import { nowIso, stableId } from "../utils.ts";
import { buildOrgAlertCaseActionTimeline, type OrgAlertCaseActionTimelineRow } from "../product/orgAlertCaseActionTimeline.ts";
import { buildOrgAlertCaseActionLedgerApiList } from "../storage/orgAlertCaseActionLedgerPostgres.ts";
import { json, readJson } from "./http.ts";
import { resolveOrganizationScope } from "./organizationRoutes.ts";
import type { OrganizationMember } from "./organizationRoutes.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

type CaseStatus = "open" | "escalated" | "suppressed" | "false_positive" | "closed";
type CasePriority = "critical" | "high" | "medium" | "low";
type CaseAccessMode = "read" | "mutate";

type AnalystCaseEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  idempotencyKey?: string;
  transitionKey?: string;
  replayState?: "recorded" | "replayed";
  auditEventId?: string;
  fromStatus?: CaseStatus;
  toStatus?: CaseStatus;
  fromOwner?: string;
  toOwner?: string;
  note?: string;
};

type CaseCustomerNotificationReceipt = {
  schemaVersion: "analyst.case_customer_notification.v1";
  id: string;
  caseId: string;
  tenantId: string;
  organizationId?: string;
  alertId?: string;
  at: string;
  actor: string;
  deliveryMode: "webhook_delivery" | "manual_handoff";
  rationale: string;
  idempotencyKey: string;
  webhookDeliveryId?: string;
  webhookDestinationId?: string;
  webhookStatus?: string;
  externalReference?: string;
  evidence: {
    evidenceCount: number;
    deliveryCount: number;
    delivered: boolean;
    contentHashes: string[];
    sourceIds: string[];
  };
};

type CaseHandoffActionReceipt = {
  schemaVersion: "dwm.case_handoff_action_receipt.v1";
  id: string;
  caseId: string;
  tenantId: string;
  organizationId?: string;
  alertId?: string;
  actionId: "alertReplay" | "webhookDryRun";
  at: string;
  actor: string;
  route?: string;
  method?: string;
  idempotencyKey: string;
  dedupeKey?: string;
  workflowEventId: string;
  auditEventId?: string;
  execution: {
    state: "recorded";
    dryRun: boolean;
    delegated: boolean;
  };
  provenance: {
    captureIds: string[];
    sourceIds: string[];
    contentHashes: string[];
    evidenceCount: number;
    blockerCodes: string[];
  };
};

type AnalystCase = {
  id: string;
  tenantId: string;
  organizationId?: string;
  sourceType: "dwm_alert" | "ti_actor" | "manual";
  sourceId: string;
  alertId?: string;
  title: string;
  summary: string;
  priority: CasePriority;
  status: CaseStatus;
  assignedOwner?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  workflowEvents: AnalystCaseEvent[];
  customerNotifications?: CaseCustomerNotificationReceipt[];
  handoffActionReceipts?: CaseHandoffActionReceipt[];
  lastDecision?: string;
  deliveryState?: string;
};

export function listCases(url: URL, options: ApiServerOptions, request?: Request): Response {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const filters = caseFiltersFromUrl(url);
  const cases = ((options.store as any).listCases?.() ?? [])
    .filter((row: AnalystCase) => row.tenantId === scope.tenantId)
    .filter((row: AnalystCase) => caseMatchesOrganizationScope(row, scope.organizationId))
    .filter((row: AnalystCase) => caseMatchesFilters(row, filters, options))
    .sort((a: AnalystCase, b: AnalystCase) => sortCaseQueue(a, b));
  const items = cases.map((caseRecord: AnalystCase) => caseListItem(caseRecord, options, access));
  return json({
    schemaVersion: "analyst.case_list.v1",
    generatedAt: nowIso(),
    organization: scope.organization,
    access: caseAccessSummary(access),
    filters,
    total: cases.length,
    cases,
    items
  });
}

export async function createCase(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  return createCaseFromBody(body, request, options);
}

export async function createCaseFromDwmAlert(request: Request, options: ApiServerOptions, alertId: string | undefined): Promise<Response> {
  const body = await readJson<any>(request);
  const routeAlertId = String(alertId ?? "").trim();
  if (!routeAlertId) return json({ error: { code: "missing_alert_id", message: "A DWM alert ID is required to open a case." } }, 400);
  const requestedAlertId = String(body.alertId ?? body.sourceId ?? routeAlertId).trim();
  if (requestedAlertId !== routeAlertId) {
    return json({ error: { code: "alert_id_mismatch", message: "Case handoff alert id must match the route alert id." } }, 400);
  }
  return createCaseFromBody({ ...body, alertId: routeAlertId, sourceId: routeAlertId }, request, options, {
    includeHandoff: true,
    requireAlertProvenance: true,
    route: `/v1/dwm/alerts/${encodeURIComponent(routeAlertId)}/case-handoff`
  });
}

async function createCaseFromBody(
  body: any,
  request: Request,
  options: ApiServerOptions,
  handoffOptions: { includeHandoff?: boolean; requireAlertProvenance?: boolean; route?: string } = {}
): Promise<Response> {
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  const generatedAt = nowIso();
  const actor = String(body.actor ?? request.headers.get("x-actor-id") ?? "case-api");
  const alertId = String(body.alertId ?? body.sourceId ?? "").trim();
  if (!alertId) return json({ error: { code: "missing_alert_id", message: "A DWM alert ID is required to open a case." } }, 400);

  const alert = findDwmAlert(options, alertId);
  if (!alert || alert.tenantId !== scope.tenantId || !alertMatchesOrganizationScope(alert, scope.organizationId)) {
    return json({ error: { code: "alert_not_found", message: "DWM alert not found for this organization." } }, 404);
  }
  const provenance = alertCaseHandoffProvenance(alert);
  if (handoffOptions.requireAlertProvenance && provenance.blockers.length) {
    return json({
      error: { code: "missing_alert_provenance", message: "Alert case handoff requires source provenance." },
      alertId: alert.id,
      organizationId: scope.organizationId,
      blockers: provenance.blockers
    }, 409);
  }

  const id = String(body.id ?? alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate ?? stableId("case", `${scope.tenantId}:${alert.id}`));
  const existing = (options.store as any).getCase?.(id) ?? findCaseByAlert(options, scope.tenantId, alert.id);
  const idempotencyKey = normalizeNote(body.idempotencyKey ?? request.headers.get("idempotency-key") ?? request.headers.get("x-idempotency-key"));
  if (existing && body.reopen !== true) {
    return json({
      organization: scope.organization,
      access: caseAccessSummary(access),
      case: existing,
      alert,
      alertCaseHandoff: handoffOptions.includeHandoff ? buildAlertCaseHandoff({
        caseRecord: existing,
        alert,
        route: handoffOptions.route,
        idempotencyKey,
        replayState: "reused",
        provenance
      }) : undefined
    }, 200);
  }

  const assignedOwner = normalizeOwner(body.assignedOwner ?? body.owner);
  const ownerValidation = validateAssignedOwner(options, scope.organizationId, assignedOwner);
  if (ownerValidation) return ownerValidation;
  const note = normalizeNote(body.note ?? "Case opened from DWM alert.");
  const event = caseEvent({
    caseId: id,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId ?? alert.organizationId,
    generatedAt,
    actor,
    action: existing ? "reopen" : "open",
    idempotencyKey,
    fromStatus: existing?.status,
    toStatus: "open",
    fromOwner: existing?.assignedOwner,
    toOwner: assignedOwner ?? existing?.assignedOwner,
    note
  });
  const caseRecord: AnalystCase = {
    id,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId ?? alert.organizationId,
    sourceType: "dwm_alert",
    sourceId: alert.id,
    alertId: alert.id,
    title: String(body.title ?? `${String(alert.severity ?? "medium").toUpperCase()} ${alert.company ?? alert.matchedTerm?.value ?? "DWM alert"}`),
    summary: String(body.summary ?? alert.claimSummary ?? "DWM alert requires analyst review."),
    priority: normalizePriority(body.priority ?? alert.severity),
    status: "open",
    assignedOwner: assignedOwner ?? existing?.assignedOwner,
    createdAt: existing?.createdAt ?? generatedAt,
    updatedAt: generatedAt,
    workflowEvents: [...(existing?.workflowEvents ?? []), event],
    lastDecision: note,
    deliveryState: alert.deliveryState
  };
  const saved = (options.store as any).saveCase(caseRecord);
  syncAlertForCase(options, alert, saved, event);
  const syncedAlert = findDwmAlert(options, alert.id);
  return json({
    organization: scope.organization,
    access: caseAccessSummary(access),
    case: saved,
    alert: syncedAlert,
    alertCaseHandoff: handoffOptions.includeHandoff ? buildAlertCaseHandoff({
      caseRecord: saved,
      alert: syncedAlert ?? alert,
      route: handoffOptions.route,
      idempotencyKey,
      replayState: "recorded",
      event,
      provenance
    }) : undefined
  }, existing ? 200 : 201);
}

export function getCaseDetail(url: URL, options: ApiServerOptions, caseId: string | undefined, request?: Request): Response {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const caseRecord = findCase(options, caseId);
  if (!caseRecord || caseRecord.tenantId !== scope.tenantId || !caseMatchesOrganizationScope(caseRecord, scope.organizationId)) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);
  return json(buildCaseDetail(caseRecord, options, scope.organization, access));
}

export function listCaseHandoffActions(url: URL, options: ApiServerOptions, caseId: string | undefined, request?: Request): Response {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const caseRecord = findCase(options, caseId);
  if (!caseRecord || caseRecord.tenantId !== scope.tenantId || !caseMatchesOrganizationScope(caseRecord, scope.organizationId)) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);
  return json(buildCaseHandoffActionHistory(caseRecord, options, scope.organization, access, {
    actionId: normalizeHandoffActionId(url.searchParams.get("actionId") ?? url.searchParams.get("action")),
    idempotencyKey: normalizeNote(url.searchParams.get("idempotencyKey") ?? url.searchParams.get("idempotency")),
    dedupeKey: normalizeNote(url.searchParams.get("dedupeKey") ?? url.searchParams.get("dedupe")),
    actor: normalizeNote(url.searchParams.get("actor"))
  }));
}

export function exportCaseActionReplay(url: URL, options: ApiServerOptions, caseId: string | undefined, request?: Request): Response {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const caseRecord = findCase(options, caseId);
  if (!caseRecord || caseRecord.tenantId !== scope.tenantId || !caseMatchesOrganizationScope(caseRecord, scope.organizationId)) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);
  return json(buildCaseActionReplayExport(caseRecord, options, scope.organization, access, {
    actionId: normalizeHandoffActionId(url.searchParams.get("actionId") ?? url.searchParams.get("action")),
    idempotencyKey: normalizeNote(url.searchParams.get("idempotencyKey") ?? url.searchParams.get("idempotency")),
    eventAction: normalizeNote(url.searchParams.get("eventAction") ?? url.searchParams.get("workflowAction"))
  }));
}

export function exportCaseEvidence(url: URL, options: ApiServerOptions, caseId: string | undefined, request?: Request): Response {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const caseRecord = findCase(options, caseId);
  if (!caseRecord || caseRecord.tenantId !== scope.tenantId || !caseMatchesOrganizationScope(caseRecord, scope.organizationId)) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);
  return json(buildCaseExport(caseRecord, options, scope.organization, access, exportOptionsFromUrl(url)));
}

export async function recordCaseCustomerNotification(request: Request, options: ApiServerOptions, caseId: string | undefined): Promise<Response> {
  const existing = findCase(options, caseId);
  if (!existing) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);
  const body = await readJson<any>(request);
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  if (existing.tenantId !== scope.tenantId || !caseMatchesOrganizationScope(existing, scope.organizationId)) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);

  const alert = findDwmAlert(options, existing.alertId);
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === existing.alertId);
  const generatedAt = nowIso();
  const actor = String(body.actor ?? request.headers.get("x-actor-id") ?? request.headers.get("x-user-email") ?? "case-api");
  const rationale = normalizeNote(body.rationale ?? body.note);
  if (!rationale) return json({ error: { code: "missing_rationale", message: "Recording customer notification requires analyst rationale." } }, 400);

  const deliveryMode = body.deliveryMode === "manual_handoff" ? "manual_handoff" : "webhook_delivery";
  const externalReference = normalizeNote(body.externalReference ?? body.reference);
  const selectedDelivery = selectNotificationDelivery(deliveries, body.webhookDeliveryId);
  if (deliveryMode === "webhook_delivery" && !selectedDelivery) {
    return json({ error: { code: "missing_delivered_webhook", message: "Select a delivered webhook delivery or record a manual handoff reference." } }, 400);
  }
  if (deliveryMode === "manual_handoff" && !externalReference) {
    return json({ error: { code: "missing_external_reference", message: "Manual customer handoff requires an external reference." } }, 400);
  }

  const idempotencyKey = stableId("case_customer_notification_idempotency", `${existing.tenantId}:${existing.organizationId ?? ""}:${existing.id}:${deliveryMode}:${selectedDelivery?.id ?? externalReference ?? ""}`);
  const existingReceipt = (existing.customerNotifications ?? []).find((receipt) => receipt.idempotencyKey === idempotencyKey);
  if (existingReceipt) {
    return json({
      organization: scope.organization,
      access: caseAccessSummary(access),
      created: false,
      receipt: existingReceipt,
      case: existing,
      detail: buildCaseDetail(existing, options, scope.organization, access)
    });
  }

  const evidenceItems = alert?.evidence ?? [];
  const receipt: CaseCustomerNotificationReceipt = {
    schemaVersion: "analyst.case_customer_notification.v1",
    id: stableId("case_customer_notification", `${existing.id}:${generatedAt}:${deliveryMode}:${selectedDelivery?.id ?? externalReference ?? ""}`),
    caseId: existing.id,
    tenantId: existing.tenantId,
    organizationId: existing.organizationId,
    alertId: existing.alertId,
    at: generatedAt,
    actor,
    deliveryMode,
    rationale,
    idempotencyKey,
    webhookDeliveryId: selectedDelivery?.id,
    webhookDestinationId: selectedDelivery?.webhookDestinationId,
    webhookStatus: selectedDelivery?.status,
    externalReference,
    evidence: {
      evidenceCount: evidenceItems.length,
      deliveryCount: deliveries.length,
      delivered: deliveries.some((delivery: any) => delivery.status === "delivered"),
      contentHashes: uniqueCaseStrings(evidenceItems.map((item: any) => item.contentHash)),
      sourceIds: uniqueCaseStrings(evidenceItems.map((item: any) => item.sourceId))
    }
  };
  const event = caseEvent({
    caseId: existing.id,
    tenantId: existing.tenantId,
    organizationId: existing.organizationId,
    generatedAt,
    actor,
    action: "customer_notified",
    fromStatus: existing.status,
    toStatus: existing.status,
    fromOwner: existing.assignedOwner,
    toOwner: existing.assignedOwner,
    note: rationale
  });
  const caseRecord: AnalystCase = {
    ...existing,
    updatedAt: generatedAt,
    workflowEvents: [...(existing.workflowEvents ?? []), event],
    customerNotifications: [...(existing.customerNotifications ?? []), receipt],
    lastDecision: rationale,
    deliveryState: selectedDelivery?.status === "delivered" ? "delivered" : existing.deliveryState
  };
  const saved = (options.store as any).saveCase(caseRecord);
  if (alert) syncAlertForCase(options, alert, saved, event);
  return json({
    organization: scope.organization,
    access: caseAccessSummary(access),
    created: true,
    receipt,
    case: saved,
    event,
    alert: alert ? findDwmAlert(options, alert.id) : undefined,
    detail: buildCaseDetail(saved, options, scope.organization, access)
  }, 201);
}

