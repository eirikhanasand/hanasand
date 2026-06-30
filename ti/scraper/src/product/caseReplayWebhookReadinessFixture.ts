import { stableId } from "../utils.ts";

export const DWM_CASE_WEBHOOK_REPLAY_READINESS_FIXTURE_SCHEMA_VERSION = "dwm.case_to_webhook_replay_readiness_fixture.v1" as const;

type ReplayExportLike = Record<string, any>;

export function buildCaseWebhookReplayReadinessFixture(replayExport: ReplayExportLike, input: {
  checkedAt?: string;
  fixtureId?: string;
} = {}) {
  const checkedAt = input.checkedAt ?? new Date(0).toISOString();
  const caseId = stringValue(replayExport.caseId);
  const alertId = stringValue(replayExport.alertId);
  const organizationId = stringValue(replayExport.organizationId);
  const tenantId = stringValue(replayExport.tenantId);
  const orgAccess = replayExport.organizationAccessReadiness ?? {};
  const source = replayExport.sourceHandoffReadiness ?? {};
  const webhook = replayExport.webhookDryRunReadiness ?? {};
  const destinations = uniqueStrings([
    ...(Array.isArray(webhook.destinationIds) ? webhook.destinationIds : []),
    ...(Array.isArray(source.consumers?.webhook?.webhookDestinationIds) ? source.consumers.webhook.webhookDestinationIds : [])
  ]);
  const workflowTransitions = Array.isArray(replayExport.workflowTransitions) ? replayExport.workflowTransitions : [];
  const handoffReceipts = Array.isArray(replayExport.handoffActionHistory?.receipts) ? replayExport.handoffActionHistory.receipts : [];
  const provenance = replayExport.provenance ?? {};
  const baseBlockers = uniqueStrings([
    replayExport.schemaVersion === "dwm.case_action_replay_export.v1" ? undefined : "unsupported_replay_export_schema",
    organizationId ? undefined : "missing_organization_scope",
    alertId ? undefined : "missing_case_alert",
    caseId ? undefined : "missing_case_id",
    ...stringArray(orgAccess.blockerCodes),
    ...stringArray(source.blockerCodes),
    ...stringArray(webhook.blockerCodes),
    destinations.length ? undefined : "missing_webhook_destination"
  ]);
  const plannedDeliveries = destinations.map((destinationId) => {
    const deliveryBlockers = uniqueStrings([
      ...baseBlockers,
      orgAccess.readyForMutation === false ? "case_action_not_mutable" : undefined,
      webhook.readyForReplay === true ? undefined : "webhook_replay_not_ready",
      source.consumers?.webhook?.ready === false ? "source_webhook_handoff_not_ready" : undefined
    ]);
    const idempotencyKey = stableId("case_webhook_replay", `${tenantId}:${organizationId}:${caseId}:${alertId}:${destinationId}`);
    return {
      rowId: stableId("case_webhook_replay_fixture_row", `${idempotencyKey}:${checkedAt}`),
      deliveryId: stableId("case_webhook_replay_delivery", idempotencyKey),
      tenantId,
      organizationId,
      caseId,
      alertId,
      webhookDestinationId: destinationId,
      ready: deliveryBlockers.length === 0,
      dryRun: true,
      method: webhook.method ?? "POST",
      route: webhook.route ?? "/v1/dwm/webhooks/deliver",
      idempotencyKey,
      dedupeKey: stableId("case_webhook_replay_dedupe", `${organizationId}:${alertId}:${destinationId}`),
      sourceFamily: source.sourceFamily,
      provenance: {
        captureIds: stringArray(provenance.captureIds),
        sourceIds: stringArray(provenance.sourceIds),
        contentHashes: stringArray(provenance.contentHashes),
        evidenceCount: Number(provenance.evidenceCount ?? source.evidenceCount ?? 0)
      },
      workflow: {
        status: replayExport.workflowState?.status,
        assignedOwner: replayExport.workflowState?.assignedOwner,
        transitionCount: workflowTransitions.length,
        handoffReceiptCount: handoffReceipts.length
      },
      blockerCodes: deliveryBlockers
    };
  });
  const fixtureBlockers = uniqueStrings([
    ...baseBlockers,
    ...plannedDeliveries.flatMap((row) => row.blockerCodes)
  ]);
  return {
    schemaVersion: DWM_CASE_WEBHOOK_REPLAY_READINESS_FIXTURE_SCHEMA_VERSION,
    fixtureId: input.fixtureId ?? stableId("case_webhook_replay_fixture", `${tenantId}:${organizationId}:${caseId}:${alertId}:${checkedAt}`),
    checkedAt,
    tenantId,
    organizationId,
    caseId,
    alertId,
    ready: fixtureBlockers.length === 0 && plannedDeliveries.length > 0,
    deliveryCount: plannedDeliveries.length,
    plannedDeliveries,
    blockerCodes: fixtureBlockers,
    nextAnalystActions: (Array.isArray(replayExport.nextAnalystActions) ? replayExport.nextAnalystActions : [])
      .filter((action: any) => ["test_webhook_delivery", "record_customer_notification", "review_org_access"].includes(String(action?.id ?? "")))
      .map((action: any) => ({
        id: action.id,
        ownerLane: action.ownerLane,
        route: action.route,
        ready: Boolean(action.ready),
        blocked: Boolean(action.blocked),
        blockerCodes: stringArray(action.blockerCodes)
      })),
    safeOutput: {
      metadataOnly: true,
      endpointSecretExposed: false,
      payloadBodyExposed: false,
      rawEvidenceExposed: false,
      crossOrgDataExposed: false
    }
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
