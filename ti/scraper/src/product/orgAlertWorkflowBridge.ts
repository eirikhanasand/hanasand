import { stableId, uniqueStrings } from "../utils.ts";
import {
  buildAlertWorkflowContract,
  validateAlertWorkflowPreservation,
  type DwmAlertWorkflowContract,
  type DwmAlertWorkflowPreservationBlocker
} from "./alertWorkflowContract.ts";

export const DWM_ORG_ALERT_WORKFLOW_BRIDGE_SCHEMA_VERSION = "dwm.org_alert_workflow_bridge.v1" as const;
export const DWM_ORG_ALERT_WEBHOOK_FIXTURE_SCHEMA_VERSION = "dwm.org_alert_webhook_fixture.v1" as const;
export const DWM_ORG_ALERT_WEBHOOK_DELIVERY_PAYLOAD_SCHEMA_VERSION = "dwm.org_alert_webhook_delivery_payload.v1" as const;

export type OrgAlertWorkflowWatchlistRef = {
  watchlistId: string;
  watchlistItemId?: string;
  tenantId: string;
  organizationId: string;
  term: string;
  normalizedTerm?: string;
  status?: "active" | "paused" | "archived" | string;
  alertGeneratorKey?: string;
};

export type OrgAlertWorkflowBridgeReport = {
  schemaVersion: typeof DWM_ORG_ALERT_WORKFLOW_BRIDGE_SCHEMA_VERSION;
  checkedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId: string;
  rows: OrgAlertWorkflowBridgeRow[];
  blockers: OrgAlertWorkflowBridgeBlocker[];
};

export type OrgAlertWorkflowBridgeRow = {
  rowId: string;
  watchlistId: string;
  watchlistItemId?: string;
  term: string;
  normalizedTerm: string;
  alertGeneratorKey?: string;
  matchedAlertIds: string[];
  alertDetailPaths: string[];
  casePaths: string[];
  sourceFamilies: string[];
  workflowEventCount: number;
  provenance: {
    evidenceCount: number;
    captureIds: string[];
    sourceIds: string[];
    contentHashes: string[];
  };
  eventPayloads: OrgAlertWorkflowBridgeEventPayload[];
  ready: boolean;
  blockerCodes: OrgAlertWorkflowBridgeBlocker["code"][];
};

export type OrgAlertWorkflowBridgeEventPayload = {
  schemaVersion: "dwm.org_alert_workflow_event_payload.v1";
  alertId: string;
  organizationId: string;
  tenantId: string;
  watchlistId: string;
  watchlistItemId?: string;
  alertGeneratorKey?: string;
  alertDetailPath?: string;
  casePaths: string[];
  sourceFamilies: string[];
  captureIds: string[];
  evidenceCount: number;
  workflowEventCount: number;
  dedupeKey?: string;
};

export type OrgAlertWorkflowBridgeBlocker = {
  code:
    | "inactive_watchlist"
    | "missing_alert_generation_ref"
    | "alert_not_generated"
    | "organization_scope_changed"
    | "alert_detail_route_unavailable"
    | "case_route_unavailable"
    | "provenance_missing"
    | "workflow_not_preserved";
  ownerLane: "watchlist" | "alert" | "case" | "source";
  rowId?: string;
  alertId?: string;
  watchlistId?: string;
  watchlistItemId?: string;
  path: string;
  message: string;
};

export type OrgAlertWebhookDestinationRef = {
  destinationId: string;
  tenantId: string;
  organizationId: string;
  kind?: "discord" | "webhook" | string;
  status?: "active" | "disabled" | "paused" | string;
  verified?: boolean;
};

export type OrgAlertWebhookFixtureContract = {
  schemaVersion: typeof DWM_ORG_ALERT_WEBHOOK_FIXTURE_SCHEMA_VERSION;
  checkedAt: string;
  ok: boolean;
  tenantId: string;
  organizationId: string;
  deliveries: OrgAlertWebhookFixtureDelivery[];
  blockers: OrgAlertWebhookFixtureBlocker[];
};

export type OrgAlertWebhookFixtureDelivery = {
  deliveryId: string;
  rowId: string;
  alertId: string;
  watchlistId: string;
  watchlistItemId?: string;
  ready: boolean;
  blockerCodes: OrgAlertWebhookFixtureBlocker["code"][];
  destinationIds: string[];
  destinationKinds: string[];
  payload: OrgAlertWebhookDeliveryPayload;
};

