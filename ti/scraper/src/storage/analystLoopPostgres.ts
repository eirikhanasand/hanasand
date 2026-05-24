import type {
  AnalystClaimLedgerEntry,
  AnalystLoopSnapshot,
  AnalystMetadataReviewTask,
  AnalystSourceActivationPacket,
  AnalystVictimNotificationPacket
} from "../types.ts";

type JsonObject = Record<string, unknown>;

const FORBIDDEN_PROVENANCE_KEYS = new Set([
  "rawBody",
  "rawPayload",
  "leakedRows",
  "credentialValues",
  "downloadedDataset",
  "password",
  "cookie",
  "authorization"
]);

export interface AnalystMetadataReviewTaskRow {
  id: string;
  tenant_id?: string;
  plan_id: string;
  run_id?: string;
  task_id?: string;
  source_id: string;
  capture_id?: string;
  status: AnalystMetadataReviewTask["status"];
  result_state: AnalystMetadataReviewTask["resultState"];
  company?: string;
  victim?: string;
  affected_accounts_text?: string;
  affected_accounts_count?: number;
  account_subjects: string[];
  dataset_size_text?: string;
  dataset_size_bytes?: number;
  actor_statement_summary?: string;
  claimed_at?: string;
  observed_at: string;
  source_url?: string;
  source_hash: string;
  provenance: JsonObject;
  allowed_actions: AnalystMetadataReviewTask["allowedActions"];
  confidence: number;
  unsafe_material_accessed: false;
  what_was_not_accessed: string[];
  duplicate_of?: string;
  created_at: string;
  updated_at: string;
}

export interface AnalystSourceActivationPacketRow {
  id: string;
  tenant_id?: string;
  plan_id: string;
  run_id?: string;
  source_id?: string;
  action: AnalystSourceActivationPacket["action"];
  execution: AnalystSourceActivationPacket["execution"];
  reason: string;
  expected_effect: string;
  rollback: string;
  dry_run: true;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
}

