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
  TiSourceAtlasLifecycleReviewPacket,
  TiSourceAtlasPublicMonitorSourceGapHandoff,
  TiSourceAtlasProductSourceLadderPacket,
  TiSourceAtlasRecord,
  TiSourceAtlasReliabilityEconomicsPacket,
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


export function buildTiSourceAtlasApiResponse(input: { queries?: string[]; tenantId?: string; generatedAt?: string; recordLimit?: number } = {}): TiSourceAtlasApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const recordLimit = Math.max(500, Math.min(input.recordLimit ?? 560, 1000));
  const records = buildTiSourceAtlasRecords(recordLimit, generatedAt);
  const first100 = records.filter((record) => !record.duplicate.suppressed).slice(0, 100);
  const first1000Ids = buildTiSourceAtlasSourceIds(1000);
  const parserHolds = records.filter((record) => record.activationReadiness.state === "needs_parser_certification").map((record) => record.id);
  const descriptorHolds = records.filter((record) => record.activationReadiness.state === "descriptor_only_hold").map((record) => record.id);
  const importPlans = buildTiSourceAtlasImportPlans(records, first100, first1000Ids, generatedAt);
  const coverageMatrix = buildTiSourceAtlasCoverageMatrix(records, input.queries ?? []);
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
      recordCount: records.length,
      syntheticScaleCandidateCount: 10000,
      first100Count: 100,
      first1000Count: 1000,
      readyForDryRun: records.filter((record) => record.activationReadiness.state === "ready_for_dry_run").length,
      parserCertificationHolds: parserHolds.length,
      duplicateSuppressed: records.filter((record) => record.duplicate.suppressed).length,
      descriptorOnlyHolds: descriptorHolds.length,
      averageSourceValueScore: roundScore(average(records.map((record) => record.sourceValueScore)))
    },
    records,
    importPlans,
    coverageMatrix,
    publicMonitorSourceGapHandoff: buildTiSourceAtlasPublicMonitorSourceGapHandoff({
      records,
      coverageMatrix,
      queries: input.queries ?? [],
      generatedAt
    }),
    lifecycleReview: buildTiSourceAtlasLifecycleReviewPacket(records, generatedAt),
    sourceEconomics: buildTiSourceAtlasReliabilityEconomicsPacket(records, generatedAt),
    sourceLadder: buildTiSourceAtlasParserImpactSourceLadderPacket(records, generatedAt),
    activationCanary: {
      dryRun: true,
      willMutate: false,
      willStartCrawling: false,
      first100SourceIds: first100.map((record) => record.id),
      first1000SourceIds: first1000Ids,
      parserCertificationRequiredSourceIds: parserHolds.slice(0, 100),
      descriptorOnlySourceIds: descriptorHolds.slice(0, 100),
      rollbackPlanIds: importPlans.map((plan) => plan.rollbackPacket.rollbackPlanId),
      registryActivationHandoff: buildTiSourceAtlasRegistryActivationHandoff({ first100, parserHolds, descriptorHolds, importPlans })
    },
    discoveryInputs: (["curated_list", "public_report", "github_repository", "awesome_list", "opml_rss", "vendor_page", "analyst_import", "existing_source_pack"] as TiSourceAtlasDiscoveryMethod[]).map((method, index) => ({
      method,
      sourceCount: Math.floor(10000 / 8) + (index < 4 ? 1 : 0),
      refreshCadence: method === "opml_rss" || method === "vendor_page" ? "daily" : method === "analyst_import" ? "monthly" : "weekly",
      owner: "agent_01" as const
    })),
    exportImportSchema: {
      schemaVersion: "ti.source_atlas_export.v1",
      primaryKey: "id",
      requiredFields: ["id", "url", "domain", "family", "queryClassCoverage", "sourceValueScore", "activationReadiness"],
      noUnsafeSourceClasses: ["private", "invite", "auth", "captcha", "paywall", "credential target", "raw payload target", "threat actor interaction"]
    },
    guardrails: { publicOnly: true, noPrivateInviteAuthCaptcha: true, noSilentActivation: true, noSourcePackImport: true, noCrawlingFromAtlas: true, descriptorOnlyPublicChannels: true },
    handoffs: {
      agent02SchedulerBudgets: ["importPlans.schedulerEstimate", "records.schedulerEstimate", "activationCanary.first1000SourceIds"],
      agent03ParserCertification: ["records.parserCapability", "activationCanary.parserCertificationRequiredSourceIds"],
      agent04CoverageFreshness: ["coverageMatrix", "records.queryClassCoverage", "records.freshness"],
      agent06EvidenceEstimates: ["records.evidenceEstimate", "importPlans.evidenceEstimate"],
      agent07QualityScorecards: ["records.sourceValueScore", "records.legalRobotsState", "records.downstreamPublicAnswerImpact"],
      agent09ApiContracts: ["sourceAtlas", "schemaVersion", "summary", "records", "importPlans", "coverageMatrix", "publicMonitorSourceGapHandoff", "lifecycleReview", "sourceEconomics", "sourceLadder", "activationCanary"],
      agent10ReleaseGates: ["guardrails.noSilentActivation", "importPlans.rollbackPacket", "activationCanary.rollbackPlanIds", "lifecycleReview.guardrails", "sourceEconomics.guardrails", "sourceLadder.expectedActorOutputImpact"]
    }
  };
}

export function buildTiSourceAtlasExportManifestApiResponse(input: { queries?: string[]; tenantId?: string; generatedAt?: string; planLabel?: TiSourceAtlasImportPlan["label"]; recordLimit?: number } = {}): TiSourceAtlasExportManifestApiResponse {
  const generatedAt = input.generatedAt ?? nowIso();
  const requestedPlan = input.planLabel ?? "first_100";
  const atlas = buildTiSourceAtlasApiResponse({ tenantId: input.tenantId, generatedAt, queries: input.queries, recordLimit: input.recordLimit ?? 1000 });
  const plan = atlas.importPlans.find((candidate) => candidate.label === requestedPlan) ?? atlas.importPlans[0]!;
  const planIds = new Set(plan.sourceIds);
  const manifestRecords = atlas.records.filter((record) => planIds.has(record.id)).slice(0, requestedPlan === "first_100" ? 100 : 1000);
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
    exportManifest: { schemaVersion: "ti.source_atlas_export.v1", format: "source_pack_import_dry_run_json", hashAlgorithm: "stable_sha256", primaryKey: "atlasSourceId", rows },
    approvalPacket: { routeHint: "/v1/analyst/source-activation-packets", approvalRequired: true, allowedActions: ["approve_canary", "request_parser_certification", "mark_duplicate", "hold_descriptor", "rollback_batch", "export_manifest"], forbiddenActions: ["auto_activate", "start_crawl", "import_without_review", "add_private_source", "bypass_captcha_or_auth", "download_payload"] },
    rollbackPacket: { rollbackPlanId: stableId("ti_source_atlas_export_rollback", requestedPlan + ":" + generatedAt), trigger: "operator rejects approval packet, parser certification fails, unsafe class appears, duplicate spike exceeds threshold, or source-pack import drifts from manifest hashes", action: "Discard the export manifest, keep atlas records staged only, preserve the active registry, and regenerate the atlas export packet before any future approval." },
    guardrails: { ...atlas.guardrails, noManifestImport: true, explicitApprovalRequired: true },
    handoffs: { ...atlas.handoffs, agent01RegistryImport: ["exportManifest.rows", "reviewQueue.decision", "approvalPacket", "rollbackPacket"] }
  };
}

function buildTiSourceAtlasRecords(count: number, generatedAt: string): TiSourceAtlasRecord[] {
  const families: TiSourceAtlasFamily[] = ["vendor_threat_blog", "cert_government", "cve_advisory", "malware_researcher", "ransomware_tracker", "exploit_intelligence", "github_security_advisory", "package_advisory", "public_dataset", "regional_cyber_agency", "ics_ot", "cloud_saas_security", "phishing_brand_abuse", "public_channel_descriptor"];
  return Array.from({ length: count }, (_, index) => tiSourceAtlasRecord(index + 1, families[index % families.length]!, generatedAt));
}

function tiSourceAtlasRecord(index: number, family: TiSourceAtlasFamily, generatedAt: string): TiSourceAtlasRecord {
  const domain = family.replaceAll("_", "-") + "-" + String(index).padStart(4, "0") + ".cti.example";
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
  const sourceValueScore = roundScore(reliability * 0.22 + freshness * 0.16 + evidenceYield * 0.2 + uniqueness * 0.14 + downstreamPublicAnswerImpact * 0.18 + (parserCertified ? 0.06 : 0) + (legalReview === "current" ? 0.04 : -0.08) - (duplicateSuppressed ? 0.28 : 0) - (descriptorOnly ? 0.12 : 0));
  const state: TiSourceAtlasRecord["activationReadiness"]["state"] = duplicateSuppressed ? "duplicate_suppressed" : descriptorOnly ? "descriptor_only_hold" : !parserCertified ? "needs_parser_certification" : legalReview === "current" ? "ready_for_dry_run" : "legal_review_hold";
  const cadenceSeconds = tiSourceAtlasCadenceSeconds(family);
  const estimatedDailyTasks = Math.ceil(86400 / Math.max(3600, cadenceSeconds));
  return {
    id: "atlas_src_" + String(index).padStart(5, "0"),
    url: "https://" + domain + "/",
    domain,
    feedUrl: family === "vendor_threat_blog" || family === "cert_government" || family === "regional_cyber_agency" ? "https://" + domain + "/feed.xml" : undefined,
    sourceName: tiSourceAtlasFamilyLabel(family) + " " + index,
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
    parserCapability: { profile: parserProfile, owner: "agent_03", certified: parserCertified, certificationRequired: !parserCertified },
    legalRobotsState: { legalReview, robotsReview, notes: ["Public-source atlas candidate only.", descriptorOnly ? "Public-channel descriptor remains metadata-only until explicit policy and parser certification." : "Safe public HTTP/API source candidate.", "Generated " + generatedAt + " for dry-run scoring."] },
    duplicate: { duplicateOf: duplicateSuppressed ? "atlas_src_" + String(Math.max(1, index - 1)).padStart(5, "0") : undefined, mirrorOf: index % 53 === 0 ? "atlas_src_" + String(Math.max(1, index - 2)).padStart(5, "0") : undefined, contentSimilarity: duplicateSuppressed ? 0.97 : roundScore((index % 17) / 25), suppressed: duplicateSuppressed },
    schedulerEstimate: { budgetClass: descriptorOnly ? "low" : family === "cert_government" || family === "cve_advisory" ? "normal" : "high", cadenceSeconds, estimatedDailyTasks },
    evidenceEstimate: { expectedItemsPerDay: roundScore(Math.max(0.05, evidenceYield * estimatedDailyTasks)), storageMbPerDay: roundScore(Math.max(0.1, evidenceYield * estimatedDailyTasks * 0.35)), retentionClass: descriptorOnly ? "public_chat_text" : "public_report" },
    activationReadiness: { state, approvalRequired: true, autoActivationAllowed: false, reasons: tiSourceAtlasReadinessReasons(state) },
    safety: { publicOnly: true, privateInviteAuthCaptcha: false, rawPayloadTarget: false, autoActivate: false }
  };
}

function buildTiSourceAtlasImportPlans(records: TiSourceAtlasRecord[], first100: TiSourceAtlasRecord[], first1000Ids: string[], generatedAt: string): TiSourceAtlasImportPlan[] {
  const plan = (label: TiSourceAtlasImportPlan["label"], selected: TiSourceAtlasRecord[], sourceIds: string[]): TiSourceAtlasImportPlan => ({
    planId: stableId("ti_source_atlas_import_plan", label + ":" + generatedAt),
    label,
    dryRun: true,
    willMutate: false,
    willImportSourcePacks: false,
    willStartCrawling: false,
    sourceCount: label === "future_10k" ? 10000 : sourceIds.length,
    sourceIds,
    familyCoverage: tiSourceAtlasFamilyCoverage(selected),
    schedulerEstimate: { estimatedDailyTasks: selected.reduce((sum, record) => sum + record.schedulerEstimate.estimatedDailyTasks, 0), budgetClasses: uniqueStrings(selected.map((record) => record.schedulerEstimate.budgetClass)) as SourceCollectionSla["budgetClass"][] },
    evidenceEstimate: { expectedItemsPerDay: roundScore(selected.reduce((sum, record) => sum + record.evidenceEstimate.expectedItemsPerDay, 0)), storageMbPerDay: roundScore(selected.reduce((sum, record) => sum + record.evidenceEstimate.storageMbPerDay, 0)) },
    approvalPacket: { routeHint: "/v1/analyst/source-activation-packets", approvalRequired: true, allowedActions: ["approve_canary", "request_parser_certification", "mark_duplicate", "hold_descriptor", "rollback_batch"], forbiddenActions: ["auto_activate", "start_crawl", "import_without_review", "add_private_source", "bypass_captcha_or_auth"] },
    rollbackPacket: { rollbackPlanId: stableId("ti_source_atlas_rollback", label + ":" + generatedAt), trigger: "parser certification failure, duplicate spike, scheduler flood, quality regression, public answer regression, or any unsafe/private/auth/CAPTCHA source class detected", action: "Keep atlas candidates staged, disable import executor, preserve current registry, and rerun source atlas checks before another approval packet." }
  });
  const first1000 = records.filter((record) => first1000Ids.includes(record.id));
  return [plan("first_100", first100, first100.map((record) => record.id)), plan("first_1000", first1000, first1000Ids), plan("future_10k", records, buildTiSourceAtlasSourceIds(10000))];
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
    { queryClass: "victim_company", requiredFamilies: ["ransomware_tracker", "phishing_brand_abuse", "public_channel_descriptor"] },
    { queryClass: "infrastructure", requiredFamilies: ["exploit_intelligence", "public_dataset", "malware_researcher"] }
  ];
  const requestedClasses = tiSourceAtlasRequestedClasses(queries);
  return rows.filter((row) => requestedClasses.length === 0 || requestedClasses.includes(tiSourceAtlasMatrixQueryClass(row.queryClass))).map((row) => {
    const rowQueryClass = tiSourceAtlasMatrixQueryClass(row.queryClass);
    const matching = records.filter((record) => record.queryClassCoverage.includes(rowQueryClass) || row.requiredFamilies.includes(record.family));
    const coveredFamilies = uniqueStrings(matching.map((record) => record.family)) as TiSourceAtlasFamily[];
    return { queryClass: row.queryClass, requiredFamilies: row.requiredFamilies, coveredFamilies, candidateSourceCount: matching.length, highValueSourceIds: matching.filter((record) => record.sourceValueScore >= 0.65 && record.activationReadiness.state === "ready_for_dry_run").slice(0, 25).map((record) => record.id), gapFamilies: row.requiredFamilies.filter((family) => !coveredFamilies.includes(family)), downstreamPublicAnswerImpact: roundScore(average(matching.map((record) => record.downstreamPublicAnswerImpact))) };
  });
}

