import type {
  AnalystClaimLedgerEntry,
  AnalystLoopSnapshot,
  AnalystMetadataReviewTask,
  AnalystSourceActivationPacket,
  AnalystVictimNotificationPacket,
  CollectionPlan,
  CollectionRun,
  CollectionTask,
  AnalystLoopResultState
} from "../types.ts";
import { buildSourceRegistryPersistenceReadinessPacket } from "./sourceRegistryPostgres.ts";

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

export type AnalystCollectionTaskState =
  | "queued"
  | "leased"
  | "completed"
  | "failed"
  | "review_required"
  | "blocked"
  | "rejected";

export type AnalystCollectionTaskTargetKind =
  | "safe_public"
  | "metadata_only"
  | "source_activation_gap"
  | "blocked_unsafe_target";

export interface AnalystCollectionPlanRow {
  id: string;
  tenant_id?: string;
  request_id: string;
  query: string;
  normalized_query: string;
  entity_type: CollectionPlan["request"]["entityType"];
  budget_class?: CollectionPlan["request"]["budgetClass"];
  created_at: string;
  requester_id?: string;
  result_state: AnalystLoopResultState;
  queued_task_count: number;
  review_required_count: number;
  rejected_source_count: number;
  request: JsonObject;
  explanations: CollectionPlan["explanations"];
  audit: CollectionPlan["audit"];
}

export interface AnalystCollectionTaskRow {
  id: string;
  tenant_id?: string;
  plan_id: string;
  run_id?: string;
  source_id: string;
  task_state: AnalystCollectionTaskState;
  target_kind: AnalystCollectionTaskTargetKind;
  source_type: CollectionTask["sourceType"];
  target_url: string;
  priority: number;
  reason: string;
  queued_at: string;
  available_at?: string;
  deadline_at?: string;
  max_bytes?: number;
  retry_count: number;
  planning: JsonObject;
  metadata: JsonObject;
}

export interface AnalystCollectionRunRow {
  id: string;
  tenant_id?: string;
  plan_id: string;
  request_id: string;
  status: CollectionRun["status"];
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  idempotency_key?: string;
  request_hash?: string;
  task_count: number;
  review_task_count: number;
  rejected_source_count: number;
  capture_count: number;
  incident_count: number;
  result_state: AnalystLoopResultState;
  error?: string;
  summary: JsonObject;
}

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
  duplicate_of?: string;
  contradiction_reason?: string;
  retention_class?: AnalystClaimLedgerEntry["retentionClass"];
  legal_hold?: boolean;
  graph_eligible?: boolean;
  stix_eligible?: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  updated_at?: string;
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
  collection_plans: AnalystCollectionPlanRow[];
  collection_tasks: AnalystCollectionTaskRow[];
  collection_runs: AnalystCollectionRunRow[];
  metadata_review_tasks: AnalystMetadataReviewTaskRow[];
  source_activation_packets: AnalystSourceActivationPacketRow[];
  victim_notification_packets: AnalystVictimNotificationPacketRow[];
  claim_ledger_entries: AnalystClaimLedgerEntryRow[];
  analyst_loop_snapshots: AnalystLoopSnapshotRow[];
}

export function analystCollectionPlanToPostgresRow(
  plan: CollectionPlan,
  resultState: AnalystLoopResultState = plan.reviewRequired.length > 0 ? "metadata_review" : plan.rejected.length > 0 ? "needs_source_activation" : "queued"
): AnalystCollectionPlanRow {
  return {
    id: plan.id,
    tenant_id: plan.tenantId,
    request_id: plan.request.id,
    query: plan.request.query,
    normalized_query: normalizeQuery(plan.request.query),
    entity_type: plan.request.entityType,
    budget_class: plan.request.budgetClass,
    created_at: plan.request.createdAt,
    requester_id: plan.request.requesterId,
    result_state: resultState,
    queued_task_count: plan.tasks.length,
    review_required_count: plan.reviewRequired.length,
    rejected_source_count: plan.rejected.length,
    request: safeJsonObject(plan.request, plan.id),
    explanations: safeJsonArray(plan.explanations ?? [], plan.id) as CollectionPlan["explanations"],
    audit: safeJsonArray(plan.audit, plan.id) as CollectionPlan["audit"]
  };
}

