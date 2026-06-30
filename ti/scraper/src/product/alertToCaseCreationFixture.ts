import { stableId } from "../utils.ts";

export const DWM_ALERT_TO_CASE_CREATION_FIXTURE_SCHEMA_VERSION = "dwm.alert_to_case_creation_fixture.v1" as const;

type AlertLike = Record<string, any>;

export function buildAlertToCaseCreationFixture(alert: AlertLike, input: {
  checkedAt?: string;
  assignedOwner?: string;
  note?: string;
} = {}) {
  const checkedAt = input.checkedAt ?? new Date(0).toISOString();
  const tenantId = stringValue(alert.tenantId);
  const organizationId = stringValue(alert.organizationId ?? alert.workflowContext?.organizationId ?? alert.webhookContext?.organizationId);
  const alertId = stringValue(alert.id);
  const caseIdCandidate = stringValue(alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate ?? alert.webhookContext?.caseIdCandidate);
  const casePath = stringValue(alert.casePath ?? alert.workflowContext?.casePath ?? alert.webhookContext?.casePath);
  const webhookDestinationIds = uniqueStrings([
    ...(Array.isArray(alert.workflowContext?.webhookDestinationIds) ? alert.workflowContext.webhookDestinationIds : []),
    ...(Array.isArray(alert.webhookContext?.webhookDestinationIds) ? alert.webhookContext.webhookDestinationIds : []),
    ...(Array.isArray(alert.deliveryReadinessContext?.webhookDestinationIds) ? alert.deliveryReadinessContext.webhookDestinationIds : [])
  ]);
  const provenance = alertProvenance(alert);
  const blockerCodes = uniqueStrings([
    tenantId ? undefined : "missing_tenant_id",
    organizationId ? undefined : "missing_organization_scope",
    alertId ? undefined : "missing_alert_id",
    caseIdCandidate ? undefined : "missing_case_id_candidate",
    casePath ? undefined : "missing_case_path",
    provenance.captureIds.length ? undefined : "missing_capture_provenance",
    provenance.sourceIds.length ? undefined : "missing_source_provenance",
    provenance.contentHashes.length ? undefined : "missing_content_hash"
  ]);
  const idempotencyKey = stableId("alert_case_creation", `${tenantId}:${organizationId}:${alertId}:${caseIdCandidate}`);
  return {
    schemaVersion: DWM_ALERT_TO_CASE_CREATION_FIXTURE_SCHEMA_VERSION,
    fixtureId: stableId("alert_to_case_creation_fixture", `${tenantId}:${organizationId}:${alertId}:${checkedAt}`),
    checkedAt,
    tenantId,
    organizationId,
    alertId,
    caseIdCandidate,
    casePath,
    ready: blockerCodes.length === 0,
    route: alertId ? `/v1/dwm/alerts/${encodeURIComponent(alertId)}/case-handoff` : "/v1/dwm/alerts/:alertId/case-handoff",
    method: "POST",
    requestBody: {
      organizationId,
      assignedOwner: input.assignedOwner,
      note: input.note,
      idempotencyKey
    },
    dedupe: {
      alertDedupeKey: stringValue(alert.dedupeKey),
      caseDedupeKey: stableId("case_dedupe", `${organizationId}:${alertId}:${caseIdCandidate}`),
      idempotencyKey
    },
    provenance,
    related: {
      watchlistIds: stringArray(alert.watchlistIds ?? alert.workflowContext?.watchlistIds),
      watchlistItemIds: stringArray(alert.watchlistItemIds ?? alert.workflowContext?.watchlistItemIds),
      webhookDestinationIds
    },
    blockerCodes,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

function alertProvenance(alert: AlertLike) {
  const evidence = Array.isArray(alert.evidence) ? alert.evidence : [];
  return {
    captureIds: uniqueStrings([
      ...stringArray(alert.provenance?.captureIds),
      ...stringArray(alert.workflowContext?.captureIds),
      ...evidence.map((item: any) => stringValue(item.provenance?.captureId ?? item.captureId))
    ]),
    sourceIds: uniqueStrings([
      ...stringArray(alert.provenance?.sourceIds),
      ...stringArray(alert.workflowContext?.sourceIds),
      ...evidence.map((item: any) => stringValue(item.sourceId ?? item.provenance?.sourceId))
    ]),
    contentHashes: uniqueStrings([
      ...stringArray(alert.provenance?.contentHashes),
      ...evidence.map((item: any) => stringValue(item.contentHash))
    ]),
    evidenceCount: evidence.length
  };
}

function stringValue(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? uniqueStrings(value.map(stringValue)) : [];
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