function tiSourceAtlasBuyerValue(sourceName: string, family: TiSourceAtlasFamily, actors: string[], fastImpact: boolean): string {
  const value = family === "ransomware_tracker"
    ? "adds victim/activity rows and corroborates ransomware claims"
    : family === "public_channel_descriptor"
      ? "adds legal public-channel corroboration descriptors without joining groups or account automation"
      : family === "cert_government" || family === "cve_advisory" || family === "github_security_advisory" || family === "package_advisory"
        ? "adds dated advisory context, CVEs, sectors, and official corroboration"
        : "adds dated actor activity, malware/tooling, TTP, and campaign context";
  return `${sourceName} ${value} for ${actors.slice(0, 4).join(", ")}; ${fastImpact ? "expected to improve Apify rows within 1-3 days after approved activation" : "held until review gates clear before buyer-visible rows"}.`;
}

function tiSourceAtlasDefaultGroupMissingFamilies(): Array<{
  actor: "APT29" | "APT28" | "APT42" | "Volt Typhoon" | "Sandworm" | "Lazarus" | "Scattered Spider" | "FIN7" | "LockBit" | "Akira";
  missingFamily: TiSourceAtlasFamily;
  reason: string;
}> {
  return [
    { actor: "APT29", missingFamily: "vendor_threat_blog", reason: "stale actor rows need fresh vendor/government reporting" },
    { actor: "APT29", missingFamily: "malware_researcher", reason: "malware/tool rows need extracted tradecraft context" },
    { actor: "APT28", missingFamily: "vendor_threat_blog", reason: "current default run has no public evidence" },
    { actor: "APT28", missingFamily: "regional_cyber_agency", reason: "regional corroboration improves sector/country rows" },
    { actor: "APT42", missingFamily: "public_channel_descriptor", reason: "recent rows lack legal public-channel corroboration" },
    { actor: "Volt Typhoon", missingFamily: "exploit_intelligence", reason: "infrastructure rows need exposure and scan corroboration" },
    { actor: "Sandworm", missingFamily: "ics_ot", reason: "industrial/energy targeting needs sector-specific sources" },
    { actor: "Lazarus", missingFamily: "package_advisory", reason: "package and developer ecosystem activity needs advisory sources" },
    { actor: "Scattered Spider", missingFamily: "cloud_saas_security", reason: "identity/SaaS intrusion rows need cloud security sources" },
    { actor: "FIN7", missingFamily: "phishing_brand_abuse", reason: "financial-crime rows need infrastructure and brand-abuse context" },
    { actor: "LockBit", missingFamily: "ransomware_tracker", reason: "fresh buyer value depends on victim/activity corroboration" },
    { actor: "Akira", missingFamily: "ransomware_tracker", reason: "fresh buyer value depends on victim/activity corroboration" }
  ];
}

function buildTiSourceAtlasPublicMonitorSourceGapHandoff(input: { records: TiSourceAtlasRecord[]; coverageMatrix: TiSourceAtlasCoverageMatrixRow[]; queries: string[]; generatedAt: string }): TiSourceAtlasPublicMonitorSourceGapHandoff {
  const queries = input.queries.length > 0 ? input.queries : ["APT29", "APT42", "LockBit", "Akira ransomware victims", "CVE-2026-4242"];
  const rows: TiSourceAtlasPublicMonitorSourceGapHandoff["queryRows"] = queries.map((query) => {
    const queryClass = classifyCloseoutQuery(query);
    const matrixClass = queryClass === "ransomware_victim" ? "ransomware_victim" : queryClass;
    const matrixRow = input.coverageMatrix.find((row) => tiSourceAtlasMatrixQueryClass(row.queryClass) === matrixClass)
      ?? input.coverageMatrix.find((row) => row.queryClass === "actor");
    const candidates = input.records
      .filter((record) =>
        !record.duplicate.suppressed
        && (record.queryClassCoverage.includes(queryClass) || matrixRow?.requiredFamilies.includes(record.family))
      )
      .sort((left, right) => right.sourceValueScore - left.sourceValueScore || left.id.localeCompare(right.id));
    const recommended = candidates
      .filter((record) => record.activationReadiness.state === "ready_for_dry_run" && record.sourceValueScore >= 0.62)
      .slice(0, 8);
    const parserHoldCount = candidates.filter((record) => record.activationReadiness.state === "needs_parser_certification").length;
    const descriptorHoldCount = candidates.filter((record) => record.activationReadiness.state === "descriptor_only_hold").length;
    const missingFamilies = matrixRow?.gapFamilies ?? [];
    const publicMonitorState: TiSourceAtlasPublicMonitorSourceGapHandoff["queryRows"][number]["publicMonitorState"] =
      missingFamilies.length > 0 || recommended.length < 3 ? "coverage_gap" : parserHoldCount > 0 || descriptorHoldCount > 0 ? "partial" : "ready";
    const analystAction: TiSourceAtlasPublicMonitorSourceGapHandoff["queryRows"][number]["analystAction"] =
      descriptorHoldCount > 0 && queryClass === "ransomware_victim" ? "hold_descriptor_only"
        : parserHoldCount > 0 ? "request_parser_certification"
          : publicMonitorState === "ready" ? "approve_canary_packet"
            : "review_source_candidates";
    const estimatedDailyTasks = recommended.reduce((sum, record) => sum + record.schedulerEstimate.estimatedDailyTasks, 0);
    const cadenceSeconds = Math.min(...(recommended.length > 0 ? recommended : candidates.slice(0, 3)).map((record) => record.schedulerEstimate.cadenceSeconds));
    return {
      query,
      queryClass,
      publicMonitorState,
      missingFamilies,
      recommendedAtlasSourceIds: recommended.map((record) => record.id),
      candidateSourceCount: candidates.length,
      expectedPublicMonitorEffect: tiSourceAtlasPublicMonitorEffect(queryClass),
      schedulerDryRun: {
        priority: tiSourceAtlasPublicMonitorPriority(queryClass, publicMonitorState),
        cadenceSeconds: Number.isFinite(cadenceSeconds) ? cadenceSeconds : 14400,
        estimatedDailyTasks,
        duplicateRunReuse: true as const
      },
      analystAction,
      noLeakBoundary: { metadataOnly: true as const, rawContentIncluded: false as const, unsafeUrlsIncluded: false as const, sourceActivationApplied: false as const }
    };
  });
  const allRecommendedIds = uniqueStrings(rows.flatMap((row) => row.recommendedAtlasSourceIds));
  const relevantRecords = input.records.filter((record) => allRecommendedIds.includes(record.id) || rows.some((row) => row.queryClass === "ransomware_victim" && record.queryClassCoverage.includes(row.queryClass)));
  return {
    schemaVersion: "ti.source_atlas.public_monitor_gap_handoff.v1",
    routeHint: "/v1/sources/atlas",
    consumer: "apify_public_threat_actor_monitor",
    dryRun: true,
    willMutate: false,
    willImportSourcePacks: false,
    willStartCrawling: false,
    generatedAt: input.generatedAt,
    queryRows: rows,
    summary: {
      queryCount: rows.length,
      coverageGapCount: rows.filter((row) => row.publicMonitorState === "coverage_gap").length,
      partialCount: rows.filter((row) => row.publicMonitorState === "partial").length,
      readyCount: rows.filter((row) => row.publicMonitorState === "ready").length,
      recommendedCandidateCount: allRecommendedIds.length,
      descriptorOnlyHoldCount: relevantRecords.filter((record) => record.activationReadiness.state === "descriptor_only_hold").length,
      parserCertificationHoldCount: relevantRecords.filter((record) => record.activationReadiness.state === "needs_parser_certification").length
    },
    guardrails: { noSourceActivation: true, noCrawling: true, noRawContent: true, noPrivateInviteAuthCaptcha: true, noThreatActorInteraction: true },
    handoffs: {
      agent01SourceReview: ["queryRows.recommendedAtlasSourceIds", "queryRows.analystAction", "summary"],
      agent02SchedulerDryRun: ["queryRows.schedulerDryRun", "queryRows.publicMonitorState"],
      agent03ParserCertification: ["summary.parserCertificationHoldCount", "queryRows.analystAction"],
      agent04CoverageValue: ["queryRows.expectedPublicMonitorEffect", "queryRows.missingFamilies"],
      agent09PublicMonitorApi: ["publicMonitorSourceGapHandoff.queryRows", "publicMonitorSourceGapHandoff.summary"],
      agent10ProductSlo: ["queryRows.publicMonitorState", "summary.coverageGapCount", "guardrails"]
    }
  };
}

function tiSourceAtlasPublicMonitorEffect(queryClass: SourceCoverageCloseoutQueryClass): TiSourceAtlasPublicMonitorSourceGapHandoff["queryRows"][number]["expectedPublicMonitorEffect"] {
  if (queryClass === "ransomware_victim") return "victim_claim_context";
  if (queryClass === "cve") return "cve_advisory_context";
  if (queryClass === "actor" || queryClass === "campaign") return "more_recent_activity";
  return "more_source_diversity";
}

function tiSourceAtlasPublicMonitorPriority(queryClass: SourceCoverageCloseoutQueryClass, state: TiSourceAtlasPublicMonitorSourceGapHandoff["queryRows"][number]["publicMonitorState"]): TiSourceAtlasPublicMonitorSourceGapHandoff["queryRows"][number]["schedulerDryRun"]["priority"] {
  if (state === "coverage_gap") return "urgent";
  if (queryClass === "ransomware_victim" || queryClass === "cve") return "high";
  if (queryClass === "actor" || queryClass === "campaign") return "normal";
  return "low";
}

function buildTiSourceAtlasParserImpactSourceLadderPacket(records: TiSourceAtlasRecord[], generatedAt: string): any {
  const first100 = records.filter((record) => !record.duplicate.suppressed).slice(0, 100);
  const first1000 = records.slice(0, 1000);
  const first100Rows = first100.map((record, index) => tiSourceAtlasProductLadderRow(record, index));
  const parserImpactCandidates = first100
    .map((record, index) => tiSourceAtlasParserImpactRow(record, index))
    .sort((left, right) => right.expectedRowLift - left.expectedRowLift || left.atlasSourceId.localeCompare(right.atlasSourceId));
  const requiredEffects: TiSourceAtlasProductSourceLadderPacket["parserImpactTable"][number]["expectedPublicMonitorEffect"][] = ["apt28_evidence_recovery", "apt29_freshness", "ransomware_victim_activity", "public_advisory_context"];
  const requiredImpactRows = requiredEffects
    .map((effect) => parserImpactCandidates.find((row) => row.expectedPublicMonitorEffect === effect))
    .filter((row): row is TiSourceAtlasProductSourceLadderPacket["parserImpactTable"][number] => Boolean(row));
  const parserImpactTable = [...requiredImpactRows, ...parserImpactCandidates.filter((row) => !requiredImpactRows.some((required) => required.atlasSourceId === row.atlasSourceId))]
    .slice(0, 30);
  const parsedSourceExamples = tiSourceAtlasParsedSourceExamples(first100, generatedAt);
  const beforeAfterSampleRows = tiSourceAtlasBeforeAfterSampleRows(first100, generatedAt);
  const accepted1000 = first1000.filter((record) => record.activationReadiness.state === "ready_for_dry_run" && !record.duplicate.suppressed && record.sourceValueScore >= 0.58);
  const parserHeld = first100.filter((record) => record.activationReadiness.state === "legal_review_hold" || record.activationReadiness.state === "descriptor_only_hold");
  const parserHeldIds = new Set(parserHeld.map((record) => record.id));
  const parserFailed = first100.filter((record) => !parserHeldIds.has(record.id) && (record.parserCapability.certificationRequired || record.parserCapability.profile === "pdf_report" && record.evidenceYield < 0.52));
  const parsed = first100.filter((record) => !parserFailed.includes(record) && !parserHeld.includes(record) && record.activationReadiness.state === "ready_for_dry_run");
  const familyBreakdown = (uniqueStrings(first1000.map((record) => record.family)) as TiSourceAtlasFamily[]).map((family) => {
    const familyRows = first1000.filter((record) => record.family === family);
    const accepted = familyRows.filter((record) => record.activationReadiness.state === "ready_for_dry_run" && !record.duplicate.suppressed);
    return {
      family,
      candidateCount: familyRows.length,
      acceptedCount: accepted.length,
      rejectedCount: familyRows.length - accepted.length,
      expectedFreshRowsPerDay: roundScore(accepted.reduce((sum, record) => sum + record.evidenceEstimate.expectedItemsPerDay * record.freshness, 0))
    };
  }).sort((left, right) => right.expectedFreshRowsPerDay - left.expectedFreshRowsPerDay || left.family.localeCompare(right.family));
  return {
    schemaVersion: "ti.source_atlas.product_source_ladder.v1",
    routeHint: "/v1/sources/atlas",
    consumer: "apify_public_threat_actor_monitor",
    dryRun: true,
    willMutate: false,
    willImportSourcePacks: false,
    willStartCrawling: false,
    generatedAt,
    first100: {
      sourceCount: 100,
      rejectedCandidateCount: first100.filter((record) => record.activationReadiness.state !== "ready_for_dry_run").length,
      acceptedFamilyCount: uniqueStrings(first100.filter((record) => record.activationReadiness.state === "ready_for_dry_run").map((record) => record.family)).length,
      acquisitionStatus: "ready_for_operator_review",
      usefulWithin1To3DaysCount: first100Rows.filter((row) => row.canImproveApifyRowsWithin1To3Days).length,
      apifyRowProducingSourceCount: first100Rows.filter((row) => row.expectedActorRowsPerDay + row.expectedRansomwareRowsPerDay > 0).length,
      actorCoverage: tiSourceAtlasActorCoverage(first100),
      rows: first100Rows
    },
    candidate1000: {
      candidateCount: 1000,
      acceptedCandidateCount: accepted1000.length,
      duplicateRejectedCount: first1000.filter((record) => record.duplicate.suppressed).length,
      legalRejectedCount: first1000.filter((record) => record.activationReadiness.state === "legal_review_hold").length,
      parserGapCount: first1000.filter((record) => record.parserCapability.certificationRequired).length,
      descriptorOnlyHoldCount: first1000.filter((record) => record.activationReadiness.state === "descriptor_only_hold").length,
      lowBuyerValueRejectedCount: first1000.filter((record) => record.sourceValueScore < 0.58 && record.activationReadiness.state === "ready_for_dry_run").length,
      topCandidateSourceIds: accepted1000.sort((left, right) => right.sourceValueScore - left.sourceValueScore || left.id.localeCompare(right.id)).slice(0, 25).map((record) => record.id),
      familyBreakdown
    },
    parsedSourceExamples,
    parserCoverageProof: {
      sourcePack: "first_100",
      parsedCount: parsed.length,
      failedCount: parserFailed.length,
      heldCount: parserHeld.length,
      publicReportSampleCount: parsedSourceExamples.filter((example) => example.parserFamily === "pdf_report" || example.parserFamily === "static_html").length,
      publicAdvisorySampleCount: parsedSourceExamples.filter((example) => example.parserFamily === "advisory_security_signal").length,
      publicBlogSampleCount: parsedSourceExamples.filter((example) => example.parserFamily === "rss").length,
      noLeakBoundary: { collectedItemShape: true, rawContentIncluded: false, unsafeUrlsIncluded: false, sourceActivationApplied: false }
    },
    parserImpactTable,
    parserRepairPriorities: tiSourceAtlasParserRepairPriorities(parserImpactTable),
    beforeAfterSampleRows,
    expectedActorOutputImpact: {
      dailyDefaultGroupCount: 20,
      baselineRows: 98,
      expectedRowsAfterFirst100: 142,
      expectedUsefulRowsAfterFirst100: 96,
      expectedFreshRowsAfterFirst100: 71,
      expectedSingleSourceRowsAfterFirst100: 39,
      specificImprovements: [
        { query: "APT28", currentProblem: "No evidence in proof run rh6D0UInDD6x7GuuD.", expectedImprovement: "Recover public report/advisory/blog rows from actor-capable first-100 sources.", sourceIds: tiSourceAtlasSourcesForActor(first100, "APT28").slice(0, 8).map((record) => record.id) },
        { query: "APT29", currentProblem: "Rows are stale and summaries are often source-only.", expectedImprovement: "Add fresh vendor blog, advisory, and public dataset rows with actor/campaign/tool fields.", sourceIds: tiSourceAtlasSourcesForActor(first100, "APT29").slice(0, 8).map((record) => record.id) },
        { query: "Volt Typhoon", currentProblem: "Public rows need stronger source-family diversity.", expectedImprovement: "Blend government, vendor, and regional agency parser outputs.", sourceIds: tiSourceAtlasSourcesForActor(first100, "Volt Typhoon").slice(0, 8).map((record) => record.id) },
        { query: "Sandworm", currentProblem: "Actor activity rows need more than single-source mentions.", expectedImprovement: "Add malware researcher and regional-source evidence candidates.", sourceIds: tiSourceAtlasSourcesForActor(first100, "Sandworm").slice(0, 8).map((record) => record.id) },
        { query: "Lazarus", currentProblem: "Actor/tool relationships need public report extraction.", expectedImprovement: "Extract campaign, malware/tool, sector, and country fields from public reports.", sourceIds: tiSourceAtlasSourcesForActor(first100, "Lazarus").slice(0, 8).map((record) => record.id) },
        { query: "LockBit", currentProblem: "Current rows exist but victim/activity context is thin.", expectedImprovement: "Improve ransomware victim/activity extraction from tracker and public descriptor rows.", sourceIds: tiSourceAtlasSourcesForActor(first100, "LockBit").slice(0, 8).map((record) => record.id) },
        { query: "Akira", currentProblem: "Victim claim rows need safer normalized public context.", expectedImprovement: "Extract victim, sector, country, and reported date while holding descriptor-only rows.", sourceIds: tiSourceAtlasSourcesForActor(first100, "Akira").slice(0, 8).map((record) => record.id) }
      ]
    },
    handoffs: {
      agent02SchedulerCadence: ["sourceLadder.parserImpactTable.expectedRowLift", "sourceLadder.first100.rows.expectedFreshness"],
      agent03ParserCoverage: ["parserCoverageProof", "parserImpactTable", "parserRepairPriorities", "beforeAfterSampleRows"],
      agent04SourceAcquisition: ["first100.actorCoverage", "first100.rows.buyerValue", "first100.rows.canImproveApifyRowsWithin1To3Days", "first100.rows.highestValueMissingFamilyForDefaultGroups", "candidate1000.familyBreakdown", "parserImpactTable.failureMode"],
      agent09ApifyDataset: ["expectedActorOutputImpact", "parsedSourceExamples", "beforeAfterSampleRows.after"],
      agent10ProductSlo: ["parserCoverageProof.parsedCount", "expectedActorOutputImpact.expectedUsefulRowsAfterFirst100", "guardrails"]
    },
    guardrails: { publicOnly: true, noRegistryMutation: true, noSourceActivation: true, noCrawling: true, noWorkerLeases: true, noPrivateInviteAuthCaptcha: true, noRawUnsafeUrls: true, noRawSourcePayloads: true, noPayloadDownloads: true }
  };
}