export async function recordCaseHandoffAction(request: Request, options: ApiServerOptions, caseId: string | undefined): Promise<Response> {
  const existing = findCase(options, caseId);
  if (!existing) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);
  const body = await readJson<any>(request);
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  if (existing.tenantId !== scope.tenantId || !caseMatchesOrganizationScope(existing, scope.organizationId)) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);

  const alert = findDwmAlert(options, existing.alertId);
  if (!alert) return json({ error: { code: "missing_case_alert", message: "Case is not linked to a persisted DWM alert." } }, 409);
  const actionId = normalizeHandoffActionId(body.actionId ?? body.action);
  if (!actionId) return json({ error: { code: "unsupported_handoff_action", message: "Handoff action must be alertReplay or webhookDryRun." } }, 400);

  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === existing.alertId);
  const handoff = buildAlertCaseHandoff({
    caseRecord: existing,
    alert,
    route: `/v1/dwm/alerts/${encodeURIComponent(alert.id)}/case-handoff`,
    replayState: "reused",
    provenance: alertCaseHandoffProvenance(alert)
  });
  const actionReadiness = buildCaseHandoffActionReadiness({ caseRecord: existing, handoff, deliveries, access });
  const action = actionReadiness.actions[actionId];
  if (!action?.ready) {
    return json({
      error: { code: "handoff_action_not_ready", message: "Case handoff action is not ready for this case." },
      actionId,
      blockerCodes: action?.blockerCodes ?? ["unsupported_handoff_action"],
      blockers: action?.blockers ?? [],
      handoffActionReadiness: actionReadiness
    }, 409);
  }

  const generatedAt = nowIso();
  const actor = String(body.actor ?? request.headers.get("x-actor-id") ?? request.headers.get("x-user-email") ?? "case-api");
  const idempotencyKey = normalizeNote(body.idempotencyKey ?? request.headers.get("idempotency-key") ?? request.headers.get("x-idempotency-key"))
    ?? action.idempotencyKey
    ?? stableId("case_handoff_action_idempotency", `${existing.tenantId}:${existing.organizationId ?? ""}:${existing.id}:${actionId}:${action.route ?? ""}`);
  const duplicateReceipt = (existing.handoffActionReceipts ?? []).find((receipt) => receipt.actionId === actionId && receipt.idempotencyKey === idempotencyKey);
  if (duplicateReceipt) {
    return json({
      organization: scope.organization,
      access: caseAccessSummary(access),
      created: false,
      duplicate: true,
      receipt: duplicateReceipt,
      case: existing,
      handoffActionReadiness: actionReadiness,
      detail: buildCaseDetail(existing, options, scope.organization, access)
    });
  }

  const note = normalizeNote(body.note ?? (actionId === "alertReplay" ? "Recorded alert replay handoff action." : "Recorded webhook dry-run handoff action."));
  const event = caseEvent({
    caseId: existing.id,
    tenantId: existing.tenantId,
    organizationId: existing.organizationId,
    generatedAt,
    actor,
    action: actionId === "alertReplay" ? "handoff_alert_replay" : "handoff_webhook_dry_run",
    idempotencyKey,
    fromStatus: existing.status,
    toStatus: existing.status,
    fromOwner: existing.assignedOwner,
    toOwner: existing.assignedOwner,
    note
  });
  const receipt: CaseHandoffActionReceipt = {
    schemaVersion: "dwm.case_handoff_action_receipt.v1",
    id: stableId("case_handoff_action_receipt", `${existing.id}:${actionId}:${idempotencyKey}`),
    caseId: existing.id,
    tenantId: existing.tenantId,
    organizationId: existing.organizationId,
    alertId: existing.alertId,
    actionId,
    at: generatedAt,
    actor,
    route: action.route,
    method: action.method,
    idempotencyKey,
    dedupeKey: action.dedupeKey,
    workflowEventId: event.id,
    auditEventId: event.auditEventId,
    execution: {
      state: "recorded",
      dryRun: actionId === "webhookDryRun",
      delegated: true
    },
    provenance: {
      captureIds: actionReadiness.provenance.captureIds,
      sourceIds: actionReadiness.provenance.sourceIds,
      contentHashes: actionReadiness.provenance.contentHashes,
      evidenceCount: actionReadiness.provenance.evidenceCount,
      blockerCodes: action.blockerCodes
    }
  };
  const caseRecord: AnalystCase = {
    ...existing,
    updatedAt: generatedAt,
    workflowEvents: [...(existing.workflowEvents ?? []), event],
    handoffActionReceipts: [...(existing.handoffActionReceipts ?? []), receipt],
    lastDecision: note
  };
  const saved = (options.store as any).saveCase(caseRecord);
  syncAlertForCase(options, alert, saved, event);
  return json({
    organization: scope.organization,
    access: caseAccessSummary(access),
    created: true,
    duplicate: false,
    receipt,
    case: saved,
    event,
    workflowTransition: caseWorkflowTransition(saved, event),
    alert: findDwmAlert(options, alert.id),
    handoffActionReadiness: buildCaseDetail(saved, options, scope.organization, access).handoffActionReadiness,
    detail: buildCaseDetail(saved, options, scope.organization, access)
  }, 201);
}

export async function updateCase(request: Request, options: ApiServerOptions, caseId: string | undefined): Promise<Response> {
  const existing = findCase(options, caseId);
  if (!existing) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);
  const body = await readJson<any>(request);
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  if (existing.tenantId !== scope.tenantId || !caseMatchesOrganizationScope(existing, scope.organizationId)) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);

  const generatedAt = nowIso();
  const actor = String(body.actor ?? request.headers.get("x-actor-id") ?? "case-api");
  const action = normalizeAction(body.action, body.status);
  const unsupportedAction = unsupportedCaseAction(action);
  if (unsupportedAction) return unsupportedAction;
  const nextStatus = statusForAction(action, body.status, existing.status);
  const transitionError = validateCaseTransition(existing, action, nextStatus);
  if (transitionError) return transitionError;
  const note = normalizeNote(body.note);
  if ((action === "close" || nextStatus === "closed" || action === "false_positive" || action === "suppress") && !note) {
    return json({ error: { code: "missing_decision_rationale", message: "Closing, suppressing, or marking false positive requires an analyst note." } }, 400);
  }
  const assignedOwner = body.assignedOwner === undefined && body.owner === undefined ? existing.assignedOwner : normalizeOwner(body.assignedOwner ?? body.owner);
  const ownerValidation = validateAssignedOwner(options, scope.organizationId, assignedOwner);
  if (ownerValidation) return ownerValidation;
  const idempotencyKey = normalizeNote(body.idempotencyKey ?? request.headers.get("idempotency-key") ?? request.headers.get("x-idempotency-key"));
  const replayedEvent = idempotencyKey ? (existing.workflowEvents ?? []).find((item) => item.idempotencyKey === idempotencyKey) : undefined;
  if (replayedEvent) {
    return json({
      organization: scope.organization,
      access: caseAccessSummary(access),
      replayed: true,
      duplicate: true,
      case: existing,
      event: replayedEvent,
      workflowTransition: caseWorkflowTransition(existing, { ...replayedEvent, replayState: "replayed" }),
      detail: buildCaseDetail(existing, options, scope.organization, access)
    });
  }
  const event = caseEvent({
    caseId: existing.id,
    tenantId: existing.tenantId,
    organizationId: existing.organizationId,
    generatedAt,
    actor,
    action,
    idempotencyKey,
    fromStatus: existing.status,
    toStatus: nextStatus,
    fromOwner: existing.assignedOwner,
    toOwner: assignedOwner,
    note
  });
  const caseRecord: AnalystCase = {
    ...existing,
    status: nextStatus,
    assignedOwner,
    updatedAt: generatedAt,
    closedAt: nextStatus === "closed" ? generatedAt : nextStatus === "open" ? undefined : existing.closedAt,
    workflowEvents: [...(existing.workflowEvents ?? []), event],
    lastDecision: note ?? existing.lastDecision
  };
  const saved = (options.store as any).saveCase(caseRecord);
  const alert = findDwmAlert(options, existing.alertId);
  if (alert) syncAlertForCase(options, alert, saved, event);
  return json({
    organization: scope.organization,
    access: caseAccessSummary(access),
    replayed: false,
    duplicate: false,
    case: saved,
    event,
    workflowTransition: caseWorkflowTransition(saved, event),
    alert: alert ? findDwmAlert(options, alert.id) : undefined
  });
}

function buildCaseDetail(caseRecord: AnalystCase, options: ApiServerOptions, organization: unknown, access?: CaseAccessResult) {
  const alert = findDwmAlert(options, caseRecord.alertId);
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === caseRecord.alertId);
  const watchlists = caseWatchlists(options, alert, caseRecord);
  const caseActionLedger = buildCaseActionLedgerTimeline(caseRecord, options, alert);
  const timeline = buildCaseTimeline(caseRecord, alert, deliveries, caseActionLedger.rows);
  const alertCaseHandoffContext = alert ? buildAlertCaseHandoff({
    caseRecord,
    alert,
    route: `/v1/dwm/alerts/${encodeURIComponent(alert.id)}/case-handoff`,
    replayState: "reused",
    provenance: alertCaseHandoffProvenance(alert)
  }) : undefined;

  return {
    schemaVersion: "analyst.case_detail.v1",
    generatedAt: nowIso(),
    organization,
    access: caseAccessSummary(access),
    case: caseRecord,
    workflowState: caseWorkflowSummary(caseRecord),
    alertCaseHandoffContext,
    handoffActionReadiness: alertCaseHandoffContext ? buildCaseHandoffActionReadiness({
      caseRecord,
      handoff: alertCaseHandoffContext,
      deliveries,
      access
    }) : undefined,
    alert,
    alertContext: alert ? {
      id: alert.id,
      caseIdCandidate: alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate,
      casePath: alert.casePath ?? alert.workflowContext?.casePath,
      workflowContext: alert.workflowContext,
      webhookContext: alert.webhookContext,
      provenance: alert.provenance,
      workflowEvents: alert.workflowEvents ?? [],
      reviewState: alert.reviewState,
      deliveryState: alert.deliveryState,
      assignedOwner: alert.assignedOwner,
      workflowNote: alert.workflowNote
    } : undefined,
    watchlists,
    deliveryContext: {
      deliveryCount: deliveries.length,
      latestDelivery: deliveries.sort((a: any, b: any) => String(b.attemptedAt ?? "").localeCompare(String(a.attemptedAt ?? "")))[0],
      delivered: deliveries.some((delivery: any) => delivery.status === "delivered"),
      failed: deliveries.filter((delivery: any) => delivery.status === "failed"),
      retryable: deliveries.some((delivery: any) => delivery.status === "failed" || delivery.status === "skipped")
    },
    customerNotificationContext: customerNotificationContext(caseRecord),
    handoffActionReceipts: caseRecord.handoffActionReceipts ?? [],
    handoffActionReceiptContext: handoffActionReceiptContext(caseRecord),
    caseActionLedgerContext: caseActionLedgerContext(caseActionLedger),
    deliveries,
    evidence: alert?.evidence ?? [],
    timeline,
    nextActions: nextActionsForCase(caseRecord, alert, deliveries),
    nextAllowedActions: nextAllowedActionsForCase(caseRecord, alert, deliveries, access)
  };
}

type CaseExportOptions = {
  shape: "compact" | "full";
  includeTimeline: boolean;
  includeEvidence: boolean;
  includeNextActionPayloads: boolean;
};

function exportOptionsFromUrl(url: URL): CaseExportOptions {
  const shape = url.searchParams.get("shape") === "compact" || url.searchParams.get("compact") === "true" ? "compact" : "full";
  return {
    shape,
    includeTimeline: url.searchParams.get("timeline") !== "false" && shape !== "compact",
    includeEvidence: url.searchParams.get("evidence") !== "false",
    includeNextActionPayloads: url.searchParams.get("nextActionPayloads") !== "false"
  };
}