export function analystCollectionPlanFromPostgresRow(
  row: AnalystCollectionPlanRow,
  tasks: CollectionTask[] = [],
  reviewRequired: CollectionTask[] = [],
  rejected: CollectionPlan["rejected"] = []
): CollectionPlan {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    request: safeJsonObject(row.request, row.id) as CollectionPlan["request"],
    tasks,
    reviewRequired,
    rejected,
    explanations: safeJsonArray(row.explanations ?? [], row.id) as CollectionPlan["explanations"],
    queryTerms: queryTermsFromExplanations(row.explanations ?? []),
    audit: safeJsonArray(row.audit, row.id) as CollectionPlan["audit"]
  };
}

export function analystCollectionTaskToPostgresRow(
  task: CollectionTask,
  input: {
    planId: string;
    taskState?: AnalystCollectionTaskState;
    targetKind?: AnalystCollectionTaskTargetKind;
    metadata?: Record<string, unknown>;
  }
): AnalystCollectionTaskRow {
  return {
    id: task.id,
    tenant_id: task.tenantId,
    plan_id: input.planId,
    run_id: task.runId,
    source_id: task.sourceId,
    task_state: input.taskState ?? collectionTaskState(task),
    target_kind: input.targetKind ?? collectionTaskTargetKind(task),
    source_type: task.sourceType,
    target_url: task.targetUrl,
    priority: task.priority,
    reason: task.reason,
    queued_at: task.queuedAt,
    available_at: task.availableAt,
    deadline_at: task.deadlineAt,
    max_bytes: task.maxBytes,
    retry_count: task.retryCount,
    planning: safeJsonObject((task.planning ?? {}) as unknown as Record<string, unknown>, task.id),
    metadata: safeJsonObject({ ...collectionTaskOptionalMetadata(task), ...(input.metadata ?? {}) }, task.id)
  };
}

export function analystCollectionTaskFromPostgresRow(row: AnalystCollectionTaskRow): CollectionTask {
  const task: CollectionTask = {
    id: row.id,
    tenantId: row.tenant_id,
    sourceId: row.source_id,
    targetUrl: row.target_url,
    sourceType: row.source_type,
    queuedAt: row.queued_at,
    priority: row.priority,
    reason: row.reason,
    retryCount: row.retry_count,
    runId: row.run_id,
    planning: Object.keys(row.planning).length > 0 ? safeJsonObject(row.planning, row.id) as unknown as CollectionTask["planning"] : undefined
  };
  if (row.deadline_at !== undefined) task.deadlineAt = row.deadline_at;
  if (row.max_bytes !== undefined) task.maxBytes = row.max_bytes;
  if (row.available_at !== undefined) task.availableAt = row.available_at;
  if (typeof row.metadata.intelRequestId === "string") task.intelRequestId = row.metadata.intelRequestId;
  if (typeof row.metadata.parentUrl === "string") task.parentUrl = row.metadata.parentUrl;
  if (typeof row.metadata.attemptDeadlineAt === "string") task.attemptDeadlineAt = row.metadata.attemptDeadlineAt;
  if (typeof row.metadata.crawlBudgetKey === "string") task.crawlBudgetKey = row.metadata.crawlBudgetKey;
  if (typeof row.metadata.maxRetries === "number") task.maxRetries = row.metadata.maxRetries;
  if (typeof row.metadata.sourceConcurrencyKey === "string") task.sourceConcurrencyKey = row.metadata.sourceConcurrencyKey;
  if (typeof row.metadata.fairnessKey === "string") task.fairnessKey = row.metadata.fairnessKey;
  if (row.metadata.scoreBreakdown && typeof row.metadata.scoreBreakdown === "object" && !Array.isArray(row.metadata.scoreBreakdown)) {
    task.scoreBreakdown = row.metadata.scoreBreakdown as CollectionTask["scoreBreakdown"];
  }
  return task;
}

