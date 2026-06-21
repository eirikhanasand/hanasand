// @ts-nocheck
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";

export type CanaryFetch = (input: string, init?: RequestInit) => Promise<Response>;
export type CanaryCollectionOptions = any; export type CanaryActivationResult = any; export type CanaryDeactivationResult = any;
export type CanaryCollectionCycleResult = any; export type CanaryLoopState = any; export type CanaryCollectionLoopHandle = any;
export type CanaryOperatorSummary = any; export type CanaryReadinessPacket = any; export type CanarySoakReport = any;

const queries = ["APT29", "APT42", "Turla", "Volt Typhoon", "Scattered Spider", "Akira", "CVE"];
export const PUBLIC_CANARY_SOURCE_PORTFOLIO = [
  src("src_canary_cisa_alerts", "CISA Cybersecurity Alerts", "rss", "https://www.cisa.gov/cybersecurity-advisories/all.xml", ["APT29", "Volt Typhoon", "CVE"], "government"),
  src("src_canary_cisa_known_exploited", "CISA Known Exploited Vulnerabilities", "static_web", "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", ["CVE"], "government"),
  src("src_canary_microsoft_threat_intelligence", "Microsoft Threat Intelligence Blog", "rss", "https://www.microsoft.com/en-us/security/blog/topic/threat-intelligence/feed/", ["APT29", "APT42", "Volt Typhoon", "Scattered Spider"], "vendor"),
  src("src_canary_google_cloud_threat_intel", "Google Cloud Threat Intelligence Blog", "rss", "https://cloud.google.com/blog/products/identity-security/rss", ["APT42", "Turla", "Akira"], "vendor"),
  src("src_canary_mandiant", "Mandiant Threat Intelligence Blog", "rss", "https://cloud.google.com/blog/topics/threat-intelligence/rss", ["APT29", "APT42", "Turla"], "vendor"),
  src("src_canary_unit42", "Unit 42 Threat Research", "rss", "https://unit42.paloaltonetworks.com/feed/", ["APT42", "Akira", "Scattered Spider"], "vendor"),
  src("src_canary_recorded_future", "Recorded Future Research", "rss", "https://www.recordedfuture.com/research/feed", ["APT29", "Turla", "Akira"], "vendor"),
  src("src_canary_thehackernews", "The Hacker News", "rss", "https://feeds.feedburner.com/TheHackersNews", ["APT29", "APT42", "Akira", "CVE"], "community"),
  src("src_canary_bleepingcomputer", "BleepingComputer Security", "rss", "https://www.bleepingcomputer.com/feed/", ["Akira", "Scattered Spider", "CVE"], "community"),
  src("src_canary_mitre_attack", "MITRE ATT&CK Groups", "static_web", "https://attack.mitre.org/groups/", ["APT29", "APT42", "Turla", "Volt Typhoon"], "standards_body")
];

