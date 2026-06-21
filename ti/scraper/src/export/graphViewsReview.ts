// @ts-nocheck
import type { PersistedGraphSnapshot } from "../types.ts";
import { buildGraphReviewQueueSummary, reviewItem, type GraphCutoverReportOptions, type GraphReviewApplyPlanOptions } from "./graphViewsCore.ts";

export const checkStixExportReadiness = (snapshot: PersistedGraphSnapshot): any => {
  const relationships = snapshot.relationships.map((rel: any) => {
    const ready = (rel.confidence ?? 0) >= 0.5 && rel.reviewState !== "rejected";
    return { relationshipId: rel.id, ready, blockers: ready ? [] : ["low_confidence_or_rejected"], reviewState: rel.reviewState ?? "proposed", discoveryOnly: false };
  });
  const readyCount = relationships.filter((rel: any) => rel.ready).length;
  return { ready: readyCount === relationships.length, readyCount, blockedCount: relationships.length - readyCount, relationships, blockers: relationships.filter((rel: any) => !rel.ready).map((rel: any) => rel.relationshipId), reviewActions: [], preview: { includedCount: readyCount, excludedCount: relationships.length - readyCount, items: relationships.map((rel: any) => ({ relationshipId: rel.relationshipId, included: rel.ready })) } };
};

export const buildGraphIntegrityReport = (snapshot: PersistedGraphSnapshot) => ({ generatedAt: snapshot.generatedAt, findingCount: 0, findings: [], relationshipCount: snapshot.relationships.length });
export const buildGraphReviewBatch = (snapshot: PersistedGraphSnapshot) => ({ generatedAt: snapshot.generatedAt, items: snapshot.relationships.filter((rel: any) => rel.reviewState !== "accepted").map(reviewItem) });
export { buildGraphReviewQueueSummary };
export const buildGraphCutoverReport = (snapshot: PersistedGraphSnapshot, options: GraphCutoverReportOptions = {}) => ({ generatedAt: options.generatedAt ?? snapshot.generatedAt, readiness: checkStixExportReadiness(snapshot), review: buildGraphReviewQueueSummary(snapshot) });
export const buildGraphReviewApplyPlan = (snapshot: PersistedGraphSnapshot, options: GraphReviewApplyPlanOptions = {}) => ({ generatedAt: options.generatedAt ?? snapshot.generatedAt, actions: buildGraphReviewBatch(snapshot).items.map((item: any) => ({ relationshipId: item.relationshipId, action: "hold_for_review", safety: "manual" })) });
export const buildGraphReviewPlanApiDto = (snapshot: PersistedGraphSnapshot, options: GraphCutoverReportOptions = {}): any => {
  const actions = buildGraphReviewApplyPlan(snapshot, options).actions.map((action: any) => ({ ...action, safety: "human_approval_required" }));
  return { endpoint: "/v1/graph/review-plan", plan: buildGraphReviewApplyPlan(snapshot, options), actions, summary: { total: actions.length, automationSafe: 0, humanApprovalRequired: actions.length, blocked: 0 }, status: actions.length ? "needs_review" : "ready" };
};
export const buildGraphReviewPersistenceLedgerDto = (snapshot: PersistedGraphSnapshot, _options: any = {}): any => ({ mode: "compact", decisionActions: [], decisions: [], cursorContinuity: { cursorField: "generatedAt", latestCursor: snapshot.generatedAt }, rollbackPlan: { strategy: "no_mutation" }, noLeak: true, entries: snapshot.relationships.map((rel: any) => ({ relationshipId: rel.id, reviewState: rel.reviewState ?? "proposed" })) });
export const buildGraphReviewApplyPlanApiDto = buildGraphReviewPlanApiDto;
