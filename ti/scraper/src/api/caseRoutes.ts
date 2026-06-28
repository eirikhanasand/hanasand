import { nowIso, stableId } from "../utils.ts";
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

export function listCases(url: URL, options: ApiServerOptions, request?: Request): Response {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const filters = caseFiltersFromUrl(url);
  const cases = ((options.store as any).listCases?.() ?? [])
    .filter((row: AnalystCase) => row.tenantId === scope.tenantId)
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
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  const generatedAt = nowIso();
  const actor = String(body.actor ?? request.headers.get("x-actor-id") ?? "case-api");
  const alertId = String(body.alertId ?? body.sourceId ?? "").trim();
  if (!alertId) return json({ error: { code: "missing_alert_id", message: "A DWM alert ID is required to open a case." } }, 400);

  const alert = findDwmAlert(options, alertId);
  if (!alert || alert.tenantId !== scope.tenantId) return json({ error: { code: "alert_not_found", message: "DWM alert not found for this organization." } }, 404);

  const id = String(body.id ?? stableId("case", `${scope.tenantId}:${alert.id}`));
  const existing = (options.store as any).getCase?.(id) ?? findCaseByAlert(options, scope.tenantId, alert.id);
  if (existing && body.reopen !== true) return json({ organization: scope.organization, access: caseAccessSummary(access), case: existing, alert }, 200);

  const assignedOwner = normalizeOwner(body.assignedOwner ?? body.owner);
  const ownerValidation = validateAssignedOwner(options, scope.organizationId, assignedOwner);
  if (ownerValidation) return ownerValidation;
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
  return json({ organization: scope.organization, access: caseAccessSummary(access), case: saved, alert }, existing ? 200 : 201);
}

export function getCaseDetail(url: URL, options: ApiServerOptions, caseId: string | undefined, request?: Request): Response {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const caseRecord = findCase(options, caseId);
  if (!caseRecord || caseRecord.tenantId !== scope.tenantId) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);
  return json(buildCaseDetail(caseRecord, options, scope.organization, access));
}

export function exportCaseEvidence(url: URL, options: ApiServerOptions, caseId: string | undefined, request?: Request): Response {
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  const caseRecord = findCase(options, caseId);
  if (!caseRecord || caseRecord.tenantId !== scope.tenantId) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);
  return json(buildCaseExport(caseRecord, options, scope.organization, access, exportOptionsFromUrl(url)));
}

export async function updateCase(request: Request, options: ApiServerOptions, caseId: string | undefined): Promise<Response> {
  const existing = findCase(options, caseId);
  if (!existing) return json({ error: { code: "case_not_found", message: "Case not found." } }, 404);
  const body = await readJson<any>(request);
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeCaseAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
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
  const ownerValidation = validateAssignedOwner(options, scope.organizationId, assignedOwner);
  if (ownerValidation) return ownerValidation;
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
  return json({ organization: scope.organization, access: caseAccessSummary(access), case: saved, event, alert: alert ? findDwmAlert(options, alert.id) : undefined });
}

