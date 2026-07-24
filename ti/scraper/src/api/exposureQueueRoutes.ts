import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { error, json, numberQuery, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";
import { resolveOrganizationScope } from "./organizationRoutes.ts";
import { authenticateRequest, type AuthenticatedIdentity } from "./requestAuthentication.ts";
import { resolveTenantScope } from "./tenantScope.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { StaticWebAdapter, canonicalizeUrl } from "../adapters/staticWeb.ts";
import { sourceCollectionLane } from "../policy/collectionPolicy.ts";
import { privateTarget } from "../registry/sourceRegistry.ts";
import { publicSourceReferenceUrl, sourceFieldReportTimestamp, zonedSourceTimestamp } from "../pipeline/sourceFieldReportTimestamp.ts";

const PUBLIC_ADVISORY_MAX_BYTES = 2_000_000;

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
  tenantId?: string;
  organizationId?: string;
  reportTimestamps?: Array<Record<string, unknown>>;
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
  parserMode: "hanasand-ai" | "local_fallback" | "public_advisory_fetch";
  parserQuality: "high" | "medium" | "needs_review";
  needsReview: boolean;
  evidenceContentHash: string;
  summary?: string;
  links?: string[];
  adapterMetadata?: Record<string, unknown>;
};

export async function listExposureQueue(request: Request, url: URL, options: ApiServerOptions) {
  const scope = resolveTenantScope(request, url);
  if (scope.error) return scope.error;
  const tenantId = scope.tenantId ?? "default";
  const limit = Math.min(250, Math.max(1, Math.floor(numberQuery(url.searchParams.get("limit")) ?? 25)));
  const offset = Math.max(0, Math.floor(numberQuery(url.searchParams.get("offset")) ?? 0));
  const filters = exposureQueueFilters(url);
  const at = nowIso();
  const allItems = exposureClaimsFromStore(options.store, filters, { tenantId });
  const items = exposureClaimsFromStore(options.store, filters, { limit, offset, tenantId });
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
  const authentication = await authenticateRequest(request, options);
  if (authentication.error) return authentication.error;
  const body = await readJson(request);
  const scope = exposureWriteScope(request, body, options, authentication.identity!);
  if (scope.error) return scope.error;
  const at = nowIso();
  const submitted = Array.isArray(body.items) ? body.items : Array.isArray(body.claims) ? body.claims : [];
  if (!submitted.length) return error("missing_exposure_claims", "Submit at least one metadata-only exposure claim", 400);
  if (submitted.length > 100) return error("exposure_batch_too_large", "At most 100 exposure claims may be submitted at once", 413);
  const items = submitted.map(exposureClaimInput).filter((item): item is ExposureClaimItem => Boolean(item));
  const parsed = await Promise.all(items.map((item) => item.sourceFamily === "public_advisory"
    ? collectPublicAdvisory(item, options, scope, at).catch(() => undefined)
    : parseExposureClaim(item, at)));
  const accepted = parsed
    .filter((claim): claim is ParsedExposureClaim => Boolean(claim))
    .filter((claim) => claim.company && (claim.parserMode === "public_advisory_fetch" || claim.actor))
    .map((claim) => saveExposureClaim(options.store, claim, at, scope))
    .filter(Boolean);

  return json({
    schemaVersion: "dwm.exposure_ingest.v1",
    generatedAt: at,
    accepted: accepted.length,
    rejected: submitted.length - accepted.length,
    parser: {
      service: "hanasand-ai",
      aiEndpointConfigured: Boolean(Bun.env.HANASAND_AI_API_BASE),
      fallbackUsed: parsed.some((claim) => claim?.parserMode !== "hanasand-ai")
    },
    captures: accepted.map((capture) => ({ id: capture.id, sourceId: capture.sourceId, collectedAt: capture.collectedAt })),
    queue: exposureClaimsFromStore(options.store, {}, { limit: 25, tenantId: scope.tenantId })
  });
}

export async function enrichExposureQueueCountries(request: Request, options: ApiServerOptions) {
  const authentication = await authenticateRequest(request, options);
  if (authentication.error) return authentication.error;
  const body = request.method === "POST" ? await readJson(request).catch(() => ({})) : {};
  const scope = exposureWriteScope(request, body, options, authentication.identity!);
  if (scope.error) return scope.error;
  const limit = Math.min(100, Math.max(1, Math.floor(Number(body.limit ?? 25))));
  const dryRun = body.dryRun === true;
  const fetcher = typeof options.fetch === "function" ? options.fetch as typeof fetch : fetch;
  const candidates = exposureCountryBackfillCandidates(options.store, scope.tenantId).slice(0, limit);
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
    reportTimestamps: item.metadata?.reportTimestamps,
    sourceFamily: item.metadata?.adapter === "public_advisory" ? "public_advisory" : item.metadata?.adapter === "telegram_public" ? "telegram_public" : undefined
  }, at);
  if (!claim.actor || !claim.company) return undefined;
  return saveExposureClaim(store, claim, at, { tenantId: item.tenantId ?? "default", organizationId: item.organizationId, submittedBy: "collector" });
}