function buildCaseExport(caseRecord: AnalystCase, options: ApiServerOptions, organization: unknown, access: CaseAccessResult | undefined, exportOptions: CaseExportOptions) {
  const alert = findDwmAlert(options, caseRecord.alertId);
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === caseRecord.alertId);
  const watchlists = caseWatchlists(options, alert, caseRecord);
  const caseActionLedger = buildCaseActionLedgerTimeline(caseRecord, options, alert);
  const timeline = buildCaseTimeline(caseRecord, alert, deliveries, caseActionLedger.rows);
  const evidence = (alert?.evidence ?? []).map((item: any) => exportEvidenceItem(item, alert));
  const deliveryEvidence = deliveries.map((delivery: any) => exportDeliveryEvidence(delivery));
  const nextAllowedActions = nextAllowedActionsForCase(caseRecord, alert, deliveries, access)
    .map((action) => exportAction(action, caseRecord, access, exportOptions));
  const matchedWatchlistTerms = watchlists.flatMap((watchlist: any) => (watchlist.matchedTerms ?? []).map((term: any) => ({
    watchlistId: watchlist.id,
    watchlistName: watchlist.name,
    watchlistItemId: String(term.id ?? `${watchlist.id}:${term.value}`),
    kind: term.kind,
    value: term.value
  })));
  const summary = {
    caseId: caseRecord.id,
    title: caseRecord.title,
    status: caseRecord.status,
    priority: caseRecord.priority,
    assignedOwner: caseRecord.assignedOwner,
    organizationId: caseRecord.organizationId,
    tenantId: caseRecord.tenantId,
    alertId: alert?.id ?? caseRecord.alertId,
    dedupeKey: alert?.dedupeKey ?? alert?.webhookDelivery?.dedupeKey ?? alert?.workflowContext?.dedupeKey,
    severity: alert?.severity ?? caseRecord.priority,
    recommendedRoute: alert?.recommendedRoute ?? alert?.webhookDelivery?.recommendedRoute ?? alert?.workflowContext?.recommendedRoute,
    createdAt: caseRecord.createdAt,
    updatedAt: caseRecord.updatedAt,
    closedAt: caseRecord.closedAt,
    evidenceCount: evidence.length,
    deliveryCount: deliveryEvidence.length,
    delivered: deliveryEvidence.some((delivery) => delivery.status === "delivered"),
    customerNotificationCount: (caseRecord.customerNotifications ?? []).length,
    latestCustomerNotificationAt: latestCaseCustomerNotification(caseRecord)?.at
  };
  const exportBody = {
    schemaVersion: "analyst.case_export.v1",
    generatedAt: nowIso(),
    exportOptions,
    organization,
    access: caseAccessSummary(access),
    summary,
    case: caseRecord,
    alertContext: alert ? {
      id: alert.id,
      caseId: alert.caseId,
      caseIdCandidate: alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate,
      casePath: alert.casePath ?? alert.workflowContext?.casePath,
      reviewState: alert.reviewState,
      deliveryState: alert.deliveryState,
      matchedTerm: alert.matchedTerm,
      workflowContext: alert.workflowContext,
      webhookContext: alert.webhookContext,
      provenance: alert.provenance
    } : undefined,
    matchedWatchlistTerms,
    evidence: exportOptions.includeEvidence ? evidence : undefined,
    evidenceSummary: evidence.map((item) => ({
      id: item.id,
      sourceName: item.sourceName,
      sourceFamily: item.sourceFamily,
      observedAt: item.observedAt,
      contentHash: item.contentHash,
      redacted: item.redaction.redacted,
      provenance: item.provenance
    })),
    timeline: exportOptions.includeTimeline ? timeline : undefined,
    timelineSummary: timeline.map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      eventType: event.eventType,
      actor: event.actor,
      source: event.source,
      related: event.related
    })),
    customerNotifications: caseRecord.customerNotifications ?? [],
    customerNotificationContext: customerNotificationContext(caseRecord),
    caseActionLedgerContext: caseActionLedgerContext(caseActionLedger),
    deliveryEvidence,
    nextAllowedActions,
    copyText: caseExportCopyText(summary, evidence, deliveryEvidence, matchedWatchlistTerms, caseRecord.customerNotifications ?? []),
    auditSafety: {
      rawSensitiveEvidenceIncluded: false,
      redactedEvidenceCount: evidence.filter((item) => item.redaction.redacted).length,
      redactionPolicy: "raw_sensitive evidence and sensitive excerpts are replaced with redaction markers; hashes, provenance, and source metadata remain for audit."
    }
  };
  return {
    ...exportBody,
    exportChecksum: stableId("case_export", JSON.stringify({
      summary,
      evidence: exportBody.evidenceSummary,
      timeline: exportBody.timelineSummary,
      deliveryEvidence,
      matchedWatchlistTerms,
      customerNotifications: caseRecord.customerNotifications ?? []
    }))
  };
}

function exportEvidenceItem(item: any, alert: any) {
  const redactionState = String(item.redactionState ?? (item.sensitive ? "raw_sensitive" : "public_excerpt"));
  const redacted = redactionState === "raw_sensitive" || item.sensitive === true;
  return {
    id: item.id,
    alertId: alert?.id,
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    sourceFamily: item.sourceFamily,
    observedAt: item.observedAt ?? item.firstSeenAt,
    captureMode: item.captureMode,
    redactionState,
    redaction: {
      redacted,
      reason: redacted ? "raw_sensitive_or_sensitive_evidence" : "public_safe_excerpt",
      rawIncluded: false
    },
    excerpt: redacted ? "[redacted: raw sensitive evidence withheld]" : item.excerpt,
    contentHash: item.contentHash,
    provenance: item.provenance,
    safeToCopy: !redacted,
    handling: redacted ? "Use hashes/provenance for audit; retrieve raw evidence only through approved evidence controls." : "Public-safe excerpt can be copied into incident handoff."
  };
}

function exportDeliveryEvidence(delivery: any) {
  return {
    id: delivery.id,
    deliveryId: delivery.id,
    alertId: delivery.alertId,
    watchlistId: delivery.watchlistId,
    webhookDestinationId: delivery.webhookDestinationId,
    status: delivery.status,
    deliveryKind: delivery.deliveryKind,
    attemptedAt: delivery.attemptedAt,
    httpStatus: delivery.httpStatus,
    endpointHash: delivery.endpointHash,
    payloadHash: delivery.payloadHash,
    dedupeKey: delivery.dedupeKey,
    dryRun: delivery.dryRun,
    error: delivery.error
  };
}

function exportAction(action: any, caseRecord: AnalystCase, access: CaseAccessResult | undefined, options: CaseExportOptions) {
  const includePayload = options.includeNextActionPayloads && access?.readOnly !== true && action.enabled;
  return {
    ...action,
    request: includePayload ? {
      method: action.method,
      path: `/v1/cases/${encodeURIComponent(caseRecord.id)}`,
      body: { action: action.id, organizationId: caseRecord.organizationId }
    } : undefined
  };
}

function caseExportCopyText(summary: any, evidence: Array<any>, deliveryEvidence: Array<any>, matchedWatchlistTerms: Array<any>, customerNotifications: Array<CaseCustomerNotificationReceipt>): string {
  const visibleEvidence = evidence.slice(0, 5).map((item) => `- ${item.sourceName ?? item.sourceFamily ?? item.id}: ${item.excerpt} (${item.contentHash})`).join("\n");
  return [
    `Case ${summary.caseId}: ${summary.title}`,
    `Status: ${summary.status}; severity: ${summary.severity}; route: ${summary.recommendedRoute ?? "unrouted"}`,
    `Alert: ${summary.alertId}; dedupe: ${summary.dedupeKey}`,
    `Matched watchlist terms: ${matchedWatchlistTerms.map((term) => `${term.kind}:${term.value}`).join(", ") || "none"}`,
    `Webhook deliveries: ${deliveryEvidence.map((delivery) => `${delivery.deliveryId}:${delivery.status}`).join(", ") || "none"}`,
    `Customer notifications: ${customerNotifications.map((receipt) => `${receipt.id}:${receipt.deliveryMode}`).join(", ") || "none"}`,
    "Evidence:",
    visibleEvidence || "- No exportable evidence."
  ].join("\n");
}

function syncAlertForCase(options: ApiServerOptions, alert: any, caseRecord: AnalystCase, event: AnalystCaseEvent) {
  const reviewState = caseRecord.status === "false_positive" ? "false_positive"
    : caseRecord.status === "suppressed" ? "false_positive_candidate"
    : caseRecord.status === "closed" ? "resolved"
    : caseRecord.status === "escalated" ? "route_to_customer"
    : event.action === "reopen" ? "reviewing"
    : alert.reviewState;
  const deliveryState = caseRecord.status === "suppressed" || caseRecord.status === "false_positive" ? "muted" : alert.deliveryState;
  (options.store as any).saveDwmAlert({
    ...alert,
    caseId: caseRecord.id,
    caseIdCandidate: alert.caseIdCandidate ?? caseRecord.id,
    casePath: alert.casePath ?? `/v1/cases/${encodeURIComponent(caseRecord.id)}?alertId=${encodeURIComponent(alert.id)}`,
    assignedOwner: caseRecord.assignedOwner,
    reviewState,
    deliveryState,
    workflowNote: caseRecord.lastDecision ?? alert.workflowNote,
    updatedAt: caseRecord.updatedAt,
    workflowEvents: [...(alert.workflowEvents ?? []), {
      id: stableId("dwm_alert_event", `${caseRecord.id}:${event.id}`),
      at: event.at,
      actor: event.actor,
      fromReviewState: alert.reviewState,
      toReviewState: reviewState,
      fromDeliveryState: alert.deliveryState,
      toDeliveryState: deliveryState,
      fromOwner: alert.assignedOwner,
      toOwner: caseRecord.assignedOwner,
      note: `Case ${event.action}: ${event.note ?? "No note."}`
    }]
  });
}

function caseWatchlists(options: ApiServerOptions, alert: any, caseRecord: AnalystCase) {
  const ids = new Set([...(alert?.watchlistIds ?? []), ...(alert?.workflowContext?.watchlistIds ?? [])].filter(Boolean));
  return ((options.store as any).listDwmWatchlists?.() ?? [])
    .filter((watchlist: any) => watchlist.tenantId === caseRecord.tenantId)
    .filter((watchlist: any) => !ids.size || ids.has(watchlist.id))
    .map((watchlist: any) => ({
      id: watchlist.id,
      organizationId: watchlist.organizationId,
      tenantId: watchlist.tenantId,
      name: watchlist.name,
      status: watchlist.status,
      webhookDestinationId: watchlist.webhookDestinationId,
      hasWebhookUrl: Boolean(watchlist.webhookUrl),
      matchedTerms: (watchlist.terms ?? []).filter((term: any) => String(term.value ?? "").toLowerCase() === String(alert?.matchedTerm?.value ?? "").toLowerCase()),
      termCount: (watchlist.terms ?? []).length
    }));
}

type CaseFilters = {
  status?: string;
  assignee?: string;
  severity?: string;
  route?: string;
  watchlistItemId?: string;
  alertId?: string;
  dedupeKey?: string;
  webhookDeliveryId?: string;
  webhookStatus?: string;
  caseActionReceiptId?: string;
  caseActionAuditEventId?: string;
  caseActionIdempotencyKey?: string;
  caseActionDedupeKey?: string;
  caseActionReplayState?: string;
  from?: string;
  to?: string;
  query?: string;
};

function caseFiltersFromUrl(url: URL): CaseFilters {
  return {
    status: normalizeFilter(url.searchParams.get("status")),
    assignee: normalizeFilter(url.searchParams.get("assignee") ?? url.searchParams.get("assignedOwner") ?? url.searchParams.get("owner")),
    severity: normalizeFilter(url.searchParams.get("severity") ?? url.searchParams.get("priority")),
    route: normalizeFilter(url.searchParams.get("route") ?? url.searchParams.get("recommendedRoute")),
    watchlistItemId: normalizeFilter(url.searchParams.get("watchlistItemId") ?? url.searchParams.get("watchlistItem")),
    alertId: normalizeFilter(url.searchParams.get("alertId")),
    dedupeKey: normalizeFilter(url.searchParams.get("dedupeKey")),
    webhookDeliveryId: normalizeFilter(url.searchParams.get("webhookDeliveryId") ?? url.searchParams.get("deliveryId")),
    webhookStatus: normalizeFilter(url.searchParams.get("webhookStatus") ?? url.searchParams.get("deliveryStatus")),
    caseActionReceiptId: normalizeFilter(url.searchParams.get("caseActionReceiptId") ?? url.searchParams.get("receiptId")),
    caseActionAuditEventId: normalizeFilter(url.searchParams.get("caseActionAuditEventId") ?? url.searchParams.get("auditEventId")),
    caseActionIdempotencyKey: normalizeFilter(url.searchParams.get("caseActionIdempotencyKey") ?? url.searchParams.get("idempotencyKey")),
    caseActionDedupeKey: normalizeFilter(url.searchParams.get("caseActionDedupeKey") ?? url.searchParams.get("replayDedupeKey")),
    caseActionReplayState: normalizeFilter(url.searchParams.get("caseActionReplayState") ?? url.searchParams.get("replayState")),
    from: normalizeFilter(url.searchParams.get("from") ?? url.searchParams.get("since")),
    to: normalizeFilter(url.searchParams.get("to") ?? url.searchParams.get("until")),
    query: normalizeFilter(url.searchParams.get("q") ?? url.searchParams.get("query") ?? url.searchParams.get("text"))
  };
}

function caseMatchesFilters(caseRecord: AnalystCase, filters: CaseFilters, options: ApiServerOptions): boolean {
  const alert = findDwmAlert(options, caseRecord.alertId);
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === caseRecord.alertId);
  const caseActionLedger = buildCaseActionLedgerTimeline(caseRecord, options, alert);
  if (filters.status && caseRecord.status !== filters.status) return false;
  if (filters.assignee && normalizeFilter(caseRecord.assignedOwner) !== filters.assignee) return false;
  if (filters.severity && normalizeFilter(alert?.severity ?? caseRecord.priority) !== filters.severity) return false;
  if (filters.route && normalizeFilter(alert?.recommendedRoute ?? alert?.webhookDelivery?.recommendedRoute ?? alert?.workflowContext?.recommendedRoute) !== filters.route) return false;
  if (filters.watchlistItemId && !caseWatchlistItemIds(alert).includes(filters.watchlistItemId)) return false;
  if (filters.alertId && alert?.id !== filters.alertId && caseRecord.alertId !== filters.alertId) return false;
  if (filters.dedupeKey && normalizeFilter(alert?.dedupeKey ?? alert?.webhookDelivery?.dedupeKey ?? alert?.workflowContext?.dedupeKey) !== filters.dedupeKey) return false;
  if (filters.webhookDeliveryId && !deliveries.some((delivery: any) => delivery.id === filters.webhookDeliveryId)) return false;
  if (filters.webhookStatus && !deliveries.some((delivery: any) => normalizeFilter(delivery.status) === filters.webhookStatus)) return false;
  if (filters.caseActionReceiptId && !caseActionLedger.rows.some((row) => normalizeFilter(row.receiptId) === filters.caseActionReceiptId)) return false;
  if (filters.caseActionAuditEventId && !caseActionLedger.rows.some((row) => normalizeFilter(row.provenance.auditEventId) === filters.caseActionAuditEventId)) return false;
  if (filters.caseActionIdempotencyKey && !caseActionLedger.rows.some((row) => normalizeFilter(row.replay.idempotencyKey) === filters.caseActionIdempotencyKey)) return false;
  if (filters.caseActionDedupeKey && !caseActionLedger.rows.some((row) => normalizeFilter(row.replay.dedupeKey) === filters.caseActionDedupeKey)) return false;
  if (filters.caseActionReplayState && !caseActionLedger.rows.some((row) => normalizeFilter(row.replay.replayState) === filters.caseActionReplayState)) return false;
  if ((filters.from || filters.to) && !caseHasTimelineInWindow(caseRecord, alert, deliveries, filters, caseActionLedger.rows)) return false;
  if (filters.query && !caseSearchBlob(caseRecord, alert, deliveries, caseActionLedger.rows).includes(filters.query)) return false;
  return true;
}