export type OrgAlertWebhookDeliveryPayload = {
  schemaVersion: typeof DWM_ORG_ALERT_WEBHOOK_DELIVERY_PAYLOAD_SCHEMA_VERSION;
  tenantId: string;
  organizationId: string;
  alertId: string;
  watchlistId: string;
  watchlistItemId?: string;
  webhookDestinationIds: string[];
  deliveryKind: string;
  alertDetailPath?: string;
  casePaths: string[];
  sourceFamilies: string[];
  captureIds: string[];
  evidenceCount: number;
  workflowEventCount: number;
  dedupeKey?: string;
  idempotencyKey: string;
};

export type OrgAlertWebhookFixtureBlocker = {
  code:
    | "bridge_row_not_ready"
    | "missing_alert_event_payload"
    | "missing_webhook_destination"
    | "webhook_destination_not_found"
    | "webhook_destination_scope_mismatch"
    | "webhook_destination_not_verified";
  ownerLane: "watchlist" | "alert" | "case" | "source" | "webhook";
  rowId: string;
  alertId?: string;
  watchlistId: string;
  watchlistItemId?: string;
  destinationId?: string;
  path: string;
  message: string;
};

export function buildOrgAlertWorkflowBridgeReport(input: {
  tenantId: string;
  organizationId: string;
  watchlists: OrgAlertWorkflowWatchlistRef[];
  alerts: Record<string, any>[];
  previousAlerts?: Record<string, any>[];
  checkedAt?: string;
}): OrgAlertWorkflowBridgeReport {
  const checkedAt = input.checkedAt ?? new Date(0).toISOString();
  const previousByAlertId = new Map(
    (input.previousAlerts ?? []).map((alert) => [String(alert.id ?? ""), buildAlertWorkflowContract({ alert, checkedAt })])
  );
  const rows = input.watchlists.map((watchlist) => bridgeRow({
    watchlist,
    alerts: input.alerts,
    previousByAlertId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    checkedAt
  }));
  const blockers = rows.flatMap((row) => rowBlockers(row));
  return {
    schemaVersion: DWM_ORG_ALERT_WORKFLOW_BRIDGE_SCHEMA_VERSION,
    checkedAt,
    ok: blockers.length === 0,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    rows,
    blockers
  };
}

export function buildOrgAlertWebhookFixtureContract(input: {
  bridge: OrgAlertWorkflowBridgeReport;
  destinations: OrgAlertWebhookDestinationRef[];
  destinationIdsByWatchlistId?: Record<string, string[]>;
  destinationIdsByWatchlistItemId?: Record<string, string[]>;
  checkedAt?: string;
}): OrgAlertWebhookFixtureContract {
  const destinationById = new Map(input.destinations.map((destination) => [destination.destinationId, destination]));
  const deliveries = input.bridge.rows.flatMap((row) => {
    const payloads = row.eventPayloads.length ? row.eventPayloads : [undefined];
    return payloads.map((payload) => webhookDeliveryFor({
      row,
      payload,
      bridge: input.bridge,
      destinationById,
      destinationIds: destinationIdsForRow(row, input.destinationIdsByWatchlistId, input.destinationIdsByWatchlistItemId)
    }));
  });
  const blockers = deliveries.flatMap((delivery) => deliveryBlockers(delivery, input.bridge, destinationById));
  return {
    schemaVersion: DWM_ORG_ALERT_WEBHOOK_FIXTURE_SCHEMA_VERSION,
    checkedAt: input.checkedAt ?? input.bridge.checkedAt,
    ok: blockers.length === 0,
    tenantId: input.bridge.tenantId,
    organizationId: input.bridge.organizationId,
    deliveries,
    blockers
  };
}

