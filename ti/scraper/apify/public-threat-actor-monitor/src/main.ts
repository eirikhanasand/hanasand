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
  buyerCaveat: string;
  expectedTimeToUsefulSignal: string;
  pollingHint: string;
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
  skippedReason?: string;
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

  const monetizationSummary = monetizationForRows(rows.length);
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

  return rows;
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
    const response = await fetch(`${apifyApiBase()}/v2/datasets/${datasetId}/items`, {
      method: "POST",
      headers: {
        ...apifyHeaders(),
        "content-type": "application/json"
      },
      body: JSON.stringify(rows)
    });
    if (!response.ok) throw new Error(`Apify dataset push returned ${response.status}`);
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
    if (!response.ok) throw new Error(`Apify output record write returned ${response.status}`);
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
    if (!response.ok) throw new Error(`Apify output record write returned ${response.status}`);
  }
}

function outputRecord(rows: MarketplaceRow[], monetizationSummary: MonetizationSummary) {
  return {
    outputContract: "safe_metadata_only.v1",
    rowCount: rows.length,
    generatedAt: new Date().toISOString(),
    monetization: monetizationSummary,
    rows
  };
}

function monetizationForRows(rowCount: number): MonetizationSummary {
  const enabled = Boolean(process.env.APIFY_ACTOR_RUN_ID && process.env.APIFY_TOKEN);
  const summary: MonetizationSummary = {
    enabled,
    eventNames: [ACTOR_START_EVENT, DATASET_ITEM_EVENT],
    pricingModel: "pay_per_event",
    billingMode: "apify_synthetic_events",
    actorStartEvent: ACTOR_START_EVENT,
    datasetItemEvent: DATASET_ITEM_EVENT,
    datasetItemCount: rowCount
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