type ExposureQueueFilters = { q?: string; company?: string; actor?: string; category?: string; size?: string; country?: string; from?: string; to?: string };

type ExposureWriteScope = {
  tenantId: string;
  organizationId?: string;
  submittedBy: string;
  error?: Response;
};

function exposureWriteScope(request: Request, body: any, options: ApiServerOptions, identity: AuthenticatedIdentity): ExposureWriteScope {
  const submitted = Array.isArray(body.items) ? body.items : Array.isArray(body.claims) ? body.claims : [];
  const tenantIds = uniqueScopeValues(body.tenantId, ...submitted.map((item: any) => item?.tenantId));
  const organizationIds = uniqueScopeValues(body.organizationId, ...submitted.map((item: any) => item?.organizationId));
  if (tenantIds.length > 1 || organizationIds.length > 1) {
    return { tenantId: "", submittedBy: identity.id, error: error("exposure_scope_mismatch", "Every exposure claim in a batch must use the same tenant and organization scope", 403) };
  }
  const scope = resolveOrganizationScope({
    request,
    url: new URL(request.url),
    body: { tenantId: tenantIds[0], organizationId: organizationIds[0] }
  }, options);
  if (scope.error) return { tenantId: scope.tenantId, organizationId: scope.organizationId, submittedBy: identity.id, error: scope.error };
  if (scope.tenantId !== "default" && !scope.organizationId) {
    return { tenantId: scope.tenantId, submittedBy: identity.id, error: error("organization_scope_required", "Non-default tenant writes require an organization scope", 403) };
  }
  if (scope.organizationId) {
    const member = ((options.store as any).listOrganizationMembers?.() ?? []).find((row: any) => row.organizationId === scope.organizationId
      && row.status === "active"
      && [row.id, row.userId, row.email].some((value) => String(value ?? "").toLowerCase() === identity.id.toLowerCase()));
    if (!member) return { tenantId: scope.tenantId, organizationId: scope.organizationId, submittedBy: identity.id, error: error("organization_visibility_denied", "Exposure intake requires active organization membership", 403) };
    if (member.role === "viewer") return { tenantId: scope.tenantId, organizationId: scope.organizationId, submittedBy: identity.id, error: error("exposure_intake_read_only", "Viewer members cannot submit or enrich exposure claims", 403) };
  }
  return { tenantId: scope.tenantId, organizationId: scope.organizationId, submittedBy: identity.id };
}

function exposureClaimInput(value: unknown): ExposureClaimItem | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item: any = value;
  const sourceFamily = ["darkweb_metadata", "telegram_public", "public_advisory", "public_actor_claims"].includes(item.sourceFamily) ? item.sourceFamily : "manual_metadata";
  const sourceUrl = submittedUrl(item.sourceUrl);
  const url = submittedUrl(item.url);
  const text = boundedText(item.text, 2000);
  const title = boundedText(item.title, 240);
  if ((item.text !== undefined && !text) || (item.title !== undefined && !title)) return undefined;
  if ((!text && !title && !(item.actor && (item.company || item.victimName)) && !(sourceFamily === "public_advisory" && (sourceUrl || url) && item.company)) || unsafeSubmittedText(text)) return undefined;
  if ((item.sourceUrl && !sourceUrl) || (item.url && !url)) return undefined;
  return {
    sourceId: /^[A-Za-z0-9_.:-]{1,200}$/.test(String(item.sourceId ?? "")) ? String(item.sourceId) : undefined,
    sourceName: boundedText(item.sourceName, 160),
    sourceUrl,
    url,
    title,
    text,
    actor: boundedText(item.actor, 80),
    company: boundedText(item.company, 140),
    victimName: boundedText(item.victimName, 140),
    claimedData: boundedText(item.claimedData, 240),
    claimedDataSize: boundedText(item.claimedDataSize, 80),
    country: boundedText(item.country, 80),
    claimedCountry: boundedText(item.claimedCountry, 80),
    claimType: boundedText(item.claimType, 80),
    capturedAt: validTimestamp(item.capturedAt),
    publishedAt: validTimestamp(item.publishedAt),
    confidence: Number.isFinite(Number(item.confidence)) ? clamp(Number(item.confidence)) : undefined,
    sourceFamily
  };
}

function uniqueScopeValues(...values: unknown[]) {
  return [...new Set(values.map((value) => typeof value === "string" ? value.trim() : "").filter(Boolean))];
}

function boundedText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\0/g, "").replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= max ? normalized : undefined;
}