function bridgeRow(input: {
  watchlist: OrgAlertWorkflowWatchlistRef;
  alerts: Record<string, any>[];
  previousByAlertId: Map<string, DwmAlertWorkflowContract>;
  tenantId: string;
  organizationId: string;
  checkedAt: string;
}): OrgAlertWorkflowBridgeRow {
  const normalizedTerm = normalizeTerm(input.watchlist.normalizedTerm ?? input.watchlist.term);
  const rowId = stableId("org_alert_workflow_bridge_row", `${input.tenantId}:${input.organizationId}:${input.watchlist.watchlistId}:${input.watchlist.watchlistItemId ?? ""}:${normalizedTerm}`);
  const matchedAlerts = input.alerts
    .filter((alert) => alertMatchesWatchlist(alert, input.watchlist, normalizedTerm))
    .filter((alert) => alertBelongsToOrg(alert, input.tenantId, input.organizationId));
  const matchedContracts = matchedAlerts.map((alert) => buildAlertWorkflowContract({ alert, checkedAt: input.checkedAt }));

  const preservationBlockers = matchedContracts.flatMap((contract) => {
    const before = input.previousByAlertId.get(contract.alertId);
    if (!before) return [];
    return validateAlertWorkflowPreservation({ before, after: contract, checkedAt: input.checkedAt }).blockers;
  });
  const provenance = mergeProvenance(matchedContracts);
  const casePaths = uniqueStrings(matchedContracts.map((alert) => alert.casePath).filter(Boolean).map(String));
  const alertDetailPaths = uniqueStrings(matchedAlerts.map(alertDetailPathFor).filter(Boolean).map(String));
  const sourceFamilies = uniqueStrings(matchedAlerts.flatMap(sourceFamiliesForAlert));
  const eventPayloads = matchedAlerts.map((alert) => bridgeEventPayload({
    alert,
    watchlist: input.watchlist,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    casePaths,
    sourceFamilies
  }));
  const blockerCodes = uniqueStrings([
    input.watchlist.status && input.watchlist.status !== "active" ? "inactive_watchlist" : undefined,
    !input.watchlist.alertGeneratorKey ? "missing_alert_generation_ref" : undefined,
    matchedContracts.length === 0 ? "alert_not_generated" : undefined,
    matchedContracts.some((alert) => alert.organizationId && alert.organizationId !== input.organizationId) ? "organization_scope_changed" : undefined,
    matchedContracts.length > 0 && alertDetailPaths.length === 0 ? "alert_detail_route_unavailable" : undefined,
    matchedAlerts.length > 0 && casePaths.length === 0 ? "case_route_unavailable" : undefined,
    matchedAlerts.length > 0 && provenance.evidenceCount === 0 && provenance.captureIds.length === 0 ? "provenance_missing" : undefined,
    preservationBlockers.length > 0 ? "workflow_not_preserved" : undefined
  ].filter(Boolean).map(String)) as OrgAlertWorkflowBridgeBlocker["code"][];

  return {
    rowId,
    watchlistId: input.watchlist.watchlistId,
    watchlistItemId: input.watchlist.watchlistItemId,
    term: input.watchlist.term,
    normalizedTerm,
    alertGeneratorKey: input.watchlist.alertGeneratorKey,
    matchedAlertIds: uniqueStrings(matchedContracts.map((alert) => alert.alertId)),
    alertDetailPaths,
    casePaths,
    sourceFamilies,
    workflowEventCount: matchedContracts.reduce((total, alert) => total + alert.workflowEventCount, 0),
    provenance,
    eventPayloads,
    ready: blockerCodes.length === 0,
    blockerCodes
  };
}

function rowBlockers(row: OrgAlertWorkflowBridgeRow): OrgAlertWorkflowBridgeBlocker[] {
  return row.blockerCodes.map((code) => ({
    code,
    ownerLane: ownerLaneFor(code),
    rowId: row.rowId,
    watchlistId: row.watchlistId,
    watchlistItemId: row.watchlistItemId,
    alertId: row.matchedAlertIds[0],
    path: pathFor(code),
    message: messageFor(code)
  }));
}

function alertMatchesWatchlist(alert: Record<string, any>, watchlist: OrgAlertWorkflowWatchlistRef, normalizedTerm: string): boolean {
  const workflow = alert.workflowContext ?? {};
  const webhook = alert.webhookContext ?? {};
  const delivery = alert.deliveryReadinessContext ?? {};
  const alertGeneratorKeys = uniqueStrings([
    ...(workflow.alertGeneratorKeys ?? []),
    ...(webhook.alertGeneratorKeys ?? []),
    ...(delivery.alertGeneratorKeys ?? [])
  ].map(String).filter(Boolean));
  const watchlistIds = uniqueStrings([
    ...(alert.watchlistIds ?? []),
    ...(workflow.watchlistIds ?? []),
    ...(delivery.watchlistIds ?? [])
  ].map(String).filter(Boolean));
  const watchlistItemIds = uniqueStrings([
    ...(alert.watchlistItemIds ?? []),
    ...(workflow.watchlistItemIds ?? []),
    ...(delivery.watchlistItemIds ?? [])
  ].map(String).filter(Boolean));
  const terms = uniqueStrings([
    alert.matchedTerm?.value,
    alert.company,
    alert.matchContext?.term,
    workflow.matchedTerm,
    delivery.matchedTerm
  ].filter(Boolean).map((term) => normalizeTerm(String(term))));

  if (watchlist.alertGeneratorKey && alertGeneratorKeys.includes(watchlist.alertGeneratorKey)) return true;
  if (watchlist.watchlistItemId && watchlistItemIds.includes(watchlist.watchlistItemId)) return true;
  if (terms.includes(normalizedTerm)) return true;
  return !watchlist.watchlistItemId && watchlistIds.includes(watchlist.watchlistId);
}

