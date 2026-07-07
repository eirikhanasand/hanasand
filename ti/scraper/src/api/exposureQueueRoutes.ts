import { json, numberQuery, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";

type ExposureClaimItem = {
  id?: string;
  sourceId?: string;
  sourceName?: string;
  sourceUrl?: string;
  url?: string;
  title?: string;
  text?: string;
  actor?: string;
  company?: string;
  victimName?: string;
  claimedData?: string;
  claimedDataSize?: string;
  country?: string;
  claimedCountry?: string;
  claimType?: string;
  capturedAt?: string;
  publishedAt?: string;
  confidence?: number;
  sourceFamily?: string;
};

type ParsedExposureClaim = ExposureClaimItem & {
  actor: string;
  company: string;
  claimedData: string;
  claimedDataSize: string;
  country: string;
  claimTime: string;
  capturedAt: string;
  confidence: number;
  parserMode: "hanasand-ai" | "local_fallback";
  parserQuality: "high" | "medium" | "needs_review";
  needsReview: boolean;
  summary?: string;
};

export async function listExposureQueue(url: URL, options: ApiServerOptions) {
  const limit = numberQuery(url.searchParams.get("limit")) ?? 25;
  const offset = Math.max(0, Math.floor(numberQuery(url.searchParams.get("offset")) ?? 0));
  const filters = exposureQueueFilters(url);
  const at = nowIso();
  const allItems = exposureClaimsFromStore(options.store, filters);
  const items = exposureClaimsFromStore(options.store, filters, { limit, offset });
  const latestClaimAt = latestTime(allItems.map((item: any) => item.claimTime));
  const latestCollectedAt = latestTime(allItems.map((item: any) => item.collectedAt));
  const claimAgeMinutes = ageMinutes(at, latestClaimAt);
  const collectionAgeMinutes = ageMinutes(at, latestCollectedAt);
  const age = collectionAgeMinutes ?? claimAgeMinutes;
  const fresh = (collectionAgeMinutes !== undefined && collectionAgeMinutes <= 60) || (claimAgeMinutes !== undefined && claimAgeMinutes <= 60);
  return json({
    schemaVersion: "dwm.exposure_queue.v1",
    generatedAt: at,
    status: fresh ? "live" : items.length ? "stale" : "empty",
    freshness: {
      latestClaimAt,
      latestCollectedAt,
      ageMinutes: age,
      claimAgeMinutes,
      collectionAgeMinutes,
      maxLiveAgeMinutes: 60,
      nextExpectedCollection: nextCollectionAt(at)
    },
    parser: {
      service: "hanasand-ai",
      aiEndpointConfigured: Boolean(Bun.env.HANASAND_AI_API_BASE),
      fallbackParser: "metadata-safe-ransomware-claim-parser:v1"
    },
    scheduler: {
      state: fresh ? "fresh" : "due",
      cadenceSeconds: 300,
      sourceFamilies: ["darkweb_metadata", "telegram_public", "public_advisory"],
      ingestEndpoint: "/v1/dwm/exposure-claims/ingest"
    },
    counts: {
      visible: items.length,
      total: allItems.length,
      needsReview: allItems.filter((item) => item.status === "needs_review").length,
      metadataOnly: allItems.filter((item) => item.metadataOnly).length
    },
    page: {
      limit,
      offset,
      total: allItems.length,
      nextOffset: offset + items.length < allItems.length ? offset + items.length : null,
      hasMore: offset + items.length < allItems.length
    },
    items
  });
}

export async function ingestExposureClaims(request: Request, options: ApiServerOptions) {
  const body = await readJson(request);
  const at = nowIso();
  const items: ExposureClaimItem[] = Array.isArray(body.items) ? body.items : Array.isArray(body.claims) ? body.claims : [];
  const parsed = await Promise.all(items.map((item) => parseExposureClaim(item, at)));
  const accepted = parsed
    .filter((claim) => claim.company && claim.actor)
    .map((claim) => saveExposureClaim(options.store, claim, at));

  return json({
    schemaVersion: "dwm.exposure_ingest.v1",
    generatedAt: at,
    accepted: accepted.length,
    rejected: parsed.length - accepted.length,
    parser: {
      service: "hanasand-ai",
      aiEndpointConfigured: Boolean(Bun.env.HANASAND_AI_API_BASE),
      fallbackUsed: parsed.some((claim) => claim.parserMode !== "hanasand-ai")
    },
    captures: accepted.map((capture) => ({ id: capture.id, sourceId: capture.sourceId, collectedAt: capture.collectedAt })),
    queue: exposureClaimsFromStore(options.store, {}, { limit: 25 })
  });
}

export async function enrichExposureQueueCountries(request: Request, options: ApiServerOptions) {
  const body = request.method === "POST" ? await readJson(request).catch(() => ({})) : {};
  const limit = Math.min(100, Math.max(1, Math.floor(Number(body.limit ?? 25))));
  const dryRun = body.dryRun === true;
  const fetcher = typeof options.fetch === "function" ? options.fetch as typeof fetch : fetch;
  const candidates = exposureCountryBackfillCandidates(options.store).slice(0, limit);
  const rows: Array<Record<string, unknown>> = [];

  for (const candidate of candidates) {
    const enrichment = await resolveCompanyCountryFromPublicRecords(candidate.company, fetcher);
    if (!enrichment.country) {
      rows.push({ ...candidate, status: "unresolved" });
      continue;
    }
    if (!dryRun) applyCountryEnrichment(options.store, candidate.captureId, enrichment);
    rows.push({ ...candidate, status: dryRun ? "would_update" : "updated", ...enrichment });
  }

  return json({
    schemaVersion: "dwm.exposure_country_enrichment.v1",
    generatedAt: nowIso(),
    dryRun,
    checked: rows.length,
    updated: rows.filter((row) => row.status === "updated").length,
    rows
  });
}

export async function exposureParserHealth() {
  const base = Bun.env.HANASAND_AI_API_BASE;
  const path = Bun.env.HANASAND_AI_HEALTH_PATH || "/health";
  if (!base) {
    return json({
      schemaVersion: "dwm.exposure_parser_health.v1",
      generatedAt: nowIso(),
      status: "blocked",
      blocker: "HANASAND_AI_API_BASE is not configured"
    }, 503);
  }

  const target = new URL(path, base);
  try {
    const started = Date.now();
    const response = await fetch(target, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    return json({
      schemaVersion: "dwm.exposure_parser_health.v1",
      generatedAt: nowIso(),
      status: response.ok ? "ready" : "blocked",
      endpoint: target.toString(),
      httpStatus: response.status,
      latencyMs: Date.now() - started
    }, response.ok ? 200 : 502);
  } catch (error) {
    return json({
      schemaVersion: "dwm.exposure_parser_health.v1",
      generatedAt: nowIso(),
      status: "blocked",
      endpoint: target.toString(),
      blocker: error instanceof Error ? error.message : String(error)
    }, 502);
  }
}

export async function saveExposureClaimFromCollectedItem(store: any, item: any, at = nowIso()) {
  if (!shouldPromoteExposureClaim(item)) return undefined;
  const claim = await parseExposureClaim({
    sourceId: item.sourceId,
    sourceName: item.source?.name || item.metadata?.sourceName,
    sourceUrl: item.source?.url,
    url: item.url,
    title: item.title,
    text: item.rawText || item.body,
    capturedAt: item.collectedAt || at,
    publishedAt: item.publishedAt,
    sourceFamily: item.metadata?.adapter === "public_advisory" ? "public_advisory" : item.metadata?.adapter === "telegram_public" ? "telegram_public" : undefined
  }, at);
  if (!claim.actor || !claim.company) return undefined;
  return saveExposureClaim(store, claim, at);
}

type ExposureQueueFilters = { q?: string; company?: string; actor?: string; category?: string; size?: string; country?: string; from?: string; to?: string };

function exposureQueueFilters(url: URL): ExposureQueueFilters {
  return {
    q: url.searchParams.get("q") ?? "",
    company: url.searchParams.get("company") ?? "",
    actor: url.searchParams.get("actor") ?? "",
    category: url.searchParams.get("category") ?? url.searchParams.get("data") ?? "",
    size: url.searchParams.get("size") ?? "",
    country: url.searchParams.get("country") ?? "",
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? ""
  };
}

export function exposureClaimsFromStore(store: any, filters: string | ExposureQueueFilters = "", options: { limit?: number; offset?: number } = {}) {
  const filter = typeof filters === "string" ? { q: filters } : filters;
  const needle = String(filter.q ?? "").trim().toLowerCase();
  const company = String(filter.company ?? "").trim().toLowerCase();
  const actor = String(filter.actor ?? "").trim().toLowerCase();
  const category = String(filter.category ?? "").trim().toLowerCase();
  const size = String(filter.size ?? "").trim().toLowerCase();
  const country = String(filter.country ?? "").trim().toLowerCase();
  const from = filter.from ? Date.parse(`${filter.from}T00:00:00.000Z`) : undefined;
  const to = filter.to ? Date.parse(`${filter.to}T23:59:59.999Z`) : undefined;
  const limit = Number(options.limit ?? 0);
  const boundedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(250, Math.max(1, Math.floor(limit))) : undefined;
  const offset = Math.max(0, Math.floor(Number(options.offset ?? 0)));
  const items: any[] = [];

  for (const capture of store.listCaptures?.() ?? []) {
    const source = store.getSource?.(capture.sourceId);
    if (!(capture?.metadata?.exposureClaim || capture?.metadata?.leakSite || isTrustedVictimFeedCapture(capture, source))) continue;
    if (!shouldShowExposureQueueCapture(capture, source)) continue;
    const item = exposureClaimFromCapture(capture, source);
    const time = epoch(item.claimTime ?? item.collectedAt);
    if (needle && ![item.actor, item.company, item.claimedData, item.claimedDataSize, item.country, item.sourceName, item.summary].join(" ").toLowerCase().includes(needle)) continue;
    if (company && !item.company.toLowerCase().includes(company)) continue;
    if (actor && !item.actor.toLowerCase().includes(actor)) continue;
    if (category && !item.claimedData.toLowerCase().includes(category)) continue;
    if (size && !item.claimedDataSize.toLowerCase().includes(size)) continue;
    if (country && !item.country.toLowerCase().includes(country)) continue;
    if (from !== undefined && (!time || time < from)) continue;
    if (to !== undefined && (!time || time > to)) continue;
    items.push(item);
  }

  items.sort((a: any, b: any) => epoch(b.claimTime ?? b.collectedAt) - epoch(a.claimTime ?? a.collectedAt));
  const windowed = offset ? items.slice(offset) : items;
  return boundedLimit ? windowed.slice(0, boundedLimit) : windowed;
}

function saveExposureClaim(store: any, claim: any, at: string) {
  const sourceId = claim.sourceId || stableId("src_exposure", claim.sourceName || claim.sourceUrl || claim.actor);
  if (store.saveSource && !store.getSource?.(sourceId)) {
    store.saveSource({
      id: sourceId,
      tenantId: claim.tenantId ?? "default",
      name: claim.sourceName || `${claim.actor} exposure source`,
      type: claim.sourceFamily === "public_advisory" ? "news" : "tor_metadata",
      url: claim.sourceUrl || claim.url || `metadata://darkweb/${claim.actor.toLowerCase()}/claims`,
      status: "active",
      accessMethod: "approved_proxy",
      risk: "high",
      trustScore: 0.82,
      crawlFrequencySeconds: 300,
      legalNotes: "Metadata-only monitoring of public actor-claim and advisory pages for customer exposure alerts.",
      createdAt: at,
      updatedAt: at,
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: at,
        approvedBy: "system"
      },
      metadata: { sourceFamily: claim.sourceFamily || "darkweb_metadata", automatedExposureQueue: true }
    });
  }

  const claimTime = claim.claimTime || claim.publishedAt || claim.capturedAt || at;
  const title = `${claim.actor} has just published a new victim: ${claim.company}`;
  const safeExcerpt = [
    title,
    claim.claimedData ? `Claimed data: ${claim.claimedData}.` : "New victim claim.",
    claim.summary
  ].filter(Boolean).join(" ");
  const id = claim.id || stableId("cap_exposure", `${sourceId}:${claim.actor}:${claim.company}:${claimTime}:${claim.url ?? ""}`);
  return store.saveCapture({
    id,
    tenantId: claim.tenantId ?? "default",
    sourceId,
    url: claim.url || `metadata://darkweb/${encodeURIComponent(claim.actor)}/${encodeURIComponent(claim.company)}`,
    title,
    collectedAt: claim.capturedAt || at,
    publishedAt: claimTime,
    contentHash: hashContent(`${title}:${claim.claimedData ?? ""}:${claim.claimedDataSize ?? ""}:${claimTime}:${claim.url ?? ""}`),
    mediaType: "text/plain",
    storageKind: "metadata_only",
    sensitive: true,
    sensitivityFlags: ["leak_metadata"],
    metadata: {
      exposureClaim: true,
      safeExcerpt,
      adapter: "darknet_metadata",
      sourceFamily: claim.sourceFamily || "darkweb_metadata",
      parserMode: claim.parserMode,
      parserQuality: claim.parserQuality,
      leakSite: {
        actorName: claim.actor,
        victimName: claim.company,
        claimedDataCategory: claim.claimedData || "Not disclosed by TA",
        claimedDataSize: claim.claimedDataSize || "Not disclosed by TA",
        claimedCountry: claim.country || "Not disclosed by TA",
        firstSeenAt: claimTime,
        claimType: claim.claimType || "ransomware_victim_publication"
      },
      review: {
        state: claim.needsReview ? "needs_review" : "parsed",
        reason: claim.needsReview ? "AI parser fallback or low-confidence extraction" : "Actor and victim fields parsed"
      }
    }
  });
}

async function parseExposureClaim(item: ExposureClaimItem, at: string): Promise<ParsedExposureClaim> {
  const ai = await parseWithHostedAi(item).catch(() => undefined);
  const parsed = ai || fallbackParse(item, at);
  const confidence = clamp(Number(parsed.confidence ?? item.confidence ?? 0.74));
  return {
    ...item,
    ...parsed,
    actor: cleanActorName(parsed.actor || item.actor || item.sourceName || "Unknown actor"),
    company: clean(parsed.company || parsed.victimName || item.company || item.victimName || ""),
    claimedData: clean(parsed.claimedData || item.claimedData || "Not disclosed by TA"),
    claimedDataSize: clean(parsed.claimedDataSize || item.claimedDataSize || dataSizeFromText([item.title, item.text].filter(Boolean).join(" ")) || "Not disclosed by TA"),
    country: clean(parsed.country || parsed.claimedCountry || item.country || item.claimedCountry || countryFromText([item.title, item.text].filter(Boolean).join(" ")) || countryFromCompanyDomain(parsed.company || parsed.victimName || item.company || item.victimName || "") || "Not disclosed by TA"),
    claimTime: parsed.claimTime || item.publishedAt || item.capturedAt || at,
    capturedAt: item.capturedAt || at,
    confidence,
    parserMode: ai ? "hanasand-ai" : "local_fallback",
    parserQuality: confidence >= 0.82 ? "high" : confidence >= 0.68 ? "medium" : "needs_review",
    needsReview: confidence < 0.72 || !clean(parsed.company || parsed.victimName || item.company || item.victimName)
  };
}

async function parseWithHostedAi(item: ExposureClaimItem) {
  const base = Bun.env.HANASAND_AI_API_BASE;
  if (!base) return undefined;
  const path = Bun.env.HANASAND_AI_EXPOSURE_PARSE_PATH || "/v1/parse/exposure-claim";
  const response = await fetch(new URL(path, base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ item }),
    signal: AbortSignal.timeout(Number(Bun.env.HANASAND_AI_PARSE_TIMEOUT_MS ?? "12000"))
  });
  if (!response.ok) return undefined;
  return await response.json();
}

