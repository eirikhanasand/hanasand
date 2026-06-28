import type { CollectionTask, SourceRecord } from "../types.ts";

export type DwmSourcePackFamily = "telegram" | "darkweb_onion" | "darkweb_metadata" | "actor_page" | "public_advisory" | "clear_web";

export type DwmSourcePackCandidateRecord = {
  id: string;
  sourceId?: string;
  family: string;
  declaredFamily: DwmSourcePackFamily;
  type: string;
  refLabel?: string;
  parserExpectation: string;
  index: number;
  targetRef: { hash: string; preview: string; family: string; rawStored: false };
  requestedBy: string;
  requestedAt: string;
  status: string;
  intakeStatus: string;
  decision?: string;
  activationState?: string;
  decidedBy?: string;
  decidedAt?: string;
  reason?: string;
  duplicateOf?: string;
  failure?: Record<string, unknown>;
  policyBoundary?: Record<string, unknown>;
  validationResult?: Record<string, unknown>;
  parserStatus?: string;
  healthStatus?: string;
  lastTestOutcome?: Record<string, unknown>;
  retryHint?: string;
};

export type DwmSourcePackRecord = {
  id: string;
  label: string;
  tenantId?: string;
  scope?: string;
  requestedBy: string;
  requestedAt: string;
  updatedAt: string;
  requestId: string;
  familyCoverage?: Record<string, unknown>;
  healthRollup?: Record<string, unknown>;
  safeOutput: Record<string, boolean>;
  candidates: DwmSourcePackCandidateRecord[];
  audit: Array<Record<string, unknown>>;
};

export type DwmSourcePackListQuery = {
  family?: DwmSourcePackFamily;
  decision?: string;
  activationState?: string;
  parserStatus?: string;
  lastFailure?: string;
  requestId?: string;
  label?: string;
  createdFrom?: string;
  createdTo?: string;
  cursor?: string;
  limit?: number;
};

export type DwmSourcePackBulkImportPolicy = {
  maxPackSize?: number;
  chunkSize?: number;
  duplicatePackId?: "merge" | "reject";
  perFamilyCaps?: Partial<Record<DwmSourcePackFamily, number>>;
};

export type DwmSourcePackBulkImportPlan = {
  acceptedPacks: DwmSourcePackRecord[];
  rejectedPacks: Array<{ packId?: string; label?: string; reason: string; safeCandidateRefs: Array<DwmSourcePackCandidateRecord["targetRef"]> }>;
  chunks: Array<{ cursor: string; nextCursor?: string; packIds: string[] }>;
  summary: {
    requestedPackCount: number;
    acceptedPackCount: number;
    rejectedPackCount: number;
    maxPackSize: number;
    chunkSize: number;
    duplicatePackIdBehavior: "merge" | "reject";
    perFamilyCaps: Partial<Record<DwmSourcePackFamily, number>>;
  };
  safeOutput: Record<string, boolean>;
};

export type DwmSourcePackValidationState =
  | "queued"
  | "validating"
  | "failed"
  | "partially_active"
  | "active"
  | "retry_scheduled"
  | "disabled";

export type DwmSourcePackValidationFailure = {
  candidateId?: string;
  code: string;
  message: string;
  at: string;
};