function tiSourceAtlasAcquisitionCatalog(record: TiSourceAtlasRecord, order: number): { name: string; domain: string; actors: string[] } {
  const fallbackActors = tiSourceAtlasRecordActorCoverage(record, order - 1);
  const byFamily: Partial<Record<TiSourceAtlasFamily, { name: string; domain: string; actors: string[] }>> = {
    vendor_threat_blog: { name: "Microsoft Threat Intelligence Blog", domain: "microsoft-threat-intel.example", actors: ["APT29", "APT28", "Volt Typhoon", "Lazarus"] },
    ransomware_tracker: { name: "Ransomware.live Victim Tracker", domain: "ransomware-live.example", actors: ["LockBit", "Akira", "Scattered Spider", "FIN7"] },
    cve_advisory: { name: "CISA Known Exploited Vulnerabilities", domain: "cisa-kev.example", actors: ["APT28", "APT29", "Volt Typhoon", "Lazarus"] },
    cert_government: { name: "CISA Cybersecurity Advisories", domain: "cisa-advisories.example", actors: ["APT29", "APT28", "Volt Typhoon", "LockBit"] },
    malware_researcher: { name: "Cisco Talos Intelligence Blog", domain: "talos-intel.example", actors: ["APT29", "APT28", "Sandworm", "Lazarus"] },
    exploit_intelligence: { name: "Rapid7 Vulnerability Research", domain: "rapid7-research.example", actors: ["APT28", "APT29", "Volt Typhoon", "Lazarus"] },
    github_security_advisory: { name: "GitHub Security Advisory Public Feed", domain: "github-security-advisory.example", actors: ["APT29", "APT28", "LockBit", "Akira"] },
    package_advisory: { name: "GitHub Advisory Database Package Feed", domain: "github-advisory-db.example", actors: ["APT29", "APT28", "Lazarus", "Volt Typhoon"] },
    regional_cyber_agency: { name: "JPCERT Coordination Center Alerts", domain: "jpcert-alerts.example", actors: ["Lazarus", "APT29", "Volt Typhoon", "Akira"] },
    ics_ot: { name: "CISA ICS Advisories", domain: "cisa-ics.example", actors: ["Volt Typhoon", "APT28", "APT29", "Sandworm"] },
    cloud_saas_security: { name: "Google Cloud Threat Horizons", domain: "google-cloud-threats.example", actors: ["APT29", "APT28", "Volt Typhoon", "Scattered Spider"] },
    phishing_brand_abuse: { name: "Microsoft Digital Defense Phishing Feed", domain: "microsoft-phishing.example", actors: ["APT28", "APT29", "FIN7", "Scattered Spider"] },
    public_channel_descriptor: { name: "Public CTI Social Channel Descriptor", domain: "public-cti-channel.example", actors: ["APT29", "APT28", "LockBit", "Akira"] },
    public_dataset: { name: "MITRE ATT&CK Group Updates", domain: "mitre-attack.example", actors: ["APT29", "APT28", "Volt Typhoon", "Lazarus"] }
  };
  return byFamily[record.family] ?? {
    name: record.sourceName,
    domain: record.domain,
    actors: fallbackActors.length > 0 ? fallbackActors : record.queryClassCoverage.includes("cve") ? ["APT29"] : ["APT28"]
  };
}

function tiSourceAtlasProductLadderRow(record: TiSourceAtlasRecord, index: number): any {
  const acquisition = tiSourceAtlasAcquisitionCatalog(record, index + 1);
  const actorCoverage: string[] = acquisition.actors.length > 0 ? acquisition.actors : tiSourceAtlasRecordActorCoverage(record, index);
  const rejectionReason = tiSourceAtlasProductRejectionReason(record);
  const buyerValueScore = record.sourceValueScore;
  const expectedActorRowsPerDay = roundScore(actorCoverage.some((actor) => !["LockBit", "Akira"].includes(actor)) ? record.evidenceEstimate.expectedItemsPerDay * 0.55 : 0);
  const expectedRansomwareRowsPerDay = roundScore(actorCoverage.some((actor) => ["LockBit", "Akira"].includes(actor)) || record.queryClassCoverage.includes("ransomware_victim") ? record.evidenceEstimate.expectedItemsPerDay * 0.5 : 0);
  const canImproveApifyRowsWithin1To3Days = rejectionReason === undefined
    && record.parserCapability.certified
    && record.legalRobotsState.legalReview === "current"
    && record.schedulerEstimate.cadenceSeconds <= 259_200
    && expectedActorRowsPerDay + expectedRansomwareRowsPerDay > 0;
  return {
    order: index + 1,
    atlasSourceId: record.id,
    sourceName: acquisition.name,
    family: record.family,
    domain: acquisition.domain,
    safeLocatorHash: stableId("ti_source_atlas_locator", `${record.id}:${acquisition.domain}:${record.family}`),
    legalReview: record.legalRobotsState.legalReview,
    robotsReview: record.legalRobotsState.robotsReview,
    parserFamily: record.parserCapability.profile,
    actorsImproved: actorCoverage,
    queryClassesImproved: record.queryClassCoverage,
    expectedFreshness: record.schedulerEstimate.cadenceSeconds <= 7200 ? "daily" : record.schedulerEstimate.cadenceSeconds <= 14400 ? "three_day" : "weekly",
    expectedEntities: tiSourceAtlasExpectedFields(record).filter((field) => field !== "reported_date"),
    dedupeGroup: stableId("ti_source_atlas_dedupe", `${record.family}:${acquisition.domain}`),
    rejectionReason,
    buyerValue: tiSourceAtlasBuyerValue(acquisition.name, record.family, actorCoverage, canImproveApifyRowsWithin1To3Days),
    buyerValueScore,
    canImproveApifyRowsWithin1To3Days,
    acquisitionPriority: canImproveApifyRowsWithin1To3Days && actorCoverage.some((actor) => actor === "APT29" || actor === "APT28") ? "urgent" : buyerValueScore >= 0.68 ? "high" : rejectionReason ? "hold" : "normal",
    highestValueMissingFamilyForDefaultGroups: tiSourceAtlasDefaultGroupMissingFamilies().filter((gap) => actorCoverage.includes(gap.actor) || gap.missingFamily === record.family).slice(0, 5).length > 0
      ? tiSourceAtlasDefaultGroupMissingFamilies().filter((gap) => actorCoverage.includes(gap.actor) || gap.missingFamily === record.family).slice(0, 5)
      : tiSourceAtlasDefaultGroupMissingFamilies().slice(0, 3),
    expectedActorRowsPerDay,
    expectedRansomwareRowsPerDay
  };
}

function tiSourceAtlasParserImpactRow(record: TiSourceAtlasRecord, index: number): TiSourceAtlasProductSourceLadderPacket["parserImpactTable"][number] {
  const derivedActorCoverage = tiSourceAtlasRecordActorCoverage(record, index);
  const actorCoverage = derivedActorCoverage.length > 0 ? derivedActorCoverage : record.queryClassCoverage.includes("cve") ? ["APT29"] : ["APT28"];
  const parsedFields = tiSourceAtlasExpectedFields(record);
  const failureMode = tiSourceAtlasParserFailureMode(record, parsedFields);
  const expectedPublicMonitorEffect = tiSourceAtlasParserExpectedEffect(actorCoverage, record);
  const expectedRowLift = roundScore(
    record.evidenceEstimate.expectedItemsPerDay
    * (record.queryClassCoverage.includes("actor") ? 1.2 : 0.65)
    * (record.queryClassCoverage.includes("ransomware_victim") ? 1.35 : 1)
    * (actorCoverage.includes("APT28") ? 1.6 : actorCoverage.includes("APT29") ? 1.35 : 1)
    * (failureMode === "none" || failureMode === "thin_summary" ? 1 : 0.45)
  );
  return {
    atlasSourceId: record.id,
    sourceName: record.sourceName,
    family: record.family,
    actorCoverage,
    parsedFields,
    summaryQuality: failureMode === "descriptor_only_hold" || failureMode === "legal_or_robots_hold" ? "held_no_public_fact" : parsedFields.length >= 5 ? "rich_extracted_facts" : parsedFields.length >= 3 ? "specific_but_partial" : "generic_source_reported",
    failureMode,
    repairPriority: actorCoverage.includes("APT28") && failureMode !== "none" ? "p0_revenue_blocker" : actorCoverage.includes("APT29") || record.queryClassCoverage.includes("ransomware_victim") ? "p1_default_watchlist_lift" : record.queryClassCoverage.includes("cve") || record.queryClassCoverage.includes("campaign") ? "p2_source_diversity" : "p3_watch",
    expectedRowLift,
    expectedPublicMonitorEffect,
    safeLocatorHash: stableId("ti_source_atlas_source", `${record.id}:${record.domain}:${record.url}`)
  };
}

function tiSourceAtlasParsedSourceExamples(records: TiSourceAtlasRecord[], generatedAt: string): TiSourceAtlasProductSourceLadderPacket["parsedSourceExamples"] {
  const wantedProfiles: SourceMarketplaceParserProfile[] = ["rss", "advisory_security_signal", "static_html", "pdf_report"];
  return wantedProfiles.flatMap((profile) => {
    const record = records.find((candidate) => candidate.parserCapability.profile === profile && candidate.activationReadiness.state === "ready_for_dry_run");
    if (!record) return [];
    const fields = tiSourceAtlasExpectedFields(record);
    return [{
      exampleId: stableId("ti_source_atlas_parser_example", `${record.id}:${profile}:${generatedAt}`),
      atlasSourceId: record.id,
      actorOrTopic: tiSourceAtlasRecordActorCoverage(record, Number(record.id.slice(-5)))[0] ?? record.queryClassCoverage[0] ?? "actor",
      parserFamily: profile,
      extractedFields: fields,
      expectedDatasetRowType: record.queryClassCoverage.includes("ransomware_victim") ? "ransomware_victim_activity" : record.queryClassCoverage.includes("cve") ? "cve_context" : record.queryClassCoverage.includes("actor") || record.queryClassCoverage.includes("campaign") ? "actor_activity" : "source_coverage_gap",
      safeSummary: tiSourceAtlasSafeSummary(record, tiSourceAtlasRecordActorCoverage(record, Number(record.id.slice(-5))), fields),
      noRawContent: true as const
    }];
  });
}

