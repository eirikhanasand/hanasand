import { buildDarkwebIndexStatus, searchDarkwebIndex } from "../adapters/darkwebIndex.ts";
import { buildRestrictedMetadataOperationsStatus } from "../adapters/darknetMetadata.ts";
import { nowIso } from "../utils.ts";
import { canaryActivation, canaryOperator, canaryReadiness, canaryRun } from "./canaryRoutes.ts";
import { contractIndex } from "./contractsRoute.ts";
import { error, json, numberQuery, page, readJson } from "./http.ts";
import { publicChannelApplyPlan, publicChannelStatus } from "./publicChannelDispatch.ts";
import { qualityPayload } from "./qualityRoute.ts";
import { createRun, runResults, runStatus } from "./runRoutes.ts";
import { searchResponse } from "./searchRoute.ts";
import type { ApiServerHandle, ApiServerOptions } from "./serverTypes.ts";
import { metrics, productSlo } from "./sloRoute.ts";
import { createSource, sourceApplyPlan, updateSource } from "./sourceRoutes.ts";
export type { ApiServerHandle, ApiServerOptions } from "./serverTypes.ts";
export function startApiServer(options: ApiServerOptions): ApiServerHandle {
  const server = Bun.serve({ port: options.port ?? 8097, fetch: (request) => handleApiRequest(request, options) });
  return { server, port: server.port ?? options.port ?? 8097, stop: () => server.stop(true) };
}
export async function handleApiRequest(request: Request, options: ApiServerOptions): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/v1/health") return json({ ok: true, service: "ti-scraper", generatedAt: nowIso() });
    if (url.pathname === "/v1/contracts") return json(contractIndex());
    if (url.pathname === "/v1/metrics") return json(metrics(options));
    if (url.pathname === "/v1/sources" && request.method === "GET") return json({ sources: page(options.store.listSources(), url) });
    if (url.pathname === "/v1/sources" && request.method === "POST") return createSource(request, options);
    if (url.pathname.startsWith("/v1/sources/") && request.method === "PATCH") return updateSource(request, options, url.pathname.split("/")[3]);
    if (url.pathname === "/v1/sources/atlas") return json({ records: page(options.store.listSources(), url), summary: { total: options.store.listSources().length } });
    if (url.pathname === "/v1/sources/apply-plan") return sourceApplyPlan(request, options);
    if (url.pathname === "/v1/sources/coverage-plan") return json({ queries: (await readJson(request)).queries ?? [], slo: { goal: "add payworthy fresh rows" } });
    if (url.pathname === "/v1/intel/search" || url.pathname === "/api/ti/search") return searchResponse(request, options, url);
    if (url.pathname === "/v1/intel/runs" && request.method === "POST") return createRun(request, options);
    if (/^\/v1\/intel\/runs\/[^/]+$/.test(url.pathname)) return runStatus(options, url.pathname.split("/").pop() ?? "");
    if (/^\/v1\/intel\/runs\/[^/]+\/results$/.test(url.pathname)) return runResults(options, url.pathname.split("/")[4]);
    if (url.pathname === "/v1/darkweb/status") return json({ status: buildDarkwebIndexStatus({ sources: options.store.listSources(), captures: options.store.listCaptures() } as any) });
    if (url.pathname === "/v1/darkweb/search") return json(searchDarkwebIndex({ query: url.searchParams.get("q") ?? "", sources: options.store.listSources(), captures: options.store.listCaptures(), limit: numberQuery(url.searchParams.get("limit")) ?? 50 } as any));
    if (url.pathname === "/v1/restricted-metadata/status") return json({ status: buildRestrictedMetadataOperationsStatus({ sources: options.store.listSources(), captures: options.store.listCaptures(), query: url.searchParams.get("q") ?? undefined }) });
    if (url.pathname === "/v1/restricted-metadata/apply-plan") return json({ endpoint: "/v1/restricted-metadata/apply-plan", metadataOnly: true, actions: [] });
    if (url.pathname === "/v1/public-channels/apply-plan") return publicChannelApplyPlan(request, options);
    if (url.pathname === "/v1/public-channels/status") return publicChannelStatus(url, options);
    if (url.pathname === "/v1/quality/evaluate") return json(qualityPayload(url.searchParams.get("q") ?? ""));
    if (url.pathname === "/v1/ops/product-slo") return json({ route: "/v1/ops/product-slo", ...productSlo(options, url) });
    if (url.pathname === "/v1/sources/canary-activation") return canaryActivation(request, options);
    if (url.pathname === "/v1/ops/canary/run") return canaryRun(request, options);
    if (url.pathname === "/v1/ops/canary") return canaryOperator(options);
    if (url.pathname === "/v1/ops/canary/readiness") return canaryReadiness(url, options);
    if (url.pathname === "/v1/ops/resource-snapshot") return json({ service: "ti-scraper", queue: { queued: options.frontier.size() }, workers: options.supervisor?.snapshot() ?? [] });
    if (url.pathname === "/v1/frontier") return json({ queued: options.frontier.size(), tasks: options.frontier.snapshot?.() ?? [] });
    if (url.pathname.endsWith("/apply-plan")) return json({ endpoint: url.pathname, dryRun: true, actions: [] });
    if (url.pathname.includes("/exports/stix")) return json({ type: "bundle", objects: [] });
    if (url.pathname.includes("/graph/")) return json({ endpoint: url.pathname, nodes: [], relationships: [] });
    return error("not_found", "Route not found", 404);
  } catch (caught) {
    return error("internal_error", caught instanceof Error ? caught.message : String(caught), 500);
  }
}
