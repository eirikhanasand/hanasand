import type { FocusedFrontier } from "../frontier/frontier.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import type { ObjectEvidenceStore } from "../storage/evidenceStore.ts";
import type { ScraperStore } from "../storage/memoryStore.ts";
import type { CollectionPlan, CollectionRun, CollectionTask, RawCapture, SourceCatalogMetadata, SourceRecord } from "../types.ts";
import { hashContent, normalizeWhitespace, nowIso, stableId } from "../utils.ts";

export type CanaryFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface CanaryCollectionOptions {
  store: ScraperStore;
  frontier: FocusedFrontier;
  objectStore?: ObjectEvidenceStore;
  fetch?: CanaryFetch;
  tenantId?: string;
  maxSources?: number;
  maxTasks?: number;
  maxBytes?: number;
  timeoutMs?: number;
  operatorId?: string;
  now?: () => string;
}

export interface CanaryActivationResult {
  generatedAt: string;
  operatorId: string;
  activated: Array<{ sourceId: string; sourceName: string; from: SourceRecord["status"]; to: SourceRecord["status"] }>;
  alreadyActive: string[];
  rejected: Array<{ sourceId: string; reason: string }>;
}

export interface CanaryDeactivationResult {
  generatedAt: string;
  operatorId: string;
  paused: Array<{ sourceId: string; sourceName: string; from: SourceRecord["status"]; to: "paused" }>;
  alreadyInactive: string[];
}

export interface CanaryCollectionCycleResult {
  generatedAt: string;
  mode: "production_canary";
  runId: string;
  planId: string;
  activatedSourceCount: number;
  queuedTaskCount: number;
  leasedTaskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
  retryScheduledCount: number;
  retryExhaustedCount: number;
  remainingQueuedTaskCount: number;
  insertedCaptureCount: number;
  duplicateCaptureCount: number;
  incidentCount: number;
  latestCaptureIds: string[];
  errors: Array<{ taskId?: string; sourceId?: string; message: string }>;
  health: {
    freshnessSeconds: number;
    errorRate: number;
    duplicateRate: number;
    promotionYield: number;
  };
}

export interface CanaryOperatorSummary {
  generatedAt: string;
  mode: "production_canary";
  activeSources: Array<{
    sourceId: string;
    sourceName: string;
    type: SourceRecord["type"];
    url: string;
    status: SourceRecord["status"];
    lastCollectedAt?: string;
    nextEligibleAt?: string;
    trustScore: number;
  }>;
  queue: {
    queued: number;
    leased: number;
    deadLetters: number;
  };
  latestRun?: {
    runId: string;
    status: CollectionRun["status"];
    taskCount: number;
    captureCount: number;
    incidentCount: number;
    updatedAt: string;
    error?: string;
  };
  schedulerHealth: {
    freshnessSeconds: number;
    errorRate: number;
    duplicateRate: number;
    promotionYield: number;
    retryScheduledCount: number;
    retryExhaustedCount: number;
    healthySourceCount: number;
    degradedSourceCount: number;
    failingSourceCount: number;
  };
  evidenceStorage: {
    metadataStore: "file_backed_or_repository";
    externalObjectCaptureCount: number;
    inlineCaptureCount: number;
    missingObjectReferenceCount: number;
  };
  blockedOrHeldItems: Array<{
    sourceId?: string;
    taskId?: string;
    reason: string;
    state: "blocked" | "held" | "dead_letter";
  }>;
  latestCaptures: Array<{
    captureId: string;
    sourceId: string;
    url: string;
    collectedAt: string;
    storageKind: RawCapture["storageKind"];
    contentHash: string;
    title?: string;
  }>;
  extraction: {
    captureCount: number;
    incidentCount: number;
    averageIncidentConfidence: number;
    reviewReasons: Record<string, number>;
  };
  publicAnswerReadiness: Array<{
    query: string;
    captureCount: number;
    latestCollectedAt?: string;
    whyPartial: string[];
  }>;
}

const CANARY_QUERIES = ["APT29", "APT42", "Turla", "Volt Typhoon", "Scattered Spider", "Akira", "CVE"];

