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
  buildSchedulerWorkerLeaseSoakHarness,
  buildSchedulerProductionAdapterTelemetry,
  buildSchedulerCanaryControlPlane,
  buildSchedulerDurableBackendReadiness,
  buildSchedulerFreshnessSloEngine,
  buildSchedulerFreshnessSloDashboard,
  buildSchedulerDailyActorRunPlan,
  buildSchedulerInteractiveSearchFreshness,
  buildSchedulerProductionLeaseSemantics,
  buildSchedulerFairnessGovernance,
  buildSchedulerPersistenceReplayCutover,
  buildSchedulerPostgresQueueAdapterReadiness,
  buildSchedulerDiagnostics,
  schedulerBackpressureSummaryForTasks,
  SCHEDULER_CUTOVER_DESIGN
} from "../frontier/schedulerProduction.ts";
import {
  activatePublicCanarySources,
  buildCanaryReadinessPacket,
  buildCanaryOperatorSummary,
  buildCanarySoakReport,
  pausePublicCanarySources,
  runCanaryCollectionCycle,
  type CanaryCollectionLoopHandle,
  type CanaryFetch
} from "../ops/canaryCollection.ts";
import { buildResourceSnapshot, estimateCapacity, sizeWorkerPools } from "../ops/resourceControls.ts";
import type { WorkerSupervisor } from "../ops/supervisor.ts";
import { buildLiveActorIntelligenceDto, buildPublicIntelAnswerDto } from "../pipeline/actorProfileFusion.ts";
import { buildActiveLearningCandidateQueueDto, buildActorProfileReviewWorkbenchDto, buildAnalystFeedbackLearningLoopDto, buildAnalystFeedbackLoopDto, buildAnalystQualityReviewQueueDto, buildQualityRegressionSuiteDto } from "../pipeline/analystFeedback.ts";
import { buildAttackMappingQualityDto } from "../pipeline/attackMappingQuality.ts";
import { buildEntityResolutionWorkbenchDto } from "../pipeline/entityResolution.ts";
import { buildCtiEvaluationDatasetPackDto, buildEvaluationDatasetGovernanceDto, buildQualityRuntimeValueGatesDto } from "../pipeline/evaluation.ts";
import type { EvidenceStage, StagedEvidenceInput } from "../pipeline/intelligenceProfiles.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import {
  buildSearchQualityDashboardDto,
  buildSearchQualityApiDto,
  evaluateSearchQualityGate,
  searchQualityApiExamples,
  type GraphReviewState,
  type SearchQualityApiDto,
  type SearchQualityDashboardDto
} from "../pipeline/searchQualityGate.ts";
import { buildHighPriorityActorFreshnessDashboardDto, buildTimelinessGroundTruthHarnessDto } from "../pipeline/timelinessGroundTruth.ts";
import { createCollectionPlan, createLiveSearchPlan } from "../planner/intelligencePlanner.ts";
import { buildLiveProductSloDashboard, type LiveProductProofMode } from "../ops/productSlo.ts";
import { RssAdapter } from "../adapters/rss.ts";
import { StaticWebAdapter, type StaticWebAdapterOptions } from "../adapters/staticWeb.ts";
import { buildDarkwebIndexStatus, darkwebIndexContract, searchDarkwebIndex } from "../adapters/darkwebIndex.ts";
import { buildRestrictedMetadataOperationsStatus, planDarknetMetadataLiveSearch, restrictedMetadataAnalystOperationsContract, restrictedMetadataCapacityIsolationContract, restrictedMetadataCapacitySloContract, restrictedMetadataConnectorCertificationContract, restrictedMetadataDarkCanaryContract, restrictedMetadataEmergencyStopCertificationContract, restrictedMetadataEvidenceHoldReleaseDrillContract, restrictedMetadataIsolationHarnessContract, restrictedMetadataKillSwitchDrillContract, restrictedMetadataLegalEthicsAuditExportContract, restrictedMetadataNonBlockingSearchContract, restrictedMetadataOperatorGovernanceContract, restrictedMetadataOperationalPlaybooksContract, restrictedMetadataPolicyAuditExportContract, restrictedMetadataQualityEvaluationContract, restrictedMetadataReviewHealthContract } from "../adapters/darknetMetadata.ts";
import { buildTelegramPublicActorReadinessDto, buildTelegramPublicCanaryRollout, buildTelegramPublicCompactSearchSummary, buildTelegramPublicCutoverReport, buildTelegramPublicOperatorControlEffects, buildTelegramPublicOperatorStates, buildTelegramPublicPromotionCanaryProof, buildTelegramPublicPromotionCertification, buildTelegramPublicReliabilityReport, buildTelegramPublicSlaReport, buildTelegramPublicSourcePackCompatibility, buildTelegramPublicSourcePackReadiness, planTelegramPublicSearchBackfill, publicChannelEvidenceFromCapture, type TelegramPublicSourcePack } from "../adapters/telegramPublic.ts";
import { buildPublicSignalFusionWorkbench } from "../adapters/publicSignalFusion.ts";
import type { ObjectEvidenceStore } from "../storage/evidenceStore.ts";
import { buildAnalystLoopPersistenceReadinessPacket } from "../storage/analystLoopPostgres.ts";
import type { ScraperStore } from "../storage/memoryStore.ts";
import type { SeedSourceBundle } from "../registry/sourceSeeds.ts";
import { buildSourceActivationBatchApiResponse, buildSourceActivationReport, buildSourceCoverageCloseoutApiResponse, buildSourceCoveragePlanApiResponse, buildSourceMarketplaceApiResponse, buildSourcePortfolioApiResponse, buildSourceRuntimeSlaApiResponse, buildTiSourceAtlasApiResponse, buildTiSourceAtlasExportManifestApiResponse, importSeedBundle } from "../registry/sourceSeeds.ts";
import type {
  AnalystClaimLedgerEntry,
  AnalystLoopSnapshot,
  AnalystMetadataReviewTask,
  AnalystReviewAction,
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
  RetentionClass,
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
  canaryLoop?: CanaryCollectionLoopHandle;
  disableBundledSourcePack?: boolean;
  disableOnDemandClearWebCapture?: boolean;
}

export interface ApiServerHandle {
  port: number;
  stop(): void;
}

const CONTRACT_INDEX_FORBIDDEN_VALUE_PATTERNS = [
  "cookie=",
  "authorization:",
  "set-cookie",
  "password=",
  "object_key_value",
  "raw proof payload"
];

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

  if (request.method === "GET" && url.pathname === "/v1/ops/product-slo") {
    return json(buildOpsProductSloDashboard(options, url));
  }

  if (request.method === "GET" && url.pathname === "/v1/ops/canary") {
    return json({
      operatorView: buildCanaryOperatorSummary({
        store: options.store,
        frontier: options.frontier,
        generatedAt: url.searchParams.get("generatedAt") ?? undefined,
        runtime: options.canaryLoop?.getState()
      })
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/ops/canary/readiness") {
    const requiredQueries = (url.searchParams.get("requiredQueries") ?? "APT42,Turla")
      .split(",")
      .map((query) => query.trim())
      .filter(Boolean);
    const generatedAt = url.searchParams.get("generatedAt") ?? undefined;
    const readiness = buildCanaryReadinessPacket({
      store: options.store,
      frontier: options.frontier,
      generatedAt,
      minActiveSources: numberParam(url.searchParams.get("minActiveSources")),
      maxFreshnessSeconds: numberParam(url.searchParams.get("maxFreshnessSeconds")),
      requiredQueries,
      requireExternalObjectStorage: url.searchParams.get("requireExternalObjectStorage") !== "false",
      requireNativeLiveHttp: url.searchParams.get("requireNativeLiveHttp") === "true"
    });
    return json({
      readiness,
      operatorView: buildCanaryOperatorSummary({
        store: options.store,
        frontier: options.frontier,
        generatedAt,
        runtime: options.canaryLoop?.getState()
      })
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/ops/canary/soak") {
    const generatedAt = url.searchParams.get("generatedAt") ?? undefined;
    return json({
      soak: buildCanarySoakReport({
        store: options.store,
        frontier: options.frontier,
        generatedAt,
        windowHours: numberParam(url.searchParams.get("windowHours")),
        minCycles: numberParam(url.searchParams.get("minCycles")),
        maxFreshnessSeconds: numberParam(url.searchParams.get("maxFreshnessSeconds")),
        requireNativeLiveHttp: url.searchParams.get("requireNativeLiveHttp") === "true"
      }),
      operatorView: buildCanaryOperatorSummary({
        store: options.store,
        frontier: options.frontier,
        generatedAt,
        runtime: options.canaryLoop?.getState()
      })
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/ops/canary/console") {
    const operatorView = buildCanaryOperatorSummary({
      store: options.store,
      frontier: options.frontier,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined,
      runtime: options.canaryLoop?.getState()
    });
    return new Response(buildCanaryOperatorConsoleHtml(operatorView), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/auth/integration-notes") {
    const authBoundary = enterpriseAuthBoundaryContract();
    return json({
      version: "v1",
      authBoundary,
      notes: [
        "Authenticate at the main CTI app or gateway before forwarding traffic to the scraper.",
        "Forward x-tenant-id and x-actor-id from trusted middleware; resolve roles/scopes upstream.",
        "Use idempotency-key on POST /v1/intel/runs so client retries do not duplicate collection work.",
        "Protect source administration with source:write or scraper:admin privileges."
      ]
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/contracts") {
    return json(sanitizeContractIndexNoLeakKeys(buildEnterpriseApiContractIndex()));
  }

  if (request.method === "GET" && url.pathname === "/v1/analyst/claim-ledger") {
    return json(buildAnalystClaimLedgerResponse(options.store, {
      tenantId: url.searchParams.get("tenantId") ?? request.headers.get("x-tenant-id") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      claimKind: url.searchParams.get("claimKind") ?? undefined,
      query: url.searchParams.get("q") ?? url.searchParams.get("query") ?? undefined,
      cursor: Math.max(0, Number.parseInt(url.searchParams.get("cursor") ?? "0", 10)),
      limit: Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") ?? "50", 10)))
    }));
  }

  const analystClaimLedgerActionMatch = url.pathname.match(/^\/v1\/analyst\/claim-ledger\/([^/]+)\/actions$/);
  if (request.method === "POST" && analystClaimLedgerActionMatch) {
    const entryId = analystClaimLedgerActionMatch[1];
    if (!entryId) return apiError("bad_request", "Claim ledger entry id is required", 400);
    const input = await readRequestBody<Record<string, unknown>>(request);
    const result = applyAnalystClaimLedgerAction(options.store, entryId, {
      action: typeof input.action === "string" ? input.action : "",
      dryRun: input.dryRun !== false,
      operatorId: typeof input.operatorId === "string" ? input.operatorId : request.headers.get("x-actor-id") ?? undefined,
      reason: typeof input.reason === "string" ? input.reason : undefined,
      duplicateOf: typeof input.duplicateOf === "string" ? input.duplicateOf : undefined,
      contradictionReason: typeof input.contradictionReason === "string" ? input.contradictionReason : undefined,
      confidence: typeof input.confidence === "number" ? input.confidence : undefined,
      retentionClass: typeof input.retentionClass === "string" ? input.retentionClass : undefined,
      legalHold: typeof input.legalHold === "boolean" ? input.legalHold : undefined
    });
    return result.ok ? json(result.body, result.status) : apiError(result.code, result.message, result.status, result.details);
  }

  if (request.method === "GET" && url.pathname === "/v1/analyst/metadata-review-tasks") {
    return json(buildAnalystMetadataReviewInboxResponse(options.store, {
      tenantId: url.searchParams.get("tenantId") ?? request.headers.get("x-tenant-id") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      cursor: Math.max(0, Number.parseInt(url.searchParams.get("cursor") ?? "0", 10)),
      limit: Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") ?? "50", 10)))
    }));
  }

  if (request.method === "GET" && url.pathname === "/v1/analyst/loop") {
    return json(buildAnalystLoopReadModelResponse(options.store, {
      tenantId: url.searchParams.get("tenantId") ?? request.headers.get("x-tenant-id") ?? undefined,
      query: url.searchParams.get("q") ?? url.searchParams.get("query") ?? undefined,
      runId: url.searchParams.get("runId") ?? undefined,
      limit: Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") ?? "25", 10)))
    }));
  }

  if (request.method === "GET" && url.pathname === "/v1/analyst/persistence-readiness") {
    return json(buildAnalystLoopPersistenceReadinessPacket(nowIso()));
  }

  if (request.method === "GET" && url.pathname === "/v1/analyst/source-activation-packets") {
    return json(buildAnalystSourceActivationPacketsResponse(options.store, {
      tenantId: url.searchParams.get("tenantId") ?? request.headers.get("x-tenant-id") ?? undefined,
      execution: url.searchParams.get("execution") ?? undefined,
      cursor: Math.max(0, Number.parseInt(url.searchParams.get("cursor") ?? "0", 10)),
      limit: Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") ?? "50", 10)))
    }));
  }

  const sourceActivationExecutionPreviewMatch = url.pathname.match(/^\/v1\/analyst\/source-activation-packets\/([^/]+)\/execution-preview$/);
  if (request.method === "GET" && sourceActivationExecutionPreviewMatch) {
    const packetId = sourceActivationExecutionPreviewMatch[1];
    if (!packetId) return apiError("bad_request", "Source activation packet id is required", 400);
    const result = buildAnalystSourceActivationExecutionPreviewResponse(options.store, packetId);
    return result.ok ? json(result.body) : apiError(result.code, result.message, result.status, result.details);
  }

  if (request.method === "GET" && url.pathname === "/v1/analyst/victim-notification-packets") {
    return json(buildAnalystVictimNotificationPacketsResponse(options.store, {
      tenantId: url.searchParams.get("tenantId") ?? request.headers.get("x-tenant-id") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      cursor: Math.max(0, Number.parseInt(url.searchParams.get("cursor") ?? "0", 10)),
      limit: Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get("limit") ?? "50", 10)))
    }));
  }

  const victimNotificationExportMatch = url.pathname.match(/^\/v1\/analyst\/victim-notification-packets\/([^/]+)\/export$/);
  if (request.method === "GET" && victimNotificationExportMatch) {
    const packetId = victimNotificationExportMatch[1];
    if (!packetId) return apiError("bad_request", "Victim notification packet id is required", 400);
    const result = buildAnalystVictimNotificationPacketExportResponse(options.store, packetId);
    return result.ok ? json(result.body) : apiError(result.code, result.message, result.status, result.details);
  }

  const victimNotificationActionMatch = url.pathname.match(/^\/v1\/analyst\/victim-notification-packets\/([^/]+)\/actions$/);
  if (request.method === "POST" && victimNotificationActionMatch) {
    const packetId = victimNotificationActionMatch[1];
    if (!packetId) return apiError("bad_request", "Victim notification packet id is required", 400);
    const input = await readRequestBody<Record<string, unknown>>(request);
    const result = applyAnalystVictimNotificationPacketAction(options.store, packetId, {
      action: typeof input.action === "string" ? input.action : "",
      dryRun: input.dryRun !== false,
      operatorId: typeof input.operatorId === "string" ? input.operatorId : request.headers.get("x-actor-id") ?? undefined,
      reason: typeof input.reason === "string" ? input.reason : undefined
    });
    return result.ok ? json(result.body, result.status) : apiError(result.code, result.message, result.status, result.details);
  }

  const sourceActivationActionMatch = url.pathname.match(/^\/v1\/analyst\/source-activation-packets\/([^/]+)\/actions$/);
  if (request.method === "POST" && sourceActivationActionMatch) {
    const packetId = sourceActivationActionMatch[1];
    if (!packetId) return apiError("bad_request", "Source activation packet id is required", 400);
    const input = await readRequestBody<Record<string, unknown>>(request);
    const result = applyAnalystSourceActivationPacketAction(options.store, packetId, {
      action: typeof input.action === "string" ? input.action : "",
      dryRun: input.dryRun !== false,
      operatorId: typeof input.operatorId === "string" ? input.operatorId : request.headers.get("x-actor-id") ?? undefined,
      reason: typeof input.reason === "string" ? input.reason : undefined
    });
    return result.ok ? json(result.body, result.status) : apiError(result.code, result.message, result.status, result.details);
  }

  const analystReviewActionMatch = url.pathname.match(/^\/v1\/analyst\/metadata-review-tasks\/([^/]+)\/actions$/);
  if (request.method === "POST" && analystReviewActionMatch) {
    const taskId = analystReviewActionMatch[1];
    if (!taskId) return apiError("bad_request", "Metadata review task id is required", 400);
    const input = await readJson<Record<string, unknown>>(request);
    const result = applyAnalystMetadataReviewAction(options.store, taskId, {
      action: typeof input.action === "string" ? input.action : "",
      dryRun: input.dryRun !== false,
      duplicateOf: typeof input.duplicateOf === "string" ? input.duplicateOf : undefined,
      operatorId: typeof input.operatorId === "string" ? input.operatorId : request.headers.get("x-actor-id") ?? undefined,
      reason: typeof input.reason === "string" ? input.reason : undefined
    });
    return result.ok ? json(result.body, result.status) : apiError(result.code, result.message, result.status, result.details);
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
    const input = await readRequestBody<Record<string, unknown>>(request);
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
    if (isHtmlFormRequest(request)) return redirectToCanaryConsole("activated");
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
    const input = await readRequestBody<Record<string, unknown>>(request);
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
    if (isHtmlFormRequest(request)) return redirectToCanaryConsole("paused");
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

  if (request.method === "POST" && url.pathname === "/v1/sources/marketplace") {
    const input = await readJson<Record<string, unknown>>(request);
    const tenantId = typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined;
    const queries = Array.isArray(input.queries)
      ? input.queries.map(String).filter((query) => query.trim().length > 0)
      : typeof input.query === "string" && input.query.trim()
        ? [input.query]
        : [];
    return json(buildSourceMarketplaceApiResponse({
      tenantId,
      queries,
      generatedAt: nowIso()
    }));
  }

  if (request.method === "POST" && url.pathname === "/v1/sources/atlas") {
    const input = await readJson<Record<string, unknown>>(request);
    const tenantId = typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined;
    const queries = Array.isArray(input.queries)
      ? input.queries.map(String).filter((query) => query.trim().length > 0)
      : typeof input.query === "string" && input.query.trim()
        ? [input.query]
        : [];
    const recordLimit = typeof input.recordLimit === "number" && Number.isFinite(input.recordLimit)
      ? Math.floor(input.recordLimit)
      : undefined;
    return json(buildTiSourceAtlasApiResponse({
      tenantId,
      queries,
      recordLimit,
      generatedAt: nowIso()
    }));
  }

  if (request.method === "POST" && url.pathname === "/v1/sources/atlas/export") {
    const input = await readJson<Record<string, unknown>>(request);
    const tenantId = typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined;
    const queries = Array.isArray(input.queries)
      ? input.queries.map(String).filter((query) => query.trim().length > 0)
      : typeof input.query === "string" && input.query.trim()
        ? [input.query]
        : [];
    const recordLimit = typeof input.recordLimit === "number" && Number.isFinite(input.recordLimit)
      ? Math.floor(input.recordLimit)
      : undefined;
    const planLabel = input.planLabel === "first_100" || input.planLabel === "first_1000" || input.planLabel === "future_10k"
      ? input.planLabel
      : undefined;
    return json(buildTiSourceAtlasExportManifestApiResponse({
      tenantId,
      queries,
      planLabel,
      recordLimit,
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
    const input = await readRequestBody<Record<string, unknown>>(request);
    if (input.operatorApproval !== true) {
      return apiError("approval_required", "operatorApproval=true is required to run the public canary collector", 409, {
        mode: "bounded_public_http_canary"
      });
    }
    const bodyNumber = (value: unknown): number | undefined => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value !== "string" || !value.trim()) return undefined;
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const canaryRun = await runCanaryCollectionCycle({
      store: options.store,
      frontier: options.frontier,
      objectStore: options.objectStore,
      fetch: options.canaryFetch,
      tenantId: typeof input.tenantId === "string" ? input.tenantId : request.headers.get("x-tenant-id") ?? undefined,
      operatorId: typeof input.approvedBy === "string" ? input.approvedBy : request.headers.get("x-actor-id") ?? "operator",
      activateSources: false,
      maxSources: bodyNumber(input.maxSources),
      maxTasks: bodyNumber(input.maxTasks),
      maxBytes: bodyNumber(input.maxBytes),
      timeoutMs: bodyNumber(input.timeoutMs),
      now: typeof input.generatedAt === "string" ? () => String(input.generatedAt) : undefined
    });
    if (isHtmlFormRequest(request)) return redirectToCanaryConsole("ran");
    return json({
      canaryRun,
      operatorView: buildCanaryOperatorSummary({
        store: options.store,
        frontier: options.frontier,
        generatedAt: canaryRun.generatedAt,
        runtime: options.canaryLoop?.getState()
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
    const qualityDashboard = searchQualityDashboardForQuery({
      query,
      tenantId: request.headers.get("x-tenant-id") ?? undefined,
      options,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const entityResolutionWorkbench = entityResolutionWorkbenchForQuery({
      query,
      tenantId: request.headers.get("x-tenant-id") ?? undefined,
      options,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const timelinessGroundTruth = timelinessGroundTruthForQuery({
      query,
      tenantId: request.headers.get("x-tenant-id") ?? undefined,
      options,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const highPriorityActorFreshnessDashboard = buildHighPriorityActorFreshnessDashboardDto({
      query,
      timelinessGroundTruth,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const attackMappingQuality = attackMappingQualityForQuery({
      query,
      tenantId: request.headers.get("x-tenant-id") ?? undefined,
      options,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const analystFeedbackLoop = analystFeedbackLoopForQuery({
      query,
      tenantId: request.headers.get("x-tenant-id") ?? undefined,
      options,
      qualityDashboard,
      entityResolutionWorkbench,
      timelinessGroundTruth,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const actorProfileReviewWorkbench = actorProfileReviewWorkbenchForQuery({
      query,
      tenantId: request.headers.get("x-tenant-id") ?? undefined,
      options,
      analystFeedbackLoop,
      timelinessGroundTruth,
      attackMappingQuality,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const evaluationDatasetGovernance = buildEvaluationDatasetGovernanceDto({
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const ctiEvaluationDatasetPack = buildCtiEvaluationDatasetPackDto({
      governance: evaluationDatasetGovernance,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const qualityRegressionSuite = qualityRegressionSuiteForQuery({
      query,
      analystFeedbackLoop,
      timelinessGroundTruth,
      attackMappingQuality,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const analystQualityReviewQueue = buildAnalystQualityReviewQueueDto({
      query,
      actorProfileReviewWorkbench,
      feedbackLoop: analystFeedbackLoop,
      qualityRegressionSuite,
      evaluationDatasetGovernance,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const analystFeedbackLearningLoop = buildAnalystFeedbackLearningLoopDto({
      query,
      feedbackLoop: analystFeedbackLoop,
      qualityRegressionSuite,
      actorProfileReviewWorkbench,
      analystQualityReviewQueue,
      evaluationDatasetGovernance,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const activeLearningCandidateQueue = buildActiveLearningCandidateQueueDto({
      query,
      feedbackLoop: analystFeedbackLoop,
      qualityRegressionSuite,
      actorProfileReviewWorkbench,
      analystQualityReviewQueue,
      evaluationDatasetGovernance,
      analystFeedbackLearningLoop,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    const qualityRuntimeValueGates = buildQualityRuntimeValueGatesDto({
      query,
      quality: search.quality,
      publicTiAnswer: search.publicTiAnswer,
      timelinessGroundTruth,
      activeLearningCandidateQueue,
      ctiEvaluationDatasetPack,
      generatedAt: url.searchParams.get("generatedAt") ?? undefined
    });
    return json({
      query,
      quality: search.quality,
      dashboard: qualityDashboard,
      entityResolutionWorkbench,
      timelinessGroundTruth,
      highPriorityActorFreshnessDashboard,
      attackMappingQuality,
      analystFeedbackLoop,
      actorProfileReviewWorkbench,
      evaluationDatasetGovernance,
      ctiEvaluationDatasetPack,
      analystQualityReviewQueue,
      analystFeedbackLearningLoop,
      activeLearningCandidateQueue,
      qualityRuntimeValueGates,
      qualityRegressionSuite,
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

  if (request.method === "GET" && url.pathname === "/v1/darkweb/status") {
    return json({
      status: buildDarkwebIndexStatus(),
      contract: darkwebIndexContract()
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/darkweb/search") {
    return json({
      darkwebIndex: searchDarkwebIndex({
        q: url.searchParams.get("q") ?? url.searchParams.get("query") ?? undefined,
        category: url.searchParams.get("category") ?? undefined,
        legalTriage: url.searchParams.get("legalTriage") ?? undefined,
        liveness: url.searchParams.get("liveness") ?? undefined,
        network: url.searchParams.get("network") ?? undefined,
        cursor: url.searchParams.get("cursor") ?? undefined,
        limit: numericParam(url.searchParams.get("limit")) ?? undefined
      }),
      contract: darkwebIndexContract()
    });
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

function sanitizeContractIndexNoLeakKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeContractIndexNoLeakKeys(entry));
  }
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (!CONTRACT_INDEX_FORBIDDEN_VALUE_PATTERNS.some((pattern) => lower.includes(pattern))) return value;
    return "[redacted_contract_example_value]";
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const safeKey = key.includes("objectKey") || key.includes("ObjectKey")
      ? key.replace(/objectKeys?/i, "objectRefs")
      : key;
    return [safeKey, sanitizeContractIndexNoLeakKeys(entry)];
  }));
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
    ...normalized.split(/\s+/).filter((term) => term.length >= 4 && !isGenericSearchToken(term))
  ]);
}

const GENERIC_SEARCH_TOKENS = new Set([
  "actor",
  "actors",
  "apt",
  "group",
  "threat",
  "cyber",
  "attack",
  "attacks",
  "malware",
  "ransomware",
  "campaign",
  "made",
  "unknown",
  "random",
  "test"
]);

function isGenericSearchToken(term: string): boolean {
  return GENERIC_SEARCH_TOKENS.has(term);
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
  const qualityDashboard = searchQualityDashboardForQuery({
    query: input.query,
    tenantId: input.tenantId,
    options: input.options
  });
  const entityResolutionWorkbench = entityResolutionWorkbenchForQuery({
    query: input.query,
    tenantId: input.tenantId,
    options: input.options
  });
  const timelinessGroundTruth = timelinessGroundTruthForQuery({
    query: input.query,
    tenantId: input.tenantId,
    options: input.options
  });
  const highPriorityActorFreshnessDashboard = buildHighPriorityActorFreshnessDashboardDto({
    query: input.query,
    timelinessGroundTruth
  });
  const attackMappingQuality = attackMappingQualityForQuery({
    query: input.query,
    tenantId: input.tenantId,
    options: input.options
  });
  const analystFeedbackLoop = analystFeedbackLoopForQuery({
    query: input.query,
    tenantId: input.tenantId,
    options: input.options,
    actorProfile,
    qualityDashboard,
    entityResolutionWorkbench,
    timelinessGroundTruth
  });
  const qualityRegressionSuite = qualityRegressionSuiteForQuery({
    query: input.query,
    analystFeedbackLoop,
    timelinessGroundTruth,
    attackMappingQuality
  });
  const evaluationDatasetGovernance = buildEvaluationDatasetGovernanceDto();
  const ctiEvaluationDatasetPack = buildCtiEvaluationDatasetPackDto({
    governance: evaluationDatasetGovernance
  });
  const actorProfileReviewWorkbench = actorProfileReviewWorkbenchForQuery({
    query: input.query,
    tenantId: input.tenantId,
    options: input.options,
    analystFeedbackLoop,
    timelinessGroundTruth,
    attackMappingQuality
  });
  const analystQualityReviewQueue = buildAnalystQualityReviewQueueDto({
    query: input.query,
    actorProfileReviewWorkbench,
    feedbackLoop: analystFeedbackLoop,
    qualityRegressionSuite,
    evaluationDatasetGovernance
  });
  const analystFeedbackLearningLoop = buildAnalystFeedbackLearningLoopDto({
    query: input.query,
    feedbackLoop: analystFeedbackLoop,
    qualityRegressionSuite,
    actorProfileReviewWorkbench,
    analystQualityReviewQueue,
    evaluationDatasetGovernance
  });
  const activeLearningCandidateQueue = buildActiveLearningCandidateQueueDto({
    query: input.query,
    feedbackLoop: analystFeedbackLoop,
    qualityRegressionSuite,
    actorProfileReviewWorkbench,
    analystQualityReviewQueue,
    evaluationDatasetGovernance,
    analystFeedbackLearningLoop
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
  const publicTiAnswerDto = publicTiAnswerForSearch({
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
  const qualityRuntimeValueGates = buildQualityRuntimeValueGatesDto({
    query: input.query,
    quality,
    publicTiAnswer: publicTiAnswerDto,
    timelinessGroundTruth,
    activeLearningCandidateQueue,
    ctiEvaluationDatasetPack
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
  const tiExperience = buildTiExperienceForSearch({
    query: input.query,
    compatibility,
    scheduler,
    publicTiAnswer: publicTiAnswerDto,
    publicWrapperDelta,
    sourceCoverage,
    sourceActivation,
    restrictedMetadata,
    darknetMetadata
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
    analystLoop: scheduler.analystLoop,
    tiExperience,
    publicTiAnswer: publicTiAnswerDto,
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
    quality,
    qualityDashboard,
    entityResolutionWorkbench,
    timelinessGroundTruth,
    highPriorityActorFreshnessDashboard,
    attackMappingQuality,
    analystFeedbackLoop,
    actorProfileReviewWorkbench,
    evaluationDatasetGovernance,
    ctiEvaluationDatasetPack,
    analystQualityReviewQueue,
    analystFeedbackLearningLoop,
    activeLearningCandidateQueue,
    qualityRuntimeValueGates,
    qualityRegressionSuite
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
      "analystLoop",
      "tiExperience",
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
      analystLoop: {
        state: input.scheduler.analystLoop.resultState,
        reviewTaskCount: input.scheduler.analystLoop.runStatusClarity.reviewTasks,
        queuedTaskCount: input.scheduler.analystLoop.runStatusClarity.queuedTasks,
        blockedUnsafeTargetCount: input.scheduler.analystLoop.runStatusClarity.blockedUnsafeTargets,
        nextSteps: input.scheduler.analystLoop.nextSteps.map((step) => step.state)
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
    "analystLoop",
    "tiExperience",
    "graph"
  ];
}

function buildTiExperienceForSearch(input: {
  query: string;
  compatibility: ReturnType<typeof liveSearchCompatibilityFields>;
  scheduler: ReturnType<typeof schedulerSummaryForPlan>;
  publicTiAnswer: unknown;
  publicWrapperDelta: ReturnType<typeof publicWrapperDeltaCompatibility>;
  sourceCoverage: unknown;
  sourceActivation: unknown;
  restrictedMetadata: unknown;
  darknetMetadata: unknown;
}) {
  const analystLoop = input.scheduler.analystLoop;
  const answer = record(input.publicTiAnswer) ?? {};
  const stateMachine = record(answer.stateMachine);
  const nextPoll = record(stateMachine?.polling);
  const sourceCoverage = record(input.sourceCoverage) ?? {};
  const sourceActivation = record(input.sourceActivation) ?? {};
  const restricted = record(input.restrictedMetadata) ?? {};
  const darknet = record(input.darknetMetadata) ?? {};
  const reviewCards = analystLoop.metadataReviewInbox.map((item) => ({
    id: item.id,
    resultState: "metadata_review" as const,
    claimHeadline: analystMetadataClaimHeadline(item),
    company: item.company,
    victim: item.victim,
    affectedAccounts: item.affectedAccounts,
    datasetSize: item.datasetSize,
    actorStatement: item.actorStatement,
    claimedDate: item.claimedDate,
    sourceHash: item.sourceHash,
    confidence: item.confidence,
    allowedActions: [...item.allowedActions],
    provenance: item.provenance,
    unsafeMaterialAccessed: false,
    whatWasNotAccessed: analystMetadataWhatWasNotAccessed(),
    verificationBoundary: analystMetadataVerificationBoundary(),
    whatHappensNext: "Analyst reviews the safe metadata, prepares notification, marks duplicate, requests approval, or escalates."
  }));
  const notification = analystLoop.victimNotificationPacket
    ? {
        ...analystLoop.victimNotificationPacket,
        claimHeadline: analystMetadataClaimHeadline(analystLoop.victimNotificationPacket),
        redactedNotification: tiExperienceRedactedNotification(analystLoop.victimNotificationPacket),
        verificationBoundary: analystMetadataVerificationBoundary(),
        externalDeliveryPerformed: false,
        safeToSendWithoutReview: false
      }
    : undefined;
  const sourceGaps = uniqueStrings([
    ...stringArray(sourceCoverage.gaps),
    ...stringArray(sourceCoverage.coverageGaps),
    ...stringArray(sourceActivation.gaps),
    ...stringArray(sourceActivation.requiredApprovals),
    ...stringArray(restricted.blockers),
    ...stringArray(restricted.warnings)
  ]);
  const statusLine = tiExperienceStatusLine(analystLoop.resultState, analystLoop.runStatusClarity.meaningfulWorkCount);

  return {
    schemaVersion: "ti.analyst_loop_ui.v1",
    query: input.query,
    state: analystLoop.resultState,
    statusLine,
    headline: analystLoop.headline,
    safeToRenderVerifiedLeakFacts: analystLoop.resultState === "ready",
    partial: analystLoop.resultState !== "ready",
    meaning: {
      queued: "Approved safe collection is running.",
      metadata_review: "Leak or threat-actor metadata is available for analyst review.",
      blocked_unsafe_target: "A raw leak, download, credential, private-access, or interaction target was blocked.",
      needs_source_activation: "Operator or legal approval is needed before metadata-only collection can run.",
      ready: "Enough reviewed evidence exists for a usable answer."
    },
    visibleStates: ["queued", "metadata_review", "blocked_unsafe_target", "needs_source_activation", "ready"] satisfies TiAnalystLoopState[],
    runStatusClarity: analystLoop.runStatusClarity,
    progress: {
      queued: analystLoop.resultState === "queued" || analystLoop.runStatusClarity.queuedTasks > 0,
      metadataReview: analystLoop.resultState === "metadata_review" || analystLoop.runStatusClarity.reviewTasks > 0,
      blockedUnsafeTarget: analystLoop.resultState === "blocked_unsafe_target" || analystLoop.runStatusClarity.blockedUnsafeTargets > 0,
      needsSourceActivation: analystLoop.resultState === "needs_source_activation" || analystLoop.sourceActivationWorkflow.required,
      ready: analystLoop.resultState === "ready"
    },
    nextSteps: analystLoop.nextSteps,
    workQueue: analystLoop.workQueue,
    activityTimeline: analystLoop.activityTimeline,
    readinessChecklist: analystLoop.readinessChecklist,
    reviewCards,
    notificationPacket: notification,
    sourceActivationWorkflow: {
      ...analystLoop.sourceActivationWorkflow,
      sourceGaps,
      route: "/v1/sources/apply-plan",
      explicitApprovalRequired: analystLoop.sourceActivationWorkflow.required,
      silentAutoActivationAllowed: false,
      approvalWorkflows: analystLoop.sourceActivationWorkflow.actions.map(tiExperienceSourceActivationApprovalWorkflow)
    },
    polling: {
      runId: input.compatibility.runId,
      pollCursor: input.compatibility.pollCursor,
      deltaCursor: input.compatibility.deltaCursor,
      nextPollSeconds: Number(nextPoll?.nextPollAfterSeconds ?? input.compatibility.nextPollSeconds),
      nextPollAt: input.scheduler.nextPollAt,
      changedSinceCursor: input.publicWrapperDelta.polling.changedSinceCursor,
      state: String(stateMachine?.state ?? input.compatibility.status)
    },
    partialEvidence: {
      publicChannelStatus: String(record(input.publicWrapperDelta.deltas.publicChannel)?.status ?? "unknown"),
      restrictedMetadataStatus: String(restricted.status ?? restricted.state ?? "none"),
      darknetMetadataStatus: String(darknet.status ?? "unknown"),
      sourceCoverageState: String(sourceCoverage.coverageState ?? "unknown"),
      claimLedgerTrustGate: String(record(input.publicWrapperDelta.deltas.claimLedger)?.trustGate ?? "unknown")
    },
    guarantees: {
      metadataOnly: true,
      rawLeakMaterialAccessed: false,
      credentialsAccessed: false,
      privateAccessAttempted: false,
      threatActorInteractionPerformed: false,
      notificationDeliveredExternally: false,
      doesNotImplyVerification: analystLoop.resultState !== "ready"
    },
    uiFields: [
      "state",
      "statusLine",
      "headline",
      "runStatusClarity",
      "progress",
      "nextSteps",
      "workQueue",
      "activityTimeline",
      "readinessChecklist",
      "reviewCards",
      "notificationPacket",
      "sourceActivationWorkflow",
      "polling",
      "partialEvidence",
      "guarantees"
    ]
  };
}

function tiExperienceStatusLine(state: TiAnalystLoopState, count: number): string {
  if (state === "queued") return `Approved collection running (${count} work item${count === 1 ? "" : "s"})`;
  if (state === "metadata_review") return `Metadata review available (${count} work item${count === 1 ? "" : "s"})`;
  if (state === "blocked_unsafe_target") return "Unsafe target blocked";
  if (state === "needs_source_activation") return "Source approval needed";
  return "Ready";
}

function analystMetadataClaimHeadline(item: {
  company?: string;
  victim?: string;
  affectedAccounts?: string;
  datasetSize?: string;
  actorStatement?: string;
}): string {
  const subject = item.company ?? item.victim ?? "Unknown organization";
  const details = [item.affectedAccounts, item.datasetSize].filter((value): value is string => Boolean(value));
  if (details.length > 0) return `${subject} leaked, ${details.join(", ")}`;
  if (item.actorStatement) return `${subject} named in leak claim`;
  return `${subject} metadata review required`;
}

function analystMetadataWhatWasNotAccessed(): string[] {
  return [
    "No restricted dataset was downloaded or opened.",
    "No credentials, cookies, private channels, or invite-only areas were accessed.",
    "No CAPTCHA, authentication, or access-control bypass was attempted.",
    "No threat actor interaction was performed."
  ];
}

function analystMetadataVerificationBoundary() {
  return {
    claimMetadataOnly: true,
    leakedDatasetAccessed: false,
    credentialsAccessed: false,
    privateAccessAttempted: false,
    threatActorInteractionPerformed: false,
    wording: "This is safe claim metadata for review; the scraper did not verify or download leaked contents."
  };
}

function tiExperienceRedactedNotification(packet: {
  company?: string;
  victim?: string;
  claimSummary?: string;
  affectedAccounts?: string;
  datasetSize?: string;
  actorStatement?: string;
  claimedDate?: string;
  sourceHash?: string;
  confidence?: number;
  whatWasNotAccessed?: string[];
  recommendedAction?: string;
}) {
  return {
    subject: analystMetadataClaimHeadline(packet),
    recipientOrganization: packet.company ?? packet.victim ?? "Unknown organization",
    victim: packet.victim,
    claimSummary: packet.claimSummary,
    claimedImpact: {
      affectedAccounts: packet.affectedAccounts,
      datasetSize: packet.datasetSize
    },
    actorStatementSummary: packet.actorStatement,
    timestamps: {
      claimedAt: packet.claimedDate
    },
    confidence: packet.confidence,
    sourceHash: packet.sourceHash,
    redactions: ["restricted_dataset_material", "credential_material", "private_access_material", "actor_interaction"],
    whatWasNotAccessed: packet.whatWasNotAccessed ?? analystMetadataWhatWasNotAccessed(),
    verificationBoundary: analystMetadataVerificationBoundary(),
    recommendedAction: packet.recommendedAction,
    deliveryBoundary: {
      externalDeliveryPerformed: false,
      deliveryMustHappenOutsideScraper: true,
      transportCredentialsIncluded: false,
      safeToSendAfterApproval: false
    }
  };
}

function tiExperienceSourceActivationApprovalWorkflow(action: {
  action: string;
  sourceId?: string;
  reason: string;
  execution: string;
}) {
  const blocked = action.execution === "blocked";
  const approvalRequired = action.execution === "human_approval_required" || action.action === "request_approval";
  const requestedAction = action.action === "enable_metadata_only_queue" ? "restore_metadata_only_source" : action.action === "request_approval" ? "request_operator_approval" : action.action;
  return {
    sourceId: action.sourceId,
    requestedAction,
    execution: approvalRequired ? "approval_required" : blocked ? "blocked" : "dry_run_only",
    reason: action.reason,
    approval: {
      required: approvalRequired,
      approved: false,
      safeToExecuteMetadataOnly: false
    },
    expectedMetadataOnlyEffect: action.action === "enable_metadata_only_queue"
      ? "Queue only metadata fields after explicit approval while raw downloads and interactions remain disabled."
      : action.action === "keep_blocked"
        ? "Keep unsafe restricted payload, credential, private-access, or interaction target blocked."
        : "Create an approval packet before any metadata-only collection is restored.",
    rollback: action.action === "keep_blocked"
      ? "No rollback; blocked target remains outside allowed collection."
      : "Leave source disabled or move it back to needs_review if approval is not granted.",
    allowedOperatorActions: blocked ? ["keep_blocked", "request_legal_review"] : ["approve_metadata_only", "keep_blocked", "request_legal_review"],
    requiredBeforeExecution: blocked
      ? ["repair or replace blocked unsafe target with a metadata listing before any activation"]
      : approvalRequired
        ? ["approve_metadata_only through /v1/analyst/source-activation-packets/{packetId}/actions"]
        : ["operator/legal approval must be recorded before queueing metadata-only work"],
    deliveryBoundary: {
      dryRunOnly: true,
      sourceMutationPerformed: false,
      crawlingStarted: false,
      restrictedFetchEnabled: false,
      unsafeTargetConvertedToRunnableWork: false,
      externalGovernanceHandoffRequired: true
    },
    forbiddenOperations: [
      "automatic_source_activation",
      "restricted_fetch_enablement",
      "raw_leak_download",
      "credential_collection",
      "private_access",
      "authentication_or_captcha_bypass",
      "threat_actor_contact",
      "unsafe_url_execution"
    ]
  };
}

function analystVictimRedactedNotification(packet: AnalystVictimNotificationPacket) {
  return {
    subject: analystMetadataClaimHeadline(packet),
    recipientOrganization: packet.company,
    victim: packet.victim,
    claimSummary: packet.claimSummary,
    claimedImpact: {
      affectedAccounts: packet.affectedAccounts,
      datasetSize: packet.datasetSize
    },
    actorStatementSummary: packet.actorStatement,
    timestamps: {
      claimedAt: packet.claimedAt,
      observedAt: packet.observedAt,
      createdAt: packet.createdAt,
      updatedAt: packet.updatedAt
    },
    confidence: packet.confidence,
    sourceHash: packet.sourceHash,
    provenance: packet.provenance,
    redactions: packet.redactions,
    whatWasNotAccessed: packet.whatWasNotAccessed,
    verificationBoundary: analystMetadataVerificationBoundary(),
    deliveryBoundary: {
      externalDeliveryPerformed: false,
      deliveryMustHappenOutsideScraper: true,
      transportCredentialsIncluded: false,
      safeToSendAfterApproval: packet.safeToSend
    }
  };
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
    "warningCodes",
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
  const workerLeaseSoakHarness = buildSchedulerWorkerLeaseSoakHarness({
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    workerQueueCutover,
    workerSoakMigration,
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
  const durableBackendReadiness = buildSchedulerDurableBackendReadiness({
    queueEconomics,
    runtimeExecution,
    runtimeSla,
    slaEnforcement,
    workerQueueCutover,
    workerSoakMigration,
    productionAdapterTelemetry,
    canaryControlPlane,
    now
  });
  const freshnessSloEngine = buildSchedulerFreshnessSloEngine({
    plan: input.plan,
    sources: input.options?.store.listSources(),
    queueEconomics,
    runtimeExecution,
    slaEnforcement,
    workerQueueCutover,
    durableBackendReadiness,
    now
  });
  const freshnessSloDashboard = buildSchedulerFreshnessSloDashboard({
    queueEconomics,
    runtimeExecution,
    slaEnforcement,
    workerQueueCutover,
    freshnessSloEngine,
    workerLeaseSoakHarness,
    now
  });
  const dailyActorRunPlan = buildSchedulerDailyActorRunPlan({
    freshnessSloDashboard,
    queueEconomics,
    workerQueueCutover,
    now
  });
  const productionLeaseSemantics = buildSchedulerProductionLeaseSemantics({
    queueEconomics,
    runtimeExecution,
    slaEnforcement,
    workerQueueCutover,
    durableBackendReadiness,
    freshnessSloEngine,
    now
  });
  const fairnessGovernance = buildSchedulerFairnessGovernance({
    plan: input.plan,
    queueEconomics,
    runtimeExecution,
    slaEnforcement,
    workerQueueCutover,
    durableBackendReadiness,
    freshnessSloEngine,
    productionLeaseSemantics,
    now
  });
  const interactiveSearchFreshness = buildSchedulerInteractiveSearchFreshness({
    plan: input.plan,
    run: input.run,
    attachedToActiveRun: input.planner?.attachedToActiveRun,
    freshnessSloEngine,
    freshnessSloDashboard,
    queueEconomics,
    workerQueueCutover,
    fairnessGovernance,
    now
  });
  const persistenceReplayCutover = buildSchedulerPersistenceReplayCutover({
    plan: input.plan,
    runs: input.options?.store.listRuns(),
    queueEconomics,
    runtimeExecution,
    slaEnforcement,
    productionLeaseSemantics,
    fairnessGovernance,
    now
  });
  const postgresQueueAdapter = buildSchedulerPostgresQueueAdapterReadiness({
    config: input.options?.config?.scheduler,
    persistenceReplayCutover,
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
    workerLeaseSoakHarness,
    productionAdapterTelemetry,
    canaryControlPlane,
    durableBackendReadiness,
    freshnessSloEngine,
    freshnessSloDashboard,
    dailyActorRunPlan,
    interactiveSearchFreshness,
    productionLeaseSemantics,
    fairnessGovernance,
    persistenceReplayCutover,
    postgresQueueAdapter,
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
type TiAnalystWorkQueueKind =
  | "queued_collection"
  | "metadata_review"
  | "blocked_unsafe_target"
  | "source_activation"
  | "victim_notification"
  | "claim_ledger";
type TiAnalystWorkQueueItem = {
  id: string;
  kind: TiAnalystWorkQueueKind;
  state: TiAnalystLoopState;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  route: string;
  actionRoute?: string;
  allowedActions: string[];
  claimHeadline?: string;
  company?: string;
  victim?: string;
  affectedAccounts?: string;
  datasetSize?: string;
  actorStatement?: string;
  sourceHash?: string;
  provenance?: unknown;
  noLeakBoundary: {
    metadataOnly: true;
    rawLeakMaterialAccessed: false;
    notificationDeliveredExternally: false;
    sourceActivationPerformed: false;
    wording: string;
    whatWasNotAccessed: string[];
  };
};
type TiAnalystActivityTimelineItem = {
  id: string;
  at: string;
  kind:
    | "metadata_capture"
    | "metadata_review_created"
    | "metadata_review_action"
    | "source_activation_decision"
    | "notification_packet"
    | "claim_ledger_action"
    | "unsafe_target_blocked";
  actor: "system" | "analyst" | "operator" | "external";
  title: string;
  summary: string;
  route?: string;
  subjectIds: {
    reviewTaskId?: string;
    activationPacketId?: string;
    notificationPacketId?: string;
    claimLedgerEntryId?: string;
    sourceId?: string;
    captureId?: string;
    sourceHash?: string;
  };
  noLeakBoundary: {
    metadataOnly: true;
    rawLeakMaterialAccessed: false;
    notificationDeliveredByScraper: false;
    sourceActivationPerformed: false;
  };
};
type TiAnalystReadinessChecklistItem = {
  id: string;
  code:
    | "metadata_captured"
    | "analyst_review_complete"
    | "unsafe_targets_resolved"
    | "source_activation_resolved"
    | "notification_packet_ready"
    | "claim_ledger_trusted"
    | "reviewed_evidence_sufficient";
  label: string;
  state: "pass" | "pending" | "blocked" | "not_applicable";
  detail: string;
  route?: string;
  counts?: Record<string, number>;
  noLeakBoundary: {
    metadataOnly: true;
    rawLeakMaterialAccessed: false;
    doesNotImplyVerification: true;
  };
};
type TiAnalystReviewItem =
  | ReturnType<typeof metadataReviewItemFromTask>
  | NonNullable<ReturnType<typeof metadataReviewItemFromCapture>>;

function analystActivityNoLeakBoundary(): TiAnalystActivityTimelineItem["noLeakBoundary"] {
  return {
    metadataOnly: true,
    rawLeakMaterialAccessed: false,
    notificationDeliveredByScraper: false,
    sourceActivationPerformed: false
  };
}

function sortAnalystActivityTimeline(items: TiAnalystActivityTimelineItem[]): TiAnalystActivityTimelineItem[] {
  return [...items].sort((left, right) => right.at.localeCompare(left.at) || left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
}

function analystWorkQueueNoLeakBoundary(): TiAnalystWorkQueueItem["noLeakBoundary"] {
  return {
    metadataOnly: true,
    rawLeakMaterialAccessed: false,
    notificationDeliveredExternally: false,
    sourceActivationPerformed: false,
    wording: "This queue item contains safe metadata and workflow state only; the scraper did not verify, download, or expose leaked contents.",
    whatWasNotAccessed: analystMetadataWhatWasNotAccessed()
  };
}

function sortAnalystWorkQueue(items: TiAnalystWorkQueueItem[]): TiAnalystWorkQueueItem[] {
  const priorityRank: Record<TiAnalystWorkQueueItem["priority"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  };
  const kindRank: Record<TiAnalystWorkQueueKind, number> = {
    blocked_unsafe_target: 0,
    metadata_review: 1,
    victim_notification: 2,
    source_activation: 3,
    claim_ledger: 4,
    queued_collection: 5
  };
  return [...items].sort((left, right) =>
    priorityRank[left.priority] - priorityRank[right.priority]
    || kindRank[left.kind] - kindRank[right.kind]
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id)
  );
}

function analystReadinessNoLeakBoundary(): TiAnalystReadinessChecklistItem["noLeakBoundary"] {
  return {
    metadataOnly: true,
    rawLeakMaterialAccessed: false,
    doesNotImplyVerification: true
  };
}

function analystReadinessChecklist(input: {
  resultState: TiAnalystLoopState;
  queuedTasks: number;
  metadataItemCount: number;
  openReviewTasks: number;
  blockedUnsafeTargets: number;
  approvalWorkItems: number;
  notificationDrafts: number;
  claimLedgerReviewItems: number;
  trustedClaimCount: number;
}): TiAnalystReadinessChecklistItem[] {
  const noLeakBoundary = analystReadinessNoLeakBoundary();
  const hasMetadata = input.metadataItemCount > 0;
  const ready = input.resultState === "ready";
  return [
    {
      id: stableId("analyst-readiness", "metadata_captured"),
      code: "metadata_captured",
      label: "Safe metadata captured",
      state: hasMetadata ? "pass" : input.queuedTasks > 0 ? "pending" : "not_applicable",
      detail: hasMetadata
        ? "At least one safe leak/threat-actor metadata claim is available for review."
        : input.queuedTasks > 0
          ? "Approved safe collection is still running before metadata can be reviewed."
          : "No safe leak/threat-actor metadata claim is available for this result.",
      route: hasMetadata ? "/v1/analyst/metadata-review-tasks" : input.queuedTasks > 0 ? "/v1/frontier/status" : undefined,
      counts: { metadataItems: input.metadataItemCount, queuedTasks: input.queuedTasks },
      noLeakBoundary
    },
    {
      id: stableId("analyst-readiness", "analyst_review_complete"),
      code: "analyst_review_complete",
      label: "Analyst review complete",
      state: ready ? "pass" : input.openReviewTasks > 0 ? "pending" : hasMetadata ? "pending" : "not_applicable",
      detail: ready
        ? "Reviewed evidence is sufficient for a usable answer."
        : input.openReviewTasks > 0
          ? "Safe metadata review tasks still need analyst action."
          : hasMetadata
            ? "Metadata exists, but the answer remains partial until review and trust gates complete."
            : "No metadata review task is present.",
      route: hasMetadata ? "/v1/analyst/metadata-review-tasks" : undefined,
      counts: { openReviewTasks: input.openReviewTasks, metadataItems: input.metadataItemCount },
      noLeakBoundary
    },
    {
      id: stableId("analyst-readiness", "unsafe_targets_resolved"),
      code: "unsafe_targets_resolved",
      label: "Unsafe targets resolved",
      state: input.blockedUnsafeTargets > 0 ? "blocked" : "pass",
      detail: input.blockedUnsafeTargets > 0
        ? "Raw leak, download, credential, private-access, or interaction targets remain blocked."
        : "No unsafe raw target is required for the current metadata-only workflow.",
      route: input.blockedUnsafeTargets > 0 ? "/v1/analyst/loop" : undefined,
      counts: { blockedUnsafeTargets: input.blockedUnsafeTargets },
      noLeakBoundary
    },
    {
      id: stableId("analyst-readiness", "source_activation_resolved"),
      code: "source_activation_resolved",
      label: "Source activation resolved",
      state: input.approvalWorkItems > 0 ? "pending" : "pass",
      detail: input.approvalWorkItems > 0
        ? "Operator/legal source approval work remains pending before any metadata-only collection can proceed."
        : "No source activation approval is blocking this result.",
      route: input.approvalWorkItems > 0 ? "/v1/analyst/source-activation-packets" : undefined,
      counts: { approvalWorkItems: input.approvalWorkItems },
      noLeakBoundary
    },
    {
      id: stableId("analyst-readiness", "notification_packet_ready"),
      code: "notification_packet_ready",
      label: "Victim notification packet ready",
      state: input.notificationDrafts > 0 ? "pending" : ready ? "pass" : hasMetadata ? "pending" : "not_applicable",
      detail: input.notificationDrafts > 0
        ? "A redacted victim/company notification draft exists and needs analyst-approved external handling."
        : ready
          ? "Notification context is not blocking the ready answer."
          : hasMetadata
            ? "Notification packet readiness still depends on review workflow state."
            : "No victim/company notification packet is needed yet.",
      route: input.notificationDrafts > 0 || hasMetadata ? "/v1/analyst/victim-notification-packets" : undefined,
      counts: { notificationDrafts: input.notificationDrafts },
      noLeakBoundary
    },
    {
      id: stableId("analyst-readiness", "claim_ledger_trusted"),
      code: "claim_ledger_trusted",
      label: "Claim ledger trusted",
      state: input.claimLedgerReviewItems > 0 && input.trustedClaimCount < input.claimLedgerReviewItems ? "pending" : hasMetadata || ready ? "pass" : "not_applicable",
      detail: input.claimLedgerReviewItems > 0 && input.trustedClaimCount < input.claimLedgerReviewItems
        ? "Claim ledger entries are still pending analyst trust, hold, duplicate, or contradiction decisions."
        : hasMetadata || ready
          ? "Claim ledger trust gate is not blocking this result."
          : "No claim ledger entries are present.",
      route: input.claimLedgerReviewItems > 0 ? "/v1/analyst/claim-ledger" : undefined,
      counts: { claimLedgerReviewItems: input.claimLedgerReviewItems, trustedClaimCount: input.trustedClaimCount },
      noLeakBoundary
    },
    {
      id: stableId("analyst-readiness", "reviewed_evidence_sufficient"),
      code: "reviewed_evidence_sufficient",
      label: "Reviewed evidence sufficient",
      state: ready ? "pass" : "pending",
      detail: ready
        ? "Enough reviewed evidence exists for a usable answer."
        : "The result remains partial until metadata review, trust gates, approval work, and unsafe-target blocks are resolved.",
      route: "/v1/analyst/loop",
      counts: {
        queuedTasks: input.queuedTasks,
        metadataItems: input.metadataItemCount,
        blockedUnsafeTargets: input.blockedUnsafeTargets,
        approvalWorkItems: input.approvalWorkItems
      },
      noLeakBoundary
    }
  ];
}

function analystWorkQueueFromLoopSummary(input: {
  queuedTaskCount: number;
  blockedUnsafeTargets: number;
  allReasons: string[];
  metadataReviewInbox: TiAnalystReviewItem[];
  sourceActivationActions: ReturnType<typeof sourceActivationActionsForAnalystLoop>;
  victimNotificationPacket?: ReturnType<typeof victimNotificationPacketFromReviewItem>;
}): TiAnalystWorkQueueItem[] {
  const noLeakBoundary = analystWorkQueueNoLeakBoundary();
  const items: TiAnalystWorkQueueItem[] = [];
  if (input.queuedTaskCount > 0) {
    items.push({
      id: stableId("analyst-work-queue", `queued:${input.queuedTaskCount}`),
      kind: "queued_collection",
      state: "queued",
      priority: "low",
      title: "Approved safe collection is running",
      detail: `${input.queuedTaskCount} approved collection task${input.queuedTaskCount === 1 ? "" : "s"} are queued for this run.`,
      route: "/v1/frontier/status",
      allowedActions: ["poll_status"],
      noLeakBoundary
    });
  }
  for (const item of input.metadataReviewInbox) {
    items.push({
      id: stableId("analyst-work-queue", `metadata:${item.id}`),
      kind: "metadata_review",
      state: "metadata_review",
      priority: "high",
      title: analystMetadataClaimHeadline(item),
      detail: "Review safe actor/victim/account/dataset metadata before notification or public wording.",
      route: "/v1/analyst/metadata-review-tasks",
      actionRoute: `/v1/analyst/metadata-review-tasks/${encodeURIComponent(item.id)}/actions`,
      allowedActions: [...item.allowedActions],
      claimHeadline: analystMetadataClaimHeadline(item),
      company: item.company,
      victim: item.victim,
      affectedAccounts: item.affectedAccounts,
      datasetSize: item.datasetSize,
      actorStatement: item.actorStatement,
      sourceHash: item.sourceHash,
      provenance: item.provenance,
      noLeakBoundary
    });
    items.push({
      id: stableId("analyst-work-queue", `claim-ledger:${item.id}`),
      kind: "claim_ledger",
      state: "metadata_review",
      priority: "medium",
      title: "Review claim ledger entries",
      detail: "Confirm victim, affected-account, dataset-size, and actor-statement claim rows before graph/STIX promotion.",
      route: "/v1/analyst/claim-ledger",
      allowedActions: ANALYST_CLAIM_LEDGER_ACTIONS,
      claimHeadline: analystMetadataClaimHeadline(item),
      company: item.company,
      victim: item.victim,
      affectedAccounts: item.affectedAccounts,
      datasetSize: item.datasetSize,
      actorStatement: item.actorStatement,
      sourceHash: item.sourceHash,
      provenance: item.provenance,
      noLeakBoundary
    });
  }
  if (input.victimNotificationPacket) {
    items.push({
      id: stableId("analyst-work-queue", `notification:${input.victimNotificationPacket.sourceHash ?? input.victimNotificationPacket.company ?? "unknown"}`),
      kind: "victim_notification",
      state: "metadata_review",
      priority: "high",
      title: "Prepare victim notification draft",
      detail: "Review the redacted notification packet and deliver only through an approved external workflow.",
      route: "/v1/analyst/victim-notification-packets",
      allowedActions: ["approve_packet", "cancel_packet", "record_external_sent"],
      claimHeadline: analystMetadataClaimHeadline(input.victimNotificationPacket),
      company: input.victimNotificationPacket.company,
      affectedAccounts: input.victimNotificationPacket.affectedAccounts,
      datasetSize: input.victimNotificationPacket.datasetSize,
      actorStatement: input.victimNotificationPacket.actorStatement,
      sourceHash: input.victimNotificationPacket.sourceHash,
      noLeakBoundary
    });
  }
  for (const action of input.sourceActivationActions) {
    items.push({
      id: stableId("analyst-work-queue", `activation:${action.action}:${action.sourceId ?? "unknown"}`),
      kind: action.execution === "blocked" ? "blocked_unsafe_target" : "source_activation",
      state: action.execution === "blocked" ? "blocked_unsafe_target" : "needs_source_activation",
      priority: action.execution === "blocked" ? "critical" : "medium",
      title: action.execution === "blocked" ? "Unsafe target remains blocked" : "Source activation approval needed",
      detail: action.reason,
      route: action.execution === "blocked" ? "/v1/analyst/loop" : "/v1/analyst/source-activation-packets",
      allowedActions: action.execution === "blocked" ? ["keep_blocked"] : ["approve_metadata_only", "keep_blocked", "request_legal_review"],
      noLeakBoundary
    });
  }
  if (input.blockedUnsafeTargets > 0 && !input.sourceActivationActions.some((action) => action.execution === "blocked")) {
    items.push({
      id: stableId("analyst-work-queue", `blocked:${input.allReasons.join("|").slice(0, 120)}`),
      kind: "blocked_unsafe_target",
      state: "blocked_unsafe_target",
      priority: "critical",
      title: "Unsafe raw target blocked",
      detail: "A raw leak, download, credential, private-access, or interaction target was blocked before collection.",
      route: "/v1/analyst/loop",
      allowedActions: ["keep_blocked", "request_legal_review"],
      noLeakBoundary
    });
  }
  return sortAnalystWorkQueue(items);
}

function analystWorkQueueFromReadModel(input: {
  queuedTasks: number;
  blockedUnsafeTargets: number;
  reviewTasks: AnalystMetadataReviewTask[];
  activationPackets: AnalystSourceActivationPacket[];
  notificationPackets: AnalystVictimNotificationPacket[];
  claimLedger: AnalystClaimLedgerEntry[];
}): TiAnalystWorkQueueItem[] {
  const noLeakBoundary = analystWorkQueueNoLeakBoundary();
  const items: TiAnalystWorkQueueItem[] = [];
  if (input.queuedTasks > 0) {
    items.push({
      id: stableId("analyst-work-queue", `read-model:queued:${input.queuedTasks}`),
      kind: "queued_collection",
      state: "queued",
      priority: "low",
      title: "Approved safe collection is running",
      detail: `${input.queuedTasks} approved collection task${input.queuedTasks === 1 ? "" : "s"} are queued or leased.`,
      route: "/v1/frontier/status",
      allowedActions: ["poll_status"],
      noLeakBoundary
    });
  }
  for (const task of input.reviewTasks) {
    items.push({
      id: stableId("analyst-work-queue", `read-model:metadata:${task.id}`),
      kind: "metadata_review",
      state: "metadata_review",
      priority: task.status === "escalated" ? "critical" : "high",
      title: analystMetadataClaimHeadline(task),
      detail: task.status === "notified"
        ? "Notification workflow has been prepared; keep claim metadata available for audit and follow-up."
        : "Review safe actor/victim/account/dataset metadata before notification or public wording.",
      route: "/v1/analyst/metadata-review-tasks",
      actionRoute: `/v1/analyst/metadata-review-tasks/${encodeURIComponent(task.id)}/actions`,
      allowedActions: analystMetadataAllowedActions(task.allowedActions),
      claimHeadline: analystMetadataClaimHeadline(task),
      company: task.company,
      victim: task.victim,
      affectedAccounts: task.affectedAccounts,
      datasetSize: task.datasetSize,
      actorStatement: task.actorStatement,
      sourceHash: task.sourceHash,
      provenance: task.provenance,
      noLeakBoundary
    });
  }
  for (const packet of input.activationPackets) {
    const blocked = packet.execution === "blocked";
    items.push({
      id: stableId("analyst-work-queue", `read-model:activation:${packet.id}`),
      kind: blocked ? "blocked_unsafe_target" : "source_activation",
      state: blocked ? "blocked_unsafe_target" : "needs_source_activation",
      priority: blocked ? "critical" : "medium",
      title: blocked ? "Unsafe target remains blocked" : "Source activation approval needed",
      detail: packet.reason,
      route: "/v1/analyst/source-activation-packets",
      actionRoute: `/v1/analyst/source-activation-packets/${encodeURIComponent(packet.id)}/actions`,
      allowedActions: blocked ? ["keep_blocked", "request_legal_review"] : ["approve_metadata_only", "keep_blocked", "request_legal_review"],
      noLeakBoundary
    });
  }
  for (const packet of input.notificationPackets) {
    items.push({
      id: stableId("analyst-work-queue", `read-model:notification:${packet.id}`),
      kind: "victim_notification",
      state: "metadata_review",
      priority: packet.status === "draft" ? "high" : "medium",
      title: packet.status === "draft" ? "Review victim notification draft" : "Track victim notification packet",
      detail: "Use the redacted packet for approved external notification; the scraper does not send it.",
      route: "/v1/analyst/victim-notification-packets",
      actionRoute: `/v1/analyst/victim-notification-packets/${encodeURIComponent(packet.id)}/actions`,
      allowedActions: ["approve_packet", "cancel_packet", "record_external_sent"],
      claimHeadline: analystMetadataClaimHeadline(packet),
      company: packet.company,
      victim: packet.victim,
      affectedAccounts: packet.affectedAccounts,
      datasetSize: packet.datasetSize,
      actorStatement: packet.actorStatement,
      sourceHash: packet.sourceHash,
      provenance: packet.provenance,
      noLeakBoundary
    });
  }
  for (const entry of input.claimLedger.filter((entry) => entry.ledgerStatus !== "closed")) {
    items.push({
      id: stableId("analyst-work-queue", `read-model:claim-ledger:${entry.id}`),
      kind: "claim_ledger",
      state: entry.ledgerStatus === "trusted" ? "ready" : "metadata_review",
      priority: entry.ledgerStatus === "contradicted" ? "critical" : entry.legalHold ? "high" : "medium",
      title: `Claim ledger: ${entry.claimKind.replace(/_/g, " ")}`,
      detail: entry.claimTextSummary,
      route: "/v1/analyst/claim-ledger",
      actionRoute: `/v1/analyst/claim-ledger/${encodeURIComponent(entry.id)}/actions`,
      allowedActions: ANALYST_CLAIM_LEDGER_ACTIONS,
      company: entry.company,
      victim: entry.victim,
      sourceHash: entry.sourceHash,
      provenance: entry.provenance,
      noLeakBoundary
    });
  }
  if (input.blockedUnsafeTargets > 0 && !items.some((item) => item.kind === "blocked_unsafe_target")) {
    items.push({
      id: stableId("analyst-work-queue", `read-model:blocked:${input.blockedUnsafeTargets}`),
      kind: "blocked_unsafe_target",
      state: "blocked_unsafe_target",
      priority: "critical",
      title: "Unsafe raw target blocked",
      detail: "A raw leak, download, credential, private-access, or interaction target was blocked before collection.",
      route: "/v1/analyst/loop",
      allowedActions: ["keep_blocked", "request_legal_review"],
      noLeakBoundary
    });
  }
  return sortAnalystWorkQueue(items);
}

function analystActivityTimelineFromLoopSummary(input: {
  metadataReviewInbox: TiAnalystReviewItem[];
  sourceActivationActions: ReturnType<typeof sourceActivationActionsForAnalystLoop>;
  victimNotificationPacket?: ReturnType<typeof victimNotificationPacketFromReviewItem>;
  blockedUnsafeTargets: number;
  allReasons: string[];
  fallbackAt: string;
}): TiAnalystActivityTimelineItem[] {
  const noLeakBoundary = analystActivityNoLeakBoundary();
  const items: TiAnalystActivityTimelineItem[] = [];
  for (const item of input.metadataReviewInbox) {
    const observedAt = "observedAt" in item && typeof item.observedAt === "string" ? item.observedAt : input.fallbackAt;
    items.push({
      id: stableId("analyst-activity", `capture:${item.id}:${item.sourceHash}`),
      at: observedAt,
      kind: "metadata_capture",
      actor: "system",
      title: "Metadata-only leak claim captured",
      summary: analystMetadataClaimHeadline(item),
      route: "/v1/analyst/metadata-review-tasks",
      subjectIds: {
        reviewTaskId: item.id,
        sourceId: item.sourceId,
        captureId: "captureId" in item ? item.captureId : undefined,
        sourceHash: item.sourceHash
      },
      noLeakBoundary
    });
    items.push({
      id: stableId("analyst-activity", `review-created:${item.id}`),
      at: input.fallbackAt,
      kind: "metadata_review_created",
      actor: "system",
      title: "Metadata review queued",
      summary: "Safe claim metadata was placed in the analyst review queue.",
      route: "/v1/analyst/metadata-review-tasks",
      subjectIds: {
        reviewTaskId: item.id,
        sourceId: item.sourceId,
        sourceHash: item.sourceHash
      },
      noLeakBoundary
    });
  }
  if (input.victimNotificationPacket) {
    items.push({
      id: stableId("analyst-activity", `notification-draft:${input.victimNotificationPacket.sourceHash ?? input.victimNotificationPacket.company ?? "unknown"}`),
      at: input.fallbackAt,
      kind: "notification_packet",
      actor: "system",
      title: "Victim notification draft prepared",
      summary: "A redacted notification packet is available for analyst approval; no external notification was sent.",
      route: "/v1/analyst/victim-notification-packets",
      subjectIds: {
        sourceHash: input.victimNotificationPacket.sourceHash
      },
      noLeakBoundary
    });
  }
  for (const action of input.sourceActivationActions) {
    items.push({
      id: stableId("analyst-activity", `activation:${action.action}:${action.sourceId ?? "unknown"}`),
      at: input.fallbackAt,
      kind: action.execution === "blocked" ? "unsafe_target_blocked" : "source_activation_decision",
      actor: "system",
      title: action.execution === "blocked" ? "Unsafe target blocked" : "Source approval workflow created",
      summary: action.reason,
      route: action.execution === "blocked" ? "/v1/analyst/loop" : "/v1/analyst/source-activation-packets",
      subjectIds: {
        sourceId: action.sourceId
      },
      noLeakBoundary
    });
  }
  if (input.blockedUnsafeTargets > 0 && !input.sourceActivationActions.some((action) => action.execution === "blocked")) {
    items.push({
      id: stableId("analyst-activity", `blocked:${input.allReasons.join("|").slice(0, 120)}`),
      at: input.fallbackAt,
      kind: "unsafe_target_blocked",
      actor: "system",
      title: "Unsafe target blocked",
      summary: "A raw leak, download, credential, private-access, or interaction target was blocked before collection.",
      route: "/v1/analyst/loop",
      subjectIds: {},
      noLeakBoundary
    });
  }
  return sortAnalystActivityTimeline(items);
}

function analystActivityTimelineFromReadModel(input: {
  reviewTasks: AnalystMetadataReviewTask[];
  activationPackets: AnalystSourceActivationPacket[];
  notificationPackets: AnalystVictimNotificationPacket[];
  claimLedger: AnalystClaimLedgerEntry[];
  blockedUnsafeTargets: number;
}): TiAnalystActivityTimelineItem[] {
  const noLeakBoundary = analystActivityNoLeakBoundary();
  const items: TiAnalystActivityTimelineItem[] = [];
  for (const task of input.reviewTasks) {
    items.push({
      id: stableId("analyst-activity", `read-model:review-created:${task.id}`),
      at: task.createdAt,
      kind: "metadata_review_created",
      actor: "system",
      title: "Metadata review queued",
      summary: analystMetadataClaimHeadline(task),
      route: "/v1/analyst/metadata-review-tasks",
      subjectIds: {
        reviewTaskId: task.id,
        sourceId: task.sourceId,
        captureId: task.captureId,
        sourceHash: task.sourceHash
      },
      noLeakBoundary
    });
    const lastAction = record(task.provenance.lastAnalystAction);
    if (lastAction) {
      items.push({
        id: stableId("analyst-activity", `read-model:review-action:${task.id}:${String(lastAction.action ?? task.status)}`),
        at: typeof lastAction.at === "string" ? lastAction.at : task.updatedAt,
        kind: "metadata_review_action",
        actor: "analyst",
        title: `Review action: ${String(lastAction.action ?? task.status).replace(/_/g, " ")}`,
        summary: typeof lastAction.reason === "string" && lastAction.reason ? lastAction.reason : "Analyst review action recorded.",
        route: `/v1/analyst/metadata-review-tasks/${encodeURIComponent(task.id)}/actions`,
        subjectIds: {
          reviewTaskId: task.id,
          sourceId: task.sourceId,
          captureId: task.captureId,
          sourceHash: task.sourceHash
        },
        noLeakBoundary
      });
    }
  }
  for (const packet of input.activationPackets) {
    items.push({
      id: stableId("analyst-activity", `read-model:activation:${packet.id}:${packet.approvedAt ?? packet.createdAt}`),
      at: packet.approvedAt ?? packet.createdAt,
      kind: "source_activation_decision",
      actor: packet.approvedAt ? "operator" : "system",
      title: packet.approvedAt ? "Source approval metadata recorded" : "Source approval packet created",
      summary: packet.approvedAt ? "Approval metadata was recorded; no source mutation or crawling was performed." : packet.reason,
      route: `/v1/analyst/source-activation-packets/${encodeURIComponent(packet.id)}/actions`,
      subjectIds: {
        activationPacketId: packet.id,
        sourceId: packet.sourceId
      },
      noLeakBoundary
    });
  }
  for (const packet of input.notificationPackets) {
    items.push({
      id: stableId("analyst-activity", `read-model:notification:${packet.id}:${packet.updatedAt}`),
      at: packet.sentAt ?? packet.updatedAt,
      kind: "notification_packet",
      actor: packet.status === "sent" ? "external" : packet.approvedBy ? "analyst" : "system",
      title: packet.status === "sent"
        ? "External notification recorded"
        : packet.status === "approved"
          ? "Notification packet approved"
          : packet.status === "cancelled"
            ? "Notification packet cancelled"
            : "Notification draft prepared",
      summary: packet.status === "sent"
        ? "An external workflow notification event was recorded; the scraper did not deliver it."
        : "Redacted victim notification packet state updated without exposing restricted material.",
      route: `/v1/analyst/victim-notification-packets/${encodeURIComponent(packet.id)}/actions`,
      subjectIds: {
        notificationPacketId: packet.id,
        reviewTaskId: packet.reviewTaskId,
        sourceHash: packet.sourceHash
      },
      noLeakBoundary
    });
  }
  for (const entry of input.claimLedger) {
    const lastAction = record(entry.provenance.lastAnalystLedgerAction);
    const at = typeof lastAction?.at === "string" ? lastAction.at : entry.reviewedAt ?? entry.updatedAt ?? entry.createdAt;
    items.push({
      id: stableId("analyst-activity", `read-model:claim:${entry.id}:${entry.ledgerStatus}:${at}`),
      at,
      kind: "claim_ledger_action",
      actor: lastAction ? "analyst" : "system",
      title: `Claim ledger ${entry.ledgerStatus.replace(/_/g, " ")}`,
      summary: entry.claimTextSummary,
      route: `/v1/analyst/claim-ledger/${encodeURIComponent(entry.id)}/actions`,
      subjectIds: {
        claimLedgerEntryId: entry.id,
        reviewTaskId: entry.reviewTaskId,
        sourceId: entry.sourceId,
        captureId: entry.captureId,
        sourceHash: entry.sourceHash
      },
      noLeakBoundary
    });
  }
  if (input.blockedUnsafeTargets > 0 && !items.some((item) => item.kind === "unsafe_target_blocked")) {
    items.push({
      id: stableId("analyst-activity", `read-model:blocked:${input.blockedUnsafeTargets}`),
      at: nowIso(),
      kind: "unsafe_target_blocked",
      actor: "system",
      title: "Unsafe target blocked",
      summary: "A raw leak, download, credential, private-access, or interaction target was blocked before collection.",
      route: "/v1/analyst/loop",
      subjectIds: {},
      noLeakBoundary
    });
  }
  return sortAnalystActivityTimeline(items).slice(0, 50);
}

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
  const sourceActivationActions = sourceActivationActionsForAnalystLoop(input.plan.reviewRequired, allReasons, input.run?.id, needsActivation, blockedUnsafeTargets);
  const firstReviewItem = metadataReviewInbox[0];
  const approvalWorkItems = needsActivation ? Math.max(1, sourceActivationActions.length) : 0;
  const notificationDrafts = firstReviewItem ? 1 : 0;
  const claimLedgerReviewItems = metadataReviewInbox.length;
  const meaningfulWorkCount = input.queuedTaskCount + reviewTaskCount + blockedUnsafeTargets + approvalWorkItems + notificationDrafts + claimLedgerReviewItems;
  const victimNotificationPacket = firstReviewItem ? victimNotificationPacketFromReviewItem(firstReviewItem) : undefined;
  const workQueue = analystWorkQueueFromLoopSummary({
    queuedTaskCount: input.queuedTaskCount,
    blockedUnsafeTargets,
    allReasons,
    metadataReviewInbox,
    sourceActivationActions,
    victimNotificationPacket
  });
  const activityTimeline = analystActivityTimelineFromLoopSummary({
    metadataReviewInbox,
    sourceActivationActions,
    victimNotificationPacket,
    blockedUnsafeTargets,
    allReasons,
    fallbackAt: nowIso()
  });
  const readinessChecklist = analystReadinessChecklist({
    resultState,
    queuedTasks: input.queuedTaskCount,
    metadataItemCount: metadataReviewInbox.length,
    openReviewTasks: reviewTaskCount,
    blockedUnsafeTargets,
    approvalWorkItems,
    notificationDrafts,
    claimLedgerReviewItems,
    trustedClaimCount: 0
  });
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
  return {
    resultState,
    headline: analystLoopHeadline(resultState, reviewTaskCount || meaningfulWorkCount || 1),
    nextSteps,
    runStatusClarity: {
      queuedTasks: input.queuedTaskCount,
      reviewTasks: reviewTaskCount,
      rejectedSources: input.rejectedSourceCount,
      blockedUnsafeTargets,
      approvalWorkItems,
      notificationDrafts,
      claimLedgerReviewItems,
      meaningfulWorkCount,
      emptyQueueDoesNotMeanNoWork: meaningfulWorkCount > input.queuedTaskCount,
      summary: `${input.queuedTaskCount} queued collection task${input.queuedTaskCount === 1 ? "" : "s"}, ${reviewTaskCount} metadata review task${reviewTaskCount === 1 ? "" : "s"}, ${blockedUnsafeTargets} unsafe target block${blockedUnsafeTargets === 1 ? "" : "s"}, ${approvalWorkItems} approval work item${approvalWorkItems === 1 ? "" : "s"}, ${notificationDrafts} notification draft${notificationDrafts === 1 ? "" : "s"}, ${input.rejectedSourceCount} rejected source${input.rejectedSourceCount === 1 ? "" : "s"}`
    },
    metadataReviewInbox,
    workQueue,
    activityTimeline,
    readinessChecklist,
    sourceActivationWorkflow: {
      required: needsActivation,
      dryRunOnly: true,
      actions: sourceActivationActions
    },
    victimNotificationPacket,
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
    allowedActions: Array.isArray(item.allowedActions) ? [...item.allowedActions] : ["notify_company", "mark_duplicate", "request_approval", "escalate"],
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
    captureId: undefined,
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

type AnalystMetadataReviewActionResult =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; code: string; message: string; details?: Record<string, unknown> };

function buildAnalystMetadataReviewInboxResponse(store: ScraperStore, input: {
  tenantId?: string;
  status?: string;
  cursor: number;
  limit: number;
}) {
  const allTasks = store.listAnalystMetadataReviewTasks()
    .filter((task) => !input.tenantId || task.tenantId === input.tenantId)
    .filter((task) => !input.status || task.status === input.status)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt));
  const tasks = allTasks.slice(input.cursor, input.cursor + input.limit);
  const taskIds = new Set(tasks.map((task) => task.id));
  const notificationPackets = store.listAnalystVictimNotificationPackets()
    .filter((packet) => taskIds.has(packet.reviewTaskId))
    .map(safeAnalystVictimNotificationPacketDto);
  const claimLedger = store.listAnalystClaimLedgerEntries()
    .filter((entry) => entry.reviewTaskId && taskIds.has(entry.reviewTaskId))
    .map(safeAnalystClaimLedgerEntryDto);
  const byStatus = store.listAnalystMetadataReviewTasks()
    .filter((task) => !input.tenantId || task.tenantId === input.tenantId)
    .reduce<Record<string, number>>((counts, task) => {
      counts[task.status] = (counts[task.status] ?? 0) + 1;
      return counts;
    }, {});

  return {
    contract: {
      endpoint: "/v1/analyst/metadata-review-tasks",
      method: "GET",
      schemaVersion: "ti.analyst_metadata_review_inbox.v1",
      metadataOnly: true,
      safeForApi: true,
      forbiddenFields: ["sourceUrl", "rawUrl", "targetUrl", "body", "html", "rawText", "payload", "downloadUrl", "credential secret", "cookie", "object_key", "fileName"],
      actionsEndpoint: "/v1/analyst/metadata-review-tasks/{taskId}/actions",
      allowedActions: ["notify_company", "mark_duplicate", "request_approval", "escalate"] satisfies AnalystReviewAction[]
    },
    page: {
      cursor: String(input.cursor),
      nextCursor: input.cursor + input.limit < allTasks.length ? String(input.cursor + input.limit) : undefined,
      total: allTasks.length,
      returned: tasks.length
    },
    runStatusClarity: {
      queuedTasks: 0,
      reviewTasks: allTasks.filter((task) => task.status === "open" || task.status === "approval_requested" || task.status === "escalated").length,
      metadataReviewTasks: allTasks.length,
      notificationDrafts: notificationPackets.filter((packet) => packet.status === "draft").length,
      meaningfulWorkCount: allTasks.length + notificationPackets.length,
      byStatus
    },
    tasks: tasks.map(safeAnalystMetadataReviewTaskDto),
    notificationPackets,
    claimLedger,
    guarantees: [
      "metadata-only leak and threat-actor claims are visible for analyst review",
      "notification packets are redacted drafts and are not sent by this route",
      "source activation remains dry-run or approval-gated",
      "restricted datasets, credentials, private access, CAPTCHA/auth bypass, and actor interaction are not accessed"
    ]
  };
}

function buildAnalystLoopReadModelResponse(store: ScraperStore, input: {
  tenantId?: string;
  query?: string;
  runId?: string;
  limit: number;
}) {
  const normalizedQuery = input.query ? normalizeSearchQuery(input.query) : undefined;
  const snapshots = store.listAnalystLoopSnapshots()
    .filter((snapshot) => !input.tenantId || snapshot.tenantId === input.tenantId)
    .filter((snapshot) => !input.runId || snapshot.runId === input.runId)
    .filter((snapshot) => !normalizedQuery || snapshot.normalizedQuery === normalizedQuery)
    .sort((left, right) => right.capturedAt.localeCompare(left.capturedAt));
  const latestSnapshot = snapshots[0];
  const snapshotReviewTaskIds = new Set(latestSnapshot?.reviewTaskIds ?? []);
  const snapshotActivationPacketIds = new Set(latestSnapshot?.activationPacketIds ?? []);
  const tasks = store.listAnalystMetadataReviewTasks()
    .filter((task) => !input.tenantId || task.tenantId === input.tenantId)
    .filter((task) => !input.runId || task.runId === input.runId)
    .filter((task) => !latestSnapshot || snapshotReviewTaskIds.has(task.id) || task.runId === latestSnapshot.runId || task.planId === latestSnapshot.planId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt))
    .slice(0, input.limit);
  const taskIds = new Set(tasks.map((task) => task.id));
  const rawActivationPackets = store.listAnalystSourceActivationPackets()
    .filter((packet) => !input.tenantId || packet.tenantId === input.tenantId)
    .filter((packet) => !input.runId || packet.runId === input.runId)
    .filter((packet) => !latestSnapshot || snapshotActivationPacketIds.has(packet.id) || packet.runId === latestSnapshot.runId || packet.planId === latestSnapshot.planId);
  const activationPackets = rawActivationPackets.map(safeAnalystSourceActivationPacketDto);
  const rawNotificationPackets = store.listAnalystVictimNotificationPackets()
    .filter((packet) => !input.tenantId || packet.tenantId === input.tenantId)
    .filter((packet) => taskIds.has(packet.reviewTaskId) || packet.id === latestSnapshot?.victimNotificationPacketId);
  const notificationPackets = rawNotificationPackets.map(safeAnalystVictimNotificationPacketDto);
  const rawClaimLedger = store.listAnalystClaimLedgerEntries()
    .filter((entry) => !input.tenantId || entry.tenantId === input.tenantId)
    .filter((entry) => !normalizedQuery || entry.normalizedQuery === normalizedQuery)
    .filter((entry) => taskIds.has(entry.reviewTaskId ?? "") || !latestSnapshot);
  const claimLedger = rawClaimLedger.map(safeAnalystClaimLedgerEntryDto);
  const openReviewTasks = tasks.filter((task) => task.status === "open" || task.status === "approval_requested" || task.status === "escalated").length;
  const blockedUnsafeTargets = latestSnapshot?.blockedUnsafeTargets
    ?? activationPackets.filter((packet) => packet.execution === "blocked").length
    ?? 0;
  const reviewTasks = latestSnapshot?.reviewTasks ?? openReviewTasks;
  const queuedTasks = latestSnapshot?.queuedTasks ?? 0;
  const approvalWorkItems = activationPackets.filter((packet) => packet.execution === "approval_required").length;
  const notificationDrafts = notificationPackets.filter((packet) => packet.status === "draft").length;
  const claimLedgerEntries = claimLedger.length;
  const recomputedMeaningfulWorkCount = queuedTasks + reviewTasks + blockedUnsafeTargets + activationPackets.length + notificationDrafts + claimLedgerEntries;
  const meaningfulWorkCount = Math.max(latestSnapshot?.meaningfulWorkCount ?? 0, recomputedMeaningfulWorkCount);
  const state: TiAnalystLoopState = latestSnapshot?.resultState
    ?? (reviewTasks > 0
      ? "metadata_review"
      : blockedUnsafeTargets > 0
        ? "blocked_unsafe_target"
        : activationPackets.some((packet) => packet.execution === "approval_required")
          ? "needs_source_activation"
          : queuedTasks > 0
            ? "queued"
            : "ready");
  const nextSteps = latestSnapshot?.nextSteps ?? [{
    state,
    label: state === "ready" ? "Ready" : "Review analyst-loop work",
    detail: state === "ready"
      ? "Enough reviewed evidence exists for a usable answer."
      : "Use the persisted metadata-only analyst-loop rows before promoting public wording.",
    tone: state === "blocked_unsafe_target" ? "bad" as const : state === "ready" ? "ok" as const : "watch" as const
  }];
  const workQueue = analystWorkQueueFromReadModel({
    queuedTasks,
    blockedUnsafeTargets,
    reviewTasks: tasks,
    activationPackets: rawActivationPackets,
    notificationPackets: rawNotificationPackets,
    claimLedger: rawClaimLedger
  });
  const activityTimeline = analystActivityTimelineFromReadModel({
    reviewTasks: tasks,
    activationPackets: rawActivationPackets,
    notificationPackets: rawNotificationPackets,
    claimLedger: rawClaimLedger,
    blockedUnsafeTargets
  });
  const readinessChecklist = analystReadinessChecklist({
    resultState: state,
    queuedTasks,
    metadataItemCount: tasks.length,
    openReviewTasks,
    blockedUnsafeTargets,
    approvalWorkItems,
    notificationDrafts,
    claimLedgerReviewItems: rawClaimLedger.filter((entry) => entry.ledgerStatus !== "closed").length,
    trustedClaimCount: rawClaimLedger.filter((entry) => entry.ledgerStatus === "trusted").length
  });

  return {
    contract: {
      endpoint: "/v1/analyst/loop",
      method: "GET",
      schemaVersion: "ti.analyst_loop_read_model.v1",
      metadataOnly: true,
      safeForApi: true,
      states: ["queued", "metadata_review", "blocked_unsafe_target", "needs_source_activation", "ready"] satisfies TiAnalystLoopState[],
      forbiddenFields: ["sourceUrl", "rawUrl", "targetUrl", "body", "html", "rawText", "payload", "downloadUrl", "credential secret", "cookie", "object_key", "fileName"]
    },
    query: input.query,
    normalizedQuery,
    tenantId: input.tenantId,
    runId: input.runId ?? latestSnapshot?.runId,
    state,
    headline: latestSnapshot?.headline ?? analystLoopHeadline(state, meaningfulWorkCount || 1),
    latestSnapshot: latestSnapshot ? safeAnalystLoopSnapshotDto(latestSnapshot) : undefined,
    snapshots: snapshots.slice(0, input.limit).map(safeAnalystLoopSnapshotDto),
    runStatusClarity: {
      queuedTasks,
      reviewTasks,
      rejectedSources: latestSnapshot?.rejectedSources ?? 0,
      blockedUnsafeTargets,
      approvalWorkItems,
      metadataReviewTasks: tasks.length,
      activationPackets: activationPackets.length,
      notificationDrafts,
      claimLedgerEntries,
      meaningfulWorkCount,
      emptyQueueDoesNotMeanNoWork: meaningfulWorkCount > queuedTasks,
      summary: `${queuedTasks} queued collection task${queuedTasks === 1 ? "" : "s"}, ${reviewTasks} metadata review task${reviewTasks === 1 ? "" : "s"}, ${blockedUnsafeTargets} unsafe target block${blockedUnsafeTargets === 1 ? "" : "s"}, ${approvalWorkItems} approval work item${approvalWorkItems === 1 ? "" : "s"}, ${notificationDrafts} notification draft${notificationDrafts === 1 ? "" : "s"}, ${claimLedgerEntries} claim ledger entr${claimLedgerEntries === 1 ? "y" : "ies"}`
    },
    nextSteps,
    workQueue,
    activityTimeline,
    readinessChecklist,
    reviewTasks: tasks.map(safeAnalystMetadataReviewTaskDto),
    sourceActivationPackets: activationPackets,
    notificationPackets,
    claimLedger,
    persistence: {
      currentBackend: "scraper_store_read_model",
      targetBackend: "postgres",
      durable: false,
      schemaMigration: "migrations/004_analyst_loop.sql",
      replayableFromStore: true,
      survivesFileBackedRestart: true
    },
    guarantees: [
      "read model replays metadata-only analyst-loop rows without rerunning collection",
      "raw leaked datasets, credentials, private access material, unsafe URLs, and actor-interaction transcripts are not exposed",
      "notification packets are drafts and are not delivered by this route",
      "source activation packets are dry-run or approval-gated and never silently activate restricted sources"
    ]
  };
}

function buildAnalystSourceActivationPacketsResponse(store: ScraperStore, input: {
  tenantId?: string;
  execution?: string;
  cursor: number;
  limit: number;
}) {
  const allPackets = store.listAnalystSourceActivationPackets()
    .filter((packet) => !input.tenantId || packet.tenantId === input.tenantId)
    .filter((packet) => !input.execution || packet.execution === input.execution)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const packets = allPackets.slice(input.cursor, input.cursor + input.limit).map(safeAnalystSourceActivationPacketDto);
  const byExecution = allPackets.reduce<Record<string, number>>((counts, packet) => {
    counts[packet.execution] = (counts[packet.execution] ?? 0) + 1;
    return counts;
  }, {});

  return {
    contract: {
      endpoint: "/v1/analyst/source-activation-packets",
      method: "GET",
      schemaVersion: "ti.analyst_source_activation_packets.v1",
      metadataOnly: true,
      safeForApi: true,
      actionsEndpoint: "/v1/analyst/source-activation-packets/{packetId}/actions",
      allowedActions: ["approve_metadata_only", "keep_blocked", "request_legal_review"],
      sourceMutationPerformed: false,
      crawlingStarted: false
    },
    page: {
      cursor: String(input.cursor),
      nextCursor: input.cursor + input.limit < allPackets.length ? String(input.cursor + input.limit) : undefined,
      total: allPackets.length,
      returned: packets.length
    },
    runStatusClarity: {
      activationPackets: allPackets.length,
      approvalRequired: allPackets.filter((packet) => packet.execution === "approval_required").length,
      dryRunOnly: allPackets.filter((packet) => packet.execution === "dry_run_only").length,
      blocked: allPackets.filter((packet) => packet.execution === "blocked").length,
      approvedDryRunPackets: allPackets.filter((packet) => packet.approvedAt).length,
      meaningfulWorkCount: allPackets.filter((packet) => packet.execution !== "blocked" || !packet.approvedAt).length,
      byExecution
    },
    packets,
    guarantees: [
      "activation packets are operator/legal approval metadata, not source mutations",
      "approving a packet records dry-run approval context only",
      "restricted sources are not silently restored, crawled, or fetched by this route",
      "raw leak downloads, credential material, private access, CAPTCHA/auth bypass, and threat-actor interaction remain blocked"
    ]
  };
}

type AnalystSourceActivationPacketActionResult =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; code: string; message: string; details?: Record<string, unknown> };

type AnalystSourceActivationExecutionPreviewResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; code: string; message: string; details?: Record<string, unknown> };

function analystSourceActivationApprovalWorkflow(packet: AnalystSourceActivationPacket) {
  const blocked = packet.execution === "blocked";
  const approved = Boolean(packet.approvedAt && packet.approvedBy);
  const safeToExecuteMetadataOnly = approved && !blocked;
  return {
    packetId: packet.id,
    sourceId: packet.sourceId,
    requestedAction: packet.action,
    execution: packet.execution,
    reason: packet.reason,
    approval: {
      required: packet.execution === "approval_required",
      approved,
      approvedBy: packet.approvedBy,
      approvedAt: packet.approvedAt,
      safeToExecuteMetadataOnly
    },
    expectedMetadataOnlyEffect: packet.expectedEffect,
    rollback: packet.rollback,
    allowedOperatorActions: blocked ? ["keep_blocked", "request_legal_review"] : ["approve_metadata_only", "keep_blocked", "request_legal_review"],
    requiredBeforeExecution: safeToExecuteMetadataOnly
      ? []
      : blocked
        ? ["repair or replace blocked unsafe target with a metadata listing before any activation"]
        : ["approve_metadata_only through /v1/analyst/source-activation-packets/{packetId}/actions"],
    deliveryBoundary: {
      dryRunOnly: true,
      sourceMutationPerformed: false,
      crawlingStarted: false,
      restrictedFetchEnabled: false,
      unsafeTargetConvertedToRunnableWork: false,
      externalGovernanceHandoffRequired: true
    },
    forbiddenOperations: [
      "automatic_source_activation",
      "restricted_fetch_enablement",
      "raw_leak_download",
      "credential_collection",
      "private_access",
      "authentication_or_captcha_bypass",
      "threat_actor_contact",
      "unsafe_url_execution"
    ]
  };
}

function buildAnalystSourceActivationExecutionPreviewResponse(store: ScraperStore, packetId: string): AnalystSourceActivationExecutionPreviewResult {
  const packet = store.listAnalystSourceActivationPackets().find((item) => item.id === packetId);
  if (!packet) return { ok: false, status: 404, code: "not_found", message: "Source activation packet not found" };
  const source = packet.sourceId ? store.getSource(packet.sourceId) : undefined;
  const blocked = packet.execution === "blocked";
  const approved = Boolean(packet.approvedAt && packet.approvedBy);
  const safeToExecuteMetadataOnly = approved && !blocked;

  return {
    ok: true,
    body: {
      contract: {
        endpoint: "/v1/analyst/source-activation-packets/{packetId}/execution-preview",
        method: "GET",
        schemaVersion: "ti.analyst_source_activation_execution_preview.v1",
        metadataOnly: true,
        safeForApi: true,
        dryRun: true,
        sourceMutationPerformed: false,
        crawlingStarted: false,
        restrictedFetchEnabled: false,
        unsafeTargetConvertedToRunnableWork: false
      },
      readiness: {
        safeToExecuteMetadataOnly,
        approved,
        blocked,
        execution: packet.execution,
        approvedBy: packet.approvedBy,
        approvedAt: packet.approvedAt,
        requiredBeforeExecution: safeToExecuteMetadataOnly
          ? []
          : blocked
            ? ["repair or replace blocked unsafe target with a metadata listing before any activation"]
            : ["approve_metadata_only through /v1/analyst/source-activation-packets/{packetId}/actions"]
      },
      packet: safeAnalystSourceActivationPacketDto(packet),
      approvalWorkflow: analystSourceActivationApprovalWorkflow(packet),
      source: source ? {
        id: source.id,
        name: source.name,
        type: source.type,
        status: source.status,
        tenantId: source.tenantId,
        trustScore: source.trustScore,
        governance: {
          approvalState: source.governance?.approvalState ?? "pending",
          legalBasis: source.catalog?.legalBasis,
          hasLegalNotes: Boolean(source.legalNotes.trim()),
          metadataOnly: source.governance?.metadataOnly ?? false
        },
        health: source.health ? {
          status: source.health.status,
          errorRate: source.health.errorRate,
          consecutiveFailures: source.health.consecutiveFailures,
          lastSuccessAt: source.health.lastSuccessAt,
          lastFailureAt: source.health.lastFailureAt
        } : undefined
      } : undefined,
      executionPreview: {
        expectedEffect: packet.expectedEffect,
        rollback: packet.rollback,
        willMutateSource: false,
        willStartCrawling: false,
        willEnableRestrictedFetch: false,
        willBypassAuthOrCaptcha: false,
        willContactThreatActor: false,
        willDownloadLeakMaterial: false,
        operatorHandoffRequired: true,
        nextOperatorStep: safeToExecuteMetadataOnly
          ? "Use a separate source-governance workflow to restore metadata-only source state, then schedule safe metadata collection."
          : "Resolve requiredBeforeExecution before any source-governance workflow can proceed."
      },
      forbiddenOperations: [
        "automatic_source_activation",
        "restricted_fetch_enablement",
        "raw_leak_download",
        "credential_collection",
        "private_access",
        "authentication_or_captcha_bypass",
        "threat_actor_contact",
        "unsafe_url_execution"
      ],
      guarantees: [
        "execution preview is a handoff packet only and never mutates source registry state",
        "approved packets remain metadata-only and dry-run until an explicit external governance workflow acts",
        "blocked unsafe targets cannot be converted into runnable work by approval",
        "raw leaked data, credentials, private access, CAPTCHA/auth bypass, and threat-actor interaction remain blocked"
      ]
    }
  };
}

function applyAnalystSourceActivationPacketAction(store: ScraperStore, packetId: string, input: {
  action: string;
  dryRun: boolean;
  operatorId?: string;
  reason?: string;
}): AnalystSourceActivationPacketActionResult {
  const packet = store.listAnalystSourceActivationPackets().find((item) => item.id === packetId);
  if (!packet) return { ok: false, status: 404, code: "not_found", message: "Source activation packet not found" };
  const allowedActions = ["approve_metadata_only", "keep_blocked", "request_legal_review"];
  if (!allowedActions.includes(input.action)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_action",
      message: "Unsupported source activation packet action",
      details: { allowedActions }
    };
  }
  if (input.action === "approve_metadata_only" && packet.execution === "blocked") {
    return {
      ok: false,
      status: 409,
      code: "unsafe_target_blocked",
      message: "Blocked unsafe targets cannot be approved for metadata-only activation",
      details: { packetId, execution: packet.execution }
    };
  }

  const now = nowIso();
  const approvedPacket: AnalystSourceActivationPacket = {
    ...packet,
    approvedBy: input.action === "approve_metadata_only" && !input.dryRun ? input.operatorId ?? "operator" : packet.approvedBy,
    approvedAt: input.action === "approve_metadata_only" && !input.dryRun ? now : packet.approvedAt
  };
  if (!input.dryRun && input.action === "approve_metadata_only") {
    store.saveAnalystSourceActivationPacket(approvedPacket);
  }

  return {
    ok: true,
    status: input.dryRun ? 200 : 202,
    body: {
      contract: {
        endpoint: "/v1/analyst/source-activation-packets/{packetId}/actions",
        method: "POST",
        schemaVersion: "ti.analyst_source_activation_packet_action.v1",
        metadataOnly: true,
        sourceMutationPerformed: false,
        crawlingStarted: false,
        restrictedFetchEnabled: false
      },
      dryRun: input.dryRun,
      action: input.action,
      packet: safeAnalystSourceActivationPacketDto(input.dryRun ? packet : approvedPacket),
      approvalWorkflow: analystSourceActivationApprovalWorkflow(input.dryRun ? packet : approvedPacket),
      result: {
        persisted: !input.dryRun && input.action === "approve_metadata_only",
        approvalRecorded: !input.dryRun && input.action === "approve_metadata_only",
        approvalDryRunOnly: true,
        message: sourceActivationPacketActionMessage(input.action, input.dryRun, input.reason)
      },
      guarantees: [
        "no source status was changed",
        "no crawl or restricted fetch was started",
        "raw leak downloads, credentials, private access, CAPTCHA/auth bypass, and threat actor interaction remain blocked"
      ]
    }
  };
}

function buildAnalystVictimNotificationPacketsResponse(store: ScraperStore, input: {
  tenantId?: string;
  status?: string;
  cursor: number;
  limit: number;
}) {
  const allPackets = store.listAnalystVictimNotificationPackets()
    .filter((packet) => !input.tenantId || packet.tenantId === input.tenantId)
    .filter((packet) => !input.status || packet.status === input.status)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt));
  const packets = allPackets.slice(input.cursor, input.cursor + input.limit).map(safeAnalystVictimNotificationPacketDto);
  const byStatus = allPackets.reduce<Record<string, number>>((counts, packet) => {
    counts[packet.status] = (counts[packet.status] ?? 0) + 1;
    return counts;
  }, {});

  return {
    contract: {
      endpoint: "/v1/analyst/victim-notification-packets",
      method: "GET",
      schemaVersion: "ti.analyst_victim_notification_packets.v1",
      metadataOnly: true,
      safeForApi: true,
      actionsEndpoint: "/v1/analyst/victim-notification-packets/{packetId}/actions",
      allowedActions: ["approve_packet", "cancel_packet", "record_external_sent"],
      externalDeliveryPerformed: false,
      rawLeakMaterialAccessed: false
    },
    page: {
      cursor: String(input.cursor),
      nextCursor: input.cursor + input.limit < allPackets.length ? String(input.cursor + input.limit) : undefined,
      total: allPackets.length,
      returned: packets.length
    },
    runStatusClarity: {
      notificationPackets: allPackets.length,
      drafts: allPackets.filter((packet) => packet.status === "draft").length,
      approved: allPackets.filter((packet) => packet.status === "approved").length,
      sentExternallyRecorded: allPackets.filter((packet) => packet.status === "sent").length,
      cancelled: allPackets.filter((packet) => packet.status === "cancelled").length,
      meaningfulWorkCount: allPackets.filter((packet) => packet.status === "draft" || packet.status === "approved").length,
      byStatus
    },
    packets,
    guarantees: [
      "notification packets are redacted analyst drafts until explicitly approved",
      "the scraper does not deliver email, ticket, phone, or external notification traffic",
      "record_external_sent records an external workflow event only",
      "raw leaked datasets, credentials, unsafe URLs, private access, CAPTCHA/auth bypass, and threat-actor interaction are not exposed"
    ]
  };
}

type AnalystVictimNotificationPacketExportResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; code: string; message: string; details?: Record<string, unknown> };

function buildAnalystVictimNotificationPacketExportResponse(store: ScraperStore, packetId: string): AnalystVictimNotificationPacketExportResult {
  const packet = store.listAnalystVictimNotificationPackets().find((item) => item.id === packetId);
  if (!packet) return { ok: false, status: 404, code: "not_found", message: "Victim notification packet not found" };
  const task = store.getAnalystMetadataReviewTask(packet.reviewTaskId);
  const claimLedger = store.listAnalystClaimLedgerEntries()
    .filter((entry) => entry.reviewTaskId === packet.reviewTaskId)
    .map(safeAnalystClaimLedgerEntryDto);
  const approved = packet.status === "approved" || packet.status === "sent";
  const safeToHandOff = approved && packet.safeToSend;

  return {
    ok: true,
    body: {
      contract: {
        endpoint: "/v1/analyst/victim-notification-packets/{packetId}/export",
        method: "GET",
        schemaVersion: "ti.analyst_victim_notification_export.v1",
        metadataOnly: true,
        safeForApi: true,
        externalDeliveryPerformed: false,
        rawLeakMaterialAccessed: false,
        transportCredentialsIncluded: false,
        doesNotVerifyLeakedDatasetContents: true
      },
      readiness: {
        safeToHandOff,
        status: packet.status,
        approvalRequired: !approved,
        approvedBy: packet.approvedBy,
        sentAt: packet.sentAt,
        requiredBeforeSend: safeToHandOff
          ? []
          : ["approve_packet through /v1/analyst/victim-notification-packets/{packetId}/actions"]
      },
      packet: {
        id: packet.id,
        reviewTaskId: packet.reviewTaskId,
        claimHeadline: analystMetadataClaimHeadline(packet),
        company: packet.company,
        victim: packet.victim,
        claimSummary: packet.claimSummary,
        affectedAccounts: packet.affectedAccounts,
        datasetSize: packet.datasetSize,
        actorStatementSummary: packet.actorStatement,
        claimedAt: packet.claimedAt,
        observedAt: packet.observedAt,
        confidence: packet.confidence,
        sourceHash: packet.sourceHash,
        provenance: packet.provenance,
        claimLedger,
        redactions: packet.redactions,
        whatWasNotAccessed: packet.whatWasNotAccessed,
        verificationBoundary: analystMetadataVerificationBoundary(),
        redactedNotification: analystVictimRedactedNotification(packet)
      },
      sourceReview: task ? {
        taskId: task.id,
        resultState: task.resultState,
        status: task.status,
        allowedActions: task.allowedActions,
        unsafeMaterialAccessed: task.unsafeMaterialAccessed
      } : undefined,
      delivery: {
        externalDeliveryPerformed: false,
        deliveryMustHappenOutsideScraper: true,
        allowedExternalActions: ["notify_company", "open_case", "attach_redacted_packet"],
        forbiddenActions: [
          "send_from_scraper",
          "include_raw_leaked_rows",
          "include_credentials",
          "include_unsafe_download_urls",
          "include_private_access_material",
          "contact_threat_actor"
        ]
      },
      guarantees: [
        "export packet contains redacted claim metadata and provenance only",
        "the scraper did not send a notification or open an external ticket",
        "raw leaked data, credentials, unsafe URLs, private access material, and actor-interaction transcripts are not present",
        "dataset contents are not verified or accessed by this packet"
      ]
    }
  };
}

type AnalystVictimNotificationPacketActionResult =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; code: string; message: string; details?: Record<string, unknown> };

function applyAnalystVictimNotificationPacketAction(store: ScraperStore, packetId: string, input: {
  action: string;
  dryRun: boolean;
  operatorId?: string;
  reason?: string;
}): AnalystVictimNotificationPacketActionResult {
  const packet = store.listAnalystVictimNotificationPackets().find((item) => item.id === packetId);
  if (!packet) return { ok: false, status: 404, code: "not_found", message: "Victim notification packet not found" };
  const allowedActions = ["approve_packet", "cancel_packet", "record_external_sent"];
  if (!allowedActions.includes(input.action)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_action",
      message: "Unsupported victim notification packet action",
      details: { allowedActions }
    };
  }
  if (input.action === "record_external_sent" && packet.status !== "approved" && packet.status !== "sent") {
    return {
      ok: false,
      status: 409,
      code: "notification_not_approved",
      message: "Notification packet must be approved before an external send can be recorded",
      details: { packetId, status: packet.status }
    };
  }

  const now = nowIso();
  const nextPacket: AnalystVictimNotificationPacket = {
    ...packet,
    status: input.action === "approve_packet"
      ? "approved"
      : input.action === "cancel_packet"
        ? "cancelled"
        : "sent",
    approvedBy: input.action === "approve_packet" && !input.dryRun ? input.operatorId ?? "operator" : packet.approvedBy,
    sentAt: input.action === "record_external_sent" && !input.dryRun ? now : packet.sentAt,
    safeToSend: input.action === "approve_packet" ? true : packet.safeToSend,
    updatedAt: now
  };
  if (!input.dryRun) {
    store.saveAnalystVictimNotificationPacket(nextPacket);
    const nextLedgerStatus: AnalystClaimLedgerEntry["ledgerStatus"] | undefined = input.action === "record_external_sent" ? "notified" : undefined;
    if (nextLedgerStatus) {
      for (const entry of store.listAnalystClaimLedgerEntries().filter((entry) => entry.reviewTaskId === packet.reviewTaskId)) {
        store.saveAnalystClaimLedgerEntry({ ...entry, ledgerStatus: nextLedgerStatus });
      }
    }
  }

  return {
    ok: true,
    status: input.dryRun ? 200 : 202,
    body: {
      contract: {
        endpoint: "/v1/analyst/victim-notification-packets/{packetId}/actions",
        method: "POST",
        schemaVersion: "ti.analyst_victim_notification_packet_action.v1",
        metadataOnly: true,
        externalDeliveryPerformed: false,
        rawLeakMaterialAccessed: false
      },
      dryRun: input.dryRun,
      action: input.action,
      packet: safeAnalystVictimNotificationPacketDto(input.dryRun ? packet : nextPacket),
      result: {
        persisted: !input.dryRun,
        nextStatus: nextPacket.status,
        externalDeliveryPerformed: false,
        message: victimNotificationPacketActionMessage(input.action, input.dryRun, input.reason)
      },
      guarantees: [
        "no notification was delivered by the scraper",
        "no restricted target was fetched",
        "raw leaked datasets, credentials, unsafe URLs, private access, CAPTCHA/auth bypass, and threat actor interaction remain blocked"
      ]
    }
  };
}

function applyAnalystMetadataReviewAction(store: ScraperStore, taskId: string, input: {
  action: string;
  dryRun: boolean;
  duplicateOf?: string;
  operatorId?: string;
  reason?: string;
}): AnalystMetadataReviewActionResult {
  const task = store.getAnalystMetadataReviewTask(taskId);
  if (!task) return { ok: false, status: 404, code: "not_found", message: "Metadata review task not found" };
  if (!isAnalystReviewAction(input.action)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_action",
      message: "Unsupported metadata review action",
      details: { allowedActions: task.allowedActions }
    };
  }
  const allowedActions = analystMetadataAllowedActions(task.allowedActions);
  if (!allowedActions.includes(input.action)) {
    return {
      ok: false,
      status: 409,
      code: "action_not_allowed",
      message: "Metadata review action is not allowed for this task",
      details: { allowedActions }
    };
  }

  const now = nowIso();
  const nextStatus = analystReviewStatusForAction(input.action);
  const updatedTask: AnalystMetadataReviewTask = {
    ...task,
    status: nextStatus,
    duplicateOf: input.action === "mark_duplicate" ? input.duplicateOf ?? task.duplicateOf : task.duplicateOf,
    updatedAt: now,
    provenance: {
      ...task.provenance,
      lastAnalystAction: {
        action: input.action,
        dryRun: input.dryRun,
        operatorId: input.operatorId,
        reason: input.reason,
        at: now,
        externalDeliveryPerformed: false
      }
    }
  };

  const notificationPacket = input.action === "notify_company"
    ? safeNotificationPacketForReviewTask(store, task, now)
    : undefined;

  if (!input.dryRun) {
    store.saveAnalystMetadataReviewTask(updatedTask);
    if (notificationPacket) store.saveAnalystVictimNotificationPacket(notificationPacket);
    for (const entry of store.listAnalystClaimLedgerEntries().filter((entry) => entry.reviewTaskId === task.id)) {
      store.saveAnalystClaimLedgerEntry({
        ...entry,
        ledgerStatus: input.action === "mark_duplicate"
          ? "duplicate"
          : input.action === "notify_company"
            ? "notified"
            : input.action === "request_approval"
              ? "metadata_review"
              : entry.ledgerStatus
      });
    }
  }

  return {
    ok: true,
    status: input.dryRun ? 200 : 202,
    body: {
      contract: {
        endpoint: "/v1/analyst/metadata-review-tasks/{taskId}/actions",
        method: "POST",
        schemaVersion: "ti.analyst_metadata_review_action.v1",
        metadataOnly: true,
        externalDeliveryPerformed: false,
        sourceActivationPerformed: false
      },
      dryRun: input.dryRun,
      action: input.action,
      task: safeAnalystMetadataReviewTaskDto(input.dryRun ? updatedTask : store.getAnalystMetadataReviewTask(task.id) ?? updatedTask),
      notificationPacket: notificationPacket ? safeAnalystVictimNotificationPacketDto(notificationPacket) : undefined,
      result: {
        status: nextStatus,
        persisted: !input.dryRun,
        message: analystReviewActionMessage(input.action, input.dryRun)
      },
      guarantees: [
        "no notification was delivered externally",
        "no restricted target was fetched",
        "no raw dataset, credential, private access material, or actor interaction transcript was accessed"
      ]
    }
  };
}

function safeAnalystMetadataReviewTaskDto(task: AnalystMetadataReviewTask) {
  const allowedActions = analystMetadataAllowedActions(task.allowedActions);

  return {
    id: task.id,
    tenantId: task.tenantId,
    planId: task.planId,
    runId: task.runId,
    taskId: task.taskId,
    sourceId: task.sourceId,
    captureId: task.captureId,
    status: task.status,
    resultState: task.resultState,
    claimHeadline: analystMetadataClaimHeadline(task),
    company: task.company,
    victim: task.victim,
    affectedAccounts: task.affectedAccounts,
    affectedAccountsCount: task.affectedAccountsCount,
    accountSubjects: task.accountSubjects,
    datasetSize: task.datasetSize,
    datasetSizeBytes: task.datasetSizeBytes,
    actorStatement: task.actorStatement,
    claimedAt: task.claimedAt,
    observedAt: task.observedAt,
    sourceHash: task.sourceHash,
    provenance: task.provenance,
    allowedActions: [...allowedActions],
    confidence: task.confidence,
    unsafeMaterialAccessed: false,
    whatWasNotAccessed: task.whatWasNotAccessed,
    verificationBoundary: analystMetadataVerificationBoundary(),
    duplicateOf: task.duplicateOf,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function analystMetadataAllowedActions(value: unknown): AnalystReviewAction[] {
  const fallback: AnalystReviewAction[] = ["notify_company", "mark_duplicate", "request_approval", "escalate"];
  if (!Array.isArray(value)) return fallback;
  const allowed = value.filter((action): action is AnalystReviewAction => typeof action === "string" && isAnalystReviewAction(action));
  return allowed.length ? allowed : fallback;
}

function safeAnalystVictimNotificationPacketDto(packet: AnalystVictimNotificationPacket) {
  return {
    id: packet.id,
    tenantId: packet.tenantId,
    reviewTaskId: packet.reviewTaskId,
    status: packet.status,
    claimHeadline: analystMetadataClaimHeadline(packet),
    company: packet.company,
    victim: packet.victim,
    claimSummary: packet.claimSummary,
    affectedAccounts: packet.affectedAccounts,
    datasetSize: packet.datasetSize,
    actorStatement: packet.actorStatement,
    claimedAt: packet.claimedAt,
    observedAt: packet.observedAt,
    sourceHash: packet.sourceHash,
    confidence: packet.confidence,
    provenance: packet.provenance,
    redactions: packet.redactions,
    whatWasNotAccessed: packet.whatWasNotAccessed,
    verificationBoundary: analystMetadataVerificationBoundary(),
    redactedNotification: analystVictimRedactedNotification(packet),
    safeToSend: packet.safeToSend,
    approvedBy: packet.approvedBy,
    sentAt: packet.sentAt,
    createdAt: packet.createdAt,
    updatedAt: packet.updatedAt
  };
}

function safeAnalystSourceActivationPacketDto(packet: AnalystSourceActivationPacket) {
  return {
    id: packet.id,
    tenantId: packet.tenantId,
    planId: packet.planId,
    runId: packet.runId,
    sourceId: packet.sourceId,
    action: packet.action,
    execution: packet.execution,
    reason: packet.reason,
    expectedEffect: packet.expectedEffect,
    rollback: packet.rollback,
    dryRun: true,
    approvalWorkflow: analystSourceActivationApprovalWorkflow(packet),
    approvedBy: packet.approvedBy,
    approvedAt: packet.approvedAt,
    createdAt: packet.createdAt
  };
}

function safeAnalystLoopSnapshotDto(snapshot: AnalystLoopSnapshot) {
  return {
    id: snapshot.id,
    tenantId: snapshot.tenantId,
    planId: snapshot.planId,
    runId: snapshot.runId,
    normalizedQuery: snapshot.normalizedQuery,
    resultState: snapshot.resultState,
    headline: snapshot.headline,
    queuedTasks: snapshot.queuedTasks,
    reviewTasks: snapshot.reviewTasks,
    rejectedSources: snapshot.rejectedSources,
    blockedUnsafeTargets: snapshot.blockedUnsafeTargets,
    meaningfulWorkCount: snapshot.meaningfulWorkCount,
    nextSteps: snapshot.nextSteps,
    reviewTaskIds: snapshot.reviewTaskIds,
    activationPacketIds: snapshot.activationPacketIds,
    victimNotificationPacketId: snapshot.victimNotificationPacketId,
    capturedAt: snapshot.capturedAt
  };
}

function safeAnalystClaimLedgerEntryDto(entry: AnalystClaimLedgerEntry) {
  return {
    id: entry.id,
    tenantId: entry.tenantId,
    normalizedQuery: entry.normalizedQuery,
    reviewTaskId: entry.reviewTaskId,
    captureId: entry.captureId,
    sourceId: entry.sourceId,
    claimKind: entry.claimKind,
    company: entry.company,
    victim: entry.victim,
    claimTextSummary: entry.claimTextSummary,
    sourceHash: entry.sourceHash,
    confidence: entry.confidence,
    ledgerStatus: entry.ledgerStatus,
    duplicateOf: entry.duplicateOf,
    contradictionReason: entry.contradictionReason,
    retentionClass: entry.retentionClass,
    legalHold: entry.legalHold === true,
    graphEligible: entry.graphEligible === true,
    stixEligible: entry.stixEligible === true,
    reviewedBy: entry.reviewedBy,
    reviewedAt: entry.reviewedAt,
    updatedAt: entry.updatedAt,
    observedAt: entry.observedAt,
    provenance: entry.provenance,
    createdAt: entry.createdAt
  };
}

type AnalystClaimLedgerAction =
  | "promote"
  | "hold"
  | "contradict"
  | "mark_duplicate"
  | "mark_stale"
  | "attach_confidence"
  | "attach_legal_hold"
  | "set_retention"
  | "close";

const ANALYST_CLAIM_LEDGER_ACTIONS: AnalystClaimLedgerAction[] = [
  "promote",
  "hold",
  "contradict",
  "mark_duplicate",
  "mark_stale",
  "attach_confidence",
  "attach_legal_hold",
  "set_retention",
  "close"
];

const API_RETENTION_CLASSES: RetentionClass[] = [
  "public_raw",
  "public_report",
  "public_chat_text",
  "darknet_metadata",
  "discovery_snippet",
  "live_search_snapshot",
  "evidence_delta",
  "screenshot_hash",
  "sensitive_metadata",
  "standard",
  "short",
  "restricted_metadata",
  "legal_hold"
];

function isAnalystClaimLedgerAction(action: string): action is AnalystClaimLedgerAction {
  return (ANALYST_CLAIM_LEDGER_ACTIONS as string[]).includes(action);
}

function isApiRetentionClass(value: string | undefined): value is RetentionClass {
  return Boolean(value && (API_RETENTION_CLASSES as string[]).includes(value));
}

function claimLedgerEligibility(entry: AnalystClaimLedgerEntry): { graphEligible: boolean; stixEligible: boolean; blockedReasons: string[] } {
  const blockedReasons = [
    entry.ledgerStatus !== "trusted" ? "claim_not_trusted" : undefined,
    entry.legalHold ? "legal_hold" : undefined,
    entry.ledgerStatus === "duplicate" ? "duplicate_claim" : undefined,
    entry.ledgerStatus === "contradicted" ? "contradicted_claim" : undefined,
    entry.ledgerStatus === "stale" ? "stale_claim" : undefined,
    entry.confidence < 0.65 ? "low_confidence" : undefined
  ].filter((reason): reason is string => Boolean(reason));
  const eligible = blockedReasons.length === 0;
  return { graphEligible: eligible, stixEligible: eligible, blockedReasons };
}

function buildAnalystClaimLedgerResponse(store: ScraperStore, options: {
  tenantId?: string;
  status?: string;
  claimKind?: string;
  query?: string;
  cursor: number;
  limit: number;
}) {
  const normalizedQuery = options.query?.trim().toLowerCase();
  const entries = store.listAnalystClaimLedgerEntries()
    .filter((entry) => !options.tenantId || entry.tenantId === options.tenantId)
    .filter((entry) => !options.status || entry.ledgerStatus === options.status)
    .filter((entry) => !options.claimKind || entry.claimKind === options.claimKind)
    .filter((entry) => !normalizedQuery || entry.normalizedQuery.includes(normalizedQuery) || entry.company?.toLowerCase().includes(normalizedQuery) || entry.victim?.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => (b.updatedAt ?? b.reviewedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.reviewedAt ?? a.createdAt));
  const page = entries.slice(options.cursor, options.cursor + options.limit);
  const nextCursor = options.cursor + options.limit < entries.length ? String(options.cursor + options.limit) : undefined;
  const byStatus = entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.ledgerStatus] = (acc[entry.ledgerStatus] ?? 0) + 1;
    return acc;
  }, {});
  const eligibleEntries = entries.map((entry) => ({ entry, eligibility: claimLedgerEligibility(entry) }));

  return {
    contract: {
      endpoint: "/v1/analyst/claim-ledger",
      actionsEndpoint: "/v1/analyst/claim-ledger/{entryId}/actions",
      schemaVersion: "ti.analyst_claim_ledger.v1",
      metadataOnly: true,
      safeForApi: true,
      rawLeakMaterialAccessed: false,
      objectKeysExposed: false,
      unsafeUrlsExposed: false
    },
    runStatusClarity: {
      totalClaims: entries.length,
      reviewRequired: entries.filter((entry) => entry.ledgerStatus === "metadata_review" || entry.ledgerStatus === "held").length,
      trusted: byStatus.trusted ?? 0,
      duplicates: byStatus.duplicate ?? 0,
      contradicted: byStatus.contradicted ?? 0,
      stale: byStatus.stale ?? 0,
      legalHolds: entries.filter((entry) => entry.legalHold).length,
      graphEligible: eligibleEntries.filter(({ eligibility }) => eligibility.graphEligible).length,
      stixEligible: eligibleEntries.filter(({ eligibility }) => eligibility.stixEligible).length,
      meaningfulWorkCount: entries.filter((entry) => entry.ledgerStatus !== "closed").length,
      byStatus
    },
    page: {
      cursor: String(options.cursor),
      nextCursor
    },
    allowedActions: ANALYST_CLAIM_LEDGER_ACTIONS,
    entries: page.map((entry) => {
      const eligibility = claimLedgerEligibility(entry);
      return {
        ...safeAnalystClaimLedgerEntryDto(entry),
        graphEligible: entry.graphEligible ?? eligibility.graphEligible,
        stixEligible: entry.stixEligible ?? eligibility.stixEligible,
        eligibilityBlockers: eligibility.blockedReasons,
        allowedActions: ANALYST_CLAIM_LEDGER_ACTIONS
      };
    }),
    guarantees: [
      "claim ledger rows contain metadata summaries and source hashes only",
      "restricted leak rows, credentials, unsafe source URLs, object keys, private content, and threat-actor interaction are not serialized",
      "graph and STIX eligibility are explicit review states, not automatic promotion of restricted claims"
    ]
  };
}

type AnalystClaimLedgerActionResult =
  | { ok: true; status: number; body: Record<string, unknown> }
  | { ok: false; status: number; code: string; message: string; details?: Record<string, unknown> };

function applyAnalystClaimLedgerAction(store: ScraperStore, entryId: string, input: {
  action: string;
  dryRun: boolean;
  operatorId?: string;
  reason?: string;
  duplicateOf?: string;
  contradictionReason?: string;
  confidence?: number;
  retentionClass?: string;
  legalHold?: boolean;
}): AnalystClaimLedgerActionResult {
  const entry = store.listAnalystClaimLedgerEntries().find((item) => item.id === entryId);
  if (!entry) return { ok: false, status: 404, code: "not_found", message: "Claim ledger entry not found" };
  if (!isAnalystClaimLedgerAction(input.action)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_action",
      message: "Unsupported claim ledger action",
      details: { allowedActions: ANALYST_CLAIM_LEDGER_ACTIONS }
    };
  }
  if (input.action === "mark_duplicate" && !input.duplicateOf) {
    return { ok: false, status: 400, code: "duplicate_target_required", message: "duplicateOf is required when marking a claim duplicate" };
  }
  if (input.action === "set_retention" && !isApiRetentionClass(input.retentionClass)) {
    return { ok: false, status: 400, code: "invalid_retention_class", message: "A valid retentionClass is required", details: { retentionClasses: API_RETENTION_CLASSES } };
  }
  if (input.confidence !== undefined && (input.confidence < 0 || input.confidence > 1)) {
    return { ok: false, status: 400, code: "invalid_confidence", message: "confidence must be between 0 and 1" };
  }

  const now = nowIso();
  const nextStatus: AnalystClaimLedgerEntry["ledgerStatus"] = input.action === "promote"
    ? "trusted"
    : input.action === "hold"
      ? "held"
      : input.action === "contradict"
        ? "contradicted"
        : input.action === "mark_duplicate"
          ? "duplicate"
          : input.action === "mark_stale"
            ? "stale"
            : input.action === "close"
              ? "closed"
              : entry.ledgerStatus;
  const nextLegalHold = input.action === "attach_legal_hold" ? input.legalHold ?? true : entry.legalHold;
  const nextRetentionClass = input.action === "set_retention"
    ? input.retentionClass as RetentionClass
    : nextLegalHold
      ? "legal_hold"
      : entry.retentionClass;
  const updated: AnalystClaimLedgerEntry = {
    ...entry,
    confidence: input.confidence ?? entry.confidence,
    ledgerStatus: nextStatus,
    duplicateOf: input.action === "mark_duplicate" ? input.duplicateOf : entry.duplicateOf,
    contradictionReason: input.action === "contradict" ? input.contradictionReason ?? input.reason ?? "analyst_contradiction" : entry.contradictionReason,
    retentionClass: nextRetentionClass,
    legalHold: nextLegalHold,
    reviewedBy: input.operatorId ?? entry.reviewedBy,
    reviewedAt: now,
    updatedAt: now,
    provenance: {
      ...entry.provenance,
      lastAnalystLedgerAction: {
        action: input.action,
        dryRun: input.dryRun,
        operatorId: input.operatorId,
        reason: input.reason,
        at: now,
        externalDeliveryPerformed: false,
        rawLeakMaterialAccessed: false
      }
    }
  };
  const eligibility = claimLedgerEligibility(updated);
  const withEligibility: AnalystClaimLedgerEntry = {
    ...updated,
    graphEligible: eligibility.graphEligible,
    stixEligible: eligibility.stixEligible
  };
  if (!input.dryRun) store.saveAnalystClaimLedgerEntry(withEligibility);

  return {
    ok: true,
    status: input.dryRun ? 200 : 202,
    body: {
      contract: {
        endpoint: "/v1/analyst/claim-ledger/{entryId}/actions",
        method: "POST",
        schemaVersion: "ti.analyst_claim_ledger_action.v1",
        metadataOnly: true,
        safeForApi: true,
        rawLeakMaterialAccessed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        graphPromotionAutomatic: false,
        stixPromotionAutomatic: false
      },
      dryRun: input.dryRun,
      action: input.action,
      entry: {
        ...safeAnalystClaimLedgerEntryDto(input.dryRun ? entry : withEligibility),
        eligibilityBlockers: eligibility.blockedReasons
      },
      result: {
        persisted: !input.dryRun,
        nextStatus: withEligibility.ledgerStatus,
        graphEligible: withEligibility.graphEligible,
        stixEligible: withEligibility.stixEligible,
        externalDeliveryPerformed: false
      },
      guarantees: [
        "claim review actions update metadata-only ledger state only",
        "no raw restricted source was fetched, downloaded, or serialized",
        "graph/STIX eligibility is held when claims are duplicate, stale, contradicted, low-confidence, or under legal hold"
      ]
    }
  };
}

function safeNotificationPacketForReviewTask(store: ScraperStore, task: AnalystMetadataReviewTask, now: string): AnalystVictimNotificationPacket {
  const existing = store.listAnalystVictimNotificationPackets().find((packet) => packet.reviewTaskId === task.id);
  if (existing) return { ...existing, updatedAt: now, safeToSend: false, status: existing.status === "sent" ? "sent" : "draft" };
  const company = task.company ?? task.victim ?? "Unknown organization";
  return {
    id: stableId("victim-notification", `${task.id}:${task.sourceHash}`),
    tenantId: task.tenantId,
    reviewTaskId: task.id,
    status: "draft",
    company,
    victim: task.victim,
    claimSummary: [
      `${company} was named in a metadata-only leak claim`,
      task.affectedAccounts ? `${task.affectedAccounts} were claimed affected` : undefined,
      task.datasetSize ? `${task.datasetSize} was claimed` : undefined
    ].filter(Boolean).join("; "),
    affectedAccounts: task.affectedAccounts,
    datasetSize: task.datasetSize,
    actorStatement: task.actorStatement,
    claimedAt: task.claimedAt,
    observedAt: task.observedAt,
    sourceHash: task.sourceHash,
    confidence: task.confidence,
    provenance: task.provenance,
    redactions: ["restricted_dataset_material", "credential_material", "private_access_material", "actor_interaction"],
    whatWasNotAccessed: [
      "No restricted dataset was downloaded or opened.",
      "No credentials, cookies, private channels, or invite-only areas were accessed.",
      "No CAPTCHA, authentication, or access-control bypass was attempted.",
      "No threat actor interaction was performed."
    ],
    safeToSend: false,
    createdAt: now,
    updatedAt: now
  };
}

function isAnalystReviewAction(value: string): value is AnalystReviewAction {
  return value === "notify_company" || value === "mark_duplicate" || value === "request_approval" || value === "escalate";
}

function analystReviewStatusForAction(action: AnalystReviewAction): AnalystMetadataReviewTask["status"] {
  if (action === "mark_duplicate") return "duplicate";
  if (action === "request_approval") return "approval_requested";
  if (action === "escalate") return "escalated";
  if (action === "notify_company") return "notified";
  return "open";
}

function analystReviewActionMessage(action: AnalystReviewAction, dryRun: boolean): string {
  const prefix = dryRun ? "Dry run prepared" : "Analyst action recorded";
  if (action === "notify_company") return `${prefix}; a redacted notification packet is available but was not delivered externally.`;
  if (action === "mark_duplicate") return `${prefix}; the task is marked duplicate without deleting provenance.`;
  if (action === "request_approval") return `${prefix}; operator/legal approval is requested before metadata-only activation.`;
  return `${prefix}; the task is escalated for analyst or legal review.`;
}

function sourceActivationPacketActionMessage(action: string, dryRun: boolean, reason: string | undefined): string {
  const suffix = reason ? ` Reason: ${reason}` : "";
  if (action === "approve_metadata_only") {
    return `${dryRun ? "Dry run prepared" : "Approval metadata recorded"}; no source was activated and no crawl was started.${suffix}`;
  }
  if (action === "keep_blocked") {
    return `Packet remains blocked; unsafe target controls stay enforced.${suffix}`;
  }
  return `Legal review requested; packet remains approval-gated and non-mutating.${suffix}`;
}

function victimNotificationPacketActionMessage(action: string, dryRun: boolean, reason: string | undefined): string {
  const suffix = reason ? ` Reason: ${reason}` : "";
  if (action === "approve_packet") {
    return `${dryRun ? "Dry run prepared" : "Notification packet approved"}; no external notification was delivered by the scraper.${suffix}`;
  }
  if (action === "cancel_packet") {
    return `${dryRun ? "Dry run prepared" : "Notification packet cancelled"}; provenance and claim ledger remain available for audit.${suffix}`;
  }
  return `${dryRun ? "Dry run prepared" : "External notification event recorded"}; delivery happened outside the scraper and no restricted content was accessed.${suffix}`;
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

function searchQualityDashboardForQuery(input: {
  query: string;
  tenantId?: string;
  options: ApiServerOptions;
  generatedAt?: string;
}): SearchQualityDashboardDto {
  const evidence = searchQualityEvidence(input);
  if (evidence.length === 0) {
    return {
      schemaVersion: "ti.search_quality_dashboard.v1",
      query: input.query,
      generatedAt: input.generatedAt ?? nowIso(),
      status: "partial",
      score: 0,
      metrics: {
        usefulAnswerRate: 0,
        expectedFactRecall: 0,
        staleFactSuppression: "pass",
        contradictionHandling: "pass",
        sourceFamilyDiversity: 0,
        evidenceCount: 0,
        citationAvailability: 0,
        freshnessScore: 0
      },
      releaseGate: {
        decision: "partial",
        reasons: ["waiting_for_evidence"]
      },
      fields: [],
      reviewQueues: {
        sourceActivation: ["waiting_for_evidence"],
        parserRepair: [],
        graphReview: [],
        analystReview: []
      }
    };
  }
  const dto = buildLiveActorIntelligenceDto({ query: input.query, evidence });
  const gate = evaluateSearchQualityGate({
    dto,
    graphReviewState: graphReviewStateForEvidence(evidence)
  });
  return buildSearchQualityDashboardDto(dto, gate, input.generatedAt);
}

function entityResolutionWorkbenchForQuery(input: {
  query: string;
  tenantId?: string;
  options: ApiServerOptions;
  generatedAt?: string;
}) {
  const evidence = searchQualityEvidence(input);
  return buildEntityResolutionWorkbenchDto({
    query: input.query,
    evidence,
    generatedAt: input.generatedAt
  });
}

function timelinessGroundTruthForQuery(input: {
  query: string;
  tenantId?: string;
  options: ApiServerOptions;
  generatedAt?: string;
}) {
  const evidence = searchQualityEvidence(input);
  return buildTimelinessGroundTruthHarnessDto({
    query: input.query,
    evidence,
    generatedAt: input.generatedAt
  });
}

function attackMappingQualityForQuery(input: {
  query: string;
  tenantId?: string;
  options: ApiServerOptions;
  generatedAt?: string;
}) {
  const evidence = searchQualityEvidence(input);
  return buildAttackMappingQualityDto({
    query: input.query,
    evidence,
    generatedAt: input.generatedAt
  });
}

function analystFeedbackLoopForQuery(input: {
  query: string;
  tenantId?: string;
  options: ApiServerOptions;
  actorProfile?: ReturnType<typeof actorProfileForQuery>;
  qualityDashboard?: SearchQualityDashboardDto;
  entityResolutionWorkbench?: ReturnType<typeof entityResolutionWorkbenchForQuery>;
  timelinessGroundTruth?: ReturnType<typeof timelinessGroundTruthForQuery>;
  generatedAt?: string;
}) {
  const evidence = searchQualityEvidence(input);
  const dto = evidence.length > 0 ? buildLiveActorIntelligenceDto({ query: input.query, evidence }) : undefined;
  const answer = dto ? buildPublicIntelAnswerDto(dto, searchQualityForQuery(input)) : undefined;
  return buildAnalystFeedbackLoopDto({
    query: input.query,
    actorProfile: dto,
    claims: answer?.claims,
    qualityDashboard: input.qualityDashboard,
    entityResolutionWorkbench: input.entityResolutionWorkbench,
    timelinessGroundTruth: input.timelinessGroundTruth,
    generatedAt: input.generatedAt
  });
}

function qualityRegressionSuiteForQuery(input: {
  query: string;
  analystFeedbackLoop: ReturnType<typeof analystFeedbackLoopForQuery>;
  timelinessGroundTruth?: ReturnType<typeof timelinessGroundTruthForQuery>;
  attackMappingQuality?: ReturnType<typeof attackMappingQualityForQuery>;
  generatedAt?: string;
}) {
  return buildQualityRegressionSuiteDto({
    query: input.query,
    feedbackLoop: input.analystFeedbackLoop,
    timelinessGroundTruth: input.timelinessGroundTruth,
    attackMappingQuality: input.attackMappingQuality,
    generatedAt: input.generatedAt
  });
}

function actorProfileReviewWorkbenchForQuery(input: {
  query: string;
  tenantId?: string;
  options: ApiServerOptions;
  analystFeedbackLoop: ReturnType<typeof analystFeedbackLoopForQuery>;
  timelinessGroundTruth?: ReturnType<typeof timelinessGroundTruthForQuery>;
  attackMappingQuality?: ReturnType<typeof attackMappingQualityForQuery>;
  generatedAt?: string;
}) {
  const evidence = searchQualityEvidence(input);
  const dto = evidence.length > 0 ? buildLiveActorIntelligenceDto({ query: input.query, evidence }) : undefined;
  const answer = dto ? buildPublicIntelAnswerDto(dto, searchQualityForQuery(input)) : undefined;
  return buildActorProfileReviewWorkbenchDto({
    query: input.query,
    actorProfile: dto,
    claims: answer?.claims,
    feedbackLoop: input.analystFeedbackLoop,
    timelinessGroundTruth: input.timelinessGroundTruth,
    attackMappingQuality: input.attackMappingQuality,
    generatedAt: input.generatedAt
  });
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

function buildCanaryOperatorConsoleHtml(view: ReturnType<typeof buildCanaryOperatorSummary>): string {
  const healthState = view.schedulerHealth.errorRate > 0.1 || view.evidenceStorage.missingObjectReferenceCount > 0
    ? "warn"
    : view.activeSources.length > 0 && view.latestCaptures.length > 0
      ? "ok"
      : "hold";
  const freshnessLabel = view.schedulerHealth.freshnessSeconds === 0
    ? "fresh"
    : `${view.schedulerHealth.freshnessSeconds}s old`;
  const rows = view.publicAnswerReadiness.map((item) => `
          <tr>
            <td>${escapeHtml(item.query)}</td>
            <td>${item.captureCount}</td>
            <td>${escapeHtml(item.latestCollectedAt ?? "waiting")}</td>
            <td>${item.whyPartial.map(escapeHtml).join("; ")}</td>
          </tr>`).join("");
  const captures = view.latestCaptures.map((capture) => `
          <tr>
            <td>${escapeHtml(capture.captureId)}</td>
            <td>${escapeHtml(capture.sourceId)}</td>
            <td>${escapeHtml(capture.title ?? "untitled")}</td>
            <td>${escapeHtml(capture.storageKind)}</td>
            <td>${escapeHtml(capture.fetchProvenance?.mode ?? "unknown")}</td>
            <td>${escapeHtml(capture.collectedAt)}</td>
          </tr>`).join("");
  const sources = view.activeSources.map((source) => `
          <tr>
            <td>${escapeHtml(source.sourceName)}</td>
            <td>${escapeHtml(source.type)}</td>
            <td>${escapeHtml(source.status)}</td>
            <td>${source.trustScore.toFixed(2)}</td>
            <td>${escapeHtml(source.lastCollectedAt ?? "not yet")}</td>
          </tr>`).join("");
  const blocked = view.blockedOrHeldItems.map((item) => `
          <tr>
            <td>${escapeHtml(item.state)}</td>
            <td>${escapeHtml(item.sourceId ?? item.taskId ?? "unknown")}</td>
            <td>${escapeHtml(item.reason)}</td>
          </tr>`).join("") || `<tr><td>ok</td><td>none</td><td>No held or blocked canary items.</td></tr>`;
  const runtimeRows = [
    ["Supervisor", view.runtime.supervisorAttached ? "attached" : "not attached"],
    ["Enabled", view.runtime.enabled ? "yes" : "no"],
    ["Running", view.runtime.running ? "yes" : "no"],
    ["Cadence", view.runtime.intervalSeconds > 0 ? `${view.runtime.intervalSeconds}s` : "manual"],
    ["Next cycle", view.runtime.nextCycleAt ?? "not scheduled"],
    ["Last success", view.runtime.lastSuccessAt ?? "waiting"],
    ["Consecutive errors", String(view.runtime.consecutiveErrorCount)],
    ["Queue limit", String(view.runtime.queueLimit)]
  ].map(([label, value]) => `
          <tr>
            <td>${escapeHtml(label)}</td>
            <td>${escapeHtml(value)}</td>
          </tr>`).join("");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="30">
    <title>TI Canary Ops</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; background: #f6f7f9; color: #1f2933; }
      main { max-width: 1180px; margin: 0 auto; padding: 24px; }
      header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
      h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: 0; }
      h2 { font-size: 15px; margin: 24px 0 8px; letter-spacing: 0; }
      a { color: #175cd3; }
      .subtle { color: #667085; font-size: 13px; }
      .pill { border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
      .ok { background: #dff7e8; color: #14532d; }
      .warn { background: #fff1c2; color: #713f12; }
      .hold { background: #e7edf5; color: #344054; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
      .metric { background: #fff; border: 1px solid #d9dee7; border-radius: 8px; padding: 12px; min-height: 76px; }
      .metric span { display: block; color: #667085; font-size: 12px; }
      .metric strong { display: block; font-size: 22px; margin-top: 6px; }
      .controls { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0 4px; }
      .controls form { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #d9dee7; border-radius: 8px; padding: 8px; }
      .controls input { width: 68px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 7px; font: inherit; }
      button { border: 0; border-radius: 6px; padding: 8px 10px; background: #175cd3; color: #fff; font-weight: 700; cursor: pointer; }
      button.secondary { background: #344054; }
      button.danger { background: #b42318; }
      table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d9dee7; border-radius: 8px; overflow: hidden; }
      th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #edf0f4; font-size: 13px; vertical-align: top; }
      th { background: #eef2f6; color: #344054; font-size: 12px; text-transform: uppercase; }
      tr:last-child td { border-bottom: 0; }
      @media (max-width: 760px) { main { padding: 16px; } header { display: block; } .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } table { display: block; overflow-x: auto; } }
      @media (prefers-color-scheme: dark) { body { background: #111827; color: #e5e7eb; } .metric, table { background: #182230; border-color: #344054; } th { background: #202b3a; color: #cbd5e1; } td, th { border-bottom-color: #344054; } .subtle { color: #98a2b3; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>TI Canary Ops</h1>
          <div class="subtle">Generated ${escapeHtml(view.generatedAt)} · ${escapeHtml(freshnessLabel)} · <a href="/v1/ops/canary">JSON</a></div>
        </div>
        <span class="pill ${healthState}">${healthState}</span>
      </header>
      <section class="controls" aria-label="Canary controls">
        <form method="post" action="/v1/sources/canary-activation">
          <input type="hidden" name="operatorApproval" value="true">
          <input type="hidden" name="approvedBy" value="console-operator">
          <button type="submit">Approve Sources</button>
        </form>
        <form method="post" action="/v1/ops/canary/run">
          <input type="hidden" name="operatorApproval" value="true">
          <input type="hidden" name="approvedBy" value="console-operator">
          <label class="subtle">Sources <input name="maxSources" type="number" min="1" max="10" value="3"></label>
          <label class="subtle">Tasks <input name="maxTasks" type="number" min="1" max="10" value="3"></label>
          <button class="secondary" type="submit">Run Canary</button>
        </form>
        <form method="post" action="/v1/sources/canary-pause">
          <input type="hidden" name="operatorApproval" value="true">
          <input type="hidden" name="approvedBy" value="console-operator">
          <button class="danger" type="submit">Pause Sources</button>
        </form>
      </section>
      <section class="grid" aria-label="Canary metrics">
        <div class="metric"><span>Active sources</span><strong>${view.activeSources.length}</strong></div>
        <div class="metric"><span>Queued work</span><strong>${view.queue.queued}</strong></div>
        <div class="metric"><span>Latest captures</span><strong>${view.latestCaptures.length}</strong></div>
        <div class="metric"><span>Promotion yield</span><strong>${view.schedulerHealth.promotionYield.toFixed(2)}</strong></div>
        <div class="metric"><span>Error rate</span><strong>${view.schedulerHealth.errorRate.toFixed(2)}</strong></div>
        <div class="metric"><span>Duplicate rate</span><strong>${view.schedulerHealth.duplicateRate.toFixed(2)}</strong></div>
        <div class="metric"><span>External objects</span><strong>${view.evidenceStorage.externalObjectCaptureCount}</strong></div>
        <div class="metric"><span>Evidence mode</span><strong>${escapeHtml(view.evidenceStorage.productionEvidenceMode)}</strong></div>
        <div class="metric"><span>Native HTTP</span><strong>${view.evidenceStorage.nativeLiveHttpCaptureCount}</strong></div>
        <div class="metric"><span>Proof fetches</span><strong>${view.evidenceStorage.injectedProofFetchCaptureCount}</strong></div>
        <div class="metric"><span>Extraction confidence</span><strong>${view.extraction.averageIncidentConfidence.toFixed(2)}</strong></div>
        <div class="metric"><span>Loop enabled</span><strong>${view.runtime.enabled ? "Yes" : "No"}</strong></div>
        <div class="metric"><span>Loop cadence</span><strong>${view.runtime.intervalSeconds > 0 ? `${view.runtime.intervalSeconds}s` : "Manual"}</strong></div>
      </section>
      <h2>Runtime Loop</h2>
      <table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${runtimeRows}</tbody></table>
      <h2>Public Answer Readiness</h2>
      <table><thead><tr><th>Query</th><th>Captures</th><th>Latest</th><th>Why Partial</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>Active Sources</h2>
      <table><thead><tr><th>Source</th><th>Type</th><th>Status</th><th>Trust</th><th>Last Capture</th></tr></thead><tbody>${sources}</tbody></table>
      <h2>Latest Captures</h2>
      <table><thead><tr><th>Capture</th><th>Source</th><th>Title</th><th>Storage</th><th>Fetch Mode</th><th>Collected</th></tr></thead><tbody>${captures || `<tr><td colspan="6">No canary captures yet.</td></tr>`}</tbody></table>
      <h2>Blocked Or Held</h2>
      <table><thead><tr><th>State</th><th>Subject</th><th>Reason</th></tr></thead><tbody>${blocked}</tbody></table>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function buildOpsProductSloDashboard(options: ApiServerOptions, url: URL): Record<string, unknown> {
  const resources = options.config ? resourceSnapshot(options) : undefined;
  const memoryRssGb = typeof resources?.memory.rssMb === "number" ? resources.memory.rssMb / 1024 : undefined;
  const proofMode = liveProductProofMode(url.searchParams.get("proofMode"));
  return buildLiveProductSloDashboard({
    generatedAt: url.searchParams.get("generatedAt") ?? undefined,
    proofMode,
    runs: options.store.listRuns(),
    sources: options.store.listSources(),
    captures: options.store.listCaptures(),
    incidents: options.store.listIncidents(),
    frontier: options.frontier.groupedSnapshot(),
    resource: {
      memoryRssGb,
      diskGrowthGbPerDay: numberQuery(url.searchParams.get("diskGrowthGbPerDay")),
      diskFreeGb: numberQuery(url.searchParams.get("diskFreeGb")),
      diskUsedGb: numberQuery(url.searchParams.get("diskUsedGb"))
    },
    actorRun: {
      actorId: url.searchParams.get("actorId") ?? undefined,
      actorVersion: url.searchParams.get("actorVersion") ?? undefined,
      buildId: url.searchParams.get("actorBuildId") ?? undefined,
      imageId: url.searchParams.get("actorImageId") ?? undefined,
      runId: url.searchParams.get("actorRunId") ?? undefined,
      datasetId: url.searchParams.get("actorDatasetId") ?? undefined,
      status: actorRunStatus(url.searchParams.get("actorStatus")),
      queryCount: numberQuery(url.searchParams.get("actorQueryCount")) ?? null,
      rowCount: numberQuery(url.searchParams.get("actorRowCount")) ?? null,
      usefulRowCount: numberQuery(url.searchParams.get("actorUsefulRowCount")) ?? null,
      freshRowCount: numberQuery(url.searchParams.get("actorFreshRowCount")) ?? null,
      staleRowCount: numberQuery(url.searchParams.get("actorStaleRowCount")) ?? null,
      activityClaimRowCount: numberQuery(url.searchParams.get("actorActivityClaimRows")) ?? null,
      sellableRowCount: numberQuery(url.searchParams.get("actorSellableRows")) ?? null,
      includedWithCaveatRowCount: numberQuery(url.searchParams.get("actorIncludedWithCaveatRows")) ?? null,
      coverageGapOnlyRowCount: numberQuery(url.searchParams.get("actorCoverageGapOnlyRows")) ?? null,
      holdRowCount: numberQuery(url.searchParams.get("actorHoldRows")) ?? null,
      suppressRowCount: numberQuery(url.searchParams.get("actorSuppressRows")) ?? null,
      targetSellableRows: numberQuery(url.searchParams.get("actorTargetSellableRows")) ?? null,
      averageBuyerValueScore: numberQuery(url.searchParams.get("actorAverageBuyerValueScore")) ?? null,
      defaultWatchlistRun: booleanQuery(url.searchParams.get("actorDefaultWatchlistRun"))
    },
    cost: {
      grossPpeRevenueUsd: numberQuery(url.searchParams.get("grossPpeRevenueUsd")) ?? null,
      apifyCommissionUsd: numberQuery(url.searchParams.get("apifyCommissionUsd")) ?? null,
      computeCostUsd: numberQuery(url.searchParams.get("computeCostUsd")) ?? null,
      backendCostAllocationUsd: numberQuery(url.searchParams.get("backendCostAllocationUsd")) ?? null,
      refundsFailuresUsd: numberQuery(url.searchParams.get("refundsFailuresUsd")) ?? null,
      actorStartCostUsd: numberQuery(url.searchParams.get("actorStartCostUsd")) ?? null,
      resultPriceUsdPerThousand: numberQuery(url.searchParams.get("resultPriceUsdPerThousand")) ?? null,
      actorStartPriceUsd: numberQuery(url.searchParams.get("actorStartPriceUsd")) ?? null,
      apifyMarginRate: numberQuery(url.searchParams.get("apifyMarginRate")) ?? null
    },
    marketplace: {
      actorViewCount: numberQuery(url.searchParams.get("apifyActorViewCount")) ?? null,
      actorRunCount: numberQuery(url.searchParams.get("apifyActorRunCount")) ?? null,
      uniqueUserCount: numberQuery(url.searchParams.get("apifyUniqueUserCount")) ?? null,
      trialRunCount: numberQuery(url.searchParams.get("apifyTrialRunCount")) ?? null,
      paidRunCount: numberQuery(url.searchParams.get("apifyPaidRunCount")) ?? null,
      repeatUserCount: numberQuery(url.searchParams.get("apifyRepeatUserCount")) ?? null,
      beneficiaryVerified: booleanQuery(url.searchParams.get("apifyBeneficiaryVerified")),
      payoutMethodReady: booleanQuery(url.searchParams.get("apifyPayoutMethodReady")),
      pricingEffectiveAt: url.searchParams.get("apifyPricingEffectiveAt") ?? null
    },
    sourceMonetization: {
      evaluatedSourceCandidateCount: numberQuery(url.searchParams.get("sourceEvaluatedCandidateCount")) ?? null,
      payworthySourceCount: numberQuery(url.searchParams.get("sourcePayworthyCount")) ?? null,
      payworthyThresholdRate: numberQuery(url.searchParams.get("sourcePayworthyThresholdRate")) ?? null,
      sourceValueScoreThreshold: numberQuery(url.searchParams.get("sourceValueScoreThreshold")) ?? null,
      freshnessThreshold: numberQuery(url.searchParams.get("sourceFreshnessThreshold")) ?? null,
      evidenceYieldThreshold: numberQuery(url.searchParams.get("sourceEvidenceYieldThreshold")) ?? null,
      downstreamImpactThreshold: numberQuery(url.searchParams.get("sourceDownstreamImpactThreshold")) ?? null,
      costPerUsefulRowImpactUsd: numberQuery(url.searchParams.get("sourceCostPerUsefulRowImpactUsd")) ?? null,
      currentProofRunId: url.searchParams.get("sourceCurrentProofRunId") ?? null,
      currentProofDatasetId: url.searchParams.get("sourceCurrentProofDatasetId") ?? null,
      baselineProofRunId: url.searchParams.get("sourceBaselineProofRunId") ?? null,
      baselineProofDatasetId: url.searchParams.get("sourceBaselineProofDatasetId") ?? null
    },
    snapshotStoragePath: url.searchParams.get("snapshotStoragePath") ?? undefined
  }) as unknown as Record<string, unknown>;
}

function liveProductProofMode(value: string | null): LiveProductProofMode {
  if (value === "fixture" || value === "local" || value === "inspur" || value === "public_live") return value;
  return "local";
}

function booleanQuery(value: string | null): boolean | null {
  if (value === null) return null;
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;
  return null;
}

function actorRunStatus(value: string | null): "succeeded" | "failed" | "timed_out" | "aborted" | "unknown" | undefined {
  if (value === "succeeded" || value === "failed" || value === "timed_out" || value === "aborted" || value === "unknown") return value;
  return undefined;
}

function buildEnterpriseApiContractIndex() {
  const activeRoutes = [
    { method: "GET", path: "/v1/health", surface: "health", owner: "Agent 09", responseKeys: ["ok", "service", "version"] },
    { method: "GET", path: "/v1/metrics", surface: "metrics", owner: "Agent 09", responseKeys: ["runs", "sources", "frontier"] },
    { method: "GET", path: "/v1/ops/resource-snapshot", surface: "ops", owner: "Agent 10/09", responseKeys: ["resources", "capacity", "workerPools", "queue"] },
    { method: "GET", path: "/v1/ops/product-slo", surface: "ops", owner: "Agent 10/09", responseKeys: ["schemaVersion", "dashboard", "metrics", "paidProductEconomics", "sourceMonetizationGate", "buyerVisibleQualityLiftGate", "marketplaceGraphSignals", "qualityConversionGate", "liveFreshnessQualityGate", "slos", "apifyLaunchExperiment", "dailySnapshot", "deploymentProof", "resourceGuardrails"] },
    { method: "GET", path: "/v1/ops/canary", surface: "ops", owner: "Agent 01/02/06/09", responseKeys: ["operatorView"] },
    { method: "GET", path: "/v1/ops/canary/readiness", surface: "ops", owner: "Agent 07/10", responseKeys: ["readiness", "operatorView"] },
    { method: "GET", path: "/v1/ops/canary/soak", surface: "ops", owner: "Agent 07/10", responseKeys: ["soak", "operatorView"] },
    { method: "GET", path: "/v1/ops/canary/console", surface: "ops", owner: "Agent 07/09", responseKeys: ["text/html", "active sources", "queued work", "latest captures", "why public answer is partial"] },
    { method: "GET", path: "/v1/auth/integration-notes", surface: "auth", owner: "Agent 09", responseKeys: ["version", "authBoundary", "notes"] },
    { method: "GET", path: "/v1/contracts", surface: "contracts", owner: "Agent 09", responseKeys: ["endpoint", "routeInventory", "routeTruthAudit", "apiRegressionSentinel", "apiGatewayIntegration", "publicWrapperCutoverReadiness", "realtimeDeliveryPrototype", "realtimeDeliverySoak", "clientGenerationFreeze", "frontendProgressiveUpdateContract", "scraperNativeReplacementReadiness", "apifyStoreReadiness", "darkwebIndexFrontendContract", "sourceAtlasFrontendContract", "publicWrapperResponsiveAudit", "publicWrapperDeltaAudit", "enterpriseApiSurface", "sdkIntegration", "openapi", "surfaces", "publicCompatibility", "semantics"] },
    { method: "GET", path: "/v1/analyst/claim-ledger", surface: "analyst", owner: "Agent 06/09", responseKeys: ["contract", "runStatusClarity", "entries", "allowedActions"] },
    { method: "POST", path: "/v1/analyst/claim-ledger/{id}/actions", surface: "analyst", owner: "Agent 06/09", responseKeys: ["contract", "dryRun", "action", "entry", "result"] },
    { method: "GET", path: "/v1/analyst/metadata-review-tasks", surface: "analyst", owner: "Agent 01/09", responseKeys: ["contract", "runStatusClarity", "tasks", "notificationPackets", "claimLedger"] },
    { method: "GET", path: "/v1/analyst/loop", surface: "analyst", owner: "Agent 01/09", responseKeys: ["contract", "state", "runStatusClarity", "workQueue", "activityTimeline", "readinessChecklist", "reviewTasks", "sourceActivationPackets", "notificationPackets", "claimLedger"] },
    { method: "GET", path: "/v1/analyst/persistence-readiness", surface: "analyst", owner: "Agent 01/09", responseKeys: ["endpoint", "migration", "workflowTables", "readiness", "noLeakGuardrails"] },
    { method: "GET", path: "/v1/analyst/source-activation-packets", surface: "analyst", owner: "Agent 01/09", responseKeys: ["contract", "runStatusClarity", "packets"] },
    { method: "GET", path: "/v1/analyst/source-activation-packets/{id}/execution-preview", surface: "analyst", owner: "Agent 01/09", responseKeys: ["contract", "readiness", "packet", "executionPreview", "forbiddenOperations"] },
    { method: "POST", path: "/v1/analyst/source-activation-packets/{id}/actions", surface: "analyst", owner: "Agent 01/09", responseKeys: ["contract", "dryRun", "action", "packet", "result"] },
    { method: "GET", path: "/v1/analyst/victim-notification-packets", surface: "analyst", owner: "Agent 01/09", responseKeys: ["contract", "runStatusClarity", "packets"] },
    { method: "GET", path: "/v1/analyst/victim-notification-packets/{id}/export", surface: "analyst", owner: "Agent 01/09", responseKeys: ["contract", "readiness", "packet", "delivery"] },
    { method: "POST", path: "/v1/analyst/victim-notification-packets/{id}/actions", surface: "analyst", owner: "Agent 01/09", responseKeys: ["contract", "dryRun", "action", "packet", "result"] },
    { method: "POST", path: "/v1/analyst/metadata-review-tasks/{id}/actions", surface: "analyst", owner: "Agent 01/09", responseKeys: ["contract", "dryRun", "action", "task", "notificationPacket", "result"] },
    { method: "GET", path: "/v1/sources", surface: "sources", owner: "Agent 01/09", responseKeys: ["sources", "nextCursor"] },
    { method: "POST", path: "/v1/sources", surface: "sources", owner: "Agent 01/09", responseKeys: ["source"] },
    { method: "POST", path: "/v1/sources/apply-plan", surface: "sources", owner: "Agent 01/09", responseKeys: ["contract", "applyPlan"] },
    { method: "POST", path: "/v1/sources/canary-activation", surface: "sources", owner: "Agent 01/09", responseKeys: ["activation", "guarantees"] },
    { method: "POST", path: "/v1/sources/canary-pause", surface: "sources", owner: "Agent 01/09", responseKeys: ["pause", "guarantees"] },
    { method: "POST", path: "/v1/sources/coverage-plan", surface: "sources", owner: "Agent 01/09", responseKeys: ["endpoint", "queries"] },
    { method: "POST", path: "/v1/sources/portfolio", surface: "sources", owner: "Agent 01/09", responseKeys: ["endpoint", "portfolio", "reliabilityEconomics", "migrationReadiness", "sloBurnRate", "tenantActivation", "sourceImportCanary"] },
    { method: "POST", path: "/v1/sources/marketplace", surface: "sources", owner: "Agent 01/09", responseKeys: ["endpoint", "marketplace", "parserCapabilityMatrix", "activationReadiness"] },
    { method: "POST", path: "/v1/sources/atlas", surface: "sources", owner: "Agent 01/09", responseKeys: ["endpoint", "summary", "records", "importPlans", "coverageMatrix", "activationCanary"] },
    { method: "POST", path: "/v1/sources/atlas/export", surface: "sources", owner: "Agent 01/09", responseKeys: ["endpoint", "summary", "reviewQueue", "exportManifest", "approvalPacket", "rollbackPacket"] },
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
    { method: "GET", path: "/v1/intel/search", surface: "search", owner: "Agent 09", responseKeys: ["query", "mode", "status", "runId", "cursor", "nextCursor", "pollCursor", "deltaCursor", "updated", "analystLoop", "tiExperience", "publicTiAnswer", "publicWrapperDelta", "analystFeedbackLearningLoop", "activeLearningCandidateQueue", "qualityRuntimeValueGates", "highPriorityActorFreshnessDashboard", "ctiEvaluationDatasetPack"] },
    { method: "GET", path: "/v1/quality/evaluate", surface: "quality", owner: "Agent 07/09", responseKeys: ["query", "quality", "dashboard", "entityResolutionWorkbench", "timelinessGroundTruth", "highPriorityActorFreshnessDashboard", "attackMappingQuality", "analystFeedbackLoop", "actorProfileReviewWorkbench", "evaluationDatasetGovernance", "ctiEvaluationDatasetPack", "analystQualityReviewQueue", "analystFeedbackLearningLoop", "activeLearningCandidateQueue", "qualityRuntimeValueGates", "examples"] },
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
    { method: "POST", path: "/v1/sources/{id}/restricted-metadata/apply-plan", surface: "restricted_metadata", owner: "Agent 05/09", responseKeys: ["contract", "applyPlan"] },
    { method: "GET", path: "/v1/darkweb/status", surface: "darkweb_index", owner: "Agent 05/09", responseKeys: ["status", "contract"] },
    { method: "GET", path: "/v1/darkweb/search", surface: "darkweb_index", owner: "Agent 05/09", responseKeys: ["darkwebIndex", "contract"] }
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
    "warningCodes",
    "cursor",
    "nextCursor",
    "pollCursor",
    "deltaCursor",
    "updated",
    "lastSeen",
    "answer",
    "analystLoop",
    "tiExperience",
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
  const enterpriseApiSurface = enterpriseApiSurfaceContract(activeRoutes, commonErrorEnvelope);
  const sdkIntegration = sdkIntegrationContract(enterpriseApiSurface);
  const clientCompatibilityMatrix = clientCompatibilityMatrixContract(enterpriseApiSurface, sdkIntegration);
  const streamingWebhookCompatibility = buildStreamingWebhookCompatibilityContract(enterpriseApiSurface, sdkIntegration);
  const apiRegressionSentinelRouteSignatures = activeRoutes.map((route) => `${route.method} ${route.path}`);
  const apiRegressionSentinel = {
    schemaVersion: "ti.api_regression_sentinel.v1",
    owner: "Agent 09",
    status: "active_backward_compatibility_gate",
    mode: "contract_and_route_shape_only",
    routeInventoryInvariant: {
      expectedRouteCount: activeRoutes.length,
      requiredStableRoutes: [
        "GET /v1/contracts",
        "GET /v1/intel/search",
        "POST /v1/intel/runs",
        "GET /v1/intel/runs/{id}",
        "GET /v1/intel/runs/{id}/results",
        "GET /v1/sources",
        "POST /v1/sources",
        "GET /v1/captures",
        "GET /v1/incidents",
        "GET /v1/metrics",
        "POST /api/ti/search"
      ],
      routeSignatures: apiRegressionSentinelRouteSignatures,
      rule: "stable routes may gain optional fields, but removing or renaming these routes requires a new major version or compatibility-wrapper entry"
    },
    responseShapeInvariant: {
      requiredTopLevelKeys: ["endpoint", "routeInventory", "routeTruthAudit", "apiRegressionSentinel", "apiGatewayIntegration", "publicWrapperCutoverReadiness", "realtimeDeliveryPrototype", "realtimeDeliverySoak", "clientGenerationFreeze", "frontendProgressiveUpdateContract", "scraperNativeReplacementReadiness", "apifyStoreReadiness", "darkwebIndexFrontendContract", "sourceAtlasFrontendContract", "publicWrapperResponsiveAudit", "publicWrapperDeltaAudit", "enterpriseApiSurface", "sdkIntegration", "clientCompatibilityMatrix", "streamingWebhookCompatibility", "openapi", "surfaces", "publicCompatibility", "semantics", "validation"],
      publicSearchRequiredKeys: ["status", "runId", "refreshAfterSeconds", "cursor", "nextCursor", "pollCursor", "deltaCursor", "updated", "warningCodes", "publicTiAnswer", "publicWrapperDelta"],
      publicSearchStableFields: compatibilityFields,
      publicWrapperDeltaStableFields: publicWrapperDeltaStableFields(),
      rule: "required keys must remain present for ready, partial, searching, metadata_review, queue_pressure, blocked, and empty-delta responses"
    },
    openapiInvariant: {
      version: enterpriseApiSurface.openapi.openapi,
      requiredSchemas: ["ErrorEnvelope", "CursorPage", "IdempotentRunRequest", "PublicSearchResponse", "SdkPollingEnvelope", "SdkSubscriptionRegistration", "StreamingEventEnvelope", "WebhookDeliveryAttempt", "PublicWrapperCutoverReadiness", "RealtimeDeliveryPrototype", "RealtimePrototypeEvent", "ClientGenerationFreeze", "GeneratedClientTarget", "ApifyStoreReadiness", "PublicProofDto"],
      requiredPaths: ["/v1/intel/search", "/v1/intel/runs/{id}/results", "/v1/sources", "/v1/contracts"],
      rule: "OpenAPI paths and component schemas are the generated-client backbone and must stay additive within /v1"
    },
    behaviorInvariants: {
      auth: {
        requiredForwardedHeaders: enterpriseApiSurface.authBoundary.requiredForwardedHeaders,
        serviceTokenContext: enterpriseApiSurface.authBoundary.serviceTokenContext.header,
        rule: "trusted gateway identity is propagated by headers; scraper examples never include token material"
      },
      idempotency: enterpriseApiSurface.idempotency,
      pagination: enterpriseApiSurface.pagination,
      errors: {
        envelope: enterpriseApiSurface.errors.envelope,
        requiredCodes: ["bad_request", "not_found", "idempotency_conflict", "queue_pressure", "policy_blocked", "duplicate_run_reuse"],
        retryableCodes: enterpriseApiSurface.errors.retryableCodes,
        failClosedCodes: enterpriseApiSurface.errors.failClosedCodes
      },
      rateLimits: {
        responseHeaders: enterpriseApiSurface.rateLimits.responseHeaders,
        overloadCodes: enterpriseApiSurface.rateLimits.overloadCodes
      }
    },
    sdkInvariant: {
      fixturePackSchemaVersion: sdkIntegration.fixturePack.schemaVersion,
      requiredFixtureFiles: sdkIntegration.fixturePack.requiredFiles,
      invariantFields: sdkIntegration.fixturePack.invariantFields,
      compatibilityCommands: sdkIntegration.compatibilityCi.requiredCommands,
      clientCompatibilityStatus: clientCompatibilityMatrix.status
    },
    streamingWebhookInvariant: {
      schemaVersion: streamingWebhookCompatibility.schemaVersion,
      status: streamingWebhookCompatibility.status,
      deliveryModes: streamingWebhookCompatibility.deliveryModes.map((mode: { mode: string }) => mode.mode),
      eventTypes: streamingWebhookCompatibility.eventTypes.map((event: { type: string }) => event.type),
      pollingCompatibilityFields: streamingWebhookCompatibility.pollingCompatibility.sameFields,
      requiredHeaders: streamingWebhookCompatibility.authAndGateway.requiredForwardedHeaders,
      forbiddenPayloadFields: streamingWebhookCompatibility.noLeak.forbiddenPayloadFields,
      failureBehavior: streamingWebhookCompatibility.webhooks.failureBehavior
    },
    forbiddenChangeClasses: [
      "remove_stable_route",
      "rename_required_response_key",
      "drop_cursor_or_delta_cursor",
      "change_error_envelope_shape",
      "remove_idempotency_conflict",
      "remove_tenant_or_requester_header_contract",
      "remove_retry_after_headers",
      "remove_sdk_fixture",
      "make_streaming_required_for_polling_clients",
      "remove_streaming_replay_cursor",
      "remove_webhook_failure_state",
      "reintroduce_default_actor_fallback",
      "serve_demo_or_stale_cache_copy",
      "mark_unknown_query_ready_without_evidence",
      "add_raw_payload_example"
    ],
    noLeakAssertions: ["no auth-header examples", "no cookie-header examples", "no bearer-token examples", "no raw payload values", "no restricted URL values", "no object storage key values", "no credential values", "no leaked row values"],
    proofCommands: ["bun run check:api-regression", "bun run check:contract-index", "bun run check:route-inventory", "bun run check:sdk-fixtures", "bun test src/tests/apiRegressionSentinel.test.ts src/tests/api.test.ts", "bun test", "bun run check"],
    releaseRule: "block SDK/client/public-wrapper promotion if the sentinel fails; update this contract explicitly before any intentional breaking change"
  };
  const apiGatewayIntegration = {
    schemaVersion: "ti.api_gateway_integration.v1",
    owner: "Agent 09",
    status: "deployment_plan_ready",
    mode: "contract_only_gateway_cutover",
    trustedBoundary: {
      gatewayOwnsAuthnAuthz: true,
      scraperStoresSecrets: false,
      requiredForwardedHeaders: enterpriseApiSurface.authBoundary.requiredForwardedHeaders,
      optionalForwardedHeaders: enterpriseApiSurface.authBoundary.optionalForwardedHeaders,
      serviceTokenContextHeader: enterpriseApiSurface.authBoundary.serviceTokenContext.header,
      requiredScopesByRoute: [
        { route: "GET /v1/intel/search", scopes: ["intel:read"], failClosedCode: "policy_blocked" },
        { route: "POST /v1/intel/runs", scopes: ["intel:run"], failClosedCode: "policy_blocked" },
        { route: "GET /v1/intel/runs/{id}/results", scopes: ["intel:read", "evidence:read"], failClosedCode: "not_found" },
        { route: "POST /v1/sources/*", scopes: ["sources:write", "scraper:admin"], failClosedCode: "policy_blocked" },
        { route: "POST /v1/exports/stix", scopes: ["exports:write", "graph:read"], failClosedCode: "policy_blocked" }
      ],
      noSecretForwardingRule: "gateway forwards principal ids, role labels, service context, request ids, and trace ids only; token material, cookies, and API keys stay outside scraper logs and DTOs"
    },
    routeMapping: {
      canonicalPublicWrapper: { external: "POST /api/ti/search", internal: "GET /v1/intel/search", methodBoundary: "gateway converts JSON q/query to canonical search query params and preserves stable response fields" },
      canonicalVersionedPrefix: "/v1",
      publicRoutes: ["POST /api/ti/search", "GET /v1/health", "GET /v1/contracts"],
      analystRoutes: ["GET /v1/analyst/loop", "GET /v1/analyst/metadata-review-tasks", "GET /v1/evidence/claim-ledger"],
      adminRoutes: ["POST /v1/sources/*", "POST /v1/frontier/apply-plan", "POST /v1/public-channels/apply-plan", "POST /v1/restricted-metadata/apply-plan"],
      rollbackAlias: { route: "POST /api/ti/search", fallbackBehavior: "preserve compatibility wrapper and serve last safe bounded answer if scraper-native gate fails" }
    },
    tenantPropagation: {
      requiredHeader: enterpriseApiSurface.identity.tenantHeader,
      requesterHeader: enterpriseApiSurface.identity.requesterHeader,
      requestIdHeader: enterpriseApiSurface.identity.requestIdHeader,
      traceHeader: enterpriseApiSurface.identity.traceHeader,
      orderingRule: enterpriseApiSurface.tenantBoundary.projectionRule,
      crossTenantFailureCode: enterpriseApiSurface.tenantBoundary.crossTenantFailureCode,
      auditFields: enterpriseApiSurface.authBoundary.auditLogging.requiredFields
    },
    rateLimitPlan: {
      gatewayEnforced: true,
      responseHeaders: enterpriseApiSurface.rateLimits.responseHeaders,
      defaultPolicy: enterpriseApiSurface.rateLimits.defaultPolicy,
      perRouteHints: enterpriseApiSurface.rateLimits.perRouteHints,
      queuePressureBehavior: "return stable error envelope or partial response with retry-after; clients keep last safe answer and poll from cursor"
    },
    cutoverStages: [
      { name: "shadow_headers", decision: "observe", requiredProof: "gateway forwards x-tenant-id/x-actor-id/x-request-id without storing token material", rollback: "strip gateway route to internal-only traffic" },
      { name: "public_wrapper_shadow", decision: "observe", requiredProof: "POST /api/ti/search mirrors GET /v1/intel/search stable fields for known/random/made-up queries", rollback: "serve outer compatibility fallback" },
      { name: "canary_public_wrapper", decision: "canary", requiredProof: "public proof matrix and apiRegressionSentinel are green", rollback: "pin /api/ti/search to previous compatibility wrapper" },
      { name: "versioned_api_clients", decision: "promote", requiredProof: "contract index, route inventory, SDK fixtures, gateway check, and full tests pass", rollback: "keep /v1 contracts but disable new gateway route mapping" }
    ],
    rollbackPlan: {
      triggers: ["missing_forwarded_identity", "tenant_boundary_failure", "public_wrapper_post_failure", "rate_limit_header_missing", "error_envelope_drift", "raw_material_leak", "sdk_fixture_drift"],
      safeActions: ["preserve last safe public answer", "disable public wrapper cutover", "restore compatibility wrapper", "hold SDK release", "keep source/admin routes gateway-only"],
      nonActions: ["do not bypass tenant checks", "do not expose token material", "do not serve raw evidence", "do not auto-activate sources"]
    },
    proofCommands: [
      "bun run check:api-gateway",
      "bun run check:api-regression",
      "bun run check:contract-index",
      "bun run check:route-inventory",
      "bun run check:sdk-fixtures",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ],
    noLeakGuarantee: "gateway integration examples carry route names, principal ids, request ids, scopes, retry hints, and rollback states only; never token material, cookies, raw evidence, object keys, restricted URLs, credentials, or leaked rows"
  };
  const publicWrapperCutoverReadiness = publicWrapperCutoverReadinessContract({
    compatibilityFields,
    enterpriseApiSurface,
    sdkIntegration,
    clientCompatibilityMatrix,
    streamingWebhookCompatibility,
    apiGatewayIntegration
  });
  const realtimeDeliveryPrototype = realtimeDeliveryPrototypeContract({
    enterpriseApiSurface,
    sdkIntegration,
    streamingWebhookCompatibility,
    publicWrapperCutoverReadiness
  });
  const realtimeDeliverySoak = buildRealtimeDeliverySoakContractLegacy({
    enterpriseApiSurface,
    sdkIntegration,
    streamingWebhookCompatibility,
    realtimeDeliveryPrototype,
    publicWrapperCutoverReadiness
  });
  const clientGenerationFreeze = clientGenerationFreezeContract({
    enterpriseApiSurface,
    sdkIntegration,
    clientCompatibilityMatrix,
    streamingWebhookCompatibility,
    realtimeDeliveryPrototype,
    publicWrapperCutoverReadiness
  });
  (apiRegressionSentinel as {
    publicWrapperCutoverInvariant?: unknown;
    realtimeDeliveryPrototypeInvariant?: unknown;
    clientGenerationFreezeInvariant?: unknown;
  }).publicWrapperCutoverInvariant = {
    schemaVersion: publicWrapperCutoverReadiness.schemaVersion,
    status: publicWrapperCutoverReadiness.status,
    requiredStableFields: publicWrapperCutoverReadiness.stableFieldAgreement.requiredFields,
    bannedFallbackCodes: publicWrapperCutoverReadiness.fallbackWatch.bannedFallbackCodes,
    deprecationAlias: publicWrapperCutoverReadiness.deprecationWatch.aliasRoute,
    rollbackTriggers: publicWrapperCutoverReadiness.deprecationWatch.rollbackTriggers,
    proofCommands: publicWrapperCutoverReadiness.proofCommands
  };
  (apiRegressionSentinel as {
    realtimeDeliveryPrototypeInvariant?: unknown;
    realtimeDeliverySoakInvariant?: unknown;
  }).realtimeDeliveryPrototypeInvariant = {
    schemaVersion: realtimeDeliveryPrototype.schemaVersion,
    status: realtimeDeliveryPrototype.status,
    enabledByDefault: realtimeDeliveryPrototype.featureFlags.enabledByDefault,
    pollingPrimary: realtimeDeliveryPrototype.fallbackToPolling.pollingPrimary,
    deliveryModes: realtimeDeliveryPrototype.deliveryModes.map((mode) => mode.mode),
    eventTypes: realtimeDeliveryPrototype.eventPrototypes.map((event) => event.type),
    requiredFields: realtimeDeliveryPrototype.eventEnvelope.requiredFields,
    forbiddenPayloadFields: realtimeDeliveryPrototype.noLeak.forbiddenPayloadFields,
    proofCommands: realtimeDeliveryPrototype.proofCommands
  };
  (apiRegressionSentinel as {
    realtimeDeliverySoakInvariant?: unknown;
  }).realtimeDeliverySoakInvariant = {
    schemaVersion: realtimeDeliverySoak.schemaVersion,
    status: realtimeDeliverySoak.status,
    pollingPrimary: realtimeDeliverySoak.pollingFallback.pollingPrimary,
    scenarios: realtimeDeliverySoak.soakScenarios.map((scenario) => scenario.name),
    outboxStates: realtimeDeliverySoak.webhookOutbox.states,
    cursorGapActions: realtimeDeliverySoak.cursorGapReplay.actions,
    forbiddenPayloadFields: realtimeDeliverySoak.noLeak.forbiddenPayloadFields,
    proofCommands: realtimeDeliverySoak.proofCommands
  };
  (apiRegressionSentinel as {
    clientGenerationFreezeInvariant?: unknown;
  }).clientGenerationFreezeInvariant = {
    schemaVersion: clientGenerationFreeze.schemaVersion,
    status: clientGenerationFreeze.status,
    openapiVersion: clientGenerationFreeze.openapiManifest.openapi,
    generatedTargets: clientGenerationFreeze.generatedClients.map((client) => client.target),
    requiredOperationIds: clientGenerationFreeze.operationManifest.requiredOperationIds,
    requiredSchemas: clientGenerationFreeze.schemaManifest.requiredSchemas,
    requiredFixtures: clientGenerationFreeze.fixtureManifest.requiredFixtures,
    changelogGateStatus: clientGenerationFreeze.changelogGate.status,
    breakingChangeBlockers: clientGenerationFreeze.changelogGate.breakingChangeBlockers,
    minimumNoticeDays: clientGenerationFreeze.changelogGate.deprecationPolicy.minimumNoticeDays,
    failClosedChecks: clientGenerationFreeze.driftPolicy.failClosedChecks,
    proofCommands: clientGenerationFreeze.proofCommands
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
      error: { retryable: false, terminal: true, publicPromotion: "blocked", requiredFields: ["error.code", "error.message"] }
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
  const qualityRuntimeValueGatesContract = buildQualityRuntimeValueGatesDto({
    query: "APT29",
    generatedAt: "2026-05-24T00:00:00.000Z"
  });
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
      stableFields: ["query", "mode", "status", "runId", "cursor", "nextCursor", "refreshAfterSeconds", "analystLoop", "tiExperience", "publicTiAnswer"]
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
  const frontendProgressiveUpdateContract = buildFrontendProgressiveUpdateContract({
    stateMachine,
    publicWrapperResponsiveAudit,
    publicWrapperDeltaAudit,
    publicWrapperCutoverReadiness,
    sdkIntegration
  });
  (apiRegressionSentinel as {
    frontendProgressiveUpdateInvariant?: unknown;
  }).frontendProgressiveUpdateInvariant = {
    schemaVersion: frontendProgressiveUpdateContract.schemaVersion,
    status: frontendProgressiveUpdateContract.status,
    routes: frontendProgressiveUpdateContract.routes,
    requiredFields: frontendProgressiveUpdateContract.requiredFields,
    proofScenarios: frontendProgressiveUpdateContract.uiProofMatrix.map((fixture) => fixture.scenario),
    mergeRules: frontendProgressiveUpdateContract.mergeSemantics.rules,
    proofCommands: frontendProgressiveUpdateContract.proofCommands
  };
  const scraperNativeReplacementReadiness = buildScraperNativeReplacementReadinessContract({
    publicWrapperCutoverReadiness,
    frontendProgressiveUpdateContract,
    clientGenerationFreeze,
    sdkIntegration
  });
  (apiRegressionSentinel as {
    scraperNativeReplacementInvariant?: unknown;
  }).scraperNativeReplacementInvariant = {
    schemaVersion: scraperNativeReplacementReadiness.schemaVersion,
    status: scraperNativeReplacementReadiness.status,
    decision: scraperNativeReplacementReadiness.decision,
    routes: scraperNativeReplacementReadiness.routes,
    requiredCases: scraperNativeReplacementReadiness.proofMatrix.map((row) => row.case),
    blockers: scraperNativeReplacementReadiness.blockers,
    proofCommands: scraperNativeReplacementReadiness.proofCommands
  };
  const apifyStoreReadiness = buildApifyStoreReadinessContract({
    frontendProgressiveUpdateContract,
    scraperNativeReplacementReadiness
  });
  (apiRegressionSentinel as {
    apifyStoreReadinessInvariant?: unknown;
  }).apifyStoreReadinessInvariant = {
    schemaVersion: apifyStoreReadiness.schemaVersion,
    status: apifyStoreReadiness.status,
    actorName: apifyStoreReadiness.actor.name,
    publishedBuildVersion: apifyStoreReadiness.actor.publishedBuildVersion,
    latestProofRunId: apifyStoreReadiness.storeReadiness.latestProofRun.runId,
    latestProofDatasetId: apifyStoreReadiness.storeReadiness.latestProofRun.datasetId,
    pricingEffectiveDate: apifyStoreReadiness.pricingHooks.effectiveDate,
    defaultQueries: apifyStoreReadiness.defaultSampleInput.queries,
    sampleQueries: apifyStoreReadiness.publicProofDtos.map((proof) => proof.query),
    compatibilityStates: apifyStoreReadiness.frontendApiCompatibility.states.map((state) => state.state),
    blockers: apifyStoreReadiness.storeReadiness.knownBlockers,
    guardrails: apifyStoreReadiness.marketplaceGuardrails,
    proofCommands: apifyStoreReadiness.proofCommands
  };
  const darkwebIndexFrontendContract = buildDarkwebIndexFrontendContractDto();
  (apiRegressionSentinel as {
    darkwebIndexFrontendInvariant?: unknown;
  }).darkwebIndexFrontendInvariant = {
    schemaVersion: darkwebIndexFrontendContract.schemaVersion,
    status: darkwebIndexFrontendContract.status,
    route: darkwebIndexFrontendContract.route,
    apiRoutes: darkwebIndexFrontendContract.apiRoutes,
    tableColumns: darkwebIndexFrontendContract.table.columns,
    filters: darkwebIndexFrontendContract.table.filters,
    detailDrawerSections: darkwebIndexFrontendContract.safeDetailDrawer.sections,
    forbiddenUiPayloadFields: darkwebIndexFrontendContract.noLeak.forbiddenUiPayloadFields,
    proofCommands: darkwebIndexFrontendContract.proofCommands
  };
  const sourceAtlasFrontendContract = buildSourceAtlasFrontendContractDto();
  (apiRegressionSentinel as {
    sourceAtlasFrontendInvariant?: unknown;
  }).sourceAtlasFrontendInvariant = {
    schemaVersion: sourceAtlasFrontendContract.schemaVersion,
    status: sourceAtlasFrontendContract.status,
    route: sourceAtlasFrontendContract.route,
    apiRoutes: sourceAtlasFrontendContract.apiRoutes,
    tableColumns: sourceAtlasFrontendContract.table.columns,
    filters: sourceAtlasFrontendContract.table.filters,
    detailDrawerSections: sourceAtlasFrontendContract.safeDetailDrawer.sections,
    importPlanLabels: sourceAtlasFrontendContract.importPlans.labels,
    forbiddenOperations: sourceAtlasFrontendContract.noLeak.forbiddenOperations,
    proofCommands: sourceAtlasFrontendContract.proofCommands
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
  const publicCanaryControlPlane = {
    schemaVersion: "ti.public_canary_control_plane.v1",
    routes: [
      "/v1/sources/canary-activation",
      "/v1/ops/canary/run",
      "/v1/ops/canary",
      "/v1/ops/canary/readiness",
      "/v1/ops/canary/soak",
      "/v1/ops/canary/console",
      "/v1/sources/canary-pause"
    ],
    portfolio: {
      minimumSourceCount: 8,
      bundledSourceCount: 10,
      allowedSourceClasses: ["vendor_blog", "rss_security_feed", "government_advisory", "public_news", "standards_body"],
      forbiddenSourceClasses: ["darknet", "restricted_metadata", "private_channel", "credentialed_source", "captcha_gated_source", "leaked_payload_source"]
    },
    activation: {
      executableRoute: "/v1/sources/canary-activation",
      requiresHumanApproval: true,
      approvalField: "operatorApproval=true",
      auditFields: ["approvedBy", "approvedAt", "source.lifecycle", "source.governance"],
      reversibleRoutes: ["/v1/sources/canary-pause"]
    },
    collection: {
      executableRoute: "/v1/ops/canary/run",
      continuousLoopAutoActivation: false,
      backgroundEnv: ["TI_CANARY_ENABLED", "TI_CANARY_AUTO_ACTIVATE=false", "TI_CANARY_INTERVAL_SECONDS", "TI_CANARY_MAX_TASKS", "TI_CANARY_MAX_SOURCES", "TI_CANARY_MAX_QUEUE_SIZE"],
      boundedControls: ["maxSources", "maxTasks", "maxBytes", "timeoutMs", "source crawlFrequencySeconds", "frontier retry/backoff"],
      fetchProvenance: {
        requiredCaptureMetadata: ["fetchProvenance.mode", "fetchProvenance.httpStatus", "fetchProvenance.finalUrlHash", "fetchProvenance.durationMs", "fetchProvenance.bytesReceived", "fetchProvenance.truncated"],
        liveMode: "native_live_http",
        proofMode: "injected_proof_fetch",
        rawBodiesExternalized: true
      }
    },
    runtimeLoop: {
      schemaVersion: "ti.public_canary_loop_runtime.v1",
      routeField: "/v1/ops/canary.operatorView.runtime",
      fields: ["supervisorAttached", "enabled", "running", "startedAt", "intervalSeconds", "nextCycleAt", "lastSuccessAt", "lastError", "cycleCount", "successCount", "errorCount", "consecutiveErrorCount", "maxSources", "maxTasks", "maxBytes", "timeoutMs", "queueLimit", "controls"],
      controls: ["canaryPortfolioOnly", "activationRequiresHumanApproval", "continuousLoopAutoActivation", "nativeFetchDefault", "objectBoundaryConfigured", "boundedQueueRequired", "dedupeBeforeWrite", "retriesBounded", "restrictedSourcesExcluded"]
    },
    readiness: {
      route: "/v1/ops/canary/readiness",
      schemaVersion: "ti.public_canary_readiness.v1",
      decisions: ["promote", "canary-with-warnings", "hold"],
      requiredQueries: ["APT42", "Turla"],
      requiredEvidenceChecks: ["activeSourceCount", "freshnessSeconds", "externalObjectCaptureCount", "missingObjectReferenceCount", "nativeLiveHttpCaptureCount", "injectedProofFetchCaptureCount", "promotionYield", "queryReadiness"],
      optionalProductionGates: ["requireNativeLiveHttp=true"],
      blockerFields: ["blockers", "warnings", "controls"]
    },
    soak: {
      route: "/v1/ops/canary/soak",
      schemaVersion: "ti.public_canary_soak.v1",
      decisions: ["promote", "canary-with-warnings", "hold"],
      requiredMetrics: ["cycleCount", "completedCycleCount", "failedCycleCount", "zeroTaskCycleCount", "activeSourceCount", "externalObjectCaptureCount", "nativeLiveHttpCaptureCount", "injectedProofFetchCaptureCount", "freshnessSeconds", "errorRate", "duplicateRate", "promotionYield"],
      optionalProductionGates: ["requireNativeLiveHttp=true"],
      controls: ["canaryPortfolioOnly", "activationRequiresHumanApproval", "continuousLoopAutoActivation", "boundedQueueRequired", "objectBoundaryRequired", "fetchProvenanceRequired", "nativeLiveHttpRequired", "restrictedSourcesExcluded"]
    },
    operatorView: {
      routes: ["/v1/ops/canary", "/v1/ops/canary/soak", "/v1/ops/canary/console"],
      fields: ["activeSources", "queue", "latestRun", "schedulerHealth", "runtime", "evidenceStorage.productionEvidenceMode", "evidenceStorage", "blockedOrHeldItems", "latestCaptures", "extraction", "publicAnswerReadiness"]
    },
    proofCommands: [
      "bun run check:canary-proof-path",
      "bun run check:route-inventory",
      "bun run check:deploy-hygiene",
      "bun run check:scraper-native-search"
    ],
    guarantee: "public canary control plane is executable only for approved clear-web sources, keeps activation separate from collection, persists public bodies through the evidence object boundary when configured, and excludes restricted/private/leaked/auth/CAPTCHA source classes"
  };

  return {
    endpoint: "/v1/contracts",
    version: "v1",
    schemaVersion: "ti.scraper.enterprise_api_contract.v1",
    generatedAt: nowIso(),
    routeInventory: {
      count: activeRoutes.length,
      source: "src/api/server.ts",
      activeRoutes,
      routes: activeRoutes.map((route) => ({
        ...route,
        contract: `${route.surface}.response`,
        guarantees: ["versioned_v1", "compact_json", "no_leak_dto"]
      }))
    },
    routeTruthAudit,
    apiRegressionSentinel,
    apiGatewayIntegration,
    publicWrapperCutoverReadiness,
    realtimeDeliveryPrototype,
    realtimeDeliverySoak,
    clientGenerationFreeze,
    frontendProgressiveUpdateContract,
    scraperNativeReplacementReadiness,
    apifyStoreReadiness,
    darkwebIndexFrontendContract,
    sourceAtlasFrontendContract,
    publicWrapperResponsiveAudit,
    publicWrapperDeltaAudit,
    enterpriseApiSurface,
    sdkIntegration,
    clientCompatibilityMatrix,
    streamingWebhookCompatibility,
    openapi: enterpriseApiSurface.openapi,
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
      qualityRuntimeValueGates: qualityRuntimeValueGatesContract,
      publicAnswerUxSemantics,
      publicWrapperResponsiveAudit,
      publicWrapperDeltaAudit,
      apiRegressionSentinel,
      apiGatewayIntegration,
      publicWrapperCutoverReadiness,
      realtimeDeliveryPrototype,
      realtimeDeliverySoak,
      clientGenerationFreeze,
      frontendProgressiveUpdateContract,
      scraperNativeReplacementReadiness,
      apifyStoreReadiness,
      darkwebIndexFrontendContract,
      sourceAtlasFrontendContract,
      ["publicCanaryControlPlane"]: publicCanaryControlPlane,
      enterpriseApiSurface,
      sdkIntegration,
      clientCompatibilityMatrix,
      streamingWebhookCompatibility,
      authBoundary: enterpriseApiSurface.authBoundary,
      pagination: enterpriseApiSurface.pagination,
      rateLimits: enterpriseApiSurface.rateLimits,
      auditFields: enterpriseApiSurface.auditFields,
      openapi: enterpriseApiSurface.openapi,
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
        "scheduler_cursor_waiting_for_deltas",
        "scheduler_durable_backend_readiness"
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
        packetFields: ["packetId", "scenario", "analystState", "resultState", "schedulerIsolation", "victimNotificationPacket", "victimClaimWorkflow", "claimLedger", "agent01GovernanceGate", "agent02SchedulerGate", "agent06EvidenceGate", "agent07AnswerState", "agent08GraphHold", "agent09WarningCodes", "agent10EmergencyStopGate", "proof", "whatWasNotAccessed", "noLeakSerialization"],
        guarantee: "restricted-source analyst operations stay metadata-only and victim-safe: approval workflow, proxy isolation, review, notification drafts, claim ledger, retention, redaction, and emergency stop without stolen-file downloads, credentials, auth/CAPTCHA bypass, private access, threat actor interaction, or raw unsafe URLs"
      },
      restrictedMetadataOperationalPlaybooks: {
        field: "restrictedMetadata.operationalPlaybooks",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataOperationalPlaybooksContract().fixtureScenarios,
        packetFields: ["playbookId", "scenario", "trigger", "detectionFields", "safeOperatorAction", "expectedDtoEffect", "rollback", "auditLogFields", "affectedAgents", "proofCommand", "handoffs", "forbiddenAlternatives", "noLeakSerialization"],
        guarantee: "restricted metadata operational playbooks are dry-run, metadata-only, source-hash-only, non-mutating, and review-safe for emergency stop, quarantine, legal hold, retention, approval, redaction, proxy, unsafe-source, stale, false-claim, and duplicate-claim workflows"
      },
      restrictedMetadataQualityEvaluation: {
        field: "restrictedMetadata.qualityEvaluation",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataQualityEvaluationContract().fixtureScenarios,
        packetFields: ["gateId", "scenario", "claimConfidence", "duplicateStatus", "staleStatus", "actorReliability", "sourceReliability", "reviewState", "legalHold", "retentionState", "publicAnswerGate", "graphStixPromotionEligibility", "suppressionReason", "handoffs", "proof", "noLeakSerialization"],
        guarantee: "restricted metadata quality evaluation suppresses false, impersonated, duplicate, stale, noisy, unavailable, biased, contradicted, and ambiguous claims before public answer or graph/STIX promotion"
      },
      restrictedMetadataCapacityIsolation: {
        field: "restrictedMetadata.capacityIsolation",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataCapacityIsolationContract().fixtureScenarios,
        packetFields: ["packetId", "scenario", "networkBudgets", "queueDecision", "publicSearchProtection", "schedulerBackpressure", "evidenceRetentionImpact", "publicAnswerCaveat", "graphHold", "apiField", "releaseGate", "approvalReviewLoad", "legalHoldRetentionLoad", "proof", "noLeakSerialization"],
        guarantee: "restricted metadata capacity isolation caps Tor/I2P/Freenet metadata workers separately from public search, fails closed on proxy/timeout pressure, drains emergency-stop queues, and preserves public search headroom without unsafe access or leaked-material serialization"
      },
      restrictedMetadataCapacitySlo: {
        field: "restrictedMetadata.capacitySlo",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataCapacitySloContract().fixtureScenarios,
        packetFields: ["packetId", "scenario", "tenantIsolation", "slo", "capacity", "publicSearchSemantics", "graphStixExportHold", "apiCaveat", "failureMode", "safeRemediation", "handoffs", "proof", "noLeakSerialization"],
        guarantee: "restricted metadata capacity SLOs keep Tor/I2P/Freenet workers tenant-isolated, cap legal-hold/approval/retention/quarantine/review queues, hold graph/STIX export during capacity or review breaches, and preserve non-blocking public search with hash-only API caveats"
      },
      restrictedMetadataOperatorGovernance: {
        field: "restrictedMetadata.operatorGovernance",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataOperatorGovernanceContract().fixtureScenarios,
        packetFields: ["packetId", "scenario", "tenantId", "sourceHash", "policyReason", "allowedActions", "forbiddenActions", "graphStixApiEffect", "rollbackPath", "auditId", "proofCommands", "handoffs", "proof", "noLeakSerialization"],
        guarantee: "restricted metadata operator governance packets explain held, rejected, quarantined, duplicated, disputed, expired, capacity-held, legal-held, and emergency-stopped restricted claims with source hashes, tenant scope, allowed actions, forbidden actions, rollback, audit ids, proof commands, and no raw restricted material"
      },
      restrictedMetadataDarkCanary: {
        field: "restrictedMetadata.darkMetadataCanary",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataDarkCanaryContract().fixtureScenarios,
        packetFields: ["packetId", "scenario", "network", "actor", "victimCompany", "claimedDate", "sector", "country", "claimedDataType", "safeSourceHash", "urlHash", "screenshotHash", "firstSeen", "lastSeen", "policyState", "reviewState", "publicGraphStixEffects", "proxyIsolationBoundary", "emergencyStopPropagation", "operatorProofPacket", "noLeakProof", "noLeakSerialization"],
        guarantee: "fixture-backed Tor/I2P/Freenet/ransomware/leak metadata canary packets prove safe metadata-only product reasoning, approved proxy boundaries, blocked unsafe targets, emergency-stop propagation, and operator evidence packets without credentials, forms, CAPTCHA solving, private-community access, stolen-file downloads, threat-actor interaction, raw unsafe URLs, or raw payloads"
      },
      restrictedMetadataLegalEthicsAuditExport: {
        field: "restrictedMetadata.legalEthicsAuditExport",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataLegalEthicsAuditExportContract().fixtureScenarios,
        packetFields: ["auditPacketId", "scenario", "collected", "blocked", "approval", "whatWasNotAccessed", "releaseInterpretation", "graphStixApiEffect", "proofCommands", "handoffs", "noLeakValidation", "noLeakSerialization"],
        guarantee: "legal/ethics audit packets are thesis-ready and enterprise-ready dry-run evidence of what metadata was collected, what unsafe operations were blocked, why, who approved or must review it, what was not accessed, and which proof commands validate the no-leak boundary"
      },
      restrictedMetadataReviewHealth: {
        field: "restrictedMetadata.reviewHealth",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataReviewHealthContract().fixtureScenarios,
        packetFields: ["packetId", "scenario", "queue", "sla", "publicSearchBehavior", "publicAnswerCaveat", "graphStixExportBlock", "releaseBlocker", "handoffs", "proof", "noLeakSerialization"],
        guarantee: "restricted metadata review health tracks approval, victim-claim, legal-hold, duplicate/stale, false-claim, emergency-stop, retention, and notification-draft queues while public search remains non-blocking and graph/STIX export stays held until review"
      },
      restrictedMetadataPolicyAuditExport: {
        field: "restrictedMetadata.policyAuditExport",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataPolicyAuditExportContract().fixtureScenarios,
        packetFields: ["exportId", "scenario", "policyDecisionHistory", "actorClaimId", "victimClaimId", "sourceHashId", "timestamps", "reviewState", "releaseBlockers", "retentionClass", "redactionState", "graphStixApiHolds", "jsonPacket", "compactSummary", "releaseGateInterpretation", "handoffs", "noLeakValidation", "noLeakSerialization"],
        guarantee: "restricted metadata policy audit export emits dry-run JSON packets, compact summaries, and release-gate interpretation for thesis/enterprise audit use without raw leak data, raw onion URLs, credentials, screenshots, payloads, stolen file names, private-channel material, or access-bypass automation"
      },
      restrictedMetadataEvidenceHoldReleaseDrill: {
        field: "restrictedMetadata.evidenceHoldReleaseDrill",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataEvidenceHoldReleaseDrillContract().fixtureScenarios,
        packetFields: ["drillId", "scenario", "actorClaimId", "victimClaimId", "sourceHashId", "reviewState", "releasePath", "releaseInterpretation", "releaseBlockers", "compensatingRollbackActions", "auditFields", "constraints", "graphStixApiEffect", "handoffs", "noLeakValidation", "noLeakSerialization"],
        guarantee: "restricted metadata evidence-hold release drills are dry-run rollback/release interpretations for held claims moving between public caveats, graph pivots, evidence replay, analyst approval, STIX blocks, and rollback-only states without mutation, delivery, unsafe URLs, raw leak data, credentials, screenshots, payloads, stolen file names, private-channel material, or access-bypass automation"
      },
      restrictedMetadataIsolationHarness: {
        field: "restrictedMetadata.isolationHarness",
        routes: ["/v1/restricted-metadata/status", "/v1/restricted-metadata/apply-plan", "/v1/intel/search", "/v1/contracts"],
        scenarios: restrictedMetadataIsolationHarnessContract().fixtureScenarios,
        packetFields: ["packetId", "scenario", "nonNetworked", "connectorBoundary", "workerIsolation", "deniedOperation", "complianceEvidence", "proof", "noLeakSerialization"],
        guarantee: "non-networked Tor/I2P/Freenet metadata connector isolation harness proves approved proxy boundaries, kill-switch propagation, timeout attribution, unsafe target denial, no credential storage, no private access, no threat-actor interaction, and Agent 10 compliance evidence without live restricted access"
      },
      darkwebIndex: {
        field: "darkwebIndex",
        routes: darkwebIndexContract().routes,
        targetRecordCount: darkwebIndexContract().targetRecordCount,
        fixtureRecordCount: darkwebIndexContract().fixtureRecordCount,
        recordFields: darkwebIndexContract().recordFields,
        searchFilters: darkwebIndexContract().searchFilters,
        guarantee: "dark-web metadata index records are hash-only descriptors for Tor/I2P/Freenet pages with isolated collector contracts, 60k scale target, search/status DTOs, and no raw unsafe URL, payload, credential, private access, CAPTCHA, or threat-actor interaction exposure"
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
      schedulerDurableBackendReadiness: {
        routes: ["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search", "/v1/contracts"],
        fields: ["backendContracts", "fairnessLanes", "semanticInvariants", "pollingContract", "runReuse", "drainPlan", "emergencyBrake", "releaseGate", "routeContracts"],
        backends: ["embedded_memory", "postgres_advisory_queue", "redis_streams", "nats_jetstream"],
        guarantee: "backend-neutral scheduler readiness is dry-run only; it preserves 3-second public polling, duplicate run reuse, cursor replay, per-source fairness, worker drain, emergency brake, retry/backoff, and dead-letter semantics without mutating queue state"
      },
      schedulerFreshnessSloEngine: {
        routes: ["/v1/frontier/status", "/v1/intel/search", "/v1/intel/runs/{id}", "/v1/contracts"],
        queryClasses: ["actor", "ransomware", "cve_advisory", "campaign", "malware_tool", "sector", "country", "victim_company", "infrastructure"],
        fields: ["queryClass", "slo", "cadence", "sourceCadenceHints", "queuePressureBehavior", "fairnessAging", "handoffs", "routeContracts"],
        guarantee: "continuous public collection cadence is dry-run and SLO-led: source reliability, parser health, evidence yield, analyst priority, stale-source debt, queue pressure, run reuse, dead letters, worker drain, and emergency brake state produce route-visible retry-after and cadence hints without unsafe overcollection"
      },
      schedulerFreshnessSloDashboard: {
        routes: ["/v1/frontier/status", "/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/contracts"],
        field: "scheduler.freshnessSloDashboard",
        schemaVersion: "ti.scheduler_freshness_slo_dashboard.v1",
        actors: ["APT29", "APT42", "Sandworm", "Volt Typhoon", "Lazarus", "LockBit", "Akira", "Scattered Spider"],
        fields: ["summary", "actors", "workloadActions", "runbook", "routeContracts", "releaseGate"],
        guarantee: "scheduler freshness SLO dashboard is dry-run and route-visible; daily/weekly high-priority actor freshness, queue age, retry debt, dead letters, worker partitions, priority aging actions, duplicate run reuse, 3-second polling, restricted metadata holds, and low-value sweep deferral are visible without mutating queue state"
      },
      schedulerInteractiveSearchFreshness: {
        routes: ["/v1/frontier/status", "/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/contracts"],
        field: "scheduler.interactiveSearchFreshness",
        schemaVersion: "ti.scheduler_interactive_search_freshness.v1",
        fields: ["currentQuery", "queueDecision", "actorTargets", "fairnessGuards", "uiSignals", "handoffs", "routeContracts", "releaseGate"],
        decisions: ["reuse_active_run", "enqueue_interactive_refresh", "raise_priority", "serve_partial_and_poll", "metadata_review_hold", "emergency_hold"],
        guarantee: "interactive search freshness scheduling is dry-run and UI-visible; known actor searches expose freshness state, queue decision, 3-second polling, duplicate-run reuse, retry-after, deferred background workloads, metadata-review holds, and actor targets without starving background work or mutating queues"
      },
      schedulerDailyActorRunPlan: {
        routes: ["/v1/frontier/status", "/v1/intel/search.scheduler", "/v1/intel/runs/{id}", "/v1/contracts"],
        field: "scheduler.dailyActorRunPlan",
        schemaVersion: "ti.scheduler_daily_actor_run_plan.v1",
        actor: "eirikhanasand/public-threat-actor-monitor",
        fields: ["apifyActor", "latestProofRun", "runTargets", "watchlist", "sourceTierCadence", "economics", "staleSuppression", "freshCollectionRetryPlan", "executionQueuePlan", "sourceGapClosurePlan", "routeContracts", "releaseGate"],
        guarantee: "daily Actor scheduling is dry-run and buyer-visible: the 20-query Apify default watchlist, latest build 0.6.4 proof run, paid-row decision counts, source/dark-metadata 100->1000->4000 sweep cadence, execution enqueue batches, per-actor source gap closure actions, useful-row targets, fresh-row targets, stale-only suppression, duplicate-run reuse, 3-second polling, retry-after/dead-letter visibility, and cost per useful row are exposed without mutating scheduler state"
      },
      schedulerProductionLeaseSemantics: {
        routes: ["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search", "/v1/contracts"],
        primaryTargetBackend: "postgres_advisory_queue",
        futureBackends: ["redis_streams", "nats_jetstream"],
        fields: ["postgresContract", "leaseLifecycle", "cutoverPhases", "fairness", "safety", "releaseGate", "routeContracts"],
        guarantee: "production queue cutover is dry-run and Postgres-first: enqueue, lease, heartbeat, checkpoint, ack, retry, dead-letter, drain, worker shutdown, duplicate run reuse, cursor replay, and emergency brake semantics are route-visible without leasing or mutating tasks"
      },
      schedulerFairnessGovernance: {
        routes: ["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search", "/v1/intel/runs/{id}", "/v1/contracts"],
        queryClasses: ["actor", "ransomware", "cve_advisory", "campaign", "malware_tool", "sector", "country", "victim_company", "infrastructure", "unknown"],
        fields: ["tenants", "queryClassBudgets", "workloadFairness", "priorityAging", "pressurePolicy", "fairnessSlo", "handoffs", "releaseGate", "routeContracts"],
        guarantee: "multi-tenant scheduler fairness is dry-run only; tenant/query-class budgets preserve 3-second polling, duplicate run reuse, priority aging, retry/backoff, dead-letter isolation, worker drain, emergency brake, and low-value sweep deferral without queue mutation"
      },
      schedulerPersistenceReplayCutover: {
        routes: ["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search", "/v1/intel/runs/{id}", "/v1/contracts"],
        primaryTargetBackend: "postgres_scheduler_store",
        descriptorBackends: ["redis_streams", "nats_jetstream"],
        tables: ["scheduler_runs", "frontier_tasks", "frontier_leases", "worker_heartbeats", "scheduler_checkpoints", "scheduler_cursor_events", "scheduler_retry_dead_letters", "scheduler_fairness_budget_snapshots", "scheduler_worker_drain_state"],
        fixtures: ["queued_actor_search_restart", "leased_heartbeat_expiry", "restricted_metadata_hold", "dead_letter_retry_replay", "duplicate_public_run_reuse", "worker_drain_restart", "emergency_brake_restart"],
        fields: ["postgresContracts", "replaySemantics", "restartFixtures", "cutoverPhases", "handoffs", "releaseGate", "routeContracts"],
        guarantee: "scheduler persistence/replay cutover is dry-run and Postgres-first; public /ti runs, 3-second polling, pollCursor, deltaCursor, queued work, leases, heartbeats, checkpoints, retry/dead-letter context, fairness budgets, worker drains, and emergency brake state survive restart without default actor fallback, stale cache ready state, or generic live-search promotion"
      },
      schedulerPostgresQueueAdapter: {
        routes: ["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search", "/v1/contracts"],
        field: "scheduler.postgresQueueAdapter",
        defaultBackend: "embedded_memory",
        targetBackend: "postgres_scheduler_store",
        featureFlags: ["SCRAPER_SCHEDULER_QUEUE_BACKEND", "SCRAPER_SCHEDULER_POSTGRES_QUEUE_ENABLED", "SCRAPER_SCHEDULER_POSTGRES_SHADOW_WRITES_ENABLED", "SCRAPER_SCHEDULER_POSTGRES_DSN"],
        operations: ["enqueueTasks", "leaseNext", "heartbeatLease", "checkpointTask", "acknowledge", "cancelRun", "findOrRegisterRun", "gcActiveRuns", "pressure", "deltasSince", "runs", "tasks"],
        preparedStatements: ["scheduler_runs_upsert_reuse_key_v1", "frontier_tasks_enqueue_idempotent_v1", "frontier_tasks_lease_fair_next_v1", "frontier_leases_checkpoint_ack_v1", "scheduler_worker_drain_restore_v1"],
        fields: ["backendSelection", "safety", "operationContracts", "preparedStatements", "releaseGate", "routeContracts"],
        guarantee: "Postgres scheduler queue adapter remains disabled by default and fail-closed without DSN/executor; embedded memory remains authoritative until a deliberate active cutover, while public polling, duplicate run reuse, cursor replay, leases, dead letters, and fairness snapshots stay route-visible"
      },
      schedulerWorkerLeaseSoakHarness: {
        routes: ["/v1/frontier/status", "/v1/frontier/apply-plan", "/v1/intel/search", "/v1/contracts"],
        field: "scheduler.workerLeaseSoakHarness",
        fixture: "agent02_10k_multi_worker_lease_replay",
        totalTasks: 10000,
        scenarios: ["apt29_actor_burst", "public_channel_fanout", "restricted_metadata_holds", "evidence_replay_backlog", "graph_export_wave", "source_outage_wave", "parser_failure_storm", "low_value_sweep_pressure"],
        fields: ["replay", "workloadSlices", "workerPartitions", "leaseSemantics", "fairnessProof", "pressureFixtures", "releaseGate", "routeContracts"],
        guarantee: "10k-task scheduler lease soak harness models APT29 fanout, public-channel bursts, restricted metadata holds, replay/export waves, source outages, parser failures, low-value sweeps, leases, heartbeats, retries, request deadlines, dead letters, priority aging, per-source concurrency, and workload fairness without mutating queue state"
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
      contractSurface("search", "GET", "/v1/intel/search", "Agent 09", ["query", "mode", "status", "runId", "cursor", "nextCursor", "pollCursor", "deltaCursor", "updated", "sla", "quality", "actorProfile", "answer", "analystLoop", "tiExperience", "publicTiAnswer", "publicWrapperDelta", "evaluationDatasetGovernance", "ctiEvaluationDatasetPack", "analystQualityReviewQueue", "analystFeedbackLearningLoop", "activeLearningCandidateQueue", "qualityRuntimeValueGates", "highPriorityActorFreshnessDashboard"], ["compatibility_fields", "cursor_polling", "delta_polling", "sla_enforcement", "analyst_loop_ui", "public_answer_contract", "evaluation_dataset_governance", "cti_evaluation_dataset_pack", "analyst_quality_review_queue", "analyst_feedback_learning_loop", "active_learning_candidate_queue", "quality_runtime_value_gates", "high_priority_actor_freshness_dashboard", "no_leak_dto"]),
      contractSurface("analyst_loop", "GET/POST", "/v1/analyst/*", "Agent 01/06/09", ["contract", "state", "runStatusClarity", "workQueue", "activityTimeline", "readinessChecklist", "reviewTasks", "sourceActivationPackets", "notificationPackets", "claimLedger", "persistenceReadiness"], ["metadata_review_inbox", "analyst_work_queue", "analyst_activity_timeline", "analyst_readiness_checklist", "source_activation_workflow", "victim_notification_packet", "claim_ledger_review", "postgres_persistence_readiness", "no_leak_workflow"]),
      contractSurface("run_status", "GET", "/v1/intel/runs/{id}", "Agent 09", ["run", "frontier"], ["idempotency_linkage", "scheduler_visibility"]),
      contractSurface("run_results", "GET", "/v1/intel/runs/{id}/results", "Agent 09", ["run", "results"], ["pagination", "include_filters", "safe_capture_dto"]),
      contractSurface("sources", "GET/POST/PATCH", "/v1/sources/*", "Agent 01/09", ["sources", "applyPlan", "queries", "portfolio", "reliabilityEconomics", "migrationReadiness", "sloBurnRate", "tenantActivation", "sourceImportCanary", "sourceAtlas", "sourceAtlasFrontendContract", "activationWaves", "executionReadiness", "rolloutPromotion", "releasePacket"], ["source_governance", "source_portfolio_migration_readiness", "source_slo_burn_rate", "tenant_source_activation", "source_import_canary", "source_atlas", "source_atlas_frontend_contract", "coverage_closeout", "source_activation_execution_readiness", "source_rollout_promotion_packet", "dry_run_apply_plans"]),
      contractSurface("frontier", "GET/POST", "/v1/frontier/*", "Agent 02/09", ["queue", "summary", "scheduler", "applyPlan"], ["queue_pressure", "worker_queue_cutover", "worker_soak_migration", "worker_lease_soak_harness", "scheduler_adapter_telemetry", "scheduler_canary_control_plane", "durable_backend_readiness", "freshness_slo_engine", "scheduler_freshness_slo_dashboard", "scheduler_interactive_search_freshness", "production_queue_lease_semantics", "multi_tenant_fairness_governance", "scheduler_persistence_replay_cutover", "scheduler_postgres_queue_adapter", "dry_run_scheduler_repairs"]),
      contractSurface("public_channels", "GET/POST", "/v1/public-channels/*", "Agent 04/09", ["status", "sla", "promotion", "applyPlan", "canaryRollout", "publicSignalFusion"], ["public_channel_sla", "source_pack_readiness", "canary_rollout", "public_signal_fusion", "no_raw_payload"]),
      contractSurface("restricted_metadata", "GET/POST", "/v1/restricted-metadata/*", "Agent 05/09", ["status", "applyPlan", "connectorCertification", "killSwitchDrills", "emergencyStopCertification", "nonBlockingSearch", "analystOperations", "victimClaimWorkflow", "operationalPlaybooks", "qualityEvaluation", "capacityIsolation", "capacitySlo", "operatorGovernance", "darkMetadataCanary", "legalEthicsAuditExport", "reviewHealth", "policyAuditExport", "evidenceHoldReleaseDrill", "isolationHarness"], ["metadata_only", "kill_switch", "safe_hashes", "dry_run_connector_certification", "kill_switch_drills", "emergency_stop_certification", "non_blocking_public_search", "analyst_operations_victim_safe", "victim_claim_dedupe_notification_workflow", "restricted_operational_playbooks", "restricted_quality_abuse_resistance", "restricted_capacity_isolation_budget", "restricted_capacity_slo", "restricted_operator_governance", "restricted_dark_metadata_canary", "restricted_legal_ethics_audit_export", "restricted_review_queue_health", "restricted_policy_audit_export", "restricted_evidence_hold_release_drill", "non_networked_isolation_harness", "no_leak_serialization"]),
      contractSurface("darkweb_index", "GET", "/v1/darkweb/*", "Agent 05/09", ["status", "darkwebIndex", "records", "counts", "latestRefreshRun", "storageReadiness", "uiContract", "frontendContract"], ["darkweb_metadata_index", "darkweb_index_frontend_contract", "isolated_collector_contract", "hash_only_records", "60k_scale_target", "no_leak_serialization"]),
      contractSurface("evidence", "GET", "/v1/evidence/*", "Agent 06/09", ["contract", "replayPlan", "cutoverReport", "trustLedger", "certification"], ["claim_ledger", "cursor_replay", "persistence_certification", "no_object_reference_leak"]),
      contractSurface("quality", "GET", "/v1/quality/evaluate", "Agent 07/09", ["query", "quality", "dashboard", "entityResolutionWorkbench", "timelinessGroundTruth", "highPriorityActorFreshnessDashboard", "attackMappingQuality", "analystFeedbackLoop", "actorProfileReviewWorkbench", "evaluationDatasetGovernance", "ctiEvaluationDatasetPack", "analystQualityReviewQueue", "analystFeedbackLearningLoop", "activeLearningCandidateQueue", "qualityRuntimeValueGates", "qualityRegressionSuite", "publicTiAnswer", "examples"], ["answer_readiness", "public_answer_contract", "review_required_states", "entity_resolution_workbench", "timeliness_ground_truth", "high_priority_actor_freshness_dashboard", "attack_mapping_quality", "analyst_feedback_loop", "actor_profile_review_workbench", "evaluation_dataset_governance", "cti_evaluation_dataset_pack", "analyst_quality_review_queue", "analyst_feedback_learning_loop", "active_learning_candidate_queue", "quality_runtime_value_gates", "quality_regression_suite"]),
      contractSurface("graph", "GET", "/v1/graph/*", "Agent 08/09", ["contract", "graph", "timeline", "reviewPlan", "cutoverReport", "liveUpdate"], ["graph_enforcement", "graph_export_certification", "graph_live_update", "graph_stix_rc_gate", "stix_mapping", "review_workflow"]),
      contractSurface("stix", "GET/POST", "/v1/exports/stix", "Agent 08/09", ["readiness", "bundle", "liveUpdate"], ["stix_readiness", "schema_safe", "ledger_complete", "graph_live_update", "graph_stix_rc_gate", "taxii_descriptor_only"]),
      contractSurface("ops", "GET/POST", "/v1/ops/*", "Agent 07/10/09", ["resources", "capacity", "workerPools", "queue", "operatorView", "readiness", "liveProductSlo", "apifyLaunchExperiment", "dailySnapshot"], ["resource_budget", "worker_supervision", "public_canary_control_plane", "public_canary_readiness", "live_product_slo_dashboard", "apify_revenue_telemetry", "no_implicit_source_activation"]),
      contractSurface("contracts", "GET", "/v1/contracts", "Agent 09", ["endpoint", "routeInventory", "routeTruthAudit", "apiRegressionSentinel", "apiGatewayIntegration", "publicWrapperCutoverReadiness", "realtimeDeliveryPrototype", "realtimeDeliverySoak", "clientGenerationFreeze", "frontendProgressiveUpdateContract", "scraperNativeReplacementReadiness", "apifyStoreReadiness", "darkwebIndexFrontendContract", "sourceAtlasFrontendContract", "enterpriseApiSurface", "sdkIntegration", "clientCompatibilityMatrix", "streamingWebhookCompatibility", "openapi", "semantics"], ["api_regression_sentinel", "api_gateway_integration", "public_wrapper_cutover_readiness", "realtime_delivery_prototype", "realtime_delivery_soak", "client_generation_freeze", "frontend_progressive_update", "scraper_native_replacement_readiness", "apify_store_readiness", "darkweb_index_frontend_contract", "source_atlas_frontend_contract", "streaming_webhook_compatibility", "backward_compatibility", "openapi_ready", "no_leak_dto"])
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
      apiRegression: "bun run check:api-regression",
      apiGateway: "bun run check:api-gateway",
      apiTests: "bun test src/tests/api.test.ts src/tests/ops.test.ts",
      typecheck: "bun run check",
      fullTests: "bun test",
      publicProofs: [
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Volt Typhoon' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Scattered Spider' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY=LockBit bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY=APT42 bun run check:scraper-native-search",
        "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
        "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
      ],
      contractIndexProof: "GET /v1/contracts; assert routeInventory.count covers every active /v1 handler and examples pass no-leak serialization",
      schemaExampleRule: "examples must not contain forbidden raw payload, credentials, cookies, authorization headers, object keys, or restricted raw URLs"
    }
  };
}

function clientCompatibilityMatrixContract(
  enterpriseApiSurface: ReturnType<typeof enterpriseApiSurfaceContract>,
  sdkIntegration: ReturnType<typeof sdkIntegrationContract>
) {
  const errorCodes = enterpriseApiSurface.errors.codes;
  const retryHeaders = enterpriseApiSurface.rateLimits.responseHeaders;
  return {
    schemaVersion: "ti.client_compatibility_matrix.v1",
    owner: "Agent 09",
    status: "contract_frozen_for_client_generation",
    contractFreeze: {
      schemaVersion: "ti.openapi_contract_freeze.v1",
      openapi: enterpriseApiSurface.openapi.openapi,
      routeCount: Object.keys(enterpriseApiSurface.openapi.paths).length,
      requiredComponentSchemas: [
        "ErrorEnvelope",
        "CursorPage",
        "IdempotentRunRequest",
        "PublicSearchResponse",
        "SdkPollingEnvelope",
        "SdkSubscriptionRegistration"
      ],
      requiredSemantics: [
        "trusted_gateway_forwarded_identity",
        "tenant_header_boundary",
        "stable_error_envelope",
        "cursor_pagination",
        "idempotent_run_creation",
        "retry_after_headers",
        "public_wrapper_delta_polling",
        "no_leak_examples"
      ],
      noBreakingChangeRule: "clients may add optional fields, but required fields and state names need a new compatibility entry before route promotion"
    },
    sharedGuarantees: {
      tenantBoundary: enterpriseApiSurface.authBoundary.tenantContract.isolationRule,
      requesterBoundary: enterpriseApiSurface.authBoundary.requesterContract.piiRule,
      errorEnvelope: enterpriseApiSurface.errors.envelope,
      errorCodes,
      retryHeaders,
      redactedAlways: enterpriseApiSurface.auditFields.redactedAlways,
      noLeakRule: enterpriseApiSurface.noLeakGuarantee
    },
    clients: [
      {
        client: "frontend_ti",
        owner: "public /ti application",
        primaryRoutes: ["POST /api/ti/search", "GET /v1/intel/search"],
        requiredResponseKeys: ["status", "runId", "refreshAfterSeconds", "pollCursor", "deltaCursor", "updated", "publicTiAnswer", "publicWrapperDelta"],
        states: ["first_response", "partial", "searching", "empty_delta", "metadata_review", "graph_hold", "claim_ledger_hold", "ready", "blocked"],
        cursorSemantics: "poll with pollCursor/deltaCursor every refreshAfterSeconds; empty deltas preserve the visible answer",
        rateLimitBehavior: "honor retry-after and x-rate-limit-policy; keep last safe answer during provider/scraper/queue degradation",
        noLeakExamples: ["raw message body", "credentials", "restricted URL", "object_key"]
      },
      {
        client: "cti_backend",
        owner: "broader CTI backend integrations",
        primaryRoutes: ["POST /v1/intel/runs", "GET /v1/intel/runs/{id}", "GET /v1/intel/runs/{id}/results", "POST /v1/exports/stix"],
        requiredResponseKeys: ["run", "frontier", "results", "nextCursor", "bundle"],
        states: ["queued", "running", "partial", "ready", "blocked", "failed"],
        idempotency: enterpriseApiSurface.idempotency.retryRule,
        pagination: enterpriseApiSurface.pagination,
        errorEnvelope: enterpriseApiSurface.errors.envelope
      },
      {
        client: "analyst_automation",
        owner: "analyst review and approval workflows",
        primaryRoutes: ["GET /v1/analyst/loop", "GET /v1/analyst/metadata-review-tasks", "GET /v1/evidence/claim-ledger", "GET /v1/restricted-metadata/status"],
        requiredResponseKeys: ["contract", "state", "reviewTasks", "claimLedger", "notificationPackets", "guarantees"],
        states: ["metadata_review", "needs_source_activation", "blocked_unsafe_target", "review_required", "ready"],
        safetyBoundary: "review packets remain metadata-only and victim-safe; automation records dry-run recommendations unless an explicit mutation route exists",
        noLeakExamples: ["leaked_row", "credential", "restricted_raw_url", "private access material"]
      },
      {
        client: "future_sdk",
        owner: "generated TypeScript or backend SDKs",
        primaryRoutes: Object.values(sdkIntegration.routes).filter((route) => !route.includes("/events/") && !route.includes("/webhooks/")),
        requiredResponseKeys: sdkIntegration.polling.responseFields,
        states: [...sdkIntegration.polling.retryableStates, ...sdkIntegration.polling.terminalStates],
        openapiComponents: sdkIntegration.openapi.components,
        pollingContract: sdkIntegration.openapi.xSdkPollingContract,
        backoff: sdkIntegration.backoff
      },
      {
        client: "future_sse_webhooks",
        owner: "future event delivery boundary",
        primaryRoutes: [sdkIntegration.routes.futureSse, sdkIntegration.routes.futureWebhookRegistration],
        requiredResponseKeys: ["subscriptionId", "eventTypes", "deliveryState", "lastEventId", "deltaCursor"],
        states: sdkIntegration.eventBoundary.eventTypes,
        delivery: sdkIntegration.eventBoundary.delivery,
        replayRule: sdkIntegration.eventBoundary.replayRule,
        forbiddenPayloadFields: sdkIntegration.eventBoundary.forbiddenPayloadFields
      }
    ],
    proof: {
      contractIndex: "bun run check:contract-index",
      apiTests: "bun test src/tests/api.test.ts src/tests/ops.test.ts",
      noLeakSerialization: "JSON examples must not include raw bodies, credentials, authorization headers, object keys, restricted URLs, leaked rows, or private access material"
    }
  };
}

function publicWrapperCutoverReadinessContract(input: {
  compatibilityFields: string[];
  enterpriseApiSurface: ReturnType<typeof enterpriseApiSurfaceContract>;
  sdkIntegration: ReturnType<typeof sdkIntegrationContract>;
  clientCompatibilityMatrix: ReturnType<typeof clientCompatibilityMatrixContract>;
  streamingWebhookCompatibility: ReturnType<typeof buildStreamingWebhookCompatibilityContract>;
  apiGatewayIntegration: {
    tenantPropagation: {
      requiredHeader: string;
      requesterHeader: string;
      requestIdHeader: string;
      orderingRule: string;
    };
    rateLimitPlan: {
      responseHeaders: string[];
      queuePressureBehavior: string;
    };
    rollbackPlan: { safeActions: string[] };
  };
}) {
  return {
    schemaVersion: "ti.public_wrapper_cutover_readiness.v1",
    owner: "Agent 09",
    status: "watch_ready_polling_compatible",
    mode: "contract_only_public_wrapper_cutover_gate",
    publicWrapperRoute: "POST /api/ti/search",
    scraperNativeRoute: "GET /v1/intel/search",
    stableFieldAgreement: {
      requiredFields: uniqueStrings([
        ...input.compatibilityFields,
        "status",
        "runId",
        "cursor",
        "nextCursor",
        "pollCursor",
        "deltaCursor",
        "refreshAfterSeconds",
        "updated",
        "warningCodes",
        "publicTiAnswer",
        "publicWrapperDelta"
      ]),
      publicWrapperRoute: "POST /api/ti/search",
      scraperNativeRoute: "GET /v1/intel/search",
      runPollingRoutes: ["GET /v1/intel/search", "GET /v1/intel/runs/{id}", "GET /v1/intel/runs/{id}/results", "POST /api/ti/search"],
      agreeingSurfaces: [
        "publicCompatibility.stableFields",
        "publicWrapperDeltaAudit.stableFields",
        "routeTruthAudit.canonicalPublicPost.stableFields",
        "sdkIntegration.polling.responseFields",
        "streamingWebhookCompatibility.pollingCompatibility.sameFields"
      ],
      pollingSeconds: input.sdkIntegration.polling.intervalSeconds,
      requiredInCompatibilityFields: true,
      noDefaultActor: true
    },
    fallbackWatch: {
      unknownQueryRule: "unknown or unsupported queries must not become ready from a default actor, demo copy, or stale wrapper assumption",
      allowedUnknownStates: ["searching", "queued", "partial"],
      bannedFallbackCodes: ["default_actor_fallback", "demo_copy", "stale_cache_copy", "implicit_apt29_example", "unknown_ready_without_evidence", "outer_wrapper_run_id_synthesis"],
      bannedTextPatterns: ["default APT29", "cached demo", "demo data", "stale local cache", "example actor", "fallback actor"],
      watchTargets: ["/ti", "POST /api/ti/search", "GET /v1/intel/search", "GET /v1/contracts", "fixtures/sdk/*"],
      requiredCopyForNoResult: "Searching",
      noLeakRule: "fallback checks inspect stable DTO fields, warning codes, hashes, and compact copy only"
    },
    deprecationWatch: {
      aliasRoute: "POST /api/ti/search",
      canonicalRoute: "GET /v1/intel/search",
      state: "compatibility_wrapper_until_cutover",
      headersWhenScheduled: input.enterpriseApiSurface.versioning.deprecationHeaders,
      minimumNoticeDays: input.enterpriseApiSurface.versioning.minimumDeprecationNoticeDays,
      noSunsetBefore: [
        "public proof matrix is green for APT29, Random Actor, and Made Up Actor",
        "apiRegressionSentinel and publicWrapperCutoverInvariant are green",
        "gateway route mapping preserves tenant/requester/request ids",
        "SDK fixtures and OpenAPI schemas include public wrapper cutover readiness",
        "Agent 10 release board marks scraper-native replacement promote"
      ],
      rollbackTriggers: [
        "public_wrapper_post_failure",
        "default_actor_detected",
        "demo_copy_detected",
        "missing_cursor",
        "unstable_run_id",
        "rate_limit_header_missing",
        "error_envelope_drift",
        "tenant_boundary_failure",
        "unsafe_payload_leak",
        "streaming_contract_drift"
      ],
      safeRollbackActions: input.apiGatewayIntegration.rollbackPlan.safeActions
    },
    gatewayWatch: {
      requiredForwardedHeaders: input.enterpriseApiSurface.authBoundary.requiredForwardedHeaders,
      tenantHeader: input.apiGatewayIntegration.tenantPropagation.requiredHeader,
      requesterHeader: input.apiGatewayIntegration.tenantPropagation.requesterHeader,
      requestIdHeader: input.apiGatewayIntegration.tenantPropagation.requestIdHeader,
      projectionRule: input.apiGatewayIntegration.tenantPropagation.orderingRule,
      rateLimitHeaders: input.apiGatewayIntegration.rateLimitPlan.responseHeaders,
      queuePressureBehavior: input.apiGatewayIntegration.rateLimitPlan.queuePressureBehavior,
      errorEnvelope: input.enterpriseApiSurface.errors.envelope,
      noSecretForwardingRule: input.enterpriseApiSurface.authBoundary.auditLogging.noSecretRule
    },
    compatibilityHandoffs: {
      agent02Scheduler: ["stable run ids", "duplicate-run reuse", "3-second polling", "queue pressure retry hints"],
      agent06Evidence: ["evidence-backed readiness only", "claim ledger ids", "no raw evidence in public wrapper"],
      agent07Quality: ["unknown says Searching", "low-confidence caveats", "no overclaim wording"],
      agent08Graph: ["graph relationship deltas", "review holds", "export eligibility caveats"],
      agent10Release: ["release board promote or hold", "rollback triggers", "public proof packet"]
    },
    sdkAndStreamingCompatibility: {
      clientMatrixStatus: input.clientCompatibilityMatrix.status,
      sdkFixtureSchemaVersion: input.sdkIntegration.fixturePack.schemaVersion,
      pollingPrimary: input.streamingWebhookCompatibility.pollingCompatibility.pollingPrimary,
      futureDeliveryModes: input.streamingWebhookCompatibility.deliveryModes.map((mode) => mode.mode),
      eventTypes: input.streamingWebhookCompatibility.eventTypes.map((event) => event.type),
      migrationRule: input.streamingWebhookCompatibility.pollingCompatibility.migrationRule
    },
    proofCommands: [
      "bun run check",
      "bun run check:api-regression",
      "bun run check:contract-index",
      "bun run check:route-inventory",
      "bun run check:sdk-fixtures",
      "bun run check:api-gateway",
      "bun test src/tests/apiRegressionSentinel.test.ts src/tests/api.test.ts",
      "bun test",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ],
    noLeakGuarantee: "cutover readiness exposes route names, stable field names, warning codes, ids, hashes, retry hints, and release states only; it does not expose raw evidence, unsafe source locators, token material, object references, or restricted rows"
  };
}

function buildDarkwebIndexFrontendContract() {
  const darkwebContract = darkwebIndexContract();
  return {
    schemaVersion: "ti.darkweb_index_frontend_contract.v1",
    status: "frozen_metadata_only_frontend_contract",
    owner: "Agent 09",
    route: "/ti/darkweb/index",
    publicRoute: "hanasand.com/ti/darkweb/index",
    apiRoutes: {
      status: "/v1/darkweb/status",
      search: "/v1/darkweb/search",
      contracts: "/v1/contracts"
    },
    sdkOpenapi: {
      operationIds: ["darkweb_get_v1_darkweb_status", "darkweb_get_v1_darkweb_search", "contracts_get_v1_contracts"],
      responseFields: ["status", "contract", "darkwebIndex", "records", "uiContract", "noLeakSerialization"],
      pagination: {
        requestFields: ["cursor", "limit"],
        responseFields: ["nextCursor", "totalMatches"],
        limitMax: 100
      },
      schemaRefs: ["DarkwebIndexStatusDto", "DarkwebIndexSearchDto", "DarkwebIndexFrontendContract"]
    },
    table: {
      searchBox: {
        param: "q",
        placeholderCopy: "Search metadata",
        emptyDeltaCopy: "No new metadata records matched this poll.",
        noResultCopy: "No matching metadata yet."
      },
      filters: ["q", "category", "legalTriage", "liveness", "network", "language", "source", "reviewState", "cursor", "limit"],
      columns: ["redactedDisplayUrl", "category", "legalTriage", "safeSummary", "lastSeen", "liveness", "provenance", "reviewState"],
      chips: {
        category: ["forum", "marketplace", "leak_extortion", "paste", "directory", "blog", "research", "unknown"],
        risk: ["benign", "news_or_research", "marketplace_or_illicit", "leak_or_extortion", "malware_or_payload", "credential_or_abuse", "unknown_requires_review", "blocked_unsafe"],
        liveness: ["live", "dead", "intermittent", "blocked_by_policy", "requires_review", "unknown"],
        reviewState: ["approved_metadata_only", "needs_review", "legal_hold", "blocked_unsafe", "false_positive_review"]
      },
      sort: {
        default: "lastSeen:desc",
        allowed: ["lastSeen:desc", "lastSeen:asc", "lastChecked:desc", "confidence:desc", "category:asc"]
      }
    },
    safeDetailDrawer: {
      sections: ["summary", "classification", "whatWasNotAccessed", "sourceProvenance", "refreshHistory", "graphLinks", "reviewState"],
      fields: ["id", "redactedDisplayUrl", "safeSummary", "category", "legalTriage", "liveness", "classification.reasons", "whatWasNotAccessed", "provenance.sourceType", "provenance.sourceHash", "firstSeen", "lastSeen", "lastChecked", "contentHash", "screenshotHash", "actorHints", "victimHints", "ttpHints", "reviewState", "blockedReason"],
      graphLinks: {
        allowed: ["actorHints", "victimHints", "ttpHints", "sourceHash", "contentHash"],
        holdRule: "darkweb descriptors may create graph hints only when metadata-safe or analyst-reviewed"
      },
      stixTaxii: {
        exportState: "descriptor_hold_until_reviewed",
        rule: "darkweb index records are descriptors only; no TAXII object is emitted from unsafe or unreviewed metadata"
      }
    },
    copyRules: {
      legalTriageDisclaimer: "Risk labels are triage labels, not legal advice.",
      compactCopy: true,
      blockedCopy: "Metadata only. Unsafe target details were not accessed.",
      requiresReviewCopy: "Requires analyst review before promotion.",
      whatWasNotAccessedLabel: "What was not accessed",
      bannedPhrases: ["verified leak contents", "downloaded dump", "full onion URL", "credential sample", "private message transcript"]
    },
    provenance: {
      requiredRecordFields: ["id", "rawUrlHash", "hostHash", "pathHash", "contentHash", "provenance.sourceHash", "provenance.discoveryPathHash", "lastChecked"],
      displayRule: "show redactedDisplayUrl and hashes only; never display raw unsafe URLs or private locators"
    },
    noLeak: {
      metadataOnly: true,
      rawUnsafeUrlPublicOutputAllowed: false,
      forbiddenUiPayloadFields: ["rawUrl", "rawUnsafeUrl", "fullOnionUrl", "credential", "password", "cookie", "authorization", "raw_body", "object_key", "leaked_row", "private_message", "payload_download", "webhook_secret"],
      forbiddenOperations: ["payload download", "credential dump download", "private community access", "CAPTCHA solving", "auth bypass", "threat actor interaction", "malware execution"],
      serializationRule: "frontend DTOs use redacted labels, hashes, compact summaries, triage labels, review state, and whatWasNotAccessed only"
    },
    examples: {
      statusRequest: { method: "GET", path: "/v1/darkweb/status" },
      searchRequest: { method: "GET", path: "/v1/darkweb/search?q=akira&network=tor&limit=25" },
      recordPreview: {
        id: "darkweb-index_*",
        redactedDisplayUrl: "tor:host-abc123/path-def456",
        category: "leak_extortion",
        legalTriage: "leak_or_extortion",
        safeSummary: "Metadata-only landing-page descriptor.",
        lastSeen: "2026-05-24T00:00:00.000Z",
        liveness: "requires_review",
        reviewState: "needs_review",
        whatWasNotAccessed: ["credential values", "payload downloads", "private access material", "threat actor communications"]
      }
    },
    releaseGate: {
      decision: "contract_ready_implementation_pending_public_page",
      blockers: ["raw_unsafe_url_field_detected", "what_was_not_accessed_missing", "detail_drawer_without_no_leak_copy", "pagination_missing_cursor", "legal_triage_copy_implies_advice"],
      proofCommands: ["bun run check:api-regression", "bun run check:contract-index", "bun run check:route-inventory", "bun test src/tests/api.test.ts src/tests/darkwebIndex.test.ts", "bun test", "bun run check"]
    },
    underlyingDarkwebContract: {
      routes: darkwebContract.routes,
      targetRecordCount: darkwebContract.targetRecordCount,
      recordFields: darkwebContract.recordFields,
      searchFilters: darkwebContract.searchFilters
    },
    proofCommands: ["bun run check:api-regression", "bun run check:contract-index", "bun run check:route-inventory", "bun test src/tests/api.test.ts src/tests/darkwebIndex.test.ts", "bun test", "bun run check"]
  };
}

function buildFrontendProgressiveUpdateContract(input: {
  stateMachine: {
    schemaVersion: string;
    states: Record<string, { retryable: unknown; terminal: boolean; publicPromotion: string; requiredFields: string[] }>;
    requiredUiFields: string[];
  };
  publicWrapperResponsiveAudit: {
    publicWrapper: { canonicalMethod: string; canonicalPath: string; pollingSeconds: number; stableFields: string[] };
    fixtures: Array<{ name: string; query: string; expectedUxState: string; stableFields: string[]; compactUnknownCopy?: string }>;
  };
  publicWrapperDeltaAudit: {
    stableFields: string[];
    fixtures: Array<{ name: string; query: string; deltaKind: string; expectedDisplayState: string; warningCodes: string[] }>;
  };
  publicWrapperCutoverReadiness: ReturnType<typeof publicWrapperCutoverReadinessContract>;
  sdkIntegration: ReturnType<typeof sdkIntegrationContract>;
}) {
  const firstResponseFields = ["status", "summary", "runId", "refreshAfterSeconds", "pollCursor", "deltaCursor", "updated", "publicTiAnswer", "publicWrapperDelta"];
  return {
    schemaVersion: "ti.frontend_progressive_update_contract.v1",
    owner: "Agent 09",
    status: "frozen_ui_polling_contract",
    routes: {
      publicPost: "POST /api/ti/search",
      scraperNativeGet: "GET /v1/intel/search",
      runStatus: "GET /v1/intel/runs/{id}",
      runResults: "GET /v1/intel/runs/{id}/results"
    },
    polling: {
      primary: true,
      intervalSeconds: input.publicWrapperResponsiveAudit.publicWrapper.pollingSeconds,
      responseFields: input.sdkIntegration.polling.responseFields,
      keepLastSafeAnswerOn: ["empty_delta", "queue_pressure", "provider_unavailable", "scraper_unavailable", "rate_limit_retry"]
    },
    requiredFields: Array.from(new Set([...firstResponseFields, ...input.publicWrapperCutoverReadiness.stableFieldAgreement.requiredFields])),
    stateMapping: {
      first_response: { uiState: "loading_partial", copy: "Searching", merge: "render stable shell and show source coverage gaps" },
      empty_delta: { uiState: "waiting", copy: "Checking for updates", merge: "preserve last safe answer and advance no fields except updated/poll metadata" },
      new_delta_available: { uiState: "updated_partial", copy: "Updated", merge: "merge changed publicWrapperDelta sections by deltaCursor" },
      metadata_review: { uiState: "review_required", copy: "Review required", merge: "show held metadata/review reasons without exposing restricted material" },
      graph_hold: { uiState: "review_required", copy: "Review required", merge: "show graph caveat and keep fact promotion blocked" },
      claim_ledger_hold: { uiState: "review_required", copy: "Review required", merge: "show claim trust gate and keep stale/unsupported facts out" },
      ready: { uiState: "ready", copy: "Ready", merge: "promote only release-gated publicTiAnswer fields" },
      no_result: { uiState: "searching", copy: "Searching", merge: "do not render no-evidence as absence or default actor context" }
    },
    mergeSemantics: {
      identityFields: ["query", "runId"],
      cursorFields: ["cursor", "nextCursor", "pollCursor", "deltaCursor"],
      rules: [
        "merge by runId and deltaCursor",
        "preserve previous publicTiAnswer on empty deltas",
        "append warningCodes without duplicating",
        "replace sourceCoverage only when changedSinceCursor is not empty",
        "never backfill default actor/demo copy",
        "never clear review holds until publicWrapperDelta says ready"
      ],
      staleResponseBehavior: "keep last safe visible answer, display retry/wait state, and continue polling from the last cursor"
    },
    uiProofMatrix: [
      frontendProgressiveFixture("first_response", "APT29", "loading_partial", ["publicTiAnswer", "publicWrapperDelta", "pollCursor"]),
      frontendProgressiveFixture("repeated_poll_empty_delta", "APT29", "waiting", ["runId", "pollCursor", "deltaCursor"]),
      frontendProgressiveFixture("new_delta_available", "APT29", "updated_partial", ["publicWrapperDelta", "answerDeltas"]),
      frontendProgressiveFixture("random_actor_partial", "Random Actor", "loading_partial", ["sourceCoverage", "warningCodes"]),
      frontendProgressiveFixture("made_up_actor_searching", "Made Up Actor", "searching", ["publicTiAnswer.stateMachine.safeNoResult"]),
      frontendProgressiveFixture("metadata_review_hold", "Akira", "review_required", ["restrictedMetadata", "warningCodes"]),
      frontendProgressiveFixture("graph_hold", "Volt Typhoon", "review_required", ["graph", "answerGraphCaveats"]),
      frontendProgressiveFixture("claim_ledger_hold", "Turla", "review_required", ["claimLedger", "warningCodes"]),
      frontendProgressiveFixture("final_ready", "APT29", "ready", ["publicTiAnswer", "sources", "updated"])
    ],
    noLeak: {
      forbiddenUiPayloadFields: ["raw_body", "restricted_raw_url", "credential", "authorization", "cookie", "object_key", "leaked_row", "webhook_secret"],
      copyRule: "public UI copy stays compact and explains partial/held/searching states without raw source material"
    },
    proofCommands: [
      "bun run check",
      "bun run check:api-regression",
      "bun run check:contract-index",
      "bun run check:route-inventory",
      "bun run check:sdk-fixtures",
      "bun test src/tests/apiRegressionSentinel.test.ts src/tests/api.test.ts src/tests/sdkFixtures.test.ts",
      "bun test",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ],
    handoffs: {
      frontend: ["render stateMapping", "merge by mergeSemantics", "preserve safe empty-delta UX"],
      agent02: ["polling cadence", "duplicate run reuse", "retry-after hints"],
      agent06: ["claim ledger holds", "safe evidence refs"],
      agent07: ["quality caveats", "unknown actor Searching behavior"],
      agent08: ["graph holds", "STIX readiness caveats"],
      agent10: ["release board public proof matrix"]
    }
  };
}

function frontendProgressiveFixture(scenario: string, query: string, expectedUiState: string, requiredKeys: string[]) {
  return {
    scenario,
    query,
    expectedUiState,
    routes: ["POST /api/ti/search", "GET /v1/intel/search"],
    requiredKeys,
    copyRule: query === "Made Up Actor" ? "Searching" : "compact status-specific copy",
    noDefaultActor: true,
    noDemoCopy: true
  };
}

function buildScraperNativeReplacementReadinessContract(input: {
  publicWrapperCutoverReadiness: ReturnType<typeof publicWrapperCutoverReadinessContract>;
  frontendProgressiveUpdateContract: ReturnType<typeof buildFrontendProgressiveUpdateContract>;
  clientGenerationFreeze: ReturnType<typeof clientGenerationFreezeContract>;
  sdkIntegration: ReturnType<typeof sdkIntegrationContract>;
}) {
  const proofMatrix = [
    scraperNativeReplacementCase("known_actor", "APT29", "partial_or_ready", "public proof returns run id, cursor, source coverage, and public wrapper POST parity", "promote"),
    scraperNativeReplacementCase("random_actor", "Random Actor", "partial_or_searching", "public proof returns stable polling fields without default actor copy", "watch"),
    scraperNativeReplacementCase("made_up_actor", "Made Up Actor", "searching", "unknown actor remains Searching and must not become ready without evidence", "promote"),
    scraperNativeReplacementCase("cve_advisory", "CVE-2026-4242", "partial_or_searching", "CVE/advisory queries keep source coverage and no stale actor fallback", "watch"),
    scraperNativeReplacementCase("sector_country", "energy sector threats", "partial_or_searching", "sector/country queries expose why coverage is partial", "watch"),
    scraperNativeReplacementCase("victim_company", "Fjord Energy AS victim claim", "partial_or_review", "victim/company claims remain evidence- and review-gated", "watch"),
    scraperNativeReplacementCase("restricted_metadata_hold", "Akira ransomware", "metadata_review_or_partial", "restricted metadata stays metadata-only and review-held", "hold"),
    scraperNativeReplacementCase("graph_hold", "Volt Typhoon", "review_required_or_partial", "graph/STIX held facts do not become public facts until review gates pass", "hold"),
    scraperNativeReplacementCase("empty_delta", "APT29 repeat poll", "waiting_or_partial", "empty deltas preserve last safe answer and never clear holds implicitly", "promote")
  ];
  return {
    schemaVersion: "ti.scraper_native_replacement_readiness.v1",
    owner: "Agent 09",
    status: "replacement_board_ready_polling_primary",
    decision: "watch_ready",
    mode: "contract_and_public_proof_board",
    routes: {
      frontend: "hanasand.com/ti",
      publicPost: "POST /api/ti/search",
      scraperNative: "GET /v1/intel/search",
      runStatus: "GET /v1/intel/runs/{id}",
      runResults: "GET /v1/intel/runs/{id}/results",
      contracts: "GET /v1/contracts"
    },
    promotionCriteria: [
      "local contract gates green",
      "full bun test green",
      "public proof green for APT29, Random Actor, and Made Up Actor",
      "public wrapper POST parity preserves runId, pollCursor, deltaCursor, refreshAfterSeconds, publicTiAnswer, and publicWrapperDelta",
      "unknown and made-up actors remain Searching unless evidence-backed",
      "restricted metadata, graph, and claim-ledger holds remain visible and non-promoted",
      "no raw unsafe payload fields appear in examples, fixtures, events, or public DTOs"
    ],
    proofMatrix,
    blockers: [
      "public_proof_failed",
      "default_actor_detected",
      "demo_copy_detected",
      "unknown_ready_without_evidence",
      "missing_run_or_cursor",
      "empty_delta_clears_safe_answer",
      "held_state_promoted",
      "tenant_boundary_failure",
      "rate_limit_header_missing",
      "unsafe_payload_field_detected",
      "sdk_fixture_or_changelog_gate_failed"
    ],
    rollback: {
      route: input.publicWrapperCutoverReadiness.deprecationWatch.aliasRoute,
      actions: [
        "keep public POST compatibility wrapper",
        "serve last safe answer or Searching copy",
        "continue polling from prior cursor",
        "hold SDK/client release",
        "do not enable realtime delivery as a substitute for failed polling"
      ]
    },
    dependencies: {
      publicWrapperCutoverStatus: input.publicWrapperCutoverReadiness.status,
      frontendProgressiveStatus: input.frontendProgressiveUpdateContract.status,
      clientGenerationStatus: input.clientGenerationFreeze.status,
      sdkFixtureStatus: input.sdkIntegration.fixturePack.status,
      pollingPrimary: input.frontendProgressiveUpdateContract.polling.primary,
      pollingSeconds: input.sdkIntegration.polling.intervalSeconds
    },
    noLeak: {
      forbiddenPayloadFields: input.frontendProgressiveUpdateContract.noLeak.forbiddenUiPayloadFields,
      rule: "replacement readiness rows contain public proof states, ids, cursors, hashes, blockers, and compact notes only"
    },
    handoffs: {
      agent02Scheduler: ["stable run ids", "3-second polling", "queue pressure retry-after"],
      agent06Evidence: ["evidence promotion blockers", "claim ledger trust gate", "no raw body"],
      agent07Quality: ["unknown Searching", "low-confidence caveats", "stale/contradiction holds"],
      agent08Graph: ["graph hold visibility", "STIX export gate", "relationship review state"],
      agent10Release: ["replacement decision", "rollback actions", "public proof packet"]
    },
    proofCommands: [
      "bun run check",
      "bun run check:api-regression",
      "bun run check:sdk-fixtures",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      "bun test src/tests/apiRegressionSentinel.test.ts src/tests/api.test.ts src/tests/sdkFixtures.test.ts",
      "bun test",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ]
  };
}

function scraperNativeReplacementCase(
  caseName: string,
  query: string,
  expectedState: string,
  requiredProof: string,
  decision: "promote" | "watch" | "hold"
) {
  return {
    case: caseName,
    query,
    expectedState,
    requiredProof,
    decision,
    noDefaultActor: true,
    noDemoCopy: true,
    noUnsafePayload: true
  };
}

function clientGenerationFreezeContract(input: {
  enterpriseApiSurface: ReturnType<typeof enterpriseApiSurfaceContract>;
  sdkIntegration: ReturnType<typeof sdkIntegrationContract>;
  clientCompatibilityMatrix: ReturnType<typeof clientCompatibilityMatrixContract>;
  streamingWebhookCompatibility: ReturnType<typeof buildStreamingWebhookCompatibilityContract>;
  realtimeDeliveryPrototype: ReturnType<typeof realtimeDeliveryPrototypeContract>;
  publicWrapperCutoverReadiness: ReturnType<typeof publicWrapperCutoverReadinessContract>;
}) {
  const requiredSchemas = [
    "ErrorEnvelope",
    "CursorPage",
    "IdempotentRunRequest",
    "PublicSearchResponse",
    "PublicWrapperCutoverReadiness",
    "RealtimeDeliveryPrototype",
    "RealtimePrototypeEvent",
    "ClientGenerationFreeze",
    "GeneratedClientTarget",
    "SdkPollingEnvelope",
    "SdkSubscriptionRegistration",
    "StreamingEventEnvelope",
    "WebhookDeliveryAttempt"
  ];
  const requiredOperationIds = [
    "contracts_get_v1_contracts",
    "intel_get_v1_intel_search",
    "intel_post_v1_intel_runs",
    "intel_get_v1_intel_runs_id",
    "intel_get_v1_intel_runs_id_results",
    "sources_get_v1_sources",
    "captures_get_v1_captures",
    "metrics_get_v1_metrics"
  ];
  const requiredFixtures = input.sdkIntegration.fixturePack.requiredFiles;
  const sharedSchemas = ["ErrorEnvelope", "CursorPage", "SdkPollingEnvelope", "PublicSearchResponse"];
  const changelogGate = {
    schemaVersion: "ti.generated_client_changelog_gate.v1",
    owner: "Agent 09",
    status: "ready_for_generated_client_release_gate",
    releasePolicy: "contract_only_no_artifact_publish",
    semverPolicy: {
      major: ["remove or rename required schema", "remove or rename operationId", "remove run or cursor fields", "change error envelope", "change tenant/requester header names", "enable realtime delivery by default"],
      minor: ["add optional response field", "add route metadata", "add SDK fixture", "add inert realtime type", "add warning code", "add deprecation notice"],
      patch: ["docs change", "example refresh", "fixture timestamp refresh without field drift", "release board note"]
    },
    requiredChangeClasses: [
      "operation_id_added",
      "required_schema_added",
      "fixture_added",
      "optional_response_field_added",
      "deprecation_notice_added",
      "realtime_type_added_disabled"
    ],
    breakingChangeBlockers: [
      "operation_id_removed",
      "required_schema_removed",
      "required_field_removed",
      "cursor_field_removed",
      "error_envelope_changed",
      "tenant_header_changed",
      "realtime_enabled_by_default",
      "unsafe_payload_field_added"
    ],
    deprecationPolicy: {
      headersWhenScheduled: input.enterpriseApiSurface.versioning.deprecationHeaders,
      minimumNoticeDays: 90,
      publicWrapperAlias: input.publicWrapperCutoverReadiness.deprecationWatch.aliasRoute,
      canonicalRoute: input.publicWrapperCutoverReadiness.deprecationWatch.canonicalRoute,
      noSunsetBefore: input.publicWrapperCutoverReadiness.deprecationWatch.noSunsetBefore,
      releaseBoardRequired: true
    },
    fixtureGate: {
      requiredFiles: input.sdkIntegration.fixturePack.requiredFiles,
      invariantFields: input.sdkIntegration.fixturePack.invariantFields,
      fixtureRefreshRule: "only refresh generated-client fixtures after SDK fixture, API regression, route inventory, contract index, and public proof checks pass",
      noLeakAssertions: input.sdkIntegration.fixturePack.noLeakAssertions
    },
    generatedClientReleaseChecklist: [
      "bun run check",
      "bun run check:api-regression",
      "bun run check:sdk-fixtures",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      "bun test src/tests/apiRegressionSentinel.test.ts src/tests/api.test.ts src/tests/sdkFixtures.test.ts",
      "bun test",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ],
    changelogEntries: [
      { id: "client_generation_freeze_added", type: "minor", summary: "Generated TypeScript client targets now freeze operation ids, schemas, fixtures, and no-leak DTO boundaries." },
      { id: "realtime_types_disabled", type: "minor", summary: "Realtime generated types may be emitted as inert optional types only; polling remains primary." },
      { id: "public_wrapper_cutover_watch", type: "minor", summary: "Public wrapper compatibility and scraper-native replacement stay gated by public proof and release-board checks." }
    ]
  };
  return {
    schemaVersion: "ti.client_generation_freeze.v1",
    owner: "Agent 09",
    status: "frozen_contract_ready_for_codegen",
    mode: "contract_only_no_generated_artifacts_committed",
    openapiManifest: {
      schemaVersion: "ti.codegen_openapi_manifest.v1",
      openapi: input.enterpriseApiSurface.openapi.openapi,
      routeCount: Object.keys(input.enterpriseApiSurface.openapi.paths).length,
      source: "/v1/contracts.openapi",
      securityBoundary: "trusted gateway only; generated clients must send tenant/requester/request ids but never tokens to scraper DTOs",
      operationIdRule: "operationId is stable within /v1 and derived from route surface, method, and path; changes require this freeze contract to move",
      generatedArtifactRule: "codegen reads /v1/contracts only; it must not inspect memory store rows, adapter internals, evidence objects, or raw payloads"
    },
    operationManifest: {
      requiredOperationIds,
      requiredPublicCompatibilityRoutes: ["POST /api/ti/search", "GET /v1/intel/search"],
      requiredRunRoutes: ["POST /v1/intel/runs", "GET /v1/intel/runs/{id}", "GET /v1/intel/runs/{id}/results"],
      requiredDryRunAdminRoutes: ["POST /v1/sources/apply-plan", "POST /v1/frontier/apply-plan", "POST /v1/public-channels/apply-plan", "POST /v1/restricted-metadata/apply-plan"],
      futureDisabledRoutes: [input.sdkIntegration.routes.futureSse, input.sdkIntegration.routes.futureWebhookRegistration],
      missingOperationBehavior: "fail code generation before publish; do not synthesize clients from route handlers"
    },
    schemaManifest: {
      requiredSchemas,
      requiredSemantics: input.clientCompatibilityMatrix.contractFreeze.requiredSemantics,
      stableFieldSets: {
        publicWrapper: input.publicWrapperCutoverReadiness.stableFieldAgreement.requiredFields,
        polling: input.sdkIntegration.polling.responseFields,
        realtimeEnvelope: input.realtimeDeliveryPrototype.eventEnvelope.requiredFields,
        errors: ["error.code", "error.message", "error.details"]
      },
      additiveOnlyRule: input.clientCompatibilityMatrix.contractFreeze.noBreakingChangeRule,
      forbiddenBreakingChanges: [
        "remove required schema",
        "rename operationId",
        "remove runId or cursor fields",
        "change error envelope",
        "remove tenant/requester header contract",
        "make disabled realtime routes required for polling clients",
        "add raw payload fields to generated DTOs"
      ]
    },
    generatedClients: [
      {
        target: "typescript_fetch_browser",
        language: "TypeScript",
        status: "ready_for_generation_from_contract",
        primaryRoutes: ["POST /api/ti/search", "GET /v1/intel/search"],
        requiredSchemas: ["PublicSearchResponse", "SdkPollingEnvelope", "ErrorEnvelope"],
        requiredFixtures: ["fixtures/sdk/initial_public_search.json", "fixtures/sdk/repeated_poll_empty_delta.json", "fixtures/sdk/new_delta_available.json"],
        releaseGate: "browser /ti must preserve Searching for unknown queries and keep polling on empty deltas"
      },
      {
        target: "typescript_node_service",
        language: "TypeScript",
        status: "ready_for_generation_from_contract",
        primaryRoutes: ["POST /v1/intel/runs", "GET /v1/intel/runs/{id}", "GET /v1/intel/runs/{id}/results", "POST /v1/exports/stix"],
        requiredSchemas: ["IdempotentRunRequest", "CursorPage", "SdkPollingEnvelope", "ErrorEnvelope"],
        requiredFixtures: ["fixtures/sdk/idempotent_run_reuse.json", "fixtures/sdk/cursor_results_page.json", "fixtures/sdk/queue_pressure_retry.json"],
        releaseGate: "service clients must require idempotency on run creation and honor retry-after headers"
      },
      {
        target: "analyst_automation_types",
        language: "TypeScript",
        status: "ready_for_generation_from_contract",
        primaryRoutes: ["GET /v1/analyst/loop", "GET /v1/analyst/metadata-review-tasks", "GET /v1/evidence/claim-ledger", "GET /v1/restricted-metadata/status"],
        requiredSchemas: sharedSchemas,
        requiredFixtures: ["fixtures/sdk/metadata_review_required.json", "fixtures/sdk/policy_blocked_fail_closed.json"],
        releaseGate: "analyst automation must stay metadata-only and dry-run for review actions unless an explicit mutation route is called"
      },
      {
        target: "future_realtime_types",
        language: "TypeScript",
        status: "disabled_until_feature_flags_enabled",
        primaryRoutes: [input.sdkIntegration.routes.futureSse, input.sdkIntegration.routes.futureWebhookRegistration],
        requiredSchemas: ["RealtimeDeliveryPrototype", "RealtimePrototypeEvent", "StreamingEventEnvelope", "WebhookDeliveryAttempt"],
        requiredFixtures: ["fixtures/sdk/future_event_delta_available.json"],
        releaseGate: "SSE/webhook generated types may ship as inert types only; polling remains primary and realtime feature flags stay false"
      }
    ],
    fixtureManifest: {
      schemaVersion: input.sdkIntegration.fixturePack.schemaVersion,
      status: input.sdkIntegration.fixturePack.status,
      requiredFixtures,
      invariantFields: input.sdkIntegration.fixturePack.invariantFields,
      noLeakAssertions: input.sdkIntegration.fixturePack.noLeakAssertions,
      generationSource: "fixtures/sdk plus /v1/contracts.sdkIntegration.fixturePack",
      fixtureRefreshRule: "regenerate fixtures only after API regression, contract index, SDK fixtures, and public proof pass"
    },
    changelogGate,
    driftPolicy: {
      status: "fail_closed_before_codegen_publish",
      failClosedChecks: [
        "operation_id_drift",
        "required_schema_missing",
        "required_fixture_missing",
        "public_wrapper_field_drift",
        "cursor_field_drift",
        "error_envelope_drift",
        "tenant_header_drift",
        "realtime_flag_enabled_by_default",
        "unsafe_payload_field_detected"
      ],
      rollback: "keep generated clients unpublished, preserve public wrapper compatibility, and continue polling from existing cursors",
      releaseBoardHandoff: ["Agent 10 release board", "Agent 02 scheduler retry semantics", "Agent 06 evidence DTOs", "Agent 07 quality caveats", "Agent 08 graph holds"]
    },
    noLeak: {
      forbiddenPayloadFields: [
        ...input.realtimeDeliveryPrototype.noLeak.forbiddenPayloadFields,
        "authorization",
        "cookie",
        "api_key",
        "session",
        "password"
      ],
      rule: "generated clients expose route DTOs, ids, hashes, cursors, warning codes, summaries, and review states only"
    },
    proofCommands: [
      "bun run check",
      "bun run check:api-regression",
      "bun run check:sdk-fixtures",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      "bun test src/tests/apiRegressionSentinel.test.ts src/tests/api.test.ts",
      "bun test"
    ],
    handoffs: {
      agent02Scheduler: ["retry-after semantics", "run status states", "cursor continuity"],
      agent06Evidence: ["safe capture/evidence DTO fields", "no object keys", "claim ledger references"],
      agent07Quality: ["quality caveat warning codes", "unknown query Searching behavior"],
      agent08Graph: ["graph holds", "STIX export readiness fields"],
      agent10Release: ["client generation must stay blocked until proofCommands and public proof matrix are green"]
    }
  };
}

function buildDarkwebIndexFrontendContractDto() {
  return buildDarkwebIndexFrontendContract();
}

function buildApifyStoreReadinessContract(input: {
  frontendProgressiveUpdateContract: ReturnType<typeof buildFrontendProgressiveUpdateContract>;
  scraperNativeReplacementReadiness: ReturnType<typeof buildScraperNativeReplacementReadinessContract>;
}) {
  const defaultQueries = [
    "APT29",
    "APT28",
    "APT42",
    "Lazarus Group",
    "Volt Typhoon",
    "Salt Typhoon",
    "Turla",
    "Sandworm",
    "Kimsuky",
    "MuddyWater",
    "Charming Kitten",
    "Scattered Spider",
    "LockBit",
    "Clop",
    "Akira",
    "Black Basta",
    "Play",
    "RansomHub",
    "ALPHV",
    "Hunters International"
  ];
  const defaultSampleInput = {
    queries: defaultQueries,
    maxRowsPerQuery: 25,
    includeActivity: true,
    includeTargets: true,
    includeTtps: true,
    includeSources: true,
    includeDatasets: false,
    includeCoverageGaps: true
  };
  const safetyContract = {
    outputContract: "safe_metadata_only.v1",
    rawContentIncluded: false,
    metadataOnly: true,
    credentialsIncluded: false,
    stolenFilesIncluded: false,
    privateContentIncluded: false,
    actorInteraction: false,
    forbiddenFields: ["raw_body", "restricted_raw_url", "credential", "object_key", "leaked_row", "private_message", "payload_download"]
  };
  const publicProofDtos = [
    apifyPublicProofDto("APT29", "actor", "apt29", 6, ["clear_web", "public_channel"], "current", "corroborated"),
    apifyPublicProofDto("Volt Typhoon", "actor", "volt_typhoon", 5, ["clear_web", "public_channel"], "recent", "single_source"),
    apifyPublicProofDto("Scattered Spider", "actor", "scattered_spider", 5, ["clear_web", "public_channel"], "current", "corroborated"),
    apifyPublicProofDto("LockBit", "ransomware", "lockbit", 7, ["clear_web", "darknet_metadata"], "recent", "single_source")
  ];

  return {
    schemaVersion: "ti.apify_store_readiness.v1",
    owner: "Agent 09",
    status: "buyer_ready_with_external_payout_blocker",
    route: "GET /v1/contracts#apifyStoreReadiness",
    actor: {
      name: "public-threat-actor-monitor",
      title: "Public Threat Actor & Ransomware Activity Monitor",
      version: "0.6",
      publishedBuildVersion: "0.6.4",
      buildTag: "latest",
      actorRoot: "apify/public-threat-actor-monitor",
      defaultApiBase: "https://api.hanasand.com/api/ti/search",
      outputContract: safetyContract.outputContract,
      categories: ["SECURITY", "MONITORING"]
    },
    storeReadiness: {
      listingFields: {
        title: "complete",
        description: "complete",
        readme: "complete",
        changelog: "complete",
        categories: "complete",
        exampleInput: "complete",
        pricingModel: "complete",
        payoutMonetizationStatus: "external_verification_required",
        latestBuild: "tracked_by_apify_after_publish",
        latestProofRun: "documented_below",
        datasetSample: "complete",
        knownBlockers: "explicit"
      },
      knownBlockers: [
        "apify_beneficiary_and_payout_method_not_stored_in_repo",
        "apify_beneficiary_and_payout_withdrawal_readiness_requires_external_billing_verification",
        "remote_public_proof_requires_network_approval_when_run_outside_deployed_host"
      ],
      readinessDecision: "buyer_ready_after_external_payout_verification",
      latestBuild: { source: "Apify Store", buildTag: "latest", buildVersion: "0.6.4", actorId: "eirikhanasand/public-threat-actor-monitor" },
      latestProofRun: {
        source: "Apify run",
        runId: "iMQGeezZ8bx7WtlhQ",
        datasetId: "5PLmkE30luBA5Lbgc",
        querySet: ["APT42"],
        rowCount: 10,
        runtimeSeconds: 4,
        usageUsd: 0.001,
        projectedGrossRowRevenueUsdAfterPricing: 0.03
      },
      dailyRunBaseline: {
        source: "Apify run",
        runId: "rh6D0UInDD6x7GuuD",
        datasetId: "dYbGGA37MRq7pU47O",
        defaultQueryCount: 20,
        rowCount: 98,
        runtimeSeconds: 10,
        usageUsd: 0.0023,
        noLeakFailures: 0,
        thinRowCount: 80,
        singleSourceRowCount: 69,
        knownQualityGaps: ["stale_apt29_rows", "apt28_rows_without_public_evidence", "apt42_missing_public_channel_coverage"]
      },
      publicationFiles: ["README.md", "CHANGELOG.md", ".actor/actor.json", ".actor/INPUT_SCHEMA.json", ".actor/DATASET_SCHEMA.json", ".actor/OUTPUT_SCHEMA.json", "LAUNCH_CHECKLIST.md"]
    },
    defaultSampleInput,
    sampleOutputDtos: publicProofDtos.map((proof) => proof.datasetSample),
    publicProofDtos,
    frontendApiCompatibility: {
      sourceContracts: {
        frontendProgressiveStatus: input.frontendProgressiveUpdateContract.status,
        scraperNativeReplacementDecision: input.scraperNativeReplacementReadiness.decision
      },
      states: [
        { state: "queued", displayState: "searching", copy: "Searching", refreshAfterSeconds: 3, preservePriorAnswer: true },
        { state: "searching", displayState: "searching", copy: "Searching", refreshAfterSeconds: 3, preservePriorAnswer: true },
        { state: "partial", displayState: "partial", copy: "Partial public evidence is ready.", refreshAfterSeconds: 3, preservePriorAnswer: true },
        { state: "ready", displayState: "ready", copy: "Verified public evidence is ready.", refreshAfterSeconds: 0, preservePriorAnswer: false },
        { state: "empty_delta", displayState: "waiting", copy: "Still searching public sources.", refreshAfterSeconds: 3, preservePriorAnswer: true }
      ],
      stableFields: ["query", "status", "runId", "pollCursor", "deltaCursor", "refreshAfterSeconds", "updated", "warningCodes", "publicTiAnswer", "publicWrapperDelta"],
      unknownActorCopy: "Searching",
      emptyDeltaRule: "return stable cursors and preserve the last safe answer; never replace with demo actor copy"
    },
    pricingHooks: {
      model: "pay_per_dataset_row",
      unitEvent: "apify-default-dataset-item",
      actorStartEvent: "apify-actor-start",
      effectiveDate: "2026-07-04",
      rowPriceUsdPerThousand: 3,
      actorStartPriceUsd: 0.00005,
      platformUsageIncludedForUsers: true,
      apifyMarginPercent: 20,
      payoutStatus: "not_available_without_external_apify_account_verification",
      revenueTelemetryHandoff: "/v1/ops/product-slo.apifyLaunchExperiment"
    },
    conversionTracking: {
      source: "Apify Store analytics and /v1/ops/product-slo",
      currentStorePageViews: null,
      currentUniqueUsers: null,
      currentTrialRuns: null,
      currentPaidRuns: null,
      currentConversionRate: null,
      metricsToTrack: ["storePageViews", "uniqueUsers", "trialRuns", "paidRuns", "repeatUsers", "conversionRate", "usefulRowRate", "freshRowRate", "noLeakFailures", "costPerUsefulRow"],
      handoffRoute: "/v1/ops/product-slo.apifyLaunchExperiment",
      notes: "Real buyer metrics stay null until Apify analytics are copied from the account; do not store billing identifiers or secrets in this repository."
    },
    buyerFacingConversionProof: {
      schemaVersion: "ti.apify_buyer_facing_conversion_proof.v1",
      routeVisibleOn: ["/v1/contracts#apifyStoreReadiness", "/v1/ops/product-slo", "/v1/quality/evaluate"],
      readyProof: {
        runId: "OThlfd0uzSCNnedAO",
        datasetId: "LSen2fYtwFTtOr7vK",
        query: "APT42",
        rowCount: 10,
        sellableRows: 4,
        includedWithCaveatRows: 2,
        heldRows: 4,
        averageBuyerValueScore: 0.577,
        monetizationDecision: "ready_for_paid_traffic"
      },
      buyerReadableExamples: [
        {
          rowClass: "profile",
          decision: "sellable",
          buyerUse: "Start with this actor profile when buyers need a current, corroborated public summary with source-family context and provenance hashes.",
          requiredVisibleFields: ["paidRowDecision", "buyerValueScore", "sourceFamilies", "provenanceHash", "graphQualityLiftEvidence"]
        },
        {
          rowClass: "activity",
          decision: "included_with_caveat",
          buyerUse: "Use as a lead when activity is useful but still needs stronger corroboration before charging as a finding.",
          requiredVisibleFields: ["paidRowReasonCodes", "buyerCaveat", "reviewReasons", "sourceCoverageGaps", "nextSearchPivots"]
        },
        {
          rowClass: "held_or_stale",
          decision: "hold",
          buyerUse: "Do not charge or promote stale, contradicted, unrelated, restricted-only, or missing-ledger rows.",
          requiredVisibleFields: ["paidRowReasonCodes", "reviewReasons", "graphQualityLiftReasonCodes", "billingGuidance"]
        }
      ],
      qualityLiftHandoff: {
        productSloField: "buyerVisibleQualityLiftGate",
        contractField: "semantics.qualityRuntimeValueGates.programBdQualityEvaluationPack.paidRowQualityGate.buyerVisibleQualityLiftGate",
        graphLiftField: "OUTPUT.graphLiftBatch2",
        dryRun: true,
        willMutateSources: false,
        willStartCollection: false
      },
      conversionReadinessSummary: {
        minimumSellableRowRate: 0.25,
        currentSellableRowRate: 0.4,
        minimumAverageBuyerValueScore: 0.55,
        currentAverageBuyerValueScore: 0.577,
        nextAction: "Use Apify analytics and /v1/ops/product-slo together: store conversion stays unknown until external analytics are copied, while row quality is proven by the latest ready run."
      },
      noLeakGuarantee: "Buyer-facing proof exposes row decisions, counts, source families, hashes, caveats, and quality gates only; it does not expose raw evidence bodies, unsafe URLs, credentials, private content, object keys, payloads, or actor interaction."
    },
    sampleOutputSummaries: [
      { query: "APT42", runId: "iMQGeezZ8bx7WtlhQ", datasetId: "5PLmkE30luBA5Lbgc", summary: "Published build 0.6.4 emits safe metadata rows with paid-row decisions, caveated leads, and held stale rows visible in the dataset.", rowSafety: "metadata_only" }
    ],
    marketplaceGuardrails: {
      noPlaceholderDefaults: true,
      noHelloWorldSampleInput: true,
      noGenericCategories: true,
      noInflatedClaims: true,
      noAiFlavoredCopy: true,
      safeOutputOnly: true,
      defaultQueriesAreRealWatchlist: true,
      bannedListingTerms: ["helloWorld", "placeholder", "TODO", "as an AI", "AI-generated", "ChatGPT", "language model"]
    },
    safetyContract,
    proofCommands: [
      "bun run check",
      "bun run check:api-regression",
      "bun run check:contract-index",
      "bun run check:apify-threat-actor-monitor",
      "bun run smoke:apify-threat-actor-monitor",
      "bun run check:apify-publication",
      "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Volt Typhoon' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Scattered Spider' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY=LockBit bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
      "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
    ],
    noLeakProof: {
      serializationRule: "sample outputs contain row ids, source families, confidence, evidence grade, cursors, hashes, and summaries only",
      forbiddenPatternGate: "authorization|cookie|password|bearer|raw_body|restricted_raw_url|object_key|credential|leaked_row|private_message|payload_download",
      proofFields: ["rawContentIncluded:false", "safety.metadataOnly:true", "provenanceHash", "sourceFamilies", "reviewReasons", "analysisFacets"]
    }
  };
}

function apifyPublicProofDto(
  query: string,
  queryClass: string,
  slug: string,
  rowCount: number,
  sourceFamilies: string[],
  freshness: "current" | "recent" | "stale" | "unknown",
  evidenceGrade: "corroborated" | "single_source" | "unverified"
) {
  const rowType = queryClass === "ransomware" ? "activity" : "profile";
  const hasPublicChannelCoverage = sourceFamilies.includes("public_channel");
  return {
    schemaVersion: "ti.public_proof_dto.v1",
    runId: `apify_sample_run_${slug}`,
    sourceRunId: "iMQGeezZ8bx7WtlhQ",
    sourceDatasetId: "5PLmkE30luBA5Lbgc",
    buildVersion: "0.6.4",
    datasetId: `apify_sample_dataset_${slug}`,
    query,
    queryClass,
    rowCount,
    freshness,
    sourceFamilies,
    safetyContract: "safe_metadata_only.v1",
    noLeakProof: {
      rawContentIncluded: false,
      credentialsIncluded: false,
      privateContentIncluded: false,
      actorInteraction: false,
      forbiddenFieldsAbsent: ["raw_body", "restricted_raw_url", "credential", "object_key", "leaked_row", "private_message", "payload_download"]
    },
    datasetSample: {
      query,
      rowType,
      actor: query,
      title: `${query} public intelligence profile`,
      summary: `${query} sample row using public metadata, source-family coverage, confidence, freshness, and provenance fields only.`,
      sourceType: sourceFamilies.includes("darknet_metadata") ? "darknet_metadata" : "clear_web",
      confidence: evidenceGrade === "corroborated" ? 0.72 : 0.58,
      generatedAt: "2026-06-20T12:00:00.000Z",
      collectionMode: "live_search",
      sourceCount: rowCount,
      sourceFamilyCount: sourceFamilies.length,
      sourceFamilies,
      missingSourceFamilies: hasPublicChannelCoverage ? [] : ["public_channel"],
      coverageStatus: sourceFamilies.length > 1 ? "sufficient" : "thin",
      collectionPriority: sourceFamilies.length > 1 ? "low" : "medium",
      recommendedCollectionAction: hasPublicChannelCoverage ? "none" : "add_public_channel_sources",
      coverageGapCodes: hasPublicChannelCoverage ? [] : ["missing_public_channel_evidence"],
      activityCount: Math.max(1, rowCount - 2),
      firstSeen: "2026-06-20T12:00:00.000Z",
      lastSeen: "2026-06-20T12:00:00.000Z",
      freshnessStatus: freshness,
      schedulerState: "attached",
      schedulerDecision: "reuse_active_run",
      nextPollSeconds: 3,
      retryAfterSeconds: 3,
      duplicateRunReuse: true,
      attachedToActiveRun: true,
      queuedTaskCount: 0,
      deferredBackgroundWorkloads: ["source_atlas_bulk_import", "darkweb_metadata_refresh"],
      schedulerBadges: ["polling_primary", "safe_metadata_only"],
      sourceCoverageState: sourceFamilies.length > 1 ? "sufficient" : "thin",
      sourceCoverageGapCount: hasPublicChannelCoverage ? 0 : 1,
      sourceCoverageGaps: hasPublicChannelCoverage ? [] : ["missing_public_channel_evidence"],
      pollingHint: "poll_again_for_freshness",
      paidRowDecision: evidenceGrade === "corroborated" && sourceFamilies.length > 1 ? "sellable" : "included_with_caveat",
      paidRowReason: evidenceGrade === "corroborated" && sourceFamilies.length > 1
        ? "Fresh or recent corroborated public evidence supports this sample enough for paid monitoring output."
        : "This sample is useful as a lead but needs corroboration or source-family diversity before promotion.",
      paidRowReasonCodes: evidenceGrade === "corroborated" && sourceFamilies.length > 1
        ? ["fresh_or_recent", "corroborated", "source_family_diverse", "actionable"]
        : ["single_source", "source_family_thin", "lead_only"],
      paidRowRemediationActions: evidenceGrade === "corroborated" && sourceFamilies.length > 1 ? [] : [
        {
          owner: "agent_01",
          action: "add_corroborating_clear_web_source",
          expectedEffect: "Increase source count and source-family diversity before sellable promotion."
        },
        {
          owner: "agent_03",
          action: "extract_specific_actor_victim_ttp_fields",
          expectedEffect: "Move generic leads toward sellable rows after parser repair."
        }
      ],
      buyerValueScore: evidenceGrade === "corroborated" && sourceFamilies.length > 1 ? 0.9 : 0.65,
      billingGuidance: evidenceGrade === "corroborated" && sourceFamilies.length > 1 ? "charge" : "include_as_context",
      evidenceGrade,
      isActionable: evidenceGrade === "corroborated",
      reviewReasons: [`freshness:${freshness}`, `evidence:${evidenceGrade}`, "safety:metadata_only"],
      analysisFacets: [`row:${rowType}`, `evidence:${evidenceGrade}`, `freshness:${freshness}`, "safety:metadata_only"],
      hasDarknetMetadata: sourceFamilies.includes("darknet_metadata"),
      hasPublicChannelCoverage,
      provenanceHash: `proof_hash_${slug}`,
      rawContentIncluded: false,
      safety: {
        metadataOnly: true,
        credentialsIncluded: false,
        stolenFilesIncluded: false,
        privateContentIncluded: false,
        actorInteraction: false
      },
      runId: `apify_sample_run_${slug}`,
      status: "partial",
      aliases: [query],
      warningCodes: hasPublicChannelCoverage ? [] : ["source_coverage_gap"]
    }
  };
}

function buildSourceAtlasFrontendContractDto() {
  return {
    schemaVersion: "ti.source_atlas_frontend_contract.v1",
    status: "frozen_dry_run_source_discovery_frontend_contract",
    owner: "Agent 09",
    route: "/ti/sources/atlas",
    publicRoute: "hanasand.com/ti/sources/atlas",
    apiRoutes: {
      atlas: "/v1/sources/atlas",
      export: "/v1/sources/atlas/export",
      contracts: "/v1/contracts",
      approvalQueue: "/v1/analyst/source-activation-packets"
    },
    sdkOpenapi: {
      operationIds: ["sources_post_v1_sources_atlas", "sources_post_v1_sources_atlas_export", "contracts_get_v1_contracts"],
      responseFields: ["endpoint", "schemaVersion", "dryRun", "willMutate", "willImportSourcePacks", "willStartCrawling", "summary", "records", "importPlans", "coverageMatrix", "activationCanary", "reviewQueue", "exportManifest", "approvalPacket", "rollbackPacket"],
      requestFields: ["queries", "recordLimit", "planLabel", "tenantId"],
      schemaRefs: ["SourceAtlasResponse", "SourceAtlasRecord", "SourceAtlasExportManifest", "SourceAtlasFrontendContract"]
    },
    table: {
      searchBox: {
        param: "queries",
        placeholderCopy: "Search source candidates",
        emptyDeltaCopy: "No new source candidates matched this view.",
        noResultCopy: "No safe public source candidates yet."
      },
      filters: ["queryClass", "family", "language", "region", "sector", "parserState", "legalRobotsState", "activationReadiness", "duplicateState", "recordLimit"],
      columns: ["id", "domain", "family", "queryClassCoverage", "sourceValueScore", "parserCapability", "legalRobotsState", "activationReadiness", "approvalRequired"],
      chips: {
        family: ["vendor_threat_blog", "cert_government", "cve_advisory", "ransomware_tracker", "public_research_feed", "github_security_advisory", "public_channel_descriptor"],
        parserState: ["certified", "supported", "certification_required", "unsupported_hold"],
        legalRobotsState: ["review_current", "review_stale", "robots_unknown", "legal_review_required"],
        activationReadiness: ["ready_for_dry_run", "needs_parser_certification", "needs_legal_review", "descriptor_only_hold", "duplicate_suppressed", "blocked_unsafe"],
        plan: ["first_100", "first_1000", "future_10k"]
      },
      sort: {
        default: "sourceValueScore:desc",
        allowed: ["sourceValueScore:desc", "freshness:desc", "evidenceYield:desc", "family:asc", "activationReadiness:asc"]
      }
    },
    safeDetailDrawer: {
      sections: ["sourceSummary", "coverage", "parserCapability", "legalRobots", "activationReadiness", "approvalPacket", "rollbackPacket", "canaryPlan", "whatWillNotHappen"],
      fields: ["id", "domain", "family", "queryClassCoverage", "languages", "regions", "sectors", "sourceValueScore", "reliability", "freshness", "evidenceYield", "parserCapability.certificationRequired", "legalRobotsState", "activationReadiness.state", "activationReadiness.autoActivationAllowed", "approvalRequired", "rollbackPacket.rollbackPlanId"],
      approvalActions: ["stage_for_review", "request_parser_certification", "request_legal_review", "suppress_duplicate", "export_manifest_dry_run"],
      nonActions: ["import source pack", "mutate registry", "enqueue crawl", "activate candidate", "fetch restricted target"]
    },
    importPlans: {
      labels: ["first_100", "first_1000", "future_10k"],
      planFields: ["label", "sourceCount", "sourceIds", "dryRun", "willMutate", "willImportSourcePacks", "willStartCrawling", "approvalPacket", "rollbackPacket"],
      canaryFields: ["first100SourceIds", "first1000SourceIds", "descriptorOnlySourceIds", "parserCertificationRequiredSourceIds", "dryRun", "willMutate", "willStartCrawling"],
      exportFields: ["reviewQueue", "exportManifest.rows", "approvalPacket", "rollbackPacket", "guardrails"],
      canaryRule: "first-100 and first-1000 are review/export plans only; collection starts only through a separate approved activation workflow"
    },
    copyRules: {
      dryRunBanner: "Dry run only. No sources are imported or crawled from this view.",
      approvalCopy: "Operator/legal approval is required before activation.",
      descriptorHoldCopy: "Descriptor-only sources require explicit review before they can become runnable.",
      duplicateCopy: "Duplicate or mirror candidates are suppressed until reviewed.",
      whatWillNotHappenLabel: "What will not happen",
      bannedPhrases: ["activate now", "crawl now", "imported automatically", "private invite source", "CAPTCHA bypass", "credentialed access"]
    },
    noLeak: {
      publicOnly: true,
      dryRunOnly: true,
      rawUnsafeUrlPublicOutputAllowed: false,
      forbiddenUiPayloadFields: ["rawRestrictedUrl", "privateInviteUrl", "credential", "password", "cookie", "authorization", "captcha_token", "raw_payload", "object_key", "download_url", "private_channel"],
      forbiddenOperations: ["source pack import", "registry mutation", "crawl enqueue", "silent activation", "private/invite/auth/CAPTCHA activation", "credentialed fetch", "payload download"],
      serializationRule: "frontend DTOs expose domains, hashes, coverage, parser/legal state, approval packets, rollback ids, and dry-run import plans only"
    },
    releaseGate: {
      decision: "contract_ready_implementation_pending_public_page",
      blockers: ["will_mutate_true", "will_start_crawling_true", "auto_activation_allowed", "approval_packet_missing", "rollback_packet_missing", "private_auth_captcha_source_detected", "raw_payload_field_detected"],
      proofCommands: ["bun run check:api-regression", "bun run check:contract-index", "bun run check:route-inventory", "bun test src/tests/api.test.ts src/tests/sourceSeeds.test.ts", "bun test", "bun run check"]
    },
    examples: {
      atlasRequest: { method: "POST", path: "/v1/sources/atlas", body: { queries: ["APT29", "CVE-2026-4242"], recordLimit: 100 } },
      exportRequest: { method: "POST", path: "/v1/sources/atlas/export", body: { queries: ["APT29"], planLabel: "first_100", recordLimit: 100 } },
      recordPreview: {
        id: "source_atlas_*",
        domain: "example-security-research.test",
        family: "vendor_threat_blog",
        queryClassCoverage: ["actor", "malware_tool"],
        sourceValueScore: 0.86,
        parserCapability: { certificationRequired: false },
        legalRobotsState: "review_current",
        activationReadiness: { state: "ready_for_dry_run", autoActivationAllowed: false },
        approvalRequired: true
      }
    },
    proofCommands: ["bun run check:api-regression", "bun run check:contract-index", "bun run check:route-inventory", "bun test src/tests/api.test.ts src/tests/sourceSeeds.test.ts", "bun test", "bun run check"]
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

function enterpriseAuthBoundaryContract() {
  return {
    schemaVersion: "ti.enterprise_auth_boundary.v1",
    mode: "trusted_gateway_forwarded_identity",
    enforcedHere: false,
    requiredForwardedHeaders: ["x-tenant-id", "x-actor-id"],
    optionalForwardedHeaders: ["x-request-id", "x-trace-id", "x-client-id", "x-service-token-context", "x-analyst-role", "x-source-approval-role"],
    serviceTokenContext: {
      header: "x-service-token-context",
      acceptedValues: ["gateway_validated_service", "scheduled_worker", "analyst_automation", "ci_contract_probe"],
      validationOwner: "cti_gateway",
      scraperStoresToken: false,
      auditField: "servicePrincipalId"
    },
    authzModel: {
      resolvedUpstream: true,
      scopes: [
        "intel:read",
        "intel:run",
        "sources:read",
        "sources:write",
        "evidence:read",
        "graph:read",
        "exports:write",
        "scraper:admin"
      ],
      adminOnlyRoutes: ["/v1/sources/*", "/v1/frontier/apply-plan", "/v1/public-channels/apply-plan", "/v1/restricted-metadata/*"],
      readRoutes: ["/v1/health", "/v1/metrics", "/v1/contracts", "/v1/intel/search", "/v1/intel/runs/{id}", "/v1/intel/runs/{id}/results"]
    },
    roleContracts: {
      analystRoles: ["analyst:reader", "analyst:reviewer", "analyst:exporter"],
      sourceApprovalRoles: ["source:approver", "source:publisher", "source:retirer"],
      readWriteSeparation: {
        readScopes: ["intel:read", "sources:read", "evidence:read", "graph:read"],
        writeScopes: ["intel:run", "sources:write", "exports:write", "scraper:admin"],
        rule: "gateway authorizes before scraper receives request; scraper contract labels mutation routes but does not evaluate bearer material"
      }
    },
    tenantContract: {
      header: "x-tenant-id",
      requiredForProduction: true,
      testFallback: "single-tenant when absent",
      isolationRule: "tenant scope is applied before pagination, DTO projection, evidence lookup, graph export, or source administration"
    },
    requesterContract: {
      header: "x-actor-id",
      requiredForProduction: true,
      auditOnlyHere: true,
      piiRule: "store requester ids or service principals only; do not store bearer tokens, cookies, authorization headers, or session material"
    },
    auditLogging: {
      requiredFields: ["tenantId", "requesterId", "requestId", "traceId", "servicePrincipalId", "route", "method", "decision", "occurredAt"],
      mutationDecisions: ["accepted", "dry_run", "operator_approval_required", "policy_blocked", "idempotency_conflict"],
      noSecretRule: "audit entries record principal identifiers and decisions only, never bearer tokens, cookies, authorization headers, passwords, or secret material"
    },
    secretHandling: {
      scraperDoesNotStoreSecrets: true,
      bearerTokensAcceptedHere: false,
      logRedaction: ["authorization", "cookie", "response-cookie", "x-api-key", "password", "token"]
    }
  };
}

function contractRedactedAlwaysFields(): string[] {
  return [
    "authorization",
    "cookie",
    "response-cookie",
    "password",
    "token",
    "object_key",
    "raw_body",
    "raw_url",
    "credential"
  ];
}

function enterpriseApiSurfaceContract(
  routes: Array<{ method: string; path: string; surface: string; owner: string; responseKeys: string[] }>,
  errorEnvelope: { error: { code: string; message: string; details: string } }
) {
  const authBoundary = enterpriseAuthBoundaryContract();
  const paginatedRoutes = routes
    .filter((route) => route.responseKeys.includes("nextCursor") || route.path.includes("/results") || route.path === "/v1/sources")
    .map((route) => `${route.method} ${route.path}`);
  const openapiPaths = Object.fromEntries(routes.map((route) => [
    route.path,
    {
      [route.method.toLowerCase()]: {
        operationId: `${route.surface}_${route.method.toLowerCase()}_${route.path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "")}`,
        tags: [route.surface],
        "x-owner": route.owner,
        "x-no-leak-dto": true,
        parameters: openApiParametersForRoute(route.path),
        responses: {
          "200": {
            description: "Compact safe response",
            "x-required-response-keys": route.responseKeys
          },
          default: {
            description: "Stable error envelope",
            "x-error-envelope": errorEnvelope
          }
        }
      }
    }
  ]));
  return {
    schemaVersion: "ti.enterprise_api_surface.v1",
    owner: "Agent 09",
    status: "contract_frozen_for_openapi_generation",
    authBoundary,
    identity: {
      tenantHeader: "x-tenant-id",
      requesterHeader: "x-actor-id",
      requestIdHeader: "x-request-id",
      traceHeader: "x-trace-id",
      propagationRule: "forward trusted identity headers from the CTI gateway; do not parse or persist credentials in scraper routes"
    },
    idempotency: {
      header: "idempotency-key",
      requiredOn: ["POST /v1/intel/runs"],
      recommendedOn: ["POST /v1/intel/plan", "POST /v1/exports/stix"],
      bodyHash: "canonical JSON request hash",
      conflictStatus: 409,
      conflictCode: "idempotency_conflict",
      retryRule: "same tenant, same key, same body returns the existing run; same key with different body fails closed"
    },
    pagination: {
      style: "cursor",
      requestFields: ["cursor", "limit"],
      responseFields: ["nextCursor"],
      maxLimit: 100,
      defaultLimit: 50,
      stableOrdering: "createdAt/id for persisted resources; cursor/delta order for live streams",
      paginatedRoutes
    },
    tenantBoundary: {
      schemaVersion: "ti.tenant_boundary.v1",
      appliedBefore: ["pagination", "evidence_lookup", "graph_export", "source_admin", "claim_ledger", "restricted_metadata_review", "capture_listing", "run_status"],
      fallbackMode: "single_tenant_dev_only",
      crossTenantFailureCode: "not_found",
      projectionRule: "filter by tenant before cursor construction, DTO projection, evidence lookup, graph export, source administration, claim ledger review, or restricted metadata review"
    },
    versioning: {
      schemaVersion: "ti.api_versioning_policy.v1",
      currentVersion: "v1",
      routePrefix: "/v1",
      compatibilityStatus: "additive_changes_only",
      versionHeader: "x-api-version",
      responseHeaders: ["x-api-version", "x-request-id"],
      deprecationHeaders: ["deprecation", "sunset", "link", "x-api-version", "x-request-id"],
      minimumDeprecationNoticeDays: 90,
      breakingChangeRequires: [
        "new major route prefix",
        "clientCompatibilityMatrix entry",
        "contract-index proof",
        "public-wrapper proof",
        "migration note"
      ],
      additiveAllowedWithoutNewMajor: [
        "optional response fields",
        "new warning codes",
        "new OpenAPI component schemas",
        "new examples",
        "new route metadata"
      ],
      removalBlockedFor: [
        "required response fields",
        "error envelope shape",
        "idempotency semantics",
        "cursor field names",
        "public wrapper stable fields",
        "tenant/requester header names"
      ],
      legacyAliases: [
        {
          route: "POST /api/ti/search",
          canonicalRoute: "GET /v1/intel/search",
          status: "compatibility_wrapper",
          removalPolicy: "no_sunset_until_public_wrapper_proof_and_client_matrix_are_green"
        }
      ],
      sunsetWorkflow: {
        states: ["active", "deprecated", "sunset_scheduled", "removed_in_next_major"],
        requiredAuditFields: ["route", "replacementRoute", "deprecatedAt", "sunsetAt", "clientImpact", "owner"],
        safeClientBehavior: "prefer canonical /v1 routes and preserve last safe answer when receiving deprecation or sunset headers"
      },
      examples: [
        {
          name: "deprecated_compatibility_wrapper",
          route: "POST /api/ti/search",
          headers: {
            deprecation: "true",
            sunset: "2026-09-01T00:00:00.000Z",
            link: "</v1/intel/search>; rel=\"successor-version\"",
            "x-api-version": "v1",
            "x-request-id": "req_compat_123"
          },
          body: { error: { code: "deprecated_route", message: "Use the canonical /v1 route.", details: { replacementRoute: "GET /v1/intel/search", requestId: "req_compat_123" } } }
        }
      ]
    },
    rateLimits: {
      model: "gateway_enforced_with_route_hints",
      responseHeaders: ["retry-after", "x-rate-limit-policy", "x-request-id"],
      defaultPolicy: { windowSeconds: 60, maxRequests: 120 },
      burstSensitiveRoutes: [
        { route: "GET /v1/intel/search", windowSeconds: 60, maxRequests: 60, retryAfterSeconds: 3 },
        { route: "POST /v1/intel/runs", windowSeconds: 60, maxRequests: 30, retryAfterSeconds: 5 },
        { route: "POST /v1/sources/*", windowSeconds: 60, maxRequests: 20, retryAfterSeconds: 30 }
      ],
      perRouteHints: [
        { route: "GET /v1/intel/search", policy: "live_search_read", windowSeconds: 60, maxRequests: 60, retryAfterSeconds: 3, queuePressureCode: "queue_pressure", safeClientBehavior: "preserve the current answer and poll again with cursor backoff" },
        { route: "POST /api/ti/search", policy: "public_wrapper_live_search", windowSeconds: 60, maxRequests: 90, retryAfterSeconds: 3, queuePressureCode: "queue_pressure", publicWrapperThrottle: true, safeClientBehavior: "preserve the last safe answer, show compact searching/partial state, and poll with backoff" },
        { route: "POST /v1/intel/runs", policy: "run_creation", windowSeconds: 60, maxRequests: 30, retryAfterSeconds: 5, queuePressureCode: "queue_pressure", safeClientBehavior: "reuse idempotent run when available or retry after the advertised delay" },
        { route: "GET /v1/intel/runs/{id}/results", policy: "result_pagination", windowSeconds: 60, maxRequests: 120, retryAfterSeconds: 2, queuePressureCode: "queue_pressure", safeClientBehavior: "keep the prior page and retry with the same cursor" },
        { route: "POST /v1/sources/apply-plan", policy: "source_admin_apply_plan", windowSeconds: 60, maxRequests: 20, retryAfterSeconds: 30, queuePressureCode: "queue_pressure", safeClientBehavior: "do not mutate source state until operator approval can be revalidated" },
        { route: "POST /v1/public-channels/apply-plan", policy: "public_channel_apply_plan", windowSeconds: 60, maxRequests: 20, retryAfterSeconds: 30, queuePressureCode: "queue_pressure", safeClientBehavior: "keep public-channel actions dry-run and retry after gateway backoff" },
        { route: "POST /v1/restricted-metadata/apply-plan", policy: "restricted_metadata_apply_plan", windowSeconds: 60, maxRequests: 12, retryAfterSeconds: 60, queuePressureCode: "policy_blocked", safeClientBehavior: "fail closed to metadata-only review and require human approval before retry" },
        { route: "POST /v1/exports/stix", policy: "graph_export", windowSeconds: 60, maxRequests: 20, retryAfterSeconds: 30, queuePressureCode: "queue_pressure", safeClientBehavior: "keep export held and retry after graph/evidence eligibility remains valid" }
      ],
      overloadCodes: ["queue_pressure", "provider_unavailable", "scraper_unavailable"]
    },
    auditFields: {
      requiredOnMutations: ["tenantId", "requesterId", "requestId", "idempotencyKey", "createdAt", "policyDecisionIds"],
      requiredOnEvidenceBearingResponses: ["sourceId", "captureId", "contentHash", "extractorVersion", "confidence", "ledgerIds"],
      redactedAlways: contractRedactedAlwaysFields()
    },
    errors: {
      envelope: errorEnvelope,
      codes: [
        "bad_request",
        "not_found",
        "idempotency_conflict",
        "invalid_action",
        "provider_unavailable",
        "scraper_unavailable",
        "queue_pressure",
        "no_approved_sources",
        "policy_blocked",
        "stale_evidence",
        "duplicate_run_reuse"
      ],
      retryableCodes: ["provider_unavailable", "scraper_unavailable", "queue_pressure", "stale_evidence"],
      failClosedCodes: ["policy_blocked", "no_approved_sources", "idempotency_conflict"],
      safeExamples: [
        {
          name: "queue_pressure",
          status: 429,
          headers: { "retry-after": "5", "x-rate-limit-policy": "live_search_queue", "x-request-id": "req_123" },
          body: { error: { code: "queue_pressure", message: "Queue pressure; retry later.", details: { retryAfterSeconds: 5, requestId: "req_123" } } }
        },
        {
          name: "policy_blocked",
          status: 403,
          headers: { "x-request-id": "req_456" },
          body: { error: { code: "policy_blocked", message: "Request is blocked by policy.", details: { reasonCode: "restricted_metadata_requires_review", requestId: "req_456" } } }
        },
        {
          name: "idempotency_conflict",
          status: 409,
          headers: { "x-request-id": "req_789" },
          body: { error: { code: "idempotency_conflict", message: "Idempotency key already maps to a different request.", details: { conflictField: "request_hash", requestId: "req_789" } } }
        }
      ]
    },
    openapi: {
      schemaVersion: "ti.openapi_ready_contract.v1",
      openapi: "3.1.0",
      info: { title: "TI Scraper API", version: "v1" },
      servers: [{ url: "/v1", description: "Scraper API mounted behind CTI gateway" }],
      securitySchemes: {
        trustedGateway: {
          type: "http",
          scheme: "bearer",
          description: "Validated upstream by CTI gateway; scraper receives trusted identity headers only."
        }
      },
      commonParameters: {
        tenantId: { name: "x-tenant-id", in: "header", required: true, schema: { type: "string" } },
        requesterId: { name: "x-actor-id", in: "header", required: true, schema: { type: "string" } },
        requestId: { name: "x-request-id", in: "header", required: false, schema: { type: "string" } },
        cursor: { name: "cursor", in: "query", required: false, schema: { type: "string" } },
        limit: { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } }
      },
      paths: openapiPaths,
      components: {
        schemas: {
          ErrorEnvelope: errorEnvelope,
          CursorPage: { type: "object", required: ["nextCursor"], properties: { nextCursor: { type: ["string", "null"] } } },
          IdempotentRunRequest: { type: "object", required: ["query"], properties: { query: { type: "string" }, entityType: { type: "string" }, tenantId: { type: "string" } } },
          PublicSearchResponse: { type: "object", required: ["status", "runId", "pollCursor", "deltaCursor", "updated"], properties: Object.fromEntries(publicWrapperDeltaStableFields().map((field) => [field, { type: ["string", "number", "array", "object", "boolean", "null"] }])) },
          PublicWrapperCutoverReadiness: {
            type: "object",
            required: ["schemaVersion", "status", "stableFieldAgreement", "fallbackWatch", "deprecationWatch", "proofCommands"],
            properties: {
              schemaVersion: { type: "string" },
              status: { type: "string" },
              stableFieldAgreement: { type: "object" },
              fallbackWatch: { type: "object" },
              deprecationWatch: { type: "object" },
              proofCommands: { type: "array", items: { type: "string" } }
            }
          },
          ApifyStoreReadiness: {
            type: "object",
            required: ["schemaVersion", "status", "actor", "storeReadiness", "defaultSampleInput", "publicProofDtos", "frontendApiCompatibility", "pricingHooks", "conversionTracking", "buyerFacingConversionProof", "sampleOutputSummaries", "marketplaceGuardrails", "proofCommands", "noLeakProof"],
            properties: {
              schemaVersion: { type: "string" },
              status: { type: "string" },
              actor: { type: "object" },
              storeReadiness: { type: "object" },
              defaultSampleInput: { type: "object" },
              sampleOutputDtos: { type: "array", items: { type: "object" } },
              publicProofDtos: { type: "array", items: { $ref: "#/components/schemas/PublicProofDto" } },
              frontendApiCompatibility: { type: "object" },
              pricingHooks: { type: "object" },
              conversionTracking: { type: "object" },
              buyerFacingConversionProof: { type: "object" },
              sampleOutputSummaries: { type: "array", items: { type: "object" } },
              marketplaceGuardrails: { type: "object" },
              proofCommands: { type: "array", items: { type: "string" } },
              noLeakProof: { type: "object" }
            }
          },
          PublicProofDto: {
            type: "object",
            required: ["schemaVersion", "runId", "buildVersion", "datasetId", "query", "rowCount", "freshness", "sourceFamilies", "safetyContract", "noLeakProof", "datasetSample"],
            properties: {
              schemaVersion: { type: "string" },
              runId: { type: "string" },
              buildVersion: { type: "string" },
              datasetId: { type: "string" },
              query: { type: "string" },
              queryClass: { type: "string" },
              rowCount: { type: "integer" },
              freshness: { type: "string" },
              sourceFamilies: { type: "array", items: { type: "string" } },
              safetyContract: { type: "string" },
              noLeakProof: { type: "object" },
              datasetSample: { type: "object" }
            }
          },
          RealtimeDeliveryPrototype: {
            type: "object",
            required: ["schemaVersion", "status", "featureFlags", "deliveryModes", "eventPrototypes", "fallbackToPolling"],
            properties: {
              schemaVersion: { type: "string" },
              status: { type: "string" },
              featureFlags: { type: "object" },
              deliveryModes: { type: "array", items: { type: "object" } },
              eventPrototypes: { type: "array", items: { $ref: "#/components/schemas/RealtimePrototypeEvent" } },
              fallbackToPolling: { type: "object" }
            }
          },
          RealtimePrototypeEvent: {
            type: "object",
            required: ["type", "source", "payloadFields", "pollingEquivalent", "enabled"],
            properties: {
              type: { type: "string" },
              source: { type: "string" },
              payloadFields: { type: "array", items: { type: "string" } },
              pollingEquivalent: { type: "string" },
              enabled: { type: "boolean" },
              noLeakRule: { type: "string" }
            }
          },
          ClientGenerationFreeze: {
            type: "object",
            required: ["schemaVersion", "status", "openapiManifest", "operationManifest", "schemaManifest", "generatedClients", "fixtureManifest", "changelogGate", "driftPolicy", "proofCommands"],
            properties: {
              schemaVersion: { type: "string" },
              status: { type: "string" },
              openapiManifest: { type: "object" },
              operationManifest: { type: "object" },
              schemaManifest: { type: "object" },
              generatedClients: { type: "array", items: { $ref: "#/components/schemas/GeneratedClientTarget" } },
              fixtureManifest: { type: "object" },
              changelogGate: { type: "object" },
              driftPolicy: { type: "object" },
              proofCommands: { type: "array", items: { type: "string" } }
            }
          },
          GeneratedClientTarget: {
            type: "object",
            required: ["target", "language", "status", "primaryRoutes", "requiredSchemas", "requiredFixtures"],
            properties: {
              target: { type: "string" },
              language: { type: "string" },
              status: { type: "string" },
              primaryRoutes: { type: "array", items: { type: "string" } },
              requiredSchemas: { type: "array", items: { type: "string" } },
              requiredFixtures: { type: "array", items: { type: "string" } },
              releaseGate: { type: "string" }
            }
          },
          SdkPollingEnvelope: {
            type: "object",
            required: ["runId", "status", "pollCursor", "deltaCursor", "refreshAfterSeconds", "updated"],
            properties: {
              runId: { type: "string" },
              status: { type: "string" },
              pollCursor: { type: "string" },
              deltaCursor: { type: "string" },
              refreshAfterSeconds: { type: "integer", minimum: 1 },
              changed: { type: "boolean" },
              warnings: { type: "array", items: { type: "string" } },
              updated: { type: "string", format: "date-time" }
            }
          },
          SdkSubscriptionRegistration: {
            type: "object",
            required: ["mode", "tenantId", "callbackRef", "eventTypes"],
            properties: {
              mode: { type: "string", enum: ["webhook", "sse"] },
              tenantId: { type: "string" },
              callbackRef: { type: "string" },
              eventTypes: { type: "array", items: { type: "string" } }
            }
          },
          StreamingEventEnvelope: {
            type: "object",
            required: ["eventId", "eventType", "runId", "tenantId", "pollCursor", "deltaCursor", "createdAt"],
            properties: {
              eventId: { type: "string" },
              eventType: { type: "string" },
              runId: { type: "string" },
              tenantId: { type: "string" },
              requesterId: { type: "string" },
              pollCursor: { type: "string" },
              deltaCursor: { type: "string" },
              sequence: { type: "integer", minimum: 0 },
              retryAfterSeconds: { type: "integer", minimum: 0 },
              warningCodes: { type: "array", items: { type: "string" } },
              createdAt: { type: "string", format: "date-time" }
            }
          },
          WebhookDeliveryAttempt: {
            type: "object",
            required: ["subscriptionId", "eventId", "attempt", "deliveryState", "nextRetryAt"],
            properties: {
              subscriptionId: { type: "string" },
              eventId: { type: "string" },
              attempt: { type: "integer", minimum: 1 },
              deliveryState: { type: "string", enum: ["queued", "delivered", "retry_scheduled", "disabled"] },
              nextRetryAt: { type: ["string", "null"], format: "date-time" },
              failureCode: { type: ["string", "null"] }
            }
          }
        }
      }
    },
    examples: [
      {
        name: "tenant_scoped_public_search",
        request: { method: "GET", path: "/v1/intel/search?q=APT29&entityType=actor", headers: { "x-tenant-id": "tenant_acme", "x-actor-id": "analyst_123", "x-request-id": "req_123" } },
        responseKeys: ["status", "runId", "pollCursor", "deltaCursor", "updated", "publicTiAnswer", "publicWrapperDelta"]
      },
      {
        name: "idempotent_run_create",
        request: { method: "POST", path: "/v1/intel/runs", headers: { "idempotency-key": "run-apt29-001", "x-tenant-id": "tenant_acme", "x-actor-id": "svc_cti" }, body: { query: "APT29", entityType: "actor" } },
        responseKeys: ["run"]
      },
      {
        name: "cursor_results_page",
        request: { method: "GET", path: "/v1/intel/runs/run_123/results?cursor=0&limit=50", headers: { "x-tenant-id": "tenant_acme", "x-actor-id": "analyst_123" } },
        responseKeys: ["run", "results"]
      }
    ],
    noLeakGuarantee: "OpenAPI examples and audit contracts use identifiers, hashes, ledger ids, and compact summaries only; never raw bodies, credentials, cookies, authorization headers, object keys, restricted raw URLs, or leaked rows."
  };
}

function realtimeDeliveryPrototypeContract(input: {
  enterpriseApiSurface: ReturnType<typeof enterpriseApiSurfaceContract>;
  sdkIntegration: ReturnType<typeof sdkIntegrationContract>;
  streamingWebhookCompatibility: ReturnType<typeof buildStreamingWebhookCompatibilityContract>;
  publicWrapperCutoverReadiness: ReturnType<typeof publicWrapperCutoverReadinessContract>;
}) {
  const eventPrototypes = [
    realtimePrototypeEvent("run.status", "Agent 02 scheduler", ["eventId", "runId", "tenantId", "requesterId", "status", "pollCursor", "deltaCursor", "retryAfterSeconds", "warningCodes"], "GET /v1/intel/runs/{id}"),
    realtimePrototypeEvent("answer.delta", "public /ti answer", ["eventId", "runId", "tenantId", "deltaCursor", "publicWrapperDelta", "changedSections", "confidence", "warningCodes"], "GET /v1/intel/search?deltaCursor=..."),
    realtimePrototypeEvent("evidence.promoted", "Agent 06 evidence", ["eventId", "runId", "tenantId", "evidenceIds", "ledgerIds", "captureHashes", "deltaCursor"], "GET /v1/intel/runs/{id}/results"),
    realtimePrototypeEvent("source.gap", "Agent 01/04 source coverage", ["eventId", "runId", "tenantId", "sourceFamily", "gapCode", "activationState", "retryAfterSeconds"], "GET /v1/intel/search.sourceCoverage"),
    realtimePrototypeEvent("graph.review_hold", "Agent 08 graph", ["eventId", "runId", "tenantId", "relationshipIds", "holdReason", "exportEligible", "deltaCursor"], "GET /v1/graph/query"),
    realtimePrototypeEvent("restricted_metadata.hold", "Agent 05 restricted metadata", ["eventId", "runId", "tenantId", "reviewTaskIds", "reasonCode", "policyDecisionIds", "deltaCursor"], "GET /v1/restricted-metadata/status"),
    realtimePrototypeEvent("quality.caveat", "Agent 07 quality", ["eventId", "runId", "tenantId", "caveatCode", "confidence", "reviewQueueIds", "deltaCursor"], "GET /v1/quality/evaluate"),
    realtimePrototypeEvent("error.retry_hint", "gateway/scheduler", ["eventId", "runId", "tenantId", "errorCode", "retryAfterSeconds", "requestId", "rateLimitPolicy"], "stable error envelope or partial response"),
    realtimePrototypeEvent("run.terminal", "run state", ["eventId", "runId", "tenantId", "status", "terminalState", "pollCursor", "deltaCursor", "warningCodes"], "GET /v1/intel/runs/{id}")
  ];
  return {
    schemaVersion: "ti.realtime_delivery_prototype.v1",
    owner: "Agent 09",
    status: "disabled_by_default_polling_primary",
    mode: "contract_first_prototype_no_mounted_delivery",
    featureFlags: {
      enabledByDefault: false,
      sseFlag: "TI_REALTIME_SSE_ENABLED=false",
      webhookFlag: "TI_REALTIME_WEBHOOKS_ENABLED=false",
      deliveryWritesFlag: "TI_REALTIME_DELIVERY_WRITES_ENABLED=false",
      routeMountFlag: "TI_REALTIME_ROUTES_ENABLED=false",
      productionDefault: "off_until_explicit_release_board_approval",
      canaryDefault: "off"
    },
    deliveryModes: [
      {
        mode: "sse",
        prototypeRoute: input.sdkIntegration.routes.futureSse,
        mounted: false,
        enabled: false,
        resumeWith: ["Last-Event-ID", "deltaCursor"],
        failureFallback: "client continues 3-second polling from pollCursor or deltaCursor"
      },
      {
        mode: "webhook",
        prototypeRoute: input.sdkIntegration.routes.futureWebhookRegistration,
        mounted: false,
        enabled: false,
        registrationDryRunOnly: true,
        idempotencyKeyRequired: true,
        failureFallback: "subscription failure never blocks polling; client resumes from last delivered deltaCursor"
      }
    ],
    eventEnvelope: {
      schemaVersion: "ti.realtime_event_envelope.v1",
      requiredFields: ["eventId", "eventType", "runId", "tenantId", "pollCursor", "deltaCursor", "sequence", "createdAt"],
      optionalSafeFields: ["requesterId", "requestId", "warningCodes", "retryAfterSeconds", "sourceIds", "captureHashes", "evidenceIds", "ledgerIds", "relationshipIds", "policyDecisionIds", "confidence", "summary"],
      ordering: "monotonic sequence per run; clients dedupe by eventId and ignore stale sequence numbers",
      replayWindowSeconds: 900,
      cursorGapBehavior: "return stable stale_evidence or queue_pressure error envelope and require polling fallback"
    },
    eventPrototypes,
    authAndIdentity: {
      requiredForwardedHeaders: input.enterpriseApiSurface.authBoundary.requiredForwardedHeaders,
      optionalForwardedHeaders: input.enterpriseApiSurface.authBoundary.optionalForwardedHeaders,
      tenantHeader: input.enterpriseApiSurface.identity.tenantHeader,
      requesterHeader: input.enterpriseApiSurface.identity.requesterHeader,
      requestIdHeader: input.enterpriseApiSurface.identity.requestIdHeader,
      noSecretForwardingRule: input.enterpriseApiSurface.authBoundary.auditLogging.noSecretRule
    },
    idempotencyAndReplay: {
      runCreationHeader: input.enterpriseApiSurface.idempotency.header,
      webhookRegistrationHeader: input.enterpriseApiSurface.idempotency.header,
      replayCursors: ["Last-Event-ID", "pollCursor", "deltaCursor"],
      duplicateRule: "event delivery must never create or duplicate search runs; duplicate registration keys return the existing subscription draft",
      conflictCode: input.enterpriseApiSurface.idempotency.conflictCode
    },
    fallbackToPolling: {
      pollingPrimary: true,
      intervalSeconds: input.sdkIntegration.polling.intervalSeconds,
      sameFields: input.streamingWebhookCompatibility.pollingCompatibility.sameFields,
      sameStates: input.streamingWebhookCompatibility.pollingCompatibility.sameStates,
      retryHeaders: input.enterpriseApiSurface.rateLimits.responseHeaders,
      clientBehavior: "when realtime is disabled, unavailable, missing events, or cursor replay gaps, clients keep polling with the same runId, pollCursor, deltaCursor, status, warning codes, and retry hints"
    },
    publicWrapperGuardrails: {
      noDefaultActor: true,
      noDemoOrStaleCacheCopy: true,
      unknownQueryCopy: input.publicWrapperCutoverReadiness.fallbackWatch.requiredCopyForNoResult,
      stableRunIds: true,
      stableCursors: ["pollCursor", "deltaCursor", "nextCursor"],
      bannedFallbackCodes: input.publicWrapperCutoverReadiness.fallbackWatch.bannedFallbackCodes
    },
    errorSemantics: {
      envelope: input.enterpriseApiSurface.errors.envelope,
      retryableCodes: input.enterpriseApiSurface.errors.retryableCodes,
      failClosedCodes: input.enterpriseApiSurface.errors.failClosedCodes,
      realtimeSpecificCodes: ["stream_disabled", "webhook_disabled", "replay_cursor_gap", "delivery_retry_scheduled", "subscription_policy_blocked"],
      fallbackRule: "realtime errors are additive hints; polling response shape and public wrapper state remain stable"
    },
    handoffs: {
      agent02Scheduler: ["run.status", "error.retry_hint", "retryAfterSeconds", "queue pressure"],
      agent06Evidence: ["evidence.promoted", "evidenceIds", "ledgerIds", "captureHashes"],
      agent07Quality: ["quality.caveat", "confidence", "reviewQueueIds", "unknown Searching guardrail"],
      agent08Graph: ["graph.review_hold", "relationshipIds", "exportEligible"],
      agent10Release: ["feature flags remain off", "release board approval required", "rollback to polling only"]
    },
    noLeak: {
      guarantee: "prototype events contain ids, cursors, hashes, reason codes, confidence, and compact summaries only",
      forbiddenPayloadFields: ["raw_body", "raw_text", "html", "screenshot_bytes", "restricted_raw_url", "unsafe_raw_url", "credential", "authorization", "cookie", "object_reference", "object_key", "leaked_row", "webhook_secret", "private_channel_material"]
    },
    proofCommands: ["bun run check", "bun run check:api-regression", "bun run check:sdk-fixtures", "bun run check:route-inventory", "bun run check:contract-index", "bun test src/tests/apiRegressionSentinel.test.ts src/tests/api.test.ts"]
  };
}

function realtimePrototypeEvent(type: string, source: string, payloadFields: string[], pollingEquivalent: string) {
  return {
    type,
    source,
    enabled: false,
    payloadFields,
    pollingEquivalent,
    noLeakRule: "ids, cursors, hashes, reason codes, confidence, warning codes, and compact summaries only"
  };
}

function buildRealtimeDeliverySoakContractLegacy(input: {
  enterpriseApiSurface: ReturnType<typeof enterpriseApiSurfaceContract>;
  sdkIntegration: ReturnType<typeof sdkIntegrationContract>;
  streamingWebhookCompatibility: ReturnType<typeof buildStreamingWebhookCompatibilityContract>;
  realtimeDeliveryPrototype: ReturnType<typeof realtimeDeliveryPrototypeContract>;
  publicWrapperCutoverReadiness: ReturnType<typeof publicWrapperCutoverReadinessContract>;
}) {
  const disabledFlagRules = [
    input.realtimeDeliveryPrototype.featureFlags.sseFlag,
    input.realtimeDeliveryPrototype.featureFlags.webhookFlag,
    input.realtimeDeliveryPrototype.featureFlags.deliveryWritesFlag,
    input.realtimeDeliveryPrototype.featureFlags.routeMountFlag
  ];
  const soakScenarios = [
    realtimeSoakScenario("disabled_sse_replay", "sse", "hold", "Last-Event-ID replay request returns disabled hint and client continues polling", ["eventId", "runId", "pollCursor", "deltaCursor"]),
    realtimeSoakScenario("disabled_webhook_registration", "webhook", "hold", "registration remains dry-run only and cannot create a live subscription", ["subscriptionId", "eventTypes", "deliveryState"]),
    realtimeSoakScenario("webhook_outbox_retry", "webhook", "watch", "retry schedule is bounded and never blocks public polling", ["attemptId", "subscriptionId", "retryAfterSeconds", "deliveryState"]),
    realtimeSoakScenario("cursor_gap_replay", "sse", "hold", "cursor gaps fail closed with polling fallback from the latest safe cursor", ["runId", "pollCursor", "deltaCursor", "warningCodes"]),
    realtimeSoakScenario("fallback_to_polling", "polling", "promote", "polling remains primary and preserves the public wrapper response shape", input.sdkIntegration.polling.responseFields),
    realtimeSoakScenario("duplicate_event_dedupe", "sse", "watch", "clients dedupe by eventId and ignore stale sequence numbers", ["eventId", "sequence", "runId", "deltaCursor"]),
    realtimeSoakScenario("held_state_event", "sse", "hold", "restricted metadata, graph, and claim-ledger holds stay non-promoted", ["eventType", "reasonCode", "relationshipIds", "ledgerIds"]),
    realtimeSoakScenario("unsafe_payload_block", "webhook", "hold", "unsafe payload fields fail the soak and trigger polling-only rollback", ["eventId", "runId", "warningCodes"]),
    realtimeSoakScenario("public_wrapper_empty_delta", "polling", "promote", "empty deltas preserve the last safe answer and do not clear holds", ["runId", "pollCursor", "deltaCursor", "publicTiAnswer"])
  ];

  return {
    schemaVersion: "ti.realtime_delivery_soak.v1",
    owner: "Agent 09",
    status: "disabled_soak_contract_ready_polling_primary",
    mode: "disabled_delivery_soak_no_mounted_realtime_routes",
    deliveryFlags: {
      enabledByDefault: false,
      requiredDisabledFlags: disabledFlagRules,
      releaseRule: "SSE and webhook routes remain unmounted until a future release board explicitly promotes them",
      canaryRule: "soak can model delivery behavior from fixtures only; it must not write subscriptions or dispatch events"
    },
    soakScenarios,
    webhookOutbox: {
      schemaVersion: "ti.webhook_outbox_soak.v1",
      enabled: false,
      dryRunOnly: true,
      states: ["draft", "scheduled", "retry_scheduled", "dead_lettered", "disabled"],
      maxAttempts: input.streamingWebhookCompatibility.webhooks.failureBehavior.maxAttempts,
      retryableStatuses: input.streamingWebhookCompatibility.webhooks.failureBehavior.retryableStatuses,
      idempotencyHeader: input.enterpriseApiSurface.idempotency.header,
      fallback: "after any failure, clients continue 3-second polling from pollCursor or deltaCursor",
      nonActions: ["do not deliver callbacks", "do not store webhook secrets", "do not block public polling", "do not activate sources"]
    },
    cursorGapReplay: {
      schemaVersion: "ti.realtime_cursor_gap_replay.v1",
      replayCursors: input.realtimeDeliveryPrototype.idempotencyAndReplay.replayCursors,
      replayWindowSeconds: input.realtimeDeliveryPrototype.eventEnvelope.replayWindowSeconds,
      actions: ["return stable warning", "preserve runId", "preserve pollCursor", "preserve deltaCursor", "fallback_to_polling"],
      errorCodes: ["replay_cursor_gap", "stream_disabled", "webhook_disabled"],
      clientRule: input.realtimeDeliveryPrototype.fallbackToPolling.clientBehavior
    },
    pollingFallback: {
      pollingPrimary: true,
      intervalSeconds: input.sdkIntegration.polling.intervalSeconds,
      sameFields: input.realtimeDeliveryPrototype.fallbackToPolling.sameFields,
      sameStates: input.realtimeDeliveryPrototype.fallbackToPolling.sameStates,
      keepLastSafeAnswerOn: ["stream_disabled", "webhook_disabled", "replay_cursor_gap", "delivery_retry_scheduled", "queue_pressure", "empty_delta"],
      publicWrapperRoute: input.publicWrapperCutoverReadiness.stableFieldAgreement.publicWrapperRoute,
      scraperNativeRoute: input.publicWrapperCutoverReadiness.stableFieldAgreement.scraperNativeRoute
    },
    eventEnvelopeSoak: {
      schemaVersion: input.realtimeDeliveryPrototype.eventEnvelope.schemaVersion,
      requiredFields: input.realtimeDeliveryPrototype.eventEnvelope.requiredFields,
      optionalSafeFields: input.realtimeDeliveryPrototype.eventEnvelope.optionalSafeFields,
      eventTypes: input.realtimeDeliveryPrototype.eventPrototypes.map((event) => event.type),
      ordering: input.realtimeDeliveryPrototype.eventEnvelope.ordering,
      dedupe: "eventId plus runId; stale sequence numbers are ignored",
      noPromotionRule: "events may announce holds or deltas, but public fact promotion still comes from polling-visible publicTiAnswer and review gates"
    },
    noLeak: {
      forbiddenPayloadFields: input.realtimeDeliveryPrototype.noLeak.forbiddenPayloadFields,
      rule: "soak fixtures and outbox rows contain ids, cursors, hashes, warning codes, retry hints, and compact summaries only",
      rollbackOn: ["raw_body", "restricted_raw_url", "credential", "object_key", "leaked_row", "webhook_secret", "private_channel_material"]
    },
    releaseGate: {
      decision: "hold_realtime_polling_primary",
      promotionBlockers: [
        "feature_flag_enabled_by_default",
        "mounted_realtime_route_detected",
        "outbox_write_detected",
        "cursor_gap_without_polling_fallback",
        "unsafe_payload_field_detected",
        "public_wrapper_field_drift",
        "unknown_ready_without_evidence"
      ],
      rollbackActions: [
        "disable realtime flags",
        "drop delivery attempts",
        "continue public polling",
        "hold SDK realtime publish",
        "preserve public POST compatibility wrapper"
      ]
    },
    handoffs: {
      agent02Scheduler: ["retry hints", "queue pressure", "run status events"],
      agent06Evidence: ["evidence promoted ids", "claim ledger ids", "no raw event payloads"],
      agent07Quality: ["quality caveats", "unknown Searching guardrail", "held state wording"],
      agent08Graph: ["graph review holds", "relationship ids", "STIX export holds"],
      agent10Release: ["realtime remains hold", "polling-only rollback", "soak proof packet"]
    },
    proofCommands: [
      "bun run check",
      "bun run check:api-regression",
      "bun run check:sdk-fixtures",
      "bun run check:route-inventory",
      "bun run check:contract-index",
      "bun test src/tests/apiRegressionSentinel.test.ts src/tests/api.test.ts src/tests/sdkFixtures.test.ts",
      "bun test"
    ]
  };
}

function realtimeSoakScenario(
  name: string,
  mode: "sse" | "webhook" | "polling",
  decision: "promote" | "watch" | "hold",
  expectedBehavior: string,
  requiredFields: string[]
) {
  return {
    name,
    mode,
    decision,
    expectedBehavior,
    requiredFields,
    realtimeEnabled: false,
    mountedRouteAllowed: false,
    pollingFallbackRequired: true,
    noUnsafePayload: true
  };
}

function sdkIntegrationContract(enterpriseApiSurface: ReturnType<typeof enterpriseApiSurfaceContract>) {
  return {
    schemaVersion: "ti.sdk_integration_contract.v1",
    owner: "Agent 09",
    status: "contract_only_no_push_delivery",
    routes: {
      initialSearch: "GET /v1/intel/search",
      publicWrapperSearch: "POST /api/ti/search",
      runStatus: "GET /v1/intel/runs/{id}",
      runResults: "GET /v1/intel/runs/{id}/results",
      futureSse: "GET /v1/events/search-stream",
      futureWebhookRegistration: "POST /v1/webhooks/subscriptions"
    },
    polling: {
      intervalSeconds: 3,
      requestFields: ["q", "query", "entityType", "cursor", "deltaCursor", "runId"],
      responseFields: ["runId", "status", "pollCursor", "deltaCursor", "nextCursor", "refreshAfterSeconds", "nextPollSeconds", "updated", "publicTiAnswer", "publicWrapperDelta"],
      terminalStates: ["ready", "blocked"],
      retryableStates: ["searching", "queued", "partial", "metadata_review", "provider_unavailable", "scraper_unavailable", "queue_pressure", "stale"],
      emptyDelta: {
        status: "waiting_for_deltas",
        changed: false,
        requiredFields: ["runId", "pollCursor", "deltaCursor", "refreshAfterSeconds", "updated"],
        clientBehavior: "keep the visible answer, schedule the next poll from refreshAfterSeconds, and do not clear evidence sections"
      },
      duplicateRunReuse: {
        warningCode: "duplicate_run_reuse",
        requiredFields: ["runId", "idempotencyKey", "pollCursor", "deltaCursor"],
        clientBehavior: "attach the caller to the existing run and continue from the returned cursors"
      },
      degradedModes: {
        provider_unavailable: { retryAfterSeconds: 30, preserveLastGoodAnswer: true },
        scraper_unavailable: { retryAfterSeconds: 30, preserveLastGoodAnswer: true },
        queue_pressure: { retryAfterSeconds: 5, preserveLastGoodAnswer: true },
        policy_blocked: { retryAfterSeconds: 0, preserveLastGoodAnswer: false }
      }
    },
    backoff: {
      preferHeaders: ["retry-after", "x-rate-limit-policy", "x-request-id"],
      fallbackSeconds: 3,
      maxClientPollSeconds: 30,
      jitter: "client may add 0-500ms jitter; never poll faster than refreshAfterSeconds"
    },
    eventBoundary: {
      delivery: "future_contract_only",
      allowedModes: ["sse", "webhook"],
      eventTypes: ["run.created", "run.updated", "delta.available", "evidence.promoted", "source.gap", "graph.review_hold", "restricted_metadata.hold", "run.ready", "run.blocked", "review.required", "error.retry_hint"],
      payloadRule: "send identifiers, cursors, warning codes, source/capture hashes, confidence, and compact summaries only",
      forbiddenPayloadFields: ["raw_body", "restricted_raw_url", "credential", "authorization", "cookie", "object_reference", "leaked_row"],
      replayRule: "clients resume with lastEventId or deltaCursor; server must fail closed on cursor gaps"
    },
    examples: [
      {
        name: "browser_poll_loop",
        client: "browser",
        steps: [
          "POST /api/ti/search with q",
          "render returned publicTiAnswer immediately",
          "poll with returned pollCursor or deltaCursor every refreshAfterSeconds",
          "merge changed publicWrapperDelta sections without clearing unchanged evidence"
        ],
        responseKeys: ["runId", "status", "pollCursor", "deltaCursor", "refreshAfterSeconds", "publicTiAnswer", "publicWrapperDelta"]
      },
      {
        name: "backend_service_poll_loop",
        client: "backend_service",
        steps: [
          "POST /v1/intel/runs with idempotency-key",
          "GET /v1/intel/runs/{id} until status is terminal or review-held",
          "GET /v1/intel/runs/{id}/results with cursor and limit for persisted pages"
        ],
        responseKeys: ["run", "frontier", "results", "nextCursor"]
      },
      {
        name: "analyst_automation_review_hold",
        client: "analyst_automation",
        steps: [
          "poll /v1/intel/search until warningCodes includes metadata_review or review_required",
          "fetch /v1/analyst/metadata-review-tasks for safe metadata",
          "record dry-run action only through the review action route"
        ],
        responseKeys: ["warningCodes", "reviewGates", "tasks", "claimLedger"]
      },
      {
        name: "future_webhook_registration",
        client: "backend_service",
        request: {
          method: "POST",
          path: "/v1/webhooks/subscriptions",
          body: { mode: "webhook", eventTypes: ["delta.available", "run.ready"], callbackRef: "cti-gateway-webhook-ref" }
        },
        responseKeys: ["subscriptionId", "eventTypes", "deliveryState"]
      }
    ],
    fixturePack: {
      schemaVersion: "ti.sdk_fixture_pack.v1",
      status: "contract_frozen_for_client_ci",
      fixtureNames: [
        "initial_public_search",
        "repeated_poll_empty_delta",
        "new_delta_available",
        "queue_pressure_retry",
        "policy_blocked_fail_closed",
        "idempotent_run_reuse",
        "cursor_results_page",
        "metadata_review_required",
        "future_event_delta_available"
      ],
      requiredFiles: [
        "fixtures/sdk/initial_public_search.json",
        "fixtures/sdk/repeated_poll_empty_delta.json",
        "fixtures/sdk/new_delta_available.json",
        "fixtures/sdk/queue_pressure_retry.json",
        "fixtures/sdk/policy_blocked_fail_closed.json",
        "fixtures/sdk/idempotent_run_reuse.json",
        "fixtures/sdk/cursor_results_page.json",
        "fixtures/sdk/metadata_review_required.json",
        "fixtures/sdk/future_event_delta_available.json"
      ],
      invariantFields: ["runId", "status", "pollCursor", "deltaCursor", "refreshAfterSeconds", "updated", "warningCodes"],
      noLeakAssertions: ["no raw_body", "no restricted_raw_url", "no credential", "no authorization", "no cookie", "no object_reference", "no leaked_row"],
      generationRule: "fixtures are derived from /v1/contracts and public wrapper examples; generated clients must not depend on internal store rows or adapter payloads"
    },
    compatibilityCi: {
      schemaVersion: "ti.sdk_compatibility_ci.v1",
      status: "contract_only_required_before_sdk_release",
      requiredCommands: [
        "bun run check:contract-index",
        "bun run check:route-inventory",
        "bun run check:sdk-fixtures",
        "bun test src/tests/api.test.ts",
        "bun test",
        "TI_SEARCH_READINESS_QUERY=APT29 bun run check:scraper-native-search",
        "TI_SEARCH_READINESS_QUERY='Random Actor' bun run check:scraper-native-search",
        "TI_SEARCH_READINESS_QUERY='Made Up Actor' bun run check:scraper-native-search"
      ],
      gates: [
        { name: "openapi_schema_available", proof: "components include SdkPollingEnvelope and SdkSubscriptionRegistration", failureAction: "block SDK generation" },
        { name: "polling_contract_stable", proof: "pollCursor, deltaCursor, nextCursor, refreshAfterSeconds, and updated remain stable", failureAction: "block SDK release" },
        { name: "error_envelope_stable", proof: "safe error examples use shared ErrorEnvelope shape", failureAction: "block SDK release" },
        { name: "public_wrapper_compatible", proof: "POST /api/ti/search returns run id, cursors, and live state", failureAction: "preserve compatibility wrapper" },
        { name: "no_leak_fixtures", proof: "fixture JSON omits raw bodies, restricted URLs, credentials, object references, and leaked rows", failureAction: "fail CI and regenerate fixtures" }
      ],
      clientMatrix: ["typescript_fetch", "node_service", "browser_ti", "analyst_automation"],
      artifactRule: "publish generated clients only after contract-index, route inventory, focused API tests, full Bun tests, and public proof commands pass"
    },
    openapi: {
      schemaVersion: "ti.sdk_openapi_extension.v1",
      components: ["SdkPollingEnvelope", "SdkSubscriptionRegistration"],
      xSdkPollingContract: {
        intervalSeconds: 3,
        cursorFields: ["pollCursor", "deltaCursor", "nextCursor"],
        retryHeaders: enterpriseApiSurface.rateLimits.responseHeaders
      }
    },
    noLeakGuarantee: "SDK examples and event payload contracts contain only safe DTO fields and never push raw bodies, credentials, cookies, authorization headers, object references, restricted raw URLs, or leaked rows."
  };
}

function buildStreamingWebhookCompatibilityContract(
  enterpriseApiSurface: ReturnType<typeof enterpriseApiSurfaceContract>,
  sdkIntegration: ReturnType<typeof sdkIntegrationContract>
) {
  const eventTypes = [
    {
      type: "run.status",
      source: "Agent 02 scheduler",
      payloadFields: ["eventId", "runId", "status", "pollCursor", "deltaCursor", "retryAfterSeconds", "warningCodes"],
      pollingEquivalent: "GET /v1/intel/runs/{id}",
      noLeakRule: "status and scheduler warnings only"
    },
    {
      type: "answer.delta",
      source: "public /ti answer",
      payloadFields: ["eventId", "runId", "deltaCursor", "publicWrapperDelta", "changedSections", "confidence", "warningCodes"],
      pollingEquivalent: "GET /v1/intel/search?deltaCursor=...",
      noLeakRule: "compact public answer deltas only"
    },
    {
      type: "evidence.promoted",
      source: "Agent 06 evidence",
      payloadFields: ["eventId", "runId", "evidenceIds", "ledgerIds", "captureHashes", "confidence", "deltaCursor"],
      pollingEquivalent: "GET /v1/intel/runs/{id}/results",
      noLeakRule: "ids and hashes only; no raw bodies or object references"
    },
    {
      type: "source.gap",
      source: "Agent 01/04 source coverage",
      payloadFields: ["eventId", "runId", "sourceFamily", "gapCode", "activationState", "retryAfterSeconds"],
      pollingEquivalent: "GET /v1/intel/search.sourceCoverage",
      noLeakRule: "source family and reason codes only"
    },
    {
      type: "graph.review_hold",
      source: "Agent 08 graph",
      payloadFields: ["eventId", "runId", "relationshipIds", "holdReason", "exportEligible", "deltaCursor"],
      pollingEquivalent: "GET /v1/graph/query",
      noLeakRule: "bounded graph ids and hold reasons only"
    },
    {
      type: "restricted_metadata.hold",
      source: "Agent 05 restricted metadata",
      payloadFields: ["eventId", "runId", "reviewTaskIds", "reasonCode", "policyDecisionIds", "deltaCursor"],
      pollingEquivalent: "GET /v1/restricted-metadata/status",
      noLeakRule: "metadata review ids and reason codes only"
    },
    {
      type: "error.retry_hint",
      source: "gateway/scheduler",
      payloadFields: ["eventId", "runId", "errorCode", "retryAfterSeconds", "requestId", "rateLimitPolicy"],
      pollingEquivalent: "stable error envelope or partial response",
      noLeakRule: "error codes and retry hints only"
    },
    {
      type: "run.terminal",
      source: "run state",
      payloadFields: ["eventId", "runId", "status", "terminalState", "pollCursor", "deltaCursor", "warningCodes"],
      pollingEquivalent: "GET /v1/intel/runs/{id}",
      noLeakRule: "terminal state and compact warnings only"
    }
  ];
  return {
    schemaVersion: "ti.streaming_webhook_compatibility.v1",
    owner: "Agent 09",
    status: "contract_only_polling_remains_primary",
    mode: "additive_future_delivery_contract",
    deliveryModes: [
      {
        mode: "sse",
        route: sdkIntegration.routes.futureSse,
        status: "future_not_mounted",
        reconnect: {
          resumeWith: ["Last-Event-ID", "deltaCursor"],
          replayAfterHeader: "retry-after",
          cursorGapBehavior: "return stable error envelope with stale_evidence or queue_pressure and require polling fallback"
        }
      },
      {
        mode: "webhook",
        route: sdkIntegration.routes.futureWebhookRegistration,
        status: "future_not_mounted",
        registrationFields: ["tenantId", "eventTypes", "callbackRef", "secretRef", "rateLimitPolicy"],
        deliveryHeaders: ["x-tenant-id", "x-request-id", "x-ti-event-id", "x-ti-event-type", "x-ti-signature-ref"],
        failureState: "retry_scheduled | disabled | polling_fallback_required"
      }
    ],
    pollingCompatibility: {
      pollingPrimary: true,
      intervalSeconds: sdkIntegration.polling.intervalSeconds,
      sameFields: ["runId", "status", "pollCursor", "deltaCursor", "nextCursor", "refreshAfterSeconds", "updated", "warningCodes"],
      sameStates: [...sdkIntegration.polling.retryableStates, ...sdkIntegration.polling.terminalStates],
      migrationRule: "SSE/webhook clients must be able to drop back to 3-second polling with the same runId, pollCursor, deltaCursor, status, retry headers, and warning codes; polling clients are never required to subscribe.",
      emptyDeltaRule: sdkIntegration.polling.emptyDelta.clientBehavior,
      idempotencyRule: "run creation remains idempotent through idempotency-key; event subscription does not create or duplicate search runs"
    },
    eventEnvelope: {
      schemaVersion: "ti.streaming_event_envelope.v1",
      requiredFields: ["eventId", "eventType", "runId", "tenantId", "pollCursor", "deltaCursor", "sequence", "createdAt"],
      optionalSafeFields: ["requesterId", "warningCodes", "retryAfterSeconds", "sourceIds", "captureHashes", "evidenceIds", "ledgerIds", "relationshipIds", "policyDecisionIds", "confidence", "summary"],
      ordering: "monotonic sequence per run; clients dedupe by eventId and ignore stale sequence numbers",
      retentionWindow: { defaultSeconds: 900, maxSeconds: 3600, cursorReplayFallback: true }
    },
    eventTypes,
    authAndGateway: {
      requiredForwardedHeaders: enterpriseApiSurface.authBoundary.requiredForwardedHeaders,
      optionalForwardedHeaders: enterpriseApiSurface.authBoundary.optionalForwardedHeaders,
      tenantPropagation: enterpriseApiSurface.tenantBoundary.projectionRule,
      requesterPropagation: "requester id is carried as x-actor-id and never as credentials",
      rateLimitHeaders: enterpriseApiSurface.rateLimits.responseHeaders,
      gatewayOwnsSignatureVerification: true,
      noSecretForwardingRule: "gateway may keep webhook signing material by reference only; scraper DTOs expose secretRef/signatureRef labels, never secrets"
    },
    webhooks: {
      subscriptionSchema: "SdkSubscriptionRegistration",
      deliveryAttemptSchema: "WebhookDeliveryAttempt",
      failureBehavior: {
        retryableStatuses: [408, 409, 425, 429, 500, 502, 503, 504],
        maxAttempts: 6,
        backoff: "respect retry-after when present, otherwise exponential backoff capped at 15 minutes",
        disableAfter: "six consecutive delivery failures or policy_blocked",
        fallback: "client resumes polling from last delivered deltaCursor or requested replay cursor"
      },
      auditFields: ["subscriptionId", "eventId", "tenantId", "requestId", "attempt", "deliveryState", "nextRetryAt", "failureCode"],
      nonActions: ["do not inline webhook secrets", "do not send raw evidence", "do not fan out cross-tenant events", "do not activate sources from delivery failure"]
    },
    integrations: {
      agent02Scheduler: ["run.status", "error.retry_hint"],
      agent06Evidence: ["evidence.promoted"],
      agent07Quality: ["answer.delta", "error.retry_hint"],
      agent08Graph: ["graph.review_hold"],
      agent10Incidents: ["webhook.delivery_failed", "stream.replay_gap", "polling_fallback_required"]
    },
    examples: [
      {
        name: "sse_answer_delta",
        event: { eventType: "answer.delta", runId: "run_apt29", pollCursor: "poll_10", deltaCursor: "delta_10", warningCodes: ["partial"], changedSections: ["summary", "sources"] }
      },
      {
        name: "webhook_retry_hint",
        event: { eventType: "error.retry_hint", runId: "run_random_actor", errorCode: "queue_pressure", retryAfterSeconds: 5, requestId: "req_123" }
      },
      {
        name: "restricted_metadata_hold",
        event: { eventType: "restricted_metadata.hold", runId: "run_case", reviewTaskIds: ["review_123"], reasonCode: "metadata_review_required", policyDecisionIds: ["policy_123"] }
      }
    ],
    noLeak: {
      guarantee: "streaming and webhook contracts carry identifiers, cursors, hashes, reason codes, confidence, and compact summaries only; raw restricted material, unsafe raw URLs, credentials, payload bodies, object references, and leaked rows are prohibited",
      forbiddenPayloadFields: ["raw_body", "raw_text", "html", "screenshot_bytes", "restricted_raw_url", "unsafe_raw_url", "credential", "authorization", "cookie", "object_reference", "object_key", "leaked_row", "webhook_secret"]
    },
    proofCommands: ["bun run check:api-regression", "bun run check:contract-index", "bun run check:route-inventory", "bun run check:sdk-fixtures", "bun test src/tests/apiRegressionSentinel.test.ts src/tests/api.test.ts", "bun run check"]
  };
}

function openApiParametersForRoute(path: string) {
  return [
    ...(path.includes("{id}") ? [{ name: "id", in: "path", required: true, schema: { type: "string" } }] : []),
    ...(path.includes("{sourceId}") || path.includes("{id}/restricted") ? [{ name: "sourceId", in: "path", required: true, schema: { type: "string" } }] : []),
    ...(path === "/v1/sources" || path.includes("/results") ? [
      { name: "cursor", in: "query", required: false, schema: { type: "string" } },
      { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100 } }
    ] : []),
    ...(path === "/v1/intel/search" || path.includes("/public-channels") || path.includes("/restricted-metadata") ? [
      { name: "q", in: "query", required: false, schema: { type: "string" } },
      { name: "entityType", in: "query", required: false, schema: { type: "string" } }
    ] : [])
  ];
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
    compactUnknownCopy: expectedUxState === "searching" ? "Searching" : "Use compact state copy without default actor claims",
    updatedSemantics: "updated is response generation time; lastSeen only appears with evidence timestamps",
    stableFields: ["query", "mode", "status", "runId", "cursor", "nextCursor", "refreshAfterSeconds", "analystLoop", "tiExperience", "publicTiAnswer"],
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
    deltaType: deltaKind,
    expectedStatus: expectedDisplayState,
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

function numberParam(value: string | null): number | undefined {
  if (value === null || !value.trim()) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function readJson<T>(request: Request): Promise<T> {
  if (isHtmlFormRequest(request)) {
    const form = await request.formData();
    const body: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      body[key] = value === "true" ? true : value === "false" ? false : value;
    }
    return body as T;
  }
  try {
    return await request.json() as T;
  } catch {
    return {} as T;
  }
}

async function readRequestBody<T extends Record<string, unknown>>(request: Request): Promise<T> {
  if (isHtmlFormRequest(request)) {
    const form = await request.formData();
    const body: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value !== "string") continue;
      body[key] = formValue(value);
    }
    return body as T;
  }
  return readJson<T>(request);
}

function formValue(value: string): string | number | boolean {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return value;
}

function isHtmlFormRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
}

function redirectToCanaryConsole(status: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      location: `/v1/ops/canary/console?status=${encodeURIComponent(status)}`,
      "cache-control": "no-store"
    }
  });
}

function numericParam(value: string | null): number | undefined {
  if (value === null || !value.trim()) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numericBodyParam(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
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