export type DwmSourcePackValidationJob = {
  id: string;
  packIds: string[];
  status: DwmSourcePackValidationState;
  cursor: string;
  nextCursor?: string;
  candidateIds: string[];
  familyConcurrency: Partial<Record<DwmSourcePackFamily, number>>;
  parserStatus: Record<string, string>;
  lastFailure?: DwmSourcePackValidationFailure;
  retry: {
    attempt: number;
    maxAttempts: number;
    backoffSeconds: number;
    retryAfter?: string;
  };
  duplicateTargetRefs: Array<{ hash: string; candidateIds: string[] }>;
  safeRejectedRows: Array<{
    candidateId: string;
    targetRef: DwmSourcePackCandidateRecord["targetRef"];
    reason: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type DwmSourcePackValidationBatchPlan = {
  jobs: DwmSourcePackValidationJob[];
  duplicateTargetRefs: DwmSourcePackValidationJob["duplicateTargetRefs"];
  safeRejectedRows: DwmSourcePackValidationJob["safeRejectedRows"];
  summary: {
    packCount: number;
    candidateCount: number;
    jobCount: number;
    chunkSize: number;
    duplicateCandidateCount: number;
    perFamilyConcurrency: Partial<Record<DwmSourcePackFamily, number>>;
  };
  safeOutput: Record<string, boolean>;
};

export type DwmSourceCandidateValidationResult = {
  candidateId: string;
  state: Exclude<DwmSourcePackValidationState, "queued" | "validating">;
  parserStatus: string;
  validationScore?: number;
  failure?: { code: string; message: string };
};

export type DwmSourcePackHealthRollup = {
  coverage: Record<DwmSourcePackFamily, { total: number; active: number; pending: number; failed: number; disabled: number }>;
  staleSources: Array<{ candidateId: string; lastCaptureAt?: string; staleSeconds: number }>;
  parserFailures: Array<{ candidateId: string; parserStatus?: string; failure?: Record<string, unknown> }>;
  activationLag: Array<{ candidateId: string; requestedAt: string; pendingSeconds: number; status: string }>;
  nextRetryWindows: Array<{ candidateId: string; retryAfter?: string; retryHint?: string; failure?: Record<string, unknown> }>;
};

export type DwmSourcePackValidationQueueRecord = {
  jobKey: string;
  job: DwmSourcePackValidationJob;
  packIds: string[];
  requestIds: string[];
  status: DwmSourcePackValidationState;
  candidateIds: string[];
  familyConcurrency: Partial<Record<DwmSourcePackFamily, number>>;
  retry: DwmSourcePackValidationJob["retry"];
  safeRejectedRows: DwmSourcePackValidationJob["safeRejectedRows"];
  createdAt: string;
  updatedAt: string;
};

export type DwmSourcePackValidationQueueReceipt = {
  status: "enqueued" | "duplicate";
  jobKey: string;
  record: DwmSourcePackValidationQueueRecord;
};

export interface DwmSourcePackValidationQueueAdapter {
  enqueue(record: DwmSourcePackValidationQueueRecord): DwmSourcePackValidationQueueReceipt;
  get(jobKey: string): DwmSourcePackValidationQueueRecord | undefined;
  list(): DwmSourcePackValidationQueueRecord[];
  transition(jobKey: string, status: DwmSourcePackValidationState, patch?: Partial<DwmSourcePackValidationQueueRecord>): DwmSourcePackValidationQueueRecord;
}

export type DwmSourcePackActiveSourceRow = {
  sourceId: string;
  candidateId: string;
  packId: string;
  requestId: string;
  family: DwmSourcePackFamily;
  sourceType: string;
  targetHash: string;
  targetPreview: string;
  targetRawStored: false;
  parserStatus: string;
  validationScore: number;
  policyBoundary?: Record<string, unknown>;
  status: "active";
  activationState: "active_canary" | "metadata_only_active";
  retry: { attempt: number; maxAttempts: number; backoffSeconds: number; retryAfter?: string };
  activatedAt: string;
  validationJobKey: string;
  alertGradeEvidenceEligible: boolean;
};

export type DwmSourcePackActiveSourceUpsertReceipt = {
  status: "inserted" | "duplicate" | "skipped";
  sourceId: string;
  candidateId: string;
  row?: DwmSourcePackActiveSourceRow;
  reason?: string;
};

export interface DwmSourcePackActiveSourceAdapter {
  upsert(row: DwmSourcePackActiveSourceRow): DwmSourcePackActiveSourceUpsertReceipt;
  get(sourceId: string): DwmSourcePackActiveSourceRow | undefined;
  list(): DwmSourcePackActiveSourceRow[];
}

export type DwmSourcePackActiveSourcePersistenceResult = {
  receipts: DwmSourcePackActiveSourceUpsertReceipt[];
  summary: {
    insertedCount: number;
    duplicateCount: number;
    skippedCount: number;
    activeSourceCount: number;
    collectionReadyCount: number;
  };
  safeOutput: Record<string, boolean>;
};

export type DwmSourcePackCollectionJobHandoff = {
  id: string;
  sourceId: string;
  candidateId: string;
  packId: string;
  requestId: string;
  family: DwmSourcePackFamily;
  sourceType: string;
  targetHash: string;
  targetPreview: string;
  targetRawStored: false;
  collectionMode: "bounded_public_preview" | "metadata_only" | "parser_readiness";
  status: "queued";
  queuedAt: string;
  parserStatus: string;
  validationScore: number;
  retry: DwmSourcePackActiveSourceRow["retry"];
  validationJobKey: string;
  policyBoundary?: Record<string, unknown>;
};

export type DwmSourcePackWorkerReadinessCounters = {
  queuedValidationJobs: number;
  validatingJobs: number;
  retryScheduledJobs: number;
  activeSourceRows: number;
  collectionReadyRows: number;
  byFamily: Record<DwmSourcePackFamily, { active: number; collectionReady: number; retryScheduled: number; failed: number; blocked: number }>;
  safeRejectedRows: number;
};

export type DwmSourcePackSourceRecordUpsertReceipt = {
  status: "inserted" | "duplicate" | "blocked";
  sourceId: string;
  candidateId: string;
  source?: SourceRecord;
  reason?: string;
};

export type DwmSourcePackSourceRecordPersistenceResult = {
  receipts: DwmSourcePackSourceRecordUpsertReceipt[];
  sources: SourceRecord[];
  summary: {
    insertedCount: number;
    duplicateCount: number;
    blockedCount: number;
    sourceRecordCount: number;
    collectionEligibleCount: number;
  };
  safeOutput: Record<string, boolean>;
};

export type DwmSourcePackSourceStore = {
  saveSource(source: SourceRecord): SourceRecord;
  getSource?(id: string): SourceRecord | undefined;
  listSources?(): SourceRecord[];
};

export type DwmSourcePackCollectionQueueReceipt = {
  status: "queued" | "duplicate" | "blocked";
  taskId: string;
  sourceId: string;
  candidateId: string;
  task?: CollectionTask;
  reason?: string;
};

export type DwmSourcePackCollectionQueueResult = {
  receipts: DwmSourcePackCollectionQueueReceipt[];
  tasks: CollectionTask[];
  summary: {
    queuedCount: number;
    duplicateCount: number;
    blockedCount: number;
    taskCount: number;
  };
  safeOutput: Record<string, boolean>;
};

export type DwmSourcePackFrontierQueue = {
  enqueueTask(task: CollectionTask): unknown;
  snapshot?(): Array<{ id?: string; task?: { id?: string } }>;
};

export type DwmSourcePackActivationResult = {
  pack: DwmSourcePackRecord;
  activeSources: DwmSourcePackActiveSourceRow[];
  blockedCandidates: Array<{ candidateId: string; state: string; reason?: string }>;
  summary: {
    activeSourceCount: number;
    blockedCandidateCount: number;
    retryScheduledCount: number;
    failedCount: number;
    disabledCount: number;
  };
  safeOutput: Record<string, boolean>;
};

export type DwmSourcePackListResult = {
  items: DwmSourcePackRecord[];
  nextCursor?: string;
  total: number;
};

export interface DwmSourcePackRegistryAdapter {
  save(pack: DwmSourcePackRecord): DwmSourcePackRecord;
  get(id: string): DwmSourcePackRecord | undefined;
  list(query?: DwmSourcePackListQuery): DwmSourcePackListResult;
}

export type DwmSourcePackPostgresRows = {
  packs: DwmSourcePackPostgresPackRow[];
  candidates: DwmSourcePackPostgresCandidateRow[];
  audit: DwmSourcePackPostgresAuditRow[];
};

export type DwmSourcePackPostgresPackRow = {
  pack_id: string;
  tenant_id?: string;
  label: string;
  scope?: string;
  request_id: string;
  requested_by: string;
  created_at: string;
  updated_at: string;
  family_coverage_json: Record<string, unknown>;
  health_rollup_json: Record<string, unknown>;
  safe_output_json: Record<string, boolean>;
};

export type DwmSourcePackPostgresCandidateRow = {
  candidate_id: string;
  pack_id: string;
  source_id?: string;
  declared_family: DwmSourcePackFamily;
  family: string;
  source_type: string;
  ref_label?: string;
  target_hash: string;
  target_preview: string;
  target_family: string;
  target_raw_stored: false;
  parser_expectation: string;
  candidate_rank: number;
  requested_by: string;
  requested_at: string;
  status: string;
  intake_status: string;
  decision?: string;
  activation_state?: string;
  decided_by?: string;
  decided_at?: string;
  reason?: string;
  duplicate_of?: string;
  failure_json?: Record<string, unknown>;
  policy_boundary_json?: Record<string, unknown>;
  validation_result_json?: Record<string, unknown>;
  parser_status?: string;
  health_status?: string;
  last_test_outcome_json?: Record<string, unknown>;
  retry_hint?: string;
};

export type DwmSourcePackPostgresAuditRow = {
  pack_id: string;
  occurred_at: string;
  action: string;
  actor?: string;
  reason?: string;
  payload_json: Record<string, unknown>;
};

export interface DwmSourcePackSqlDriver {
  upsertPack(rows: DwmSourcePackPostgresRows): void;
  getPack(packId: string): DwmSourcePackPostgresRows | undefined;
  listPacks(query: DwmSourcePackListQuery): { rows: DwmSourcePackPostgresRows[]; total: number; nextCursor?: string };
}

export class DwmSourcePackPostgresAdapter implements DwmSourcePackRegistryAdapter {
  constructor(private readonly driver: DwmSourcePackSqlDriver) {}

  save(pack: DwmSourcePackRecord): DwmSourcePackRecord {
    assertSafePackRecord(pack);
    this.driver.upsertPack(sourcePackRecordToPostgresRows(pack));
    return this.get(pack.id) ?? pack;
  }

  get(id: string): DwmSourcePackRecord | undefined {
    const rows = this.driver.getPack(id);
    return rows ? sourcePackRecordFromPostgresRows(rows) : undefined;
  }

  list(query: DwmSourcePackListQuery = {}): DwmSourcePackListResult {
    const result = this.driver.listPacks(query);
    return { items: result.rows.map(sourcePackRecordFromPostgresRows), total: result.total, nextCursor: result.nextCursor };
  }
}

export class InMemoryDwmSourcePackRegistryAdapter implements DwmSourcePackRegistryAdapter {
  private readonly packs = new Map<string, DwmSourcePackRecord>();

  constructor(seed: DwmSourcePackRecord[] = []) {
    for (const pack of seed) this.save(pack);
  }

  save(pack: DwmSourcePackRecord): DwmSourcePackRecord {
    assertSafePackRecord(pack);
    const previous = this.packs.get(pack.id);
    const next = previous ? {
      ...previous,
      ...clone(pack),
      candidates: dedupeCandidates([...previous.candidates, ...pack.candidates]),
      audit: [...previous.audit, ...pack.audit].sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")))
    } : clone(pack);
    this.packs.set(next.id, next);
    return clone(next);
  }

  get(id: string): DwmSourcePackRecord | undefined {
    const pack = this.packs.get(id);
    return pack ? clone(pack) : undefined;
  }

  list(query: DwmSourcePackListQuery = {}): DwmSourcePackListResult {
    const limit = Math.max(1, Math.min(query.limit ?? 100, 500));
    const offset = Math.max(0, Number.parseInt(query.cursor ?? "0", 10) || 0);
    const filtered = [...this.packs.values()]
      .filter((pack) => matchesPackQuery(pack, query))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const page = filtered.slice(offset, offset + limit).map((pack) => clone(pack));
    const nextOffset = offset + page.length;
    return { items: page, nextCursor: nextOffset < filtered.length ? String(nextOffset) : undefined, total: filtered.length };
  }
}

export class InMemoryDwmSourcePackValidationQueueAdapter implements DwmSourcePackValidationQueueAdapter {
  private readonly records = new Map<string, DwmSourcePackValidationQueueRecord>();

  enqueue(record: DwmSourcePackValidationQueueRecord): DwmSourcePackValidationQueueReceipt {
    assertSafeValidationQueueRecord(record);
    const previous = this.records.get(record.jobKey);
    if (previous) return { status: "duplicate", jobKey: record.jobKey, record: clone(previous) };
    this.records.set(record.jobKey, clone(record));
    return { status: "enqueued", jobKey: record.jobKey, record: clone(record) };
  }

  get(jobKey: string): DwmSourcePackValidationQueueRecord | undefined {
    const record = this.records.get(jobKey);
    return record ? clone(record) : undefined;
  }

  list(): DwmSourcePackValidationQueueRecord[] {
    return [...this.records.values()].map((record) => clone(record)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  transition(jobKey: string, status: DwmSourcePackValidationState, patch: Partial<DwmSourcePackValidationQueueRecord> = {}): DwmSourcePackValidationQueueRecord {
    const previous = this.records.get(jobKey);
    if (!previous) throw new Error(`Unknown validation job ${jobKey}`);
    const next = { ...previous, ...clone(patch), jobKey, status, job: { ...previous.job, ...patch.job, status }, updatedAt: patch.updatedAt ?? previous.updatedAt };
    assertSafeValidationQueueRecord(next);
    this.records.set(jobKey, next);
    return clone(next);
  }
}

export class InMemoryDwmSourcePackActiveSourceAdapter implements DwmSourcePackActiveSourceAdapter {
  private readonly rows = new Map<string, DwmSourcePackActiveSourceRow>();

  upsert(row: DwmSourcePackActiveSourceRow): DwmSourcePackActiveSourceUpsertReceipt {
    assertSafeActiveSourceRow(row);
    const previous = this.rows.get(row.sourceId);
    if (previous) return { status: "duplicate", sourceId: row.sourceId, candidateId: row.candidateId, row: clone(previous) };
    this.rows.set(row.sourceId, clone(row));
    return { status: "inserted", sourceId: row.sourceId, candidateId: row.candidateId, row: clone(row) };
  }

  get(sourceId: string): DwmSourcePackActiveSourceRow | undefined {
    const row = this.rows.get(sourceId);
    return row ? clone(row) : undefined;
  }

  list(): DwmSourcePackActiveSourceRow[] {
    return [...this.rows.values()].map((row) => clone(row)).sort((a, b) => a.activatedAt.localeCompare(b.activatedAt) || a.sourceId.localeCompare(b.sourceId));
  }
}

export function buildDwmSourcePackPersistenceShape() {
  return {
    schemaVersion: "ti.dwm_source_pack_registry.v1",
    tables: {
      dwm_source_packs: [
        "pack_id",
        "tenant_id",
        "label",
        "request_id",
        "requested_by",
        "created_at",
        "updated_at",
        "family_coverage_json",
        "health_rollup_json",
        "safe_output_json"
      ],
      dwm_source_pack_candidates: [
        "candidate_id",
        "pack_id",
        "source_id",
        "declared_family",
        "target_hash",
        "target_preview",
        "target_raw_stored",
        "parser_expectation",
        "decision",
        "activation_state",
        "parser_status",
        "health_status",
        "failure_json",
        "policy_boundary_json",
        "retry_hint",
        "created_at",
        "updated_at"
      ]
    },
    indexes: [
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_dwm_source_packs_pack_id ON dwm_source_packs(pack_id)",
      "CREATE INDEX IF NOT EXISTS idx_dwm_source_packs_label_created ON dwm_source_packs(label, created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_dwm_source_packs_request_id ON dwm_source_packs(request_id)",
      "CREATE INDEX IF NOT EXISTS idx_dwm_source_pack_candidates_family ON dwm_source_pack_candidates(declared_family)",
      "CREATE INDEX IF NOT EXISTS idx_dwm_source_pack_candidates_decision ON dwm_source_pack_candidates(decision)",
      "CREATE INDEX IF NOT EXISTS idx_dwm_source_pack_candidates_activation ON dwm_source_pack_candidates(activation_state)",
      "CREATE INDEX IF NOT EXISTS idx_dwm_source_pack_candidates_parser ON dwm_source_pack_candidates(parser_status)",
      "CREATE INDEX IF NOT EXISTS idx_dwm_source_pack_candidates_failure ON dwm_source_pack_candidates((failure_json->>'code'))"
    ],
    sql: buildDwmSourcePackRegistrySql(),
    guardrails: [
      "target_raw_stored must remain false",
      "raw payload, capture body, credential, and downloaded leak rows are not pack registry columns",
      "collection remains controlled by source promotion and frontier queue contracts"
    ]
  };
}

export function buildDwmSourcePackWorkerIntegrationShape() {
  return {
    schemaVersion: "ti.dwm_source_pack_worker_integration.v1",
    tables: {
      dwm_source_pack_validation_jobs: [
        "job_key",
        "pack_ids_json",
        "request_ids_json",
        "status",
        "candidate_ids_json",
        "family_concurrency_json",
        "retry_json",
        "safe_rejected_rows_json",
        "job_json",
        "created_at",
        "updated_at"
      ],
      dwm_source_pack_active_source_rows: [
        "source_id",
        "candidate_id",
        "pack_id",
        "request_id",
        "declared_family",
        "source_type",
        "target_hash",
        "target_preview",
        "target_raw_stored",
        "parser_status",
        "validation_score",
        "retry_json",
        "policy_boundary_json",
        "activation_state",
        "activated_at",
        "validation_job_key"
      ]
    },
    indexes: [
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_dwm_source_pack_validation_jobs_key ON dwm_source_pack_validation_jobs(job_key)",
      "CREATE INDEX IF NOT EXISTS idx_dwm_source_pack_validation_jobs_status ON dwm_source_pack_validation_jobs(status, updated_at)",
      "CREATE INDEX IF NOT EXISTS idx_dwm_source_pack_validation_jobs_pack ON dwm_source_pack_validation_jobs USING GIN(pack_ids_json)",
      "CREATE INDEX IF NOT EXISTS idx_dwm_source_pack_active_source_rows_candidate ON dwm_source_pack_active_source_rows(candidate_id)"
    ],
    guardrails: [
      "job_key is the idempotency key and must be unique",
      "target_raw_stored must remain false for active source rows",
      "worker tests must use validator fixtures rather than live network probes",
      "restricted sources can only activate into metadata_only_active rows"
    ],
    safeOutput: sourcePackSafeOutput()
  };
}

export function sourcePackRecordToPostgresRows(pack: DwmSourcePackRecord): DwmSourcePackPostgresRows {
  assertSafePackRecord(pack);
  return {
    packs: [{
      pack_id: pack.id,
      tenant_id: pack.tenantId,
      label: pack.label,
      scope: pack.scope,
      request_id: pack.requestId,
      requested_by: pack.requestedBy,
      created_at: pack.requestedAt,
      updated_at: pack.updatedAt,
      family_coverage_json: pack.familyCoverage ?? {},
      health_rollup_json: pack.healthRollup ?? {},
      safe_output_json: pack.safeOutput
    }],
    candidates: pack.candidates.map((candidate) => ({
      candidate_id: candidate.id,
      pack_id: pack.id,
      source_id: candidate.sourceId,
      declared_family: candidate.declaredFamily,
      family: candidate.family,
      source_type: candidate.type,
      ref_label: candidate.refLabel,
      target_hash: candidate.targetRef.hash,
      target_preview: candidate.targetRef.preview,
      target_family: candidate.targetRef.family,
      target_raw_stored: false,
      parser_expectation: candidate.parserExpectation,
      candidate_rank: candidate.index,
      requested_by: candidate.requestedBy,
      requested_at: candidate.requestedAt,
      status: candidate.status,
      intake_status: candidate.intakeStatus,
      decision: candidate.decision,
      activation_state: candidate.activationState,
      decided_by: candidate.decidedBy,
      decided_at: candidate.decidedAt,
      reason: candidate.reason,
      duplicate_of: candidate.duplicateOf,
      failure_json: candidate.failure,
      policy_boundary_json: candidate.policyBoundary,
      validation_result_json: candidate.validationResult,
      parser_status: candidate.parserStatus,
      health_status: candidate.healthStatus,
      last_test_outcome_json: candidate.lastTestOutcome,
      retry_hint: candidate.retryHint
    })),
    audit: pack.audit.map((event) => ({
      pack_id: pack.id,
      occurred_at: String(event.at ?? pack.updatedAt),
      action: String(event.action ?? "unknown"),
      actor: event.actor ? String(event.actor) : undefined,
      reason: event.reason ? String(event.reason) : undefined,
      payload_json: event
    }))
  };
}

export function sourcePackRecordFromPostgresRows(rows: DwmSourcePackPostgresRows): DwmSourcePackRecord {
  const pack = rows.packs[0];
  if (!pack) throw new Error("Missing source pack row");
  return {
    id: pack.pack_id,
    label: pack.label,
    tenantId: pack.tenant_id,
    scope: pack.scope,
    requestedBy: pack.requested_by,
    requestedAt: pack.created_at,
    updatedAt: pack.updated_at,
    requestId: pack.request_id,
    familyCoverage: pack.family_coverage_json,
    healthRollup: pack.health_rollup_json,
    safeOutput: pack.safe_output_json,
    candidates: rows.candidates.map((candidate) => ({
      id: candidate.candidate_id,
      sourceId: candidate.source_id,
      family: candidate.family,
      declaredFamily: candidate.declared_family,
      type: candidate.source_type,
      refLabel: candidate.ref_label,
      parserExpectation: candidate.parser_expectation,
      index: candidate.candidate_rank,
      targetRef: {
        hash: candidate.target_hash,
        preview: candidate.target_preview,
        family: candidate.target_family,
        rawStored: false as const
      },
      requestedBy: candidate.requested_by,
      requestedAt: candidate.requested_at,
      status: candidate.status,
      intakeStatus: candidate.intake_status,
      decision: candidate.decision,
      activationState: candidate.activation_state,
      decidedBy: candidate.decided_by,
      decidedAt: candidate.decided_at,
      reason: candidate.reason,
      duplicateOf: candidate.duplicate_of,
      failure: candidate.failure_json,
      policyBoundary: candidate.policy_boundary_json,
      validationResult: candidate.validation_result_json,
      parserStatus: candidate.parser_status,
      healthStatus: candidate.health_status,
      lastTestOutcome: candidate.last_test_outcome_json,
      retryHint: candidate.retry_hint
    })).sort((a, b) => a.index - b.index),
    audit: rows.audit.map((event) => ({
      ...event.payload_json,
      at: event.occurred_at,
      action: event.action,
      actor: event.actor,
      reason: event.reason
    })).sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")))
  };
}

export function planDwmSourcePackBulkImport(packs: DwmSourcePackRecord[], policy: DwmSourcePackBulkImportPolicy = {}): DwmSourcePackBulkImportPlan {
  const maxPackSize = Math.max(1, Math.min(policy.maxPackSize ?? 250, 1000));
  const chunkSize = Math.max(1, Math.min(policy.chunkSize ?? 25, maxPackSize));
  const duplicatePackIdBehavior = policy.duplicatePackId ?? "merge";
  const perFamilyCaps = policy.perFamilyCaps ?? {};
  const seen = new Set<string>();
  const acceptedPacks: DwmSourcePackRecord[] = [];
  const rejectedPacks: DwmSourcePackBulkImportPlan["rejectedPacks"] = [];

  for (const pack of packs) {
    const safeCandidateRefs = pack.candidates.map((candidate) => candidate.targetRef);
    try {
      assertSafePackRecord(pack);
      if (pack.candidates.length > maxPackSize) throw new Error(`pack exceeds maxPackSize ${maxPackSize}`);
      if (seen.has(pack.id) && duplicatePackIdBehavior === "reject") throw new Error("duplicate pack id rejected by policy");
      for (const [family, cap] of Object.entries(perFamilyCaps)) {
        const count = pack.candidates.filter((candidate) => candidate.declaredFamily === family).length;
        if (cap !== undefined && count > cap) throw new Error(`family cap exceeded for ${family}: ${count}/${cap}`);
      }
      seen.add(pack.id);
      acceptedPacks.push(clone(pack));
    } catch (error) {
      rejectedPacks.push({
        packId: pack.id,
        label: pack.label,
        reason: error instanceof Error ? error.message : String(error),
        safeCandidateRefs
      });
    }
  }

  const chunks: DwmSourcePackBulkImportPlan["chunks"] = [];
  for (let index = 0; index < acceptedPacks.length; index += chunkSize) {
    const chunk = acceptedPacks.slice(index, index + chunkSize);
    chunks.push({
      cursor: String(index),
      nextCursor: index + chunk.length < acceptedPacks.length ? String(index + chunk.length) : undefined,
      packIds: chunk.map((pack) => pack.id)
    });
  }

  return {
    acceptedPacks,
    rejectedPacks,
    chunks,
    summary: {
      requestedPackCount: packs.length,
      acceptedPackCount: acceptedPacks.length,
      rejectedPackCount: rejectedPacks.length,
      maxPackSize,
      chunkSize,
      duplicatePackIdBehavior,
      perFamilyCaps
    },
    safeOutput: sourcePackSafeOutput()
  };
}

export function planDwmSourcePackValidationBatch(
  packs: DwmSourcePackRecord[],
  options: {
    chunkSize?: number;
    generatedAt?: string;
    maxAttempts?: number;
    backoffSeconds?: number;
    perFamilyConcurrency?: Partial<Record<DwmSourcePackFamily, number>>;
  } = {}
): DwmSourcePackValidationBatchPlan {
  const generatedAt = options.generatedAt ?? "2026-06-28T00:00:00.000Z";
  const chunkSize = Math.max(1, Math.min(options.chunkSize ?? 250, 1000));
  const perFamilyConcurrency = options.perFamilyConcurrency ?? {};
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const backoffSeconds = Math.max(1, options.backoffSeconds ?? 300);
  const candidates = packs.flatMap((pack) => pack.candidates.map((candidate) => ({ packId: pack.id, candidate })));
  const duplicateTargetRefs = findDuplicateTargetRefs(candidates.map((item) => item.candidate));
  const duplicateIds = new Set(duplicateTargetRefs.flatMap((item) => item.candidateIds.slice(1)));
  const safeRejectedRows = candidates
    .filter((item) => duplicateIds.has(item.candidate.id))
    .map((item) => ({
      candidateId: item.candidate.id,
      targetRef: item.candidate.targetRef,
      reason: "duplicate_target_ref"
    }));
  const jobs: DwmSourcePackValidationJob[] = [];

  for (let index = 0; index < candidates.length; index += chunkSize) {
    const chunk = candidates.slice(index, index + chunkSize);
    const candidateIds = chunk.map((item) => item.candidate.id);
    const chunkDuplicateRows = safeRejectedRows.filter((row) => candidateIds.includes(row.candidateId));
    jobs.push({
      id: `source_pack_validation_${index}`,
      packIds: [...new Set(chunk.map((item) => item.packId))],
      status: "queued",
      cursor: String(index),
      nextCursor: index + chunk.length < candidates.length ? String(index + chunk.length) : undefined,
      candidateIds,
      familyConcurrency: perFamilyConcurrency,
      parserStatus: Object.fromEntries(candidateIds.map((candidateId) => [candidateId, "queued_for_validation"])),
      retry: { attempt: 0, maxAttempts, backoffSeconds },
      duplicateTargetRefs,
      safeRejectedRows: chunkDuplicateRows,
      createdAt: generatedAt,
      updatedAt: generatedAt
    });
  }

  return {
    jobs,
    duplicateTargetRefs,
    safeRejectedRows,
    summary: {
      packCount: packs.length,
      candidateCount: candidates.length,
      jobCount: jobs.length,
      chunkSize,
      duplicateCandidateCount: duplicateIds.size,
      perFamilyConcurrency
    },
    safeOutput: sourcePackSafeOutput()
  };
}

export function runDwmSourcePackValidationJob(
  job: DwmSourcePackValidationJob,
  packs: DwmSourcePackRecord | DwmSourcePackRecord[],
  validator: (candidate: DwmSourcePackCandidateRecord, job: DwmSourcePackValidationJob) => DwmSourceCandidateValidationResult,
  options: { generatedAt?: string } = {}
) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const selectedCandidates = (Array.isArray(packs) ? packs : [packs])
    .flatMap((pack) => pack.candidates)
    .filter((candidate) => job.candidateIds.includes(candidate.id));
  const started: DwmSourcePackValidationJob = { ...clone(job), status: "validating", updatedAt: generatedAt };
  const results = selectedCandidates.map((candidate) => validator(candidate, started));
  const finalStatus = validationStatusFromResults(results);
  const failure = results.find((result) => result.failure)?.failure;
  const failedCandidate = results.find((result) => result.failure)?.candidateId;
  const retry = finalStatus === "retry_scheduled" ? {
    ...started.retry,
    attempt: started.retry.attempt + 1,
    retryAfter: new Date(Date.parse(generatedAt) + started.retry.backoffSeconds * 1000).toISOString()
  } : started.retry;

  return {
    started,
    results,
    job: {
      ...started,
      status: finalStatus,
      parserStatus: Object.fromEntries(results.map((result) => [result.candidateId, result.parserStatus])),
      lastFailure: failure ? { candidateId: failedCandidate, code: failure.code, message: failure.message, at: generatedAt } : undefined,
      retry,
      updatedAt: generatedAt
    } satisfies DwmSourcePackValidationJob,
    safeOutput: sourcePackSafeOutput()
  };
}

export function sourcePackHealthRollup(
  pack: DwmSourcePackRecord,
  options: { generatedAt?: string; staleAfterSeconds?: number } = {}
): DwmSourcePackHealthRollup {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const generatedMs = Date.parse(generatedAt);
  const staleAfterSeconds = Math.max(1, options.staleAfterSeconds ?? 86400);
  const coverage = emptyFamilyCoverage();
  const staleSources: DwmSourcePackHealthRollup["staleSources"] = [];
  const parserFailures: DwmSourcePackHealthRollup["parserFailures"] = [];
  const activationLag: DwmSourcePackHealthRollup["activationLag"] = [];
  const nextRetryWindows: DwmSourcePackHealthRollup["nextRetryWindows"] = [];

  for (const candidate of pack.candidates) {
    const family = coverage[candidate.declaredFamily];
    const active = candidate.status === "active" || candidate.activationState === "active_canary" || candidate.decision === "approved";
    family.total += 1;
    if (active) {
      family.active += 1;
    } else if (candidate.status === "disabled" || candidate.decision === "suppressed") {
      family.disabled += 1;
    } else if (candidate.status === "failed" || candidate.status === "retry_scheduled" || candidate.failure) {
      family.failed += 1;
    } else {
      family.pending += 1;
    }

    const lastCaptureAt = String(candidate.lastTestOutcome?.captureAt ?? candidate.lastTestOutcome?.lastCaptureAt ?? "");
    if (active && (lastCaptureAt === "" || generatedMs - Date.parse(lastCaptureAt) > staleAfterSeconds * 1000)) {
      staleSources.push({
        candidateId: candidate.id,
        lastCaptureAt: lastCaptureAt || undefined,
        staleSeconds: lastCaptureAt ? Math.floor((generatedMs - Date.parse(lastCaptureAt)) / 1000) : staleAfterSeconds
      });
    }

    if (candidate.failure || candidate.parserStatus?.includes("failed") || candidate.parserStatus?.includes("retry")) {
      parserFailures.push({ candidateId: candidate.id, parserStatus: candidate.parserStatus, failure: candidate.failure });
    }
    if (!["active", "disabled", "failed", "retry_scheduled"].includes(candidate.status) && candidate.decision !== "suppressed") {
      activationLag.push({
        candidateId: candidate.id,
        requestedAt: candidate.requestedAt,
        pendingSeconds: Math.max(0, Math.floor((generatedMs - Date.parse(candidate.requestedAt)) / 1000)),
        status: candidate.status
      });
    }
    if (candidate.retryHint || candidate.status === "retry_scheduled") {
      nextRetryWindows.push({
        candidateId: candidate.id,
        retryAfter: candidate.retryHint?.match(/\d{4}-\d{2}-\d{2}T[0-9:.]+Z/)?.[0],
        retryHint: candidate.retryHint,
        failure: candidate.failure
      });
    }
  }

  return { coverage, staleSources, parserFailures, activationLag, nextRetryWindows };
}

export function sourcePackValidationJobKey(job: DwmSourcePackValidationJob, requestIds: string[] = []): string {
  return [
    "dwm_source_pack_validation",
    [...job.packIds].sort().join("+"),
    [...requestIds].sort().join("+"),
    job.cursor,
    job.candidateIds.join("+")
  ].join(":");
}

export function enqueueDwmSourcePackValidationJobs(
  adapter: DwmSourcePackValidationQueueAdapter,
  packs: DwmSourcePackRecord[],
  plan: DwmSourcePackValidationBatchPlan,
  options: { generatedAt?: string } = {}
) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const packById = new Map(packs.map((pack) => [pack.id, pack]));
  const receipts = plan.jobs.map((job) => {
    const requestIds = job.packIds.map((packId) => packById.get(packId)?.requestId).filter((requestId): requestId is string => Boolean(requestId));
    const record: DwmSourcePackValidationQueueRecord = {
      jobKey: sourcePackValidationJobKey(job, requestIds),
      job,
      packIds: job.packIds,
      requestIds,
      status: job.status,
      candidateIds: job.candidateIds,
      familyConcurrency: job.familyConcurrency,
      retry: job.retry,
      safeRejectedRows: job.safeRejectedRows,
      createdAt: generatedAt,
      updatedAt: generatedAt
    };
    return adapter.enqueue(record);
  });

  return {
    receipts,
    summary: {
      enqueuedCount: receipts.filter((receipt) => receipt.status === "enqueued").length,
      duplicateCount: receipts.filter((receipt) => receipt.status === "duplicate").length,
      jobCount: receipts.length,
      candidateCount: plan.summary.candidateCount,
      safeRejectedRowCount: plan.safeRejectedRows.length
    },
    safeOutput: sourcePackSafeOutput()
  };
}

export function applyDwmSourcePackValidationResults(
  pack: DwmSourcePackRecord,
  job: DwmSourcePackValidationQueueRecord | DwmSourcePackValidationJob,
  results: DwmSourceCandidateValidationResult[],
  options: { generatedAt?: string; actor?: string } = {}
): DwmSourcePackActivationResult {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const jobRecord = "job" in job ? job : undefined;
  const validationJob = "job" in job ? job.job : job;
  const jobKey = jobRecord?.jobKey ?? sourcePackValidationJobKey(validationJob, [pack.requestId]);
  const resultByCandidate = new Map(results.map((result) => [result.candidateId, result]));
  const activeSources: DwmSourcePackActiveSourceRow[] = [];
  const blockedCandidates: DwmSourcePackActivationResult["blockedCandidates"] = [];
  const counters = { retryScheduledCount: 0, failedCount: 0, disabledCount: 0 };

  const candidates = pack.candidates.map((candidate) => {
    const result = resultByCandidate.get(candidate.id);
    if (!result || !validationJob.candidateIds.includes(candidate.id)) return clone(candidate);
    const validationResult = { state: result.state, parserStatus: result.parserStatus, validatedAt: generatedAt, validationJobKey: jobKey };
    if (result.state === "active") {
      if (isRestrictedFamily(candidate.declaredFamily) && candidate.policyBoundary?.metadataOnly !== true) {
        const failure = { code: "metadata_only_policy_required", message: "Restricted source candidate requires metadataOnly policy boundary before activation" };
        counters.failedCount += 1;
        blockedCandidates.push({ candidateId: candidate.id, state: "failed", reason: failure.message });
        return {
          ...clone(candidate),
          status: "approval_required",
          decision: "metadata_only_approval_required",
          parserStatus: result.parserStatus,
          failure,
          validationResult: { ...validationResult, state: "failed", failure }
        };
      }
      const sourceId = candidate.sourceId ?? `src_${candidate.id}`;
      activeSources.push(activeSourceRowForCandidate(pack, candidate, {
        sourceId,
        parserStatus: result.parserStatus,
        validationScore: result.validationScore ?? validationScoreForResult(result),
        retry: validationJob.retry,
        validationJobKey: jobKey,
        activatedAt: generatedAt
      }));
      return {
        ...clone(candidate),
        sourceId,
        status: "active",
        decision: "approved",
        activationState: candidate.declaredFamily === "darkweb_onion" || candidate.declaredFamily === "darkweb_metadata" ? "metadata_only_active" : "active_canary",
        parserStatus: result.parserStatus,
        healthStatus: "validated",
        validationResult
      };
    }
    if (result.state === "retry_scheduled") {
      counters.retryScheduledCount += 1;
      blockedCandidates.push({ candidateId: candidate.id, state: result.state, reason: result.failure?.message });
      return {
        ...clone(candidate),
        status: "retry_scheduled",
        decision: "retry_scheduled",
        parserStatus: result.parserStatus,
        failure: result.failure,
        retryHint: result.failure ? `retry after backoff: ${result.failure.code}` : candidate.retryHint,
        validationResult
      };
    }
    if (result.state === "disabled") {
      counters.disabledCount += 1;
      blockedCandidates.push({ candidateId: candidate.id, state: result.state, reason: result.failure?.message ?? "validator disabled source" });
      return {
        ...clone(candidate),
        status: "disabled",
        decision: "suppressed",
        parserStatus: result.parserStatus,
        failure: result.failure,
        validationResult
      };
    }
    counters.failedCount += 1;
    blockedCandidates.push({ candidateId: candidate.id, state: result.state, reason: result.failure?.message ?? "validation failed" });
    return {
      ...clone(candidate),
      status: "failed",
      decision: "validation_failed",
      parserStatus: result.parserStatus,
      failure: result.failure,
      validationResult
    };
  });

  const nextPack = {
    ...clone(pack),
    updatedAt: generatedAt,
    candidates,
    audit: [
      ...pack.audit,
      {
        at: generatedAt,
        action: "source_pack_validation_applied",
        actor: options.actor ?? "source-pack-worker",
        jobKey,
        activeSourceCount: activeSources.length,
        blockedCandidateCount: blockedCandidates.length
      }
    ]
  };

  assertSafePackRecord(nextPack);
  return {
    pack: nextPack,
    activeSources,
    blockedCandidates,
    summary: {
      activeSourceCount: activeSources.length,
      blockedCandidateCount: blockedCandidates.length,
      retryScheduledCount: counters.retryScheduledCount,
      failedCount: counters.failedCount,
      disabledCount: counters.disabledCount
    },
    safeOutput: sourcePackSafeOutput()
  };
}

export function persistDwmSourcePackActiveSources(
  adapter: DwmSourcePackActiveSourceAdapter,
  activation: DwmSourcePackActivationResult,
  options: { perFamilyCaps?: Partial<Record<DwmSourcePackFamily, number>> } = {}
): DwmSourcePackActiveSourcePersistenceResult {
  const currentByFamily = countRowsByFamily(adapter.list());
  const receipts: DwmSourcePackActiveSourceUpsertReceipt[] = [];
  for (const row of activation.activeSources) {
    if (adapter.get(row.sourceId)) {
      receipts.push(adapter.upsert(row));
      continue;
    }
    const cap = options.perFamilyCaps?.[row.family];
    if (cap !== undefined && (currentByFamily[row.family] ?? 0) >= cap) {
      receipts.push({ status: "skipped", sourceId: row.sourceId, candidateId: row.candidateId, reason: `family cap reached for ${row.family}: ${cap}` });
      continue;
    }
    const receipt = adapter.upsert(row);
    receipts.push(receipt);
    if (receipt.status === "inserted") currentByFamily[row.family] = (currentByFamily[row.family] ?? 0) + 1;
  }
  const activeRows = adapter.list();
  return {
    receipts,
    summary: {
      insertedCount: receipts.filter((receipt) => receipt.status === "inserted").length,
      duplicateCount: receipts.filter((receipt) => receipt.status === "duplicate").length,
      skippedCount: receipts.filter((receipt) => receipt.status === "skipped").length,
      activeSourceCount: activeRows.length,
      collectionReadyCount: activeRows.filter((row) => row.alertGradeEvidenceEligible).length
    },
    safeOutput: sourcePackSafeOutput()
  };
}

export function buildDwmSourcePackCollectionJobHandoff(
  rows: DwmSourcePackActiveSourceRow[],
  options: { generatedAt?: string } = {}
): { jobs: DwmSourcePackCollectionJobHandoff[]; safeOutput: Record<string, boolean> } {
  const queuedAt = options.generatedAt ?? new Date().toISOString();
  return {
    jobs: rows.filter((row) => row.alertGradeEvidenceEligible).map((row) => ({
      id: `dwm_source_pack_collection:${row.validationJobKey}:${row.sourceId}`,
      sourceId: row.sourceId,
      candidateId: row.candidateId,
      packId: row.packId,
      requestId: row.requestId,
      family: row.family,
      sourceType: row.sourceType,
      targetHash: row.targetHash,
      targetPreview: row.targetPreview,
      targetRawStored: false,
      collectionMode: collectionModeForActiveSource(row),
      status: "queued",
      queuedAt,
      parserStatus: row.parserStatus,
      validationScore: row.validationScore,
      retry: row.retry,
      validationJobKey: row.validationJobKey,
      policyBoundary: row.policyBoundary
    })),
    safeOutput: sourcePackSafeOutput()
  };
}

export function sourcePackWorkerReadinessCounters(
  packs: DwmSourcePackRecord[],
  queueRecords: DwmSourcePackValidationQueueRecord[],
  activeRows: DwmSourcePackActiveSourceRow[]
): DwmSourcePackWorkerReadinessCounters {
  const byFamily = emptyWorkerFamilyCounters();
  for (const row of activeRows) {
    byFamily[row.family].active += 1;
    if (row.alertGradeEvidenceEligible) byFamily[row.family].collectionReady += 1;
  }
  for (const pack of packs) {
    for (const candidate of pack.candidates) {
      if (candidate.status === "retry_scheduled") byFamily[candidate.declaredFamily].retryScheduled += 1;
      if (candidate.status === "failed" || candidate.failure) byFamily[candidate.declaredFamily].failed += 1;
      if (candidate.status === "approval_required" || candidate.status === "disabled" || candidate.decision === "suppressed") byFamily[candidate.declaredFamily].blocked += 1;
    }
  }
  return {
    queuedValidationJobs: queueRecords.filter((record) => record.status === "queued").length,
    validatingJobs: queueRecords.filter((record) => record.status === "validating").length,
    retryScheduledJobs: queueRecords.filter((record) => record.status === "retry_scheduled").length,
    activeSourceRows: activeRows.length,
    collectionReadyRows: activeRows.filter((row) => row.alertGradeEvidenceEligible).length,
    byFamily,
    safeRejectedRows: queueRecords.reduce((total, record) => total + record.safeRejectedRows.length, 0)
  };
}

export function sourceRecordFromDwmSourcePackActiveRow(
  row: DwmSourcePackActiveSourceRow,
  options: { tenantId?: string; generatedAt?: string; approvedBy?: string } = {}
): SourceRecord {
  assertSafeActiveSourceRow(row);
  const generatedAt = options.generatedAt ?? row.activatedAt;
  const metadataOnly = isRestrictedFamily(row.family);
  return {
    id: row.sourceId,
    tenantId: options.tenantId,
    name: sourceNameForActiveRow(row),
    type: sourceTypeForActiveRow(row),
    url: safeSourceUrlForActiveRow(row),
    accessMethod: metadataOnly ? "approved_proxy" : row.family === "telegram" ? "official_api" : "public_http",
    status: "active",
    risk: metadataOnly ? "restricted" : row.family === "telegram" ? "medium" : "low",
    trustScore: clamp01(row.validationScore),
    language: "unknown",
    crawlFrequencySeconds: sourceCrawlFrequencyForActiveRow(row),
    legalNotes: metadataOnly
      ? "Metadata-only source-pack activation. Raw payload download, credential access, and private interaction remain disabled."
      : "Source-pack activation validated for bounded public collection. No private access or credential use.",
    approvedAt: generatedAt,
    approvedBy: options.approvedBy ?? "source-pack-worker",
    governance: {
      approvalRequired: true,
      approvalState: "approved",
      metadataOnly,
      approvedAt: generatedAt,
      approvedBy: options.approvedBy ?? "source-pack-worker",
      policyVersion: "source-pack-worker:v1",
      riskJustification: metadataOnly ? "restricted source metadata-only onboarding" : "validated source-pack onboarding"
    },
    health: {
      status: "not_collected",
      lastCheckedAt: generatedAt,
      errorRate: 0,
      consecutiveFailures: 0,
      parserStatus: row.parserStatus
    },
    scoring: {
      reliability: clamp01(row.validationScore),
      freshness: 0.5,
      relevance: clamp01(row.validationScore),
      uniqueness: 0.5,
      parseability: row.parserStatus.includes("ready") ? 0.9 : 0.5,
      policyRiskPenalty: metadataOnly ? 0.4 : 0,
      operatorBoost: 0
    },
    crawlState: {
      nextEligibleAt: row.retry.retryAfter,
      retryCount: row.retry.attempt
    },
    tags: [row.family, row.packId, row.requestId],
    metadata: {
      sourcePack: {
        packId: row.packId,
        requestId: row.requestId,
        candidateId: row.candidateId,
        validationJobKey: row.validationJobKey,
        validationScore: row.validationScore,
        activationState: row.activationState,
        parserStatus: row.parserStatus,
        targetHash: row.targetHash,
        targetPreview: row.targetPreview,
        targetRawStored: false,
        collectionMode: collectionModeForActiveSource(row),
        alertGradeEvidenceEligible: row.alertGradeEvidenceEligible
      },
      policyBoundary: row.policyBoundary,
      sourceFamily: row.family
    },
    lifecycle: [{
      at: generatedAt,
      from: "candidate",
      to: "active",
      reason: "source-pack validation promoted candidate to durable source record",
      actorId: options.approvedBy ?? "source-pack-worker"
    }],
    createdAt: generatedAt,
    updatedAt: generatedAt
  } as SourceRecord;
}

export function persistDwmSourcePackSourceRecords(
  store: DwmSourcePackSourceStore,
  activeRows: DwmSourcePackActiveSourceRow[],
  options: { tenantId?: string; generatedAt?: string; approvedBy?: string; updateExisting?: boolean } = {}
): DwmSourcePackSourceRecordPersistenceResult {
  const receipts: DwmSourcePackSourceRecordUpsertReceipt[] = [];
  const sources: SourceRecord[] = [];
  for (const row of activeRows) {
    try {
      const source = sourceRecordFromDwmSourcePackActiveRow(row, options);
      const existing = store.getSource?.(source.id) ?? store.listSources?.().find((item) => item.id === source.id);
      if (existing) {
        const saved = options.updateExisting ? store.saveSource(mergeSourcePackActiveSourceRecord(existing, source)) : existing;
        receipts.push({
          status: "duplicate",
          sourceId: source.id,
          candidateId: row.candidateId,
          source: saved,
          reason: options.updateExisting ? "existing_source_record_upserted" : undefined
        });
        sources.push(saved);
        continue;
      }
      const saved = store.saveSource(source);
      receipts.push({ status: "inserted", sourceId: source.id, candidateId: row.candidateId, source: saved });
      sources.push(saved);
    } catch (error) {
      receipts.push({
        status: "blocked",
        sourceId: row.sourceId,
        candidateId: row.candidateId,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return {
    receipts,
    sources,
    summary: {
      insertedCount: receipts.filter((receipt) => receipt.status === "inserted").length,
      duplicateCount: receipts.filter((receipt) => receipt.status === "duplicate").length,
      blockedCount: receipts.filter((receipt) => receipt.status === "blocked").length,
      sourceRecordCount: store.listSources?.().length ?? sources.length,
      collectionEligibleCount: sources.filter((source) => source.metadata?.sourcePack?.alertGradeEvidenceEligible === true).length
    },
    safeOutput: sourcePackSafeOutput()
  };
}

function mergeSourcePackActiveSourceRecord(existing: SourceRecord, source: SourceRecord): SourceRecord {
  const sourcePack = source.metadata?.sourcePack ?? {};
  const existingCandidate = existing.metadata?.sourceCandidate ?? {};
  return {
    ...existing,
    ...source,
    id: existing.id,
    name: existing.name ?? source.name,
    type: existing.type ?? source.type,
    url: existing.url ?? source.url,
    createdAt: existing.createdAt ?? source.createdAt,
    metadata: {
      ...(existing.metadata ?? {}),
      ...(source.metadata ?? {}),
      sourceCandidate: {
        ...existingCandidate,
        id: sourcePack.candidateId ?? existingCandidate.id,
        sourceId: existing.id,
        sourcePackId: sourcePack.packId ?? existingCandidate.sourcePackId,
        requestId: sourcePack.requestId ?? existingCandidate.requestId,
        sourceGrowthFamily: source.metadata?.sourceFamily ?? existingCandidate.sourceGrowthFamily,
        status: "active",
        validationResult: {
          ...(existingCandidate.validationResult ?? {}),
          state: "active",
          parserStatus: sourcePack.parserStatus,
          validationScore: sourcePack.validationScore,
          validationJobKey: sourcePack.validationJobKey,
          checkedAt: source.updatedAt
        },
        parserStatus: sourcePack.parserStatus ?? existingCandidate.parserStatus,
        healthStatus: "validated",
        activationDecision: sourcePack.activationState ?? existingCandidate.activationDecision,
        policyBoundary: source.metadata?.policyBoundary ?? existingCandidate.policyBoundary
      }
    },
    lifecycle: [
      ...((existing.lifecycle as Array<Record<string, unknown>> | undefined) ?? []),
      ...((source.lifecycle as Array<Record<string, unknown>> | undefined) ?? [])
    ],
    updatedAt: source.updatedAt
  } as SourceRecord;
}

export function enqueueDwmSourcePackCollectionTasks(
  frontier: DwmSourcePackFrontierQueue,
  jobs: DwmSourcePackCollectionJobHandoff[],
  sources: SourceRecord[],
  options: { tenantId?: string; maxBytes?: number } = {}
): DwmSourcePackCollectionQueueResult {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const existingTaskIds = new Set((frontier.snapshot?.() ?? []).map((item) => item.task?.id ?? item.id).filter((id): id is string => Boolean(id)));
  const receipts: DwmSourcePackCollectionQueueReceipt[] = [];
  const tasks: CollectionTask[] = [];
  for (const job of jobs) {
    const source = sourceById.get(job.sourceId);
    if (!source) {
      receipts.push({ status: "blocked", taskId: job.id, sourceId: job.sourceId, candidateId: job.candidateId, reason: "source record missing" });
      continue;
    }
    if (job.targetRawStored !== false) {
      receipts.push({ status: "blocked", taskId: job.id, sourceId: job.sourceId, candidateId: job.candidateId, reason: "raw target storage is not allowed" });
      continue;
    }
    if (isRestrictedFamily(job.family) && source.governance?.metadataOnly !== true) {
      receipts.push({ status: "blocked", taskId: job.id, sourceId: job.sourceId, candidateId: job.candidateId, reason: "restricted source requires metadata-only governance" });
      continue;
    }
    if (existingTaskIds.has(job.id)) {
      receipts.push({ status: "duplicate", taskId: job.id, sourceId: job.sourceId, candidateId: job.candidateId });
      continue;
    }
    const task = collectionTaskFromSourcePackJob(job, source, options);
    frontier.enqueueTask(task);
    existingTaskIds.add(job.id);
    receipts.push({ status: "queued", taskId: job.id, sourceId: job.sourceId, candidateId: job.candidateId, task });
    tasks.push(task);
  }
  return {
    receipts,
    tasks,
    summary: {
      queuedCount: receipts.filter((receipt) => receipt.status === "queued").length,
      duplicateCount: receipts.filter((receipt) => receipt.status === "duplicate").length,
      blockedCount: receipts.filter((receipt) => receipt.status === "blocked").length,
      taskCount: frontier.snapshot?.().length ?? tasks.length
    },
    safeOutput: sourcePackSafeOutput()
  };
}

export function buildDwmSourcePackRegistrySql() {
  return {
    createPacksTable: `
CREATE TABLE IF NOT EXISTS dwm_source_packs (
  pack_id TEXT PRIMARY KEY,
  tenant_id TEXT,
  label TEXT NOT NULL,
  scope TEXT,
  request_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  family_coverage_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  health_rollup_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  safe_output_json JSONB NOT NULL DEFAULT '{}'::jsonb
)`,
    createCandidatesTable: `
CREATE TABLE IF NOT EXISTS dwm_source_pack_candidates (
  candidate_id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES dwm_source_packs(pack_id) ON DELETE CASCADE,
  source_id TEXT,
  declared_family TEXT NOT NULL,
  family TEXT NOT NULL,
  source_type TEXT NOT NULL,
  ref_label TEXT,
  target_hash TEXT NOT NULL,
  target_preview TEXT NOT NULL,
  target_family TEXT NOT NULL,
  target_raw_stored BOOLEAN NOT NULL DEFAULT FALSE CHECK (target_raw_stored = FALSE),
  parser_expectation TEXT NOT NULL,
  candidate_rank INT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  intake_status TEXT NOT NULL,
  decision TEXT,
  activation_state TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  reason TEXT,
  duplicate_of TEXT,
  failure_json JSONB,
  policy_boundary_json JSONB,
  validation_result_json JSONB,
  parser_status TEXT,
  health_status TEXT,
  last_test_outcome_json JSONB,
  retry_hint TEXT
)`,
    createAuditTable: `
CREATE TABLE IF NOT EXISTS dwm_source_pack_audit (
  pack_id TEXT NOT NULL REFERENCES dwm_source_packs(pack_id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  reason TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb
)`
  };
}

function matchesPackQuery(pack: DwmSourcePackRecord, query: DwmSourcePackListQuery): boolean {
  if (query.label && !pack.label.toLowerCase().includes(query.label.toLowerCase())) return false;
  if (query.requestId && pack.requestId !== query.requestId) return false;
  if (query.createdFrom && pack.requestedAt < query.createdFrom) return false;
  if (query.createdTo && pack.requestedAt > query.createdTo) return false;
  if (query.family && !pack.candidates.some((candidate) => candidate.declaredFamily === query.family)) return false;
  if (query.decision && !pack.candidates.some((candidate) => candidate.decision === query.decision || candidate.status === query.decision)) return false;
  if (query.activationState && !pack.candidates.some((candidate) => candidate.activationState === query.activationState || candidate.status === query.activationState)) return false;
  if (query.parserStatus && !pack.candidates.some((candidate) => candidate.parserStatus === query.parserStatus)) return false;
  if (query.lastFailure && !pack.candidates.some((candidate) => candidate.failure?.code === query.lastFailure || candidate.failure?.message === query.lastFailure)) return false;
  return true;
}

function assertSafePackRecord(pack: DwmSourcePackRecord) {
  assertNoUnsafeKeys(pack);
  for (const candidate of pack.candidates) {
    if (candidate.targetRef.rawStored !== false) throw new Error("Source pack candidate targetRef.rawStored must be false");
    if ((candidate as Record<string, unknown>).target) throw new Error("Source pack registry candidates must store targetRef, not raw target");
  }
}

function assertSafeValidationQueueRecord(record: DwmSourcePackValidationQueueRecord) {
  assertNoUnsafeKeys(record);
  for (const row of record.safeRejectedRows) {
    if (row.targetRef.rawStored !== false) throw new Error("Source pack validation rejected rows must not store raw targets");
  }
}

function assertSafeActiveSourceRow(row: DwmSourcePackActiveSourceRow) {
  assertNoUnsafeKeys(row);
  if (row.targetRawStored !== false) throw new Error("Source pack active source rows must not store raw targets");
  if (isRestrictedFamily(row.family) && row.activationState !== "metadata_only_active") throw new Error("Restricted source rows must activate metadata-only");
  if (isRestrictedFamily(row.family) && row.policyBoundary?.metadataOnly !== true) throw new Error("Restricted source rows require metadataOnly policy boundary");
}

function sourcePackSafeOutput() {
  return {
    rawUnsafeRowsStored: false,
    rawRejectedTargetsStored: false,
    rawDuplicateTargetsStored: false,
    liveNetworkScrapeStarted: false,
    restrictedPayloadDownloadAllowed: false
  };
}

function activeSourceRowForCandidate(
  pack: DwmSourcePackRecord,
  candidate: DwmSourcePackCandidateRecord,
  input: {
    sourceId: string;
    parserStatus: string;
    validationScore: number;
    retry: DwmSourcePackValidationJob["retry"];
    validationJobKey: string;
    activatedAt: string;
  }
): DwmSourcePackActiveSourceRow {
  return {
    sourceId: input.sourceId,
    candidateId: candidate.id,
    packId: pack.id,
    requestId: pack.requestId,
    family: candidate.declaredFamily,
    sourceType: candidate.type,
    targetHash: candidate.targetRef.hash,
    targetPreview: candidate.targetRef.preview,
    targetRawStored: false,
    parserStatus: input.parserStatus,
    validationScore: clamp01(input.validationScore),
    policyBoundary: candidate.policyBoundary,
    status: "active",
    activationState: candidate.declaredFamily === "darkweb_onion" || candidate.declaredFamily === "darkweb_metadata" ? "metadata_only_active" : "active_canary",
    retry: input.retry,
    activatedAt: input.activatedAt,
    validationJobKey: input.validationJobKey,
    alertGradeEvidenceEligible: !["darkweb_onion", "darkweb_metadata"].includes(candidate.declaredFamily) || candidate.policyBoundary?.metadataOnly === true
  };
}

function isRestrictedFamily(family: DwmSourcePackFamily): boolean {
  return family === "darkweb_onion" || family === "darkweb_metadata";
}

function validationScoreForResult(result: DwmSourceCandidateValidationResult): number {
  if (result.state === "active") return 0.9;
  if (result.state === "retry_scheduled") return 0.45;
  if (result.state === "disabled") return 0.1;
  return 0;
}

function collectionModeForActiveSource(row: DwmSourcePackActiveSourceRow): DwmSourcePackCollectionJobHandoff["collectionMode"] {
  if (row.family === "telegram") return "bounded_public_preview";
  if (isRestrictedFamily(row.family)) return "metadata_only";
  return "parser_readiness";
}

function collectionTaskFromSourcePackJob(
  job: DwmSourcePackCollectionJobHandoff,
  source: SourceRecord,
  options: { tenantId?: string; maxBytes?: number }
): CollectionTask {
  return {
    id: job.id,
    tenantId: source.tenantId ?? options.tenantId,
    sourceId: job.sourceId,
    sourceType: source.type,
    targetUrl: source.url,
    queuedAt: job.queuedAt,
    availableAt: job.retry.retryAfter,
    priority: clamp01(job.validationScore),
    reason: `source-pack ${job.collectionMode} validation handoff`,
    retryCount: job.retry.attempt,
    maxRetries: job.retry.maxAttempts,
    maxBytes: options.maxBytes ?? (job.collectionMode === "metadata_only" ? 128_000 : 512_000),
    fairnessKey: `${source.tenantId ?? options.tenantId ?? "global"}:${job.family}:source-pack`,
    intelRequestId: job.requestId,
    crawlBudgetKey: `${source.tenantId ?? options.tenantId ?? "global"}:source-pack:${job.family}`,
    planning: {
      budgetClass: job.collectionMode === "bounded_public_preview" ? "interactive_live_search" : "background_source_growth",
      decision: "selected",
      selectedFor: "source_growth",
      reason: `validated ${job.family} source-pack candidate`,
      sourcePack: {
        packId: job.packId,
        requestId: job.requestId,
        candidateId: job.candidateId,
        validationJobKey: job.validationJobKey,
        parserStatus: job.parserStatus,
        validationScore: job.validationScore,
        collectionMode: job.collectionMode,
        targetHash: job.targetHash,
        targetRawStored: false
      },
      safetyEnvelope: {
        allowPublicChannel: job.collectionMode === "bounded_public_preview",
        allowRestrictedMetadata: job.collectionMode === "metadata_only",
        metadataOnlyRestricted: job.collectionMode === "metadata_only",
        forbiddenOperations: ["credential_bypass", "private_community_access", "payload_download", "captcha_solving"]
      }
    }
  } as CollectionTask;
}

function sourceNameForActiveRow(row: DwmSourcePackActiveSourceRow): string {
  return `${row.family} source-pack candidate ${row.candidateId}`;
}

function sourceTypeForActiveRow(row: DwmSourcePackActiveSourceRow): string {
  if (row.family === "telegram") return "telegram_public";
  if (row.family === "darkweb_onion" || row.family === "darkweb_metadata") return "tor_metadata";
  if (row.family === "public_advisory") return "api";
  if (row.family === "actor_page" || row.family === "clear_web") return "static_web";
  return row.sourceType;
}

function safeSourceUrlForActiveRow(row: DwmSourcePackActiveSourceRow): string {
  if (row.family === "telegram" && row.targetPreview.startsWith("https://t.me/")) return row.targetPreview;
  if (row.family === "telegram" && row.targetPreview.startsWith("@")) return `https://t.me/${row.targetPreview.slice(1)}`;
  return `source-pack://${row.family}/${encodeURIComponent(row.targetHash)}`;
}

function sourceCrawlFrequencyForActiveRow(row: DwmSourcePackActiveSourceRow): number {
  if (row.family === "telegram") return 300;
  if (isRestrictedFamily(row.family)) return 1800;
  return 3600;
}

function countRowsByFamily(rows: DwmSourcePackActiveSourceRow[]): Partial<Record<DwmSourcePackFamily, number>> {
  return rows.reduce<Partial<Record<DwmSourcePackFamily, number>>>((counts, row) => {
    counts[row.family] = (counts[row.family] ?? 0) + 1;
    return counts;
  }, {});
}

function emptyWorkerFamilyCounters(): DwmSourcePackWorkerReadinessCounters["byFamily"] {
  return {
    telegram: { active: 0, collectionReady: 0, retryScheduled: 0, failed: 0, blocked: 0 },
    darkweb_onion: { active: 0, collectionReady: 0, retryScheduled: 0, failed: 0, blocked: 0 },
    darkweb_metadata: { active: 0, collectionReady: 0, retryScheduled: 0, failed: 0, blocked: 0 },
    actor_page: { active: 0, collectionReady: 0, retryScheduled: 0, failed: 0, blocked: 0 },
    public_advisory: { active: 0, collectionReady: 0, retryScheduled: 0, failed: 0, blocked: 0 },
    clear_web: { active: 0, collectionReady: 0, retryScheduled: 0, failed: 0, blocked: 0 }
  };
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function findDuplicateTargetRefs(candidates: DwmSourcePackCandidateRecord[]) {
  const byHash = new Map<string, string[]>();
  for (const candidate of candidates) {
    const candidateIds = byHash.get(candidate.targetRef.hash) ?? [];
    candidateIds.push(candidate.id);
    byHash.set(candidate.targetRef.hash, candidateIds);
  }
  return [...byHash.entries()]
    .filter(([, candidateIds]) => candidateIds.length > 1)
    .map(([hash, candidateIds]) => ({ hash, candidateIds }));
}

function validationStatusFromResults(results: DwmSourceCandidateValidationResult[]): DwmSourcePackValidationState {
  if (results.length === 0) return "failed";
  if (results.every((result) => result.state === "active")) return "active";
  if (results.every((result) => result.state === "disabled")) return "disabled";
  if (results.every((result) => result.state === "retry_scheduled")) return "retry_scheduled";
  if (results.some((result) => result.state === "active")) return "partially_active";
  if (results.some((result) => result.state === "retry_scheduled")) return "retry_scheduled";
  return "failed";
}

function emptyFamilyCoverage(): DwmSourcePackHealthRollup["coverage"] {
  return {
    telegram: { total: 0, active: 0, pending: 0, failed: 0, disabled: 0 },
    darkweb_onion: { total: 0, active: 0, pending: 0, failed: 0, disabled: 0 },
    darkweb_metadata: { total: 0, active: 0, pending: 0, failed: 0, disabled: 0 },
    actor_page: { total: 0, active: 0, pending: 0, failed: 0, disabled: 0 },
    public_advisory: { total: 0, active: 0, pending: 0, failed: 0, disabled: 0 },
    clear_web: { total: 0, active: 0, pending: 0, failed: 0, disabled: 0 }
  };
}

function assertNoUnsafeKeys(value: unknown) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoUnsafeKeys(item);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (["rawPayload", "rawText", "payloadBody", "password", "sessionCookie"].includes(key)) {
      throw new Error(`Unsafe source pack registry field: ${key}`);
    }
    assertNoUnsafeKeys(child);
  }
}

function dedupeCandidates(candidates: DwmSourcePackCandidateRecord[]) {
  const seen = new Map<string, DwmSourcePackCandidateRecord>();
  for (const candidate of candidates) seen.set(candidate.id, clone(candidate));
  return [...seen.values()].sort((a, b) => a.index - b.index);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