export const PUBLIC_CANARY_SOURCE_PORTFOLIO: SourceRecord[] = [
  canarySource("src_canary_cisa_alerts", "CISA Cybersecurity Alerts", "rss", "https://www.cisa.gov/cybersecurity-advisories/all.xml", ["government_advisories", "vulnerability_intelligence"], ["APT29", "Volt Typhoon", "CVE"], "government"),
  canarySource("src_canary_cisa_known_exploited", "CISA Known Exploited Vulnerabilities", "static_web", "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", ["government_advisories", "vulnerability_intelligence"], ["CVE"], "government"),
  canarySource("src_canary_microsoft_threat_intelligence", "Microsoft Threat Intelligence Blog", "rss", "https://www.microsoft.com/en-us/security/blog/topic/threat-intelligence/feed/", ["vendor_research", "actor_intelligence"], ["APT29", "APT42", "Volt Typhoon", "Scattered Spider"], "vendor"),
  canarySource("src_canary_google_cloud_threat_intel", "Google Cloud Threat Intelligence Blog", "rss", "https://cloud.google.com/blog/products/identity-security/rss", ["vendor_research", "actor_intelligence"], ["APT42", "Turla", "Akira"], "vendor"),
  canarySource("src_canary_mandiant", "Mandiant Threat Intelligence Blog", "rss", "https://cloud.google.com/blog/topics/threat-intelligence/rss", ["vendor_research", "actor_intelligence"], ["APT29", "APT42", "Turla"], "vendor"),
  canarySource("src_canary_unit42", "Unit 42 Threat Research", "rss", "https://unit42.paloaltonetworks.com/feed/", ["vendor_research", "malware_reports"], ["APT42", "Akira", "Scattered Spider"], "vendor"),
  canarySource("src_canary_recorded_future", "Recorded Future Research", "rss", "https://www.recordedfuture.com/research/feed", ["vendor_research", "actor_intelligence"], ["APT29", "Turla", "Akira"], "vendor"),
  canarySource("src_canary_thehackernews", "The Hacker News", "rss", "https://feeds.feedburner.com/TheHackersNews", ["news", "actor_intelligence"], ["APT29", "APT42", "Akira", "CVE"], "community"),
  canarySource("src_canary_bleepingcomputer", "BleepingComputer Security", "rss", "https://www.bleepingcomputer.com/feed/", ["news", "ransomware_victim_reporting"], ["Akira", "Scattered Spider", "CVE"], "community"),
  canarySource("src_canary_mitre_attack", "MITRE ATT&CK Groups", "static_web", "https://attack.mitre.org/groups/", ["standards_body", "actor_intelligence"], ["APT29", "APT42", "Turla", "Volt Typhoon"], "standards_body")
];

export function activatePublicCanarySources(input: {
  store: ScraperStore;
  tenantId?: string;
  operatorId?: string;
  now?: string;
  portfolio?: SourceRecord[];
}): CanaryActivationResult {
  const generatedAt = input.now ?? nowIso();
  const operatorId = input.operatorId ?? "canary-operator";
  const activated: CanaryActivationResult["activated"] = [];
  const alreadyActive: string[] = [];
  const rejected: CanaryActivationResult["rejected"] = [];

  for (const source of input.portfolio ?? PUBLIC_CANARY_SOURCE_PORTFOLIO) {
    const existing = input.store.getSource(source.id);
    const scoped = { ...source, tenantId: input.tenantId ?? source.tenantId };
    const candidate = existing ?? scoped;
    const rejection = canaryRejection(candidate);
    if (rejection) {
      rejected.push({ sourceId: candidate.id, reason: rejection });
      continue;
    }
    if (candidate.status === "active") {
      alreadyActive.push(candidate.id);
      continue;
    }
    const updated: SourceRecord = {
      ...candidate,
      status: "active",
      approvedAt: candidate.approvedAt ?? generatedAt,
      approvedBy: candidate.approvedBy ?? operatorId,
      updatedAt: generatedAt,
      governance: {
        approvalState: "approved",
        approvalRequired: false,
        metadataOnly: false,
        approvedAt: candidate.governance?.approvedAt ?? generatedAt,
        approvedBy: candidate.governance?.approvedBy ?? operatorId,
        policyVersion: "collection-policy:v1",
        riskJustification: "Safe public canary source portfolio; no restricted protocols or private access."
      },
      lifecycle: [
        ...(candidate.lifecycle ?? []),
        {
          at: generatedAt,
          from: candidate.status,
          to: "active",
          reason: "operator_request",
          actorId: operatorId,
          note: "Executable public canary activation; reversible by pausing or retiring the source."
        }
      ]
    };
    input.store.saveSource(updated);
    activated.push({ sourceId: updated.id, sourceName: updated.name, from: candidate.status, to: "active" });
  }

  return { generatedAt, operatorId, activated, alreadyActive, rejected };
}

export function pausePublicCanarySources(input: {
  store: ScraperStore;
  tenantId?: string;
  operatorId?: string;
  now?: string;
}): CanaryDeactivationResult {
  const generatedAt = input.now ?? nowIso();
  const operatorId = input.operatorId ?? "canary-operator";
  const paused: CanaryDeactivationResult["paused"] = [];
  const alreadyInactive: string[] = [];

  for (const source of input.store.listSources()) {
    if (source.metadata?.canaryPortfolio !== true) continue;
    if (input.tenantId && source.tenantId && source.tenantId !== input.tenantId) continue;
    if (source.status !== "active" && source.status !== "degraded" && source.status !== "probation") {
      alreadyInactive.push(source.id);
      continue;
    }
    const updated: SourceRecord = {
      ...source,
      status: "paused",
      updatedAt: generatedAt,
      lifecycle: [
        ...(source.lifecycle ?? []),
        {
          at: generatedAt,
          from: source.status,
          to: "paused",
          reason: "operator_request",
          actorId: operatorId,
          note: "Reversible public canary pause; source remains approved but no longer schedules collection."
        }
      ],
      crawlState: {
        retryCount: source.crawlState?.retryCount ?? 0,
        ...source.crawlState,
        nextEligibleAt: undefined
      }
    };
    input.store.saveSource(updated);
    paused.push({ sourceId: updated.id, sourceName: updated.name, from: source.status, to: "paused" });
  }

  return { generatedAt, operatorId, paused, alreadyInactive };
}