function alertBelongsToOrg(alert: Record<string, any>, tenantId: string, organizationId: string): boolean {
  const workflow = alert.workflowContext ?? {};
  const webhook = alert.webhookContext ?? {};
  const delivery = alert.deliveryReadinessContext ?? {};
  const alertTenantId = String(alert.tenantId ?? workflow.tenantId ?? webhook.tenantId ?? delivery.tenantId ?? "");
  const alertOrganizationId = String(alert.organizationId ?? workflow.organizationId ?? webhook.organizationId ?? delivery.organizationId ?? "");
  return alertTenantId === tenantId && (!alertOrganizationId || alertOrganizationId === organizationId);
}

function alertDetailPathFor(alert: Record<string, any>): string | undefined {
  return [
    alert.alertDetailPath,
    alert.workflowContext?.alertDetailPath,
    alert.webhookContext?.alertDetailPath,
    alert.deliveryReadinessContext?.alertDetailPath,
    alert.alertCreatedEvent?.alertDetailPath,
    alert.alertUpdatedEvent?.alertDetailPath
  ].find((value) => typeof value === "string" && value.trim().length > 0);
}

function sourceFamiliesForAlert(alert: Record<string, any>): string[] {
  return uniqueStrings([
    alert.sourceFamily,
    alert.workflowContext?.sourceFamily,
    alert.webhookContext?.sourceFamily,
    alert.deliveryReadinessContext?.sourceFamily,
    ...(Array.isArray(alert.evidence) ? alert.evidence.map((item: any) => item.sourceFamily) : [])
  ].filter(Boolean).map(String));
}

function bridgeEventPayload(input: {
  alert: Record<string, any>;
  watchlist: OrgAlertWorkflowWatchlistRef;
  tenantId: string;
  organizationId: string;
  casePaths: string[];
  sourceFamilies: string[];
}): OrgAlertWorkflowBridgeEventPayload {
  const contract = buildAlertWorkflowContract({ alert: input.alert });
  return {
    schemaVersion: "dwm.org_alert_workflow_event_payload.v1",
    alertId: contract.alertId,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    watchlistId: input.watchlist.watchlistId,
    watchlistItemId: input.watchlist.watchlistItemId,
    alertGeneratorKey: input.watchlist.alertGeneratorKey,
    alertDetailPath: alertDetailPathFor(input.alert),
    casePaths: input.casePaths,
    sourceFamilies: input.sourceFamilies,
    captureIds: contract.provenance.captureIds,
    evidenceCount: contract.provenance.evidenceCount,
    workflowEventCount: contract.workflowEventCount,
    dedupeKey: contract.dedupeKey
  };
}

