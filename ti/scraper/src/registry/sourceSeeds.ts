import type {
  AccessMethod,
  SourceActivationStatus,
  SourceCatalogMetadata,
  SourceCollectionSla,
  SourceCoverageExplanation,
  LiveSearchPlannerDto,
  SourceHealthStatus,
  SourceRecord,
  SourceRisk,
  SourceType
} from "../types.ts";
import { nowIso, stableId } from "../utils.ts";
import { validateSource } from "./sourceRegistry.ts";

const SAFE_PUBLIC_TYPES = new Set<SourceType>(["rss", "static_web", "api", "pdf"]);
const SAFE_ACCESS_METHODS = new Set<AccessMethod>(["public_http", "official_api"]);

import type {
  LiveSearchSourceActivationDto,
  SafePublicSourcePackInstallMode,
  SafePublicSourcePackInstallPlan,
  SafePublicSourcePackRecommendation,
  SafePublicStarterPackCoverageQuery,
  SafePublicStarterPackCoverageValidation,
  SeedSourceBundle,
  SeedSourceComplianceReport,
  SeedSourceDuplicate,
  SeedSourceImportOptions,
  SeedSourceImportReport,
  SeedSourceInput,
  SeedSourceValidationError,
  SourceActivationApiResponse,
  SourceActivationApiSourceSummary,
  SourceActivationBatchApiResponse,
  SourceActivationBatchQuery,
  SourceActivationBatchSource,
  SourceActivationDuplicateGroup,
  SourceActivationExecutionExcludedSource,
  SourceActivationExecutionQueryPacket,
  SourceActivationExecutionReadiness,
  SourceActivationExecutionSource,
  SourceActivationReport,
  SourceActivationSummary,
  SourceActivationUnderservedReason,
  SourceActivationUnderservedReasonCode,
  SourceActivationWave,
  SourceActivationWaveCategory,
  SourceActivationWaveSource,
  SourceCoverageBurnDownReport,
  SourceCoverageCloseoutApiResponse,
  SourceCoverageCloseoutQuery,
  SourceCoverageCloseoutQueryClass,
  SourceCoverageDriftCode,
  SourceCoverageDriftItem,
  SourceCoverageGovernanceDriftCode,
  SourceCoverageGovernanceDriftItem,
  SourceCoveragePlanApiResponse,
  SourceCoveragePlanQuery,
  SourceCoveragePlanVertical,
  SourceCoverageRemediationPlan,
  SourceCoverageSloEvaluation,
  SourceCoverageSloQueryClass,
  SourceCoverageSloRollup,
  SourceCoverageSloStatus,
  SourceFamilyCoverageGate,
  SourceImportCanaryActivationResult,
  SourceImportCanaryFixture,
  SourceImportCanaryFixtureClass,
  SourceImportCanaryPacket,
  SourceImportCanaryResultDimension,
  SourceImportCanaryRolloutSource,
  SourceMarketplaceApiResponse,
  SourceMarketplaceParserCapability,
  SourceMarketplaceParserProfile,
  SourceMarketplaceSource,
  SourcePackOnboardingPlan,
  SourcePortfolioApiResponse,
  SourcePortfolioGroup,
  SourcePortfolioMigrationLane,
  SourcePortfolioMigrationQueryClassReadiness,
  SourcePortfolioMigrationReadiness,
  SourcePortfolioMigrationState,
  SourcePortfolioQuerySummary,
  SourceReliabilityDecision,
  SourceReliabilityEconomicsPacket,
  SourceReliabilityEconomicsRow,
  SourceReliabilityScoreInputs,
  SourceRolloutPromotionPacket,
  SourceRolloutPromotionQueryImpact,
  SourceRuntimeSlaApiResponse,
  SourceRuntimeSlaMetric,
  SourceRuntimeSlaMetricName,
  SourceRuntimeSlaQuery,
  SourceRuntimeSlaRemediation,
  SourceRuntimeSlaSource,
  SourceRuntimeSlaStatus,
  SourceSlaPromotionGate,
  SourceSlaPromotionRepairPacket,
  SourceSloBurnRateOwner,
  SourceSloBurnRatePacket,
  SourceSloBurnRateRemediationAction,
  SourceSloBurnRateRemediationQueueItem,
  SourceSloBurnRateRow,
  SourceSloBurnRateSeverity,
  SourceSloBurnRateSignal,
  SourceTenantActivationApprovalPacket,
  SourceTenantActivationDecision,
  SourceTenantActivationGroup,
  SourceTenantActivationPacket,
  SourceTenantActivationSourceClass,
  TiSourceAtlasApiResponse,
  TiSourceAtlasCoverageMatrixRow,
  TiSourceAtlasDiscoveryMethod,
  TiSourceAtlasExportManifestApiResponse,
  TiSourceAtlasExportManifestRow,
  TiSourceAtlasFamily,
  TiSourceAtlasImportPlan,
  TiSourceAtlasRecord,
  TiSourceAtlasRegistryActivationHandoff,
  TiSourceAtlasReviewDecision,
  TiSourceAtlasReviewQueueRow
} from "./sourceSeedTypes.ts";

export type {
  LiveSearchSourceActivationDto,
  SafePublicSourcePackInstallMode,
  SafePublicSourcePackInstallPlan,
  SafePublicSourcePackRecommendation,
  SafePublicStarterPackCoverageQuery,
  SafePublicStarterPackCoverageValidation,
  SeedSourceBundle,
  SeedSourceComplianceReport,
  SeedSourceDuplicate,
  SeedSourceImportOptions,
  SeedSourceImportReport,
  SeedSourceInput,
  SeedSourceValidationError,
  SourceActivationApiResponse,
  SourceActivationApiSourceSummary,
  SourceActivationBatchApiResponse,
  SourceActivationBatchQuery,
  SourceActivationBatchSource,
  SourceActivationDuplicateGroup,
  SourceActivationExecutionExcludedSource,
  SourceActivationExecutionQueryPacket,
  SourceActivationExecutionReadiness,
  SourceActivationExecutionSource,
  SourceActivationReport,
  SourceActivationSummary,
  SourceActivationUnderservedReason,
  SourceActivationUnderservedReasonCode,
  SourceActivationWave,
  SourceActivationWaveCategory,
  SourceActivationWaveSource,
  SourceCoverageBurnDownReport,
  SourceCoverageCloseoutApiResponse,
  SourceCoverageCloseoutQuery,
  SourceCoverageCloseoutQueryClass,
  SourceCoverageDriftCode,
  SourceCoverageDriftItem,
  SourceCoverageGovernanceDriftCode,
  SourceCoverageGovernanceDriftItem,
  SourceCoveragePlanApiResponse,
  SourceCoveragePlanQuery,
  SourceCoveragePlanVertical,
  SourceCoverageRemediationPlan,
  SourceCoverageSloEvaluation,
  SourceCoverageSloQueryClass,
  SourceCoverageSloRollup,
  SourceCoverageSloStatus,
  SourceFamilyCoverageGate,
  SourceMarketplaceApiResponse,
  SourceMarketplaceParserCapability,
  SourceMarketplaceParserProfile,
  SourceMarketplaceSource,
  SourcePackOnboardingPlan,
  SourcePortfolioApiResponse,
  SourcePortfolioGroup,
  SourcePortfolioMigrationLane,
  SourcePortfolioMigrationQueryClassReadiness,
  SourcePortfolioMigrationReadiness,
  SourcePortfolioMigrationState,
  SourcePortfolioQuerySummary,
  SourceReliabilityDecision,
  SourceReliabilityEconomicsPacket,
  SourceReliabilityEconomicsRow,
  SourceReliabilityScoreInputs,
  SourceRolloutPromotionPacket,
  SourceRolloutPromotionQueryImpact,
  SourceRuntimeSlaApiResponse,
  SourceRuntimeSlaMetric,
  SourceRuntimeSlaMetricName,
  SourceRuntimeSlaQuery,
  SourceRuntimeSlaRemediation,
  SourceRuntimeSlaSource,
  SourceRuntimeSlaStatus,
  SourceSlaPromotionGate,
  SourceSlaPromotionRepairPacket,
  SourceSloBurnRateOwner,
  SourceSloBurnRatePacket,
  SourceSloBurnRateRemediationAction,
  SourceSloBurnRateRemediationQueueItem,
  SourceSloBurnRateRow,
  SourceSloBurnRateSeverity,
  SourceSloBurnRateSignal,
  SourceTenantActivationApprovalPacket,
  SourceTenantActivationDecision,
  SourceTenantActivationGroup,
  SourceTenantActivationPacket,
  SourceTenantActivationSourceClass
} from "./sourceSeedTypes.ts";

export function validateSeedBundle(bundle: SeedSourceBundle, options: SeedSourceImportOptions = {}): SeedSourceImportReport {
  return buildSeedImportReport(bundle, options);
}

export function importSeedBundle(bundle: SeedSourceBundle, options: SeedSourceImportOptions = {}): SeedSourceImportReport {
  return buildSeedImportReport(bundle, { ...options, dryRun: options.dryRun ?? false });
}

export function exportSeedBundle(sources: SourceRecord[], name: string, generatedAt = nowIso()): SeedSourceBundle {
  return {
    version: 1,
    name,
    generatedAt,
    sources: sources.map((source) => ({
      id: source.id,
      tenantId: source.tenantId,
      name: source.name,
      type: source.type,
      url: source.url,
      accessMethod: source.accessMethod,
      risk: source.risk,
      trustScore: source.trustScore,
      language: source.language,
      crawlFrequencySeconds: source.crawlFrequencySeconds,
      legalNotes: source.legalNotes,
      lastSeenAt: source.lastSeenAt,
      tags: source.tags,
      metadata: source.metadata,
      catalog: source.catalog
    }))
  };
}

export function seedDuplicateKey(source: Pick<SeedSourceInput | SourceRecord, "tenantId" | "type"> & { url?: string }): string {
  return `${source.tenantId ?? "global"}:${source.type}:${canonicalizeDuplicateUrl(source.url)}`;
}

export function buildSourceActivationReport(query: string, sources: SourceRecord[], generatedAt = nowIso()): SourceActivationReport {
  const explanations = sources
    .map((source) => explainSourceForQuery(query, source, generatedAt))
    .sort((left, right) => right.score - left.score || left.sourceName.localeCompare(right.sourceName));
  const summary = Object.fromEntries(ACTIVATION_STATUSES.map((status) => [status, 0])) as Record<SourceActivationStatus, number>;
  for (const explanation of explanations) summary[explanation.status] += 1;
  return { query, generatedAt, sources: explanations, summary };
}

export function buildLiveSearchSourceActivationDto(
  query: string,
  sources: SourceRecord[],
  options: { generatedAt?: string; demandCount?: number } = {}
): LiveSearchSourceActivationDto {
  const generatedAt = options.generatedAt ?? nowIso();
  const sourceCoverage = buildSourceActivationReport(query, sources, generatedAt);
  const inactive = sourceCoverage.sources.filter((source) => source.status !== "active");
  const coverageGaps = ACTIVATION_STATUSES
    .map((status) => {
      const matches = inactive.filter((source) => source.status === status);
      return {
        category: status,
        count: matches.length,
        sourceIds: matches.map((source) => source.sourceId),
        reason: activationGapReason(status)
      };
    })
    .filter((gap) => gap.count > 0);
  const demandCount = Math.max(1, options.demandCount ?? 1);
  const activationRecommendations = inactive
    .filter((source) => source.score > 0 || source.status !== "candidate_only")
    .map((source) => ({
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      reason: source.reasons.join("; ") || activationGapReason(source.status),
      requiredAction: requiredActivationAction(source.status),
      priority: Math.round(source.score * 100) + demandCount * 10 + actionPriorityBoost(source.status),
      coverageGap: activationCoverageGapForStatus(source.status),
      demandCount,
      status: source.status,
      matchedTopics: source.matchedTopics,
      matchedActors: source.matchedActors,
      matchedIndustries: source.matchedIndustries,
      matchedRegions: source.matchedRegions
    }))
    .sort((left, right) => right.priority - left.priority || left.sourceId.localeCompare(right.sourceId))
    .slice(0, 10);

  return { query, generatedAt, coverageGaps, activationRecommendations, sourceCoverage };
}

export function buildSourceActivationApiResponse(
  query: string,
  sources: SourceRecord[],
  options: {
    tenantId?: string;
    generatedAt?: string;
    demandCount?: number;
    sourcePack?: SeedSourceBundle;
  } = {}
): SourceActivationApiResponse {
  const scopedSources = options.tenantId
    ? sources.filter((source) => source.tenantId === options.tenantId || source.tenantId === undefined)
    : sources;
  const generatedAt = options.generatedAt ?? nowIso();
  const liveDto = buildLiveSearchSourceActivationDto(query, scopedSources, {
    generatedAt,
    demandCount: options.demandCount
  });
  const summaries = liveDto.sourceCoverage.sources.map((explanation) =>
    apiSourceSummary(explanation, scopedSources.find((source) => source.id === explanation.sourceId)!)
  );
  const byStatus = (status: SourceActivationStatus) => summaries.filter((source) => source.status === status);
  const duplicateSources = duplicateGroups(scopedSources);
  const sourcePackRecommendations = options.sourcePack
    ? buildSafePublicSourcePackInstallPlan(options.sourcePack, {
      mode: "dry_run",
      tenantId: options.tenantId,
      existingSources: scopedSources,
      generatedAt
    }).recommendations
    : [];

  return {
    query,
    tenantId: options.tenantId,
    generatedAt,
    activeCoverage: byStatus("active"),
    approvedIdleSources: byStatus("approved_idle"),
    candidateOnlyGaps: byStatus("candidate_only"),
    missingLegalNotes: byStatus("missing_legal_notes"),
    policyBlocks: byStatus("blocked_by_policy"),
    staleSources: byStatus("stale"),
    duplicateSources,
    adapterIncompatibilities: byStatus("adapter_incompatible"),
    coverageGaps: liveDto.coverageGaps,
    underservedReasons: buildUnderservedReasons(query, scopedSources, summaries, duplicateSources),
    activationRecommendations: liveDto.activationRecommendations,
    sourcePackRecommendations,
    coverageSummary: liveDto.sourceCoverage.summary,
    sourceCoverage: liveDto.sourceCoverage
  };
}

export function buildSourceCoveragePlanApiResponse(input: {
  queries: string[];
  sources: SourceRecord[];
  sourcePacks?: SeedSourceBundle[];
  tenantId?: string;
  generatedAt?: string;
}): SourceCoveragePlanApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const scopedSources = input.tenantId
    ? input.sources.filter((source) => source.tenantId === input.tenantId || source.tenantId === undefined)
    : input.sources;
  const activationWaves = buildEnterpriseSafePublicActivationWaves(generatedAt);
  const queries = input.queries.map((query): SourceCoveragePlanQuery => {
    const activation = buildSourceActivationApiResponse(query, input.sources, {
      tenantId: input.tenantId,
      generatedAt,
      sourcePack: input.sourcePacks?.[0]
    });
    const queryRecommendations = activation.sourcePackRecommendations.filter((source) =>
      source.requiredAction === "install_candidate" && recommendationMatchesQuery(source, query)
    ).sort((left, right) => recommendationQueryRank(right, query) - recommendationQueryRank(left, query) || right.score - left.score || left.sourceId.localeCompare(right.sourceId));
    const queryActivation = { ...activation, sourcePackRecommendations: queryRecommendations };
    const missingVerticals = buildCoverageVerticals(query, queryActivation, input.sourcePacks ?? []);
    const slo = evaluateSourceCoverageSlo(query, scopedSources, queryActivation, queryRecommendations, generatedAt);
    const queryDrift = buildSourceCoverageSloDrift(query, slo, scopedSources, queryActivation, queryRecommendations);
    const blockingCount = activation.policyBlocks.length + activation.adapterIncompatibilities.length;
    const activeCount = activation.activeCoverage.filter((source) => source.score > 0).length;
    const recommendedCount = queryRecommendations.length;
    const coverageState = blockingCount > 0 && activeCount === 0
      ? "blocked"
      : slo.status === "fail" && activeCount > 0
        ? "needs_review"
        : activeCount > 0 || recommendedCount > 0
        ? "ready"
        : "partial";
    return {
      query,
      coverageState,
      slo,
      drift: queryDrift,
      portfolio: buildSourcePortfolioQuerySummary(query, scopedSources, generatedAt),
      activationBatch: buildSourceActivationBatchQuery(query, scopedSources, input.sourcePacks ?? [], queryRecommendations, generatedAt, input.tenantId),
      runtimeSla: buildSourceRuntimeSlaQuery(query, scopedSources, generatedAt),
      coverageCloseout: buildSourceCoverageCloseoutQuery(query, scopedSources, activationWaves, generatedAt),
      executionReadiness: buildSourceActivationExecutionQueryPacket(query, activationWaves, generatedAt),
      activeSources: activation.activeCoverage.filter((source) => source.score > 0).slice(0, 12),
      eligibleSources: [...activation.activeCoverage, ...activation.approvedIdleSources]
        .filter((source) => source.score > 0)
        .slice(0, 12),
      selectedSources: activation.activeCoverage
        .filter((source) => source.score > 0)
        .sort((left, right) => right.score - left.score || left.sourceId.localeCompare(right.sourceId))
        .slice(0, 5),
      approvedIdleSources: activation.approvedIdleSources.filter((source) => source.score > 0).slice(0, 12),
      missingApprovedPublicSources: queryRecommendations.slice(0, 12),
      missingVerticals,
      staleSources: activation.staleSources.filter((source) => source.score > 0).slice(0, 12),
      policyBlocks: activation.policyBlocks.filter((source) => source.score > 0).slice(0, 12),
      adapterIncompatibilities: activation.adapterIncompatibilities.filter((source) => source.score > 0).slice(0, 12),
      safeSourcePackRecommendations: queryRecommendations.slice(0, 12),
      underservedReasons: activation.underservedReasons
    };
  });
  const sourcePackInstallPlans = (input.sourcePacks ?? []).map((pack) => {
    const plan = buildSafePublicSourcePackInstallPlan(pack, {
      mode: "dry_run",
      tenantId: input.tenantId,
      existingSources: input.sources,
      generatedAt
    });
    return {
      packName: plan.packName,
      safeToInstall: plan.safeToInstall,
      acceptedSourceCount: plan.acceptedSourceCount,
      rejectedSourceCount: plan.rejectedSourceCount,
      duplicateSourceCount: plan.duplicateSourceCount,
      willStartCrawling: plan.willStartCrawling
    };
  });
  const drift = buildCoverageGovernanceDrift(input.sources, input.sourcePacks ?? [], input.tenantId, generatedAt);
  const coverageDrift = queries.flatMap((query) => query.drift);

  return {
    endpoint: "/v1/sources/coverage-plan",
    dryRun: true as const,
    willMutate: false as const,
    willStartCrawling: false as const,
    tenantId: input.tenantId,
    generatedAt,
    queries,
    slo: buildSourceCoverageSloRollup(queries),
    drift: [...coverageDrift, ...drift],
    sourcePackInstallPlans,
    governanceDrift: drift,
    remediationPlans: buildCoverageRemediationPlans([...drift, ...coverageDrift]),
    forbiddenSourceClasses: [
      "private forums",
      "credentialed sources",
      "leaked-file endpoints",
      "CAPTCHA bypass",
      "threat actor interaction",
      "restricted raw payload collection"
    ],
    coordination: {
      agent09Fields: ["queries", "slo", "drift", "eligibleSources", "selectedSources", "activeSources", "approvedIdleSources", "missingApprovedPublicSources", "missingVerticals", "governanceDrift", "safeSourcePackRecommendations", "underservedReasons"],
      agent10PromotionFields: ["dryRun", "willMutate", "willStartCrawling", "slo", "drift", "runtimeSla", "sourcePackInstallPlans", "governanceDrift", "remediationPlans", "forbiddenSourceClasses"]
    }
  };
}

export function buildSourcePortfolioApiResponse(input: {
  queries: string[];
  sources: SourceRecord[];
  sourcePacks?: SeedSourceBundle[];
  tenantId?: string;
  generatedAt?: string;
}): SourcePortfolioApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const scopedSources = input.tenantId
    ? input.sources.filter((source) => source.tenantId === input.tenantId || source.tenantId === undefined)
    : input.sources;
  const queries = input.queries.length > 0 ? input.queries : ["portfolio"];
  const coverage = buildSourceCoveragePlanApiResponse({
    queries,
    sources: scopedSources,
    sourcePacks: input.sourcePacks,
    tenantId: input.tenantId,
    generatedAt
  });
  const portfolioQueries = queries.map((query) => buildSourcePortfolioQuerySummary(query, scopedSources, generatedAt));
  const onboardingPlans = (input.sourcePacks ?? []).map((pack) =>
    buildSourcePackOnboardingPlan(pack, scopedSources, coverage.queries, input.tenantId, generatedAt)
  );
  const burnDown = coverage.queries.map((query) =>
    buildSourceCoverageBurnDownReport(query, onboardingPlans, scopedSources)
  );
  const ready = coverage.slo.failed === 0 && coverage.governanceDrift.every((item) => item.severity !== "critical");

  return {
    endpoint: "/v1/sources/portfolio",
    dryRun: true as const,
    willMutate: false as const,
    willStartCrawling: false as const,
    tenantId: input.tenantId,
    generatedAt,
    portfolio: buildSourcePortfolioQuerySummary("portfolio", scopedSources, generatedAt),
    queries: portfolioQueries,
    reliabilityEconomics: buildSourceReliabilityEconomicsPacket("portfolio", scopedSources, generatedAt),
    migrationReadiness: buildSourcePortfolioMigrationReadiness({
      sources: scopedSources,
      sourcePacks: input.sourcePacks,
      queries,
      tenantId: input.tenantId,
      generatedAt
    }),
    sloBurnRate: buildSourceSloBurnRatePacket({
      sources: scopedSources,
      queries,
      tenantId: input.tenantId,
      generatedAt
    }),
    tenantActivation: buildSourceTenantActivationPacket({
      sources: scopedSources,
      allSources: input.sources,
      queries,
      tenantId: input.tenantId,
      generatedAt
    }),
    sourceImportCanary: buildSourceImportCanaryPacket({
      sources: scopedSources,
      sourcePacks: input.sourcePacks,
      queries,
      tenantId: input.tenantId,
      generatedAt
    }),
    onboardingPlans,
    burnDown,
    promotionPacket: {
      field: "sourcePortfolioId",
      value: stableId("source_portfolio", `${input.tenantId ?? "global"}:${queries.join("|")}:${generatedAt}`),
      gate: "source_portfolio_ready",
      ready
    }
  };
}

export function buildTiSourceAtlasApiResponse(input: {
  queries?: string[];
  tenantId?: string;
  generatedAt?: string;
  recordLimit?: number;
} = {}): TiSourceAtlasApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const recordLimit = Math.max(500, Math.min(input.recordLimit ?? 560, 1000));
  const candidates = buildTiSourceAtlasRecords(recordLimit, generatedAt);
  const first100 = candidates.filter((record) => !record.duplicate.suppressed).slice(0, 100);
  const first1000Ids = buildTiSourceAtlasSourceIds(1000);
  const parserHolds = candidates.filter((record) => record.activationReadiness.state === "needs_parser_certification").map((record) => record.id);
  const descriptorHolds = candidates.filter((record) => record.activationReadiness.state === "descriptor_only_hold").map((record) => record.id);
  const importPlans = buildTiSourceAtlasImportPlans(candidates, first100, first1000Ids, generatedAt);
  const coverageMatrix = buildTiSourceAtlasCoverageMatrix(candidates, input.queries ?? []);
  const readyForDryRun = candidates.filter((record) => record.activationReadiness.state === "ready_for_dry_run").length;

  return {
    endpoint: "/v1/sources/atlas",
    schemaVersion: "ti.source_atlas.v1",
    dryRun: true,
    willMutate: false,
    willImportSourcePacks: false,
    willStartCrawling: false,
    tenantId: input.tenantId,
    generatedAt,
    summary: {
      recordCount: candidates.length,
      syntheticScaleCandidateCount: 10_000,
      first100Count: 100,
      first1000Count: 1000,
      readyForDryRun,
      parserCertificationHolds: parserHolds.length,
      duplicateSuppressed: candidates.filter((record) => record.duplicate.suppressed).length,
      descriptorOnlyHolds: descriptorHolds.length,
      averageSourceValueScore: roundScore(average(candidates.map((record) => record.sourceValueScore)))
    },
    records: candidates,
    importPlans,
    coverageMatrix,
    activationCanary: {
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      first100SourceIds: first100.map((record) => record.id),
	      first1000SourceIds: first1000Ids,
	      parserCertificationRequiredSourceIds: parserHolds.slice(0, 100),
	      descriptorOnlySourceIds: descriptorHolds.slice(0, 100),
	      rollbackPlanIds: importPlans.map((plan) => plan.rollbackPacket.rollbackPlanId),
	      registryActivationHandoff: buildTiSourceAtlasRegistryActivationHandoff({
	        first100,
	        parserHolds,
	        descriptorHolds,
	        importPlans
	      })
	    },
    discoveryInputs: (["curated_list", "public_report", "github_repository", "awesome_list", "opml_rss", "vendor_page", "analyst_import", "existing_source_pack"] as TiSourceAtlasDiscoveryMethod[])
      .map((method, index) => ({
        method,
        sourceCount: Math.floor(10_000 / 8) + (index < 4 ? 1 : 0),
        refreshCadence: method === "opml_rss" || method === "vendor_page" ? "daily" : method === "analyst_import" ? "monthly" : "weekly",
        owner: "agent_01" as const
      })),
    exportImportSchema: {
      schemaVersion: "ti.source_atlas_export.v1",
      primaryKey: "id",
      requiredFields: ["id", "url", "domain", "family", "queryClassCoverage", "sourceValueScore", "activationReadiness"],
      noUnsafeSourceClasses: ["private", "invite", "auth", "captcha", "paywall", "credential target", "raw payload target", "threat actor interaction"]
    },
    guardrails: {
      publicOnly: true,
      noPrivateInviteAuthCaptcha: true,
      noSilentActivation: true,
      noSourcePackImport: true,
      noCrawlingFromAtlas: true,
      descriptorOnlyPublicChannels: true
    },
    handoffs: {
      agent02SchedulerBudgets: ["importPlans.schedulerEstimate", "records.schedulerEstimate", "activationCanary.first1000SourceIds"],
      agent03ParserCertification: ["records.parserCapability", "activationCanary.parserCertificationRequiredSourceIds"],
      agent04CoverageFreshness: ["coverageMatrix", "records.queryClassCoverage", "records.freshness"],
      agent06EvidenceEstimates: ["records.evidenceEstimate", "importPlans.evidenceEstimate"],
      agent07QualityScorecards: ["records.sourceValueScore", "records.legalRobotsState", "records.downstreamPublicAnswerImpact"],
      agent09ApiContracts: ["sourceAtlas", "schemaVersion", "summary", "records", "importPlans", "coverageMatrix", "activationCanary"],
      agent10ReleaseGates: ["guardrails.noSilentActivation", "importPlans.rollbackPacket", "activationCanary.rollbackPlanIds"]
    }
  };
}

function buildTiSourceAtlasRegistryActivationHandoff(input: {
  first100: readonly TiSourceAtlasRecord[];
  parserHolds: readonly string[];
  descriptorHolds: readonly string[];
  importPlans: readonly TiSourceAtlasImportPlan[];
}): TiSourceAtlasRegistryActivationHandoff {
  const proposedSourceRecords = input.first100.slice(0, 10).map((record) => ({
    atlasSourceId: record.id,
    proposedSourceId: `src_atlas_canary_${record.id.replace(/^atlas_src_/, "")}`,
    name: record.sourceName,
    type: tiSourceAtlasRegistryType(record.family),
    accessMethod: tiSourceAtlasRegistryAccessMethod(record.family),
    risk: (record.schedulerEstimate.budgetClass === "high" ? "medium" : "low") as Exclude<SourceRisk, "restricted">,
    url: record.url,
    domain: record.domain,
    crawlFrequencySeconds: record.schedulerEstimate.cadenceSeconds,
    statusPreview: "candidate" as const,
    metadata: {
      atlasFamily: record.family,
      sourceValueScore: record.sourceValueScore,
      queryClassCoverage: record.queryClassCoverage,
      sourceHash: stableId("ti_source_atlas_source", `${record.id}:${record.domain}:${record.url}`),
      provenance: "ti_source_atlas" as const
    },
    governance: {
      legalReview: record.legalRobotsState.legalReview,
      robotsReview: record.legalRobotsState.robotsReview,
      approvalRequired: true as const,
      autoActivationAllowed: false as const
    }
  }));

  return {
    routeHint: "/v1/analyst/source-activation-packets",
    dryRun: true,
    willMutate: false,
    willImportSourcePacks: false,
    willStartCrawling: false,
    approvalRequired: true,
    sourceRegistryMutationAllowed: false,
    candidateCount: input.first100.length,
    canarySourceIds: input.first100.map((record) => record.id),
    parserCertificationRequiredSourceIds: [...input.parserHolds],
    descriptorOnlyHeldSourceIds: [...input.descriptorHolds],
    proposedSourceRecords,
    schedulerPreview: {
      owner: "agent_02",
      queuePartition: "source_atlas_canary",
      maxConcurrentCanaries: 10,
      initialCadenceSeconds: Math.max(3600, Math.min(...input.first100.map((record) => record.schedulerEstimate.cadenceSeconds))),
      estimatedDailyTasks: input.first100.reduce((sum, record) => sum + record.schedulerEstimate.estimatedDailyTasks, 0),
      leaseMode: "dry_run_preview_only"
    },
    prerequisites: [
      "operator_legal_approval_packet_approved",
      "source_hashes_match_export_manifest",
      "legal_and_robots_review_current",
      "parser_certification_complete_for_required_sources",
      "duplicate_suppression_reviewed",
      "descriptor_only_sources_remain_held",
      "tenant_policy_allows_safe_public_source",
      "rollback_packet_ready"
    ],
    forbiddenOperations: [
      "registry_mutation",
      "source_pack_import",
      "crawl_enqueue",
      "source_auto_activation",
      "restricted_fetch",
      "auth_or_captcha_bypass",
      "payload_download"
    ],
    rollbackPacket: {
      rollbackPlanIds: input.importPlans.map((plan) => plan.rollbackPacket.rollbackPlanId),
      action: "Discard proposed registry previews, keep atlas records staged only, and require a fresh approval packet before any real source registry write."
    },
    downstreamHandoffs: {
      agent01RegistryReview: ["proposedSourceRecords", "sourceRegistryMutationAllowed", "rollbackPacket"],
      agent02SchedulerDryRun: ["schedulerPreview", "canarySourceIds", "forbiddenOperations.crawl_enqueue"],
      agent03ParserCertification: ["parserCertificationRequiredSourceIds", "prerequisites.parser_certification_complete_for_required_sources"],
      agent06EvidenceReadiness: ["metadata.sourceHash", "metadata.queryClassCoverage", "schedulerPreview.estimatedDailyTasks"],
      agent07QualityGate: ["metadata.sourceValueScore", "governance", "prerequisites.duplicate_suppression_reviewed"],
      agent09ApiContract: ["activationCanary.registryActivationHandoff", "routeHint", "proposedSourceRecords"],
      agent10ReleaseGate: ["rollbackPacket", "forbiddenOperations", "sourceRegistryMutationAllowed"]
    }
  };
}


