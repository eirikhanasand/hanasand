// @ts-nocheck
import { hashContent, stableId } from "../utils.ts";
import type { CanaryFetch, CanaryLoopState } from "./canaryCollectionTypes.ts";

export function taskFor(source: any, at: string, runId: string, maxBytes: number) {
  return { id: stableId("task", `${source.id}:${at}`), sourceId: source.id, targetUrl: source.url, sourceType: source.type, queuedAt: at, priority: source.trustScore ?? 0.5, reason: "public_canary", retryCount: 0, maxBytes, runId };
}

export async function fetchItem(source: any, task: any, fetcher: CanaryFetch, mode: string, at: string, maxBytes: number, timeoutMs = 12_000) {
  const started = Date.now(), res = await fetcher(task.targetUrl, { headers: { "user-agent": "hanasand-ti-scraper-canary/0.1 (+safe-public-canary)" }, signal: AbortSignal.timeout(timeoutMs) });
  const fetched = (await res.text()).slice(0, maxBytes), text = `${source.name}\n${fetched}`;
  const metadata = { canaryPortfolio: true, fetchMode: mode, finalUrlHash: hashContent(res.url || task.targetUrl), responseBytes: fetched.length, fetchProvenance: { mode, adapterVersion: "public_canary_fetcher:v1", requestedUrlHash: hashContent(task.targetUrl), finalUrlHash: hashContent(res.url || task.targetUrl), httpStatus: res.status, ok: res.ok, contentType: res.headers.get("content-type") ?? undefined, fetchedAt: at, durationMs: Date.now() - started, bytesReceived: fetched.length, maxBytes, truncated: fetched.length >= maxBytes, bounded: true, userAgent: "hanasand-ti-scraper-canary/0.1 (+safe-public-canary)" } };
  return { source, task, url: task.targetUrl, title: source.name, rawText: text, body: text, collectedAt: at, contentHash: hashContent(`${source.id}:${text}`), metadata };
}

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
  return { freshnessSeconds: latest ? Math.max(0, (Date.parse(at) - Date.parse(latest)) / 1000) : Infinity, errorRate: rate(counters.failedTaskCount, counters.leasedTaskCount), duplicateRate: rate(counters.duplicateCaptureCount, (counters.duplicateCaptureCount ?? 0) + (counters.insertedCaptureCount ?? 0)), promotionYield: rate(counters.incidentCount ?? incidents, counters.insertedCaptureCount ?? captures.length) };
}

export function detachedState(at: string, queueLimit: number): CanaryLoopState {
  return { schemaVersion: "ti.public_canary_loop_runtime.v1", supervisorAttached: false, enabled: false, running: false, startedAt: at, intervalSeconds: 300, cycleCount: 0, successCount: 0, errorCount: 0, consecutiveErrorCount: 0, maxSources: 10, maxTasks: 5, maxBytes: 512_000, timeoutMs: 30_000, queueLimit, activateSources: false, controls: { canaryPortfolioOnly: true, activationRequiresHumanApproval: true, continuousLoopAutoActivation: false, nativeFetchDefault: true, objectBoundaryConfigured: true, boundedQueueRequired: true, dedupeBeforeWrite: true, retriesBounded: true, restrictedSourcesExcluded: true } };
}

export function storageStats(captures: any[]) {
  const nativeLiveHttpCaptureCount = captures.filter((c) => c.metadata?.fetchMode === "native_live_http").length, injectedProofFetchCaptureCount = captures.filter((c) => c.metadata?.fetchMode === "injected_proof_fetch").length, externalObjectCaptureCount = captures.filter((c) => c.storageKind === "external_object" || c.storageKind === "object_ref").length;
  return { metadataStore: "file_backed_or_repository", productionEvidenceMode: nativeLiveHttpCaptureCount && !injectedProofFetchCaptureCount ? "native_live_http" : injectedProofFetchCaptureCount && !nativeLiveHttpCaptureCount ? "injected_proof_only" : nativeLiveHttpCaptureCount ? "mixed" : "none", externalObjectCaptureCount, inlineCaptureCount: captures.length - externalObjectCaptureCount, missingObjectReferenceCount: captures.filter((c) => ["external_object", "object_ref"].includes(c.storageKind) && !c.objectRef).length, nativeLiveHttpCaptureCount, injectedProofFetchCaptureCount, unknownFetchModeCaptureCount: captures.filter((c) => !c.metadata?.fetchMode).length };
}