function buildCaseDetail(caseRecord: AnalystCase, options: ApiServerOptions, organization: unknown, access?: CaseAccessResult) {
  const alert = findDwmAlert(options, caseRecord.alertId);
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === caseRecord.alertId);
  const watchlists = caseWatchlists(options, alert, caseRecord);
  const timeline = buildCaseTimeline(caseRecord, alert, deliveries);

  return {
    schemaVersion: "analyst.case_detail.v1",
    generatedAt: nowIso(),
    organization,
    access: caseAccessSummary(access),
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
  const timeline = buildCaseTimeline(caseRecord, alert, deliveries);
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
    delivered: deliveryEvidence.some((delivery) => delivery.status === "delivered")
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
    deliveryEvidence,
    nextAllowedActions,
    copyText: caseExportCopyText(summary, evidence, deliveryEvidence, matchedWatchlistTerms),
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
      matchedWatchlistTerms
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

function caseExportCopyText(summary: any, evidence: Array<any>, deliveryEvidence: Array<any>, matchedWatchlistTerms: Array<any>): string {
  const visibleEvidence = evidence.slice(0, 5).map((item) => `- ${item.sourceName ?? item.sourceFamily ?? item.id}: ${item.excerpt} (${item.contentHash})`).join("\n");
  return [
    `Case ${summary.caseId}: ${summary.title}`,
    `Status: ${summary.status}; severity: ${summary.severity}; route: ${summary.recommendedRoute ?? "unrouted"}`,
    `Alert: ${summary.alertId}; dedupe: ${summary.dedupeKey}`,
    `Matched watchlist terms: ${matchedWatchlistTerms.map((term) => `${term.kind}:${term.value}`).join(", ") || "none"}`,
    `Webhook deliveries: ${deliveryEvidence.map((delivery) => `${delivery.deliveryId}:${delivery.status}`).join(", ") || "none"}`,
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
    from: normalizeFilter(url.searchParams.get("from") ?? url.searchParams.get("since")),
    to: normalizeFilter(url.searchParams.get("to") ?? url.searchParams.get("until")),
    query: normalizeFilter(url.searchParams.get("q") ?? url.searchParams.get("query") ?? url.searchParams.get("text"))
  };
}

function caseMatchesFilters(caseRecord: AnalystCase, filters: CaseFilters, options: ApiServerOptions): boolean {
  const alert = findDwmAlert(options, caseRecord.alertId);
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === caseRecord.alertId);
  if (filters.status && caseRecord.status !== filters.status) return false;
  if (filters.assignee && normalizeFilter(caseRecord.assignedOwner) !== filters.assignee) return false;
  if (filters.severity && normalizeFilter(alert?.severity ?? caseRecord.priority) !== filters.severity) return false;
  if (filters.route && normalizeFilter(alert?.recommendedRoute ?? alert?.webhookDelivery?.recommendedRoute ?? alert?.workflowContext?.recommendedRoute) !== filters.route) return false;
  if (filters.watchlistItemId && !caseWatchlistItemIds(alert).includes(filters.watchlistItemId)) return false;
  if (filters.alertId && alert?.id !== filters.alertId && caseRecord.alertId !== filters.alertId) return false;
  if (filters.dedupeKey && normalizeFilter(alert?.dedupeKey ?? alert?.webhookDelivery?.dedupeKey ?? alert?.workflowContext?.dedupeKey) !== filters.dedupeKey) return false;
  if (filters.webhookDeliveryId && !deliveries.some((delivery: any) => delivery.id === filters.webhookDeliveryId)) return false;
  if (filters.webhookStatus && !deliveries.some((delivery: any) => normalizeFilter(delivery.status) === filters.webhookStatus)) return false;
  if ((filters.from || filters.to) && !caseHasTimelineInWindow(caseRecord, alert, deliveries, filters)) return false;
  if (filters.query && !caseSearchBlob(caseRecord, alert, deliveries).includes(filters.query)) return false;
  return true;
}

function caseListItem(caseRecord: AnalystCase, options: ApiServerOptions, access?: CaseAccessResult) {
  const alert = findDwmAlert(options, caseRecord.alertId);
  const deliveries = ((options.store as any).listDwmWebhookDeliveries?.() ?? []).filter((row: any) => row.alertId === caseRecord.alertId);
  const timeline = buildCaseTimeline(caseRecord, alert, deliveries);
  const latestEvent = timeline[timeline.length - 1];
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
    createdAt: caseRecord.createdAt,
    updatedAt: caseRecord.updatedAt,
    closedAt: caseRecord.closedAt,
    latestEvent,
    timeline,
    nextAllowedActions: nextAllowedActionsForCase(caseRecord, alert, deliveries, access)
  };
}

function buildCaseTimeline(caseRecord: AnalystCase, alert: any, deliveries: any[]) {
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
    ...(caseRecord.workflowEvents ?? []).map((event) => caseTimelineEvent({
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
      alertId: input.alert?.id,
      dedupeKey: input.alert?.dedupeKey ?? input.alert?.webhookDelivery?.dedupeKey ?? input.alert?.workflowContext?.dedupeKey,
      watchlistIds: input.alert?.watchlistIds ?? input.alert?.workflowContext?.watchlistIds ?? [],
      watchlistItemIds: caseWatchlistItemIds(input.alert),
      webhookDeliveryId: input.webhookDelivery?.id,
      webhookDestinationId: input.webhookDelivery?.webhookDestinationId,
      webhookStatus: input.webhookDelivery?.status
    },
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    fromOwner: input.fromOwner,
    toOwner: input.toOwner,
    detail
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

function caseHasTimelineInWindow(caseRecord: AnalystCase, alert: any, deliveries: any[], filters: CaseFilters): boolean {
  const from = filters.from ? Date.parse(filters.from) : undefined;
  const to = filters.to ? Date.parse(filters.to) : undefined;
  return buildCaseTimeline(caseRecord, alert, deliveries).some((event) => {
    const timestamp = Date.parse(event.timestamp);
    if (!Number.isFinite(timestamp)) return false;
    if (from !== undefined && Number.isFinite(from) && timestamp < from) return false;
    if (to !== undefined && Number.isFinite(to) && timestamp > to) return false;
    return true;
  });
}

function caseSearchBlob(caseRecord: AnalystCase, alert: any, deliveries: any[]): string {
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
    ...deliveries.flatMap((delivery: any) => [delivery.id, delivery.status, delivery.webhookDestinationId, delivery.error])
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