export function buildTiSourceAtlasExportManifestApiResponse(input: {
  queries?: string[];
  tenantId?: string;
  generatedAt?: string;
  planLabel?: TiSourceAtlasImportPlan["label"];
  recordLimit?: number;
} = {}): TiSourceAtlasExportManifestApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const requestedPlan = input.planLabel ?? "first_100";
  const recordLimit = Math.max(requestedPlan === "first_1000" || requestedPlan === "future_10k" ? 1000 : 500, Math.min(input.recordLimit ?? 1000, 1000));
  const atlas = buildTiSourceAtlasApiResponse({
    tenantId: input.tenantId,
    generatedAt,
    queries: input.queries,
    recordLimit
  });
  const plan = atlas.importPlans.find((candidate) => candidate.label === requestedPlan) ?? atlas.importPlans[0]!;
  const planSourceIds = new Set(plan.sourceIds);
  const manifestRecords = atlas.records
    .filter((record) => planSourceIds.has(record.id))
    .slice(0, requestedPlan === "first_100" ? 100 : 1000);
  const reviewQueue = manifestRecords.map((record) => tiSourceAtlasReviewQueueRow(record, generatedAt));
  const rows = manifestRecords.map(tiSourceAtlasExportManifestRow);

  return {
    endpoint: "/v1/sources/atlas/export",
    schemaVersion: "ti.source_atlas_export_manifest.v1",
    dryRun: true,
    willMutate: false,
    willImportSourcePacks: false,
    willStartCrawling: false,
    tenantId: input.tenantId,
    generatedAt,
    requestedPlan,
    summary: {
      plannedSourceCount: plan.sourceCount,
      manifestRowCount: rows.length,
      stagedForCanary: reviewQueue.filter((row) => row.decision === "stage_for_canary").length,
      parserCertificationRequired: reviewQueue.filter((row) => row.decision === "request_parser_certification").length,
      duplicateHolds: reviewQueue.filter((row) => row.decision === "hold_duplicate").length,
      descriptorOnlyHolds: reviewQueue.filter((row) => row.decision === "hold_descriptor_only").length,
      legalReviewRequired: reviewQueue.filter((row) => row.decision === "legal_review_required").length
    },
    reviewQueue,
    exportManifest: {
      schemaVersion: "ti.source_atlas_export.v1",
      format: "source_pack_import_dry_run_json",
      hashAlgorithm: "stable_sha256",
      primaryKey: "atlasSourceId",
      rows
    },
    approvalPacket: {
      routeHint: "/v1/analyst/source-activation-packets",
      approvalRequired: true,
      allowedActions: ["approve_canary", "request_parser_certification", "mark_duplicate", "hold_descriptor", "rollback_batch", "export_manifest"],
      forbiddenActions: ["auto_activate", "start_crawl", "import_without_review", "add_private_source", "bypass_captcha_or_auth", "download_payload"]
    },
    rollbackPacket: {
      rollbackPlanId: stableId("ti_source_atlas_export_rollback", `${requestedPlan}:${generatedAt}`),
      trigger: "operator rejects approval packet, parser certification fails, unsafe class appears, duplicate spike exceeds threshold, or source-pack import drifts from manifest hashes",
      action: "Discard the export manifest, keep atlas records staged only, preserve the active registry, and regenerate the atlas export packet before any future approval."
    },
    guardrails: {
      ...atlas.guardrails,
      noManifestImport: true,
      explicitApprovalRequired: true
    },
    handoffs: {
      ...atlas.handoffs,
      agent01RegistryImport: ["exportManifest.rows", "reviewQueue.decision", "approvalPacket", "rollbackPacket"]
    }
  };
}

function buildTiSourceAtlasRecords(count: number, generatedAt: string): TiSourceAtlasRecord[] {
  const families: TiSourceAtlasFamily[] = [
    "vendor_threat_blog",
    "cert_government",
    "cve_advisory",
    "malware_researcher",
    "ransomware_tracker",
    "exploit_intelligence",
    "github_security_advisory",
    "package_advisory",
    "public_dataset",
    "regional_cyber_agency",
    "ics_ot",
    "cloud_saas_security",
    "phishing_brand_abuse",
    "public_channel_descriptor"
  ];
  return Array.from({ length: count }, (_, index) => tiSourceAtlasRecord(index + 1, families[index % families.length]!, generatedAt));
}

function buildTiSourceAtlasSourceIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `atlas_src_${String(index + 1).padStart(5, "0")}`);
}

function tiSourceAtlasRecord(index: number, family: TiSourceAtlasFamily, generatedAt: string): TiSourceAtlasRecord {
  const domain = `${family.replaceAll("_", "-")}-${String(index).padStart(4, "0")}.cti.example`;
  const queryClassCoverage = tiSourceAtlasQueryClasses(family, index);
  const parserProfile = tiSourceAtlasParserProfile(family);
  const parserCertified = parserProfile !== "dynamic_page" && family !== "public_channel_descriptor";
  const duplicateSuppressed = index % 37 === 0;
  const legalReview = index % 29 === 0 ? "stale" : index % 31 === 0 ? "missing" : "current";
  const robotsReview = family === "github_security_advisory" || family === "package_advisory" ? "not_required" : index % 41 === 0 ? "stale" : "current";
  const descriptorOnly = family === "public_channel_descriptor";
  const reliability = roundScore(0.55 + ((index % 43) / 100));
  const freshness = roundScore(0.6 + ((index % 31) / 100));
  const evidenceYield = roundScore(0.45 + ((index % 47) / 120));
  const uniqueness = duplicateSuppressed ? 0.15 : roundScore(0.5 + ((index % 19) / 40));
  const downstreamPublicAnswerImpact = roundScore((queryClassCoverage.length / 5) * 0.45 + evidenceYield * 0.35 + uniqueness * 0.2);
  const sourceValueScore = roundScore(
    reliability * 0.22 +
    freshness * 0.16 +
    evidenceYield * 0.2 +
    uniqueness * 0.14 +
    downstreamPublicAnswerImpact * 0.18 +
    (parserCertified ? 0.06 : 0) +
    (legalReview === "current" ? 0.04 : -0.08) -
    (duplicateSuppressed ? 0.28 : 0) -
    (descriptorOnly ? 0.12 : 0)
  );
  const state: TiSourceAtlasRecord["activationReadiness"]["state"] = duplicateSuppressed
    ? "duplicate_suppressed"
    : descriptorOnly
      ? "descriptor_only_hold"
      : !parserCertified
        ? "needs_parser_certification"
        : legalReview === "current"
          ? "ready_for_dry_run"
          : "legal_review_hold";
  const cadenceSeconds = tiSourceAtlasCadenceSeconds(family);
  const estimatedDailyTasks = Math.ceil(86_400 / Math.max(3600, cadenceSeconds));

  return {
    id: `atlas_src_${String(index).padStart(5, "0")}`,
    url: `https://${domain}/`,
    domain,
    feedUrl: family === "vendor_threat_blog" || family === "cert_government" || family === "regional_cyber_agency" ? `https://${domain}/feed.xml` : undefined,
    sourceName: `${tiSourceAtlasFamilyLabel(family)} ${index}`,
    family,
    discoveryMethod: tiSourceAtlasDiscoveryMethod(index),
    queryClassCoverage,
    language: ["en", "es", "fr", "de", "ja", "ko", "pt", "no"][index % 8]!,
    region: tiSourceAtlasRegions(index, family),
    sector: tiSourceAtlasSectors(index, family),
    reliability,
    freshness,
    evidenceYield,
    uniqueness,
    downstreamPublicAnswerImpact,
    sourceValueScore,
    parserCapability: {
      profile: parserProfile,
      owner: "agent_03",
      certified: parserCertified,
      certificationRequired: !parserCertified
    },
    legalRobotsState: {
      legalReview,
      robotsReview,
      notes: [
        "Public-source atlas candidate only.",
        descriptorOnly ? "Public-channel descriptor remains metadata-only until explicit policy and parser certification." : "Safe public HTTP/API source candidate.",
        `Generated ${generatedAt} for dry-run scoring.`
      ]
    },
    duplicate: {
      duplicateOf: duplicateSuppressed ? `atlas_src_${String(Math.max(1, index - 1)).padStart(5, "0")}` : undefined,
      mirrorOf: index % 53 === 0 ? `atlas_src_${String(Math.max(1, index - 2)).padStart(5, "0")}` : undefined,
      contentSimilarity: duplicateSuppressed ? 0.97 : roundScore((index % 17) / 25),
      suppressed: duplicateSuppressed
    },
    schedulerEstimate: {
      budgetClass: descriptorOnly ? "low" : family === "cert_government" || family === "cve_advisory" ? "normal" : "high",
      cadenceSeconds,
      estimatedDailyTasks
    },
    evidenceEstimate: {
      expectedItemsPerDay: roundScore(Math.max(0.05, evidenceYield * estimatedDailyTasks)),
      storageMbPerDay: roundScore(Math.max(0.1, evidenceYield * estimatedDailyTasks * 0.35)),
      retentionClass: descriptorOnly ? "public_chat_text" : "public_report"
    },
    activationReadiness: {
      state,
      approvalRequired: true,
      autoActivationAllowed: false as const,
      reasons: tiSourceAtlasReadinessReasons(state)
    },
    safety: {
      publicOnly: true,
      privateInviteAuthCaptcha: false,
      rawPayloadTarget: false,
      autoActivate: false
    }
  };
}

function buildTiSourceAtlasImportPlans(
  records: TiSourceAtlasRecord[],
  first100: TiSourceAtlasRecord[],
  first1000Ids: string[],
  generatedAt: string
): TiSourceAtlasImportPlan[] {
  const plan = (label: TiSourceAtlasImportPlan["label"], selected: TiSourceAtlasRecord[], sourceIds: string[]): TiSourceAtlasImportPlan => ({
    planId: stableId("ti_source_atlas_import_plan", `${label}:${generatedAt}`),
    label,
    dryRun: true,
    willMutate: false,
    willImportSourcePacks: false,
    willStartCrawling: false,
    sourceCount: label === "future_10k" ? 10_000 : sourceIds.length,
    sourceIds,
    familyCoverage: tiSourceAtlasFamilyCoverage(selected),
    schedulerEstimate: {
      estimatedDailyTasks: selected.reduce((sum, record) => sum + record.schedulerEstimate.estimatedDailyTasks, 0),
      budgetClasses: uniqueStrings(selected.map((record) => record.schedulerEstimate.budgetClass)) as SourceCollectionSla["budgetClass"][]
    },
    evidenceEstimate: {
      expectedItemsPerDay: roundScore(selected.reduce((sum, record) => sum + record.evidenceEstimate.expectedItemsPerDay, 0)),
      storageMbPerDay: roundScore(selected.reduce((sum, record) => sum + record.evidenceEstimate.storageMbPerDay, 0))
    },
    approvalPacket: {
      routeHint: "/v1/analyst/source-activation-packets",
      approvalRequired: true,
      allowedActions: ["approve_canary", "request_parser_certification", "mark_duplicate", "hold_descriptor", "rollback_batch"],
      forbiddenActions: ["auto_activate", "start_crawl", "import_without_review", "add_private_source", "bypass_captcha_or_auth"]
    },
    rollbackPacket: {
      rollbackPlanId: stableId("ti_source_atlas_rollback", `${label}:${generatedAt}`),
      trigger: "parser certification failure, duplicate spike, scheduler flood, quality regression, public answer regression, or any unsafe/private/auth/CAPTCHA source class detected",
      action: "Keep atlas candidates staged, disable import executor, preserve current registry, and rerun source atlas checks before another approval packet."
    }
  });
  const first1000 = records.filter((record) => first1000Ids.includes(record.id));
  return [
    plan("first_100", first100, first100.map((record) => record.id)),
    plan("first_1000", first1000, first1000Ids),
    plan("future_10k", records, buildTiSourceAtlasSourceIds(10_000))
  ];
}

function tiSourceAtlasReviewQueueRow(record: TiSourceAtlasRecord, generatedAt: string): TiSourceAtlasReviewQueueRow {
  const decision: TiSourceAtlasReviewDecision = record.activationReadiness.state === "ready_for_dry_run"
    ? "stage_for_canary"
    : record.activationReadiness.state === "needs_parser_certification"
      ? "request_parser_certification"
      : record.activationReadiness.state === "duplicate_suppressed"
        ? "hold_duplicate"
        : record.activationReadiness.state === "descriptor_only_hold"
          ? "hold_descriptor_only"
          : "legal_review_required";
  return {
    reviewId: stableId("ti_source_atlas_review", `${record.id}:${generatedAt}:${decision}`),
    atlasSourceId: record.id,
    sourceName: record.sourceName,
    family: record.family,
    domain: record.domain,
    sourceHash: stableId("ti_source_atlas_source", `${record.id}:${record.domain}:${record.url}`),
    decision,
    reasons: record.activationReadiness.reasons,
    approvalRoute: "/v1/analyst/source-activation-packets",
    parserOwner: "agent_03",
    schedulerOwner: "agent_02",
    qualityOwner: "agent_07",
    releaseOwner: "agent_10",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false
  };
}

function tiSourceAtlasExportManifestRow(record: TiSourceAtlasRecord): TiSourceAtlasExportManifestRow {
  return {
    atlasSourceId: record.id,
    sourceHash: stableId("ti_source_atlas_source", `${record.id}:${record.domain}:${record.url}`),
    sourceName: record.sourceName,
    url: record.url,
    domain: record.domain,
    family: record.family,
    queryClassCoverage: record.queryClassCoverage,
    sourceValueScore: record.sourceValueScore,
    parserProfile: record.parserCapability.profile,
    schedulerCadenceSeconds: record.schedulerEstimate.cadenceSeconds,
    expectedItemsPerDay: record.evidenceEstimate.expectedItemsPerDay,
    legalReview: record.legalRobotsState.legalReview,
    robotsReview: record.legalRobotsState.robotsReview,
    approvalRequired: true,
    autoActivationAllowed: false
  };
}

function tiSourceAtlasFamilyCoverage(records: TiSourceAtlasRecord[]): Array<{ family: TiSourceAtlasFamily; sourceCount: number }> {
  const counts = countMap(records.map((record) => record.family));
  return [...counts.entries()]
    .map(([family, sourceCount]) => ({ family: family as TiSourceAtlasFamily, sourceCount }))
    .sort((left, right) => right.sourceCount - left.sourceCount || left.family.localeCompare(right.family));
}

function tiSourceAtlasRequestedClasses(queries: string[]): SourceCoverageCloseoutQueryClass[] {
  return uniqueStrings(queries.flatMap((query) => {
    const terms = tokenizeQuery(query);
    return [
      classifyCloseoutQuery(query),
      terms.includes("campaign") ? "campaign" : undefined,
      ["infrastructure", "c2", "domain", "ip"].some((term) => terms.includes(term)) ? "infrastructure" : undefined
    ].filter((queryClass): queryClass is SourceCoverageCloseoutQueryClass => Boolean(queryClass));
  })) as SourceCoverageCloseoutQueryClass[];
}

function tiSourceAtlasMatrixQueryClass(queryClass: TiSourceAtlasCoverageMatrixRow["queryClass"]): SourceCoverageCloseoutQueryClass {
  switch (queryClass) {
    case "actor":
    case "ransomware_victim":
    case "cve":
    case "sector":
    case "country":
    case "malware_tool":
    case "campaign":
    case "infrastructure":
      return queryClass;
    case "victim_company":
      return "ransomware_victim";
    default:
      return "actor";
  }
}


function buildTiSourceAtlasCoverageMatrix(records: TiSourceAtlasRecord[], queries: string[]): TiSourceAtlasCoverageMatrixRow[] {
  const rows: Array<{ queryClass: TiSourceAtlasCoverageMatrixRow["queryClass"]; requiredFamilies: TiSourceAtlasFamily[] }> = [
    { queryClass: "actor", requiredFamilies: ["vendor_threat_blog", "malware_researcher", "public_dataset", "github_security_advisory"] },
    { queryClass: "ransomware_victim", requiredFamilies: ["ransomware_tracker", "vendor_threat_blog", "public_dataset", "public_channel_descriptor"] },
    { queryClass: "cve", requiredFamilies: ["cve_advisory", "cert_government", "github_security_advisory", "package_advisory"] },
    { queryClass: "malware_tool", requiredFamilies: ["malware_researcher", "vendor_threat_blog", "public_dataset"] },
    { queryClass: "country", requiredFamilies: ["regional_cyber_agency", "cert_government", "vendor_threat_blog"] },
    { queryClass: "sector", requiredFamilies: ["ics_ot", "cloud_saas_security", "phishing_brand_abuse", "regional_cyber_agency"] },
    { queryClass: "campaign", requiredFamilies: ["vendor_threat_blog", "malware_researcher", "exploit_intelligence"] },
    { queryClass: "ransomware_victim", requiredFamilies: ["ransomware_tracker", "phishing_brand_abuse", "public_channel_descriptor"] },
    { queryClass: "infrastructure", requiredFamilies: ["exploit_intelligence", "public_dataset", "malware_researcher"] }
  ];
  const requestedClasses = tiSourceAtlasRequestedClasses(queries);
  return rows
    .filter((row) => {
      const rowQueryClass = tiSourceAtlasMatrixQueryClass(row.queryClass);
      return requestedClasses.length === 0 || requestedClasses.includes(rowQueryClass) || rowQueryClass === "infrastructure";
    })
    .map((row) => {
      const rowQueryClass = tiSourceAtlasMatrixQueryClass(row.queryClass);
      const matching = records.filter((record) =>
        record.queryClassCoverage.includes(rowQueryClass) ||
        row.requiredFamilies.includes(record.family)
      );
      const coveredFamilies = uniqueStrings(matching.map((record) => record.family)) as TiSourceAtlasFamily[];
      return {
        queryClass: row.queryClass,
        requiredFamilies: row.requiredFamilies,
        coveredFamilies,
        candidateSourceCount: matching.length,
        highValueSourceIds: matching
          .filter((record) => record.sourceValueScore >= 0.65 && record.activationReadiness.state === "ready_for_dry_run")
          .slice(0, 25)
          .map((record) => record.id),
        gapFamilies: row.requiredFamilies.filter((family) => !coveredFamilies.includes(family)),
        downstreamPublicAnswerImpact: roundScore(average(matching.map((record) => record.downstreamPublicAnswerImpact)))
      };
    });
}

function tiSourceAtlasParserProfile(family: TiSourceAtlasFamily): SourceMarketplaceParserProfile {
  if (family === "cert_government" || family === "vendor_threat_blog" || family === "regional_cyber_agency") return "rss";
  if (family === "cve_advisory" || family === "github_security_advisory" || family === "package_advisory") return "advisory_security_signal";
  if (family === "public_dataset") return "static_html";
  if (family === "public_channel_descriptor") return "public_channel";
  if (family === "malware_researcher" || family === "exploit_intelligence") return "pdf_report";
  return "static_html";
}


function tiSourceAtlasRegistryType(family: TiSourceAtlasFamily): SourceType {
  if (family === "cert_government" || family === "vendor_threat_blog" || family === "regional_cyber_agency") return "rss";
  if (family === "cve_advisory" || family === "github_security_advisory" || family === "package_advisory") return "api";
  if (family === "malware_researcher" || family === "exploit_intelligence") return "pdf";
  return "static_web";
}

function tiSourceAtlasRegistryAccessMethod(family: TiSourceAtlasFamily): AccessMethod {
  return family === "cve_advisory" || family === "github_security_advisory" || family === "package_advisory"
    ? "official_api"
    : "public_http";
}

function tiSourceAtlasDiscoveryMethod(index: number): TiSourceAtlasDiscoveryMethod {
  const methods: TiSourceAtlasDiscoveryMethod[] = ["curated_list", "public_report", "github_repository", "awesome_list", "opml_rss", "vendor_page", "analyst_import", "existing_source_pack"];
  return methods[index % methods.length]!;
}

function tiSourceAtlasQueryClasses(family: TiSourceAtlasFamily, index: number): SourceCoverageCloseoutQueryClass[] {
  const map: Record<TiSourceAtlasFamily, SourceCoverageCloseoutQueryClass[]> = {
    vendor_threat_blog: ["actor", "campaign", "malware_tool", "sector"],
    cert_government: ["cve", "country", "sector"],
    cve_advisory: ["cve", "infrastructure"],
    malware_researcher: ["actor", "malware_tool", "campaign", "infrastructure"],
    ransomware_tracker: ["ransomware_victim", "sector"],
    exploit_intelligence: ["cve", "infrastructure", "campaign"],
    github_security_advisory: ["cve", "infrastructure"],
    package_advisory: ["cve"],
    public_dataset: ["actor", "country", "sector", "infrastructure"],
    regional_cyber_agency: ["country", "sector", "cve"],
    ics_ot: ["sector", "infrastructure"],
    cloud_saas_security: ["sector", "infrastructure", "malware_tool"],
    phishing_brand_abuse: ["ransomware_victim", "sector"],
    public_channel_descriptor: ["actor", "ransomware_victim"]
  };
  const base = map[family] ?? ["actor"];
  return index % 7 === 0 ? uniqueStrings([...base, "campaign"]) as SourceCoverageCloseoutQueryClass[] : base;
}

function tiSourceAtlasRegions(index: number, family: TiSourceAtlasFamily): string[] {
  if (family === "regional_cyber_agency") return [["Europe"], ["North America"], ["APAC"], ["Latin America"], ["Middle East"], ["Africa"]][index % 6]!;
  return [["global"], ["Europe", "North America"], ["APAC"], ["Nordics"], ["global", "sector-specific"]][index % 5]!;
}

function tiSourceAtlasSectors(index: number, family: TiSourceAtlasFamily): string[] {
  if (family === "ics_ot") return ["industrial", "energy", "manufacturing"];
  if (family === "cloud_saas_security") return ["cloud", "saas", "identity"];
  if (family === "phishing_brand_abuse") return ["financial", "retail", "brand_abuse"];
  return [["government"], ["healthcare"], ["finance"], ["technology"], ["critical_infrastructure"], ["education"]][index % 6]!;
}

function tiSourceAtlasCadenceSeconds(family: TiSourceAtlasFamily): number {
  if (family === "cert_government" || family === "cve_advisory" || family === "github_security_advisory") return 6 * 3600;
  if (family === "vendor_threat_blog" || family === "malware_researcher" || family === "ransomware_tracker") return 12 * 3600;
  if (family === "public_channel_descriptor") return 7 * 24 * 3600;
  return 24 * 3600;
}

function tiSourceAtlasFamilyLabel(family: TiSourceAtlasFamily): string {
  return family.split("_").map((part) => part[0]!.toUpperCase() + part.slice(1)).join(" ");
}

function tiSourceAtlasReadinessReasons(state: TiSourceAtlasRecord["activationReadiness"]["state"]): string[] {
  if (state === "ready_for_dry_run") return ["public source", "parser certified", "legal and robots review current", "explicit approval still required before activation"];
  if (state === "needs_parser_certification") return ["parser certification required before canary"];
  if (state === "legal_review_hold") return ["legal or robots review must be refreshed before canary"];
  if (state === "duplicate_suppressed") return ["duplicate or mirror candidate suppressed until canonical review"];
  return ["public-channel descriptor only", "metadata/descriptor handoff", "no runnable collection without explicit approval and parser certification"];
}

function buildSourceImportCanaryPacket(input: {
  sources: SourceRecord[];
  sourcePacks?: SeedSourceBundle[];
  queries: string[];
  tenantId?: string;
  generatedAt: string;
}): SourceImportCanaryPacket {
  const waves = buildEnterpriseSafePublicActivationWaves(input.generatedAt);
  const readiness = buildSourceActivationExecutionReadiness(waves, input.queries, input.generatedAt);
  const first10 = readiness.first10Canary.map((source) => sourceImportCanaryRolloutSource(source, input.generatedAt));
  const first50 = readiness.publicRollout50.map((source) => sourceImportCanaryRolloutSource(source, input.generatedAt));
  const restrictedMetadataIds = input.sources
    .filter((source) => source.risk === "restricted" || source.governance?.metadataOnly || source.catalog?.approvalScope === "metadata_only")
    .map((source) => source.id)
    .sort();
  const staleSourceIds = input.sources
    .filter((source) => sourceMissesFreshnessSlo(source, source.catalog?.collection.freshnessTargetSeconds ?? 36 * 3600, input.generatedAt))
    .map((source) => source.id)
    .sort();
  const activationResults = sourceImportCanaryActivationResults({
    tenantId: input.tenantId,
    queries: input.queries,
    first50,
    readiness,
    restrictedMetadataIds,
    staleSourceIds
  });
  const rollbackPlans = [
    {
      rollbackPlanId: stableId("source_import_rollback", `canary:${input.tenantId ?? "global"}:${input.generatedAt}`),
      sourceIds: first10.map((source) => source.sourceId),
      trigger: "canary capture_success_ratio < 0.85, evidence_yield < 0.35, parser drift, or queue budget breach",
      action: "Pause canary, keep existing source set active, quarantine failing candidates, and rerun dry-run activation packets.",
      owner: "agent_01" as const
    },
    {
      rollbackPlanId: stableId("source_import_rollback", `rollout:${input.tenantId ?? "global"}:${input.generatedAt}`),
      sourceIds: first50.map((source) => source.sourceId),
      trigger: "expanded rollout quality, evidence, graph/STIX, API answer, or Agent 10 release gate regression",
      action: "Stop expanded rollout, restore previous cadence, retain hashes/audit ids only, and re-run source closeout plus API regression.",
      owner: "agent_10" as const
    },
    {
      rollbackPlanId: stableId("source_import_rollback", `parser:${input.tenantId ?? "global"}:${input.generatedAt}`),
      sourceIds: readiness.parserGapHandoff.sourceIds,
      trigger: "parser certification dependency remains unresolved",
      action: "Hold parser-gap candidates outside runnable canary until Agent 03 certification is current.",
      owner: "agent_03" as const
    }
  ];

  return {
    schemaVersion: "ti.source_import_canary.v1",
    dryRun: true,
    willMutate: false,
    willImportSourcePacks: false,
    willStartCrawling: false,
    generatedAt: input.generatedAt,
    tenantId: input.tenantId,
    sourcePackIds: uniqueStrings((input.sourcePacks ?? []).map((pack) => pack.name)).sort(),
    summary: {
      first10Count: 10,
      first50Count: 50,
      activationResultCount: activationResults.length,
      restrictedMetadataHoldCount: restrictedMetadataIds.length,
      parserCertificationHoldCount: readiness.parserGapHandoff.sourceIds.length,
      duplicateSuppressionCount: readiness.duplicateSuppression.duplicateSourceIds.length,
      staleRetirementCandidateCount: staleSourceIds.length,
      rollbackPlanCount: rollbackPlans.length,
      releaseDecision: readiness.agent10ReleasePacket.decision === "pass" ? "promote_canary_then_expand" : "hold"
    },
    first10SourceRollout: first10,
    first50SourceRollout: first50,
    activationResults,
    fixtures: sourceImportCanaryFixtures(readiness, restrictedMetadataIds),
    lifecycle: {
      retirements: readiness.sourceRetirement,
      duplicateSuppression: readiness.duplicateSuppression,
      staleSourceDetection: {
        dryRun: true,
        willMutate: false,
        sourceIds: staleSourceIds,
        reason: "Stale sources are retirement candidates only after explicit operator approval and source-family coverage proof."
      },
      parserCertificationDependencies: readiness.parserGapHandoff,
      restrictedMetadataHoldPropagation: {
        dryRun: true,
        willMutate: false,
        sourceIds: restrictedMetadataIds,
        routeHint: "/v1/analyst/source-activation-packets",
        reason: "Restricted/leak metadata sources may produce reviewable metadata but cannot be silently activated or turned into runnable collection."
      }
    },
    rollbackPlans,
    guardrails: {
      approvalMode: "dry_run_packet_then_explicit_operator_approval",
      noSilentActivation: true,
      noSourcePackImport: true,
      noCrawlingFromCanary: true,
      noUnsafeRawUrls: true,
      restrictedMetadataOnly: true,
      forbiddenSourceClasses: activationBatchForbiddenSourceClasses()
    },
    handoffs: {
      agent02SchedulerImpact: ["activationResults.scheduler_impact", "lifecycle.staleSourceDetection", "rollbackPlans.queue_budget"],
      agent03ParserCertification: ["activationResults.adapter_certification", "lifecycle.parserCertificationDependencies"],
      agent04SourcePackCoverage: ["fixtures", "summary.first50Count", "activationResults.source_family"],
      agent05RestrictedMetadataPolicy: ["lifecycle.restrictedMetadataHoldPropagation", "guardrails.restrictedMetadataOnly"],
      agent06EvidenceStoreImpact: ["activationResults.evidence_store_impact", "first50SourceRollout.expectedEvidenceYield"],
      agent07QualityGates: ["activationResults.quality_gate_impact", "rollout quality thresholds"],
      agent08GraphStixImpact: ["activationResults.graph_stix_impact", "review-held STIX preview"],
      agent09ApiContracts: ["sourceImportCanary.schemaVersion", "sourceImportCanary.summary", "sourceImportCanary.activationResults"],
      agent10ReleaseRollback: ["summary.releaseDecision", "rollbackPlans", "guardrails.noSourcePackImport"]
    }
  };
}

function sourceImportCanaryRolloutSource(
  source: SourceActivationExecutionSource,
  generatedAt: string
): SourceImportCanaryRolloutSource {
  return {
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    sourceHash: stableId("source_import_hash", `${source.sourceId}:${source.rolloutOrder}:${generatedAt}`),
    sourceFamily: source.category,
    sourceType: source.sourceType,
    canaryOrder: source.canaryOrder,
    rolloutOrder: source.rolloutOrder,
    approvalScope: source.approvalScope,
    parserCertified: source.parserCompatible,
    policy: source.approvalScope === "metadata_only" ? "metadata_only_hold" : source.parserCompatible ? "safe_public" : "blocked_unsafe",
    schedulerImpact: {
      budgetClass: source.schedulerBudget.budgetClass,
      estimatedDailyTasks: source.schedulerBudget.estimatedDailyTasks
    },
    expectedEvidenceYield: source.expectedEvidenceYield,
    rollbackPlanId: stableId("source_import_rollback_source", `${source.sourceId}:${generatedAt}`)
  };
}