export function analystCollectionRunToPostgresRow(
  run: CollectionRun,
  input: {
    resultState?: AnalystLoopResultState;
    summary?: Record<string, unknown>;
  } = {}
): AnalystCollectionRunRow {
  return {
    id: run.id,
    tenant_id: run.tenantId,
    plan_id: run.planId,
    request_id: run.requestId,
    status: run.status,
    created_at: run.createdAt,
    updated_at: run.updatedAt,
    started_at: run.startedAt,
    completed_at: run.completedAt,
    idempotency_key: run.idempotencyKey,
    request_hash: run.requestHash,
    task_count: run.taskCount,
    review_task_count: run.reviewTaskCount,
    rejected_source_count: run.rejectedSourceCount,
    capture_count: run.captureCount,
    incident_count: run.incidentCount,
    result_state: input.resultState ?? collectionRunResultState(run),
    error: run.error,
    summary: safeJsonObject(input.summary ?? {}, run.id)
  };
}

export function analystCollectionRunFromPostgresRow(row: AnalystCollectionRunRow): CollectionRun {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planId: row.plan_id,
    requestId: row.request_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    idempotencyKey: row.idempotency_key,
    requestHash: row.request_hash,
    taskCount: row.task_count,
    reviewTaskCount: row.review_task_count,
    rejectedSourceCount: row.rejected_source_count,
    captureCount: row.capture_count,
    incidentCount: row.incident_count,
    error: row.error
  };
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
    duplicate_of: entry.duplicateOf,
    contradiction_reason: entry.contradictionReason,
    retention_class: entry.retentionClass,
    legal_hold: entry.legalHold,
    graph_eligible: entry.graphEligible,
    stix_eligible: entry.stixEligible,
    reviewed_by: entry.reviewedBy,
    reviewed_at: entry.reviewedAt,
    updated_at: entry.updatedAt,
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
    duplicateOf: row.duplicate_of,
    contradictionReason: row.contradiction_reason,
    retentionClass: row.retention_class,
    legalHold: row.legal_hold,
    graphEligible: row.graph_eligible,
    stixEligible: row.stix_eligible,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    updatedAt: row.updated_at,
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
  collectionPlans?: CollectionPlan[];
  collectionTasks?: Array<{
    task: CollectionTask;
    planId: string;
    taskState?: AnalystCollectionTaskState;
    targetKind?: AnalystCollectionTaskTargetKind;
    metadata?: Record<string, unknown>;
  }>;
  collectionRuns?: CollectionRun[];
  metadataReviewTasks: AnalystMetadataReviewTask[];
  sourceActivationPackets: AnalystSourceActivationPacket[];
  victimNotificationPackets: AnalystVictimNotificationPacket[];
  claimLedgerEntries: AnalystClaimLedgerEntry[];
  loopSnapshots: AnalystLoopSnapshot[];
}): AnalystLoopPostgresRows {
  return {
    collection_plans: (input.collectionPlans ?? []).map((plan) => analystCollectionPlanToPostgresRow(plan)),
    collection_tasks: (input.collectionTasks ?? []).map((entry) => analystCollectionTaskToPostgresRow(entry.task, entry)),
    collection_runs: (input.collectionRuns ?? []).map((run) => analystCollectionRunToPostgresRow(run)),
    metadata_review_tasks: input.metadataReviewTasks.map(analystMetadataReviewTaskToPostgresRow),
    source_activation_packets: input.sourceActivationPackets.map(analystSourceActivationPacketToPostgresRow),
    victim_notification_packets: input.victimNotificationPackets.map(analystVictimNotificationPacketToPostgresRow),
    claim_ledger_entries: input.claimLedgerEntries.map(analystClaimLedgerEntryToPostgresRow),
    analyst_loop_snapshots: input.loopSnapshots.map(analystLoopSnapshotToPostgresRow)
  };
}