function unsafeSubmittedText(value?: string) {
  return Boolean(value && (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*\S+/i.test(value) || (value.match(/@/g)?.length ?? 0) > 10));
}

function submittedUrl(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    const url = new URL(String(value));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.toString().length > 2048) return undefined;
    if (/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|::1$)/i.test(url.hostname)) return undefined;
    if ([...url.searchParams.keys()].some((key) => /token|secret|password|authorization|cookie|api[_-]?key|signature/i.test(key))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function validTimestamp(value: unknown): string | undefined {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

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

export function exposureClaimsFromStore(store: any, filters: string | ExposureQueueFilters = "", options: { limit?: number; offset?: number; tenantId?: string } = {}) {
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
    if (Object.hasOwn(options, "tenantId") && normalizedTenantId(capture.tenantId) !== normalizedTenantId(options.tenantId)) continue;
    const source = store.getSource?.(capture.sourceId);
    if (source && normalizedTenantId(source.tenantId) !== normalizedTenantId(capture.tenantId)) continue;
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

function saveExposureClaim(store: any, claim: any, at: string, scope: { tenantId: string; organizationId?: string; submittedBy?: string }) {
  if (claim.parserMode === "public_advisory_fetch") return savePublicAdvisory(store, claim, at, scope);
  const requestedSourceId = /^[A-Za-z0-9_.:-]{1,200}$/.test(String(claim.sourceId ?? "")) ? String(claim.sourceId) : undefined;
  const sourceId = requestedSourceId || stableId("src_exposure", `${scope.tenantId}:${claim.sourceName || claim.sourceUrl || claim.actor}`);
  const existingSource = store.getSource?.(sourceId);
  if (existingSource && (existingSource.tenantId || "default") !== scope.tenantId) return undefined;
  if (store.saveSource && !existingSource) {
    store.saveSource({
      id: sourceId,
      tenantId: scope.tenantId,
      name: claim.sourceName || `${claim.actor} exposure source`,
      type: claim.sourceFamily === "public_advisory" ? "news" : "metadata_intake",
      url: claim.sourceUrl || claim.url || `metadata://exposure/${encodeURIComponent(claim.actor)}/claims`,
      status: "candidate",
      accessMethod: "manual_submission",
      risk: "high",
      trustScore: 0.5,
      crawlFrequencySeconds: 300,
      legalNotes: "Metadata-only analyst submission pending source and collection approval.",
      createdAt: at,
      updatedAt: at,
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: true,
        submittedAt: at,
        submittedBy: scope.submittedBy
      },
      metadata: { sourceFamily: claim.sourceFamily || "darkweb_metadata", exposureQueueIntake: true, organizationId: scope.organizationId }
    });
  }

  const sourcePublishedAt = validTimestamp(claim.publishedAt);
  const claimTime = claim.claimTime || sourcePublishedAt || claim.capturedAt || at;
  const title = `${claim.actor} has just published a new victim: ${claim.company}`;
  const safeExcerpt = [title, claim.claimedData ? `Claimed data category: ${claim.claimedData}.` : undefined, claim.claimedDataSize ? `Claimed size: ${claim.claimedDataSize}.` : undefined, claim.country ? `Claimed country: ${claim.country}.` : undefined].filter(Boolean).join(" ");
  const pipeline = processCollectedItem({
    tenantId: scope.tenantId,
    sourceId,
    url: claim.url || `metadata://exposure/${encodeURIComponent(claim.actor)}/${encodeURIComponent(claim.company)}`,
    title,
    collectedAt: claim.capturedAt || at,
    publishedAt: sourcePublishedAt,
    contentHash: claim.evidenceContentHash,
    rawText: safeExcerpt,
    links: [],
    sensitive: true,
    metadata: {
      exposureClaim: true,
      organizationId: scope.organizationId,
      submittedBy: scope.submittedBy,
      safeExcerpt,
      adapter: "darknet_metadata",
      sourceFamily: claim.sourceFamily || "darkweb_metadata",
      parserMode: claim.parserMode,
      parserQuality: claim.parserQuality,
      reportTimestamps: claim.reportTimestamps,
      extractionProfile: "ransomware_victim_blog",
      leakSite: {
        actorName: claim.actor,
        victimName: claim.company,
        summary: claim.summary,
        claimedDataCategory: claim.claimedData || "Not disclosed by TA",
        claimedDataType: claim.claimedData || "Not disclosed by TA",
        claimedDataSize: claim.claimedDataSize || "Not disclosed by TA",
        claimedCountry: claim.country || "Not disclosed by TA",
        channelType: claim.sourceFamily === "public_advisory" ? "public victim-claim feed" : claim.sourceFamily === "telegram_public" ? "public Telegram" : undefined,
        firstSeenAt: sourcePublishedAt,
        claimType: claim.claimType || "ransomware_victim_publication"
      },
      review: {
        state: claim.needsReview ? "needs_review" : "parsed",
        reason: claim.needsReview ? "AI parser fallback or low-confidence extraction" : "Actor and victim fields parsed"
      }
    }
  }, { actorIdentities: store.listActorIdentities?.() ?? [] });
  pipeline.capture.title = title;
  return store.savePipelineResult(pipeline).capture;
}

async function collectPublicAdvisory(item: ExposureClaimItem, options: ApiServerOptions, scope: { tenantId: string; organizationId?: string }, at: string): Promise<ParsedExposureClaim | undefined> {
  const requestedUrl = item.sourceUrl || item.url;
  const company = boundedText(item.company || item.victimName, 140);
  if (!requestedUrl || !company || new URL(requestedUrl).protocol !== "https:") return undefined;
  const fetchSourceId = publicAdvisorySourceIdentity(requestedUrl, options.store.listSources?.()).id;
  const source = {
    id: fetchSourceId,
    tenantId: scope.tenantId,
    name: `Public incident report ${new URL(requestedUrl).hostname}`,
    type: "static_web",
    url: requestedUrl,
    accessMethod: "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.7,
    crawlFrequencySeconds: 3600,
    legalNotes: "Public incident reporting collected without credentials, form submission, downloads, or access-control bypass.",
    createdAt: at,
    updatedAt: at
  };
  const timeoutMs = publicAdvisoryTimeout(options);
  const adapter = new StaticWebAdapter({ fetcher: publicAdvisoryFetcher(options.fetch as typeof fetch | undefined, timeoutMs), timeoutMs });
  const result = await adapter.collect(source, {
    id: stableId("task_public_advisory", `${scope.tenantId}:${scope.organizationId ?? ""}:${requestedUrl}`),
    tenantId: scope.tenantId,
    sourceId: fetchSourceId,
    targetUrl: requestedUrl,
    status: "queued",
    retryCount: 0,
    maxBytes: PUBLIC_ADVISORY_MAX_BYTES
  });
  const collected = result.items[0];
  const text = String(collected?.rawText ?? "").replace(/\s+/g, " ").trim().slice(0, 20_000);
  if (!collected || !text || !termOccursInText(text, company) || !cyberIncidentText(text)) return undefined;
  const publishedAt = publicationTimestampFromHtml(String(collected.html ?? ""));
  const collectedAt = validTimestamp(collected.collectedAt) || at;
  if (!publishedAt || Date.parse(publishedAt) > Date.parse(collectedAt) + 300_000) return undefined;
  const title = String(collected.title ?? "").replace(/\s+/g, " ").trim().slice(0, 240) || `${company} public incident report`;
  const collectedUrl = submittedUrl(collected.url);
  const url = collectedUrl && new URL(collectedUrl).protocol === "https:" ? collectedUrl : requestedUrl;
  const publisher = publicAdvisorySourceIdentity(url, options.store.listSources?.());
  const sourceId = publisher.id;
  const reportTimestamp = sourceFieldReportTimestamp({
    role: "publisher",
    timestamp: publishedAt,
    referenceUrl: url,
    sourceId,
    evidencePath: "page.publicationTimestamp"
  });
  return {
    ...item,
    sourceId,
    sourceName: publisher.existing?.name || `Public advisory publisher ${new URL(publisher.url).hostname}`,
    sourceUrl: publisher.url,
    url,
    title,
    text,
    actor: "",
    company,
    claimedData: "Public incident report",
    claimedDataSize: "Not stated by source",
    country: item.country || "Not stated by source",
    publishedAt,
    claimTime: publishedAt,
    capturedAt: collectedAt,
    confidence: 0.9,
    parserMode: "public_advisory_fetch",
    parserQuality: "high",
    needsReview: true,
    evidenceContentHash: collected.contentHash || hashContent(text),
    summary: text.slice(0, 500),
    links: collected.links,
    adapterMetadata: { ...collected.metadata, provenance: { ...collected.metadata?.provenance, sourceId } },
    reportTimestamps: reportTimestamp ? [reportTimestamp] : undefined
  };
}

function savePublicAdvisory(store: any, claim: ParsedExposureClaim, at: string, scope: { tenantId: string; organizationId?: string; submittedBy?: string }) {
  const sourceId = claim.sourceId!;
  const existingSource = store.getSource?.(sourceId);
  if (!existingSource) store.saveSource?.({
    id: sourceId,
    tenantId: undefined,
    name: claim.sourceName,
    type: "static_web",
    url: claim.sourceUrl,
    accessMethod: "public_http",
    status: "candidate",
    risk: "low",
    trustScore: 0.7,
    crawlFrequencySeconds: 3600,
    legalNotes: "Public incident reporting collected without credentials, form submission, downloads, or access-control bypass.",
    createdAt: existingSource?.createdAt || at,
    updatedAt: at,
    metadata: {
      sourceFamily: "public_advisory",
      collectionMode: "publisher_site",
      productionCollection: false
    }
  });
  const text = claim.text!;
  const safeExcerpt = text.slice(0, 600);
  const adapterProvenance = claim.adapterMetadata?.provenance;
  const provenanceTaskId = adapterProvenance && typeof adapterProvenance === "object" && typeof (adapterProvenance as Record<string, unknown>).taskId === "string"
    ? (adapterProvenance as Record<string, unknown>).taskId as string
    : undefined;
  const pipeline = processCollectedItem({
    tenantId: scope.tenantId,
    sourceId,
    taskId: provenanceTaskId,
    url: claim.url!,
    title: claim.title,
    collectedAt: claim.capturedAt,
    publishedAt: claim.publishedAt,
    contentHash: claim.evidenceContentHash,
    rawText: text,
    links: claim.links || [],
    sensitive: false,
    metadata: {
      ...claim.adapterMetadata,
      publicAdvisory: true,
      organizationId: scope.organizationId,
      submittedBy: scope.submittedBy,
      safeExcerpt,
      adapter: "static_web",
      sourceFamily: "public_advisory",
      parserMode: claim.parserMode,
      parserQuality: claim.parserQuality,
      reportTimestamps: claim.reportTimestamps,
      extractionProfile: "public_advisory",
      review: { state: "needs_review", reason: "Public incident evidence requires analyst confirmation" }
    }
  }, { actorIdentities: store.listActorIdentities?.() ?? [] });
  pipeline.capture.title = claim.title;
  const duplicate = store.findDuplicateCapture?.(pipeline.capture);
  const capture = store.savePipelineResult(pipeline).capture;
  const checkedAt = claim.capturedAt!;
  const taskId = capture.taskId || provenanceTaskId;
  const source = store.getSource?.(sourceId);
  store.saveSourceHealthObservation?.({
    id: stableId("source-health", `manual-public-advisory:${taskId}:${capture.id}:${checkedAt}`),
    tenantId: scope.tenantId,
    sourceId,
    taskId,
    captureId: capture.id,
    checkedAt,
    status: "healthy",
    success: true,
    useful: true,
    latencyMs: Number(claim.adapterMetadata?.fetchDurationMs) || undefined,
    itemCount: 1,
    captureCount: duplicate ? 0 : 1,
    incidentCount: pipeline.incident ? 1 : 0,
    duplicateCount: duplicate ? 1 : 0,
    parserWarningCount: 0,
    observedActorCount: 0,
    freshnessLagSeconds: Math.max(0, Math.round((Date.parse(checkedAt) - Date.parse(claim.publishedAt!)) / 1_000)),
    legalMode: "public_content"
  });
  if (source) store.saveSource({
    ...source,
    lastSeenAt: checkedAt,
    health: { ...(source.health ?? {}), status: "healthy", checkedAt, lastSuccessAt: checkedAt, lastUsefulAt: checkedAt, consecutiveFailures: 0, errorRate: 0, parserStatus: "healthy", lastError: undefined },
    updatedAt: checkedAt
  });
  return capture;
}

export function publicAdvisorySourceIdentity(value: string, sources: any[] = []) {
  const target = new URL(value);
  if (target.protocol !== "https:") throw new Error("Public advisory publisher must use HTTPS.");
  target.pathname = "/";
  target.search = "";
  target.hash = "";
  target.username = "";
  target.password = "";
  const url = canonicalizeUrl(target.toString());
  const existing = sources.filter((source) => !source.tenantId
    && source.accessMethod === "public_http"
    && source.status !== "retired"
    && !source.metadata?.retiredReason
    && publicAdvisoryOrigin(source.url) === url)
    .sort((left, right) => Number(Boolean(sourceCollectionLane(right))) - Number(Boolean(sourceCollectionLane(left)))
      || Number(right.metadata?.productionCollection === true) - Number(left.metadata?.productionCollection === true)
      || String(left.id).localeCompare(String(right.id)))[0];
  return { id: existing?.id || stableId("src_public_advisory", url), url, existing };
}

function publicAdvisoryOrigin(value: string) {
  try {
    const target = new URL(value);
    if (target.protocol !== "https:") return undefined;
    target.pathname = "/";
    target.search = "";
    target.hash = "";
    target.username = "";
    target.password = "";
    return canonicalizeUrl(target.toString());
  } catch {
    return undefined;
  }
}

function publicationTimestampFromHtml(html: string): string | undefined {
  const candidates: string[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = htmlAttribute(tag, "property") || htmlAttribute(tag, "name") || htmlAttribute(tag, "itemprop");
    if (/^(?:article:published_time|datepublished|date|pubdate|publish-date)$/i.test(key || "")) candidates.push(htmlAttribute(tag, "content") || "");
  }
  candidates.push(html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] || "");
  candidates.push(html.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1] || "");
  return candidates.map(zonedSourceTimestamp).find(Boolean);
}

function htmlAttribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"))?.[1];
}

function termOccursInText(text: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);
}

function cyberIncidentText(text: string) {
  return /\b(?:cyber(?:attack| attack|angrep)|ransomware|data breach|security incident|compromis(?:e|ed)|dataangrep|sikkerhetshendelse|datainnbrudd|løsepengevirus|stjålet)\b/i.test(text);
}

export function publicAdvisoryFetcher(configured?: typeof fetch, timeoutMs = 8_000): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    let target = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    for (let redirects = 0; redirects <= 3; redirects++) {
      target = normalizePublicAdvisoryUrl(target);
      const response = configured
        ? await configured(target, { ...init, redirect: "manual" })
        : await fetchPinnedPublicAdvisory(target, init, timeoutMs, PUBLIC_ADVISORY_MAX_BYTES);
      const location = response.headers.get("location");
      if (![301, 302, 303, 307, 308].includes(response.status) || !location) return response;
      await response.body?.cancel().catch(() => undefined);
      target = new URL(location, target).toString();
    }
    throw new Error("Public advisory exceeded the redirect limit.");
  }) as typeof fetch;
}

type PublicAdvisoryResolver = (hostname: string, options: { all: true; verbatim: true }) => Promise<Array<{ address: string; family: number }>>;

export async function resolvePublicAdvisoryTarget(value: string, resolver: PublicAdvisoryResolver = lookup) {
  const normalized = normalizePublicAdvisoryUrl(value), hostname = new URL(normalized).hostname.replace(/^\[|\]$/g, "");
  const addresses = await resolver(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address, family }) => isIP(address) !== family || privateTarget(address))) throw new Error("Public advisory resolved to a private network target.");
  return { normalized, addresses };
}

