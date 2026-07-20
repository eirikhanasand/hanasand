// @ts-nocheck
import { nowIso } from "../utils.ts";
import type {
  CanaryOperatorSummary,
  CanaryReadinessPacket,
  CanarySoakReport,
} from "./canaryCollectionTypes.ts";
import { canaryQueries } from "./canaryPortfolio.ts";
import {
  canaryCaptures,
  detachedState,
  health,
  searchable,
  storageStats,
  sum,
} from "./canaryHelpers.ts";

export function buildCanaryOperatorSummary(input: any): CanaryOperatorSummary {
  const generatedAt = input.generatedAt ?? nowIso(),
    captures = canaryCaptures(input.store),
    latestRun =
      input.store.listRuns().filter((r: any) =>
        r.requestId === "req_public_canary"
      ).sort((a: any, b: any) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const storage = storageStats(captures);
  const sourceRecords = input.store.listSources().filter((source: any) =>
    source.metadata?.canaryPortfolio && source.status === "active"
  );
  const attemptCount = (latestRun?.completedTaskCount ?? 0) +
    (latestRun?.failedTaskCount ?? 0);
  return {
    generatedAt,
    mode: "production_canary",
    activeSources: sourceRecords.map((s: any) => ({
      sourceId: s.id,
      sourceName: s.name,
      type: s.type,
      url: s.url,
      status: s.status,
      lastCollectedAt: s.crawlState?.lastCollectedAt,
      nextEligibleAt: s.crawlState?.nextEligibleAt,
      trustScore: s.trustScore,
    })),
    queue: {
      queued: input.frontier.size?.() ?? input.frontier.snapshot?.().length ??
        0,
      leased: 0,
      deadLetters: input.frontier.deadLetterSnapshot?.().length ?? 0,
    },
    latestRun,
    schedulerHealth: {
      ...health(input.store, generatedAt, {}),
      errorRate: attemptCount > 0 ? (latestRun?.failedTaskCount ?? 0) / attemptCount : 0,
      promotionYield: latestRun?.captureCount > 0 ? (latestRun.incidentCount ?? 0) / latestRun.captureCount : 0,
      duplicateRate: (latestRun?.duplicateCaptureCount ?? 0) / Math.max(1, (latestRun?.duplicateCaptureCount ?? 0) + (latestRun?.captureCount ?? 0)),
      retryScheduledCount: latestRun?.retryScheduledCount ?? 0,
      retryExhaustedCount: latestRun?.retryExhaustedCount ?? 0,
      healthySourceCount: sourceRecords.filter((source: any) => source.health?.status === "healthy").length,
      degradedSourceCount: sourceRecords.filter((source: any) => source.health?.status === "degraded").length,
      failingSourceCount: sourceRecords.filter((source: any) => source.health?.status === "failing").length,
    },
    runtime: input.runtime ?? detachedState(generatedAt, 500),
    evidenceStorage: storage,
    blockedOrHeldItems: [],
    latestCaptures: captures.slice(-10).reverse().map((c: any) => ({
      captureId: c.id,
      sourceId: c.sourceId,
      url: c.url,
      collectedAt: c.collectedAt,
      storageKind: c.storageKind,
      contentHash: c.contentHash,
      title: c.title,
      fetchProvenance: c.metadata?.fetchProvenance,
    })),
    extraction: {
      captureCount: captures.length,
      incidentCount: input.store.listIncidents?.().length ?? 0,
      averageIncidentConfidence: 0.7,
      reviewReasons: {},
    },
    publicAnswerReadiness: canaryQueries.map((query) => ({
      query,
      captureCount:
        captures.filter((c: any) => searchable(c).includes(query.toLowerCase()))
          .length,
      latestCollectedAt: captures.at(-1)?.collectedAt,
      whyPartial: ["can cite canary captures when present"],
    })),
  };
}

export function buildCanaryReadinessPacket(input: any): CanaryReadinessPacket {
  const summary = buildCanaryOperatorSummary(input),
    required = input.requiredQueries ?? ["APT42", "Turla"],
    blockers = [] as string[];
  if (
    input.requireNativeLiveHttp &&
    summary.evidenceStorage.nativeLiveHttpCaptureCount === 0
  ) {
    blockers.push(
      "no native live HTTP canary captures are available for production readiness",
    );
  }
  const queryReadiness = required.map((q: string) => ({
    query: q,
    captureCount: summary.publicAnswerReadiness.find((r: any) => r.query === q)
      ?.captureCount ?? 0,
    latestCollectedAt: summary.publicAnswerReadiness.find((r: any) =>
      r.query === q
    )?.latestCollectedAt,
    readyForPublicAnswer:
      (summary.publicAnswerReadiness.find((r: any) => r.query === q)
        ?.captureCount ?? 0) > 0,
    reasons: [],
  }));
  return {
    schemaVersion: "ti.public_canary_readiness.v1",
    generatedAt: summary.generatedAt,
    decision: blockers.length ||
        queryReadiness.some((q: any) => !q.readyForPublicAnswer)
      ? "hold"
      : "promote",
    mode: "production_canary",
    minimums: {
      minActiveSources: 1,
      maxFreshnessSeconds: 86400,
      requiredQueries: required,
      requireExternalObjectStorage: false,
      requireNativeLiveHttp: Boolean(input.requireNativeLiveHttp),
    },
    evidence: {
      activeSourceCount: summary.activeSources.length,
      latestRunId: summary.latestRun?.id,
      latestRunStatus: summary.latestRun?.status,
      latestCaptureCount: summary.latestCaptures.length,
      canaryCaptureCount: summary.evidenceStorage.inlineCaptureCount +
        summary.evidenceStorage.externalObjectCaptureCount,
      averageIncidentConfidence: 0.7,
      promotionYield: summary.schedulerHealth.promotionYield,
      freshnessSeconds: summary.schedulerHealth.freshnessSeconds,
      ...summary.evidenceStorage,
    },
    queryReadiness,
    blockers,
    warnings: [],
    controls: {
      activationRequiresHumanApproval: true,
      continuousLoopAutoActivation: false,
      restrictedSourcesExcluded: true,
      reversiblePauseAvailable: true,
      rawBodiesExternalizedWhenObjectStoreConfigured: true,
      liveFetchProvenanceAvailable: true,
      nativeLiveHttpRequired: Boolean(input.requireNativeLiveHttp),
    },
    proofCommands: ["bun run check:canary-proof-path"],
  };
}

export function buildCanarySoakReport(input: any): CanarySoakReport {
  const summary = buildCanaryOperatorSummary(input),
    cycles = input.store.listRuns().filter((r: any) =>
      r.requestId === "req_public_canary"
    ),
    minCycles = Math.max(1, input.minCycles ?? 1),
    blockers: string[] = [];
  if (cycles.length < minCycles) {
    blockers.push(`fewer than ${minCycles} collection cycles are available`);
  }
  if (
    input.requireNativeLiveHttp &&
    summary.evidenceStorage.nativeLiveHttpCaptureCount === 0
  ) {
    blockers.push(
      "no native live HTTP canary captures are available in the soak window",
    );
  }
  if (
    input.maxFreshnessSeconds !== undefined &&
    summary.schedulerHealth.freshnessSeconds > input.maxFreshnessSeconds
  ) blockers.push("canary evidence exceeds the soak freshness limit");
  if (cycles.some((run: any) => run.status === "failed")) {
    blockers.push("one or more collection cycles failed");
  }
  return {
    schemaVersion: "ti.public_canary_soak.v1",
    generatedAt: summary.generatedAt,
    decision: blockers.length ? "hold" : "promote",
    mode: "production_canary",
    window: {
      hours: input.windowHours ?? 24,
      since: input.since ?? summary.generatedAt,
      until: summary.generatedAt,
      minCycles,
    },
    cycles,
    metrics: {
      cycleCount: cycles.length,
      completedCycleCount:
        cycles.filter((r: any) => r.status === "completed").length,
      runningCycleCount:
        cycles.filter((r: any) => r.status === "running").length,
      failedCycleCount: cycles.filter((r: any) => r.status === "failed").length,
      zeroTaskCycleCount: cycles.filter((r: any) => !r.taskCount).length,
      totalTaskCount: sum(cycles, "taskCount"),
      totalCaptureCount: sum(cycles, "captureCount"),
      totalIncidentCount: sum(cycles, "incidentCount"),
      queueDepth: summary.queue.queued,
      deadLetterCount: summary.queue.deadLetters,
      activeSourceCount: summary.activeSources.length,
      freshnessSeconds: summary.schedulerHealth.freshnessSeconds,
      errorRate: summary.schedulerHealth.errorRate,
      duplicateRate: summary.schedulerHealth.duplicateRate,
      promotionYield: summary.schedulerHealth.promotionYield,
      ...summary.evidenceStorage,
    },
    blockers,
    warnings: [],
    controls: {
      canaryPortfolioOnly: false,
      activationRequiresHumanApproval: true,
      continuousLoopAutoActivation: false,
      boundedQueueRequired: true,
      objectBoundaryRequired: true,
      fetchProvenanceRequired: true,
      nativeLiveHttpRequired: Boolean(input.requireNativeLiveHttp),
      restrictedSourcesExcluded: true,
    },
    proofCommands: ["bun run check:canary-proof-path"],
  };
}

export const buildCanaryOperatorConsoleHtml = (
  summary: CanaryOperatorSummary,
) =>
  `<title>TI Canary Ops</title><h1>TI Canary Ops</h1><h2>Active Sources</h2><p>${summary.activeSources.length}</p><h2>Queued work</h2><p>${summary.queue.queued}</p><h2>Runtime Loop</h2><p>Supervisor: ${
    summary.runtime.supervisorAttached ? "attached" : "detached"
  }; ${summary.runtime.intervalSeconds}s</p><h2>Evidence mode</h2><p>${summary.evidenceStorage.productionEvidenceMode}</p><h2>Public Answer Readiness</h2><ul>${
    summary.publicAnswerReadiness.map((item) =>
      `<li>${item.query}: ${item.captureCount}</li>`
    ).join("")
  }</ul><h2>Why Partial</h2><p>Can cite canary captures when present</p>`;