function fallbackParse(item: ExposureClaimItem, at: string) {
  const text = [item.title, item.text].filter(Boolean).join("\n");
  const victim =
    item.company ||
    item.victimName ||
    match(text, /\bvictim\s*:?\s+([A-Z0-9][A-Za-z0-9&.,'() -]{2,90})/i) ||
    match(text, /\b(?:listed|lists|added|adds|claims?|target(?:ed|ing))\s+([A-Z0-9][A-Za-z0-9&.,'() -]{2,90})/i) ||
    match(text, /:\s*([A-Z0-9][A-Za-z0-9&.,'() -]{2,90})$/);
  const actor = cleanActorName(item.actor || match(text, /^([A-Z][A-Za-z0-9_.-]{2,40})\b/) || item.sourceName || "Unknown actor");
  const claimedData = meaningfulClaimedData(item.claimedData) || claimedDataFromText(text) || "Not disclosed by TA";
  const claimedDataSize = item.claimedDataSize || dataSizeFromText(text) || "Not disclosed by TA";
  const country = item.country || item.claimedCountry || countryFromText(text) || countryFromCompanyDomain(victim || "") || "Not disclosed by TA";
  const confidence = victim && actor !== "Unknown actor" ? 0.78 : 0.58;
  return {
    actor,
    company: victim,
    claimedData,
    claimedDataSize,
    country,
    claimTime: item.publishedAt || item.capturedAt || at,
    summary: text.slice(0, 300),
    confidence
  };
}

function looksLikeExposureClaim(item: any) {
  const text = [item?.title, item?.rawText, item?.body].filter(Boolean).join(" ");
  return /\b(ransomware|victim|leak site|actor page|claimed|claims|listed|published|extortion|breach|data leak)\b/i.test(text)
    && /\b(company|supplier|vendor|victim|GB|TB|data|records|dump|exfiltrat)/i.test(text);
}

function shouldPromoteExposureClaim(item: any) {
  if (item?.metadata?.leakSite) return true;
  const title = String(item?.title ?? "");
  const sourceName = String(item?.source?.name ?? item?.metadata?.sourceName ?? item?.sourceName ?? "");
  const sourceId = String(item?.sourceId ?? "");
  const sourceFamily = String(item?.metadata?.sourceFamily ?? item?.sourceFamily ?? item?.metadata?.adapter ?? "");
  const sourceText = `${sourceId} ${sourceName} ${sourceFamily}`;
  if (isGenericReferenceSource(sourceText)) return false;
  const actorClaimTitle = /\b(has just published a new victim|claims victim|claim(?:ed|s)? victim|victim\s*:|added victim|listed victim|published victim)\b/i.test(title);
  const trustedClaimSource = /\b(victim feed|ransomware\.live victim|ransomlook|leak site|extortion|darkweb|darknet|actor claim)\b/i.test(sourceText);
  return (actorClaimTitle || trustedClaimSource) && looksLikeExposureClaim(item);
}

function shouldShowExposureQueueCapture(capture: any, source?: any) {
  const leak = capture.metadata?.leakSite ?? {};
  const sourceText = `${capture.sourceId ?? ""} ${source?.name ?? ""} ${source?.metadata?.sourceFamily ?? ""}`;
  if (isGenericReferenceSource(sourceText)) return false;
  if (isTrustedVictimFeedCapture(capture, source)) return true;
  if (!leak.actorName || !leak.victimName) return false;
  if (String(capture.sourceId ?? "").startsWith("src_qa_")) return true;
  if (/\b(victim feed|ransomware\.live victim|ransomlook|leak site|extortion|darkweb|darknet|actor claim|tor_metadata|i2p_metadata|freenet_metadata)\b/i.test(sourceText)) return true;
  return /\b(has just published a new victim|claims victim|claim(?:ed|s)? victim|victim\s*:|added victim|listed victim|published victim)\b/i.test(String(capture.metadata?.safeExcerpt ?? capture.title ?? ""));
}

function isGenericReferenceSource(sourceText: string) {
  if (/\b(victim feed|actor claim|leak site|extortion|darkweb|darknet)\b/i.test(sourceText)) return false;
  return /\b(cisa known exploited|known exploited vulnerabilities|mitre att&ck|attack enterprise|groups dataset|public groups dataset|nvd recent cve|github advisory database)\b/i.test(sourceText);
}

function isTrustedVictimFeedCapture(capture: any, source?: any) {
  const sourceText = `${capture?.sourceId ?? ""} ${source?.name ?? ""} ${source?.metadata?.sourceFamily ?? ""}`;
  if (isGenericReferenceSource(sourceText)) return false;
  if (!/\b(victim feed|ransomware\.live victim|ransomlook|leak site|extortion|darkweb|darknet|actor claim|tor_metadata|i2p_metadata|freenet_metadata)\b/i.test(sourceText)) return false;
  return Boolean(parseVictimClaimTitle(String(capture?.title ?? capture?.metadata?.safeExcerpt ?? "")));
}

function exposureClaimFromCapture(capture: any, source?: any) {
  const leak = capture.metadata?.leakSite ?? {};
  const parsedTitle = parseVictimClaimTitle(String(capture.title ?? capture.metadata?.safeExcerpt ?? ""));
  const firstSeen = leak.firstSeenAt || capture.publishedAt || capture.collectedAt;
  const ageMinutes = Math.max(0, Math.round((Date.now() - Date.parse(firstSeen || capture.collectedAt || nowIso())) / 60_000));
  const confidence = capture.metadata?.parserQuality === "high" ? 0.9 : capture.metadata?.parserQuality === "medium" ? 0.78 : 0.64;
  const text = [capture.title, capture.body, capture.rawText, capture.metadata?.safeExcerpt].filter(Boolean).join(" ");
  return {
    id: capture.id,
    sourceId: capture.sourceId,
    sourceName: source?.name || capture.sourceId,
    actor: leak.actorName || capture.metadata?.actor || parsedTitle?.actor || "Unknown actor",
    company: leak.victimName || capture.metadata?.victimName || parsedTitle?.company || "Unknown company",
    claimedData: meaningfulClaimedData(leak.claimedDataCategory) || claimedDataFromText(text) || "Not disclosed by TA",
    claimedDataSize: leak.claimedDataSize || leak.dataSize || dataSizeFromText(text) || "Not disclosed by TA",
    country: clean(leak.claimedCountry || leak.country || capture.metadata?.country || countryFromText(text) || countryFromCompanyDomain(leak.victimName || capture.metadata?.victimName || parsedTitle?.company || "") || "Not disclosed by TA"),
    claimType: leak.claimType || "ransomware_victim_publication",
    claimTime: firstSeen,
    collectedAt: capture.collectedAt,
    status: capture.metadata?.review?.state === "needs_review" ? "needs_review" : ageMinutes <= 60 ? "new" : "parsed",
    confidence,
    freshnessMinutes: ageMinutes,
    metadataOnly: capture.storageKind === "metadata_only",
    url: capture.url?.startsWith("http") ? capture.url : undefined,
    summary: capture.metadata?.safeExcerpt || capture.title || "",
    provenanceHash: hashContent(capture.id)
  };
}

function exposureCountryBackfillCandidates(store: any) {
  const rows: Array<{ captureId: string; company: string; actor: string; sourceName: string }> = [];
  for (const capture of store.listCaptures?.() ?? []) {
    const source = store.getSource?.(capture.sourceId);
    if (!shouldShowExposureQueueCapture(capture, source)) continue;
    const leak = capture.metadata?.leakSite ?? {};
    if (!missingCountry(leak.claimedCountry || leak.country || capture.metadata?.country)) continue;
    const item = exposureClaimFromCapture(capture, source);
    rows.push({ captureId: capture.id, company: item.company, actor: item.actor, sourceName: item.sourceName });
  }
  return rows.filter((row) => row.company && row.company !== "Unknown company");
}

function applyCountryEnrichment(store: any, captureId: string, enrichment: CountryEnrichment) {
  store.updateCaptureMetadata?.(captureId, (metadata: any) => ({
    ...metadata,
    countryEnrichment: {
      provider: "public_news_records",
      country: enrichment.country,
      confidence: enrichment.confidence,
      evidence: enrichment.evidence,
      updatedAt: nowIso()
    },
    leakSite: {
      ...(metadata.leakSite ?? {}),
      claimedCountry: enrichment.country
    }
  }));
}

type CountryEnrichment = { country: string; confidence: number; evidence: Array<{ source: string; title: string; url?: string }> };

export async function resolveCompanyCountryFromPublicRecords(company: string, fetcher: typeof fetch = fetch): Promise<CountryEnrichment> {
  const domainCountry = countryFromCompanyDomain(company);
  if (domainCountry) {
    return {
      country: domainCountry,
      confidence: 0.68,
      evidence: [{ source: "Public domain registry", title: `${company} uses a country-code domain for ${domainCountry}` }]
    };
  }
  const records = await publicCountryRecords(company, fetcher);
  const evidence = records.flatMap((record) => countryEvidenceFromRecord(company, record));
  const counts = new Map<string, number>();
  for (const item of evidence) counts.set(item.country, (counts.get(item.country) ?? 0) + 1);
  const [country, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  return {
    country,
    confidence: country ? Math.min(0.95, count >= 2 ? 0.86 : 0.72) : 0,
    evidence: evidence.filter((item) => item.country === country).slice(0, 3).map(({ country: _country, ...item }) => item)
  };
}

async function publicCountryRecords(company: string, fetcher: typeof fetch) {
  const query = `"${company}" ("headquartered in" OR "based in" OR "located in" OR "incorporated in")`;
  const urls = [
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&format=json&maxrecords=10&sort=DateDesc`,
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  ];
  const responses = await Promise.all(urls.map((url) => fetchText(url, fetcher)));
  return [
    ...gdeltRecords(responses[0] ?? ""),
    ...googleNewsRecords(responses[1] ?? "")
  ];
}

async function fetchText(url: string, fetcher: typeof fetch) {
  try {
    const response = await fetcher(url, { headers: { "user-agent": "HanasandCountryEnrichment/1.0" }, signal: AbortSignal.timeout(5000) } as RequestInit);
    return response.ok ? await response.text() : "";
  } catch {
    return "";
  }
}

function gdeltRecords(text: string) {
  try {
    const json = JSON.parse(text);
    return Array.isArray(json.articles) ? json.articles.map((item: any) => ({ source: "GDELT", title: clean(item.title), url: clean(item.url) })) : [];
  } catch {
    return [];
  }
}

function googleNewsRecords(xml: string) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(([item]) => ({
    source: "Google News",
    title: decodeXml(item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/i)?.[1] ?? item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
    url: decodeXml(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "")
  }));
}

function countryEvidenceFromRecord(company: string, record: { source: string; title: string; url?: string }) {
  const text = clean(record.title);
  if (!containsCompany(text, company)) return [];
  return countryNames().flatMap((country) => countryMentionIsCompanyLocation(text, country) ? [{ ...record, country }] : []);
}

function containsCompany(text: string, company: string) {
  const normalizedText = simplifyCompanyName(text);
  const normalizedCompany = simplifyCompanyName(company);
  return normalizedCompany.length >= 3 && normalizedText.includes(normalizedCompany);
}

function countryMentionIsCompanyLocation(text: string, country: string) {
  const c = escapeRegex(country);
  return new RegExp(`\\b(?:headquartered|based|located|incorporated)\\s+(?:in|at)\\s+(?:the\\s+)?${c}\\b`, "i").test(text)
    || new RegExp(`\\b${c}\\s*-\\s*based\\b`, "i").test(text)
    || new RegExp(`\\b(?:${c})\\s+(?:company|firm|business|organization|hospital|school|manufacturer|provider)\\b`, "i").test(text);
}

let cachedCountryNames: string[] | undefined;
function countryNames() {
  if (cachedCountryNames) return cachedCountryNames;
  const names = new Set(["United States", "United Kingdom", "Norway", "Canada", "Australia", "Germany", "France", "Italy", "Spain", "Netherlands", "Sweden", "Denmark", "Finland", "Ireland", "India", "Japan", "China", "Brazil", "Mexico"]);
  try {
    const display = new Intl.DisplayNames(["en"], { type: "region" });
    for (const code of Intl.supportedValuesOf("region" as any)) {
      const name = display.of(code);
      if (name && /^[A-Za-z .'-]+$/.test(name)) names.add(name);
    }
  } catch {}
  cachedCountryNames = [...names].sort((a, b) => b.length - a.length);
  return cachedCountryNames;
}

function simplifyCompanyName(value: string) {
  return value.toLowerCase().replace(/\b(?:inc|llc|ltd|limited|corp|corporation|company|co|group|plc|sa|ag|as|bv|gmbh)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function missingCountry(value: unknown) {
  return !clean(value) || /^not disclosed by ta$/i.test(clean(value));
}

function countryFromCompanyDomain(value: unknown) {
  const host = clean(value).toLowerCase().match(/\b(?:[a-z0-9-]+\.)+([a-z]{2,})\b/)?.[0];
  const suffix = host?.split(".").pop() ?? "";
  if (suffix === "gov" || suffix === "mil") return "United States";
  if (suffix.length !== 2) return "";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(suffix.toUpperCase()) ?? "";
  } catch {
    return ({ br: "Brazil", no: "Norway", uk: "United Kingdom", us: "United States", ca: "Canada", au: "Australia" } as Record<string, string>)[suffix] ?? "";
  }
}

function decodeXml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseVictimClaimTitle(title: string) {
  const normalized = victimClaimHeadline(title);
  const direct = normalized.match(/^(.+?)\s+has just published a new victim\s*:?\s*(.+)$/i)
    || normalized.match(/^(.+?)\s+(?:claims?|claimed|listed|added|published)\s+victim\s*:?\s*(.+)$/i);
  if (!direct) return undefined;
  const actor = stripVictimFeedPrefix(direct[1]);
  const company = clean(direct[2]);
  if (!actor || !company || actor.length > 80 || company.length > 140) return undefined;
  return { actor, company };
}

function victimClaimHeadline(value: unknown) {
  const lines = String(value ?? "")
    .split(/\r?\n/)
    .map((line) => stripVictimFeedPrefix(line))
    .filter(Boolean);
  return lines.find((line) => /\b(has just published a new victim|claims victim|claim(?:ed|s)? victim|victim\s*:|added victim|listed victim|published victim)\b/i.test(line))
    || stripVictimFeedPrefix(value);
}

function stripVictimFeedPrefix(value: unknown) {
  return clean(String(value ?? "")
    .replace(/^Ransomware\.live Victim Feed\s+/i, "")
    .replace(/^[^A-Za-z0-9]+/, ""));
}

function cleanActorName(value: unknown) {
  return clean(stripVictimFeedPrefix(value)
    .replace(/\s+(?:has just published a new victim|claims? victim|claim(?:ed|s)? victim|listed victim|added victim|published victim)\b.*$/i, ""));
}

function claimedDataFromText(text: string) {
  const normalized = clean(text).toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/\b(usernames?\s+(?:and|&)\s+passwords?|credentials?|login\s+data|account\s+credentials?)\b/i, "Usernames and passwords"],
    [/\b(patient|medical|healthcare|health)\s+(records?|data|files?|information)\b/i, "Patient records"],
    [/\b(customer|client)\s+(records?|data|files?|information|database)\b/i, "Customer data"],
    [/\b(employee|staff|hr)\s+(records?|data|files?|information)\b/i, "Employee data"],
    [/\b(financial|banking|payment)\s+(records?|data|files?|information)\b/i, "Financial records"],
    [/\b(source\s+code|git\s+repositories?)\b/i, "Source code"],
    [/\b(email|mailbox|mailboxes|emails)\b/i, "Email"],
    [/\b(invoices?|contracts?|legal\s+documents?)\b/i, "Business documents"],
    [/\b(database|databases|sql\s+dump|db\s+dump)\b/i, "Database"],
    [/\b(backups?|archive|archives?)\b/i, "Backups"],
    [/\b(corporate|company)\s+data\b/i, "Corporate data"],
    [/\b(documents?|files?)\b/i, "Documents"]
  ];
  return patterns.find(([pattern]) => pattern.test(normalized))?.[1] ?? "";
}

function dataSizeFromText(text: string) {
  const found = text.match(/\b(\d+(?:\.\d+)?)\s*(GB|TB|MB)\b/i);
  return found ? clean(`${found[1]} ${found[2].toUpperCase()}`) : "";
}

function countryFromText(text: string) {
  return match(text, /\bcountry\s*:?\s*([A-Z][A-Za-z .'-]{1,60}|[A-Z]{2})\b/i);
}

function meaningfulClaimedData(value: unknown) {
  const cleaned = clean(value);
  if (!cleaned || /^new (?:victim|exposure) claim$/i.test(cleaned)) return "";
  if (/^\d+(?:\.\d+)?\s*(?:GB|TB|MB)\b/i.test(cleaned)) return "";
  return cleaned;
}

function nextCollectionAt(at: string) {
  return new Date(Date.parse(at) + 5 * 60_000).toISOString();
}

function latestTime(values: unknown[]) {
  const latest = values
    .map((value) => String(value ?? ""))
    .filter(Boolean)
    .sort((a, b) => epoch(b) - epoch(a))[0];
  return latest;
}

function ageMinutes(now: string, value?: string) {
  if (!value) return undefined;
  const then = epoch(value);
  if (!then) return undefined;
  return Math.max(0, Math.round((Date.parse(now) - then) / 60_000));
}

function epoch(value: unknown) {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? time : 0;
}

function match(text: string, regex: RegExp) {
  return clean(text.match(regex)?.[1] ?? "");
}

function clean(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").replace(/[.。]+$/, "").trim();
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0.58;
  return Math.max(0, Math.min(1, value));
}