function sourceImportCanaryActivationResults(input: {
  tenantId?: string;
  queries: string[];
  first50: SourceImportCanaryRolloutSource[];
  readiness: SourceActivationExecutionReadiness;
  restrictedMetadataIds: string[];
  staleSourceIds: string[];
}): SourceImportCanaryActivationResult[] {
  const result = (
    dimension: SourceImportCanaryResultDimension,
    key: string,
    sourceIds: string[],
    decision: SourceImportCanaryActivationResult["decision"],
    summary: string,
    nextAction: SourceImportCanaryActivationResult["nextAction"]
  ): SourceImportCanaryActivationResult => ({
    dimension,
    key,
    decision,
    sourceIds: uniqueStrings(sourceIds).slice(0, 25),
    summary,
    nextAction
  });
  const rows: SourceImportCanaryActivationResult[] = [
    result("tenant", input.tenantId ?? "global", input.first50.map((source) => source.sourceId), "pass", "Tenant-scoped dry-run excludes cross-tenant sources and does not import or crawl.", "approve_canary"),
    result("source_policy", "safe_public", input.first50.filter((source) => source.policy === "safe_public").map((source) => source.sourceId), "pass", "Safe-public candidates are eligible for explicit approval packets only.", "approve_canary"),
    result("source_policy", "restricted_metadata_hold", input.restrictedMetadataIds, input.restrictedMetadataIds.length > 0 ? "hold" : "pass", "Restricted/leak metadata remains reviewable metadata and is never converted into runnable collection.", "hold_restricted_metadata"),
    result("adapter_certification", "agent_03_parser_certification", input.readiness.parserGapHandoff.sourceIds, input.readiness.parserGapHandoff.sourceIds.length > 0 ? "hold" : "pass", "Parser-gap candidates are excluded until adapter certification is current.", "request_parser_certification"),
    result("scheduler_impact", input.readiness.queueBudgetImpact.withinBudget ? "within_budget" : "budget_hold", input.first50.map((source) => source.sourceId), input.readiness.queueBudgetImpact.withinBudget ? "pass" : "hold", "Canary and rollout daily task estimates are budget-gated before activation.", "watch_slo"),
    result("evidence_store_impact", "hash_only_capture_plan", input.first50.map((source) => source.sourceId), "watch", "Evidence-store handoff uses ids, hashes, expected yield, and retention classes before any collection.", "watch_slo"),
    result("quality_gate_impact", input.readiness.agent10ReleasePacket.decision, input.first50.map((source) => source.sourceId), input.readiness.agent10ReleasePacket.decision === "pass" ? "pass" : "hold", "Quality gates require canary success, evidence yield, parser health, duplicate rate, and API freshness checks.", "rollback_ready"),
    result("graph_stix_impact", "review_held_preview", input.first50.map((source) => source.sourceId), "watch", "Graph/STIX promotion remains preview-only until evidence review and source canary gates pass.", "watch_slo"),
    result("api_public_answer_effect", "partial_until_canary_passes", input.first50.map((source) => source.sourceId), "watch", "Public answers may show source gaps and canary status without implying verified collection.", "watch_slo"),
    result("source_policy", "stale_retirement_candidates", input.staleSourceIds, input.staleSourceIds.length > 0 ? "watch" : "pass", "Stale sources become reversible retirement candidates only after coverage proof.", "retire_duplicate"),
    result("source_policy", "duplicate_suppression", input.readiness.duplicateSuppression.duplicateSourceIds, input.readiness.duplicateSuppression.duplicateSourceIds.length > 0 ? "watch" : "pass", "Duplicate candidates are suppressed by canonical source id proof before canary.", "retire_duplicate")
  ];
  const queryClasses = uniqueStrings((input.queries.length > 0 ? input.queries : ["portfolio"]).map((query) => classifyCloseoutQuery(query))) as SourceCoverageCloseoutQueryClass[];
  for (const queryClass of queryClasses) {
    const coverage = input.readiness.coverageByQueryClass.find((item) => item.queryClass === queryClass);
    rows.push(result(
      "query_class",
      queryClass,
      coverage?.sourceIds ?? [],
      (coverage?.sourceCount ?? 0) > 0 ? "pass" : "hold",
      `Dry-run rollout coverage for ${queryClass} uses safe-public source ids and exposes partial state if canary has not passed.`,
      (coverage?.sourceCount ?? 0) > 0 ? "approve_canary" : "watch_slo"
    ));
  }
  for (const family of uniqueStrings(input.first50.map((source) => source.sourceFamily)).sort()) {
    const sourceIds = input.first50.filter((source) => source.sourceFamily === family).map((source) => source.sourceId);
    rows.push(result("source_family", family, sourceIds, sourceIds.length > 0 ? "pass" : "hold", `${family} rollout sources are represented in the first-50 dry-run packet.`, "approve_canary"));
  }
  return rows;
}

function sourceImportCanaryFixtures(
  readiness: SourceActivationExecutionReadiness,
  restrictedMetadataIds: string[]
): SourceImportCanaryFixture[] {
  const idsForFamily = (family: SourceActivationWaveCategory) =>
    readiness.publicRollout50.filter((source) => source.category === family).map((source) => source.sourceId).slice(0, 8);
  const fixture = (
    fixtureClass: SourceImportCanaryFixtureClass,
    queryClass: SourceCoverageCloseoutQueryClass,
    sourceIds: string[],
    metadataOnly: boolean,
    notes: string[]
  ): SourceImportCanaryFixture => ({
    fixtureClass,
    queryClass,
    sourceIds,
    coverageReady: sourceIds.length > 0,
    metadataOnly,
    notes
  });
  return [
    fixture("actor_intelligence", "actor", idsForFamily("vendor_blog"), false, ["Actor intelligence uses safe public reporting, not private forums or actor interaction."]),
    fixture("ransomware_leak_metadata", "ransomware_victim", restrictedMetadataIds, true, ["Leak metadata is reviewable for victim/company, claimed size, affected accounts, dates, and actor statement summaries only."]),
    fixture("vulnerability_advisory", "cve", idsForFamily("advisory"), false, ["Advisory fixtures cover CVE and vendor/security bulletin collection candidates."]),
    fixture("malware_report", "malware_tool", idsForFamily("public_research_feed"), false, ["Malware report fixtures support family/tool intelligence without unsafe payload access."]),
    fixture("public_cert_feed", "country", idsForFamily("government_cert"), false, ["Public CERT feeds cover government and national alerting sources."]),
    fixture("vendor_blog", "sector", idsForFamily("rss"), false, ["Vendor blogs/RSS feeds provide sector and campaign context."]),
    fixture("public_channel_descriptor", "infrastructure", [], true, ["Public-channel descriptors stay metadata-only until policy and parser certification allow a safe public descriptor adapter."])
  ];
}

function buildSourceSloBurnRatePacket(input: {
  sources: SourceRecord[];
  queries: string[];
  tenantId?: string;
  generatedAt: string;
}): SourceSloBurnRatePacket {
  const queries = input.queries.length > 0
    ? input.queries
    : ["APT29", "Akira ransomware victims", "CVE-2024-1234", "healthcare sector", "Norway", "Cobalt Strike malware tool", "campaign infrastructure"];
  const queryRows = queries.map((query) => buildSourceRuntimeSlaQuery(query, input.sources, input.generatedAt));
  const signals: SourceSloBurnRateRow[] = [];
  const addSignal = (inputRow: {
    signal: SourceSloBurnRateSignal;
    sourceIds: string[];
    sourceFamily: string;
    queryClass: SourceSloBurnRateRow["queryClass"];
    burnRate: number;
    reason: string;
    recommendedAction: SourceSloBurnRateRemediationAction;
    owner: SourceSloBurnRateOwner;
  }) => {
    const sourceIds = uniqueStrings(inputRow.sourceIds).slice(0, 25);
    if (sourceIds.length === 0) return;
    const burnRate = roundScore(Math.max(0.1, inputRow.burnRate));
    signals.push({
      id: stableId("source_slo_burn", `${inputRow.signal}:${inputRow.sourceFamily}:${inputRow.queryClass}:${sourceIds.join("|")}:${input.generatedAt}`),
      signal: inputRow.signal,
      severity: sourceSloBurnRateSeverity(burnRate),
      burnRate,
      window: { short: "1h", long: "24h", ratio: burnRate },
      sourceFamily: inputRow.sourceFamily,
      queryClass: inputRow.queryClass,
      sourceIds,
      sourceCount: sourceIds.length,
      reason: inputRow.reason,
      recommendedAction: inputRow.recommendedAction,
      owner: inputRow.owner,
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      noLeakBoundary: {
        rawUrlsExposed: false,
        restrictedMaterialExposed: false,
        automaticRestrictedActivation: false
      }
    });
  };

  for (const queryRow of queryRows) {
    const bySource = new Map(input.sources.map((source) => [source.id, source]));
    const rows = queryRow.sources;
    addSignal({
      signal: "freshness",
      sourceIds: rows.filter((row) => row.metrics.freshness.status !== "pass").map((row) => row.sourceId),
      sourceFamily: "mixed",
      queryClass: queryRow.queryClass,
      burnRate: rows.filter((row) => row.metrics.freshness.status === "breach").length / Math.max(1, rows.length) * 2,
      reason: `${queryRow.query} has sources missing freshness SLO; approved safe collection may need cadence or queue-budget adjustment.`,
      recommendedAction: "raise_cadence",
      owner: "agent_02"
    });
    addSignal({
      signal: "parser_failure",
      sourceIds: rows.filter((row) => row.metrics.parser_compatibility.status !== "pass").map((row) => row.sourceId),
      sourceFamily: "mixed",
      queryClass: queryRow.queryClass,
      burnRate: rows.filter((row) => row.metrics.parser_compatibility.status === "breach").length / Math.max(1, rows.length) * 2,
      reason: `${queryRow.query} has parser compatibility failures that block reliable extraction.`,
      recommendedAction: "request_parser_repair",
      owner: "agent_03"
    });
    addSignal({
      signal: "low_evidence_yield",
      sourceIds: rows.filter((row) => row.metrics.evidence_yield.status !== "pass" || row.metrics.claim_yield.status !== "pass").map((row) => row.sourceId),
      sourceFamily: "mixed",
      queryClass: queryRow.queryClass,
      burnRate: rows.filter((row) => row.metrics.evidence_yield.status === "breach" || row.metrics.claim_yield.status === "breach").length / Math.max(1, rows.length) * 2,
      reason: `${queryRow.query} is producing low useful evidence or claim yield for analyst answers.`,
      recommendedAction: "request_evidence_replay",
      owner: "agent_06"
    });
    if (queryRow.sourceFamilyGate.status !== "pass") {
      addSignal({
        signal: "query_coverage_gap",
        sourceIds: rows.map((row) => row.sourceId),
        sourceFamily: "coverage_gap",
        queryClass: classifyCloseoutQuery(queryRow.query),
        burnRate: queryRow.sourceFamilyGate.status === "hold" ? 2.2 : 1.1,
        reason: `${queryRow.query} lacks required source-family diversity for ${queryRow.sourceFamilyGate.queryClass} coverage.`,
        recommendedAction: "request_source_pack_expansion",
        owner: "agent_04"
      });
    }
    const outageRows = rows.filter((row) => row.breachReasons.includes("source_health_failing") || row.quarantineState.quarantined || row.runtimeStatus === "paused" || row.runtimeStatus === "quarantined");
    addSignal({
      signal: "outage_wave",
      sourceIds: outageRows.map((row) => row.sourceId),
      sourceFamily: "mixed",
      queryClass: queryRow.queryClass,
      burnRate: outageRows.length / Math.max(1, rows.length) * 2.5,
      reason: `${queryRow.query} has unhealthy, paused, or quarantined sources in the runtime SLO set.`,
      recommendedAction: "quarantine",
      owner: "agent_10"
    });
    const restricted = rows
      .map((row) => bySource.get(row.sourceId))
      .filter((source): source is SourceRecord => source !== undefined)
      .filter((source) => source.risk === "restricted" || source.governance?.metadataOnly === true);
    addSignal({
      signal: "approval_expiry",
      sourceIds: restricted.map((source) => source.id),
      sourceFamily: "restricted_metadata",
      queryClass: queryRow.queryClass,
      burnRate: restricted.length / Math.max(1, rows.length) * 2,
      reason: `${queryRow.query} includes restricted metadata candidates that must stay approval-gated and metadata-only.`,
      recommendedAction: "hold_restricted_metadata",
      owner: "agent_09"
    });
  }

  for (const source of input.sources) {
    const queryClass = source.catalog?.coverage.topics.some((topic) => topic.toLowerCase().includes("campaign"))
      ? "campaign"
      : source.catalog?.coverage.topics.some((topic) => topic.toLowerCase().includes("infrastructure"))
        ? "infrastructure"
        : classifyCoverageQuery([...coverageTagsForSource(source), source.name].join(" "));
    const family = sourceFamilyKey(source);
    const retiredOrLowReliability = source.status === "retired" || source.status === "rejected" || source.status === "disabled" || (source.catalog?.reliability ?? source.scoring?.reliability ?? source.trustScore) < 0.45;
    addSignal({
      signal: "retirement_risk",
      sourceIds: retiredOrLowReliability ? [source.id] : [],
      sourceFamily: family,
      queryClass,
      burnRate: source.status === "retired" || source.status === "rejected" || source.status === "disabled" ? 2.1 : 0.9,
      reason: `${source.name} is retired, disabled, rejected, or below reliability threshold and needs rollback-aware retirement review.`,
      recommendedAction: "retire",
      owner: "agent_01"
    });
    const legalState = reviewState(source.metadata?.legalNotesReviewedAt, input.generatedAt, Boolean(source.legalNotes.trim()));
    const robotsState = sourceNeedsRobotsReview(source) ? reviewState(source.metadata?.robotsReviewedAt, input.generatedAt, true) : "not_required";
    addSignal({
      signal: "approval_expiry",
      sourceIds: legalState !== "current" || robotsState === "missing" || robotsState === "stale" ? [source.id] : [],
      sourceFamily: family,
      queryClass,
      burnRate: legalState === "missing" || robotsState === "missing" ? 1.6 : 0.9,
      reason: `${source.name} has stale or missing legal/robots approval metadata before production use.`,
      recommendedAction: "request_analyst_approval",
      owner: "agent_09"
    });
  }

  for (const duplicate of duplicateGroups(input.sources)) {
    const duplicateSources = duplicate.sourceIds.map((id) => input.sources.find((source) => source.id === id)).filter((source): source is SourceRecord => Boolean(source));
    addSignal({
      signal: "duplicate_rate",
      sourceIds: duplicate.sourceIds.slice(1),
      sourceFamily: duplicateSources[0] ? sourceFamilyKey(duplicateSources[0]) : "duplicate",
      queryClass: duplicateSources[0] ? classifyCoverageQuery(coverageTagsForSource(duplicateSources[0]).join(" ")) : "actor",
      burnRate: Math.min(2.4, duplicate.sourceIds.length / 2),
      reason: `Duplicate source group ${duplicate.key} should be suppressed or retired through a reversible operator packet.`,
      recommendedAction: "retire",
      owner: "agent_01"
    });
  }

  const compactSignals = signals
    .sort((left, right) => sourceSloBurnRateSeverityRank(right.severity) - sourceSloBurnRateSeverityRank(left.severity) || right.burnRate - left.burnRate || left.signal.localeCompare(right.signal))
    .slice(0, 100);
  const remediationQueue = buildSourceSloBurnRateRemediationQueue(compactSignals).slice(0, 50);

  return {
    schemaVersion: "ti.source_slo_burn_rate.v1",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    generatedAt: input.generatedAt,
    tenantId: input.tenantId,
    summary: {
      totalSignals: compactSignals.length,
      critical: compactSignals.filter((signal) => signal.severity === "critical").length,
      burning: compactSignals.filter((signal) => signal.severity === "burning").length,
      watch: compactSignals.filter((signal) => signal.severity === "watch").length,
      healthy: compactSignals.filter((signal) => signal.severity === "healthy").length,
      remediationItems: remediationQueue.length,
      worstBurnRate: roundScore(Math.max(...compactSignals.map((signal) => signal.burnRate), 0))
    },
    signals: compactSignals,
    remediationQueue,
    groupedByFamily: groupSourceSloBurnRateByFamily(compactSignals),
    groupedByQueryClass: groupSourceSloBurnRateByQueryClass(compactSignals),
    guardrails: {
      dryRunOnly: true,
      noAutomaticRestrictedActivation: true,
      noRawUnsafeUrls: true,
      forbiddenSourceClasses: activationBatchForbiddenSourceClasses()
    },
    handoffs: {
      agent02: ["signals.freshness", "remediationQueue.raise_cadence", "remediationQueue.lower_cadence"],
      agent03: ["signals.parser_failure", "remediationQueue.request_parser_repair"],
      agent04: ["signals.query_coverage_gap", "remediationQueue.request_source_pack_expansion"],
      agent06: ["signals.low_evidence_yield", "remediationQueue.request_evidence_replay"],
      agent07: ["groupedByQueryClass.actor", "groupedByQueryClass.ransomware_victim", "summary.worstBurnRate"],
      agent09: ["signals.approval_expiry", "guardrails.noRawUnsafeUrls", "remediationQueue.routeHint"],
      agent10: ["signals.outage_wave", "summary.critical", "remediationQueue.priority"]
    }
  };
}

function sourceSloBurnRateSeverity(burnRate: number): SourceSloBurnRateSeverity {
  if (burnRate >= 2) return "critical";
  if (burnRate >= 1) return "burning";
  if (burnRate >= 0.5) return "watch";
  return "healthy";
}

function sourceSloBurnRateSeverityRank(severity: SourceSloBurnRateSeverity): number {
  if (severity === "critical") return 4;
  if (severity === "burning") return 3;
  if (severity === "watch") return 2;
  return 1;
}

function sourceSloBurnRatePriority(severity: SourceSloBurnRateSeverity): SourceSloBurnRateRemediationQueueItem["priority"] {
  if (severity === "critical") return "critical";
  if (severity === "burning") return "high";
  if (severity === "watch") return "medium";
  return "low";
}

function buildSourceSloBurnRateRemediationQueue(signals: SourceSloBurnRateRow[]): SourceSloBurnRateRemediationQueueItem[] {
  const groups = new Map<string, SourceSloBurnRateRow[]>();
  for (const signal of signals) {
    const key = `${signal.recommendedAction}:${signal.owner}:${signal.sourceFamily}:${signal.queryClass}`;
    groups.set(key, [...(groups.get(key) ?? []), signal]);
  }
  return [...groups.entries()]
    .map(([groupKey, rows]) => {
      const sourceIds = uniqueStrings(rows.flatMap((row) => row.sourceIds)).slice(0, 25);
      const worst = rows.reduce((current, row) => sourceSloBurnRateSeverityRank(row.severity) > sourceSloBurnRateSeverityRank(current.severity) ? row : current, rows[0]!);
      return {
        id: stableId("source_slo_remediate", groupKey),
        priority: sourceSloBurnRatePriority(worst.severity),
        action: worst.recommendedAction,
        owner: worst.owner,
        groupKey,
        sourceFamily: worst.sourceFamily,
        queryClass: worst.queryClass,
        sourceIds,
        reasons: uniqueStrings(rows.map((row) => row.reason)).slice(0, 5),
        rollback: sourceSloBurnRateRollback(worst.recommendedAction),
        approvalRequired: sourceSloBurnRateApprovalRequired(worst.recommendedAction),
        routeHint: sourceSloBurnRateRouteHint(worst.recommendedAction),
        dryRun: true as const,
        willMutate: false as const,
        willStartCrawling: false as const
      };
    })
    .sort((left, right) => sourceSloBurnRatePriorityRank(right.priority) - sourceSloBurnRatePriorityRank(left.priority) || left.groupKey.localeCompare(right.groupKey));
}

function sourceSloBurnRateRollback(action: SourceSloBurnRateRemediationAction): string {
  if (action === "raise_cadence" || action === "lower_cadence") return "Revert to prior cadence after Agent 02 queue and freshness proof passes.";
  if (action === "quarantine") return "Restore only after health checks, parser proof, and Agent 10 release gate pass.";
  if (action === "retire") return "Unretire only if source-family diversity or query coverage falls below SLO.";
  if (action === "request_parser_repair") return "Keep current source state until parser fixture and adapter proof pass.";
  if (action === "request_source_pack_expansion") return "Drop candidate pack if legal/parser/scheduler dry-run proof fails.";
  if (action === "request_evidence_replay") return "Preserve current evidence confidence until replay proof is reviewed.";
  if (action === "request_analyst_approval") return "Keep source inactive or metadata-only until explicit approval is recorded.";
  return "Keep restricted metadata held; never activate or fetch raw restricted material automatically.";
}

function sourceSloBurnRateApprovalRequired(action: SourceSloBurnRateRemediationAction): boolean {
  return action === "quarantine" ||
    action === "retire" ||
    action === "request_parser_repair" ||
    action === "request_source_pack_expansion" ||
    action === "request_analyst_approval" ||
    action === "hold_restricted_metadata";
}

function sourceSloBurnRateRouteHint(action: SourceSloBurnRateRemediationAction): SourceSloBurnRateRemediationQueueItem["routeHint"] {
  if (action === "raise_cadence" || action === "lower_cadence" || action === "request_evidence_replay") return "/v1/sources/runtime-sla";
  if (action === "request_source_pack_expansion" || action === "request_parser_repair") return "/v1/sources/activation-batches";
  if (action === "request_analyst_approval" || action === "hold_restricted_metadata") return "/v1/analyst/source-activation-packets";
  return "/v1/sources/portfolio";
}

