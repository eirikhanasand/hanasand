import type { RuntimeConfig } from "../config/runtimeConfig.ts";
import { buildRelationshipGraph } from "../export/relationships.ts";
import { exportEvidenceBackedStixBundle } from "../export/stix.ts";
import type { FocusedFrontier } from "../frontier/frontier.ts";
import {
  buildSchedulerQueueEconomics,
  buildSchedulerRuntimeExecution,
  buildSchedulerRuntimeSla,
  buildSchedulerSlaEnforcement,
  buildSchedulerWorkerQueueCutover,
  buildSchedulerWorkerSoakMigration,
  buildSchedulerProductionAdapterTelemetry,
  buildSchedulerCanaryControlPlane,
  buildSchedulerDiagnostics,
  schedulerBackpressureSummaryForTasks,
  SCHEDULER_CUTOVER_DESIGN
} from "../frontier/schedulerProduction.ts";
import {
  activatePublicCanarySources,
  buildCanaryOperatorSummary,
  pausePublicCanarySources,
  runCanaryCollectionCycle,
  type CanaryFetch
} from "../ops/canaryCollection.ts";
import { buildResourceSnapshot, estimateCapacity, sizeWorkerPools } from "../ops/resourceControls.ts";
import type { WorkerSupervisor } from "../ops/supervisor.ts";
import { buildLiveActorIntelligenceDto, buildPublicIntelAnswerDto } from "../pipeline/actorProfileFusion.ts";
import type { EvidenceStage, StagedEvidenceInput } from "../pipeline/intelligenceProfiles.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import {
  buildSearchQualityApiDto,
  evaluateSearchQualityGate,
  searchQualityApiExamples,
  type GraphReviewState,
  type SearchQualityApiDto
} from "../pipeline/searchQualityGate.ts";
import { createCollectionPlan, createLiveSearchPlan } from "../planner/intelligencePlanner.ts";
import { RssAdapter } from "../adapters/rss.ts";
import { StaticWebAdapter, type StaticWebAdapterOptions } from "../adapters/staticWeb.ts";
import { buildRestrictedMetadataOperationsStatus, planDarknetMetadataLiveSearch, restrictedMetadataAnalystOperationsContract, restrictedMetadataConnectorCertificationContract, restrictedMetadataEmergencyStopCertificationContract, restrictedMetadataIsolationHarnessContract, restrictedMetadataKillSwitchDrillContract, restrictedMetadataNonBlockingSearchContract } from "../adapters/darknetMetadata.ts";
import { buildTelegramPublicActorReadinessDto, buildTelegramPublicCanaryRollout, buildTelegramPublicCompactSearchSummary, buildTelegramPublicCutoverReport, buildTelegramPublicOperatorControlEffects, buildTelegramPublicOperatorStates, buildTelegramPublicPromotionCanaryProof, buildTelegramPublicPromotionCertification, buildTelegramPublicReliabilityReport, buildTelegramPublicSlaReport, buildTelegramPublicSourcePackCompatibility, buildTelegramPublicSourcePackReadiness, planTelegramPublicSearchBackfill, publicChannelEvidenceFromCapture, type TelegramPublicSourcePack } from "../adapters/telegramPublic.ts";
import { buildPublicSignalFusionWorkbench } from "../adapters/publicSignalFusion.ts";
import type { ObjectEvidenceStore } from "../storage/evidenceStore.ts";
import type { ScraperStore } from "../storage/memoryStore.ts";
import type { SeedSourceBundle } from "../registry/sourceSeeds.ts";
import { buildSourceActivationBatchApiResponse, buildSourceActivationReport, buildSourceCoverageCloseoutApiResponse, buildSourceCoveragePlanApiResponse, buildSourcePortfolioApiResponse, buildSourceRuntimeSlaApiResponse, importSeedBundle } from "../registry/sourceSeeds.ts";
import type {
  AnalystClaimLedgerEntry,
  AnalystLoopSnapshot,
  AnalystMetadataReviewTask,
  AnalystSourceActivationPacket,
  AnalystVictimNotificationPacket,
  CollectionPlan,
  CollectionRun,
  CollectionTask,
  IncidentCandidate,
  IntelligenceRequest,
  LiveSearchPlannerDto,
  MetricsResponse,
  PipelineResult,
  RawCapture,
  RunResultsInclude,
  RunStatus,
  SafeCaptureDto,
  SourceRecord,
  StixBundle
} from "../types.ts";
import { clampScore, hashContent, nowIso, stableId } from "../utils.ts";
import { toSafeCaptureDto } from "./captureDtos.ts";
import {
  buildEvidenceClaimLedgerDto,
  buildEvidenceCutoverReportDto,
  buildEvidenceReplayPlanDto,
  buildEvidenceTrustLedgerDto,
  evidenceClaimLedgerApiContract,
  evidenceCutoverReportApiContract,
  evidenceReplayPlanApiContract,
  evidenceTrustLedgerApiContract
} from "./evidenceDtos.ts";
import { handleFrontierApplyPlanRoute } from "./frontierApplyPlanRoute.ts";
import {
  handleGraphCutoverReportRoute,
  handleGraphReviewPlanRoute,
  handleStixExportReadinessRoute,
  type GraphReviewRouteRequestDto
} from "./graphReviewRoutes.ts";
import { buildPublicChannelApplyPlanRouteResponse, buildPublicChannelStatusRouteResponse, type PublicChannelApplyPlanRequestDto } from "./publicChannelRoutes.ts";
import { buildRestrictedMetadataApplyPlanRouteResponse, buildRestrictedMetadataStatusRouteResponse, type RestrictedMetadataApplyPlanRequestDto } from "./restrictedMetadataRoutes.ts";
import { apiError, json } from "./responses.ts";
import { handleSourceApplyPlanRoute } from "./sourceApplyPlanRoute.ts";
import {
  buildCorrelationGraphQuery,
  buildCorrelationTimeline,
  buildGraphQueryApiContract,
  buildGraphExportCertificationDto,
  buildGraphReviewQueueSummary,
  buildGraphRuntimeApiDto,
  buildPersistedGraphSnapshot
} from "../export/graphViews.ts";

export interface ApiServerOptions {
  port?: number;
  store: ScraperStore;
  frontier: FocusedFrontier;
  config?: RuntimeConfig;
  supervisor?: WorkerSupervisor;
  publicTelegramSourcePacks?: TelegramPublicSourcePack[];
  sourcePacks?: SeedSourceBundle[];
  objectStore?: ObjectEvidenceStore;
  publicClearWebFetcher?: StaticWebAdapterOptions["fetcher"];
  canaryFetch?: CanaryFetch;
  disableBundledSourcePack?: boolean;
  disableOnDemandClearWebCapture?: boolean;
}

export interface ApiServerHandle {
  port: number;
  stop(): void;
}

export function startApiServer(options: ApiServerOptions): ApiServerHandle {
  const configuredPort = options.port ?? 8097;
  const server = Bun.serve({
    port: configuredPort,
    fetch: (request) => handleApiRequest(request, options)
  });

  return {
    port: typeof server.port === "number" ? server.port : configuredPort,
    stop: () => server.stop()
  };
}