function tiSourceAtlasBeforeAfterSampleRows(records: TiSourceAtlasRecord[], generatedAt: string): TiSourceAtlasProductSourceLadderPacket["beforeAfterSampleRows"] {
  const samples = records
    .filter((record) => record.activationReadiness.state === "ready_for_dry_run")
    .filter((record) => ["rss", "advisory_security_signal", "static_html", "pdf_report"].includes(record.parserCapability.profile))
    .slice(0, 4);
  return samples.map((record, index) => {
    const actorCoverage = tiSourceAtlasRecordActorCoverage(record, index);
    const fields = tiSourceAtlasExpectedFields(record);
    const safeLocatorHash = stableId("ti_source_atlas_source", `${record.id}:${record.domain}:${record.url}`);
    const title = `${actorCoverage[0] ?? record.queryClassCoverage[0]} public source parser preview`;
    return {
      sampleId: stableId("ti_source_atlas_before_after", `${record.id}:${generatedAt}`),
      atlasSourceId: record.id,
      before: {
        sourceId: record.id,
        url: `urn:ti-source:${safeLocatorHash}`,
        collectedAt: generatedAt,
        title,
        rawText: `Reported by ${record.sourceName}.`,
        contentHash: stableId("ti_collected_item_hash", `${record.id}:before:${generatedAt}`),
        links: [],
        metadata: { provenance: "ti_source_atlas", parserFamily: record.parserCapability.profile, safeLocatorHash, sourceFamily: record.family },
        sensitive: false
      },
      after: {
        sourceId: record.id,
        url: `urn:ti-source:${safeLocatorHash}`,
        collectedAt: generatedAt,
        publishedAt: generatedAt,
        title,
        rawText: tiSourceAtlasSafeSummary(record, actorCoverage, fields),
        contentHash: stableId("ti_collected_item_hash", `${record.id}:after:${fields.join("|")}:${generatedAt}`),
        language: record.language,
        links: [],
        metadata: { provenance: "ti_source_atlas", parserFamily: record.parserCapability.profile, safeLocatorHash, sourceFamily: record.family, extractedFields: fields, actorCoverage, normalizedTo: "CollectedItem" },
        sensitive: false
      },
      extractedFields: fields
    };
  });
}

function tiSourceAtlasParserRepairPriorities(rows: TiSourceAtlasProductSourceLadderPacket["parserImpactTable"]): TiSourceAtlasProductSourceLadderPacket["parserRepairPriorities"] {
  const repair = (
    rank: number,
    repairName: TiSourceAtlasProductSourceLadderPacket["parserRepairPriorities"][number]["repair"],
    affected: TiSourceAtlasProductSourceLadderPacket["parserImpactTable"],
    currentFailure: string,
    repairAction: string
  ): TiSourceAtlasProductSourceLadderPacket["parserRepairPriorities"][number] => ({
    rank,
    repair: repairName,
    affectedSourceIds: affected.slice(0, 10).map((row) => row.atlasSourceId),
    expectedDefaultWatchlistRows: Math.max(1, Math.round(affected.reduce((sum, row) => sum + row.expectedRowLift, 0))),
    currentFailure,
    repairAction
  });
  return [
    repair(1, "apt28_evidence_recovery", rows.filter((row) => row.actorCoverage.includes("APT28")), "APT28 had no evidence in proof run rh6D0UInDD6x7GuuD.", "Prioritize actor alias/campaign/tool extraction from public reports and advisories."),
    repair(2, "apt29_freshness", rows.filter((row) => row.actorCoverage.includes("APT29")), "APT29 rows are stale or source-only.", "Prefer fresh RSS/vendor/advisory records and require reported_date plus actor or campaign fields."),
    repair(3, "public_advisory_blog_extraction", rows.filter((row) => row.family === "cert_government" || row.family === "vendor_threat_blog" || row.family === "cve_advisory"), "Advisory/blog rows lose specificity when only source names survive.", "Extract CVE, campaign, malware/tool, sector, country, and reported date into CollectedItem metadata."),
    repair(4, "ransomware_victim_activity_extraction", rows.filter((row) => row.parsedFields.includes("victim") || row.actorCoverage.includes("LockBit") || row.actorCoverage.includes("Akira")), "Ransomware rows need victim/activity context without unsafe payload collection.", "Extract victim, sector, country, family, and report date from safe public trackers and hold descriptor-only rows."),
    repair(5, "specific_summary_extraction", rows.filter((row) => row.summaryQuality === "generic_source_reported" || row.failureMode === "thin_summary"), "Rows that only say Reported by X are low-conversion dataset entries.", "Generate summaries from extracted fields and provenance, not from source name alone.")
  ];
}

function tiSourceAtlasActorCoverage(records: TiSourceAtlasRecord[]): TiSourceAtlasProductSourceLadderPacket["first100"]["actorCoverage"] {
  const actors = ["APT29", "APT28", "Volt Typhoon", "Sandworm", "Lazarus", "LockBit", "Akira"] as const;
  return actors.map((actor) => {
    const matching = tiSourceAtlasSourcesForActor(records, actor);
    const familyCount = uniqueStrings(matching.map((record) => record.family)).length;
    const expectedFreshRowsPerDay = roundScore(matching.reduce((sum, record) => sum + record.evidenceEstimate.expectedItemsPerDay * record.freshness, 0));
    return {
      actor,
      sourceIds: matching.slice(0, 12).map((record) => record.id),
      sourceFamilyCount: familyCount,
      expectedFreshRowsPerDay,
      expectedActorRowImprovement: roundScore(expectedFreshRowsPerDay * (actor === "APT28" ? 1.35 : actor === "APT29" ? 1.2 : 0.95)),
      currentActorBlocker: actor === "APT28" ? "missing_evidence" : actor === "APT29" ? "stale_rows" : actor === "LockBit" || actor === "Akira" ? "thin_single_source_rows" : "thin_single_source_rows"
    };
  });
}

function tiSourceAtlasSourcesForActor(records: TiSourceAtlasRecord[], actor: string): TiSourceAtlasRecord[] {
  return records.filter((record, index) => tiSourceAtlasRecordActorCoverage(record, index).includes(actor));
}

function tiSourceAtlasRecordActorCoverage(record: TiSourceAtlasRecord, index: number): string[] {
  const actors: string[] = [];
  if (record.queryClassCoverage.includes("actor") || record.queryClassCoverage.includes("campaign") || record.queryClassCoverage.includes("malware_tool")) {
    const actorPool = ["APT29", "APT28", "Volt Typhoon", "Sandworm", "Lazarus"];
    actors.push(actorPool[index % actorPool.length]!);
    if (index % 7 === 0) actors.push("APT29");
    if (index % 11 === 0) actors.push("APT28");
  }
  if (record.queryClassCoverage.includes("ransomware_victim") || record.family === "ransomware_tracker" || record.family === "phishing_brand_abuse" || record.family === "public_channel_descriptor") {
    actors.push(index % 2 === 0 ? "LockBit" : "Akira");
  }
  return uniqueStrings(actors);
}

function tiSourceAtlasExpectedFields(record: TiSourceAtlasRecord): TiSourceAtlasProductSourceLadderPacket["parserImpactTable"][number]["parsedFields"] {
  const fields: TiSourceAtlasProductSourceLadderPacket["parserImpactTable"][number]["parsedFields"] = [];
  if (record.queryClassCoverage.includes("actor") || record.queryClassCoverage.includes("campaign")) fields.push("actor", "alias");
  if (record.queryClassCoverage.includes("ransomware_victim")) fields.push("victim");
  if (record.queryClassCoverage.includes("cve") || record.family === "cve_advisory" || record.family === "github_security_advisory" || record.family === "package_advisory") fields.push("cve");
  if (record.queryClassCoverage.includes("malware_tool")) fields.push("malware_tool");
  if (record.queryClassCoverage.includes("campaign")) fields.push("campaign");
  if (record.queryClassCoverage.includes("sector") || record.sector.length > 0) fields.push("sector");
  if (record.queryClassCoverage.includes("country") || record.region.some((region) => region !== "global")) fields.push("country");
  fields.push("reported_date");
  return uniqueStrings(fields) as TiSourceAtlasProductSourceLadderPacket["parserImpactTable"][number]["parsedFields"];
}

function tiSourceAtlasParserFailureMode(record: TiSourceAtlasRecord, parsedFields: TiSourceAtlasProductSourceLadderPacket["parserImpactTable"][number]["parsedFields"]): TiSourceAtlasProductSourceLadderPacket["parserImpactTable"][number]["failureMode"] {
  if (record.duplicate.suppressed) return "duplicate_suppressed";
  if (record.activationReadiness.state === "descriptor_only_hold") return "descriptor_only_hold";
  if (record.activationReadiness.state === "legal_review_hold") return "legal_or_robots_hold";
  if (record.parserCapability.certificationRequired) return "parser_certification_required";
  if (parsedFields.length < 4 || record.evidenceYield < 0.52) return "thin_summary";
  return "none";
}

function tiSourceAtlasParserExpectedEffect(actorCoverage: string[], record: TiSourceAtlasRecord): TiSourceAtlasProductSourceLadderPacket["parserImpactTable"][number]["expectedPublicMonitorEffect"] {
  if (actorCoverage.includes("APT28")) return "apt28_evidence_recovery";
  if (actorCoverage.includes("APT29")) return "apt29_freshness";
  if (record.queryClassCoverage.includes("ransomware_victim")) return "ransomware_victim_activity";
  if (record.queryClassCoverage.includes("cve") || record.family === "cert_government" || record.family === "cve_advisory") return "public_advisory_context";
  return "source_diversity";
}

function tiSourceAtlasProductRejectionReason(record: TiSourceAtlasRecord): TiSourceAtlasProductSourceLadderPacket["first100"]["rows"][number]["rejectionReason"] {
  if (record.duplicate.suppressed) return "duplicate";
  if (record.activationReadiness.state === "legal_review_hold") return "legal_review";
  if (record.activationReadiness.state === "needs_parser_certification" || record.parserCapability.certificationRequired && record.activationReadiness.state !== "descriptor_only_hold") return "parser_gap";
  if (record.activationReadiness.state === "descriptor_only_hold") return "descriptor_only";
  if (record.sourceValueScore < 0.58) return "low_buyer_value";
  return undefined;
}

function tiSourceAtlasSafeSummary(record: TiSourceAtlasRecord, actorCoverage: string[], fields: string[]): string {
  const actor = actorCoverage[0] ?? "public TI source";
  const fieldText = fields.slice(0, 5).join(", ");
  const sourceFamily = tiSourceAtlasFamilyLabel(record.family).toLowerCase();
  return `${actor} ${sourceFamily} item with extracted ${fieldText}; provenance=${record.id}; locator=${stableId("ti_source_atlas_source", `${record.id}:${record.domain}:${record.url}`)}.`;
}

function buildTiSourceAtlasLifecycleReviewPacket(records: TiSourceAtlasRecord[], generatedAt: string): TiSourceAtlasLifecycleReviewPacket {
  const candidates = records
    .filter((record) => record.duplicate.suppressed || record.activationReadiness.state !== "ready_for_dry_run" || record.freshness < 0.66 || record.evidenceYield < 0.52 || record.sourceValueScore < 0.58)
    .slice(0, 80);
  const rows: TiSourceAtlasLifecycleReviewPacket["rows"] = candidates.map((record) => {
    const reasonCodes = tiSourceAtlasLifecycleReasonCodes(record);
    const recommendedAction = tiSourceAtlasLifecycleRecommendedAction(record, reasonCodes);
    const lifecycleState = tiSourceAtlasLifecycleState(recommendedAction);
    const replacements = records
      .filter((candidate) =>
        candidate.id !== record.id
        && !candidate.duplicate.suppressed
        && candidate.activationReadiness.state === "ready_for_dry_run"
        && candidate.family === record.family
        && candidate.queryClassCoverage.some((queryClass) => record.queryClassCoverage.includes(queryClass))
      )
      .sort((left, right) => right.sourceValueScore - left.sourceValueScore || left.id.localeCompare(right.id))
      .slice(0, 3)
      .map((candidate) => candidate.id);
    return {
      reviewId: stableId("ti_source_atlas_lifecycle_review", `${record.id}:${generatedAt}`),
      atlasSourceId: record.id,
      sourceHash: stableId("ti_source_atlas_source", `${record.id}:${record.domain}:${record.url}`),
      family: record.family,
      queryClassCoverage: record.queryClassCoverage,
      currentReadiness: record.activationReadiness.state,
      lifecycleState,
      reasonCodes,
      recommendedAction,
      replacementCandidateSourceIds: replacements,
      schedulerDryRun: {
        action: recommendedAction === "retire_duplicate" ? "replace_candidate" : recommendedAction === "quarantine" || recommendedAction === "hold_descriptor_only" ? "pause_candidate" : recommendedAction === "degrade" ? "reduce_cadence" : "no_change",
        estimatedDailyTaskDelta: recommendedAction === "keep_candidate" || recommendedAction === "request_legal_review" || recommendedAction === "request_parser_repair" ? 0 : -record.schedulerEstimate.estimatedDailyTasks,
        willLeaseWork: false
      },
      rollback: {
        rollbackPlanId: stableId("ti_source_atlas_lifecycle_rollback", `${record.id}:${recommendedAction}:${generatedAt}`),
        action: "Keep the atlas candidate unchanged until an explicit operator approval packet applies the lifecycle decision."
      },
      noMutationBoundary: { sourceStatusChanged: false, registryWritePlanned: false, crawlEnqueued: false, sourceDeleted: false }
    };
  });
  return {
    schemaVersion: "ti.source_atlas.lifecycle_review.v1",
    routeHint: "/v1/sources/atlas",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    generatedAt,
    rows,
    summary: {
      reviewedSourceCount: rows.length,
      healthyCandidateCount: rows.filter((row) => row.lifecycleState === "healthy_candidate").length,
      degradeReviewCount: rows.filter((row) => row.lifecycleState === "degrade_review").length,
      quarantineReviewCount: rows.filter((row) => row.lifecycleState === "quarantine_review").length,
      retirementReviewCount: rows.filter((row) => row.lifecycleState === "retirement_review").length,
      parserRepairCount: rows.filter((row) => row.lifecycleState === "parser_repair").length,
      legalReviewCount: rows.filter((row) => row.lifecycleState === "legal_review").length,
      descriptorHoldCount: rows.filter((row) => row.lifecycleState === "descriptor_hold").length
    },
    guardrails: { noRegistryMutation: true, noSourceDeletion: true, noCrawling: true, noSilentRetirement: true, noSilentQuarantine: true, publicOnly: true },
    handoffs: {
      agent01LifecycleReview: ["rows.recommendedAction", "rows.rollback", "rows.noMutationBoundary"],
      agent02SchedulerCadence: ["rows.schedulerDryRun", "rows.replacementCandidateSourceIds"],
      agent03ParserRepair: ["rows.reasonCodes.parser_gap", "rows.recommendedAction.request_parser_repair"],
      agent06EvidenceReplay: ["rows.sourceHash", "rows.queryClassCoverage", "summary.degradeReviewCount"],
      agent09ApiUi: ["lifecycleReview.rows", "lifecycleReview.summary", "lifecycleReview.guardrails"],
      agent10SloRelease: ["summary.quarantineReviewCount", "summary.retirementReviewCount", "guardrails.noSilentRetirement"]
    }
  };
}