export function pinnedPublicAdvisoryLookup(addresses: Array<{ address: string; family: number }>): LookupFunction {
  return (_hostname, options, callback) => {
    const requestedFamily = options.family === "IPv4" ? 4 : options.family === "IPv6" ? 6 : Number(options.family || 0);
    const matching = requestedFamily ? addresses.filter(({ family }) => family === requestedFamily) : addresses;
    if (!matching.length) {
      callback(Object.assign(new Error("No validated public advisory address matches the requested family."), { code: "ENOTFOUND" }), options.all ? [] : "", requestedFamily);
      return;
    }
    if (options.all) callback(null, matching);
    else callback(null, matching[0].address, matching[0].family);
  };
}

async function fetchPinnedPublicAdvisory(value: string, init: RequestInit | undefined, timeoutMs: number, maxBytes: number): Promise<Response> {
  const startedAt = Date.now();
  const { normalized, addresses } = await publicAdvisoryDeadline(resolvePublicAdvisoryTarget(value), timeoutMs);
  if (init?.signal?.aborted) throw init.signal.reason;
  const remainingMs = timeoutMs - (Date.now() - startedAt);
  if (remainingMs <= 0) throw new Error("Public advisory request timed out.");
  const url = new URL(normalized), headers = new Headers(init?.headers);
  headers.set("accept-encoding", "identity");
  headers.delete("host");
  headers.delete("content-length");
  return await new Promise<Response>((resolve, reject) => {
    let settled = false;
    const finish = (cause?: unknown, response?: Response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      init?.signal?.removeEventListener("abort", abort);
      cause ? reject(cause) : resolve(response!);
    };
    const request = httpsRequest(url, { method: "GET", headers: Object.fromEntries(headers), lookup: pinnedPublicAdvisoryLookup(addresses) }, incoming => {
      const chunks: Buffer[] = []; let contentBytes = 0;
      const declared = Number(incoming.headers["content-length"]);
      if (Number.isFinite(declared) && declared > maxBytes) {
        incoming.destroy(new Error(`Public advisory exceeds maxBytes ${maxBytes}.`));
        return;
      }
      incoming.on("data", chunk => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        contentBytes += bytes.byteLength;
        if (contentBytes > maxBytes) incoming.destroy(new Error(`Public advisory exceeds maxBytes ${maxBytes}.`));
        else chunks.push(bytes);
      });
      incoming.on("error", finish);
      incoming.on("end", () => {
        const responseHeaders = new Headers();
        for (const [name, raw] of Object.entries(incoming.headers)) for (const part of Array.isArray(raw) ? raw : raw === undefined ? [] : [String(raw)]) responseHeaders.append(name, part);
        const status = incoming.statusCode ?? 0, body = [204, 205, 304].includes(status) ? null : Buffer.concat(chunks, contentBytes);
        const response = new Response(body, { status, statusText: incoming.statusMessage, headers: responseHeaders });
        Object.defineProperty(response, "url", { value: normalized });
        finish(undefined, response);
      });
    });
    const abort = () => request.destroy(init?.signal?.reason instanceof Error ? init.signal.reason : new Error("Public advisory request aborted."));
    const timer = setTimeout(() => request.destroy(new Error("Public advisory request timed out.")), remainingMs);
    request.on("error", finish);
    if (init?.signal?.aborted) abort(); else init?.signal?.addEventListener("abort", abort, { once: true });
    request.end();
  });
}