function webhookDeliveryFor(input: {
  row: OrgAlertWorkflowBridgeRow;
  payload?: OrgAlertWorkflowBridgeEventPayload;
  bridge: OrgAlertWorkflowBridgeReport;
  destinationById: Map<string, OrgAlertWebhookDestinationRef>;
  destinationIds: string[];
}): OrgAlertWebhookFixtureDelivery {
  const destinations = input.destinationIds.map((destinationId) => input.destinationById.get(destinationId)).filter(Boolean) as OrgAlertWebhookDestinationRef[];
  const destinationKinds = uniqueStrings(destinations.map((destination) => destination.kind ?? "webhook"));
  const alertId = input.payload?.alertId ?? input.row.matchedAlertIds[0] ?? "";
  const blockerCodes = uniqueStrings([
    !input.row.ready ? "bridge_row_not_ready" : undefined,
    !input.payload ? "missing_alert_event_payload" : undefined,
    input.destinationIds.length === 0 ? "missing_webhook_destination" : undefined,
    input.destinationIds.some((destinationId) => !input.destinationById.has(destinationId)) ? "webhook_destination_not_found" : undefined,
    destinations.some((destination) => destination.tenantId !== input.bridge.tenantId || destination.organizationId !== input.bridge.organizationId) ? "webhook_destination_scope_mismatch" : undefined,
    destinations.some((destination) => destination.status !== "active" || destination.verified !== true) ? "webhook_destination_not_verified" : undefined
  ].filter(Boolean).map(String)) as OrgAlertWebhookFixtureBlocker["code"][];

  return {
    deliveryId: stableId("org_alert_webhook_delivery", `${input.bridge.tenantId}:${input.bridge.organizationId}:${input.row.rowId}:${alertId}:${input.destinationIds.join(",")}`),
    rowId: input.row.rowId,
    alertId,
    watchlistId: input.row.watchlistId,
    watchlistItemId: input.row.watchlistItemId,
    ready: blockerCodes.length === 0,
    blockerCodes,
    destinationIds: input.destinationIds,
    destinationKinds,
    payload: {
      schemaVersion: DWM_ORG_ALERT_WEBHOOK_DELIVERY_PAYLOAD_SCHEMA_VERSION,
      tenantId: input.bridge.tenantId,
      organizationId: input.bridge.organizationId,
      alertId,
      watchlistId: input.row.watchlistId,
      watchlistItemId: input.row.watchlistItemId,
      webhookDestinationIds: input.destinationIds,
      deliveryKind: destinationKinds.includes("discord") ? "discord" : destinationKinds[0] ?? "webhook",
      alertDetailPath: input.payload?.alertDetailPath,
      casePaths: input.payload?.casePaths ?? input.row.casePaths,
      sourceFamilies: input.payload?.sourceFamilies ?? input.row.sourceFamilies,
      captureIds: input.payload?.captureIds ?? input.row.provenance.captureIds,
      evidenceCount: input.payload?.evidenceCount ?? input.row.provenance.evidenceCount,
      workflowEventCount: input.payload?.workflowEventCount ?? input.row.workflowEventCount,
      dedupeKey: input.payload?.dedupeKey,
      idempotencyKey: stableId("org_alert_webhook_idempotency", `${input.bridge.organizationId}:${alertId}:${input.row.watchlistId}:${input.row.watchlistItemId ?? ""}:${input.destinationIds.join(",")}`)
    }
  };
}

function destinationIdsForRow(
  row: OrgAlertWorkflowBridgeRow,
  byWatchlistId?: Record<string, string[]>,
  byWatchlistItemId?: Record<string, string[]>
): string[] {
  return uniqueStrings([
    ...(byWatchlistId?.[row.watchlistId] ?? []),
    ...(row.watchlistItemId ? byWatchlistItemId?.[row.watchlistItemId] ?? [] : [])
  ]);
}

function deliveryBlockers(
  delivery: OrgAlertWebhookFixtureDelivery,
  bridge: OrgAlertWorkflowBridgeReport,
  destinationById: Map<string, OrgAlertWebhookDestinationRef>
): OrgAlertWebhookFixtureBlocker[] {
  return delivery.blockerCodes.flatMap((code) => {
    if (code === "webhook_destination_not_found" || code === "webhook_destination_scope_mismatch" || code === "webhook_destination_not_verified") {
      const destinationIds = delivery.destinationIds.length ? delivery.destinationIds : [undefined];
      return destinationIds
        .filter((destinationId) => shouldReportDestinationBlocker(code, destinationId, bridge, destinationById))
        .map((destinationId) => webhookBlocker(code, delivery, destinationId));
    }
    return [webhookBlocker(code, delivery)];
  });
}

function shouldReportDestinationBlocker(
  code: OrgAlertWebhookFixtureBlocker["code"],
  destinationId: string | undefined,
  bridge: OrgAlertWorkflowBridgeReport,
  destinationById: Map<string, OrgAlertWebhookDestinationRef>
): boolean {
  if (!destinationId) return false;
  const destination = destinationById.get(destinationId);
  if (code === "webhook_destination_not_found") return !destination;
  if (!destination) return false;
  if (code === "webhook_destination_scope_mismatch") return destination.tenantId !== bridge.tenantId || destination.organizationId !== bridge.organizationId;
  if (code === "webhook_destination_not_verified") return destination.status !== "active" || destination.verified !== true;
  return false;
}

