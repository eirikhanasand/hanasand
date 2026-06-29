import { stableId, uniqueStrings } from "../utils.ts";

export const TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION = "ti.source_provenance_page_contract.v1" as const;
export const TI_SOURCE_PROVENANCE_ALERTABILITY_BRIDGE_SCHEMA_VERSION = "ti.source_provenance_alertability_bridge.v1" as const;

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
    actionRequiredCount: number;
    operatorActionTypes: string[];
  };
  rows: TiSourceProvenancePageRow[];
  blockers: TiSourceProvenancePageBlocker[];
  operatorActions: TiSourceProvenancePageAction[];
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
  operatorActions: TiSourceProvenancePageAction[];
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

export type TiSourceProvenanceAlertabilityBridge = {
  schemaVersion: typeof TI_SOURCE_PROVENANCE_ALERTABILITY_BRIDGE_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId?: string;
  actor: string;
  sourceContractId: string;
  canCreateWatchlistTerms: boolean;
  canRequestAlertGeneration: boolean;
  payloadShape: string[];
  watchlistTerms: TiSourceProvenanceAlertabilityTerm[];
  blockers: TiSourceProvenanceAlertabilityBlocker[];
};

export type TiSourceProvenanceAlertabilityTerm = {
  termId: string;
  value: string;
  kind: "actor" | "source_family" | "relationship";
  sourceIds: string[];
  captureIds: string[];
  contentHashes: string[];
  confidence: number;
  alertGenerationRef: {
    schemaVersion: "organization.watchlist_alert_generation_ref.v1";
    key: string;
    organizationId?: string;
    term: string;
    source: "public_ti_source_provenance";
  };
};

export type TiSourceProvenanceAlertabilityBlocker = {
  code: "source_provenance_not_ready" | "no_alertable_terms" | "missing_organization_scope";
  ownerLane: "source" | "publicTI" | "org";
  path: string;
  message: string;
};

export type TiSourceProvenancePageAction = {
  action:
    | "attach_source_identity"
    | "record_capture"
    | "record_content_hash"
    | "record_provenance"
    | "retry_capture"
    | "review_source_activation"
    | "fix_organization_scope";
  ownerLane: "source" | "publicTI";
  rowId: string;
  sourceId?: string;
  captureId?: string;
  reason: string;
  route: {
    method: "POST";
    path: string;
    body: Record<string, unknown>;
    dryRunSupported: true;
    liveNetworkFetch: false;
  };
  safeOutput: {
    rawTargetsExposed: false;
    restrictedMetadataLeaked: false;
    privateTelegramContentExposed: false;
    liveNetworkScrapeStarted: false;
  };
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
  const operatorActions = uniqueActionRows(rows.flatMap((row) => row.operatorActions));
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
      averageConfidence: average(rows.map((row) => row.confidence)),
      actionRequiredCount: rows.filter((row) => !row.ready).length,
      operatorActionTypes: uniqueStrings(operatorActions.map((action) => action.action))
    },
    rows,
    blockers,
    operatorActions
  };
}