export function analystLoopSnapshotFromPostgresRows(rows: AnalystLoopPostgresRows) {
  return {
    collectionPlans: rows.collection_plans.map((row) => analystCollectionPlanFromPostgresRow(row)),
    collectionTasks: rows.collection_tasks.map(analystCollectionTaskFromPostgresRow),
    collectionRuns: rows.collection_runs.map(analystCollectionRunFromPostgresRow),
    metadataReviewTasks: rows.metadata_review_tasks.map(analystMetadataReviewTaskFromPostgresRow),
    sourceActivationPackets: rows.source_activation_packets.map(analystSourceActivationPacketFromPostgresRow),
    victimNotificationPackets: rows.victim_notification_packets.map(analystVictimNotificationPacketFromPostgresRow),
    claimLedgerEntries: rows.claim_ledger_entries.map(analystClaimLedgerEntryFromPostgresRow),
    loopSnapshots: rows.analyst_loop_snapshots.map(analystLoopSnapshotFromPostgresRow)
  };
}

export interface AnalystLoopPersistenceReadinessPacket {
  endpoint: "/v1/analyst/persistence-readiness";
  schemaVersion: "ti.analyst_loop_persistence_readiness.v1";
  generatedAt: string;
  dryRun: true;
  willMutate: false;
  willConnectToDatabase: false;
  migration: {
    path: "migrations/004_analyst_loop.sql";
    purpose: string;
  };
  dependencies: Array<{
    table: string;
    migration: string;
    purpose: string;
  }>;
  sourceRegistryPersistence: {
    schemaVersion: "ti.source_registry_persistence_readiness.v1";
    migration: "migrations/001_source_registry.sql";
    dryRun: true;
    willMutate: false;
    willConnectToDatabase: false;
    workflowTables: Array<{
      table: string;
      mapper: string;
      requiredForCutover: boolean;
    }>;
    replayOrder: string[];
    guardrails: string[];
    cutoverRole: string;
  };
  workflowTables: Array<{
    table: keyof AnalystLoopPostgresRows;
    mapper: string;
    replayRole: string;
    safetyBoundary: string;
  }>;
  replayOrder: Array<keyof AnalystLoopPostgresRows>;
  readiness: {
    state: "ready";
    mappedTableCount: number;
    blockers: string[];
  };
  noLeakGuardrails: {
    forbiddenPersistedFields: string[];
    enforcedChecks: string[];
    forbiddenOperations: string[];
  };
  operatorUse: {
    route: "/v1/analyst/persistence-readiness";
    recommendedNextStep: string;
    proofCommands: string[];
  };
}