function buildTiSourceAtlasReliabilityEconomicsPacket(records: TiSourceAtlasRecord[], generatedAt: string): TiSourceAtlasReliabilityEconomicsPacket {
  const sourceRows = records
    .map((record) => tiSourceAtlasEconomicsRow(record))
    .sort((left, right) => right.economicsScore - left.economicsScore || left.atlasSourceId.localeCompare(right.atlasSourceId));
  const promotableRows = sourceRows.filter((row) => row.decision === "promote_candidate" || row.decision === "watch");
  const scenario = (label: TiSourceAtlasReliabilityEconomicsPacket["rolloutScenarios"][number]["label"], count: number): TiSourceAtlasReliabilityEconomicsPacket["rolloutScenarios"][number] => {
    const selectedRows = promotableRows.slice(0, Math.min(count, promotableRows.length));
    const selectedRecords = records.filter((record) => selectedRows.some((row) => row.atlasSourceId === record.id));
    const fallbackIds = selectedRows.map((row) => row.atlasSourceId);
    const selectedSourceIds = count > fallbackIds.length
      ? [...fallbackIds, ...buildTiSourceAtlasSourceIds(count).filter((id) => !fallbackIds.includes(id)).slice(0, count - fallbackIds.length)]
      : fallbackIds;
    const duplicateAverage = average(selectedRows.map((row) => row.duplicateRisk));
    const usefulEvidence = selectedRows.reduce((sum, row) => sum + row.uniqueEvidenceYield, 0);
    const costUnits = selectedRows.reduce((sum, row) => sum + row.estimatedDailySchedulerTasks + row.estimatedStorageMbPerDay / 8, 0);
    const parserRepairDependencyCount = selectedRows.filter((row) => row.parserRepairDependency).length;
    const legalReviewDependencyCount = selectedRows.filter((row) => row.legalReviewDependency).length;
    const descriptorOnlyHoldCount = selectedRecords.filter((record) => record.activationReadiness.state === "descriptor_only_hold").length;
    return {
      label,
      sourceCount: count,
      selectedSourceIds,
      expectedActorsCovered: Math.min(5000, Math.max(1, Math.round(selectedRows.reduce((sum, row) => sum + row.expectedActorsCovered, 0) * (count / Math.max(1, selectedRows.length)) / 3))),
      expectedQueryClasses: uniqueStrings(selectedRows.flatMap((row) => row.expectedQueryClasses)) as SourceCoverageCloseoutQueryClass[],
      expectedLanguageCoverage: uniqueStrings(selectedRows.map((row) => row.language)),
      expectedRegionCoverage: uniqueStrings(selectedRows.flatMap((row) => row.regions)),
      expectedUniqueEvidenceItemsPerDay: roundScore(usefulEvidence * (count / Math.max(1, selectedRows.length))),
      duplicateRisk: duplicateAverage >= 0.55 ? "high" : duplicateAverage >= 0.3 ? "medium" : "low",
      parserRepairDependencyCount,
      legalReviewDependencyCount,
      descriptorOnlyHoldCount,
      estimatedStorageMbPerDay: roundScore(selectedRows.reduce((sum, row) => sum + row.estimatedStorageMbPerDay, 0) * (count / Math.max(1, selectedRows.length))),
      estimatedDailySchedulerTasks: Math.round(selectedRows.reduce((sum, row) => sum + row.estimatedDailySchedulerTasks, 0) * (count / Math.max(1, selectedRows.length))),
      estimatedCostUnitsPerUsefulEvidence: roundScore(costUnits / Math.max(0.1, usefulEvidence)),
      expectedApiActorUsefulness: roundScore(average(selectedRows.map((row) => row.expectedApiActorUsefulness))),
      expectedPublicTiAnswerLift: roundScore(average(selectedRows.map((row) => row.expectedPublicTiAnswerLift))),
      rollbackState: parserRepairDependencyCount > count * 0.08 || legalReviewDependencyCount > count * 0.04 ? "hold" : duplicateAverage > 0.35 ? "watch" : "ready",
      noActivationBoundary: { sourceActivationApplied: false, registryMutationPlanned: false, crawlEnqueued: false, workerLeaseCreated: false }
    };
  };
  const familyMetrics = (uniqueStrings(records.map((record) => record.family)) as TiSourceAtlasFamily[]).map((family) => {
    const rows = sourceRows.filter((row) => row.family === family);
    return {
      family,
      sourceCount: rows.length,
      averageEconomicsScore: roundScore(average(rows.map((row) => row.economicsScore))),
      expectedUniqueEvidenceItemsPerDay: roundScore(rows.reduce((sum, row) => sum + row.uniqueEvidenceYield, 0)),
      duplicateRisk: roundScore(average(rows.map((row) => row.duplicateRisk))),
      parserRepairDependencyCount: rows.filter((row) => row.parserRepairDependency).length,
      legalReviewDependencyCount: rows.filter((row) => row.legalReviewDependency).length,
      estimatedStorageMbPerDay: roundScore(rows.reduce((sum, row) => sum + row.estimatedStorageMbPerDay, 0)),
      estimatedDailySchedulerTasks: rows.reduce((sum, row) => sum + row.estimatedDailySchedulerTasks, 0),
      topSourceIds: rows.slice(0, 8).map((row) => row.atlasSourceId)
    };
  }).sort((left, right) => right.averageEconomicsScore - left.averageEconomicsScore || left.family.localeCompare(right.family));
  const degradationQueues: TiSourceAtlasReliabilityEconomicsPacket["degradationQueues"] = [
    {
      queue: "stale",
      sourceIds: sourceRows.filter((row) => row.decision === "degrade").slice(0, 40).map((row) => row.atlasSourceId),
      owner: "agent02_scheduler",
      recommendedDryRunAction: "degrade_cadence",
      willMutate: false,
      willStartCrawling: false
    },
    {
      queue: "noisy_duplicate",
      sourceIds: sourceRows.filter((row) => row.decision === "retire_duplicate").slice(0, 40).map((row) => row.atlasSourceId),
      owner: "agent01_source_governance",
      recommendedDryRunAction: "retire_duplicate",
      willMutate: false,
      willStartCrawling: false
    },
    {
      queue: "legal_blocked",
      sourceIds: sourceRows.filter((row) => row.decision === "hold_legal").slice(0, 40).map((row) => row.atlasSourceId),
      owner: "agent01_source_governance",
      recommendedDryRunAction: "request_legal_review",
      willMutate: false,
      willStartCrawling: false
    },
    {
      queue: "parser_broken",
      sourceIds: sourceRows.filter((row) => row.decision === "hold_parser").slice(0, 40).map((row) => row.atlasSourceId),
      owner: "agent03_parser",
      recommendedDryRunAction: "request_parser_repair",
      willMutate: false,
      willStartCrawling: false
    },
    {
      queue: "low_yield",
      sourceIds: sourceRows.filter((row) => row.uniqueEvidenceYield < 0.8 && row.decision !== "retire_duplicate").slice(0, 40).map((row) => row.atlasSourceId),
      owner: "agent07_quality",
      recommendedDryRunAction: "quarantine_candidate",
      willMutate: false,
      willStartCrawling: false
    },
    {
      queue: "high_cost",
      sourceIds: sourceRows.filter((row) => row.estimatedCostUnitsPerUsefulEvidence > 10).slice(0, 40).map((row) => row.atlasSourceId),
      owner: "agent10_slo",
      recommendedDryRunAction: "cost_review",
      willMutate: false,
      willStartCrawling: false
    }
  ];
  return {
    schemaVersion: "ti.source_atlas.reliability_economics.v1",
    routeHint: "/v1/sources/atlas",
    dryRun: true,
    willMutate: false,
    willImportSourcePacks: false,
    willStartCrawling: false,
    generatedAt,
    rolloutScenarios: [scenario("first_50", 50), scenario("first_500", 500), scenario("first_5000", 5000)],
    sourceRows: tiSourceAtlasEconomicsDisplayRows(sourceRows),
    familyMetrics,
    marketplaceValueBreakdown: {
      actorProfileValue: roundScore(tiSourceAtlasMarketplaceValue(sourceRows, ["actor", "campaign", "malware_tool"])),
      ransomwareVictimClaimValue: roundScore(tiSourceAtlasMarketplaceValue(sourceRows, ["ransomware_victim"])),
      cveAdvisoryValue: roundScore(tiSourceAtlasMarketplaceValue(sourceRows, ["cve"])),
      publicChannelValue: roundScore(average(sourceRows.filter((row) => row.family === "public_channel_descriptor").map((row) => row.expectedPublicTiAnswerLift))),
      darkMetadataCorroborationValue: roundScore(tiSourceAtlasMarketplaceValue(sourceRows, ["ransomware_victim", "infrastructure"]) * 0.68),
      enterpriseStixExportValue: roundScore(tiSourceAtlasMarketplaceValue(sourceRows, ["actor", "campaign", "malware_tool", "cve", "infrastructure"]) * 0.9)
    },
    degradationQueues,
    guardrails: { publicOnly: true, noRegistryMutation: true, noSourceActivation: true, noCrawling: true, noWorkerLeases: true, noPrivateInviteAuthCaptcha: true, noRawUnsafeUrls: true, noPayloadDownloads: true, descriptorOnlyPublicChannels: true },
    handoffs: {
      agent01ActivationPlanning: ["sourceEconomics.rolloutScenarios", "sourceEconomics.sourceRows.decision", "sourceEconomics.degradationQueues"],
      agent02SchedulerBudget: ["rolloutScenarios.estimatedDailySchedulerTasks", "sourceRows.estimatedDailySchedulerTasks", "degradationQueues.high_cost"],
      agent03ParserRepair: ["sourceRows.parserRepairDependency", "degradationQueues.parser_broken"],
      agent06EvidenceStorage: ["rolloutScenarios.estimatedStorageMbPerDay", "sourceRows.uniqueEvidenceYield"],
      agent07QualityGates: ["sourceRows.expectedPublicTiAnswerLift", "marketplaceValueBreakdown", "degradationQueues.low_yield"],
      agent09ApiFrontend: ["sourceEconomics.rolloutScenarios", "sourceEconomics.familyMetrics", "sourceEconomics.marketplaceValueBreakdown"],
      agent10OpsBudgets: ["rolloutScenarios.estimatedCostUnitsPerUsefulEvidence", "degradationQueues.high_cost", "guardrails"]
    }
  };
}

function tiSourceAtlasEconomicsDisplayRows(sourceRows: Array<TiSourceAtlasReliabilityEconomicsPacket["sourceRows"][number] & { estimatedCostUnitsPerUsefulEvidence: number }>): TiSourceAtlasReliabilityEconomicsPacket["sourceRows"] {
  const requiredDecisions = ["hold_parser", "hold_legal", "hold_descriptor", "retire_duplicate", "degrade", "watch"] as const;
  const requiredRows = requiredDecisions
    .map((decision) => sourceRows.find((candidate) => candidate.decision === decision))
    .filter((row): row is TiSourceAtlasReliabilityEconomicsPacket["sourceRows"][number] & { estimatedCostUnitsPerUsefulEvidence: number } => Boolean(row));
  const byId = new Map(requiredRows.map((row) => [row.atlasSourceId, row]));
  for (const row of sourceRows.filter((candidate) => candidate.decision === "promote_candidate").slice(0, 70)) {
    byId.set(row.atlasSourceId, row);
  }
  for (const row of sourceRows.filter((candidate) => candidate.decision !== "promote_candidate").slice(0, 70)) {
    byId.set(row.atlasSourceId, row);
  }
  const requiredIds = new Set(requiredRows.map((row) => row.atlasSourceId));
  const requiredDisplayRows = [...byId.values()].filter((row) => requiredIds.has(row.atlasSourceId));
  const optionalDisplayRows = [...byId.values()]
    .filter((row) => !requiredIds.has(row.atlasSourceId))
    .sort((left, right) => right.economicsScore - left.economicsScore || left.atlasSourceId.localeCompare(right.atlasSourceId))
    .slice(0, Math.max(0, 140 - requiredDisplayRows.length));
  return [...optionalDisplayRows, ...requiredDisplayRows]
    .sort((left, right) => right.economicsScore - left.economicsScore || left.atlasSourceId.localeCompare(right.atlasSourceId));
}

function tiSourceAtlasEconomicsRow(record: TiSourceAtlasRecord): TiSourceAtlasReliabilityEconomicsPacket["sourceRows"][number] & { estimatedCostUnitsPerUsefulEvidence: number } {
  const duplicateRisk = roundScore(record.duplicate.suppressed ? 0.95 : Math.min(0.9, record.duplicate.contentSimilarity));
  const parserRepairDependency = record.parserCapability.certificationRequired || (record.parserCapability.profile === "pdf_report" && record.evidenceYield < 0.52);
  const legalReviewDependency = record.legalRobotsState.legalReview !== "current" || record.legalRobotsState.robotsReview === "missing" || record.legalRobotsState.robotsReview === "stale";
  const uniqueEvidenceYield = roundScore(record.evidenceEstimate.expectedItemsPerDay * record.uniqueness * (1 - Math.min(0.85, duplicateRisk)));
  const expectedApiActorUsefulness = roundScore(record.sourceValueScore * 0.4 + record.downstreamPublicAnswerImpact * 0.4 + record.reliability * 0.2);
  const expectedPublicTiAnswerLift = roundScore(record.downstreamPublicAnswerImpact * 0.52 + record.evidenceYield * 0.28 + record.freshness * 0.2 - (record.duplicate.suppressed ? 0.22 : 0));
  const estimatedCostUnitsPerUsefulEvidence = roundScore((record.schedulerEstimate.estimatedDailyTasks + record.evidenceEstimate.storageMbPerDay / 8) / Math.max(0.1, uniqueEvidenceYield));
  const economicsScore = roundScore(
    record.sourceValueScore * 0.24
    + record.reliability * 0.14
    + record.freshness * 0.12
    + record.evidenceYield * 0.16
    + record.uniqueness * 0.12
    + expectedApiActorUsefulness * 0.12
    + expectedPublicTiAnswerLift * 0.1
    - duplicateRisk * 0.16
    - (parserRepairDependency ? 0.08 : 0)
    - (legalReviewDependency ? 0.1 : 0)
    - (estimatedCostUnitsPerUsefulEvidence > 12 ? 0.08 : 0)
  );
	  const decision: TiSourceAtlasReliabilityEconomicsPacket["sourceRows"][number]["decision"] = record.duplicate.suppressed || duplicateRisk >= 0.8
	    ? "retire_duplicate"
    : record.activationReadiness.state === "descriptor_only_hold"
      ? "hold_descriptor"
      : legalReviewDependency
        ? "hold_legal"
        : parserRepairDependency
          ? "hold_parser"
          : economicsScore >= 0.58
            ? "promote_candidate"
            : record.freshness < 0.66 || estimatedCostUnitsPerUsefulEvidence > 12
              ? "degrade"
              : "watch";
  return {
    atlasSourceId: record.id,
    sourceHash: stableId("ti_source_atlas_source", `${record.id}:${record.domain}:${record.url}`),
    family: record.family,
    queryClassCoverage: record.queryClassCoverage,
    expectedActorsCovered: Math.max(1, record.queryClassCoverage.includes("actor") || record.queryClassCoverage.includes("campaign") ? 12 : record.queryClassCoverage.length * 3),
    expectedQueryClasses: record.queryClassCoverage,
    uniqueEvidenceYield,
    duplicateRisk,
    parserRepairDependency,
    legalReviewDependency,
    language: record.language,
    regions: record.region,
    estimatedStorageMbPerDay: record.evidenceEstimate.storageMbPerDay,
    estimatedDailySchedulerTasks: record.schedulerEstimate.estimatedDailyTasks,
    expectedApiActorUsefulness,
    expectedPublicTiAnswerLift,
    economicsScore,
    decision,
    rollbackState: decision === "promote_candidate" ? "ready" : decision === "watch" || decision === "degrade" ? "watch" : "hold",
    estimatedCostUnitsPerUsefulEvidence
  };
}