function webhookBlocker(
  code: OrgAlertWebhookFixtureBlocker["code"],
  delivery: OrgAlertWebhookFixtureDelivery,
  destinationId?: string
): OrgAlertWebhookFixtureBlocker {
  return {
    code,
    ownerLane: webhookOwnerLaneFor(code),
    rowId: delivery.rowId,
    alertId: delivery.alertId || undefined,
    watchlistId: delivery.watchlistId,
    watchlistItemId: delivery.watchlistItemId,
    destinationId,
    path: webhookPathFor(code),
    message: webhookMessageFor(code)
  };
}

function webhookOwnerLaneFor(code: OrgAlertWebhookFixtureBlocker["code"]): OrgAlertWebhookFixtureBlocker["ownerLane"] {
  if (code === "bridge_row_not_ready") return "alert";
  if (code === "missing_alert_event_payload") return "alert";
  return "webhook";
}

function webhookPathFor(code: OrgAlertWebhookFixtureBlocker["code"]): string {
  if (code === "bridge_row_not_ready") return "bridge.rows[].ready";
  if (code === "missing_alert_event_payload") return "bridge.rows[].eventPayloads";
  if (code === "missing_webhook_destination") return "destinationIdsByWatchlistId";
  if (code === "webhook_destination_scope_mismatch") return "destinations[].organizationId";
  if (code === "webhook_destination_not_verified") return "destinations[].verified";
  return "destinations[].destinationId";
}

function webhookMessageFor(code: OrgAlertWebhookFixtureBlocker["code"]): string {
  if (code === "bridge_row_not_ready") return "Org alert workflow bridge row is not ready for delivery.";
  if (code === "missing_alert_event_payload") return "Org alert workflow bridge row has no alert event payload.";
  if (code === "missing_webhook_destination") return "No webhook destination is mapped to this watchlist row.";
  if (code === "webhook_destination_scope_mismatch") return "Webhook destination does not belong to the alert organization.";
  if (code === "webhook_destination_not_verified") return "Webhook destination is not active and verified.";
  return "Webhook destination is not available.";
}

function mergeProvenance(contracts: DwmAlertWorkflowContract[]): OrgAlertWorkflowBridgeRow["provenance"] {
  return {
    evidenceCount: contracts.reduce((total, contract) => total + contract.provenance.evidenceCount, 0),
    captureIds: uniqueStrings(contracts.flatMap((contract) => contract.provenance.captureIds)),
    sourceIds: uniqueStrings(contracts.flatMap((contract) => contract.provenance.sourceIds)),
    contentHashes: uniqueStrings(contracts.flatMap((contract) => contract.provenance.contentHashes))
  };
}

function ownerLaneFor(code: OrgAlertWorkflowBridgeBlocker["code"]): OrgAlertWorkflowBridgeBlocker["ownerLane"] {
  if (code === "inactive_watchlist" || code === "missing_alert_generation_ref") return "watchlist";
  if (code === "case_route_unavailable") return "case";
  if (code === "provenance_missing") return "source";
  return "alert";
}

function pathFor(code: OrgAlertWorkflowBridgeBlocker["code"]): string {
  if (code === "inactive_watchlist") return "watchlist.status";
  if (code === "missing_alert_generation_ref") return "watchlist.alertGeneratorKey";
  if (code === "alert_detail_route_unavailable") return "alert.alertDetailPath";
  if (code === "case_route_unavailable") return "alert.casePath";
  if (code === "provenance_missing") return "alert.provenance";
  if (code === "organization_scope_changed") return "alert.organizationId";
  if (code === "workflow_not_preserved") return "alert.workflow";
  return "alert.id";
}

function messageFor(code: OrgAlertWorkflowBridgeBlocker["code"]): string {
  if (code === "inactive_watchlist") return "Watchlist item is not active.";
  if (code === "missing_alert_generation_ref") return "Watchlist item is missing an alert generation reference.";
  if (code === "alert_detail_route_unavailable") return "Matched alert is missing a detail route.";
  if (code === "case_route_unavailable") return "Matched alert is missing a case route.";
  if (code === "provenance_missing") return "Matched alert is missing evidence provenance.";
  if (code === "organization_scope_changed") return "Matched alert does not belong to the requested organization.";
  if (code === "workflow_not_preserved") return "Matched alert dropped workflow state compared with the previous record.";
  return "No alert exists for this watchlist item.";
}

function normalizeTerm(value: string) {
  return String(value).trim().toLowerCase();
}
