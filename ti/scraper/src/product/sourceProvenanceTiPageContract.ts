import { stableId, uniqueStrings } from "../utils.ts";

export const TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION = "ti.source_provenance_page_contract.v1" as const;

export type TiSourceProvenanceInputRow = {
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourceId?: string;
  sourceName?: string;
  sourceFamily?: string;
  sourceStatus?: "active" | "paused" | "disabled" | string;
  captureId?: string;
  capturedAt?: string;
  collectedAt?: string;
  contentHash?: string;
  provenance?: string;
  confidence?: number;
  route?: string;
  relationship?: "actor_activity" | "targeting" | "infrastructure" | "tooling" | "victim" | string;
};

export type TiSourceProvenancePageContract = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  page: {
    route: string;
    payloadShape: string[];
    customerVisible: true;
    redacted: true;
  };
  summary: {
    sourceCount: number;
    captureCount: number;
    activeSourceCount: number;
    sourceFamilies: string[];
    newestEvidenceAt?: string;
    averageConfidence: number;
  };
  rows: TiSourceProvenancePageRow[];
  blockers: TiSourceProvenancePageBlocker[];
};

export type TiSourceProvenancePageRow = {
  rowId: string;
  sourceId?: string;
  sourceName?: string;
  sourceFamily?: string;
  sourceStatus?: string;
  captureId?: string;
  capturedAt?: string;
  contentHash?: string;
  provenance?: string;
  relationship?: string;
  confidence: number;
  route?: string;
  ready: boolean;
  blockerCodes: TiSourceProvenancePageBlocker["code"][];
};

export type TiSourceProvenancePageBlocker = {
  code:
    | "missing_source_id"
    | "missing_capture_id"
    | "missing_content_hash"
    | "missing_provenance"
    | "inactive_source"
    | "stale_evidence"
    | "organization_scope_mismatch";
  ownerLane: "source" | "publicTI";
  rowId: string;
  sourceId?: string;
  captureId?: string;
  path: string;
  message: string;
};

export function buildSourceProvenanceTiPageContract(input: {
  tenantId: string;
  organizationId?: string;
  actor: string;
  rows: TiSourceProvenanceInputRow[];
  generatedAt?: string;
  maxAgeDays?: number;
}): TiSourceProvenancePageContract {
  const generatedAt = input.generatedAt ?? new Date(0).toISOString();
  const maxAgeDays = input.maxAgeDays ?? 180;
  const rows = input.rows.map((row) => provenancePageRow({
    row,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    generatedAt,
    maxAgeDays
  }));
  const blockers = rows.flatMap(rowBlockers);
  return {
    schemaVersion: TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_page", `${input.tenantId}:${input.organizationId ?? ""}:${input.actor}:${generatedAt}:${rows.map((row) => row.rowId).join(",")}`),
    generatedAt,
    ok: blockers.length === 0,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    actor: input.actor,
    page: {
      route: `/ti/${encodeURIComponent(input.actor)}`,
      payloadShape: ["actor", "summary", "rows[].sourceId", "rows[].captureId", "rows[].contentHash", "rows[].provenance", "blockers[]"],
      customerVisible: true,
      redacted: true
    },
    summary: {
      sourceCount: uniqueStrings(rows.map((row) => row.sourceId).filter(Boolean).map(String)).length,
      captureCount: uniqueStrings(rows.map((row) => row.captureId).filter(Boolean).map(String)).length,
      activeSourceCount: uniqueStrings(rows.filter((row) => row.sourceStatus === "active").map((row) => row.sourceId).filter(Boolean).map(String)).length,
      sourceFamilies: uniqueStrings(rows.map((row) => row.sourceFamily).filter(Boolean).map(String)),
      newestEvidenceAt: newestTimestamp(rows.map((row) => row.capturedAt)),
      averageConfidence: average(rows.map((row) => row.confidence))
    },
    rows,
    blockers
  };
}

function provenancePageRow(input: {
  row: TiSourceProvenanceInputRow;
  tenantId: string;
  organizationId?: string;
  generatedAt: string;
  maxAgeDays: number;
}): TiSourceProvenancePageRow {
  const row = input.row;
  const capturedAt = row.capturedAt ?? row.collectedAt;
  const rowId = stableId("ti_source_provenance_row", `${input.tenantId}:${input.organizationId ?? ""}:${row.actor}:${row.sourceId ?? ""}:${row.captureId ?? ""}:${row.contentHash ?? ""}`);
  const blockerCodes = uniqueStrings([
    !row.sourceId ? "missing_source_id" : undefined,
    !row.captureId ? "missing_capture_id" : undefined,
    !row.contentHash ? "missing_content_hash" : undefined,
    !row.provenance ? "missing_provenance" : undefined,
    row.sourceStatus && row.sourceStatus !== "active" ? "inactive_source" : undefined,
    capturedAt && daysBetween(capturedAt, input.generatedAt) > input.maxAgeDays ? "stale_evidence" : undefined,
    row.tenantId !== input.tenantId || (input.organizationId && row.organizationId && row.organizationId !== input.organizationId) ? "organization_scope_mismatch" : undefined
  ].filter(Boolean).map(String)) as TiSourceProvenancePageBlocker["code"][];

  return {
    rowId,
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    sourceFamily: row.sourceFamily,
    sourceStatus: row.sourceStatus,
    captureId: row.captureId,
    capturedAt,
    contentHash: row.contentHash,
    provenance: row.provenance,
    relationship: row.relationship,
    confidence: clampConfidence(row.confidence),
    route: row.route,
    ready: blockerCodes.length === 0,
    blockerCodes
  };
}

function rowBlockers(row: TiSourceProvenancePageRow): TiSourceProvenancePageBlocker[] {
  return row.blockerCodes.map((code) => ({
    code,
    ownerLane: code === "organization_scope_mismatch" ? "publicTI" : "source",
    rowId: row.rowId,
    sourceId: row.sourceId,
    captureId: row.captureId,
    path: blockerPath(code),
    message: blockerMessage(code)
  }));
}

function blockerPath(code: TiSourceProvenancePageBlocker["code"]): string {
  if (code === "missing_source_id") return "rows[].sourceId";
  if (code === "missing_capture_id") return "rows[].captureId";
  if (code === "missing_content_hash") return "rows[].contentHash";
  if (code === "missing_provenance") return "rows[].provenance";
  if (code === "inactive_source") return "rows[].sourceStatus";
  if (code === "organization_scope_mismatch") return "rows[].organizationId";
  return "rows[].capturedAt";
}

function blockerMessage(code: TiSourceProvenancePageBlocker["code"]): string {
  if (code === "missing_source_id") return "Source evidence is missing source identity.";
  if (code === "missing_capture_id") return "Source evidence is missing capture identity.";
  if (code === "missing_content_hash") return "Source evidence is missing content hash.";
  if (code === "missing_provenance") return "Source evidence is missing provenance text.";
  if (code === "inactive_source") return "Source evidence came from an inactive source.";
  if (code === "organization_scope_mismatch") return "Source evidence belongs to another organization.";
  return "Source evidence is older than the accepted freshness window.";
}

function newestTimestamp(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

function daysBetween(start: string, end: string): number {
  const deltaMs = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(deltaMs)) return Number.POSITIVE_INFINITY;
  return deltaMs / 86_400_000;
}

function clampConfidence(value: unknown): number {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(1, numberValue));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(3));
}