export function buildSourceProvenanceAlertabilityBridge(input: {
  contract: TiSourceProvenancePageContract;
  includeSourceFamilies?: boolean;
  includeRelationships?: boolean;
  generatedAt?: string;
}): TiSourceProvenanceAlertabilityBridge {
  const generatedAt = input.generatedAt ?? input.contract.generatedAt;
  const watchlistTerms = alertabilityTerms(input.contract, {
    includeSourceFamilies: input.includeSourceFamilies ?? true,
    includeRelationships: input.includeRelationships ?? true
  });
  const blockers = alertabilityBlockers(input.contract, watchlistTerms);
  return {
    schemaVersion: TI_SOURCE_PROVENANCE_ALERTABILITY_BRIDGE_SCHEMA_VERSION,
    id: stableId("ti_source_provenance_alertability", `${input.contract.id}:${generatedAt}:${watchlistTerms.map((term) => term.termId).join(",")}`),
    generatedAt,
    ok: blockers.length === 0,
    tenantId: input.contract.tenantId,
    organizationId: input.contract.organizationId,
    actor: input.contract.actor,
    sourceContractId: input.contract.id,
    canCreateWatchlistTerms: blockers.length === 0,
    canRequestAlertGeneration: blockers.length === 0,
    payloadShape: ["watchlistTerms[].value", "watchlistTerms[].kind", "watchlistTerms[].alertGenerationRef", "watchlistTerms[].captureIds", "blockers[]"],
    watchlistTerms,
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
    blockerCodes,
    operatorActions: blockerCodes.map((code) => operatorActionForBlocker(code, rowId, row))
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

function alertabilityTerms(
  contract: TiSourceProvenancePageContract,
  options: { includeSourceFamilies: boolean; includeRelationships: boolean }
): TiSourceProvenanceAlertabilityTerm[] {
  const readyRows = contract.rows.filter((row) => row.ready);
  const terms = [
    termFromRows(contract, "actor", contract.actor, readyRows),
    ...(options.includeSourceFamilies
      ? uniqueStrings(readyRows.map((row) => row.sourceFamily).filter(Boolean).map(String)).map((family) => termFromRows(contract, "source_family", family, readyRows.filter((row) => row.sourceFamily === family)))
      : []),
    ...(options.includeRelationships
      ? uniqueStrings(readyRows.map((row) => row.relationship).filter(Boolean).map(String)).map((relationship) => termFromRows(contract, "relationship", relationship, readyRows.filter((row) => row.relationship === relationship)))
      : [])
  ];
  return terms.filter((term): term is TiSourceProvenanceAlertabilityTerm => Boolean(term));
}

function termFromRows(
  contract: TiSourceProvenancePageContract,
  kind: TiSourceProvenanceAlertabilityTerm["kind"],
  value: string | undefined,
  rows: TiSourceProvenancePageRow[]
): TiSourceProvenanceAlertabilityTerm | undefined {
  if (!value || rows.length === 0) return undefined;
  const normalizedValue = value.trim();
  if (!normalizedValue) return undefined;
  const termId = stableId("ti_source_provenance_alert_term", `${contract.tenantId}:${contract.organizationId ?? ""}:${contract.actor}:${kind}:${normalizedValue}`);
  return {
    termId,
    value: normalizedValue,
    kind,
    sourceIds: uniqueStrings(rows.map((row) => row.sourceId).filter(Boolean).map(String)),
    captureIds: uniqueStrings(rows.map((row) => row.captureId).filter(Boolean).map(String)),
    contentHashes: uniqueStrings(rows.map((row) => row.contentHash).filter(Boolean).map(String)),
    confidence: average(rows.map((row) => row.confidence)),
    alertGenerationRef: {
      schemaVersion: "organization.watchlist_alert_generation_ref.v1",
      key: stableId("org_watchlist_alert_generation", `${contract.organizationId ?? ""}:${kind}:${normalizedValue}:${termId}`),
      organizationId: contract.organizationId,
      term: normalizedValue,
      source: "public_ti_source_provenance"
    }
  };
}

function alertabilityBlockers(
  contract: TiSourceProvenancePageContract,
  terms: TiSourceProvenanceAlertabilityTerm[]
): TiSourceProvenanceAlertabilityBlocker[] {
  const blockers: TiSourceProvenanceAlertabilityBlocker[] = [];
  if (!contract.organizationId) {
    blockers.push({
      code: "missing_organization_scope",
      ownerLane: "org",
      path: "contract.organizationId",
      message: "Watchlist alertability requires organization scope."
    });
  }
  if (!contract.ok) {
    blockers.push({
      code: "source_provenance_not_ready",
      ownerLane: "source",
      path: "contract.blockers",
      message: "Source provenance must be ready before creating alertable watchlist terms."
    });
  }
  if (terms.length === 0) {
    blockers.push({
      code: "no_alertable_terms",
      ownerLane: "publicTI",
      path: "watchlistTerms",
      message: "No alertable terms were produced from source provenance."
    });
  }
  return blockers;
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

function operatorActionForBlocker(code: TiSourceProvenancePageBlocker["code"], rowId: string, row: TiSourceProvenanceInputRow): TiSourceProvenancePageAction {
  const action = actionTypeForBlocker(code);
  return {
    action,
    ownerLane: code === "organization_scope_mismatch" ? "publicTI" : "source",
    rowId,
    sourceId: row.sourceId,
    captureId: row.captureId,
    reason: blockerMessage(code),
    route: {
      method: "POST",
      path: action === "fix_organization_scope" ? "/v1/actor-org-relevance/review" : "/v1/dwm/source-requests",
      body: {
        action,
        actor: row.actor,
        sourceId: row.sourceId,
        captureId: row.captureId,
        sourceFamily: row.sourceFamily,
        dryRun: true
      },
      dryRunSupported: true,
      liveNetworkFetch: false
    },
    safeOutput: {
      rawTargetsExposed: false,
      restrictedMetadataLeaked: false,
      privateTelegramContentExposed: false,
      liveNetworkScrapeStarted: false
    }
  };
}

function actionTypeForBlocker(code: TiSourceProvenancePageBlocker["code"]): TiSourceProvenancePageAction["action"] {
  if (code === "missing_source_id") return "attach_source_identity";
  if (code === "missing_capture_id") return "record_capture";
  if (code === "missing_content_hash") return "record_content_hash";
  if (code === "missing_provenance") return "record_provenance";
  if (code === "inactive_source") return "review_source_activation";
  if (code === "organization_scope_mismatch") return "fix_organization_scope";
  return "retry_capture";
}

function uniqueActionRows(actions: TiSourceProvenancePageAction[]): TiSourceProvenancePageAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.rowId}:${action.action}:${action.sourceId ?? ""}:${action.captureId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