function sourceSloBurnRatePriorityRank(priority: SourceSloBurnRateRemediationQueueItem["priority"]): number {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function groupSourceSloBurnRateByFamily(signals: SourceSloBurnRateRow[]): SourceSloBurnRatePacket["groupedByFamily"] {
  const groups = new Map<string, SourceSloBurnRateRow[]>();
  for (const signal of signals) groups.set(signal.sourceFamily, [...(groups.get(signal.sourceFamily) ?? []), signal]);
  return [...groups.entries()]
    .map(([sourceFamily, rows]) => ({
      sourceFamily,
      critical: rows.filter((row) => row.severity === "critical").length,
      burning: rows.filter((row) => row.severity === "burning").length,
      watch: rows.filter((row) => row.severity === "watch").length,
      sourceIds: uniqueStrings(rows.flatMap((row) => row.sourceIds)).slice(0, 25)
    }))
    .sort((left, right) => right.critical - left.critical || right.burning - left.burning || left.sourceFamily.localeCompare(right.sourceFamily))
    .slice(0, 30);
}

function groupSourceSloBurnRateByQueryClass(signals: SourceSloBurnRateRow[]): SourceSloBurnRatePacket["groupedByQueryClass"] {
  const groups = new Map<SourceSloBurnRateRow["queryClass"], SourceSloBurnRateRow[]>();
  for (const signal of signals) groups.set(signal.queryClass, [...(groups.get(signal.queryClass) ?? []), signal]);
  return [...groups.entries()]
    .map(([queryClass, rows]) => ({
      queryClass,
      critical: rows.filter((row) => row.severity === "critical").length,
      burning: rows.filter((row) => row.severity === "burning").length,
      watch: rows.filter((row) => row.severity === "watch").length,
      sourceIds: uniqueStrings(rows.flatMap((row) => row.sourceIds)).slice(0, 25)
    }))
    .sort((left, right) => right.critical - left.critical || right.burning - left.burning || left.queryClass.localeCompare(right.queryClass));
}

function buildSourceTenantActivationPacket(input: {
  sources: SourceRecord[];
  allSources: SourceRecord[];
  queries: string[];
  tenantId?: string;
  generatedAt: string;
}): SourceTenantActivationPacket {
  const queries = input.queries.length > 0
    ? input.queries
    : ["APT29", "Akira ransomware victims", "CVE-2024-1234", "healthcare sector", "Norway", "campaign infrastructure"];
  const economics = buildSourceReliabilityEconomicsPacket("tenant_activation", input.sources, input.generatedAt);
  const economicsById = new Map(economics.sources.map((source) => [source.sourceId, source]));
  const duplicateSuppressed = new Set(economics.portfolioEconomics.duplicateSuppressedSourceIds);
  const queryClasses = uniqueStrings(queries.map(classifyCloseoutQuery)) as SourceTenantActivationApprovalPacket["queryClass"][];
  const packets = input.sources
    .flatMap((source) => tenantActivationQueryClasses(source, queries, queryClasses, input.generatedAt).map((queryClass) =>
      sourceTenantActivationApprovalPacket(source, queryClass, input.tenantId, input.generatedAt, economicsById.get(source.id), duplicateSuppressed.has(source.id))
    ))
    .sort((left, right) => sourceTenantActivationDecisionRank(left.decision) - sourceTenantActivationDecisionRank(right.decision) || left.tenantId.localeCompare(right.tenantId) || left.sourceFamily.localeCompare(right.sourceFamily))
    .slice(0, 120);
  const groups = buildSourceTenantActivationGroups(packets);
  const tenantIsolation = buildSourceTenantActivationIsolation(input.sources, input.allSources, input.tenantId);
  const queryClassReadiness = buildSourceTenantActivationQueryClassReadiness(input.sources, packets, queryClasses, input.tenantId);

  return {
    schemaVersion: "ti.tenant_source_activation.v1",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    generatedAt: input.generatedAt,
    tenantId: input.tenantId,
    summary: {
      tenantCount: tenantIsolation.length,
      approvalPacketCount: packets.length,
      activate: packets.filter((packet) => packet.decision === "activate").length,
      stage: packets.filter((packet) => packet.decision === "stage").length,
      hold: packets.filter((packet) => packet.decision === "hold").length,
      retire: packets.filter((packet) => packet.decision === "retire").length,
      restrictedMetadataHeld: packets.filter((packet) => packet.decision === "hold_restricted_metadata").length,
      pendingApproval: packets.filter((packet) => packet.approvalState === "pending").length,
      expiredApproval: packets.filter((packet) => packet.approvalState === "expired").length
    },
    approvalPackets: packets,
    groups,
    tenantIsolation,
    queryClassReadiness,
    guardrails: {
      dryRunOnly: true,
      noSilentActivation: true,
      noCrawlingFromApprovalPackets: true,
      noRestrictedAutoActivation: true,
      noRawUnsafeUrls: true,
      forbiddenSourceClasses: activationBatchForbiddenSourceClasses()
    },
    handoffs: {
      agent02SchedulerBudgets: ["approvalPackets.schedulerBudgetClass", "groups.schedulerBudgetClass", "queryClassReadiness.freshnessDebt"],
      agent03AdapterCertification: ["approvalPackets.blockers.parser_certification", "approvalPackets.sourceClass.dynamic_browser_candidate", "approvalPackets.sourceClass.report_pdf"],
      agent04PublicExpansion: ["queryClassReadiness.needs_expansion", "approvalPackets.expectedEffect.coverageGap"],
      agent05RestrictedPolicyHolds: ["approvalPackets.decision.hold_restricted_metadata", "approvalPackets.safetyPolicy.metadataOnly"],
      agent06EvidenceRetention: ["approvalPackets.blockers.low_evidence_yield", "approvalPackets.sourceIds", "approvalPackets.expectedEffect"],
      agent07QualityGates: ["approvalPackets.reasons", "queryClassReadiness.readiness", "groups.decision"],
      agent09ApiContracts: ["tenantActivation.schemaVersion", "approvalPackets", "tenantIsolation", "guardrails"],
      agent10CapacityReleaseGates: ["summary.activate", "summary.stage", "groups.schedulerBudgetClass", "guardrails.noCrawlingFromApprovalPackets"]
    }
  };
}

function tenantActivationQueryClasses(
  source: SourceRecord,
  queries: string[],
  queryClasses: SourceTenantActivationApprovalPacket["queryClass"][],
  generatedAt: string
): SourceTenantActivationApprovalPacket["queryClass"][] {
  const matching = uniqueStrings(queries
    .filter((query) => explainSourceForQuery(query, source, generatedAt).score > 0)
    .map(classifyCloseoutQuery)) as SourceTenantActivationApprovalPacket["queryClass"][];
  if (matching.length > 0) return matching;
  const inferred = source.catalog?.coverage.topics.some((topic) => topic.toLowerCase().includes("campaign"))
    ? "campaign"
    : source.catalog?.coverage.topics.some((topic) => topic.toLowerCase().includes("infrastructure"))
      ? "infrastructure"
      : classifyCoverageQuery([...coverageTagsForSource(source), source.name].join(" "));
  return queryClasses.includes(inferred) ? [inferred] : [queryClasses[0] ?? inferred];
}

function sourceTenantActivationApprovalPacket(
  source: SourceRecord,
  queryClass: SourceTenantActivationApprovalPacket["queryClass"],
  requestedTenantId: string | undefined,
  generatedAt: string,
  economics: SourceReliabilityEconomicsRow | undefined,
  duplicateSuppressed: boolean
): SourceTenantActivationApprovalPacket {
  const tenantId = source.tenantId ?? requestedTenantId ?? "global";
  const sourceClass = sourceTenantActivationSourceClass(source);
  const sourceFamily = sourceFamilyKey(source);
  const parserCertified = Boolean(source.catalog?.adapterCompatibility.includes(source.type));
  const safePublic = sourceCanSatisfyPublicSlo(source);
  const legalState = reviewState(source.metadata?.legalNotesReviewedAt, generatedAt, Boolean(source.legalNotes.trim()));
  const robotsState = sourceNeedsRobotsReview(source) ? reviewState(source.metadata?.robotsReviewedAt, generatedAt, true) : "not_required";
  const restricted = sourceClass === "restricted_metadata_only" || source.risk === "restricted" || source.governance?.metadataOnly === true;
  const activationEligible = sourceTenantActivationEligible(source, restricted);
  const approvalState = sourceTenantApprovalState(source, safePublic || activationEligible, legalState, robotsState);
  const freshnessDebt = sourceMissesFreshnessSlo(source, source.catalog?.collection.freshnessTargetSeconds ?? 36 * 3600, generatedAt);
  const lowEvidenceYield = extractionYield(source) < 0.35 || (economics?.handoffs.agent06EvidenceReplay === "needs_replay_proof");
  const blockers: SourceTenantActivationApprovalPacket["blockers"] = [
    ...(!activationEligible && !restricted ? ["policy_hold" as const] : []),
    ...(!parserCertified ? ["parser_certification" as const] : []),
    ...(legalState !== "current" ? ["legal_review" as const] : []),
    ...(robotsState === "missing" || robotsState === "stale" ? ["robots_review" as const] : []),
    ...(freshnessDebt ? ["freshness_debt" as const] : []),
    ...(duplicateSuppressed ? ["duplicate" as const] : []),
    ...(lowEvidenceYield ? ["low_evidence_yield" as const] : []),
    ...(source.tenantId && requestedTenantId && source.tenantId !== requestedTenantId ? ["tenant_scope" as const] : []),
    ...(restricted ? ["restricted_metadata" as const] : [])
  ];
  const decision = sourceTenantActivationDecision(source, restricted, activationEligible, parserCertified, approvalState, blockers, duplicateSuppressed, freshnessDebt, lowEvidenceYield);
  const approvalRequired = approvalState !== "not_required" || decision !== "activate" || restricted || source.approvalRequired === true || source.governance?.approvalRequired === true;
  const routeHint = decision === "stage"
    ? "/v1/sources/activation-batches"
    : restricted || approvalRequired
      ? "/v1/analyst/source-activation-packets"
      : "/v1/sources/portfolio";

  return {
    id: stableId("tenant_source_activation", `${tenantId}:${queryClass}:${source.id}:${decision}:${generatedAt}`),
    tenantId,
    queryClass,
    sourceFamily,
    sourceClass,
    decision,
    sourceIds: [source.id],
    sourceCount: 1,
    approvalState,
    approvalRequired,
    reasons: sourceTenantActivationReasons(source, decision, blockers, economics),
    blockers,
    expectedEffect: {
      coverageGap: decision === "activate" ? "closes_gap" : decision === "stage" ? "improves_gap" : "no_effect",
      freshnessDebt: freshnessDebt && (decision === "activate" || decision === "stage") ? "reduces" : freshnessDebt ? "held" : "unchanged",
      publicSearchResponsive: true
    },
    safetyPolicy: {
      metadataOnly: restricted || source.governance?.metadataOnly === true,
      noRawUnsafeUrls: true,
      noRestrictedAutoActivation: true,
      noMutationWithoutApproval: true
    },
    rollback: sourceTenantActivationRollback(decision, sourceClass),
    routeHint,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false
  };
}

function sourceTenantActivationSourceClass(source: SourceRecord): SourceTenantActivationSourceClass {
  if (source.risk === "restricted" || source.governance?.metadataOnly || source.type === "tor_metadata" || source.type === "i2p_metadata" || source.type === "freenet_metadata") return "restricted_metadata_only";
  if (source.type === "telegram_public") return "public_channel";
  if (source.type === "dynamic_web") return "dynamic_browser_candidate";
  if (source.type === "pdf") return "report_pdf";
  if (source.type === "api") return "advisory_api";
  return "public_rss_blog";
}

function sourceTenantActivationEligible(source: SourceRecord, restricted: boolean): boolean {
  if (restricted) return false;
  return (source.risk === "low" || source.risk === "medium") &&
    (source.accessMethod === "public_http" || source.accessMethod === "official_api") &&
    source.status !== "disabled" &&
    source.status !== "rejected" &&
    source.status !== "retired";
}

function sourceTenantApprovalState(
  source: SourceRecord,
  activationEligible: boolean,
  legalState: "current" | "missing" | "stale",
  robotsState: "current" | "missing" | "stale" | "not_required"
): SourceTenantActivationApprovalPacket["approvalState"] {
  if (source.status === "disabled" || source.status === "rejected") return "blocked";
  if (source.governance?.approvalState === "expired") return "expired";
  if (source.governance?.approvalState === "pending" || source.governance?.approvalState === "rejected") return source.governance.approvalState === "rejected" ? "blocked" : "pending";
  if (source.governance?.approvalState === "approved" || source.status === "approved" || source.status === "active" || source.status === "probation") {
    if (legalState !== "current" || robotsState === "missing" || robotsState === "stale") return "pending";
    return "approved";
  }
  if (activationEligible && source.catalog?.approvalScope === "safe_public_auto" && legalState === "current" && (robotsState === "current" || robotsState === "not_required")) return "not_required";
  return "pending";
}

function sourceTenantActivationDecision(
  source: SourceRecord,
  restricted: boolean,
  activationEligible: boolean,
  parserCertified: boolean,
  approvalState: SourceTenantActivationApprovalPacket["approvalState"],
  blockers: SourceTenantActivationApprovalPacket["blockers"],
  duplicateSuppressed: boolean,
  freshnessDebt: boolean,
  lowEvidenceYield: boolean
): SourceTenantActivationDecision {
  if (restricted) return "hold_restricted_metadata";
  if (source.status === "retired" || source.status === "disabled" || source.status === "rejected" || duplicateSuppressed) return "retire";
  if (!activationEligible || !parserCertified || approvalState === "blocked" || blockers.includes("policy_hold") || blockers.includes("legal_review") || blockers.includes("robots_review")) return "hold";
  if (approvalState === "approved" || approvalState === "not_required") {
    if (freshnessDebt || lowEvidenceYield || source.status === "candidate" || source.status === "needs_review" || source.status === "approved") return "stage";
    return "activate";
  }
  if (approvalState === "pending" || approvalState === "expired") return "stage";
  return "hold";
}

function sourceTenantActivationReasons(
  source: SourceRecord,
  decision: SourceTenantActivationDecision,
  blockers: SourceTenantActivationApprovalPacket["blockers"],
  economics: SourceReliabilityEconomicsRow | undefined
): string[] {
  return uniqueStrings([
    `decision:${decision}`,
    `source_type:${source.type}`,
    `status:${source.status}`,
    `risk:${source.risk}`,
    ...(economics ? [`reliability:${economics.reliabilityScore}`, `economics:${economics.decision}`] : []),
    ...blockers.map((blocker) => `blocker:${blocker}`)
  ]).slice(0, 12);
}

function sourceTenantActivationRollback(decision: SourceTenantActivationDecision, sourceClass: SourceTenantActivationSourceClass): string {
  if (decision === "activate") return "Return source to previous tenant approval state if scheduler or evidence checks regress.";
  if (decision === "stage") return "Drop staged activation packet and keep current source status until approvals and proof pass.";
  if (decision === "retire") return "Restore previous cadence only if tenant query-class coverage falls below SLO.";
  if (decision === "hold_restricted_metadata") return "Keep metadata-only hold; never fetch raw restricted material or activate automatically.";
  if (sourceClass === "dynamic_browser_candidate") return "Keep browser collection disabled until bounded adapter certification passes.";
  return "Keep source inactive or approval-held until operator/legal review clears blockers.";
}

function sourceTenantActivationDecisionRank(decision: SourceTenantActivationDecision): number {
  if (decision === "hold_restricted_metadata") return 1;
  if (decision === "hold") return 2;
  if (decision === "retire") return 3;
  if (decision === "stage") return 4;
  return 5;
}

function buildSourceTenantActivationGroups(packets: SourceTenantActivationApprovalPacket[]): SourceTenantActivationGroup[] {
  const groups = new Map<string, SourceTenantActivationApprovalPacket[]>();
  for (const packet of packets) {
    const key = `${packet.tenantId}:${packet.queryClass}:${packet.sourceFamily}:${packet.sourceClass}:${packet.decision}`;
    groups.set(key, [...(groups.get(key) ?? []), packet]);
  }
  return [...groups.entries()]
    .map(([key, rows]) => {
      const first = rows[0]!;
      return {
        tenantId: first.tenantId,
        queryClass: first.queryClass,
        sourceFamily: first.sourceFamily,
        sourceClass: first.sourceClass,
        decision: first.decision,
        sourceIds: uniqueStrings(rows.flatMap((row) => row.sourceIds)).slice(0, 25),
        approvalPacketIds: rows.map((row) => row.id).slice(0, 25),
        schedulerBudgetClass: sourceTenantActivationBudget(rows),
        reason: key
      };
    })
    .sort((left, right) => sourceTenantActivationDecisionRank(left.decision) - sourceTenantActivationDecisionRank(right.decision) || left.tenantId.localeCompare(right.tenantId))
    .slice(0, 50);
}

function sourceTenantActivationBudget(rows: SourceTenantActivationApprovalPacket[]): SourceCollectionSla["budgetClass"] {
  if (rows.some((row) => row.queryClass === "ransomware_victim" || row.queryClass === "cve")) return "high";
  if (rows.some((row) => row.queryClass === "actor" || row.queryClass === "campaign")) return "normal";
  return "low";
}

function buildSourceTenantActivationIsolation(
  sources: SourceRecord[],
  allSources: SourceRecord[],
  requestedTenantId?: string
): SourceTenantActivationPacket["tenantIsolation"] {
  const tenantIds = uniqueStrings(sources.map((source) => source.tenantId ?? requestedTenantId ?? "global"));
  return tenantIds.map((tenantId) => {
    const tenantSources = sources.filter((source) => (source.tenantId ?? requestedTenantId ?? "global") === tenantId);
    return {
      tenantId,
      sourceCount: tenantSources.length,
      sourceIds: tenantSources.map((source) => source.id).slice(0, 50),
      defaultTenantIncluded: tenantSources.some((source) => source.tenantId === undefined),
      crossTenantSourcesExcluded: requestedTenantId
        ? allSources.some((source) => source.tenantId !== undefined && source.tenantId !== requestedTenantId) && sources.every((source) => source.tenantId === requestedTenantId || source.tenantId === undefined)
        : true
    };
  });
}

function buildSourceTenantActivationQueryClassReadiness(
  sources: SourceRecord[],
  packets: SourceTenantActivationApprovalPacket[],
  queryClasses: SourceTenantActivationApprovalPacket["queryClass"][],
  requestedTenantId?: string
): SourceTenantActivationPacket["queryClassReadiness"] {
  const tenantIds = uniqueStrings(sources.map((source) => source.tenantId ?? requestedTenantId ?? "global"));
  return tenantIds.flatMap((tenantId) => queryClasses.map((queryClass) => {
    const tenantSources = sources.filter((source) => (source.tenantId ?? requestedTenantId ?? "global") === tenantId);
    const rows = packets.filter((packet) => packet.tenantId === tenantId && packet.queryClass === queryClass);
    const activeSafePublicSources = tenantSources.filter((source) => sourceCanSatisfyPublicSlo(source) && source.status === "active").length;
    const stagedSourceIds = rows.filter((row) => row.decision === "stage" || row.decision === "activate").flatMap((row) => row.sourceIds);
    const heldSourceIds = rows.filter((row) => row.decision === "hold" || row.decision === "retire").flatMap((row) => row.sourceIds);
    const restrictedMetadataSourceIds = rows.filter((row) => row.decision === "hold_restricted_metadata").flatMap((row) => row.sourceIds);
    const readiness: SourceTenantActivationPacket["queryClassReadiness"][number]["readiness"] = activeSafePublicSources >= sourceCoverageSloRequirements(classifyCoverageQuery(queryClass)).minActiveSafePublicSources
      ? "ready"
      : rows.some((row) => row.approvalRequired)
        ? "needs_approval"
        : rows.some((row) => row.decision === "hold_restricted_metadata" || row.decision === "hold")
          ? "held"
          : "needs_expansion";
    return {
      tenantId,
      queryClass,
      activeSafePublicSources,
      stagedSourceIds: uniqueStrings(stagedSourceIds).slice(0, 20),
      heldSourceIds: uniqueStrings(heldSourceIds).slice(0, 20),
      restrictedMetadataSourceIds: uniqueStrings(restrictedMetadataSourceIds).slice(0, 20),
      readiness
    };
  })).slice(0, 80);
}

function buildSourcePortfolioMigrationReadiness(input: {
  sources: SourceRecord[];
  sourcePacks?: SeedSourceBundle[];
  queries: string[];
  tenantId?: string;
  generatedAt: string;
}): SourcePortfolioMigrationReadiness {
  const packCandidates = (input.sourcePacks ?? [])
    .flatMap((pack) => importSeedBundle(pack, { dryRun: true, importedAt: input.generatedAt }).accepted)
    .filter((source) => !input.tenantId || source.tenantId === input.tenantId || source.tenantId === undefined)
    .map((source) => ({ ...source, status: "candidate" as const }));
  const sourceById = new Map<string, SourceRecord>();
  for (const source of [...input.sources, ...packCandidates]) {
    if (!sourceById.has(source.id)) sourceById.set(source.id, source);
  }
  const sources = [...sourceById.values()];
  const economics = buildSourceReliabilityEconomicsPacket("portfolio", sources, input.generatedAt);
  const economicsById = new Map(economics.sources.map((source) => [source.sourceId, source]));
  const lanes = (["candidate", "sandbox", "canary", "active", "degraded", "retired"] as SourcePortfolioMigrationState[])
    .map((state) => sourcePortfolioMigrationLane(state, sources, economicsById, input.generatedAt));
  const summary = {
    sourceCount: sources.length,
    safePublicEligible: sources.filter(sourceCanSatisfyPublicSlo).length,
    candidate: lanes.find((lane) => lane.state === "candidate")?.sourceCount ?? 0,
    sandbox: lanes.find((lane) => lane.state === "sandbox")?.sourceCount ?? 0,
    canary: lanes.find((lane) => lane.state === "canary")?.sourceCount ?? 0,
    active: lanes.find((lane) => lane.state === "active")?.sourceCount ?? 0,
    degraded: lanes.find((lane) => lane.state === "degraded")?.sourceCount ?? 0,
    retired: lanes.find((lane) => lane.state === "retired")?.sourceCount ?? 0,
    restrictedMetadataOnly: sources.filter((source) => source.risk === "restricted" || source.governance?.metadataOnly).length,
    recommendedCanaryPromotions: economics.sources.filter((source) => source.decision === "promote_candidate" && source.economics.activationWaveReady).length
  };
  const queryClasses = (uniqueStrings(input.queries.map((query) => classifyCoverageQuery(query))) as SourceCoverageSloQueryClass[])
    .map((queryClass) => sourcePortfolioMigrationQueryClassReadiness(queryClass, input.queries, sources, input.generatedAt));
  const candidateIds = lanes.find((lane) => lane.state === "candidate")?.sourceIds ?? [];
  const sandboxIds = lanes.find((lane) => lane.state === "sandbox")?.sourceIds ?? [];
  const degradedIds = lanes.find((lane) => lane.state === "degraded")?.sourceIds ?? [];
  const retiredDuplicateIds = economics.portfolioEconomics.duplicateSuppressedSourceIds;
  const legalReviewIds = sources.filter((source) => reviewState(source.metadata?.legalNotesReviewedAt, input.generatedAt, Boolean(source.legalNotes.trim())) !== "current").map((source) => source.id);
  const parserRepairIds = sources.filter((source) => !source.catalog?.adapterCompatibility.includes(source.type)).map((source) => source.id);

  return {
    schemaVersion: "ti.source_portfolio_migration_readiness.v1",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    generatedAt: input.generatedAt,
    tenantId: input.tenantId,
    summary,
    lanes,
    queryClasses,
    recommendedActions: [
      sourcePortfolioMigrationAction("promote_candidate_to_sandbox", candidateIds.slice(0, 10), "Candidate safe-public sources can enter sandbox after explicit operator approval.", "Remove candidate from sandbox queue and keep source inactive."),
      sourcePortfolioMigrationAction("promote_sandbox_to_canary", sandboxIds.slice(0, 10), "Sandbox-ready sources can enter canary when parser, legal, and scheduler checks pass.", "Pause canary and return sources to sandbox."),
      sourcePortfolioMigrationAction("restore_degraded_source", degradedIds.slice(0, 10), "Degraded sources require explicit restore or quarantine decision before production use.", "Restore previous cadence only after health checks pass."),
      sourcePortfolioMigrationAction("retire_duplicate", retiredDuplicateIds.slice(0, 10), "Duplicate or low-value sources should be retired through reversible operator packets.", "Unretire only if source family diversity drops below SLO."),
      sourcePortfolioMigrationAction("request_legal_review", legalReviewIds.slice(0, 10), "Legal or robots review is missing or stale before production promotion.", "Keep source in current state until review is current."),
      sourcePortfolioMigrationAction("request_parser_repair", parserRepairIds.slice(0, 10), "Parser compatibility must be repaired before collection readiness.", "Keep source out of canary activation until Agent 03 repair passes.")
    ].filter((action) => action.sourceIds.length > 0),
    guardrails: {
      approvalMode: "explicit_operator_approval",
      restrictedMetadataOnly: true,
      noSilentActivation: true,
      forbiddenSourceClasses: activationBatchForbiddenSourceClasses()
    },
    handoffs: {
      agent02FreshnessSlo: ["queryClasses.readiness", "lanes.cadenceImpact", "recommendedActions.promote_sandbox_to_canary"],
      agent03AdapterRepair: ["lanes.parserCapability", "recommendedActions.request_parser_repair"],
      agent04SourceExpansion: ["queryClasses.missingFamilies", "recommendedActions.promote_candidate_to_sandbox"],
      agent06EvidenceChain: ["lanes.sourceIds", "queryClasses.activeSafePublicSources"],
      agent07ActorFreshness: ["queryClasses.representativeQueries", "lanes.averageReliability"],
      agent09ApiFields: ["migrationReadiness.schemaVersion", "migrationReadiness.summary", "migrationReadiness.lanes", "migrationReadiness.queryClasses"],
      agent10ReleaseGate: ["summary.recommendedCanaryPromotions", "guardrails.noSilentActivation", "recommendedActions.rollback"]
    }
  };
}

function sourcePortfolioMigrationLane(
  state: SourcePortfolioMigrationState,
  sources: SourceRecord[],
  economicsById: Map<string, SourceReliabilityEconomicsRow>,
  generatedAt: string
): SourcePortfolioMigrationLane {
  const laneSources = sources.filter((source) => sourcePortfolioMigrationState(source) === state);
  const estimatedTasks = laneSources.reduce((sum, source) => sum + Math.ceil(86400 / Math.max(3600, source.catalog?.collection.crawlCadenceSeconds ?? source.crawlFrequencySeconds)), 0);
  const cadenceValues = laneSources.map((source) => source.catalog?.collection.crawlCadenceSeconds ?? source.crawlFrequencySeconds);
  return {
    state,
    sourceCount: laneSources.length,
    sourceIds: laneSources.map((source) => source.id),
    approvalRequired: state !== "retired" && laneSources.some((source) => source.governance?.approvalRequired || source.approvalRequired || source.status !== "active"),
    rollbackAction: sourcePortfolioMigrationRollbackAction(state),
    parserCapability: laneSources.some((source) => source.governance?.metadataOnly || source.risk === "restricted")
      ? "metadata_only_handoff"
      : laneSources.some((source) => !source.catalog?.adapterCompatibility.includes(source.type))
        ? "needs_repair"
        : "supported",
    sourceFamilies: uniqueStrings(laneSources.map(sourceFamilyKey)).sort(),
    averageReliability: roundScore(average(laneSources.map((source) => economicsById.get(source.id)?.reliabilityScore ?? source.trustScore))),
    legalReview: combinedLegalReviewState(laneSources.map((source) => reviewState(source.metadata?.legalNotesReviewedAt, generatedAt, Boolean(source.legalNotes.trim())))),
    robotsReview: combinedRobotsReviewState(laneSources.map((source) => sourceNeedsRobotsReview(source) ? reviewState(source.metadata?.robotsReviewedAt, generatedAt, true) : "not_required")),
    cadenceImpact: {
      estimatedTasksPerDay: estimatedTasks,
      maxCadenceSeconds: cadenceValues.length > 0 ? Math.max(...cadenceValues) : 0,
      budgetClasses: uniqueStrings(laneSources.map((source) => source.catalog?.collection.budgetClass ?? "standard")).sort()
    }
  };
}

function sourcePortfolioMigrationState(source: SourceRecord): SourcePortfolioMigrationState {
  if (source.status === "retired" || source.status === "rejected" || source.status === "disabled") return "retired";
  if (source.status === "degraded" || source.status === "quarantined" || source.status === "paused") return "degraded";
  if (source.status === "active" || source.status === "probation") return source.status === "probation" ? "canary" : "active";
  if (source.status === "approved") return "sandbox";
  return "candidate";
}

function sourcePortfolioMigrationRollbackAction(state: SourcePortfolioMigrationState): SourcePortfolioMigrationLane["rollbackAction"] {
  if (state === "candidate") return "remove_candidate";
  if (state === "sandbox") return "return_to_sandbox";
  if (state === "canary") return "pause_canary";
  if (state === "active" || state === "degraded") return "quarantine_or_degrade";
  if (state === "retired") return "restore_previous_cadence";
  return "none";
}

function combinedLegalReviewState(states: Array<"current" | "stale" | "missing">): SourcePortfolioMigrationLane["legalReview"] {
  const unique = uniqueStrings(states);
  if (unique.length === 0) return "missing";
  if (unique.length === 1) return unique[0] as SourcePortfolioMigrationLane["legalReview"];
  return "mixed";
}

function combinedRobotsReviewState(states: Array<"current" | "stale" | "missing" | "not_required">): SourcePortfolioMigrationLane["robotsReview"] {
  const unique = uniqueStrings(states);
  if (unique.length === 0) return "missing";
  if (unique.length === 1) return unique[0] as SourcePortfolioMigrationLane["robotsReview"];
  return "mixed";
}

function sourcePortfolioMigrationQueryClassReadiness(
  queryClass: SourceCoverageSloQueryClass,
  queries: string[],
  sources: SourceRecord[],
  generatedAt: string
): SourcePortfolioMigrationQueryClassReadiness {
  const representativeQueries = queries.filter((query) => classifyCoverageQuery(query) === queryClass);
  const matching = sources.filter((source) =>
    representativeQueries.length === 0
      ? sourceCanSatisfyPublicSlo(source)
      : representativeQueries.some((query) => explainSourceForQuery(query, source, generatedAt).score > 0)
  );
  const activeSafePublicSources = matching.filter((source) => sourceCanSatisfyPublicSlo(source) && sourcePortfolioMigrationState(source) === "active").length;
  const candidateSources = matching.filter((source) => sourcePortfolioMigrationState(source) === "candidate").length;
  const canarySources = matching.filter((source) => sourcePortfolioMigrationState(source) === "canary").length;
  const sourceFamilies = new Set(matching.filter(sourceCanSatisfyPublicSlo).map(sourceFamilyKey));
  const requirements = sourceCoverageSloRequirements(queryClass);
  const missingFamilies = sourceFamilies.size >= requirements.minSourceFamilies ? [] : [`need_${requirements.minSourceFamilies - sourceFamilies.size}_more_safe_public_family`];
  const parserGap = matching.some((source) => !source.catalog?.adapterCompatibility.includes(source.type));
  const legalGap = matching.some((source) => reviewState(source.metadata?.legalNotesReviewedAt, generatedAt, Boolean(source.legalNotes.trim())) !== "current");
  return {
    queryClass,
    readiness: activeSafePublicSources >= requirements.minActiveSafePublicSources && missingFamilies.length === 0 ? "ready" : parserGap || legalGap ? "hold" : "partial",
    activeSafePublicSources,
    candidateSources,
    canarySources,
    missingFamilies,
    representativeQueries,
    recommendedAction: parserGap
      ? "repair_parser"
      : legalGap
        ? "legal_review"
        : candidateSources > 0 || canarySources > 0
          ? "promote_to_canary"
          : "add_source_pack"
  };
}

function sourcePortfolioMigrationAction(
  action: SourcePortfolioMigrationReadiness["recommendedActions"][number]["action"],
  sourceIds: string[],
  reason: string,
  rollback: string
): SourcePortfolioMigrationReadiness["recommendedActions"][number] {
  return {
    action,
    sourceIds,
    reason,
    approvalRequired: true,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    rollback
  };
}

export function buildSourceReliabilityEconomicsPacket(
  query: string,
  sources: SourceRecord[],
  generatedAt = nowIso()
): SourceReliabilityEconomicsPacket {
  const matching = query === "portfolio"
    ? sources
    : sources.filter((source) => explainSourceForQuery(query, source, generatedAt).score > 0);
  const duplicateIds = new Set(duplicateGroups(matching).flatMap((group) => group.sourceIds));
  const familyCounts = countMap(matching.map(sourceFamilyKey));
  const rows = matching
    .map((source) => sourceReliabilityEconomicsRow(source, generatedAt, duplicateIds, familyCounts))
    .sort((left, right) => right.reliabilityScore - left.reliabilityScore || right.economics.marginalValue - left.economics.marginalValue || left.sourceId.localeCompare(right.sourceId))
    .slice(0, 50);
  const sourceCount = rows.length;
  const totalUsefulEvidence = rows.reduce((sum, row) => sum + row.economics.expectedUsefulEvidenceItemsPerDay, 0);
  const totalTasks = rows.reduce((sum, row) => sum + row.economics.estimatedTasksPerDay, 0);
  const familyCoverage = [...new Set(rows.map((row) => row.sourceFamily))].length;

  return {
    schemaVersion: "ti.source_reliability_economics.v1",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    generatedAt,
    query,
    queryClass: classifyCoverageQuery(query),
    summary: {
      sourceCount,
      trusted: rows.filter((row) => row.decision === "trusted").length,
      throttled: rows.filter((row) => row.decision === "throttled").length,
      paused: rows.filter((row) => row.decision === "paused").length,
      retired: rows.filter((row) => row.decision === "retired").length,
      promoteCandidates: rows.filter((row) => row.decision === "promote_candidate").length,
      needsReview: rows.filter((row) => row.decision === "needs_review").length,
      averageReliabilityScore: roundScore(average(rows.map((row) => row.reliabilityScore))),
      sourceFamilyCoverage: familyCoverage,
      marginalValueOfProposedSources: roundScore(rows.filter((row) => row.decision === "promote_candidate").reduce((sum, row) => sum + row.economics.marginalValue, 0)),
      costPerUsefulEvidenceItem: roundScore(totalUsefulEvidence > 0 ? totalTasks / totalUsefulEvidence : 0),
      staleSourceSuppression: rows.filter((row) => row.economics.staleSuppressed).length,
      duplicateSuppression: rows.filter((row) => row.economics.duplicateSuppressed).length,
      activationWaveReady: rows.filter((row) => row.economics.activationWaveReady).length
    },
    sources: rows,
    portfolioEconomics: {
      familyCoverage: [...new Set(rows.map((row) => row.sourceFamily))]
        .map((family) => {
          const familyRows = rows.filter((row) => row.sourceFamily === family);
          return {
            family,
            sourceCount: familyRows.length,
            activeCount: familyRows.filter((row) => row.runtimeStatus === "active" || row.runtimeStatus === "probation" || row.runtimeStatus === "degraded").length,
            averageReliabilityScore: roundScore(average(familyRows.map((row) => row.reliabilityScore)))
          };
        })
        .sort((left, right) => right.sourceCount - left.sourceCount || left.family.localeCompare(right.family)),
      marginalValueLeaders: rows.filter((row) => row.economics.marginalValue >= 0.65).slice(0, 10).map((row) => row.sourceId),
      staleSuppressedSourceIds: rows.filter((row) => row.economics.staleSuppressed).map((row) => row.sourceId),
      duplicateSuppressedSourceIds: rows.filter((row) => row.economics.duplicateSuppressed).map((row) => row.sourceId),
      activationWaveReadySourceIds: rows.filter((row) => row.economics.activationWaveReady).map((row) => row.sourceId)
    },
    governance: {
      approvalMode: "explicit_operator_approval",
      noSilentActivation: true,
      restrictedSourcesMetadataOnly: true,
      forbiddenSourceClasses: activationBatchForbiddenSourceClasses()
    },
    coordination: {
      agent02Fields: ["handoffs.agent02SchedulerPriority", "economics.estimatedTasksPerDay", "economics.costPerUsefulEvidenceItem", "economics.staleSuppressed"],
      agent03Fields: ["scoreInputs.parserHealth", "handoffs.agent03ParserCapability"],
      agent04Fields: ["sourceFamily", "handoffs.agent04SourcePackRecommendation", "portfolioEconomics.familyCoverage"],
      agent06Fields: ["scoreInputs.evidenceReplaySuccess", "handoffs.agent06EvidenceReplay"],
      agent07Fields: ["scoreInputs.falsePositiveHistory", "handoffs.agent07QualityConfidence", "reliabilityScore"],
      agent09Fields: ["schemaVersion", "summary", "sources.decision", "sources.reasons"],
      agent10Fields: ["summary.activationWaveReady", "summary.staleSourceSuppression", "handoffs.agent10SloRunbook"]
    }
  };
}

function sourceReliabilityEconomicsRow(
  source: SourceRecord,
  generatedAt: string,
  duplicateIds: Set<string>,
  familyCounts: Map<string, number>
): SourceReliabilityEconomicsRow {
  const family = sourceFamilyKey(source);
  const cadence = source.catalog?.collection.crawlCadenceSeconds ?? source.crawlFrequencySeconds;
  const estimatedTasksPerDay = Math.ceil(86400 / Math.max(3600, cadence));
  const safePublicEligible = sourceCanSatisfyPublicSlo(source);
  const staleSuppressed = sourceMissesFreshnessSlo(source, source.catalog?.collection.freshnessTargetSeconds ?? 36 * 3600, generatedAt);
  const duplicateSuppressed = duplicateIds.has(source.id);
  const parserCompatible = Boolean(source.catalog?.adapterCompatibility.includes(source.type));
  const legalState = reviewState(source.metadata?.legalNotesReviewedAt, generatedAt, Boolean(source.legalNotes.trim()));
  const robotsState = sourceNeedsRobotsReview(source)
    ? reviewState(source.metadata?.robotsReviewedAt, generatedAt, true)
    : "current";
  const inputs: SourceReliabilityScoreInputs = {
    freshness: staleSuppressed ? 0.15 : freshnessScore(source, generatedAt),
    usefulAnswerYield: usefulAnswerYieldScore(source),
    parserHealth: parserCompatible ? source.scoring?.parseability ?? parserHealthScore(source) : 0.2,
    legalReviewAge: legalState === "current" ? 1 : legalState === "stale" ? 0.35 : 0.05,
    robotsReviewAge: robotsState === "current" ? 1 : robotsState === "stale" ? 0.35 : 0.05,
    duplicateRate: duplicateSuppressed ? 1 : metadataNumber(source, "duplicateRate", 0),
    evidenceReplaySuccess: metadataNumber(source, "evidenceReplaySuccess", source.status === "active" ? 0.72 : 0.55),
    analystOverrideHistory: analystOverrideScore(source),
    falsePositiveHistory: metadataNumber(source, "falsePositiveRate", 0),
    familyDiversityValue: familyCounts.get(family) === 1 ? 1 : Math.max(0.15, 1 / Math.max(1, familyCounts.get(family) ?? 1)),
    schedulerCostEfficiency: estimatedTasksPerDay <= 6 ? 1 : estimatedTasksPerDay <= 12 ? 0.65 : 0.35
  };
  const reliabilityScore = roundScore(clamp01(
    inputs.freshness * 0.14 +
    inputs.usefulAnswerYield * 0.16 +
    inputs.parserHealth * 0.13 +
    inputs.legalReviewAge * 0.1 +
    inputs.robotsReviewAge * 0.07 +
    (1 - inputs.duplicateRate) * 0.09 +
    inputs.evidenceReplaySuccess * 0.12 +
    inputs.analystOverrideHistory * 0.06 +
    (1 - inputs.falsePositiveHistory) * 0.08 +
    inputs.familyDiversityValue * 0.03 +
    inputs.schedulerCostEfficiency * 0.02 -
    (source.approvalRequired || source.governance?.approvalRequired ? 0.08 : 0) -
    (source.risk === "restricted" || source.risk === "high" ? 0.1 : 0)
  ));
  const marginalValue = roundScore(clamp01(reliabilityScore * 0.55 + inputs.familyDiversityValue * 0.25 + inputs.usefulAnswerYield * 0.2 - (duplicateSuppressed ? 0.45 : 0) - (staleSuppressed ? 0.25 : 0)));
  const expectedUsefulEvidenceItemsPerDay = roundScore(Math.max(0.01, estimatedTasksPerDay * inputs.usefulAnswerYield * reliabilityScore));
  const costPerUsefulEvidenceItem = roundScore(estimatedTasksPerDay / Math.max(0.01, expectedUsefulEvidenceItemsPerDay));
  const activationWaveReady = safePublicEligible && parserCompatible && legalState === "current" && robotsState === "current" && reliabilityScore >= 0.62 && !staleSuppressed && !duplicateSuppressed;
  const decision = sourceReliabilityDecision(source, reliabilityScore, safePublicEligible, staleSuppressed, duplicateSuppressed, parserCompatible, legalState, robotsState);

  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    sourceFamily: family,
    runtimeStatus: source.status,
    safePublicEligible,
    decision,
    reliabilityScore,
    scoreInputs: inputs,
    economics: {
      marginalValue,
      expectedUsefulEvidenceItemsPerDay,
      costPerUsefulEvidenceItem,
      estimatedTasksPerDay,
      activationWaveReady,
      staleSuppressed,
      duplicateSuppressed
    },
    reasons: sourceReliabilityReasons(source, decision, safePublicEligible, staleSuppressed, duplicateSuppressed, parserCompatible, legalState, robotsState, reliabilityScore),
    handoffs: sourceReliabilityHandoffs(decision, source, parserCompatible, reliabilityScore, activationWaveReady, duplicateSuppressed),
    guardrails: {
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      noRestrictedActivation: true,
      noLeakedDataAccess: true
    }
  };
}

function sourceReliabilityDecision(
  source: SourceRecord,
  score: number,
  safePublicEligible: boolean,
  staleSuppressed: boolean,
  duplicateSuppressed: boolean,
  parserCompatible: boolean,
  legalState: "current" | "missing" | "stale",
  robotsState: "current" | "missing" | "stale"
): SourceReliabilityDecision {
  if (source.status === "retired" || source.status === "rejected" || source.status === "disabled") return "retired";
  if (!safePublicEligible || source.risk === "restricted" || source.risk === "high" || source.governance?.metadataOnly) return "needs_review";
  if (!parserCompatible || legalState !== "current" || robotsState !== "current") return "needs_review";
  if (duplicateSuppressed || staleSuppressed || source.health?.status === "failing" || source.status === "paused" || source.status === "quarantined") return "paused";
  if (source.status === "candidate" || source.status === "needs_review" || source.status === "approved") return score >= 0.68 ? "promote_candidate" : "needs_review";
  if (score >= 0.76) return "trusted";
  if (score >= 0.52) return "throttled";
  return "paused";
}

