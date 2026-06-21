// @ts-nocheck
import { disabled, now } from "./evidenceSearchReadModelCore.ts";

export const buildDisabledEvidenceActorDatasetSourceGapConsumerQueueAuditRepositoryStatus = (rows: any, input: any = {}) => disabled("actor_gap_queue", rows?.item_rows ?? []);
export const createEvidenceActorDatasetSourceGapConsumerQueueAuditRepository = () => ({ persistConsumerQueueRows: (rows: any, input: any = {}) => buildDisabledEvidenceActorDatasetSourceGapConsumerQueueAuditRepositoryStatus(rows, input) });
export const buildEvidenceActorDatasetSourceGapRepairHandoff = (queue: any) => ({ packets: queue.rows ?? [], counts: queue.counts ?? {} });
export const buildEvidenceActorDatasetSourceGapRepairReplayLedger = (handoff: any) => ({ checkpoints: (handoff.packets ?? []).map((packet: any) => ({ packet, status: "ready" })) });
export const evidenceActorDatasetSourceGapRepairReplayLedgerToPostgresRows = (ledger: any) => ({ run_rows: [{ id: "actor_gap_repair", count: ledger.checkpoints?.length ?? 0 }], checkpoint_rows: ledger.checkpoints ?? [] });
export const buildDisabledEvidenceActorDatasetSourceGapRepairReplayRepositoryStatus = (rows: any, input: any = {}) => disabled("actor_gap_repair", rows?.checkpoint_rows ?? []);
export const createEvidenceActorDatasetSourceGapRepairReplayRepository = () => ({ persistRepairReplayRows: (rows: any, input: any = {}) => buildDisabledEvidenceActorDatasetSourceGapRepairReplayRepositoryStatus(rows, input) });
export const buildEvidenceActorDatasetConsumerHandoff = (preview: any) => ({ rows: preview.rows ?? [], counts: { rows: preview.rows?.length ?? 0 } });
export const executeEvidenceActorDatasetConsumerHandoff = (handoff: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), status: "dry_run", actorDatasetRows: handoff.rows ?? [], publicAnswerCacheWrites: [] });
export const evidenceActorDatasetConsumerExecutionToPostgresRows = (receipt: any) => ({ receipt_rows: [{ id: "actor_dataset_consumer", status: receipt.status }], actor_dataset_rows: receipt.actorDatasetRows ?? [], public_answer_cache_rows: receipt.publicAnswerCacheWrites ?? [] });
export const buildEvidenceActorDatasetConsumerAuditReplay = (rows: any, input: any = {}) => ({ generatedAt: input.generatedAt ?? now(), receipts: rows.actor_dataset_rows ?? [], status: "replayed" });
export const buildDisabledEvidenceActorDatasetConsumerAuditRepositoryStatus = (rows: any, input: any = {}) => disabled("actor_dataset_consumer", rows?.actor_dataset_rows ?? []);
export const createEvidenceActorDatasetConsumerAuditRepository = () => ({ persistConsumerExecutionRows: (rows: any, input: any = {}) => buildDisabledEvidenceActorDatasetConsumerAuditRepositoryStatus(rows, input) });
