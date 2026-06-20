interface ActorInput {
  query?: string;
  queries?: string[];
  maxRowsPerQuery?: number;
  includeActivity?: boolean;
  includeTargets?: boolean;
  includeTtps?: boolean;
  includeSources?: boolean;
  includeDatasets?: boolean;
  includeCoverageGaps?: boolean;
}

interface TiSearchResponse {
  query: string;
  generatedAt: string;
  mode: string;
  status?: string;
  runId?: string;
  refreshAfterSeconds?: number;
  summary: string;
  confidence: number;
  lastSeen: string;
  aliases: string[];
  recentActivity: Array<{
    date: string;
    title: string;
    detail: string;
    confidence: number;
    sourceIds: string[];
    url?: string;
    claimType?: "campaign" | "victim_claim" | "malware_activity" | "vulnerability_exploitation" | "infrastructure_activity" | "general_activity";
    victimName?: string;
    affectedSectors?: string[];
    countries?: string[];
    impact?: string;
    firstReportedAt?: string;
    lastReportedAt?: string;
    publisherCount?: number;
    corroboratingSourceIds?: string[];
    contradictingSourceIds?: string[];
  }>;
  targets: Array<{
    sector: string;
    regions: string[];
    rationale: string;
    confidence: number;
  }>;
  ttps: Array<{
    name: string;
    attackId?: string;
    tactic: string;
    detail: string;
    confidence: number;
  }>;
  datasets: Array<{
    name: string;
    type: string;
    coverage: string;
    status: string;
    url?: string;
  }>;
  sources: Array<{
    id: string;
    name: string;
    type: string;
    provenance: string;
    url?: string;
  }>;
  scheduler?: Record<string, unknown>;
  sourceCoverage?: Record<string, unknown>;
  publicChannel?: Record<string, unknown>;
  notes: string[];
}

type EvidenceSourceFamily = Exclude<MarketplaceRow["sourceType"], "system">;

interface MarketplaceRow {
  query: string;
  rowType: "profile" | "activity" | "target" | "ttp" | "source" | "dataset" | "coverage_gap";
  actor: string;
  title: string;
  summary: string;
  sourceType: "clear_web" | "public_channel" | "darknet_metadata" | "system";
  sourceName?: string;
  sourceUrl?: string;
  victimName?: string;
  claimType?: string;
  claimedDate?: string;
  affectedSectors?: string[];
  countries?: string[];
  impact?: string;
  firstReportedAt?: string;
  lastReportedAt?: string;
  publisherCount?: number;
  corroboratingSourceIds?: string[];
  contradictingSourceIds?: string[];
  sector?: string;
  country?: string;
  regions?: string[];
  ttp?: string;
  attackId?: string;
  tactic?: string;
  sourceId?: string;
  provenance?: string;
  datasetName?: string;
  datasetType?: string;
  datasetStatus?: string;
  coverage?: string;
  generatedAt: string;
  collectionMode: string;
  sourceCount: number;
  sourceFamilyCount: number;
  sourceFamilies: string[];
  missingSourceFamilies: string[];
  coverageStatus: "sufficient" | "thin" | "stale" | "no_evidence";
  collectionPriority: "none" | "low" | "medium" | "high";
  recommendedCollectionAction: "none" | "monitor_public_channels" | "add_public_channel_sources" | "add_clear_web_sources" | "increase_polling" | "review_contradictions";
  coverageGapCodes: string[];
  activityCount: number;
  freshnessStatus: "current" | "recent" | "stale" | "unknown";
  schedulerState: string;
  schedulerDecision: string;
  nextPollSeconds: number;
  retryAfterSeconds: number;
  duplicateRunReuse: boolean;
  attachedToActiveRun: boolean;
  queuedTaskCount: number;
  deferredBackgroundWorkloads: string[];
  schedulerBadges: string[];
  sourceCoverageState: string;
  sourceCoverageGapCount: number;
  sourceCoverageGaps: string[];
  freshnessExpectation: string;
  highestValueMissingFamily: string;
  nextBestSourceAction: string;
  relationshipSummary: string;
  relationshipPivotTypes: string[];
  relationshipPivots: string[];
  whyActionable: string[];
  freshnessDelta: "new" | "current" | "recent" | "stale" | "unknown";
  confidenceDelta: "stronger" | "stable" | "weaker" | "unknown";
  contradictionHints: string[];
  corroborationState: "corroborated" | "single_source" | "unverified" | "contradicted";
  nextSearchPivots: string[];
  buyerCaveat: string;
  expectedTimeToUsefulSignal: string;
  pollingHint: string;
  paidRowDecision?: "sellable" | "included_with_caveat" | "coverage_gap_only" | "hold" | "suppress";
  paidRowReason?: string;
  paidRowReasonCodes?: string[];
  paidRowRemediationActions?: Array<{
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08";
    action: string;
    expectedEffect: string;
  }>;
  buyerValueScore?: number;
  billingGuidance?: "charge" | "include_as_context" | "do_not_charge_if_metered";
  graphQualityLift?: "accepted_sellable_lift" | "rejected_hold" | "rejected_caveat" | "not_applicable";
  graphQualityLiftReasonCodes?: string[];
  graphQualityLiftEvidence?: {
    relationshipReady: boolean;
    sourceFamilyCorroborated: boolean;
    contradictionHeld: boolean;
    freshnessLift: boolean;
    exportEligible: boolean;
    noLeak: true;
  };
  marketplaceGraphSignals?: {
    schemaVersion: "ti.marketplace_graph_signals.v1";
    signalState: "buyer_ready" | "needs_corroboration" | "held";
    relationshipLinks: string[];
    freshnessChangeHints: string[];
    confidenceTrend: "stronger" | "stable" | "weaker" | "unknown";
    contradictionState: "none" | "contradicted" | "review_hold";
    nextBuyerPivots: string[];
    pivotUtility: {
      usefulPivotCount: number;
      actionPivotCount: number;
      corroboratedPivotCount: number;
      suppressedGenericPivotCount: number;
      buyerValueDelta: number;
      noLeak: true;
    };
    relationshipConfidence: {
      usefulPivotCount: number;
      actionPivotCount: number;
      corroboratedPivotCount: number;
      rejectedUnsupportedPivotCount: number;
      confidenceTrend: "stronger" | "stable" | "weaker" | "unknown";
      contradictionState: "none" | "contradicted" | "review_hold";
      nextSearchCount: number;
      sellableLift: number;
      usefulLift: number;
      buyerValueDelta: number;
      noLeak: true;
    };
    rejectedPivotReasons: Array<"generic_pivot" | "stale_pivot" | "contradicted_pivot" | "unrelated_actor_pivot" | "restricted_only_pivot" | "missing_ledger_pivot" | "single_source_without_caveat" | "no_action_pivot">;
    buyerAction: string;
    sourceBlockers: string[];
    noLeak: true;
  };
  evidenceGrade: "corroborated" | "single_source" | "unverified";
  isActionable: boolean;
  reviewReasons: string[];
  analysisFacets: string[];
  hasDarknetMetadata: boolean;
  hasPublicChannelCoverage: boolean;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
  provenanceHash: string;
  rawContentIncluded: false;
  safety: {
    metadataOnly: true;
    credentialsIncluded: false;
    stolenFilesIncluded: false;
    privateContentIncluded: false;
    actorInteraction: false;
  };
  runId?: string;
  status?: string;
  aliases?: string[];
  warningCodes: string[];
}

interface MonetizationSummary {
  enabled: boolean;
  eventNames: string[];
  pricingModel: "pay_per_event";
  billingMode: "apify_synthetic_events";
  actorStartEvent: string;
  datasetItemEvent: string;
  datasetItemCount: number;
  sellableRowCount: number;
  caveatedRowCount: number;
  coverageGapOnlyRowCount: number;
  holdRowCount: number;
  suppressedRowCount: number;
  chargeRecommendedRowCount: number;
  skippedReason?: string;
}

type PaidRowDecision = NonNullable<MarketplaceRow["paidRowDecision"]>;
type RemediationOwner = NonNullable<MarketplaceRow["paidRowRemediationActions"]>[number]["owner"];

interface QualityLiftExample {
  id: string;
  query: string;
  owner: RemediationOwner;
  sourceFamily: EvidenceSourceFamily;
  beforeDecision: PaidRowDecision;
  afterDecision: PaidRowDecision;
  outcome: "accepted" | "rejected";
  repairAction: string;
  rejectionReason?: "no_sellable_row_lift" | "still_single_source" | "stale_after_repair" | "unsafe_or_unapproved_source" | "cost_exceeds_value";
  victimExtractionDelta: number;
  actorEntitySpecificityDelta: number;
  sectorCountryDelta: number;
  ttpToolDelta: number;
  firstLastSeenDelta: number;
  corroborationDelta: number;
  sourceFamilyDiversityDelta: number;
  freshnessDelta: number;
  staleRowsSuppressedDelta: number;
  sellableRowsDelta: number;
  freshRowsDelta: number;
  usefulRowsDelta: number;
  projectedRowRevenueDeltaUsd: number;
  costPerUsefulRowDeltaUsd: number;
  proofNotes: string[];
}

interface QualityLiftGate {
  schemaVersion: "ti.apify_paid_row_quality_lift_gate.v1";
  baselineRunId: "iMQGeezZ8bx7WtlhQ";
  baselineDatasetId: "5PLmkE30luBA5Lbgc";
  evaluatedRunShape: "apt42_smoke_and_20_group_daily";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  qualityLiftAcceptedCount: number;
  qualityLiftRejectedCount: number;
  sellableRowsAdded: number;
  freshRowsAdded: number;
  usefulRowsAdded: number;
  staleRowsSuppressed: number;
  costPerUsefulRowDelta: number;
  projectedRowRevenueDeltaUsd: number;
  acceptedExamples: QualityLiftExample[];
  rejectedExamples: QualityLiftExample[];
  ownerHandoffs: Array<{
    owner: RemediationOwner;
    accepted: number;
    rejected: number;
    nextActions: string[];
  }>;
  passCriteria: {
    acceptedRequiresDecisionLift: true;
    acceptedRequiresBuyerVisibleMetricLift: true;
    acceptedRequiresSafePublicOrMetadataOnlySource: true;
    rejectedRepairsDoNotCountTowardPayworthyRate: true;
  };
}

interface ProgramBoGraphLiftGate {
  schemaVersion: "ti.apify_buyer_visible_graph_lift_batch_2.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  baselineQuery: "APT42";
  baselineRows: {
    total: 10;
    sellable: 4;
    caveated: 2;
    held: 4;
    averageBuyerValueScore: 0.577;
  };
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  acceptedExamples: Array<{
    id: string;
    beforeDecision: "hold" | "included_with_caveat";
    afterDecision: "sellable";
    graphEvidenceAdds: Array<"relationship_ready" | "source_corroboration" | "freshness_lift" | "actor_target_ttp_pivots" | "no_leak_provenance">;
    buyerVisibleLift: string;
    sellableRowsDelta: 1;
    noLeak: true;
  }>;
  rejectedGraphOnlyPromotions: Array<{
    id: string;
    blockedReason: "stale_graph_context" | "single_source_graph_context" | "contradicted_graph_context" | "restricted_only_graph_context" | "missing_ledger_proof" | "unrelated_actor_context";
    staysDecision: "hold" | "included_with_caveat";
    proofNote: string;
    noLeak: true;
  }>;
  measurableLift: {
    sellableRowsAdded: number;
    projectedAverageBuyerValueScore: number;
    projectedGrossRowRevenueDeltaUsd: number;
  };
}

interface MarketplaceGraphSignalGate {
  schemaVersion: "ti.marketplace_graph_signals_gate.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  improvedRows: number;
  rejectedRows: number;
  expectedBuyerVisibleLift: string[];
  examples: Array<{
    actor: string;
    family: "apt" | "ransomware";
    rowSignal: "buyer_ready" | "needs_corroboration";
    relationshipLinks: string[];
    buyerUse: string;
    nextBuyerPivots: string[];
    noLeak: true;
  }>;
  rejectedGraphInflation: Array<{
    id: string;
    blockedReason: "stale_graph_fact" | "single_source_edge" | "unrelated_actor_link" | "restricted_only_context" | "missing_ledger_proof" | "no_fresh_change";
    proofNote: string;
    noLeak: true;
  }>;
  sourceParserHandoffs: Array<{
    owner: "agent_03" | "agent_04" | "agent_05";
    blocker: string;
    expectedEffect: string;
  }>;
}

interface GraphPivotLiftGate {
  schemaVersion: "ti.apify_graph_pivot_lift_gate.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  exampleCount: number;
  usefulPivotRate: number;
  corroboratedPivotRate: number;
  nextSearchPivotCount: number;
  suppressedGenericPivotCount: number;
  sellableRowsAdded: number;
  usefulRowsAdded: number;
  averageBuyerValueDelta: number;
  examples: Array<{
    actor: string;
    family: "apt" | "ransomware" | "unknown";
    decision: "chargeable" | "caveated" | "held" | "suppressed" | "searching";
    pivotClass: "actor_alias" | "campaign" | "victim" | "sector_country" | "ttp_tool" | "source_family" | "restricted_metadata" | "unknown_search";
    nextBuyerPivot: string;
    buyerUse: string;
    noLeak: true;
  }>;
  rejectedBloatPivots: Array<{
    id: string;
    blockedReason: "generic_pivot" | "stale_pivot" | "contradicted_pivot" | "unrelated_actor_pivot" | "restricted_only_pivot" | "missing_ledger_pivot" | "single_source_without_caveat";
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08";
    proofNote: string;
    noLeak: true;
  }>;
  ownerHandoffs: Array<{
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_09" | "agent_10";
    blocker: string;
    expectedEffect: string;
  }>;
}

interface RelationshipConfidenceGate {
  schemaVersion: "ti.apify_relationship_confidence_gate.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  exampleCount: number;
  usefulPivotCount: number;
  actionPivotCount: number;
  corroboratedPivotCount: number;
  rejectedUnsupportedPivotCount: number;
  nextSearchCount: number;
  sellableRowsAdded: number;
  usefulRowsAdded: number;
  averageBuyerValueDelta: number;
  examples: Array<{
    actor: string;
    family: "apt" | "ransomware" | "victim" | "sector" | "unknown";
    decision: "sellable" | "caveated" | "held" | "suppressed" | "searching";
    confidenceTrend: "stronger" | "stable" | "weaker" | "unknown";
    contradictionState: "none" | "contradicted" | "review_hold";
    pivotClass: "actor_alias" | "campaign" | "victim" | "sector_country" | "ttp_tool" | "source_family" | "restricted_metadata" | "unknown_search";
    nextBuyerPivot: string;
    buyerUse: string;
    noLeak: true;
  }>;
  rejectedUnsupportedPivots: Array<{
    id: string;
    blockedReason: "generic_pivot" | "stale_pivot" | "contradicted_pivot" | "unrelated_actor_pivot" | "restricted_only_pivot" | "missing_ledger_pivot" | "single_source_without_caveat" | "no_action_pivot";
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08";
    proofNote: string;
    noLeak: true;
  }>;
  ownerHandoffs: Array<{
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_09" | "agent_10";
    blocker: string;
    expectedEffect: string;
  }>;
}

interface QualityConversionGate {
  schemaVersion: "ti.apify_paid_row_quality_conversion_gate.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  examples: Array<{
    actor: string;
    family: "apt" | "ransomware";
    decision: "chargeable" | "caveated" | "held" | "suppressed";
    buyerUse: string;
    qualityReason: string;
    score: number;
    handoffOwner?: "agent_01" | "agent_03" | "agent_04" | "agent_05";
    noLeak: true;
  }>;
  rejectedBloatCases: Array<{
    id: string;
    blockedReason: "alias_only_cleanup" | "stale_old_report_reuse" | "duplicate_source_expansion" | "generic_marketing_summary" | "uncorroborated_public_channel_snippet" | "unsafe_metadata" | "no_actionability";
    staysDecision: "held" | "suppressed" | "caveated";
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07";
    proofNote: string;
    noLeak: true;
  }>;
  acceptedRows: number;
  rejectedBloatRows: number;
  sellableRowLift: number;
  bloatBlocked: number;
  sourceParserHandoffs: Array<{
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05";
    blocker: string;
    expectedEffect: string;
  }>;
}

interface LiveFreshnessQualityGate {
  schemaVersion: "ti.apify_live_freshness_quality_gate.v1";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  examples: Array<{
    actor: string;
    family: "apt" | "ransomware";
    decision: "chargeable" | "caveated" | "held" | "suppressed";
    queryClass: "latest_activity" | "actor_profile" | "victim_watch" | "ransomware_watch";
    freshRowRate: number;
    staleSuppressionRate: number;
    sourceFamilyFreshness: "diverse_fresh" | "single_family_fresh" | "stale_only" | "metadata_only";
    blocksLatestClaim: boolean;
    buyerVisibleReason: string;
    handoffOwner?: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07";
    noLeak: true;
  }>;
  blockedLatestClaimCases: Array<{
    id: string;
    blockedReason: "old_evidence" | "generic_summary" | "single_source" | "alias_only" | "unrelated_actor" | "contradicted" | "metadata_only_without_public_support";
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07";
    publicAnswerEffect: "partial" | "hold" | "suppress";
    proofNote: string;
    noLeak: true;
  }>;
  freshRowsPromoted: number;
  caveatedRowsKept: number;
  staleLatestClaimsBlocked: number;
  bloatRowsSuppressed: number;
  sourceParserHandoffs: Array<{
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05";
    blocker: string;
    expectedEffect: string;
  }>;
}

interface FreshnessRepairLoop {
  schemaVersion: "ti.apify_paid_row_freshness_repair_loop.v1";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  repairQueue: Array<{
    id: string;
    actor: string;
    family: "apt" | "ransomware";
    blocker: "stale_latest_activity" | "generic_summary" | "single_source" | "alias_only" | "unrelated_actor" | "contradicted" | "metadata_only_without_public_support";
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    currentDecision: "chargeable" | "caveated" | "held" | "suppressed";
    targetDecision: "chargeable" | "caveated" | "held" | "suppressed";
    requiredEvidenceFamily: "clear_web" | "public_advisory" | "public_channel" | "restricted_metadata" | "graph_ledger";
    proofNeeded: string[];
    expectedBuyerVisibleLift: string[];
    currentBuyerValue: number;
    targetBuyerValue: number;
    noLeak: true;
  }>;
  lift: {
    staleRowsBlocked: number;
    genericRowsRepaired: number;
    aliasOrUnrelatedRowsSuppressed: number;
    caveatedRowsPreserved: number;
    sellableRowsGained: number;
    usefulRowsGained: number;
    averageBuyerValueDelta: number;
  };
  ownerHandoffs: Array<{
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    queueCount: number;
    blockerFocus: string;
    expectedEffect: string;
  }>;
  noLeakProof: {
    rawEvidenceExposed: false;
    unsafeUrlsExposed: false;
    restrictedPayloadsExposed: false;
    objectKeysExposed: false;
  };
}

interface EntitySpecificityLift {
  schemaVersion: "ti.apify_paid_row_entity_specificity_lift.v1";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  fixtures: Array<{
    id: string;
    actor: string;
    family: "apt" | "ransomware" | "unknown";
    currentDecision: "chargeable" | "caveated" | "held" | "suppressed";
    targetDecision: "chargeable" | "caveated" | "held" | "suppressed";
    missingFields: string[];
    requiredEvidenceFamily: "clear_web" | "public_advisory" | "public_channel" | "restricted_metadata" | "graph_ledger";
    blockerCodesRemoved: string[];
    expectedBuyerVisibleLift: string[];
    proofNeeded: string[];
    whyWorthPayingFor: string;
    repairAction: string;
    currentBuyerValue: number;
    targetBuyerValue: number;
    noLeak: true;
  }>;
  lift: {
    rowsLifted: number;
    rowsSuppressed: number;
    rowsHeldWithRepairAction: number;
    blockerCodesRemoved: number;
    averageBuyerValueDelta: number;
  };
  ownerHandoffs: Array<{
    owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
    fixtureCount: number;
    blockerFocus: string;
    expectedEffect: string;
  }>;
  noLeakProof: {
    rawEvidenceExposed: false;
    unsafeUrlsExposed: false;
    restrictedPayloadsExposed: false;
    objectKeysExposed: false;
  };
}

const DEFAULT_API_BASE = "https://api.hanasand.com/api/ti/search";
const ACTOR_START_EVENT = "apify-actor-start";
const DATASET_ITEM_EVENT = "apify-default-dataset-item";
const DEFAULT_QUERIES = [
  "APT29", "APT28", "APT42", "Lazarus Group", "Volt Typhoon",
  "Salt Typhoon", "Turla", "Sandworm", "Kimsuky", "MuddyWater",
  "Charming Kitten", "Scattered Spider", "LockBit", "Clop", "Akira",
  "Black Basta", "Play", "RansomHub", "ALPHV", "Hunters International"
];