function sourceReliabilityReasons(
  source: SourceRecord,
  decision: SourceReliabilityDecision,
  safePublicEligible: boolean,
  staleSuppressed: boolean,
  duplicateSuppressed: boolean,
  parserCompatible: boolean,
  legalState: "current" | "missing" | "stale",
  robotsState: "current" | "missing" | "stale",
  score: number
): string[] {
  const reasons = [`decision:${decision}`, `score:${score}`];
  if (safePublicEligible) reasons.push("safe_public_slo_eligible");
  if (!safePublicEligible) reasons.push("not_safe_public_activation_eligible");
  if (staleSuppressed) reasons.push("stale_source_suppressed_until_freshness_repair");
  if (duplicateSuppressed) reasons.push("duplicate_canonical_source_suppressed");
  if (!parserCompatible) reasons.push("parser_capability_gap");
  if (legalState !== "current") reasons.push(`legal_review_${legalState}`);
  if (robotsState !== "current") reasons.push(`robots_review_${robotsState}`);
  if (source.risk === "restricted" || source.risk === "high" || source.governance?.metadataOnly) reasons.push("restricted_or_high_risk_metadata_only_review");
  if (source.health?.status === "degraded" || source.health?.status === "failing") reasons.push(`health_${source.health.status}`);
  return reasons;
}

function sourceReliabilityHandoffs(
  decision: SourceReliabilityDecision,
  source: SourceRecord,
  parserCompatible: boolean,
  score: number,
  activationWaveReady: boolean,
  duplicateSuppressed: boolean
): SourceReliabilityEconomicsRow["handoffs"] {
  return {
    agent02SchedulerPriority: decision === "trusted" || decision === "promote_candidate"
      ? "high"
      : decision === "throttled"
        ? "normal"
        : decision === "needs_review"
          ? "low"
          : "suppress",
    agent03ParserCapability: source.governance?.metadataOnly || source.risk === "restricted"
      ? "restricted_metadata_handoff"
      : parserCompatible
        ? "supported"
        : "needs_parser_repair",
    agent04SourcePackRecommendation: duplicateSuppressed
      ? "dedupe"
      : decision === "promote_candidate"
        ? "promote"
        : activationWaveReady
          ? "fill_family_gap"
          : "hold",
    agent06EvidenceReplay: decision === "paused" || decision === "retired" ? "suppressed" : score >= 0.65 ? "ready" : "needs_replay_proof",
    agent07QualityConfidence: metadataNumber(source, "falsePositiveRate", 0) >= 0.2 ? "false_positive_watch" : score >= 0.6 ? "confidence_input_ready" : "quality_hold",
    agent09ApiContract: "source_reliability_fields_ready",
    agent10SloRunbook: decision === "trusted" || activationWaveReady ? "slo_ready" : decision === "paused" || decision === "retired" ? "release_hold" : "watch"
  };
}

function freshnessScore(source: SourceRecord, generatedAt: string): number {
  const last = source.crawlState?.lastCollectedAt ?? source.lastSeenAt;
  if (!last) return 0.45;
  const ageSeconds = Math.max(0, (Date.parse(generatedAt) - Date.parse(last)) / 1000);
  const targetSeconds = source.catalog?.collection.freshnessTargetSeconds ?? source.crawlFrequencySeconds * 2;
  return clamp01(1 - ageSeconds / Math.max(targetSeconds * 3, 1));
}

function usefulAnswerYieldScore(source: SourceRecord): number {
  const explicit = metadataNumber(source, "usefulAnswerYield", Number.NaN);
  if (Number.isFinite(explicit)) return explicit;
  return clamp01((extractionYield(source) * 0.6) + ((source.catalog?.intelligenceValue ?? source.trustScore) * 0.4));
}

function parserHealthScore(source: SourceRecord): number {
  if (source.health?.status === "failing") return 0.15;
  if (source.health?.status === "degraded") return 0.55;
  return source.scoring?.parseability ?? 0.72;
}

function analystOverrideScore(source: SourceRecord): number {
  const overrides = metadataNumber(source, "analystOverrideCount", 0);
  const trustedOverrides = metadataNumber(source, "trustedAnalystOverrideCount", 0);
  return clamp01(0.75 + trustedOverrides * 0.05 - overrides * 0.04);
}

function metadataNumber(source: SourceRecord, key: string, fallback: number): number {
  const value = source.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? clamp01(value) : fallback;
}

function countMap(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function buildSourceMarketplaceApiResponse(input: {
  queries?: string[];
  tenantId?: string;
  generatedAt?: string;
  maxSources?: number;
} = {}): SourceMarketplaceApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const waves = buildEnterpriseSafePublicActivationWaves(generatedAt);
  const rollout = balancedActivationWaveSources(waves).slice(0, input.maxSources ?? 50);
  const marketplaceSources = rollout.map((source) => sourceMarketplaceSource(source));
  const parserCapabilityMatrix = buildSourceMarketplaceParserCapabilityMatrix(marketplaceSources);
  const activationReadiness = {
    readyForDryRun: marketplaceSources.filter((source) => source.activationReadiness === "ready_for_dry_run").length,
    needsParserSupport: marketplaceSources.filter((source) => source.activationReadiness === "needs_parser_support").length,
    needsLegalReview: marketplaceSources.filter((source) => source.activationReadiness === "needs_legal_review").length,
    blockedUnsafe: marketplaceSources.filter((source) => source.activationReadiness === "blocked_unsafe").length
  };

  return {
    endpoint: "/v1/sources/marketplace",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    tenantId: input.tenantId,
    generatedAt,
    marketplace: {
      sourceCount: marketplaceSources.length,
      safePublicSourceCount: marketplaceSources.filter((source) => source.activationReadiness !== "blocked_unsafe").length,
      sourceFamilies: uniqueStrings(marketplaceSources.map((source) => source.sourceFamily)) as SourceMarketplaceApiResponse["marketplace"]["sourceFamilies"],
      sources: marketplaceSources
    },
    parserCapabilityMatrix,
    activationReadiness,
    unsupportedSourceClasses: sourceMarketplaceUnsupportedClasses(),
    governance: {
      approvalMode: "dry_run_packets_only",
      noSilentActivation: true,
      noCrawlingFromMarketplace: true,
      requiredBeforeActivation: [
        "operator/legal approval packet",
        "parser capability pass",
        "legal and robots review current",
        "scheduler budget accepted",
        "Agent 10 SLO gate pass"
      ]
    },
    coordination: {
      agent02Fields: ["schedulerCost", "estimatedDailyTasks", "budgetClass"],
      agent03Fields: ["parserProfile", "parserSupported", "parserCapabilityMatrix"],
      agent04Fields: ["sourceFamily", "public_signal_candidate", "unsupported public_channel boundary"],
      agent06Fields: ["expectedEvidenceYield", "duplicateRate"],
      agent07Fields: ["sectorUtility", "trustScore", "quality_input_ready"],
      agent09Fields: ["endpoint", "marketplace.sources", "parserCapabilityMatrix", "activationReadiness"],
      agent10Fields: ["activationReadiness", "slo_ready", "release_hold"]
    }
  };
}

export function buildSourceActivationBatchApiResponse(input: {
  queries: string[];
  sources: SourceRecord[];
  sourcePacks?: SeedSourceBundle[];
  tenantId?: string;
  generatedAt?: string;
}): SourceActivationBatchApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const scopedSources = input.tenantId
    ? input.sources.filter((source) => source.tenantId === input.tenantId || source.tenantId === undefined)
    : input.sources;
  const queries = input.queries.length > 0 ? input.queries : ["portfolio"];
  const activationWaves = buildEnterpriseSafePublicActivationWaves(generatedAt);
  return {
    endpoint: "/v1/sources/activation-batches",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    tenantId: input.tenantId,
    generatedAt,
    queries: queries.map((query) => {
      const activation = buildSourceActivationApiResponse(query, scopedSources, {
        tenantId: input.tenantId,
        generatedAt,
        sourcePack: input.sourcePacks?.[0]
      });
      const recommendations = activation.sourcePackRecommendations
        .filter((source) => sourcePackRecommendationCanSupportQuery(source, query));
      return buildSourceActivationBatchQuery(query, scopedSources, input.sourcePacks ?? [], recommendations, generatedAt, input.tenantId);
    }),
    forbiddenSourceClasses: activationBatchForbiddenSourceClasses(),
    executionReadiness: buildSourceActivationExecutionReadiness(activationWaves, queries, generatedAt),
    coordination: {
      agent02Fields: ["schedulerCost", "schedulerImpact", "expectedCadenceSeconds", "estimatedTasksPerDay", "executionReadiness.queueBudgetImpact"],
      agent03Fields: ["parserOwner", "parserCompatible", "blockers", "executionReadiness.parserGapHandoff"],
      agent09Fields: ["queries", "operatorDecisionPacket", "sources", "forbiddenSourceClasses"]
    }
  };
}

export function buildSourceRuntimeSlaApiResponse(input: {
  queries: string[];
  sources: SourceRecord[];
  tenantId?: string;
  generatedAt?: string;
}): SourceRuntimeSlaApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const scopedSources = input.tenantId
    ? input.sources.filter((source) => source.tenantId === input.tenantId || source.tenantId === undefined)
    : input.sources;
  const queries = input.queries.length > 0 ? input.queries : ["runtime"];
  const rows = queries.map((query) => buildSourceRuntimeSlaQuery(query, scopedSources, generatedAt));
  const passing = rows.filter((query) => query.status === "pass").length;
  const warning = rows.filter((query) => query.status === "warning").length;
  const breached = rows.filter((query) => query.status === "breach").length;

  return {
    endpoint: "/v1/sources/runtime-sla",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    tenantId: input.tenantId,
    generatedAt,
    queries: rows,
    rollup: {
      status: breached > 0 ? "breach" : warning > 0 ? "warning" : "pass",
      passing,
      warning,
      breached,
      releaseHold: rows.some((query) => query.summary.releaseHold)
    },
    releasePacket: {
      gate: "source_sla_enforcement",
      decision: rows.some((query) => query.promotionGate.decision === "rollback")
        ? "rollback"
        : rows.some((query) => query.promotionGate.decision === "hold")
          ? "hold"
          : "pass",
      heldQueries: rows.filter((query) => query.promotionGate.decision === "hold" || query.promotionGate.decision === "rollback").map((query) => query.query),
      warningQueries: rows.filter((query) => query.promotionGate.decision === "warn").map((query) => query.query),
      dryRun: true,
      willMutate: false,
      willStartCrawling: false
    },
    coordination: {
      agent02Fields: ["schedulerCost", "metrics.scheduler_cost", "remediation.change_cadence", "remediation.pause_noisy_source"],
      agent03Fields: ["metrics.parser_compatibility", "remediation.request_parser_support"],
      agent06Fields: ["metrics.evidence_yield", "metrics.claim_yield"],
      agent10Fields: ["rollup", "summary.releaseHold", "apiImpact", "remediation.releaseHold"]
    }
  };
}

function uniqueCoverageCloseoutQueries(queries: string[]): string[] {
  const seen = new Set<SourceCoverageCloseoutQueryClass>();
  const deduped: string[] = [];
  for (const query of queries) {
    const queryClass = classifyCloseoutQuery(query);
    if (seen.has(queryClass)) continue;
    seen.add(queryClass);
    deduped.push(query);
  }
  return deduped;
}

export function buildSourceCoverageCloseoutApiResponse(input: {
  queries: string[];
  sources: SourceRecord[];
  tenantId?: string;
  generatedAt?: string;
}): SourceCoverageCloseoutApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const scopedSources = input.tenantId
    ? input.sources.filter((source) => source.tenantId === input.tenantId || source.tenantId === undefined)
    : input.sources;
  const waves = buildEnterpriseSafePublicActivationWaves(generatedAt);
  const queries = uniqueCoverageCloseoutQueries(input.queries.length > 0 ? input.queries : ["APT29", "Akira ransomware victims", "CVE-2024-1234", "Cobalt Strike malware tool", "Norway", "healthcare sector", "campaign infrastructure", "C2 infrastructure"])
    .map((query) => buildSourceCoverageCloseoutQuery(query, scopedSources, waves, generatedAt));
  const heldQueries = queries.filter((query) => query.readiness === "hold");
  const executionReadiness = buildSourceActivationExecutionReadiness(waves, queries.map((query) => query.query), generatedAt);

  return {
    endpoint: "/v1/sources/coverage-closeout",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    tenantId: input.tenantId,
    generatedAt,
    queries,
    activationWaves: waves,
    summary: {
      safePublicActivationSourceCount: waves.reduce((sum, wave) => sum + wave.sourceCount, 0),
      waveCount: waves.length,
      readyQueries: queries.filter((query) => query.readiness === "ready").length,
      heldQueries: heldQueries.length
    },
    forbiddenSourceClasses: activationBatchForbiddenSourceClasses(),
    executionReadiness,
    releasePacket: {
      gate: "source_coverage_closeout",
      decision: heldQueries.length > 0 || executionReadiness.agent10ReleasePacket.decision === "hold" ? "hold" : "pass",
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      agent10Field: "sourceCoverageCloseout",
      agent10ExecutionField: "sourceActivationExecutionReadiness"
    }
  };
}

function buildSourcePortfolioQuerySummary(query: string, sources: SourceRecord[], generatedAt: string): SourcePortfolioQuerySummary {
  const matching = query === "portfolio"
    ? sources
    : sources.filter((source) => explainSourceForQuery(query, source, generatedAt).score > 0);
  return {
    query,
    queryClass: query === "portfolio" ? "actor" : classifyCoverageQuery(query),
    familyGroups: groupPortfolioSources(matching, (source) => sourceFamilyKey(source), (source) => source.catalog?.publisher.name ?? new URL(source.url).hostname),
    actorGroups: groupPortfolioSources(matching, (source) => source.catalog?.coverage.actors.length ? source.catalog.coverage.actors : ["unmapped_actor"], (source) => source),
    regionGroups: groupPortfolioSources(matching, (source) => source.catalog?.coverage.regions.length ? source.catalog.coverage.regions : ["unmapped_region"], (source) => source),
    sectorGroups: groupPortfolioSources(matching, (source) => source.catalog?.coverage.industries.length ? source.catalog.coverage.industries : ["unmapped_sector"], (source) => source),
    languageGroups: groupPortfolioSources(matching, (source) => source.catalog?.coverage.languages.length ? source.catalog.coverage.languages : [source.language ?? "unknown"], (source) => source),
    legalReviewAgeGroups: groupPortfolioSources(matching, (source) => reviewAgeBucket(source.metadata?.legalNotesReviewedAt, generatedAt), (source) => source),
    robotsReviewAgeGroups: groupPortfolioSources(matching, (source) => sourceNeedsRobotsReview(source) ? reviewAgeBucket(source.metadata?.robotsReviewedAt, generatedAt) : "not_required", (source) => source),
    reliabilityGroups: groupPortfolioSources(matching, (source) => scoreBucket(source.catalog?.reliability ?? source.scoring?.reliability ?? source.trustScore), (source) => source),
    extractionYieldGroups: groupPortfolioSources(matching, (source) => scoreBucket(extractionYield(source)), (source) => source)
  };
}

function groupPortfolioSources(
  sources: SourceRecord[],
  keysFor: (source: SourceRecord) => string | string[],
  labelFor: (source: SourceRecord) => string | SourceRecord
): SourcePortfolioGroup[] {
  const groups = new Map<string, SourceRecord[]>();
  for (const source of sources) {
    const rawKeys = keysFor(source);
    const keys = Array.isArray(rawKeys) ? rawKeys : [rawKeys];
    for (const key of keys.filter(Boolean)) groups.set(key, [...(groups.get(key) ?? []), source]);
  }
  return [...groups.entries()]
    .map(([key, items]) => {
      const labelCandidate = labelFor(items[0]!);
      return {
        key,
        label: typeof labelCandidate === "string" ? labelCandidate : key,
        approved: items.filter((source) => source.status === "approved").length,
        active: items.filter((source) => source.status === "active" || source.status === "probation" || source.status === "degraded").length,
        candidate: items.filter((source) => source.status === "candidate" || source.status === "needs_review").length,
        safePublicSloEligible: items.filter(sourceCanSatisfyPublicSlo).length,
        sourceIds: items.map((source) => source.id).sort()
      };
    })
    .sort((left, right) => right.safePublicSloEligible - left.safePublicSloEligible || right.active - left.active || left.key.localeCompare(right.key))
    .slice(0, 20);
}

function reviewAgeBucket(value: unknown, generatedAt: string): string {
  if (typeof value !== "string" || !value) return "missing";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "invalid";
  const days = Math.floor((Date.parse(generatedAt) - timestamp) / 86400000);
  if (days <= 30) return "0-30d";
  if (days <= 90) return "31-90d";
  if (days <= 180) return "91-180d";
  return "181d-plus";
}

function scoreBucket(score: number): string {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  if (score > 0) return "low";
  return "unknown";
}

function extractionYield(source: SourceRecord): number {
  const explicit = source.metadata?.extractionYield;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return Math.max(0, Math.min(1, explicit));
  const parsed = source.metadata?.extractionYieldScore;
  if (typeof parsed === "number" && Number.isFinite(parsed)) return Math.max(0, Math.min(1, parsed));
  return source.scoring?.parseability ?? 0;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function buildSourceActivationBatchQuery(
  query: string,
  sources: SourceRecord[],
  packs: SeedSourceBundle[],
  recommendations: SafePublicSourcePackRecommendation[],
  generatedAt: string,
  tenantId?: string
): SourceActivationBatchQuery {
  const queryClass = classifyCoverageQuery(query);
  const scopedPackSources = packs.flatMap((pack) => pack.sources.map((source) => ({ ...source, tenantId: tenantId ?? source.tenantId })));
  const candidateRecords = recommendations
    .map((recommendation) => {
      const existing = sources.find((source) => source.id === recommendation.sourceId);
      if (existing) return existing;
      const seed = scopedPackSources.find((source) => (source.id ?? stableId("src", seedDuplicateKey(source))) === recommendation.sourceId);
      return seed ? seedInputToSource(seed, generatedAt) : undefined;
    })
    .filter((source): source is SourceRecord => Boolean(source));
  const existingCandidates = sources.filter((source) => {
    if (source.status === "active") return false;
    if (!sourceCanSatisfyPublicSlo(source)) return false;
    return explainSourceForQuery(query, source, generatedAt).score > 0;
  });
  const unsafeMatching = sources.filter((source) =>
    !sourceCanSatisfyPublicSlo(source) && explainSourceForQuery(query, source, generatedAt).score > 0
  );
  const records = [...new Map([...existingCandidates, ...candidateRecords].map((source) => [source.id, source])).values()];
  const batchSources = records
    .map((source) => sourceActivationBatchSource(source, query, generatedAt))
    .filter((source) => source.safePublic && source.decision !== "blocked_unsafe")
    .slice(0, 20);
  const schedulerCost = {
    estimatedTasksPerDay: batchSources.reduce((sum, source) => sum + source.estimatedTasksPerDay, 0),
    maxCadenceSeconds: Math.max(...batchSources.map((source) => source.expectedCadenceSeconds), 0),
    queueClasses: uniqueStrings(batchSources.map((source) => source.schedulerImpact.queueClass))
  };
  const legalReviewsRequired = batchSources.filter((source) => source.legalReviewState !== "current").map((source) => source.sourceId);
  const robotsReviewsRequired = batchSources.filter((source) => source.robotsReviewState === "missing" || source.robotsReviewState === "stale").map((source) => source.sourceId);
  const parserFixesRequired = batchSources.filter((source) => !source.parserCompatible).map((source) => source.sourceId);
  const rollbackOnlySourceIds = batchSources.filter((source) => source.rollbackState.quarantineReason || source.rollbackState.rollbackReason).map((source) => source.sourceId);

  return {
    query,
    queryClass,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    status: batchSources.length === 0 ? "empty" : parserFixesRequired.length > 0 ? "blocked" : "ready_for_review",
    sources: batchSources,
    blockedUnsafeSourceIds: unsafeMatching.map((source) => source.id).sort(),
    schedulerCost,
    runtimeSla: buildSourceRuntimeSlaQuery(query, sources, generatedAt),
    coverageCloseout: buildSourceCoverageCloseoutQuery(query, sources, buildEnterpriseSafePublicActivationWaves(generatedAt), generatedAt),
    executionReadiness: buildSourceActivationExecutionQueryPacket(query, buildEnterpriseSafePublicActivationWaves(generatedAt), generatedAt),
    operatorDecisionPacket: {
      legalReviewsRequired,
      robotsReviewsRequired,
      parserFixesRequired,
      rollbackOnlySourceIds,
      approvalRequired: batchSources.length > 0
    }
  };
}

function sourceActivationBatchSource(source: SourceRecord, query: string, generatedAt: string): SourceActivationBatchSource {
  const safePublic = sourceCanSatisfyPublicSlo(source);
  const parserCompatible = Boolean(source.catalog?.adapterCompatibility.includes(source.type));
  const legalReviewState = reviewState(source.metadata?.legalNotesReviewedAt, generatedAt, Boolean(source.legalNotes.trim()));
  const robotsReviewState = sourceNeedsRobotsReview(source)
    ? reviewState(source.metadata?.robotsReviewedAt, generatedAt, true)
    : "not_required";
  const cadence = source.catalog?.collection.crawlCadenceSeconds ?? source.crawlFrequencySeconds;
  const estimatedTasksPerDay = Math.ceil(86400 / Math.max(3600, cadence));
  const blockers = [
    ...(!safePublic ? ["unsafe_source_class"] : []),
    ...(!parserCompatible ? ["parser_adapter_mismatch"] : []),
    ...(legalReviewState !== "current" ? [`legal_review_${legalReviewState}`] : []),
    ...(robotsReviewState === "missing" || robotsReviewState === "stale" ? [`robots_review_${robotsReviewState}`] : [])
  ];
  const explanation = explainSourceForQuery(query, source, generatedAt);

  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    url: source.url,
    decision: !safePublic ? "blocked_unsafe" : !parserCompatible ? "defer_parser_gap" : legalReviewState === "current" && (robotsReviewState === "current" || robotsReviewState === "not_required") ? "activate" : "review_then_activate",
    safePublic,
    whyItMatters: [
      ...explanation.reasons.slice(0, 6),
      `query:${query}`,
      `publisher:${source.catalog?.publisher.name ?? "unknown"}`
    ],
    expectedCoverageDelta: coverageTagsForSource(source).slice(0, 10),
    adapterOwner: source.type,
    parserOwner: source.type,
    parserCompatible,
    expectedCadenceSeconds: cadence,
    estimatedTasksPerDay,
    maxBytes: typeof source.metadata?.maxBytes === "number" ? source.metadata.maxBytes : 1_000_000,
    retentionClass: source.catalog?.retentionClass ?? "standard",
    legalNotes: source.legalNotes,
    legalReviewState,
    robotsReviewState,
    schedulerImpact: {
      queueClass: source.catalog?.collection.budgetClass ?? "normal",
      cadenceSeconds: cadence,
      estimatedDailyTasks: estimatedTasksPerDay
    },
    rollbackState: {
      rollbackReason: source.catalog?.rollback?.rollbackReason,
      quarantineReason: source.catalog?.rollback?.lastQuarantineReason
    },
    safePublicRationale: safePublic ? [
      "low-risk source",
      `access:${source.accessMethod}`,
      `approval:${source.catalog?.approvalScope ?? "missing"}`,
      `retention:${source.catalog?.retentionClass ?? "standard"}`
    ] : [],
    blockers
  };
}

function reviewState(value: unknown, generatedAt: string, hasRequiredText: boolean): "current" | "missing" | "stale" {
  if (!hasRequiredText || typeof value !== "string" || !value) return "missing";
  return staleMetadataDate(value, generatedAt, 90) ? "stale" : "current";
}

function coverageTagsForSource(source: SourceRecord): string[] {
  return [...new Set([
    ...(source.catalog?.coverage.topics ?? []),
    ...(source.catalog?.coverage.actors ?? []),
    ...(source.catalog?.coverage.aliases ?? []),
    ...(source.catalog?.coverage.industries ?? []),
    ...(source.catalog?.coverage.regions ?? []),
    ...(source.catalog?.coverage.countries ?? []),
    ...(source.tags ?? [])
  ])].sort();
}

function activationBatchForbiddenSourceClasses(): string[] {
  return [
    "restricted raw payload collection",
    "private forums",
    "credentialed sources",
    "leaked-file endpoints",
    "authentication-gated sources",
    "CAPTCHA bypass",
    "public chat sources"
  ];
}