async function publicAdvisoryDeadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("Public advisory request timed out.")), timeoutMs); })]); }
  finally { if (timer) clearTimeout(timer); }
}

function normalizePublicAdvisoryUrl(value: string) {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("Public advisory URL must be valid."); }
  if (privateTarget(parsed.hostname)) throw new Error("Public advisory URL must use a public network target.");
  const safe = publicSourceReferenceUrl(value);
  if (!safe) throw new Error("Public advisory URL must use a public HTTP URL without credentials or secrets.");
  const url = new URL(safe);
  if (url.protocol !== "https:") throw new Error("Public advisory URL must use HTTPS.");
  return url.toString();
}

function publicAdvisoryTimeout(options: ApiServerOptions) {
  const direct = Number(options.publicAdvisoryTimeoutMs);
  if (Number.isFinite(direct)) return Math.max(1, Math.min(direct, 30_000));
  return Math.max(1_000, Math.min(Number(Bun.env.TI_PUBLIC_ADVISORY_TIMEOUT_MS || 8_000), 30_000));
}

async function parseExposureClaim(item: ExposureClaimItem, at: string): Promise<ParsedExposureClaim> {
  const ai = await parseWithHostedAi(item).catch(() => undefined);
  const parsed = ai || fallbackParse(item, at);
  const sourceIdentity = ransomwareLiveIdentity(item.url);
  const titleClaim = parseVictimClaimTitle([item.title, item.text].filter(Boolean).join("\n"));
  const confidence = clamp(Number(parsed.confidence ?? item.confidence ?? 0.74));
  const company = boundedText(clean(item.company || item.victimName || sourceIdentity?.company || titleClaim?.company || parsed.company || parsed.victimName || ""), 140) ?? "";
  const actor = boundedText(validActorName(item.actor || sourceIdentity?.actor || titleClaim?.actor || parsed.actor), 80) ?? "";
  return {
    ...item,
    actor,
    company,
    claimedData: boundedText(clean(parsed.claimedData || item.claimedData || "Not disclosed by TA"), 240) ?? "Not disclosed by TA",
    claimedDataSize: boundedText(clean(parsed.claimedDataSize || item.claimedDataSize || dataSizeFromText([item.title, item.text].filter(Boolean).join(" ")) || "Not disclosed by TA"), 80) ?? "Not disclosed by TA",
    country: boundedText(clean(parsed.country || parsed.claimedCountry || item.country || item.claimedCountry || countryFromText([item.title, item.text].filter(Boolean).join(" ")) || countryFromCompanyDomain(company) || "Not disclosed by TA"), 80) ?? "Not disclosed by TA",
    summary: boundedText(parsed.summary, 500),
    claimTime: validTimestamp(item.publishedAt) ?? validTimestamp(parsed.claimTime || item.capturedAt) ?? at,
    capturedAt: item.capturedAt || at,
    confidence,
    parserMode: ai ? "hanasand-ai" : "local_fallback",
    parserQuality: confidence >= 0.82 ? "high" : confidence >= 0.68 ? "medium" : "needs_review",
    needsReview: confidence < 0.72 || !company || !actor,
    evidenceContentHash: hashContent(JSON.stringify([item.sourceId, item.url, item.title, item.text, item.actor, item.company, item.victimName, item.publishedAt, item.capturedAt]))
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
  const titleClaim = parseVictimClaimTitle(text);
  const victim =
    item.company ||
    item.victimName ||
    titleClaim?.company ||
    match(text, /\bvictim\s*:?\s+([A-Z0-9][A-Za-z0-9&.,'() -]{2,90})/i) ||
    match(text, /\b(?:listed|lists|added|adds|claims?|target(?:ed|ing))\s+([A-Z0-9][A-Za-z0-9&.,'() -]{2,90})/i) ||
    match(text, /:\s*([A-Z0-9][A-Za-z0-9&.,'() -]{2,90})$/);
  const actor = validActorName(item.actor || titleClaim?.actor || match(text, /^([A-Z][A-Za-z0-9_.-]{2,40})\b/)) || "";
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
  const publishedAt = validTimestamp(capture.publishedAt);
  const collectedAt = validTimestamp(capture.collectedAt);
  const leakObservedAt = validTimestamp(leak.firstSeenAt);
  const observedAt = publishedAt ?? (leakObservedAt !== collectedAt ? leakObservedAt : undefined);
  const authoritativePublishedAt = publishedAt ?? observedAt;
  const ageMinutes = authoritativePublishedAt
    ? Math.max(0, Math.round((Date.now() - Date.parse(authoritativePublishedAt)) / 60_000))
    : undefined;
  const confidence = capture.metadata?.parserQuality === "high" ? 0.9 : capture.metadata?.parserQuality === "medium" ? 0.78 : 0.64;
  const text = capture.storageKind === "metadata_only"
    ? [capture.title, capture.metadata?.safeExcerpt].filter(Boolean).join(" ")
    : [capture.title, capture.body, capture.rawText, capture.metadata?.safeExcerpt].filter(Boolean).join(" ");
  return {
    id: capture.id,
    tenantId: capture.tenantId,
    organizationId: capture.metadata?.organizationId,
    sourceId: capture.sourceId,
    sourceName: source?.name || capture.sourceId,
    actor: leak.actorName || capture.metadata?.actor || parsedTitle?.actor || "Unknown actor",
    company: leak.victimName || capture.metadata?.victimName || parsedTitle?.company || "Unknown company",
    claimedData: meaningfulClaimedData(leak.claimedDataCategory) || claimedDataFromText(text) || "Not disclosed by TA",
    claimedDataSize: leak.claimedDataSize || leak.dataSize || dataSizeFromText(text) || "Not disclosed by TA",
    country: clean(leak.claimedCountry || leak.country || capture.metadata?.country || countryFromText(text) || countryFromCompanyDomain(leak.victimName || capture.metadata?.victimName || parsedTitle?.company || "") || "Not disclosed by TA"),
    claimType: leak.claimType || "ransomware_victim_publication",
    claimTime: authoritativePublishedAt,
    publishedAt: authoritativePublishedAt,
    observedAt,
    collectedAt,
    status: capture.metadata?.review?.state === "needs_review" || ageMinutes === undefined ? "needs_review" : ageMinutes <= 60 ? "new" : "parsed",
    confidence,
    freshnessMinutes: ageMinutes,
    metadataOnly: capture.storageKind === "metadata_only",
    url: safeExposureUrl(capture.url),
    summary: capture.metadata?.safeExcerpt || capture.title || "",
    provenanceHash: hashContent(capture.id)
  };
}

function exposureCountryBackfillCandidates(store: any, tenantId: string) {
  const rows: Array<{ captureId: string; company: string; actor: string; sourceName: string }> = [];
  for (const capture of store.listCaptures?.() ?? []) {
    if (normalizedTenantId(capture.tenantId) !== normalizedTenantId(tenantId)) continue;
    const source = store.getSource?.(capture.sourceId);
    if (!shouldShowExposureQueueCapture(capture, source)) continue;
    const leak = capture.metadata?.leakSite ?? {};
    if (!missingCountry(leak.claimedCountry || leak.country || capture.metadata?.country)) continue;
    const item = exposureClaimFromCapture(capture, source);
    rows.push({ captureId: capture.id, company: item.company, actor: item.actor, sourceName: item.sourceName });
  }
  return rows.filter((row) => row.company && row.company !== "Unknown company");
}

function normalizedTenantId(value: unknown) {
  return value || "default";
}

function safeExposureUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? ""));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /\.onion$|\.i2p$/i.test(url.hostname)) return undefined;
    if ([...url.searchParams.keys()].some((key) => /token|secret|password|authorization|cookie|api[_-]?key|signature/i.test(key))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
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

function ransomwareLiveIdentity(value: unknown) {
  try {
    const url = new URL(String(value ?? ""));
    if (!/^(?:www\.)?ransomware\.live$/i.test(url.hostname) || !url.pathname.startsWith("/id/")) return undefined;
    const token = decodeURIComponent(url.pathname.slice(4)).replace(/-/g, "+").replace(/_/g, "/");
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(token), (char) => char.charCodeAt(0)));
    const separator = decoded.lastIndexOf("@");
    const company = clean(decoded.slice(0, separator));
    const rawActor = clean(decoded.slice(separator + 1));
    if (separator < 1 || !company || !rawActor || company.length > 140 || rawActor.length > 80) return undefined;
    return { company, actor: rawActor.charAt(0).toUpperCase() + rawActor.slice(1) };
  } catch {
    return undefined;
  }
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

function validActorName(value: unknown) {
  const actor = cleanActorName(value);
  return actor && !/^(?:unknown actor|ransomware\.live(?: victim feed)?|victim feed|metadata[- ]only victim source)$/i.test(actor) ? actor : "";
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