export async function handleApiRequest(request: Request, options: ApiServerOptions): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/v1/health")) {
    const resources = options.config ? resourceSnapshot(options) : undefined;
    return json({
      ok: resources ? resources.memory.status !== "critical" && resources.queue.status !== "critical" : true,
      service: "ti-scraper",
      version: options.config?.apiVersion ?? "v1",
      environment: options.config?.environment,
      resources
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/metrics") {
    return json(buildMetrics(options));
  }

  if (request.method === "GET" && url.pathname === "/v1/ops/resource-snapshot") {
    return json(buildOpsResourceSnapshot(options));
  }

  if (request.method === "GET" && url.pathname === "/v1/ops/canary") {
    return json({
      operatorView: buildCanaryOperatorSummary({
        store: options.store,
        frontier: options.frontier,
        generatedAt: url.searchParams.get("generatedAt") ?? undefined
      })
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/auth/integration-notes") {
    return json({
      notes: [
        "Authenticate at the main CTI app or gateway before forwarding traffic to the scraper.",
        "Forward x-tenant-id and x-actor-id from trusted middleware; resolve roles/scopes upstream.",
        "Use idempotency-key on POST /v1/intel/runs so client retries do not duplicate collection work.",
        "Protect source administration with source:write or scraper:admin privileges."
      ]
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/contracts") {
    return json(buildEnterpriseApiContractIndex());
  }

  if (request.method === "GET" && url.pathname === "/v1/sources") {
    const limit = Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10));
    const cursor = Math.max(0, Number.parseInt(url.searchParams.get("cursor") ?? "0", 10));
    const sources = options.store.listSources();
    const page = sources.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < sources.length ? String(cursor + limit) : undefined;
    return json({ sources: page, nextCursor });
  }

  if (request.method === "POST" && url.pathname === "/v1/sources") {
    const input = await readJson<Record<string, unknown>>(request);
    const createdAt = nowIso();
    const source: SourceRecord = {
      id: stableId("src", `${String(input.type)}:${String(input.url)}:${createdAt}`),
      name: String(input.name ?? "Unnamed source"),
      type: String(input.type ?? "rss") as SourceRecord["type"],
      url: String(input.url ?? ""),
      accessMethod: String(input.accessMethod ?? "public_http") as SourceRecord["accessMethod"],
      status: String(input.status ?? "candidate") as SourceRecord["status"],
      risk: String(input.risk ?? "low") as SourceRecord["risk"],
      trustScore: clampScore(typeof input.trustScore === "number" ? input.trustScore : 0.5),
      crawlFrequencySeconds: typeof input.crawlFrequencySeconds === "number" ? input.crawlFrequencySeconds : 3600,
      legalNotes: String(input.legalNotes ?? ""),
      createdAt,
      updatedAt: createdAt
    };
    options.store.saveSource(source);
    return json({ source }, 201);
  }

  const sourceMatch = url.pathname.match(/^\/v1\/sources\/([^/]+)$/);
  if (request.method === "PATCH" && sourceMatch) {
    const sourceId = sourceMatch[1];
    if (!sourceId) return apiError("bad_request", "Source id is required", 400);
    const existing = options.store.getSource(sourceId);
    if (!existing) return apiError("not_found", "Source not found", 404);
    const input = await readJson<Partial<SourceRecord>>(request);
    const updated: SourceRecord = {
      ...existing,
      ...input,
      trustScore: clampScore(input.trustScore ?? existing.trustScore),
      updatedAt: nowIso()
    };
    options.store.saveSource(updated);
    return json({ source: updated });
  }

  if (request.method === "GET" && url.pathname === "/v1/frontier") {
    return json({
      ...paged("queue", options.frontier.snapshot(), url),
      summary: options.frontier.groupedSnapshot(),
      scheduler: {
        cutover: SCHEDULER_CUTOVER_DESIGN,
        diagnostics: buildSchedulerDiagnostics({
          frontier: options.frontier,
          runs: options.store.listRuns(),
          plans: options.store.listPlans()
        })
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/frontier/status") {
    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? undefined;
    const runId = url.searchParams.get("runId") ?? undefined;
    return json(frontierStatusResponse({
      query,
      runId,
      tenantId: request.headers.get("x-tenant-id") ?? undefined,
      sinceCursor: url.searchParams.get("cursor") ?? undefined,
      options
    }));
  }

  if (request.method === "POST" && url.pathname === "/v1/frontier/apply-plan") {
    const input = await readJson<Record<string, unknown>>(request);
    const result = handleFrontierApplyPlanRoute({
      request: input,
      sources: options.store.listSources(),
      queued: options.frontier.snapshot().map((item) => item.task),
      leased: options.frontier.leasedSnapshot(),
      deadLetters: options.frontier.deadLetterSnapshot(),
      runs: options.store.listRuns(),
      generatedAt: nowIso()
    });
    return json(result.body, result.status);
  }

  if (request.method === "POST" && url.pathname === "/v1/sources/apply-plan") {
    const input = await readJson<Record<string, unknown>>(request);
    const result = handleSourceApplyPlanRoute({
      request: {
        ...input,
        tenantId: typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined
      },
      sources: options.store.listSources(),
      sourcePacks: options.sourcePacks ?? await defaultSourcePacks(input),
      generatedAt: nowIso()
    });
    return json(result.body, result.status);
  }

  if (request.method === "POST" && url.pathname === "/v1/sources/canary-activation") {
    const input = await readJson<Record<string, unknown>>(request);
    if (input.operatorApproval !== true) {
      return apiError("approval_required", "operatorApproval=true is required for executable canary source activation", 409, {
        mode: "human_approved_clear_web_canary_only"
      });
    }
    const activation = activatePublicCanarySources({
      store: options.store,
      tenantId: typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined,
      operatorId: typeof input.approvedBy === "string" ? input.approvedBy : request.headers.get("x-actor-id") ?? "operator",
      now: typeof input.generatedAt === "string" ? input.generatedAt : nowIso()
    });
    return json({
      activation,
      guarantees: [
        "only bundled safe public clear-web sources are activated",
        "no restricted metadata, private channels, authentication, CAPTCHA solving, or restricted payload collection is enabled",
        "activation is audited on source lifecycle and can be reversed with existing pause or retire source controls"
      ]
    });
  }

  if (request.method === "POST" && url.pathname === "/v1/sources/canary-pause") {
    const input = await readJson<Record<string, unknown>>(request);
    if (input.operatorApproval !== true) {
      return apiError("approval_required", "operatorApproval=true is required to pause canary source collection", 409, {
        mode: "human_approved_clear_web_canary_pause"
      });
    }
    const pause = pausePublicCanarySources({
      store: options.store,
      tenantId: typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined,
      operatorId: typeof input.approvedBy === "string" ? input.approvedBy : request.headers.get("x-actor-id") ?? "operator",
      now: typeof input.generatedAt === "string" ? input.generatedAt : nowIso()
    });
    return json({
      pause,
      guarantees: [
        "only bundled public canary sources are paused",
        "source approval and lifecycle history are preserved",
        "collection can resume through the explicit canary activation operation"
      ]
    });
  }

  if (request.method === "POST" && url.pathname === "/v1/sources/coverage-plan") {
    const input = await readJson<Record<string, unknown>>(request);
    const tenantId = typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined;
    const queries = Array.isArray(input.queries)
      ? input.queries.map(String).filter((query) => query.trim().length > 0)
      : typeof input.query === "string" && input.query.trim()
        ? [input.query]
        : [];
    if (queries.length === 0) return apiError("bad_request", "queries must contain at least one query", 400);
    return json(buildSourceCoveragePlanApiResponse({
      tenantId,
      queries,
      sources: options.store.listSources(),
      sourcePacks: options.sourcePacks ?? await defaultCoverageSourcePacks(input),
      generatedAt: nowIso()
    }));
  }

  if (request.method === "POST" && url.pathname === "/v1/sources/portfolio") {
    const input = await readJson<Record<string, unknown>>(request);
    const tenantId = typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined;
    const queries = Array.isArray(input.queries)
      ? input.queries.map(String).filter((query) => query.trim().length > 0)
      : typeof input.query === "string" && input.query.trim()
        ? [input.query]
        : [];
    return json(buildSourcePortfolioApiResponse({
      tenantId,
      queries,
      sources: options.store.listSources(),
      sourcePacks: options.sourcePacks ?? await defaultCoverageSourcePacks(input),
      generatedAt: nowIso()
    }));
  }

  if (request.method === "POST" && url.pathname === "/v1/sources/activation-batches") {
    const input = await readJson<Record<string, unknown>>(request);
    const tenantId = typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined;
    const queries = Array.isArray(input.queries)
      ? input.queries.map(String).filter((query) => query.trim().length > 0)
      : typeof input.query === "string" && input.query.trim()
        ? [input.query]
        : [];
    if (queries.length === 0) return apiError("bad_request", "queries must contain at least one query", 400);
    return json(buildSourceActivationBatchApiResponse({
      tenantId,
      queries,
      sources: options.store.listSources(),
      sourcePacks: options.sourcePacks ?? await defaultCoverageSourcePacks(input),
      generatedAt: nowIso()
    }));
  }

  if (request.method === "POST" && url.pathname === "/v1/sources/runtime-sla") {
    const input = await readJson<Record<string, unknown>>(request);
    const tenantId = typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined;
    const queries = Array.isArray(input.queries)
      ? input.queries.map(String).filter((query) => query.trim().length > 0)
      : typeof input.query === "string" && input.query.trim()
        ? [input.query]
        : [];
    if (queries.length === 0) return apiError("bad_request", "queries must contain at least one query", 400);
    return json(buildSourceRuntimeSlaApiResponse({
      tenantId,
      queries,
      sources: options.store.listSources(),
      generatedAt: nowIso()
    }));
  }

  if (request.method === "POST" && url.pathname === "/v1/sources/coverage-closeout") {
    const input = await readJson<Record<string, unknown>>(request);
    const tenantId = typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined;
    const queries = Array.isArray(input.queries)
      ? input.queries.map(String).filter((query) => query.trim().length > 0)
      : typeof input.query === "string" && input.query.trim()
        ? [input.query]
        : [];
    if (queries.length === 0) return apiError("bad_request", "queries must contain at least one query", 400);
    return json(buildSourceCoverageCloseoutApiResponse({
      tenantId,
      queries,
      sources: options.store.listSources(),
      generatedAt: nowIso()
    }));
  }

  if (request.method === "GET" && url.pathname === "/v1/captures") {
    return json(paged("captures", options.store.listCaptures().map((capture) => captureDto(capture, includeCaptureBody(url))), url));
  }

  if (request.method === "POST" && url.pathname === "/v1/ops/canary/run") {
    const input = await readJson<Record<string, unknown>>(request);
    if (input.operatorApproval !== true) {
      return apiError("approval_required", "operatorApproval=true is required to run the public canary collector", 409, {
        mode: "bounded_public_http_canary"
      });
    }
    const canaryRun = await runCanaryCollectionCycle({
      store: options.store,
      frontier: options.frontier,
      objectStore: options.objectStore,
      fetch: options.canaryFetch,
      tenantId: typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined,
      operatorId: typeof input.approvedBy === "string" ? input.approvedBy : request.headers.get("x-actor-id") ?? "operator",
      maxSources: typeof input.maxSources === "number" ? input.maxSources : undefined,
      maxTasks: typeof input.maxTasks === "number" ? input.maxTasks : undefined,
      maxBytes: typeof input.maxBytes === "number" ? input.maxBytes : undefined,
      now: typeof input.generatedAt === "string" ? () => String(input.generatedAt) : undefined
    });
    return json({
      canaryRun,
      operatorView: buildCanaryOperatorSummary({
        store: options.store,
        frontier: options.frontier,
        generatedAt: canaryRun.generatedAt
      })
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/evidence/replay-plan") {
    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    if (!query.trim()) return apiError("bad_request", "query is required", 400);
    const runId = url.searchParams.get("runId") ?? undefined;
    if (runId && !options.store.getRun(runId)) return apiError("not_found", "Run not found", 404);
    return json({
      contract: evidenceReplayPlanApiContract(),
      replayPlan: buildEvidenceReplayPlanDto(options.store, query, {
        tenantId: request.headers.get("x-tenant-id") ?? undefined,
        runId,
        sinceCursor: url.searchParams.get("sinceCursor") ?? undefined
      })
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/evidence/cutover-report") {
    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    if (!query.trim()) return apiError("bad_request", "query is required", 400);
    const runId = url.searchParams.get("runId") ?? undefined;
    if (runId && !options.store.getRun(runId)) return apiError("not_found", "Run not found", 404);
    return json({
      contract: evidenceCutoverReportApiContract(),
      cutoverReport: buildEvidenceCutoverReportDto(options.store, options.objectStore ?? EMPTY_OBJECT_STORE, query, {
        tenantId: request.headers.get("x-tenant-id") ?? undefined,
        runId,
        sinceCursor: url.searchParams.get("sinceCursor") ?? undefined,
        generatedAt: url.searchParams.get("generatedAt") ?? undefined
      })
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/evidence/trust-ledger") {
    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    if (!query.trim()) return apiError("bad_request", "query is required", 400);
    const runId = url.searchParams.get("runId") ?? undefined;
    if (runId && !options.store.getRun(runId)) return apiError("not_found", "Run not found", 404);
    const minTrustedConfidence = numericParam(url.searchParams.get("minTrustedConfidence"));
    return json({
      contract: evidenceTrustLedgerApiContract(),
      trustLedger: buildEvidenceTrustLedgerDto(options.store, options.objectStore ?? EMPTY_OBJECT_STORE, query, {
        tenantId: request.headers.get("x-tenant-id") ?? undefined,
        runId,
        sinceCursor: url.searchParams.get("sinceCursor") ?? undefined,
        generatedAt: url.searchParams.get("generatedAt") ?? undefined,
        minTrustedConfidence
      })
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/evidence/claim-ledger") {
    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    if (!query.trim()) return apiError("bad_request", "query is required", 400);
    const runId = url.searchParams.get("runId") ?? undefined;
    if (runId && !options.store.getRun(runId)) return apiError("not_found", "Run not found", 404);
    return json({
      contract: evidenceClaimLedgerApiContract(),
      claimLedger: buildEvidenceClaimLedgerDto(options.store, options.objectStore ?? EMPTY_OBJECT_STORE, query, {
        tenantId: request.headers.get("x-tenant-id") ?? undefined,
        runId,
        sinceCursor: url.searchParams.get("sinceCursor") ?? undefined,
        generatedAt: url.searchParams.get("generatedAt") ?? undefined,
        minTrustedConfidence: numericParam(url.searchParams.get("minTrustedConfidence"))
      })
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/incidents") {
    return json(paged("incidents", options.store.listIncidents(), url));
  }

  if (request.method === "GET" && url.pathname === "/v1/intel/plans") {
    return json(paged("plans", options.store.listPlans(), url));
  }

  if (request.method === "GET" && url.pathname === "/v1/intel/search") {
    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    if (!query.trim()) return apiError("bad_request", "query is required", 400);
    const entityType = url.searchParams.get("entityType") ?? "free_text";
    return json(await publicIntelSearchResponse({
      query,
      entityType,
      tenantId: request.headers.get("x-tenant-id") ?? undefined,
      sinceCursor: url.searchParams.get("cursor") ?? undefined,
      options
    }));
  }

  if (request.method === "GET" && url.pathname === "/v1/quality/evaluate") {
    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    if (!query.trim()) return apiError("bad_request", "query is required", 400);
    const search = await publicIntelSearchResponse({
      query,
      entityType: "free_text",
      tenantId: request.headers.get("x-tenant-id") ?? undefined,
      options
    });
    return json({
      query,
      quality: search.quality,
      publicTiAnswer: search.publicTiAnswer,
      examples: searchQualityApiExamples()
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/graph/review-plan") {
    const run = runForGraphRoute(url, options);
    if (run instanceof Response) return run;
    const result = handleGraphReviewPlanRoute({
      snapshot: graphSnapshotForRun(run, options, url.searchParams.get("generatedAt") ?? undefined),
      request: graphReviewRouteRequest(url),
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    return graphReviewRouteResponse(result);
  }

  if (request.method === "GET" && url.pathname === "/v1/graph/query") {
    const run = runForGraphRoute(url, options);
    if (run instanceof Response) return run;
    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    if (!query.trim()) return apiError("bad_request", "query is required", 400);
    return json({
      contract: buildGraphQueryApiContract("/v1/graph/query"),
      graph: buildCorrelationGraphQuery(graphSnapshotForRun(run, options, url.searchParams.get("generatedAt") ?? undefined), {
        query,
        focusNodeId: url.searchParams.get("focusNodeId") ?? undefined,
        generatedAt: url.searchParams.get("generatedAt") ?? undefined
      })
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/graph/timeline") {
    const run = runForGraphRoute(url, options);
    if (run instanceof Response) return run;
    const query = url.searchParams.get("q") ?? url.searchParams.get("query") ?? "";
    if (!query.trim()) return apiError("bad_request", "query is required", 400);
    return json({
      contract: buildGraphQueryApiContract("/v1/graph/timeline"),
      timeline: buildCorrelationTimeline(graphSnapshotForRun(run, options, url.searchParams.get("generatedAt") ?? undefined), {
        query,
        focusNodeId: url.searchParams.get("focusNodeId") ?? undefined,
        generatedAt: url.searchParams.get("generatedAt") ?? undefined
      })
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/graph/cutover-report") {
    const run = runForGraphRoute(url, options);
    if (run instanceof Response) return run;
    const result = handleGraphCutoverReportRoute({
      snapshot: graphSnapshotForRun(run, options, url.searchParams.get("generatedAt") ?? undefined),
      request: graphReviewRouteRequest(url),
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    return graphReviewRouteResponse(result);
  }

  if (request.method === "GET" && url.pathname === "/v1/exports/stix") {
    const run = runForGraphRoute(url, options);
    if (run instanceof Response) return run;
    const result = handleStixExportReadinessRoute({
      snapshot: graphSnapshotForRun(run, options, url.searchParams.get("generatedAt") ?? undefined),
      request: graphReviewRouteRequest(url),
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    return graphReviewRouteResponse(result);
  }

  if (request.method === "POST" && url.pathname === "/v1/public-channels/apply-plan") {
    const input = await readJson<PublicChannelApplyPlanRequestDto>(request);
    const result = buildPublicChannelApplyPlanRouteResponse(input, {
      store: options.store,
      publicTelegramSourcePacks: options.publicTelegramSourcePacks
    });
    return result.ok
      ? json(result.body)
      : apiError(result.code, result.message, result.status, result.details);
  }

  if (request.method === "GET" && url.pathname === "/v1/public-channels/status") {
    const result = buildPublicChannelStatusRouteResponse({
      query: url.searchParams.get("q") ?? url.searchParams.get("query") ?? "",
      entityType: url.searchParams.get("entityType") ?? undefined,
      cursor: url.searchParams.get("cursor") ? Number.parseInt(url.searchParams.get("cursor") ?? "", 10) : undefined,
      tenantId: request.headers.get("x-tenant-id") ?? undefined
    }, {
      store: options.store,
      publicTelegramSourcePacks: options.publicTelegramSourcePacks
    });
    return result.ok
      ? json(result.body)
      : apiError(result.code, result.message, result.status);
  }

  if (request.method === "POST" && url.pathname === "/v1/restricted-metadata/apply-plan") {
    const input = await readJson<RestrictedMetadataApplyPlanRequestDto>(request);
    const result = buildRestrictedMetadataApplyPlanRouteResponse(input, {
      store: options.store
    });
    return result.ok
      ? json(result.body)
      : apiError(result.code, result.message, result.status, result.details);
  }

  if (request.method === "GET" && url.pathname === "/v1/restricted-metadata/status") {
    const sourceIds = url.searchParams.getAll("sourceId");
    const result = buildRestrictedMetadataStatusRouteResponse({
      sourceIds: sourceIds.length > 0 ? sourceIds : undefined,
      operatorId: url.searchParams.get("operatorId") ?? undefined,
      runId: url.searchParams.get("runId") ?? undefined
    }, {
      store: options.store
    });
    return json(result.body);
  }

  const restrictedMetadataSourceApplyPlanMatch = url.pathname.match(/^\/v1\/sources\/([^/]+)\/restricted-metadata\/apply-plan$/);
  if (request.method === "POST" && restrictedMetadataSourceApplyPlanMatch) {
    const sourceId = restrictedMetadataSourceApplyPlanMatch[1];
    if (!sourceId) return apiError("bad_request", "Source id is required", 400);
    const input = await readJson<RestrictedMetadataApplyPlanRequestDto>(request);
    const result = buildRestrictedMetadataApplyPlanRouteResponse({
      ...input,
      sourceIds: [sourceId]
    }, {
      store: options.store
    });
    return result.ok
      ? json(result.body)
      : apiError(result.code, result.message, result.status, result.details);
  }

  if (request.method === "POST" && url.pathname === "/v1/intel/plan") {
    const input = await readJson<IntelligenceRequest>(request);
    const plan = createCollectionPlan(input, options.store.listSources(), options.frontier);
    options.store.savePlan(plan);
    return json({ plan }, 201);
  }

  if (request.method === "POST" && url.pathname === "/v1/intel/runs") {
    const input = await readJson<IntelligenceRequest>(request);
    input.tenantId = input.tenantId ?? request.headers.get("x-tenant-id") ?? undefined;
    const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
    input.createdAt = input.createdAt ?? nowIso();
    const requestHash = hashContent(canonicalJson(normalizeRunRequest(input)));
    const existingRun = idempotencyKey ? options.store.findRunByIdempotencyKey(input.tenantId, idempotencyKey) : undefined;
    if (existingRun) {
      if (existingRun.requestHash && existingRun.requestHash !== requestHash) {
        return apiError("idempotency_conflict", "Idempotency key was already used with a different request body", 409, {
          runId: existingRun.id
        });
      }
      return json({ run: existingRun });
    }

    const live = createLiveSearchPlan({
      request: {
        ...input,
        budgetClass: input.budgetClass ?? "interactive_live_search",
        priority: input.priority ?? "urgent"
      },
      sources: options.store.listSources(),
      activeRuns: options.store.listRuns(),
      activePlans: options.store.listPlans(),
      frontier: options.frontier
    });
    if (live.dto.activeRunId) {
      const activeRun = options.store.getRun(live.dto.activeRunId);
      if (activeRun) {
        return json({
          run: activeRun,
          reused: true,
          scheduler: schedulerSummaryForPlan({
            plan: live.plan,
            run: activeRun,
            planner: live.dto,
            frontier: options.frontier,
            partialResultCount: partialResultCountForQuery(live.plan.request.query, activeRun.tenantId, options)
          })
        }, 202);
      }
    }
    const plan = live.plan;
    const run: CollectionRun = {
      id: stableId("run", `${plan.id}:${idempotencyKey ?? nowIso()}`),
      tenantId: plan.tenantId,
      planId: plan.id,
      requestId: plan.request.id,
      status: "queued",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      idempotencyKey,
      requestHash,
      taskCount: plan.tasks.length,
      reviewTaskCount: plan.reviewRequired.length,
      rejectedSourceCount: plan.rejected.length,
      captureCount: 0,
      incidentCount: 0
    };
    const runScopedPlan = withRunSchedulingMetadata(plan, run, idempotencyKey);
    options.store.savePlan(runScopedPlan);
    options.store.saveRun(run);
    for (const task of runScopedPlan.tasks) options.frontier.enqueueTask(task);
    return json({
      run,
      reused: false,
      scheduler: schedulerSummaryForPlan({
        plan: runScopedPlan,
        run,
        planner: live.dto,
        frontier: options.frontier,
        partialResultCount: partialResultCountForQuery(runScopedPlan.request.query, run.tenantId, options)
      })
    }, 202);
  }

  const runMatch = url.pathname.match(/^\/v1\/intel\/runs\/([^/]+)$/);
  if (request.method === "GET" && runMatch) {
    const runId = runMatch[1];
    if (!runId) return apiError("bad_request", "Run id is required", 400);
    const run = options.store.getRun(runId);
    if (!run) return apiError("not_found", "Run not found", 404);
    const plan = options.store.listPlans().find((candidate) => candidate.id === run.planId || candidate.request.id === run.requestId);
    return json({
      run,
      frontier: {
        queuedForRun: options.frontier.snapshot().filter((task) => task.runId === run.id || task.intelRequestId === run.requestId).length,
        leasedForRun: options.frontier.leasedSnapshot().filter((task) => task.runId === run.id || task.intelRequestId === run.requestId).length,
        summary: options.frontier.groupedSnapshot()
      },
      scheduler: plan ? schedulerSummaryForPlan({
        plan,
        run,
        frontier: options.frontier,
        options,
        sinceCursor: url.searchParams.get("cursor") ?? undefined,
        partialResultCount: partialResultCountForQuery(plan.request.query, run.tenantId, options)
      }) : undefined
    });
  }

  const resultMatch = url.pathname.match(/^\/v1\/intel\/runs\/([^/]+)\/results$/);
  if (request.method === "GET" && resultMatch) {
    const runId = resultMatch[1];
    if (!runId) return apiError("bad_request", "Run id is required", 400);
    const run = options.store.getRun(runId);
    if (!run) return apiError("not_found", "Run not found", 404);
    return json(runResultsResponse(run, options, url));
  }

  if (request.method === "POST" && url.pathname === "/v1/exports/stix") {
    const input = await readJson<{ runId?: string; producerName?: string; generatedAt?: string; tenantId?: string }>(request);
    if (!input.runId) return apiError("bad_request", "runId is required", 400);
    const run = options.store.getRun(input.runId);
    if (!run) return apiError("not_found", "Run not found", 404);
    if (input.tenantId && run.tenantId && input.tenantId !== run.tenantId) {
      return apiError("not_found", "Run not found", 404);
    }
    return json({
      bundle: stixBundleForRun(run, options, {
        producerName: input.producerName ?? "ti-scraper",
        generatedAt: input.generatedAt ?? nowIso(),
        tenantId: run.tenantId ?? input.tenantId
      })
    });
  }

  return apiError("not_found", `No route for ${request.method} ${url.pathname}`, 404);
}

function runResultsResponse(run: CollectionRun, options: ApiServerOptions, url: URL) {
  const include = requestedIncludes(url);
  const materialized = materializeRunResults(run, options);
  const results: Partial<Record<RunResultsInclude, unknown>> = {};

  if (include.has("captures")) {
    results.captures = page(materialized.captures.map((capture) => captureDto(capture, includeCaptureBody(url))), url);
  }
  if (include.has("incidents")) results.incidents = page(materialized.incidents, url);
  if (include.has("indicators")) results.indicators = page(materialized.incidents.flatMap((incident) => incident.indicators), url);
  if (include.has("entities")) results.entities = page(materialized.incidents.flatMap((incident) => incident.entities), url);
  if (include.has("relationships")) {
    results.relationships = page(materialized.pipelineResults.flatMap((result) => buildRelationshipGraph(result).relationships), url);
  }

  return { run, results };
}

let bundledStarterPack: SeedSourceBundle | undefined;

async function sourcePacksForSearch(options: ApiServerOptions): Promise<SeedSourceBundle[]> {
  if (options.sourcePacks?.length || options.disableBundledSourcePack) return options.sourcePacks ?? [];
  bundledStarterPack ??= await Bun.file(new URL("../../seeds/public_cti_starter_pack.json", import.meta.url)).json() as SeedSourceBundle;
  return [bundledStarterPack];
}

function ensureSafePublicStarterSources(options: ApiServerOptions, sourcePacks: SeedSourceBundle[], tenantId?: string): void {
  if (sourcePacks.length === 0) return;
  const existing = options.store.listSources();
  const existingIds = new Set(existing.map((source) => source.id));
  for (const pack of sourcePacks) {
    const imported = importSeedBundle(pack, { existingSources: existing, importedAt: nowIso() });
    for (const source of imported.accepted) {
      if (existingIds.has(source.id)) continue;
      if (!isSafePublicAutoSource(source)) continue;
      if (tenantId && source.tenantId && source.tenantId !== tenantId) continue;
      options.store.saveSource({
        ...source,
        tenantId: source.tenantId ?? tenantId,
        status: "active",
        approvedAt: source.approvedAt ?? nowIso(),
        approvedBy: source.approvedBy ?? "safe-public-starter-pack"
      });
      existingIds.add(source.id);
    }
  }
}

async function collectOnDemandClearWebEvidence(input: {
  query: string;
  tenantId?: string;
  options: ApiServerOptions;
}): Promise<void> {
  const sources = input.options.store.listSources()
    .filter((source) => !input.tenantId || !source.tenantId || source.tenantId === input.tenantId)
    .filter(isSafePublicAutoSource)
    .filter((source) => source.status === "active")
    .filter((source) => source.type === "rss" || source.type === "static_web");
  const ranked = buildSourceActivationReport(input.query, sources).sources
    .filter((source) => source.score > 0)
    .map((summary) => sources.find((source) => source.id === summary.sourceId))
    .filter((source): source is SourceRecord => Boolean(source))
    .slice(0, 3);

  for (const source of ranked) {
    const before = searchQualityEvidence({ query: input.query, tenantId: input.tenantId, options: input.options });
    if (countEvidenceSources(before) >= 2) return;
    await collectSourceForInteractiveSearch(source, input.query, input.tenantId, input.options);
  }
}

function countEvidenceSources(evidence: StagedEvidenceInput[]): number {
  return new Set(evidence.map((item) => item.result.capture.sourceId)).size;
}

async function collectSourceForInteractiveSearch(
  source: SourceRecord,
  query: string,
  tenantId: string | undefined,
  options: ApiServerOptions
): Promise<void> {
  const queuedAt = nowIso();
  const task: CollectionTask = {
    id: stableId("task", `interactive:${tenantId ?? "global"}:${source.id}:${query}`),
    tenantId,
    sourceId: source.id,
    targetUrl: source.url,
    sourceType: source.type,
    queuedAt,
    priority: 0.9,
    reason: `on-demand safe-public capture for ${query}`,
    retryCount: 0,
    maxRetries: 1,
    maxBytes: 1_000_000,
    sourceConcurrencyKey: source.id,
    fairnessKey: `${tenantId ?? "global"}:${query}:safe_public_on_demand`,
    planning: {
      budgetClass: "interactive_live_search",
      decision: "selected",
      reason: "cold search has no durable evidence; bounded safe-public source capture selected",
      queryTerms: [query],
      freshness: 1,
      freshnessTargetSeconds: source.crawlFrequencySeconds,
      maxCost: { tasks: 1, bytes: 1_000_000 },
      safetyEnvelope: {
        allowClearWeb: true,
        allowPublicChannel: false,
        allowRestrictedMetadata: false,
        metadataOnlyRestricted: false,
        forbiddenOperations: ["credential_bypass", "captcha_solving", "private_community_access", "leak_download"]
      },
      sourceTrust: source.trustScore,
      selectedFor: "interactive"
    }
  };

  try {
    const adapter = source.type === "rss"
      ? new RssAdapter({ fetcher: options.publicClearWebFetcher })
      : new StaticWebAdapter({ fetcher: options.publicClearWebFetcher });
    const collected = await adapter.collect(source, task);
    const queryTerms = searchTermsForQuery(query);
    for (const item of collected.items
      .filter((collectedItem) => itemMatchesQuery(collectedItem.title, collectedItem.rawText, collectedItem.url, queryTerms))
      .slice(0, 5)) {
      options.store.savePipelineResult(processCollectedItem({
        ...item,
        metadata: {
          ...item.metadata,
          query,
          normalizedQuery: normalizeSearchQuery(query),
          evidenceStage: "captured_page",
          collectionMode: "on_demand_safe_public",
          sourceActivation: "safe_public_auto",
          retentionClass: "standard"
        }
      }));
    }
  } catch {
    return;
  }
}

function isSafePublicAutoSource(source: SourceRecord): boolean {
  return (source.type === "rss" || source.type === "static_web" || source.type === "api" || source.type === "pdf")
    && (source.accessMethod === "public_http" || source.accessMethod === "official_api")
    && source.risk === "low"
    && source.catalog?.approvalScope === "safe_public_auto";
}

function searchTermsForQuery(query: string): string[] {
  const normalized = normalizeSearchQuery(query);
  return uniqueStrings([
    normalized,
    ...normalized.split(/\s+/).filter((term) => term.length >= 4)
  ]);
}

function itemMatchesQuery(title: string | undefined, body: string | undefined, url: string, terms: string[]): boolean {
  const haystack = `${title ?? ""} ${body ?? ""} ${url}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

async function publicIntelSearchResponse(input: {
  query: string;
  entityType: string;
  tenantId?: string;
  sinceCursor?: string;
  options: ApiServerOptions;
}) {
  const sourcePacks = await sourcePacksForSearch(input.options);
  ensureSafePublicStarterSources(input.options, sourcePacks, input.tenantId);
  const onDemandClearWebEnabled = input.options.publicClearWebFetcher !== undefined || Bun.env.TI_ON_DEMAND_CLEAR_WEB === "true";
  if (onDemandClearWebEnabled && !input.options.disableOnDemandClearWebCapture && searchQualityEvidence({
    query: input.query,
    tenantId: input.tenantId,
    options: input.options
  }).length === 0) {
    await collectOnDemandClearWebEvidence({
      query: input.query,
      tenantId: input.tenantId,
      options: input.options
    });
  }
  const sources = input.options.store.listSources();
  const live = createLiveSearchPlan({
    request: {
      query: input.query,
      entityType: parseIntelEntityType(input.entityType),
      tenantId: input.tenantId,
      includeClearWeb: true,
      includeTelegram: true,
      includeDarknetMetadata: false
    },
    sources,
    activeRuns: input.options.store.listRuns(),
    activePlans: input.options.store.listPlans(),
    frontier: input.options.frontier
  });
  const backfill = planTelegramPublicSearchBackfill({
    query: input.query,
    entityType: input.entityType,
    sources,
    sourcePacks: input.options.publicTelegramSourcePacks,
    tenantId: input.tenantId,
    maxTasks: 8,
    queuedSourceIds: input.options.store.listPlans()
      .filter((plan) => !input.tenantId || plan.tenantId === input.tenantId)
      .flatMap((plan) => plan.tasks)
      .filter((task) => task.sourceType === "telegram_public")
      .map((task) => task.sourceId)
  });
  const queryTerms = backfill.queryTerms.map((term) => term.toLowerCase());
  const evidence = input.options.store.listCaptures()
    .filter((capture) => !input.tenantId || capture.tenantId === input.tenantId)
    .map(publicChannelEvidenceFromCapture)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => queryTerms.some((term) =>
      `${item.channel} ${item.snippet} ${item.extractedUrls.join(" ")}`.toLowerCase().includes(term)
    ))
    .slice(0, 10);
  const sourceTypeById = new Map(sources.map((source) => [source.id, source.type]));
  const clearWebEvidenceCount = input.options.store.listCaptures()
    .filter((capture) => !input.tenantId || capture.tenantId === input.tenantId)
    .filter((capture) => sourceTypeById.get(capture.sourceId) !== "telegram_public" && capture.metadata?.sourceType !== "telegram_public")
    .filter((capture) => queryTerms.some((term) =>
      `${capture.url} ${capture.body ?? ""} ${String(capture.metadata.safeExcerpt ?? "")}`.toLowerCase().includes(term)
    ))
    .length;
  const publicChannelCutoverReport = buildTelegramPublicCutoverReport({
    query: input.query,
    entityType: input.entityType,
    sources,
    sourcePacks: input.options.publicTelegramSourcePacks,
    evidence,
    clearWebEvidenceCount,
    scheduler: {
      queuedSourceIds: backfill.tasks.map((task) => task.sourceId)
    }
  });
  const publicChannelReliability = buildTelegramPublicReliabilityReport({
    query: input.query,
    entityType: input.entityType,
    sources,
    evidence
  });
  const publicChannelOperatorStates = buildTelegramPublicOperatorStates({
    sources,
    reliability: publicChannelReliability
  });
  const publicChannelSourcePackCompatibility = buildTelegramPublicSourcePackCompatibility({
    sources,
    sourcePacks: input.options.publicTelegramSourcePacks
  });
  const publicChannelActorReadiness = buildTelegramPublicActorReadinessDto(publicChannelReliability);
  const publicChannelSummary = buildTelegramPublicCompactSearchSummary({
    cutoverReport: publicChannelCutoverReport,
    reliability: publicChannelReliability,
    operatorStates: publicChannelOperatorStates,
    actorReadiness: publicChannelActorReadiness
  });
  const publicChannelOperatorControlEffects = buildTelegramPublicOperatorControlEffects(publicChannelCutoverReport.applyPlan);
  const publicChannelSla = buildTelegramPublicSlaReport({
    cutoverReport: publicChannelCutoverReport,
    reliability: publicChannelReliability,
    operatorStates: publicChannelOperatorStates,
    actorReadiness: publicChannelActorReadiness,
    operatorControlEffects: publicChannelOperatorControlEffects
  });
  const publicChannelSourcePackReadiness = buildTelegramPublicSourcePackReadiness({
    sources,
    sourcePacks: input.options.publicTelegramSourcePacks,
    evidence,
    reliability: publicChannelReliability,
    sla: publicChannelSla
  });
  const publicChannelCanaryRollout = buildTelegramPublicCanaryRollout({
    sources,
    sourcePacks: input.options.publicTelegramSourcePacks,
    evidence,
    reliability: publicChannelReliability,
    sla: publicChannelSla,
    applyPlan: publicChannelCutoverReport.applyPlan
  });
  const publicChannelPromotionCanary = buildTelegramPublicPromotionCanaryProof({
    query: input.query,
    entityType: input.entityType,
    sources,
    evidence,
    reliability: publicChannelReliability,
    canaryRollout: publicChannelCanaryRollout,
    applyPlan: publicChannelCutoverReport.applyPlan
  });
  const publicChannelPromotionCertification = buildTelegramPublicPromotionCertification({
    query: input.query,
    entityType: input.entityType,
    sources,
    evidence,
    promotionCanary: publicChannelPromotionCanary
  });
  const publicSignalFusion = buildPublicSignalFusionWorkbench({
    query: input.query,
    entityType: input.entityType,
    tenantId: input.tenantId,
    sources,
    sourcePacks: input.options.publicTelegramSourcePacks,
    evidence,
    previousUrls: sources.flatMap((source) => Array.isArray(source.metadata?.lastDiscoveredUrls) ? source.metadata.lastDiscoveredUrls.filter((value): value is string => typeof value === "string") : [])
  });

  const publicChannelStatus = evidence.length > 0
    ? "partial"
    : backfill.status;
  const darknetMetadata = planDarknetMetadataLiveSearch({
    query: input.query,
    entityType: input.entityType,
    tenantId: input.tenantId,
    sources: input.options.store.listSources(),
    captures: input.options.store.listCaptures(),
    proxyBoundaries: {},
    disabled: darknetMetadataDisabled(input.options),
    maxTasks: 8
  });
  const restrictedMetadata = buildRestrictedMetadataOperationsStatus({
    sources: input.options.store.listSources(),
    captures: input.options.store.listCaptures(),
    proxyBoundaries: {},
    runId: live.dto.activeRunId,
    query: input.query,
    entityType: input.entityType
  });

  const scheduler = schedulerSummaryForPlan({
    plan: live.plan,
    run: live.dto.activeRunId ? input.options.store.getRun(live.dto.activeRunId) : undefined,
    planner: live.dto,
    frontier: input.options.frontier,
    options: input.options,
    sinceCursor: input.sinceCursor,
    partialResultCount: partialResultCountForQuery(input.query, input.tenantId, input.options)
  });
  const actorProfile = actorProfileForQuery({
    query: input.query,
    tenantId: input.tenantId,
    options: input.options
  });
  const quality = searchQualityForQuery({
    query: input.query,
    tenantId: input.tenantId,
    options: input.options
  });
  const graph = graphReviewSummaryForQuery({
    query: input.query,
    tenantId: input.tenantId,
    options: input.options
  });
  const sourceActivation = buildSourceActivationBatchApiResponse({
    queries: [input.query],
    sources,
    sourcePacks,
    tenantId: input.tenantId
  }).queries[0];
  const sourceCoverage = buildSourceCoveragePlanApiResponse({
    queries: [input.query],
    sources,
    sourcePacks,
    tenantId: input.tenantId
  }).queries[0];
  const evidenceCutover = buildEvidenceCutoverReportDto(input.options.store, input.options.objectStore ?? EMPTY_OBJECT_STORE, input.query, {
    tenantId: input.tenantId,
    sinceCursor: input.sinceCursor
  });
  const compatibility = liveSearchCompatibilityFields({
    query: input.query,
    planner: live.dto,
    scheduler: scheduler as ReturnType<typeof schedulerSummaryForPlan>,
    actorProfile,
    graph,
    quality,
    sourceCount: sources.length
  });
  const publicAnswer = actorProfile.answer as { deltas?: unknown[]; reviewGates?: unknown[] } | undefined;
  const sla = searchSlaSummary({
    sourceCoverage,
    sourceActivation,
    scheduler,
    publicChannelSla,
    publicChannelSourcePackReadiness,
    publicChannelCanaryRollout,
    publicChannelPromotionCanary,
    publicChannelPromotionCertification,
    restrictedMetadata,
    claimLedger: evidenceCutover.trustLedger,
    answer: actorProfile.answer,
    graphExport: graph.exportGate,
    warnings: compatibility.warnings,
    warningCodes: compatibility.warningCodes,
    status: compatibility.status,
    nextPollSeconds: compatibility.nextPollSeconds,
    cursor: compatibility.cursor,
    nextCursor: compatibility.nextCursor
  });
  const publicTiAnswer = publicTiAnswerForSearch({
    actorProfile,
    compatibility,
    sourceCoverage,
    sourceActivation,
    scheduler,
    publicChannelStatus,
    publicChannelSummary,
    publicChannelPromotionCanary,
    publicChannelPromotionCertification,
    restrictedMetadata,
    graph,
    sla
  });
  const publicWrapperDelta = publicWrapperDeltaCompatibility({
    query: input.query,
    compatibility,
    scheduler,
    answerDeltas: Array.isArray(publicAnswer?.deltas) ? publicAnswer.deltas : [],
    sourceCoverage,
    publicChannelStatus,
    publicChannelSummary,
    restrictedMetadata,
    claimLedger: evidenceCutover.trustLedger,
    graph,
    sla
  });

  return {
    query: input.query,
    normalizedQuery: input.query.trim(),
    ...compatibility,
    mode: "interactive_live_search",
    planner: live.dto,
    scheduler,
    actorProfile,
    graph,
    graphExport: graph.exportGate,
    answer: actorProfile.answer,
    publicTiAnswer,
    publicWrapperDelta,
    answerGraphCaveats: graph.enforcement.answerCaveats,
    answerDeltas: Array.isArray(publicAnswer?.deltas) ? publicAnswer.deltas : [],
    reviewGates: Array.isArray(publicAnswer?.reviewGates) ? publicAnswer.reviewGates : [],
    sourceActivation,
    claimLedger: evidenceCutover.trustLedger,
    sourceCoverage,
    sla,
    publicChannel: {
      status: publicChannelStatus,
      summary: publicChannelSummary,
      sla: publicChannelSla,
      evidence,
      queuedTasks: backfill.tasks.length,
      blocked: backfill.blocked,
      skipped: backfill.skipped,
      coverageGaps: backfill.coverageGaps,
      sourcePackRecommendations: backfill.sourcePackRecommendations,
      activationProgram: backfill.activationProgram,
      reconciliation: backfill.reconciliation,
      cutoverReport: publicChannelCutoverReport,
      reliability: publicChannelReliability,
      abuseControls: publicChannelCutoverReport.abuseControls,
      operatorStates: publicChannelOperatorStates,
      sourcePackCompatibility: publicChannelSourcePackCompatibility,
      sourcePackReadiness: publicChannelSourcePackReadiness,
      canaryRollout: publicChannelCanaryRollout,
      promotionCanary: publicChannelPromotionCanary,
      promotionCertification: publicChannelPromotionCertification,
      signalFusion: publicSignalFusion,
      actorReadiness: publicChannelActorReadiness,
      operatorControlEffects: publicChannelOperatorControlEffects,
      applyPlan: {
        summary: publicChannelCutoverReport.applyPlan.summary,
        promotionGate: publicChannelCutoverReport.applyPlan.promotionGate,
        steps: publicChannelCutoverReport.applyPlan.steps.map((step) => ({
          id: step.id,
          action: step.action,
          execution: step.execution,
          sourceId: step.sourceId,
          channelHandle: step.channelHandle,
          priority: step.priority,
          automationSafe: step.automationSafe,
          manual: step.manual
        }))
      },
      activationRecommendations: backfill.activationRecommendations,
      queryTerms: backfill.queryTerms,
      notes: publicChannelStatus === "pending_channel_search"
        ? ["No approved public-channel evidence is currently available; review activation recommendations for safe public sources."]
        : publicSignalFusion.caveats
    },
    darknetMetadata,
    restrictedMetadata,
    quality
  };
}

function searchSlaSummary(input: {
  sourceCoverage: unknown;
  sourceActivation: unknown;
  scheduler: ReturnType<typeof schedulerSummaryForPlan>;
  publicChannelSla: unknown;
  publicChannelSourcePackReadiness?: unknown;
  publicChannelCanaryRollout?: unknown;
  publicChannelPromotionCanary?: unknown;
  publicChannelPromotionCertification?: unknown;
  restrictedMetadata: unknown;
  claimLedger: unknown;
  answer: unknown;
  graphExport: unknown;
  warnings: string[];
  warningCodes: string[];
  status: string;
  nextPollSeconds: number;
  cursor: string;
  nextCursor: string;
}) {
  const sourceCoverage = record(input.sourceCoverage);
  const sourceActivation = record(input.sourceActivation);
  const sourceSlo = record(sourceCoverage?.slo);
  const activationPacket = record(sourceActivation?.operatorDecisionPacket);
  const publicChannelSla = record(input.publicChannelSla) ?? {};
  const publicChannelSourcePackReadiness = record(input.publicChannelSourcePackReadiness) ?? {};
  const sourcePackSummary = record(publicChannelSourcePackReadiness.summary) ?? {};
  const publicChannelCanaryRollout = record(input.publicChannelCanaryRollout) ?? {};
  const canarySummary = record(publicChannelCanaryRollout.summary) ?? {};
  const publicChannelPromotionCanary = record(input.publicChannelPromotionCanary) ?? {};
  const promotionCanarySummary = record(publicChannelPromotionCanary.summary) ?? {};
  const publicChannelPromotionCertification = record(input.publicChannelPromotionCertification) ?? {};
  const promotionCertificationSummary = record(publicChannelPromotionCertification.summary) ?? {};
  const restricted = record(input.restrictedMetadata);
  const claimLedger = record(input.claimLedger) ?? {};
  const answer = record(input.answer) ?? {};
  const answerSla = record(answer?.readinessSla);
  const graphExport = record(input.graphExport) ?? {};
  const publicReleaseGate = record(publicChannelSla.releaseGate);
  const publicEnforcement = record(publicChannelSla.enforcement);
  const graphState = String(graphExport.state ?? "pass");
  const sourceStatus = String(sourceSlo?.status ?? sourceCoverage?.coverageState ?? "unknown");
  const schedulerState = input.scheduler.runtimeSla.state;
  const publicChannelStatus = String(publicChannelSla.status ?? "pass");
  const restrictedStatus = String(restricted?.status ?? restricted?.state ?? "none");
  const claimGate = String(claimLedger.trustGate ?? "unknown");
  const answerStatus = String(answerSla?.status ?? answer?.status ?? "unknown");
  const sectionStates = [sourceStatus, schedulerState, publicChannelStatus, restrictedStatus, claimGate, answerStatus, graphState];
  const releaseState = sectionStates.some((state) => ["blocked", "blocker", "breach"].includes(state))
    ? "blocked"
    : sectionStates.some((state) => ["fail", "hold", "watch", "warning", "review_required"].includes(state))
      ? "watch"
      : "pass";
  return {
    endpoint: "/v1/intel/search.sla",
    releaseState,
    sourceActivation: {
      status: sourceStatus,
      failures: stringArray(sourceSlo?.failures),
      dryRun: sourceActivation?.dryRun === true,
      willMutate: sourceActivation?.willMutate === true,
      willStartCrawling: sourceActivation?.willStartCrawling === true,
      legalReviewsRequired: stringArray(activationPacket?.legalReviewsRequired),
      parserFixesRequired: stringArray(activationPacket?.parserFixesRequired)
    },
    scheduler: {
      state: schedulerState,
      publicAnswerImpact: input.scheduler.runtimeSla.publicAnswerImpact,
      apiPollingImpact: input.scheduler.runtimeSla.apiPollingImpact,
      breached: input.scheduler.runtimeSla.breached,
      watched: input.scheduler.runtimeSla.watched,
      workerSafetyPlan: {
        dryRun: input.scheduler.runtimeSla.workerSafetyPlan.dryRun,
        willMutate: input.scheduler.runtimeSla.workerSafetyPlan.willMutate,
        recoveryActionCount: input.scheduler.runtimeSla.workerSafetyPlan.recoveryActions.length
      }
    },
    publicChannel: {
      status: publicChannelStatus,
      decisionImpact: String(publicReleaseGate?.decisionImpact ?? "promote"),
      enforcementStatus: String(publicEnforcement?.status ?? publicChannelStatus),
      releaseAction: String(publicEnforcement?.releaseAction ?? publicReleaseGate?.decisionImpact ?? "promote"),
      checkCount: Array.isArray(publicEnforcement?.checks) ? publicEnforcement.checks.length : 0,
      sourcePackReadiness: {
        status: String(publicChannelSourcePackReadiness.status ?? "unknown"),
        sourcePackCount: typeof sourcePackSummary.sourcePackCount === "number" ? sourcePackSummary.sourcePackCount : 0,
        candidateCount: typeof sourcePackSummary.candidateCount === "number" ? sourcePackSummary.candidateCount : 0,
        replayableEvidenceCount: typeof sourcePackSummary.replayableEvidenceCount === "number" ? sourcePackSummary.replayableEvidenceCount : 0,
        releaseHold: Boolean(sourcePackSummary.releaseHold ?? false)
      },
      canaryRollout: {
        status: String(publicChannelCanaryRollout.status ?? "unknown"),
        selectedSourceCount: typeof canarySummary.selectedSourceCount === "number" ? canarySummary.selectedSourceCount : 0,
        pendingReviewCount: typeof canarySummary.pendingReviewCount === "number" ? canarySummary.pendingReviewCount : 0,
        releaseTrain: String(canarySummary.releaseTrain ?? "unknown")
      },
      promotionCanary: {
        status: String(publicChannelPromotionCanary.status ?? "unknown"),
        evidenceCount: typeof promotionCanarySummary.evidenceCount === "number" ? promotionCanarySummary.evidenceCount : 0,
        claimCandidateCount: typeof promotionCanarySummary.claimCandidateCount === "number" ? promotionCanarySummary.claimCandidateCount : 0,
        graphHintCount: typeof promotionCanarySummary.graphHintCount === "number" ? promotionCanarySummary.graphHintCount : 0,
        rollbackTriggerCount: typeof promotionCanarySummary.rollbackTriggerCount === "number" ? promotionCanarySummary.rollbackTriggerCount : 0
      },
      promotionCertification: {
        status: String(publicChannelPromotionCertification.status ?? "unknown"),
        certifiedEvidenceCount: typeof promotionCertificationSummary.certifiedEvidenceCount === "number" ? promotionCertificationSummary.certifiedEvidenceCount : 0,
        heldEvidenceCount: typeof promotionCertificationSummary.heldEvidenceCount === "number" ? promotionCertificationSummary.heldEvidenceCount : 0,
        blockedEvidenceCount: typeof promotionCertificationSummary.blockedEvidenceCount === "number" ? promotionCertificationSummary.blockedEvidenceCount : 0,
        releaseDecision: String(promotionCertificationSummary.releaseDecision ?? "unknown")
      },
      blockers: stringArray(publicReleaseGate?.blockers),
      warnings: stringArray(publicReleaseGate?.warnings)
    },
    restrictedMetadata: {
      status: restrictedStatus,
      killSwitch: Boolean(restricted?.killSwitchActive ?? restricted?.disabled ?? false),
      blockers: stringArray(restricted?.blockers),
      warnings: stringArray(restricted?.warnings)
    },
    claimLedger: {
      trustGate: claimGate,
      blockers: stringArray(claimLedger.blockers),
      counts: claimLedger.counts,
      enforcement: claimLedger.enforcement,
      certification: claimLedger.certification,
      safeOutput: claimLedger.safeOutput
    },
    answerReadiness: {
      status: answerStatus,
      confidence: typeof answerSla?.confidence === "number" ? answerSla.confidence : answer?.confidence,
      explanations: stringArray(answerSla?.explanations),
      warningCodes: stringArray(answer?.warningCodes)
    },
    graphExport,
    warnings: input.warnings,
    warningCodes: input.warningCodes,
    polling: {
      nextPollSeconds: input.nextPollSeconds,
      cursor: input.cursor,
      nextCursor: input.nextCursor,
      cursorContinuity: input.scheduler.cursorContinuity
    },
    enforcement: searchSlaEnforcement({
      status: input.status,
      releaseState,
      sourceStatus,
      schedulerState,
      publicChannelStatus,
      restrictedStatus,
      claimGate,
      answerStatus,
      graphState,
      sourceCoverage,
      sourceActivation,
      scheduler: input.scheduler,
      publicReleaseGate,
      publicEnforcement,
      restricted,
      claimLedger,
      answer,
      answerSla,
      graphExport,
      warnings: input.warnings,
      warningCodes: input.warningCodes,
      nextPollSeconds: input.nextPollSeconds,
      cursor: input.cursor,
      nextCursor: input.nextCursor
    })
  };
}

function publicWrapperDeltaCompatibility(input: {
  query: string;
  compatibility: ReturnType<typeof liveSearchCompatibilityFields>;
  scheduler: ReturnType<typeof schedulerSummaryForPlan>;
  answerDeltas: unknown[];
  sourceCoverage: unknown;
  publicChannelStatus: string;
  publicChannelSummary: unknown;
  restrictedMetadata: unknown;
  claimLedger: unknown;
  graph: ReturnType<typeof graphReviewSummaryForQuery>;
  sla: ReturnType<typeof searchSlaSummary>;
}) {
  const claimLedger = record(input.claimLedger) ?? {};
  const graphDeltas = arrayRecords(input.graph.liveUpdate?.scenarioCoverage)
    .filter((scenario) => String(scenario.status ?? "").match(/pass|warning/));
  const publicChannel = record(input.publicChannelSummary) ?? {};
  const restricted = record(input.restrictedMetadata) ?? {};
  const answerDeltas = arrayRecords(input.answerDeltas);
  const sourceCoverage = record(input.sourceCoverage) ?? {};
  const changedSinceCursor = {
    cursor: input.compatibility.pollCursor,
    nextCursor: input.compatibility.deltaCursor,
    cursorContinuity: input.scheduler.cursorContinuity,
    empty: input.scheduler.newEvidenceDeltaCount === 0 && answerDeltas.length === 0,
    counts: {
      scheduler: input.scheduler.newEvidenceDeltaCount,
      answer: answerDeltas.length,
      graph: graphDeltas.length,
      claimLedgerHolds: stringArray(claimLedger.blockers).length,
      publicChannelHints: input.publicChannelStatus === "partial" ? 1 : 0,
      restrictedHeld: stringArray(restricted.blockers).length + stringArray(restricted.warnings).length
    }
  };
  return {
    schemaVersion: "ti.public_wrapper_delta.v1",
    query: input.query,
    stablePublicFields: [
      "status",
      "summary",
      "runId",
      "refreshAfterSeconds",
      "pollCursor",
      "deltaCursor",
      "updated",
      "lastSeen",
      "sources",
      "recentActivity",
      "targets",
      "ttps",
      "datasets",
      "warnings",
      "warningCodes",
      "sourceCoverage",
      "publicChannel",
      "restrictedMetadata",
      "claimLedger",
      "graph"
    ],
    compatibility: {
      canonicalMethod: "POST",
      canonicalPath: "/api/ti/search",
      mapsTo: "/v1/intel/search",
      backwardsCompatible: true,
      noRawProofPayloads: true,
      runIdStableAcrossPolls: true,
      refreshAfterSeconds: input.compatibility.refreshAfterSeconds
    },
    polling: {
      runId: input.compatibility.runId,
      pollCursor: input.compatibility.pollCursor,
      deltaCursor: input.compatibility.deltaCursor,
      nextPollSeconds: input.compatibility.nextPollSeconds,
      updated: input.compatibility.updated,
      lastSeen: input.compatibility.lastSeen,
      cursorRequired: true,
      changedSinceCursor
    },
    deltas: {
      answer: answerDeltas,
      scheduler: {
        cursorContinuity: input.scheduler.cursorContinuity,
        promotedEvidenceCount: input.scheduler.promotedEvidenceCount,
        newEvidenceDeltaCount: input.scheduler.newEvidenceDeltaCount,
        partialReasons: input.scheduler.partialReasons
      },
      sourceCoverage: {
        coverageState: String(sourceCoverage.coverageState ?? "unknown"),
        gaps: uniqueStrings([
          ...stringArray(sourceCoverage.gaps),
          ...stringArray(sourceCoverage.coverageGaps)
        ])
      },
      publicChannel: {
        status: input.publicChannelStatus,
        hintCount: input.publicChannelStatus === "partial" ? 1 : 0,
        safeOutput: record(publicChannel.safeOutput) ?? {}
      },
      restrictedMetadata: {
        status: String(restricted.status ?? restricted.state ?? "none"),
        held: stringArray(restricted.blockers).length > 0 || stringArray(restricted.warnings).length > 0,
        blockers: stringArray(restricted.blockers),
        warnings: stringArray(restricted.warnings)
      },
      claimLedger: {
        trustGate: String(claimLedger.trustGate ?? "unknown"),
        blockers: stringArray(claimLedger.blockers),
        safeOutput: claimLedger.safeOutput
      },
      graph: {
        relationshipCount: input.graph.relationshipCount,
        publicFactPolicy: input.graph.publicFactPolicy,
        exportGate: input.graph.exportGate,
        liveUpdate: input.graph.liveUpdate
      }
    },
    releaseBoardHandoff: {
      agent02SchedulerCursors: "scheduler.cursorContinuity | scheduler.latestCursor | scheduler.newEvidenceDeltaCount",
      agent06ClaimLedger: "claimLedger.trustGate | claimLedger.blockers | claimLedger.safeOutput",
      agent07AnswerDeltas: "answerDeltas[]",
      agent08GraphDeltas: "graph.liveUpdate | graph.exportGate",
      agent10ReleaseBoard: "publicWrapperDelta.compatibility | publicWrapperDelta.polling | publicWrapperDelta.deltas"
    },
    noLeakExamples: [
      { scenario: "public_channel_hint_delta", allowed: ["message URL/hash", "compact claim", "source id"], forbidden: ["raw message body", "media payload", "session token"] },
      { scenario: "restricted_metadata_held_delta", allowed: ["victim", "actor statement summary", "dataset-size claim", "hash"], forbidden: ["restricted rows", "credentials", "private access material", "restricted URL"] }
    ]
  };
}

function publicWrapperDeltaStableFields(): string[] {
  return [
    "status",
    "summary",
    "runId",
    "refreshAfterSeconds",
    "pollCursor",
    "deltaCursor",
    "updated",
    "lastSeen",
    "sources",
    "recentActivity",
    "targets",
    "ttps",
    "datasets",
    "warnings",
    "warningCodes",
    "sourceCoverage",
    "publicChannel",
    "restrictedMetadata",
    "claimLedger",
    "graph"
  ];
}

function searchSlaEnforcement(input: {
  status: string;
  releaseState: string;
  sourceStatus: string;
  schedulerState: string;
  publicChannelStatus: string;
  restrictedStatus: string;
  claimGate: string;
  answerStatus: string;
  graphState: string;
  sourceCoverage: Record<string, unknown> | undefined;
  sourceActivation: Record<string, unknown> | undefined;
  scheduler: ReturnType<typeof schedulerSummaryForPlan>;
  publicReleaseGate: Record<string, unknown> | undefined;
  publicEnforcement: Record<string, unknown> | undefined;
  restricted: Record<string, unknown> | undefined;
  claimLedger: Record<string, unknown>;
  answer: Record<string, unknown>;
  answerSla: Record<string, unknown> | undefined;
  graphExport: Record<string, unknown>;
  warnings: string[];
  warningCodes: string[];
  nextPollSeconds: number;
  cursor: string;
  nextCursor: string;
}) {
  const activationPacket = record(input.sourceActivation?.operatorDecisionPacket);
  const runtimeSla = record(input.sourceCoverage?.runtimeSla);
  const runtimeSummary = record(runtimeSla?.summary);
  const promotionPolicy = record(input.answer?.promotionPolicy);
  const claimEnforcement = record(input.claimLedger.enforcement);
  const sourceCoverageState = String(input.sourceCoverage?.coverageState ?? input.sourceStatus);
  const noApprovedSources = arrayLength(input.sourceCoverage?.eligibleSources) === 0
    && arrayLength(input.sourceCoverage?.selectedSources) === 0
    && arrayLength(input.sourceCoverage?.approvedIdleSources) === 0;
  const providerUnavailable = input.warningCodes.includes("provider_unavailable")
    || input.scheduler.runtimeSla.breached.some((item) => item.includes("provider"))
    || input.scheduler.backpressure.reasons.some((item) => item.includes("provider"));
  const queuePressure = input.scheduler.backpressure.reasons.length > 0
    || input.scheduler.runtimeSla.apiPollingImpact !== "normal"
    || input.warningCodes.includes("queue_pressure");
  const staleEvidence = input.warningCodes.some((code) => code.includes("stale"))
    || input.answerStatus === "stale"
    || String(runtimeSummary?.apiImpact ?? "").includes("stale");
  const reviewRequired = input.answerStatus === "review_required"
    || input.warningCodes.includes("needs_review")
    || arrayLength(input.answer?.reviewGates) > 0;
  const blocked = input.releaseState === "blocked"
    || input.scheduler.runtimeSla.apiPollingImpact === "blocked"
    || input.restrictedStatus === "blocked"
    || input.claimGate === "blocked";
  const currentStatus = blocked
    ? "blocked"
    : input.status === "ready"
      ? "ready"
      : reviewRequired
        ? "review_required"
        : "partial";
  const holds = [
    ...(blocked ? ["release_state_blocked"] : []),
    ...(providerUnavailable ? ["provider_unavailable"] : []),
    ...(noApprovedSources ? ["no_approved_sources"] : []),
    ...(queuePressure ? ["queue_pressure"] : []),
    ...(staleEvidence ? ["stale_evidence"] : []),
    ...stringArray(input.publicReleaseGate?.blockers),
    ...stringArray(input.claimLedger.blockers),
    ...stringArray(claimEnforcement?.holds)
  ];
  const warnings = uniqueStrings([
    ...input.warnings,
    ...input.warningCodes,
    ...stringArray(input.publicReleaseGate?.warnings),
    ...stringArray(claimEnforcement?.warnings),
    ...(reviewRequired ? ["review_required"] : []),
    ...(sourceCoverageState === "needs_review" ? ["source_coverage_needs_review"] : [])
  ]);
  const repairPackets = [
    ...(noApprovedSources ? [repairPacket("source_activation", "Agent 01", "review_source_activation_batch")] : []),
    ...(queuePressure ? [repairPacket("queue_pressure", "Agent 02", "apply_scheduler_capacity_plan")] : []),
    ...(providerUnavailable ? [repairPacket("provider_unavailable", "Agent 02", "hold_or_retry_provider_backoff")] : []),
    ...(stringArray(activationPacket?.parserFixesRequired).length > 0 ? [repairPacket("parser_gap", "Agent 03", "request_parser_support")] : []),
    ...(input.publicChannelStatus !== "pass" ? [repairPacket("public_channel_sla", "Agent 04", "review_public_channel_release_gate")] : []),
    ...(input.restrictedStatus === "blocked" ? [repairPacket("restricted_metadata_blocked", "Agent 05", "keep_metadata_kill_switch_or_review")] : []),
    ...(input.claimGate !== "pass" && input.claimGate !== "ready" ? [repairPacket("claim_ledger_hold", "Agent 06", "repair_evidence_trust_ledger")] : []),
    ...repairPacketsFromClaimLedger(claimEnforcement),
    ...(reviewRequired ? [repairPacket("answer_review_required", "Agent 07", "review_public_answer_gates")] : []),
    ...(input.graphState === "hold" ? [repairPacket("graph_export_hold", "Agent 08", "review_graph_export_holds")] : [])
  ];

  return {
    endpoint: "/v1/intel/search.sla.enforcement",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    current: {
      status: currentStatus,
      releaseState: input.releaseState,
      publicStatus: input.status,
      canPromote: currentStatus === "ready" && holds.length === 0 && promotionPolicy?.canPromote !== false,
      releaseAction: holds.length > 0 ? "hold" : "promote"
    },
    statePolicy: {
      ready: compatibilityStatePolicy("ready", 200, "preserve_fields_and_allow_public_promotion"),
      partial: compatibilityStatePolicy("partial", 200, "preserve_fields_and_poll_for_deltas"),
      reviewRequired: compatibilityStatePolicy("review_required", 200, "preserve_fields_and_surface_review_gates"),
      blocked: compatibilityStatePolicy("blocked", 200, "preserve_fields_and_surface_safe_blockers"),
      error: compatibilityStatePolicy("error", 500, "preserve_error_envelope_without_raw_evidence")
    },
    publicApiProof: {
      canonicalMethod: "POST",
      canonicalPath: "/api/ti/search",
      getProofOptionalUnlessRequired: true
    },
    compatibilityFields: [
      "query",
      "mode",
      "status",
      "runId",
      "refreshAfterSeconds",
      "summary",
      "confidence",
      "aliases",
      "recentActivity",
      "targets",
      "TTPs",
      "datasets",
      "sources",
      "notes",
      "warnings",
      "cursor",
      "nextCursor"
    ],
    sections: {
      sourceActivation: enforcementSection(input.sourceStatus, sourceCoverageState, "public_answer_and_source_gap_visibility"),
      scheduler: enforcementSection(input.schedulerState, input.scheduler.runtimeSla.apiPollingImpact, "cursor_polling_and_duplicate_run_reuse"),
      publicChannel: enforcementSection(input.publicChannelStatus, String(input.publicEnforcement?.releaseAction ?? input.publicReleaseGate?.decisionImpact ?? "promote"), "public_channel_partial_answer_safety"),
      restrictedMetadata: enforcementSection(input.restrictedStatus, input.restricted?.killSwitchActive === true ? "kill_switch_active" : "metadata_only_safe_output", "restricted_metadata_safe_output"),
      claimLedger: enforcementSection(input.claimGate, String(claimEnforcement?.releaseAction ?? (input.claimLedger.safeOutput ? "redacted_safe_output" : "trust_gate_unknown")), "claim_level_public_promotion"),
      answerReadiness: enforcementSection(input.answerStatus, String(input.answerSla?.status ?? input.answerStatus), "ready_partial_review_required_mapping"),
      graphExport: enforcementSection(input.graphState, String(input.graphExport.slaState ?? input.graphState), "stix_and_public_fact_export")
    },
    holds: uniqueStrings(holds),
    warnings,
    repairPackets,
    polling: {
      nextPollSeconds: input.nextPollSeconds,
      cursor: input.cursor,
      nextCursor: input.nextCursor,
      cursorStable: input.cursor === input.nextCursor,
      duplicateRunReuse: input.scheduler.attachedToActiveRun,
      cursorContinuity: input.scheduler.cursorContinuity
    }
  };
}

function repairPacketsFromClaimLedger(enforcement: Record<string, unknown> | undefined): ReturnType<typeof repairPacket>[] {
  const packets = Array.isArray(enforcement?.repairPackets) ? enforcement.repairPackets : [];
  return packets
    .filter((packet): packet is Record<string, unknown> => Boolean(packet) && typeof packet === "object" && !Array.isArray(packet))
    .map((packet) => repairPacket(String(packet.code ?? "claim_ledger_enforcement"), String(packet.owner ?? "Agent 06"), String(packet.action ?? "repair_evidence_trust_ledger")));
}

function repairPacket(code: string, owner: string, action: string) {
  return {
    code,
    owner,
    action,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false
  };
}

function compatibilityStatePolicy(status: string, httpStatus: number, behavior: string) {
  return {
    status,
    httpStatus,
    behavior,
    preservesCompatibilityFields: true,
    cursorPollable: status !== "error"
  };
}

function enforcementSection(state: string, impact: string, publicApiImpact: string) {
  return {
    state,
    impact,
    publicApiImpact,
    hold: ["blocked", "blocker", "breach", "hold"].includes(state)
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function graphReviewSummaryForQuery(input: {
  query: string;
  tenantId?: string;
  options: ApiServerOptions;
}) {
  const evidence = searchQualityEvidence(input);
  const nodes = new Map<string, ReturnType<typeof buildRelationshipGraph>["nodes"][number]>();
  const relationships = new Map<string, ReturnType<typeof buildRelationshipGraph>["relationships"][number]>();
  for (const item of evidence) {
    const graph = buildRelationshipGraph(item.result);
    for (const node of graph.nodes) nodes.set(node.id, node);
    for (const relationship of graph.relationships) relationships.set(relationship.id, relationship);
  }
  const snapshot = buildPersistedGraphSnapshot({
    nodes: [...nodes.values()],
    relationships: [...relationships.values()]
  }, { generatedAt: nowIso() });
  const reviewQueue = buildGraphReviewQueueSummary(snapshot);
  const runtime = buildGraphRuntimeApiDto(snapshot, {
    endpoint: "/v1/intel/search.graph",
    generatedAt: snapshot.generatedAt,
    maxRelationships: 25
  });
  const exportGate = {
    state: runtime.enforcement.releaseGate.stixPromotion === "rollback"
      ? "rollback"
      : runtime.enforcement.releaseGate.stixPromotion === "hold"
        ? "hold"
        : runtime.exportSla.state === "pass" || runtime.exportSla.state === "warning" ? "pass" : "hold",
    publicFactPolicy: reviewQueue.publicFactPolicy,
    readyRelationshipCount: Math.max(0, reviewQueue.total - reviewQueue.exportHoldCount),
    heldRelationshipCount: reviewQueue.exportHoldCount,
    reviewRequiredCount: reviewQueue.humanReviewCount,
    slaState: runtime.exportSla.state,
    enforcementState: runtime.enforcement.state,
    schemaSafe: runtime.enforcement.releaseGate.schemaSafe,
    ledgerComplete: runtime.enforcement.releaseGate.ledgerComplete,
    certificationStatus: runtime.certification.status,
    noUnsupportedTaxiiServerClaims: runtime.certification.noUnsupportedTaxiiServerClaims,
    answerCaveats: runtime.enforcement.answerCaveats,
    proofRoute: "/v1/exports/stix"
  };
  return {
    endpoint: "/v1/intel/search.graph",
    query: input.query,
    relationshipCount: snapshot.relationships.length,
    runtime,
    exportSla: runtime.exportSla,
    enforcement: runtime.enforcement,
    certification: runtime.certification,
    liveUpdate: runtime.liveUpdate,
    reviewQueue,
    publicFactPolicy: reviewQueue.publicFactPolicy,
    exportGate,
    notes: reviewQueue.exportHoldCount > 0
      ? ["Weak or drifted graph edges are held out of public /ti facts until review and provenance gates pass."]
      : []
  };
}

function liveSearchCompatibilityFields(input: {
  query: string;
  planner: LiveSearchPlannerDto;
  scheduler: ReturnType<typeof schedulerSummaryForPlan>;
  actorProfile: ReturnType<typeof actorProfileForQuery>;
  graph: ReturnType<typeof graphReviewSummaryForQuery>;
  quality: ReturnType<typeof searchQualityForQuery>;
  sourceCount: number;
}) {
  const status = input.quality.status === "ready"
    ? "ready"
    : input.planner.backpressureState === "deferred_by_queue_pressure"
      ? "degraded"
      : input.planner.backpressureState === "needs_source_activation" || input.scheduler.partialResultReadiness === "blocked"
        ? "partial"
        : "partial";
  const cursor = input.scheduler.latestCursor ?? stableId("cursor", `${input.query}:${input.planner.reuseKey}:${input.scheduler.cursorContinuity}`);
  const publicPollSeconds = publicTiAnswerPollSeconds(input.scheduler.nextPollSeconds);
  const evidenceStageCounts = record(input.actorProfile.datasets?.evidenceStageCounts) ?? {};
  const hasObservedEvidence = Object.entries(evidenceStageCounts)
    .some(([stage, value]) => stage !== "seeded" && typeof value === "number" && value > 0);
  const recentActivity = record(input.actorProfile.recentActivity) ?? {};
  const lastSeen = hasObservedEvidence && typeof recentActivity.lastSeen === "string" ? recentActivity.lastSeen : undefined;
  return {
    status,
    runId: input.planner.activeRunId ?? stableId("run", input.query.toLowerCase()),
    cursor,
    nextCursor: cursor,
    pollCursor: cursor,
    deltaCursor: cursor,
    updated: nowIso(),
    lastSeen,
    refreshAfterSeconds: publicPollSeconds,
    nextPollSeconds: publicPollSeconds,
    summary: input.actorProfile.answer?.summary ?? input.actorProfile.summary,
    aliases: input.actorProfile.aliases,
    recentActivity: input.actorProfile.recentActivity,
    targets: input.actorProfile.targets,
    ttps: input.actorProfile.ttps,
    ttpsDisplay: input.actorProfile.ttps,
    datasets: input.actorProfile.datasets,
    sources: {
      total: input.sourceCount,
      active: input.planner.queuedTaskCount,
      coverageGaps: input.planner.coverageGaps,
      recommendations: input.planner.recommendedSourceActivations
    },
    notes: input.actorProfile.provenanceNotes,
    warnings: input.quality.publicWarningText,
    warningCodes: input.quality.publicWarningCodes
  };
}

function publicTiAnswerForSearch(input: {
  actorProfile: ReturnType<typeof actorProfileForQuery>;
  compatibility: ReturnType<typeof liveSearchCompatibilityFields>;
  sourceCoverage: unknown;
  sourceActivation: unknown;
  scheduler: ReturnType<typeof schedulerSummaryForPlan>;
  publicChannelStatus: string;
  publicChannelSummary: unknown;
  publicChannelPromotionCanary?: unknown;
  publicChannelPromotionCertification?: unknown;
  restrictedMetadata: unknown;
  graph: ReturnType<typeof graphReviewSummaryForQuery>;
  sla: ReturnType<typeof searchSlaSummary>;
}) {
  const answer = record(input.actorProfile.answer) ?? {};
  const contract = record(answer.publicContract) ?? fallbackPublicTiAnswerContract(input.actorProfile, input.compatibility);
  const sourceCoverage = record(input.sourceCoverage);
  const sourceActivation = record(input.sourceActivation);
  const sourceGaps = [
    ...stringArray(sourceCoverage?.gaps),
    ...stringArray(sourceCoverage?.coverageGaps),
    ...stringArray(sourceActivation?.coverageGaps),
    ...stringArray(input.compatibility.sources.coverageGaps)
  ];
  const stateMachine = publicTiAnswerPollingStateMachine({
    contract,
    answer,
    compatibility: input.compatibility,
    sourceCoverageGaps: sourceGaps,
    sourceActivation,
    scheduler: input.scheduler,
    publicChannelStatus: input.publicChannelStatus,
    publicChannelSummary: input.publicChannelSummary,
    restrictedMetadata: input.restrictedMetadata,
    graph: input.graph,
    sla: input.sla
  });
  const releaseCandidate = publicTiAnswerReleaseCandidate({
    contract,
    answer,
    stateMachine,
    compatibility: input.compatibility,
    sourceCoverageGaps: sourceGaps,
    sourceActivation,
    scheduler: input.scheduler,
    publicChannelStatus: input.publicChannelStatus,
    publicChannelSummary: input.publicChannelSummary,
    publicChannelPromotionCanary: input.publicChannelPromotionCanary,
    restrictedMetadata: input.restrictedMetadata,
    graph: input.graph,
    sla: input.sla
  });
  const ux = publicTiAnswerUxSemantics({
    contract,
    answer,
    stateMachine,
    releaseCandidate,
    compatibility: input.compatibility,
    actorProfile: input.actorProfile,
    scheduler: input.scheduler,
    sourceCoverageGaps: sourceGaps
  });
  const uxRecord = record(ux) ?? {};
  const compactAnswerCopy = record(uxRecord.compactAnswerCopy) ?? {};
  const responsiveSafeSummary = stringArray(compactAnswerCopy.summary).length > 0
    ? stringArray(compactAnswerCopy.summary)
    : stringArray(contract.safeSummary);
  const searchingOnly = responsiveSafeSummary.length === 1 && responsiveSafeSummary[0] === "Searching";
  return {
    ...contract,
    safeSummary: responsiveSafeSummary,
    evidenceLedgerReferences: searchingOnly ? [] : contract.evidenceLedgerReferences,
    stateMachine,
    releaseCandidate,
    ux,
    route: {
      endpoint: "/v1/intel/search",
      publicWrapperPath: "/api/ti/search",
      publicWrapperMethod: "POST",
      runId: input.compatibility.runId,
      status: input.compatibility.status,
      cursor: input.compatibility.cursor,
      nextCursor: input.compatibility.nextCursor,
      refreshAfterSeconds: input.compatibility.refreshAfterSeconds
    },
    liveProgress: {
      phase: stateMachine.phase,
      immediatePartialResults: input.compatibility.status !== "ready",
      schedulerState: input.scheduler.runtimeSla.state,
      queuedTaskCount: input.scheduler.queuedTaskCount,
      partialResultReadiness: input.scheduler.partialResultReadiness,
      publicChannelStatus: input.publicChannelStatus,
      restrictedMetadataStatus: String(record(input.restrictedMetadata)?.status ?? record(input.restrictedMetadata)?.state ?? "none"),
      graphRelationshipCount: input.graph.relationshipCount,
      changedSinceCursor: stateMachine.changedSinceCursor,
      waitingFor: stateMachine.waitReasons.map((reason) => reason.message)
    },
    sourceCoverageGaps: uniqueStrings(sourceGaps),
    sourceActivation: {
      dryRun: sourceActivation?.dryRun === true,
      willMutate: sourceActivation?.willMutate === true,
      willStartCrawling: sourceActivation?.willStartCrawling === true,
      recommendations: input.compatibility.sources.recommendations
    },
    graphStixReadiness: {
      ...(record(contract.graphStixReadiness) ?? {}),
      exportGate: input.graph.exportGate,
      proofRoute: "/v1/exports/stix"
    },
    publicChannel: input.publicChannelSummary,
    publicChannelPromotion: {
      status: String(record(input.publicChannelPromotionCanary)?.status ?? "unknown"),
      sourceHealth: Array.isArray(record(input.publicChannelPromotionCanary)?.sourceHealth) ? record(input.publicChannelPromotionCanary)?.sourceHealth : [],
      answerCaveats: stringArray(record(record(input.publicChannelPromotionCanary)?.handoffs)?.agent07PublicAnswer && record(record(record(input.publicChannelPromotionCanary)?.handoffs)?.agent07PublicAnswer)?.caveatCodes),
      rcGate: record(record(input.publicChannelPromotionCanary)?.handoffs)?.agent10RcGate
    },
    publicChannelCertification: {
      status: String(record(input.publicChannelPromotionCertification)?.status ?? "unknown"),
      summary: record(record(input.publicChannelPromotionCertification)?.summary) ?? {},
      answerStateMachine: record(record(input.publicChannelPromotionCertification)?.handoffs)?.agent07AnswerStateMachine,
      graphCertification: record(record(input.publicChannelPromotionCertification)?.handoffs)?.agent08GraphCertification,
      rcGate: record(record(input.publicChannelPromotionCertification)?.handoffs)?.agent10RcGate
    },
    sla: {
      releaseState: input.sla.releaseState,
      answerReadiness: input.sla.answerReadiness,
      polling: input.sla.polling
    }
  };
}

function publicTiAnswerPollSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 3;
  return Math.min(3, Math.max(1, Math.floor(value)));
}

const publicTiAnswerUxSemantics = (input: {
  contract: Record<string, unknown>;
  answer: Record<string, unknown>;
  stateMachine: ReturnType<typeof publicTiAnswerPollingStateMachine>;
  releaseCandidate: ReturnType<typeof publicTiAnswerReleaseCandidate>;
  compatibility: ReturnType<typeof liveSearchCompatibilityFields>;
  actorProfile: ReturnType<typeof actorProfileForQuery>;
  scheduler: ReturnType<typeof schedulerSummaryForPlan>;
  sourceCoverageGaps: string[];
}) => {
  const evidenceRefs = arrayRecords(input.contract.evidenceLedgerReferences);
  const evidenceStageCounts = record(record(input.contract.sources)?.evidenceStageCounts) ?? record(input.actorProfile.datasets?.evidenceStageCounts) ?? {};
  const sourceSupported = evidenceRefs.length > 0 || Object.entries(evidenceStageCounts)
    .some(([stage, value]) => stage !== "seeded" && typeof value === "number" && value > 0);
  const isSearchingOnly = !sourceSupported && input.stateMachine.safeNoResult.noResult && !["blocked", "error"].includes(input.stateMachine.state);
  const state = isSearchingOnly
    ? "searching"
    : input.scheduler.backpressureState === "deferred_by_queue_pressure" || input.stateMachine.holds.schedulerPressure.active
      ? "queue_pressure"
    : input.releaseCandidate.state === "provider_unavailable"
      ? "provider_unavailable"
      : input.releaseCandidate.state === "scraper_unavailable"
        ? "scraper_unavailable"
        : input.releaseCandidate.state === "policy_blocked"
          ? "policy_blocked"
          : input.stateMachine.state === "blocked"
            ? "restricted_held"
            : input.releaseCandidate.state;
  const updatedAt = nowIso();
  const recentActivity = record(input.actorProfile.recentActivity) ?? {};
  const lastSeenAt = typeof recentActivity.lastSeen === "string" && sourceSupported ? recentActivity.lastSeen : undefined;
  const compactSummary = isSearchingOnly
    ? ["Searching"]
    : compactPublicSummary(input.contract, input.actorProfile, input.releaseCandidate.visibleAnswer.canRenderFacts);
  return {
    schemaVersion: "ti.public_answer_ux.v1",
    state,
    compactAnswerCopy: {
      heading: isSearchingOnly ? "Searching" : String(input.contract.query ?? input.actorProfile.actor),
      summary: compactSummary,
      statusLine: publicUxStatusLine(state, sourceSupported),
      caveats: isSearchingOnly ? [] : arrayRecords(input.contract.caveats).map((caveat) => String(caveat.message ?? caveat.code ?? "")).filter(Boolean).slice(0, 3)
    },
    freshness: {
      updatedAt,
      updatedLabel: "Updated",
      lastSeenAt,
      lastSeenLabel: "Last seen",
      showLastSeen: Boolean(lastSeenAt),
      semantics: "updated is the API response time; lastSeen is shown only when evidence supplies an observed timestamp",
      noLastSeenFiction: !lastSeenAt
    },
    polling: {
      intervalSeconds: 3,
      nextPollAfterSeconds: 3,
      nextPollAt: new Date(Date.now() + 3_000).toISOString(),
      cursorRequired: true,
      hint: "poll_after_3_seconds"
    },
    sourceCaveats: uniqueStrings([
      ...input.sourceCoverageGaps,
      ...input.stateMachine.caveats.map((caveat) => caveat.code),
      ...input.stateMachine.waitReasons.map((reason) => reason.code)
    ]).slice(0, 8),
    evidenceStageLabels: Object.fromEntries(Object.entries(evidenceStageCounts)
      .filter(([, count]) => typeof count === "number" && count > 0)
      .map(([stage, count]) => [stage, { label: evidenceStageLabel(stage), count }])),
    forbiddenCopy: ["not in local cache", "local cache", "demo", "default APT29", "last seen unknown"],
    publicWrapperCompatibility: {
      canonicalMethod: "POST",
      canonicalPath: "/api/ti/search",
      noDefaultQuery: true,
      compactCopyField: "publicTiAnswer.ux.compactAnswerCopy",
      pollingField: "publicTiAnswer.ux.polling"
    }
  };
};

function compactPublicSummary(contract: Record<string, unknown>, actorProfile: ReturnType<typeof actorProfileForQuery>, canRenderFacts: boolean): string[] {
  const summary = stringArray(contract.safeSummary).length > 0 ? stringArray(contract.safeSummary) : actorProfile.summary;
  return summary
    .map((line) => line
      .replace(/^This is a partial intelligence answer;?\s*/i, "")
      .replace(/^live snippets and unreviewed claims are not treated as confirmed facts\.?\s*/i, "")
      .replace(/^No durable evidence is available.*$/i, "Searching")
      .replace(/\bnot in local cache\b/gi, "Searching")
      .replace(/\blocal cache\b/gi, "current evidence")
      .replace(/\bdemo\b/gi, "preview")
      .trim())
    .filter(Boolean)
    .filter((line, index, lines) => line !== "Searching" || lines.length === 1 || index === 0)
    .map((line) => canRenderFacts ? line : line.replace(/\bconfirmed\b/gi, "reported"))
    .slice(0, 3);
}

function publicUxStatusLine(state: string, sourceSupported: boolean): string {
  if (state === "searching") return "Searching";
  if (state === "ready" || state === "canary_ready") return "Ready";
  if (state === "provider_unavailable") return "Provider unavailable";
  if (state === "scraper_unavailable") return "Scraper unavailable";
  if (state === "queue_pressure") return "Searching; queue pressure";
  if (state === "policy_blocked" || state === "restricted_held") return "Held by policy";
  if (state === "review_required") return "Needs review";
  if (state === "stale") return "Stale evidence";
  if (state === "contradicted") return "Contradicted reporting";
  if (state === "source_biased") return "Source caveat";
  return sourceSupported ? "Partial" : "Searching";
}

function evidenceStageLabel(stage: string): string {
  return ({
    seeded: "Seeded context",
    live_discovery: "Live discovery",
    captured_page: "Captured page",
    public_channel_message: "Public channel",
    metadata_only_claim: "Metadata-only restricted source",
    extracted_relationship: "Extracted relationship",
    reviewed_promoted: "Reviewed evidence"
  } as Record<string, string>)[stage] ?? stage;
}

function publicTiAnswerReleaseCandidate(input: {
  contract: Record<string, unknown>;
  answer: Record<string, unknown>;
  stateMachine: ReturnType<typeof publicTiAnswerPollingStateMachine>;
  compatibility: ReturnType<typeof liveSearchCompatibilityFields>;
  sourceCoverageGaps: string[];
  sourceActivation: Record<string, unknown> | undefined;
  scheduler: ReturnType<typeof schedulerSummaryForPlan>;
  publicChannelStatus: string;
  publicChannelSummary: unknown;
  publicChannelPromotionCanary?: unknown;
  restrictedMetadata: unknown;
  graph: ReturnType<typeof graphReviewSummaryForQuery>;
  sla: ReturnType<typeof searchSlaSummary>;
}) {
  const restricted = record(input.restrictedMetadata);
  const publicChannelPromotionCanary = record(input.publicChannelPromotionCanary);
  const promotionSummary = record(publicChannelPromotionCanary?.summary);
  const promotionHandoffs = record(publicChannelPromotionCanary?.handoffs);
  const agent10CanaryGate = record(promotionHandoffs?.agent10RcGate);
  const warningCodes = uniqueStrings([...stringArray(input.answer.warningCodes), ...input.compatibility.warningCodes]);
  const restrictedStatus = String(restricted?.status ?? restricted?.state ?? "none");
  const policyBlocked = warningCodes.includes("policy_blocked")
    || restrictedStatus === "blocked"
    || restricted?.killSwitchActive === true
    || restricted?.disabled === true;
  const providerUnavailable = warningCodes.includes("provider_unavailable");
  const scraperUnavailable = warningCodes.includes("scraper_unavailable");
  const canaryStatus = String(publicChannelPromotionCanary?.status ?? "unknown");
  const canaryRollbackCount = typeof promotionSummary?.rollbackTriggerCount === "number" ? promotionSummary.rollbackTriggerCount : 0;
  const canaryWarnings = uniqueStrings([
    ...stringArray(agent10CanaryGate?.reasons),
    ...arrayRecords(publicChannelPromotionCanary?.sourceHealth).flatMap((source) => stringArray(source.rollbackTriggers))
  ]);
  const releaseState = policyBlocked
    ? "policy_blocked"
    : scraperUnavailable
      ? "scraper_unavailable"
      : providerUnavailable
        ? "provider_unavailable"
        : input.stateMachine.state === "no_result"
          ? "no_result"
          : input.stateMachine.state === "contradicted"
            ? "contradicted"
            : input.stateMachine.state === "stale"
              ? "stale"
              : input.stateMachine.state === "source_biased"
                ? "source_biased"
                : input.stateMachine.state === "blocked" || input.sla.releaseState === "blocked"
                  ? "blocked"
                  : input.stateMachine.state === "review_required"
                    ? "review_required"
                    : input.stateMachine.state === "ready" && (canaryStatus === "pass" || agent10CanaryGate?.status === "pass") && canaryRollbackCount === 0
                      ? "canary_ready"
                      : input.stateMachine.state === "ready" && (canaryStatus !== "unknown" || canaryRollbackCount > 0 || canaryWarnings.length > 0)
                        ? "canary_with_warnings"
                        : input.stateMachine.state === "ready"
                          ? "ready"
                          : "partial";
  const blockingStates = ["blocked", "policy_blocked", "provider_unavailable", "scraper_unavailable"];
  const reviewStates = ["review_required", "stale", "contradicted", "source_biased", "canary_with_warnings"];
  const canRenderFacts = releaseState === "ready" || releaseState === "canary_ready";
  const safeSummaryMode = canRenderFacts
    ? "release_ready"
    : releaseState === "no_result"
      ? "safe_empty"
      : blockingStates.includes(releaseState)
      ? "fail_closed"
      : "partial_with_caveats";
  const claimLedgerEnforcement = record(input.sla.claimLedger.enforcement);
  const gateInputs = [
    releaseGate("sourceCanary", input.sla.sourceActivation.status, input.sourceCoverageGaps.length > 0 ? "source_activation_gaps_visible" : "source_canary_ready", input.sourceCoverageGaps, [], "/v1/sources/coverage-closeout"),
    releaseGate("schedulerControlPlane", input.scheduler.runtimeSla.state, input.scheduler.runtimeSla.apiPollingImpact, input.scheduler.deferredReasons, input.scheduler.runtimeSla.breached, "/v1/frontier/status"),
    releaseGate("publicChannelPromotion", canaryStatus, canaryRollbackCount > 0 ? "canary_rollback_watch" : "public_channel_promotion_ready", canaryWarnings, stringArray(agent10CanaryGate?.blockers), "/v1/public-channels/status"),
    releaseGate("restrictedEmergencyStop", restrictedStatus, policyBlocked ? "restricted_metadata_blocks_public_answer" : "metadata_only_safe_output", stringArray(restricted?.warnings), stringArray(restricted?.blockers), "/v1/restricted-metadata/status"),
    releaseGate("evidenceCutover", input.sla.claimLedger.trustGate, input.sla.claimLedger.safeOutput ? "safe_claim_output" : "claim_ledger_review_required", stringArray(claimLedgerEnforcement?.warnings), stringArray(claimLedgerEnforcement?.holds), "/v1/evidence/claim-ledger"),
    releaseGate("graphExport", input.graph.exportGate.state, input.graph.exportGate.publicFactPolicy, stringArray(input.graph.exportGate.answerCaveats), input.graph.exportGate.heldRelationshipCount > 0 ? ["graph_relationships_held"] : [], "/v1/exports/stix"),
    releaseGate("apiContractState", input.sla.releaseState, "public_post_compatibility_preserved", input.sla.warningCodes, [], "/v1/contracts")
  ];
  const holds = uniqueStrings([
    ...gateInputs.flatMap((gate) => gate.blockers),
    ...input.stateMachine.holds.evidenceLedgerHolds,
    ...(blockingStates.includes(releaseState) ? [`release_candidate_${releaseState}`] : [])
  ]);
  const warnings = uniqueStrings([
    ...warningCodes,
    ...gateInputs.flatMap((gate) => gate.warnings),
    ...(reviewStates.includes(releaseState) ? [`release_candidate_${releaseState}`] : [])
  ]);
  const agent10Status = holds.length > 0
    ? "blocker"
    : warnings.length > 0 || releaseState === "canary_with_warnings"
      ? "warning"
      : "pass";
  const agent10Decision = agent10Status === "blocker"
    ? "hold"
    : releaseState === "canary_ready" || releaseState === "canary_with_warnings"
      ? "canary"
      : canRenderFacts
        ? "promote"
        : "hold";
  return {
    schemaVersion: "ti.public_answer_release_candidate.v1",
    state: releaseState,
    label: releaseCandidateLabel(releaseState),
    visibleAnswer: {
      displayState: canRenderFacts ? "ready" : blockingStates.includes(releaseState) ? "blocked" : releaseState === "review_required" ? "review_required" : "partial",
      canRenderFacts,
      safeSummaryMode,
      safeNoResultWording: input.stateMachine.safeNoResult,
      caveatRequired: !canRenderFacts,
      confidenceLabel: input.stateMachine.confidenceLabel
    },
    releaseGates: gateInputs,
    effects: {
      sourceCanary: gateEffect(gateInputs[0]),
      schedulerControlPlane: gateEffect(gateInputs[1]),
      publicChannelPromotion: gateEffect(gateInputs[2]),
      restrictedEmergencyStop: gateEffect(gateInputs[3]),
      evidenceCutover: gateEffect(gateInputs[4]),
      graphExport: gateEffect(gateInputs[5]),
      apiContractState: gateEffect(gateInputs[6])
    },
    agent10RcGate: {
      status: agent10Status,
      decision: agent10Decision,
      reasons: uniqueStrings([...holds, ...warnings]).slice(0, 12),
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      proofCommands: [
        "bun test",
        "bun run check",
        "bun run check:route-inventory",
        "bun run check:search-quality-mounted",
        "bun run check:scraper-native-search"
      ]
    },
    publicPostCompatibility: {
      canonicalMethod: "POST",
      canonicalPath: "/api/ti/search",
      mapsTo: "/v1/intel/search",
      stableFieldsPreserved: true,
      cursorRequired: true,
      noLeakDto: true
    },
    uiFields: [
      "state",
      "label",
      "visibleAnswer",
      "releaseGates",
      "effects",
      "agent10RcGate",
      "publicPostCompatibility",
      "fixtures"
    ],
    fixtures: publicAnswerReleaseCandidateFixtureMatrix()
  };
}

function releaseGate(name: string, state: unknown, visibleAnswerEffect: unknown, warnings: string[], blockers: string[], proofRoute: string) {
  const normalizedState = String(state ?? "unknown");
  const normalizedBlockers = uniqueStrings(blockers);
  return {
    name,
    state: normalizedState,
    visibleAnswerEffect: String(visibleAnswerEffect ?? "unknown"),
    hold: normalizedBlockers.length > 0 || ["blocked", "blocker", "breach", "hold", "fail"].includes(normalizedState),
    warnings: uniqueStrings(warnings),
    blockers: normalizedBlockers,
    proofRoute
  };
}

function gateEffect(gate: ReturnType<typeof releaseGate>) {
  return {
    state: gate.state,
    effect: gate.visibleAnswerEffect,
    hold: gate.hold,
    proofRoute: gate.proofRoute
  };
}

function releaseCandidateLabel(state: string): string {
  return ({
    ready: "Ready",
    canary_ready: "Canary ready",
    canary_with_warnings: "Canary with warnings",
    partial: "Partial",
    review_required: "Review required",
    blocked: "Blocked",
    no_result: "No durable result yet",
    stale: "Stale",
    contradicted: "Contradicted",
    source_biased: "Source-biased",
    provider_unavailable: "Provider unavailable",
    scraper_unavailable: "Scraper unavailable",
    policy_blocked: "Policy blocked"
  } as Record<string, string>)[state] ?? "Partial";
}

function publicAnswerReleaseCandidateFixtureMatrix() {
  const scenarios = [
    ["ready", "APT29", "actor"],
    ["canary_ready", "Volt Typhoon", "actor"],
    ["canary_with_warnings", "Scattered Spider", "actor"],
    ["partial", "Akira", "ransomware"],
    ["review_required", "Turla", "actor"],
    ["blocked", "Crimson Quartz", "random_actor"],
    ["no_result", "Unseen Quartz Actor", "random_actor"],
    ["stale", "CVE-2026-11111", "cve"],
    ["contradicted", "Snake", "malware_tool"],
    ["source_biased", "Norway", "country"],
    ["provider_unavailable", "energy", "sector"],
    ["scraper_unavailable", "Fjord Energy AS", "victim"],
    ["policy_blocked", "restricted leak metadata", "victim"]
  ];
  return scenarios.map(([state, query, queryClass]) => ({
    state,
    query,
    queryClass,
    expectedDisplayState: state === "ready" || state === "canary_ready"
      ? "ready"
      : state === "blocked" || state === "policy_blocked" || state === "provider_unavailable" || state === "scraper_unavailable"
        ? "blocked"
        : state === "review_required"
          ? "review_required"
          : "partial",
    publicPostCompatible: true,
    safeWording: state === "no_result" ? "safe_empty" : state === "ready" || state === "canary_ready" ? "release_ready" : "partial_with_caveats",
    agent10RcGate: state === "ready" || state === "canary_ready" ? "pass" : state === "canary_with_warnings" ? "warning" : "blocker"
  }));
}

function publicTiAnswerPollingStateMachine(input: {
  contract: Record<string, unknown>;
  answer: Record<string, unknown>;
  compatibility: ReturnType<typeof liveSearchCompatibilityFields>;
  sourceCoverageGaps: string[];
  sourceActivation: Record<string, unknown> | undefined;
  scheduler: ReturnType<typeof schedulerSummaryForPlan>;
  publicChannelStatus: string;
  publicChannelSummary: unknown;
  restrictedMetadata: unknown;
  graph: ReturnType<typeof graphReviewSummaryForQuery>;
  sla: ReturnType<typeof searchSlaSummary>;
}) {
  const contractState = String(input.contract.state ?? "partial");
  const displayState = String(input.contract.displayState ?? "partial");
  const warningCodes = uniqueStrings([
    ...stringArray(input.answer.warningCodes),
    ...input.compatibility.warningCodes
  ]);
  const waitReasons = arrayRecords(input.contract.waitReasons).map((reason) => ({
    code: String(reason.code ?? "capture_promotion"),
    message: String(reason.message ?? "Live collection is still waiting for durable evidence."),
    evidenceIds: stringArray(reason.evidenceIds),
    claimKinds: stringArray(reason.claimKinds)
  }));
  const deltas = arrayRecords(input.contract.deltas);
  const evidenceRefs = arrayRecords(input.contract.evidenceLedgerReferences);
  const restricted = record(input.restrictedMetadata);
  const claimLedger = record(input.sla.claimLedger);
  const graphState = String(input.graph.exportGate.state ?? record(input.contract.graphStixReadiness)?.state ?? "unknown");
  const restrictedStatus = String(restricted?.status ?? restricted?.state ?? "none");
  const schedulerPressure = input.scheduler.runtimeSla.state === "watch" || input.scheduler.runtimeSla.state === "breach" || input.scheduler.backpressureState === "deferred_by_queue_pressure";
  const sourceActivationGapCount = uniqueStrings(input.sourceCoverageGaps).length;
  const errorLike = warningCodes.some((code) => code === "provider_unavailable" || code === "scraper_unavailable");
  const noResult = input.contract.noResult === true || evidenceRefs.length === 0;
  const state = errorLike
    ? "error"
    : displayState === "blocked" || restrictedStatus === "blocked" || input.sla.releaseState === "blocked"
      ? "blocked"
      : contractState === "contradicted"
        ? "contradicted"
        : contractState === "stale"
          ? "stale"
          : contractState === "source_biased"
            ? "source_biased"
            : displayState === "ready"
              ? "ready"
              : displayState === "review_required"
                ? "review_required"
                : deltas.some((delta) => delta.kind === "promoted") || input.scheduler.promotedEvidenceCount > 0
                  ? "promoted_evidence"
                  : evidenceRefs.length > 0
                    ? "live_partial"
                    : noResult
                      ? "no_result"
                      : input.scheduler.queuedTaskCount > 0
                        ? "queued_collection"
                        : "first_response";
  const phase = state === "ready" || state === "blocked" || state === "error"
    ? state
    : input.scheduler.cursorContinuity === "not_started"
      ? "first_response"
      : input.scheduler.queuedTaskCount > 0 && evidenceRefs.length === 0
        ? "queued_collection"
        : state;
  const nextPollAfterSeconds = Number(record(input.contract.nextPoll)?.nextPollAfterSeconds ?? input.compatibility.nextPollSeconds);
  const changed = deltas.map((delta) => ({
    kind: String(delta.kind ?? "new"),
    pollReason: String(delta.pollReason ?? "new_evidence"),
    claimKind: String(delta.claimKind ?? "actor"),
    value: String(delta.value ?? ""),
    evidenceIds: stringArray(delta.evidenceIds),
    ledgerIds: stringArray(delta.ledgerIds)
  }));
  const sourceGaps = uniqueStrings(input.sourceCoverageGaps);
  const graphHold = graphState === "hold" || graphState === "rollback" || input.graph.exportGate.heldRelationshipCount > 0;
  const evidenceLedgerHolds = uniqueStrings([
    ...stringArray(claimLedger?.blockers),
    ...arrayRecords(record(claimLedger?.enforcement)?.repairPackets).map((packet) => String(packet.reason ?? packet.action ?? "")).filter(Boolean)
  ]);
  return {
    schemaVersion: "ti.public_answer_polling_state.v1",
    state,
    phase,
    terminal: ["ready", "blocked", "error"].includes(state),
    retryable: !["ready", "blocked"].includes(state),
    safeToRenderFacts: state === "ready",
    confidenceLabel: String(record(input.contract.confidence)?.label ?? "unknown"),
    caveats: arrayRecords(input.contract.caveats).map((caveat) => ({
      code: String(caveat.code ?? "unknown"),
      severity: String(caveat.severity ?? "warning"),
      message: String(caveat.message ?? "")
    })),
    waitReasons,
    safeNoResult: {
      noResult,
      wording: noResult ? "Searching" : "",
      overstatesAbsence: false
    },
    progress: {
      firstResponse: input.scheduler.cursorContinuity === "not_started",
      queuedCollection: input.scheduler.queuedTaskCount > 0,
      livePartial: evidenceRefs.length > 0 && state !== "ready",
      promotedEvidence: changed.some((delta) => delta.kind === "promoted") || input.scheduler.promotedEvidenceCount > 0,
      reviewRequired: state === "review_required",
      blocked: state === "blocked",
      noResult,
      stale: state === "stale",
      contradicted: state === "contradicted",
      sourceBiased: state === "source_biased",
      ready: state === "ready",
      error: state === "error"
    },
    changedSinceCursor: {
      cursor: input.compatibility.cursor,
      nextCursor: input.compatibility.nextCursor,
      cursorContinuity: input.scheduler.cursorContinuity,
      newDeltaCount: input.scheduler.newEvidenceDeltaCount + changed.length,
      promotedEvidenceCount: input.scheduler.promotedEvidenceCount + changed.filter((delta) => delta.kind === "promoted").length,
      changed
    },
    polling: {
      nextPollAfterSeconds,
      nextPollAt: input.scheduler.nextPollAt,
      cursor: input.compatibility.cursor,
      nextCursor: input.compatibility.nextCursor,
      pollReason: pollingReasonForState(state, schedulerPressure, sourceGaps.length),
      cursorRequired: true
    },
    holds: {
      sourceActivationGaps: sourceGaps,
      schedulerPressure: {
        active: schedulerPressure,
        state: input.scheduler.runtimeSla.state,
        backpressureState: input.scheduler.backpressureState,
        reasons: uniqueStrings([...input.scheduler.deferredReasons, ...input.scheduler.partialReasons])
      },
      publicChannelCanaryImpact: {
        status: input.publicChannelStatus,
        canaryActive: Boolean(record(input.publicChannelSummary)?.canaryRollout),
        impact: input.publicChannelStatus === "partial" ? "keeps_answer_partial_until_correlated" : "none"
      },
      restrictedMetadataBlocked: {
        blocked: restrictedStatus === "blocked" || restrictedStatus === "disabled",
        status: restrictedStatus,
        reasons: uniqueStrings([...stringArray(restricted?.blockers), ...stringArray(restricted?.warnings)])
      },
      evidenceLedgerHolds,
      graphStixHolds: {
        hold: graphHold,
        state: graphState,
        reasons: stringArray(input.graph.exportGate.answerCaveats)
      }
    },
    uiFields: [
      "state",
      "phase",
      "progress",
      "changedSinceCursor",
      "polling",
      "holds",
      "confidenceLabel",
      "caveats",
      "waitReasons",
      "safeNoResult"
    ]
  };
}

function pollingReasonForState(state: string, schedulerPressure: boolean, sourceGapCount: number): string {
  if (state === "ready") return "ready_refresh";
  if (state === "blocked") return "blocked_review";
  if (state === "error") return "provider_retry";
  if (schedulerPressure) return "scheduler_capacity";
  if (sourceGapCount > 0) return "source_activation_gap";
  if (state === "review_required") return "analyst_review";
  if (state === "stale") return "fresh_evidence";
  if (state === "contradicted") return "contradiction_resolution";
  return "live_collection";
}

function arrayRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.map(record).filter((item): item is Record<string, unknown> => Boolean(item)) : [];
}

function fallbackPublicTiAnswerContract(
  actorProfile: ReturnType<typeof actorProfileForQuery>,
  compatibility: ReturnType<typeof liveSearchCompatibilityFields>
) {
  return {
    schemaVersion: "ti.public_answer_contract.v1",
    query: actorProfile.actor,
    queryClass: "unknown",
    state: "partial",
    status: "partial",
    displayState: "partial",
    noResult: true,
    safeSummary: Array.isArray(actorProfile.summary) ? actorProfile.summary : compatibility.summary,
    confidence: {
      score: actorProfile.confidence,
      label: "unknown",
      sourceFamilyCount: 0,
      ledgerBackedClaimCount: 0
    },
    recentAttacks: [],
    targets: actorProfile.targets,
    ttps: actorProfile.ttps,
    datasets: [],
    sources: {
      sourceCount: 0,
      evidenceStageCounts: {},
      evidenceIds: actorProfile.evidenceIds,
      ledgerIds: []
    },
    caveats: [],
    waitReasons: [{
      code: "capture_promotion",
      message: `No durable evidence is available for ${actorProfile.actor}; waiting for capture or reviewed evidence.`,
      evidenceIds: [],
      claimKinds: []
    }],
    nextPoll: {
      pollable: true,
      nextPollAfterSeconds: compatibility.nextPollSeconds,
      cursorRequired: true,
      deltaCount: 0
    },
    evidenceLedgerReferences: [],
    graphStixReadiness: {
      state: "unknown",
      reasons: ["no graph-backed evidence yet"],
      readyForDefaultExport: false
    },
    deltas: [],
    safeWording: {
      overstatesLiveSnippets: false,
      rawEvidenceExposed: false,
      restrictedPayloadsExposed: false,
      guidance: ["Use partial/no-result wording until durable evidence is available."]
    }
  };
}

function withRunSchedulingMetadata(plan: CollectionPlan, run: CollectionRun, idempotencyKey: string | undefined): CollectionPlan {
  const stampTask = (task: CollectionTask): CollectionTask => ({
    ...task,
    runId: run.id,
    planning: task.planning
      ? {
          ...task.planning,
          idempotencyKey,
          maxCost: task.planning.maxCost ?? { tasks: 1, bytes: task.maxBytes ?? plan.budget?.maxBytesPerTask ?? 0 }
        }
      : task.planning
  });
  return {
    ...plan,
    tasks: plan.tasks.map(stampTask),
    reviewRequired: plan.reviewRequired.map(stampTask)
  };
}

function schedulerSummaryForPlan(input: {
  plan: CollectionPlan;
  run?: CollectionRun;
  planner?: LiveSearchPlannerDto;
  frontier: FocusedFrontier;
  options?: ApiServerOptions;
  sinceCursor?: string;
  partialResultCount: number;
}) {
  const now = new Date();
  const queryTasks = [...input.frontier.snapshot(), ...input.frontier.leasedSnapshot()].filter((task) =>
    task.runId === input.run?.id || task.intelRequestId === input.plan.request.id
  );
  const queueAges = queryTasks.map((task) => Math.max(0, Math.floor((now.getTime() - Date.parse(task.queuedAt)) / 1000)));
  const decisions = input.plan.explanations ?? [];
  const selected = decisions.filter((decision) => decision.status === "selected").length;
  const deferred = decisions.filter((decision) => decision.status === "delayed" || decision.status === "waiting-for-backoff").map((decision) => decision.reason);
  const blocked = decisions.filter((decision) => decision.status === "blocked-by-policy" || decision.status === "blocked-by-approval").map((decision) => decision.reason);
  const skipped = decisions.filter((decision) => decision.status === "skipped" || decision.status === "duplicate-suppressed").map((decision) => decision.reason);
  const backpressureState = input.planner?.backpressureState ?? pressureStateForSummary(input.frontier, queryTasks);
  const leasedSet = new Set(input.frontier.leasedSnapshot().map((task) => task.id));
  const backpressure = schedulerBackpressureSummaryForTasks({
    queued: queryTasks.filter((task) => !leasedSet.has(task.id)),
    leased: queryTasks.filter((task) => leasedSet.has(task.id)),
    deadLetters: input.frontier.deadLetterSnapshot(),
    runs: input.options?.store.listRuns(),
    now
  });
  const queueEconomics = buildSchedulerQueueEconomics({
    queued: queryTasks.filter((task) => !leasedSet.has(task.id)),
    leased: queryTasks.filter((task) => leasedSet.has(task.id)),
    deadLetters: input.frontier.deadLetterSnapshot(),
    now
  });
  const runtimeExecution = buildSchedulerRuntimeExecution({
    queued: queryTasks.filter((task) => !leasedSet.has(task.id)),
    leased: queryTasks.filter((task) => leasedSet.has(task.id)),
    deadLetters: input.frontier.deadLetterSnapshot(),
    sinceCursor: input.sinceCursor,
    queueEconomics,
    approvedRestrictedMetadata: input.plan.tasks.every((task) => !task.sourceType.endsWith("_metadata") || task.planning?.safetyEnvelope?.metadataOnlyRestricted === true),
    pendingActivationBatchCount: 0,
    now
  });
  const runtimeSla = buildSchedulerRuntimeSla({
    queueEconomics,
    runtimeExecution,
    runs: input.options?.store.listRuns(),
    now
  });
  const slaEnforcement = buildSchedulerSlaEnforcement({
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    runs: input.options?.store.listRuns(),
    now
  });
  const workerQueueCutover = buildSchedulerWorkerQueueCutover({
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    slaEnforcement,
    now
  });
  const workerSoakMigration = buildSchedulerWorkerSoakMigration({
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    slaEnforcement,
    workerQueueCutover,
    now
  });
  const productionAdapterTelemetry = buildSchedulerProductionAdapterTelemetry({
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    slaEnforcement,
    workerQueueCutover,
    workerSoakMigration,
    now
  });
  const canaryControlPlane = buildSchedulerCanaryControlPlane({
    productionAdapterTelemetry,
    queueEconomics,
    slaEnforcement,
    workerQueueCutover,
    workerSoakMigration,
    now
  });
  const analystLoop = buildTiAnalystLoopSummary({
    plan: input.plan,
    run: input.run,
    queuedTaskCount: queryTasks.filter((task) => !leasedSet.has(task.id)).length,
    reviewTaskCount: input.plan.reviewRequired.length,
    rejectedSourceCount: input.run?.rejectedSourceCount ?? input.plan.rejected.length,
    blockedReasons: blocked,
    deferredReasons: deferred,
    skippedReasons: skipped,
    captures: input.options?.store.listCaptures() ?? []
  });
  const persistedAnalystLoop = input.options?.store
    ? persistTiAnalystLoopSummary(input.options.store, input.plan, input.run, analystLoop)
    : undefined;
  const poll = pollingSummaryForPlan({
    plan: input.plan,
    run: input.run,
    options: input.options,
    sinceCursor: input.sinceCursor,
    nextPollSeconds: input.planner?.nextPollSeconds ?? (backpressureState === "deferred_by_queue_pressure" ? 30 : 5),
    partialResultCount: input.partialResultCount,
    blockedReasons: blocked,
    deferredReasons: deferred,
    skippedReasons: skipped
  });
  return {
    query: input.plan.request.query,
    tenantId: input.plan.tenantId,
    runId: input.run?.id,
    runStatus: input.run?.status,
    reuseKey: input.planner?.reuseKey,
    attachedToActiveRun: input.planner?.attachedToActiveRun ?? false,
    backpressureState,
    queueAgeSeconds: {
      max: queueAges.length ? Math.max(...queueAges) : 0,
      p95: percentile(queueAges, 0.95)
    },
    selectedTaskCount: selected,
    queuedTaskCount: queryTasks.filter((task) => !input.frontier.leasedSnapshot().some((leased) => leased.id === task.id)).length,
    leasedTaskCount: queryTasks.filter((task) => input.frontier.leasedSnapshot().some((leased) => leased.id === task.id)).length,
    reviewTaskCount: input.plan.reviewRequired.length,
    skippedReasons: uniqueStrings(skipped).slice(0, 8),
    deferredReasons: uniqueStrings(deferred).slice(0, 8),
    blockedReasons: uniqueStrings(blocked).slice(0, 8),
    nextPollSeconds: poll.nextPollSeconds,
    nextPollAt: poll.nextPollAt,
    cursorContinuity: poll.cursorContinuity,
    latestCursor: poll.latestCursor,
    promotedEvidenceCount: poll.promotedEvidenceCount,
    newEvidenceDeltaCount: poll.newEvidenceDeltaCount,
    partialReasons: poll.partialReasons,
    partialResultReadiness: input.partialResultCount > 0
      ? "ready"
      : blocked.length > 0 && selected === 0
        ? "blocked"
        : deferred.length > 0 && selected === 0
          ? "deferred"
          : "pending",
    partialResultCount: input.partialResultCount,
    safetyEnvelope: aggregateSafetyEnvelope(input.plan.tasks),
    backpressure,
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    slaEnforcement,
    workerQueueCutover,
    workerSoakMigration,
    productionAdapterTelemetry,
    canaryControlPlane,
    analystLoop: persistedAnalystLoop ? {
      ...analystLoop,
      persistence: {
        ...analystLoop.persistence,
        currentBackend: "in_memory_repository",
        durable: false,
        persisted: {
          reviewTaskIds: persistedAnalystLoop.reviewTaskIds,
          activationPacketIds: persistedAnalystLoop.activationPacketIds,
          victimNotificationPacketId: persistedAnalystLoop.victimNotificationPacketId,
          claimLedgerEntryIds: persistedAnalystLoop.claimLedgerEntryIds,
          snapshotId: persistedAnalystLoop.snapshotId
        }
      }
    } : analystLoop,
    emergencyBrakeState: input.frontier.groupedSnapshot().queued >= 1_000 ? "armed" : "clear"
  };
}

type TiAnalystLoopState = "queued" | "metadata_review" | "blocked_unsafe_target" | "needs_source_activation" | "ready";
type TiAnalystLoopNextStep = {
  state: TiAnalystLoopState;
  label: string;
  detail: string;
  tone: "ok" | "watch" | "bad";
};
type TiAnalystReviewItem =
  | ReturnType<typeof metadataReviewItemFromTask>
  | NonNullable<ReturnType<typeof metadataReviewItemFromCapture>>;

function buildTiAnalystLoopSummary(input: {
  plan: CollectionPlan;
  run?: CollectionRun;
  queuedTaskCount: number;
  reviewTaskCount: number;
  rejectedSourceCount: number;
  blockedReasons: string[];
  deferredReasons: string[];
  skippedReasons: string[];
  captures: RawCapture[];
}) {
  const allReasons = uniqueStrings([...input.blockedReasons, ...input.deferredReasons, ...input.skippedReasons]);
  const blockedUnsafeTargets = allReasons.filter((reason) => /payload|download|credential|private|captcha|interaction|unsafe/i.test(reason)).length;
  const captureReviewItems = input.captures
    .filter((capture) => capture.tenantId === input.plan.tenantId || !input.plan.tenantId)
    .map((capture) => metadataReviewItemFromCapture(capture, input.plan.request.query, input.run?.id))
    .filter((item): item is NonNullable<ReturnType<typeof metadataReviewItemFromCapture>> => Boolean(item));
  const taskReviewItems: TiAnalystReviewItem[] = input.plan.reviewRequired
    .filter((task) => task.sourceType === "tor_metadata" || task.sourceType === "i2p_metadata" || task.sourceType === "freenet_metadata")
    .map((task) => metadataReviewItemFromTask(task, input.plan.request.query, input.run?.id));
  const metadataReviewInbox = dedupeAnalystReviewItems([...captureReviewItems, ...taskReviewItems]).slice(0, 10);
  const needsActivation = allReasons.some((reason) => /activation|approval|legal|operator|restore|metadata-only review/i.test(reason))
    || input.plan.reviewRequired.some((task) => /approval|legal|operator|restore|metadata-only review/i.test(task.reason));
  const resultState: TiAnalystLoopState = metadataReviewInbox.length > 0
    ? "metadata_review"
    : blockedUnsafeTargets > 0
      ? "blocked_unsafe_target"
      : needsActivation
        ? "needs_source_activation"
        : input.queuedTaskCount > 0
          ? "queued"
          : "ready";
  const reviewTaskCount = metadataReviewInbox.length > 0 ? metadataReviewInbox.length : input.reviewTaskCount;
  const meaningfulWorkCount = input.queuedTaskCount + reviewTaskCount;
  const nextSteps: TiAnalystLoopNextStep[] = [
    ...(input.queuedTaskCount > 0 ? [{
      state: "queued" as const,
      label: "Approved collection running",
      detail: `${input.queuedTaskCount} approved safe collection task${input.queuedTaskCount === 1 ? "" : "s"} visible for this run.`,
      tone: "ok" as const
    }] : []),
    ...(metadataReviewInbox.length > 0 ? [{
      state: "metadata_review" as const,
      label: "Review leak metadata",
      detail: "Review actor/victim/account/dataset metadata and prepare notification without opening leaked payloads.",
      tone: "watch" as const
    }] : []),
    ...(blockedUnsafeTargets > 0 ? [{
      state: "blocked_unsafe_target" as const,
      label: "Unsafe target blocked",
      detail: "Raw leak downloads, credentials, private access, or interaction targets stayed blocked.",
      tone: "bad" as const
    }] : []),
    ...(needsActivation ? [{
      state: "needs_source_activation" as const,
      label: "Approval needed",
      detail: "Use dry-run source approval or restore packets before metadata-only queueing.",
      tone: "watch" as const
    }] : [])
  ];
  if (!nextSteps.length) {
    nextSteps.push({
      state: "ready" as const,
      label: "Ready",
      detail: "No review or collection work is pending for this plan.",
      tone: "ok" as const
    });
  }
  const firstReviewItem = metadataReviewInbox[0];

  return {
    resultState,
    headline: analystLoopHeadline(resultState, reviewTaskCount || meaningfulWorkCount || 1),
    nextSteps,
    runStatusClarity: {
      queuedTasks: input.queuedTaskCount,
      reviewTasks: reviewTaskCount,
      rejectedSources: input.rejectedSourceCount,
      blockedUnsafeTargets,
      meaningfulWorkCount,
      summary: `${input.queuedTaskCount} queued collection task${input.queuedTaskCount === 1 ? "" : "s"}, ${reviewTaskCount} metadata review task${reviewTaskCount === 1 ? "" : "s"}, ${blockedUnsafeTargets} unsafe target block${blockedUnsafeTargets === 1 ? "" : "s"}, ${input.rejectedSourceCount} rejected source${input.rejectedSourceCount === 1 ? "" : "s"}`
    },
    metadataReviewInbox,
    sourceActivationWorkflow: {
      required: needsActivation,
      dryRunOnly: true,
      actions: sourceActivationActionsForAnalystLoop(input.plan.reviewRequired, allReasons, input.run?.id, needsActivation, blockedUnsafeTargets)
    },
    victimNotificationPacket: firstReviewItem ? victimNotificationPacketFromReviewItem(firstReviewItem) : undefined,
    persistence: {
      currentBackend: "in_memory",
      targetBackend: "postgres",
      durable: false,
      schemaMigration: "migrations/004_analyst_loop.sql",
      schemaTables: [
        "collection_plans",
        "collection_tasks",
        "collection_runs",
        "metadata_review_tasks",
        "source_activation_packets",
        "victim_notification_packets",
        "claim_ledger_entries",
        "analyst_loop_snapshots"
      ],
      missingRuntimeRepository: ["postgres_analyst_loop_repository", "migration_runner_cutover"],
      migrationPlan: "Postgres workflow schema is defined; cut runtime from in-memory analyst-loop summaries to repository-backed plans, runs, review tasks, notifications, snapshots, and claim ledger before production promotion."
    }
  };
}

function persistTiAnalystLoopSummary(
  store: ScraperStore,
  plan: CollectionPlan,
  run: CollectionRun | undefined,
  loop: ReturnType<typeof buildTiAnalystLoopSummary>
): {
  reviewTaskIds: string[];
  activationPacketIds: string[];
  victimNotificationPacketId?: string;
  claimLedgerEntryIds: string[];
  snapshotId: string;
} {
  const now = nowIso();
  const parseReviewCount = (value: string | undefined): number | undefined => {
    if (!value) return undefined;
    const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|m|million|thousand)?/i);
    if (!match) return undefined;
    const base = Number(match[1]);
    if (!Number.isFinite(base)) return undefined;
    const suffix = match[2]?.toLowerCase();
    if (suffix === "k" || suffix === "thousand") return Math.round(base * 1_000);
    if (suffix === "m" || suffix === "million") return Math.round(base * 1_000_000);
    return Math.round(base);
  };
  const parseReviewSizeBytes = (value: string | undefined): number | undefined => {
    if (!value) return undefined;
    const match = value.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB|PB)/i);
    if (!match) return undefined;
    const base = Number(match[1]);
    if (!Number.isFinite(base)) return undefined;
    const unit = match[2].toUpperCase();
    const factor = unit === "PB" ? 1_000_000_000_000_000 : unit === "TB" ? 1_000_000_000_000 : unit === "GB" ? 1_000_000_000 : 1_000_000;
    return Math.round(base * factor);
  };
  const whatWasNotAccessed = () => [
    "restricted files",
    "sensitive account material",
    "private communities",
    "CAPTCHA or authenticated areas",
    "threat actor interaction"
  ];
  const reviewProvenance = (value: string): Record<string, unknown> => ({
    summary: value,
    unsafeMaterialAccessed: false,
    whatWasNotAccessed: whatWasNotAccessed()
  });
  const activationAction = (action: string): {
    action: AnalystSourceActivationPacket["action"];
    execution: AnalystSourceActivationPacket["execution"];
    expectedEffect: string;
    rollback: string;
  } => {
    if (action === "keep_blocked") {
      return {
        action: "keep_blocked",
        execution: "blocked",
        expectedEffect: "Keep unsafe restricted payload, credential, private-access, or interaction target blocked.",
        rollback: "No rollback; blocked target remains outside allowed collection."
      };
    }
    if (action === "enable_metadata_only_queue") {
      return {
        action: "restore_metadata_only_source",
        execution: "dry_run_only",
        expectedEffect: "Queue only metadata fields after explicit approval while raw downloads and interactions disabled.",
        rollback: "Leave source disabled or move it back to needs_review if approval is not granted."
      };
    }
    return {
      action: "request_operator_approval",
      execution: "approval_required",
      expectedEffect: "Create an approval packet before any metadata-only collection is restored.",
      rollback: "Reject or expire the approval packet; no source activation occurs from this dry run."
    };
  };
  const notificationFromLoop = (
    packet: ReturnType<typeof victimNotificationPacketFromReviewItem>,
    reviewTask: AnalystMetadataReviewTask
  ): AnalystVictimNotificationPacket => ({
    id: stableId("victim-notification", `${reviewTask.id}:${packet.sourceHash}`),
    tenantId: plan.tenantId,
    reviewTaskId: reviewTask.id,
    status: "draft",
    company: reviewTask.company ?? reviewTask.victim ?? "Unknown organization",
    victim: reviewTask.victim,
    claimSummary: packet.claimSummary,
    affectedAccounts: packet.affectedAccounts,
    datasetSize: packet.datasetSize,
    actorStatement: packet.actorStatement,
    claimedAt: packet.claimedDate,
    observedAt: reviewTask.observedAt,
    sourceHash: packet.sourceHash,
    confidence: clampScore(packet.confidence),
    provenance: reviewTask.provenance,
    redactions: ["restricted_dataset_material", "credential_material", "private_access_material", "actor_interaction"],
    whatWasNotAccessed: packet.whatWasNotAccessed,
    safeToSend: false,
    createdAt: now,
    updatedAt: now
  });
  const claimEntriesFromTask = (task: AnalystMetadataReviewTask): AnalystClaimLedgerEntry[] => {
    const base = {
      tenantId: task.tenantId,
      normalizedQuery: normalizeSearchQuery(plan.request.query),
      reviewTaskId: task.id,
      captureId: task.captureId,
      sourceId: task.sourceId,
      company: task.company,
      victim: task.victim,
      sourceHash: task.sourceHash,
      confidence: task.confidence,
      ledgerStatus: "metadata_review" as const,
      observedAt: task.observedAt,
      provenance: task.provenance,
      createdAt: now
    };
    const entries: AnalystClaimLedgerEntry[] = [];
    if (task.company || task.victim) {
      entries.push({
        ...base,
        id: stableId("claim-ledger", `${task.id}:victim:${task.company ?? task.victim}`),
        claimKind: "victim_claim",
        claimTextSummary: `${task.company ?? task.victim} was named in a metadata-only leak claim.`
      });
    }
    if (task.affectedAccounts) {
      entries.push({
        ...base,
        id: stableId("claim-ledger", `${task.id}:affected:${task.affectedAccounts}`),
        claimKind: "affected_accounts_claim",
        claimTextSummary: `${task.affectedAccounts} were claimed affected.`
      });
    }
    if (task.datasetSize) {
      entries.push({
        ...base,
        id: stableId("claim-ledger", `${task.id}:dataset:${task.datasetSize}`),
        claimKind: "dataset_size_claim",
        claimTextSummary: `${task.datasetSize} was claimed as dataset size or volume.`
      });
    }
    if (task.actorStatement) {
      entries.push({
        ...base,
        id: stableId("claim-ledger", `${task.id}:statement:${task.sourceHash}`),
        claimKind: "actor_statement_claim",
        claimTextSummary: task.actorStatement.slice(0, 500)
      });
    }
    if (!entries.length) {
      entries.push({
        ...base,
        id: stableId("claim-ledger", `${task.id}:leak`),
        claimKind: "leak_claim",
        claimTextSummary: "Metadata-only leak claim requires analyst review."
      });
    }
    return entries;
  };
  const reviewTasks = loop.metadataReviewInbox.map((item): AnalystMetadataReviewTask => ({
    id: item.id,
    tenantId: plan.tenantId,
    planId: plan.id,
    runId: run?.id,
    taskId: item.taskId || undefined,
    sourceId: item.sourceId,
    captureId: "captureId" in item ? item.captureId : undefined,
    status: item.status === "needs_review" ? "open" : "open",
    resultState: "metadata_review",
    company: item.company,
    victim: item.victim,
    affectedAccounts: item.affectedAccounts,
    affectedAccountsCount: parseReviewCount(item.affectedAccounts),
    accountSubjects: item.accountSubjects ? [item.accountSubjects] : [],
    datasetSize: item.datasetSize,
    datasetSizeBytes: parseReviewSizeBytes(item.datasetSize),
    actorStatement: item.actorStatement,
    claimedAt: item.claimedDate,
    observedAt: now,
    sourceUrl: undefined,
    sourceHash: item.sourceHash,
    provenance: reviewProvenance(item.provenance),
    allowedActions: [...item.allowedActions],
    confidence: clampScore(item.confidence),
    unsafeMaterialAccessed: false,
    whatWasNotAccessed: whatWasNotAccessed(),
    createdAt: now,
    updatedAt: now
  }));
  for (const task of reviewTasks) store.saveAnalystMetadataReviewTask(task);

  const activationPackets = loop.sourceActivationWorkflow.actions.map((action, index): AnalystSourceActivationPacket => {
    const mapped = activationAction(action.action);
    return {
      id: stableId("activation-packet", `${plan.id}:${run?.id ?? "no-run"}:${action.action}:${action.sourceId ?? "source"}:${index}`),
      tenantId: plan.tenantId,
      planId: plan.id,
      runId: run?.id,
      sourceId: action.sourceId,
      action: mapped.action,
      execution: mapped.execution,
      reason: action.reason,
      expectedEffect: mapped.expectedEffect,
      rollback: mapped.rollback,
      dryRun: true,
      createdAt: now
    };
  });
  for (const packet of activationPackets) store.saveAnalystSourceActivationPacket(packet);

  const notification = loop.victimNotificationPacket && reviewTasks[0]?.company
    ? notificationFromLoop(loop.victimNotificationPacket, reviewTasks[0])
    : undefined;
  if (notification) store.saveAnalystVictimNotificationPacket(notification);

  const claimLedgerEntries = reviewTasks.flatMap((task) => claimEntriesFromTask(task));
  for (const entry of claimLedgerEntries) store.saveAnalystClaimLedgerEntry(entry);

  const snapshot: AnalystLoopSnapshot = {
    id: stableId("analyst-loop-snapshot", `${plan.id}:${run?.id ?? "no-run"}:${now}:${loop.resultState}`),
    tenantId: plan.tenantId,
    planId: plan.id,
    runId: run?.id,
    normalizedQuery: normalizeSearchQuery(plan.request.query),
    resultState: loop.resultState,
    headline: loop.headline,
    queuedTasks: loop.runStatusClarity.queuedTasks,
    reviewTasks: loop.runStatusClarity.reviewTasks,
    rejectedSources: loop.runStatusClarity.rejectedSources,
    blockedUnsafeTargets: loop.runStatusClarity.blockedUnsafeTargets,
    meaningfulWorkCount: loop.runStatusClarity.meaningfulWorkCount,
    nextSteps: loop.nextSteps,
    reviewTaskIds: reviewTasks.map((task) => task.id),
    activationPacketIds: activationPackets.map((packet) => packet.id),
    victimNotificationPacketId: notification?.id,
    capturedAt: now
  };
  store.saveAnalystLoopSnapshot(snapshot);

  return {
    reviewTaskIds: reviewTasks.map((task) => task.id),
    activationPacketIds: activationPackets.map((packet) => packet.id),
    victimNotificationPacketId: notification?.id,
    claimLedgerEntryIds: claimLedgerEntries.map((entry) => entry.id),
    snapshotId: snapshot.id
  };
}

function metadataReviewItemFromTask(task: CollectionTask, query: string, runId: string | undefined) {
  const parsed = parseLeakClaimText(`${query} ${task.reason}`);
  return {
    id: stableId("metadata-review", `${runId ?? task.intelRequestId ?? "plan"}:${task.id}`),
    sourceId: task.sourceId,
    taskId: task.id,
    captureId: "",
    company: parsed.company,
    victim: parsed.company,
    affectedAccounts: parsed.affectedAccounts,
    accountSubjects: parsed.accountSubjects,
    datasetSize: parsed.datasetSize,
    actorStatement: parsed.actorStatement ?? task.reason,
    claimedDate: parsed.claimedDate,
    sourceHash: hashContent(`${task.sourceId}:${task.targetUrl}`),
    provenance: `review task ${task.id}; source ${task.sourceId}; run ${runId ?? "not-started"}`,
    confidence: parsed.company || parsed.affectedAccounts || parsed.datasetSize ? 0.68 : 0.5,
    status: "needs_review" as const,
    allowedActions: ["notify_company", "mark_duplicate", "request_approval", "escalate"] as const
  };
}

function metadataReviewItemFromCapture(capture: RawCapture, query: string, runId: string | undefined) {
  if (capture.storageKind !== "metadata_only") return undefined;
  const leakSite = record(capture.metadata.leakSite);
  if (!leakSite) return undefined;
  const actorStatement = String(leakSite.actorStatement ?? leakSite.description ?? capture.body ?? "").trim();
  const company = stringValue(leakSite.victimName) ?? parseLeakClaimText(`${query} ${actorStatement}`).company;
  const affectedAccounts = stringValue(leakSite.affectedAccounts);
  const datasetSize = stringValue(leakSite.datasetSize);
  if (!company && !affectedAccounts && !datasetSize && !actorStatement) return undefined;

  return {
    id: stableId("metadata-review", `${runId ?? "capture"}:${capture.id}`),
    sourceId: capture.sourceId,
    taskId: capture.taskId ?? "",
    captureId: capture.id,
    company,
    victim: company,
    affectedAccounts,
    accountSubjects: stringValue(leakSite.accountSubjects),
    datasetSize,
    actorStatement: actorStatement || undefined,
    claimedDate: stringValue(leakSite.claimDate),
    sourceHash: stringValue(leakSite.urlHash) ?? capture.contentHash,
    provenance: `metadata-only capture ${capture.id}; source ${capture.sourceId}; run ${runId ?? "not-started"}`,
    confidence: clampScore(Number(leakSite.confidence ?? 0.6)),
    status: "needs_review" as const,
    allowedActions: ["notify_company", "mark_duplicate", "request_approval", "escalate"] as const
  };
}

function dedupeAnalystReviewItems<T extends { sourceId: string; company?: string; sourceHash?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.sourceId}:${item.company ?? ""}:${item.sourceHash ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function victimNotificationPacketFromReviewItem(item: TiAnalystReviewItem) {
  return {
    company: item.company,
    claimSummary: [
      item.company ? `${item.company} was named in a leak claim` : "A leak claim requires review",
      item.affectedAccounts ? `${item.affectedAccounts} were claimed affected` : undefined,
      item.datasetSize ? `${item.datasetSize} was claimed` : undefined
    ].filter(Boolean).join("; "),
    affectedAccounts: item.affectedAccounts,
    accountSubjects: item.accountSubjects,
    datasetSize: item.datasetSize,
    actorStatement: item.actorStatement,
    claimedDate: item.claimedDate,
    sourceHash: item.sourceHash,
    confidence: item.confidence,
    whatWasNotAccessed: [
      "No restricted dataset was downloaded or opened.",
      "No credentials, cookies, private channels, or invite-only areas were accessed.",
      "No CAPTCHA, authentication, or access-control bypass was attempted.",
      "No threat actor interaction was performed."
    ],
    recommendedAction: "Validate metadata, dedupe against existing claims, and notify the named organization through approved contact channels."
  };
}

function sourceActivationActionsForAnalystLoop(
  reviewTasks: CollectionTask[],
  reasons: string[],
  runId: string | undefined,
  needsActivation: boolean,
  blockedUnsafeTargets: number
) {
  return [
    ...(needsActivation ? [{
      action: "request_approval" as const,
      sourceId: reviewTasks[0]?.sourceId ?? runId,
      reason: reasons.find((reason) => /approval|legal|operator/i.test(reason)) ?? reviewTasks[0]?.reason ?? "Metadata-only source requires operator/legal approval.",
      execution: "human_approval_required" as const
    }, {
      action: "enable_metadata_only_queue" as const,
      sourceId: reviewTasks[0]?.sourceId ?? runId,
      reason: "After approval, queue metadata-only work with raw downloads and interactions disabled.",
      execution: "dry_run" as const
    }] : []),
    ...(blockedUnsafeTargets > 0 ? [{
      action: "keep_blocked" as const,
      sourceId: runId,
      reason: "Unsafe raw payload, credential, private access, or interaction target must remain blocked.",
      execution: "blocked" as const
    }] : [])
  ];
}

function notificationPacketFromAnalystLoop(
  packet: ReturnType<typeof victimNotificationPacketFromReviewItem>,
  reviewTask: AnalystMetadataReviewTask,
  tenantId: string | undefined,
  now: string
): AnalystVictimNotificationPacket {
  return {
    id: stableId("victim-notification", `${reviewTask.id}:${packet.sourceHash}`),
    tenantId,
    reviewTaskId: reviewTask.id,
    status: "draft",
    company: reviewTask.company ?? reviewTask.victim ?? "Unknown organization",
    victim: reviewTask.victim,
    claimSummary: packet.claimSummary,
    affectedAccounts: packet.affectedAccounts,
    datasetSize: packet.datasetSize,
    actorStatement: packet.actorStatement,
    claimedAt: packet.claimedDate,
    observedAt: reviewTask.observedAt,
    sourceHash: packet.sourceHash,
    confidence: clampScore(packet.confidence),
    provenance: reviewTask.provenance,
    redactions: ["restricted_dataset_material", "credential_material", "private_access_material", "actor_interaction"],
    whatWasNotAccessed: packet.whatWasNotAccessed,
    safeToSend: false,
    createdAt: now,
    updatedAt: now
  };
}

function claimLedgerEntriesFromReviewTask(
  task: AnalystMetadataReviewTask,
  query: string,
  now: string
): AnalystClaimLedgerEntry[] {
  const base = {
    tenantId: task.tenantId,
    normalizedQuery: normalizeSearchQuery(query),
    reviewTaskId: task.id,
    captureId: task.captureId,
    sourceId: task.sourceId,
    company: task.company,
    victim: task.victim,
    sourceHash: task.sourceHash,
    confidence: task.confidence,
    ledgerStatus: "metadata_review" as const,
    observedAt: task.observedAt,
    provenance: task.provenance,
    createdAt: now
  };
  const entries: AnalystClaimLedgerEntry[] = [];
  if (task.company || task.victim) {
    entries.push({
      ...base,
      id: stableId("claim-ledger", `${task.id}:victim:${task.company ?? task.victim}`),
      claimKind: "victim_claim",
      claimTextSummary: `${task.company ?? task.victim} was named in a metadata-only leak claim.`
    });
  }
  if (task.affectedAccounts) {
    entries.push({
      ...base,
      id: stableId("claim-ledger", `${task.id}:affected:${task.affectedAccounts}`),
      claimKind: "affected_accounts_claim",
      claimTextSummary: `${task.affectedAccounts} were claimed affected.`
    });
  }
  if (task.datasetSize) {
    entries.push({
      ...base,
      id: stableId("claim-ledger", `${task.id}:dataset:${task.datasetSize}`),
      claimKind: "dataset_size_claim",
      claimTextSummary: `${task.datasetSize} was claimed as dataset size or volume.`
    });
  }
  if (task.actorStatement) {
    entries.push({
      ...base,
      id: stableId("claim-ledger", `${task.id}:statement:${task.sourceHash}`),
      claimKind: "actor_statement_claim",
      claimTextSummary: task.actorStatement.slice(0, 500)
    });
  }
  if (!entries.length) {
    entries.push({
      ...base,
      id: stableId("claim-ledger", `${task.id}:leak`),
      claimKind: "leak_claim",
      claimTextSummary: "Metadata-only leak claim requires analyst review."
    });
  }
  return entries;
}

function mapAnalystActivationAction(action: string): {
  action: AnalystSourceActivationPacket["action"];
  execution: AnalystSourceActivationPacket["execution"];
  expectedEffect: string;
  rollback: string;
} {
  if (action === "keep_blocked") {
    return {
      action: "keep_blocked",
      execution: "blocked",
      expectedEffect: "Keep unsafe restricted payload, credential, private-access, or interaction target blocked.",
      rollback: "No rollback; blocked target remains outside allowed collection."
    };
  }
  if (action === "enable_metadata_only_queue") {
    return {
      action: "restore_metadata_only_source",
      execution: "dry_run_only",
      expectedEffect: "Queue only metadata fields after explicit approval while raw payload access remains disabled.",
      rollback: "Leave source disabled or move it back to needs_review if approval is not granted."
    };
  }
  return {
    action: "request_operator_approval",
    execution: "approval_required",
    expectedEffect: "Create an approval packet before any metadata-only collection is restored.",
    rollback: "Reject or expire the approval packet; no source activation occurs from this dry run."
  };
}

function provenanceRecord(value: string): Record<string, unknown> {
  return {
    summary: value,
    unsafeMaterialAccessed: false,
    whatWasNotAccessed: defaultAnalystWhatWasNotAccessed()
  };
}

function defaultAnalystWhatWasNotAccessed(): string[] {
  return [
    "restricted files",
    "credential material",
    "private communities",
    "CAPTCHA or authenticated areas",
    "threat actor interaction"
  ];
}

function parseCountText(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|m|million|thousand)?/i);
  if (!match) return undefined;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return undefined;
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k" || suffix === "thousand") return Math.round(base * 1_000);
  if (suffix === "m" || suffix === "million") return Math.round(base * 1_000_000);
  return Math.round(base);
}

function parseSizeBytes(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB|PB)/i);
  if (!match) return undefined;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return undefined;
  const unit = match[2].toUpperCase();
  const factor = unit === "PB" ? 1_000_000_000_000_000 : unit === "TB" ? 1_000_000_000_000 : unit === "GB" ? 1_000_000_000 : 1_000_000;
  return Math.round(base * factor);
}

function analystLoopHeadline(state: TiAnalystLoopState, count: number): string {
  if (state === "metadata_review") return `${count} metadata review item${count === 1 ? "" : "s"} need analyst action.`;
  if (state === "blocked_unsafe_target") return "Unsafe raw target blocked; safe metadata remains the only permitted path.";
  if (state === "needs_source_activation") return "Operator or legal approval is needed before metadata-only collection can continue.";
  if (state === "queued") return "Approved safe collection is queued and waiting for worker progress.";
  return "Enough reviewed evidence exists for the public answer.";
}

function parseLeakClaimText(text: string): {
  company?: string;
  affectedAccounts?: string;
  accountSubjects?: string;
  datasetSize?: string;
  actorStatement?: string;
  claimedDate?: string;
} {
  if (!/\b(leak(?:ed)?|breach(?:ed)?|compromis(?:ed|e)|dump(?:ed)?|stolen|exfiltrat(?:ed|ion))\b/i.test(text)) {
    return { actorStatement: text.slice(0, 500) };
  }
  return {
    company: text.match(/^\s*["“]?([^"|,;]+?)["”]?\s+(?:was\s+)?(?:leak(?:ed)?|breach(?:ed)?|compromis(?:ed|e)|hit|named)\b/i)?.[1]?.trim()
      ?? text.match(/\b(?:victim|company|organization)\s*:\s*([^|;\n]+)/i)?.[1]?.trim(),
    affectedAccounts: text.match(/\b([\d,.]+\s*(?:k|m|million|thousand)?\s+accounts?)\b/i)?.[1],
    accountSubjects: text.match(/\b(?:who|account subjects|account owners)\s*:\s*([^|;\n]+)/i)?.[1]?.trim(),
    datasetSize: text.match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB|TB|PB|records?|files?|rows?))\b/i)?.[1],
    actorStatement: text.replace(/\s+/g, " ").trim().slice(0, 500),
    claimedDate: text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function frontierStatusResponse(input: {
  query?: string;
  runId?: string;
  tenantId?: string;
  sinceCursor?: string;
  options: ApiServerOptions;
}) {
  const run = input.runId ? input.options.store.getRun(input.runId) : undefined;
  const plan = run
    ? input.options.store.listPlans().find((candidate) => candidate.id === run.planId || candidate.request.id === run.requestId)
    : input.query
      ? createLiveSearchPlan({
          request: {
            query: input.query,
            entityType: "actor",
            tenantId: input.tenantId,
            includeClearWeb: true,
            includeTelegram: true,
            includeDarknetMetadata: false
          },
          sources: input.options.store.listSources(),
          activeRuns: input.options.store.listRuns(),
          activePlans: input.options.store.listPlans(),
          frontier: input.options.frontier
        }).plan
      : undefined;
  return {
    endpoint: "/v1/frontier/status",
    summary: input.options.frontier.groupedSnapshot(),
    scheduler: plan ? schedulerSummaryForPlan({
      plan,
      run,
      frontier: input.options.frontier,
      options: input.options,
      sinceCursor: input.sinceCursor,
      partialResultCount: partialResultCountForQuery(plan.request.query, run?.tenantId ?? input.tenantId, input.options)
    }) : undefined
  };
}

function pollingSummaryForPlan(input: {
  plan: CollectionPlan;
  run?: CollectionRun;
  options?: ApiServerOptions;
  sinceCursor?: string;
  nextPollSeconds: number;
  partialResultCount: number;
  blockedReasons: string[];
  deferredReasons: string[];
  skippedReasons: string[];
}) {
  const queryHelpers = (input.options?.store as { queries?: () => { getSearchDeltas: (query: string, sinceCursor?: string, scope?: { tenantId?: string }) => Array<{ cursor: string; kind: string; runId?: string }> } } | undefined)?.queries?.();
  const deltas = queryHelpers?.getSearchDeltas(input.plan.request.query, input.sinceCursor, { tenantId: input.run?.tenantId ?? input.plan.tenantId }) ?? [];
  const runDeltas = input.run ? deltas.filter((delta) => !delta.runId || delta.runId === input.run?.id) : deltas;
  const latestCursor = runDeltas.at(-1)?.cursor ?? input.sinceCursor;
  const partialReasons = uniqueStrings([
    ...input.blockedReasons.map((reason) => `blocked:${reason}`),
    ...input.deferredReasons.map((reason) => `deferred:${reason}`),
    ...input.skippedReasons.map((reason) => `skipped:${reason}`),
    ...(input.partialResultCount === 0 && runDeltas.length === 0 ? ["waiting_for_evidence"] : [])
  ]).slice(0, 8);
  return {
    nextPollSeconds: input.nextPollSeconds,
    nextPollAt: new Date(Date.now() + input.nextPollSeconds * 1_000).toISOString(),
    cursorContinuity: input.run?.status === "cancelled"
      ? "cancelled"
      : input.blockedReasons.length > 0 && input.partialResultCount === 0
        ? "blocked"
        : input.sinceCursor
          ? runDeltas.length > 0 ? "continued" : "waiting_for_deltas"
          : runDeltas.length > 0 ? "continued" : "not_started",
    latestCursor,
    promotedEvidenceCount: runDeltas.filter((delta) => delta.kind === "promoted").length,
    newEvidenceDeltaCount: runDeltas.length,
    partialReasons
  };
}

function partialResultCountForQuery(query: string, tenantId: string | undefined, options: ApiServerOptions): number {
  const normalized = query.trim().toLowerCase();
  return options.store.listCaptures()
    .filter((capture) => !tenantId || capture.tenantId === tenantId)
    .filter((capture) => `${capture.url} ${capture.body ?? ""} ${JSON.stringify(capture.metadata ?? {})}`.toLowerCase().includes(normalized))
    .length;
}

function pressureStateForSummary(frontier: FocusedFrontier, tasks: CollectionTask[]): LiveSearchPlannerDto["backpressureState"] {
  if (frontier.groupedSnapshot().queued >= 1_000) return "deferred_by_queue_pressure";
  if (tasks.some((task) => task.availableAt && Date.parse(task.availableAt) > Date.now())) return "deferred_by_source_backoff";
  return "accepted";
}

function aggregateSafetyEnvelope(tasks: CollectionTask[]) {
  return {
    allowClearWeb: tasks.some((task) => task.planning?.safetyEnvelope?.allowClearWeb),
    allowPublicChannel: tasks.some((task) => task.planning?.safetyEnvelope?.allowPublicChannel),
    allowRestrictedMetadata: tasks.some((task) => task.planning?.safetyEnvelope?.allowRestrictedMetadata),
    metadataOnlyRestricted: tasks.some((task) => task.planning?.safetyEnvelope?.metadataOnlyRestricted),
    forbiddenOperations: uniqueStrings(tasks.flatMap((task) => task.planning?.safetyEnvelope?.forbiddenOperations ?? []))
  };
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))] ?? 0;
}

function searchQualityForQuery(input: {
  query: string;
  tenantId?: string;
  options: ApiServerOptions;
}): SearchQualityApiDto {
  const evidence = searchQualityEvidence(input);
  if (evidence.length === 0) return emptySearchQuality(input.query);
  const dto = buildLiveActorIntelligenceDto({ query: input.query, evidence });
  const gate = evaluateSearchQualityGate({
    dto,
    graphReviewState: graphReviewStateForEvidence(evidence)
  });
  return redactSearchQuality(buildSearchQualityApiDto(dto, gate));
}

function actorProfileForQuery(input: {
  query: string;
  tenantId?: string;
  options: ApiServerOptions;
}) {
  const evidence = searchQualityEvidence(input);
  if (evidence.length === 0) return emptyActorProfile(input.query);
  const dto = buildLiveActorIntelligenceDto({ query: input.query, evidence });
  const gate = evaluateSearchQualityGate({
    dto,
    graphReviewState: graphReviewStateForEvidence(evidence)
  });
  const quality = redactSearchQuality(buildSearchQualityApiDto(dto, gate));
  const candidateTargets = targetCandidatesFromEvidence(evidence);
  return redactActorProfile({
    status: quality.status,
    confidence: dto.confidence,
    warningCodes: quality.publicWarningCodes,
    caveatCodes: quality.caveatCodes,
    changedFields: [...new Set(dto.profileDeltas.map((delta) => delta.kind))],
    evidenceIds: dto.provenance.map((item) => item.evidenceId),
    analystActions: quality.analystActions,
    actor: dto.actor,
    summary: dto.summaryBullets.slice(0, 5),
    aliases: dto.aliases,
    recentActivity: dto.recentActivity,
    targets: {
      victims: uniqueStrings([...dto.targets.victims, ...candidateTargets.victims]),
      sectors: uniqueStrings([...dto.targets.sectors, ...candidateTargets.sectors]),
      regions: uniqueStrings([...dto.targets.regions, ...candidateTargets.regions])
    },
    readiness: dto.readiness,
    answer: buildPublicIntelAnswerDto(dto, quality),
    ttps: dto.ttps,
    malwareTools: dto.malwareTools,
    vulnerabilities: dto.vulnerabilities,
    datasets: dto.datasets,
    provenance: dto.provenance.map((item) => ({
      evidenceId: item.evidenceId,
      sourceId: item.sourceId,
      captureId: item.captureId,
      evidenceStage: item.evidenceStage,
      collectedAt: item.collectedAt,
      confidence: item.confidence
    })),
    provenanceNotes: quality.publicWarningText
  });
}

function targetCandidatesFromEvidence(evidence: Array<{ result: PipelineResult }>): { victims: string[]; sectors: string[]; regions: string[] } {
  return {
    victims: uniqueStrings([
      ...evidence.flatMap((item) => item.result.entities.filter((entity) => entity.type === "victim").map((entity) => entity.value)),
      ...evidence.flatMap((item) => safeEntityHints(item.result.capture.metadata).victims),
      ...evidence.flatMap((item) => victimCandidatesFromText(item.result.capture.body ?? ""))
    ]),
    sectors: uniqueStrings([
      ...evidence.flatMap((item) => item.result.entities.filter((entity) => entity.type === "sector").map((entity) => entity.value)),
      ...evidence.flatMap((item) => safeEntityHints(item.result.capture.metadata).sectors)
    ]),
    regions: uniqueStrings(evidence.flatMap((item) => item.result.entities.filter((entity) => entity.type === "country").map((entity) => entity.value)))
  };
}

function safeEntityHints(metadata: Record<string, unknown>): { victims: string[]; sectors: string[] } {
  const hints = metadata.safeEntityHints;
  if (!hints || typeof hints !== "object") return { victims: [], sectors: [] };
  const record = hints as Record<string, unknown>;
  return {
    victims: Array.isArray(record.victims) ? record.victims.filter((item): item is string => typeof item === "string") : [],
    sectors: Array.isArray(record.sectors) ? record.sectors.filter((item): item is string => typeof item === "string") : []
  };
}

function victimCandidatesFromText(value: string): string[] {
  const victims = new Set<string>();
  for (const match of value.matchAll(/\bvictim\s*:?\s+([A-Z][A-Za-z0-9&., -]{2,80})/g)) {
    const victim = match[1]?.replace(/\s+\b(?:on|in|using|with|after|from)\b.*$/i, "").trim();
    if (victim) victims.add(victim);
  }
  return [...victims];
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function searchQualityEvidence(input: {
  query: string;
  tenantId?: string;
  options: ApiServerOptions;
}) {
  const terms = input.query.toLowerCase().split(/\s+/).filter(Boolean);
  return input.options.store.listCaptures()
    .filter((capture) => !input.tenantId || capture.tenantId === input.tenantId)
    .filter((capture) => terms.some((term) => searchableCaptureText(capture).includes(term)))
    .slice(0, 12)
    .map((capture) => captureToSearchQualityEvidence(capture));
}

function captureToSearchQualityEvidence(capture: RawCapture) {
  const rawText = capture.body ?? metadataOnlyEvidenceText(capture) ?? String(capture.metadata.safeExcerpt ?? capture.metadata.title ?? capture.url);
  const stage = evidenceStageFromCapture(capture);
  return {
    id: String(capture.metadata.evidenceId ?? capture.id),
    stage,
    observedAt: capture.collectedAt,
    previousStage: evidenceStageOrUndefined(capture.metadata.previousEvidenceStage),
    previousConfidence: typeof capture.metadata.previousConfidence === "number" ? capture.metadata.previousConfidence : undefined,
    blockedReason: typeof capture.metadata.blockedReason === "string" ? capture.metadata.blockedReason : undefined,
    result: {
      ...processCollectedItem({
        sourceId: capture.sourceId,
        taskId: capture.taskId,
        url: capture.url,
        collectedAt: capture.collectedAt,
        publishedAt: capture.publishedAt,
        title: typeof capture.metadata.title === "string" ? capture.metadata.title : undefined,
        rawText,
        contentHash: capture.contentHash,
        links: [],
        metadata: { ...capture.metadata, evidenceStage: stage },
        sensitive: capture.sensitive
      }),
      capture: {
        ...capture,
        metadata: { ...capture.metadata, evidenceStage: stage }
      }
    }
  };
}

function searchableCaptureText(capture: RawCapture): string {
  return [
    capture.url,
    capture.body,
    capture.metadata.safeExcerpt,
    capture.metadata.title,
    metadataOnlyEvidenceText(capture)
  ].filter((value): value is string => typeof value === "string" && value.length > 0).join(" ").toLowerCase();
}

function metadataOnlyEvidenceText(capture: RawCapture): string | undefined {
  if (capture.metadata.adapter !== "darknet_metadata") return undefined;
  const leakSite = record(capture.metadata.leakSite);
  if (!leakSite) return undefined;
  const parts = [
    metadataField("actor", leakSite.actorName),
    metadataField("victim", leakSite.victimName),
    metadataField("company", leakSite.victimName),
    metadataField("accounts affected", leakSite.affectedAccounts),
    metadataField("account subjects", leakSite.accountSubjects),
    metadataField("dataset size", leakSite.datasetSize),
    metadataField("actor demand or statement", leakSite.actorStatement),
    metadataField("claimed date", leakSite.claimDate),
    metadataField("sector", leakSite.claimedSector),
    metadataField("country", leakSite.claimedCountry),
    metadataField("data category", leakSite.claimedDataCategory ?? leakSite.claimedDataType),
    metadataField("post status", leakSite.postStatus),
    metadataField("source timestamp", leakSite.sourceTimestamp),
    metadataField("url hash", leakSite.urlHash),
    metadataField("screenshot hash", leakSite.screenshotHash)
  ].filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(" | ") : undefined;
}

function metadataField(label: string, value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? `${label}: ${value.trim()}` : undefined;
}

function evidenceStageFromCapture(capture: RawCapture): EvidenceStage {
  return evidenceStageOrUndefined(capture.metadata.evidenceStage)
    ?? (capture.storageKind === "metadata_only" ? "metadata_only_claim" : undefined)
    ?? (capture.metadata.adapter === "telegram_public" ? "public_channel_message" : undefined)
    ?? (capture.body ? "captured_page" : "live_discovery");
}

function evidenceStageOrUndefined(value: unknown): EvidenceStage | undefined {
  const allowed: EvidenceStage[] = [
    "seeded",
    "live_discovery",
    "captured_page",
    "public_channel_message",
    "metadata_only_claim",
    "extracted_relationship",
    "reviewed_promoted"
  ];
  return allowed.includes(value as EvidenceStage) ? value as EvidenceStage : undefined;
}

function graphReviewStateForEvidence(evidence: Array<{ result: PipelineResult }>): GraphReviewState | undefined {
  for (const item of evidence) {
    const state = item.result.capture.metadata.graphReviewState;
    if (isGraphReviewState(state)) return state;
  }
  return undefined;
}

function isGraphReviewState(value: unknown): value is GraphReviewState {
  return [
    "accepted",
    "proposed",
    "needs-human-review",
    "contradiction",
    "stale",
    "rejected",
    "downgraded",
    "superseded"
  ].includes(value as GraphReviewState);
}

function redactSearchQuality(quality: SearchQualityApiDto): SearchQualityApiDto {
  return {
    ...quality,
    analystActions: quality.analystActions.map((action) => ({
      ...action,
      evidenceIds: action.evidenceIds.slice(0, 12)
    })),
    publicWarningText: quality.publicWarningText.map((message) => message.replace(/https?:\/\/\S+/g, "[url-redacted]"))
  };
}

function redactActorProfile<T>(profile: T): T {
  return redactValue(profile) as T;
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, redactValue(item)]));
  }
  if (typeof value !== "string") return value;
  return value
    .replace(/hxxps?:\/\/\S+/gi, "[url-redacted]")
    .replace(/https?:\/\/\S+/gi, "[url-redacted]")
    .replace(/\b[a-z0-9.-]+\.onion\b/gi, "[restricted-url-redacted]");
}

function emptySearchQuality(query: string): SearchQualityApiDto {
  return {
    status: "partial",
    score: 0,
    caveatCodes: ["live_snippet_only"],
    qualityNoteCodes: ["low_evidence_count"],
    evidenceStageCounts: {
      seeded: 0,
      live_discovery: 0,
      public_channel_message: 0,
      metadata_only_claim: 0,
      captured_page: 0,
      extracted_relationship: 0,
      reviewed_promoted: 0
    },
    analystActions: [{
      kind: "request_more_capture_evidence",
      label: "Request more capture evidence",
      manualOnly: false,
      evidenceIds: []
    }],
    canPromoteToReady: false,
    publicWarningText: [`No durable evidence is available for ${query}; keep the result partial until capture or review evidence arrives.`],
    publicWarningCodes: ["partial", "live_snippet_only", "low_evidence_count"]
  };
}

function emptyActorProfile(query: string) {
  return {
    status: "partial",
    confidence: 0,
    warningCodes: ["partial", "live_snippet_only", "low_evidence_count"],
    caveatCodes: ["live_snippet_only"],
    changedFields: [],
    evidenceIds: [],
    analystActions: [{
      kind: "request_more_capture_evidence",
      label: "Request more capture evidence",
      manualOnly: false,
      evidenceIds: []
    }],
    actor: query,
    summary: [`No durable evidence is available for ${query}`],
    aliases: [],
    recentActivity: { freshnessScore: 0, notes: [] },
    targets: { victims: [], sectors: [], regions: [] },
    readiness: emptyActorReadiness(),
    answer: {
      query,
      actor: query,
      status: "partial_evidence",
      confidence: 0,
      summary: [`No durable evidence is available for ${query}`],
      aliases: [],
      recentActivity: { freshnessScore: 0, notes: [] },
      targets: { victims: [], sectors: [], regions: [] },
      victims: [],
      ttps: [],
      malwareTools: [],
      vulnerabilities: [],
      datasets: {
        coverage: [],
        sourceCount: 0,
        indicatorCount: 0,
        entityCount: 0,
        evidenceStageCounts: {
          seeded: 0,
          live_discovery: 0,
          public_channel_message: 0,
          metadata_only_claim: 0,
          captured_page: 0,
          extracted_relationship: 0,
          reviewed_promoted: 0
        }
      },
      timeline: [],
      warnings: [`No durable evidence is available for ${query}; keep the result partial until capture or review evidence arrives.`],
      warningCodes: ["partial", "live_snippet_only", "low_evidence_count"],
      provenanceNotes: [],
      readiness: emptyActorReadiness()
    },
    ttps: [],
    malwareTools: [],
    vulnerabilities: [],
    datasets: {
      coverage: [],
      sourceCount: 0,
      indicatorCount: 0,
      entityCount: 0,
      evidenceStageCounts: {
        seeded: 0,
        live_discovery: 0,
        public_channel_message: 0,
        metadata_only_claim: 0,
        captured_page: 0,
        extracted_relationship: 0,
        reviewed_promoted: 0
      }
    },
    provenance: [],
    provenanceNotes: [`No durable evidence is available for ${query}; keep the result partial until capture or review evidence arrives.`]
  };
}

function emptyActorReadiness() {
  const evidenceStageCounts = {
    seeded: 0,
    live_discovery: 0,
    public_channel_message: 0,
    metadata_only_claim: 0,
    captured_page: 0,
    extracted_relationship: 0,
    reviewed_promoted: 0
  };
  const fields = [
    "summary",
    "aliases",
    "recent_activity",
    "timeline_changes",
    "targets",
    "victims",
    "sectors",
    "regions",
    "ttps",
    "malware_tools",
    "vulnerabilities",
    "infrastructure",
    "datasets"
  ];
  return {
    overall: "partial_evidence",
    fields: Object.fromEntries(fields.map((field) => [field, {
      field,
      status: "partial_evidence",
      confidence: 0,
      evidenceIds: [],
      provenance: [],
      caveatCodes: ["live_snippet_only"],
      reasons: ["no durable evidence"]
    }])),
    downgradeReasons: ["no durable evidence"],
    sourceFamilyCount: 0,
    evidenceStageCounts
  };
}

function parseIntelEntityType(value: string): IntelligenceRequest["entityType"] {
  const allowed: IntelligenceRequest["entityType"][] = [
    "actor",
    "alias",
    "victim",
    "malware",
    "cve",
    "campaign",
    "indicator",
    "sector",
    "country",
    "infrastructure",
    "free_text",
    "saved_topic"
  ];
  return allowed.includes(value as IntelligenceRequest["entityType"])
    ? value as IntelligenceRequest["entityType"]
    : "free_text";
}

function darknetMetadataDisabled(options: ApiServerOptions): boolean {
  if (!options.config) return false;
  return !options.config.collection.darknetMetadataOnly || options.config.limits.maxConcurrentDarknetMetadataTasks <= 0;
}

function materializeRunResults(run: CollectionRun, options: ApiServerOptions): {
  captures: RawCapture[];
  incidents: IncidentCandidate[];
  pipelineResults: PipelineResult[];
} {
  const plan = options.store.getPlan(run.planId);
  const taskIds = new Set(plan?.tasks.map((task) => task.id) ?? []);
  const captures = options.store.listCaptures().filter((capture) => {
    if (run.tenantId && capture.tenantId !== run.tenantId) return false;
    return taskIds.size === 0 || (capture.taskId ? taskIds.has(capture.taskId) : true);
  });
  const captureIds = new Set(captures.map((capture) => capture.id));
  const incidents = options.store.listIncidents().filter((incident) => Boolean(incident.captureId && captureIds.has(incident.captureId)));
  const captureById = new Map(captures.map((capture) => [capture.id, capture]));
  const pipelineResults = incidents.flatMap((incident): PipelineResult[] => {
    const capture = incident.captureId ? captureById.get(incident.captureId) : undefined;
    return capture ? [{ capture, incident, indicators: incident.indicators, entities: incident.entities }] : [];
  });
  return { captures, incidents, pipelineResults };
}

function stixBundleForRun(
  run: CollectionRun,
  options: ApiServerOptions,
  exportOptions: { producerName: string; generatedAt: string; tenantId?: string }
): StixBundle {
  const { captures, incidents } = materializeRunResults(run, options);
  return exportEvidenceBackedStixBundle({
    captures,
    incidents,
    options: {
      ...exportOptions,
      bundleKey: run.id,
      includeMetadataOnlyCaptures: true
    }
  });
}

function runForGraphRoute(url: URL, options: ApiServerOptions): CollectionRun | Response {
  const runId = url.searchParams.get("runId") ?? "";
  if (!runId.trim()) return apiError("bad_request", "runId is required", 400);
  const run = options.store.getRun(runId);
  if (!run) return apiError("not_found", "Run not found", 404);
  return run;
}

function graphSnapshotForRun(run: CollectionRun, options: ApiServerOptions, generatedAt = nowIso()) {
  const { pipelineResults } = materializeRunResults(run, options);
  const nodes = new Map<string, ReturnType<typeof buildRelationshipGraph>["nodes"][number]>();
  const relationships = new Map<string, ReturnType<typeof buildRelationshipGraph>["relationships"][number]>();
  for (const result of pipelineResults) {
    const graph = buildRelationshipGraph(result);
    for (const node of graph.nodes) nodes.set(node.id, node);
    for (const relationship of graph.relationships) relationships.set(relationship.id, relationship);
  }
  return buildPersistedGraphSnapshot({
    nodes: [...nodes.values()],
    relationships: [...relationships.values()]
  }, { generatedAt });
}

function graphReviewRouteRequest(url: URL): GraphReviewRouteRequestDto {
  return {
    dryRun: url.searchParams.has("dryRun") ? url.searchParams.get("dryRun") !== "false" : undefined,
    relationshipId: url.searchParams.get("relationshipId") ?? undefined,
    selectedActions: csv(url.searchParams.get("selectedActions")) as GraphReviewRouteRequestDto["selectedActions"],
    includeExamples: url.searchParams.get("includeExamples") === "true",
    includeDiscoveryOnly: url.searchParams.get("includeDiscoveryOnly") === "true" ? true : undefined,
    minConfidence: numberQuery(url.searchParams.get("minConfidence")),
    requireAccepted: url.searchParams.get("requireAccepted") === "true" ? true : undefined,
    generatedAt: url.searchParams.get("generatedAt") ?? undefined
  };
}

function graphReviewRouteResponse(result: { status: number; body: unknown }): Response {
  const error = (result.body as { error?: { code: string; message: string; details?: Record<string, unknown> } }).error;
  return error ? apiError(error.code, error.message, result.status, error.details) : json(result.body, result.status);
}

function csv(value: string | null): string[] | undefined {
  if (!value) return undefined;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function numberQuery(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requestedIncludes(url: URL): Set<RunResultsInclude> {
  const allowed: RunResultsInclude[] = ["captures", "incidents", "indicators", "entities", "relationships"];
  const raw = url.searchParams.get("include") ?? allowed.join(",");
  const requested = new Set(raw.split(",").map((value) => value.trim()).filter((value): value is RunResultsInclude =>
    allowed.includes(value as RunResultsInclude)
  ));
  return requested.size ? requested : new Set(allowed);
}

function includeCaptureBody(url: URL): boolean {
  return url.searchParams.get("includeBody") === "true";
}

function captureDto(capture: RawCapture, includeBody: boolean): SafeCaptureDto {
  return toSafeCaptureDto(capture, { includeBody });
}

function normalizeRunRequest(input: IntelligenceRequest): Record<string, unknown> {
  return {
    tenantId: input.tenantId,
    query: input.query,
    entityType: input.entityType,
    includeClearWeb: input.includeClearWeb,
    includeTelegram: input.includeTelegram,
    includeDarknetMetadata: input.includeDarknetMetadata,
    maxTasks: input.maxTasks,
    requesterId: input.requesterId,
    priority: input.priority,
    reason: input.reason
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function paged<T>(key: string, items: T[], url: URL): Record<string, T[] | string | undefined> {
  const current = page(items, url);
  return { [key]: current.items, nextCursor: current.nextCursor };
}

function page<T>(items: T[], url: URL): { items: T[]; nextCursor?: string } {
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const cursor = Math.max(0, Number.parseInt(url.searchParams.get("cursor") ?? "0", 10));
  const pageItems = items.slice(cursor, cursor + limit);
  const nextCursor = cursor + limit < items.length ? String(cursor + limit) : undefined;
  return { items: pageItems, nextCursor };
}

function buildMetrics(options: ApiServerOptions): MetricsResponse {
  const sources = options.store.listSources();
  const captures = options.store.listCaptures();
  const incidents = options.store.listIncidents();
  const runs = options.store.listRuns();
  const runCounts: Record<RunStatus, number> = {
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0
  };

  for (const run of runs) {
    runCounts[run.status] += 1;
  }

  return {
    service: "ti-scraper",
    generatedAt: nowIso(),
    sources: {
      total: sources.length,
      active: sources.filter((source) => source.status === "active").length,
      degraded: sources.filter((source) => source.status === "degraded").length,
      needsReview: sources.filter((source) => source.status === "needs_review").length
    },
    frontier: {
      queued: options.frontier.size(),
      maxPriority: Math.max(0, ...options.frontier.snapshot().map((task) => task.priority))
    },
    runs: runCounts,
    captures: {
      total: captures.length,
      sensitive: captures.filter((capture) => capture.sensitive).length
    },
    incidents: {
      total: incidents.length,
      needsReview: incidents.filter((incident) => incident.reviewReasons.length > 0).length
    }
  };
}

function resourceSnapshot(options: ApiServerOptions) {
  const config = options.config;
  if (!config) return undefined;
  return buildResourceSnapshot({
    budget: {
      maxRamGb: Math.floor(config.limits.maxMemoryMbTarget / 1024),
      normalCeilingGb: Math.floor(config.limits.maxMemoryMbCeiling / 1024),
      reservedDiskGb: 500,
      maxCollectionWorkers: config.limits.maxConcurrentClearWebTasks,
      maxProcessingWorkers: 1,
      maxTelegramWorkers: config.limits.maxConcurrentTelegramTasks,
      maxBrowserWorkers: 0,
      maxDarknetMetadataWorkers: config.limits.maxConcurrentDarknetMetadataTasks,
      maxQueueItems: config.limits.maxRequestTasks
    },
    queueItems: options.frontier.size()
  });
}

function buildOpsResourceSnapshot(options: ApiServerOptions): Record<string, unknown> {
  const resources = options.config ? resourceSnapshot(options) : undefined;
  const budget = options.config
    ? {
      maxRamGb: Math.floor(options.config.limits.maxMemoryMbTarget / 1024),
      normalCeilingGb: Math.floor(options.config.limits.maxMemoryMbCeiling / 1024),
      reservedDiskGb: 500,
      maxCollectionWorkers: options.config.limits.maxConcurrentClearWebTasks,
      maxProcessingWorkers: 1,
      maxTelegramWorkers: options.config.limits.maxConcurrentTelegramTasks,
      maxBrowserWorkers: 0,
      maxDarknetMetadataWorkers: options.config.limits.maxConcurrentDarknetMetadataTasks,
      maxQueueItems: options.config.limits.maxRequestTasks
    }
    : undefined;

  return {
    service: "ti-scraper",
    generatedAt: nowIso(),
    resources,
    capacity: budget ? estimateCapacity(budget) : undefined,
    workerPools: budget ? sizeWorkerPools(budget) : undefined,
    queue: {
      queued: options.frontier.size(),
      leased: options.frontier.leasedSnapshot().length
    },
    workers: options.supervisor?.snapshot() ?? []
  };
}

function buildEnterpriseApiContractIndex() {
  const activeRoutes = [
    { method: "GET", path: "/v1/health", surface: "health", owner: "Agent 09", responseKeys: ["ok", "service", "version"] },
    { method: "GET", path: "/v1/metrics", surface: "metrics", owner: "Agent 09", responseKeys: ["runs", "sources", "frontier"] },
    { method: "GET", path: "/v1/ops/resource-snapshot", surface: "ops", owner: "Agent 10/09", responseKeys: ["resources", "capacity", "workerPools", "queue"] },
    { method: "GET", path: "/v1/ops/canary", surface: "ops", owner: "Agent 01/02/06/09", responseKeys: ["operatorView"] },
    { method: "GET", path: "/v1/auth/integration-notes", surface: "auth", owner: "Agent 09", responseKeys: ["version", "notes"] },
    { method: "GET", path: "/v1/contracts", surface: "contracts", owner: "Agent 09", responseKeys: ["endpoint", "routeInventory", "routeTruthAudit", "publicWrapperResponsiveAudit", "publicWrapperDeltaAudit", "surfaces", "publicCompatibility", "semantics"] },
    { method: "GET", path: "/v1/sources", surface: "sources", owner: "Agent 01/09", responseKeys: ["sources", "nextCursor"] },
    { method: "POST", path: "/v1/sources", surface: "sources", owner: "Agent 01/09", responseKeys: ["source"] },
    { method: "POST", path: "/v1/sources/apply-plan", surface: "sources", owner: "Agent 01/09", responseKeys: ["contract", "applyPlan"] },
    { method: "POST", path: "/v1/sources/canary-activation", surface: "sources", owner: "Agent 01/09", responseKeys: ["activation", "guarantees"] },
    { method: "POST", path: "/v1/sources/canary-pause", surface: "sources", owner: "Agent 01/09", responseKeys: ["pause", "guarantees"] },
    { method: "POST", path: "/v1/sources/coverage-plan", surface: "sources", owner: "Agent 01/09", responseKeys: ["endpoint", "queries"] },
    { method: "POST", path: "/v1/sources/portfolio", surface: "sources", owner: "Agent 01/09", responseKeys: ["endpoint", "portfolio"] },
    { method: "POST", path: "/v1/sources/activation-batches", surface: "sources", owner: "Agent 01/09", responseKeys: ["endpoint", "queries", "coordination", "executionReadiness.rolloutPromotion"] },
    { method: "POST", path: "/v1/sources/runtime-sla", surface: "sources", owner: "Agent 01/09", responseKeys: ["endpoint", "queries", "releasePacket"] },
    { method: "POST", path: "/v1/sources/coverage-closeout", surface: "sources", owner: "Agent 01/09", responseKeys: ["endpoint", "queries", "activationWaves", "releasePacket"] },
    { method: "POST", path: "/v1/ops/canary/run", surface: "ops", owner: "Agent 01/02/06/09", responseKeys: ["canaryRun", "operatorView"] },
    { method: "GET", path: "/v1/frontier", surface: "frontier", owner: "Agent 02/09", responseKeys: ["queue", "summary", "scheduler"] },
    { method: "GET", path: "/v1/frontier/status", surface: "frontier", owner: "Agent 02/09", responseKeys: ["endpoint", "summary", "scheduler"] },
    { method: "POST", path: "/v1/frontier/apply-plan", surface: "frontier", owner: "Agent 02/09", responseKeys: ["contract", "applyPlan"] },
    { method: "GET", path: "/v1/captures", surface: "evidence", owner: "Agent 06/09", responseKeys: ["captures"] },
    { method: "GET", path: "/v1/evidence/replay-plan", surface: "evidence", owner: "Agent 06/09", responseKeys: ["contract", "replayPlan"] },
    { method: "GET", path: "/v1/evidence/cutover-report", surface: "evidence", owner: "Agent 06/09", responseKeys: ["contract", "cutoverReport", "trustLedger.certification"] },
    { method: "GET", path: "/v1/evidence/trust-ledger", surface: "evidence", owner: "Agent 06/09", responseKeys: ["endpoint", "ledger", "certification"] },
    { method: "GET", path: "/v1/evidence/claim-ledger", surface: "evidence", owner: "Agent 06/09", responseKeys: ["endpoint", "ledger", "certification"] },
    { method: "GET", path: "/v1/incidents", surface: "incidents", owner: "Agent 09", responseKeys: ["incidents"] },
    { method: "GET", path: "/v1/intel/plans", surface: "intel", owner: "Agent 09", responseKeys: ["plans"] },
    { method: "POST", path: "/v1/intel/plan", surface: "intel", owner: "Agent 09", responseKeys: ["plan"] },
    { method: "POST", path: "/v1/intel/runs", surface: "intel", owner: "Agent 09", responseKeys: ["run"] },
    { method: "GET", path: "/v1/intel/runs/{id}", surface: "intel", owner: "Agent 09", responseKeys: ["run", "frontier"] },
    { method: "GET", path: "/v1/intel/runs/{id}/results", surface: "intel", owner: "Agent 09", responseKeys: ["run", "results"] },
    { method: "GET", path: "/v1/intel/search", surface: "search", owner: "Agent 09", responseKeys: ["query", "mode", "status", "runId", "cursor", "nextCursor", "pollCursor", "deltaCursor", "updated", "publicTiAnswer", "publicWrapperDelta"] },
    { method: "GET", path: "/v1/quality/evaluate", surface: "quality", owner: "Agent 07/09", responseKeys: ["query", "quality", "examples"] },
    { method: "GET", path: "/v1/graph/review-plan", surface: "graph", owner: "Agent 08/09", responseKeys: ["contract", "reviewPlan"] },
    { method: "GET", path: "/v1/graph/query", surface: "graph", owner: "Agent 08/09", responseKeys: ["contract", "graph"] },
    { method: "GET", path: "/v1/graph/timeline", surface: "graph", owner: "Agent 08/09", responseKeys: ["contract", "timeline"] },
    { method: "GET", path: "/v1/graph/cutover-report", surface: "graph", owner: "Agent 08/09", responseKeys: ["contract", "cutoverReport"] },
    { method: "GET", path: "/v1/exports/stix", surface: "stix", owner: "Agent 08/09", responseKeys: ["contract", "readiness"] },
    { method: "POST", path: "/v1/exports/stix", surface: "stix", owner: "Agent 08/09", responseKeys: ["bundle"] },
    { method: "GET", path: "/v1/public-channels/status", surface: "public_channels", owner: "Agent 04/09", responseKeys: ["status"] },
    { method: "POST", path: "/v1/public-channels/apply-plan", surface: "public_channels", owner: "Agent 04/09", responseKeys: ["contract", "applyPlan"] },
    { method: "GET", path: "/v1/restricted-metadata/status", surface: "restricted_metadata", owner: "Agent 05/09", responseKeys: ["status"] },
    { method: "POST", path: "/v1/restricted-metadata/apply-plan", surface: "restricted_metadata", owner: "Agent 05/09", responseKeys: ["contract", "applyPlan"] },
    { method: "POST", path: "/v1/sources/{id}/restricted-metadata/apply-plan", surface: "restricted_metadata", owner: "Agent 05/09", responseKeys: ["contract", "applyPlan"] }
  ];
  const compatibilityFields = [
    "query",
    "mode",
    "status",
    "runId",
    "refreshAfterSeconds",
    "summary",
    "confidence",
    "aliases",
    "recentActivity",
    "targets",
    "TTPs",
    "datasets",
    "sources",
    "notes",
    "warnings",
    "cursor",
    "nextCursor",
    "pollCursor",
    "deltaCursor",
    "updated",
    "lastSeen",
    "answer",
    "publicTiAnswer",
    "publicWrapperDelta"
  ];
  const noLeakGuarantees = [
    "no raw Telegram message bodies",
    "no restricted raw payloads",
    "no object storage keys",
    "no credentials, cookies, session strings, passwords, or authorization headers",
    "no private invite links or account-automation material",
    "restricted-source URLs are redacted to hashes where applicable"
  ];
  const commonErrorEnvelope = {
    error: {
      code: "bad_request | not_found | idempotency_conflict | relationship_not_found | invalid_action | provider_unavailable | scraper_unavailable | queue_pressure | no_approved_sources | policy_blocked | stale_evidence | duplicate_run_reuse",
      message: "stable human-readable summary",
      details: "optional structured object"
    }
  };
  const stateMachine = {
    schemaVersion: "ti.public_answer_polling_state.v1",
    states: {
      first_response: { retryable: true, terminal: false, publicPromotion: "blocked_until_evidence", requiredFields: ["publicTiAnswer.stateMachine", "cursor", "nextCursor"] },
      queued_collection: { retryable: true, terminal: false, publicPromotion: "blocked_until_partial_evidence", requiredFields: ["scheduler", "publicTiAnswer.stateMachine.polling"] },
      live_partial: { retryable: true, terminal: false, publicPromotion: "allowed_only_as_partial", requiredFields: ["summary", "warnings", "publicTiAnswer.stateMachine.changedSinceCursor"] },
      promoted_evidence: { retryable: true, terminal: false, publicPromotion: "allowed_after_release_gates", requiredFields: ["answerDeltas", "claimLedger", "graphExport"] },
      review_required: { retryable: false, terminal: false, publicPromotion: "blocked_until_human_review", requiredFields: ["reviewGates", "warningCodes", "publicTiAnswer.stateMachine.holds"] },
      blocked: { retryable: false, terminal: true, publicPromotion: "blocked_fail_closed", requiredFields: ["safeSummary", "warningCodes", "publicTiAnswer.stateMachine.holds"] },
      no_result: { retryable: true, terminal: false, publicPromotion: "safe_empty_state_only", requiredFields: ["publicTiAnswer.stateMachine.safeNoResult", "sourceCoverage"] },
      stale: { retryable: true, terminal: false, publicPromotion: "blocked_until_fresh_evidence", requiredFields: ["warningCodes", "publicTiAnswer.caveats"] },
      contradicted: { retryable: false, terminal: false, publicPromotion: "blocked_until_contradiction_review", requiredFields: ["warningCodes", "reviewGates"] },
      source_biased: { retryable: true, terminal: false, publicPromotion: "blocked_until_source_family_diversity", requiredFields: ["sourceCoverageGaps", "publicTiAnswer.waitReasons"] },
      ready: { retryable: false, terminal: true, publicPromotion: "allowed_when_release_gates_pass", requiredFields: ["status", "runId", "cursor", "nextCursor", "publicTiAnswer"] },
      error: { retryable: "depends_on_error_code", terminal: true, publicPromotion: "blocked", requiredFields: ["error.code", "error.message"] }
    },
    requiredUiFields: ["state", "phase", "progress", "changedSinceCursor", "polling", "holds", "confidenceLabel", "caveats", "waitReasons", "safeNoResult"]
  };
  const publicAnswerReleaseCandidate = {
    schemaVersion: "ti.public_answer_release_candidate.v1",
    field: "publicTiAnswer.releaseCandidate",
    states: [
      "ready",
      "canary_ready",
      "canary_with_warnings",
      "partial",
      "review_required",
      "blocked",
      "no_result",
      "stale",
      "contradicted",
      "source_biased",
      "provider_unavailable",
      "scraper_unavailable",
      "policy_blocked"
    ],
    queryClasses: ["actor", "ransomware", "random_actor", "cve", "malware_tool", "country", "sector", "victim"],
    visibleAnswerInputs: [
      "sourceCanary",
      "schedulerControlPlane",
      "publicChannelPromotion",
      "restrictedEmergencyStop",
      "evidenceCutover",
      "graphExport",
      "apiContractState"
    ],
    requiredUiFields: ["state", "label", "visibleAnswer", "releaseGates", "effects", "agent10RcGate", "publicPostCompatibility", "fixtures"],
    fixtures: publicAnswerReleaseCandidateFixtureMatrix(),
    agent10RcGate: {
      field: "publicTiAnswer.releaseCandidate.agent10RcGate",
      statuses: ["pass", "warning", "blocker"],
      decisions: ["promote", "canary", "hold"],
      proofCommands: ["bun test", "bun run check", "bun run check:route-inventory", "bun run check:search-quality-mounted", "bun run check:scraper-native-search"]
    },
    guarantee: "release-candidate state is dry-run, no-leak, public POST compatible, and fail-closed for policy, provider, scraper, restricted emergency-stop, evidence, graph, scheduler, or canary blockers"
  };
  const publicAnswerUxSemantics = {
    schemaVersion: "ti.public_answer_ux.v1",
    field: "publicTiAnswer.ux",
    states: [
      "ready",
      "partial",
      "searching",
      "no_result",
      "provider_unavailable",
      "scraper_unavailable",
      "queue_pressure",
      "review_required",
      "stale",
      "contradicted",
      "source_biased",
      "policy_blocked",
      "restricted_held"
    ],
    queryFixtures: [
      { query: "APT29", queryClass: "actor", expectedUxState: "ready" },
      { query: "APT42", queryClass: "actor", expectedUxState: "partial" },
      { query: "Turla", queryClass: "actor", expectedUxState: "stale" },
      { query: "Volt Typhoon", queryClass: "actor", expectedUxState: "contradicted" },
      { query: "Scattered Spider", queryClass: "actor", expectedUxState: "source_biased" },
      { query: "Akira", queryClass: "ransomware", expectedUxState: "restricted_held" },
      { query: "Unseen Quartz Actor", queryClass: "random_actor", expectedUxState: "searching" },
      { query: "CVE-2026-11111", queryClass: "cve", expectedUxState: "partial" },
      { query: "Snake", queryClass: "malware_tool", expectedUxState: "partial" },
      { query: "Norway", queryClass: "country", expectedUxState: "partial" },
      { query: "energy", queryClass: "sector", expectedUxState: "partial" },
      { query: "Fjord Energy AS", queryClass: "victim", expectedUxState: "partial" }
    ],
    copyRules: {
      unknownQuery: "Searching",
      compactSummaryMaxLines: 3,
      bannedPhrases: ["not in local cache", "local cache", "demo", "default APT29"],
      noBloatedPolicyParagraph: true
    },
    freshness: {
      updatedField: "publicTiAnswer.ux.freshness.updatedAt",
      lastSeenField: "publicTiAnswer.ux.freshness.lastSeenAt",
      rule: "updated is response generation time; lastSeen is shown only when evidence supplies an observed timestamp"
    },
    polling: {
      intervalSeconds: 3,
      fields: ["publicTiAnswer.ux.polling", "refreshAfterSeconds", "nextPollSeconds"]
    },
    evidenceStageLabels: ["seeded", "live_discovery", "captured_page", "public_channel_message", "metadata_only_claim", "extracted_relationship", "reviewed_promoted"],
    publicWrapperCompatibility: {
      noDefaultQuery: true,
      canonicalMethod: "POST",
      canonicalPath: "/api/ti/search"
    }
  };
  const cutoverScenarios = [
    { code: "provider_unavailable", state: "partial", warningCode: "provider_unavailable", publicBehavior: "return cached or seed-safe partial with cursor and wait reason" },
    { code: "scraper_unavailable", state: "partial", warningCode: "scraper_unavailable", publicBehavior: "outer API may serve bounded compatibility fallback with explicit degraded warning" },
    { code: "queue_pressure", state: "partial", warningCode: "queue_pressure", publicBehavior: "reuse or defer run; expose retryAfter/refreshAfterSeconds without duplicate work" },
    { code: "stale_evidence", state: "review_required", warningCode: "stale_evidence", publicBehavior: "label stale claims and avoid confirmed wording" },
    { code: "no_approved_sources", state: "blocked", warningCode: "no_approved_sources", publicBehavior: "return safe no-result answer plus source coverage gaps" },
    { code: "policy_blocked", state: "blocked", warningCode: "policy_blocked", publicBehavior: "return policy-safe blocker without raw restricted details" },
    { code: "duplicate_run_reuse", state: "partial", warningCode: "duplicate_run_reuse", publicBehavior: "attach to existing run and preserve cursor continuity" }
  ];
  const publicWrapperResponsiveAudit = {
    schemaVersion: "ti.public_wrapper_responsive_search.v1",
    owner: "Agent 09",
    route: "GET /v1/intel/search",
    publicWrapper: {
      canonicalMethod: "POST",
      canonicalPath: "/api/ti/search",
      mapsTo: "/v1/intel/search",
      noDefaultQuery: true,
      stableRunIds: true,
      pollingSeconds: 3,
      unknownCopy: "Searching",
      updatedSemantics: "updated is response generation time; lastSeen is shown only when evidence supplies an observed timestamp",
      stableFields: ["query", "mode", "status", "runId", "cursor", "nextCursor", "refreshAfterSeconds", "publicTiAnswer"]
    },
    fixtures: [
      publicWrapperResponsiveFixture("apt29_actor", "APT29", "actor", "ready", "ready", []),
      publicWrapperResponsiveFixture("apt42_actor", "APT42", "actor", "partial", "partial", []),
      publicWrapperResponsiveFixture("turla_actor", "Turla", "actor", "stale", "review_required", ["stale_evidence"]),
      publicWrapperResponsiveFixture("volt_typhoon_actor", "Volt Typhoon", "actor", "contradicted", "review_required", ["contradicted_reporting"]),
      publicWrapperResponsiveFixture("scattered_spider_actor", "Scattered Spider", "actor", "source_biased", "partial", ["source_coverage_needs_review"]),
      publicWrapperResponsiveFixture("akira_ransomware", "Akira", "ransomware", "restricted_held", "blocked", ["metadata_only_leak_claim"]),
      publicWrapperResponsiveFixture("random_actor", "Random Actor", "random_actor", "searching", "partial", []),
      publicWrapperResponsiveFixture("made_up_actor", "Made Up Actor", "random_actor", "searching", "partial", []),
      publicWrapperResponsiveFixture("cve", "CVE-2026-11111", "cve", "partial", "partial", []),
      publicWrapperResponsiveFixture("malware_tool", "Snake", "malware_tool", "partial", "partial", []),
      publicWrapperResponsiveFixture("country", "Norway", "country", "partial", "partial", []),
      publicWrapperResponsiveFixture("sector", "energy", "sector", "partial", "partial", []),
      publicWrapperResponsiveFixture("victim", "Fjord Energy AS", "victim", "partial", "partial", []),
      publicWrapperResponsiveFixture("provider_unavailable", "APT29", "provider_unavailable", "provider_unavailable", "partial", ["provider_unavailable"]),
      publicWrapperResponsiveFixture("scraper_unavailable", "APT29", "scraper_unavailable", "scraper_unavailable", "partial", ["scraper_unavailable"]),
      publicWrapperResponsiveFixture("queue_pressure", "APT42", "queue_pressure", "queue_pressure", "partial", ["queue_pressure"]),
      publicWrapperResponsiveFixture("duplicate_run_reuse", "APT42", "duplicate_run_reuse", "partial", "partial", ["duplicate_run_reuse"]),
      publicWrapperResponsiveFixture("policy_block", "restricted leak metadata", "policy_block", "policy_blocked", "blocked", ["policy_blocked"]),
      publicWrapperResponsiveFixture("restricted_hold", "Akira victim claim", "restricted_hold", "restricted_held", "blocked", ["metadata_only_leak_claim"]),
      publicWrapperResponsiveFixture("public_channel_partial", "Scattered Spider Telegram", "public_channel_partial", "partial", "partial", ["public_channel_partial"]),
      publicWrapperResponsiveFixture("graph_evidence_promotion", "APT29 graph promotion", "graph_evidence_promotion", "ready", "ready", [])
    ],
    noLeakExamples: [
      { scenario: "restricted_hold", allowed: ["actor", "victim", "claimedDataType", "contentHash", "ledgerIds"], forbidden: ["restricted files", "credentials", "private invite links", "restricted URLs"] },
      { scenario: "public_channel_partial", allowed: ["messageUrl", "contentHash", "compactClaim", "sourceId"], forbidden: ["raw message body", "media payload", "session material"] }
    ],
    proofCommands: [
      "bun test src/tests/api.test.ts src/tests/ops.test.ts",
      "bun run check",
      "bun test",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY=APT42 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ],
    guarantee: "public wrapper search is compact, no-default-query, no-leak, stable-run-id, 3-second-polling, and uses updated response time instead of fictional lastSeen values"
  };
  const publicWrapperDeltaAudit = {
    schemaVersion: "ti.public_wrapper_delta_contract.v1",
    owner: "Agent 09",
    route: "GET /v1/intel/search",
    publicWrapperRoute: "POST /api/ti/search",
    stableFields: publicWrapperDeltaStableFields(),
    cursorContract: {
      runId: "stable for duplicate/repeated polls",
      pollCursor: "client-supplied cursor for repeated polling",
      deltaCursor: "server cursor for the newest visible delta",
      emptyDelta: "HTTP 200 with stable fields and empty changedSinceCursor",
      pollingSeconds: 3,
      updatedSemantics: "updated is response generation time; lastSeen appears only with evidence-backed activity timestamps"
    },
    fixtures: [
      publicWrapperDeltaFixture("first_response", "APT29", "actor", "first_response", "partial", []),
      publicWrapperDeltaFixture("repeated_poll_same_run_id", "APT29", "actor", "empty_delta", "partial", ["duplicate_run_reuse"]),
      publicWrapperDeltaFixture("poll_cursor_advancement", "APT42", "actor", "cursor_advancement", "partial", []),
      publicWrapperDeltaFixture("empty_delta", "Random Actor", "random_actor", "empty_delta", "partial", []),
      publicWrapperDeltaFixture("new_clear_web_capture_delta", "APT29", "actor", "clear_web_capture", "partial", []),
      publicWrapperDeltaFixture("public_channel_hint_delta", "Scattered Spider", "actor", "public_channel_hint", "partial", ["public_channel_partial"]),
      publicWrapperDeltaFixture("restricted_metadata_held_delta", "Akira", "ransomware", "restricted_metadata_held", "blocked", ["metadata_only_leak_claim"]),
      publicWrapperDeltaFixture("graph_relationship_delta", "Volt Typhoon", "actor", "graph_relationship", "review_required", ["graph_export_hold"]),
      publicWrapperDeltaFixture("claim_ledger_hold", "Turla", "actor", "claim_ledger_hold", "review_required", ["claim_ledger_hold"]),
      publicWrapperDeltaFixture("contradiction_downgrade", "Volt Typhoon", "actor", "contradiction_downgrade", "review_required", ["contradicted_reporting"]),
      publicWrapperDeltaFixture("no_result_searching", "Made Up Actor", "random_actor", "searching", "partial", []),
      publicWrapperDeltaFixture("provider_unavailable", "APT42", "provider_unavailable", "provider_unavailable", "partial", ["provider_unavailable"]),
      publicWrapperDeltaFixture("scraper_unavailable", "APT42", "scraper_unavailable", "scraper_unavailable", "partial", ["scraper_unavailable"]),
      publicWrapperDeltaFixture("queue_pressure", "Scattered Spider", "queue_pressure", "queue_pressure", "partial", ["queue_pressure"]),
      publicWrapperDeltaFixture("duplicate_run_reuse", "APT29", "duplicate_run_reuse", "empty_delta", "partial", ["duplicate_run_reuse"]),
      publicWrapperDeltaFixture("stale_source", "Turla", "actor", "stale_source", "review_required", ["stale_evidence"]),
      publicWrapperDeltaFixture("low_confidence", "Snake", "malware_tool", "low_confidence", "review_required", ["low_confidence"]),
      publicWrapperDeltaFixture("policy_block", "restricted leak metadata", "policy_block", "policy_blocked", "blocked", ["policy_blocked"]),
      publicWrapperDeltaFixture("final_ready", "APT29", "actor", "ready", "ready", []),
      publicWrapperDeltaFixture("cve", "CVE-2026-11111", "cve", "clear_web_capture", "partial", []),
      publicWrapperDeltaFixture("victim_ransomware", "Fjord Energy AS", "victim", "restricted_metadata_held", "partial", ["metadata_only_leak_claim"]),
      publicWrapperDeltaFixture("country", "Norway", "country", "clear_web_capture", "partial", []),
      publicWrapperDeltaFixture("sector", "energy", "sector", "clear_web_capture", "partial", [])
    ],
    handoffs: {
      agent02: ["runId", "pollCursor", "deltaCursor", "scheduler.cursorContinuity"],
      agent06: ["claimLedger.trustGate", "claimLedger.blockers", "claimLedger.safeOutput"],
      agent07: ["answerDeltas", "publicTiAnswer.stateMachine.changedSinceCursor"],
      agent08: ["graph.liveUpdate", "graph.exportGate"],
      agent10: ["publicWrapperDelta.compatibility", "publicWrapperDelta.polling", "publicWrapperDelta.deltas"]
    },
    noLeakExamples: [
      { scenario: "public_channel_hint_delta", forbidden: ["raw message body", "media payload", "session token"] },
      { scenario: "restricted_metadata_held_delta", forbidden: ["restricted rows", "credentials", "private access material", "restricted URL"] }
    ],
    proofCommands: [
      "bun test src/tests/api.test.ts src/tests/ops.test.ts",
      "bun run check",
      "bun test",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ],
    guarantee: "public delta polling preserves stable wrapper fields across first response, repeated polls, empty deltas, new evidence, holds, downgraded facts, and ready states with compact proof summaries only"
  };
  const routeTruthAudit = {
    schemaVersion: "ti.route_truth_audit.v1",
    owner: "Agent 09",
    mode: "dry_run_contract_audit",
    expectedRouteInventoryCount: activeRoutes.length,
    canonicalPublicPost: {
      path: "/api/ti/search",
      method: "POST",
      mapsTo: "/v1/intel/search",
      stableFields: compatibilityFields,
      getProofOptionalUnlessRequired: true
    },
    fixtures: [
      routeTruthAuditFixture("route_inventory_drift", "pass", "GET /v1/contracts", "bun run check:route-inventory", ["routeInventory.count", "routeInventory.routes", "routeInventory.routes[].owner"], "hold API cutover until missing route ownership/response keys are restored"),
      routeTruthAuditFixture("missing_schema_examples", "pass", "GET /v1/contracts", "bun run check:contract-index", ["examples", "validation.schemaExampleRule", "surfaces[].responseSchema"], "hold contract promotion until schema/example fixtures exist for every active surface"),
      routeTruthAuditFixture("public_post_compatibility", "pass", "POST /api/ti/search", "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search", ["publicCompatibility.canonicalMethod", "publicCompatibility.stableFields", "publicTiAnswer"], "restore public wrapper fallback until canonical POST returns stable top-level fields"),
      routeTruthAuditFixture("provider_unavailable", "pass", "GET /v1/intel/search", "bun test src/tests/api.test.ts", ["semantics.cutoverScenarios.provider_unavailable", "examples.providerUnavailable", "warningCodes"], "serve safe partial response with provider_unavailable warning"),
      routeTruthAuditFixture("scraper_unavailable", "pass", "GET /v1/intel/search", "bun test src/tests/ops.test.ts", ["semantics.cutoverScenarios.scraper_unavailable", "examples.scraperUnavailable", "publicCompatibility.statusMapping"], "serve bounded fallback and block promotion until scraper health recovers"),
      routeTruthAuditFixture("queue_pressure", "pass", "GET /v1/intel/search", "bun test src/tests/api.test.ts", ["semantics.cutoverScenarios.queue_pressure", "examples.queuePressure", "refreshAfterSeconds"], "reuse or defer the existing run without duplicate work"),
      routeTruthAuditFixture("stale_evidence", "pass", "GET /v1/intel/search", "bun test src/tests/pipeline.test.ts", ["semantics.cutoverScenarios.stale_evidence", "warningCodes", "publicTiAnswer.caveats"], "label stale claims and block confirmed wording"),
      routeTruthAuditFixture("no_approved_sources", "pass", "GET /v1/intel/search", "bun test src/tests/sourceSeeds.test.ts", ["semantics.cutoverScenarios.no_approved_sources", "examples.noApprovedSources", "sourceCoverageGaps"], "return safe blocked/no-result state with remediation gaps"),
      routeTruthAuditFixture("policy_blocked", "pass", "GET /v1/intel/search", "bun test src/tests/api.test.ts", ["semantics.cutoverScenarios.policy_blocked", "examples.policyBlocked", "reviewGates"], "fail closed without raw restricted details"),
      routeTruthAuditFixture("duplicate_run_reuse", "pass", "POST /v1/intel/runs", "bun test src/tests/api.test.ts", ["semantics.cutoverScenarios.duplicate_run_reuse", "idempotency", "cursorPolling"], "attach callers to existing run and preserve cursor continuity"),
      routeTruthAuditFixture("delta_polling_contract", "pass", "GET /v1/intel/search", "bun test src/tests/api.test.ts", ["publicWrapperDelta", "pollCursor", "deltaCursor", "updated"], "freeze public POST delta polling shape before frontend promotion"),
      routeTruthAuditFixture("empty_delta_poll", "pass", "GET /v1/intel/search", "bun test src/tests/api.test.ts", ["publicWrapperDelta.polling.changedSinceCursor.empty", "runId", "pollCursor"], "return stable empty-delta response instead of changing shape"),
      routeTruthAuditFixture("public_post_poll_compatibility", "pass", "POST /api/ti/search", "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search", ["publicWrapperDelta.compatibility", "publicCompatibility.stableFields", "validation.publicProofs"], "restore public wrapper fallback if POST polling drops stable fields"),
      routeTruthAuditFixture("restricted_emergency_stop", "pass", "GET /v1/restricted-metadata/status", "bun test src/tests/darknetMetadata.test.ts", ["restrictedMetadataEmergencyStopCertification", "restrictedMetadataKillSwitchDrills", "noLeakGuarantees"], "hold or roll back public promotion when restricted emergency-stop controls fire"),
      routeTruthAuditFixture("canary_rc_decision", "pass", "GET /v1/contracts", "bun test src/tests/ops.test.ts", ["publicAnswerReleaseCandidate.agent10RcGate", "sourceRolloutPromotionPacket", "schedulerCanaryControlPlane"], "hold RC promotion unless Agent 10 canary gate passes"),
      routeTruthAuditFixture("no_leak_examples", "pass", "GET /v1/contracts", "bun run check:contract-index", ["noLeakGuarantees", "validation.schemaExampleRule", "examples"], "remove or redact any example that exposes raw payloads, credentials, cookies, object keys, or restricted URLs")
    ],
    proofCommands: [
      "bun run check:contract-index",
      "bun run check:route-inventory",
      "bun test src/tests/api.test.ts src/tests/ops.test.ts",
      "bun test",
      "bun run check",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY=APT42 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ],
    guarantee: "route truth audit is dry-run, route-visible, no-leak, public POST compatible, and fail-closed for route drift, missing examples, provider/scraper failures, queue pressure, stale evidence, no approved sources, policy blocks, duplicate reuse, restricted emergency stop, and canary RC holds"
  };

  return {
    endpoint: "/v1/contracts",
    version: "v1",
    schemaVersion: "ti.scraper.enterprise_api_contract.v1",
    generatedAt: nowIso(),
    routeInventory: {
      count: activeRoutes.length,
      source: "src/api/server.ts",
      routes: activeRoutes.map((route) => ({
        ...route,
        contract: `${route.surface}.response`,
        guarantees: ["versioned_v1", "compact_json", "no_leak_dto"]
      }))
    },
    routeTruthAudit,
    publicWrapperResponsiveAudit,
    publicWrapperDeltaAudit,
    publicCompatibility: {
      canonicalPublicPath: "/api/ti/search",
      canonicalMethod: "POST",
      getProofOptionalUnlessRequired: true,
      mapsTo: "/v1/intel/search",
      stableFields: compatibilityFields,
      publicAnswerContract: {
        schemaVersion: "ti.public_answer_contract.v1",
        field: "publicTiAnswer",
        nestedAnswerField: "answer.publicContract",
        states: ["ready", "partial", "review_required", "blocked"],
        queryClasses: ["actor", "ransomware", "cve", "malware_tool", "country", "sector", "unknown"],
        requiredSections: [
          "stateMachine",
          "releaseCandidate",
          "ux",
          "publicWrapperDelta",
          "safeSummary",
          "recentAttacks",
          "targets",
          "ttps",
          "datasets",
          "sources",
          "confidence",
          "caveats",
          "waitReasons",
          "nextPoll",
          "sourceCoverageGaps",
          "evidenceLedgerReferences",
          "graphStixReadiness",
          "deltas",
          "safeWording"
        ],
        safeWordingGuarantee: "partial, live-snippet, source-biased, stale, contradicted, and blocked answers must not be worded as confirmed facts"
      },
      statusMapping: {
        ready: "HTTP 200 with stable fields and promotable public answer",
        partial: "HTTP 200 with stable fields, warnings, cursor, nextCursor, and refreshAfterSeconds",
        review_required: "HTTP 200 with stable fields, reviewGates, warningCodes, and non-promoted facts",
        blocked: "HTTP 200 with stable fields, safe blockers, and no raw restricted material",
        error: "standard error envelope with no raw evidence"
      }
    },
    semantics: {
      stateMachine,
      publicAnswerReleaseCandidate,
      publicAnswerUxSemantics,
      publicWrapperResponsiveAudit,
      publicWrapperDeltaAudit,
      cutoverScenarios,
      cursorPolling: {
        requestFields: ["cursor"],
        responseFields: ["cursor", "nextCursor", "pollCursor", "deltaCursor", "refreshAfterSeconds", "nextPollSeconds"],
        guarantee: "cursor and nextCursor remain present for ready, partial, review-required, and blocked search states"
      },
      idempotency: {
        header: "idempotency-key",
        route: "POST /v1/intel/runs",
        behavior: "same tenant and body returns the existing run; conflicting body returns idempotency_conflict"
      },
      warningCodes: [
        "weak-evidence",
        "needs_review",
        "queue_pressure",
        "scraper_unavailable",
        "no_approved_sources",
        "policy_blocked",
        "duplicate_run_reuse",
        "provider_unavailable",
        "metadata_only_leak_claim",
        "alias_collision",
        "stale_evidence",
        "graph_export_hold",
        "source_coverage_needs_review",
        "scheduler_migration_postgres_shadow",
        "scheduler_migration_redis_shadow",
        "scheduler_migration_nats_shadow",
        "scheduler_cursor_replay_required",
        "scheduler_stream_pending_review",
        "scheduler_ack_wait_review",
        "scheduler_retry_debt_watch",
        "scheduler_dead_letter_watch",
        "scheduler_cursor_waiting_for_deltas"
      ],
      restrictedMetadataConnectorCertification: {
        field: "restrictedMetadata.connectorCertification",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search"],
        scenarios: restrictedMetadataConnectorCertificationContract().fixtureScenarios,
        packetFields: ["packetId", "sourceId", "network", "connectorKind", "scenario", "status", "dryRunOnly", "metadataOnly", "safeForApi", "networkIsolation", "approval", "killSwitch", "timeoutAttribution", "maxMetadataFields", "redaction", "retention", "guarantees", "evidence", "agent06LedgerAction", "agent09WarningCodes", "agent10EmergencyStopReleaseTrain", "noLeakSerialization"],
        guarantee: "dry-run metadata-only certification; no contact, no downloads, no credential bypass, no CAPTCHA solving, no stealth, and unsafe targets represented only by hashes"
      },
      restrictedMetadataKillSwitchDrills: {
        field: "restrictedMetadata.killSwitchDrills",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search"],
        scenarios: restrictedMetadataKillSwitchDrillContract().fixtureScenarios,
        packetFields: ["packetId", "scenario", "operatorVisible", "drillState", "approvalProof", "proxyIsolation", "killSwitchPropagation", "timeoutAttribution", "redaction", "retention", "unsafeTargetRejection", "guarantees", "evidence", "agent06LedgerAction", "agent09WarningCodes", "agent10RcGate", "noLeakSerialization"],
        guarantee: "operator-visible dry-run drills for kill-switch propagation and blocked public API states; metadata-only with no contact, no downloads, and hash-only unsafe target evidence"
      },
      restrictedMetadataEmergencyStopCertification: {
        field: "restrictedMetadata.emergencyStopCertification",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search"],
        scenarios: restrictedMetadataEmergencyStopCertificationContract().fixtureScenarios,
        packetFields: ["packetId", "scenario", "rcGate", "controls", "approvalProof", "proxyIsolation", "timeoutAttribution", "redaction", "retention", "unsafeTargetRejection", "proof", "evidence", "agent06EvidenceRedactionCertification", "agent09WarningCodes", "agent10EmergencyStopGate", "noLeakSerialization"],
        guarantee: "final dry-run release-candidate emergency-stop certification; proves hold, pause, rollback, and emergency-stop controls without unsafe access, data exposure, contact, downloads, credential bypass, CAPTCHA solving, or stealth"
      },
      restrictedMetadataNonBlockingSearch: {
        field: "restrictedMetadata.nonBlockingSearch",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataNonBlockingSearchContract().fixtureScenarios,
        packetFields: ["packetId", "scenario", "publicSearchAction", "restrictedContext", "publicAnswerInfluence", "policyGate", "agent06EvidenceGate", "agent07PublicAnswerState", "agent09WarningCodes", "agent10EmergencyStopBoard", "proof", "noLeakSerialization"],
        guarantee: "restricted Tor/I2P/Freenet/leak-site metadata never blocks clear-web or public-channel search; it remains held metadata-only policy-gated context with no unsafe access, no data exposure, no public-answer promotion, and no-leak serialization"
      },
      restrictedMetadataAnalystOperations: {
        field: "restrictedMetadata.analystOperations | analystLoop",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/evidence/claim-ledger", "/v1/contracts"],
        scenarios: restrictedMetadataAnalystOperationsContract().fixtureScenarios,
        packetFields: ["packetId", "scenario", "analystState", "resultState", "schedulerIsolation", "victimNotificationPacket", "claimLedger", "agent01GovernanceGate", "agent02SchedulerGate", "agent06EvidenceGate", "agent07AnswerState", "agent08GraphHold", "agent09WarningCodes", "agent10EmergencyStopGate", "proof", "whatWasNotAccessed", "noLeakSerialization"],
        guarantee: "restricted-source analyst operations stay metadata-only and victim-safe: approval workflow, proxy isolation, review, notification drafts, claim ledger, retention, redaction, and emergency stop without stolen-file downloads, credentials, auth/CAPTCHA bypass, private access, threat actor interaction, or raw unsafe URLs"
      },
      restrictedMetadataIsolationHarness: {
        field: "restrictedMetadata.isolationHarness",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataIsolationHarnessContract().fixtureScenarios,
        packetFields: ["packetId", "scenario", "nonNetworked", "connectorBoundary", "workerIsolation", "deniedOperation", "complianceEvidence", "proof", "noLeakSerialization"],
        guarantee: "non-networked Tor/I2P/Freenet metadata connector isolation harness proves approved proxy boundaries, kill-switch propagation, timeout attribution, unsafe target denial, no credential storage, no private access, no threat-actor interaction, and Agent 10 compliance evidence without live restricted access"
      },
      graphExportCertification: {
        field: "graph.certification | readiness.certification | runtime.certification",
        routes: ["/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/intel/search", "/v1/contracts"],
        scenarios: [
          "apt29_actor_profile",
          "scattered_spider_actor_profile",
          "akira_victim_profile",
          "turla_actor_profile",
          "cve_exploitation",
          "weak_co_mention",
          "restricted_only_evidence",
          "missing_ledger_id",
          "schema_risk_export",
          "missing_provenance",
          "contradicted_relationship",
          "stale_relationship",
          "analyst_reviewed_promotion"
        ],
        packetFields: ["endpoint", "generatedAt", "status", "scenarioCount", "passCount", "holdCount", "rollbackCount", "scenarios", "rcGate", "noUnsupportedTaxiiServerClaims", "releasePacket"],
        guarantee: "final dry-run graph/STIX release-candidate gate; TAXII output is descriptor metadata and no full TAXII server is claimed"
      },
      graphLiveSearchUpdate: {
        field: "graph.liveUpdate | graph.runtime.liveUpdate | readiness.runtime.liveUpdate",
        routes: ["/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/intel/search.graph", "/v1/contracts"],
        scenarios: [
          "apt29_clear_web",
          "apt42_clear_web",
          "turla_clear_web",
          "volt_typhoon_public_channel",
          "scattered_spider_clear_web",
          "akira_restricted_held",
          "cve_exploitation",
          "random_actor_weak_discovery",
          "weak_co_mention",
          "public_channel_only_hint",
          "restricted_held_evidence",
          "missing_ledger_id",
          "stale_relationship",
          "contradicted_relationship",
          "missing_provenance",
          "accepted_promotion",
          "stix_export_eligible"
        ],
        deltaStreamFixtures: [
          "clear_web_capture_promotion",
          "public_channel_hint",
          "restricted_metadata_held",
          "claim_ledger_hold",
          "missing_ledger_id",
          "weak_co_mention_pivot",
          "actor_alias_collision",
          "contradicted_attribution",
          "stale_ttp",
          "new_victim_claim",
          "new_cve_exploitation_claim",
          "malware_tool_relation",
          "infrastructure_relation",
          "analyst_accepted_promotion",
          "analyst_rejected_relation",
          "graph_rollback",
          "stix_export_eligibility_change"
        ],
        packetFields: ["mode", "responsePolicy", "nextPollSeconds", "cursorField", "deltaCounts", "scenarioCoverage", "deltaStream", "weakDiscoveryPolicy", "publicChannelPolicy", "restrictedEvidencePolicy", "stixPolicy", "agentHandoffs", "taxiiBoundary"],
        guarantee: "incremental live-search graph updates use seconds-level polling; graph delta stream fixtures expose review holds, Agent 06 ledger gates, Agent 07 caveats, Agent 09 cursors, Agent 10 release gates, and weak/public/restricted evidence remains caveated until ledger, review, and STIX gates pass"
      },
      graphBackendRepository: {
        field: "graph.runtime.backendContract | readiness.runtime.backendContract",
        routes: ["/v1/graph/query", "/v1/graph/review-plan", "/v1/exports/stix", "/v1/intel/search.graph", "/v1/contracts"],
        backendCandidates: ["memory_snapshot", "postgres_graph_tables", "neo4j"],
        operations: ["upsert_node", "upsert_relationship", "append_provenance", "append_review_decision", "append_confidence_history", "record_cursor_delta", "update_export_eligibility"],
        packetFields: ["tenantScope", "operations", "reviewWorkflow", "exportEligibility", "cursorDeltas", "handoffs"],
        guarantee: "backend-neutral graph repository contract preserves tenant scope, provenance chains, append-only review audit, accepted/rejected/stale/contradicted workflow state, STIX eligibility, and cursor deltas without changing public graph DTOs"
      },
      publicChannelCanary: {
        routes: ["/v1/public-channels/status", "/v1/public-channels/apply-plan", "/v1/intel/search"],
        fields: ["canaryRollout", "promotionCanary", "promotionCertification", "signalFusion", "selectedSources", "pendingCandidates", "sourceHealth", "controls", "agent06EvidenceHandoff", "agent07AnswerCaveats", "agent10ReleaseTrain"],
        guarantee: "dry-run only; public approved sources only; no private invite, account automation, raw media, credential, or raw message payload material"
      },
      publicChannelPromotionCanary: {
        fields: ["sourceHealth", "evidenceFlow", "claimCandidates", "graphHints", "agent06EvidenceCutover", "agent07PublicAnswer", "agent10RcGate"],
        healthSignals: ["rateLimitDebt", "duplicateUrlPressure", "editDeleteChurn", "unavailableWindows", "languageDrift", "spamChurn", "evidenceYield", "claimYield", "rollbackTriggers"],
        guarantee: "promotion proof is dry-run and serializes only message URLs, hashes, ledger ids, compact claims, graph hints, and metadata-only health fields"
      },
      publicChannelPromotionCertification: {
        routes: ["/v1/public-channels/status", "/v1/public-channels/apply-plan", "/v1/intel/search", "/v1/contracts"],
        fields: ["decisionRules", "evidenceCertification", "claimCertification", "graphCertification", "agent06EvidenceCertification", "agent07AnswerStateMachine", "agent08GraphCertification", "agent10RcGate"],
        influenceSurfaces: ["public_answer", "graph", "source_health", "release"],
        guarantee: "dry-run certification of when public-channel evidence may influence answers, graph hints, source health, and release decisions; no raw message, private channel, media payload, credential, or session material"
      },
      sourceActivationExecutionReadiness: {
        routes: ["/v1/sources/coverage-closeout", "/v1/sources/activation-batches", "/v1/intel/search", "/v1/contracts"],
        fields: ["first10Canary", "publicRollout50", "excludedSources", "coverageByQueryClass", "sourceRetirement", "duplicateSuppression", "parserGapHandoff", "queueBudgetImpact", "postActivationDriftChecks", "agent10ReleasePacket"],
        guarantee: "dry-run only; first production source rollout packets do not mutate registry state, start crawling, or admit restricted/private/leaked/auth/CAPTCHA/chat sources"
      },
      sourceRolloutPromotionPacket: {
        routes: ["/v1/sources/coverage-closeout", "/v1/sources/activation-batches", "/v1/intel/search", "/v1/contracts"],
        fields: ["rolloutPromotion", "coverageImpacts", "publicTiAnswerEffect", "agent02SchedulerTelemetry", "agent06EvidenceCertification", "agent07PollingState", "agent09ContractIndex", "agent10CanaryReleaseDecision"],
        guarantee: "dry-run canary-to-expanded rollout promotion only; safe-public sources, no registry mutation, no queue leasing, and no crawl start"
      },
      schedulerCanaryControlPlane: {
        routes: ["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search", "/v1/contracts"],
        fields: ["controls", "headroom", "warningCodes", "routeContracts", "agent10ReleaseDecision"],
        actions: ["start", "pause", "drain", "rollback", "expand"],
        guarantee: "scheduler canary execution control plane is dry-run only; it exposes queue deltas, partition effects, cursor/replay preservation, rollback steps, and headroom without leasing, acknowledging, or mutating queue state"
      },
      evidencePersistenceCertification: {
        field: "claimLedger.certification | cutoverReport.trustLedger.certification | sla.claimLedger.certification",
        routes: ["/v1/evidence/claim-ledger", "/v1/evidence/cutover-report", "/v1/intel/search", "/v1/contracts"],
        scenarios: [
          "clean_cutover",
          "missing_object",
          "hash_mismatch",
          "stale_extractor_replay",
          "restricted_metadata_redaction",
          "retired_source",
          "graph_hold",
          "low_confidence",
          "duplicate_claim",
          "cursor_gap",
          "retention_expiry",
          "legal_hold",
          "object_store_write_failure"
        ],
        packetFields: ["status", "releaseAction", "objectStore", "postgresRepository", "cursorReplay", "retention", "redaction", "claimPromotion", "fixtures", "downstream", "proofCommands", "safeOutput"],
        guarantee: "route-ready dry-run certification for object store, Postgres-like repository, cursor replay, retention, deletion audit, duplicate suppression, redaction, legal hold, missing-object repair, and restart replay without exposing raw bodies or object keys"
      },
      noLeakGuarantees,
      errorEnvelope: commonErrorEnvelope
    },
    surfaces: [
      contractSurface("search", "GET", "/v1/intel/search", "Agent 09", ["query", "mode", "status", "runId", "cursor", "nextCursor", "pollCursor", "deltaCursor", "updated", "sla", "quality", "actorProfile", "answer", "publicTiAnswer", "publicWrapperDelta"], ["compatibility_fields", "cursor_polling", "delta_polling", "sla_enforcement", "public_answer_contract", "no_leak_dto"]),
      contractSurface("run_status", "GET", "/v1/intel/runs/{id}", "Agent 09", ["run", "frontier"], ["idempotency_linkage", "scheduler_visibility"]),
      contractSurface("run_results", "GET", "/v1/intel/runs/{id}/results", "Agent 09", ["run", "results"], ["pagination", "include_filters", "safe_capture_dto"]),
      contractSurface("sources", "GET/POST/PATCH", "/v1/sources/*", "Agent 01/09", ["sources", "applyPlan", "queries", "activationWaves", "executionReadiness", "rolloutPromotion", "releasePacket"], ["source_governance", "coverage_closeout", "source_activation_execution_readiness", "source_rollout_promotion_packet", "dry_run_apply_plans"]),
      contractSurface("frontier", "GET/POST", "/v1/frontier/*", "Agent 02/09", ["queue", "summary", "scheduler", "applyPlan"], ["queue_pressure", "worker_queue_cutover", "worker_soak_migration", "scheduler_adapter_telemetry", "scheduler_canary_control_plane", "dry_run_scheduler_repairs"]),
      contractSurface("public_channels", "GET/POST", "/v1/public-channels/*", "Agent 04/09", ["status", "sla", "promotion", "applyPlan", "canaryRollout", "publicSignalFusion"], ["public_channel_sla", "source_pack_readiness", "canary_rollout", "public_signal_fusion", "no_raw_payload"]),
      contractSurface("restricted_metadata", "GET/POST", "/v1/restricted-metadata/*", "Agent 05/09", ["status", "applyPlan", "connectorCertification", "killSwitchDrills", "emergencyStopCertification", "nonBlockingSearch", "analystOperations", "isolationHarness"], ["metadata_only", "kill_switch", "safe_hashes", "dry_run_connector_certification", "kill_switch_drills", "emergency_stop_certification", "non_blocking_public_search", "analyst_operations_victim_safe", "non_networked_isolation_harness", "no_leak_serialization"]),
      contractSurface("evidence", "GET", "/v1/evidence/*", "Agent 06/09", ["contract", "replayPlan", "cutoverReport", "trustLedger", "certification"], ["claim_ledger", "cursor_replay", "persistence_certification", "no_object_key_leak"]),
      contractSurface("quality", "GET", "/v1/quality/evaluate", "Agent 07/09", ["query", "quality", "publicTiAnswer", "examples"], ["answer_readiness", "public_answer_contract", "review_required_states"]),
      contractSurface("graph", "GET", "/v1/graph/*", "Agent 08/09", ["contract", "graph", "timeline", "reviewPlan", "cutoverReport", "liveUpdate"], ["graph_enforcement", "graph_export_certification", "graph_live_update", "graph_stix_rc_gate", "stix_mapping", "review_workflow"]),
      contractSurface("stix", "GET/POST", "/v1/exports/stix", "Agent 08/09", ["readiness", "bundle", "liveUpdate"], ["stix_readiness", "schema_safe", "ledger_complete", "graph_live_update", "graph_stix_rc_gate", "taxii_descriptor_only"]),
      contractSurface("ops", "GET", "/v1/ops/resource-snapshot", "Agent 10/09", ["resources", "capacity", "workerPools", "queue"], ["resource_budget", "worker_supervision"])
    ],
    examples: {
      publicPostSearch: {
        request: { method: "POST", path: "/api/ti/search", body: { q: "APT29" } },
        response: {
          status: "ready | partial | review_required | blocked",
          runId: "run_*",
          cursor: "cursor_*",
          nextCursor: "cursor_*",
          publicTiAnswer: {
            schemaVersion: "ti.public_answer_contract.v1",
            displayState: "ready | partial | review_required | blocked",
            safeSummary: ["Evidence-backed summary or explicit partial/no-result wording."],
            evidenceLedgerReferences: [{ claimKind: "actor", value: "APT29", ledgerIds: ["ledger_*"], evidenceIds: ["ev_*"] }]
          }
        }
      },
      runCreateIdempotent: {
        request: { method: "POST", path: "/v1/intel/runs", headers: { "idempotency-key": "client-generated-key" }, body: { query: "APT29", entityType: "actor" } },
        response: { run: { id: "run_*", requestHash: "stable hash", idempotencyKey: "client-generated-key" } }
      },
      providerUnavailable: {
        response: { status: "partial", warningCodes: ["provider_unavailable"], warnings: ["Provider unavailable; returning safe partial response."], cursor: "cursor_*", nextCursor: "cursor_*" }
      },
      scraperUnavailable: {
        response: { status: "partial", warningCodes: ["scraper_unavailable"], refreshAfterSeconds: 30, publicTiAnswer: { displayState: "partial", waitReasons: ["scraper_unavailable"] } }
      },
      queuePressure: {
        response: { status: "partial", warningCodes: ["queue_pressure", "duplicate_run_reuse"], runId: "run_existing", cursor: "cursor_existing", nextCursor: "cursor_existing_next" }
      },
      noApprovedSources: {
        response: { status: "blocked", warningCodes: ["no_approved_sources"], sourceCoverageGaps: ["safe_public_sources_missing"], publicTiAnswer: { displayState: "blocked", safeSummary: ["No approved sources are available for this query class."] } }
      },
      policyBlocked: {
        response: { status: "blocked", warningCodes: ["policy_blocked"], blockers: ["restricted_source_not_approved"], publicTiAnswer: { displayState: "blocked" } }
      },
      errorEnvelope: commonErrorEnvelope
    },
    validation: {
      routeInventory: "bun run check:route-inventory",
      apiTests: "bun test src/tests/api.test.ts src/tests/ops.test.ts",
      typecheck: "bun run check",
      fullTests: "bun test",
      publicProofs: [
        "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
        "TI_SEARCH_READINESS_QUERY=APT42 bun run check:scraper-native-search",
        "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
        "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
      ],
      contractIndexProof: "GET /v1/contracts; assert routeInventory.count covers every active /v1 handler and examples pass no-leak serialization",
      schemaExampleRule: "examples must not contain forbidden raw payload, credentials, cookies, authorization headers, object keys, or restricted raw URLs"
    }
  };
}

function contractSurface(
  name: string,
  method: string,
  path: string,
  owner: string,
  responseKeys: string[],
  guarantees: string[]
) {
  return {
    name,
    method,
    path,
    owner,
    responseKeys,
    guarantees,
    responseSchema: Object.fromEntries(responseKeys.map((key) => [key, { required: true, type: "object | array | string | number | boolean" }])),
    errorEnvelope: { error: { code: "string", message: "string", details: "object?" } }
  };
}

function routeTruthAuditFixture(
  name: string,
  status: "pass" | "warning" | "blocker",
  route: string,
  proofCommand: string,
  auditFields: string[],
  rollbackPath: string
) {
  return {
    name,
    status,
    route,
    proofCommand,
    auditFields,
    publicPostCompatible: true,
    noLeakRequired: true,
    rollbackPath
  };
}

function publicWrapperResponsiveFixture(
  name: string,
  query: string,
  queryClass: string,
  expectedUxState: string,
  expectedDisplayState: string,
  warningCodes: string[]
) {
  return {
    name,
    query,
    queryClass,
    route: "GET /v1/intel/search",
    publicWrapperRoute: "POST /api/ti/search",
    expectedUxState,
    expectedDisplayState,
    warningCodes,
    pollSeconds: 3,
    stableRunId: true,
    publicPostCompatible: true,
    noDefaultActor: true,
    noLeakRequired: true,
    noStaleCacheCopy: true,
    compactUnknownCopy: expectedUxState === "searching" ? "Searching" : undefined,
    updatedSemantics: "updated is response generation time; lastSeen only appears with evidence timestamps",
    stableFields: ["query", "mode", "status", "runId", "cursor", "nextCursor", "refreshAfterSeconds", "publicTiAnswer"],
    proofCommand: "bun run check:scraper-native-search"
  };
}

function publicWrapperDeltaFixture(
  name: string,
  query: string,
  queryClass: string,
  deltaKind: string,
  expectedDisplayState: string,
  warningCodes: string[]
) {
  return {
    name,
    query,
    queryClass,
    deltaKind,
    expectedDisplayState,
    warningCodes,
    route: "GET /v1/intel/search",
    publicWrapperRoute: "POST /api/ti/search",
    stableRunId: true,
    pollSeconds: 3,
    requiresPollCursor: true,
    requiresDeltaCursor: true,
    publicPostCompatible: true,
    noLeakRequired: true,
    stableFields: publicWrapperDeltaStableFields(),
    handoffs: ["Agent 02 scheduler cursors", "Agent 06 claim ledger", "Agent 07 answer deltas", "Agent 08 graph deltas", "Agent 10 release board"]
  };
}

const EMPTY_OBJECT_STORE: ObjectEvidenceStore = {
  putObject() {
    throw new Error("read-only object store");
  },
  getObject() {
    return undefined;
  },
  deleteObject() {
    return false;
  }
};

async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    return {} as T;
  }
}

function numericParam(value: string | null): number | undefined {
  if (value === null || !value.trim()) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function defaultSourcePacks(input: Record<string, unknown>): Promise<SeedSourceBundle[]> {
  const sourcePackIds = Array.isArray(input.sourcePackIds) ? input.sourcePackIds.map(String) : [];
  if (!sourcePackIds.includes("safe-public-cti-starter-pack")) return [];
  return [await Bun.file("seeds/public_cti_starter_pack.json").json() as SeedSourceBundle];
}

async function defaultCoverageSourcePacks(input: Record<string, unknown>): Promise<SeedSourceBundle[]> {
  const sourcePackIds = Array.isArray(input.sourcePackIds) ? input.sourcePackIds.map(String) : ["safe-public-cti-starter-pack"];
  if (!sourcePackIds.includes("safe-public-cti-starter-pack")) return [];
  return [await Bun.file("seeds/public_cti_starter_pack.json").json() as SeedSourceBundle];
}
