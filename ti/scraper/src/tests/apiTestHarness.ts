export { describe, expect, test } from "bun:test";
export { mkdtempSync, rmSync } from "node:fs";
export { join } from "node:path";
export { tmpdir } from "node:os";
export { handleApiRequest, startApiServer } from "../api/server.ts";
export { loadRuntimeConfig } from "../config/runtimeConfig.ts";
export { FocusedFrontier } from "../frontier/frontier.ts";
export { activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop } from "../ops/canaryCollection.ts";
export { createLogger } from "../ops/logger.ts";
export { MetricsRegistry } from "../ops/metrics.ts";
export { WorkerSupervisor } from "../ops/supervisor.ts";
export { processCollectedItem } from "../pipeline/pipeline.ts";
export { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
export { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../storage/memoryStore.ts";
export { hashContent } from "../utils.ts";
export type { AnalystClaimLedgerEntry, RawCapture, SourceRecord } from "../types.ts";
export { api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "./helpers/apiFixtures.ts";

export type CanaryOperatorViewForTest = {
  activeSources: unknown[];
  latestRun?: { runId: string; status: string; taskCount: number; captureCount: number; incidentCount: number };
  latestCaptures: unknown[];
  schedulerHealth: { errorRate: number; promotionYield: number; duplicateRate: number; retryScheduledCount: number; retryExhaustedCount: number };
  runtime: { schemaVersion: string; supervisorAttached: boolean; enabled: boolean; running: boolean; intervalSeconds: number; nextCycleAt?: string; cycleCount: number; successCount: number; errorCount: number; consecutiveErrorCount: number; maxSources: number; maxTasks: number; queueLimit: number; activateSources: boolean; controls: { canaryPortfolioOnly: boolean; activationRequiresHumanApproval: boolean; continuousLoopAutoActivation: boolean; nativeFetchDefault: boolean; objectBoundaryConfigured: boolean; boundedQueueRequired: boolean; dedupeBeforeWrite: boolean; retriesBounded: boolean; restrictedSourcesExcluded: boolean } };
  evidenceStorage: { productionEvidenceMode: string; externalObjectCaptureCount: number; inlineCaptureCount: number; missingObjectReferenceCount: number; nativeLiveHttpCaptureCount: number; injectedProofFetchCaptureCount: number; unknownFetchModeCaptureCount: number };
  blockedOrHeldItems: unknown[];
  publicAnswerReadiness: Array<{ query: string; captureCount: number; whyPartial?: string[] }>;
};

export type CanaryOperatorResponseForTest = { operatorView: CanaryOperatorViewForTest };
export type CanaryReadinessResponseForTest = { readiness: { schemaVersion: string; decision: string; evidence: { activeSourceCount: number; externalObjectCaptureCount: number; missingObjectReferenceCount: number; nativeLiveHttpCaptureCount: number; injectedProofFetchCaptureCount: number; promotionYield: number }; queryReadiness: Array<{ query: string; captureCount: number; readyForPublicAnswer: boolean }>; blockers: string[]; controls: { activationRequiresHumanApproval: boolean; continuousLoopAutoActivation: boolean; restrictedSourcesExcluded: boolean; reversiblePauseAvailable: boolean; liveFetchProvenanceAvailable: boolean; nativeLiveHttpRequired: boolean }; proofCommands: string[] } };
export type CanarySoakResponseForTest = { soak: { schemaVersion: string; decision: string; cycles: Array<{ runId: string; status: string; taskCount: number; captureCount: number; incidentCount: number }>; metrics: { cycleCount: number; totalCaptureCount: number; totalIncidentCount: number; activeSourceCount: number; externalObjectCaptureCount: number; missingObjectReferenceCount: number; nativeLiveHttpCaptureCount: number; injectedProofFetchCaptureCount: number; promotionYield: number }; blockers: string[]; controls: { canaryPortfolioOnly: boolean; activationRequiresHumanApproval: boolean; continuousLoopAutoActivation: boolean; boundedQueueRequired: boolean; objectBoundaryRequired: boolean; fetchProvenanceRequired: boolean; nativeLiveHttpRequired: boolean; restrictedSourcesExcluded: boolean }; proofCommands: string[] } };
