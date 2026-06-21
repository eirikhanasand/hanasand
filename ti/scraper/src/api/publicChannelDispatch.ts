import { buildPublicChannelApplyPlanRouteResponse, buildPublicChannelStatusRouteResponse } from "./publicChannelRoutes.ts";
import { json, numberQuery, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";

export async function publicChannelApplyPlan(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson(request);
  const result = buildPublicChannelApplyPlanRouteResponse(body, {
    store: options.store,
    publicTelegramSourcePacks: options.publicTelegramSourcePacks as any,
    generatedAt: String(body.generatedAt ?? "") || undefined
  });
  return result.ok ? json(result.body) : json({ error: { code: result.code, message: result.message, details: result.details } }, result.status);
}

export function publicChannelStatus(url: URL, options: ApiServerOptions): Response {
  const result = buildPublicChannelStatusRouteResponse({
    query: url.searchParams.get("q") ?? url.searchParams.get("query") ?? "",
    entityType: url.searchParams.get("entityType") ?? undefined,
    cursor: numberQuery(url.searchParams.get("cursor")) ?? undefined,
    tenantId: url.searchParams.get("tenantId") ?? undefined
  }, { store: options.store, publicTelegramSourcePacks: options.publicTelegramSourcePacks as any });
  return result.ok ? json(result.body) : json({ code: result.code, message: result.message }, result.status);
}
