import { scheduleWatchlistDiscoveryRuns } from "../ops/watchlistDiscovery.ts";
import { stableId } from "../utils.ts";
import { authorizeDwmWorkflowAccess } from "./dwmWorkflowRoutes.ts";
import { error, json, readJson } from "./http.ts";
import { resolveOrganizationScope } from "./organizationRoutes.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

export async function createDwmCollectionRequest(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson<any>(request);
  const scope = resolveOrganizationScope({ body, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, body, mode: "mutate" });
  if (access.error) return access.error;
  if (!scope.organizationId) return error("organization_required", "Select an organization before requesting collection", 400);
  if (!access.member || !["owner", "admin"].includes(access.member.role)) {
    return error("collection_role_required", "Fresh collection requires an active organization owner or administrator", 403);
  }
  if (typeof options.runExecutor !== "function") return error("collection_unavailable", "Collection execution is unavailable", 503);

  const watchlists = ((options.store as any).listDwmWatchlists?.() ?? []).filter((row: any) =>
    row.tenantId === scope.tenantId && row.organizationId === scope.organizationId && row.status === "active");
  if (!watchlists.some((row: any) => Array.isArray(row.terms) && row.terms.length)) {
    return error("missing_watchlist", "Create an active organization watchlist before requesting collection", 400);
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (idempotencyKey && !/^[A-Za-z0-9_.:-]{1,200}$/.test(idempotencyKey)) return error("invalid_idempotency_key", "Idempotency-Key is invalid", 400);
  const requestId = stableId("dwm_collection_request", `${scope.tenantId}:${scope.organizationId}:${idempotencyKey ?? crypto.randomUUID()}`);
  const existing = collectionRequestStatus(options, scope.tenantId, scope.organizationId, requestId);
  if (existing) return json({ collectionRequest: existing });
  const scheduled = await scheduleWatchlistDiscoveryRuns({
    ...options,
    awaitWatchlistDiscoveryExecution: false,
    watchlistDiscoveryMaxJobs: 25,
    watchlistDiscoveryScope: { tenantId: scope.tenantId, organizationId: scope.organizationId },
    watchlistDiscoveryRequestId: requestId,
    watchlistDiscoveryRequesterId: access.member.id
  });
  if (!scheduled.runIds?.length && scheduled.reason !== "already_scheduled") {
    return error("collection_unavailable", collectionUnavailableMessage(scheduled.reason), 503);
  }
  const status = collectionRequestStatus(options, scope.tenantId, scope.organizationId, requestId);
  if (!status) return error("collection_unavailable", "Collection request was not persisted", 503);
  return json({ collectionRequest: status }, scheduled.runIds?.length ? 202 : 200);
}

export function getDwmCollectionRequest(request: Request, options: ApiServerOptions, requestId: string): Response {
  const url = new URL(request.url);
  const scope = resolveOrganizationScope({ url, request }, options);
  if (scope.error) return scope.error;
  const access = authorizeDwmWorkflowAccess({ options, scope, request, url, mode: "read" });
  if (access.error) return access.error;
  if (!scope.organizationId) return error("organization_required", "Select an organization before reading collection status", 400);
  const status = collectionRequestStatus(options, scope.tenantId, scope.organizationId, requestId);
  return status ? json({ collectionRequest: status }) : error("not_found", "Collection request not found", 404);
}

function collectionRequestStatus(options: ApiServerOptions, tenantId: string, organizationId: string, requestId: string) {
  const plans = (options.store.listPlans?.() ?? []).filter((plan: any) =>
    (plan.tenantId ?? plan.request?.tenantId) === tenantId
    && plan.request?.organizationId === organizationId
    && plan.request?.collectionRequestId === requestId);
  if (!plans.length) return undefined;
  const planIds = new Set(plans.map((plan: any) => plan.id));
  const runs = (options.store.listRuns?.() ?? []).filter((run: any) => run.tenantId === tenantId && planIds.has(run.planId));
  const captureIds = new Set(runs.flatMap((run: any) => run.captureIds ?? []));
  const alertIds = ((options.store as any).listDwmAlerts?.() ?? [])
    .filter((alert: any) => alert.tenantId === tenantId && alert.organizationId === organizationId)
    .filter((alert: any) => alertCaptureIds(alert).some((id) => captureIds.has(id)))
    .map((alert: any) => alert.id);
  const statuses = runs.map((run: any) => String(run.status));
  const status = statuses.some((value) => value === "running") ? "running"
    : statuses.some((value) => value === "queued") ? "queued"
    : statuses.length && statuses.every((value) => value === "completed") ? "completed"
    : "failed";
  return {
    requestId,
    status,
    runIds: runs.map((run: any) => run.id),
    captureCount: runs.reduce((total: number, run: any) => total + Number(run.captureCount ?? 0), 0),
    alertCount: alertIds.length,
    alertIds,
    createdAt: runs.map((run: any) => run.createdAt).filter(Boolean).sort()[0],
    updatedAt: runs.map((run: any) => run.updatedAt).filter(Boolean).sort().at(-1),
    completedAt: statuses.every((value) => !["queued", "running"].includes(value))
      ? runs.map((run: any) => run.completedAt).filter(Boolean).sort().at(-1)
      : undefined,
    errors: runs.map((run: any) => run.error).filter(Boolean)
  };
}

function alertCaptureIds(alert: any): string[] {
  return [...new Set([
    ...(alert.workflowContext?.captureIds ?? []),
    ...(alert.provenance?.captureIds ?? []),
    ...(alert.evidence ?? []).map((item: any) => item.captureId)
  ].filter(Boolean).map(String))];
}

function collectionUnavailableMessage(reason: unknown) {
  if (reason === "no_verified_query_provider") return "No verified public discovery provider is available";
  if (reason === "scheduler_unavailable") return "Collection scheduler is unavailable";
  return "No collection run could be scheduled";
}
