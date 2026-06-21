// @ts-nocheck
export type AnalystFeedbackMark = any; export type AnalystFeedbackTarget = any; export type AnalystCorrectionState = any; export type QualityRegressionArea = any; export type AnalystFeedbackContractItemDto = any; export type AnalystFeedbackLoopDto = any; export type QualityRegressionCaseDto = any; export type QualityRegressionSuiteDto = any; export type ActorProfileReviewState = any; export type ActorProfileCorrectionActionKind = any; export type ActorProfileCorrectionActionDto = any; export type ActorProfileReviewFieldDto = any; export type ActorProfileReviewWorkbenchDto = any; export type AnalystQualityQueueField = any; export type AnalystQualityQueueState = any; export type AnalystQualityReleaseGateCode = any; export type AnalystQualityReviewQueueItemDto = any; export type AnalystQualityReviewQueueDto = any; export type AnalystFeedbackLearningEventType = any; export type EvaluationScorecardMetric = any; export type AnalystFeedbackLearningEventDto = any; export type EvaluationScorecardDto = any; export type EvaluationLearningFixtureDto = any; export type AnalystFeedbackLearningLoopDto = any; export type ActiveLearningCandidateType = any; export type ActiveLearningScorecardMetric = any; export type ActiveLearningBeforeAfterScorecardDto = any; export type ActiveLearningCandidateDto = any; export type SummarySpecificityThresholdDto = any; export type RowUsefulnessDeltaDto = any; export type AnalystApprovedReplayPromotionReportDto = any; export type ActiveLearningCandidateQueueDto = any;

export function buildAnalystFeedbackLoopDto(input: any) {
  const items = input.items ?? input.feedback ?? [];
  return { schemaVersion: "ti.analyst_feedback_loop.v1", generatedAt: input.generatedAt ?? new Date().toISOString(), items, summary: counts(items, "mark"), corrections: items.filter((i: any) => i.mark === "incorrect" || i.mark === "needs_review") };
}
export function buildActorProfileReviewWorkbenchDto(input: any) {
  const fields = ["summary", "aliases", "targets", "ttps", "recentActivity"].map((field) => ({ field, state: input.profile?.[field] ? "ready" : "needs_review" }));
  return { schemaVersion: "ti.actor_profile_review_workbench.v1", actor: input.actor ?? input.profile?.actor, fields, actions: fields.filter((f) => f.state !== "ready").map((f) => ({ field: f.field, action: "improve_extraction" })) };
}
export function buildQualityRegressionSuiteDto(input: any) {
  const cases = input.cases ?? [];
  return { schemaVersion: "ti.quality_regression_suite.v1", cases, summary: { total: cases.length, failing: cases.filter((c: any) => c.status === "fail").length } };
}
export function buildAnalystQualityReviewQueueDto(input: any) {
  const rows = (input.rows ?? input.items ?? []).map((row: any, index: number) => ({ id: row.id ?? `review_${index}`, field: row.field ?? "summary", state: row.state ?? "queued", priority: row.priority ?? "medium" }));
  return { schemaVersion: "ti.analyst_quality_review_queue.v1", rows, summary: counts(rows, "state"), releaseGate: rows.some((r: any) => r.state === "blocked") ? "hold" : "pass" };
}
export function buildAnalystFeedbackLearningLoopDto(input: any) {
  const events = input.events ?? [];
  return { schemaVersion: "ti.analyst_feedback_learning_loop.v1", events, scorecard: { accuracy: input.accuracy ?? 0, timeliness: input.timeliness ?? 0, coverage: input.coverage ?? 0 }, nextTrainingRows: events.filter((e: any) => e.type === "correction") };
}
export function buildActiveLearningCandidateQueueDto(input: any) {
  const candidates = (input.candidates ?? input.rows ?? []).map((row: any, index: number) => ({ id: row.id ?? `candidate_${index}`, type: row.type ?? "extraction", score: row.score ?? 0.5, reason: row.reason ?? "low confidence or high buyer value" }));
  return { schemaVersion: "ti.active_learning_candidate_queue.v1", candidates: candidates.sort((a: any, b: any) => b.score - a.score), summary: { total: candidates.length, highPriority: candidates.filter((c: any) => c.score >= 0.75).length } };
}
function counts(rows: any[], key: string) {
  return rows.reduce<Record<string, number>>((acc, row) => ((acc[row[key] ?? "unknown"] = (acc[row[key] ?? "unknown"] ?? 0) + 1), acc), {});
}
