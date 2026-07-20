import {
  activatePublicCanarySources,
  buildCanaryOperatorConsoleHtml,
  buildCanaryOperatorSummary,
  buildCanaryReadinessPacket,
  buildCanarySoakReport,
  pausePublicCanarySources,
  runCanaryCollectionCycle
} from "../ops/canaryCollection.ts";
import { booleanQuery, error, json, numberQuery, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { nowIso } from "../utils.ts";
import { authenticateOperatorRequest } from "./requestAuthentication.ts";

export async function canaryActivation(request: Request, options: ApiServerOptions): Promise<Response> {
  const input = await canaryInput(request);
  const authentication = await authenticateOperatorRequest(request, options);
  if (authentication.error) return authentication.error;
  if (input.operatorApproval !== true) return error("approval_required", "operatorApproval=true is required for executable canary source activation", 409);
  const activation = activatePublicCanarySources({ store: options.store, tenantId: input.tenantId, operatorId: authentication.identity?.id ?? input.approvedBy, now: input.generatedAt });
  return isForm(request) ? consoleRedirect("activated") : json({ activation });
}

export async function canaryRun(request: Request, options: ApiServerOptions): Promise<Response> {
  const input = await canaryInput(request);
  const authentication = await authenticateOperatorRequest(request, options);
  if (authentication.error) return authentication.error;
  if (input.operatorApproval !== true) return error("approval_required", "operatorApproval=true is required to run the public canary collector", 409);
  const canaryRun = await runCanaryCollectionCycle({
    store: options.store, frontier: options.frontier, objectStore: options.objectStore,
    fetch: options.canaryFetch as any, activateSources: false,
    tenantId: input.tenantId, sourceIds: input.sourceIds,
    maxSources: input.maxSources, maxTasks: input.maxTasks,
    maxItemsPerTask: input.maxItemsPerTask, timeoutMs: input.timeoutMs,
    maxConcurrentTasks: input.maxConcurrentTasks,
    now: () => input.generatedAt ?? nowIso()
  });
  if (isForm(request)) return consoleRedirect("ran");
  return json({ canaryRun, operatorView: buildCanaryOperatorSummary({ store: options.store, frontier: options.frontier, generatedAt: canaryRun.generatedAt, runtime: (options.canaryLoop as any)?.getState?.() }) });
}

export async function canaryPause(request: Request, options: ApiServerOptions): Promise<Response> {
  const input = await canaryInput(request);
  const authentication = await authenticateOperatorRequest(request, options);
  if (authentication.error) return authentication.error;
  if (input.operatorApproval !== true) return error("approval_required", "operatorApproval=true is required to pause canary source collection", 409);
  const pause = pausePublicCanarySources({ store: options.store, tenantId: input.tenantId, operatorId: authentication.identity?.id ?? input.approvedBy, now: input.generatedAt });
  return isForm(request) ? consoleRedirect("paused") : json({ pause });
}

export function canaryOperator(options: ApiServerOptions): Response {
  return json({ operatorView: buildCanaryOperatorSummary({ store: options.store, frontier: options.frontier, runtime: (options.canaryLoop as any)?.getState?.() }) });
}

export function canaryReadiness(url: URL, options: ApiServerOptions): Response {
  return json({ readiness: buildCanaryReadinessPacket({ store: options.store, frontier: options.frontier, requiredQueries: (url.searchParams.get("requiredQueries") ?? "APT42,Turla").split(","), minActiveSources: numberQuery(url.searchParams.get("minActiveSources")), maxFreshnessSeconds: numberQuery(url.searchParams.get("maxFreshnessSeconds")), requireExternalObjectStorage: booleanQuery(url.searchParams.get("requireExternalObjectStorage")) !== false, requireNativeLiveHttp: booleanQuery(url.searchParams.get("requireNativeLiveHttp")) === true, generatedAt: url.searchParams.get("generatedAt") ?? undefined }) });
}

export function canarySoak(url: URL, options: ApiServerOptions): Response {
  const generatedAt = url.searchParams.get("generatedAt") ?? undefined;
  return json({
    soak: buildCanarySoakReport({ store: options.store, frontier: options.frontier, generatedAt, windowHours: numberQuery(url.searchParams.get("windowHours")), minCycles: numberQuery(url.searchParams.get("minCycles")), maxFreshnessSeconds: numberQuery(url.searchParams.get("maxFreshnessSeconds")), requireNativeLiveHttp: booleanQuery(url.searchParams.get("requireNativeLiveHttp")) === true }),
    operatorView: buildCanaryOperatorSummary({ store: options.store, frontier: options.frontier, generatedAt, runtime: (options.canaryLoop as any)?.getState?.() })
  });
}

export function canaryConsole(url: URL, options: ApiServerOptions): Response {
  const view = buildCanaryOperatorSummary({ store: options.store, frontier: options.frontier, generatedAt: url.searchParams.get("generatedAt") ?? undefined, runtime: (options.canaryLoop as any)?.getState?.() });
  return new Response(buildCanaryOperatorConsoleHtml(view), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

async function canaryInput(request: Request): Promise<any> {
  if (!isForm(request)) {
    const input = await readJson(request);
    return { ...input, sourceIds: sourceIds(input.sourceIds) };
  }
  const input = Object.fromEntries(await request.formData());
  return {
    ...input,
    operatorApproval: input.operatorApproval === "true",
    maxSources: numeric(input.maxSources),
    maxTasks: numeric(input.maxTasks),
    maxItemsPerTask: numeric(input.maxItemsPerTask),
    timeoutMs: numeric(input.timeoutMs),
    maxConcurrentTasks: numeric(input.maxConcurrentTasks)
  };
}

function sourceIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.filter((item): item is string => typeof item === "string" && /^[A-Za-z0-9_.:-]{1,200}$/.test(item));
  return ids.length ? [...new Set(ids)].slice(0, 100) : undefined;
}

function numeric(value: unknown): number | undefined {
  const parsed = Number(value);
  return value === undefined || value === "" || !Number.isFinite(parsed) ? undefined : parsed;
}
function isForm(request: Request): boolean { return (request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded"); }
function consoleRedirect(status: string): Response { return new Response(null, { status: 303, headers: { location: `/v1/ops/canary/console?status=${encodeURIComponent(status)}`, "cache-control": "no-store" } }); }