function caseMatchesOrganizationScope(caseRecord: AnalystCase, organizationId: string | undefined): boolean {
  return !organizationId || !caseRecord.organizationId || caseRecord.organizationId === organizationId;
}

function alertMatchesOrganizationScope(alert: any, organizationId: string | undefined): boolean {
  return !organizationId || !alert?.organizationId || alert.organizationId === organizationId;
}

function caseListItem(caseRecord: AnalystCase, options: ApiServerOptions, access?: CaseAccessResult) {
  const alert = findDwmAlert(options, caseRecord.alertId);
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === caseRecord.alertId);
  const caseActionLedger = buildCaseActionLedgerTimeline(caseRecord, options, alert);
  const timeline = buildCaseTimeline(caseRecord, alert, deliveries, caseActionLedger.rows);
  const latestEvent = timeline[timeline.length - 1];
  const latestCaseAction = [...timeline].reverse().find((event) => event.eventType === "case.action_recorded");
  return {
    id: caseRecord.id,
    caseId: caseRecord.id,
    title: caseRecord.title,
    summary: caseRecord.summary,
    status: caseRecord.status,
    priority: caseRecord.priority,
    severity: alert?.severity ?? caseRecord.priority,
    assignedOwner: caseRecord.assignedOwner,
    organizationId: caseRecord.organizationId,
    tenantId: caseRecord.tenantId,
    alertId: caseRecord.alertId,
    dedupeKey: alert?.dedupeKey ?? alert?.webhookDelivery?.dedupeKey ?? alert?.workflowContext?.dedupeKey,
    recommendedRoute: alert?.recommendedRoute ?? alert?.webhookDelivery?.recommendedRoute ?? alert?.workflowContext?.recommendedRoute,
    watchlistIds: alert?.watchlistIds ?? alert?.workflowContext?.watchlistIds ?? [],
    watchlistItemIds: caseWatchlistItemIds(alert),
    webhookDeliveryIds: deliveries.map((delivery: any) => delivery.id),
    webhookStatuses: [...new Set(deliveries.map((delivery: any) => delivery.status).filter(Boolean))],
    latestCustomerNotification: latestCaseCustomerNotification(caseRecord),
    createdAt: caseRecord.createdAt,
    updatedAt: caseRecord.updatedAt,
    closedAt: caseRecord.closedAt,
    latestEvent,
    latestCaseAction,
    caseActionLedgerContext: caseActionLedgerContext(caseActionLedger),
    timeline,
    nextAllowedActions: nextAllowedActionsForCase(caseRecord, alert, deliveries, access)
  };
}

function buildCaseTimeline(caseRecord: AnalystCase, alert: any, deliveries: any[], caseActionRows: OrgAlertCaseActionTimelineRow[] = []) {
  return [
    caseTimelineEvent({
      id: `${caseRecord.id}:created`,
      timestamp: caseRecord.createdAt,
      eventType: "case.created",
      title: "Case opened",
      source: "case",
      caseId: caseRecord.id,
      alert,
      actor: caseRecord.workflowEvents?.[0]?.actor,
      rationale: caseRecord.summary,
      toStatus: "open"
    }),
    ...(caseRecord.workflowEvents ?? [])
      .filter((event) => event.action !== "customer_notified")
      .map((event) => caseTimelineEvent({
        id: event.id,
        timestamp: event.at,
        eventType: `case.${event.action}`,
        title: event.action.replaceAll("_", " "),
        source: "case",
        caseId: caseRecord.id,
        alert,
        actor: event.actor,
        rationale: event.note,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        fromOwner: event.fromOwner,
        toOwner: event.toOwner
      })),
    ...deliveries.map((delivery: any) => caseTimelineEvent({
      id: delivery.id,
      timestamp: delivery.attemptedAt,
      eventType: `webhook.${delivery.status ?? "attempt"}`,
      title: `Webhook ${String(delivery.status ?? "attempt").replaceAll("_", " ")}`,
      source: "webhook",
      caseId: caseRecord.id,
      alert,
      webhookDelivery: delivery,
      rationale: delivery.error ?? `HTTP ${delivery.httpStatus ?? 0} · ${delivery.endpointHash}`
    })),
    ...(caseRecord.customerNotifications ?? []).map((receipt) => caseTimelineEvent({
      id: receipt.id,
      timestamp: receipt.at,
      eventType: "case.customer_notified",
      title: "customer notified",
      source: "case",
      caseId: caseRecord.id,
      alert,
      customerNotification: receipt,
      actor: receipt.actor,
      rationale: receipt.rationale,
      toStatus: caseRecord.status
    })),
    ...caseActionRows.map((row) => caseTimelineEvent({
      id: row.id,
      timestamp: row.at,
      eventType: "case.action_recorded",
      title: row.action.replaceAll("_", " "),
      source: "case",
      caseId: caseRecord.id,
      alert,
      actor: row.analystId,
      rationale: row.execution,
      toStatus: caseRecord.status,
      caseAction: row
    }))
  ].sort((a, b) => String(a.timestamp ?? "").localeCompare(String(b.timestamp ?? "")));
}

function caseTimelineEvent(input: {
  id: string;
  timestamp: string;
  eventType: string;
  title: string;
  source: "case" | "webhook";
  caseId: string;
  alert?: any;
  webhookDelivery?: any;
  customerNotification?: CaseCustomerNotificationReceipt;
  caseAction?: OrgAlertCaseActionTimelineRow;
  actor?: string;
  rationale?: string;
  fromStatus?: string;
  toStatus?: string;
  fromOwner?: string;
  toOwner?: string;
}) {
  const detail = [
    input.rationale,
    input.toOwner ? `Owner: ${input.toOwner}` : undefined,
    input.toStatus ? `Status: ${input.toStatus}` : undefined
  ].filter(Boolean).join(" · ");
  return {
    id: input.id,
    at: input.timestamp,
    timestamp: input.timestamp,
    type: input.source === "webhook" ? "delivery" : "case_event",
    eventType: input.eventType,
    title: input.title,
    actor: input.actor,
    rationale: input.rationale,
    source: input.source,
    related: {
      caseId: input.caseId,
      alertId: input.caseAction?.related.alertIds[0] ?? input.alert?.id,
      dedupeKey: input.alert?.dedupeKey ?? input.alert?.webhookDelivery?.dedupeKey ?? input.alert?.workflowContext?.dedupeKey,
      watchlistIds: uniqueCaseStrings([
        input.caseAction?.related.watchlistId,
        ...(input.alert?.watchlistIds ?? input.alert?.workflowContext?.watchlistIds ?? [])
      ]),
      watchlistItemIds: uniqueCaseStrings([
        input.caseAction?.related.watchlistItemId,
        ...caseWatchlistItemIds(input.alert)
      ]),
      webhookDeliveryId: input.webhookDelivery?.id ?? input.customerNotification?.webhookDeliveryId,
      webhookDestinationId: input.webhookDelivery?.webhookDestinationId ?? input.customerNotification?.webhookDestinationId,
      webhookStatus: input.webhookDelivery?.status ?? input.customerNotification?.webhookStatus,
      customerNotificationId: input.customerNotification?.id,
      caseActionReceiptId: input.caseAction?.receiptId,
      caseActionRecordId: input.caseAction?.provenance.recordId,
      caseActionAuditEventId: input.caseAction?.provenance.auditEventId,
      caseActionReplayState: input.caseAction?.replay.replayState,
      caseActionIdempotencyKey: input.caseAction?.replay.idempotencyKey,
      caseActionDedupeKey: input.caseAction?.replay.dedupeKey
    },
    workflowState: input.caseAction ? {
      action: input.caseAction.action,
      execution: input.caseAction.execution,
      replayState: input.caseAction.replay.replayState,
      idempotencyKey: input.caseAction.replay.idempotencyKey,
      dedupeKey: input.caseAction.replay.dedupeKey
    } : undefined,
    provenance: input.caseAction?.provenance,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    fromOwner: input.fromOwner,
    toOwner: input.toOwner,
    detail
  };
}

function buildCaseActionLedgerTimeline(caseRecord: AnalystCase, options: ApiServerOptions, alert: any) {
  const repository = options.orgAlertCaseActionLedgerRepository;
  const tenantId = caseRecord.tenantId;
  const organizationId = caseRecord.organizationId;
  const alertId = caseRecord.alertId ?? alert?.id;
  const casePath = alert?.casePath ?? alert?.workflowContext?.casePath;
  if (!repository || !tenantId || !organizationId || !alertId) {
    return buildOrgAlertCaseActionTimeline({
      tenantId,
      organizationId,
      alertId,
      casePath,
      records: []
    });
  }
  const ledger = buildOrgAlertCaseActionLedgerApiList({
    repository,
    tenantId,
    organizationId,
    alertId
  });
  return buildOrgAlertCaseActionTimeline({
    tenantId,
    organizationId,
    alertId,
    casePath,
    records: ledger.records
  });
}

function caseActionLedgerContext(report: ReturnType<typeof buildCaseActionLedgerTimeline>) {
  return {
    schemaVersion: report.schemaVersion,
    ok: report.ok,
    eventCount: report.rows.length,
    blockerCount: report.blockers.length,
    blockers: report.blockers,
    route: "/v1/dwm/org-alert-case-actions/timeline"
  };
}

function nextAllowedActionsForCase(caseRecord: AnalystCase, alert: any, deliveries: any[], access?: CaseAccessResult) {
  const readOnly = access?.readOnly === true;
  const base = [
    { id: "assign", label: "Assign owner", method: "PATCH", requiresRationale: false, enabled: !readOnly && caseRecord.status !== "closed" && caseRecord.status !== "false_positive" },
    { id: "escalate", label: "Escalate", method: "PATCH", requiresRationale: true, enabled: !readOnly && caseRecord.status !== "closed" && caseRecord.status !== "false_positive" && caseRecord.status !== "suppressed" },
    { id: "close", label: "Close", method: "PATCH", requiresRationale: true, enabled: !readOnly && caseRecord.status !== "closed" },
    { id: "suppress", label: "Suppress", method: "PATCH", requiresRationale: true, enabled: !readOnly && caseRecord.status !== "suppressed" },
    { id: "reopen", label: "Reopen", method: "PATCH", requiresRationale: false, enabled: !readOnly && (caseRecord.status === "closed" || caseRecord.status === "suppressed" || caseRecord.status === "false_positive") }
  ];
  if (alert?.deliveryState === "ready_to_send" && !deliveries.some((delivery: any) => delivery.status === "delivered")) {
    base.push({ id: "deliver_webhook", label: "Deliver webhook", method: "POST", requiresRationale: false, enabled: !readOnly });
  }
  return base.map((action) => ({ ...action, disabledReason: action.enabled ? undefined : readOnly ? "read_only_member" : "not_applicable_for_status" }));
}

function caseHasTimelineInWindow(caseRecord: AnalystCase, alert: any, deliveries: any[], filters: CaseFilters, caseActionRows: OrgAlertCaseActionTimelineRow[] = []): boolean {
  const from = filters.from ? Date.parse(filters.from) : undefined;
  const to = filters.to ? Date.parse(filters.to) : undefined;
  return buildCaseTimeline(caseRecord, alert, deliveries, caseActionRows).some((event) => {
    const timestamp = Date.parse(event.timestamp);
    if (!Number.isFinite(timestamp)) return false;
    if (from !== undefined && Number.isFinite(from) && timestamp < from) return false;
    if (to !== undefined && Number.isFinite(to) && timestamp > to) return false;
    return true;
  });
}

function caseSearchBlob(caseRecord: AnalystCase, alert: any, deliveries: any[], caseActionRows: OrgAlertCaseActionTimelineRow[] = []): string {
  return [
    caseRecord.id,
    caseRecord.title,
    caseRecord.summary,
    caseRecord.status,
    caseRecord.assignedOwner,
    caseRecord.lastDecision,
    alert?.id,
    alert?.company,
    alert?.actor,
    alert?.sourceFamily,
    alert?.claimSummary,
    alert?.matchedTerm?.value,
    alert?.dedupeKey,
    alert?.webhookDelivery?.dedupeKey,
    alert?.workflowContext?.dedupeKey,
    ...(alert?.evidence ?? []).flatMap((item: any) => [item.id, item.sourceName, item.sourceFamily, item.contentHash, item.excerpt]),
    ...deliveries.flatMap((delivery: any) => [delivery.id, delivery.status, delivery.webhookDestinationId, delivery.error]),
    ...caseActionRows.flatMap((row) => [
      row.receiptId,
      row.action,
      row.execution,
      row.ownerLane,
      row.analystId,
      row.provenance.recordId,
      row.provenance.auditEventId,
      row.provenance.blockedByCodes.join(" "),
      row.replay.replayState,
      row.replay.idempotencyKey,
      row.replay.dedupeKey,
      ...row.related.alertIds,
      ...row.related.casePaths,
      row.related.watchlistId,
      row.related.watchlistItemId
    ])
  ].map((value) => String(value ?? "").toLowerCase()).join(" ");
}

function caseWatchlistItemIds(alert: any): string[] {
  return [...new Set([
    ...(alert?.watchlistItemIds ?? []),
    ...(alert?.workflowContext?.watchlistItemIds ?? []),
    ...(alert?.webhookContext?.watchlistItemIds ?? [])
  ].map((value) => String(value)).filter(Boolean))];
}

function normalizeFilter(value: unknown): string | undefined {
  const filter = String(value ?? "").trim().toLowerCase();
  return filter || undefined;
}

type CaseAccessResult = {
  member?: OrganizationMember;
  readOnly: boolean;
  visibilityDecision: CaseVisibilityDecision;
  error?: Response;
};

type CaseVisibilityPolicy = "members" | "admins" | "owners";
type CaseVisibilityDenyReason = "not_member" | "member_removed" | "member_deactivated" | "role_not_allowed";
type CaseVisibilityDecision = {
  allowed: boolean;
  reason: CaseVisibilityDenyReason | null;
  alertVisibilityPolicy: CaseVisibilityPolicy;
  allowedRoles: string[];
};