export async function runCanaryCollectionCycle(options: CanaryCollectionOptions): Promise<CanaryCollectionCycleResult> {
  const generatedAt = options.now?.() ?? nowIso();
  const fetcher = options.fetch ?? fetch;
  const maxSources = Math.max(1, options.maxSources ?? 10);
  const maxTasks = Math.max(1, options.maxTasks ?? 5);
  const maxBytes = Math.max(1024, options.maxBytes ?? 512_000);
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? 30_000);
  const activation = activatePublicCanarySources({
    store: options.store,
    tenantId: options.tenantId,
    operatorId: options.operatorId,
    now: generatedAt
  });
  const sources = options.store.listSources()
    .filter((source) => source.status === "active")
    .filter((source) => !options.tenantId || source.tenantId === options.tenantId || source.tenantId === undefined)
    .filter((source) => !canaryRejection(source))
    .slice(0, maxSources);

  const dueSources = sources.filter((source) => sourceDue(source, generatedAt));
  const planId = stableId("canary-plan", `${options.tenantId ?? "global"}:${generatedAt}`);
  const runId = stableId("canary-run", `${planId}:${options.operatorId ?? "canary-operator"}`);
  const tasks = dueSources.map((source) => taskForSource(source, generatedAt, options.tenantId, maxBytes, runId));
  const plan = canaryCollectionPlan({
    planId,
    tenantId: options.tenantId,
    operatorId: options.operatorId,
    generatedAt,
    tasks,
    rejected: activation.rejected
  });
  const run = canaryCollectionRun({
    runId,
    plan,
    generatedAt,
    taskCount: tasks.length,
    rejectedSourceCount: activation.rejected.length
  });
  options.store.savePlan(plan);
  options.store.saveRun(run);

  for (const source of dueSources) {
    options.store.saveSource({
      ...source,
      updatedAt: generatedAt,
      crawlState: {
        retryCount: source.crawlState?.retryCount ?? 0,
        ...source.crawlState,
        lastScheduledAt: generatedAt,
        nextEligibleAt: new Date(Date.parse(generatedAt) + source.crawlFrequencySeconds * 1000).toISOString()
      }
    });
  }
  for (const task of tasks) options.frontier.enqueueTask(task);

  let queuedTaskCount = tasks.length;

  const errors: CanaryCollectionCycleResult["errors"] = [];
  const latestCaptureIds: string[] = [];
  let leasedTaskCount = 0;
  let completedTaskCount = 0;
  let failedTaskCount = 0;
  let retryScheduledCount = 0;
  let retryExhaustedCount = 0;
  let insertedCaptureCount = 0;
  let duplicateCaptureCount = 0;
  let incidentCount = 0;

  for (let index = 0; index < maxTasks; index += 1) {
    const leased = options.frontier.next(new Date(generatedAt));
    if (!leased) break;
    leasedTaskCount += 1;
    const task = leased.task;
    const source = options.store.getSource(task.sourceId);
    if (!source) {
      failedTaskCount += 1;
      const ack = options.frontier.fail(task, new Date(generatedAt), "source missing");
      if (ack.status === "retry_scheduled") retryScheduledCount += 1;
      if (ack.status === "retry_exhausted") retryExhaustedCount += 1;
      errors.push({ taskId: task.id, sourceId: task.sourceId, message: "source missing" });
      continue;
    }

    try {
      const item = await fetchCanaryCollectedItem(source, task, fetcher, generatedAt, maxBytes, timeoutMs);
      const pipeline = processCollectedItem(item);
      const body = pipeline.capture.body;
      const capture = body && options.objectStore && !pipeline.capture.sensitive
        ? externalizedCapture(pipeline.capture, options.objectStore, body)
        : pipeline.capture;
      const duplicateBeforeWrite = options.store.findDuplicateCapture(capture);
      const saved = options.store.savePipelineResult({ ...pipeline, capture });
      const wasDuplicate = Boolean(duplicateBeforeWrite && duplicateBeforeWrite.id !== capture.id) || saved.capture.id !== capture.id;
      if (wasDuplicate) duplicateCaptureCount += 1;
      else insertedCaptureCount += 1;
      if (saved.incident) incidentCount += 1;
      latestCaptureIds.push(saved.capture.id);
      completedTaskCount += 1;
      options.frontier.complete(task);
      updateSourceSuccess(options.store, source, generatedAt);
      updateRunProgress(options.store, task, generatedAt, saved.incident ? 1 : 0);
    } catch (error) {
      failedTaskCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      const ack = options.frontier.fail(task, new Date(generatedAt), message);
      if (ack.status === "retry_scheduled") retryScheduledCount += 1;
      if (ack.status === "retry_exhausted") retryExhaustedCount += 1;
      errors.push({ taskId: task.id, sourceId: task.sourceId, message });
      updateSourceFailure(options.store, source, generatedAt, message);
    }
  }
  const remainingQueuedTaskCount = options.frontier.snapshot().filter((item) => item.task.runId === runId).length;
  finalizeCanaryRun(options.store, runId, generatedAt, {
    completedTaskCount,
    failedTaskCount,
    retryScheduledCount,
    retryExhaustedCount,
    remainingQueuedTaskCount,
    error: errors[0]?.message
  });

  return {
    generatedAt,
    mode: "production_canary",
    runId,
    planId,
    activatedSourceCount: activation.activated.length + activation.alreadyActive.length,
    queuedTaskCount,
    leasedTaskCount,
    completedTaskCount,
    failedTaskCount,
    retryScheduledCount,
    retryExhaustedCount,
    remainingQueuedTaskCount,
    insertedCaptureCount,
    duplicateCaptureCount,
    incidentCount,
    latestCaptureIds,
    errors,
    health: {
      freshnessSeconds: latestFreshnessSeconds(options.store, generatedAt),
      errorRate: rate(failedTaskCount, leasedTaskCount),
      duplicateRate: rate(duplicateCaptureCount, duplicateCaptureCount + insertedCaptureCount),
      promotionYield: rate(incidentCount, insertedCaptureCount)
    }
  };
}