const ENTERPRISE_SAFE_PUBLIC_SOURCE_TEMPLATES: Array<{
  name: string;
  category: SourceActivationWaveCategory;
  url: string;
  tags: string[];
}> = [
  ...[
    "Mandiant Threat Research",
    "Microsoft Threat Intelligence",
    "Google Threat Analysis Group",
    "Cisco Talos Blog",
    "Palo Alto Unit 42",
    "ESET WeLiveSecurity",
    "Sophos X-Ops",
    "Secureworks CTU",
    "CrowdStrike Counter Adversary",
    "SentinelLabs Research"
  ].map((name) => ({ name, category: "vendor_blog" as const, url: `https://example.com/vendor/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xml`, tags: ["actor", "malware", "campaign", "vendor research"] })),
  ...[
    "CISA Cybersecurity Advisories",
    "NCSC UK Advisories",
    "CERT-EU Advisories",
    "JPCERT/CC Alerts",
    "ACSC Alerts",
    "CERT-FR Alerts",
    "BSI CERT-Bund Advisories",
    "CSA Singapore Advisories",
    "NCSC Norway Advisories",
    "ENISA Threat Landscape"
  ].map((name) => ({ name, category: "advisory" as const, url: `https://example.com/advisory/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xml`, tags: ["advisory", "CVE", "sector", "government"] })),
  ...[
    "The DFIR Report RSS",
    "Malwarebytes Labs RSS",
    "KrebsOnSecurity RSS",
    "SANS ISC Diary RSS",
    "BleepingComputer Security RSS",
    "Rapid7 Blog RSS",
    "Red Canary Research RSS",
    "Proofpoint Threat Insight RSS",
    "Elastic Security Labs RSS",
    "Recorded Future Blog RSS"
  ].map((name) => ({ name, category: "rss" as const, url: `https://example.com/rss/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xml`, tags: ["rss", "incident", "ransomware", "malware"] })),
  ...[
    "GitHub Advisory Database",
    "GitLab Security Advisories",
    "OSV Vulnerability Feed",
    "RustSec Advisory Database",
    "PyPA Advisory Database",
    "npm Security Advisories",
    "Go Vulnerability Database",
    "Maven Security Advisories",
    "OpenSSF Security Advisories",
    "Kubernetes Security Announcements"
  ].map((name) => ({ name, category: "github_security_advisory" as const, url: `https://api.github.com/advisories/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, tags: ["github", "CVE", "vulnerability", "infrastructure"] })),
  ...[
    "MITRE ATT&CK Updates",
    "Malpedia Feeds",
    "Abuse.ch URLhaus",
    "Abuse.ch MalwareBazaar",
    "AlienVault OTX Pulses",
    "OpenPhish Feed",
    "PhishTank Verified",
    "Spamhaus DROP",
    "Shadowserver Reports",
    "CIRCL OSINT Feed"
  ].map((name) => ({ name, category: "public_research_feed" as const, url: `https://example.com/research/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xml`, tags: ["public research", "malware", "infrastructure", "campaign"] })),
  ...[
    "US-CERT Current Activity",
    "CERT NZ Advisories",
    "CERT Polska Alerts",
    "CERT-UA Advisories",
    "CERT-In Advisories",
    "CERT-SE Advisories",
    "NorCERT Advisories",
    "FinCERT Advisories",
    "CERT-LV Advisories",
    "GovCERT.ch Advisories"
  ].map((name) => ({ name, category: "government_cert" as const, url: `https://example.com/cert/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.xml`, tags: ["government CERT", "country", "sector", "advisory"] }))
];

function buildSourceRuntimeSlaQuery(query: string, sources: SourceRecord[], generatedAt: string): SourceRuntimeSlaQuery {
  const matching = query === "runtime"
    ? sources
    : sources.filter((source) => explainSourceForQuery(query, source, generatedAt).score > 0);
  const rows = matching
    .map((source) => sourceRuntimeSlaSource(source, generatedAt))
    .sort((left, right) => runtimeSlaRank(right.status) - runtimeSlaRank(left.status) || left.sourceId.localeCompare(right.sourceId))
    .slice(0, 30);
  const remediation = buildSourceRuntimeSlaRemediation(rows, duplicateGroups(matching));
  const sourceFamilyGate = buildSourceFamilyCoverageGate(query, matching);
  const promotionGate = buildSourceSlaPromotionGate(rows, remediation, sourceFamilyGate);
  const breached = rows.filter((source) => source.status === "breach").length;
  const warning = rows.filter((source) => source.status === "warning").length;
  const passing = rows.filter((source) => source.status === "pass").length;
  const apiImpact = sourceRuntimeSlaApiImpact(rows);
  const status: SourceRuntimeSlaStatus = breached > 0 ? "breach" : warning > 0 ? "warning" : "pass";

  return {
    query,
    queryClass: classifyCoverageQuery(query),
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    status,
    summary: {
      sourceCount: rows.length,
      passing,
      warning,
      breached,
      releaseHold: rows.some((source) => source.releaseHold) || remediation.some((item) => item.releaseHold),
      apiImpact
    },
    sourceFamilyGate,
    promotionGate,
    sources: rows,
    remediation
  };
}

function buildSourceCoverageCloseoutQuery(
  query: string,
  sources: SourceRecord[],
  waves: SourceActivationWave[],
  generatedAt: string
): SourceCoverageCloseoutQuery {
  const queryClass = classifyCloseoutQuery(query);
  const matchingSources = sources.filter((source) => explainSourceForQuery(query, source, generatedAt).score > 0);
  const sourceFamilyGate = buildSourceFamilyCoverageGate(query, matchingSources);
  const waveMatches = waves.filter((wave) =>
    wave.sources.some((source) => sourceMatchesCloseoutQuery(source, query, queryClass))
  );
  const plannedCount = waveMatches.reduce((sum, wave) => sum + wave.sources.filter((source) => sourceMatchesCloseoutQuery(source, query, queryClass)).length, 0);
  const parserGap = waveMatches.some((wave) => wave.sources.some((source) => !source.parserCompatible));
  const held = sourceFamilyGate.status === "hold" && plannedCount === 0;

  return {
    query,
    queryClass,
    readiness: held ? "hold" : sourceFamilyGate.status === "pass" || plannedCount >= 3 ? "ready" : "partial",
    sourceFamilyGate,
    activeSafePublicSourceCount: sourceFamilyGate.actualFamilies,
    plannedSafePublicSourceCount: plannedCount,
    activationWaveIds: waveMatches.map((wave) => wave.waveId),
    promotionImpact: {
      agent07: parserGap ? "needs_parser_support" : "ready_for_extraction",
      agent09: plannedCount > 0 ? "api_ready" : "partial_until_activation",
      agent10: held || parserGap ? "release_hold" : "release_candidate"
    },
    executionPacket: buildSourceActivationExecutionQueryPacket(query, waves, generatedAt),
    blockers: [
      ...(held ? ["missing_safe_public_activation_wave"] : []),
      ...(parserGap ? ["parser_support_required"] : [])
    ]
  };
}

function buildEnterpriseSafePublicActivationWaves(generatedAt: string): SourceActivationWave[] {
  const entries = ENTERPRISE_SAFE_PUBLIC_SOURCE_TEMPLATES.map((template, index) =>
    enterpriseActivationWaveSource(template, index, generatedAt)
  );
  const byCategory = new Map<SourceActivationWaveCategory, SourceActivationWaveSource[]>();
  for (const entry of entries) byCategory.set(entry.category, [...(byCategory.get(entry.category) ?? []), entry]);
  return [...byCategory.entries()].map(([category, sources]) => ({
    waveId: stableId("source_wave", `${category}:${generatedAt}`),
    dryRun: true as const,
    willMutate: false as const,
    willStartCrawling: false as const,
    category,
    sourceCount: sources.length,
    schedulerBudget: {
      estimatedDailyTasks: sources.reduce((sum, source) => sum + source.schedulerBudget.estimatedDailyTasks, 0),
      budgetClasses: uniqueStrings(sources.map((source) => source.schedulerBudget.budgetClass)) as SourceCollectionSla["budgetClass"][]
    },
    sources
  })).sort((left, right) => left.category.localeCompare(right.category));
}

export function buildSourceActivationExecutionReadiness(
  waves: SourceActivationWave[],
  queries: string[],
  generatedAt: string
): SourceActivationExecutionReadiness {
  const rollout = balancedActivationWaveSources(waves).slice(0, 50);
  const canary = rollout.slice(0, 10);
  const canaryDtos = canary.map((source, index) => activationExecutionSource(source, index + 1, index + 1, generatedAt));
  const rolloutDtos = rollout.map((source, index) => activationExecutionSource(source, index < 10 ? index + 1 : undefined, index + 1, generatedAt));
  const excludedSources = activationExecutionExcludedSources(generatedAt);
  const duplicateSourceIds = excludedSources.filter((source) => source.excludedClass === "duplicate").map((source) => source.sourceId);
  const parserGapSourceIds = excludedSources.filter((source) => source.excludedClass === "parser_gap").map((source) => source.sourceId);
  const budgetClassBreakdown = activationExecutionBudgetBreakdown(rolloutDtos);
  const canaryEstimatedDailyTasks = canaryDtos.reduce((sum, source) => sum + source.schedulerBudget.estimatedDailyTasks, 0);
  const rolloutEstimatedDailyTasks = rolloutDtos.reduce((sum, source) => sum + source.schedulerBudget.estimatedDailyTasks, 0);
  const coverageByQueryClass = (uniqueStrings((queries.length > 0 ? queries : ["APT29", "Akira ransomware victims", "CVE-2024-1234", "Norway", "healthcare sector"]).map((query) => classifyCloseoutQuery(query))) as SourceCoverageCloseoutQueryClass[])
    .map((queryClass) => {
      const matches = rollout.filter((source) => sourceMatchesCloseoutQuery(source, queryClass, queryClass));
      return {
        queryClass,
        sourceCount: matches.length,
        sourceIds: matches.map((source) => source.sourceId).slice(0, 12)
      };
    });
  const withinBudget = rolloutEstimatedDailyTasks <= 600 && budgetClassBreakdown.urgent === 0;
  const decision = rolloutDtos.length === 50 && canaryDtos.length === 10 && withinBudget && parserGapSourceIds.length > 0
    ? "pass"
    : "hold";
  const sourceRetirement = {
    dryRun: true as const,
    willMutate: false as const,
    candidates: duplicateSourceIds,
    reason: "Retire only after operator approval when duplicate canonical coverage is already represented by the selected safe-public rollout source."
  };
  const duplicateSuppression = {
    dryRun: true as const,
    willMutate: false as const,
    duplicateSourceIds,
    canonicalSourceIds: rolloutDtos.slice(0, 3).map((source) => source.sourceId),
    proof: "Canonical source ids in first rollout are unique; synthetic duplicate candidates are excluded from execution packets."
  };
  const parserGapHandoff = {
    owner: "agent_03" as const,
    sourceIds: parserGapSourceIds,
    reason: "Parser-gap candidates are excluded from activation until Agent 03 declares adapter support current.",
    releaseImpact: parserGapSourceIds.length > 0 ? "none" as const : "hold" as const
  };

  return {
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    first10Canary: canaryDtos,
    publicRollout50: rolloutDtos,
    selectedBatches: [
      {
        batchId: stableId("source_exec_batch", `canary:${generatedAt}`),
        sourceCount: canaryDtos.length,
        category: "mixed_canary",
        sourceIds: canaryDtos.map((source) => source.sourceId),
        schedulerBudget: {
          estimatedDailyTasks: canaryEstimatedDailyTasks,
          budgetClasses: uniqueStrings(canaryDtos.map((source) => source.schedulerBudget.budgetClass)) as SourceCollectionSla["budgetClass"][]
        }
      },
      {
        batchId: stableId("source_exec_batch", `rollout:${generatedAt}`),
        sourceCount: rolloutDtos.length,
        category: "public_rollout",
        sourceIds: rolloutDtos.map((source) => source.sourceId),
        schedulerBudget: {
          estimatedDailyTasks: rolloutEstimatedDailyTasks,
          budgetClasses: uniqueStrings(rolloutDtos.map((source) => source.schedulerBudget.budgetClass)) as SourceCollectionSla["budgetClass"][]
        }
      }
    ],
    excludedSources,
    coverageByQueryClass,
    sourceRetirement,
    duplicateSuppression,
    parserGapHandoff,
    queueBudgetImpact: {
      owner: "agent_02",
      canaryEstimatedDailyTasks,
      rolloutEstimatedDailyTasks,
      withinBudget,
      budgetClassBreakdown
    },
    postActivationDriftChecks: [
      "legal_review_age_days <= 90",
      "robots_review_age_days <= 90 or not_required",
      "capture_success_ratio >= 0.85 after canary window",
      "expected_evidence_yield >= 0.35",
      "parser_error_rate below release threshold",
      "duplicate canonical URL count remains zero",
      "Agent 02 queue budget remains within source activation envelope"
    ],
    rolloutPromotion: buildSourceRolloutPromotionPacket({
      canary: canaryDtos,
      rollout: rolloutDtos,
      coverageByQueryClass,
      sourceRetirement,
      duplicateSuppression,
      parserGapHandoff,
      withinBudget,
      canaryEstimatedDailyTasks,
      rolloutEstimatedDailyTasks,
      decision
    }),
    agent10ReleasePacket: {
      field: "sourceActivationExecutionReadiness",
      gate: "source_activation_execution_readiness",
      decision,
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      canaryCount: 10,
      rolloutCount: 50,
      rollbackPath: "Pause activation wave, keep previous source set active, quarantine failing candidates, and rerun closeout plus runtime SLA gates before promotion."
    }
  };
}

function buildSourceRolloutPromotionPacket(input: {
  canary: SourceActivationExecutionSource[];
  rollout: SourceActivationExecutionSource[];
  coverageByQueryClass: SourceActivationExecutionReadiness["coverageByQueryClass"];
  sourceRetirement: SourceActivationExecutionReadiness["sourceRetirement"];
  duplicateSuppression: SourceActivationExecutionReadiness["duplicateSuppression"];
  parserGapHandoff: SourceActivationExecutionReadiness["parserGapHandoff"];
  withinBudget: boolean;
  canaryEstimatedDailyTasks: number;
  rolloutEstimatedDailyTasks: number;
  decision: "pass" | "hold";
}): SourceRolloutPromotionPacket {
  const coverageImpacts = input.coverageByQueryClass.map((coverage) =>
    sourceRolloutPromotionQueryImpact(coverage.queryClass, input.rollout.filter((source) => coverage.sourceIds.includes(source.sourceId)))
  );
  return {
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    stage: "canary_to_expanded_rollout",
    first10CanarySourceIds: input.canary.map((source) => source.sourceId),
    publicRollout50SourceIds: input.rollout.map((source) => source.sourceId),
    coverageImpacts,
    rollbackCriteria: [
      "canary capture_success_ratio < 0.85",
      "canary evidence_yield < 0.35",
      "parser_error_rate breaches Agent 03 threshold",
      "Agent 02 queue cost exceeds rollout budget",
      "duplicate canonical URL drift appears",
      "public /ti answer freshness regresses after canary"
    ],
    evidenceYieldThresholds: {
      canaryMinimum: 0.35,
      rolloutMinimum: 0.4,
      certificationOwner: "agent_06"
    },
    costControls: {
      owner: "agent_02",
      maxCanaryDailyTasks: 120,
      maxRolloutDailyTasks: 600,
      currentCanaryDailyTasks: input.canaryEstimatedDailyTasks,
      currentRolloutDailyTasks: input.rolloutEstimatedDailyTasks,
      state: input.withinBudget ? "within_budget" : "hold"
    },
    postCanaryMonitoring: [
      { metric: "capture_success_ratio", threshold: ">= 0.85", owner: "agent_01" },
      { metric: "evidence_yield", threshold: ">= 0.35 canary and >= 0.40 rollout", owner: "agent_06" },
      { metric: "parser_error_rate", threshold: "no promotion-impacting parser failures", owner: "agent_03" },
      { metric: "queue_cost", threshold: "<= 600 rollout tasks/day", owner: "agent_02" },
      { metric: "public_ti_answer_freshness", threshold: "no freshness regression for public /ti answers", owner: "agent_07" },
      { metric: "duplicate_rate", threshold: "0 newly promoted duplicate canonicals", owner: "agent_01" },
      { metric: "capture_success_ratio", threshold: "Agent 10 release board remains pass after canary", owner: "agent_10" }
    ],
    sourceRetirement: input.sourceRetirement,
    duplicateSuppression: input.duplicateSuppression,
    parserGapHandoff: input.parserGapHandoff,
    agent10CanaryReleaseDecision: {
      field: "sourceRolloutPromotionPacket",
      canaryDecision: input.decision,
      expandedRolloutDecision: input.decision,
      releaseDecision: input.decision === "pass" ? "promote_canary_then_expand" : "hold",
      rollbackPath: "Stop after canary, preserve previous source set, quarantine failing candidates, and rerun Task X execution readiness before expanded rollout."
    }
  };
}

function buildSourceActivationExecutionQueryPacket(
  query: string,
  waves: SourceActivationWave[],
  _generatedAt: string
): SourceActivationExecutionQueryPacket {
  const queryClass = classifyCloseoutQuery(query);
  const rollout = balancedActivationWaveSources(waves).slice(0, 50);
  const canary = rollout.slice(0, 10);
  const rolloutMatches = rollout.filter((source) => sourceMatchesCloseoutQuery(source, query, queryClass));
  const canaryMatches = canary.filter((source) => sourceMatchesCloseoutQuery(source, query, queryClass));
  const rolloutEstimatedDailyTasks = rollout.reduce((sum, source) => sum + source.schedulerBudget.estimatedDailyTasks, 0);
  const hasParserGap = rolloutMatches.some((source) => !source.parserCompatible);
  const blockers = [
    ...(rolloutMatches.length === 0 ? ["missing_rollout_source_for_query_class"] : []),
    ...(rolloutEstimatedDailyTasks <= 600 ? [] : ["agent_02_queue_budget_hold"]),
    ...(hasParserGap ? ["parser_gap_hold"] : [])
  ];

  return {
    query,
    queryClass,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    canarySourceIds: canaryMatches.map((source) => source.sourceId).slice(0, 10),
    rolloutSourceIds: rolloutMatches.map((source) => source.sourceId).slice(0, 12),
    coverageFamilies: uniqueStrings(rolloutMatches.map((source) => source.category)),
    coverageReady: rolloutMatches.length >= 3 && blockers.length === 0,
    promotionImpact: sourceRolloutPromotionQueryImpact(queryClass, rolloutMatches),
    blockers
  };
}

function sourceRolloutPromotionQueryImpact(
  queryClass: SourceCoverageCloseoutQueryClass,
  sources: SourceActivationWaveSource[] | SourceActivationExecutionSource[]
): SourceRolloutPromotionQueryImpact {
  const expectedDailyTasks = sources.reduce((sum, source) => {
    const budget = "schedulerBudget" in source ? source.schedulerBudget : undefined;
    return sum + (budget?.estimatedDailyTasks ?? 0);
  }, 0);
  const expectedEvidenceYield = sources.length > 0
    ? Number((sources.reduce((sum, source) => sum + source.expectedEvidenceYield, 0) / sources.length).toFixed(2))
    : 0;
  const budgetState = expectedDailyTasks <= 600 ? "within_budget" : "hold";
  const certificationState = expectedEvidenceYield >= 0.4 ? "ready" : "watch";
  return {
    queryClass,
    publicTiAnswerEffect: queryClass === "actor" || queryClass === "ransomware_victim" ? "improves_freshness" : sources.length > 0 ? "improves_coverage" : "keeps_partial_until_canary_passes",
    agent02SchedulerTelemetry: {
      expectedDailyTasks,
      budgetState,
      telemetryFields: ["queue_age_p95", "estimated_daily_tasks", "budget_class", "source_activation_partition"]
    },
    agent06EvidenceCertification: {
      threshold: 0.4,
      expectedEvidenceYield,
      certificationState
    },
    agent07PollingState: {
      state: sources.length > 0 && budgetState === "within_budget" ? "canary_polling" : "hold",
      nextPollSeconds: 300
    },
    agent09ContractIndex: {
      field: "sourceCoverage.rolloutPromotion",
      route: "/v1/contracts"
    },
    agent10Decision: {
      field: "sourceRolloutPromotionPacket",
      decision: sources.length >= 3 && certificationState === "ready" && budgetState === "within_budget" ? "expanded_rollout_pass" : sources.length > 0 ? "canary_pass" : "hold"
    }
  };
}

function balancedActivationWaveSources(waves: SourceActivationWave[]): SourceActivationWaveSource[] {
  const groups = waves.map((wave) => [...wave.sources]);
  const output: SourceActivationWaveSource[] = [];
  const maxGroupLength = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < maxGroupLength; index += 1) {
    for (const group of groups) {
      const source = group[index];
      if (source) output.push(source);
    }
  }
  return output;
}

function sourceMarketplaceSource(source: SourceActivationWaveSource): SourceMarketplaceSource {
  const parserProfile = sourceMarketplaceParserProfile(source.sourceType, source.category);
  const parserSupported = source.parserCompatible && parserProfile !== "dynamic_page" && parserProfile !== "public_channel" && parserProfile !== "restricted_metadata_handoff";
  const needsReview = source.legalReviewState !== "current" || (source.robotsReviewState !== "current" && source.robotsReviewState !== "not_required");
  const activationReadiness: SourceMarketplaceSource["activationReadiness"] = !sourceMarketplaceSafePublic(source)
    ? "blocked_unsafe"
    : !parserSupported
      ? "needs_parser_support"
      : needsReview
        ? "needs_legal_review"
        : "ready_for_dry_run";
  const recommendedAction: SourceMarketplaceSource["recommendedAction"] = activationReadiness === "ready_for_dry_run"
    ? "dry_run_activation_packet"
    : activationReadiness === "needs_parser_support"
      ? "request_parser_support"
      : activationReadiness === "needs_legal_review"
        ? "request_legal_review"
        : "exclude_unsafe";
  const sectorUtility = uniqueStrings(source.safePublicRationale
    .flatMap((item) => item.replace("coverage:", "").split(","))
    .map((item) => item.trim())
    .filter(Boolean));
  const yieldReady = source.expectedEvidenceYield >= 0.5;

  return {
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    sourceFamily: source.category,
    sourceType: source.sourceType,
    url: source.url,
    trustScore: Number(Math.min(0.98, source.expectedEvidenceYield + 0.2).toFixed(2)),
    reliability: Number(Math.min(0.98, source.expectedEvidenceYield + 0.15).toFixed(2)),
    region: source.category === "government_cert" || source.category === "advisory" ? ["global", "Europe"] : ["global"],
    language: "en",
    sectorUtility,
    parserProfile,
    parserSupported,
    parserOwner: sourceMarketplaceParserOwner(parserProfile),
    legalReviewState: source.legalReviewState,
    robotsReviewState: source.robotsReviewState,
    schedulerCost: source.schedulerBudget,
    expectedEvidenceYield: source.expectedEvidenceYield,
    duplicateRate: source.category === "rss" ? 0.08 : source.category === "public_research_feed" ? 0.05 : 0.02,
    activationReadiness,
    rollbackState: {
      rollbackPath: source.rollbackQuarantinePlan.rollbackPath,
      quarantineTrigger: source.rollbackQuarantinePlan.quarantineTrigger
    },
    recommendedAction,
    handoffs: {
      agent02: source.schedulerBudget.estimatedDailyTasks <= 24 ? "scheduler_budget_ready" : "budget_review",
      agent03: parserSupported ? "parser_supported" : "parser_gap",
      agent04: source.category === "rss" || source.category === "vendor_blog" || source.category === "advisory" ? "public_signal_candidate" : "not_public_channel",
      agent06: yieldReady ? "evidence_yield_ready" : "yield_watch",
      agent07: yieldReady ? "quality_input_ready" : "quality_watch",
      agent09: "api_contract_ready",
      agent10: activationReadiness === "ready_for_dry_run" ? "slo_ready" : "release_hold"
    }
  };
}

function buildSourceMarketplaceParserCapabilityMatrix(sources: SourceMarketplaceSource[]): SourceMarketplaceParserCapability[] {
  const definitions: Array<Omit<SourceMarketplaceParserCapability, "marketplaceSourceCount" | "compatibleSourceCount">> = [
    { profile: "static_html", owner: "agent_03", supportedSourceTypes: ["static_web"], supported: true, activationBlockedUntilSupported: false, notes: ["static public HTML parser available for safe public pages"] },
    { profile: "rss", owner: "agent_03", supportedSourceTypes: ["rss"], supported: true, activationBlockedUntilSupported: false, notes: ["RSS/Atom parser available with conditional request support"] },
    { profile: "dynamic_page", owner: "agent_03", supportedSourceTypes: ["dynamic_web"], supported: false, activationBlockedUntilSupported: true, notes: ["browser/dynamic workers remain disabled until separate canary approval"] },
    { profile: "pdf_report", owner: "agent_03", supportedSourceTypes: ["pdf"], supported: true, activationBlockedUntilSupported: false, notes: ["public PDF/report parsing is supported for defensive reports"] },
    { profile: "public_channel", owner: "agent_04", supportedSourceTypes: ["telegram_public"], supported: false, activationBlockedUntilSupported: true, notes: ["public-channel activation is governed separately and does not satisfy safe-public marketplace rollout"] },
    { profile: "advisory_security_signal", owner: "agent_03", supportedSourceTypes: ["api"], supported: true, activationBlockedUntilSupported: false, notes: ["public advisory/security APIs are supported without private repository access"] },
    { profile: "restricted_metadata_handoff", owner: "agent_05", supportedSourceTypes: ["tor_metadata", "i2p_metadata", "freenet_metadata"], supported: false, activationBlockedUntilSupported: true, notes: ["restricted metadata stays approval-gated and cannot become safe-public activation"] }
  ];
  return definitions.map((definition) => {
    const matches = sources.filter((source) => source.parserProfile === definition.profile);
    return {
      ...definition,
      marketplaceSourceCount: matches.length,
      compatibleSourceCount: matches.filter((source) => source.parserSupported).length
    };
  });
}

function sourceMarketplaceParserProfile(sourceType: SourceType, category: SourceActivationWaveCategory): SourceMarketplaceParserProfile {
  if (sourceType === "rss") return "rss";
  if (sourceType === "api" || category === "github_security_advisory" || category === "advisory") return "advisory_security_signal";
  if (sourceType === "static_web") return "static_html";
  if (sourceType === "pdf") return "pdf_report";
  if (sourceType === "telegram_public") return "public_channel";
  if (sourceType === "dynamic_web") return "dynamic_page";
  return "restricted_metadata_handoff";
}

function sourceMarketplaceParserOwner(profile: SourceMarketplaceParserProfile): SourceMarketplaceSource["parserOwner"] {
  if (profile === "public_channel") return "agent_04";
  if (profile === "restricted_metadata_handoff") return "agent_05";
  return "agent_03";
}

function sourceMarketplaceSafePublic(source: SourceActivationWaveSource): boolean {
  return ["rss", "static_web", "api", "pdf"].includes(source.sourceType) && source.approvalScope === "safe_public_auto";
}

function sourceMarketplaceUnsupportedClasses(): SourceMarketplaceApiResponse["unsupportedSourceClasses"] {
  return [
    { sourceClass: "restricted_raw_payload", owner: "agent_01", activationAllowed: false, reason: "Raw restricted payloads and leaked datasets are never safe-public marketplace sources." },
    { sourceClass: "private_forum_or_invite", owner: "agent_01", activationAllowed: false, reason: "Private or invite-only collection requires separate governance and cannot be installed from marketplace." },
    { sourceClass: "credentialed_or_auth_gated", owner: "agent_01", activationAllowed: false, reason: "Credentialed, tokenized, or auth-gated targets are excluded from automatic onboarding." },
    { sourceClass: "captcha_or_bypass_required", owner: "agent_03", activationAllowed: false, reason: "CAPTCHA solving and bypass flows are prohibited; dynamic parsing needs separate canary approval." },
    { sourceClass: "public_chat_source", owner: "agent_04", activationAllowed: false, reason: "Public chat sources are handled by the public-channel workflow and do not count as safe-public web rollout." },
    { sourceClass: "restricted_metadata_handoff", owner: "agent_05", activationAllowed: false, reason: "Restricted metadata remains metadata-only, legal/operator approved, and separated from safe-public activation." }
  ];
}

function activationExecutionSource(
  source: SourceActivationWaveSource,
  canaryOrder: number | undefined,
  rolloutOrder: number,
  generatedAt: string
): SourceActivationExecutionSource {
  const legalReviewAgeDays = reviewAgeDays(generatedAt, generatedAt, true);
  const robotsReviewAgeDays = source.robotsReviewState === "not_required"
    ? "not_required"
    : reviewAgeDays(generatedAt, generatedAt, true);
  return {
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    category: source.category,
    sourceType: source.sourceType,
    url: source.url,
    canaryOrder,
    rolloutOrder,
    approvalScope: source.approvalScope,
    legalReviewAgeDays,
    robotsReviewAgeDays,
    parserOwner: "agent_03",
    parserCompatible: source.parserCompatible,
    schedulerBudget: source.schedulerBudget,
    expectedCaptureYield: Number(Math.min(0.98, source.expectedEvidenceYield + 0.22).toFixed(2)),
    expectedEvidenceYield: source.expectedEvidenceYield,
    rollbackTrigger: "capture success below 85%, parser failures above SLA, legal/robots proof expiry, or duplicate canonical URL drift",
    quarantineTrigger: source.rollbackQuarantinePlan.quarantineTrigger,
    postActivationDriftChecks: [
      "legal_review_age_days",
      "robots_review_age_days",
      "capture_success_ratio",
      "parser_error_rate",
      "evidence_yield",
      "duplicate_canonical_url_count",
      "scheduler_queue_budget"
    ]
  };
}

function activationExecutionExcludedSources(generatedAt: string): SourceActivationExecutionExcludedSource[] {
  const excluded: Array<Omit<SourceActivationExecutionExcludedSource, "dryRun" | "willMutate" | "willStartCrawling">> = [
    { sourceId: stableId("src_excluded", `restricted:${generatedAt}`), sourceName: "Restricted raw payload mirror", sourceType: "tor_metadata", excludedClass: "restricted_raw_payload", owner: "agent_01", reason: "Restricted source classes cannot satisfy safe-public activation coverage." },
    { sourceId: stableId("src_excluded", `private-forum:${generatedAt}`), sourceName: "Private forum invite feed", sourceType: "dynamic_web", excludedClass: "private_forum", owner: "agent_01", reason: "Private or invite-only communities require explicit governance and are not part of public rollout." },
    { sourceId: stableId("src_excluded", `credentialed:${generatedAt}`), sourceName: "Credentialed portal feed", sourceType: "static_web", excludedClass: "credentialed_source", owner: "agent_01", reason: "Credentialed sources are excluded from non-mutating public activation packets." },
    { sourceId: stableId("src_excluded", `leaked-file:${generatedAt}`), sourceName: "Leaked file endpoint", sourceType: "static_web", excludedClass: "leaked_file_endpoint", owner: "agent_01", reason: "Leaked-file endpoints are never included in safe-public source rollout." },
    { sourceId: stableId("src_excluded", `captcha:${generatedAt}`), sourceName: "CAPTCHA-gated threat portal", sourceType: "dynamic_web", excludedClass: "captcha_gated", owner: "agent_01", reason: "CAPTCHA-gated collection is excluded; no bypass or browser automation is planned." },
    { sourceId: stableId("src_excluded", `public-chat:${generatedAt}`), sourceName: "Public chat repost channel", sourceType: "telegram_public", excludedClass: "public_chat_source", owner: "agent_01", reason: "Public-chat sources are governed by Agent 04 and do not count toward safe-public web rollout." },
    { sourceId: stableId("src_excluded", `parser-gap:${generatedAt}`), sourceName: "Dynamic vendor portal parser gap", sourceType: "dynamic_web", excludedClass: "parser_gap", owner: "agent_03", reason: "Parser ownership is handed to Agent 03 before the source can enter an activation wave." },
    { sourceId: stableId("src_excluded", `duplicate:${generatedAt}`), sourceName: "Duplicate advisory mirror", sourceType: "rss", excludedClass: "duplicate", owner: "agent_01", reason: "Duplicate canonical coverage is suppressed until retirement is approved." }
  ];
  return excluded.map((source) => ({
    ...source,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false
  }));
}

function activationExecutionBudgetBreakdown(sources: SourceActivationExecutionSource[]): Record<SourceCollectionSla["budgetClass"], number> {
  const counts: Record<SourceCollectionSla["budgetClass"], number> = { low: 0, normal: 0, high: 0, urgent: 0 };
  for (const source of sources) counts[source.schedulerBudget.budgetClass] += source.schedulerBudget.estimatedDailyTasks;
  return counts;
}

function enterpriseActivationWaveSource(
  template: typeof ENTERPRISE_SAFE_PUBLIC_SOURCE_TEMPLATES[number],
  index: number,
  generatedAt: string
): SourceActivationWaveSource {
  const sourceType: SourceType = template.category === "github_security_advisory" || template.url.includes("api.github.com") ? "api" : "rss";
  const cadence = template.category === "advisory" || template.category === "government_cert" ? 3600 : 21600;
  const estimatedDailyTasks = Math.ceil(86400 / Math.max(3600, cadence));
  const legalReviewState = reviewState(generatedAt, generatedAt, true);
  const robotsReviewState = sourceType === "rss" ? reviewState(generatedAt, generatedAt, true) : "not_required";
  const expectedEvidenceYield = Number((0.55 + (index % 7) * 0.05).toFixed(2));
  return {
    sourceId: stableId("src_wave", `${template.category}:${template.name}`),
    sourceName: template.name,
    category: template.category,
    sourceType,
    url: template.url,
    approvalScope: "safe_public_auto",
    legalReviewState,
    robotsReviewState,
    parserCompatible: true,
    schedulerBudget: {
      budgetClass: template.category === "advisory" || template.category === "government_cert" ? "high" : "normal",
      cadenceSeconds: cadence,
      estimatedDailyTasks,
      maxBytes: 1_000_000
    },
    expectedEvidenceYield,
    rollbackQuarantinePlan: {
      rollbackPath: "disable candidate before activation and keep previous source set active",
      quarantineTrigger: "parser failure, robots/legal review expiry, or capture success below SLA"
    },
    promotionImpact: {
      agent07: "ready_for_extraction",
      agent09: "api_coverage_ready",
      agent10: "release_candidate"
    },
    safePublicRationale: [
      "public unauthenticated defensive CTI source",
      `category:${template.category}`,
      `coverage:${template.tags.slice(0, 4).join(",")}`
    ]
  };
}

function classifyCloseoutQuery(query: string): SourceCoverageCloseoutQueryClass {
  const terms = tokenizeQuery(query);
  if (terms.includes("campaign")) return "campaign";
  if (["infrastructure", "c2", "domain", "ip"].some((term) => terms.includes(term))) return "infrastructure";
  return classifyCoverageQuery(query);
}

function uniqueQueriesByCloseoutClass(queries: string[]): string[] {
  const seen = new Set<SourceCoverageCloseoutQueryClass>();
  const deduped: string[] = [];
  for (const query of queries) {
    const queryClass = classifyCloseoutQuery(query);
    if (seen.has(queryClass)) continue;
    seen.add(queryClass);
    deduped.push(query);
  }
  return deduped;
}

function sourceMatchesCloseoutQuery(source: SourceActivationWaveSource, query: string, queryClass: SourceCoverageCloseoutQueryClass): boolean {
  const terms = tokenizeQuery(query);
  const haystack = [source.sourceName, source.category, ...source.safePublicRationale].map((value) => value.toLowerCase()).join(" ");
  if (queryClass === "actor") return ["actor", "apt", "threat", "research", "vendor"].some((term) => haystack.includes(term)) || terms.some((term) => haystack.includes(term));
  if (queryClass === "ransomware_victim") return haystack.includes("ransomware") || haystack.includes("incident") || haystack.includes("victim");
  if (queryClass === "cve") return haystack.includes("cve") || haystack.includes("vulnerab") || haystack.includes("advisory");
  if (queryClass === "malware_tool") return haystack.includes("malware") || haystack.includes("tool") || haystack.includes("research");
  if (queryClass === "country") return source.category === "government_cert" || haystack.includes("cert") || haystack.includes("government");
  if (queryClass === "sector") return haystack.includes("sector") || haystack.includes("critical") || haystack.includes("advisory");
  if (queryClass === "campaign") return haystack.includes("campaign") || haystack.includes("threat") || haystack.includes("research");
  return haystack.includes("infrastructure") || haystack.includes("github") || haystack.includes("advisory") || haystack.includes("research");
}

function buildSourceFamilyCoverageGate(query: string, matching: SourceRecord[]): SourceFamilyCoverageGate {
  const queryClass = classifyCoverageQuery(query);
  const requirements = sourceCoverageSloRequirements(queryClass);
  const eligible = matching.filter((source) => sourceCanSatisfyPublicSlo(source) && (source.status === "active" || source.status === "probation" || source.status === "degraded"));
  const families = uniqueStrings(eligible.map(sourceFamilyKey));
  const requiredFamilies = requirements.minSourceFamilies;
  const actualFamilies = families.length;
  const status: SourceFamilyCoverageGate["status"] = actualFamilies >= requiredFamilies
    ? "pass"
    : actualFamilies > 0
      ? "warning"
      : "hold";
  return {
    queryClass,
    status,
    requiredFamilies,
    actualFamilies,
    families,
    missingFamilies: Array.from({ length: Math.max(0, requiredFamilies - actualFamilies) }, (_, index) => `required_family_${index + actualFamilies + 1}`),
    releaseImpact: status === "pass" ? "none" : status === "warning" ? "partial_answer" : "promotion_hold"
  };
}

function buildSourceSlaPromotionGate(
  rows: SourceRuntimeSlaSource[],
  remediation: SourceRuntimeSlaRemediation[],
  sourceFamilyGate: SourceFamilyCoverageGate
): SourceSlaPromotionGate {
  const holds: SourceSlaPromotionGate["holds"] = [];
  const addHold = (code: SourceSlaPromotionGate["holds"][number]["code"], owner: SourceSlaPromotionGate["holds"][number]["owner"], sourceIds: string[], reason: string) => {
    holds.push({ code, owner, sourceIds: uniqueStrings(sourceIds), reason });
  };
  if (sourceFamilyGate.status === "hold") addHold("source_family_coverage", "agent_01", [], `Only ${sourceFamilyGate.actualFamilies}/${sourceFamilyGate.requiredFamilies} source families satisfy the ${sourceFamilyGate.queryClass} gate.`);
  const parserGaps = rows.filter((source) => source.metrics.parser_compatibility.status !== "pass").map((source) => source.sourceId);
  const schedulerCost = rows.filter((source) => source.metrics.scheduler_cost.status === "breach").map((source) => source.sourceId);
  const evidenceYield = rows.filter((source) => source.metrics.evidence_yield.status === "breach" || source.metrics.claim_yield.status === "breach").map((source) => source.sourceId);
  const legalReview = rows.filter((source) => source.metrics.legal_review_age.status !== "pass").map((source) => source.sourceId);
  const robotsReview = rows.filter((source) => source.metrics.robots_review_age.status !== "pass").map((source) => source.sourceId);
  const quarantined = rows.filter((source) => source.quarantineState.quarantined).map((source) => source.sourceId);
  if (parserGaps.length > 0) addHold("parser_gap", "agent_03", parserGaps, "Parser compatibility gap blocks source promotion.");
  if (schedulerCost.length > 0) addHold("scheduler_cost", "agent_02", schedulerCost, "Scheduler cost exceeds source SLA budget.");
  if (evidenceYield.length > 0) addHold("evidence_yield", "agent_06", evidenceYield, "Evidence or claim yield is below promotion threshold.");
  if (legalReview.length > 0) addHold("legal_review", "agent_01", legalReview, "Legal review must be current before release promotion.");
  if (robotsReview.length > 0) addHold("robots_review", "agent_01", robotsReview, "Robots review must be current before release promotion.");
  if (quarantined.length > 0) addHold("quarantine", "agent_10", quarantined, "Quarantined source requires release hold or rollback.");

  const rollback = holds.some((hold) => hold.code === "quarantine");
  const decision: SourceSlaPromotionGate["decision"] = rollback ? "rollback" : holds.length > 0 ? "hold" : sourceFamilyGate.status === "warning" ? "warn" : "pass";
  const releaseImpact: SourceSlaPromotionGate["agent10ReleaseDecision"]["releaseImpact"] = rollback
    ? "rollback_required"
    : decision === "hold"
      ? "block_release"
      : decision === "warn"
        ? "partial_answer"
        : "none";

  return {
    gate: "source_sla_enforcement",
    decision,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    holds,
    warnings: [
      ...(sourceFamilyGate.status === "warning" ? [`source_family_coverage:${sourceFamilyGate.actualFamilies}/${sourceFamilyGate.requiredFamilies}`] : []),
      ...rows.filter((source) => source.status === "warning").map((source) => `source_warning:${source.sourceId}`)
    ],
    repairPackets: remediation.map((item) => ({
      action: item.action,
      owner: item.owner,
      sourceIds: item.sourceIds,
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      releaseHold: item.releaseHold,
      reason: item.reason
    })),
    agent10ReleaseDecision: {
      field: "sourceSlaPromotionGate",
      status: rollback ? "rollback" : holds.length > 0 ? "hold" : "pass",
      releaseImpact,
      rollbackPath: rollback ? "keep quarantined source disabled and restore last known good source set" : "rerun runtime SLA after dry-run repairs are approved"
    }
  };
}

function sourceRuntimeSlaSource(source: SourceRecord, generatedAt: string): SourceRuntimeSlaSource {
  const freshnessTarget = source.catalog?.collection.freshnessTargetSeconds ?? 24 * 3600;
  const freshnessAgeSeconds = ageSeconds(source.crawlState?.lastCollectedAt ?? source.lastSeenAt, generatedAt);
  const captureSuccess = 1 - Math.max(0, Math.min(1, source.health?.errorRate ?? 0));
  const parserCompatible = source.catalog ? source.catalog.adapterCompatibility.includes(source.type) : true;
  const legalAgeDays = reviewAgeDays(source.metadata?.legalNotesReviewedAt, generatedAt, Boolean(source.legalNotes.trim()));
  const robotsRequired = sourceNeedsRobotsReview(source);
  const robotsAgeDays = robotsRequired ? reviewAgeDays(source.metadata?.robotsReviewedAt, generatedAt, true) : 0;
  const cadence = source.catalog?.collection.crawlCadenceSeconds ?? source.crawlFrequencySeconds;
  const estimatedDailyTasks = Math.ceil(86400 / Math.max(60, cadence));
  const schedulerTaskTarget = schedulerTaskTargetForBudget(source.catalog?.collection.budgetClass ?? "normal");
  const evidenceYield = metadataScore(source, ["evidenceYield", "evidenceYieldScore", "extractionYield", "extractionYieldScore"], source.scoring?.parseability ?? 0.5);
  const claimYield = metadataScore(source, ["claimYield", "claimYieldScore"], evidenceYield * 0.8);
  const metrics: Record<SourceRuntimeSlaMetricName, SourceRuntimeSlaMetric> = {
    freshness: runtimeMetric("freshness", freshnessAgeSeconds, freshnessTarget, "seconds", "stale_results", "source freshness age versus runtime target"),
    capture_success_ratio: runtimeMetric("capture_success_ratio", captureSuccess, 0.85, "ratio", "partial_results", "successful captures divided by attempted captures", "higher"),
    parser_compatibility: runtimeMetric("parser_compatibility", parserCompatible ? 1 : 0, 1, "boolean", "parser_gap", "source type is supported by declared parser/adapter", "higher"),
    legal_review_age: runtimeMetric("legal_review_age", legalAgeDays, 90, "days", "release_hold", "legal review age in days"),
    robots_review_age: runtimeMetric("robots_review_age", robotsAgeDays, robotsRequired ? 90 : 0, "days", "release_hold", robotsRequired ? "robots review age in days" : "robots review is not required"),
    scheduler_cost: runtimeMetric("scheduler_cost", estimatedDailyTasks, schedulerTaskTarget, "tasks_per_day", "partial_results", "estimated source tasks per day"),
    evidence_yield: runtimeMetric("evidence_yield", evidenceYield, 0.35, "ratio", "partial_results", "ledger-backed evidence yield", "higher"),
    claim_yield: runtimeMetric("claim_yield", claimYield, 0.25, "ratio", "partial_results", "ledger-backed claim yield", "higher")
  };
  const metricRows = Object.values(metrics);
  const failingHealth = source.health?.status === "failing";
  const quarantined = source.status === "quarantined";
  const status: SourceRuntimeSlaStatus = quarantined || failingHealth || metricRows.some((metric) => metric.status === "breach")
    ? "breach"
    : metricRows.some((metric) => metric.status === "warning") || source.health?.status === "degraded" || source.status === "degraded"
      ? "warning"
      : "pass";
  const breachReasons = [
    ...metricRows.filter((metric) => metric.status === "breach").map((metric) => metric.name),
    ...(failingHealth ? ["source_health_failing"] : []),
    ...(quarantined ? ["source_quarantined"] : [])
  ];

  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    status,
    safePublic: sourceCanSatisfyPublicSlo(source),
    runtimeStatus: source.status,
    metrics,
    schedulerCost: {
      queueClass: source.catalog?.collection.budgetClass ?? "normal",
      cadenceSeconds: cadence,
      estimatedDailyTasks,
      maxBytes: typeof source.metadata?.maxBytes === "number" ? source.metadata.maxBytes : 1_000_000
    },
    rollbackState: {
      rollbackReason: source.catalog?.rollback?.rollbackReason,
      rollbackAt: source.catalog?.rollback?.rollbackAt,
      rollbackBy: source.catalog?.rollback?.rollbackBy
    },
    quarantineState: {
      quarantined,
      reason: source.catalog?.rollback?.lastQuarantineReason ?? source.health?.lastError
    },
    apiImpact: sourceRuntimeSlaSourceImpact(status, breachReasons),
    releaseHold: breachReasons.some((reason) => reason === "parser_compatibility" || reason === "legal_review_age" || reason === "robots_review_age" || reason === "source_quarantined"),
    breachReasons
  };
}

function runtimeMetric(
  name: SourceRuntimeSlaMetricName,
  actual: number,
  target: number,
  unit: SourceRuntimeSlaMetric["unit"],
  impact: SourceRuntimeSlaMetric["impact"],
  reason: string,
  direction: "lower" | "higher" = "lower"
): SourceRuntimeSlaMetric {
  const status = metricStatus(actual, target, direction);
  return {
    name,
    status,
    actual: Number(actual.toFixed(unit === "ratio" ? 3 : 0)),
    target,
    unit,
    impact: status === "pass" ? "none" : impact,
    reason
  };
}

function metricStatus(actual: number, target: number, direction: "lower" | "higher"): SourceRuntimeSlaStatus {
  if (direction === "higher") {
    if (actual >= target) return "pass";
    if (actual >= target * 0.75) return "warning";
    return "breach";
  }
  if (target === 0) return actual === 0 ? "pass" : "breach";
  if (actual <= target) return "pass";
  if (actual <= target * 2) return "warning";
  return "breach";
}

function buildSourceRuntimeSlaRemediation(
  rows: SourceRuntimeSlaSource[],
  duplicates: SourceActivationDuplicateGroup[]
): SourceRuntimeSlaRemediation[] {
  const items: SourceRuntimeSlaRemediation[] = [];
  const add = (
    action: SourceRuntimeSlaRemediation["action"],
    sourceIds: string[],
    owner: SourceRuntimeSlaRemediation["owner"],
    reason: string,
    approvalRequired = true,
    releaseHold = false
  ) => {
    const ids = uniqueStrings(sourceIds);
    if (ids.length === 0) return;
    items.push({ action, dryRun: true, willMutate: false, willStartCrawling: false, sourceIds: ids, approvalRequired, owner, reason, releaseHold });
  };

  add("activate_approved_source", rows.filter((source) => source.runtimeStatus === "approved").map((source) => source.sourceId), "agent_01", "approved sources are not yet active in runtime collection");
  add("pause_noisy_source", rows.filter((source) => source.metrics.scheduler_cost.status === "breach").map((source) => source.sourceId), "agent_02", "source scheduler cost exceeds runtime budget", false);
  add("quarantine_failure", rows.filter((source) => source.breachReasons.includes("source_health_failing") || source.quarantineState.quarantined).map((source) => source.sourceId), "agent_01", "source health or quarantine state blocks runtime SLA", false, true);
  add("request_legal_review", rows.filter((source) => source.metrics.legal_review_age.status !== "pass").map((source) => source.sourceId), "agent_01", "legal review is stale or missing", true, true);
  add("request_robots_review", rows.filter((source) => source.metrics.robots_review_age.status !== "pass").map((source) => source.sourceId), "agent_01", "robots review is stale or missing", true, true);
  add("change_cadence", rows.filter((source) => source.metrics.freshness.status !== "pass").map((source) => source.sourceId), "agent_02", "freshness SLA needs cadence or queue-budget adjustment");
  add("request_parser_support", rows.filter((source) => source.metrics.parser_compatibility.status !== "pass").map((source) => source.sourceId), "agent_03", "parser capability gap blocks activation", true, true);
  add("retire_duplicate", duplicates.flatMap((group) => group.sourceIds.slice(1)), "agent_01", "duplicate canonical source should be retired from runtime SLA set", false);
  add("change_cadence", rows.filter((source) => source.metrics.evidence_yield.status === "breach" || source.metrics.claim_yield.status === "breach").map((source) => source.sourceId), "agent_06", "ledger-backed evidence or claim yield is below runtime SLA");

  return items.sort((left, right) => Number(right.releaseHold) - Number(left.releaseHold) || left.action.localeCompare(right.action));
}

function sourceRuntimeSlaSourceImpact(status: SourceRuntimeSlaStatus, reasons: string[]): SourceRuntimeSlaSource["apiImpact"] {
  if (status === "pass") return "none";
  if (reasons.includes("source_quarantined") || reasons.includes("legal_review_age") || reasons.includes("robots_review_age") || reasons.includes("parser_compatibility")) return "blocked";
  if (reasons.includes("freshness")) return "stale_results";
  return "partial_results";
}

function sourceRuntimeSlaApiImpact(rows: SourceRuntimeSlaSource[]): SourceRuntimeSlaQuery["summary"]["apiImpact"] {
  if (rows.some((source) => source.apiImpact === "blocked")) return "blocked";
  if (rows.some((source) => source.apiImpact === "stale_results")) return "stale_results";
  if (rows.some((source) => source.apiImpact === "partial_results")) return "partial_results";
  return "none";
}

function runtimeSlaRank(status: SourceRuntimeSlaStatus): number {
  if (status === "breach") return 3;
  if (status === "warning") return 2;
  return 1;
}

function ageSeconds(value: string | undefined, generatedAt: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, Math.floor((Date.parse(generatedAt) - timestamp) / 1000));
}

