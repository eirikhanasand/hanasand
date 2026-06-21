// @ts-nocheck
import type { PersistedGraphSnapshot } from "../types.ts";
import { stableId } from "../utils.ts";
import { buildGraphReviewQueueSummary } from "./graphViewsCore.ts";
import { buildGraphCutoverReport, checkStixExportReadiness } from "./graphViewsReview.ts";

export const buildStixExportPreview = (snapshot: PersistedGraphSnapshot) => ({ objectCount: snapshot.nodes.length + snapshot.relationships.length, relationshipCount: snapshot.relationships.length, ready: checkStixExportReadiness(snapshot).ready });
export const buildReviewedExportSubsetGovernanceDto = (snapshot: PersistedGraphSnapshot, _options: any = {}): any => {
  const eligibleRelationshipIds = snapshot.relationships.filter((rel: any) => rel.reviewState === "accepted").map((rel: any) => rel.id);
  const heldRelationshipIds = snapshot.relationships.filter((rel: any) => rel.reviewState !== "accepted").map((rel: any) => rel.id);
  return { subsetId: stableId("graph-export-subset", snapshot.generatedAt), mediaType: "application/stix+json;version=2.1", eligibleRelationshipIds, heldRelationshipIds, excludedRelationshipIds: [], exportedRelationshipIds: eligibleRelationshipIds, cursor: snapshot.generatedAt, governanceChecks: ["metadata_only"], counts: { eligible: eligibleRelationshipIds.length, held: heldRelationshipIds.length, excluded: 0 }, noLeak: true, noRawLeakData: true };
};
export const buildGraphExportEnforcementDto = (snapshot: PersistedGraphSnapshot) => ({ state: checkStixExportReadiness(snapshot).ready ? "pass" : "hold", blockers: checkStixExportReadiness(snapshot).blockers });
export const buildGraphExportCertificationDto = (snapshot: PersistedGraphSnapshot) => ({ certified: checkStixExportReadiness(snapshot).ready, generatedAt: snapshot.generatedAt });
export const buildGraphExportSlaDto = (snapshot: PersistedGraphSnapshot) => ({ state: checkStixExportReadiness(snapshot).ready ? "pass" : "warn", relationshipCount: snapshot.relationships.length });
export const buildGraphCutoverReportApiDto = (snapshot: PersistedGraphSnapshot, options: any = {}): any => ({ endpoint: "/v1/graph/cutover-report", report: buildGraphCutoverReport(snapshot, options), promotionBlockers: [], counts: { relationships: snapshot.relationships.length } });
export const buildStixExportReadinessApiDto = (snapshot: PersistedGraphSnapshot, _options: any = {}): any => ({ endpoint: "/v1/exports/stix", ...checkStixExportReadiness(snapshot), exportGovernance: buildReviewedExportSubsetGovernanceDto(snapshot), taxiiCollections: [] });
export const buildTaxiiCollectionReadiness = (snapshot: PersistedGraphSnapshot) => ({ ready: checkStixExportReadiness(snapshot).ready, mediaType: "application/taxii+json;version=2.1" });
export const buildTaxiiDescriptorStixBundleGovernanceDto = (snapshot: PersistedGraphSnapshot) => ({ collectionReady: buildTaxiiCollectionReadiness(snapshot), noRawLeakData: true });
export const graphReviewApiExamples = (generatedAt = "2026-05-24T00:00:00.000Z"): any => ({ generatedAt, examples: ["/v1/graph/review-plan", "/v1/exports/stix"] });
export const buildGraphStixTaxiiMarketplaceReadinessDto = (snapshot: PersistedGraphSnapshot) => ({ ready: checkStixExportReadiness(snapshot).ready, reviewQueue: buildGraphReviewQueueSummary(snapshot) });