export interface AnalystVictimNotificationPacketRow {
  id: string;
  tenant_id?: string;
  review_task_id: string;
  status: AnalystVictimNotificationPacket["status"];
  company: string;
  victim?: string;
  claim_summary: string;
  affected_accounts_text?: string;
  dataset_size_text?: string;
  actor_statement_summary?: string;
  claimed_at?: string;
  observed_at: string;
  source_hash: string;
  confidence: number;
  provenance: JsonObject;
  redactions: string[];
  what_was_not_accessed: string[];
  safe_to_send: boolean;
  approved_by?: string;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AnalystClaimLedgerEntryRow {
  id: string;
  tenant_id?: string;
  normalized_query: string;
  review_task_id?: string;
  capture_id?: string;
  source_id: string;
  claim_kind: AnalystClaimLedgerEntry["claimKind"];
  company?: string;
  victim?: string;
  claim_text_summary: string;
  source_hash: string;
  confidence: number;
  ledger_status: AnalystClaimLedgerEntry["ledgerStatus"];
  observed_at: string;
  provenance: JsonObject;
  created_at: string;
}

export interface AnalystLoopSnapshotRow {
  id: string;
  tenant_id?: string;
  plan_id: string;
  run_id?: string;
  normalized_query: string;
  result_state: AnalystLoopSnapshot["resultState"];
  headline: string;
  queued_tasks: number;
  review_tasks: number;
  rejected_sources: number;
  blocked_unsafe_targets: number;
  meaningful_work_count: number;
  next_steps: AnalystLoopSnapshot["nextSteps"];
  review_task_ids: string[];
  activation_packet_ids: string[];
  victim_notification_packet_id?: string;
  captured_at: string;
}

export interface AnalystLoopPostgresRows {
  metadata_review_tasks: AnalystMetadataReviewTaskRow[];
  source_activation_packets: AnalystSourceActivationPacketRow[];
  victim_notification_packets: AnalystVictimNotificationPacketRow[];
  claim_ledger_entries: AnalystClaimLedgerEntryRow[];
  analyst_loop_snapshots: AnalystLoopSnapshotRow[];
}

export function analystMetadataReviewTaskToPostgresRow(task: AnalystMetadataReviewTask): AnalystMetadataReviewTaskRow {
  if (task.unsafeMaterialAccessed !== false) throw new Error(`Unsafe material access is not persistable: ${task.id}`);
  return {
    id: task.id,
    tenant_id: task.tenantId,
    plan_id: task.planId,
    run_id: task.runId,
    task_id: task.taskId,
    source_id: task.sourceId,
    capture_id: task.captureId,
    status: task.status,
    result_state: task.resultState,
    company: task.company,
    victim: task.victim,
    affected_accounts_text: task.affectedAccounts,
    affected_accounts_count: task.affectedAccountsCount,
    account_subjects: [...task.accountSubjects],
    dataset_size_text: task.datasetSize,
    dataset_size_bytes: task.datasetSizeBytes,
    actor_statement_summary: task.actorStatement,
    claimed_at: task.claimedAt,
    observed_at: task.observedAt,
    source_url: task.sourceUrl,
    source_hash: task.sourceHash,
    provenance: safeProvenance(task.provenance, task.id),
    allowed_actions: [...task.allowedActions],
    confidence: task.confidence,
    unsafe_material_accessed: false,
    what_was_not_accessed: [...task.whatWasNotAccessed],
    duplicate_of: task.duplicateOf,
    created_at: task.createdAt,
    updated_at: task.updatedAt
  };
}

export function analystMetadataReviewTaskFromPostgresRow(row: AnalystMetadataReviewTaskRow): AnalystMetadataReviewTask {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planId: row.plan_id,
    runId: row.run_id,
    taskId: row.task_id,
    sourceId: row.source_id,
    captureId: row.capture_id,
    status: row.status,
    resultState: row.result_state,
    company: row.company,
    victim: row.victim,
    affectedAccounts: row.affected_accounts_text,
    affectedAccountsCount: row.affected_accounts_count,
    accountSubjects: [...row.account_subjects],
    datasetSize: row.dataset_size_text,
    datasetSizeBytes: row.dataset_size_bytes,
    actorStatement: row.actor_statement_summary,
    claimedAt: row.claimed_at,
    observedAt: row.observed_at,
    sourceUrl: row.source_url,
    sourceHash: row.source_hash,
    provenance: safeProvenance(row.provenance, row.id),
    allowedActions: [...row.allowed_actions],
    confidence: row.confidence,
    unsafeMaterialAccessed: false,
    whatWasNotAccessed: [...row.what_was_not_accessed],
    duplicateOf: row.duplicate_of,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function analystSourceActivationPacketToPostgresRow(packet: AnalystSourceActivationPacket): AnalystSourceActivationPacketRow {
  if (packet.dryRun !== true) throw new Error(`Source activation packets must stay dry-run: ${packet.id}`);
  return {
    id: packet.id,
    tenant_id: packet.tenantId,
    plan_id: packet.planId,
    run_id: packet.runId,
    source_id: packet.sourceId,
    action: packet.action,
    execution: packet.execution,
    reason: packet.reason,
    expected_effect: packet.expectedEffect,
    rollback: packet.rollback,
    dry_run: true,
    approved_by: packet.approvedBy,
    approved_at: packet.approvedAt,
    created_at: packet.createdAt
  };
}

export function analystSourceActivationPacketFromPostgresRow(row: AnalystSourceActivationPacketRow): AnalystSourceActivationPacket {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planId: row.plan_id,
    runId: row.run_id,
    sourceId: row.source_id,
    action: row.action,
    execution: row.execution,
    reason: row.reason,
    expectedEffect: row.expected_effect,
    rollback: row.rollback,
    dryRun: true,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at
  };
}

export function analystVictimNotificationPacketToPostgresRow(packet: AnalystVictimNotificationPacket): AnalystVictimNotificationPacketRow {
  return {
    id: packet.id,
    tenant_id: packet.tenantId,
    review_task_id: packet.reviewTaskId,
    status: packet.status,
    company: packet.company,
    victim: packet.victim,
    claim_summary: packet.claimSummary,
    affected_accounts_text: packet.affectedAccounts,
    dataset_size_text: packet.datasetSize,
    actor_statement_summary: packet.actorStatement,
    claimed_at: packet.claimedAt,
    observed_at: packet.observedAt,
    source_hash: packet.sourceHash,
    confidence: packet.confidence,
    provenance: safeProvenance(packet.provenance, packet.id),
    redactions: [...packet.redactions],
    what_was_not_accessed: [...packet.whatWasNotAccessed],
    safe_to_send: packet.safeToSend,
    approved_by: packet.approvedBy,
    sent_at: packet.sentAt,
    created_at: packet.createdAt,
    updated_at: packet.updatedAt
  };
}

export function analystVictimNotificationPacketFromPostgresRow(row: AnalystVictimNotificationPacketRow): AnalystVictimNotificationPacket {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    reviewTaskId: row.review_task_id,
    status: row.status,
    company: row.company,
    victim: row.victim,
    claimSummary: row.claim_summary,
    affectedAccounts: row.affected_accounts_text,
    datasetSize: row.dataset_size_text,
    actorStatement: row.actor_statement_summary,
    claimedAt: row.claimed_at,
    observedAt: row.observed_at,
    sourceHash: row.source_hash,
    confidence: row.confidence,
    provenance: safeProvenance(row.provenance, row.id),
    redactions: [...row.redactions],
    whatWasNotAccessed: [...row.what_was_not_accessed],
    safeToSend: row.safe_to_send,
    approvedBy: row.approved_by,
    sentAt: row.sent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function analystClaimLedgerEntryToPostgresRow(entry: AnalystClaimLedgerEntry): AnalystClaimLedgerEntryRow {
  return {
    id: entry.id,
    tenant_id: entry.tenantId,
    normalized_query: entry.normalizedQuery,
    review_task_id: entry.reviewTaskId,
    capture_id: entry.captureId,
    source_id: entry.sourceId,
    claim_kind: entry.claimKind,
    company: entry.company,
    victim: entry.victim,
    claim_text_summary: entry.claimTextSummary,
    source_hash: entry.sourceHash,
    confidence: entry.confidence,
    ledger_status: entry.ledgerStatus,
    observed_at: entry.observedAt,
    provenance: safeProvenance(entry.provenance, entry.id),
    created_at: entry.createdAt
  };
}

export function analystClaimLedgerEntryFromPostgresRow(row: AnalystClaimLedgerEntryRow): AnalystClaimLedgerEntry {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    normalizedQuery: row.normalized_query,
    reviewTaskId: row.review_task_id,
    captureId: row.capture_id,
    sourceId: row.source_id,
    claimKind: row.claim_kind,
    company: row.company,
    victim: row.victim,
    claimTextSummary: row.claim_text_summary,
    sourceHash: row.source_hash,
    confidence: row.confidence,
    ledgerStatus: row.ledger_status,
    observedAt: row.observed_at,
    provenance: safeProvenance(row.provenance, row.id),
    createdAt: row.created_at
  };
}

export function analystLoopSnapshotToPostgresRow(snapshot: AnalystLoopSnapshot): AnalystLoopSnapshotRow {
  return {
    id: snapshot.id,
    tenant_id: snapshot.tenantId,
    plan_id: snapshot.planId,
    run_id: snapshot.runId,
    normalized_query: snapshot.normalizedQuery,
    result_state: snapshot.resultState,
    headline: snapshot.headline,
    queued_tasks: snapshot.queuedTasks,
    review_tasks: snapshot.reviewTasks,
    rejected_sources: snapshot.rejectedSources,
    blocked_unsafe_targets: snapshot.blockedUnsafeTargets,
    meaningful_work_count: snapshot.meaningfulWorkCount,
    next_steps: snapshot.nextSteps.map((step) => ({ ...step })),
    review_task_ids: [...snapshot.reviewTaskIds],
    activation_packet_ids: [...snapshot.activationPacketIds],
    victim_notification_packet_id: snapshot.victimNotificationPacketId,
    captured_at: snapshot.capturedAt
  };
}

export function analystLoopSnapshotFromPostgresRow(row: AnalystLoopSnapshotRow): AnalystLoopSnapshot {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planId: row.plan_id,
    runId: row.run_id,
    normalizedQuery: row.normalized_query,
    resultState: row.result_state,
    headline: row.headline,
    queuedTasks: row.queued_tasks,
    reviewTasks: row.review_tasks,
    rejectedSources: row.rejected_sources,
    blockedUnsafeTargets: row.blocked_unsafe_targets,
    meaningfulWorkCount: row.meaningful_work_count,
    nextSteps: row.next_steps.map((step) => ({ ...step })),
    reviewTaskIds: [...row.review_task_ids],
    activationPacketIds: [...row.activation_packet_ids],
    victimNotificationPacketId: row.victim_notification_packet_id,
    capturedAt: row.captured_at
  };
}