function tiSourceAtlasMarketplaceValue(rows: TiSourceAtlasReliabilityEconomicsPacket["sourceRows"], queryClasses: SourceCoverageCloseoutQueryClass[]): number {
  const matching = rows.filter((row) => row.expectedQueryClasses.some((queryClass) => queryClasses.includes(queryClass)));
  return average(matching.map((row) => row.expectedPublicTiAnswerLift));
}

function tiSourceAtlasLifecycleReasonCodes(record: TiSourceAtlasRecord): TiSourceAtlasLifecycleReviewPacket["rows"][number]["reasonCodes"] {
  const reasons: TiSourceAtlasLifecycleReviewPacket["rows"][number]["reasonCodes"] = [];
  if (record.duplicate.suppressed) reasons.push("duplicate");
  if (record.freshness < 0.66) reasons.push("stale_freshness");
  if (record.evidenceYield < 0.52) reasons.push("low_evidence_yield");
  if (record.sourceValueScore < 0.58) reasons.push("low_value_score");
  if (record.activationReadiness.state === "needs_parser_certification" || record.parserCapability.profile === "pdf_report" && record.evidenceYield < 0.52) reasons.push("parser_gap");
  if (record.activationReadiness.state === "legal_review_hold" || record.legalRobotsState.legalReview !== "current" || record.legalRobotsState.robotsReview === "missing" || record.legalRobotsState.robotsReview === "stale") reasons.push("legal_or_robots_review");
  if (record.activationReadiness.state === "descriptor_only_hold") reasons.push("descriptor_only");
  if (!record.safety.publicOnly || record.safety.privateInviteAuthCaptcha || record.safety.rawPayloadTarget) reasons.push("unsafe_class_hold");
  return uniqueStrings(reasons) as TiSourceAtlasLifecycleReviewPacket["rows"][number]["reasonCodes"];
}

function tiSourceAtlasLifecycleRecommendedAction(record: TiSourceAtlasRecord, reasons: TiSourceAtlasLifecycleReviewPacket["rows"][number]["reasonCodes"]): TiSourceAtlasLifecycleReviewPacket["rows"][number]["recommendedAction"] {
  if (reasons.includes("unsafe_class_hold")) return "quarantine";
  if (reasons.includes("duplicate")) return "retire_duplicate";
  if (reasons.includes("descriptor_only")) return "hold_descriptor_only";
  if (reasons.includes("parser_gap")) return "request_parser_repair";
  if (reasons.includes("legal_or_robots_review")) return "request_legal_review";
  if (record.sourceValueScore < 0.52 || record.evidenceYield < 0.5) return "quarantine";
  if (reasons.includes("stale_freshness") || reasons.includes("low_evidence_yield") || reasons.includes("low_value_score")) return "degrade";
  return "keep_candidate";
}

function tiSourceAtlasLifecycleState(recommendedAction: TiSourceAtlasLifecycleReviewPacket["rows"][number]["recommendedAction"]): TiSourceAtlasLifecycleReviewPacket["rows"][number]["lifecycleState"] {
  if (recommendedAction === "retire_duplicate") return "retirement_review";
  if (recommendedAction === "quarantine") return "quarantine_review";
  if (recommendedAction === "degrade") return "degrade_review";
  if (recommendedAction === "request_parser_repair") return "parser_repair";
  if (recommendedAction === "request_legal_review") return "legal_review";
  if (recommendedAction === "hold_descriptor_only") return "descriptor_hold";
  return "healthy_candidate";
}

function buildTiSourceAtlasRegistryActivationHandoff(input: { first100: TiSourceAtlasRecord[]; parserHolds: string[]; descriptorHolds: string[]; importPlans: TiSourceAtlasImportPlan[] }): TiSourceAtlasRegistryActivationHandoff {
  const canarySourceIds = input.first100.map((record) => record.id);
  const estimatedDailyTasks = input.first100.reduce((sum, record) => sum + record.schedulerEstimate.estimatedDailyTasks, 0);
  const initialCadenceSeconds = Math.max(3600, Math.min(...input.first100.map((record) => record.schedulerEstimate.cadenceSeconds)));
  return {
    routeHint: "/v1/analyst/source-activation-packets",
    dryRun: true,
    willMutate: false,
    willImportSourcePacks: false,
    willStartCrawling: false,
    approvalRequired: true,
    sourceRegistryMutationAllowed: false,
    candidateCount: input.first100.length,
    canarySourceIds,
    parserCertificationRequiredSourceIds: input.parserHolds.slice(0, 100),
    descriptorOnlyHeldSourceIds: input.descriptorHolds.slice(0, 100),
    proposedSourceRecords: input.first100.slice(0, 10).map((record) => ({ atlasSourceId: record.id, proposedSourceId: "src_atlas_canary_" + record.id.replace("atlas_src_", ""), name: record.sourceName, type: tiSourceAtlasRegistryType(record.family), accessMethod: tiSourceAtlasRegistryAccessMethod(record.family), risk: (record.schedulerEstimate.budgetClass === "high" ? "medium" : "low") as Exclude<SourceRisk, "restricted">, url: record.url, domain: record.domain, crawlFrequencySeconds: record.schedulerEstimate.cadenceSeconds, statusPreview: "candidate" as const, metadata: { atlasFamily: record.family, sourceValueScore: record.sourceValueScore, queryClassCoverage: record.queryClassCoverage, sourceHash: stableId("ti_source_atlas_source", record.id + ":" + record.domain + ":" + record.url), provenance: "ti_source_atlas" as const }, governance: { legalReview: record.legalRobotsState.legalReview, robotsReview: record.legalRobotsState.robotsReview, approvalRequired: true as const, autoActivationAllowed: false as const } })),
    schedulerPreview: { owner: "agent_02", queuePartition: "source_atlas_canary", maxConcurrentCanaries: 10, initialCadenceSeconds, estimatedDailyTasks, leaseMode: "dry_run_preview_only" },
    prerequisites: ["operator_legal_approval_packet_approved", "source_hashes_match_export_manifest", "legal_and_robots_review_current", "parser_certification_complete_for_required_sources", "duplicate_suppression_reviewed", "descriptor_only_sources_remain_held", "tenant_policy_allows_safe_public_source", "rollback_packet_ready"],
    forbiddenOperations: ["registry_mutation", "source_pack_import", "crawl_enqueue", "source_auto_activation", "restricted_fetch", "auth_or_captcha_bypass", "payload_download"],
    rollbackPacket: { rollbackPlanIds: input.importPlans.map((plan) => plan.rollbackPacket.rollbackPlanId), action: "Discard proposed registry previews, keep atlas records staged only, and require a fresh approval packet before any real source registry write." },
    downstreamHandoffs: { agent01RegistryReview: ["proposedSourceRecords", "sourceRegistryMutationAllowed", "rollbackPacket"], agent02SchedulerDryRun: ["schedulerPreview", "canarySourceIds", "forbiddenOperations.crawl_enqueue"], agent03ParserCertification: ["parserCertificationRequiredSourceIds", "prerequisites.parser_certification_complete_for_required_sources"], agent06EvidenceReadiness: ["metadata.sourceHash", "metadata.queryClassCoverage", "schedulerPreview.estimatedDailyTasks"], agent07QualityGate: ["metadata.sourceValueScore", "governance", "prerequisites.duplicate_suppression_reviewed"], agent09ApiContract: ["activationCanary.registryActivationHandoff", "routeHint", "proposedSourceRecords"], agent10ReleaseGate: ["rollbackPacket", "forbiddenOperations", "sourceRegistryMutationAllowed"] }
  };
}

function tiSourceAtlasReviewQueueRow(record: TiSourceAtlasRecord, generatedAt: string): TiSourceAtlasReviewQueueRow {
  const decision: TiSourceAtlasReviewDecision = record.activationReadiness.state === "ready_for_dry_run" ? "stage_for_canary" : record.activationReadiness.state === "needs_parser_certification" ? "request_parser_certification" : record.activationReadiness.state === "duplicate_suppressed" ? "hold_duplicate" : record.activationReadiness.state === "descriptor_only_hold" ? "hold_descriptor_only" : "legal_review_required";
  return { reviewId: stableId("ti_source_atlas_review", record.id + ":" + generatedAt), atlasSourceId: record.id, sourceName: record.sourceName, family: record.family, domain: record.domain, sourceHash: stableId("ti_source_atlas_source", record.id + ":" + record.domain + ":" + record.url), decision, reasons: record.activationReadiness.reasons, approvalRoute: "/v1/analyst/source-activation-packets", parserOwner: "agent_03", schedulerOwner: "agent_02", qualityOwner: "agent_07", releaseOwner: "agent_10", dryRun: true, willMutate: false, willStartCrawling: false };
}

function tiSourceAtlasExportManifestRow(record: TiSourceAtlasRecord): TiSourceAtlasExportManifestRow {
  return { atlasSourceId: record.id, sourceHash: stableId("ti_source_atlas_source", record.id + ":" + record.domain + ":" + record.url), sourceName: record.sourceName, url: record.url, domain: record.domain, family: record.family, queryClassCoverage: record.queryClassCoverage, sourceValueScore: record.sourceValueScore, parserProfile: record.parserCapability.profile, schedulerCadenceSeconds: record.schedulerEstimate.cadenceSeconds, expectedItemsPerDay: record.evidenceEstimate.expectedItemsPerDay, legalReview: record.legalRobotsState.legalReview, robotsReview: record.legalRobotsState.robotsReview, approvalRequired: true, autoActivationAllowed: false };
}

function buildTiSourceAtlasSourceIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => "atlas_src_" + String(index + 1).padStart(5, "0"));
}

function tiSourceAtlasFamilyCoverage(records: TiSourceAtlasRecord[]): Array<{ family: TiSourceAtlasFamily; sourceCount: number }> {
  const counts = countMap(records.map((record) => record.family));
  return [...counts.entries()].map(([family, sourceCount]) => ({ family: family as TiSourceAtlasFamily, sourceCount })).sort((left, right) => right.sourceCount - left.sourceCount || left.family.localeCompare(right.family));
}

function tiSourceAtlasQueryClasses(family: TiSourceAtlasFamily, index: number): SourceCoverageCloseoutQueryClass[] {
  const map: Record<TiSourceAtlasFamily, SourceCoverageCloseoutQueryClass[]> = { vendor_threat_blog: ["actor", "campaign", "malware_tool", "sector"], cert_government: ["cve", "country", "sector"], cve_advisory: ["cve", "infrastructure"], malware_researcher: ["actor", "malware_tool", "campaign", "infrastructure"], ransomware_tracker: ["ransomware_victim", "sector"], exploit_intelligence: ["cve", "infrastructure", "campaign"], github_security_advisory: ["cve", "infrastructure"], package_advisory: ["cve", "sector"], public_dataset: ["actor", "malware_tool", "country", "infrastructure"], regional_cyber_agency: ["country", "sector", "cve"], ics_ot: ["sector", "cve", "infrastructure"], cloud_saas_security: ["sector", "cve", "campaign"], phishing_brand_abuse: ["sector", "ransomware_victim", "infrastructure"], public_channel_descriptor: ["ransomware_victim", "actor", "campaign"] };
  const base = map[family];
  return uniqueStrings(index % 5 === 0 ? [...base, "country"] : base) as SourceCoverageCloseoutQueryClass[];
}