function authorizeCaseAccess(input: { options: ApiServerOptions; scope: { organizationId?: string; organization?: unknown }; request?: Request; url?: URL; body?: any; mode: CaseAccessMode }): CaseAccessResult {
  const visibilityPolicy = organizationAlertVisibilityPolicy(input.scope.organization);
  const allowedRoles = allowedCaseVisibilityRoles(visibilityPolicy);
  const openDecision: CaseVisibilityDecision = { allowed: true, reason: null, alertVisibilityPolicy: visibilityPolicy, allowedRoles };
  const members = organizationMembers(input.options, input.scope.organizationId);
  if (!input.scope.organizationId || !members.length) return { readOnly: false, visibilityDecision: openDecision };

  const identity = requestIdentity(input.request, input.body, input.url);
  if (!identity.length) {
    const visibilityDecision: CaseVisibilityDecision = { allowed: false, reason: "not_member", alertVisibilityPolicy: visibilityPolicy, allowedRoles };
    return { readOnly: true, visibilityDecision, error: caseVisibilityError(visibilityDecision, "Case access requires an active organization member identity.") };
  }

  const member = members.find((row) => identityMatchesMember(identity, row));
  if (!member) {
    const visibilityDecision: CaseVisibilityDecision = { allowed: false, reason: "not_member", alertVisibilityPolicy: visibilityPolicy, allowedRoles };
    return { readOnly: true, visibilityDecision, error: caseVisibilityError(visibilityDecision, "Case access is limited to active organization members.") };
  }

  const visibilityDecision = caseVisibilityDecision(member, visibilityPolicy);
  if (!visibilityDecision.allowed) {
    return { member, readOnly: true, visibilityDecision, error: caseVisibilityError(visibilityDecision, "Case evidence is not visible for this organization membership.") };
  }
  const readOnly = member.role === "viewer";
  if (input.mode === "mutate" && readOnly) {
    return { member, readOnly, visibilityDecision, error: json({ error: { code: "case_read_only_member", message: "Viewer members can read cases but cannot assign, close, suppress, or escalate them." }, visibilityDecision }, 403) };
  }
  return { member, readOnly, visibilityDecision };
}

function validateAssignedOwner(options: ApiServerOptions, organizationId: string | undefined, assignedOwner: string | undefined): Response | undefined {
  if (!organizationId || !assignedOwner) return undefined;
  const members = activeOrganizationMembers(options, organizationId);
  if (!members.length) return undefined;
  const owner = members.find((member) => identityMatchesMember([assignedOwner], member));
  if (!owner) {
    return json({ error: { code: "invalid_case_owner", message: "Assigned owner must be an active member of this organization." } }, 400);
  }
  if (owner.role === "viewer") {
    return json({ error: { code: "invalid_case_owner_role", message: "Viewer members cannot own mutable analyst cases." } }, 400);
  }
  return undefined;
}

function activeOrganizationMembers(options: ApiServerOptions, organizationId: string | undefined): OrganizationMember[] {
  if (!organizationId) return [];
  return organizationMembers(options, organizationId)
    .filter((row: OrganizationMember) => row.organizationId === organizationId && row.status === "active");
}

function organizationMembers(options: ApiServerOptions, organizationId: string | undefined): OrganizationMember[] {
  if (!organizationId) return [];
  return ((options.store as any).listOrganizationMembers?.() ?? [])
    .filter((row: OrganizationMember) => row.organizationId === organizationId);
}

function requestIdentity(request: Request | undefined, body?: any, url?: URL): string[] {
  return [
    request?.headers.get("x-user-email"),
    request?.headers.get("x-user-id"),
    request?.headers.get("x-actor-id"),
    body?.userEmail,
    body?.userId,
    body?.actorEmail,
    body?.actor,
    url?.searchParams.get("userEmail"),
    url?.searchParams.get("userId"),
    url?.searchParams.get("actor")
  ].map(normalizeIdentity).filter(Boolean) as string[];
}

function identityMatchesMember(identity: string[], member: OrganizationMember): boolean {
  const candidates = [member.id, member.email, member.userId].map(normalizeIdentity).filter(Boolean);
  return candidates.some((candidate) => identity.includes(candidate as string));
}

function normalizeIdentity(value: unknown): string | undefined {
  const identity = String(value ?? "").trim().toLowerCase();
  return identity || undefined;
}

function caseAccessSummary(access?: CaseAccessResult) {
  return access?.member ? {
    memberId: access.member.id,
    role: access.member.role,
    readOnly: access.readOnly,
    visibilityDecision: access.visibilityDecision
  } : undefined;
}

function caseVisibilityDecision(member: OrganizationMember, alertVisibilityPolicy: CaseVisibilityPolicy): CaseVisibilityDecision {
  const allowedRoles = allowedCaseVisibilityRoles(alertVisibilityPolicy);
  if ((member as any).userActive === false || (member as any).active === false || (member as any).deactivatedAt || (member as any).deactivated_at) {
    return { allowed: false, reason: "member_deactivated", alertVisibilityPolicy, allowedRoles };
  }
  if (member.status !== "active") {
    return { allowed: false, reason: member.status === "removed" ? "member_removed" : "member_deactivated", alertVisibilityPolicy, allowedRoles };
  }
  const role = normalizeVisibilityRole(member.role);
  if (!allowedRoles.includes(role)) {
    return { allowed: false, reason: "role_not_allowed", alertVisibilityPolicy, allowedRoles };
  }
  return { allowed: true, reason: null, alertVisibilityPolicy, allowedRoles };
}

function caseVisibilityError(decision: CaseVisibilityDecision, message: string): Response {
  return json({
    error: {
      code: "organization_visibility_denied",
      message,
      reason: decision.reason
    },
    visibilityDecision: decision
  }, 403);
}

function organizationAlertVisibilityPolicy(organization: unknown): CaseVisibilityPolicy {
  const value = String((organization as any)?.alertVisibilityPolicy ?? (organization as any)?.alert_visibility_policy ?? "members");
  return value === "admins" || value === "owners" ? value : "members";
}

function allowedCaseVisibilityRoles(policy: CaseVisibilityPolicy): string[] {
  if (policy === "owners") return ["owner"];
  if (policy === "admins") return ["owner", "admin"];
  return ["owner", "admin", "analyst", "member", "viewer"];
}

function normalizeVisibilityRole(role: unknown): string {
  const value = String(role ?? "").trim().toLowerCase();
  return value === "member" ? "analyst" : value;
}

function nextActionsForCase(caseRecord: AnalystCase, alert: any, deliveries: any[]) {
  if (caseRecord.status === "closed") return ["Keep closed unless new evidence changes the decision."];
  if (caseRecord.status === "false_positive" || caseRecord.status === "suppressed") return ["Monitor for new evidence before reopening."];
  if (!caseRecord.assignedOwner) return ["Assign an owner.", "Review evidence.", "Decide whether to notify the customer."];
  if (deliveries.some((delivery: any) => delivery.status === "delivered") && !(caseRecord.customerNotifications ?? []).length) return ["Record customer notification.", "Add decision rationale.", "Close or keep the case open for follow-up."];
  if ((caseRecord.customerNotifications ?? []).length) return ["Review customer handoff receipt.", "Close the case or keep it open for follow-up."];
  if (alert?.deliveryState === "ready_to_send" && !deliveries.some((delivery: any) => delivery.status === "delivered")) return ["Send or retry customer delivery.", "Record the delivery decision."];
  return ["Review evidence.", "Add decision rationale.", "Escalate, suppress, mark false positive, or close."];
}

function uniqueCaseStrings(values: unknown[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function latestCaseCustomerNotification(caseRecord: AnalystCase) {
  return [...(caseRecord.customerNotifications ?? [])].reverse()[0];
}

function customerNotificationContext(caseRecord: AnalystCase) {
  const receipts = caseRecord.customerNotifications ?? [];
  const latest = latestCaseCustomerNotification(caseRecord);
  return {
    notificationCount: receipts.length,
    latest,
    notified: Boolean(latest),
    modes: [...new Set(receipts.map((receipt) => receipt.deliveryMode))]
  };
}

function handoffActionReceiptContext(caseRecord: AnalystCase) {
  const receipts = caseRecord.handoffActionReceipts ?? [];
  const latest = [...receipts].sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")))[0];
  return {
    schemaVersion: "dwm.case_handoff_action_receipt_context.v1",
    receiptCount: receipts.length,
    latest,
    actionIds: uniqueCaseStrings(receipts.map((receipt) => receipt.actionId)),
    route: "/v1/cases/:caseId/handoff-action"
  };
}

function buildCaseHandoffActionHistory(caseRecord: AnalystCase, options: ApiServerOptions, organization: unknown, access: CaseAccessResult, filters: {
  actionId?: "alertReplay" | "webhookDryRun";
  idempotencyKey?: string;
  dedupeKey?: string;
  actor?: string;
}) {
  const alert = findDwmAlert(options, caseRecord.alertId);
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === caseRecord.alertId);
  const alertCaseHandoffContext = alert ? buildAlertCaseHandoff({
    caseRecord,
    alert,
    route: `/v1/dwm/alerts/${encodeURIComponent(alert.id)}/case-handoff`,
    replayState: "reused",
    provenance: alertCaseHandoffProvenance(alert)
  }) : undefined;
  const handoffActionReadiness = alertCaseHandoffContext ? buildCaseHandoffActionReadiness({
    caseRecord,
    handoff: alertCaseHandoffContext,
    deliveries,
    access
  }) : undefined;
  const allReceipts = [...(caseRecord.handoffActionReceipts ?? [])].sort((a, b) => String(b.at ?? "").localeCompare(String(a.at ?? "")));
  const receipts = allReceipts.filter((receipt) => {
    if (filters.actionId && receipt.actionId !== filters.actionId) return false;
    if (filters.idempotencyKey && receipt.idempotencyKey !== filters.idempotencyKey) return false;
    if (filters.dedupeKey && receipt.dedupeKey !== filters.dedupeKey) return false;
    if (filters.actor && normalizeIdentity(receipt.actor) !== normalizeIdentity(filters.actor)) return false;
    return true;
  });
  const latestByAction = Object.fromEntries(["alertReplay", "webhookDryRun"].map((actionId) => [
    actionId,
    allReceipts.find((receipt) => receipt.actionId === actionId)
  ]));
  return {
    schemaVersion: "dwm.case_handoff_action_history.v1",
    generatedAt: nowIso(),
    organization,
    access: caseAccessSummary(access),
    caseId: caseRecord.id,
    tenantId: caseRecord.tenantId,
    organizationId: caseRecord.organizationId,
    alertId: caseRecord.alertId,
    filters,
    summary: {
      receiptCount: receipts.length,
      totalReceiptCount: allReceipts.length,
      actionIds: uniqueCaseStrings(allReceipts.map((receipt) => receipt.actionId)),
      latestReceipt: allReceipts[0],
      latestByAction
    },
    handoffActionReadiness,
    receipts,
    auditSafety: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false
    }
  };
}

function buildCaseActionReplayExport(caseRecord: AnalystCase, options: ApiServerOptions, organization: unknown, access: CaseAccessResult, filters: {
  actionId?: "alertReplay" | "webhookDryRun";
  idempotencyKey?: string;
  eventAction?: string;
}) {
  const alert = findDwmAlert(options, caseRecord.alertId);
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === caseRecord.alertId);
  const handoffHistory = buildCaseHandoffActionHistory(caseRecord, options, organization, access, {
    actionId: filters.actionId,
    idempotencyKey: filters.idempotencyKey
  });
  const workflowTransitions = (caseRecord.workflowEvents ?? [])
    .filter((event) => !filters.eventAction || event.action === filters.eventAction)
    .filter((event) => !filters.idempotencyKey || event.idempotencyKey === filters.idempotencyKey)
    .map((event) => caseWorkflowTransition(caseRecord, event));
  const customerNotifications = (caseRecord.customerNotifications ?? [])
    .filter((receipt) => !filters.idempotencyKey || receipt.idempotencyKey === filters.idempotencyKey)
    .map((receipt) => ({
      id: receipt.id,
      schemaVersion: receipt.schemaVersion,
      caseId: receipt.caseId,
      alertId: receipt.alertId,
      at: receipt.at,
      actor: receipt.actor,
      deliveryMode: receipt.deliveryMode,
      idempotencyKey: receipt.idempotencyKey,
      webhookDeliveryId: receipt.webhookDeliveryId,
      webhookDestinationId: receipt.webhookDestinationId,
      webhookStatus: receipt.webhookStatus,
      externalReference: receipt.externalReference,
      evidence: receipt.evidence
    }));
  const webhookDryRunReadiness = caseWebhookDryRunReplayReadiness({
    alert,
    caseRecord,
    deliveries,
    customerNotifications,
    handoffActionReadiness: handoffHistory.handoffActionReadiness
  });
  const sourceHandoffReadiness = caseSourceHandoffReplayReadiness({ alert, caseRecord });
  const publicTiHandoffReadiness = casePublicTiHandoffReadiness({ alert, caseRecord, sourceHandoffReadiness });
  const organizationAccessReadiness = caseOrganizationAccessReadiness({ caseRecord, access });
  const supportRecoveryReadiness = caseSupportRecoveryReadiness({
    alert,
    caseRecord,
    access,
    sourceHandoffReadiness,
    webhookDryRunReadiness
  });
  const auditTimeline = caseReplayAuditTimeline({
    caseRecord,
    filters,
    handoffReceipts: handoffHistory.receipts,
    customerNotifications
  });
  const blockerCodes = uniqueCaseStrings([
    ...(alert ? [] : ["missing_case_alert"]),
    ...(handoffHistory.handoffActionReadiness?.blockerCodes ?? [])
  ]);
  const nextAnalystActions = caseReplayNextAnalystActions({
    caseRecord,
    access,
    organizationAccessReadiness,
    publicTiHandoffReadiness,
    sourceHandoffReadiness,
    webhookDryRunReadiness,
    supportRecoveryReadiness,
    handoffActionReadiness: handoffHistory.handoffActionReadiness
  });
  return {
    schemaVersion: "dwm.case_action_replay_export.v1",
    generatedAt: nowIso(),
    organization,
    access: caseAccessSummary(access),
    caseId: caseRecord.id,
    tenantId: caseRecord.tenantId,
    organizationId: caseRecord.organizationId,
    alertId: caseRecord.alertId,
    filters,
    workflowState: caseWorkflowSummary(caseRecord),
    handoffActionReadiness: handoffHistory.handoffActionReadiness,
    handoffActionHistory: {
      schemaVersion: handoffHistory.schemaVersion,
      summary: handoffHistory.summary,
      receipts: handoffHistory.receipts
    },
    workflowTransitions,
    customerNotifications,
    auditTimeline,
    organizationAccessReadiness,
    publicTiHandoffReadiness,
    webhookDryRunReadiness,
    sourceHandoffReadiness,
    supportRecoveryReadiness,
    nextAnalystActions,
    replayPlan: {
      workflowTransitionCount: workflowTransitions.length,
      handoffReceiptCount: handoffHistory.receipts.length,
      customerNotificationCount: customerNotifications.length,
      auditTimelineRowCount: auditTimeline.summary.rowCount,
      dryRunDeliveryReceiptCount: webhookDryRunReadiness.deliveryReceipts.length,
      organizationAccessReady: organizationAccessReadiness.ready,
      publicTiHandoffReady: publicTiHandoffReadiness.ready,
      sourceHandoffReady: sourceHandoffReadiness.ready,
      supportRecoveryReady: supportRecoveryReadiness.ready,
      nextActionCount: nextAnalystActions.length,
      replayable: blockerCodes.length === 0,
      blockerCodes
    },
    provenance: {
      captureIds: handoffHistory.handoffActionReadiness?.provenance?.captureIds ?? [],
      sourceIds: handoffHistory.handoffActionReadiness?.provenance?.sourceIds ?? [],
      contentHashes: handoffHistory.handoffActionReadiness?.provenance?.contentHashes ?? [],
      evidenceCount: handoffHistory.handoffActionReadiness?.provenance?.evidenceCount ?? 0
    },
    auditSafety: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false
    }
  };
}

