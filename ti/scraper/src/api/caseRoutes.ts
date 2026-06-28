import { nowIso, stableId } from "../utils.ts";
import { json, readJson } from "./http.ts";
import { resolveOrganizationScope } from "./organizationRoutes.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

type CaseStatus = "open" | "escalated" | "suppressed" | "false_positive" | "closed";
type CasePriority = "critical" | "high" | "medium" | "low";

type AnalystCaseEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  fromStatus?: CaseStatus;
  toStatus?: CaseStatus;
  fromOwner?: string;
  toOwner?: string;
  note?: string;
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
  lastDecision?: string;
  deliveryState?: string;
};

export function listCases(url: URL, options: ApiServerOptions): Response {
  const scope = resolveOrganizationScope({ url }, options);
  if (scope.error) return scope.error;
  const requestedStatus = url.searchParams.get("status");
  const cases = ((options.store as any).listCases?.() ?? [])
    .filter((row: AnalystCase) => row.tenantId === scope.tenantId)
    .filter((row: AnalystCase) => !requestedStatus || row.status === requestedStatus)
    .sort((a: AnalystCase, b: AnalystCase) => sortCaseQueue(a, b));
  return json({ organization: scope.organization, cases });
}

export async function createCase(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const generatedAt = nowIso();
  const actor = String(body.actor ?? request.headers.get("x-actor-id") ?? "case-api");
  const alertId = String(body.alertId ?? body.sourceId ?? "").trim();
  if (!alertId) return json({ error: { code: "missing_alert_id", message: "A DWM alert ID is required to open a case." } }, 400);

  const alert = findDwmAlert(options, alertId);
  if (!alert || alert.tenantId !== scope.tenantId) return json({ error: { code: "alert_not_found", message: "DWM alert not found for this organization." } }, 404);

  const id = String(body.id ?? stableId("case", `${scope.tenantId}:${alert.id}`));
  const existing = (options.store as any).getCase?.(id) ?? findCaseByAlert(options, scope.tenantId, alert.id);
  if (existing && body.reopen !== true) return json({ organization: scope.organization, case: existing, alert }, 200);

  const assignedOwner = normalizeOwner(body.assignedOwner ?? body.owner);
  const note = normalizeNote(body.note ?? "Case opened from DWM alert.");
  const event = caseEvent({
    caseId: id,
    generatedAt,
    actor,
    action: existing ? "reopen" : "open",
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
  return json({ organization: scope.organization, case: saved, alert }, existing ? 200 : 201);
}

export function getCaseDetail(url: URL, options: ApiServerOptions, caseId: string | undefined): Response {
  const scope = resolveOrganizationScope({ url }, options);
  if (scope.error) return scope.error;
  const caseRecord = findCase(options, caseId);
  if (!caseRecord || caseRecord.tenantId !== scope.tenantId) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);
  return json(buildCaseDetail(caseRecord, options, scope.organization));
}

export async function updateCase(request: Request, options: ApiServerOptions, caseId: string | undefined): Promise<Response> {
  const existing = findCase(options, caseId);
  if (!existing) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);
  const body = await readJson<any>(request);
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  if (existing.tenantId !== scope.tenantId) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);

  const generatedAt = nowIso();
  const actor = String(body.actor ?? request.headers.get("x-actor-id") ?? "case-api");
  const action = normalizeAction(body.action, body.status);
  const nextStatus = statusForAction(action, body.status, existing.status);
  const note = normalizeNote(body.note);
  if ((action === "close" || nextStatus === "closed" || action === "false_positive" || action === "suppress") && !note) {
    return json({ error: { code: "missing_decision_rationale", message: "Closing, suppressing, or marking false positive requires an analyst note." } }, 400);
  }
  const assignedOwner = body.assignedOwner === undefined && body.owner === undefined ? existing.assignedOwner : normalizeOwner(body.assignedOwner ?? body.owner);
  const event = caseEvent({
    caseId: existing.id,
    generatedAt,
    actor,
    action,
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
  return json({ organization: scope.organization, case: saved, event, alert: alert ? findDwmAlert(options, alert.id) : undefined });
}

function buildCaseDetail(caseRecord: AnalystCase, options: ApiServerOptions, organization: unknown) {
  const alert = findDwmAlert(options, caseRecord.alertId);
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === caseRecord.alertId);
  const watchlists = caseWatchlists(options, alert, caseRecord);
  const timeline = [
    { id: `${caseRecord.id}:created`, at: caseRecord.createdAt, type: "case_created", title: "Case opened", detail: caseRecord.summary },
    ...(caseRecord.workflowEvents ?? []).map((event) => ({
      id: event.id,
      at: event.at,
      type: "case_event",
      title: event.action.replaceAll("_", " "),
      detail: [event.note, event.toOwner ? `Owner: ${event.toOwner}` : undefined, event.toStatus ? `Status: ${event.toStatus}` : undefined].filter(Boolean).join(" · ")
    })),
    ...deliveries.map((delivery: any) => ({
      id: delivery.id,
      at: delivery.attemptedAt,
      type: "delivery",
      title: `Webhook ${String(delivery.status ?? "attempt").replaceAll("_", " ")}`,
      detail: delivery.error ?? `HTTP ${delivery.httpStatus ?? 0} · ${delivery.endpointHash}`
    }))
  ].sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));

  return {
    schemaVersion: "analyst.case_detail.v1",
    generatedAt: nowIso(),
    organization,
    case: caseRecord,
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
    deliveries,
    evidence: alert?.evidence ?? [],
    timeline,
    nextActions: nextActionsForCase(caseRecord, alert, deliveries)
  };
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

function nextActionsForCase(caseRecord: AnalystCase, alert: any, deliveries: any[]) {
  if (caseRecord.status === "closed") return ["Keep closed unless new evidence changes the decision."];
  if (caseRecord.status === "false_positive" || caseRecord.status === "suppressed") return ["Monitor for new evidence before reopening."];
  if (!caseRecord.assignedOwner) return ["Assign an owner.", "Review evidence.", "Decide whether to notify the customer."];
  if (alert?.deliveryState === "ready_to_send" && !deliveries.some((delivery: any) => delivery.status === "delivered")) return ["Send or retry customer delivery.", "Record the delivery decision."];
  return ["Review evidence.", "Add decision rationale.", "Escalate, suppress, mark false positive, or close."];
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

function caseEvent(input: { caseId: string; generatedAt: string; actor: string; action: string; fromStatus?: CaseStatus; toStatus?: CaseStatus; fromOwner?: string; toOwner?: string; note?: string }): AnalystCaseEvent {
  return {
    id: stableId("case_event", `${input.caseId}:${input.generatedAt}:${input.action}:${input.toStatus ?? ""}:${input.toOwner ?? ""}:${input.note ?? ""}`),
    at: input.generatedAt,
    actor: input.actor,
    action: input.action,
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
