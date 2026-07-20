import { buildDarkwebIndexStatus, searchDarkwebIndex } from "../adapters/darkwebIndex.ts";
import { getOrganizationEntitlementReadiness, getOrganizationEntitlements, upsertOrganizationEntitlements } from "./dwmEntitlementRoutes.ts";
import { buildDwmSourcePackWorkerReadinessSnapshot, createDwmSourceRequest } from "./dwmSourceRequestRoute.ts";
import { authorizeDwmWorkflowAccess, createDwmWatchlist, deliverDwmWebhooks, disableDwmWatchlist, getDwmAlertDetail, getDwmAlertGenerationReadiness, getDwmWatchlistDetail, listDwmAlerts, listDwmWatchlists, listDwmWebhookDeliveries, rebuildDwmAlerts, replayDwmAlert, storedWatchlistTerms, testDwmWebhook, updateDwmAlert, updateDwmWatchlist } from "./dwmWorkflowRoutes.ts";
import { buildDwmProductSnapshot, normalizeWatchlist } from "../product/dwmProduct.ts";
import { buildDwmOperationsSnapshot } from "../product/dwmOperations.ts";
import { buildDwmSeedCatalog, buildDwmSourceInventory } from "../product/dwmSourceInventory.ts";
import { nowIso } from "../utils.ts";
import { cancelActorOrgRelevanceReviewPreparedHandoff, createActorOrgRelevanceReviewAlertGenerationRequest, createActorOrgRelevanceReviewCaseHandoffRequest, createActorOrgRelevanceReviewCustomerNotification, createActorOrgRelevanceReviewSourceCollectionRequest, createActorOrgRelevanceReviewWebhookTriggerRequest, getActorOrgRelevanceReview, listActorOrgRelevanceHandoffQueue, listActorOrgRelevanceReviews, listActorOrgRelevanceSourceCollectionQueue, materializeActorOrgRelevanceReviewWatchlist, submitActorOrgRelevanceReview, updateActorOrgRelevanceReview, updateActorOrgRelevanceReviewEvidence } from "./actorOrgRelevanceRoutes.ts";
import { canaryActivation, canaryConsole, canaryOperator, canaryPause, canaryReadiness, canaryRun, canarySoak } from "./canaryRoutes.ts";
import { createCase, createCaseFromDwmAlert, exportCaseActionReplay, exportCaseEvidence, getCaseDetail, getCaseWebhookReplayReadiness, listCaseHandoffActions, listCaseWorkflowTransitions, listCases, recordCaseCustomerNotification, recordCaseHandoffAction, updateCase } from "./caseRoutes.ts";
import { collectionSchedulerStatus, updateCollectionSchedulerControl } from "./collectionSchedulerStatus.ts";
import { contractIndex } from "./contractsRoute.ts";
import { enrichExposureQueueCountries, exposureParserHealth, ingestExposureClaims, listExposureQueue } from "./exposureQueueRoutes.ts";
import { error, json, numberQuery, readJson } from "./http.ts";
import { handleEvidenceRequest } from "./evidenceRoutes.ts";
import { handleOrgAlertCaseActionLedgerRequest } from "./orgAlertCaseActionLedgerRoutes.ts";
import { createOrganization, createOrganizationInvites, createWebhookDestination, disableWebhookDestination, listOrganizationMembers, listOrganizations, listWebhookDestinations, resolveOrganizationScope, testOrganizationWebhook, updateWebhookDestination } from "./organizationRoutes.ts";
import { publicChannelApplyPlan, publicChannelStatus } from "./publicChannelDispatch.ts";
import { qualityPayload } from "./qualityRoute.ts";
import { buildRestrictedMetadataApplyPlanRouteResponse, buildRestrictedMetadataStatusRouteResponse } from "./restrictedMetadataRoutes.ts";
import { createRun, exportRunStix, runResults, runStatus } from "./runRoutes.ts";
import { searchResponse } from "./searchRoute.ts";
import type { ApiServerHandle, ApiServerOptions } from "./serverTypes.ts";
import { metrics, productSlo } from "./sloRoute.ts";
import { createSource, listSources, sourceApplyPlan, sourceAtlas, updateSource } from "./sourceRoutes.ts";
import { handleStructuredIntelRequest } from "./structuredIntelRoutes.ts";
import { handleFrontierApplyPlanRoute } from "./frontierApplyPlanRoute.ts";
import { resolveTenantScope } from "./tenantScope.ts";
import { InMemoryOrgAlertCaseActionLedgerRepository } from "../storage/orgAlertCaseActionLedgerPostgres.ts";
import { buildSchedulerDiagnostics, SCHEDULER_CUTOVER_DESIGN } from "../frontier/schedulerProduction.ts";
import { buildResourceSnapshot, estimateCapacity, sizeWorkerPools } from "../ops/resourceControls.ts";
import { DEFAULT_RESOURCE_BUDGET } from "../ops/config.ts";
export type { ApiServerHandle, ApiServerOptions } from "./serverTypes.ts";
export function startApiServer(options: ApiServerOptions): ApiServerHandle {
  const serve = (port: number) => Bun.serve({ port, hostname: options.port === 0 ? "127.0.0.1" : undefined, fetch: (request) => handleDurableApiRequest(request, options) });
  let server: ReturnType<typeof Bun.serve> | undefined;
  for (let attempt = 0; attempt < (options.port === 0 ? 20 : 1); attempt++) {
    try { server = serve(options.port === 0 ? 18_100 + attempt : options.port ?? 8097); break; }
    catch (error) { if ((error as { code?: string }).code !== "EADDRINUSE") throw error; }
  }
  if (!server) throw new Error("Failed to allocate a loopback test server port");
  return { server, port: server.port ?? options.port ?? 8097, stop: () => server.stop(true) };
}
async function handleDurableApiRequest(request: Request, options: ApiServerOptions): Promise<Response> {
  const response = await handleApiRequest(request, options);
  try {
    await (options.store as any).flush?.();
    return response;
  } catch (caught) {
    return error("storage_unavailable", caught instanceof Error ? caught.message : String(caught), 503);
  }
}
export async function handleApiRequest(request: Request, options: ApiServerOptions): Promise<Response> {
  const url = new URL(request.url);
  try {
    const orgAlertCaseActionLedgerResponse = await handleOrgAlertCaseActionLedgerRequest(request, {
      repository: orgAlertCaseActionLedgerRepository(options)
    });
    if (orgAlertCaseActionLedgerResponse) return orgAlertCaseActionLedgerResponse;

    if (url.pathname === "/v1/health") {
      const storage = await (options.store as any).databaseHealth?.() ?? { ok: true, backend: "memory" };
      return json({ ok: storage.ok !== false, service: "ti-scraper", version: "v1", storage, collection: { public: (options.canaryLoop as any)?.getState?.(), restrictedMetadata: (options.restrictedMetadataLoop as any)?.getState?.() }, generatedAt: nowIso() }, storage.ok === false ? 503 : 200);
    }
    if (url.pathname === "/v1/auth/integration-notes" && request.method === "GET") {
      return json({
        version: "v1",
        authBoundary: {
          schemaVersion: "ti.enterprise_auth_boundary.v2",
          mode: "hanasand_session_validation",
          enforcedHere: true,
          identityContract: { header: "id", bearerHeader: "authorization", requiredForProtectedMutations: true },
          tenantContract: { header: "x-tenant-id", requiredForTenantScopedRoutes: true },
          organizationContract: { header: "x-organization-id", requiredForOrganizationScopedRoutes: true },
          validation: { authority: "hanasand_auth_api", cache: "no-store", failClosed: true },
          secretHandling: { scraperDoesNotStoreSecrets: true, bearerTokensAcceptedForValidation: true }
        },
        notes: ["Protected mutations validate the Hanasand session before applying tenant-scoped changes."]
      });
    }
    if (url.pathname === "/v1/contracts") return json(contractIndex());
    if (url.pathname === "/v1/metrics") return json(metrics(options));
    if (url.pathname === "/v1/ops/collection-scheduler" && request.method === "GET") return collectionSchedulerStatus(options);
    if (url.pathname === "/v1/ops/collection-scheduler" && request.method === "POST") return updateCollectionSchedulerControl(request, options);
    if (url.pathname === "/v1/organizations" && request.method === "GET") return listOrganizations(url, options);
    if (url.pathname === "/v1/organizations" && request.method === "POST") return createOrganization(request, options);
    if (/^\/v1\/organizations\/[^/]+\/members$/.test(url.pathname) && request.method === "GET") return listOrganizationMembers(url, options, url.pathname.split("/")[3]);
    if (/^\/v1\/organizations\/[^/]+\/invites$/.test(url.pathname) && request.method === "POST") return createOrganizationInvites(request, options, url.pathname.split("/")[3]);
    if (/^\/v1\/organizations\/[^/]+\/entitlements\/readiness$/.test(url.pathname) && (request.method === "GET" || request.method === "POST")) return getOrganizationEntitlementReadiness(request, options, url.pathname.split("/")[3]);
    if (/^\/v1\/organizations\/[^/]+\/entitlements$/.test(url.pathname) && request.method === "GET") return getOrganizationEntitlements(url, options, url.pathname.split("/")[3], request);
    if (/^\/v1\/organizations\/[^/]+\/entitlements$/.test(url.pathname) && request.method === "PUT") return upsertOrganizationEntitlements(request, options, url.pathname.split("/")[3]);
    if (/^\/v1\/organizations\/[^/]+\/webhooks$/.test(url.pathname) && request.method === "GET") return listWebhookDestinations(url, options, url.pathname.split("/")[3]);
    if (/^\/v1\/organizations\/[^/]+\/webhooks$/.test(url.pathname) && request.method === "POST") return createWebhookDestination(request, options, url.pathname.split("/")[3]);
    if (/^\/v1\/organizations\/[^/]+\/webhooks\/test$/.test(url.pathname) && request.method === "POST") return testOrganizationWebhook(request, options, url.pathname.split("/")[3]);
    if (/^\/v1\/organizations\/[^/]+\/webhooks\/[^/]+$/.test(url.pathname) && request.method === "PATCH") return updateWebhookDestination(request, options, url.pathname.split("/")[3], url.pathname.split("/")[5]);
    if (/^\/v1\/organizations\/[^/]+\/webhooks\/[^/]+$/.test(url.pathname) && request.method === "DELETE") return disableWebhookDestination(request, options, url.pathname.split("/")[3], url.pathname.split("/")[5]);
    if (url.pathname === "/v1/cases" && request.method === "GET") return listCases(url, options, request);
    if (url.pathname === "/v1/cases" && request.method === "POST") return createCase(request, options);
    if (/^\/v1\/cases\/[^/]+\/action-replay-export$/.test(url.pathname) && request.method === "GET") return exportCaseActionReplay(url, options, url.pathname.split("/")[3], request);
    if (/^\/v1\/cases\/[^/]+\/export$/.test(url.pathname) && request.method === "GET") return exportCaseEvidence(url, options, url.pathname.split("/")[3], request);
    if (/^\/v1\/cases\/[^/]+\/customer-notification$/.test(url.pathname) && request.method === "POST") return recordCaseCustomerNotification(request, options, url.pathname.split("/")[3]);
    if (/^\/v1\/cases\/[^/]+\/handoff-actions$/.test(url.pathname) && request.method === "GET") return listCaseHandoffActions(url, options, url.pathname.split("/")[3], request);
    if (/^\/v1\/cases\/[^/]+\/workflow-transitions$/.test(url.pathname) && request.method === "GET") return listCaseWorkflowTransitions(url, options, url.pathname.split("/")[3], request);
    if (/^\/v1\/cases\/[^/]+\/webhook-replay-readiness$/.test(url.pathname) && request.method === "GET") return getCaseWebhookReplayReadiness(url, options, url.pathname.split("/")[3], request);
    if (/^\/v1\/cases\/[^/]+\/handoff-action$/.test(url.pathname) && request.method === "POST") return recordCaseHandoffAction(request, options, url.pathname.split("/")[3]);
    if (/^\/v1\/cases\/[^/]+$/.test(url.pathname) && request.method === "GET") return getCaseDetail(url, options, url.pathname.split("/")[3], request);
    if (/^\/v1\/cases\/[^/]+$/.test(url.pathname) && request.method === "PATCH") return updateCase(request, options, url.pathname.split("/")[3]);
    if (url.pathname === "/v1/sources" && request.method === "GET") return listSources(request, options);
    if (url.pathname === "/v1/sources" && request.method === "POST") return createSource(request, options);
    if (url.pathname.startsWith("/v1/sources/") && request.method === "PATCH") return updateSource(request, options, url.pathname.split("/")[3]);
    if (url.pathname === "/v1/sources/atlas" && request.method === "GET") return sourceAtlas(request, options);
    if (url.pathname === "/v1/sources/apply-plan") return sourceApplyPlan(request, options);
    if (url.pathname === "/v1/sources/coverage-plan") return json({ queries: (await readJson(request)).queries ?? [], slo: { goal: "add payworthy fresh rows" } });
    if (url.pathname === "/v1/intel/search" || url.pathname === "/api/ti/search") return searchResponse(request, options, url);
    const evidenceResponse = await handleEvidenceRequest(request, options);
    if (evidenceResponse) return evidenceResponse;
    const structuredIntelResponse = await handleStructuredIntelRequest(request, options);
    if (structuredIntelResponse) return structuredIntelResponse;
    if (url.pathname === "/v1/ti/actor-org-relevance" && request.method === "GET") return listActorOrgRelevanceReviews(url, options, request);
    if (url.pathname === "/v1/ti/actor-org-relevance" && request.method === "POST") return submitActorOrgRelevanceReview(request, options);
    if (url.pathname === "/v1/ti/actor-org-relevance/handoff-queue" && request.method === "GET") return listActorOrgRelevanceHandoffQueue(url, options, request);
    if (url.pathname === "/v1/ti/actor-org-relevance/source-collection-queue" && request.method === "GET") return listActorOrgRelevanceSourceCollectionQueue(url, options, request);
    if (/^\/v1\/ti\/actor-org-relevance\/[^/]+\/watchlist$/.test(url.pathname) && request.method === "POST") return materializeActorOrgRelevanceReviewWatchlist(request, options, url.pathname.split("/")[4]);
    if (/^\/v1\/ti\/actor-org-relevance\/[^/]+\/alert-generation-request$/.test(url.pathname) && request.method === "POST") return createActorOrgRelevanceReviewAlertGenerationRequest(request, options, url.pathname.split("/")[4]);
    if (/^\/v1\/ti\/actor-org-relevance\/[^/]+\/case-handoff-request$/.test(url.pathname) && request.method === "POST") return createActorOrgRelevanceReviewCaseHandoffRequest(request, options, url.pathname.split("/")[4]);
    if (/^\/v1\/ti\/actor-org-relevance\/[^/]+\/webhook-trigger-request$/.test(url.pathname) && request.method === "POST") return createActorOrgRelevanceReviewWebhookTriggerRequest(request, options, url.pathname.split("/")[4]);
    if (/^\/v1\/ti\/actor-org-relevance\/[^/]+\/customer-notification$/.test(url.pathname) && request.method === "POST") return createActorOrgRelevanceReviewCustomerNotification(request, options, url.pathname.split("/")[4]);
    if (/^\/v1\/ti\/actor-org-relevance\/[^/]+\/cancel-prepared-handoff$/.test(url.pathname) && request.method === "POST") return cancelActorOrgRelevanceReviewPreparedHandoff(request, options, url.pathname.split("/")[4]);
    if (/^\/v1\/ti\/actor-org-relevance\/[^/]+\/evidence-review$/.test(url.pathname) && request.method === "POST") return updateActorOrgRelevanceReviewEvidence(request, options, url.pathname.split("/")[4]);
    if (/^\/v1\/ti\/actor-org-relevance\/[^/]+\/source-collection-request$/.test(url.pathname) && request.method === "POST") return createActorOrgRelevanceReviewSourceCollectionRequest(request, options, url.pathname.split("/")[4]);
    if (/^\/v1\/ti\/actor-org-relevance\/[^/]+$/.test(url.pathname) && request.method === "GET") return getActorOrgRelevanceReview(url, options, url.pathname.split("/").pop(), request);
    if (/^\/v1\/ti\/actor-org-relevance\/[^/]+$/.test(url.pathname) && request.method === "PATCH") return updateActorOrgRelevanceReview(request, options, url.pathname.split("/").pop());
    if (url.pathname === "/v1/intel/runs" && request.method === "POST") return createRun(request, options);
    if (/^\/v1\/intel\/runs\/[^/]+$/.test(url.pathname) && request.method === "GET") return runStatus(request, options, url.pathname.split("/").pop() ?? "");
    if (/^\/v1\/intel\/runs\/[^/]+\/results$/.test(url.pathname) && request.method === "GET") return runResults(request, options, url.pathname.split("/")[4]);
    if (url.pathname === "/v1/exports/stix" && request.method === "POST") return exportRunStix(request, options);
    if (url.pathname === "/v1/darkweb/status") return json({ status: buildDarkwebIndexStatus({ sources: options.store.listSources(), captures: options.store.listCaptures() } as any) });
    if (url.pathname === "/v1/darkweb/search") return json(searchDarkwebIndex({ query: url.searchParams.get("q") ?? "", sources: options.store.listSources(), captures: options.store.listCaptures(), limit: numberQuery(url.searchParams.get("limit")) ?? 50 } as any));
    if ((url.pathname === "/v1/dwm/exposure-queue" || url.pathname === "/api/dwm/exposure-queue") && request.method === "GET") return listExposureQueue(request, url, options);
    if ((url.pathname === "/v1/dwm/exposure-queue/enrich-countries" || url.pathname === "/api/dwm/exposure-queue/enrich-countries") && request.method === "POST") return enrichExposureQueueCountries(request, options);
    if ((url.pathname === "/v1/dwm/exposure-claims/ingest" || url.pathname === "/api/dwm/exposure-claims/ingest") && request.method === "POST") return ingestExposureClaims(request, options);
    if ((url.pathname === "/v1/dwm/exposure-parser/health" || url.pathname === "/api/dwm/exposure-parser/health") && request.method === "GET") return exposureParserHealth();
    if ((url.pathname === "/v1/dwm/product" || url.pathname === "/api/dwm/product") && request.method === "GET") {
      const scope = resolveOrganizationScope({ url, request }, options);
      if (scope.error) return scope.error;
      const access = authorizeDwmWorkflowAccess({ options, scope, request, url, mode: "read" });
      if (access.error) return access.error;
      const tenantId = scope.tenantId;
      const explicitWatchlist = parseWatchlistParam(url.searchParams.get("watchlist") ?? url.searchParams.get("terms") ?? url.searchParams.get("q") ?? "");
      return json(withPersistedDwmProductAlerts(buildDwmProductSnapshot({
        tenantId,
        watchlist: explicitWatchlist.length ? explicitWatchlist : storedWatchlistTerms(options, tenantId),
        sources: options.store.listSources(),
        captures: options.store.listCaptures()
      }), options, tenantId, scope.organizationId));
    }
    if ((url.pathname === "/v1/dwm/product" || url.pathname === "/api/dwm/product") && request.method === "POST") {
      const body = await readJson(request);
      const scope = resolveOrganizationScope({ body, url, request }, options);
      if (scope.error) return scope.error;
      const access = authorizeDwmWorkflowAccess({ options, scope, request, url, body, mode: "read" });
      if (access.error) return access.error;
      const tenantId = scope.tenantId;
      return json(withPersistedDwmProductAlerts(buildDwmProductSnapshot({
        tenantId,
        watchlist: Array.isArray(body.watchlist) ? body.watchlist : parseWatchlistParam(String(body.watchlist ?? body.terms ?? "")),
        sources: options.store.listSources(),
        captures: options.store.listCaptures()
      }), options, tenantId, scope.organizationId));
    }
    if ((url.pathname === "/v1/dwm/operations" || url.pathname === "/api/dwm/operations") && request.method === "GET") {
      const scope = resolveOrganizationScope({ url, request }, options);
      if (scope.error) return scope.error;
      const access = authorizeDwmWorkflowAccess({ options, scope, request, url, mode: "read" });
      if (access.error) return access.error;
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
      const access = authorizeDwmWorkflowAccess({ options, scope, request, url, mode: "read" });
      if (access.error) return access.error;
      const generatedAt = url.searchParams.get("generatedAt") ?? nowIso();
      return json({
        ...buildDwmSourceInventory({
          tenantId: scope.tenantId,
          watchlist: parseWatchlistParam(url.searchParams.get("watchlist") ?? url.searchParams.get("terms") ?? ""),
          sources: options.store.listSources(),
          captures: options.store.listCaptures(),
          includeCandidates: url.searchParams.get("full") === "true",
          generatedAt
        }),
        sourcePackWorker: buildDwmSourcePackWorkerReadinessSnapshot(options, {
          generatedAt,
          tenantId: scope.tenantId,
          scope: parseWatchlistParam(url.searchParams.get("watchlist") ?? url.searchParams.get("terms") ?? "").join(",")
        })
      });
    }
    if ((url.pathname === "/v1/dwm/source-packs" || url.pathname === "/api/dwm/source-packs") && request.method === "GET") {
      const generatedAt = url.searchParams.get("generatedAt") ?? nowIso();
      const catalog = buildDwmSeedCatalog({ watchlist: parseWatchlistParam(url.searchParams.get("watchlist") ?? url.searchParams.get("terms") ?? ""), generatedAt });
      const sourcePackWorker = buildDwmSourcePackWorkerReadinessSnapshot(options, { generatedAt });
      return json({
        schemaVersion: "dwm.source_packs.v1",
        generatedAt,
        packs: catalog.packs,
        counts: {
          packCount: catalog.packs.length,
          candidateCount: catalog.candidates.length,
          telegramPublic: catalog.candidates.filter((candidate) => candidate.family === "telegram_public").length,
          darkwebMetadata: catalog.candidates.filter((candidate) => candidate.family === "darkweb_metadata").length,
          publicAdvisory: catalog.candidates.filter((candidate) => candidate.family === "public_advisory").length
        },
        workerReadiness: sourcePackWorker.workerReadiness,
        sourceHealth: sourcePackWorker.sourceHealth,
        sourceOperationsReadiness: sourcePackWorker.sourceOperationsReadiness,
        sourceCustomerConfig: sourcePackWorker.sourceCustomerConfig,
        sourceReadinessArtifact: sourcePackWorker.sourceReadinessArtifact,
        lastRun: sourcePackWorker.lastRun,
        sourceGrowthCounters: sourcePackWorker.counters,
        parserSourceFamilyCounts: sourcePackWorker.parserSourceFamilyCounts,
        sourceFamilyCounts: sourcePackWorker.sourceFamilyCounts,
        proxyVerification: sourcePackWorker.proxyVerification,
        readiness: sourcePackWorker.readiness,
        redactedSourcePackIds: sourcePackWorker.redactedSourcePackIds,
        rejectedCandidates: sourcePackWorker.rejectedCandidates,
        safeOutput: sourcePackWorker.safeOutput
      });
    }
    if (url.pathname === "/v1/dwm/watchlists" && request.method === "GET") return listDwmWatchlists(url, options, request);
    if (url.pathname === "/v1/dwm/watchlists" && request.method === "POST") return createDwmWatchlist(request, options);
    if (/^\/v1\/dwm\/watchlists\/[^/]+\/disable$/.test(url.pathname) && request.method === "POST") return disableDwmWatchlist(request, options, url.pathname.split("/")[4]);
    if (/^\/v1\/dwm\/watchlists\/[^/]+$/.test(url.pathname) && request.method === "GET") return getDwmWatchlistDetail(url, options, url.pathname.split("/").pop(), request);
    if (/^\/v1\/dwm\/watchlists\/[^/]+$/.test(url.pathname) && request.method === "PATCH") return updateDwmWatchlist(request, options, url.pathname.split("/").pop());
    if (url.pathname === "/v1/dwm/alerts" && request.method === "GET") return listDwmAlerts(url, options, request);
    if (url.pathname === "/v1/dwm/alerts/generation-readiness" && request.method === "GET") return getDwmAlertGenerationReadiness(url, options, request);
    if (/^\/v1\/dwm\/alerts\/[^/]+\/case-handoff$/.test(url.pathname) && request.method === "POST") return createCaseFromDwmAlert(request, options, url.pathname.split("/")[4]);
    if (/^\/v1\/dwm\/alerts\/[^/]+\/replay$/.test(url.pathname) && request.method === "POST") return replayDwmAlert(request, options, url.pathname.split("/")[4]);
    if (/^\/v1\/dwm\/alerts\/[^/]+$/.test(url.pathname) && request.method === "GET") return getDwmAlertDetail(url, options, url.pathname.split("/").pop(), request);
    if (/^\/v1\/dwm\/alerts\/[^/]+$/.test(url.pathname) && request.method === "PATCH") return updateDwmAlert(request, options, url.pathname.split("/").pop());
    if (url.pathname === "/v1/dwm/alerts/rebuild" && request.method === "POST") return rebuildDwmAlerts(request, options);
    if (url.pathname === "/v1/dwm/webhooks/deliver" && request.method === "POST") return deliverDwmWebhooks(request, options);
    if (url.pathname === "/v1/dwm/webhooks/test" && request.method === "POST") return testDwmWebhook(request, options);
    if (url.pathname === "/v1/dwm/webhooks/deliveries" && request.method === "GET") return listDwmWebhookDeliveries(url, options, request);
    if (url.pathname === "/v1/dwm/watchlist/normalize") return json({ watchlist: normalizeWatchlist(parseWatchlistParam(url.searchParams.get("terms") ?? "")) });
    if (url.pathname === "/v1/restricted-metadata/status" && request.method === "GET") {
      const result = buildRestrictedMetadataStatusRouteResponse({
        sourceIds: url.searchParams.getAll("sourceId"),
        operatorId: url.searchParams.get("operatorId") ?? undefined,
        runId: url.searchParams.get("runId") ?? undefined
      }, { store: options.store, generatedAt: url.searchParams.get("generatedAt") ?? undefined });
      return json(result.body);
    }
    const restrictedSourceMatch = url.pathname.match(/^\/v1\/sources\/([^/]+)\/restricted-metadata\/apply-plan$/);
    if ((url.pathname === "/v1/restricted-metadata/apply-plan" || restrictedSourceMatch) && request.method === "POST") {
      const body = await readJson(request);
      const result = buildRestrictedMetadataApplyPlanRouteResponse({
        ...body,
        sourceIds: restrictedSourceMatch ? [decodeURIComponent(restrictedSourceMatch[1])] : body.sourceIds
      }, { store: options.store, generatedAt: body.generatedAt });
      return result.ok
        ? json(result.body)
        : json({ error: { code: result.code, message: result.message, details: result.details } }, result.status);
    }
    if (url.pathname === "/v1/public-channels/apply-plan") return publicChannelApplyPlan(request, options);
    if (url.pathname === "/v1/public-channels/status") return publicChannelStatus(url, options);
    if (url.pathname === "/v1/quality/evaluate") {
      const scope = resolveTenantScope(request, url);
      return scope.error ?? json(qualityPayload(url.searchParams.get("q") ?? "", options.store, scope.tenantId));
    }
    if (url.pathname === "/v1/ops/product-slo") return json({ route: "/v1/ops/product-slo", ...productSlo(options, url) });
    if (url.pathname === "/v1/sources/canary-activation" && request.method === "POST") return canaryActivation(request, options);
    if (url.pathname === "/v1/sources/canary-pause" && request.method === "POST") return canaryPause(request, options);
    if (url.pathname === "/v1/ops/canary/run" && request.method === "POST") return canaryRun(request, options);
    if (url.pathname === "/v1/ops/canary" && request.method === "GET") return canaryOperator(options);
    if (url.pathname === "/v1/ops/canary/readiness" && request.method === "GET") return canaryReadiness(url, options);
    if (url.pathname === "/v1/ops/canary/soak" && request.method === "GET") return canarySoak(url, options);
    if (url.pathname === "/v1/ops/canary/console" && request.method === "GET") return canaryConsole(url, options);
    if (url.pathname === "/v1/ops/resource-snapshot") {
      const budget = DEFAULT_RESOURCE_BUDGET;
      return json({ service: "ti-scraper", queue: { queued: options.frontier.size() }, resources: buildResourceSnapshot({ budget, queueItems: options.frontier.size() }), capacity: estimateCapacity(budget), workerPools: sizeWorkerPools(budget), workers: options.supervisor?.snapshot() ?? [] });
    }
    if (url.pathname === "/v1/frontier") {
      const queue = options.frontier.snapshot?.() ?? [];
      return json({ queue, summary: options.frontier.groupedSnapshot(), scheduler: { cutover: SCHEDULER_CUTOVER_DESIGN, diagnostics: buildSchedulerDiagnostics({ queued: queue.map((item: any) => item.task ?? item), leased: options.frontier.leasedSnapshot?.() ?? [], deadLetters: options.frontier.deadLetterSnapshot?.() ?? [], now: new Date() }) } });
    }
    if (url.pathname === "/v1/frontier/apply-plan" && request.method === "POST") {
      const body = await readJson(request);
      const result = handleFrontierApplyPlanRoute({
        request: body,
        sources: options.store.listSources(),
        queued: options.frontier.snapshot?.() ?? [],
        leased: options.frontier.leasedSnapshot?.() ?? [],
        deadLetters: options.frontier.deadLetterSnapshot?.() ?? [],
        runs: options.store.listRuns?.() ?? [],
        generatedAt: body.generatedAt
      });
      return json(result.body, result.status);
    }
    if (url.pathname.endsWith("/apply-plan")) return json({ endpoint: url.pathname, dryRun: true, actions: [] });
    if (url.pathname.includes("/graph/")) return json({ endpoint: url.pathname, nodes: [], relationships: [] });
    return error("not_found", "Route not found", 404);
  } catch (caught) {
    return error("internal_error", caught instanceof Error ? caught.message : String(caught), 500);
  }
}

function orgAlertCaseActionLedgerRepository(options: ApiServerOptions): InMemoryOrgAlertCaseActionLedgerRepository {
  const existing = options.orgAlertCaseActionLedgerRepository;
  if (existing) return existing;
  const repository = new InMemoryOrgAlertCaseActionLedgerRepository();
  options.orgAlertCaseActionLedgerRepository = repository;
  return repository;
}

function parseWatchlistParam(value: string): string[] {
  return value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

function withPersistedDwmProductAlerts(
  snapshot: ReturnType<typeof buildDwmProductSnapshot>,
  options: ApiServerOptions,
  tenantId: string,
  organizationId?: string
): ReturnType<typeof buildDwmProductSnapshot> {
  const persistedAlerts = ((options.store as any).listDwmAlerts?.() ?? [])
    .filter((alert: any) => alert?.tenantId === tenantId)
    .filter((alert: any) => !organizationId || alert?.organizationId === organizationId);
  if (!persistedAlerts.length) return snapshot;

  const seen = new Set<string>();
  const alerts = [...persistedAlerts, ...snapshot.alerts].filter((alert: any) => {
    const key = String(alert?.id ?? alert?.dedupeKey ?? "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { ...snapshot, alerts };
}
