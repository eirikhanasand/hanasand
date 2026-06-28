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
    guardrails: [
      "target_raw_stored must remain false",
      "raw payload, capture body, credential, and downloaded leak rows are not pack registry columns",
      "collection remains controlled by source promotion and frontier queue contracts"
    ]
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