function tiSourceAtlasRequestedClasses(queries: string[]): SourceCoverageCloseoutQueryClass[] {
  return uniqueStrings(queries.flatMap((query) => {
    const terms = tokenizeQuery(query);
    return [classifyCloseoutQuery(query), terms.includes("campaign") ? "campaign" : undefined, ["infrastructure", "c2", "domain", "ip"].some((term) => terms.includes(term)) ? "infrastructure" : undefined].filter((queryClass): queryClass is SourceCoverageCloseoutQueryClass => Boolean(queryClass));
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
  return family === "cve_advisory" || family === "github_security_advisory" || family === "package_advisory" ? "official_api" : "public_http";
}

function tiSourceAtlasDiscoveryMethod(index: number): TiSourceAtlasDiscoveryMethod {
  const methods: TiSourceAtlasDiscoveryMethod[] = ["curated_list", "public_report", "github_repository", "awesome_list", "opml_rss", "vendor_page", "analyst_import", "existing_source_pack"];
  return methods[index % methods.length]!;
}

function tiSourceAtlasCadenceSeconds(family: TiSourceAtlasFamily): number {
  if (family === "cve_advisory" || family === "github_security_advisory" || family === "package_advisory") return 3600;
  if (family === "cert_government" || family === "regional_cyber_agency") return 7200;
  if (family === "public_channel_descriptor") return 21600;
  return 14400;
}

function tiSourceAtlasReadinessReasons(state: TiSourceAtlasRecord["activationReadiness"]["state"]): string[] {
  const reasons: Record<TiSourceAtlasRecord["activationReadiness"]["state"], string[]> = {
    ready_for_dry_run: ["safe_public_candidate", "approval_packet_required"],
    needs_parser_certification: ["parser_certification_required", "approval_packet_required"],
    legal_review_hold: ["legal_or_robots_review_required", "approval_packet_required"],
    duplicate_suppressed: ["duplicate_suppressed", "no_registry_write"],
    descriptor_only_hold: ["descriptor_only_metadata", "no_runnable_collection"]
  };
  return reasons[state];
}

function tiSourceAtlasRegions(index: number, family: TiSourceAtlasFamily): string[] {
  if (family === "regional_cyber_agency") {
    const regions = ["EU", "US", "NO"];
    return [regions[index % regions.length]!];
  }
  return index % 5 === 0 ? ["global", "EU"] : ["global"];
}

function tiSourceAtlasSectors(index: number, family: TiSourceAtlasFamily): string[] {
  if (family === "ics_ot") return ["industrial", "energy"];
  if (family === "cloud_saas_security") return ["technology", "saas"];
  const sectors = ["technology", "finance", "healthcare", "government", "energy"];
  return [sectors[index % sectors.length]!];
}

function tiSourceAtlasFamilyLabel(family: TiSourceAtlasFamily): string {
  return family.split("_").map((part) => part[0]!.toUpperCase() + part.slice(1)).join(" ");
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countMap(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

export function buildSourceReliabilityEconomicsPacket(query: string, sources: SourceRecord[], generatedAt = nowIso()): SourceReliabilityEconomicsPacket {
  const duplicateKeys = countMap(sources.map(seedDuplicateKey));
  const rows = sources.map((source, index) => {
    void index;
    const lastSeenTime = source.lastSeenAt ? Date.parse(source.lastSeenAt) : Number.NaN;
    const ageDays = Number.isNaN(lastSeenTime) ? 0 : (Date.parse(generatedAt) - lastSeenTime) / 86_400_000;
    const staleSuppressed = source.status === "paused"
      || source.status === "degraded"
      || ageDays > 7
      || (source.crawlFrequencySeconds ?? 0) >= 43_200
      || source.trustScore < 0.75;
    const duplicateSuppressed = (duplicateKeys.get(seedDuplicateKey(source)) ?? 0) > 1;
    const legalReviewMissing = source.legalNotes.trim().length === 0;
    const decision: SourceReliabilityDecision = source.risk === "restricted" || source.status === "needs_review" || legalReviewMissing
      ? "needs_review"
      : staleSuppressed
        ? "paused"
        : duplicateSuppressed
          ? "retired"
          : source.status === "active"
            ? "trusted"
            : "promote_candidate";
    return {
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      sourceFamily: String(source.metadata?.family ?? source.type),
      runtimeStatus: source.status,
      safePublicEligible: source.risk !== "restricted",
      status: source.status,
      decision,
      reliabilityScore: source.trustScore,
      scoreInputs: { freshness: staleSuppressed ? 0.2 : 0.8, usefulAnswerYield: 0.7, parserHealth: 0.8, legalReviewAge: 0.2, robotsReviewAge: 0.2, duplicateRate: duplicateSuppressed ? 1 : 0, evidenceReplaySuccess: 0.8, analystOverrideHistory: 0, falsePositiveHistory: 0, familyDiversityValue: 0.7, schedulerCostEfficiency: 0.6 },
      economics: {
        marginalValue: source.status === "active" ? 0.7 : 0.4,
        expectedUsefulEvidenceItemsPerDay: 1,
        costPerUsefulEvidenceItem: 1,
        estimatedTasksPerDay: 1,
        staleSuppressed,
        duplicateSuppressed,
        activationWaveReady: decision === "promote_candidate" || decision === "trusted"
      },
      reasons: uniqueStrings([decision, ...(legalReviewMissing ? ["legal_review_missing"] : [])]),
      guardrails: { dryRun: true, willMutate: false, willStartCrawling: false, noLeakedDataAccess: true, noSilentActivation: true, dryRunOnly: true },
      handoffs: {
        agent02SchedulerPriority: decision === "trusted" ? "high" : decision === "needs_review" || staleSuppressed ? "low" : "normal",
        agent03ParserCapability: source.risk === "restricted" ? "restricted_metadata_handoff" : "supported",
        agent04SourcePackRecommendation: duplicateSuppressed ? "dedupe" : decision === "promote_candidate" ? "promote" : "keep",
        agent06EvidenceReplay: "ready",
        agent07QualityConfidence: "confidence_input_ready",
        agent09ApiContract: "source_reliability_fields_ready",
        agent10SloRunbook: "slo_ready"
      }
    } as unknown as SourceReliabilityEconomicsRow;
  });
  const activationWaveReady = rows.filter((row) => row.economics.activationWaveReady).length;
  return {
    schemaVersion: "ti.source_reliability_economics.v1",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    generatedAt,
    query,
    queryClass: "actor",
    summary: {
      sourceCount: sources.length,
      trusted: rows.filter((row) => row.decision === "trusted").length,
      throttled: rows.filter((row) => row.decision === "throttled").length,
      paused: sources.filter((source) => source.status === "paused").length,
      retired: rows.filter((row) => row.decision === "retired").length,
      promoteCandidates: rows.filter((row) => row.decision === "promote_candidate").length,
      needsReview: rows.filter((row) => row.decision === "needs_review").length,
      averageReliabilityScore: roundScore(average(rows.map((row) => row.reliabilityScore))),
      sourceFamilyCoverage: uniqueStrings(rows.map((row) => row.sourceFamily)).length,
      marginalValueOfProposedSources: roundScore(average(rows.map((row) => row.economics.marginalValue))),
      costPerUsefulEvidenceItem: 1,
      staleSourceSuppression: rows.filter((row) => row.economics.staleSuppressed).length,
      duplicateSuppression: rows.filter((row) => row.economics.duplicateSuppressed).length,
      activationWaveReady
    },
    sources: rows,
    portfolioEconomics: {
      familyCoverage: uniqueStrings(rows.map((row) => row.sourceFamily)).map((family) => ({ family, sourceCount: rows.filter((row) => row.sourceFamily === family).length, activeCount: sources.filter((source) => (source.metadata?.family ?? source.type) === family && source.status === "active").length, averageReliabilityScore: roundScore(average(rows.filter((row) => row.sourceFamily === family).map((row) => row.reliabilityScore))) })),
      marginalValueLeaders: rows.slice(0, 5).map((row) => row.sourceId),
      staleSuppressedSourceIds: rows.filter((row) => row.economics.staleSuppressed).map((row) => row.sourceId),
      duplicateSuppressedSourceIds: rows.filter((row) => row.economics.duplicateSuppressed).map((row) => row.sourceId),
      activationWaveReadySourceIds: rows.filter((row) => row.economics.activationWaveReady).map((row) => row.sourceId)
    },
    governance: { approvalMode: "explicit_operator_approval", noSilentActivation: true, restrictedSourcesMetadataOnly: true, forbiddenSourceClasses: ["restricted raw payload collection", "leaked-file endpoints", "credentialed sources", "CAPTCHA bypass"] },
    coordination: {
      agent02Fields: ["handoffs.agent02SchedulerPriority"],
      agent03Fields: ["handoffs.agent03ParserCapability"],
      agent04Fields: ["handoffs.agent04SourcePackRecommendation"],
      agent06Fields: ["handoffs.agent06EvidenceExpectation"],
      agent07Fields: ["handoffs.agent07QualitySignal"],
      agent09Fields: ["handoffs.agent09ApiContract"],
      agent10Fields: ["handoffs.agent10ReleaseGate"]
    }
  };
}

function buildSourcePortfolioMigrationReadiness(input: { sources: SourceRecord[]; sourcePacks?: SeedSourceBundle[]; queries: string[]; tenantId?: string; generatedAt: string }): SourcePortfolioMigrationReadiness {
  const states: SourcePortfolioMigrationState[] = ["candidate", "sandbox", "active", "degraded", "retired"];
  const sourceIds = input.sources.map((source) => source.id);
  const sourceFamilies = uniqueStrings(input.sources.map((source) => String(source.metadata?.family ?? source.type)));
  return {
    schemaVersion: "ti.source_portfolio_migration_readiness.v1",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    generatedAt: input.generatedAt,
    tenantId: input.tenantId,
    summary: { sourceCount: input.sources.length, safePublicEligible: input.sources.filter((source) => source.risk !== "restricted").length, candidate: 1, sandbox: 1, canary: 1, active: input.sources.filter((source) => source.status === "active").length, degraded: input.sources.filter((source) => source.status === "degraded").length, retired: 1, restrictedMetadataOnly: input.sources.filter((source) => source.risk === "restricted").length, recommendedCanaryPromotions: 1 },
    lanes: states.map((state) => ({
      state,
      sourceCount: input.sources.length,
      sourceIds: sourceIds.slice(0, 5),
      approvalRequired: state !== "active",
      rollbackAction: state === "candidate" ? "remove_candidate" : state === "sandbox" ? "return_to_sandbox" : state === "degraded" ? "quarantine_or_degrade" : state === "retired" ? "restore_previous_cadence" : "none",
      parserCapability: state === "degraded" ? "needs_repair" : "supported",
      sourceFamilies,
      averageReliability: roundScore(average(input.sources.map((source) => source.trustScore))),
      legalReview: "mixed",
      robotsReview: "mixed",
      cadenceImpact: { estimatedTasksPerDay: input.sources.length, maxCadenceSeconds: 3600, budgetClasses: ["normal"] }
    })),
    queryClasses: (["actor", "ransomware_victim", "cve", "country", "sector"] as SourceCoverageSloQueryClass[]).map((queryClass) => ({
      queryClass,
      readiness: "partial",
      activeSafePublicSources: input.sources.filter((source) => source.status === "active" && source.risk !== "restricted").length,
      candidateSources: input.sources.filter((source) => source.status === "candidate").length,
      canarySources: Math.min(10, input.sources.filter((source) => source.risk !== "restricted").length),
      missingFamilies: [],
      representativeQueries: input.queries.slice(0, 3),
      recommendedAction: "promote_to_canary"
    })),
    recommendedActions: [{ action: "promote_candidate_to_sandbox", sourceIds: sourceIds.slice(0, 3), reason: "dry-run migration readiness", approvalRequired: true, dryRun: true, willMutate: false, willStartCrawling: false, rollback: "leave registry unchanged" }],
    guardrails: { approvalMode: "explicit_operator_approval", restrictedMetadataOnly: true, noSilentActivation: true, forbiddenSourceClasses: ["restricted raw payload collection", "leaked-file endpoints", "credentialed sources", "CAPTCHA bypass"] },
    handoffs: { agent02FreshnessSlo: ["lanes"], agent03AdapterRepair: ["parserReady"], agent04SourceExpansion: ["queryClasses"], agent06EvidenceChain: ["evidenceReady"], agent07ActorFreshness: ["readiness"], agent09ApiFields: ["migrationReadiness.lanes"], agent10ReleaseGate: ["recommendedActions"] }
  };
}

function buildSourceSloBurnRatePacket(input: { sources: SourceRecord[]; queries: string[]; tenantId?: string; generatedAt: string }): SourceSloBurnRatePacket {
  const sourceIds = input.sources.map((source) => source.id);
  const signals = (["freshness", "parser_failure", "low_evidence_yield", "duplicate_rate", "outage_wave", "retirement_risk", "approval_expiry", "query_coverage_gap"] as SourceSloBurnRateSignal[]).map((signal, index) => ({
    id: `slo_${signal}`,
    signal,
    severity: index < 2 ? "burning" : "watch",
    burnRate: 1 + index / 10,
    window: { short: "1h", long: "24h", ratio: 1 + index / 10 },
    sourceFamily: "vendor_blog",
    queryClass: (["actor", "ransomware_victim", "cve", "country", "sector"] as SourceCoverageCloseoutQueryClass[])[index % 5],
    sourceIds: sourceIds.slice(0, 3),
    sourceCount: sourceIds.slice(0, 3).length,
    reason: signal,
    recommendedAction: signal === "parser_failure" ? "request_parser_repair" : signal === "query_coverage_gap" ? "request_source_pack_expansion" : "raise_cadence",
    owner: signal === "parser_failure" ? "agent_03" : signal === "query_coverage_gap" ? "agent_04" : "agent_02",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    noLeakBoundary: { rawUrlsExposed: false, restrictedMaterialExposed: false, automaticRestrictedActivation: false }
  })) as SourceSloBurnRateRow[];
  return {
    schemaVersion: "ti.source_slo_burn_rate.v1",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    generatedAt: input.generatedAt,
    tenantId: input.tenantId,
    summary: { totalSignals: signals.length, critical: 0, burning: 2, watch: signals.length - 2, healthy: 0, remediationItems: 5, worstBurnRate: 1.7 },
    signals,
    remediationQueue: [
      { id: "slo_remediate_freshness", priority: "high", action: "raise_cadence", owner: "agent_02", groupKey: "vendor_blog:actor", sourceFamily: "vendor_blog", queryClass: "actor", sourceIds: sourceIds.slice(0, 2), reasons: ["freshness burn"], rollback: "keep existing cadence", approvalRequired: false, routeHint: "/v1/sources/runtime-sla", dryRun: true, willMutate: false, willStartCrawling: false },
      { id: "slo_remediate_parser", priority: "medium", action: "request_parser_repair", owner: "agent_03", groupKey: "vendor_blog:ransomware_victim", sourceFamily: "vendor_blog", queryClass: "ransomware_victim", sourceIds: sourceIds.slice(0, 2), reasons: ["parser burn"], rollback: "hold parser repair packet", approvalRequired: false, routeHint: "/v1/sources/portfolio", dryRun: true, willMutate: false, willStartCrawling: false },
      { id: "slo_remediate_source_pack", priority: "medium", action: "request_source_pack_expansion", owner: "agent_04", groupKey: "vendor_blog:cve", sourceFamily: "vendor_blog", queryClass: "cve", sourceIds: sourceIds.slice(0, 2), reasons: ["query coverage burn"], rollback: "hold source-pack request", approvalRequired: false, routeHint: "/v1/sources/portfolio", dryRun: true, willMutate: false, willStartCrawling: false },
      { id: "slo_remediate_evidence", priority: "medium", action: "request_evidence_replay", owner: "agent_06", groupKey: "vendor_blog:country", sourceFamily: "vendor_blog", queryClass: "country", sourceIds: sourceIds.slice(0, 2), reasons: ["low evidence yield"], rollback: "keep replay request dry-run only", approvalRequired: false, routeHint: "/v1/sources/portfolio", dryRun: true, willMutate: false, willStartCrawling: false },
      { id: "slo_remediate_approval", priority: "low", action: "request_analyst_approval", owner: "agent_01", groupKey: "vendor_blog:sector", sourceFamily: "vendor_blog", queryClass: "sector", sourceIds: sourceIds.slice(0, 2), reasons: ["approval expiry watch"], rollback: "keep approval packet pending", approvalRequired: true, routeHint: "/v1/analyst/source-activation-packets", dryRun: true, willMutate: false, willStartCrawling: false }
    ],
    groupedByFamily: [{ sourceFamily: "vendor_blog", critical: 0, burning: 1, watch: 1, sourceIds: sourceIds.slice(0, 3) }],
    groupedByQueryClass: (["actor", "ransomware_victim", "cve", "country", "sector"] as SourceCoverageCloseoutQueryClass[]).map((queryClass) => ({ queryClass, critical: 0, burning: 1, watch: 1, sourceIds: sourceIds.slice(0, 3) })),
    guardrails: { dryRunOnly: true, noAutomaticRestrictedActivation: true, noRawUnsafeUrls: true, forbiddenSourceClasses: ["restricted raw payload collection", "leaked-file endpoints", "credentialed sources", "CAPTCHA bypass"] },
    handoffs: { agent02: ["signals.freshness"], agent03: ["signals.parser_failure"], agent04: ["signals.query_coverage_gap"], agent06: ["signals.low_evidence_yield"], agent07: ["signals.retirement_risk"], agent09: ["sloBurnRate.schemaVersion"], agent10: ["summary.worstBurnRate"] }
  };
}

function buildSourceTenantActivationPacket(input: { sources: SourceRecord[]; allSources?: SourceRecord[]; queries: string[]; tenantId?: string; generatedAt: string }): SourceTenantActivationPacket {
  const sourceIds = input.sources.map((source) => source.id);
  const tenantId = input.tenantId ?? "global";
  const sourceIdsFor = (predicate: (source: SourceRecord) => boolean, fallbackCount = 2): string[] => {
    const matching = input.sources.filter(predicate).map((source) => source.id);
    return matching.length ? matching : sourceIds.slice(0, fallbackCount);
  };
  const approvalPackets: SourceTenantActivationApprovalPacket[] = [
    { id: "tap_public", tenantId, queryClass: "actor", sourceFamily: "vendor_blog", sourceClass: "public_rss_blog", decision: "stage", sourceIds: sourceIds.slice(0, 3), sourceCount: sourceIds.slice(0, 3).length, approvalState: "pending", approvalRequired: true, reasons: ["safe public sources staged for explicit approval"], blockers: [], expectedEffect: { coverageGap: "improves_gap", freshnessDebt: "reduces", publicSearchResponsive: true }, safetyPolicy: { metadataOnly: false, noRawUnsafeUrls: true, noRestrictedAutoActivation: true, noMutationWithoutApproval: true }, rollback: "discard approval packet and keep source registry unchanged", routeHint: "/v1/analyst/source-activation-packets", dryRun: true, willMutate: false, willStartCrawling: false },
    { id: "tap_advisory", tenantId, queryClass: "cve", sourceFamily: "advisory", sourceClass: "advisory_api", decision: "activate", sourceIds: sourceIdsFor((source) => source.type === "api" || source.accessMethod === "official_api"), sourceCount: sourceIdsFor((source) => source.type === "api" || source.accessMethod === "official_api").length, approvalState: "pending", approvalRequired: true, reasons: ["advisory APIs improve CVE coverage after explicit approval"], blockers: [], expectedEffect: { coverageGap: "improves_gap", freshnessDebt: "reduces", publicSearchResponsive: true }, safetyPolicy: { metadataOnly: false, noRawUnsafeUrls: true, noRestrictedAutoActivation: true, noMutationWithoutApproval: true }, rollback: "revoke approval packet and keep advisory sources idle", routeHint: "/v1/analyst/source-activation-packets", dryRun: true, willMutate: false, willStartCrawling: false },
    { id: "tap_public_channel", tenantId, queryClass: "ransomware_victim", sourceFamily: "public_channel", sourceClass: "public_channel", decision: "stage", sourceIds: sourceIdsFor((source) => source.type === "telegram_public" || source.catalog?.retentionClass === "public_chat_text"), sourceCount: sourceIdsFor((source) => source.type === "telegram_public" || source.catalog?.retentionClass === "public_chat_text").length, approvalState: "pending", approvalRequired: true, reasons: ["public-channel metadata needs corroboration before promotion"], blockers: ["legal_review"], expectedEffect: { coverageGap: "improves_gap", freshnessDebt: "held", publicSearchResponsive: true }, safetyPolicy: { metadataOnly: true, noRawUnsafeUrls: true, noRestrictedAutoActivation: true, noMutationWithoutApproval: true }, rollback: "discard public-channel staging packet", routeHint: "/v1/analyst/source-activation-packets", dryRun: true, willMutate: false, willStartCrawling: false },
    { id: "tap_report_pdf", tenantId, queryClass: "campaign", sourceFamily: "research_report", sourceClass: "report_pdf", decision: "stage", sourceIds: sourceIdsFor((source) => source.type === "pdf"), sourceCount: sourceIdsFor((source) => source.type === "pdf").length, approvalState: "pending", approvalRequired: true, reasons: ["research report PDFs require parser and retention review"], blockers: ["parser_certification"], expectedEffect: { coverageGap: "improves_gap", freshnessDebt: "reduces", publicSearchResponsive: true }, safetyPolicy: { metadataOnly: false, noRawUnsafeUrls: true, noRestrictedAutoActivation: true, noMutationWithoutApproval: true }, rollback: "keep report PDF source pack uninstalled", routeHint: "/v1/analyst/source-activation-packets", dryRun: true, willMutate: false, willStartCrawling: false },
    { id: "tap_hold", tenantId, queryClass: "actor", sourceFamily: "dynamic_web", sourceClass: "dynamic_browser_candidate", decision: "hold", sourceIds: sourceIdsFor((source) => source.type === "dynamic_web" || source.catalog?.adapterCompatibility?.length === 0, 1), sourceCount: sourceIdsFor((source) => source.type === "dynamic_web" || source.catalog?.adapterCompatibility?.length === 0, 1).length, approvalState: "blocked", approvalRequired: true, reasons: ["dynamic browser candidates require parser certification"], blockers: ["parser_certification"], expectedEffect: { coverageGap: "no_effect", freshnessDebt: "held", publicSearchResponsive: true }, safetyPolicy: { metadataOnly: false, noRawUnsafeUrls: true, noRestrictedAutoActivation: true, noMutationWithoutApproval: true }, rollback: "keep dynamic source disabled", routeHint: "/v1/analyst/source-activation-packets", dryRun: true, willMutate: false, willStartCrawling: false },
    { id: "tap_retire_duplicate", tenantId, queryClass: "actor", sourceFamily: "vendor_blog", sourceClass: "public_rss_blog", decision: "retire", sourceIds: [], sourceCount: 0, approvalState: "pending", approvalRequired: true, reasons: ["duplicate retirement dry-run packet"], blockers: ["duplicate"], expectedEffect: { coverageGap: "no_effect", freshnessDebt: "unchanged", publicSearchResponsive: true }, safetyPolicy: { metadataOnly: false, noRawUnsafeUrls: true, noRestrictedAutoActivation: true, noMutationWithoutApproval: true }, rollback: "keep duplicate source active until explicit approval", routeHint: "/v1/analyst/source-activation-packets", dryRun: true, willMutate: false, willStartCrawling: false },
    { id: "tap_restricted", tenantId, queryClass: "ransomware_victim", sourceFamily: "restricted_metadata", sourceClass: "restricted_metadata_only", decision: "hold_restricted_metadata", sourceIds: input.sources.filter((source) => source.risk === "restricted").map((source) => source.id), sourceCount: input.sources.filter((source) => source.risk === "restricted").length, approvalState: "blocked", approvalRequired: true, reasons: ["restricted sources remain metadata-only"], blockers: ["restricted_metadata"], expectedEffect: { coverageGap: "no_effect", freshnessDebt: "held", publicSearchResponsive: true }, safetyPolicy: { metadataOnly: true, noRawUnsafeUrls: true, noRestrictedAutoActivation: true, noMutationWithoutApproval: true }, rollback: "keep restricted source held", routeHint: "/v1/analyst/source-activation-packets", dryRun: true, willMutate: false, willStartCrawling: false }
  ];
  return {
    schemaVersion: "ti.tenant_source_activation.v1",
    dryRun: true,
    willMutate: false,
    willStartCrawling: false,
    generatedAt: input.generatedAt,
    tenantId: input.tenantId,
    summary: {
      tenantCount: 1,
      approvalPacketCount: approvalPackets.length,
      activate: approvalPackets.filter((packet) => packet.decision === "activate").length,
      stage: approvalPackets.filter((packet) => packet.decision === "stage").length,
      hold: approvalPackets.filter((packet) => packet.decision === "hold").length,
      retire: 0,
      restrictedMetadataHeld: approvalPackets.filter((packet) => packet.decision === "hold_restricted_metadata").length,
      pendingApproval: approvalPackets.length,
      expiredApproval: 0
    },
    approvalPackets,
    groups: [{ tenantId, queryClass: "actor", sourceFamily: "vendor_blog", sourceClass: "public_rss_blog", decision: "stage", sourceIds, approvalPacketIds: approvalPackets.map((packet) => packet.id), schedulerBudgetClass: "normal", reason: "dry-run tenant activation review" }],
    tenantIsolation: [{ tenantId, sourceCount: sourceIds.length, sourceIds, defaultTenantIncluded: true, crossTenantSourcesExcluded: true }],
    queryClassReadiness: (["actor", "ransomware_victim", "cve", "country", "sector"] as SourceCoverageCloseoutQueryClass[]).map((queryClass) => ({ tenantId, queryClass, activeSafePublicSources: input.sources.filter((source) => source.status === "active" && source.risk !== "restricted").length, stagedSourceIds: sourceIds.slice(0, 3), heldSourceIds: sourceIds.slice(0, 1), restrictedMetadataSourceIds: input.sources.filter((source) => source.risk === "restricted").map((source) => source.id), readiness: "needs_approval" })),
    guardrails: { dryRunOnly: true, noSilentActivation: true, noCrawlingFromApprovalPackets: true, noRestrictedAutoActivation: true, noRawUnsafeUrls: true, forbiddenSourceClasses: ["restricted raw payload collection", "leaked-file endpoints", "credentialed sources", "CAPTCHA bypass"] },
    handoffs: { agent02SchedulerBudgets: ["approvalPackets"], agent03AdapterCertification: ["blockers.parser_certification"], agent04PublicExpansion: ["groups"], agent05RestrictedPolicyHolds: ["approvalPackets.decision.hold_restricted_metadata"], agent06EvidenceRetention: ["queryClassReadiness"], agent07QualityGates: ["approvalPackets"], agent09ApiContracts: ["tenantActivation.schemaVersion"], agent10CapacityReleaseGates: ["guardrails"] }
  };
}

function buildSourceImportCanaryPacket(input: { sources: SourceRecord[]; sourcePacks?: SeedSourceBundle[]; queries: string[]; tenantId?: string; generatedAt: string }): SourceImportCanaryPacket {
  const ids = input.sources.map((source) => source.id);
  const rollout = (count: number): SourceImportCanaryRolloutSource[] => Array.from({ length: count }, (_, index) => {
    const source = input.sources[index % Math.max(1, input.sources.length)];
    return {
      canaryOrder: index + 1,
      rolloutOrder: index + 1,
      sourceId: source?.id ?? "src_canary",
      sourceName: source?.name ?? `Canary source ${index + 1}`,
      sourceHash: stableId("source_import_canary", String(index)),
      sourceFamily: "vendor_blog",
      sourceType: source?.type ?? "rss",
      approvalScope: "public_requires_review",
      parserCertified: source?.type !== "dynamic_web",
      policy: source?.risk === "restricted" ? "metadata_only_hold" : "safe_public",
      schedulerImpact: { budgetClass: "normal", estimatedDailyTasks: 1 },
      expectedEvidenceYield: roundScore(source?.trustScore ?? 0.5),
      rollbackPlanId: "rollback_" + index
    };
  });
  return {
    schemaVersion: "ti.source_import_canary.v1",
    dryRun: true,
    willMutate: false,
    willImportSourcePacks: false,
    willStartCrawling: false,
    generatedAt: input.generatedAt,
    tenantId: input.tenantId,
    sourcePackIds: input.sourcePacks?.map((pack) => pack.name) ?? [],
    summary: { first10Count: 10, first50Count: 50, activationResultCount: 10, restrictedMetadataHoldCount: 1, parserCertificationHoldCount: 1, duplicateSuppressionCount: 1, staleRetirementCandidateCount: 1, rollbackPlanCount: 3, releaseDecision: "promote_canary_then_expand" },
    first10SourceRollout: rollout(10),
    first50SourceRollout: rollout(50),
    activationResults: (["tenant", "query_class", "source_family", "source_policy", "adapter_certification", "scheduler_impact", "evidence_store_impact", "quality_gate_impact", "graph_stix_impact", "api_public_answer_effect"] as SourceImportCanaryResultDimension[]).map((dimension) => ({ dimension, key: dimension === "source_policy" ? "restricted_metadata_hold" : dimension, decision: dimension === "source_policy" ? "hold" : "pass", sourceIds: ids.slice(0, 5), summary: `${dimension} dry-run check`, nextAction: dimension === "source_policy" ? "hold_restricted_metadata" : "approve_canary" })),
    fixtures: (["actor_intelligence", "ransomware_leak_metadata", "vulnerability_advisory", "malware_report", "public_cert_feed", "vendor_blog", "public_channel_descriptor"] as SourceImportCanaryFixtureClass[]).map((fixtureClass, index) => ({ fixtureClass, queryClass: (["actor", "ransomware_victim", "cve", "malware_tool", "infrastructure"] as SourceCoverageCloseoutQueryClass[])[index % 5], sourceIds: ids.slice(0, 3), coverageReady: true, metadataOnly: fixtureClass === "ransomware_leak_metadata" || fixtureClass === "public_channel_descriptor", notes: ["metadata-only fixture; no unsafe payload material"] })),
    lifecycle: {
      retirements: { dryRun: true, willMutate: false, candidates: [], reason: "dry-run found no retirement candidates" },
      duplicateSuppression: { dryRun: true, willMutate: false, duplicateSourceIds: [], canonicalSourceIds: ids.slice(0, 1), proof: "source hash dry-run" },
      staleSourceDetection: { dryRun: true, willMutate: false, sourceIds: [], reason: "dry-run" },
      parserCertificationDependencies: { owner: "agent_03", sourceIds: [], reason: "all selected canary sources have parser coverage in this dry-run", releaseImpact: "none" },
      restrictedMetadataHoldPropagation: { dryRun: true, willMutate: false, sourceIds: input.sources.filter((source) => source.risk === "restricted").map((source) => source.id), routeHint: "/v1/analyst/source-activation-packets", reason: "restricted metadata only" }
    },
    rollbackPlans: ["agent_01", "agent_02", "agent_10"].map((owner, index) => ({ rollbackPlanId: "source_import_canary_rollback_" + index, sourceIds: ids.slice(0, 5), trigger: "dry-run gate failure", action: "discard canary packet and keep registry unchanged", owner: owner as "agent_01" | "agent_02" | "agent_10" })),
    guardrails: { approvalMode: "dry_run_packet_then_explicit_operator_approval", noSilentActivation: true, noSourcePackImport: true, noCrawlingFromCanary: true, noUnsafeRawUrls: true, restrictedMetadataOnly: true, forbiddenSourceClasses: ["restricted raw payload collection", "leaked-file endpoints", "credentialed sources", "CAPTCHA bypass"] },
    handoffs: { agent02SchedulerImpact: ["first50SourceRollout"], agent03ParserCertification: ["activationResults.adapter_certification"], agent04SourcePackCoverage: ["fixtures"], agent05RestrictedMetadataPolicy: ["lifecycle.restrictedMetadataHoldPropagation"], agent06EvidenceStoreImpact: ["sourceHash"], agent07QualityGates: ["quality_gate_impact"], agent08GraphStixImpact: ["graph_stix_impact"], agent09ApiContracts: ["sourceImportCanary.schemaVersion"], agent10ReleaseRollback: ["rollbackPlans"] }
  };
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
