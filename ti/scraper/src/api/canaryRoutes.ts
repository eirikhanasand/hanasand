import {
  activatePublicCanarySources,
  buildCanaryOperatorSummary,
  buildCanaryReadinessPacket,
  runCanaryCollectionCycle
} from "../ops/canaryCollection.ts";
import { booleanQuery, json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { nowIso } from "../utils.ts";

export async function canaryActivation(request: Request, options: ApiServerOptions): Promise<Response> {
  const input = await readJson(request);
  return json({ activation: activatePublicCanarySources({ store: options.store, tenantId: input.tenantId, operatorId: input.approvedBy, now: input.generatedAt }) });
}

export async function canaryRun(request: Request, options: ApiServerOptions): Promise<Response> {
  const input = await readJson(request);
  const canaryRun = await runCanaryCollectionCycle({
    store: options.store, frontier: options.frontier, objectStore: options.objectStore,
    fetch: options.canaryFetch as any, activateSources: false,
    maxSources: input.maxSources, maxTasks: input.maxTasks,
    maxItemsPerTask: input.maxItemsPerTask, timeoutMs: input.timeoutMs,
    maxConcurrentTasks: input.maxConcurrentTasks,
    now: () => input.generatedAt ?? nowIso()
  });
  return json({ canaryRun });
}

export function canaryOperator(options: ApiServerOptions): Response {
  return json({ operatorView: buildCanaryOperatorSummary({ store: options.store, frontier: options.frontier, runtime: (options.canaryLoop as any)?.getState?.() }) });
}

export function canaryReadiness(url: URL, options: ApiServerOptions): Response {
  return json({ readiness: buildCanaryReadinessPacket({ store: options.store, frontier: options.frontier, requiredQueries: (url.searchParams.get("requiredQueries") ?? "APT42,Turla").split(","), requireNativeLiveHttp: booleanQuery(url.searchParams.get("requireNativeLiveHttp")) === true, generatedAt: url.searchParams.get("generatedAt") ?? undefined }) });
}