function caseReplayAuditTimeline(input: {
  caseRecord: AnalystCase;
  filters: {
    actionId?: "alertReplay" | "webhookDryRun";
    idempotencyKey?: string;
    eventAction?: string;
  };
  handoffReceipts: Array<any>;
  customerNotifications: Array<any>;
}) {
  const workflowRows = (input.caseRecord.workflowEvents ?? [])
    .filter((event) => !input.filters.eventAction || event.action === input.filters.eventAction)
    .filter((event) => !input.filters.idempotencyKey || event.idempotencyKey === input.filters.idempotencyKey)
    .map((event) => ({
      schemaVersion: "dwm.case_replay_audit_timeline_row.v1",
      id: stableId("case_replay_audit_timeline_row", `${input.caseRecord.id}:workflow:${event.id}`),
      at: event.at,
      rowType: "workflow_transition",
      caseId: input.caseRecord.id,
      tenantId: input.caseRecord.tenantId,
      organizationId: input.caseRecord.organizationId,
      alertId: input.caseRecord.alertId,
      actor: event.actor,
      action: event.action,
      rationale: event.note,
      workflow: {
        eventId: event.id,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        fromOwner: event.fromOwner,
        toOwner: event.toOwner,
        currentStatus: input.caseRecord.status,
        currentOwner: input.caseRecord.assignedOwner
      },
      replay: {
        replayState: event.replayState ?? "recorded",
        idempotencyKey: event.idempotencyKey,
        dedupeKey: event.transitionKey,
        auditEventId: event.auditEventId,
        workflowEventId: event.id
      },
      provenance: {
        source: "case_workflow",
        eventId: event.id,
        auditEventId: event.auditEventId,
        captureIds: [],
        sourceIds: [],
        contentHashes: [],
        evidenceCount: 0,
        blockerCodes: []
      }
    }));

  const handoffRows = input.handoffReceipts.map((receipt) => ({
    schemaVersion: "dwm.case_replay_audit_timeline_row.v1",
    id: stableId("case_replay_audit_timeline_row", `${input.caseRecord.id}:handoff:${receipt.id}`),
    at: receipt.at,
    rowType: "handoff_action_receipt",
    caseId: receipt.caseId,
    tenantId: receipt.tenantId,
    organizationId: receipt.organizationId,
    alertId: receipt.alertId,
    actor: receipt.actor,
    action: receipt.actionId,
    rationale: receipt.actionId === "webhookDryRun" ? "Webhook dry-run handoff recorded." : "Alert replay handoff recorded.",
    handoffAction: {
      receiptId: receipt.id,
      actionId: receipt.actionId,
      route: receipt.route,
      method: receipt.method,
      execution: receipt.execution
    },
    workflow: {
      workflowEventId: receipt.workflowEventId,
      currentStatus: input.caseRecord.status,
      currentOwner: input.caseRecord.assignedOwner
    },
    replay: {
      replayState: receipt.execution?.state ?? "recorded",
      idempotencyKey: receipt.idempotencyKey,
      dedupeKey: receipt.dedupeKey,
      auditEventId: receipt.auditEventId,
      workflowEventId: receipt.workflowEventId
    },
    provenance: {
      source: "case_handoff_action",
      receiptId: receipt.id,
      captureIds: receipt.provenance?.captureIds ?? [],
      sourceIds: receipt.provenance?.sourceIds ?? [],
      contentHashes: receipt.provenance?.contentHashes ?? [],
      evidenceCount: receipt.provenance?.evidenceCount ?? 0,
      blockerCodes: receipt.provenance?.blockerCodes ?? []
    }
  }));

  const customerNotificationRows = input.customerNotifications.map((receipt) => ({
    schemaVersion: "dwm.case_replay_audit_timeline_row.v1",
    id: stableId("case_replay_audit_timeline_row", `${input.caseRecord.id}:customer_notification:${receipt.id}`),
    at: receipt.at,
    rowType: "customer_notification",
    caseId: receipt.caseId,
    tenantId: receipt.tenantId,
    organizationId: receipt.organizationId,
    alertId: receipt.alertId,
    actor: receipt.actor,
    action: "customer_notified",
    rationale: receipt.rationale,
    delivery: {
      deliveryMode: receipt.deliveryMode,
      webhookDeliveryId: receipt.webhookDeliveryId,
      webhookDestinationId: receipt.webhookDestinationId,
      webhookStatus: receipt.webhookStatus,
      externalReference: receipt.externalReference
    },
    workflow: {
      currentStatus: input.caseRecord.status,
      currentOwner: input.caseRecord.assignedOwner
    },
    replay: {
      replayState: "recorded",
      idempotencyKey: receipt.idempotencyKey
    },
    provenance: {
      source: "case_customer_notification",
      receiptId: receipt.id,
      captureIds: [],
      sourceIds: receipt.evidence?.sourceIds ?? [],
      contentHashes: receipt.evidence?.contentHashes ?? [],
      evidenceCount: receipt.evidence?.evidenceCount ?? 0,
      blockerCodes: []
    }
  }));

  const rows = [...workflowRows, ...handoffRows, ...customerNotificationRows]
    .sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")) || String(a.id).localeCompare(String(b.id)));
  return {
    schemaVersion: "dwm.case_replay_audit_timeline.v1",
    generatedAt: nowIso(),
    caseId: input.caseRecord.id,
    tenantId: input.caseRecord.tenantId,
    organizationId: input.caseRecord.organizationId,
    alertId: input.caseRecord.alertId,
    filters: input.filters,
    summary: {
      rowCount: rows.length,
      workflowTransitionCount: workflowRows.length,
      handoffReceiptCount: handoffRows.length,
      customerNotificationCount: customerNotificationRows.length,
      latestAt: rows[rows.length - 1]?.at,
      actions: uniqueCaseStrings(rows.map((row) => row.action)),
      rowTypes: uniqueCaseStrings(rows.map((row) => row.rowType))
    },
    rows,
    auditSafety: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false
    }
  };
}

function casePublicTiHandoffReadiness(input: {
  alert: any;
  caseRecord: AnalystCase;
  sourceHandoffReadiness: any;
}) {
  const publicTi = input.sourceHandoffReadiness.consumers?.publicTi ?? {};
  const query = String(input.alert?.actor ?? input.alert?.threatActor ?? input.alert?.matchedTerm?.value ?? "").trim() || undefined;
  const blockerCodes = uniqueCaseStrings([
    ...(input.sourceHandoffReadiness.ready ? [] : input.sourceHandoffReadiness.blockerCodes ?? ["missing_alert_source_handoff_readiness"]),
    ...(publicTi.ready ? [] : ["public_ti_handoff_not_ready"])
  ]);
  return {
    schemaVersion: "dwm.case_public_ti_handoff_replay_readiness.v1",
    route: "/api/ti/search",
    publicRoute: query ? `/ti/${encodeURIComponent(query)}` : "/ti",
    available: Boolean(input.sourceHandoffReadiness.available),
    ready: blockerCodes.length === 0,
    redacted: publicTi.redacted !== false,
    caseId: input.caseRecord.id,
    tenantId: input.caseRecord.tenantId,
    organizationId: input.caseRecord.organizationId,
    alertId: input.caseRecord.alertId,
    query,
    sourceFamily: publicTi.sourceFamily ?? input.sourceHandoffReadiness.sourceFamily,
    alertGenerationRefCount: publicTi.alertGenerationRefCount ?? 0,
    stableFields: publicTi.stableFields ?? [],
    gapFields: publicTi.gapFields ?? [],
    provenance: {
      captureIds: input.sourceHandoffReadiness.provenanceCaptureIds ?? [],
      sourceIds: input.sourceHandoffReadiness.provenanceSourceIds ?? [],
      selectedCaptureIds: input.sourceHandoffReadiness.selectedCaptureIds ?? [],
      evidenceCount: input.sourceHandoffReadiness.evidenceCount ?? 0
    },
    blockerCodes,
    auditSafety: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      publicRawPayloadExposed: false
    }
  };
}

function caseOrganizationAccessReadiness(input: {
  caseRecord: AnalystCase;
  access: CaseAccessResult;
}) {
  const readOnly = input.access.readOnly === true;
  const missingOrg = !input.caseRecord.organizationId;
  const allowed = input.access.visibilityDecision.allowed !== false;
  const blockerCodes = uniqueCaseStrings([
    ...(!allowed ? ["organization_visibility_denied"] : []),
    ...(missingOrg ? ["missing_organization_scope"] : []),
    ...(readOnly ? ["case_read_only_member"] : [])
  ]);
  return {
    schemaVersion: "dwm.case_org_access_replay_readiness.v1",
    route: `/v1/cases/${encodeURIComponent(input.caseRecord.id)}`,
    organizationRoute: input.caseRecord.organizationId
      ? `/api/organizations/${encodeURIComponent(input.caseRecord.organizationId)}/members`
      : "/api/organizations/:id/members",
    available: !missingOrg,
    ready: blockerCodes.length === 0,
    readyForReview: allowed,
    readyForMutation: allowed && !readOnly && !missingOrg,
    state: !allowed ? "blocked" : missingOrg ? "missing_organization_scope" : readOnly ? "read_only" : "ready_for_case_actions",
    caseId: input.caseRecord.id,
    tenantId: input.caseRecord.tenantId,
    organizationId: input.caseRecord.organizationId,
    alertId: input.caseRecord.alertId,
    member: input.access.member ? {
      memberId: input.access.member.id,
      role: input.access.member.role,
      status: input.access.member.status,
      readOnly
    } : undefined,
    visibility: {
      allowed,
      reason: input.access.visibilityDecision.reason,
      alertVisibilityPolicy: input.access.visibilityDecision.alertVisibilityPolicy,
      allowedRoles: input.access.visibilityDecision.allowedRoles
    },
    noEnumeration: true,
    requiredFields: ["organizationId", "memberId", "role", "caseId"],
    blockerCodes,
    auditSafety: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      crossOrgDataExposed: false
    }
  };
}

