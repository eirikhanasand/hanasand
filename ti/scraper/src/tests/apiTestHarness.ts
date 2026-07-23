export { describe, expect, test } from "bun:test";
export { mkdtempSync, rmSync } from "node:fs";
export { join } from "node:path";
export { tmpdir } from "node:os";
export { handleApiRequest, startApiServer } from "../api/server.ts";
export { loadRuntimeConfig } from "../config/runtimeConfig.ts";
export { FocusedFrontier } from "../frontier/frontier.ts";
export { activatePublicCanarySources, buildCanaryOperatorSummary, runCanaryCollectionCycle, startCanaryCollectionLoop } from "../ops/canaryCollection.ts";
export { processCollectedItem } from "../pipeline/pipeline.ts";
export { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
export { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../storage/memoryStore.ts";
export { hashContent } from "../utils.ts";
export type { AnalystClaimLedgerEntry, RawCapture, SourceRecord } from "../types.ts";
export { api, apiRestrictedMetadataApplyPlanSources, body, fixtureCapture, fixtureDelta, restrictedMetadataApplyPlanSources, seedEvidenceReplayFixture, source, telegramCapture } from "./helpers/apiFixtures.ts";

import type { ActorIdentityRecord, MitreActorCatalogSnapshot, MitreActorIdentity } from "../pipeline/mitreActorCatalog.ts";
import type { InMemoryScraperStore } from "../storage/memoryStore.ts";

const actorCatalogObservedAt = "2026-07-20T00:00:00.000Z";

export function actorIdentity(externalId: string, canonicalName: string, associatedNames: string[] = []): ActorIdentityRecord {
  return {
    id: `mitre-attack-enterprise:${externalId}`,
    catalogId: "mitre-attack-enterprise",
    externalId,
    canonicalName,
    normalizedCanonicalName: canonicalName.toLowerCase(),
    associatedNames,
    status: "current",
    lookupPolicy: "text_safe",
    aptNumberDesignationPresent: /^apt(?:[- ]?\d+|-[a-z]+-\d+)$/i.test(canonicalName),
    sourceUrl: `https://attack.mitre.org/groups/${externalId}/`,
    catalogVersion: "19.1",
    catalogModifiedAt: actorCatalogObservedAt,
    bundleSha256: "test-catalog",
    retrievedAt: actorCatalogObservedAt,
    createdAt: actorCatalogObservedAt,
    modifiedAt: actorCatalogObservedAt,
  };
}

export function seedActorIdentityCatalog(store: InMemoryScraperStore, identities: ActorIdentityRecord[]) {
  const distinctAssociatedNames = new Set(identities.flatMap((identity) => identity.associatedNames.map((name) => name.toLowerCase())));
  const distinctLookupLabels = new Set(identities.flatMap((identity) => [identity.canonicalName, ...identity.associatedNames].map((name) => name.toLowerCase())));
  store.replaceActorIdentityCatalog({
    schemaVersion: "ti.actor_identity_catalog.v1",
    catalogId: "mitre-attack-enterprise",
    catalogName: "Enterprise ATT&CK",
    catalogVersion: "19.1",
    catalogModifiedAt: actorCatalogObservedAt,
    sourceUrl: "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json",
    bundleId: "bundle--test-catalog",
    bundleSha256: "test-catalog",
    retrievedAt: actorCatalogObservedAt,
    counts: {
      totalIdentityCount: identities.length,
      currentIdentityCount: identities.length,
      deprecatedIdentityCount: 0,
      revokedIdentityCount: 0,
      aptNumberDesignationPresentCount: identities.filter((identity) => identity.aptNumberDesignationPresent).length,
      associatedNameOccurrenceCount: identities.reduce((count, identity) => count + identity.associatedNames.length, 0),
      distinctAssociatedNameCount: distinctAssociatedNames.size,
      distinctLookupLabelCount: distinctLookupLabels.size,
      aliasCollisionCount: 0,
    },
    identities: identities as MitreActorIdentity[],
    aliasCollisions: [],
  } satisfies MitreActorCatalogSnapshot, {
    sourceId: "src_mitre_actor_catalog",
    captureId: "cap_mitre_actor_catalog",
    importedAt: actorCatalogObservedAt,
  });
}

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