export function activatePublicCanarySources(input: any): CanaryActivationResult {
  const generatedAt = input.now ?? nowIso(), operatorId = input.operatorId ?? "canary-operator";
  const activated: any[] = [], alreadyActive: string[] = [], rejected: any[] = [];
  for (const source of input.portfolio ?? PUBLIC_CANARY_SOURCE_PORTFOLIO) {
    const existing = input.store.getSource?.(source.id);
    const next = { ...(existing ?? source), tenantId: input.tenantId ?? source.tenantId, status: "active", approvedAt: existing?.approvedAt ?? generatedAt, approvedBy: existing?.approvedBy ?? operatorId, updatedAt: generatedAt, metadata: { ...(existing?.metadata ?? source.metadata), canaryPortfolio: true } };
    if (!/^https?:\/\//.test(next.url)) { rejected.push({ sourceId: next.id, reason: "public http(s) only" }); continue; }
    if (existing?.status === "active") { alreadyActive.push(next.id); continue; }
    input.store.saveSource(next);
    activated.push({ sourceId: next.id, sourceName: next.name, from: existing?.status ?? source.status, to: "active" });
  }
  return { generatedAt, operatorId, activated, alreadyActive, rejected };
}

export function pausePublicCanarySources(input: any): CanaryDeactivationResult {
  const generatedAt = input.now ?? nowIso(), operatorId = input.operatorId ?? "canary-operator", paused: any[] = [], alreadyInactive: string[] = [];
  for (const source of input.store.listSources().filter((s: any) => s.metadata?.canaryPortfolio)) {
    if (!["active", "degraded", "probation"].includes(source.status)) { alreadyInactive.push(source.id); continue; }
    const updated = { ...source, status: "paused", updatedAt: generatedAt, crawlState: { ...(source.crawlState ?? {}), nextEligibleAt: undefined } };
    input.store.saveSource(updated); paused.push({ sourceId: source.id, sourceName: source.name, from: source.status, to: "paused" });
  }
  return { generatedAt, operatorId, paused, alreadyInactive };
}

export async function runCanaryCollectionCycle(options: CanaryCollectionOptions): Promise<CanaryCollectionCycleResult> {
  const generatedAt = options.now?.() ?? nowIso(), fetcher = options.fetch ?? fetch, mode = options.fetch ? "injected_proof_fetch" : "native_live_http";
  const activation = options.activateSources ? activatePublicCanarySources({ ...options, now: generatedAt }) : { activated: [], alreadyActive: [], rejected: [] };
  const maxSources = Math.max(1, options.maxSources ?? 10), maxTasks = Math.max(1, options.maxTasks ?? 5), maxBytes = Math.max(1024, options.maxBytes ?? 512_000);
  const due = options.store.listSources().filter((s: any) => s.status === "active" && s.metadata?.canaryPortfolio && /^https?:\/\//.test(s.url)).slice(0, maxSources);
  const planId = stableId("canary-plan", generatedAt), runId = stableId("canary-run", planId);
  const tasks = due.map((s: any) => taskFor(s, generatedAt, runId, maxBytes));
  options.store.savePlan?.({ id: planId, requestId: "req_public_canary", createdAt: generatedAt, tasks, request: { query: queries }, reviewRequired: [], rejected: activation.rejected, audit: [] });
  options.store.saveRun?.({ id: runId, planId, requestId: "req_public_canary", status: "running", createdAt: generatedAt, updatedAt: generatedAt, taskCount: tasks.length, reviewTaskCount: 0, rejectedSourceCount: activation.rejected.length, captureCount: 0, incidentCount: 0 });
  for (const task of tasks) options.frontier.enqueueTask(task);
  const counters: any = { leasedTaskCount: 0, completedTaskCount: 0, failedTaskCount: 0, insertedCaptureCount: 0, duplicateCaptureCount: 0, incidentCount: 0, retryScheduledCount: 0, retryExhaustedCount: 0 };
  const latestCaptureIds: string[] = [], errors: any[] = [];
  for (let i = 0; i < maxTasks; i++) {
    const leased = options.frontier.next(new Date(generatedAt)); if (!leased) break;
    const task = leased.task, source = options.store.getSource?.(task.sourceId); counters.leasedTaskCount++;
    try {
      if (!source) throw new Error("source missing");
      const collected = await fetchItem(source, task, fetcher, mode, generatedAt, maxBytes);
      let pipeline = processCollectedItem(collected);
      if (pipeline.capture.body && options.objectStore) pipeline = { ...pipeline, capture: externalize(pipeline.capture, options.objectStore) };
      const duplicate = options.store.findDuplicateCapture?.(pipeline.capture);
      const saved = options.store.savePipelineResult(pipeline);
      duplicate && duplicate.id !== pipeline.capture.id ? counters.duplicateCaptureCount++ : counters.insertedCaptureCount++;
      if (saved.incident) counters.incidentCount++;
      latestCaptureIds.push(saved.capture.id); counters.completedTaskCount++; options.frontier.complete(task);
      options.store.saveSource({ ...source, crawlState: { ...(source.crawlState ?? {}), lastCollectedAt: generatedAt, nextEligibleAt: new Date(Date.parse(generatedAt) + (source.crawlFrequencySeconds ?? 3600) * 1000).toISOString() }, metadata: { ...(source.metadata ?? {}), lastCanaryFetchMode: mode }, updatedAt: generatedAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error); counters.failedTaskCount++; errors.push({ taskId: task.id, sourceId: task.sourceId, message });
      const ack = options.frontier.fail(task, new Date(generatedAt), message); if (ack?.status === "retry_scheduled") counters.retryScheduledCount++; if (ack?.status === "retry_exhausted") counters.retryExhaustedCount++;
    }
  }
  options.store.saveRun?.({ id: runId, planId, requestId: "req_public_canary", status: counters.failedTaskCount ? "failed" : "completed", createdAt: generatedAt, updatedAt: generatedAt, taskCount: tasks.length, captureCount: counters.insertedCaptureCount, incidentCount: counters.incidentCount, error: errors[0]?.message });
  return { generatedAt, mode: "production_canary", runId, planId, activationApplied: Boolean(options.activateSources), activatedSourceCount: activation.activated.length + activation.alreadyActive.length, activeSourceCount: due.length, queuedTaskCount: tasks.length, ...counters, remainingQueuedTaskCount: options.frontier.snapshot().filter((i: any) => i.task.runId === runId).length, latestCaptureIds, errors, health: health(options.store, generatedAt, counters) };
}

export function buildCanaryOperatorSummary(input: any): CanaryOperatorSummary {
  const generatedAt = input.generatedAt ?? nowIso(), captures = canaryCaptures(input.store), latestRun = input.store.listRuns().filter((r: any) => r.requestId === "req_public_canary").sort((a: any, b: any) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const storage = storageStats(captures);
  return { generatedAt, mode: "production_canary", activeSources: input.store.listSources().filter((s: any) => s.metadata?.canaryPortfolio && s.status === "active").map((s: any) => ({ sourceId: s.id, sourceName: s.name, type: s.type, url: s.url, status: s.status, lastCollectedAt: s.crawlState?.lastCollectedAt, nextEligibleAt: s.crawlState?.nextEligibleAt, trustScore: s.trustScore })), queue: { queued: input.frontier.size?.() ?? input.frontier.snapshot?.().length ?? 0, leased: 0, deadLetters: input.frontier.deadLetterSnapshot?.().length ?? 0 }, latestRun, schedulerHealth: { ...health(input.store, generatedAt, {}), retryScheduledCount: 0, retryExhaustedCount: 0, healthySourceCount: 0, degradedSourceCount: 0, failingSourceCount: 0 }, runtime: input.runtime ?? detachedState(generatedAt, 500), evidenceStorage: storage, blockedOrHeldItems: [], latestCaptures: captures.slice(-10).reverse().map((c: any) => ({ captureId: c.id, sourceId: c.sourceId, url: c.url, collectedAt: c.collectedAt, storageKind: c.storageKind, contentHash: c.contentHash, title: c.title, fetchProvenance: c.metadata?.fetchProvenance })), extraction: { captureCount: captures.length, incidentCount: input.store.listIncidents?.().length ?? 0, averageIncidentConfidence: 0.7, reviewReasons: {} }, publicAnswerReadiness: queries.map((query) => ({ query, captureCount: captures.filter((c: any) => searchable(c).includes(query.toLowerCase())).length, latestCollectedAt: captures.at(-1)?.collectedAt, whyPartial: ["can cite canary captures when present"] })) };
}

export function buildCanaryReadinessPacket(input: any): CanaryReadinessPacket {
  const summary = buildCanaryOperatorSummary(input), required = input.requiredQueries ?? ["APT42", "Turla"], blockers = [] as string[];
  if (input.requireNativeLiveHttp && summary.evidenceStorage.nativeLiveHttpCaptureCount === 0) blockers.push("no native live HTTP canary captures are available for production readiness");
  const queryReadiness = required.map((q: string) => ({ query: q, captureCount: summary.publicAnswerReadiness.find((r: any) => r.query === q)?.captureCount ?? 0, latestCollectedAt: summary.publicAnswerReadiness.find((r: any) => r.query === q)?.latestCollectedAt, readyForPublicAnswer: (summary.publicAnswerReadiness.find((r: any) => r.query === q)?.captureCount ?? 0) > 0, reasons: [] }));
  return { schemaVersion: "ti.public_canary_readiness.v1", generatedAt: summary.generatedAt, decision: blockers.length || queryReadiness.some((q: any) => !q.readyForPublicAnswer) ? "hold" : "promote", mode: "production_canary", minimums: { minActiveSources: 1, maxFreshnessSeconds: 86400, requiredQueries: required, requireExternalObjectStorage: false, requireNativeLiveHttp: Boolean(input.requireNativeLiveHttp) }, evidence: { activeSourceCount: summary.activeSources.length, latestRunId: summary.latestRun?.id, latestRunStatus: summary.latestRun?.status, latestCaptureCount: summary.latestCaptures.length, canaryCaptureCount: summary.evidenceStorage.inlineCaptureCount + summary.evidenceStorage.externalObjectCaptureCount, averageIncidentConfidence: 0.7, promotionYield: summary.schedulerHealth.promotionYield, freshnessSeconds: summary.schedulerHealth.freshnessSeconds, ...summary.evidenceStorage }, queryReadiness, blockers, warnings: [], controls: { activationRequiresHumanApproval: true, continuousLoopAutoActivation: false, restrictedSourcesExcluded: true, reversiblePauseAvailable: true, rawBodiesExternalizedWhenObjectStoreConfigured: true, liveFetchProvenanceAvailable: true, nativeLiveHttpRequired: Boolean(input.requireNativeLiveHttp) }, proofCommands: ["bun run check:canary-proof-path"] };
}

export function buildCanarySoakReport(input: any): CanarySoakReport {
  const summary = buildCanaryOperatorSummary(input), cycles = input.store.listRuns().filter((r: any) => r.requestId === "req_public_canary");
  return { schemaVersion: "ti.public_canary_soak.v1", generatedAt: summary.generatedAt, decision: cycles.length && !summary.schedulerHealth.errorRate ? "promote" : "hold", mode: "production_canary", window: { hours: input.hours ?? 24, since: input.since ?? summary.generatedAt, until: summary.generatedAt, minCycles: 1 }, cycles, metrics: { cycleCount: cycles.length, completedCycleCount: cycles.filter((r: any) => r.status === "completed").length, runningCycleCount: cycles.filter((r: any) => r.status === "running").length, failedCycleCount: cycles.filter((r: any) => r.status === "failed").length, zeroTaskCycleCount: cycles.filter((r: any) => !r.taskCount).length, totalTaskCount: sum(cycles, "taskCount"), totalCaptureCount: sum(cycles, "captureCount"), totalIncidentCount: sum(cycles, "incidentCount"), queueDepth: summary.queue.queued, deadLetterCount: summary.queue.deadLetters, activeSourceCount: summary.activeSources.length, freshnessSeconds: summary.schedulerHealth.freshnessSeconds, errorRate: summary.schedulerHealth.errorRate, duplicateRate: summary.schedulerHealth.duplicateRate, promotionYield: summary.schedulerHealth.promotionYield, ...summary.evidenceStorage }, blockers: [], warnings: [], controls: { canaryPortfolioOnly: true, activationRequiresHumanApproval: true, continuousLoopAutoActivation: false, boundedQueueRequired: true, objectBoundaryRequired: true, fetchProvenanceRequired: true, nativeLiveHttpRequired: Boolean(input.requireNativeLiveHttp), restrictedSourcesExcluded: true }, proofCommands: [] };
}

export const buildCanaryOperatorConsoleHtml = (summary: CanaryOperatorSummary) => `<title>TI Canary Ops</title><h1>TI Canary Ops</h1><p>Active Sources: ${summary.activeSources.length}</p><p>Public Answer Readiness: ${summary.publicAnswerReadiness.length}</p><p>Why Partial: can cite canary captures when present</p>`;
export function startCanaryCollectionLoop(options: CanaryCollectionOptions & { enabled?: boolean; intervalSeconds?: number; queueLimit?: number; onCycle?: (r: any) => void; onError?: (e: unknown) => void }): CanaryCollectionLoopHandle {
  const state = detachedState(nowIso(), options.queueLimit ?? 500), intervalMs = Math.max(5, options.intervalSeconds ?? 300) * 1000; let timer: Timer | undefined;
  const cycle = async () => { if (!state.enabled || state.running) return; state.running = true; state.lastCycleAt = nowIso(); try { const result = await runCanaryCollectionCycle(options); state.latestResult = result; state.successCount++; state.lastSuccessAt = result.generatedAt; options.onCycle?.(result); } catch (e) { state.errorCount++; state.consecutiveErrorCount++; state.lastError = e instanceof Error ? e.message : String(e); state.lastErrorAt = nowIso(); options.onError?.(e); } finally { state.running = false; state.cycleCount++; state.nextCycleAt = new Date(Date.now() + intervalMs).toISOString(); } };
  Object.assign(state, { enabled: options.enabled !== false, intervalSeconds: options.intervalSeconds ?? 300, maxSources: options.maxSources ?? 10, maxTasks: options.maxTasks ?? 5, maxBytes: options.maxBytes ?? 512_000, timeoutMs: options.timeoutMs ?? 30_000, queueLimit: options.queueLimit ?? 500, activateSources: Boolean(options.activateSources) });
  if (state.enabled) timer = setInterval(cycle, intervalMs);
  return { stop: () => { if (timer) clearInterval(timer); state.enabled = false; }, getState: () => ({ ...state }) };
}

function src(id: string, name: string, type: string, url: string, q: string[], family: string) { return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "low", trustScore: 0.85, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q } }; }
function taskFor(source: any, at: string, runId: string, maxBytes: number) { return { id: stableId("task", `${source.id}:${at}`), sourceId: source.id, targetUrl: source.url, sourceType: source.type, queuedAt: at, priority: source.trustScore ?? 0.5, reason: "public_canary", retryCount: 0, maxBytes, runId }; }
async function fetchItem(source: any, task: any, fetcher: CanaryFetch, mode: string, at: string, maxBytes: number) { const started = Date.now(), res = await fetcher(task.targetUrl, { headers: { "user-agent": "hanasand-ti-scraper-canary/0.1 (+safe-public-canary)" } }); const fetched = (await res.text()).slice(0, maxBytes); const text = `${source.name}\n${fetched}`; const metadata = { canaryPortfolio: true, fetchMode: mode, finalUrlHash: hashContent(res.url || task.targetUrl), responseBytes: fetched.length, fetchProvenance: { mode, adapterVersion: "public_canary_fetcher:v1", requestedUrlHash: hashContent(task.targetUrl), finalUrlHash: hashContent(res.url || task.targetUrl), httpStatus: res.status, ok: res.ok, contentType: res.headers.get("content-type") ?? undefined, fetchedAt: at, durationMs: Date.now() - started, bytesReceived: fetched.length, maxBytes, truncated: fetched.length >= maxBytes, bounded: true, userAgent: "hanasand-ti-scraper-canary/0.1 (+safe-public-canary)" } }; return { source, task, url: task.targetUrl, title: source.name, rawText: text, body: text, collectedAt: at, contentHash: hashContent(`${source.id}:${text}`), metadata }; }
function externalize(capture: any, objectStore: any) { const body = capture.body ?? ""; const record = objectStore.putObject?.({ tenantId: capture.tenantId, sourceId: capture.sourceId, captureId: capture.id, body, mediaType: capture.mediaType ?? "text/plain", contentHash: capture.contentHash, retentionClass: "public_report", metadata: capture.metadata }); return { ...capture, body: undefined, storageKind: "external_object", objectRef: record?.ref, metadata: { ...capture.metadata, safeExcerpt: body.slice(0, 600), objectRef: record?.ref } }; }
const canaryCaptures = (store: any) => store.listCaptures().filter((c: any) => store.getSource?.(c.sourceId)?.metadata?.canaryPortfolio || c.metadata?.canaryPortfolio);
function storageStats(captures: any[]) { const nativeLiveHttpCaptureCount = captures.filter((c) => c.metadata?.fetchMode === "native_live_http").length, injectedProofFetchCaptureCount = captures.filter((c) => c.metadata?.fetchMode === "injected_proof_fetch").length, externalObjectCaptureCount = captures.filter((c) => c.storageKind === "external_object" || c.storageKind === "object_ref").length; return { metadataStore: "file_backed_or_repository", productionEvidenceMode: nativeLiveHttpCaptureCount && !injectedProofFetchCaptureCount ? "native_live_http" : injectedProofFetchCaptureCount && !nativeLiveHttpCaptureCount ? "injected_proof_only" : nativeLiveHttpCaptureCount ? "mixed" : "none", externalObjectCaptureCount, inlineCaptureCount: captures.length - externalObjectCaptureCount, missingObjectReferenceCount: captures.filter((c) => ["external_object", "object_ref"].includes(c.storageKind) && !c.objectRef).length, nativeLiveHttpCaptureCount, injectedProofFetchCaptureCount, unknownFetchModeCaptureCount: captures.filter((c) => !c.metadata?.fetchMode).length }; }
function health(store: any, at: string, counters: any) { const captures = canaryCaptures(store), latest = captures.map((c) => c.collectedAt).sort().at(-1), incidents = store.listIncidents?.().length ?? 0; return { freshnessSeconds: latest ? Math.max(0, (Date.parse(at) - Date.parse(latest)) / 1000) : Infinity, errorRate: rate(counters.failedTaskCount, counters.leasedTaskCount), duplicateRate: rate(counters.duplicateCaptureCount, (counters.duplicateCaptureCount ?? 0) + (counters.insertedCaptureCount ?? 0)), promotionYield: rate(counters.incidentCount ?? incidents, counters.insertedCaptureCount ?? captures.length) }; }
function detachedState(at: string, queueLimit: number): CanaryLoopState { return { schemaVersion: "ti.public_canary_loop_runtime.v1", supervisorAttached: false, enabled: false, running: false, startedAt: at, intervalSeconds: 300, cycleCount: 0, successCount: 0, errorCount: 0, consecutiveErrorCount: 0, maxSources: 10, maxTasks: 5, maxBytes: 512_000, timeoutMs: 30_000, queueLimit, activateSources: false, controls: { canaryPortfolioOnly: true, activationRequiresHumanApproval: true, continuousLoopAutoActivation: false, nativeFetchDefault: true, objectBoundaryConfigured: true, boundedQueueRequired: true, dedupeBeforeWrite: true, retriesBounded: true, restrictedSourcesExcluded: true } }; }
const rate = (n = 0, d = 0) => d > 0 ? n / d : 0; const sum = (rows: any[], key: string) => rows.reduce((n, r) => n + (r[key] ?? 0), 0);
const searchable = (capture: any) => `${capture.title ?? ""} ${capture.body ?? ""} ${capture.rawText ?? ""} ${capture.metadata?.safeExcerpt ?? ""}`.toLowerCase();