function caseSupportRecoveryReadiness(input: {
  alert: any;
  caseRecord: AnalystCase;
  access: CaseAccessResult;
  sourceHandoffReadiness: any;
  webhookDryRunReadiness: any;
}) {
  const readOnly = input.access.readOnly === true;
  const route = "/api/admin/support/readiness";
  const recoveryRoute = input.caseRecord.organizationId
    ? `/api/admin/support/organizations/${encodeURIComponent(input.caseRecord.organizationId)}/access-recovery`
    : "/api/admin/support/organizations/:id/access-recovery";
  const blockerCodes = uniqueCaseStrings([
    ...(readOnly ? ["case_read_only_member"] : []),
    ...(!input.caseRecord.organizationId ? ["missing_organization_scope"] : []),
    ...(!input.caseRecord.alertId || !input.alert ? ["missing_case_alert"] : []),
    ...(!input.caseRecord.assignedOwner ? ["missing_case_owner"] : []),
    ...(input.caseRecord.status === "closed" ? ["case_closed"] : []),
    ...(input.sourceHandoffReadiness.ready ? [] : input.sourceHandoffReadiness.blockerCodes ?? ["missing_alert_source_handoff_readiness"])
  ]);
  return {
    schemaVersion: "dwm.case_support_recovery_readiness.v1",
    route,
    recoveryRoute,
    method: "POST",
    available: true,
    ready: blockerCodes.length === 0,
    state: blockerCodes.length === 0 ? "ready_for_support_review" : "blocked",
    caseId: input.caseRecord.id,
    tenantId: input.caseRecord.tenantId,
    organizationId: input.caseRecord.organizationId,
    alertId: input.caseRecord.alertId,
    assignedOwner: input.caseRecord.assignedOwner,
    workflowStatus: input.caseRecord.status,
    member: input.access.member ? {
      memberId: input.access.member.id,
      role: input.access.member.role,
      readOnly
    } : undefined,
    source: {
      sourceFamily: input.sourceHandoffReadiness.sourceFamily ?? input.alert?.sourceFamily,
      selectedCaptureIds: input.sourceHandoffReadiness.selectedCaptureIds ?? [],
      provenanceCaptureIds: input.sourceHandoffReadiness.provenanceCaptureIds ?? [],
      provenanceSourceIds: input.sourceHandoffReadiness.provenanceSourceIds ?? [],
      contentHashes: alertCaseHandoffProvenance(input.alert).contentHashes,
      evidenceCount: input.sourceHandoffReadiness.evidenceCount ?? 0
    },
    webhook: {
      readyForReplay: Boolean(input.webhookDryRunReadiness.readyForReplay),
      receiptAvailable: Boolean(input.webhookDryRunReadiness.receiptAvailable),
      destinationIds: input.webhookDryRunReadiness.destinationIds ?? [],
      latestDeliveryId: input.webhookDryRunReadiness.latestDelivery?.id,
      latestDeliveryStatus: input.webhookDryRunReadiness.latestDelivery?.status
    },
    requiredFields: ["organizationId", "caseId", "alertId", "assignedOwner", "audit.reason", "idempotencyKey"],
    blockerCodes,
    auditSafety: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

function caseSourceHandoffReplayReadiness(input: {
  alert: any;
  caseRecord: AnalystCase;
}) {
  const source = input.alert?.sourceHandoffReadiness;
  if (!source) {
    return {
      schemaVersion: "dwm.case_source_handoff_replay_readiness.v1",
      available: false,
      ready: false,
      state: "missing_source_handoff_readiness",
      caseId: input.caseRecord.id,
      alertId: input.caseRecord.alertId,
      organizationId: input.caseRecord.organizationId,
      sourceFamily: input.alert?.sourceFamily,
      selectedCaptureIds: [],
      evidenceCount: 0,
      provenanceCaptureIds: [],
      provenanceSourceIds: [],
      provenanceGapCodes: ["missing_alert_source_handoff_readiness"],
      blockerCodes: ["missing_alert_source_handoff_readiness"],
      consumers: {
        case: { ready: false, blockerCodes: ["missing_alert_source_handoff_readiness"] },
        webhook: { ready: false, blockerCodes: ["missing_alert_source_handoff_readiness"] },
        publicTi: { ready: false, blockerCodes: ["missing_alert_source_handoff_readiness"] }
      },
      auditSafety: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false
      }
    };
  }
  const sourceBlockers = uniqueCaseStrings([
    ...(source.provenanceGapCodes ?? []),
    ...(source.caseConsumer?.blockerCodes ?? []),
    ...(source.webhookConsumer?.blockerCodes ?? []),
    ...(source.publicTiConsumer?.ready ? [] : ["public_ti_handoff_not_ready"])
  ]);
  return {
    schemaVersion: "dwm.case_source_handoff_replay_readiness.v1",
    sourceSchemaVersion: source.schemaVersion,
    available: true,
    ready: Boolean(source.ready),
    state: source.state,
    caseId: input.caseRecord.id,
    alertId: input.caseRecord.alertId,
    organizationId: input.caseRecord.organizationId,
    sourceFamily: source.sourceFamily,
    selectedCaptureIds: source.selectedCaptureIds ?? [],
    evidenceCount: source.evidenceCount ?? 0,
    provenanceCaptureIds: source.provenanceCaptureIds ?? [],
    provenanceSourceIds: source.provenanceSourceIds ?? [],
    provenanceGapCodes: source.provenanceGapCodes ?? [],
    blockerCodes: sourceBlockers,
    stableFields: source.stableFields ?? [],
    gapFields: source.gapFields ?? [],
    consumers: {
      case: {
        ready: Boolean(source.caseConsumer?.ready),
        caseId: source.caseConsumer?.caseId,
        casePath: source.caseConsumer?.casePath,
        idempotencyKey: source.caseConsumer?.idempotencyKey,
        blockerCodes: source.caseConsumer?.blockerCodes ?? []
      },
      webhook: {
        ready: Boolean(source.webhookConsumer?.ready),
        deliveryReady: Boolean(source.webhookConsumer?.deliveryReady),
        delivered: Boolean(source.webhookConsumer?.delivered),
        selectedWebhookDestinationId: source.webhookConsumer?.selectedWebhookDestinationId,
        webhookDestinationIds: source.webhookConsumer?.webhookDestinationIds ?? [],
        deliveryDedupeKey: source.webhookConsumer?.deliveryDedupeKey,
        deliveryHistoryRefs: source.webhookConsumer?.deliveryHistoryRefs ?? [],
        blockerCodes: source.webhookConsumer?.blockerCodes ?? []
      },
      publicTi: {
        ready: Boolean(source.publicTiConsumer?.ready),
        redacted: source.publicTiConsumer?.redacted !== false,
        alertGenerationRefCount: source.publicTiConsumer?.alertGenerationRefCount ?? 0,
        sourceFamily: source.publicTiConsumer?.sourceFamily ?? source.sourceFamily,
        stableFields: source.publicTiConsumer?.stableFields ?? [],
        gapFields: source.publicTiConsumer?.gapFields ?? []
      }
    },
    auditSafety: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false
    }
  };
}

function caseReplayNextAnalystActions(input: {
  caseRecord: AnalystCase;
  access: CaseAccessResult;
  organizationAccessReadiness: any;
  publicTiHandoffReadiness: any;
  sourceHandoffReadiness: any;
  webhookDryRunReadiness: any;
  supportRecoveryReadiness: any;
  handoffActionReadiness?: any;
}) {
  const readOnly = input.access.readOnly === true;
  return [
    {
      id: "review_org_access",
      ownerLane: "org",
      route: input.organizationAccessReadiness.organizationRoute,
      ready: Boolean(input.organizationAccessReadiness.ready),
      blocked: !input.organizationAccessReadiness.ready,
      blockerCodes: input.organizationAccessReadiness.blockerCodes ?? [],
      requiredFields: input.organizationAccessReadiness.requiredFields ?? []
    },
    {
      id: "review_source_handoff",
      ownerLane: "source",
      route: "/v1/dwm/alerts/generation-readiness",
      ready: Boolean(input.sourceHandoffReadiness.ready),
      blocked: !input.sourceHandoffReadiness.ready,
      blockerCodes: input.sourceHandoffReadiness.blockerCodes ?? [],
      requiredFields: ["sourceFamily", "selectedCaptureIds", "provenanceCaptureIds", "provenanceSourceIds"]
    },
    {
      id: "review_public_ti_handoff",
      ownerLane: "publicTI",
      route: input.publicTiHandoffReadiness.route,
      publicRoute: input.publicTiHandoffReadiness.publicRoute,
      ready: Boolean(input.publicTiHandoffReadiness.ready),
      blocked: !input.publicTiHandoffReadiness.ready,
      blockerCodes: input.publicTiHandoffReadiness.blockerCodes ?? [],
      requiredFields: ["query", "sourceFamily", "alertGenerationRefCount", "provenance.captureIds"]
    },
    {
      id: "replay_alert",
      ownerLane: "alert",
      route: input.handoffActionReadiness?.actions?.alertReplay?.route,
      ready: Boolean(input.handoffActionReadiness?.actions?.alertReplay?.ready && !readOnly),
      blocked: readOnly || !input.handoffActionReadiness?.actions?.alertReplay?.ready,
      blockerCodes: uniqueCaseStrings([
        ...(readOnly ? ["case_read_only_member"] : []),
        ...(input.handoffActionReadiness?.actions?.alertReplay?.blockerCodes ?? [])
      ]),
      requiredFields: ["organizationId", "caseId", "casePath", "expectedWorkflowEventCount"]
    },
    {
      id: "test_webhook_delivery",
      ownerLane: "webhook",
      route: input.webhookDryRunReadiness.route,
      ready: Boolean(input.webhookDryRunReadiness.readyForReplay && !readOnly),
      blocked: readOnly || !input.webhookDryRunReadiness.readyForReplay,
      blockerCodes: uniqueCaseStrings([
        ...(readOnly ? ["case_read_only_member"] : []),
        ...(input.webhookDryRunReadiness.blockerCodes ?? [])
      ]),
      requiredFields: input.webhookDryRunReadiness.requiredRequestFields ?? []
    },
    {
      id: "record_customer_notification",
      ownerLane: "case",
      route: `/v1/cases/${encodeURIComponent(input.caseRecord.id)}/customer-notification`,
      ready: Boolean(input.webhookDryRunReadiness.receiptAvailable && !readOnly),
      blocked: readOnly || !input.webhookDryRunReadiness.receiptAvailable,
      blockerCodes: uniqueCaseStrings([
        ...(readOnly ? ["case_read_only_member"] : []),
        ...(!input.webhookDryRunReadiness.receiptAvailable ? ["missing_webhook_dry_run_receipt"] : [])
      ]),
      requiredFields: ["organizationId", "webhookDeliveryId", "rationale"]
    },
    {
      id: "verify_support_recovery",
      ownerLane: "support",
      route: input.supportRecoveryReadiness.route,
      ready: Boolean(input.supportRecoveryReadiness.ready && !readOnly),
      blocked: readOnly || !input.supportRecoveryReadiness.ready,
      blockerCodes: uniqueCaseStrings([
        ...(readOnly ? ["case_read_only_member"] : []),
        ...(input.supportRecoveryReadiness.blockerCodes ?? [])
      ]),
      requiredFields: input.supportRecoveryReadiness.requiredFields ?? []
    }
  ];
}

function caseWebhookDryRunReplayReadiness(input: {
  alert: any;
  caseRecord: AnalystCase;
  deliveries: any[];
  customerNotifications: Array<{
    id: string;
    webhookDeliveryId?: string;
    webhookDestinationId?: string;
    webhookStatus?: string;
    idempotencyKey: string;
  }>;
  handoffActionReadiness?: any;
}) {
  const action = input.handoffActionReadiness?.actions?.webhookDryRun;
  const dryRunDeliveries = [...input.deliveries]
    .filter((delivery: any) => delivery?.dryRun === true || delivery?.status === "dry_run")
    .sort((a: any, b: any) => String(b.attemptedAt ?? "").localeCompare(String(a.attemptedAt ?? "")));
  const destinationIds = uniqueCaseStrings([
    action?.body?.webhookDestinationId,
    ...(action?.body?.webhookDestinationIds ?? []),
    ...(input.alert?.deliveryReadinessContext?.webhookDestinationIds ?? []),
    ...(input.alert?.workflowContext?.webhookDestinationIds ?? []),
    ...(input.alert?.webhookContext?.webhookDestinationIds ?? []),
    ...input.deliveries.map((delivery: any) => delivery.webhookDestinationId),
    ...input.customerNotifications.map((receipt) => receipt.webhookDestinationId)
  ]);
  const deliveryReceipts = dryRunDeliveries.map((delivery: any) => ({
    id: delivery.id,
    alertId: delivery.alertId,
    caseId: input.caseRecord.id,
    organizationId: delivery.organizationId ?? input.caseRecord.organizationId,
    webhookDestinationId: delivery.webhookDestinationId,
    status: delivery.status,
    attemptedAt: delivery.attemptedAt,
    dryRun: delivery.dryRun === true || delivery.status === "dry_run",
    deliveryKind: delivery.deliveryKind,
    httpStatus: delivery.httpStatus,
    endpointHash: delivery.endpointHash,
    payloadHash: delivery.payloadHash,
    dedupeKey: delivery.dedupeKey
  }));
  const linkedNotificationReceipts = input.customerNotifications
    .filter((receipt) => receipt.webhookDeliveryId && dryRunDeliveries.some((delivery: any) => delivery.id === receipt.webhookDeliveryId))
    .map((receipt) => ({
      id: receipt.id,
      webhookDeliveryId: receipt.webhookDeliveryId,
      webhookDestinationId: receipt.webhookDestinationId,
      webhookStatus: receipt.webhookStatus,
      idempotencyKey: receipt.idempotencyKey
    }));
  const actionBlockerCodes = action?.blockerCodes ?? [];
  const receiptBlockers = [
    ...(!destinationIds.length ? ["missing_webhook_destination"] : []),
    ...(!dryRunDeliveries.length ? ["missing_webhook_dry_run_receipt"] : [])
  ];
  const blockerCodes = uniqueCaseStrings([...actionBlockerCodes, ...receiptBlockers]);
  return {
    schemaVersion: "dwm.case_webhook_dry_run_replay_readiness.v1",
    route: action?.route ?? "/v1/dwm/webhooks/deliver",
    method: action?.method ?? "POST",
    caseId: input.caseRecord.id,
    alertId: input.caseRecord.alertId,
    organizationId: input.caseRecord.organizationId,
    destinationIds,
    readyForReplay: Boolean(action?.ready),
    receiptAvailable: dryRunDeliveries.length > 0,
    notificationLinked: linkedNotificationReceipts.length > 0,
    blockerCodes,
    deliveryReceipts,
    latestDelivery: deliveryReceipts[0],
    linkedNotificationReceipts,
    requiredRequestFields: ["organizationId", "alertId", "caseId", "casePath", "webhookDestinationId", "dryRun", "limit"],
    auditSafety: {
      metadataOnly: true,
      endpointSecretExposed: false,
      payloadBodyExposed: false
    }
  };
}

function alertCaseHandoffProvenance(alert: any) {
  const evidence = Array.isArray(alert?.evidence) ? alert.evidence : [];
  const captureIds = uniqueCaseStrings([
    ...(alert?.provenance?.captureIds ?? []),
    ...(alert?.workflowContext?.captureIds ?? []),
    ...evidence.map((item: any) => item.provenance?.captureId ?? item.captureId).filter(Boolean)
  ]);
  const sourceIds = uniqueCaseStrings([
    ...(alert?.provenance?.sourceIds ?? []),
    ...(alert?.workflowContext?.sourceIds ?? []),
    ...evidence.map((item: any) => item.sourceId ?? item.provenance?.sourceId).filter(Boolean)
  ]);
  const contentHashes = uniqueCaseStrings([
    ...(alert?.provenance?.contentHashes ?? []),
    ...evidence.map((item: any) => item.contentHash).filter(Boolean)
  ]);
  const sourceFamilies = uniqueCaseStrings([
    ...(alert?.provenance?.sourceFamilies ?? []),
    ...evidence.map((item: any) => item.sourceFamily).filter(Boolean)
  ]);
  const blockers = [
    captureIds.length ? undefined : { code: "missing_capture_provenance", path: "alert.provenance.captureIds" },
    sourceIds.length ? undefined : { code: "missing_source_provenance", path: "alert.provenance.sourceIds" },
    contentHashes.length ? undefined : { code: "missing_content_hash", path: "alert.provenance.contentHashes" }
  ].filter(Boolean) as Array<{ code: string; path: string }>;
  return {
    captureIds,
    sourceIds,
    contentHashes,
    sourceFamilies,
    evidenceCount: evidence.length,
    blockers
  };
}

