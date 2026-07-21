// @ts-nocheck
import { hashContent, stableId } from "../utils.ts";
import type { CanaryFetch, CanaryLoopState } from "./canaryCollectionTypes.ts";
import { feedItems } from "./canaryFeedItems.ts";

export function taskFor(source: any, at: string, runId: string, maxBytes: number) {
  return { id: stableId("task", `${source.id}:${at}`), tenantId: source.tenantId, sourceId: source.id, targetUrl: source.url, sourceType: source.type, queuedAt: at, priority: source.trustScore ?? 0.5, reason: "public_canary", retryCount: 0, maxBytes, runId };
}

export async function fetchItems(source: any, task: any, fetcher: CanaryFetch, mode: string, at: string, maxBytes: number, timeoutMs = 12_000, maxItems?: number) {
  const started = Date.now(), requestedUrl = publicFetchUrl(source, task.targetUrl);
  if (source.catalog?.canonicalId === "gov:us:cisa:known-exploited-vulnerabilities") maxBytes = Math.max(maxBytes, 4_000_000);
  if (source.catalog?.canonicalId === "community:ransomwarelive:groups") maxBytes = Math.max(maxBytes, 2_000_000);
  const { response: res, finalUrl, redirectCount } = await fetchPublicResponse(fetcher, requestedUrl, timeoutMs);
  if (!res.ok) throw httpError(res.status);
  const contentType = res.headers.get("content-type") ?? undefined;
  if (contentType && !/^(?:text\/|application\/(?:rss\+xml|x-rss\+xml|atom\+xml|rdf\+xml|xml|json|xhtml\+xml))/i.test(contentType)) throw new Error(`unsupported media type: ${contentType}`);
  const body = await boundedText(res, maxBytes);
  const fetched = body.text;
  const metadata = { canaryPortfolio: true, fetchMode: mode, finalUrlHash: hashContent(finalUrl), responseBytes: body.bytesReceived, fetchProvenance: { mode, adapterVersion: "public_canary_fetcher:v2", requestedUrlHash: hashContent(requestedUrl), sourceUrlHash: hashContent(task.targetUrl), finalUrlHash: hashContent(finalUrl), httpStatus: res.status, ok: res.ok, contentType, fetchedAt: at, durationMs: Date.now() - started, bytesReceived: body.bytesReceived, maxBytes, truncated: body.truncated, bounded: true, redirectCount, userAgent: "hanasand-ti-scraper-canary/0.1 (+safe-public-canary)" } };
  return feedItems(source, task, fetched, at, metadata, maxItemsFor(source) ?? maxItems);
}

export const fetchItem = async (...args: any[]) => (await fetchItems(...args))[0];

export function externalize(capture: any, objectStore: any) {
  const body = capture.body ?? "";
  const record = objectStore.putObject?.({ tenantId: capture.tenantId, sourceId: capture.sourceId, captureId: capture.id, body, mediaType: capture.mediaType ?? "text/plain", contentHash: capture.contentHash, retentionClass: "public_report", metadata: capture.metadata });
  return { ...capture, body: undefined, storageKind: "external_object", objectRef: record?.ref, metadata: { ...capture.metadata, safeExcerpt: body.slice(0, 600), objectRef: record?.ref } };
}

export const canaryCaptures = (store: any) => store.listCaptures().filter((c: any) => store.getSource?.(c.sourceId)?.metadata?.canaryPortfolio || c.metadata?.canaryPortfolio);
export const rate = (n = 0, d = 0) => d > 0 ? n / d : 0;
export const sum = (rows: any[], key: string) => rows.reduce((n, r) => n + (r[key] ?? 0), 0);
export const searchable = (capture: any) => `${capture.title ?? ""} ${capture.body ?? ""} ${capture.rawText ?? ""} ${capture.metadata?.safeExcerpt ?? ""}`.toLowerCase();

export function health(store: any, at: string, counters: any) {
  const captures = canaryCaptures(store), latest = captures.map((c) => c.collectedAt).sort().at(-1), incidents = store.listIncidents?.().length ?? 0;
  const processed = (counters.insertedCaptureCount ?? 0) + (counters.duplicateCaptureCount ?? 0);
  return { freshnessSeconds: latest ? Math.max(0, (Date.parse(at) - Date.parse(latest)) / 1000) : Infinity, errorRate: rate(counters.failedTaskCount, counters.leasedTaskCount), duplicateRate: rate(counters.duplicateCaptureCount, processed), promotionYield: rate(counters.incidentCount ?? incidents, processed || captures.length) };
}