export function buildCanaryOperatorSummary(input: {
  store: ScraperStore;
  frontier: FocusedFrontier;
  generatedAt?: string;
}): CanaryOperatorSummary {
  const generatedAt = input.generatedAt ?? nowIso();
  const canarySources = input.store.listSources()
    .filter((source) => source.metadata?.canaryPortfolio === true);
  const activeSourceRecords = canarySources.filter((source) => source.status === "active");
  const latestRun = input.store.listRuns()
    .filter((run) => run.requestId.startsWith("req_public_canary"))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const deadLetters = input.frontier.deadLetterSnapshot();
  const activeSources = activeSourceRecords.map((source) => ({
      sourceId: source.id,
      sourceName: source.name,
      type: source.type,
      url: source.url,
      status: source.status,
      lastCollectedAt: source.crawlState?.lastCollectedAt,
      nextEligibleAt: source.crawlState?.nextEligibleAt,
      trustScore: source.trustScore
    }));
  const latestCaptures = input.store.listCaptures()
    .filter((capture) => input.store.getSource(capture.sourceId)?.metadata?.canaryPortfolio === true)
    .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))
    .slice(0, 20)
    .map((capture) => ({
      captureId: capture.id,
      sourceId: capture.sourceId,
      url: capture.url,
      collectedAt: capture.collectedAt,
      storageKind: capture.storageKind,
      contentHash: capture.contentHash,
      title: typeof capture.metadata.title === "string" ? capture.metadata.title : undefined
    }));
  const canaryCaptures = input.store.listCaptures()
    .filter((capture) => input.store.getSource(capture.sourceId)?.metadata?.canaryPortfolio === true);
  const incidents = input.store.listIncidents();
  const reviewReasons = new Map<string, number>();
  let confidenceSum = 0;
  for (const incident of incidents) {
    confidenceSum += incident.confidence;
    for (const reason of incident.reviewReasons) reviewReasons.set(reason, (reviewReasons.get(reason) ?? 0) + 1);
  }

  return {
    generatedAt,
    mode: "production_canary",
    activeSources,
    queue: {
      queued: input.frontier.snapshot().length,
      leased: input.frontier.leasedSnapshot().length,
      deadLetters: deadLetters.length
    },
    latestRun: latestRun ? {
      runId: latestRun.id,
      status: latestRun.status,
      taskCount: latestRun.taskCount,
      captureCount: latestRun.captureCount,
      incidentCount: latestRun.incidentCount,
      updatedAt: latestRun.updatedAt,
      error: latestRun.error
    } : undefined,
    schedulerHealth: {
      freshnessSeconds: latestFreshnessSeconds(input.store, generatedAt),
      errorRate: sourceErrorRate(activeSourceRecords),
      duplicateRate: canaryDuplicateRate(canaryCaptures),
      promotionYield: rate(incidents.length, Math.max(1, canaryCaptures.length)),
      retryScheduledCount: input.frontier.groupedSnapshot(new Date(generatedAt)).metrics.throughput.retryScheduled,
      retryExhaustedCount: input.frontier.groupedSnapshot(new Date(generatedAt)).metrics.throughput.retryExhausted,
      healthySourceCount: activeSourceRecords.filter((source) => source.health?.status === "healthy").length,
      degradedSourceCount: activeSourceRecords.filter((source) => source.health?.status === "degraded").length,
      failingSourceCount: activeSourceRecords.filter((source) => source.health?.status === "failing").length
    },
    evidenceStorage: {
      metadataStore: "file_backed_or_repository",
      externalObjectCaptureCount: canaryCaptures.filter((capture) => capture.storageKind === "external_object").length,
      inlineCaptureCount: canaryCaptures.filter((capture) => capture.storageKind !== "external_object").length,
      missingObjectReferenceCount: canaryCaptures.filter((capture) => capture.storageKind === "external_object" && !capture.objectRef).length
    },
    blockedOrHeldItems: [
      ...deadLetters.map((dead) => ({
        taskId: dead.taskId,
        sourceId: dead.task?.sourceId,
        reason: dead.reason,
        state: "dead_letter" as const
      })),
      ...canarySources
        .filter((source) => source.status !== "active")
        .map((source) => ({
          sourceId: source.id,
          reason: source.status === "approved" ? "approved but not active" : `source status is ${source.status}`,
          state: source.status === "quarantined" || source.status === "disabled" || source.status === "rejected" ? "blocked" as const : "held" as const
        }))
    ],
    latestCaptures,
    extraction: {
      captureCount: latestCaptures.length,
      incidentCount: incidents.length,
      averageIncidentConfidence: incidents.length ? Number((confidenceSum / incidents.length).toFixed(3)) : 0,
      reviewReasons: Object.fromEntries([...reviewReasons.entries()].sort((a, b) => a[0].localeCompare(b[0])))
    },
    publicAnswerReadiness: CANARY_QUERIES.map((query) => {
      const captures = canaryCaptures.filter((capture) =>
        `${capture.url} ${capture.body ?? ""} ${String(capture.metadata.safeExcerpt ?? "")} ${String(capture.metadata.title ?? "")}`.toLowerCase().includes(query.toLowerCase())
      );
      return {
        query,
        captureCount: captures.length,
        latestCollectedAt: captures.map((capture) => capture.collectedAt).sort().at(-1),
        whyPartial: captures.length === 0
          ? ["no fresh canary capture matched this query yet"]
          : incidents.length === 0
            ? ["captures exist but extraction has not produced incident candidates yet"]
            : ["public answer can cite canary captures but still needs corroboration before high-confidence wording"]
      };
    })
  };
}