function buildAlertCaseHandoff(input: {
  caseRecord: AnalystCase;
  alert: any;
  route?: string;
  idempotencyKey?: string;
  replayState: "recorded" | "reused";
  event?: AnalystCaseEvent;
  provenance: ReturnType<typeof alertCaseHandoffProvenance>;
}) {
  const casePath = input.alert?.casePath ?? input.alert?.workflowContext?.casePath ?? `/v1/cases/${input.caseRecord.id}?alertId=${input.caseRecord.alertId ?? input.alert?.id}`;
  const alertId = input.alert?.id ?? input.caseRecord.alertId;
  const webhookDestinationIds = uniqueCaseStrings([
    ...(input.alert?.deliveryReadinessContext?.webhookDestinationIds ?? []),
    ...(input.alert?.workflowContext?.webhookDestinationIds ?? []),
    ...(input.alert?.webhookContext?.webhookDestinationIds ?? [])
  ]);
  const selectedWebhookDestinationId = webhookDestinationIds[0];
  const workflowEventCount = Array.isArray(input.alert?.workflowEvents) ? input.alert.workflowEvents.length : 0;
  const dedupeKey = stableId("dwm_alert_case_handoff", `${input.caseRecord.tenantId}:${input.caseRecord.organizationId ?? ""}:${alertId}:${input.idempotencyKey ?? input.caseRecord.id}`);
  const deliveryDedupeKey = input.alert?.deliveryReadinessContext?.deliveryDedupeKey
    ?? input.alert?.webhookDelivery?.dedupeKey
    ?? input.alert?.dedupeKey
    ?? stableId("dwm_webhook_delivery", `${input.caseRecord.tenantId}:${input.caseRecord.organizationId ?? ""}:${alertId}:${selectedWebhookDestinationId ?? "missing_destination"}`);
  const readinessBlockers = [
    ...input.provenance.blockers,
    ...(!webhookDestinationIds.length ? [{
      code: "missing_webhook_destination",
      message: "No webhook destination is attached to this alert.",
      path: "alert.workflowContext.webhookDestinationIds"
    }] : []),
    ...(!alertId ? [{
      code: "missing_alert_id",
      message: "Alert replay requires a persisted alert id.",
      path: "alert.id"
    }] : []),
    ...(input.caseRecord.status === "closed" ? [{
      code: "case_closed",
      message: "Case is closed; reopen before sending another customer notification.",
      path: "case.status"
    }] : [])
  ];
  return {
    schemaVersion: "dwm.alert_case_handoff.v1",
    route: input.route ?? "/v1/cases",
    method: "POST",
    tenantId: input.caseRecord.tenantId,
    organizationId: input.caseRecord.organizationId,
    alertId,
    caseId: input.caseRecord.id,
    casePath,
    webhookDestinationIds,
    watchlistIds: uniqueCaseStrings([
      ...(input.alert?.watchlistIds ?? []),
      ...(input.alert?.workflowContext?.watchlistIds ?? [])
    ]),
    watchlistItemIds: caseWatchlistItemIds(input.alert),
    assignedOwner: input.caseRecord.assignedOwner,
    workflowState: {
      caseStatus: input.caseRecord.status,
      alertReviewState: input.alert?.reviewState,
      alertWorkflowStatus: input.alert?.workflowStatus,
      replayState: input.replayState,
      idempotencyKey: input.idempotencyKey,
      dedupeKey
    },
    readiness: {
      schemaVersion: "dwm.alert_case_handoff_readiness.v1",
      replayReady: Boolean(alertId) && input.provenance.blockers.length === 0,
      webhookDryRunReady: Boolean(alertId && selectedWebhookDestinationId) && input.provenance.blockers.length === 0 && input.caseRecord.status !== "closed",
      blockerCodes: uniqueCaseStrings(readinessBlockers.map((blocker) => blocker.code)),
      blockers: readinessBlockers
    },
    consumerActions: {
      alertReplay: {
        schemaVersion: "dwm.alert_replay_request.v1",
        route: `/v1/dwm/alerts/${encodeURIComponent(String(alertId ?? ""))}/replay`,
        method: "POST",
        idempotencyKey: dedupeKey,
        body: {
          organizationId: input.caseRecord.organizationId,
          caseId: input.caseRecord.id,
          casePath,
          expectedWorkflowEventCount: workflowEventCount
        }
      },
      webhookDryRun: {
        schemaVersion: "dwm.webhook_delivery_request.v1",
        route: "/v1/dwm/webhooks/deliver",
        method: "POST",
        idempotencyKey: deliveryDedupeKey,
        dedupeKey: deliveryDedupeKey,
        body: {
          organizationId: input.caseRecord.organizationId,
          alertId,
          caseId: input.caseRecord.id,
          casePath,
          webhookDestinationId: selectedWebhookDestinationId,
          webhookDestinationIds,
          dryRun: true,
          limit: 1
        }
      }
    },
    provenance: {
      source: "dwm_alert",
      alertId,
      caseId: input.caseRecord.id,
      auditEventId: input.event?.auditEventId,
      workflowEventId: input.event?.id,
      captureIds: input.provenance.captureIds,
      sourceIds: input.provenance.sourceIds,
      contentHashes: input.provenance.contentHashes,
      sourceFamilies: input.provenance.sourceFamilies,
      evidenceCount: input.provenance.evidenceCount,
      blockers: input.provenance.blockers
    }
  };
}

function buildCaseHandoffActionReadiness(input: {
  caseRecord: AnalystCase;
  handoff: any;
  deliveries: any[];
  access?: CaseAccessResult;
}) {
  const readOnlyBlockers = input.access?.readOnly === true ? [{
    code: "case_read_only_member",
    message: "Viewer members can inspect case handoff state but cannot replay alerts or send webhook deliveries.",
    path: "access.readOnly"
  }] : [];
  const handoffBlockers = Array.isArray(input.handoff?.readiness?.blockers) ? input.handoff.readiness.blockers : [];
  const replayBlockers = [
    ...readOnlyBlockers,
    ...handoffBlockers.filter((blocker: any) => blocker?.code !== "missing_webhook_destination")
  ];
  const webhookBlockers = [
    ...readOnlyBlockers,
    ...handoffBlockers
  ];
  const latestDryRunDelivery = [...input.deliveries]
    .filter((delivery: any) => delivery.status === "dry_run")
    .sort((a: any, b: any) => String(b.attemptedAt ?? "").localeCompare(String(a.attemptedAt ?? "")))[0];
  const replayAction = input.handoff?.consumerActions?.alertReplay;
  const webhookAction = input.handoff?.consumerActions?.webhookDryRun;
  const replayReady = Boolean(input.handoff?.readiness?.replayReady && replayAction && replayBlockers.length === 0);
  const webhookDryRunReady = Boolean(input.handoff?.readiness?.webhookDryRunReady && webhookAction && webhookBlockers.length === 0);
  return {
    schemaVersion: "dwm.case_handoff_action_readiness.v1",
    generatedFrom: input.handoff?.schemaVersion,
    caseId: input.caseRecord.id,
    alertId: input.handoff?.alertId,
    organizationId: input.caseRecord.organizationId,
    workflowState: input.handoff?.workflowState,
    provenance: {
      captureIds: input.handoff?.provenance?.captureIds ?? [],
      sourceIds: input.handoff?.provenance?.sourceIds ?? [],
      contentHashes: input.handoff?.provenance?.contentHashes ?? [],
      evidenceCount: input.handoff?.provenance?.evidenceCount ?? 0
    },
    readyActionIds: [
      ...(replayReady ? ["alertReplay"] : []),
      ...(webhookDryRunReady ? ["webhookDryRun"] : [])
    ],
    actions: {
      alertReplay: readinessAction("alertReplay", replayReady, replayAction, replayBlockers),
      webhookDryRun: {
        ...readinessAction("webhookDryRun", webhookDryRunReady, webhookAction, webhookBlockers),
        latestDryRunDeliveryId: latestDryRunDelivery?.id,
        latestDryRunAt: latestDryRunDelivery?.attemptedAt,
        latestDryRunStatus: latestDryRunDelivery?.status
      }
    },
    blockerCodes: uniqueCaseStrings([...replayBlockers, ...webhookBlockers].map((blocker: any) => blocker?.code))
  };
}

function readinessAction(id: string, ready: boolean, action: any, blockers: any[]) {
  return {
    id,
    ready,
    route: action?.route,
    method: action?.method,
    idempotencyKey: action?.idempotencyKey,
    dedupeKey: action?.dedupeKey,
    body: action?.body,
    blockerCodes: uniqueCaseStrings(blockers.map((blocker: any) => blocker?.code)),
    blockers
  };
}

function normalizeHandoffActionId(value: unknown): "alertReplay" | "webhookDryRun" | undefined {
  const action = String(value ?? "").trim();
  if (action === "alertReplay" || action === "replay_alert" || action === "alert_replay") return "alertReplay";
  if (action === "webhookDryRun" || action === "webhook_dry_run" || action === "dry_run_webhook") return "webhookDryRun";
  return undefined;
}

function caseWorkflowSummary(caseRecord: AnalystCase) {
  const latest = [...(caseRecord.workflowEvents ?? [])].reverse()[0];
  return {
    status: caseRecord.status,
    assignedOwner: caseRecord.assignedOwner,
    updatedAt: caseRecord.updatedAt,
    latestTransition: latest ? caseWorkflowTransition(caseRecord, latest) : undefined
  };
}

function caseWorkflowTransition(caseRecord: AnalystCase, event: AnalystCaseEvent) {
  return {
    schemaVersion: "analyst.case_workflow_transition.v1",
    caseId: caseRecord.id,
    tenantId: caseRecord.tenantId,
    organizationId: caseRecord.organizationId,
    alertId: caseRecord.alertId,
    at: event.at,
    actor: event.actor,
    action: event.action,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    fromOwner: event.fromOwner,
    toOwner: event.toOwner,
    workflowState: {
      status: caseRecord.status,
      assignedOwner: caseRecord.assignedOwner,
      replayState: event.replayState ?? "recorded",
      idempotencyKey: event.idempotencyKey,
      dedupeKey: event.transitionKey
    },
    provenance: {
      source: "case_workflow",
      caseId: caseRecord.id,
      alertId: caseRecord.alertId,
      auditEventId: event.auditEventId,
      eventId: event.id
    }
  };
}

function selectNotificationDelivery(deliveries: any[], webhookDeliveryId: unknown) {
  const requested = String(webhookDeliveryId ?? "").trim();
  const delivered = deliveries.filter((delivery: any) => delivery.status === "delivered");
  if (requested) return delivered.find((delivery: any) => delivery.id === requested);
  return [...delivered].sort((a: any, b: any) => String(b.attemptedAt ?? "").localeCompare(String(a.attemptedAt ?? "")))[0];
}

function findCase(options: ApiServerOptions, caseId: string | undefined): AnalystCase | undefined {
  if (!caseId) return undefined;
  return (options.store as any).getCase?.(caseId) ?? ((options.store as any).listCases?.() ?? []).find((row: AnalystCase) => row.id === caseId);
}

function findCaseByAlert(options: ApiServerOptions, tenantId: string, alertId: string): AnalystCase | undefined {
  return ((options.store as any).listCases?.() ?? []).find((row: AnalystCase) => row.tenantId === tenantId && row.alertId === alertId);
}

function findDwmAlert(options: ApiServerOptions, alertId: string | undefined) {
  if (!alertId) return undefined;
  return (options.store as any).getDwmAlert?.(alertId) ?? ((options.store as any).listDwmAlerts?.() ?? []).find((row: any) => row.id === alertId);
}

function caseEvent(input: { caseId: string; tenantId?: string; organizationId?: string; generatedAt: string; actor: string; action: string; idempotencyKey?: string; fromStatus?: CaseStatus; toStatus?: CaseStatus; fromOwner?: string; toOwner?: string; note?: string }): AnalystCaseEvent {
  const transitionKey = stableId("case_workflow_transition", `${input.tenantId ?? ""}:${input.organizationId ?? ""}:${input.caseId}:${input.idempotencyKey ?? input.generatedAt}:${input.action}`);
  const id = stableId("case_event", `${input.caseId}:${input.generatedAt}:${input.action}:${input.toStatus ?? ""}:${input.toOwner ?? ""}:${input.note ?? ""}:${input.idempotencyKey ?? ""}`);
  return {
    id,
    at: input.generatedAt,
    actor: input.actor,
    action: input.action,
    idempotencyKey: input.idempotencyKey,
    transitionKey,
    replayState: "recorded",
    auditEventId: stableId("case_workflow_audit", `${input.caseId}:${id}`),
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    fromOwner: input.fromOwner,
    toOwner: input.toOwner,
    note: input.note
  };
}

function normalizeAction(value: unknown, status: unknown): string {
  const action = String(value ?? "").trim();
  if (action) return action;
  const statusValue = String(status ?? "").trim();
  if (statusValue === "closed") return "close";
  if (statusValue === "false_positive") return "false_positive";
  if (statusValue === "suppressed") return "suppress";
  if (statusValue === "escalated") return "escalate";
  return "note";
}

function statusForAction(action: string, status: unknown, current: CaseStatus): CaseStatus {
  const explicit = String(status ?? "").trim();
  if (["open", "escalated", "suppressed", "false_positive", "closed"].includes(explicit)) return explicit as CaseStatus;
  if (action === "escalate") return "escalated";
  if (action === "suppress") return "suppressed";
  if (action === "false_positive") return "false_positive";
  if (action === "close") return "closed";
  if (action === "reopen") return "open";
  return current;
}

function unsupportedCaseAction(action: string): Response | undefined {
  if (["note", "assign", "escalate", "suppress", "false_positive", "close", "reopen"].includes(action)) return undefined;
  return json({
    error: {
      code: "unsupported_case_action",
      message: "Case action is not supported.",
      supportedActions: ["note", "assign", "escalate", "suppress", "false_positive", "close", "reopen"]
    }
  }, 400);
}

function validateCaseTransition(caseRecord: AnalystCase, action: string, nextStatus: CaseStatus): Response | undefined {
  if (caseRecord.status === "closed" && action !== "reopen" && nextStatus !== "closed") {
    return json({
      error: {
        code: "invalid_case_transition",
        message: "Closed cases must be reopened before changing workflow state.",
        fromStatus: caseRecord.status,
        requestedAction: action,
        requestedStatus: nextStatus
      }
    }, 409);
  }
  if ((caseRecord.status === "suppressed" || caseRecord.status === "false_positive") && action !== "reopen" && action !== "note" && nextStatus !== caseRecord.status) {
    return json({
      error: {
        code: "invalid_case_transition",
        message: "Suppressed and false-positive cases must be reopened before changing workflow state.",
        fromStatus: caseRecord.status,
        requestedAction: action,
        requestedStatus: nextStatus
      }
    }, 409);
  }
  return undefined;
}

function normalizePriority(value: unknown): CasePriority {
  return value === "critical" || value === "high" || value === "low" ? value : "medium";
}

function normalizeOwner(value: unknown): string | undefined {
  const owner = String(value ?? "").trim().slice(0, 120);
  return owner || undefined;
}

function normalizeNote(value: unknown): string | undefined {
  const note = String(value ?? "").trim().slice(0, 1000);
  return note || undefined;
}

function sortCaseQueue(a: AnalystCase, b: AnalystCase): number {
  const statusWeight: Record<CaseStatus, number> = { escalated: 5, open: 4, suppressed: 2, false_positive: 1, closed: 0 };
  const priorityWeight: Record<CasePriority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return (statusWeight[b.status] - statusWeight[a.status])
    || (priorityWeight[b.priority] - priorityWeight[a.priority])
    || String(b.updatedAt).localeCompare(String(a.updatedAt));
}