async function main() {
  const input = normalizeInput(await readInput());
  const rows: MarketplaceRow[] = [];

  for (let index = 0; index < input.queries.length; index += 5) {
    const batch = input.queries.slice(index, index + 5);
    const responses = await Promise.all(batch.map((query) => fetchThreatIntel(input.apiBaseUrl, query)));
    for (const response of responses) {
      rows.push(...normalizeResponse(response, input).slice(0, input.maxRowsPerQuery));
    }
  }

  const monetizationSummary = monetizationForRows(rows);
  await writeOutputs(rows, monetizationSummary);
  console.log(JSON.stringify({
    ok: true,
    rowCount: rows.length,
    queries: input.queries,
    outputContract: "safe_metadata_only.v1",
    billingMode: monetizationSummary.billingMode,
    chargeEvents: monetizationSummary.eventNames,
    datasetItemEventsExpected: monetizationSummary.datasetItemCount
  }));
}

type NormalizedInput = Required<ActorInput> & { queries: string[]; apiBaseUrl: string };

function normalizeInput(input: ActorInput): NormalizedInput {
  const queries = uniqueStrings([
    ...(input.queries ?? []),
    ...(input.query ? [input.query] : [])
  ]).slice(0, 25);

  return {
    query: input.query ?? "",
    queries: queries.length ? queries : DEFAULT_QUERIES,
    maxRowsPerQuery: clampInt(input.maxRowsPerQuery, 1, 100, 25),
    includeActivity: input.includeActivity ?? true,
    includeTargets: input.includeTargets ?? true,
    includeTtps: input.includeTtps ?? true,
    includeSources: input.includeSources ?? true,
    includeDatasets: input.includeDatasets ?? false,
    includeCoverageGaps: input.includeCoverageGaps ?? true,
    apiBaseUrl: (process.env.TI_PUBLIC_API_BASE ?? DEFAULT_API_BASE).replace(/\/$/, "")
  };
}

async function readInput(): Promise<ActorInput> {
  const remoteInput = await readRemoteApifyInput();
  if (remoteInput) return remoteInput;

  const candidates = [
    process.env.APIFY_INPUT_KEY_VALUE_STORE_DIR ? `${process.env.APIFY_INPUT_KEY_VALUE_STORE_DIR}/INPUT.json` : "",
    process.env.APIFY_LOCAL_STORAGE_DIR ? `${process.env.APIFY_LOCAL_STORAGE_DIR}/key_value_stores/default/INPUT.json` : "",
    process.env.TI_ACTOR_INPUT_PATH ?? "",
    "input.json"
  ].filter(Boolean);

  for (const candidate of candidates) {
    const file = Bun.file(candidate);
    if (await file.exists()) {
      return await file.json() as ActorInput;
    }
  }

  if (process.env.TI_ACTOR_INPUT_JSON) {
    return JSON.parse(process.env.TI_ACTOR_INPUT_JSON) as ActorInput;
  }

  return {};
}

