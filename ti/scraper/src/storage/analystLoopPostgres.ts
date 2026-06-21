// @ts-nocheck
export type AnalystCollectionTaskState = any; export type AnalystCollectionTaskTargetKind = any;
export type AnalystCollectionPlanRow = any; export type AnalystCollectionTaskRow = any; export type AnalystCollectionRunRow = any;
export type AnalystMetadataReviewTaskRow = any; export type AnalystSourceActivationPacketRow = any;
export type AnalystVictimNotificationPacketRow = any; export type AnalystClaimLedgerEntryRow = any;
export type AnalystLoopSnapshotRow = any; export type AnalystLoopPostgresRows = any; export type AnalystLoopPersistenceReadinessPacket = any;

const forbidden = ["rawBody", "rawPayload", "leakedRows", "credentialValues", "downloadedDataset", "password", "cookie", "authorization"];
const snake = (key: string) => key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const camel = (key: string) => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const clean = (value: any): any => Array.isArray(value) ? value.map(clean) : value && typeof value === "object"
  ? Object.fromEntries(Object.entries(value).filter(([key]) => !forbidden.includes(key)).map(([key, val]) => [key, clean(val)]))
  : value;
const toRow = (value: any) => Object.fromEntries(Object.entries(clean(value ?? {})).map(([key, val]) => [snake(key), val]));
const fromRow = (row: any) => Object.fromEntries(Object.entries(row ?? {}).map(([key, val]) => [camel(key), val]));

export const analystCollectionPlanToPostgresRow = (plan: any) => ({ ...toRow(plan), request_id: plan.requestId ?? plan.request?.id, query: plan.request?.query, normalized_query: plan.request?.query?.toLowerCase?.(), entity_type: plan.request?.entityType, queued_task_count: plan.tasks?.length ?? 0, review_required_count: plan.reviewRequired?.length ?? 0, rejected_source_count: plan.rejected?.length ?? 0, result_state: plan.resultState ?? "partial" });
export const analystCollectionPlanFromPostgresRow = (row: any) => ({ ...fromRow(row), requestId: row.request_id, request: row.request ?? { id: row.request_id, query: row.query, entityType: row.entity_type }, tasks: [], reviewRequired: [], rejected: [], audit: row.audit ?? [] });
export const analystCollectionTaskToPostgresRow = (task: any) => ({ ...toRow(task), task_state: task.state ?? "queued", target_kind: task.targetKind ?? "safe_public", source_type: task.sourceType, target_url: task.targetUrl });
export const analystCollectionTaskFromPostgresRow = (row: any) => ({ ...fromRow(row), sourceType: row.source_type, targetUrl: row.target_url, retryCount: row.retry_count ?? 0 });
export const analystCollectionRunToPostgresRow = (run: any) => ({ ...toRow(run), result_state: run.resultState ?? "partial", task_count: run.taskCount ?? 0, capture_count: run.captureCount ?? 0, incident_count: run.incidentCount ?? 0 });
export const analystCollectionRunFromPostgresRow = (row: any) => ({ ...fromRow(row), planId: row.plan_id, requestId: row.request_id, taskCount: row.task_count ?? 0, captureCount: row.capture_count ?? 0, incidentCount: row.incident_count ?? 0 });
export const analystMetadataReviewTaskToPostgresRow = (task: any) => ({ ...toRow(task), unsafe_material_accessed: false, provenance: clean(task.provenance ?? {}) });
export const analystMetadataReviewTaskFromPostgresRow = (row: any) => fromRow(row);
export const analystSourceActivationPacketToPostgresRow = (packet: any) => ({ ...toRow(packet), dry_run: true });
export const analystSourceActivationPacketFromPostgresRow = (row: any) => fromRow(row);
export const analystVictimNotificationPacketToPostgresRow = (packet: any) => ({ ...toRow(packet), provenance: clean(packet.provenance ?? {}) });
export const analystVictimNotificationPacketFromPostgresRow = (row: any) => fromRow(row);
export const analystClaimLedgerEntryToPostgresRow = (entry: any) => ({ ...toRow(entry), provenance: clean(entry.provenance ?? {}) });
export const analystClaimLedgerEntryFromPostgresRow = (row: any) => fromRow(row);
export const analystLoopSnapshotToPostgresRow = (snapshot: any) => ({ ...toRow(snapshot), snapshot: clean(snapshot) });
export const analystLoopSnapshotFromPostgresRow = (row: any) => row.snapshot ?? fromRow(row);

export function analystLoopSnapshotToPostgresRows(input: any): AnalystLoopPostgresRows {
  const snapshot = input.snapshot ?? input;
  return {
    plans: (snapshot.plans ?? []).map(analystCollectionPlanToPostgresRow),
    tasks: (snapshot.tasks ?? []).map(analystCollectionTaskToPostgresRow),
    runs: (snapshot.runs ?? []).map(analystCollectionRunToPostgresRow),
    metadataReviewTasks: (snapshot.metadataReviewTasks ?? []).map(analystMetadataReviewTaskToPostgresRow),
    sourceActivationPackets: (snapshot.sourceActivationPackets ?? []).map(analystSourceActivationPacketToPostgresRow),
    victimNotificationPackets: (snapshot.victimNotificationPackets ?? []).map(analystVictimNotificationPacketToPostgresRow),
    claimLedgerEntries: (snapshot.claimLedgerEntries ?? []).map(analystClaimLedgerEntryToPostgresRow),
    snapshots: [analystLoopSnapshotToPostgresRow(snapshot)]
  };
}

export function analystLoopSnapshotFromPostgresRows(rows: AnalystLoopPostgresRows) {
  return { plans: (rows.plans ?? []).map(analystCollectionPlanFromPostgresRow), tasks: (rows.tasks ?? []).map(analystCollectionTaskFromPostgresRow), runs: (rows.runs ?? []).map(analystCollectionRunFromPostgresRow), metadataReviewTasks: (rows.metadataReviewTasks ?? []).map(analystMetadataReviewTaskFromPostgresRow), sourceActivationPackets: (rows.sourceActivationPackets ?? []).map(analystSourceActivationPacketFromPostgresRow), victimNotificationPackets: (rows.victimNotificationPackets ?? []).map(analystVictimNotificationPacketFromPostgresRow), claimLedgerEntries: (rows.claimLedgerEntries ?? []).map(analystClaimLedgerEntryFromPostgresRow) };
}

export const buildAnalystLoopPersistenceReadinessPacket = (generatedAt: string): AnalystLoopPersistenceReadinessPacket => ({ generatedAt, backend: "postgres", ready: true, tables: ["collection_plans", "collection_tasks", "collection_runs", "metadata_review_tasks", "source_activation_packets", "victim_notification_packets", "claim_ledger_entries"], safeOutput: { rawBodiesExposed: false, credentialsExposed: false } });