export function detachedState(at: string, queueLimit: number): CanaryLoopState {
  return { schemaVersion: "ti.public_canary_loop_runtime.v1", supervisorAttached: false, enabled: false, running: false, startedAt: at, intervalSeconds: 300, cycleCount: 0, successCount: 0, errorCount: 0, consecutiveErrorCount: 0, maxSources: 10, maxTasks: 5, maxBytes: 512_000, timeoutMs: 30_000, queueLimit, activateSources: false, controls: { canaryPortfolioOnly: false, activationRequiresHumanApproval: true, continuousLoopAutoActivation: false, nativeFetchDefault: true, objectBoundaryConfigured: true, boundedQueueRequired: true, dedupeBeforeWrite: true, retriesBounded: true, restrictedSourcesExcluded: true } };
}

export function storageStats(captures: any[]) {
  const nativeLiveHttpCaptureCount = captures.filter((c) => c.metadata?.fetchMode === "native_live_http").length, injectedProofFetchCaptureCount = captures.filter((c) => c.metadata?.fetchMode === "injected_proof_fetch").length, externalObjectCaptureCount = captures.filter((c) => c.storageKind === "external_object" || c.storageKind === "object_ref").length;
  return { metadataStore: "file_backed_or_repository", productionEvidenceMode: nativeLiveHttpCaptureCount && !injectedProofFetchCaptureCount ? "native_live_http" : injectedProofFetchCaptureCount && !nativeLiveHttpCaptureCount ? "injected_proof_only" : nativeLiveHttpCaptureCount ? "mixed" : "none", externalObjectCaptureCount, inlineCaptureCount: captures.length - externalObjectCaptureCount, missingObjectReferenceCount: captures.filter((c) => ["external_object", "object_ref"].includes(c.storageKind) && !c.objectRef).length, nativeLiveHttpCaptureCount, injectedProofFetchCaptureCount, unknownFetchModeCaptureCount: captures.filter((c) => !c.metadata?.fetchMode).length };
}

export function maxItemsFor(source: any) {
  if (source.id === "src_canary_ransomwarelive") return Number(Bun.env.TI_RANSOMWARELIVE_MAX_ITEMS ?? "24");
  return source.metadata?.maxItemsPerFetch;
}

function publicFetchUrl(source: any, targetUrl: string) {
  if (source.type !== "telegram_public") return targetUrl;
  const match = targetUrl.match(/(?:https?:\/\/)?t\.me\/(?:s\/)?([a-zA-Z0-9_]+)/);
  const searchQuery = typeof source.metadata?.searchQuery === "string" ? source.metadata.searchQuery.trim().slice(0, 100) : "";
  return match ? `https://t.me/s/${match[1]}${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}` : targetUrl;
}

export function isSafePublicCollectionTarget(value: string): boolean {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || /\.(?:local|internal|onion|i2p)$/.test(host)) return false;
    if (host === "::1" || /^(?:fc|fd|fe8|fe9|fea|feb)/i.test(host)) return false;
    const octets = host.split(".").map(Number);
    if (octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
      const [a, b] = octets;
      if (a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a === 198 && [18, 19].includes(b)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function fetchPublicResponse(fetcher: CanaryFetch, initialUrl: string, timeoutMs: number) {
  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount++) {
    if (!isSafePublicCollectionTarget(currentUrl)) throw new Error("public fetch policy blocked target");
    const response = await fetcher(currentUrl, { headers: { "user-agent": "hanasand-ti-scraper-canary/0.1 (+safe-public-canary)" }, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, finalUrl: response.url || currentUrl, redirectCount };
    const location = response.headers.get("location");
    if (!location || redirectCount === 3) throw new Error("public fetch redirect limit exceeded");
    currentUrl = new URL(location, currentUrl).toString();
  }
  throw new Error("public fetch redirect limit exceeded");
}

async function boundedText(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) return { text: "", bytesReceived: 0, truncated: false };
  const decoder = new TextDecoder();
  let text = "", bytesReceived = 0, truncated = false;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    const remaining = maxBytes - bytesReceived;
    if (remaining <= 0) { truncated = true; await reader.cancel(); break; }
    const bytes = chunk.value.byteLength > remaining ? chunk.value.subarray(0, remaining) : chunk.value;
    bytesReceived += bytes.byteLength;
    text += decoder.decode(bytes, { stream: true });
    if (bytes.byteLength < chunk.value.byteLength) { truncated = true; await reader.cancel(); break; }
  }
  text += decoder.decode();
  return { text, bytesReceived, truncated };
}

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { httpStatus: status });
}