export function analystLoopSnapshotToPostgresRows(input: {
  metadataReviewTasks: AnalystMetadataReviewTask[];
  sourceActivationPackets: AnalystSourceActivationPacket[];
  victimNotificationPackets: AnalystVictimNotificationPacket[];
  claimLedgerEntries: AnalystClaimLedgerEntry[];
  loopSnapshots: AnalystLoopSnapshot[];
}): AnalystLoopPostgresRows {
  return {
    metadata_review_tasks: input.metadataReviewTasks.map(analystMetadataReviewTaskToPostgresRow),
    source_activation_packets: input.sourceActivationPackets.map(analystSourceActivationPacketToPostgresRow),
    victim_notification_packets: input.victimNotificationPackets.map(analystVictimNotificationPacketToPostgresRow),
    claim_ledger_entries: input.claimLedgerEntries.map(analystClaimLedgerEntryToPostgresRow),
    analyst_loop_snapshots: input.loopSnapshots.map(analystLoopSnapshotToPostgresRow)
  };
}

export function analystLoopSnapshotFromPostgresRows(rows: AnalystLoopPostgresRows) {
  return {
    metadataReviewTasks: rows.metadata_review_tasks.map(analystMetadataReviewTaskFromPostgresRow),
    sourceActivationPackets: rows.source_activation_packets.map(analystSourceActivationPacketFromPostgresRow),
    victimNotificationPackets: rows.victim_notification_packets.map(analystVictimNotificationPacketFromPostgresRow),
    claimLedgerEntries: rows.claim_ledger_entries.map(analystClaimLedgerEntryFromPostgresRow),
    loopSnapshots: rows.analyst_loop_snapshots.map(analystLoopSnapshotFromPostgresRow)
  };
}

function safeProvenance(value: Record<string, unknown>, id: string): JsonObject {
  assertSafeProvenance(value, id);
  return { ...value };
}

function assertSafeProvenance(value: unknown, id: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Analyst provenance must be an object: ${id}`);
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_PROVENANCE_KEYS.has(key)) throw new Error(`Unsafe analyst provenance key cannot be persisted: ${key}`);
    if (nested && typeof nested === "object" && !Array.isArray(nested)) assertSafeProvenance(nested, id);
  }
}
