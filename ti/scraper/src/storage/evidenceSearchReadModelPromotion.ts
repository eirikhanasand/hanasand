// @ts-nocheck
import { now } from "./evidenceSearchReadModelCore.ts";

export const buildEvidenceSearchReadModelPromotionReplay = (writeSet: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), state: "ready", promotedDocuments: writeSet.postgresDocuments?.length ?? 0 });
export const buildEvidencePromotionTransactionPlan = (writeSet: any, replay: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), steps: [{ name: "promote_search_documents", count: writeSet.postgresDocuments?.length ?? 0 }], replay });
export const executeEvidencePromotionTransactionPlan = (plan: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), status: "dry_run", executedSteps: plan.steps ?? [], heldSteps: [] });
export const evidencePromotionExecutionToPostgresRows = (receipt: any) => ({ execution_rows: [{ id: "promotion_execution", status: receipt.status }], step_rows: receipt.executedSteps ?? [], held_step_rows: receipt.heldSteps ?? [], rollback_rows: [] });
export const evidencePromotionExecutionFromPostgresRows = (rows: any) => ({ status: rows.execution_rows?.[0]?.status ?? "dry_run", executedSteps: rows.step_rows ?? [] });
export const buildEvidencePromotionTransactionAuditReplay = (rows: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), receipts: rows.step_rows ?? [], status: "replayed" });
export const buildEvidenceActorProductImpactReplay = (writeSet: any, transaction: any, audit: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), rows: writeSet.postgresDocuments ?? [], transaction, audit });
export const buildEvidenceActorDatasetPromotionPreview = (impact: any, transaction: any) => ({ rows: impact.rows ?? [], promotedActorDatasets: impact.rows?.length ?? 0, transaction });
export const buildEvidenceActorDatasetSourceGapSuppressionFeedback = (preview: any) => ({ suppressed: [], candidates: preview.rows ?? [] });
export const buildEvidenceActorDatasetSourceGapConsumerQueue = (feedback: any) => ({ rows: feedback.candidates ?? [], counts: { queued: feedback.candidates?.length ?? 0 } });
export const evidenceActorDatasetSourceGapConsumerQueueToPostgresRows = (queue: any) => ({ queue_run_rows: [{ id: "actor_gap_queue", count: queue.rows?.length ?? 0 }], item_rows: queue.rows ?? [] });