export function buildCanaryOperatorConsoleHtml(summary: CanaryOperatorSummary): string {
  const health = summary.schedulerHealth;
  const rows = [
    ["Active sources", String(summary.activeSources.length)],
    ["Queued tasks", String(summary.queue.queued)],
    ["Leased tasks", String(summary.queue.leased)],
    ["Dead letters", String(summary.queue.deadLetters)],
    ["Latest captures", String(summary.latestCaptures.length)],
    ["Promotion yield", health.promotionYield.toFixed(3)],
    ["Error rate", health.errorRate.toFixed(3)]
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>TI Canary Operator Console</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #17202a; }
    table { border-collapse: collapse; min-width: 420px; }
    th, td { border-bottom: 1px solid #d8dee4; padding: 8px 10px; text-align: left; }
    th { background: #f6f8fa; }
    code { background: #f6f8fa; padding: 2px 4px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>TI Canary Operator Console</h1>
  <p>Generated at <code>${escapeHtml(summary.generatedAt)}</code></p>
  <table>
    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
    <tbody>${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function startCanaryCollectionLoop(options: CanaryCollectionOptions & {
  intervalSeconds?: number;
  enabled?: boolean;
  onCycle?: (result: CanaryCollectionCycleResult) => void;
  onError?: (error: unknown) => void;
}): { stop(): void } {
  if (options.enabled === false) return { stop() {} };
  let running = false;
  const intervalMs = Math.max(5, options.intervalSeconds ?? 60) * 1000;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      options.onCycle?.(await runCanaryCollectionCycle(options));
    } catch (error) {
      options.onError?.(error);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  return { stop: () => clearInterval(timer) };
}

async function fetchCanaryCollectedItem(source: SourceRecord, task: CollectionTask, fetcher: CanaryFetch, collectedAt: string, maxBytes: number, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetcher(task.targetUrl, {
      signal: controller.signal,
      headers: {
        "accept": source.type === "rss" ? "application/rss+xml, application/xml, text/xml, text/html;q=0.8, text/plain;q=0.5" : "text/html, text/plain;q=0.8",
        "user-agent": "hanasand-ti-scraper-canary/0.1 (+safe-public-canary)"
      }
    });
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`canary fetch timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = (await response.text()).slice(0, maxBytes);
  const parsed = source.type === "rss" ? parseRssText(text) : parseHtmlText(text, task.targetUrl);
  const rawText = normalizeWhitespace(parsed.rawText || text);
  if (!rawText) throw new Error("empty response body");
  return {
    sourceId: source.id,
    taskId: task.id,
    url: parsed.url ?? task.targetUrl,
    collectedAt,
    publishedAt: parsed.publishedAt,
    title: parsed.title ?? source.name,
    rawText,
    html: source.type === "rss" ? undefined : text,
    contentHash: hashContent(`${source.id}:${task.targetUrl}:${rawText}`),
    language: source.language ?? "en",
    links: parsed.links,
    metadata: {
      adapter: "public_canary",
      sourceType: source.type,
      query: "public canary",
      normalizedQuery: "public canary",
      title: parsed.title ?? source.name,
      evidenceStage: "captured_page",
      canary: true,
      sourceUrl: source.url
    },
    sensitive: false
  };
}

function externalizedCapture(capture: RawCapture, objectStore: ObjectEvidenceStore, body: string): RawCapture {
  const record = objectStore.putObject({
    tenantId: capture.tenantId,
    sourceId: capture.sourceId,
    captureId: capture.id,
    mediaType: capture.mediaType,
    body,
    contentHash: capture.contentHash,
    retentionClass: "public_raw",
    metadata: capture.metadata
  });
  return {
    ...capture,
    body: undefined,
    objectRef: record.ref,
    storageKind: "external_object",
    retentionClass: "public_raw",
    metadata: {
      ...capture.metadata,
      durableObjectBoundary: "file_or_object_store",
      bodyExternalized: true,
      safeExcerpt: normalizeWhitespace(body).slice(0, 700)
    }
  };
}

function canaryCollectionPlan(input: {
  planId: string;
  tenantId?: string;
  operatorId?: string;
  generatedAt: string;
  tasks: CollectionTask[];
  rejected: Array<{ sourceId: string; reason: string }>;
}): CollectionPlan {
  const requestId = stableId("req_public_canary", `${input.tenantId ?? "global"}:${input.generatedAt}`);
  return {
    id: input.planId,
    tenantId: input.tenantId,
    request: {
      id: requestId,
      tenantId: input.tenantId,
      query: "public canary",
      entityType: "free_text",
      includeClearWeb: true,
      includeTelegram: false,
      includeDarknetMetadata: false,
      maxTasks: input.tasks.length,
      createdAt: input.generatedAt,
      requesterId: input.operatorId,
      priority: "normal",
      reason: "continuous safe-public source canary collection",
      budgetClass: "background_refresh"
    },
    tasks: input.tasks,
    reviewRequired: [],
    rejected: input.rejected,
    queryTerms: CANARY_QUERIES,
    budget: {
      class: "background_refresh",
      maxTasks: input.tasks.length,
      immediateTaskLimit: input.tasks.length,
      maxBytesPerTask: Math.max(0, ...input.tasks.map((task) => task.maxBytes ?? 0)),
      deadlineAt: new Date(Date.parse(input.generatedAt) + 5 * 60_000).toISOString(),
      backgroundAvailableAt: input.generatedAt
    },
    audit: [{
      id: stableId("audit", `public-canary:${input.planId}`),
      tenantId: input.tenantId,
      actorId: input.operatorId,
      action: "public_canary_plan_created",
      subjectType: "collection_plan",
      subjectId: input.planId,
      occurredAt: input.generatedAt,
      metadata: {
        safePublicOnly: true,
        restrictedSourcesAllowed: false,
        taskCount: input.tasks.length,
        rejectedSourceCount: input.rejected.length
      }
    }]
  };
}

function canaryCollectionRun(input: {
  runId: string;
  plan: CollectionPlan;
  generatedAt: string;
  taskCount: number;
  rejectedSourceCount: number;
}): CollectionRun {
  return {
    id: input.runId,
    tenantId: input.plan.tenantId,
    planId: input.plan.id,
    requestId: input.plan.request.id,
    status: input.taskCount > 0 ? "queued" : "completed",
    createdAt: input.generatedAt,
    updatedAt: input.generatedAt,
    startedAt: input.taskCount > 0 ? input.generatedAt : undefined,
    completedAt: input.taskCount === 0 ? input.generatedAt : undefined,
    idempotencyKey: `public-canary:${input.plan.tenantId ?? "global"}:${input.generatedAt}`,
    requestHash: stableId("canary-request", `${input.plan.id}:${input.taskCount}`),
    taskCount: input.taskCount,
    reviewTaskCount: 0,
    rejectedSourceCount: input.rejectedSourceCount,
    captureCount: 0,
    incidentCount: 0
  };
}

function finalizeCanaryRun(
  store: ScraperStore,
  runId: string,
  at: string,
  result: {
    completedTaskCount: number;
    failedTaskCount: number;
    retryScheduledCount: number;
    retryExhaustedCount: number;
    remainingQueuedTaskCount: number;
    error?: string;
  }
): void {
  const run = store.getRun(runId);
  if (!run) return;
  const captureCount = store.listCaptures().filter((capture) => capture.metadata.canary === true && capture.collectedAt === at).length;
  const incidentCount = store.listIncidents().filter((incident) => {
    const capture = incident.captureId ? store.getCapture(incident.captureId) : undefined;
    return capture?.metadata.canary === true && capture.collectedAt === at;
  }).length;
  const terminal = result.remainingQueuedTaskCount === 0;
  const status: CollectionRun["status"] = terminal
    ? result.retryExhaustedCount > 0 && result.completedTaskCount === 0
      ? "failed"
      : "completed"
    : "running";
  store.saveRun({
    ...run,
    status,
    updatedAt: at,
    completedAt: terminal ? at : undefined,
    captureCount,
    incidentCount,
    error: result.error && (status === "failed" || result.failedTaskCount > 0)
      ? `${result.error}; retryScheduled=${result.retryScheduledCount}; retryExhausted=${result.retryExhaustedCount}`
      : undefined
  });
}

function taskForSource(source: SourceRecord, queuedAt: string, tenantId: string | undefined, maxBytes: number, runId: string): CollectionTask {
  return {
    id: stableId("canary-task", `${source.id}:${queuedAt}`),
    tenantId: tenantId ?? source.tenantId,
    sourceId: source.id,
    targetUrl: source.url,
    sourceType: source.type,
    queuedAt,
    priority: 75,
    reason: "production public canary collection",
    retryCount: 0,
    maxRetries: 1,
    runId,
    sourceConcurrencyKey: source.id,
    fairnessKey: "public-canary",
    crawlBudgetKey: "public-canary",
    maxBytes,
    planning: {
      budgetClass: "background_refresh",
      decision: "selected",
      reason: "safe public source selected for production canary collection",
      queryTerms: CANARY_QUERIES,
      freshness: 1,
      freshnessTargetSeconds: source.catalog?.collection.freshnessTargetSeconds ?? source.crawlFrequencySeconds,
      safetyEnvelope: {
        allowClearWeb: true,
        allowPublicChannel: false,
        allowRestrictedMetadata: false,
        metadataOnlyRestricted: false,
        forbiddenOperations: ["auth_bypass", "captcha_solving", "private_channel_join", "restricted_download"]
      },
      sourceTrust: source.trustScore,
      selectedFor: "background"
    }
  };
}

function canaryRejection(source: SourceRecord): string | undefined {
  if (!["rss", "static_web", "api", "pdf"].includes(source.type)) return "only clear-web public source types are allowed";
  if (!["public_http", "official_api"].includes(source.accessMethod)) return "only public_http or official_api access is allowed";
  if (source.risk !== "low" && source.risk !== "medium") return "restricted or high-risk sources are excluded";
  if (!source.legalNotes.trim()) return "legal notes are required";
  return undefined;
}

function sourceDue(source: SourceRecord, now: string): boolean {
  const backoffUntil = source.crawlState?.backoffUntil;
  if (backoffUntil && Date.parse(backoffUntil) > Date.parse(now)) return false;
  const nextEligibleAt = source.crawlState?.nextEligibleAt;
  return !nextEligibleAt || Date.parse(nextEligibleAt) <= Date.parse(now);
}

function updateSourceSuccess(store: ScraperStore, source: SourceRecord, at: string): void {
  store.saveSource({
    ...source,
    lastSeenAt: at,
    updatedAt: at,
    health: {
      status: "healthy",
      checkedAt: at,
      lastSuccessAt: at,
      consecutiveFailures: 0,
      errorRate: 0
    },
    crawlState: {
      retryCount: 0,
      ...source.crawlState,
      lastCollectedAt: at,
      nextEligibleAt: new Date(Date.parse(at) + source.crawlFrequencySeconds * 1000).toISOString()
    }
  });
}

function updateSourceFailure(store: ScraperStore, source: SourceRecord, at: string, message: string): void {
  const failures = (source.health?.consecutiveFailures ?? 0) + 1;
  store.saveSource({
    ...source,
    updatedAt: at,
    health: {
      status: failures >= 3 ? "failing" : "degraded",
      checkedAt: at,
      lastSuccessAt: source.health?.lastSuccessAt,
      lastFailureAt: at,
      consecutiveFailures: failures,
      errorRate: Math.min(1, (source.health?.errorRate ?? 0) + 0.1),
      lastError: message
    },
    crawlState: {
      retryCount: failures,
      ...source.crawlState,
      backoffUntil: new Date(Date.parse(at) + Math.min(3600, failures * 300) * 1000).toISOString(),
      nextEligibleAt: new Date(Date.parse(at) + Math.min(3600, failures * 300) * 1000).toISOString()
    }
  });
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? Number((numerator / denominator).toFixed(3)) : 0;
}

function latestFreshnessSeconds(store: ScraperStore, generatedAt: string): number {
  const latest = store.listCaptures()
    .filter((capture) => store.getSource(capture.sourceId)?.metadata?.canaryPortfolio === true)
    .map((capture) => Date.parse(capture.collectedAt))
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((a, b) => b - a)[0];
  return latest ? Math.max(0, Math.floor((Date.parse(generatedAt) - latest) / 1000)) : 0;
}

function sourceErrorRate(sources: SourceRecord[]): number {
  if (sources.length === 0) return 0;
  return Number((sources.reduce((sum, source) => sum + (source.health?.errorRate ?? 0), 0) / sources.length).toFixed(3));
}

function canaryDuplicateRate(captures: RawCapture[]): number {
  if (captures.length === 0) return 0;
  const uniqueHashes = new Set(captures.map((capture) => `${capture.sourceId}:${capture.canonicalUrl ?? capture.url}:${capture.contentHash}`));
  return rate(captures.length - uniqueHashes.size, captures.length);
}

function updateRunProgress(store: ScraperStore, task: CollectionTask, at: string, incidentDelta: number): void {
  if (!task.runId) return;
  const run = store.getRun(task.runId);
  if (!run) return;
  store.saveRun({
    ...run,
    status: "running",
    startedAt: run.startedAt ?? at,
    updatedAt: at,
    captureCount: run.captureCount + 1,
    incidentCount: run.incidentCount + incidentDelta
  });
}

function parseRssText(text: string): { title?: string; rawText: string; publishedAt?: string; url?: string; links: string[] } {
  const item = text.match(/<item[\s\S]*?<\/item>/i)?.[0] ?? text.match(/<entry[\s\S]*?<\/entry>/i)?.[0] ?? text;
  const title = xmlText(item, "title");
  const description = xmlText(item, "description") ?? xmlText(item, "summary") ?? xmlText(item, "content:encoded");
  const link = xmlText(item, "link") ?? item.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
  const publishedAt = xmlText(item, "pubDate") ?? xmlText(item, "updated") ?? xmlText(item, "published");
  const rawText = normalizeWhitespace([title, description].filter(Boolean).join(" "));
  return { title, rawText, publishedAt: publishedAt ? safeDate(publishedAt) : undefined, url: link, links: link ? [link] : [] };
}

function parseHtmlText(text: string, fallbackUrl: string): { title?: string; rawText: string; publishedAt?: string; url?: string; links: string[] } {
  const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g, "").trim();
  const rawText = normalizeWhitespace(text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&"));
  const links = [...text.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => {
      try {
        return new URL(match[1] ?? "", fallbackUrl).toString();
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .slice(0, 25);
  return { title, rawText, url: fallbackUrl, links };
}

function xmlText(xml: string, tag: string): string | undefined {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]
    ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

function safeDate(value: string): string | undefined {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function canarySource(
  id: string,
  name: string,
  type: SourceRecord["type"],
  url: string,
  topics: string[],
  actors: string[],
  trustBasis: SourceCatalogMetadata["publisher"]["trustBasis"]
): SourceRecord {
  const createdAt = "2026-05-24T00:00:00.000Z";
  return {
    id,
    name,
    type,
    url,
    accessMethod: "public_http",
    status: "approved",
    risk: "low",
    trustScore: trustBasis === "government" || trustBasis === "standards_body" ? 0.9 : 0.82,
    language: "en",
    crawlFrequencySeconds: 15 * 60,
    legalNotes: "Safe public canary source: public HTTP content only; no authentication, private access, or restricted collection.",
    createdAt,
    updatedAt: createdAt,
    tags: [...topics, ...actors.map((actor) => actor.toLowerCase())],
    metadata: {
      canaryPortfolio: true,
      sourcePortfolio: "public_canary_10",
      activationMode: "human_approved_executable"
    },
    catalog: {
      canonicalId: id,
      publisher: {
        name,
        homepage: new URL(url).origin,
        trustBasis
      },
      tier: trustBasis === "government" || trustBasis === "standards_body" ? "tier_1" : "tier_2",
      approvalScope: "safe_public_auto",
      license: "Public website/feed terms apply; store bounded excerpts/raw public pages only.",
      legalBasis: "Public HTTP collection for defensive cyber threat intelligence.",
      reliability: trustBasis === "government" || trustBasis === "standards_body" ? 0.9 : 0.78,
      intelligenceValue: 0.78,
      retentionClass: "public_raw",
      coverage: {
        topics,
        actors,
        aliases: actors,
        industries: [],
        regions: [],
        countries: [],
        languages: ["en"],
        queryPatterns: actors
      },
      collection: {
        freshnessTargetSeconds: 1800,
        collectionSlaSeconds: 300,
        budgetClass: "normal",
        crawlCadenceSeconds: 900
      },
      adapterCompatibility: [type]
    }
  };
}