export function buildAnalystLoopPersistenceReadinessPacket(generatedAt: string): AnalystLoopPersistenceReadinessPacket {
  const workflowTables: AnalystLoopPersistenceReadinessPacket["workflowTables"] = [
    {
      table: "collection_plans",
      mapper: "analystCollectionPlanToPostgresRow / analystCollectionPlanFromPostgresRow",
      replayRole: "rebuild original analyst request, query normalization, queued/review/rejected counts, planner explanations, and audit events",
      safetyBoundary: "request/explanation/audit JSON is recursively checked for raw leak, credential, payload, and downloaded dataset keys"
    },
    {
      table: "collection_tasks",
      mapper: "analystCollectionTaskToPostgresRow / analystCollectionTaskFromPostgresRow",
      replayRole: "replay safe-public tasks, metadata-only review holds, activation gaps, and blocked unsafe target state without leasing work",
      safetyBoundary: "planning and metadata JSON are recursively checked; task target_kind distinguishes safe metadata from blocked unsafe targets"
    },
    {
      table: "collection_runs",
      mapper: "analystCollectionRunToPostgresRow / analystCollectionRunFromPostgresRow",
      replayRole: "restore run status, counters, idempotency linkage, and analyst-loop result state after restart",
      safetyBoundary: "summary JSON is recursively checked and does not store raw captures, object keys, credentials, or restricted content"
    },
    {
      table: "metadata_review_tasks",
      mapper: "analystMetadataReviewTaskToPostgresRow / analystMetadataReviewTaskFromPostgresRow",
      replayRole: "restore the analyst inbox for company/victim, affected accounts, dataset size, actor statement, provenance, allowed actions, and source hash",
      safetyBoundary: "unsafe_material_accessed must be false and provenance is recursively checked"
    },
    {
      table: "source_activation_packets",
      mapper: "analystSourceActivationPacketToPostgresRow / analystSourceActivationPacketFromPostgresRow",
      replayRole: "restore dry-run operator/legal approval packets for metadata-only source activation",
      safetyBoundary: "dry_run must remain true; packets do not activate sources or enqueue collection"
    },
    {
      table: "victim_notification_packets",
      mapper: "analystVictimNotificationPacketToPostgresRow / analystVictimNotificationPacketFromPostgresRow",
      replayRole: "restore redacted victim/company notification packets and external-delivery audit state",
      safetyBoundary: "packets contain claim summaries and what-was-not-accessed text only; the scraper never sends notifications"
    },
    {
      table: "claim_ledger_entries",
      mapper: "analystClaimLedgerEntryToPostgresRow / analystClaimLedgerEntryFromPostgresRow",
      replayRole: "restore reviewed, duplicate, held, contradicted, and graph/STIX eligibility state for safe claims",
      safetyBoundary: "provenance is checked and claim summaries exclude raw leaked rows, credential values, and private material"
    },
    {
      table: "analyst_loop_snapshots",
      mapper: "analystLoopSnapshotToPostgresRow / analystLoopSnapshotFromPostgresRow",
      replayRole: "restore /ti result state, next steps, meaningful work counts, and packet/task references without rerunning collection",
      safetyBoundary: "snapshots reference safe workflow IDs and analyst-loop states only"
    }
  ];
  const sourceRegistryPersistence = buildSourceRegistryPersistenceReadinessPacket(generatedAt);
  return {
    endpoint: "/v1/analyst/persistence-readiness",
    schemaVersion: "ti.analyst_loop_persistence_readiness.v1",
    generatedAt,
    dryRun: true,
    willMutate: false,
    willConnectToDatabase: false,
    migration: {
      path: "migrations/004_analyst_loop.sql",
      purpose: "Durable safe workflow state for /ti analyst-loop review, source activation approvals, notification packets, claim ledger, and restart replay."
    },
    dependencies: [
      {
        table: "sources",
        migration: "migrations/001_source_registry.sql",
        purpose: "source registry and lifecycle records referenced by collection tasks, review tasks, activation packets, and claim ledger entries"
      },
      {
        table: "raw_captures",
        migration: "migrations/003_evidence_store.sql",
        purpose: "safe capture references and hashes only; analyst-loop packets must never expose raw capture bodies or object keys"
      }
    ],
    sourceRegistryPersistence: {
      schemaVersion: "ti.source_registry_persistence_readiness.v1",
      migration: "migrations/001_source_registry.sql",
      dryRun: true,
      willMutate: false,
      willConnectToDatabase: false,
      workflowTables: sourceRegistryPersistence.workflowTables,
      replayOrder: sourceRegistryPersistence.replayOrder,
      guardrails: sourceRegistryPersistence.guardrails,
      cutoverRole: "restore source records, governance approvals, legal notes, health, scoring inputs, crawl state, and lifecycle history before replaying analyst-loop tasks"
    },
    workflowTables,
    replayOrder: [
      "collection_plans",
      "collection_runs",
      "collection_tasks",
      "metadata_review_tasks",
      "source_activation_packets",
      "victim_notification_packets",
      "claim_ledger_entries",
      "analyst_loop_snapshots"
    ],
    readiness: {
      state: "ready",
      mappedTableCount: workflowTables.length,
      blockers: []
    },
    noLeakGuardrails: {
      forbiddenPersistedFields: [...FORBIDDEN_PROVENANCE_KEYS],
      enforcedChecks: [
        "metadata_review_tasks.unsafe_material_accessed must be false",
        "source_activation_packets.dry_run must be true",
        "review, notification, claim, plan, task, and run JSON payloads reject forbidden raw material keys",
        "analyst snapshots store states, counts, and safe packet ids rather than raw data"
      ],
      forbiddenOperations: [
        "download leaked datasets",
        "persist credential values",
        "expose private-access material",
        "bypass CAPTCHA or authenticated areas",
        "interact with threat actors",
        "activate restricted sources silently",
        "enqueue collection from the readiness endpoint",
        "send victim notifications from the scraper"
      ]
    },
    operatorUse: {
      route: "/v1/analyst/persistence-readiness",
      recommendedNextStep: "Use this packet as the preflight proof before wiring a real Postgres adapter or replay worker.",
      proofCommands: [
        "bun run check",
        "bun test src/tests/storageCutover.test.ts src/tests/api.test.ts",
        "bun run check:route-inventory",
        "bun run check:contract-index"
      ]
    }
  };
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function queryTermsFromExplanations(explanations: CollectionPlan["explanations"]): string[] | undefined {
  const terms = new Set<string>();
  for (const explanation of explanations ?? []) {
    for (const term of explanation.queryTerms ?? []) terms.add(term);
  }
  return terms.size > 0 ? [...terms] : undefined;
}

function collectionTaskOptionalMetadata(task: CollectionTask): JsonObject {
  const metadata: JsonObject = {};
  if (task.intelRequestId) metadata.intelRequestId = task.intelRequestId;
  if (task.parentUrl) metadata.parentUrl = task.parentUrl;
  if (task.attemptDeadlineAt) metadata.attemptDeadlineAt = task.attemptDeadlineAt;
  if (task.crawlBudgetKey) metadata.crawlBudgetKey = task.crawlBudgetKey;
  if (task.maxRetries !== undefined) metadata.maxRetries = task.maxRetries;
  if (task.sourceConcurrencyKey) metadata.sourceConcurrencyKey = task.sourceConcurrencyKey;
  if (task.fairnessKey) metadata.fairnessKey = task.fairnessKey;
  if (task.scoreBreakdown) metadata.scoreBreakdown = task.scoreBreakdown;
  return metadata;
}

function collectionTaskState(task: CollectionTask): AnalystCollectionTaskState {
  if (task.planning?.decision === "blocked-by-policy") return "blocked";
  if (task.planning?.decision === "blocked-by-approval") return "review_required";
  if (task.planning?.decision === "skipped" || task.planning?.decision === "duplicate-suppressed") return "rejected";
  return "queued";
}

function collectionTaskTargetKind(task: CollectionTask): AnalystCollectionTaskTargetKind {
  if (task.planning?.decision === "blocked-by-policy") return "blocked_unsafe_target";
  if (task.planning?.decision === "blocked-by-approval") return "source_activation_gap";
  if (task.planning?.safetyEnvelope?.metadataOnlyRestricted || task.planning?.selectedFor === "metadata") return "metadata_only";
  return "safe_public";
}

function collectionRunResultState(run: CollectionRun): AnalystLoopResultState {
  if (run.reviewTaskCount > 0) return "metadata_review";
  if (run.rejectedSourceCount > 0) return "needs_source_activation";
  if (run.status === "completed") return "ready";
  return "queued";
}

function safeJsonObject(value: unknown, id: string): JsonObject {
  assertSafeProvenance(value, id);
  return { ...(value as Record<string, unknown>) };
}

function safeJsonArray(value: unknown[], id: string): unknown[] {
  for (const nested of value) {
    if (nested && typeof nested === "object") assertSafeProvenance(nested, id);
  }
  return value.map((entry) => entry && typeof entry === "object" && !Array.isArray(entry) ? { ...entry } : entry);
}

function safeProvenance(value: Record<string, unknown>, id: string): JsonObject {
  assertSafeProvenance(value, id);
  return { ...value };
}

function assertSafeProvenance(value: unknown, id: string): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Analyst provenance must be an object: ${id}`);
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_PROVENANCE_KEYS.has(key)) throw new Error(`Unsafe analyst provenance key cannot be persisted: ${key}`);
    if (Array.isArray(nested)) {
      for (const entry of nested) {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) assertSafeProvenance(entry, id);
      }
      continue;
    }
    if (nested && typeof nested === "object" && !Array.isArray(nested)) assertSafeProvenance(nested, id);
  }
}
