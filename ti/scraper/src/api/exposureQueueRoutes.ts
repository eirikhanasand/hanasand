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
  const query = url.searchParams.get("q") ?? "";
  const at = nowIso();
  const items = exposureClaimsFromStore(options.store, query)
    .slice(0, limit);
  const latestClaimAt = latestTime(items.map((item: any) => item.claimTime));
  const latestCollectedAt = latestTime(items.map((item: any) => item.collectedAt));
  const claimAgeMinutes = ageMinutes(at, latestClaimAt);
  const collectionAgeMinutes = ageMinutes(at, latestCollectedAt);
  const age = collectionAgeMinutes ?? claimAgeMinutes;
  const fresh = (collectionAgeMinutes !== undefined && collectionAgeMinutes <= 60) || (claimAgeMinutes !== undefined && claimAgeMinutes <= 60);
  return json({
    schemaVersion: "dwm.exposure_queue.v1",
    generatedAt: at,
    status: fresh ? "live" : items.length ? "stale" : "waiting_for_collection",
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
      needsReview: items.filter((item) => item.status === "needs_review").length,
      metadataOnly: items.filter((item) => item.metadataOnly).length
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
    queue: exposureClaimsFromStore(options.store, "").slice(0, 25)
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

export function exposureClaimsFromStore(store: any, query = "") {
  const needle = query.trim().toLowerCase();
  return (store.listCaptures?.() ?? [])
    .map((capture: any) => ({ capture, source: store.getSource?.(capture.sourceId) }))
    .filter(({ capture, source }: any) => capture?.metadata?.exposureClaim || capture?.metadata?.leakSite || isTrustedVictimFeedCapture(capture, source))
    .filter(({ capture, source }: any) => shouldShowExposureQueueCapture(capture, source))
    .map(({ capture, source }: any) => exposureClaimFromCapture(capture, source))
    .filter((item: any) => !needle || [item.actor, item.company, item.claimedData, item.sourceName, item.summary].join(" ").toLowerCase().includes(needle))
    .sort((a: any, b: any) => epoch(b.claimTime ?? b.collectedAt) - epoch(a.claimTime ?? a.collectedAt));
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
    contentHash: hashContent(`${title}:${claim.claimedData ?? ""}:${claimTime}:${claim.url ?? ""}`),
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
        claimedDataCategory: claim.claimedData || "new victim claim",
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
    actor: clean(parsed.actor || item.actor || item.sourceName || "Unknown actor"),
    company: clean(parsed.company || parsed.victimName || item.company || item.victimName || ""),
    claimedData: clean(parsed.claimedData || item.claimedData || "new victim claim"),
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
    signal: AbortSignal.timeout(4500)
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
  const actor = item.actor || match(text, /^([A-Z][A-Za-z0-9_.-]{2,40})\b/) || item.sourceName || "Unknown actor";
  const claimedData = item.claimedData || match(text, /\b(\d+(?:\.\d+)?\s*(?:GB|TB|MB)\s+(?:claimed|leaked|stolen|exfiltrated|data))/i) || "new victim claim";
  const confidence = victim && actor !== "Unknown actor" ? 0.78 : 0.58;
  return {
    actor,
    company: victim,
    claimedData,
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
    claimedData: leak.claimedDataCategory || match(text, /\b(\d+(?:\.\d+)?\s*(?:GB|TB|MB)\s+(?:claimed|leaked|stolen|exfiltrated|data))/i) || "new victim claim",
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

function parseVictimClaimTitle(title: string) {
  const normalized = stripVictimFeedPrefix(title);
  const direct = normalized.match(/^(.+?)\s+has just published a new victim\s*:?\s*(.+)$/i)
    || normalized.match(/^(.+?)\s+(?:claims?|claimed|listed|added|published)\s+victim\s*:?\s*(.+)$/i);
  if (!direct) return undefined;
  const actor = stripVictimFeedPrefix(direct[1]);
  const company = clean(direct[2]);
  if (!actor || !company || actor.length > 80 || company.length > 140) return undefined;
  return { actor, company };
}

function stripVictimFeedPrefix(value: unknown) {
  return clean(String(value ?? "")
    .replace(/^Ransomware\.live Victim Feed\s+/i, "")
    .replace(/^[^A-Za-z0-9]+/, ""));
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
