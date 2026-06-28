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

function sourcePackSafeOutput() {
  return {
    rawUnsafeRowsStored: false,
    rawRejectedTargetsStored: false,
    rawDuplicateTargetsStored: false,
    liveNetworkScrapeStarted: false,
    restrictedPayloadDownloadAllowed: false
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
