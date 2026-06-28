import { buildDarkwebIndexStatus, searchDarkwebIndex } from "../adapters/darkwebIndex.ts";
import { buildRestrictedMetadataOperationsStatus } from "../adapters/darknetMetadata.ts";
import { createDwmSourceRequest } from "./dwmSourceRequestRoute.ts";
import { createDwmWatchlist, deliverDwmWebhooks, getDwmAlertDetail, listDwmAlerts, listDwmWatchlists, listDwmWebhookDeliveries, rebuildDwmAlerts, replayDwmAlert, storedWatchlistTerms, testDwmWebhook, updateDwmAlert } from "./dwmWorkflowRoutes.ts";
import { buildDwmProductSnapshot, normalizeWatchlist } from "../product/dwmProduct.ts";
import { buildDwmOperationsSnapshot } from "../product/dwmOperations.ts";
import { buildDwmSeedCatalog, buildDwmSourceInventory } from "../product/dwmSourceInventory.ts";
import { nowIso } from "../utils.ts";
import { canaryActivation, canaryOperator, canaryReadiness, canaryRun } from "./canaryRoutes.ts";
import { contractIndex } from "./contractsRoute.ts";
import { error, json, numberQuery, page, readJson } from "./http.ts";
import { createOrganization, createOrganizationInvites, createWebhookDestination, listOrganizationMembers, listOrganizations, listWebhookDestinations, resolveOrganizationScope, testOrganizationWebhook } from "./organizationRoutes.ts";
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
    if (url.pathname === "/v1/organizations" && request.method === "GET") return listOrganizations(url, options);
    if (url.pathname === "/v1/organizations" && request.method === "POST") return createOrganization(request, options);
    if (/^\/v1\/organizations\/[^/]+\/members$/.test(url.pathname) && request.method === "GET") return listOrganizationMembers(url, options, url.pathname.split("/")[3]);
    if (/^\/v1\/organizations\/[^/]+\/invites$/.test(url.pathname) && request.method === "POST") return createOrganizationInvites(request, options, url.pathname.split("/")[3]);
    if (/^\/v1\/organizations\/[^/]+\/webhooks$/.test(url.pathname) && request.method === "GET") return listWebhookDestinations(url, options, url.pathname.split("/")[3]);
    if (/^\/v1\/organizations\/[^/]+\/webhooks$/.test(url.pathname) && request.method === "POST") return createWebhookDestination(request, options, url.pathname.split("/")[3]);
    if (/^\/v1\/organizations\/[^/]+\/webhooks\/test$/.test(url.pathname) && request.method === "POST") return testOrganizationWebhook(request, options, url.pathname.split("/")[3]);
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
    if ((url.pathname === "/v1/dwm/product" || url.pathname === "/api/dwm/product") && request.method === "GET") {
      const scope = resolveOrganizationScope({ url, request }, options);
      if (scope.error) return scope.error;
      const tenantId = scope.tenantId;
      const explicitWatchlist = parseWatchlistParam(url.searchParams.get("watchlist") ?? url.searchParams.get("terms") ?? url.searchParams.get("q") ?? "");
      return json(buildDwmProductSnapshot({
        tenantId,
        watchlist: explicitWatchlist.length ? explicitWatchlist : storedWatchlistTerms(options, tenantId),
        sources: options.store.listSources(),
        captures: options.store.listCaptures(),
        includeDemoIfEmpty: url.searchParams.get("demo") !== "false"
      }));
    }
    if ((url.pathname === "/v1/dwm/product" || url.pathname === "/api/dwm/product") && request.method === "POST") {
      const body = await readJson(request);
      return json(buildDwmProductSnapshot({
        tenantId: body.tenantId,
        watchlist: Array.isArray(body.watchlist) ? body.watchlist : parseWatchlistParam(String(body.watchlist ?? body.terms ?? "")),
        sources: options.store.listSources(),
        captures: options.store.listCaptures(),
        includeDemoIfEmpty: body.includeDemoIfEmpty !== false
      }));
    }
    if ((url.pathname === "/v1/dwm/operations" || url.pathname === "/api/dwm/operations") && request.method === "GET") {
      const scope = resolveOrganizationScope({ url, request }, options);
      if (scope.error) return scope.error;
      const tenantId = scope.tenantId;
      const explicitWatchlist = parseWatchlistParam(url.searchParams.get("watchlist") ?? url.searchParams.get("terms") ?? url.searchParams.get("q") ?? "");
      return json(buildDwmOperationsSnapshot({
        tenantId,
        watchlist: explicitWatchlist.length ? explicitWatchlist : storedWatchlistTerms(options, tenantId),
        sources: options.store.listSources(),
        captures: options.store.listCaptures(),
        runs: options.store.listRuns()
      }));
    }
    if (url.pathname === "/v1/dwm/source-requests" && request.method === "POST") return createDwmSourceRequest(request, options);
    if ((url.pathname === "/v1/dwm/source-inventory" || url.pathname === "/api/dwm/source-inventory") && request.method === "GET") {
      const scope = resolveOrganizationScope({ url, request }, options);
      if (scope.error) return scope.error;
      return json(buildDwmSourceInventory({
      tenantId: scope.tenantId,
      watchlist: parseWatchlistParam(url.searchParams.get("watchlist") ?? url.searchParams.get("terms") ?? ""),
      sources: options.store.listSources(),
      captures: options.store.listCaptures(),
      includeCandidates: url.searchParams.get("full") === "true"
    }));
    }
    if ((url.pathname === "/v1/dwm/source-packs" || url.pathname === "/api/dwm/source-packs") && request.method === "GET") {
      const catalog = buildDwmSeedCatalog({ watchlist: parseWatchlistParam(url.searchParams.get("watchlist") ?? url.searchParams.get("terms") ?? "") });
      return json({
        schemaVersion: "dwm.source_packs.v1",
        generatedAt: nowIso(),
        packs: catalog.packs,
        counts: {
          packCount: catalog.packs.length,
          candidateCount: catalog.candidates.length,
          telegramPublic: catalog.candidates.filter((candidate) => candidate.family === "telegram_public").length,
          darkwebMetadata: catalog.candidates.filter((candidate) => candidate.family === "darkweb_metadata").length
        }
      });
    }
    if (url.pathname === "/v1/dwm/watchlists" && request.method === "GET") return listDwmWatchlists(url, options);
    if (url.pathname === "/v1/dwm/watchlists" && request.method === "POST") return createDwmWatchlist(request, options);
    if (url.pathname === "/v1/dwm/alerts" && request.method === "GET") return listDwmAlerts(url, options);
    if (/^\/v1\/dwm\/alerts\/[^/]+\/replay$/.test(url.pathname) && request.method === "POST") return replayDwmAlert(request, options, url.pathname.split("/")[4]);
    if (/^\/v1\/dwm\/alerts\/[^/]+$/.test(url.pathname) && request.method === "GET") return getDwmAlertDetail(url, options, url.pathname.split("/").pop());
    if (/^\/v1\/dwm\/alerts\/[^/]+$/.test(url.pathname) && request.method === "PATCH") return updateDwmAlert(request, options, url.pathname.split("/").pop());
    if (url.pathname === "/v1/dwm/alerts/rebuild" && request.method === "POST") return rebuildDwmAlerts(request, options);
    if (url.pathname === "/v1/dwm/webhooks/deliver" && request.method === "POST") return deliverDwmWebhooks(request, options);
    if (url.pathname === "/v1/dwm/webhooks/test" && request.method === "POST") return testDwmWebhook(request, options);
    if (url.pathname === "/v1/dwm/webhooks/deliveries" && request.method === "GET") return listDwmWebhookDeliveries(url, options);
    if (url.pathname === "/v1/dwm/watchlist/normalize") return json({ watchlist: normalizeWatchlist(parseWatchlistParam(url.searchParams.get("terms") ?? "")) });
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

function parseWatchlistParam(value: string): string[] {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}