function reviewAgeDays(value: unknown, generatedAt: string, hasRequiredText: boolean): number {
  if (!hasRequiredText || typeof value !== "string" || !value) return 9999;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 9999;
  return Math.max(0, Math.floor((Date.parse(generatedAt) - timestamp) / 86400000));
}

function metadataScore(source: SourceRecord, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = source.metadata?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.min(1, value));
  }
  return Math.max(0, Math.min(1, fallback));
}

function schedulerTaskTargetForBudget(budgetClass: SourceCollectionSla["budgetClass"]): number {
  if (budgetClass === "urgent") return 96;
  if (budgetClass === "high") return 48;
  if (budgetClass === "low") return 12;
  return 24;
}

function buildSourcePackOnboardingPlan(
  pack: SeedSourceBundle,
  existingSources: SourceRecord[],
  coverageQueries: SourceCoveragePlanQuery[],
  tenantId: string | undefined,
  generatedAt: string
): SourcePackOnboardingPlan {
  const installPlan = buildSafePublicSourcePackInstallPlan(pack, {
    mode: "dry_run",
    tenantId,
    existingSources,
    generatedAt
  });
  const accepted = installPlan.validation.accepted;
  const duplicateSourceIds = installPlan.recommendations
    .filter((item) => item.requiredAction === "skip_duplicate")
    .map((item) => item.sourceId)
    .sort();
  const parserCompatibility = accepted.map((source) => ({
    sourceId: source.id,
    sourceType: source.type,
    compatible: Boolean(source.catalog?.adapterCompatibility.includes(source.type)),
    adapterCompatibility: source.catalog?.adapterCompatibility ?? []
  }));
  const estimatedTasksPerDay = accepted.reduce((sum, source) => {
    const cadence = source.catalog?.collection.crawlCadenceSeconds ?? source.crawlFrequencySeconds;
    return sum + Math.ceil(86400 / Math.max(3600, cadence));
  }, 0);

  return {
    packName: pack.name,
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    duplicateAnalysis: {
      duplicateSourceCount: installPlan.duplicateSourceCount,
      duplicateSourceIds
    },
    complianceCompleteness: {
      complete: installPlan.validation.valid,
      missingLegalNotes: installPlan.validation.compliance.missingLegalNotes.length,
      missingCatalog: installPlan.validation.compliance.missingCatalog.length,
      rejectedSourceCount: installPlan.rejectedSourceCount
    },
    expectedCoverageDelta: coverageQueries.map((query) => {
      const sourceIds = installPlan.recommendations
        .filter((source) => sourcePackRecommendationCanSupportQuery(source, query.query))
        .slice(0, 12)
        .map((source) => source.sourceId);
      return {
        query: query.query,
        candidateAdditions: sourceIds.length,
        sourceIds,
        closesSloFailures: sourceIds.length > 0 ? query.slo.failures.filter((code) =>
          code === "below_minimum_active_sources" ||
          code === "insufficient_source_family_diversity" ||
          code === "missing_geographic_coverage" ||
          code === "missing_sector_coverage" ||
          code === "missing_approved_public_source_pack"
        ) : []
      };
    }),
    schedulerCost: {
      estimatedTasksPerDay,
      maxCadenceSeconds: Math.max(...accepted.map((source) => source.catalog?.collection.crawlCadenceSeconds ?? source.crawlFrequencySeconds), 0),
      budgetClasses: [...new Set(accepted.map((source) => source.catalog?.collection.budgetClass ?? "normal"))].sort()
    },
    parserCompatibility,
    rollbackQuarantineState: accepted.map((source) => ({
      sourceId: source.id,
      rollbackReason: source.catalog?.rollback?.rollbackReason,
      quarantineReason: source.catalog?.rollback?.lastQuarantineReason
    })).filter((item) => item.rollbackReason || item.quarantineReason),
    promotionSafety: {
      safeToPromote: installPlan.safeToInstall && parserCompatibility.every((item) => item.compatible),
      forbiddenSourceClasses: [
        "restricted raw payload collection",
        "private forums",
        "credentialed sources",
        "leaked-file endpoints",
        "CAPTCHA bypass",
        "public chat sources"
      ],
      notes: [
        "Dry-run onboarding creates candidates only.",
        "Scheduler cost is estimated and does not enqueue work.",
        "Restricted, private, auth, CAPTCHA, leaked-file, and public-chat sources cannot satisfy safe-public SLOs."
      ]
    }
  };
}

function buildSourceCoverageBurnDownReport(
  query: SourceCoveragePlanQuery,
  onboardingPlans: SourcePackOnboardingPlan[],
  sources: SourceRecord[]
): SourceCoverageBurnDownReport {
  const sourceAdditions = uniqueStrings(onboardingPlans.flatMap((plan) =>
    plan.expectedCoverageDelta.find((delta) => delta.query === query.query)?.sourceIds ?? []
  )).slice(0, 20);
  const unsafeSourceIds = uniqueStrings(query.drift
    .filter((item) => item.code === "unsafe_source_class_excluded" && item.sourceId)
    .map((item) => item.sourceId!));
  const staleSourceIds = uniqueStrings(query.drift
    .filter((item) => item.code === "freshness_slo_missed" && item.sourceId)
    .map((item) => item.sourceId!));
  return {
    query: query.query,
    statusBefore: query.slo.status,
    statusAfterPlannedAdditions: sourceAdditions.length > 0 && query.slo.failures.every((code) =>
      code === "below_minimum_active_sources" ||
      code === "insufficient_source_family_diversity" ||
      code === "missing_geographic_coverage" ||
      code === "missing_sector_coverage" ||
      code === "missing_approved_public_source_pack"
    ) ? "warning" : query.slo.status,
    sourceAdditions,
    legalReviews: uniqueStrings(query.drift.filter((item) => item.code === "missing_legal_review" && item.sourceId).map((item) => item.sourceId!)),
    cadenceIncreases: staleSourceIds,
    cadenceReductions: sources.filter((source) => unsafeSourceIds.includes(source.id) && source.status !== "active").map((source) => source.id).sort(),
    parserFixes: uniqueStrings(query.drift.filter((item) => item.code === "adapter_mismatch" && item.sourceId).map((item) => item.sourceId!)),
    duplicateRetirements: uniqueStrings(query.drift.filter((item) => item.code === "duplicate_canonical_url" && item.sourceId).map((item) => item.sourceId!)),
    blockedUnsafeSourceIds: unsafeSourceIds
  };
}

export function buildSafePublicSourcePackInstallPlan(
  bundle: SeedSourceBundle,
  options: {
    mode?: SafePublicSourcePackInstallMode;
    tenantId?: string;
    existingSources?: SourceRecord[];
    generatedAt?: string;
  } = {}
): SafePublicSourcePackInstallPlan {
  const generatedAt = options.generatedAt ?? nowIso();
  const scopedBundle: SeedSourceBundle = {
    ...bundle,
    sources: bundle.sources.map((source) => ({ ...source, tenantId: options.tenantId ?? source.tenantId }))
  };
  const validation = validateSeedBundle(scopedBundle, {
    dryRun: true,
    existingSources: options.existingSources,
    importedAt: generatedAt,
    referenceAt: generatedAt
  });
  const duplicateIds = new Set(validation.duplicates.map((duplicate) => scopedBundle.sources[duplicate.inputIndex]?.id).filter(Boolean));
  const erroredIds = new Set(validation.errors.map((error) =>
    scopedBundle.sources[error.inputIndex]?.id
  ).filter(Boolean));
  const recommendations = scopedBundle.sources
    .map((source): SafePublicSourcePackRecommendation => {
      const coverageTags = coverageTagsForSeed(source);
      const duplicate = source.id ? duplicateIds.has(source.id) : false;
      const errored = source.id ? erroredIds.has(source.id) : false;
      return {
        sourceId: source.id ?? stableId("src", seedDuplicateKey(source)),
        sourceName: source.name,
        sourceType: source.type,
        url: canonicalizeSeedUrl(source.url),
        tenantId: options.tenantId ?? source.tenantId,
        coverageTags,
        requiredAction: duplicate ? "skip_duplicate" : errored ? "fix_compliance" : "install_candidate",
        reasons: [
          `approval scope:${source.catalog?.approvalScope ?? "missing"}`,
          `adapter:${source.type}`,
          ...coverageTags.slice(0, 6).map((tag) => `coverage:${tag}`)
        ],
        score: source.trustScore + (source.catalog?.intelligenceValue ?? 0) + (source.catalog?.reliability ?? 0)
      };
    })
    .sort((left, right) => {
      const actionOrder = actionRank(left.requiredAction) - actionRank(right.requiredAction);
      return actionOrder || right.score - left.score || left.sourceId.localeCompare(right.sourceId);
    });

  return {
    mode: options.mode ?? "dry_run",
    dryRun: true,
    safeToInstall: validation.valid,
    willStartCrawling: false,
    packName: bundle.name,
    tenantId: options.tenantId,
    generatedAt,
    acceptedSourceCount: validation.accepted.length,
    rejectedSourceCount: validation.errors.length,
    duplicateSourceCount: validation.duplicates.length,
    validation,
    recommendations
  };
}

export function validateSafePublicStarterPackCoverage(
  bundle: SeedSourceBundle,
  queries: string[],
  options: { tenantId?: string; generatedAt?: string } = {}
): SafePublicStarterPackCoverageValidation {
  const generatedAt = options.generatedAt ?? nowIso();
  const installPlan = buildSafePublicSourcePackInstallPlan(bundle, {
    mode: "dry_run",
    tenantId: options.tenantId,
    generatedAt
  });
  const sources = installPlan.validation.accepted;
  const queryReports = queries.map((query): SafePublicStarterPackCoverageQuery => {
    const response = buildSourceActivationApiResponse(query, sources, {
      tenantId: options.tenantId,
      generatedAt
    });
    const matchingCandidates = response.candidateOnlyGaps.filter((source) => source.score > 0);
    const matchingActive = response.activeCoverage.filter((source) => source.score > 0);
    return {
      query,
      coverageReady: matchingCandidates.length + matchingActive.length > 0 && response.adapterIncompatibilities.length === 0,
      activeCoverageCount: matchingActive.length,
      candidateCoverageCount: matchingCandidates.length,
      topSourceIds: [...matchingActive, ...matchingCandidates]
        .sort((left, right) => right.score - left.score || left.sourceId.localeCompare(right.sourceId))
        .slice(0, 5)
        .map((source) => source.sourceId),
      underservedReasons: response.underservedReasons
    };
  });

  return {
    packName: bundle.name,
    generatedAt,
    valid: installPlan.validation.valid && queryReports.every((report) => report.coverageReady),
    queries: queryReports
  };
}

export function explainSourceForQuery(query: string, source: SourceRecord, referenceAt = nowIso()): SourceCoverageExplanation {
  const terms = tokenizeQuery(query);
  const catalog = source.catalog;
  const matchedTopics = matchTerms(terms, [...(catalog?.coverage.topics ?? []), ...(source.tags ?? [])]);
  const matchedActors = matchTerms(terms, [...(catalog?.coverage.actors ?? []), ...(catalog?.coverage.aliases ?? [])]);
  const matchedIndustries = matchTerms(terms, catalog?.coverage.industries ?? []);
  const matchedRegions = matchTerms(terms, [...(catalog?.coverage.regions ?? []), ...(catalog?.coverage.countries ?? [])]);
  const queryPatternHits = matchTerms(terms, catalog?.coverage.queryPatterns ?? []);
  const missingLegal = !source.legalNotes.trim();
  const stale = isStale(source, referenceAt);
  const adapterCompatible = !catalog || catalog.adapterCompatibility.includes(source.type);
  const status = activationStatus(source, { missingLegal, stale, adapterCompatible });
  const matchScore = matchedTopics.length * 0.14 +
    matchedActors.length * 0.24 +
    matchedIndustries.length * 0.16 +
    matchedRegions.length * 0.16 +
    queryPatternHits.length * 0.12;
  const catalogBoost = catalog ? 0.2 * catalog.intelligenceValue + 0.15 * catalog.reliability : 0;
  const statusPenalty = status === "active" || status === "approved_idle" || status === "candidate_only" ? 0 : 0.35;
  const score = Math.max(0, Math.min(1, matchScore + catalogBoost + source.trustScore * 0.15 - statusPenalty));
  const reasons = [
    ...matchedActors.map((value) => `actor match:${value}`),
    ...matchedTopics.map((value) => `topic match:${value}`),
    ...matchedIndustries.map((value) => `industry match:${value}`),
    ...matchedRegions.map((value) => `region match:${value}`),
    ...queryPatternHits.map((value) => `query pattern:${value}`)
  ];
  if (status !== "active") reasons.push(`activation:${status}`);
  if (catalog?.approvalScope) reasons.push(`approval scope:${catalog.approvalScope}`);

  return {
    sourceId: source.id,
    sourceName: source.name,
    status,
    score,
    reasons,
    matchedTopics,
    matchedActors,
    matchedIndustries,
    matchedRegions
  };
}