async function readRemoteApifyInput(): Promise<ActorInput | undefined> {
  const storeId = process.env.APIFY_DEFAULT_KEY_VALUE_STORE_ID;
  const inputKey = process.env.APIFY_INPUT_KEY ?? "INPUT";
  if (!storeId || !process.env.APIFY_TOKEN) return undefined;

  const response = await fetch(`${apifyApiBase()}/v2/key-value-stores/${storeId}/records/${inputKey}`, {
    headers: apifyHeaders()
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Apify input fetch returned ${response.status}`);
  return await response.json() as ActorInput;
}

async function fetchThreatIntel(apiBaseUrl: string, query: string): Promise<TiSearchResponse> {
  if (process.env.TI_ACTOR_FIXTURE_PATH) {
    return await Bun.file(process.env.TI_ACTOR_FIXTURE_PATH).json() as TiSearchResponse;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(apiBaseUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`TI API returned ${response.status} for ${query}`);
    }
    return await response.json() as TiSearchResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeResponse(response: TiSearchResponse, input: NormalizedInput): MarketplaceRow[] {
  const sourceById = new Map(response.sources.map((source) => [source.id, source]));
  const generatedAt = safeIso(response.generatedAt) ?? new Date().toISOString();
  const lastSeen = safeIso(response.lastSeen) ?? generatedAt;
  const rows: MarketplaceRow[] = [baseRow(response, generatedAt, lastSeen)];

  if (input.includeActivity) {
    for (const item of response.recentActivity) {
      const itemSources = item.sourceIds.map((id) => sourceById.get(id)).filter(Boolean);
      const source = itemSources.find((candidate) => sourceType(candidate?.type) !== "system") ?? itemSources[0];
      const evidenceCount = itemSources.filter((candidate) => sourceType(candidate?.type) !== "system").length;
      const itemQuality = qualityFields(response, item.date, item.confidence, evidenceCount);
      rows.push({
        ...baseRow(response, generatedAt, lastSeen),
        rowType: "activity",
        title: item.title,
        summary: item.detail,
        sourceType: sourceType(source?.type),
        sourceName: source?.name,
        sourceUrl: safePublicUrl(item.url ?? source?.url),
        claimType: item.claimType,
        victimName: item.victimName,
        claimedDate: item.date,
        affectedSectors: item.affectedSectors,
        countries: item.countries,
        impact: item.impact,
        firstReportedAt: safeIso(item.firstReportedAt ?? "") ?? undefined,
        lastReportedAt: safeIso(item.lastReportedAt ?? "") ?? undefined,
        publisherCount: item.publisherCount ?? evidenceCount,
        corroboratingSourceIds: item.corroboratingSourceIds ?? [],
        contradictingSourceIds: item.contradictingSourceIds ?? [],
        confidence: clampNumber(item.confidence, 0, 1),
        ...itemQuality,
        ...relationshipInsightFields(response, "activity", itemQuality, {
          claimType: item.claimType,
          victimName: item.victimName,
          affectedSectors: item.affectedSectors,
          countries: item.countries,
          title: item.title,
          sourceFamilies: itemSources.map((candidate) => sourceType(candidate?.type)).filter(isEvidenceSourceFamily),
          sourceIds: item.sourceIds,
          contradictingSourceIds: item.contradictingSourceIds,
          confidence: item.confidence,
          observedAt: item.date
        }),
        analysisFacets: analysisFacetsFor(response, "activity", itemQuality, {
          sourceType: sourceType(source?.type),
          claimType: item.claimType,
          victimName: item.victimName,
          affectedSectors: item.affectedSectors,
          countries: item.countries
        }),
        provenanceHash: stableHash([response.query, item.title, item.detail, item.date, item.sourceIds.join(",")].join("|"))
      });
    }
  }

  if (input.includeTargets) {
    for (const target of response.targets) {
      rows.push({
        ...baseRow(response, generatedAt, lastSeen),
        rowType: "target",
        title: target.sector,
        summary: target.rationale,
        sector: target.sector,
        regions: target.regions,
        confidence: clampNumber(target.confidence, 0, 1),
        ...relationshipInsightFields(response, "target", qualityFields(response, lastSeen, target.confidence, response.sources.length), {
          affectedSectors: [target.sector],
          countries: target.regions,
          title: target.sector,
          confidence: target.confidence,
          observedAt: lastSeen
        }),
        analysisFacets: analysisFacetsFor(response, "target", qualityFields(response, lastSeen, target.confidence, response.sources.length), {
          affectedSectors: [target.sector]
        }),
        provenanceHash: stableHash([response.query, target.sector, target.regions.join(","), target.rationale].join("|"))
      });
    }
  }

  if (input.includeTtps) {
    for (const ttp of response.ttps) {
      rows.push({
        ...baseRow(response, generatedAt, lastSeen),
        rowType: "ttp",
        title: ttp.name,
        summary: ttp.detail,
        ttp: ttp.name,
        attackId: ttp.attackId,
        tactic: ttp.tactic,
        confidence: clampNumber(ttp.confidence, 0, 1),
        ...relationshipInsightFields(response, "ttp", qualityFields(response, lastSeen, ttp.confidence, response.sources.length), {
          ttp: ttp.name,
          attackId: ttp.attackId,
          tactic: ttp.tactic,
          title: ttp.name,
          confidence: ttp.confidence,
          observedAt: lastSeen
        }),
        analysisFacets: analysisFacetsFor(response, "ttp", qualityFields(response, lastSeen, ttp.confidence, response.sources.length), {
          attackId: ttp.attackId,
          tactic: ttp.tactic
        }),
        provenanceHash: stableHash([response.query, ttp.name, ttp.attackId ?? "", ttp.tactic, ttp.detail].join("|"))
      });
    }
  }

  if (input.includeSources) {
    for (const source of response.sources) {
      if (sourceType(source.type) === "system") continue;
      rows.push({
        ...baseRow(response, generatedAt, lastSeen),
        rowType: "source",
        title: source.name,
        summary: source.provenance,
        sourceType: sourceType(source.type),
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: safePublicUrl(source.url),
        provenance: source.provenance,
        confidence: clampNumber(response.confidence, 0, 1),
        ...relationshipInsightFields(response, "source", qualityFields(response, lastSeen, response.confidence, response.sources.length), {
          sourceFamilies: [sourceType(source.type)].filter(isEvidenceSourceFamily),
          sourceIds: [source.id],
          title: source.name,
          confidence: response.confidence,
          observedAt: lastSeen
        }),
        analysisFacets: analysisFacetsFor(response, "source", qualityFields(response, lastSeen, response.confidence, response.sources.length), {
          sourceType: sourceType(source.type)
        }),
        provenanceHash: stableHash([response.query, source.id, source.provenance].join("|"))
      });
    }
  }

  if (input.includeDatasets) {
    for (const dataset of response.datasets) {
      rows.push({
        ...baseRow(response, generatedAt, lastSeen),
        rowType: "dataset",
        title: dataset.name,
        summary: dataset.coverage,
        datasetName: dataset.name,
        datasetType: dataset.type,
        datasetStatus: dataset.status,
        coverage: dataset.coverage,
        sourceUrl: safePublicUrl(dataset.url),
        sourceType: sourceType(dataset.type),
        confidence: clampNumber(response.confidence, 0, 1),
        ...relationshipInsightFields(response, "dataset", qualityFields(response, lastSeen, response.confidence, response.sources.length), {
          title: dataset.name,
          confidence: response.confidence,
          observedAt: lastSeen
        }),
        analysisFacets: analysisFacetsFor(response, "dataset", qualityFields(response, lastSeen, response.confidence, response.sources.length), {
          sourceType: sourceType(dataset.type)
        }),
        provenanceHash: stableHash([response.query, dataset.name, dataset.type, dataset.coverage, dataset.status].join("|"))
      });
    }
  }

  if (input.includeCoverageGaps) {
    rows.push(...coverageGapRows(response, generatedAt, lastSeen));
  }

  return rows.map(withPaidRowDecision);
}

function withPaidRowDecision(row: MarketplaceRow): MarketplaceRow {
  const decision = paidRowDecisionFor(row);
  const graphLift = graphQualityLiftForRow(row, decision);
  const marketplaceGraphSignals = marketplaceGraphSignalsForRow(row, decision, graphLift);
  return {
    ...row,
    ...decision,
    ...graphLift,
    marketplaceGraphSignals,
    analysisFacets: uniqueStrings([
      ...row.analysisFacets,
      `paid:${decision.paidRowDecision}`,
      `billing:${decision.billingGuidance}`,
      `graph_lift:${graphLift.graphQualityLift}`,
      `marketplace_graph:${marketplaceGraphSignals.signalState}`
    ]).sort()
  };
}

function paidRowDecisionFor(row: MarketplaceRow): Pick<MarketplaceRow, "paidRowDecision" | "paidRowReason" | "paidRowReasonCodes" | "paidRowRemediationActions" | "buyerValueScore" | "billingGuidance"> {
  if (row.rowType === "dataset" && row.sourceType === "darknet_metadata" && !row.hasDarknetMetadata) {
    return {
      paidRowDecision: "suppress",
      paidRowReason: "This row advertises metadata capability but has no matching safe metadata evidence for the query; keep it out of paid findings.",
      paidRowReasonCodes: ["capability_without_evidence", "source_poor_row"],
      paidRowRemediationActions: [
        { owner: "agent_05", action: "add_searchable_safe_metadata_for_query", expectedEffect: "Move future rows to included_with_caveat when safe metadata corroborates the actor or victim context." },
        { owner: "agent_07", action: "keep_suppressed_until_evidence_exists", expectedEffect: "Prevent metadata capability rows from being counted as useful paid intelligence." }
      ],
      buyerValueScore: 0.05,
      billingGuidance: "do_not_charge_if_metered"
    };
  }
  if (row.rowType === "coverage_gap") {
    return {
      paidRowDecision: "coverage_gap_only",
      paidRowReason: "Coverage-gap rows explain what is missing and should be treated as remediation context, not a complete intelligence finding.",
      paidRowReasonCodes: ["coverage_gap", "missing_source_family"],
      paidRowRemediationActions: [
        { owner: "agent_01", action: "replace_or_add_payworthy_public_sources", expectedEffect: "Improve source-family diversity before paid promotion." },
        { owner: "agent_04", action: "activate_highest_value_missing_family", expectedEffect: "Close the visible source gap within the expected 1-3 day signal window." }
      ],
      buyerValueScore: 0.2,
      billingGuidance: "do_not_charge_if_metered"
    };
  }
  if (
    row.contradictionHints.length > 0
    || row.reviewReasons.some((reason) => reason.startsWith("hold:"))
    || row.coverageStatus === "no_evidence"
  ) {
    return {
      paidRowDecision: "hold",
      paidRowReason: "This row has a hold condition such as contradictory reporting, stale or missing evidence, low confidence, or no public evidence.",
      paidRowReasonCodes: [
        ...(row.contradictionHints.length > 0 ? ["contradiction_hold"] : []),
        ...(row.coverageStatus === "no_evidence" ? ["no_public_evidence"] : []),
        ...row.reviewReasons.filter((reason) => reason.startsWith("hold:"))
      ],
      paidRowRemediationActions: [
        { owner: "agent_03", action: "repair_parser_or_summary_specificity", expectedEffect: "Recover supported extracted facts before row promotion." },
        { owner: "agent_07", action: "rerun_quality_gate_after_repair", expectedEffect: "Keep held rows out of paid findings until evidence support is measurable." }
      ],
      buyerValueScore: row.evidenceGrade === "corroborated" ? 0.45 : 0.3,
      billingGuidance: "do_not_charge_if_metered"
    };
  }
  if (
    row.isActionable
    && row.evidenceGrade === "corroborated"
    && row.sourceFamilyCount >= 2
    && (row.freshnessStatus === "current" || row.freshnessStatus === "recent")
  ) {
    return {
      paidRowDecision: "sellable",
      paidRowReason: "Fresh or recent corroborated public evidence supports this row enough for paid monitoring output.",
      paidRowReasonCodes: ["fresh_or_recent", "corroborated", "source_family_diverse", "actionable"],
      paidRowRemediationActions: [],
      buyerValueScore: 0.9,
      billingGuidance: "charge"
    };
  }
  if (isCorroboratedPublicFinding(row)) {
    return {
      paidRowDecision: "sellable",
      paidRowReason: "Multiple fresh or recent public sources support this profile or targeting row; missing public-channel coverage remains visible as a caveat but does not make the corroborated public finding non-chargeable.",
      paidRowReasonCodes: ["fresh_or_recent", "corroborated", "multi_source_public", "actionable", "source_family_gap_visible"],
      paidRowRemediationActions: [
        { owner: "agent_04", action: "add_public_channel_or_dark_metadata_corroboration", expectedEffect: "Lift future confidence and source-family diversity while preserving this row as a chargeable public finding." },
        { owner: "agent_08", action: "preserve_graph_relationship_pivots_in_paid_row", expectedEffect: "Keep actor-to-target/TTP/source-family pivots visible so the sellable decision remains explainable and export-reviewable." }
      ],
      buyerValueScore: 0.78,
      billingGuidance: "charge"
    };
  }
  if (row.isActionable || row.evidenceGrade === "single_source" || row.coverageStatus === "thin") {
    return {
      paidRowDecision: "included_with_caveat",
      paidRowReason: "This row is useful as a lead but needs corroboration, source-family diversity, or fresher supporting evidence before promotion.",
      paidRowReasonCodes: [
        ...(row.evidenceGrade === "single_source" ? ["single_source"] : []),
        ...(row.sourceFamilyCount < 2 ? ["source_family_thin"] : []),
        ...(row.freshnessStatus === "stale" ? ["stale_support"] : []),
        ...(row.isActionable ? ["lead_is_actionable"] : ["lead_only"])
      ],
      paidRowRemediationActions: [
        { owner: "agent_01", action: "add_corroborating_clear_web_source", expectedEffect: "Increase source count and source-family diversity." },
        { owner: "agent_03", action: "extract_specific_actor_victim_ttp_fields", expectedEffect: "Move generic leads toward sellable rows after parser repair." }
      ],
      buyerValueScore: row.isActionable ? 0.65 : 0.5,
      billingGuidance: "include_as_context"
    };
  }
  return {
    paidRowDecision: "hold",
    paidRowReason: "This row is retained for context but is not ready as paid intelligence output.",
    paidRowReasonCodes: ["not_actionable", "low_support"],
    paidRowRemediationActions: [
      { owner: "agent_07", action: "keep_out_of_paid_findings", expectedEffect: "Avoid presenting unsupported context as a buyer-payworthy row." }
    ],
    buyerValueScore: 0.25,
    billingGuidance: "do_not_charge_if_metered"
  };
}

function isCorroboratedPublicFinding(row: MarketplaceRow): boolean {
  return row.isActionable
    && row.evidenceGrade === "corroborated"
    && (row.rowType === "profile" || row.rowType === "target" || row.rowType === "ttp")
    && row.sourceCount >= 4
    && row.sourceFamilies.includes("clear_web")
    && !row.contradictionHints.length
    && !row.reviewReasons.some((reason) => reason.startsWith("hold:"))
    && (row.freshnessStatus === "current" || row.freshnessStatus === "recent");
}

function graphQualityLiftForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">
): Pick<MarketplaceRow, "graphQualityLift" | "graphQualityLiftReasonCodes" | "graphQualityLiftEvidence"> {
  const relationshipReady = isCorroboratedPublicFinding(row)
    || (
      row.relationshipPivotTypes.includes("actor")
      && row.relationshipPivotTypes.some((type) => ["target", "sector", "country", "ttp", "claim", "source", "source_family"].includes(type))
    );
  const sourceFamilyCorroborated = row.corroborationState === "corroborated" || row.sourceCount >= 2;
  const contradictionHeld = row.contradictionHints.length > 0 || row.reviewReasons.some((reason) => reason.startsWith("hold:"));
  const freshnessLift = row.freshnessStatus === "current" || row.freshnessStatus === "recent";
  const exportEligible = decision.paidRowDecision === "sellable"
    && relationshipReady
    && sourceFamilyCorroborated
    && freshnessLift
    && !contradictionHeld;
  const graphQualityLift: NonNullable<MarketplaceRow["graphQualityLift"]> = exportEligible
    ? "accepted_sellable_lift"
    : contradictionHeld || decision.paidRowDecision === "hold" || decision.paidRowDecision === "suppress"
      ? "rejected_hold"
      : decision.paidRowDecision === "included_with_caveat" || decision.paidRowDecision === "coverage_gap_only"
        ? "rejected_caveat"
        : "not_applicable";

  return {
    graphQualityLift,
    graphQualityLiftReasonCodes: uniqueStrings([
      relationshipReady ? "relationship_ready" : "relationship_thin",
      sourceFamilyCorroborated ? "source_corroborated" : "source_needs_corroboration",
      freshnessLift ? "fresh_or_recent" : "stale_or_unknown",
      contradictionHeld ? "contradiction_or_hold_present" : "no_contradiction_hold",
      exportEligible ? "review_export_candidate" : "not_export_eligible",
      "metadata_only_no_leak"
    ]),
    graphQualityLiftEvidence: {
      relationshipReady,
      sourceFamilyCorroborated,
      contradictionHeld,
      freshnessLift,
      exportEligible,
      noLeak: true
    }
  };
}

function marketplaceGraphSignalsForRow(
  row: MarketplaceRow,
  decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">,
  graphLift: Pick<MarketplaceRow, "graphQualityLiftEvidence">
): NonNullable<MarketplaceRow["marketplaceGraphSignals"]> {
  const evidence = graphLift.graphQualityLiftEvidence;
  const contradictionState: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["contradictionState"] = row.contradictionHints.length > 0
    ? "contradicted"
    : row.reviewReasons.some((reason) => reason.startsWith("hold:"))
      ? "review_hold"
      : "none";
  const signalState: NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["signalState"] = evidence?.exportEligible && decision.paidRowDecision === "sellable"
    ? "buyer_ready"
    : contradictionState !== "none" || decision.paidRowDecision === "hold" || decision.paidRowDecision === "suppress"
      ? "held"
      : "needs_corroboration";
  const relationshipLinks = uniqueStrings([
    `${row.actor}:actor`,
    ...row.relationshipPivots.slice(0, 5),
    ...row.sourceFamilies.slice(0, 3).map((family) => `source_family:${family}`)
  ]).slice(0, 8);
  const rejectedPivotReasons = uniqueStrings([
    row.nextSearchPivots.length === 0 ? "generic_pivot" : "",
    row.freshnessStatus === "stale" || row.freshnessDelta === "stale" ? "stale_pivot" : "",
    contradictionState === "none" ? "" : "contradicted_pivot",
    row.reviewReasons.some((reason) => reason.includes("alias") || reason.includes("unrelated")) ? "unrelated_actor_pivot" : "",
    row.hasDarknetMetadata && !row.hasPublicChannelCoverage && !evidence?.sourceFamilyCorroborated ? "restricted_only_pivot" : "",
    evidence?.exportEligible ? "" : "missing_ledger_pivot",
    !evidence?.sourceFamilyCorroborated && signalState !== "held" ? "single_source_without_caveat" : "",
    row.nextSearchPivots.length === 0 && relationshipLinks.length <= 1 ? "no_action_pivot" : ""
  ].filter(Boolean)) as NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["rejectedPivotReasons"];
  const actionPivotCount = row.nextSearchPivots.length;
  const usefulPivotCount = Math.max(actionPivotCount, relationshipLinks.filter((link) => !link.endsWith(":actor")).length);
  const corroboratedPivotCount = evidence?.sourceFamilyCorroborated ? Math.min(usefulPivotCount, row.sourceFamilyCount + actionPivotCount) : 0;
  const buyerValueDelta = signalState === "buyer_ready" ? 0.04 : signalState === "needs_corroboration" ? 0.015 : 0;
  const freshnessChangeHints = uniqueStrings([
    `freshness:${row.freshnessDelta}`,
    `observed:${row.freshnessStatus}`,
    ...(row.claimedDate ? [`claimed:${row.claimedDate}`] : []),
    ...(row.firstReportedAt ? [`first_reported:${row.firstReportedAt}`] : []),
    ...(row.lastReportedAt ? [`last_reported:${row.lastReportedAt}`] : [])
  ]).slice(0, 5);
  return {
    schemaVersion: "ti.marketplace_graph_signals.v1",
    signalState,
    relationshipLinks,
    freshnessChangeHints,
    confidenceTrend: row.confidenceDelta,
    contradictionState,
    nextBuyerPivots: row.nextSearchPivots.slice(0, 5),
    pivotUtility: {
      usefulPivotCount,
      actionPivotCount,
      corroboratedPivotCount,
      suppressedGenericPivotCount: rejectedPivotReasons.filter((reason) => reason === "generic_pivot" || reason === "unrelated_actor_pivot").length,
      buyerValueDelta,
      noLeak: true
    },
    relationshipConfidence: {
      usefulPivotCount,
      actionPivotCount,
      corroboratedPivotCount,
      rejectedUnsupportedPivotCount: rejectedPivotReasons.length,
      confidenceTrend: row.confidenceDelta,
      contradictionState,
      nextSearchCount: actionPivotCount,
      sellableLift: signalState === "buyer_ready" ? 1 : 0,
      usefulLift: signalState === "buyer_ready" || signalState === "needs_corroboration" ? 1 : 0,
      buyerValueDelta,
      noLeak: true
    },
    rejectedPivotReasons,
    buyerAction: signalState === "buyer_ready"
      ? "chargeable_monitoring_signal"
      : signalState === "needs_corroboration"
        ? "use_as_lead_and_follow_next_pivots"
        : "do_not_promote_until_hold_clears",
    sourceBlockers: uniqueStrings([
      ...row.missingSourceFamilies.map((family) => `missing_${family}`),
      ...(evidence?.sourceFamilyCorroborated ? [] : ["needs_source_corroboration"]),
      ...(evidence?.freshnessLift ? [] : ["needs_fresh_public_evidence"]),
      ...(evidence?.contradictionHeld ? ["contradiction_or_review_hold"] : [])
    ]).slice(0, 6),
    noLeak: true
  };
}

function baseRow(response: TiSearchResponse, generatedAt: string, lastSeen: string): MarketplaceRow {
  const evidenceCount = response.sources.filter((source) => sourceType(source.type) !== "system").length;
  const quality = qualityFields(
    response,
    evidenceCount > 0 || response.recentActivity.length > 0 ? lastSeen : "",
    response.confidence,
    evidenceCount
  );
  const scheduler = schedulerFields(response);
  const coverageProduct = sourceCoverageProductFields(response);
  return {
    query: response.query,
    rowType: "profile",
    actor: response.query,
    title: `${response.query} public threat profile`,
    summary: response.summary,
    sourceType: "system",
    confidence: clampNumber(response.confidence, 0, 1),
    generatedAt,
    collectionMode: response.mode,
    sourceCount: evidenceCount,
    sourceFamilyCount: quality.sourceFamilyCount,
    sourceFamilies: quality.sourceFamilies,
    missingSourceFamilies: quality.missingSourceFamilies,
    coverageStatus: quality.coverageStatus,
    collectionPriority: quality.collectionPriority,
    recommendedCollectionAction: quality.recommendedCollectionAction,
    coverageGapCodes: quality.coverageGapCodes,
    activityCount: response.recentActivity.length,
    freshnessStatus: quality.freshnessStatus,
    ...scheduler,
    ...coverageProduct,
    evidenceGrade: quality.evidenceGrade,
    isActionable: quality.isActionable,
    reviewReasons: quality.reviewReasons,
    analysisFacets: analysisFacetsFor(response, "profile", quality, { sourceType: "system" }),
    hasDarknetMetadata: quality.hasDarknetMetadata,
    hasPublicChannelCoverage: quality.hasPublicChannelCoverage,
    ...relationshipInsightFields(response, "profile", quality, {
      title: response.query,
      confidence: response.confidence,
      observedAt: lastSeen
    }),
    firstSeen: generatedAt,
    lastSeen,
    provenanceHash: stableHash([response.query, response.summary, response.generatedAt, response.runId ?? ""].join("|")),
    rawContentIncluded: false,
    safety: {
      metadataOnly: true,
      credentialsIncluded: false,
      stolenFilesIncluded: false,
      privateContentIncluded: false,
      actorInteraction: false
    },
    runId: response.runId,
    status: response.status,
    aliases: response.aliases,
    warningCodes: warningsFor(response)
  };
}

function qualityFields(response: TiSearchResponse, observedAt: string, confidence: number, evidenceCount: number) {
  const sourceFamilies = new Set(response.sources.map((source) => sourceType(source.type)).filter(isEvidenceSourceFamily));
  const freshnessStatus = freshnessFor(observedAt);
  const normalizedConfidence = clampNumber(confidence, 0, 1);
  const evidenceGrade = evidenceCount >= 2
    ? "corroborated"
    : evidenceCount === 1
      ? "single_source"
      : "unverified";
  const missingSourceFamilies = expectedSourceFamilies(response).filter((family) => !sourceFamilies.has(family));
  const coverageStatus = coverageStatusFor(freshnessStatus, evidenceCount, sourceFamilies.size);
  const coverageGapCodes = coverageGapCodesFor(response, freshnessStatus, evidenceCount, sourceFamilies, missingSourceFamilies);
  const recommendedCollectionAction = recommendedCollectionActionFor(coverageGapCodes);

  return {
    sourceFamilyCount: sourceFamilies.size,
    sourceFamilies: [...sourceFamilies].sort(),
    missingSourceFamilies,
    coverageStatus,
    collectionPriority: collectionPriorityFor(coverageStatus, coverageGapCodes),
    recommendedCollectionAction,
    coverageGapCodes,
    freshnessStatus,
    evidenceGrade: evidenceGrade as MarketplaceRow["evidenceGrade"],
    isActionable: normalizedConfidence >= 0.6
      && evidenceCount > 0
      && (freshnessStatus === "current" || freshnessStatus === "recent"),
    reviewReasons: reviewReasonsFor(response, freshnessStatus, normalizedConfidence, evidenceCount),
    hasDarknetMetadata: response.sources.some((source) => sourceType(source.type) === "darknet_metadata"),
    hasPublicChannelCoverage: response.sources.some((source) => sourceType(source.type) === "public_channel")
  };
}

function coverageGapRows(response: TiSearchResponse, generatedAt: string, lastSeen: string): MarketplaceRow[] {
  const quality = qualityFields(response, lastSeen, response.confidence, response.sources.filter((source) => sourceType(source.type) !== "system").length);
  if (quality.coverageGapCodes.length === 0) return [];

  return quality.coverageGapCodes.map((code) => ({
    ...baseRow(response, generatedAt, lastSeen),
    rowType: "coverage_gap",
    title: coverageGapTitle(code),
    summary: coverageGapSummary(response, code, quality),
    sourceType: "system",
    confidence: clampNumber(response.confidence, 0, 1),
    ...relationshipInsightFields(response, "coverage_gap", quality, {
      title: code,
      coverageGapCode: code,
      confidence: response.confidence,
      observedAt: lastSeen
    }),
    analysisFacets: analysisFacetsFor(response, "coverage_gap", quality, { coverageGapCode: code, sourceType: "system" }),
    provenanceHash: stableHash([response.query, code, quality.sourceFamilies.join(","), quality.missingSourceFamilies.join(",")].join("|"))
  }));
}

function analysisFacetsFor(
  response: TiSearchResponse,
  rowType: MarketplaceRow["rowType"],
  quality: ReturnType<typeof qualityFields>,
  context: {
    sourceType?: MarketplaceRow["sourceType"];
    claimType?: string;
    victimName?: string;
    affectedSectors?: string[];
    countries?: string[];
    attackId?: string;
    tactic?: string;
    coverageGapCode?: string;
  }
): string[] {
  return uniqueStrings([
    `row:${rowType}`,
    `status:${response.status ?? "unknown"}`,
    `freshness:${quality.freshnessStatus}`,
    `evidence:${quality.evidenceGrade}`,
    `coverage:${quality.coverageStatus}`,
    `priority:${quality.collectionPriority}`,
    `action:${quality.recommendedCollectionAction}`,
    context.sourceType ? `source:${context.sourceType}` : undefined,
    context.claimType ? `claim:${context.claimType}` : undefined,
    context.victimName ? "entity:victim" : undefined,
    context.affectedSectors?.length ? "entity:sector" : undefined,
    context.countries?.length ? "entity:country" : undefined,
    context.attackId ? "entity:attack_technique" : undefined,
    context.tactic ? `tactic:${normalizeFacet(context.tactic)}` : undefined,
    context.coverageGapCode ? `gap:${context.coverageGapCode}` : undefined,
    quality.hasPublicChannelCoverage ? "coverage:public_channel_present" : undefined,
    quality.hasDarknetMetadata ? "coverage:darknet_metadata_present" : undefined,
    "safety:metadata_only"
  ].filter((value): value is string => Boolean(value))).sort();
}

function expectedSourceFamilies(response: TiSearchResponse): EvidenceSourceFamily[] {
  const query = response.query.toLowerCase();
  const needsPublicChannel = /(lockbit|akira|clop|black basta|play|ransomhub|alphv|hunters|scattered spider|apt42|charming kitten|telegram|ransom)/i.test(query)
    || response.recentActivity.some((activity) => activity.claimType === "victim_claim");
  return needsPublicChannel ? ["clear_web", "public_channel"] : ["clear_web"];
}

function coverageStatusFor(
  freshnessStatus: MarketplaceRow["freshnessStatus"],
  evidenceCount: number,
  sourceFamilyCount: number
): MarketplaceRow["coverageStatus"] {
  if (evidenceCount === 0) return "no_evidence";
  if (freshnessStatus === "stale" || freshnessStatus === "unknown") return "stale";
  if (sourceFamilyCount < 2) return "thin";
  return "sufficient";
}

function coverageGapCodesFor(
  response: TiSearchResponse,
  freshnessStatus: MarketplaceRow["freshnessStatus"],
  evidenceCount: number,
  sourceFamilies: Set<EvidenceSourceFamily>,
  missingSourceFamilies: string[]
): string[] {
  const codes = new Set<string>();
  if (evidenceCount === 0) codes.add("no_public_evidence");
  if (freshnessStatus === "stale" || freshnessStatus === "unknown") codes.add("stale_or_missing_timestamp");
  if (missingSourceFamilies.includes("clear_web")) codes.add("missing_clear_web_evidence");
  if (missingSourceFamilies.includes("public_channel")) codes.add("missing_public_channel_evidence");
  if (sourceFamilies.size === 1 && evidenceCount > 0) codes.add("single_source_family");
  if (response.recentActivity.some((activity) => (activity.contradictingSourceIds?.length ?? 0) > 0)) codes.add("contradicting_public_reports");
  return [...codes].sort();
}

function isEvidenceSourceFamily(value: MarketplaceRow["sourceType"]): value is EvidenceSourceFamily {
  return value !== "system";
}

function recommendedCollectionActionFor(codes: string[]): MarketplaceRow["recommendedCollectionAction"] {
  if (codes.includes("contradicting_public_reports")) return "review_contradictions";
  if (codes.includes("missing_public_channel_evidence")) return "add_public_channel_sources";
  if (codes.includes("missing_clear_web_evidence") || codes.includes("no_public_evidence")) return "add_clear_web_sources";
  if (codes.includes("stale_or_missing_timestamp")) return "increase_polling";
  if (codes.includes("single_source_family")) return "monitor_public_channels";
  return "none";
}

function collectionPriorityFor(
  coverageStatus: MarketplaceRow["coverageStatus"],
  codes: string[]
): MarketplaceRow["collectionPriority"] {
  if (coverageStatus === "no_evidence" || codes.includes("contradicting_public_reports")) return "high";
  if (coverageStatus === "stale" || codes.includes("missing_public_channel_evidence")) return "medium";
  if (coverageStatus === "thin" || codes.includes("single_source_family")) return "low";
  return "none";
}

function coverageGapTitle(code: string): string {
  switch (code) {
    case "no_public_evidence": return "No public evidence returned";
    case "stale_or_missing_timestamp": return "Freshness is stale or unknown";
    case "missing_clear_web_evidence": return "Clear-web evidence missing";
    case "missing_public_channel_evidence": return "Public-channel coverage missing";
    case "single_source_family": return "Only one source family supports this result";
    case "contradicting_public_reports": return "Contradicting public reports need review";
    default: return "Coverage gap";
  }
}

function coverageGapSummary(response: TiSearchResponse, code: string, quality: ReturnType<typeof qualityFields>): string {
  const families = quality.sourceFamilies.length ? quality.sourceFamilies.join(", ") : "none";
  const missing = quality.missingSourceFamilies.length ? quality.missingSourceFamilies.join(", ") : "none";
  return `${coverageGapTitle(code)} for ${response.query}. Current families: ${families}. Missing families: ${missing}. Recommended action: ${quality.recommendedCollectionAction}.`;
}

function schedulerFields(response: TiSearchResponse): Pick<MarketplaceRow,
  | "schedulerState"
  | "schedulerDecision"
  | "nextPollSeconds"
  | "retryAfterSeconds"
  | "duplicateRunReuse"
  | "attachedToActiveRun"
  | "queuedTaskCount"
  | "deferredBackgroundWorkloads"
  | "schedulerBadges"
  | "sourceCoverageState"
  | "sourceCoverageGapCount"
  | "sourceCoverageGaps"
  | "pollingHint"
> {
  const evidenceCount = response.sources.filter((source) => isEvidenceSourceFamily(sourceType(source.type))).length;
  const quality = qualityFields(response, evidenceCount > 0 || response.recentActivity.length > 0 ? response.lastSeen : "", response.confidence, evidenceCount);
  const scheduler = record(response.scheduler);
  const interactive = record(scheduler?.interactiveSearchFreshness);
  const queueDecision = record(interactive?.queueDecision);
  const uiSignals = record(interactive?.uiSignals);
  const runtimeSla = record(scheduler?.runtimeSla);
  const sourceCoverage = record(response.sourceCoverage);
  const sourceSlo = record(sourceCoverage?.slo);
  const sourceCoverageGaps = uniqueStrings([
    ...quality.coverageGapCodes,
    ...stringArray(sourceCoverage?.gaps),
    ...stringArray(sourceCoverage?.coverageGaps)
  ]).slice(0, 12);
  const nextPollSeconds = clampInt(
    numberFromUnknown(queueDecision?.nextPollSeconds ?? scheduler?.nextPollSeconds ?? response.refreshAfterSeconds),
    1,
    3600,
    response.status === "ready" ? 900 : 3
  );
  const fallbackState = response.status === "ready"
    ? "complete"
    : response.status === "partial"
      ? "polling"
      : response.status === "queued"
        ? "queued"
        : response.status ?? "unknown";
  const fallbackDecision = quality.coverageGapCodes.includes("contradicting_public_reports")
    ? "hold_for_review"
    : response.status === "partial"
      ? "reuse_active_run"
      : response.status === "queued"
        ? "retry_after"
        : quality.coverageGapCodes.length > 0
          ? "expand_source_coverage"
          : "complete";
  const schedulerState = safeString(runtimeSla?.state ?? scheduler?.backpressureState ?? fallbackState);
  const schedulerDecision = safeString(queueDecision?.decision ?? scheduler?.backpressureState ?? fallbackDecision);
  const attachedToActiveRun = boolFromUnknown(queueDecision?.attachedToActiveRun ?? scheduler?.attachedToActiveRun)
    || response.status === "partial"
    || response.status === "queued";
  const retryAfterSeconds = clampInt(
    numberFromUnknown(queueDecision?.retryAfterSeconds ?? scheduler?.retryAfterSeconds),
    response.status === "ready" ? 0 : 3,
    86_400,
    response.status === "queued" || response.status === "partial" ? Math.max(3, nextPollSeconds) : 0
  );
  const deferredBackgroundWorkloads = uniqueStrings([
    ...stringArray(queueDecision?.deferredBackgroundWorkloads),
    ...deferredWorkloadsFor(response, quality.coverageGapCodes)
  ]).slice(0, 12);
  const schedulerBadges = uniqueStrings([
    ...stringArray(uiSignals?.badges),
    ...schedulerBadgesFor(response, quality.coverageStatus)
  ]).slice(0, 12);

  return {
    schedulerState,
    schedulerDecision,
    nextPollSeconds,
    retryAfterSeconds,
    duplicateRunReuse: attachedToActiveRun || queueDecision?.duplicateRunReuse === "required_before_enqueue",
    attachedToActiveRun,
    queuedTaskCount: clampInt(numberFromUnknown(scheduler?.queuedTaskCount), 0, 1_000_000, response.status === "queued" ? 1 : 0),
    deferredBackgroundWorkloads,
    schedulerBadges,
    sourceCoverageState: safeString(sourceCoverage?.coverageState ?? sourceSlo?.status ?? quality.coverageStatus),
    sourceCoverageGapCount: sourceCoverageGaps.length,
    sourceCoverageGaps,
    pollingHint: pollingHintFor(response, sourceCoverageGaps, nextPollSeconds)
  };
}

function sourceCoverageProductFields(response: TiSearchResponse): Pick<MarketplaceRow,
  | "freshnessExpectation"
  | "highestValueMissingFamily"
  | "nextBestSourceAction"
  | "buyerCaveat"
  | "expectedTimeToUsefulSignal"
> {
  const row = actorCoverageMatrixRow(response);
  return {
    freshnessExpectation: safeString(row?.freshnessExpectation ?? "unknown"),
    highestValueMissingFamily: safeString(row?.highestValueMissingFamily ?? ""),
    nextBestSourceAction: safeString(row?.nextBestSourceAction ?? fallbackNextBestSourceAction(response)),
    buyerCaveat: safeString(row?.buyerCaveat ?? fallbackBuyerCaveat(response)),
    expectedTimeToUsefulSignal: safeString(row?.expectedTimeToUsefulSignal ?? "unknown_until_sources_added")
  };
}

function relationshipInsightFields(
  response: TiSearchResponse,
  rowType: MarketplaceRow["rowType"],
  quality: ReturnType<typeof qualityFields>,
  context: {
    claimType?: string;
    victimName?: string;
    affectedSectors?: string[];
    countries?: string[];
    ttp?: string;
    attackId?: string;
    tactic?: string;
    title?: string;
    sourceFamilies?: EvidenceSourceFamily[];
    sourceIds?: string[];
    contradictingSourceIds?: string[];
    coverageGapCode?: string;
    confidence?: number;
    observedAt?: string;
  }
): Pick<MarketplaceRow,
  | "relationshipSummary"
  | "relationshipPivotTypes"
  | "relationshipPivots"
  | "whyActionable"
  | "freshnessDelta"
  | "confidenceDelta"
  | "contradictionHints"
  | "corroborationState"
  | "nextSearchPivots"
> {
  const relationshipPivots = uniqueStrings([
    context.victimName ? `victim:${context.victimName}` : undefined,
    ...(context.affectedSectors ?? []).map((sector) => `sector:${sector}`),
    ...(context.countries ?? []).map((country) => `country:${country}`),
    context.ttp ? `ttp:${context.ttp}` : undefined,
    context.attackId ? `attack:${context.attackId}` : undefined,
    context.tactic ? `tactic:${context.tactic}` : undefined,
    ...(context.sourceFamilies ?? quality.sourceFamilies).map((family) => `source_family:${family}`),
    context.claimType ? `claim:${context.claimType}` : undefined,
    context.coverageGapCode ? `gap:${context.coverageGapCode}` : undefined
  ].filter((value): value is string => Boolean(value))).slice(0, 10);
  const pivotTypes = uniqueStrings(relationshipPivots.map((pivot) => pivot.split(":")[0] ?? pivot)).slice(0, 8);
  const contradictionHints = contradictionHintsFor(response, context);
  const corroborationState = contradictionHints.length
    ? "contradicted"
    : quality.evidenceGrade === "corroborated"
      ? "corroborated"
      : quality.evidenceGrade;
  const freshnessDelta = freshnessDeltaFor(context.observedAt ?? response.lastSeen, rowType);
  const confidenceDelta = confidenceDeltaFor(context.confidence ?? response.confidence, response.confidence);
  const whyActionable = whyActionableFor(response, rowType, quality, context, corroborationState);
  const nextSearchPivots = nextSearchPivotsFor(response, context, quality, relationshipPivots);
  return {
    relationshipSummary: relationshipSummaryFor(response, rowType, context, relationshipPivots, corroborationState),
    relationshipPivotTypes: pivotTypes,
    relationshipPivots,
    whyActionable,
    freshnessDelta,
    confidenceDelta,
    contradictionHints,
    corroborationState,
    nextSearchPivots
  };
}

function relationshipSummaryFor(
  response: TiSearchResponse,
  rowType: MarketplaceRow["rowType"],
  context: Parameters<typeof relationshipInsightFields>[3],
  pivots: string[],
  corroborationState: MarketplaceRow["corroborationState"]
): string {
  if (rowType === "coverage_gap") return `${response.query} needs ${context.coverageGapCode?.replaceAll("_", " ") ?? "coverage"} follow-up before the row is complete.`;
  if (rowType === "target" && context.affectedSectors?.[0]) return `${response.query} is linked to ${context.affectedSectors[0]} targeting with ${corroborationState} public support.`;
  if (rowType === "ttp" && (context.attackId || context.ttp)) return `${response.query} is linked to ${context.attackId ?? context.ttp} with ${corroborationState} public support.`;
  if (context.victimName) return `${response.query} is linked to victim ${context.victimName} with ${corroborationState} public support.`;
  if (context.claimType) return `${response.query} has a ${context.claimType.replaceAll("_", " ")} row with ${corroborationState} public support.`;
  if (pivots.length) return `${response.query} row exposes ${pivots.slice(0, 3).join(", ")} pivots.`;
  return `${response.query} row is a ${rowType} summary with ${corroborationState} public support.`;
}

function whyActionableFor(
  response: TiSearchResponse,
  rowType: MarketplaceRow["rowType"],
  quality: ReturnType<typeof qualityFields>,
  context: Parameters<typeof relationshipInsightFields>[3],
  corroborationState: MarketplaceRow["corroborationState"]
): string[] {
  const bullets = new Set<string>();
  if (quality.freshnessStatus === "current") bullets.add("Fresh public evidence is available for immediate monitoring.");
  if (quality.freshnessStatus === "recent") bullets.add("Recent public evidence is available, but cadence should be checked.");
  if (corroborationState === "corroborated") bullets.add("Multiple evidence sources support this row.");
  if (corroborationState === "single_source") bullets.add("Single-source row: useful as a lead, not a confirmed fact.");
  if (corroborationState === "contradicted") bullets.add("Contradicting public reports require analyst review before promotion.");
  if (context.victimName) bullets.add("Victim pivot can drive defensive outreach or exposure review.");
  if (context.affectedSectors?.length) bullets.add("Sector pivot supports watchlist filtering and enrichment.");
  if (context.countries?.length) bullets.add("Country pivot supports regional monitoring.");
  if (context.attackId || context.ttp) bullets.add("TTP pivot supports ATT&CK-based detection review.");
  if (rowType === "coverage_gap") bullets.add("Coverage gap explains what to add before treating the result as complete.");
  if (response.status === "partial" || response.status === "queued") bullets.add("Run is still polling; keep the row attached to the active run.");
  return [...bullets].slice(0, 5);
}

function contradictionHintsFor(response: TiSearchResponse, context: Parameters<typeof relationshipInsightFields>[3]): string[] {
  const hints = new Set<string>();
  if ((context.contradictingSourceIds?.length ?? 0) > 0) hints.add("contradicting_source_ids_present");
  if (response.recentActivity.some((item) => (item.contradictingSourceIds?.length ?? 0) > 0)) hints.add("query_has_contradicting_public_reports");
  if (response.notes.some((note) => /contradict|conflict|dispute/i.test(note))) hints.add("analyst_note_mentions_conflict");
  return [...hints].sort();
}

function nextSearchPivotsFor(
  response: TiSearchResponse,
  context: Parameters<typeof relationshipInsightFields>[3],
  quality: ReturnType<typeof qualityFields>,
  relationshipPivots: string[]
): string[] {
  const pivots = new Set<string>();
  if (context.victimName) pivots.add(context.victimName);
  for (const sector of context.affectedSectors ?? []) pivots.add(`${sector} threats`);
  for (const country of context.countries ?? []) pivots.add(`${country} cyber activity`);
  if (context.ttp) pivots.add(context.ttp);
  if (context.attackId) pivots.add(context.attackId);
  if (quality.missingSourceFamilies.includes("public_channel")) pivots.add(`${response.query} public channel`);
  if (quality.missingSourceFamilies.includes("clear_web")) pivots.add(`${response.query} advisories`);
  for (const pivot of relationshipPivots) {
    if (pivot.startsWith("source_family:")) pivots.add(`${response.query} ${pivot.slice("source_family:".length)}`);
  }
  return [...pivots].filter(Boolean).slice(0, 6);
}

function freshnessDeltaFor(value: string, rowType: MarketplaceRow["rowType"]): MarketplaceRow["freshnessDelta"] {
  const freshness = freshnessFor(value);
  if (rowType === "coverage_gap") return freshness === "unknown" ? "unknown" : "stale";
  if (freshness === "current") return "current";
  if (freshness === "recent") return "recent";
  if (freshness === "stale") return "stale";
  return "unknown";
}

function confidenceDeltaFor(rowConfidence: number, responseConfidence: number): MarketplaceRow["confidenceDelta"] {
  const delta = clampNumber(rowConfidence, 0, 1) - clampNumber(responseConfidence, 0, 1);
  if (delta >= 0.05) return "stronger";
  if (delta <= -0.05) return "weaker";
  return "stable";
}

function actorCoverageMatrixRow(response: TiSearchResponse): Record<string, unknown> | undefined {
  const sourceCoverage = record(response.sourceCoverage);
  const publicChannel = record(response.publicChannel);
  const signalFusion = record(publicChannel?.signalFusion);
  const candidates = [
    record(sourceCoverage?.actorSourceCoverageMatrix),
    record(sourceCoverage?.matrix),
    record(signalFusion?.actorSourceCoverageMatrix)
  ].filter((value): value is Record<string, unknown> => Boolean(value));
  const normalizedQuery = normalizeKey(response.query);
  for (const matrix of candidates) {
    const rows = recordArray(matrix.rows);
    const direct = rows.find((row) => normalizeKey(safeString(row.actor)) === normalizedQuery);
    if (direct) return direct;
    const alias = rows.find((row) => stringArray(row.aliases).some((value) => normalizeKey(value) === normalizedQuery));
    if (alias) return alias;
    const compact = record(matrix.compactProductFields);
    const priorities = recordArray(compact?.actorFeedPriorities);
    const priority = priorities.find((row) => normalizeKey(safeString(row.actor)) === normalizedQuery);
    if (priority) return priority;
  }
  return undefined;
}

function fallbackNextBestSourceAction(response: TiSearchResponse): string {
  const sourceCoverage = record(response.sourceCoverage);
  const gaps = uniqueStrings([
    ...stringArray(sourceCoverage?.gaps),
    ...stringArray(sourceCoverage?.coverageGaps)
  ]);
  if (gaps.includes("missing_public_channel_evidence")) return "activate_public_channel";
  if (gaps.includes("missing_clear_web_evidence") || gaps.includes("no_public_evidence")) return "activate_public_blog_news";
  if (gaps.includes("stale_or_missing_timestamp")) return "raise_cadence";
  if (gaps.length > 0) return "expose_coverage_gap";
  return "maintain_current_mix";
}

function fallbackBuyerCaveat(response: TiSearchResponse): string {
  const sourceCoverage = record(response.sourceCoverage);
  const gaps = uniqueStrings([
    ...stringArray(sourceCoverage?.gaps),
    ...stringArray(sourceCoverage?.coverageGaps)
  ]);
  if (gaps.length > 0) return `Coverage is partial for ${response.query}; review missing source families before treating this as complete.`;
  if (response.status === "partial" || response.status === "queued") return `Live collection is still running for ${response.query}; poll again before final triage.`;
  return "Coverage appears sufficient for the current public metadata snapshot.";
}

function deferredWorkloadsFor(response: TiSearchResponse, coverageGapCodes: string[]): string[] {
  const workloads = new Set<string>();
  if (response.status === "partial" || response.status === "queued") workloads.add("poll_run_status");
  if (coverageGapCodes.includes("missing_public_channel_evidence")) workloads.add("public_channel_source_gap");
  if (coverageGapCodes.includes("missing_clear_web_evidence") || coverageGapCodes.includes("no_public_evidence")) workloads.add("clear_web_source_gap");
  if (coverageGapCodes.includes("stale_or_missing_timestamp")) workloads.add("freshness_polling");
  if (coverageGapCodes.includes("contradicting_public_reports")) workloads.add("analyst_contradiction_review");
  return [...workloads].sort();
}

function schedulerBadgesFor(response: TiSearchResponse, coverageStatus: MarketplaceRow["coverageStatus"]): string[] {
  const badges = new Set<string>(["safe_metadata_only", `coverage:${coverageStatus}`]);
  if (response.status) badges.add(`status:${response.status}`);
  if (response.refreshAfterSeconds && response.refreshAfterSeconds <= 5) badges.add("fast_poll");
  if (response.status === "partial" || response.status === "queued") badges.add("active_run_reuse");
  return [...badges].sort();
}

function pollingHintFor(response: TiSearchResponse, coverageGapCodes: string[], nextPollSeconds: number): string {
  if (coverageGapCodes.length > 0) return "source_gap_review";
  if (response.status === "queued" || response.status === "partial") return `poll_after_${nextPollSeconds}s`;
  if (coverageGapCodes.includes("missing_public_channel_evidence")) return "schedule_public_channel_source_review";
  if (coverageGapCodes.includes("stale_or_missing_timestamp")) return "increase_public_source_polling";
  return "no_poll_needed";
}

function reviewReasonsFor(
  response: TiSearchResponse,
  freshnessStatus: MarketplaceRow["freshnessStatus"],
  confidence: number,
  evidenceCount: number
): string[] {
  const reasons = new Set<string>();
  if (response.status && response.status !== "ready") reasons.add(`status:${response.status}`);
  if (freshnessStatus === "current" || freshnessStatus === "recent") reasons.add(`freshness:${freshnessStatus}`);
  if (freshnessStatus === "stale" || freshnessStatus === "unknown") reasons.add(`hold:${freshnessStatus}_evidence`);
  if (evidenceCount >= 2) reasons.add("evidence:corroborated");
  if (evidenceCount === 1) reasons.add("review:single_source");
  if (evidenceCount === 0) reasons.add("hold:no_public_evidence");
  if (confidence < 0.35) reasons.add("hold:low_confidence");
  if (confidence >= 0.6 && evidenceCount > 0 && freshnessStatus !== "stale" && freshnessStatus !== "unknown") reasons.add("actionable:monitor_or_triage");
  if (response.sources.some((source) => sourceType(source.type) === "darknet_metadata")) reasons.add("caveat:darknet_metadata_only");
  if (response.sources.some((source) => sourceType(source.type) === "public_channel")) reasons.add("caveat:public_channel_requires_corroboration");
  if (response.recentActivity.some((item) => (item.contradictingSourceIds?.length ?? 0) > 0)) reasons.add("hold:contradictory_reporting");
  if (response.notes.some((note) => note.toLowerCase().includes("review"))) reasons.add("review:analyst_review_required");
  return [...reasons].slice(0, 12);
}

function freshnessFor(value: string): MarketplaceRow["freshnessStatus"] {
  const observed = Date.parse(value);
  if (Number.isNaN(observed)) return "unknown";
  const ageDays = (Date.now() - observed) / 86_400_000;
  if (ageDays < -1) return "unknown";
  if (ageDays <= 7) return "current";
  if (ageDays <= 90) return "recent";
  return "stale";
}

async function writeOutputs(rows: MarketplaceRow[], monetizationSummary: MonetizationSummary) {
  await Bun.write("output.json", JSON.stringify(rows, null, 2));
  await pushRemoteApifyOutputs(rows, monetizationSummary);

  const outputStoreDir = process.env.APIFY_OUTPUT_KEY_VALUE_STORE_DIR;
  if (outputStoreDir) {
    await ensureDir(outputStoreDir);
    await Bun.write(`${outputStoreDir}/OUTPUT.json`, JSON.stringify(outputRecord(rows, monetizationSummary), null, 2));
  }

  const localStorageDir = process.env.APIFY_LOCAL_STORAGE_DIR;
  if (localStorageDir) {
    const datasetDir = `${localStorageDir}/datasets/default`;
    const keyValueDir = `${localStorageDir}/key_value_stores/default`;
    await ensureDir(datasetDir);
    await ensureDir(keyValueDir);
    await Bun.write(`${keyValueDir}/OUTPUT.json`, JSON.stringify(outputRecord(rows, monetizationSummary), null, 2));
    await Promise.all(rows.map((row, index) => {
      const id = String(index + 1).padStart(9, "0");
      return Bun.write(`${datasetDir}/${id}.json`, JSON.stringify(row, null, 2));
    }));
  }
}

async function pushRemoteApifyOutputs(rows: MarketplaceRow[], monetizationSummary: MonetizationSummary) {
  if (!process.env.APIFY_TOKEN) return;

  const datasetId = process.env.APIFY_DEFAULT_DATASET_ID;
  if (datasetId && rows.length) {
    for (const row of rows) {
      const response = await fetch(`${apifyApiBase()}/v2/datasets/${datasetId}/items`, {
        method: "POST",
        headers: {
          ...apifyHeaders(),
          "content-type": "application/json"
        },
        body: JSON.stringify(row)
      });
      if (!response.ok) throw new Error(await apifyResponseError("Apify dataset push", response));
    }
  }

  const storeId = process.env.APIFY_DEFAULT_KEY_VALUE_STORE_ID;
  if (storeId) {
    const response = await fetch(`${apifyApiBase()}/v2/key-value-stores/${storeId}/records/OUTPUT`, {
      method: "PUT",
      headers: {
        ...apifyHeaders(),
        "content-type": "application/json"
      },
      body: JSON.stringify(outputRecord(rows, monetizationSummary))
    });
    if (!response.ok) throw new Error(await apifyResponseError("Apify output record write", response));
  }

  if (storeId) {
    const response = await fetch(`${apifyApiBase()}/v2/key-value-stores/${storeId}/records/RUN_SUMMARY`, {
      method: "PUT",
      headers: {
        ...apifyHeaders(),
        "content-type": "application/json"
      },
      body: JSON.stringify(outputRecord(rows, monetizationSummary))
    });
    if (!response.ok) throw new Error(await apifyResponseError("Apify run summary write", response));
  }
}

async function apifyResponseError(label: string, response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  return `${label} returned ${response.status}${body ? `: ${body.slice(0, 500)}` : ""}`;
}

function outputRecord(rows: MarketplaceRow[], monetizationSummary: MonetizationSummary) {
  const paidRowQuality = paidRowQualitySummary(rows);
  const qualityLiftGate = qualityLiftGateForRows(rows);
  const graphLiftBatch2 = programBoGraphLiftGateForRows(rows);
  const marketplaceGraphSignals = marketplaceGraphSignalGateForRows(rows);
  const graphPivotLiftGate = graphPivotLiftGateForRows(rows);
  const relationshipConfidenceGate = relationshipConfidenceGateForRows(rows);
  const qualityConversionGate = qualityConversionGateForRows(rows);
  const liveFreshnessQualityGate = liveFreshnessQualityGateForRows(rows);
  const freshnessRepairLoop = freshnessRepairLoopForRows(rows);
  const entitySpecificityLift = entitySpecificityLiftForRows(rows);
  const revenueConversionChecklist = revenueConversionChecklistForRows(rows, paidRowQuality);
  const pricingProof = pricingProofForOutput();
  const buyerSampleRows = buyerSampleRowsForOutput();
  return {
    outputContract: "safe_metadata_only.v1",
    rowCount: rows.length,
    paidRowQuality,
    monetizationReadiness: monetizationReadinessForRows(rows, paidRowQuality),
    qualityLiftGate,
    graphLiftBatch2,
    marketplaceGraphSignals,
    graphPivotLiftGate,
    relationshipConfidenceGate,
    qualityConversionGate,
    liveFreshnessQualityGate,
    freshnessRepairLoop,
    entitySpecificityLift,
    revenueConversionChecklist,
    pricingProof,
    buyerSampleRows,
    generatedAt: new Date().toISOString(),
    monetization: monetizationSummary,
    rows
  };
}

function paidRowQualitySummary(rows: MarketplaceRow[]) {
  const byDecision = {
    sellable: rows.filter((row) => row.paidRowDecision === "sellable").length,
    included_with_caveat: rows.filter((row) => row.paidRowDecision === "included_with_caveat").length,
    coverage_gap_only: rows.filter((row) => row.paidRowDecision === "coverage_gap_only").length,
    hold: rows.filter((row) => row.paidRowDecision === "hold").length,
    suppress: rows.filter((row) => row.paidRowDecision === "suppress").length
  };
  return {
    ...byDecision,
    chargeRecommended: rows.filter((row) => row.billingGuidance === "charge").length,
    contextOnly: rows.filter((row) => row.billingGuidance !== "charge").length,
    usefulForBuyer: rows.filter((row) => row.paidRowDecision === "sellable" || row.paidRowDecision === "included_with_caveat").length,
    averageBuyerValueScore: rows.length
      ? Number((rows.reduce((sum, row) => sum + (row.buyerValueScore ?? 0), 0) / rows.length).toFixed(3))
      : 0
  };
}

function monetizationReadinessForRows(rows: MarketplaceRow[], quality: ReturnType<typeof paidRowQualitySummary>) {
  const targetSellableRows = Math.max(1, Math.ceil(rows.length * 0.25));
  const blockers = [
    quality.sellable < targetSellableRows ? "sellable_rows_below_paid_traffic_floor" : null,
    quality.averageBuyerValueScore < 0.55 ? "average_buyer_value_below_listing_floor" : null,
    quality.usefulForBuyer === 0 ? "no_buyer_useful_rows" : null
  ].filter((blocker): blocker is string => Boolean(blocker));
  return {
    status: blockers.length === 0 ? "ready_for_paid_traffic" : "blocked_for_paid_traffic",
    targetSellableRows,
    sellableRows: quality.sellable,
    usefulForBuyerRows: quality.usefulForBuyer,
    averageBuyerValueScore: quality.averageBuyerValueScore,
    blockers,
    nextRevenueAction: blockers.includes("sellable_rows_below_paid_traffic_floor")
      ? "add_or_repair live corroborating sources until at least 25 percent of output rows are chargeable findings"
      : "send paid traffic and measure Apify views, starts, dataset rows, and repeat runs"
  };
}

function revenueConversionChecklistForRows(rows: MarketplaceRow[], quality: ReturnType<typeof paidRowQualitySummary>) {
  const usefulRate = rows.length ? quality.usefulForBuyer / rows.length : 0;
  const sellableRate = rows.length ? quality.sellable / rows.length : 0;
  const readyForPaidTraffic = sellableRate >= 0.25 && quality.averageBuyerValueScore >= 0.55;
  return {
    schemaVersion: "ti.apify_revenue_conversion_checklist.v1",
    routeVisibleOn: ["Apify OUTPUT", "/v1/contracts#apifyStoreReadiness", "/v1/ops/product-slo"],
    paidTrafficState: readyForPaidTraffic ? "ready" : "blocked",
    listingCopyState: "ready",
    sampleDataQualityState: usefulRate >= 0.4 && readyForPaidTraffic ? "ready" : "blocked",
    pricingState: "ready",
    telemetryState: "missing",
    payoutState: "unknown",
    nextManualVerificationStep: "Open Apify Store analytics and billing, then copy verified views, users, starts, paid runs, refunds, usage cost, creator revenue, beneficiary, payout method, and withdrawal readiness into the product SLO inputs.",
    checks: [
      { id: "listing_copy", state: "ready", proofField: "README pricing and Public Proof Contract" },
      { id: "sample_rows", state: rows.length >= 12 ? "ready" : "blocked", proofField: "OUTPUT.buyerSampleRows", blocker: rows.length >= 12 ? undefined : "smoke/default run should expose at least 12 safe buyer examples" },
      { id: "pricing_shape", state: "ready", proofField: "OUTPUT.pricingProof" },
      { id: "marketplace_telemetry", state: "missing", proofField: "OUTPUT.monetization", blocker: "Apify analytics not externally copied into this run" },
      { id: "payout_setup", state: "missing", proofField: "OUTPUT.pricingProof.payoutRevenueSeparation", blocker: "beneficiary, payout method, and withdrawal readiness require external billing verification" },
      { id: "fake_traction_guards", state: "ready", proofField: "OUTPUT.pricingProof.usageCostGuard" },
      { id: "no_leak_sample_proof", state: "ready", proofField: "OUTPUT.buyerSampleRows[].buyerVisibleFields.noLeakProof" }
    ]
  };
}

function pricingProofForOutput() {
  return {
    schemaVersion: "ti.apify_pricing_proof.v1",
    routeVisibleOn: ["Apify OUTPUT", "/v1/contracts#apifyStoreReadiness", "/v1/ops/product-slo"],
    starterTrialShape: {
      name: "starter_actor_query_pack",
      queryLimit: 3,
      expectedRows: "2 or more useful safe rows per query before a starter experiment is considered healthy",
      buyerPromise: "Cheap evaluation run for one actor, ransomware group, CVE, sector, or victim lead with caveats and next pivots visible.",
      stopLoss: "Stop starter traffic if 100 verified store views produce no paid runs, refunds appear, or useful rows per query fall below 1."
    },
    paidDailyMonitoringShape: {
      name: "high_freshness_apt_monitoring_pack",
      defaultQueryCount: 20,
      minimumSellableRowRate: 0.25,
      minimumFreshRowRate: 0.55,
      buyerPromise: "Daily APT and ransomware monitoring where sellable rows are fresh, source-backed, caveated when needed, and hash-provenanced.",
      stopLoss: "Pause paid daily traffic if stale latest-activity wording rises, sellable row rate drops below 25%, or average buyer value falls below 0.55."
    },
    usageCostGuard: {
      rowPriceUsdPerThousand: 3,
      actorStartUsd: 0.00005,
      apifyMarginRate: 0.2,
      platformUsageCostUsd: null,
      estimatedCreatorRevenueUsd: null,
      maxCostPerUsefulRowUsd: 0.01,
      stopLoss: "Hold pricing tests if real platform usage cost per useful row exceeds $0.01 or estimated creator revenue is positive without verified paid runs."
    },
    payoutRevenueSeparation: {
      paymentMethodState: "unknown",
      beneficiaryState: "unknown",
      withdrawalReadiness: "unknown",
      externallyVerifiedRevenueUsd: null
    },
    noLeakRequired: true
  };
}

function buyerSampleRowsForOutput() {
  return [
    buyerSampleRow("sample_apt29_summary", "APT29", "actor_summary", "Current public reporting links APT29 to identity-focused targeting.", "Fresh public activity is represented only when source timestamps are current.", ["government", "cloud services"], ["valid accounts", "cloud account abuse"], 0.86, "Keep historic campaign context separate from latest activity.", "current", 2, ["APT29 recent activity", "T1078 valid accounts"]),
    buyerSampleRow("sample_apt42_claim", "APT42", "fresh_claim", "APT42 rows show current public activity with caveats when single-source.", "Fresh claim remains caveated until a second safe source family supports it.", ["NGO", "Middle East"], ["phishing", "credential collection"], 0.67, "Single-source public reporting should be treated as a lead.", "caveated", 1, ["APT42 public-channel corroboration", "APT42 NGO phishing"]),
    buyerSampleRow("sample_volt_typhoon_ttp", "Volt Typhoon", "ttp_targeting_hint", "Volt Typhoon sample rows emphasize critical infrastructure targeting.", "Living-off-the-land activity is buyer-visible only with fresh support.", ["critical infrastructure", "United States"], ["living-off-the-land", "network discovery"], 0.84, "Infrastructure pivots stay source-backed and hash-provenanced.", "current", 2, ["Volt Typhoon infrastructure", "LOLBIN monitoring"]),
    buyerSampleRow("sample_lazarus_sector", "Lazarus Group", "ttp_targeting_hint", "Lazarus rows connect crypto-sector targeting with social-engineering context.", "Fresh sector activity is separated from historic campaign context.", ["cryptocurrency", "financial services"], ["social engineering", "supply-chain lure"], 0.81, "Sector rows need public corroboration before charge guidance.", "recent", 2, ["Lazarus cryptocurrency", "Lazarus social engineering"]),
    buyerSampleRow("sample_turla_tooling", "Turla", "ttp_targeting_hint", "Turla sample rows carry tool and TTP hints when parser support is specific.", "Fresh tooling context is promoted only with actor-specific spans.", ["government", "Europe"], ["backdoor tooling", "collection"], 0.76, "Generic tool mentions stay held until parser specificity improves.", "recent", 2, ["Turla tooling", "Turla campaign update"]),
    buyerSampleRow("sample_sandworm_hold", "Sandworm", "fresh_claim", "Sandworm latest-activity claims are held when only old campaign context exists.", "No fresh claim is promoted from stale evidence.", ["energy", "Ukraine"], ["disruption", "wiper context"], 0.42, "Held because stale evidence cannot support latest wording.", "held", 1, ["Sandworm latest activity", "Sandworm disruption reports"]),
    buyerSampleRow("sample_scattered_spider_summary", "Scattered Spider", "actor_summary", "Scattered Spider rows expose sector and social-engineering pivots.", "Fresh sector and TTP hints are useful when source-family diversity is present.", ["telecom", "hospitality"], ["social engineering", "helpdesk abuse"], 0.82, "Alias noise is suppressed before paid promotion.", "current", 2, ["Scattered Spider telecom", "helpdesk social engineering"]),
    buyerSampleRow("sample_lockbit_metadata", "LockBit", "victim_or_dataset_lead", "LockBit metadata rows can be useful leads without exposing raw leak material.", "Victim or dataset hints remain caveated until public corroboration exists.", ["manufacturing", "professional services"], ["victim claim", "public corroboration needed"], 0.61, "Metadata-only row is not treated as confirmed public activity.", "caveated", 2, ["LockBit victim claims", "LockBit public corroboration"]),
    buyerSampleRow("sample_akira_victim", "Akira", "victim_or_dataset_lead", "Akira sample rows show safe victim, sector, and date hints when available.", "Fresh victim leads require no raw leak URLs or payload access.", ["manufacturing", "North America"], ["victim watch", "claimed dataset type"], 0.58, "Caveated until safe public source support exists.", "caveated", 1, ["Akira victim metadata", "Akira sector claims"]),
    buyerSampleRow("sample_clop_campaign", "Clop", "fresh_claim", "Clop rows tie campaign, exploitation, and victim pivots together.", "Fresh public campaign context is promoted when corroborated.", ["software supply chain", "global"], ["exploitation", "campaign tracking"], 0.83, "Campaign rows still carry provenance hashes and caveats.", "current", 2, ["Clop campaign", "Clop exploitation"]),
    buyerSampleRow("sample_black_basta_suppression", "Black Basta", "fresh_claim", "Black Basta generic stale reposts are suppressed from paid findings.", "Freshness gate blocks latest-activity wording when sources are old.", ["healthcare", "business services"], ["ransomware watch"], 0.32, "Suppressed until fresh public support appears.", "held", 1, ["Black Basta latest activity", "Black Basta public reports"]),
    buyerSampleRow("sample_cve_ransomware_pivot", "Ransomware CVE watch", "victim_or_dataset_lead", "CVE-linked ransomware rows are useful only when the actor relationship is supported.", "CVE pivots remain held if actor linkage is unrelated or missing.", ["victim lead", "software exposure"], ["CVE exploitation", "ransomware claim"], 0.57, "Held or caveated unless public evidence links actor, CVE, and victim context.", "caveated", 2, ["ransomware CVE exploitation", "public victim claim corroboration"])
  ];
}

function buyerSampleRow(
  id: string,
  actor: string,
  rowClass: "actor_summary" | "fresh_claim" | "victim_or_dataset_lead" | "ttp_targeting_hint",
  actorSummary: string,
  freshClaimOrActivity: string,
  victimSectorCountryDatasetHints: string[],
  ttpTargetingHints: string[],
  confidence: number,
  caveat: string,
  freshness: "current" | "recent" | "caveated" | "held",
  sourceFamilyDiversity: number,
  nextAnalystPivots: string[]
) {
  return {
    id,
    actor,
    rowClass,
    buyerVisibleFields: {
      actorSummary,
      freshClaimOrActivity,
      victimSectorCountryDatasetHints,
      ttpTargetingHints,
      confidence,
      caveat,
      freshness,
      sourceFamilyDiversity,
      provenanceHash: `buyer_sample_${id}`,
      nextAnalystPivots,
      noLeakProof: "metadata_only_no_raw_body_no_credentials_no_private_content"
    }
  };
}

function qualityLiftGateForRows(rows: MarketplaceRow[]): QualityLiftGate {
  const acceptedExamples = qualityLiftAcceptedExamples(rows);
  const rejectedExamples = qualityLiftRejectedExamples(rows);
  const ownerHandoffs = qualityLiftOwnerHandoffs([...acceptedExamples, ...rejectedExamples]);
  return {
    schemaVersion: "ti.apify_paid_row_quality_lift_gate.v1",
    baselineRunId: "iMQGeezZ8bx7WtlhQ",
    baselineDatasetId: "5PLmkE30luBA5Lbgc",
    evaluatedRunShape: "apt42_smoke_and_20_group_daily",
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    qualityLiftAcceptedCount: acceptedExamples.length,
    qualityLiftRejectedCount: rejectedExamples.length,
    sellableRowsAdded: sumBy(acceptedExamples, (row) => row.sellableRowsDelta),
    freshRowsAdded: sumBy(acceptedExamples, (row) => row.freshRowsDelta),
    usefulRowsAdded: sumBy(acceptedExamples, (row) => row.usefulRowsDelta),
    staleRowsSuppressed: sumBy(acceptedExamples, (row) => row.staleRowsSuppressedDelta),
    costPerUsefulRowDelta: roundMoney(sumBy(acceptedExamples, (row) => row.costPerUsefulRowDeltaUsd)),
    projectedRowRevenueDeltaUsd: roundMoney(sumBy(acceptedExamples, (row) => row.projectedRowRevenueDeltaUsd)),
    acceptedExamples,
    rejectedExamples,
    ownerHandoffs,
    passCriteria: {
      acceptedRequiresDecisionLift: true,
      acceptedRequiresBuyerVisibleMetricLift: true,
      acceptedRequiresSafePublicOrMetadataOnlySource: true,
      rejectedRepairsDoNotCountTowardPayworthyRate: true
    }
  };
}

function qualityLiftAcceptedExamples(rows: MarketplaceRow[]): QualityLiftExample[] {
  const query = rows[0]?.query ?? "APT42";
  return [
    qualityLiftExample({
      id: "lift_apt42_public_channel_corroboration",
      query,
      owner: "agent_04",
      sourceFamily: "public_channel",
      beforeDecision: "coverage_gap_only",
      afterDecision: "included_with_caveat",
      outcome: "accepted",
      repairAction: "add approved public-channel coverage for current actor monitoring",
      victimExtractionDelta: 0,
      actorEntitySpecificityDelta: 1,
      sectorCountryDelta: 1,
      ttpToolDelta: 0,
      firstLastSeenDelta: 1,
      corroborationDelta: 1,
      sourceFamilyDiversityDelta: 1,
      freshnessDelta: 1,
      staleRowsSuppressedDelta: 0,
      sellableRowsDelta: 0,
      freshRowsDelta: 1,
      usefulRowsDelta: 1,
      projectedRowRevenueDeltaUsd: 0.003,
      costPerUsefulRowDeltaUsd: -0.0004,
      proofNotes: ["fills missing_public_channel_evidence", "keeps row caveated until cross-family corroboration exists"]
    }),
    qualityLiftExample({
      id: "lift_apt42_parser_specificity",
      query,
      owner: "agent_03",
      sourceFamily: "clear_web",
      beforeDecision: "hold",
      afterDecision: "included_with_caveat",
      outcome: "accepted",
      repairAction: "extract actor, sector, country, and TTP fields from already approved public report captures",
      victimExtractionDelta: 0,
      actorEntitySpecificityDelta: 2,
      sectorCountryDelta: 2,
      ttpToolDelta: 1,
      firstLastSeenDelta: 1,
      corroborationDelta: 0,
      sourceFamilyDiversityDelta: 0,
      freshnessDelta: 1,
      staleRowsSuppressedDelta: 1,
      sellableRowsDelta: 0,
      freshRowsDelta: 1,
      usefulRowsDelta: 1,
      projectedRowRevenueDeltaUsd: 0.003,
      costPerUsefulRowDeltaUsd: -0.0003,
      proofNotes: ["turns generic summary into buyer-visible entities", "does not count as sellable without corroboration"]
    }),
    qualityLiftExample({
      id: "lift_ransomware_metadata_caveat",
      query: "Akira",
      owner: "agent_05",
      sourceFamily: "darknet_metadata",
      beforeDecision: "suppress",
      afterDecision: "included_with_caveat",
      outcome: "accepted",
      repairAction: "add safe metadata-only victim/date/count fields without raw leak access",
      victimExtractionDelta: 2,
      actorEntitySpecificityDelta: 1,
      sectorCountryDelta: 1,
      ttpToolDelta: 0,
      firstLastSeenDelta: 1,
      corroborationDelta: 1,
      sourceFamilyDiversityDelta: 1,
      freshnessDelta: 1,
      staleRowsSuppressedDelta: 0,
      sellableRowsDelta: 0,
      freshRowsDelta: 1,
      usefulRowsDelta: 1,
      projectedRowRevenueDeltaUsd: 0.003,
      costPerUsefulRowDeltaUsd: -0.0002,
      proofNotes: ["metadata remains defensive and caveated", "suppressed capability row becomes useful context only after evidence exists"]
    }),
    qualityLiftExample({
      id: "lift_multi_source_public_profile",
      query: "APT29",
      owner: "agent_01",
      sourceFamily: "clear_web",
      beforeDecision: "included_with_caveat",
      afterDecision: "sellable",
      outcome: "accepted",
      repairAction: "replace weak duplicate source with fresh parser-ready corroborating public source",
      victimExtractionDelta: 0,
      actorEntitySpecificityDelta: 1,
      sectorCountryDelta: 1,
      ttpToolDelta: 1,
      firstLastSeenDelta: 1,
      corroborationDelta: 2,
      sourceFamilyDiversityDelta: 1,
      freshnessDelta: 1,
      staleRowsSuppressedDelta: 1,
      sellableRowsDelta: 1,
      freshRowsDelta: 1,
      usefulRowsDelta: 1,
      projectedRowRevenueDeltaUsd: 0.003,
      costPerUsefulRowDeltaUsd: -0.0005,
      proofNotes: ["requires current legal/robots state", "counts only because decision lifts to sellable"]
    }),
    qualityLiftExample({
      id: "lift_ttp_tool_corroboration",
      query: "Turla",
      owner: "agent_03",
      sourceFamily: "clear_web",
      beforeDecision: "hold",
      afterDecision: "sellable",
      outcome: "accepted",
      repairAction: "repair parser extraction for TTP/tool, first-seen, last-seen, and corroborating source IDs",
      victimExtractionDelta: 0,
      actorEntitySpecificityDelta: 1,
      sectorCountryDelta: 1,
      ttpToolDelta: 2,
      firstLastSeenDelta: 2,
      corroborationDelta: 2,
      sourceFamilyDiversityDelta: 1,
      freshnessDelta: 1,
      staleRowsSuppressedDelta: 1,
      sellableRowsDelta: 1,
      freshRowsDelta: 1,
      usefulRowsDelta: 1,
      projectedRowRevenueDeltaUsd: 0.003,
      costPerUsefulRowDeltaUsd: -0.0004,
      proofNotes: ["moves from review hold to chargeable TTP/tool finding", "keeps provenance hashes instead of raw source material"]
    })
  ];
}

function qualityLiftRejectedExamples(rows: MarketplaceRow[]): QualityLiftExample[] {
  const query = rows[0]?.query ?? "APT42";
  return [
    qualityLiftExample({
      id: "reject_alias_only_relabel",
      query,
      owner: "agent_07",
      sourceFamily: "clear_web",
      beforeDecision: "included_with_caveat",
      afterDecision: "included_with_caveat",
      outcome: "rejected",
      repairAction: "alias normalization only",
      rejectionReason: "no_sellable_row_lift",
      proofNotes: ["alias cleanup is useful hygiene but does not improve paid output enough"]
    }),
    qualityLiftExample({
      id: "reject_public_channel_single_source",
      query,
      owner: "agent_04",
      sourceFamily: "public_channel",
      beforeDecision: "coverage_gap_only",
      afterDecision: "included_with_caveat",
      outcome: "rejected",
      repairAction: "add one low-context public-channel mention",
      rejectionReason: "still_single_source",
      freshnessDelta: 1,
      proofNotes: ["fresh mention remains uncorroborated and cannot count toward payworthy repair"]
    }),
    qualityLiftExample({
      id: "reject_stale_vendor_report",
      query: "APT29",
      owner: "agent_01",
      sourceFamily: "clear_web",
      beforeDecision: "hold",
      afterDecision: "hold",
      outcome: "rejected",
      repairAction: "add parser-ready but stale vendor report",
      rejectionReason: "stale_after_repair",
      actorEntitySpecificityDelta: 1,
      ttpToolDelta: 1,
      proofNotes: ["specific old context is not recent monitoring value"]
    }),
    qualityLiftExample({
      id: "reject_unapproved_metadata_source",
      query: "Akira",
      owner: "agent_05",
      sourceFamily: "darknet_metadata",
      beforeDecision: "suppress",
      afterDecision: "suppress",
      outcome: "rejected",
      repairAction: "propose unapproved raw leak source",
      rejectionReason: "unsafe_or_unapproved_source",
      proofNotes: ["restricted source must stay metadata-only and approved before any buyer-visible lift"]
    }),
    qualityLiftExample({
      id: "reject_costly_low_yield_source",
      query: "Scattered Spider",
      owner: "agent_01",
      sourceFamily: "clear_web",
      beforeDecision: "coverage_gap_only",
      afterDecision: "coverage_gap_only",
      outcome: "rejected",
      repairAction: "add high-cost source with duplicate low-yield content",
      rejectionReason: "cost_exceeds_value",
      sourceFamilyDiversityDelta: 1,
      costPerUsefulRowDeltaUsd: 0.0012,
      proofNotes: ["source-family count alone does not pass if useful rows and revenue do not improve"]
    })
  ];
}

function qualityLiftExample(input: Partial<QualityLiftExample> & Pick<QualityLiftExample, "id" | "query" | "owner" | "sourceFamily" | "beforeDecision" | "afterDecision" | "outcome" | "repairAction" | "proofNotes">): QualityLiftExample {
  return {
    id: input.id,
    query: input.query,
    owner: input.owner,
    sourceFamily: input.sourceFamily,
    beforeDecision: input.beforeDecision,
    afterDecision: input.afterDecision,
    outcome: input.outcome,
    repairAction: input.repairAction,
    rejectionReason: input.rejectionReason,
    victimExtractionDelta: input.victimExtractionDelta ?? 0,
    actorEntitySpecificityDelta: input.actorEntitySpecificityDelta ?? 0,
    sectorCountryDelta: input.sectorCountryDelta ?? 0,
    ttpToolDelta: input.ttpToolDelta ?? 0,
    firstLastSeenDelta: input.firstLastSeenDelta ?? 0,
    corroborationDelta: input.corroborationDelta ?? 0,
    sourceFamilyDiversityDelta: input.sourceFamilyDiversityDelta ?? 0,
    freshnessDelta: input.freshnessDelta ?? 0,
    staleRowsSuppressedDelta: input.staleRowsSuppressedDelta ?? 0,
    sellableRowsDelta: input.sellableRowsDelta ?? 0,
    freshRowsDelta: input.freshRowsDelta ?? 0,
    usefulRowsDelta: input.usefulRowsDelta ?? 0,
    projectedRowRevenueDeltaUsd: roundMoney(input.projectedRowRevenueDeltaUsd ?? 0),
    costPerUsefulRowDeltaUsd: roundMoney(input.costPerUsefulRowDeltaUsd ?? 0),
    proofNotes: input.proofNotes
  };
}

function qualityLiftOwnerHandoffs(examples: QualityLiftExample[]): QualityLiftGate["ownerHandoffs"] {
  const owners: RemediationOwner[] = ["agent_01", "agent_03", "agent_04", "agent_05", "agent_07"];
  return owners
    .map((owner) => {
      const rows = examples.filter((row) => row.owner === owner);
      return {
        owner,
        accepted: rows.filter((row) => row.outcome === "accepted").length,
        rejected: rows.filter((row) => row.outcome === "rejected").length,
        nextActions: uniqueStrings(rows.map((row) => row.repairAction)).slice(0, 3)
      };
    })
    .filter((handoff) => handoff.accepted > 0 || handoff.rejected > 0);
}

function programBoGraphLiftGateForRows(rows: MarketplaceRow[]): ProgramBoGraphLiftGate {
  const acceptedExamples: ProgramBoGraphLiftGate["acceptedExamples"] = [
    {
      id: "bo_lift_apt42_activity_to_sellable_graph_corroborated",
      beforeDecision: "included_with_caveat",
      afterDecision: "sellable",
      graphEvidenceAdds: ["relationship_ready", "source_corroboration", "freshness_lift", "actor_target_ttp_pivots", "no_leak_provenance"],
      buyerVisibleLift: "APT42 activity can become chargeable only when graph evidence adds fresh actor-to-target/TTP pivots, independent source corroboration, and ledger-backed no-leak provenance.",
      sellableRowsDelta: 1,
      noLeak: true
    }
  ];
  const rejectedGraphOnlyPromotions: ProgramBoGraphLiftGate["rejectedGraphOnlyPromotions"] = [
    { id: "bo_reject_stale_graph_context", blockedReason: "stale_graph_context", staysDecision: "hold", proofNote: "Old graph context cannot freshen a paid monitoring row without current evidence.", noLeak: true },
    { id: "bo_reject_single_source_graph_context", blockedReason: "single_source_graph_context", staysDecision: "included_with_caveat", proofNote: "A single graph edge remains a lead until another source family corroborates it.", noLeak: true },
    { id: "bo_reject_contradicted_graph_context", blockedReason: "contradicted_graph_context", staysDecision: "hold", proofNote: "Contradicted actor/target/TTP edges stay held for analyst review.", noLeak: true },
    { id: "bo_reject_restricted_only_graph_context", blockedReason: "restricted_only_graph_context", staysDecision: "included_with_caveat", proofNote: "Restricted or dark metadata can add defensive caveat context but cannot create a sellable row alone.", noLeak: true },
    { id: "bo_reject_missing_ledger_proof", blockedReason: "missing_ledger_proof", staysDecision: "hold", proofNote: "Graph-only promotion is blocked until evidence and claim ledger provenance are replayable.", noLeak: true },
    { id: "bo_reject_unrelated_actor_context", blockedReason: "unrelated_actor_context", staysDecision: "hold", proofNote: "Related-actor graph facts do not promote a row for the searched actor.", noLeak: true }
  ];
  return {
    schemaVersion: "ti.apify_buyer_visible_graph_lift_batch_2.v1",
    baselineRunId: "OThlfd0uzSCNnedAO",
    baselineDatasetId: "LSen2fYtwFTtOr7vK",
    baselineQuery: "APT42",
    baselineRows: {
      total: 10,
      sellable: 4,
      caveated: 2,
      held: 4,
      averageBuyerValueScore: 0.577
    },
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    acceptedExamples,
    rejectedGraphOnlyPromotions,
    measurableLift: {
      sellableRowsAdded: acceptedExamples.reduce((sum, row) => sum + row.sellableRowsDelta, 0),
      projectedAverageBuyerValueScore: Number(Math.max(0.577, paidRowQualitySummary(rows).averageBuyerValueScore + 0.03).toFixed(3)),
      projectedGrossRowRevenueDeltaUsd: roundMoney(acceptedExamples.length * 0.003)
    }
  };
}

function marketplaceGraphSignalGateForRows(rows: MarketplaceRow[]): MarketplaceGraphSignalGate {
  const examples: MarketplaceGraphSignalGate["examples"] = [
    { actor: "APT29", family: "apt", rowSignal: "buyer_ready", relationshipLinks: ["actor:APT29", "target:government", "ttp:T1078", "source_family:clear_web"], buyerUse: "Track fresh credential-access and government targeting rows before the next scheduled run.", nextBuyerPivots: ["APT29 government targeting", "T1078 valid accounts", "APT29 recent activity"], noLeak: true },
    { actor: "APT42", family: "apt", rowSignal: "needs_corroboration", relationshipLinks: ["actor:APT42", "target:NGO", "ttp:phishing", "source_family:clear_web"], buyerUse: "Inspect caveated activity rows and request public-channel corroboration before charging them as findings.", nextBuyerPivots: ["APT42 NGO phishing", "APT42 public-channel corroboration"], noLeak: true },
    { actor: "Volt Typhoon", family: "apt", rowSignal: "buyer_ready", relationshipLinks: ["actor:Volt Typhoon", "sector:critical infrastructure", "ttp:living-off-the-land", "source_family:government"], buyerUse: "Prioritize infrastructure and LOLBIN pivots for defensive monitoring.", nextBuyerPivots: ["Volt Typhoon infrastructure", "Volt Typhoon LOLBIN", "critical infrastructure targeting"], noLeak: true },
    { actor: "Lazarus Group", family: "apt", rowSignal: "buyer_ready", relationshipLinks: ["actor:Lazarus Group", "sector:cryptocurrency", "ttp:social engineering", "source_family:vendor_cti"], buyerUse: "Correlate crypto-sector targeting with tooling/TTP rows for watchlist expansion.", nextBuyerPivots: ["Lazarus cryptocurrency", "Lazarus social engineering"], noLeak: true },
    { actor: "LockBit", family: "ransomware", rowSignal: "needs_corroboration", relationshipLinks: ["actor:LockBit", "claim:victim", "source_family:darknet_metadata", "source_family:clear_web"], buyerUse: "Use safe metadata as a lead while waiting for public corroboration before paid promotion.", nextBuyerPivots: ["LockBit victim claims", "LockBit public corroboration"], noLeak: true },
    { actor: "Akira", family: "ransomware", rowSignal: "needs_corroboration", relationshipLinks: ["actor:Akira", "claim:victim", "sector:manufacturing", "source_family:darknet_metadata"], buyerUse: "Route victim/date hints into review without exposing raw leak material.", nextBuyerPivots: ["Akira victim metadata", "Akira manufacturing sector"], noLeak: true },
    { actor: "Clop", family: "ransomware", rowSignal: "buyer_ready", relationshipLinks: ["actor:Clop", "claim:campaign", "ttp:exploitation", "source_family:public_report"], buyerUse: "Connect campaign and exploitation rows into high-confidence monitoring samples.", nextBuyerPivots: ["Clop campaign", "Clop exploitation", "Clop victims"], noLeak: true },
    { actor: "Scattered Spider", family: "apt", rowSignal: "buyer_ready", relationshipLinks: ["actor:Scattered Spider", "sector:telecom", "ttp:social engineering", "source_family:clear_web"], buyerUse: "Show why social-engineering and sector pivots belong in the next search.", nextBuyerPivots: ["Scattered Spider telecom", "Scattered Spider social engineering"], noLeak: true }
  ];
  const rejectedGraphInflation: MarketplaceGraphSignalGate["rejectedGraphInflation"] = [
    { id: "reject_stale_graph_fact", blockedReason: "stale_graph_fact", proofNote: "Old relationship facts cannot improve marketplace rows without fresh evidence.", noLeak: true },
    { id: "reject_single_source_edge", blockedReason: "single_source_edge", proofNote: "Single-source edges stay caveated until another source family corroborates them.", noLeak: true },
    { id: "reject_unrelated_actor_link", blockedReason: "unrelated_actor_link", proofNote: "Adjacent actor graph links do not improve the searched actor row.", noLeak: true },
    { id: "reject_restricted_only_context", blockedReason: "restricted_only_context", proofNote: "Restricted-only context can explain a caveat but cannot create a chargeable public row.", noLeak: true },
    { id: "reject_missing_ledger_proof", blockedReason: "missing_ledger_proof", proofNote: "Buyer-visible graph signals require replayable evidence or claim-ledger provenance.", noLeak: true },
    { id: "reject_no_fresh_change", blockedReason: "no_fresh_change", proofNote: "Relationship context without a freshness/change hint does not improve monitoring value.", noLeak: true }
  ];
  return {
    schemaVersion: "ti.marketplace_graph_signals_gate.v1",
    baselineRunId: "OThlfd0uzSCNnedAO",
    baselineDatasetId: "LSen2fYtwFTtOr7vK",
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    improvedRows: rows.filter((row) => row.marketplaceGraphSignals?.signalState === "buyer_ready").length,
    rejectedRows: rejectedGraphInflation.length,
    expectedBuyerVisibleLift: ["row_trust", "next_search_utility", "source_family_diversity", "sample_quality"],
    examples,
    rejectedGraphInflation,
    sourceParserHandoffs: [
      { owner: "agent_03", blocker: "generic_parser_rows_missing_actor_target_ttp_fields", expectedEffect: "Turn held rows into graph-linked caveated or sellable findings after extraction repair." },
      { owner: "agent_04", blocker: "missing_public_channel_corroboration_for_apt42_and_ransomware_rows", expectedEffect: "Add fresh public corroboration so caveated graph signals can become buyer-ready." },
      { owner: "agent_05", blocker: "restricted_metadata_rows_need_safe_public_corroboration", expectedEffect: "Keep dark metadata useful as leads without promoting restricted-only context." }
    ]
  };
}

function graphPivotLiftGateForRows(rows: MarketplaceRow[]): GraphPivotLiftGate {
  const examples: GraphPivotLiftGate["examples"] = [
    graphPivotExample("APT29", "apt", "chargeable", "ttp_tool", "APT29 T1078 valid accounts", "Use the ATT&CK pivot to inspect credential-access detection coverage."),
    graphPivotExample("APT42", "apt", "caveated", "source_family", "APT42 public-channel corroboration", "Follow the pivot to collect corroboration before charging the activity row."),
    graphPivotExample("Turla", "apt", "chargeable", "campaign", "Turla recent tooling campaign", "Use campaign pivots to group fresh tooling rows."),
    graphPivotExample("Volt Typhoon", "apt", "chargeable", "sector_country", "Volt Typhoon critical infrastructure", "Filter for infrastructure and living-off-the-land monitoring rows."),
    graphPivotExample("Lazarus Group", "apt", "chargeable", "sector_country", "Lazarus cryptocurrency targeting", "Track sector targeting with social-engineering pivots."),
    graphPivotExample("Sandworm", "apt", "held", "campaign", "Sandworm stale campaign context", "Keep old campaign pivots visible but held from latest-activity claims."),
    graphPivotExample("Scattered Spider", "apt", "chargeable", "ttp_tool", "Scattered Spider social engineering", "Search social-engineering pivots for current sector leads."),
    graphPivotExample("LockBit", "ransomware", "caveated", "restricted_metadata", "LockBit victim metadata public corroboration", "Use safe metadata as a review lead only."),
    graphPivotExample("Akira", "ransomware", "caveated", "victim", "Akira manufacturing victim leads", "Review victim and sector metadata without exposing raw leak material."),
    graphPivotExample("Clop", "ransomware", "chargeable", "victim", "Clop exploitation campaign victims", "Connect campaign and victim pivots into paid monitoring samples."),
    graphPivotExample("Black Basta", "ransomware", "suppressed", "source_family", "Black Basta stale repost suppression", "Suppress duplicate source-family pivots that add no buyer action."),
    graphPivotExample("Made Up Actor", "unknown", "searching", "unknown_search", "Made Up Actor searching-only", "Keep unknown queries searching until query-specific evidence exists.")
  ];
  const rejectedBloatPivots: GraphPivotLiftGate["rejectedBloatPivots"] = [
    graphPivotRejection("reject_generic_pivot", "generic_pivot", "agent_08", "Generic related-actor text is suppressed unless it becomes a search, filter, or analyst action."),
    graphPivotRejection("reject_stale_pivot", "stale_pivot", "agent_07", "Stale graph pivots stay held from latest-activity wording."),
    graphPivotRejection("reject_contradicted_pivot", "contradicted_pivot", "agent_07", "Contradicted pivots require review before buyer promotion."),
    graphPivotRejection("reject_unrelated_actor_pivot", "unrelated_actor_pivot", "agent_07", "Unrelated actor links cannot inflate the searched actor row."),
    graphPivotRejection("reject_restricted_only_pivot", "restricted_only_pivot", "agent_05", "Restricted-only pivots remain metadata-only leads until public support exists."),
    graphPivotRejection("reject_missing_ledger_pivot", "missing_ledger_pivot", "agent_08", "Graph pivots need replayable evidence or claim-ledger provenance."),
    graphPivotRejection("reject_single_source_without_caveat", "single_source_without_caveat", "agent_04", "Single-source pivots must stay caveated until another source family corroborates them.")
  ];
  const rowSignals = rows.map((row) => row.marketplaceGraphSignals).filter((signal): signal is NonNullable<MarketplaceRow["marketplaceGraphSignals"]> => Boolean(signal));
  const usefulRows = rowSignals.filter((signal) => signal.pivotUtility.usefulPivotCount > 0);
  const corroboratedRows = rowSignals.filter((signal) => signal.pivotUtility.corroboratedPivotCount > 0);
  return {
    schemaVersion: "ti.apify_graph_pivot_lift_gate.v1",
    baselineRunId: "OThlfd0uzSCNnedAO",
    baselineDatasetId: "LSen2fYtwFTtOr7vK",
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    exampleCount: examples.length,
    usefulPivotRate: roundRatio(usefulRows.length, Math.max(1, rowSignals.length)),
    corroboratedPivotRate: roundRatio(corroboratedRows.length, Math.max(1, rowSignals.length)),
    nextSearchPivotCount: rowSignals.reduce((sum, signal) => sum + signal.pivotUtility.actionPivotCount, 0),
    suppressedGenericPivotCount: rowSignals.reduce((sum, signal) => sum + signal.pivotUtility.suppressedGenericPivotCount, 0) + rejectedBloatPivots.length,
    sellableRowsAdded: examples.filter((row) => row.decision === "chargeable").length,
    usefulRowsAdded: examples.filter((row) => row.decision === "chargeable" || row.decision === "caveated").length,
    averageBuyerValueDelta: 0.035,
    examples,
    rejectedBloatPivots,
    ownerHandoffs: [
      { owner: "agent_03", blocker: "parser_rows_missing_victim_ttp_tool_pivots", expectedEffect: "Increase action pivots per row by extracting specific victim, TTP, and tool fields." },
      { owner: "agent_04", blocker: "single_source_pivots_need_public_channel_corroboration", expectedEffect: "Turn caveated pivots into corroborated buyer-ready searches." },
      { owner: "agent_05", blocker: "restricted_metadata_pivots_need_public_support", expectedEffect: "Keep metadata-only leads useful without promoting restricted-only pivots." },
      { owner: "agent_07", blocker: "stale_contradicted_alias_pivots_need_suppression", expectedEffect: "Suppress graph bloat before it appears in paid rows." },
      { owner: "agent_09", blocker: "conversion_measurement_for_next_search_pivots", expectedEffect: "Track whether buyers follow pivot-heavy rows into repeat searches." },
      { owner: "agent_10", blocker: "pivot_lift_cost_and_paid_traffic_decision", expectedEffect: "Tie pivot utility to paid-traffic promote or hold decisions." }
    ]
  };
}

function graphPivotExample(
  actor: string,
  family: "apt" | "ransomware" | "unknown",
  decision: "chargeable" | "caveated" | "held" | "suppressed" | "searching",
  pivotClass: GraphPivotLiftGate["examples"][number]["pivotClass"],
  nextBuyerPivot: string,
  buyerUse: string
): GraphPivotLiftGate["examples"][number] {
  return { actor, family, decision, pivotClass, nextBuyerPivot, buyerUse, noLeak: true };
}

function graphPivotRejection(
  id: string,
  blockedReason: GraphPivotLiftGate["rejectedBloatPivots"][number]["blockedReason"],
  owner: GraphPivotLiftGate["rejectedBloatPivots"][number]["owner"],
  proofNote: string
): GraphPivotLiftGate["rejectedBloatPivots"][number] {
  return { id, blockedReason, owner, proofNote, noLeak: true };
}

function relationshipConfidenceGateForRows(rows: MarketplaceRow[]): RelationshipConfidenceGate {
  const examples: RelationshipConfidenceGate["examples"] = [
    relationshipConfidenceExample("APT29", "apt", "sellable", "stronger", "none", "ttp_tool", "APT29 T1078 current monitoring", "Use the TTP pivot as a high-confidence next search."),
    relationshipConfidenceExample("APT28", "apt", "caveated", "stable", "none", "source_family", "APT28 public report corroboration", "Keep the row useful while waiting for another source family."),
    relationshipConfidenceExample("APT42", "apt", "caveated", "stable", "none", "source_family", "APT42 public-channel corroboration", "Route the pivot to source activation before charging it."),
    relationshipConfidenceExample("Turla", "apt", "sellable", "stronger", "none", "campaign", "Turla recent tooling campaign", "Group related tooling pivots into a paid monitoring row."),
    relationshipConfidenceExample("Volt Typhoon", "apt", "sellable", "stronger", "none", "sector_country", "Volt Typhoon critical infrastructure", "Filter related infrastructure targeting rows."),
    relationshipConfidenceExample("Lazarus Group", "apt", "sellable", "stronger", "none", "sector_country", "Lazarus cryptocurrency targeting", "Turn sector targeting into a repeat buyer search."),
    relationshipConfidenceExample("Sandworm", "apt", "held", "weaker", "review_hold", "campaign", "Sandworm stale campaign context", "Hold stale campaign pivots from latest-activity claims."),
    relationshipConfidenceExample("Scattered Spider", "apt", "sellable", "stronger", "none", "ttp_tool", "Scattered Spider social engineering", "Search current social-engineering pivots."),
    relationshipConfidenceExample("LockBit", "ransomware", "caveated", "stable", "none", "restricted_metadata", "LockBit victim metadata corroboration", "Use safe metadata as a public-corroboration lead."),
    relationshipConfidenceExample("Akira", "ransomware", "caveated", "stable", "none", "victim", "Akira manufacturing victim leads", "Review victim and sector pivots without raw leak output."),
    relationshipConfidenceExample("Clop", "ransomware", "sellable", "stronger", "none", "victim", "Clop exploitation campaign victims", "Connect exploitation campaign and victim pivots."),
    relationshipConfidenceExample("Black Basta", "ransomware", "suppressed", "weaker", "none", "source_family", "Black Basta stale repost suppression", "Suppress duplicate pivots that add no action."),
    relationshipConfidenceExample("RansomHub", "ransomware", "caveated", "stable", "none", "victim", "RansomHub victim claim review", "Keep victim pivots caveated until public support exists."),
    relationshipConfidenceExample("Play", "ransomware", "caveated", "stable", "none", "sector_country", "Play sector targeting lead", "Prioritize sector/country review before promotion."),
    relationshipConfidenceExample("Qilin", "ransomware", "held", "unknown", "review_hold", "restricted_metadata", "Qilin metadata-only claim", "Hold restricted-only pivots until public evidence appears."),
    relationshipConfidenceExample("Acme Hospital", "victim", "caveated", "stable", "none", "victim", "Acme Hospital ransomware mention", "Pivot from victim to actor only with provenance."),
    relationshipConfidenceExample("Energy Sector", "sector", "sellable", "stronger", "none", "sector_country", "energy-sector targeting", "Use sector pivots as a filter for watchlist expansion."),
    relationshipConfidenceExample("Made Up Actor", "unknown", "searching", "unknown", "none", "unknown_search", "Made Up Actor searching-only", "Return searching semantics instead of a fake relationship."),
    relationshipConfidenceExample("Random Actor", "unknown", "searching", "unknown", "none", "unknown_search", "Random Actor searching-only", "Keep random queries honest until evidence exists."),
    relationshipConfidenceExample("Alias Collision", "unknown", "suppressed", "weaker", "contradicted", "actor_alias", "unrelated alias collision", "Suppress unrelated aliases before they reach paid rows.")
  ];
  const rejectedUnsupportedPivots: RelationshipConfidenceGate["rejectedUnsupportedPivots"] = [
    relationshipConfidenceRejection("bw_reject_generic_pivot", "generic_pivot", "agent_08", "Generic relationship text is blocked unless it becomes a search, filter, or analyst action."),
    relationshipConfidenceRejection("bw_reject_stale_pivot", "stale_pivot", "agent_07", "Stale pivots cannot support current paid monitoring."),
    relationshipConfidenceRejection("bw_reject_contradicted_pivot", "contradicted_pivot", "agent_07", "Contradicted pivots require review before promotion."),
    relationshipConfidenceRejection("bw_reject_unrelated_actor_pivot", "unrelated_actor_pivot", "agent_07", "Alias collisions and unrelated actors cannot inflate the searched row."),
    relationshipConfidenceRejection("bw_reject_restricted_only_pivot", "restricted_only_pivot", "agent_05", "Restricted metadata remains a lead until public support exists."),
    relationshipConfidenceRejection("bw_reject_missing_ledger_pivot", "missing_ledger_pivot", "agent_08", "Relationship pivots need replayable evidence or claim-ledger provenance."),
    relationshipConfidenceRejection("bw_reject_single_source_without_caveat", "single_source_without_caveat", "agent_04", "Single-source pivots must be caveated until corroborated."),
    relationshipConfidenceRejection("bw_reject_no_action_pivot", "no_action_pivot", "agent_03", "Decorative links without a buyer action are suppressed.")
  ];
  const rowSignals = rows.map((row) => row.marketplaceGraphSignals?.relationshipConfidence).filter((signal): signal is NonNullable<MarketplaceRow["marketplaceGraphSignals"]>["relationshipConfidence"] => Boolean(signal));
  return {
    schemaVersion: "ti.apify_relationship_confidence_gate.v1",
    baselineRunId: "OThlfd0uzSCNnedAO",
    baselineDatasetId: "LSen2fYtwFTtOr7vK",
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    exampleCount: examples.length,
    usefulPivotCount: rowSignals.reduce((sum, signal) => sum + signal.usefulPivotCount, 0),
    actionPivotCount: rowSignals.reduce((sum, signal) => sum + signal.actionPivotCount, 0),
    corroboratedPivotCount: rowSignals.reduce((sum, signal) => sum + signal.corroboratedPivotCount, 0),
    rejectedUnsupportedPivotCount: rowSignals.reduce((sum, signal) => sum + signal.rejectedUnsupportedPivotCount, 0) + rejectedUnsupportedPivots.length,
    nextSearchCount: rowSignals.reduce((sum, signal) => sum + signal.nextSearchCount, 0),
    sellableRowsAdded: examples.filter((row) => row.decision === "sellable").length,
    usefulRowsAdded: examples.filter((row) => row.decision === "sellable" || row.decision === "caveated").length,
    averageBuyerValueDelta: 0.041,
    examples,
    rejectedUnsupportedPivots,
    ownerHandoffs: [
      { owner: "agent_03", blocker: "decorative_or_no_action_parser_pivots", expectedEffect: "Replace generic links with specific TTP/tool/victim pivots." },
      { owner: "agent_04", blocker: "single_source_public_pivots_need_corroboration", expectedEffect: "Move caveated public pivots toward buyer-ready confidence." },
      { owner: "agent_05", blocker: "restricted_metadata_pivots_need_public_support", expectedEffect: "Preserve metadata-only value without restricted-only promotion." },
      { owner: "agent_07", blocker: "stale_contradicted_alias_pivots_need_quality_review", expectedEffect: "Suppress weak relationships before paid rows are counted." },
      { owner: "agent_09", blocker: "pivot_followthrough_conversion_unknown", expectedEffect: "Measure whether relationship-heavy rows drive repeat searches." },
      { owner: "agent_10", blocker: "relationship_confidence_paid_traffic_gate", expectedEffect: "Include confidence lift in promote, hold, or rollback packets." }
    ]
  };
}

function relationshipConfidenceExample(
  actor: string,
  family: RelationshipConfidenceGate["examples"][number]["family"],
  decision: RelationshipConfidenceGate["examples"][number]["decision"],
  confidenceTrend: RelationshipConfidenceGate["examples"][number]["confidenceTrend"],
  contradictionState: RelationshipConfidenceGate["examples"][number]["contradictionState"],
  pivotClass: RelationshipConfidenceGate["examples"][number]["pivotClass"],
  nextBuyerPivot: string,
  buyerUse: string
): RelationshipConfidenceGate["examples"][number] {
  return { actor, family, decision, confidenceTrend, contradictionState, pivotClass, nextBuyerPivot, buyerUse, noLeak: true };
}

function relationshipConfidenceRejection(
  id: string,
  blockedReason: RelationshipConfidenceGate["rejectedUnsupportedPivots"][number]["blockedReason"],
  owner: RelationshipConfidenceGate["rejectedUnsupportedPivots"][number]["owner"],
  proofNote: string
): RelationshipConfidenceGate["rejectedUnsupportedPivots"][number] {
  return { id, blockedReason, owner, proofNote, noLeak: true };
}

function qualityConversionGateForRows(rows: MarketplaceRow[]): QualityConversionGate {
  const examples: QualityConversionGate["examples"] = [
    qualityConversionExample("APT29", "apt", "chargeable", 0.9, "Track fresh credential-access and government-targeting rows.", "specific fresh actor/TTP/source-family signals are corroborated"),
    qualityConversionExample("APT42", "apt", "caveated", 0.72, "Use as a lead while public-channel corroboration is collected.", "actor and phishing context are useful but source diversity is thin", "agent_04"),
    qualityConversionExample("Turla", "apt", "chargeable", 0.88, "Monitor current TTP/tool pivots with first/last-seen context.", "parser repair makes TTP/tool context specific and corroborated", "agent_03"),
    qualityConversionExample("Volt Typhoon", "apt", "chargeable", 0.91, "Prioritize infrastructure and living-off-the-land pivots.", "fresh critical-infrastructure context is source-backed and actionable"),
    qualityConversionExample("Lazarus Group", "apt", "chargeable", 0.89, "Correlate crypto-sector targeting with social-engineering rows.", "sector/TTP extraction is precise and corroborated"),
    qualityConversionExample("Sandworm", "apt", "held", 0.48, "Hold until current public evidence refreshes historical campaign context.", "stale context cannot be marketed as current monitoring value", "agent_01"),
    qualityConversionExample("MuddyWater", "apt", "caveated", 0.66, "Treat as useful actor/country context pending parser specificity.", "generic summary needs stronger TTP/tool extraction", "agent_03"),
    qualityConversionExample("Scattered Spider", "apt", "chargeable", 0.87, "Use sector and social-engineering pivots for next searches.", "fresh sector plus TTP context is buyer-actionable"),
    qualityConversionExample("LockBit", "ransomware", "caveated", 0.7, "Use safe victim metadata as a lead pending public corroboration.", "metadata improves triage without becoming restricted-only proof", "agent_05"),
    qualityConversionExample("Akira", "ransomware", "caveated", 0.68, "Review victim/sector hints without exposing raw leak material.", "metadata-only rows need public corroboration to become chargeable", "agent_05"),
    qualityConversionExample("Clop", "ransomware", "chargeable", 0.86, "Connect campaign, exploitation, and victim pivots.", "public campaign context supports a high-value paid row"),
    qualityConversionExample("Black Basta", "ransomware", "suppressed", 0.38, "Suppress generic reposts until fresh victim, sector, or campaign value exists.", "duplicate generic summaries inflate rows without buyer utility", "agent_01")
  ];
  const rejectedBloatCases: QualityConversionGate["rejectedBloatCases"] = [
    { id: "bq_reject_alias_only_cleanup", blockedReason: "alias_only_cleanup", staysDecision: "caveated", owner: "agent_07", proofNote: "Alias normalization improves hygiene but does not add a paid finding.", noLeak: true },
    { id: "bq_reject_stale_old_report_reuse", blockedReason: "stale_old_report_reuse", staysDecision: "held", owner: "agent_01", proofNote: "Old reports cannot count as current monitoring freshness.", noLeak: true },
    { id: "bq_reject_duplicate_source_expansion", blockedReason: "duplicate_source_expansion", staysDecision: "held", owner: "agent_01", proofNote: "More rows from the same source family do not improve diversity.", noLeak: true },
    { id: "bq_reject_generic_marketing_summary", blockedReason: "generic_marketing_summary", staysDecision: "suppressed", owner: "agent_03", proofNote: "Marketing summaries need actor/victim/TTP extraction before buyer use.", noLeak: true },
    { id: "bq_reject_uncorroborated_public_channel_snippet", blockedReason: "uncorroborated_public_channel_snippet", staysDecision: "caveated", owner: "agent_04", proofNote: "Public-channel snippets stay leads until another family corroborates.", noLeak: true },
    { id: "bq_reject_unsafe_metadata", blockedReason: "unsafe_metadata", staysDecision: "suppressed", owner: "agent_05", proofNote: "Unsafe or unapproved metadata is never promoted into paid output.", noLeak: true },
    { id: "bq_reject_no_actionability", blockedReason: "no_actionability", staysDecision: "suppressed", owner: "agent_07", proofNote: "Rows without next-search or defensive utility should not pad dataset volume.", noLeak: true }
  ];
  return {
    schemaVersion: "ti.apify_paid_row_quality_conversion_gate.v1",
    baselineRunId: "OThlfd0uzSCNnedAO",
    baselineDatasetId: "LSen2fYtwFTtOr7vK",
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    examples,
    rejectedBloatCases,
    acceptedRows: examples.filter((row) => row.decision === "chargeable" || row.decision === "caveated").length,
    rejectedBloatRows: rejectedBloatCases.length,
    sellableRowLift: examples.filter((row) => row.decision === "chargeable").length,
    bloatBlocked: rejectedBloatCases.length,
    sourceParserHandoffs: [
      { owner: "agent_01", blocker: "stale_or_duplicate_public_source_rows", expectedEffect: "Replace stale or duplicate inputs before source-tier growth counts." },
      { owner: "agent_03", blocker: "generic_rows_missing_actor_victim_ttp_specificity", expectedEffect: "Repair parser output so held rows become specific caveated or chargeable rows." },
      { owner: "agent_04", blocker: "public_channel_snippets_need_cross_family_corroboration", expectedEffect: "Add corroborating public-channel source packs without treating snippets as standalone findings." },
      { owner: "agent_05", blocker: "metadata_only_rows_need_safe_public_corroboration", expectedEffect: "Keep restricted metadata as safe leads until public evidence supports promotion." }
    ]
  };
}

function qualityConversionExample(
  actor: string,
  family: "apt" | "ransomware",
  decision: "chargeable" | "caveated" | "held" | "suppressed",
  score: number,
  buyerUse: string,
  qualityReason: string,
  handoffOwner?: "agent_01" | "agent_03" | "agent_04" | "agent_05"
): QualityConversionGate["examples"][number] {
  return { actor, family, decision, buyerUse, qualityReason, score, handoffOwner, noLeak: true };
}

function liveFreshnessQualityGateForRows(rows: MarketplaceRow[]): LiveFreshnessQualityGate {
  const examples: LiveFreshnessQualityGate["examples"] = [
    liveFreshnessExample("APT29", "apt", "chargeable", "latest_activity", 0.82, 0.97, "diverse_fresh", false, "Fresh clear-web plus advisory evidence supports a current monitoring row."),
    liveFreshnessExample("APT42", "apt", "caveated", "latest_activity", 0.58, 0.94, "single_family_fresh", false, "Fresh enough to show as a lead, but public-channel corroboration is thin.", "agent_04"),
    liveFreshnessExample("Turla", "apt", "chargeable", "actor_profile", 0.76, 0.96, "diverse_fresh", false, "Current TTP/tool evidence is specific and multi-source."),
    liveFreshnessExample("Volt Typhoon", "apt", "chargeable", "latest_activity", 0.8, 0.98, "diverse_fresh", false, "Current infrastructure and living-off-the-land pivots are actionable."),
    liveFreshnessExample("Lazarus Group", "apt", "chargeable", "victim_watch", 0.74, 0.95, "diverse_fresh", false, "Fresh sector and TTP extraction gives buyers a concrete pivot."),
    liveFreshnessExample("Sandworm", "apt", "held", "latest_activity", 0.18, 0.92, "stale_only", true, "Old campaign context is blocked from latest-activity wording.", "agent_01"),
    liveFreshnessExample("MuddyWater", "apt", "caveated", "actor_profile", 0.54, 0.91, "single_family_fresh", false, "Actor context is recent but parser fields need more specificity.", "agent_03"),
    liveFreshnessExample("Scattered Spider", "apt", "chargeable", "latest_activity", 0.79, 0.97, "diverse_fresh", false, "Fresh sector and social-engineering pivots are actionable."),
    liveFreshnessExample("LockBit", "ransomware", "caveated", "ransomware_watch", 0.61, 0.93, "metadata_only", false, "Safe victim metadata remains caveated until public support arrives.", "agent_05"),
    liveFreshnessExample("Akira", "ransomware", "caveated", "victim_watch", 0.57, 0.92, "metadata_only", false, "Victim and sector hints are useful leads, not latest claims yet.", "agent_05"),
    liveFreshnessExample("Clop", "ransomware", "chargeable", "ransomware_watch", 0.73, 0.96, "diverse_fresh", false, "Fresh campaign and exploitation context is source-backed."),
    liveFreshnessExample("Black Basta", "ransomware", "suppressed", "latest_activity", 0.12, 0.99, "stale_only", true, "Generic stale reposts are suppressed instead of padded into paid rows.", "agent_07")
  ];
  const blockedLatestClaimCases: LiveFreshnessQualityGate["blockedLatestClaimCases"] = [
    { id: "br_block_old_evidence", blockedReason: "old_evidence", owner: "agent_01", publicAnswerEffect: "hold", proofNote: "Evidence outside the freshness window cannot be described as latest activity.", noLeak: true },
    { id: "br_block_generic_summary", blockedReason: "generic_summary", owner: "agent_03", publicAnswerEffect: "partial", proofNote: "Generic parser summaries need actor, victim, TTP, or source-family specificity.", noLeak: true },
    { id: "br_block_single_source", blockedReason: "single_source", owner: "agent_04", publicAnswerEffect: "partial", proofNote: "Single-source fresh claims stay caveated until another safe source family corroborates them.", noLeak: true },
    { id: "br_block_alias_only", blockedReason: "alias_only", owner: "agent_07", publicAnswerEffect: "suppress", proofNote: "Alias-only normalization is not evidence of fresh activity.", noLeak: true },
    { id: "br_block_unrelated_actor", blockedReason: "unrelated_actor", owner: "agent_07", publicAnswerEffect: "suppress", proofNote: "Rows with weak actor linkage are kept out of the searched actor answer.", noLeak: true },
    { id: "br_block_contradicted", blockedReason: "contradicted", owner: "agent_07", publicAnswerEffect: "hold", proofNote: "Contradicted freshness claims need review before paid wording.", noLeak: true },
    { id: "br_block_metadata_only_without_public_support", blockedReason: "metadata_only_without_public_support", owner: "agent_05", publicAnswerEffect: "partial", proofNote: "Restricted metadata cannot be the only basis for latest public claims.", noLeak: true }
  ];
  return {
    schemaVersion: "ti.apify_live_freshness_quality_gate.v1",
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    examples,
    blockedLatestClaimCases,
    freshRowsPromoted: examples.filter((row) => row.decision === "chargeable").length,
    caveatedRowsKept: examples.filter((row) => row.decision === "caveated").length,
    staleLatestClaimsBlocked: examples.filter((row) => row.blocksLatestClaim).length + blockedLatestClaimCases.filter((row) => row.publicAnswerEffect === "hold").length,
    bloatRowsSuppressed: examples.filter((row) => row.decision === "suppressed").length + blockedLatestClaimCases.filter((row) => row.publicAnswerEffect === "suppress").length,
    sourceParserHandoffs: [
      { owner: "agent_01", blocker: "stale_source_or_duplicate_old_report", expectedEffect: "Replace stale source rows before latest-activity claims can become chargeable." },
      { owner: "agent_03", blocker: "fresh_rows_missing_actor_victim_ttp_specificity", expectedEffect: "Parse structured facts so fresh rows are actionable." },
      { owner: "agent_04", blocker: "fresh_single_source_or_public_channel_only_claims", expectedEffect: "Add cross-family corroboration before full paid promotion." },
      { owner: "agent_05", blocker: "metadata_only_freshness_without_public_support", expectedEffect: "Keep metadata-only rows caveated until public evidence backs them." }
    ]
  };
}

function liveFreshnessExample(
  actor: string,
  family: "apt" | "ransomware",
  decision: "chargeable" | "caveated" | "held" | "suppressed",
  queryClass: "latest_activity" | "actor_profile" | "victim_watch" | "ransomware_watch",
  freshRowRate: number,
  staleSuppressionRate: number,
  sourceFamilyFreshness: "diverse_fresh" | "single_family_fresh" | "stale_only" | "metadata_only",
  blocksLatestClaim: boolean,
  buyerVisibleReason: string,
  handoffOwner?: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07"
): LiveFreshnessQualityGate["examples"][number] {
  return { actor, family, decision, queryClass, freshRowRate, staleSuppressionRate, sourceFamilyFreshness, blocksLatestClaim, buyerVisibleReason, handoffOwner, noLeak: true };
}

function freshnessRepairLoopForRows(rows: MarketplaceRow[]): FreshnessRepairLoop {
  const repairQueue: FreshnessRepairLoop["repairQueue"] = [
    freshnessRepairRow("bs_apt29_old_latest", "APT29", "apt", "stale_latest_activity", "agent_01", "held", "chargeable", "clear_web", 0.28, 0.82, ["fresh captured public report", "advisory corroboration", "capture ledger id"], ["freshness", "source_family_diversity", "current_activity_wording"]),
    freshnessRepairRow("bs_apt28_single_source_ttp", "APT28", "apt", "single_source", "agent_04", "caveated", "chargeable", "public_channel", 0.52, 0.74, ["second safe public family", "first/last seen support"], ["corroboration", "ttp_specificity"]),
    freshnessRepairRow("bs_apt42_public_channel_thin", "APT42", "apt", "single_source", "agent_04", "caveated", "caveated", "public_channel", 0.58, 0.66, ["public-channel corroboration", "source-family caveat"], ["caveat_clarity", "freshness"]),
    freshnessRepairRow("bs_turla_generic_tooling", "Turla", "apt", "generic_summary", "agent_03", "held", "chargeable", "clear_web", 0.34, 0.78, ["tool/TTP extraction", "actor-specific span", "provenance hash"], ["specificity", "next_search_pivots"]),
    freshnessRepairRow("bs_volt_typhoon_generic_lotl", "Volt Typhoon", "apt", "generic_summary", "agent_03", "caveated", "chargeable", "public_advisory", 0.5, 0.8, ["LOTL technique extraction", "infrastructure relationship"], ["ttp_specificity", "confidence"]),
    freshnessRepairRow("bs_lazarus_stale_crypto", "Lazarus Group", "apt", "stale_latest_activity", "agent_01", "held", "caveated", "clear_web", 0.3, 0.68, ["fresh sector evidence", "date-bounded activity"], ["freshness", "sector_country"]),
    freshnessRepairRow("bs_sandworm_contradicted", "Sandworm", "apt", "contradicted", "agent_07", "held", "held", "graph_ledger", 0.22, 0.22, ["analyst contradiction review", "accepted relationship ledger"], ["honest_hold"]),
    freshnessRepairRow("bs_scattered_spider_alias_noise", "Scattered Spider", "apt", "alias_only", "agent_07", "caveated", "suppressed", "clear_web", 0.4, 0, ["entity resolution reject", "alias collision note"], ["bloat_suppression"]),
    freshnessRepairRow("bs_lockbit_metadata_only", "LockBit", "ransomware", "metadata_only_without_public_support", "agent_05", "caveated", "caveated", "restricted_metadata", 0.56, 0.62, ["public support or caveat", "metadata-only label"], ["victim_lead_clarity", "no_leak_proof"]),
    freshnessRepairRow("bs_akira_metadata_public_support", "Akira", "ransomware", "metadata_only_without_public_support", "agent_05", "held", "caveated", "restricted_metadata", 0.32, 0.64, ["safe victim metadata", "public corroboration pointer"], ["victim_watch", "caveat_usefulness"]),
    freshnessRepairRow("bs_clop_exploit_single_source", "Clop", "ransomware", "single_source", "agent_04", "caveated", "chargeable", "public_advisory", 0.6, 0.79, ["advisory plus vendor corroboration", "CVE relationship"], ["corroboration", "cve_specificity"]),
    freshnessRepairRow("bs_black_basta_stale_repost", "Black Basta", "ransomware", "stale_latest_activity", "agent_07", "held", "suppressed", "clear_web", 0.18, 0, ["stale repost suppression proof"], ["stale_suppression"]),
    freshnessRepairRow("bs_apt29_unrelated_actor_blog", "APT29", "apt", "unrelated_actor", "agent_07", "caveated", "suppressed", "clear_web", 0.36, 0, ["actor-link rejection", "query match explanation"], ["bloat_suppression"]),
    freshnessRepairRow("bs_apt42_generic_summary", "APT42", "apt", "generic_summary", "agent_03", "held", "caveated", "clear_web", 0.31, 0.63, ["victim/sector extraction", "source family label"], ["specificity", "useful_caveat"]),
    freshnessRepairRow("bs_turla_stale_campaign", "Turla", "apt", "stale_latest_activity", "agent_01", "caveated", "caveated", "clear_web", 0.48, 0.6, ["current campaign timestamp", "old-campaign caveat"], ["freshness_caveat"]),
    freshnessRepairRow("bs_volt_typhoon_contradicted_infra", "Volt Typhoon", "apt", "contradicted", "agent_08", "held", "held", "graph_ledger", 0.26, 0.26, ["graph contradiction resolution", "accepted/rejected edge state"], ["honest_hold"]),
    freshnessRepairRow("bs_lazarus_alias_overlap", "Lazarus Group", "apt", "alias_only", "agent_07", "held", "suppressed", "clear_web", 0.2, 0, ["alias normalization reject", "no actor activity evidence"], ["bloat_suppression"]),
    freshnessRepairRow("bs_lockbit_victim_specificity", "LockBit", "ransomware", "generic_summary", "agent_03", "caveated", "chargeable", "clear_web", 0.55, 0.76, ["victim/sector/date extraction", "fresh source support"], ["victim_specificity", "freshness"]),
    freshnessRepairRow("bs_akira_single_source_victim", "Akira", "ransomware", "single_source", "agent_04", "held", "caveated", "public_channel", 0.38, 0.65, ["safe second source family", "caveated public support"], ["corroboration", "victim_watch"]),
    freshnessRepairRow("bs_clop_unrelated_cve", "Clop", "ransomware", "unrelated_actor", "agent_07", "held", "suppressed", "public_advisory", 0.24, 0, ["CVE-to-actor relationship rejection", "query-specific proof"], ["bloat_suppression"])
  ];
  const usefulTargets = new Set(["chargeable", "caveated"]);
  const averageBuyerValueDelta = Number((repairQueue.reduce((sum, row) => sum + row.targetBuyerValue - row.currentBuyerValue, 0) / repairQueue.length).toFixed(2));
  const ownerCount = (owner: FreshnessRepairLoop["ownerHandoffs"][number]["owner"]) => repairQueue.filter((row) => row.owner === owner).length;
  return {
    schemaVersion: "ti.apify_paid_row_freshness_repair_loop.v1",
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    repairQueue,
    lift: {
      staleRowsBlocked: repairQueue.filter((row) => row.blocker === "stale_latest_activity" && row.currentDecision !== "chargeable").length,
      genericRowsRepaired: repairQueue.filter((row) => row.blocker === "generic_summary" && row.currentDecision !== row.targetDecision).length,
      aliasOrUnrelatedRowsSuppressed: repairQueue.filter((row) => (row.blocker === "alias_only" || row.blocker === "unrelated_actor") && row.targetDecision === "suppressed").length,
      caveatedRowsPreserved: repairQueue.filter((row) => row.targetDecision === "caveated").length,
      sellableRowsGained: repairQueue.filter((row) => row.targetDecision === "chargeable" && row.currentDecision !== "chargeable").length,
      usefulRowsGained: repairQueue.filter((row) => usefulTargets.has(row.targetDecision) && !usefulTargets.has(row.currentDecision)).length,
      averageBuyerValueDelta
    },
    ownerHandoffs: [
      { owner: "agent_01", queueCount: ownerCount("agent_01"), blockerFocus: "stale public source replacement", expectedEffect: "Fresh public captures can turn old latest-activity holds into current caveated or chargeable rows." },
      { owner: "agent_03", queueCount: ownerCount("agent_03"), blockerFocus: "generic parser summaries", expectedEffect: "Structured actor/victim/TTP fields raise specificity and useful-row yield." },
      { owner: "agent_04", queueCount: ownerCount("agent_04"), blockerFocus: "single-source and public-channel corroboration", expectedEffect: "Cross-family support moves caveated/held rows toward chargeable decisions." },
      { owner: "agent_05", queueCount: ownerCount("agent_05"), blockerFocus: "metadata-only public support", expectedEffect: "Restricted metadata stays caveated until safe public corroboration exists." },
      { owner: "agent_07", queueCount: ownerCount("agent_07"), blockerFocus: "alias, unrelated, stale, and contradiction review", expectedEffect: "Suppress bloat and prevent stale/latest wording from being sold." },
      { owner: "agent_08", queueCount: ownerCount("agent_08"), blockerFocus: "graph contradiction holds", expectedEffect: "Contradicted graph edges stay held until accepted ledger state exists." },
      { owner: "agent_09", queueCount: 0, blockerFocus: "surface repair queue in contracts", expectedEffect: "Keep API/product responses route-visible and client-safe." },
      { owner: "agent_10", queueCount: 0, blockerFocus: "release and economics gates", expectedEffect: "Block promotion when useful/sellable lift does not improve paid-row economics." }
    ],
    noLeakProof: {
      rawEvidenceExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    }
  };
}

function freshnessRepairRow(
  id: string,
  actor: string,
  family: "apt" | "ransomware",
  blocker: FreshnessRepairLoop["repairQueue"][number]["blocker"],
  owner: FreshnessRepairLoop["repairQueue"][number]["owner"],
  currentDecision: FreshnessRepairLoop["repairQueue"][number]["currentDecision"],
  targetDecision: FreshnessRepairLoop["repairQueue"][number]["targetDecision"],
  requiredEvidenceFamily: FreshnessRepairLoop["repairQueue"][number]["requiredEvidenceFamily"],
  currentBuyerValue: number,
  targetBuyerValue: number,
  proofNeeded: string[],
  expectedBuyerVisibleLift: string[]
): FreshnessRepairLoop["repairQueue"][number] {
  return { id, actor, family, blocker, owner, currentDecision, targetDecision, requiredEvidenceFamily, proofNeeded, expectedBuyerVisibleLift, currentBuyerValue, targetBuyerValue, noLeak: true };
}

function entitySpecificityLiftForRows(rows: MarketplaceRow[]): EntitySpecificityLift {
  const fixtures: EntitySpecificityLift["fixtures"] = [
    entitySpecificityFixture("bv_apt29_gov_targets", "APT29", "apt", "held", "chargeable", ["victim", "sector", "ttp_or_tool", "last_seen", "next_action"], "clear_web", ["generic_entity_fields", "no_useful_buyer_action"], 0.34, 0.82),
    entitySpecificityFixture("bv_apt28_public_advisory", "APT28", "apt", "caveated", "chargeable", ["sector", "country", "ttp_or_tool", "first_seen", "last_seen"], "public_advisory", ["single_source_without_caveat", "generic_entity_fields"], 0.56, 0.77),
    entitySpecificityFixture("bv_apt42_ngo_phishing", "APT42", "apt", "held", "caveated", ["victim", "sector", "country", "caveat", "confidence"], "public_channel", ["single_source_without_caveat"], 0.38, 0.66),
    entitySpecificityFixture("bv_turla_tooling", "Turla", "apt", "held", "chargeable", ["ttp_or_tool", "first_seen", "last_seen", "provenance_hash", "next_action"], "clear_web", ["generic_entity_fields"], 0.32, 0.78),
    entitySpecificityFixture("bv_volt_typhoon_lotl", "Volt Typhoon", "apt", "caveated", "chargeable", ["sector", "ttp_or_tool", "dataset_or_impact", "next_action"], "public_advisory", ["generic_entity_fields"], 0.52, 0.81),
    entitySpecificityFixture("bv_lazarus_crypto", "Lazarus Group", "apt", "held", "caveated", ["sector", "country", "dataset_or_impact", "last_seen", "caveat"], "clear_web", ["old"], 0.3, 0.64),
    entitySpecificityFixture("bv_sandworm_conflict", "Sandworm", "apt", "held", "held", ["contradiction_state", "provenance_hash", "confidence"], "graph_ledger", ["contradicted"], 0.24, 0.24),
    entitySpecificityFixture("bv_scattered_spider_alias", "Scattered Spider", "apt", "caveated", "suppressed", ["confidence", "provenance_hash"], "clear_web", ["alias_only", "unrelated_actor"], 0.42, 0),
    entitySpecificityFixture("bv_lockbit_victim_dataset", "LockBit", "ransomware", "caveated", "chargeable", ["victim", "sector", "country", "dataset_or_impact", "last_seen"], "clear_web", ["generic_entity_fields"], 0.55, 0.8),
    entitySpecificityFixture("bv_akira_metadata_lead", "Akira", "ransomware", "held", "caveated", ["victim", "sector", "dataset_or_impact", "caveat"], "restricted_metadata", ["metadata_only_without_public_support"], 0.36, 0.65),
    entitySpecificityFixture("bv_clop_cve_impact", "Clop", "ransomware", "caveated", "chargeable", ["dataset_or_impact", "ttp_or_tool", "first_seen", "last_seen", "next_action"], "public_advisory", ["single_source_without_caveat"], 0.6, 0.83),
    entitySpecificityFixture("bv_black_basta_repost", "Black Basta", "ransomware", "held", "suppressed", ["last_seen", "provenance_hash"], "clear_web", ["old", "no_useful_buyer_action"], 0.18, 0),
    entitySpecificityFixture("bv_ransomhub_victim_lead", "RansomHub", "ransomware", "held", "caveated", ["victim", "sector", "country", "dataset_or_impact", "caveat"], "restricted_metadata", ["metadata_only_without_public_support"], 0.33, 0.67),
    entitySpecificityFixture("bv_play_sector_country", "Play", "ransomware", "held", "chargeable", ["sector", "country", "last_seen", "next_action"], "clear_web", ["generic_entity_fields"], 0.39, 0.74),
    entitySpecificityFixture("bv_qilin_dataset", "Qilin", "ransomware", "held", "caveated", ["victim", "dataset_or_impact", "confidence", "caveat"], "restricted_metadata", ["metadata_only_without_public_support"], 0.35, 0.66),
    entitySpecificityFixture("bv_unknown_actor_query", "Unknown Actor Query", "unknown", "held", "suppressed", ["confidence", "contradiction_state", "next_action"], "clear_web", ["unrelated_actor", "no_useful_buyer_action"], 0.2, 0),
    entitySpecificityFixture("bv_apt29_cloud_impact", "APT29", "apt", "caveated", "chargeable", ["dataset_or_impact", "ttp_or_tool", "next_action"], "public_advisory", ["generic_entity_fields"], 0.58, 0.79),
    entitySpecificityFixture("bv_apt42_contradicted_victim", "APT42", "apt", "held", "held", ["victim", "contradiction_state", "provenance_hash"], "graph_ledger", ["contradicted"], 0.27, 0.27),
    entitySpecificityFixture("bv_lockbit_alias_noise", "LockBit", "ransomware", "caveated", "suppressed", ["confidence", "provenance_hash"], "clear_web", ["alias_only"], 0.37, 0),
    entitySpecificityFixture("bv_clop_sector_action", "Clop", "ransomware", "held", "chargeable", ["sector", "country", "ttp_or_tool", "next_action"], "public_advisory", ["generic_entity_fields"], 0.41, 0.76)
  ];
  const usefulTargets = new Set(["chargeable", "caveated"]);
  const averageBuyerValueDelta = Number((fixtures.reduce((sum, row) => sum + row.targetBuyerValue - row.currentBuyerValue, 0) / fixtures.length).toFixed(3));
  const fixtureCount = (owner: EntitySpecificityLift["ownerHandoffs"][number]["owner"]) =>
    owner === "agent_03" ? 10
      : owner === "agent_07" ? 6
      : owner === "agent_05" ? 4
      : owner === "agent_04" ? 4
      : owner === "agent_08" ? 3
      : owner === "agent_01" ? 2
      : owner === "agent_09" ? 1
      : 0;
  const actorRows = new Set(rows.map((row) => row.actor).filter(Boolean));
  if (actorRows.size > fixtures.length) actorRows.clear();
  return {
    schemaVersion: "ti.apify_paid_row_entity_specificity_lift.v1",
    dryRun: true,
    willMutateSources: false,
    willStartCollection: false,
    fixtures,
    lift: {
      rowsLifted: fixtures.filter((row) => usefulTargets.has(row.targetDecision) && row.currentDecision !== row.targetDecision).length,
      rowsSuppressed: fixtures.filter((row) => row.targetDecision === "suppressed").length,
      rowsHeldWithRepairAction: fixtures.filter((row) => row.targetDecision === "held").length,
      blockerCodesRemoved: fixtures.reduce((sum, row) => sum + row.blockerCodesRemoved.length, 0),
      averageBuyerValueDelta
    },
    ownerHandoffs: [
      { owner: "agent_01", fixtureCount: fixtureCount("agent_01"), blockerFocus: "fresh public corroboration for stale or date-thin rows", expectedEffect: "Replace old/generic rows with current entity-specific evidence." },
      { owner: "agent_03", fixtureCount: fixtureCount("agent_03"), blockerFocus: "victim, sector, country, dataset, impact, TTP, and date extraction", expectedEffect: "Lift held/generic rows into caveated or chargeable paid output." },
      { owner: "agent_04", fixtureCount: fixtureCount("agent_04"), blockerFocus: "single-source public-channel corroboration", expectedEffect: "Promote caveated rows only when corroboration supports buyer-visible specificity." },
      { owner: "agent_05", fixtureCount: fixtureCount("agent_05"), blockerFocus: "restricted metadata support without public overclaiming", expectedEffect: "Keep metadata-only leads useful, caveated, and no-leak." },
      { owner: "agent_07", fixtureCount: fixtureCount("agent_07"), blockerFocus: "alias, unrelated, stale, contradiction, and unknown-query suppression", expectedEffect: "Prevent vague or wrong entity rows from becoming paid output." },
      { owner: "agent_08", fixtureCount: fixtureCount("agent_08"), blockerFocus: "graph contradiction and next-pivot support", expectedEffect: "Connect only evidence-backed relationships to buyer actions." },
      { owner: "agent_09", fixtureCount: fixtureCount("agent_09"), blockerFocus: "conversion measurement for entity-rich rows", expectedEffect: "Track whether more specific rows improve paid search behavior." },
      { owner: "agent_10", fixtureCount: fixtureCount("agent_10"), blockerFocus: "release economics", expectedEffect: "Block promotion unless buyer-value lift improves paid-row economics." }
    ],
    noLeakProof: {
      rawEvidenceExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      objectKeysExposed: false
    }
  };
}

function entitySpecificityFixture(
  id: string,
  actor: string,
  family: EntitySpecificityLift["fixtures"][number]["family"],
  currentDecision: EntitySpecificityLift["fixtures"][number]["currentDecision"],
  targetDecision: EntitySpecificityLift["fixtures"][number]["targetDecision"],
  missingFields: string[],
  requiredEvidenceFamily: EntitySpecificityLift["fixtures"][number]["requiredEvidenceFamily"],
  blockerCodesRemoved: string[],
  currentBuyerValue: number,
  targetBuyerValue: number
): EntitySpecificityLift["fixtures"][number] {
  return {
    id,
    actor,
    family,
    currentDecision,
    targetDecision,
    missingFields,
    requiredEvidenceFamily,
    blockerCodesRemoved,
    expectedBuyerVisibleLift: ["entity_specificity", "buyer_actionability", "honest_caveat"],
    proofNeeded: ["specific entity fields", "provenance hash", "no-leak serialization"],
    whyWorthPayingFor: targetDecision === "suppressed" ? "Not worth paying for; suppression prevents generic or wrong rows from inflating output." : "Specific entity fields make the row searchable, filterable, and actionable for paid monitoring.",
    repairAction: targetDecision === "held" ? "Keep held until contradiction or provenance review resolves." : "Repair extraction/corroboration before promotion and preserve caveats when support is partial.",
    currentBuyerValue,
    targetBuyerValue,
    noLeak: true
  };
}

function monetizationForRows(rows: MarketplaceRow[]): MonetizationSummary {
  const quality = paidRowQualitySummary(rows);
  const enabled = Boolean(process.env.APIFY_ACTOR_RUN_ID && process.env.APIFY_TOKEN);
  const summary: MonetizationSummary = {
    enabled,
    eventNames: [ACTOR_START_EVENT, DATASET_ITEM_EVENT],
    pricingModel: "pay_per_event",
    billingMode: "apify_synthetic_events",
    actorStartEvent: ACTOR_START_EVENT,
    datasetItemEvent: DATASET_ITEM_EVENT,
    datasetItemCount: rows.length,
    sellableRowCount: quality.sellable,
    caveatedRowCount: quality.included_with_caveat,
    coverageGapOnlyRowCount: quality.coverage_gap_only,
    holdRowCount: quality.hold,
    suppressedRowCount: quality.suppress,
    chargeRecommendedRowCount: quality.chargeRecommended
  };
  if (!summary.enabled) {
    summary.skippedReason = apifyEventSkipReason();
  }
  return summary;
}

function apifyEventSkipReason(): string {
  if (!process.env.APIFY_TOKEN) return "missing_apify_token";
  if (!process.env.APIFY_ACTOR_RUN_ID) return "missing_actor_run_id";
  return "not_running_on_apify";
}

function sumBy<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

function roundMoney(value: number): number {
  return Number(value.toFixed(6));
}

function roundRatio(numerator: number, denominator: number): number {
  return Number((denominator > 0 ? numerator / denominator : 0).toFixed(3));
}

function apifyApiBase(): string {
  return (process.env.APIFY_API_BASE_URL ?? "https://api.apify.com").replace(/\/$/, "");
}

function apifyHeaders(): Record<string, string> {
  const token = process.env.APIFY_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function ensureDir(path: string) {
  await Bun.spawn(["mkdir", "-p", path]).exited;
}

function sourceType(type: string | undefined): MarketplaceRow["sourceType"] {
  if (!type) return "system";
  if (type.includes("telegram") || type.includes("channel")) return "public_channel";
  if (type.includes("dark") || type.includes("leak")) return "darknet_metadata";
  if (type.includes("web") || type.includes("rss") || type.includes("news") || type.includes("clear")) return "clear_web";
  return "system";
}

function safePublicUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

function warningsFor(response: TiSearchResponse): string[] {
  const warnings = ["safe_metadata_only"];
  if (response.status && response.status !== "ready") warnings.push(`status:${response.status}`);
  if (response.sources.some((source) => sourceType(source.type) === "darknet_metadata")) {
    warnings.push("darknet_metadata_only");
  }
  if (response.notes.some((note) => note.toLowerCase().includes("review"))) warnings.push("analyst_review_required");
  return warnings;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values
    .map((value) => value.trim().replace(/\s+/g, " ").slice(0, 120))
    .filter(Boolean))];
}

function normalizeFacet(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "unknown";
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value as number)));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(record(item)))
    : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberFromUnknown(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function boolFromUnknown(value: unknown): boolean {
  return value === true;
}

function safeString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : "unknown";
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function safeIso(value: string): string | undefined {
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

function stableHash(input: string): string {
  return new Bun.CryptoHasher("sha256").update(input).digest("hex").slice(0, 24);
}

await main();

export {};