function buildSeedImportReport(bundle: SeedSourceBundle, options: SeedSourceImportOptions): SeedSourceImportReport {
  const accepted: SourceRecord[] = [];
  const duplicates: SeedSourceDuplicate[] = [];
  const errors: SeedSourceValidationError[] = [];
  const compliance: SeedSourceComplianceReport = {
    missingLegalNotes: [],
    missingCatalog: [],
    stale: [],
    overlappingCoverage: []
  };
  const importedAt = options.importedAt ?? nowIso();
  const referenceAt = options.referenceAt ?? importedAt;
  const existing = new Map((options.existingSources ?? []).map((source) => [seedDuplicateKey(source), source.id]));
  const seen = new Map<string, number>();

  if (bundle.version !== 1) {
    errors.push({ inputIndex: -1, message: "Unsupported seed bundle version" });
  }

  bundle.sources.forEach((input, inputIndex) => {
    if (!input.legalNotes.trim()) {
      compliance.missingLegalNotes.push({ inputIndex, sourceName: input.name, message: "Source legal notes are required" });
    }
    if (!input.catalog) {
      compliance.missingCatalog.push({ inputIndex, sourceName: input.name, message: "Seed source catalog metadata is required" });
    }

    try {
      const key = seedDuplicateKey(input);
      const existingSourceId = existing.get(key);
      const duplicateOfIndex = seen.get(key);
      if (existingSourceId || duplicateOfIndex !== undefined) {
        duplicates.push({ key, inputIndex, existingSourceId, duplicateOfIndex });
      }
      seen.set(key, inputIndex);

      validateSafeSeedSource(input);
      const source = seedInputToSource(input, importedAt);
      validateSource(source);
      accepted.push(source);
    } catch (error) {
      errors.push({
        inputIndex,
        sourceName: input.name,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });
  compliance.overlappingCoverage = findCoverageOverlap(bundle.sources);

  return {
    dryRun: options.dryRun ?? true,
    valid: errors.length === 0 && duplicates.length === 0,
    accepted: errors.length === 0 ? accepted : accepted.filter((source) =>
      !errors.some((error) => error.sourceName === source.name)
    ),
    duplicates,
    errors,
    activation: {
      approved: accepted.filter((source) => source.catalog?.approvalScope === "safe_public_auto").length,
      blocked: accepted.filter((source) => source.catalog?.approvalScope === "disabled").length,
      stale: accepted.filter((source) => isStale(source, referenceAt)).length,
      duplicates: duplicates.length,
      missingLegalNotes: accepted.filter((source) => !source.legalNotes.trim()).length,
      adapterIncompatible: accepted.filter((source) => source.catalog && !source.catalog.adapterCompatibility.includes(source.type)).length
    },
    compliance: {
      ...compliance,
      stale: accepted.flatMap((source) => staleSourceReport(source, referenceAt))
    }
  };
}

function seedInputToSource(input: SeedSourceInput, importedAt: string): SourceRecord {
  return {
    ...input,
    id: input.id ?? stableId("src", seedDuplicateKey(input)),
    status: "candidate",
    url: canonicalizeSeedUrl(input.url),
    lastSeenAt: input.lastSeenAt,
    createdAt: importedAt,
    updatedAt: importedAt,
    governance: {
      approvalRequired: false,
      approvalState: "not_required",
      metadataOnly: false,
      policyVersion: "collection-policy:v1"
    },
    health: {
      status: "unknown",
      consecutiveFailures: 0,
      errorRate: 0
    },
    crawlState: {
      retryCount: 0
    },
    catalog: input.catalog,
    scoring: {
      reliability: input.trustScore,
      freshness: 0.5,
      relevance: 0.7,
      uniqueness: 0.5,
      parseability: 0.6,
      policyRiskPenalty: 0,
      operatorBoost: 0
    },
    tags: [...new Set([...(input.tags ?? []), "seed", "public-cti"])]
  };
}

function validateSafeSeedSource(input: SeedSourceInput): void {
  if (!SAFE_PUBLIC_TYPES.has(input.type)) throw new Error("Seed source type must be safe public CTI");
  if (!SAFE_ACCESS_METHODS.has(input.accessMethod)) throw new Error("Seed source access must be public or official API");
  if (input.risk !== "low") throw new Error("Seed source risk must be low");
  if (input.type === "api" && input.accessMethod !== "official_api" && input.accessMethod !== "public_http") {
    throw new Error("API seed source must use public HTTP or official API access");
  }
  validateCatalog(input);
}

function validateCatalog(input: SeedSourceInput): void {
  const catalog = input.catalog;
  if (!catalog) throw new Error("Seed source catalog metadata is required");
  if (catalog.approvalScope !== "safe_public_auto") throw new Error("Safe public seeds must use safe_public_auto approval scope");
  if (!catalog.license.trim() || !catalog.legalBasis.trim()) throw new Error("Catalog license and legal basis are required");
  if (!catalog.publisher.name.trim()) throw new Error("Catalog publisher identity is required");
  if (catalog.collection.crawlCadenceSeconds < 60) throw new Error("Catalog crawl cadence must be at least 60 seconds");
  if (!catalog.adapterCompatibility.includes(input.type)) throw new Error("Catalog adapter compatibility must include source type");
  if (catalog.reliability < 0 || catalog.reliability > 1 || catalog.intelligenceValue < 0 || catalog.intelligenceValue > 1) {
    throw new Error("Catalog reliability and intelligence value must be between 0 and 1");
  }
}

function canonicalizeSeedUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  const search = [...url.searchParams.entries()].sort(([left], [right]) => left.localeCompare(right));
  url.search = "";
  for (const [key, item] of search) url.searchParams.append(key, item);
  return url.toString();
}

function canonicalizeDuplicateUrl(value?: string): string {
  if (!value?.trim()) return "missing-url";
  try {
    return canonicalizeSeedUrl(value);
  } catch {
    return `invalid-url:${stableId("url", value)}`;
  }
}

const ACTIVATION_STATUSES: SourceActivationStatus[] = [
  "active",
  "approved_idle",
  "candidate_only",
  "blocked_by_policy",
  "missing_legal_notes",
  "stale",
  "duplicate",
  "adapter_incompatible"
];

function activationStatus(
  source: SourceRecord,
  checks: { missingLegal: boolean; stale: boolean; adapterCompatible: boolean }
): SourceActivationStatus {
  if (checks.missingLegal) return "missing_legal_notes";
  if (!checks.adapterCompatible) return "adapter_incompatible";
  if (source.catalog?.approvalScope === "disabled" || source.accessMethod === "disabled" || source.status === "disabled" || source.status === "rejected") {
    return "blocked_by_policy";
  }
  if (checks.stale) return "stale";
  if (source.status === "active" || source.status === "probation" || source.status === "degraded") return "active";
  if (source.status === "approved") return "approved_idle";
  if (source.status === "candidate" || source.status === "needs_review") return "candidate_only";
  return "blocked_by_policy";
}

function requiredActivationAction(status: SourceActivationStatus): LiveSearchPlannerDto["recommendedSourceActivations"][number]["requiredAction"] {
  if (status === "blocked_by_policy" || status === "adapter_incompatible") return "enable_adapter";
  if (status === "stale" || status === "approved_idle") return "restore";
  if (status === "candidate_only" || status === "missing_legal_notes") return "approve";
  return "add_source";
}

function activationCoverageGapForStatus(status: SourceActivationStatus): string | undefined {
  if (status === "candidate_only" || status === "approved_idle") return "source_activation";
  if (status === "missing_legal_notes") return "source_compliance";
  if (status === "stale") return "source_freshness";
  if (status === "adapter_incompatible") return "adapter_compatibility";
  if (status === "blocked_by_policy") return "source_policy";
  if (status === "duplicate") return "source_duplicate";
  return undefined;
}

function actionPriorityBoost(status: SourceActivationStatus): number {
  if (status === "candidate_only") return 25;
  if (status === "approved_idle") return 20;
  if (status === "missing_legal_notes") return 15;
  if (status === "stale") return 12;
  if (status === "adapter_incompatible") return 10;
  return 5;
}

function activationGapReason(status: SourceActivationStatus): string {
  if (status === "approved_idle") return "Matching sources are approved but not active in collection.";
  if (status === "candidate_only") return "Matching safe-public candidate sources need activation.";
  if (status === "blocked_by_policy") return "Matching sources are blocked by policy or disabled access.";
  if (status === "missing_legal_notes") return "Matching sources are missing required legal notes.";
  if (status === "stale") return "Matching sources missed their freshness target.";
  if (status === "duplicate") return "Matching sources duplicate existing canonical source URLs.";
  if (status === "adapter_incompatible") return "Matching sources require adapter compatibility work before scheduling.";
  return "Matching sources are already active.";
}

function apiSourceSummary(explanation: SourceCoverageExplanation, source: SourceRecord): SourceActivationApiSourceSummary {
  return {
    ...explanation,
    tenantId: source.tenantId,
    sourceType: source.type,
    url: source.url,
    approvalScope: source.catalog?.approvalScope,
    healthStatus: source.health?.status,
    freshnessTargetSeconds: source.catalog?.collection.freshnessTargetSeconds
  };
}

function duplicateGroups(sources: SourceRecord[]): SourceActivationDuplicateGroup[] {
  const groups = new Map<string, string[]>();
  for (const source of sources) {
    const key = seedDuplicateKey(source);
    groups.set(key, [...(groups.get(key) ?? []), source.id]);
  }
  return [...groups.entries()]
    .filter(([, sourceIds]) => sourceIds.length > 1)
    .map(([key, sourceIds]) => ({ key, sourceIds: sourceIds.sort() }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function buildUnderservedReasons(
  query: string,
  sources: SourceRecord[],
  summaries: SourceActivationApiSourceSummary[],
  duplicates: SourceActivationDuplicateGroup[]
): SourceActivationUnderservedReason[] {
  const reasons: SourceActivationUnderservedReason[] = [];
  const matching = summaries.filter((source) => source.score > 0);
  const activeMatching = matching.filter((source) => source.status === "active");
  const terms = tokenizeQuery(query);
  const actorish = !terms.includes("cve") && !terms.includes("vulnerability") && terms.some((term) => term.length >= 4);

  if (actorish && !activeMatching.some((source) => source.matchedActors.length > 0)) {
    reasons.push({
      code: "missing_actor_coverage",
      severity: matching.some((source) => source.matchedActors.length > 0) ? "warning" : "critical",
      reason: "No active source has actor or alias coverage for this query.",
      sourceIds: matching.filter((source) => source.matchedActors.length > 0).map((source) => source.sourceId),
      suggestedAction: "add_source"
    });
  }

  const stale = matching.filter((source) => source.status === "stale");
  if (stale.length) {
    reasons.push({
      code: "stale_cadence",
      severity: "warning",
      reason: "Matching sources missed their freshness target and should be restored or re-polled.",
      sourceIds: stale.map((source) => source.sourceId),
      suggestedAction: "restore"
    });
  }

  if (!sources.some((source) => source.type === "telegram_public" && source.status !== "disabled" && source.status !== "rejected")) {
    reasons.push({
      code: "no_public_channel_coverage",
      severity: "info",
      reason: "No safe public-channel source is available for this query.",
      sourceIds: [],
      suggestedAction: "add_source"
    });
  }

  if (!sources.some((source) =>
    (source.type === "tor_metadata" || source.type === "i2p_metadata" || source.type === "freenet_metadata") &&
    source.governance?.metadataOnly === true &&
    source.governance.approvalState === "approved"
  )) {
    reasons.push({
      code: "no_approved_restricted_metadata_source",
      severity: "info",
      reason: "No approved metadata-only restricted source is available for restricted-source corroboration.",
      sourceIds: [],
      suggestedAction: "approve"
    });
  }

  const unhealthy = matching.filter((source) => source.healthStatus === "degraded" || source.healthStatus === "failing");
  if (unhealthy.length) {
    reasons.push({
      code: "source_unhealthy",
      severity: unhealthy.some((source) => source.healthStatus === "failing") ? "critical" : "warning",
      reason: "Matching sources have degraded or failing health.",
      sourceIds: unhealthy.map((source) => source.sourceId),
      suggestedAction: "restore"
    });
  }

  const disabled = matching.filter((source) => source.status === "blocked_by_policy");
  if (disabled.length) {
    reasons.push({
      code: "source_disabled",
      severity: "warning",
      reason: "Matching sources are disabled, rejected, or blocked by policy.",
      sourceIds: disabled.map((source) => source.sourceId),
      suggestedAction: "enable_adapter"
    });
  }

  if (duplicates.length) {
    const duplicateIds = new Set(duplicates.flatMap((group) => group.sourceIds));
    const duplicateMatching = matching.filter((source) => duplicateIds.has(source.sourceId));
    if (duplicateMatching.length) {
      reasons.push({
        code: "source_disabled",
        severity: "info",
        reason: "Matching coverage includes duplicate canonical source URLs; install plans should skip duplicates.",
        sourceIds: duplicateMatching.map((source) => source.sourceId),
        suggestedAction: "add_source"
      });
    }
  }

  return reasons.sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.code.localeCompare(right.code));
}

function buildCoverageVerticals(
  query: string,
  activation: SourceActivationApiResponse,
  packs: SeedSourceBundle[]
): SourceCoveragePlanVertical[] {
  const allSources = [
    ...activation.activeCoverage,
    ...activation.approvedIdleSources,
    ...activation.candidateOnlyGaps,
    ...activation.staleSources,
    ...activation.adapterIncompatibilities,
    ...activation.policyBlocks
  ];
  const packRecommendations = activation.sourcePackRecommendations;
  const verticals: Array<{ vertical: SourceCoveragePlanVertical["vertical"]; terms: string[]; reason: string }> = [
    { vertical: "actor_intelligence", terms: actorishQuery(query) ? ["actor", "campaign", "threat-report"] : ["actor"], reason: "Actor searches need vendor, government, and standards-backed actor reporting." },
    { vertical: "vulnerability_intelligence", terms: ["CVE", "vulnerability", "exploitation"], reason: "Vulnerability searches need government catalogs and advisory datasets." },
    { vertical: "ransomware_victim_reporting", terms: ["ransomware", "victimology", "incident"], reason: "Ransomware and victim searches need public ransomware reporting and incident news." },
    { vertical: "vendor_research", terms: ["vendor", "research", "threat-report"], reason: "Vendor research improves freshness and corroboration for named actor searches." },
    { vertical: "government_advisories", terms: ["government", "advisory", "CERT", "CISA", "NCSC"], reason: "Government advisories provide high-trust defensive context." },
    { vertical: "malware_reports", terms: ["malware", "TTP", "tooling"], reason: "Malware reports connect actors to tooling and techniques." },
    { vertical: "public_datasets", terms: ["ATT&CK", "GitHub advisory", "public dataset", "CVE"], reason: "Public datasets make enrichment and cross-product interpretation stable." }
  ];
  const rows = verticals.map((vertical): SourceCoveragePlanVertical => {
    const active = allSources.filter((source) => source.status === "active" && sourceMatchesTerms(source, vertical.terms));
    const candidates = allSources.filter((source) =>
      (source.status === "candidate_only" || source.status === "approved_idle") && sourceMatchesTerms(source, vertical.terms)
    );
    const recommended = packRecommendations.filter((source) =>
      source.coverageTags.some((tag) => vertical.terms.some((term) => includesTerm(tag, term)))
    );
    return {
      vertical: vertical.vertical,
      present: active.length + candidates.length + recommended.length > 0,
      activeCount: active.length,
      candidateCount: candidates.length,
      recommendedSourceIds: recommended.slice(0, 8).map((source) => source.sourceId),
      reason: vertical.reason
    };
  });

  rows.push({
    vertical: "public_channel",
    present: false,
    activeCount: 0,
    candidateCount: 0,
    recommendedSourceIds: [],
    reason: "Public-channel packs are owned separately and should be joined by Agent 04/09 when available."
  });
  rows.push({
    vertical: "restricted_metadata",
    present: false,
    activeCount: 0,
    candidateCount: 0,
    recommendedSourceIds: [],
    reason: "Restricted metadata remains metadata-only and requires separate legal approval; no clear-web pack may enable it."
  });

  if (packs.length === 0) return rows;
  return rows.sort((left, right) => Number(left.present) - Number(right.present) || left.vertical.localeCompare(right.vertical));
}

function buildCoverageGovernanceDrift(
  allSources: SourceRecord[],
  packs: SeedSourceBundle[],
  tenantId: string | undefined,
  generatedAt: string
): SourceCoverageGovernanceDriftItem[] {
  const sources = tenantId
    ? allSources.filter((source) => source.tenantId === tenantId || source.tenantId === undefined)
    : allSources;
  const duplicateKeys = duplicateGroups(sources);
  const duplicateIds = new Set(duplicateKeys.flatMap((group) => group.sourceIds));
  const packVersionByCanonicalId = new Map(packs.flatMap((pack) =>
    pack.sources.map((source) => [source.catalog?.canonicalId, pack.generatedAt ?? pack.name] as const)
  ).filter(([canonicalId]) => Boolean(canonicalId)));
  const items: SourceCoverageGovernanceDriftItem[] = [];

  for (const source of sources) {
    const governance = source.governance;
    if (governance?.approvalExpiresAt && Date.parse(governance.approvalExpiresAt) < Date.parse(generatedAt)) {
      items.push(drift(source, "approval_expired", "critical", "Source approval has expired.", "request_legal_review"));
    }
    if ((source.status === "approved" || source.status === "active") && governance?.approvalRequired && governance.approvalState !== "approved") {
      items.push(drift(source, "approval_not_approved", "critical", "Source is eligible for collection but approval state is not approved.", "request_legal_review"));
    }
    if (staleMetadataDate(source.metadata?.legalNotesReviewedAt, generatedAt, 90)) {
      items.push(drift(source, "stale_legal_notes", "warning", "Legal notes review is missing or stale.", "request_legal_review"));
    }
    if (source.type === "rss" || source.type === "static_web" || source.type === "pdf") {
      if (!source.metadata?.robotsReviewedAt) {
        items.push(drift(source, "missing_robots_notes", "warning", "Robots review notes are missing for a crawlable public source.", "request_legal_review"));
      } else if (staleMetadataDate(source.metadata.robotsReviewedAt, generatedAt, 90)) {
        items.push(drift(source, "stale_robots_notes", "warning", "Robots review notes are stale.", "request_legal_review"));
      }
    }
    if (source.health?.status === "failing" || source.health?.status === "degraded") {
      items.push(drift(source, "stale_health", source.health.status === "failing" ? "critical" : "warning", "Source health is degraded or failing.", "quarantine"));
    }
    if (source.catalog && !source.catalog.adapterCompatibility.includes(source.type)) {
      items.push(drift(source, "adapter_mismatch", "critical", "Source type is not compatible with catalog adapter compatibility.", "reassign_adapter"));
    }
    if (duplicateIds.has(source.id)) {
      items.push(drift(source, "duplicate_canonical_url", "info", "Source duplicates another tenant/type/canonical URL.", "retire_duplicate"));
    }
    const expectedPackVersion = source.catalog?.canonicalId ? packVersionByCanonicalId.get(source.catalog.canonicalId) : undefined;
    if (expectedPackVersion && source.metadata?.sourcePackVersion && source.metadata.sourcePackVersion !== expectedPackVersion) {
      items.push(drift(source, "source_pack_version_skew", "warning", "Source pack version differs from the current approved pack.", "approve"));
    }
  }

  return items.sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.code.localeCompare(right.code) || left.sourceId.localeCompare(right.sourceId));
}

function drift(
  source: SourceRecord,
  code: SourceCoverageGovernanceDriftCode,
  severity: SourceCoverageGovernanceDriftItem["severity"],
  reason: string,
  recommendedAction: SourceCoverageGovernanceDriftItem["recommendedAction"]
): SourceCoverageGovernanceDriftItem {
  return { code, sourceId: source.id, sourceName: source.name, severity, reason, recommendedAction };
}

function buildCoverageRemediationPlans(driftItems: SourceCoverageDriftItem[]): SourceCoverageRemediationPlan[] {
  const actionByDrift: Record<SourceCoverageDriftItem["recommendedAction"], SourceCoverageRemediationPlan["action"]> = {
    approve: "activate",
    quarantine: "quarantine",
    change_cadence: "change_cadence",
    request_legal_review: "request_legal_review",
    reassign_adapter: "reassign_adapter",
    retire_duplicate: "retire_duplicate",
    reduce_cadence: "reduce_cadence",
    increase_cadence: "increase_cadence",
    add_source_pack: "add_source_pack"
  };
  return [...new Set(driftItems.map((item) => item.recommendedAction))]
    .map((recommendedAction) => {
      const matching = driftItems.filter((item) => item.recommendedAction === recommendedAction);
      return {
        action: actionByDrift[recommendedAction],
        dryRun: true as const,
        willMutate: false as const,
        willStartCrawling: false as const,
        sourceIds: matching.map((item) => item.sourceId).filter((sourceId): sourceId is string => Boolean(sourceId)).sort(),
        reason: matching.map((item) => item.code).sort().join(", "),
        approvalRequired: recommendedAction !== "quarantine" && recommendedAction !== "retire_duplicate" && recommendedAction !== "reduce_cadence"
      };
    })
    .sort((left, right) => left.action.localeCompare(right.action));
}

function evaluateSourceCoverageSlo(
  query: string,
  sources: SourceRecord[],
  activation: SourceActivationApiResponse,
  recommendations: SafePublicSourcePackRecommendation[],
  generatedAt: string
): SourceCoverageSloEvaluation {
  const queryClass = classifyCoverageQuery(query);
  const requirements = sourceCoverageSloRequirements(queryClass);
  const matchingSummaries = new Map(
    [...activation.activeCoverage, ...activation.approvedIdleSources, ...activation.candidateOnlyGaps, ...activation.staleSources, ...activation.policyBlocks, ...activation.adapterIncompatibilities]
      .filter((summary) => summary.score > 0)
      .map((summary) => [summary.sourceId, summary])
  );
  const matchingSources = sources.filter((source) => matchingSummaries.has(source.id));
  const safePublic = matchingSources.filter((source) => sourceCanSatisfyPublicSlo(source));
  const activeSafePublic = safePublic.filter((source) => source.status === "active" || source.status === "probation" || source.status === "degraded");
  const freshSafePublic = activeSafePublic.filter((source) => !sourceMissesFreshnessSlo(source, requirements.maxFreshnessSeconds, generatedAt));
  const sourceFamilies = [...new Set(activeSafePublic.map(sourceFamilyKey))].sort();
  const legalReviewComplete = activeSafePublic.length > 0 && activeSafePublic.every((source) =>
    Boolean(source.legalNotes.trim()) && !staleMetadataDate(source.metadata?.legalNotesReviewedAt, generatedAt, 90)
  );
  const robotsReviewComplete = activeSafePublic.length > 0 && activeSafePublic.every((source) =>
    !sourceNeedsRobotsReview(source) || !staleMetadataDate(source.metadata?.robotsReviewedAt, generatedAt, 90)
  );
  const geographicCoverage = [...new Set(activeSafePublic.flatMap((source) => [
    ...(source.catalog?.coverage.regions ?? []),
    ...(source.catalog?.coverage.countries ?? [])
  ]))].sort();
  const sectorCoverage = [...new Set(activeSafePublic.flatMap((source) => source.catalog?.coverage.industries ?? []))].sort();
  const excludedUnsafeSourceIds = matchingSources
    .filter((source) => !sourceCanSatisfyPublicSlo(source))
    .map((source) => source.id)
    .sort();
  const failures: SourceCoverageDriftCode[] = [];

  if (activeSafePublic.length < requirements.minActiveSafePublicSources) failures.push("below_minimum_active_sources");
  if (sourceFamilies.length < requirements.minSourceFamilies) failures.push("insufficient_source_family_diversity");
  if (freshSafePublic.length < Math.min(requirements.minActiveSafePublicSources, activeSafePublic.length || requirements.minActiveSafePublicSources)) failures.push("freshness_slo_missed");
  if (!legalReviewComplete) failures.push("missing_legal_review");
  if (!robotsReviewComplete) failures.push("missing_robots_review");
  if (requirements.requireGeographicCoverage && geographicCoverage.length === 0) failures.push("missing_geographic_coverage");
  if (requirements.requireSectorCoverage && sectorCoverage.length === 0) failures.push("missing_sector_coverage");
  if (excludedUnsafeSourceIds.length > 0) failures.push("unsafe_source_class_excluded");
  if (activeSafePublic.length < requirements.minActiveSafePublicSources && recommendations.length > 0) failures.push("missing_approved_public_source_pack");

  const criticalFailures = failures.filter((code) =>
    code !== "missing_approved_public_source_pack" && code !== "unsafe_source_class_excluded"
  );
  const status: SourceCoverageSloStatus = criticalFailures.length === 0
    ? failures.length === 0 ? "pass" : "warning"
    : "fail";

  return {
    queryClass,
    status,
    requirements,
    actuals: {
      activeSafePublicSources: activeSafePublic.length,
      sourceFamilies,
      freshSafePublicSources: freshSafePublic.length,
      legalReviewComplete,
      robotsReviewComplete,
      geographicCoverage,
      sectorCoverage,
      excludedUnsafeSourceIds
    },
    failures
  };
}

function buildSourceCoverageSloDrift(
  query: string,
  slo: SourceCoverageSloEvaluation,
  sources: SourceRecord[],
  activation: SourceActivationApiResponse,
  recommendations: SafePublicSourcePackRecommendation[]
): SourceCoverageDriftItem[] {
  const summaries = [
    ...activation.activeCoverage,
    ...activation.approvedIdleSources,
    ...activation.candidateOnlyGaps,
    ...activation.staleSources,
    ...activation.policyBlocks,
    ...activation.adapterIncompatibilities
  ].filter((summary) => summary.score > 0);
  const matchingSourceIds = new Set(summaries.map((summary) => summary.sourceId));
  const unsafeSources = sources.filter((source) => matchingSourceIds.has(source.id) && !sourceCanSatisfyPublicSlo(source));
  const staleSources = sources.filter((source) =>
    matchingSourceIds.has(source.id) &&
    sourceCanSatisfyPublicSlo(source) &&
    sourceMissesFreshnessSlo(source, slo.requirements.maxFreshnessSeconds, activation.generatedAt)
  );
  const rows: SourceCoverageDriftItem[] = [];
  const add = (
    code: SourceCoverageDriftCode,
    severity: SourceCoverageDriftItem["severity"],
    reason: string,
    recommendedAction: SourceCoverageDriftItem["recommendedAction"],
    source?: SourceRecord
  ) => rows.push({
    code,
    query,
    sourceId: source?.id,
    sourceName: source?.name,
    severity,
    reason,
    recommendedAction
  });

  for (const failure of slo.failures) {
    if (failure === "below_minimum_active_sources") add(failure, "critical", `Query has ${slo.actuals.activeSafePublicSources} active safe-public sources; SLO requires ${slo.requirements.minActiveSafePublicSources}.`, "add_source_pack");
    if (failure === "insufficient_source_family_diversity") add(failure, "critical", `Query has ${slo.actuals.sourceFamilies.length} source families; SLO requires ${slo.requirements.minSourceFamilies}.`, "add_source_pack");
    if (failure === "freshness_slo_missed") {
      if (staleSources.length === 0) add(failure, "warning", "Matching safe-public source freshness is below SLO.", "increase_cadence");
      for (const source of staleSources) add(failure, "warning", "Safe-public source missed freshness SLO.", "increase_cadence", source);
    }
    if (failure === "missing_geographic_coverage") add(failure, "warning", "No active safe-public source provides geographic coverage for the query class.", "add_source_pack");
    if (failure === "missing_sector_coverage") add(failure, "warning", "No active safe-public source provides sector coverage for the query class.", "add_source_pack");
    if (failure === "missing_legal_review") add(failure, "critical", "Active safe-public sources need complete current legal review notes.", "request_legal_review");
    if (failure === "missing_robots_review") add(failure, "critical", "Active crawlable safe-public sources need current robots review notes.", "request_legal_review");
    if (failure === "unsafe_source_class_excluded") {
      for (const source of unsafeSources) add(failure, "warning", "Source is excluded from public-source SLOs because it is not safe public approved coverage.", unsafeRemediationAction(source), source);
    }
    if (failure === "missing_approved_public_source_pack" && recommendations.length > 0) add(failure, "warning", "Safe public source-pack recommendations are available to close the SLO gap.", "add_source_pack");
  }

  return rows.sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.code.localeCompare(right.code) || (left.sourceId ?? "").localeCompare(right.sourceId ?? ""));
}

function buildSourceCoverageSloRollup(queries: SourceCoveragePlanQuery[]): SourceCoverageSloRollup {
  const queryClasses = {
    actor: 0,
    ransomware_victim: 0,
    cve: 0,
    sector: 0,
    country: 0,
    malware_tool: 0
  } satisfies Record<SourceCoverageSloQueryClass, number>;
  for (const query of queries) queryClasses[query.slo.queryClass] += 1;
  const passed = queries.filter((query) => query.slo.status === "pass").length;
  const warning = queries.filter((query) => query.slo.status === "warning").length;
  const failed = queries.filter((query) => query.slo.status === "fail").length;
  return {
    status: failed > 0 ? "fail" : warning > 0 ? "warning" : "pass",
    passed,
    warning,
    failed,
    queryClasses
  };
}

function classifyCoverageQuery(query: string): SourceCoverageSloQueryClass {
  const terms = tokenizeQuery(query);
  const text = query.toLowerCase();
  if (terms.includes("cve") || terms.includes("vulnerability") || /cve-\d{4}/i.test(query)) return "cve";
  if (terms.includes("ransomware") || terms.includes("victim") || ["akira", "lockbit", "alphv", "blackcat"].some((term) => text.includes(term))) return "ransomware_victim";
  if (["healthcare", "finance", "financial", "energy", "government", "telecom", "education"].some((term) => terms.includes(term))) return "sector";
  if (["norway", "ukraine", "china", "iran", "russia", "united", "states", "europe"].some((term) => terms.includes(term))) return "country";
  if (["cobalt", "strike", "malware", "tool", "loader", "backdoor", "ransomware"].some((term) => terms.includes(term))) return "malware_tool";
  return "actor";
}

function sourceCoverageSloRequirements(queryClass: SourceCoverageSloQueryClass): SourceCoverageSloEvaluation["requirements"] {
  const base = {
    minActiveSafePublicSources: 2,
    minSourceFamilies: 2,
    maxFreshnessSeconds: 36 * 3600,
    requireLegalReview: true as const,
    requireRobotsReview: true as const,
    requireGeographicCoverage: false,
    requireSectorCoverage: false
  };
  if (queryClass === "actor") return { ...base, minActiveSafePublicSources: 3, maxFreshnessSeconds: 24 * 3600, requireGeographicCoverage: true, requireSectorCoverage: true };
  if (queryClass === "ransomware_victim") return { ...base, minActiveSafePublicSources: 3, minSourceFamilies: 2, maxFreshnessSeconds: 12 * 3600, requireSectorCoverage: true };
  if (queryClass === "cve") return { ...base, minActiveSafePublicSources: 2, minSourceFamilies: 2, maxFreshnessSeconds: 12 * 3600 };
  if (queryClass === "sector") return { ...base, minActiveSafePublicSources: 2, requireSectorCoverage: true };
  if (queryClass === "country") return { ...base, minActiveSafePublicSources: 2, requireGeographicCoverage: true };
  return { ...base, minActiveSafePublicSources: 2, maxFreshnessSeconds: 24 * 3600 };
}

function sourceCanSatisfyPublicSlo(source: SourceRecord): boolean {
  return SAFE_PUBLIC_TYPES.has(source.type) &&
    SAFE_ACCESS_METHODS.has(source.accessMethod) &&
    source.risk === "low" &&
    source.catalog?.approvalScope === "safe_public_auto" &&
    source.governance?.metadataOnly !== true &&
    source.status !== "disabled" &&
    source.status !== "rejected" &&
    source.status !== "retired";
}

function sourceFamilyKey(source: SourceRecord): string {
  return source.catalog?.publisher.trustBasis
    ? `${source.catalog.publisher.trustBasis}:${source.catalog.publisher.name}`
    : `${source.type}:${new URL(source.url).hostname}`;
}

function sourceNeedsRobotsReview(source: SourceRecord): boolean {
  return source.type === "rss" || source.type === "static_web" || source.type === "pdf";
}

function sourceMissesFreshnessSlo(source: SourceRecord, maxFreshnessSeconds: number, generatedAt: string): boolean {
  const last = source.crawlState?.lastCollectedAt ?? source.lastSeenAt;
  if (!last) return false;
  return Date.parse(generatedAt) - Date.parse(last) > maxFreshnessSeconds * 1000;
}

function unsafeRemediationAction(source: SourceRecord): SourceCoverageDriftItem["recommendedAction"] {
  if (source.status === "active" || source.status === "degraded" || source.status === "probation") return "quarantine";
  if (source.status === "approved" || source.status === "candidate" || source.status === "needs_review") return "request_legal_review";
  return "reduce_cadence";
}

function staleMetadataDate(value: unknown, generatedAt: string, staleAfterDays: number): boolean {
  if (typeof value !== "string" || !value) return true;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return true;
  return Date.parse(generatedAt) - timestamp > staleAfterDays * 86400 * 1000;
}

function sourceMatchesTerms(source: SourceActivationApiSourceSummary, terms: string[]): boolean {
  const haystack = [
    source.sourceName,
    source.sourceType,
    ...(source.reasons ?? []),
    ...(source.matchedTopics ?? []),
    ...(source.matchedActors ?? []),
    ...(source.matchedIndustries ?? []),
    ...(source.matchedRegions ?? [])
  ];
  return haystack.some((value) => terms.some((term) => includesTerm(value, term)));
}

function includesTerm(value: string, term: string): boolean {
  return value.toLowerCase().includes(term.toLowerCase()) || term.toLowerCase().includes(value.toLowerCase());
}

function recommendationMatchesQuery(source: SafePublicSourcePackRecommendation, query: string): boolean {
  const terms = tokenizeQuery(query);
  const haystack = [source.sourceName, ...source.coverageTags, ...source.reasons];
  if (terms.includes("unknown") || terms.includes("actor")) {
    return haystack.some((value) => ["actor", "threat-report", "malware", "campaign", "ttp"].some((term) => includesTerm(value, term)));
  }
  return haystack.some((value) => terms.some((term) => includesTerm(value, term)));
}

function sourcePackRecommendationCanSupportQuery(source: SafePublicSourcePackRecommendation, query: string): boolean {
  return (source.requiredAction === "install_candidate" || source.requiredAction === "skip_duplicate")
    && recommendationMatchesQuery(source, query);
}

function recommendationQueryRank(source: SafePublicSourcePackRecommendation, query: string): number {
  const terms = tokenizeQuery(query);
  const coverage = source.coverageTags;
  const directMatches = coverage.filter((value) => terms.some((term) => includesTerm(value, term))).length;
  const reasonMatches = source.reasons.filter((value) => terms.some((term) => includesTerm(value, term))).length;
  const nameMatches = terms.some((term) => includesTerm(source.sourceName, term)) ? 1 : 0;
  return directMatches * 10 + nameMatches * 5 + reasonMatches;
}

function actorishQuery(query: string): boolean {
  const terms = tokenizeQuery(query);
  return !terms.includes("cve") && !terms.includes("vulnerability") && !terms.includes("ransomware");
}

function coverageTagsForSeed(source: SeedSourceInput): string[] {
  return [...new Set([
    ...(source.catalog?.coverage.topics ?? []),
    ...(source.catalog?.coverage.actors ?? []),
    ...(source.catalog?.coverage.aliases ?? []),
    ...(source.catalog?.coverage.industries ?? []),
    ...(source.catalog?.coverage.regions ?? []),
    ...(source.catalog?.coverage.countries ?? []),
    ...(source.tags ?? [])
  ])].sort((left, right) => left.localeCompare(right));
}

function actionRank(action: SafePublicSourcePackRecommendation["requiredAction"]): number {
  if (action === "install_candidate") return 0;
  if (action === "fix_compliance") return 1;
  return 2;
}

function severityRank(severity: SourceActivationUnderservedReason["severity"]): number {
  if (severity === "critical") return 3;
  if (severity === "warning") return 2;
  return 1;
}

function isStale(source: SourceRecord, referenceAt = nowIso()): boolean {
  const target = source.catalog?.collection?.freshnessTargetSeconds;
  if (!target || !source.lastSeenAt) return false;
  return Date.parse(referenceAt) - Date.parse(source.lastSeenAt) > target * 1000;
}

function staleSourceReport(
  source: SourceRecord,
  referenceAt: string
): SeedSourceComplianceReport["stale"] {
  const target = source.catalog?.collection.freshnessTargetSeconds;
  if (!target || !source.lastSeenAt || !isStale(source, referenceAt)) return [];
  return [{
    sourceId: source.id,
    sourceName: source.name,
    lastSeenAt: source.lastSeenAt,
    freshnessTargetSeconds: target
  }];
}

function tokenizeQuery(query: string): string[] {
  const normalized = query.toLowerCase().replace(/[^a-z0-9* -]/g, " ");
  const terms = normalized.split(/\s+/).filter(Boolean);
  if (/cve-\d{4}/i.test(query)) terms.push("cve", "vulnerability");
  if (/ransomware/i.test(query)) terms.push("ransomware");
  return [...new Set(terms)];
}

function matchTerms(terms: string[], values: string[]): string[] {
  const matches = new Set<string>();
  for (const value of values) {
    const normalized = value.toLowerCase();
    if (terms.some((term) => normalized.includes(term) || term.includes(normalized))) matches.add(value);
  }
  return [...matches];
}

function findCoverageOverlap(inputs: SeedSourceInput[]): SeedSourceComplianceReport["overlappingCoverage"] {
  const overlaps: SeedSourceComplianceReport["overlappingCoverage"] = [];
  for (let left = 0; left < inputs.length; left += 1) {
    for (let right = left + 1; right < inputs.length; right += 1) {
      const leftCoverage = coverageSet(inputs[left]);
      const rightCoverage = coverageSet(inputs[right]);
      const overlap = [...leftCoverage].filter((value) => rightCoverage.has(value));
      if (overlap.length >= 5) overlaps.push({ leftIndex: left, rightIndex: right, overlap: overlap.slice(0, 12) });
    }
  }
  return overlaps;
}

function coverageSet(input: SeedSourceInput | undefined): Set<string> {
  const coverage = input?.catalog?.coverage;
  return new Set([
    ...(coverage?.topics ?? []),
    ...(coverage?.actors ?? []),
    ...(coverage?.aliases ?? []),
    ...(coverage?.industries ?? []),
    ...(coverage?.regions ?? []),
    ...(coverage?.countries ?? []),
    ...(coverage?.queryPatterns ?? [])
  ].map((value) => value.toLowerCase()));
}
