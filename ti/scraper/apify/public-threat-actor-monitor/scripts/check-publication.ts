type ActorManifest = {
  title?: string;
  description?: string;
  categories?: string[];
  exampleRunInput?: {
    body?: string;
    contentType?: string;
  };
};

type DatasetSchema = {
  fields?: {
    properties?: Record<string, unknown>;
    required?: unknown;
  };
  views?: {
    overview?: {
      transformation?: {
        fields?: unknown;
      };
      display?: {
        properties?: Record<string, unknown>;
      };
    };
  };
};

const forbiddenListingTerms = [
  "helloWorld",
  "placeholder",
  "TODO",
  "as an AI",
  "AI-generated",
  "ChatGPT",
  "language model"
];

const requiredCategories = ["SECURITY", "MONITORING"];
const requiredDatasetFields = [
  "coverageStatus",
  "collectionPriority",
  "recommendedCollectionAction",
  "coverageGapCodes",
  "schedulerState",
  "schedulerDecision",
  "nextPollSeconds",
  "retryAfterSeconds",
  "duplicateRunReuse",
  "attachedToActiveRun",
  "queuedTaskCount",
  "deferredBackgroundWorkloads",
  "schedulerBadges",
  "sourceCoverageState",
  "sourceCoverageGapCount",
  "sourceCoverageGaps",
  "freshnessExpectation",
  "highestValueMissingFamily",
  "nextBestSourceAction",
  "relationshipSummary",
  "relationshipPivotTypes",
  "relationshipPivots",
  "whyActionable",
  "freshnessDelta",
  "confidenceDelta",
  "contradictionHints",
  "corroborationState",
  "nextSearchPivots",
  "buyerCaveat",
  "expectedTimeToUsefulSignal",
  "pollingHint",
  "paidRowDecision",
  "paidRowReason",
  "paidRowReasonCodes",
  "paidRowRemediationActions",
  "whyWorthPayingFor",
  "buyerValueScore",
  "billingGuidance",
  "reviewReasons",
  "analysisFacets",
  "rawContentIncluded",
  "safety"
];
const visibleDatasetFields = [
  "schedulerDecision",
  "pollingHint",
  "nextPollSeconds",
  "retryAfterSeconds",
  "sourceCoverageState",
  "sourceCoverageGaps",
  "freshnessExpectation",
  "highestValueMissingFamily",
  "nextBestSourceAction",
  "relationshipSummary",
  "relationshipPivots",
  "whyActionable",
  "corroborationState",
  "nextSearchPivots",
  "buyerCaveat",
  "paidRowDecision",
  "paidRowReason",
  "paidRowReasonCodes",
  "paidRowRemediationActions",
  "whyWorthPayingFor",
  "buyerValueScore",
  "billingGuidance",
  "expectedTimeToUsefulSignal",
  "coverageStatus",
  "collectionPriority",
  "recommendedCollectionAction",
  "reviewReasons",
  "analysisFacets",
  "sourceFamilies",
  "missingSourceFamilies"
];
const manifest = await Bun.file(".actor/actor.json").json() as ActorManifest;
const readme = await Bun.file("README.md").text();
const changelog = await Bun.file("CHANGELOG.md").text();
const launchChecklist = await Bun.file("LAUNCH_CHECKLIST.md").text();
const mainSource = await Bun.file("src/main.ts").text();
const datasetSchema = await Bun.file(".actor/DATASET_SCHEMA.json").json() as DatasetSchema;
const inputSchema = await Bun.file(".actor/INPUT_SCHEMA.json").text();
const fixture = await Bun.file("fixtures/apt42.json").json() as Record<string, unknown>;

const failures: string[] = [];
const latestShapeSafetyProof = {
  buyerPreset: "100-name",
  localRows: "607 safe rows",
  localSellableRows: "187 sellable rows",
  localSellableRate: "30.8% sellable rate",
  localAverageBuyerValue: "average buyer value `0.593`"
};

for (const field of ["title", "description"] as const) {
  if (!manifest[field]?.trim()) failures.push(`Missing actor manifest ${field}`);
}

for (const category of requiredCategories) {
  if (!manifest.categories?.includes(category)) failures.push(`Missing ${category} category`);
}

for (const generic of ["DEVELOPER_TOOLS", "AUTOMATION", "NEWS"]) {
  if (manifest.categories?.includes(generic)) failures.push(`Remove generic ${generic} category`);
}

const exampleInput = parseExampleInput(manifest.exampleRunInput?.body);
if (!exampleInput) {
  failures.push("Missing parseable exampleRunInput.body");
} else {
  const queries = Array.isArray(exampleInput.queries) ? exampleInput.queries : [];
  if (queries.length !== 0) failures.push("Example input should omit queries so the 100-name default watchlist is used");
  if (exampleInput.includeCoverageGaps !== false) failures.push("Example input should disable coverage gaps by default");
  if (exampleInput.includeHeldRows !== false) failures.push("Example input should disable held diagnostics by default");
  if (exampleInput.includeDatasets !== false) failures.push("Example input should keep dataset coverage disabled by default");
}

const combinedText = [
  JSON.stringify(manifest, null, 2),
  readme,
  changelog,
  launchChecklist,
  mainSource,
  JSON.stringify(datasetSchema, null, 2),
  inputSchema
].join("\n");

for (const term of forbiddenListingTerms) {
  if (combinedText.toLowerCase().includes(term.toLowerCase())) {
    failures.push(`Publication text contains forbidden term: ${term}`);
  }
}

const contractMentions: Array<[string, string[]]> = [
  ["safe metadata contract", ["safe_metadata_only", "safe-metadata-only"]],
  ["raw content exclusion", ["rawContentIncluded"]],
  ["review reasons", ["reviewReasons"]],
  ["analysis facets", ["analysisFacets"]],
  ["coverage status", ["coverageStatus"]],
  ["source coverage gaps", ["sourceCoverageGaps"]],
  ["source coverage action fields", ["nextBestSourceAction", "buyerCaveat", "expectedTimeToUsefulSignal"]],
  ["paid row decision fields", ["paidRowDecision", "billingGuidance", "buyerValueScore", "whyWorthPayingFor"]],
  ["relationship insight fields", ["relationshipSummary", "relationshipPivots", "whyActionable", "nextSearchPivots"]],
  ["scheduler decision", ["schedulerDecision"]],
  ["pay-per-event pricing", ["pay-per-event", "apify-default-dataset-item"]],
  ["actor start charge event", ["apify-actor-start"]],
  ["synthetic Apify event billing", ["apify_synthetic_events", "default dataset"]],
  ["100-row conversion proof", ["hundredRowConversionProof", "ti.apify_100_row_conversion_proof.v1"]],
  ["100 sellable row progress", ["current sellable rows", "projected sellable rows", "one-repair-away rows"]],
  ["paid-traffic floor", ["at least `100 sellable rows`", "paid-traffic-ready"]],
  ["100-name buyer preset", ["100-name default watchlist", "100-name buyer preset"]],
  ["diagnostics opt-in", ["Held rows, suppressed rows, and coverage-gap diagnostics are opt-in", "includeHeldRows"]],
  ["sellable public evidence rows", ["sellable source-provenance rows", "public source-provenance rows"]],
  ["real-row conversion sample pack", ["marketplaceConversionRealRowSamplePack", "ti.apify_marketplace_conversion_real_row_sample_pack.v1"]],
  ["first-100 buyer preview", ["first100BuyerPreview", "ti.apify_first_100_real_rows_buyer_preview.v1", "blocked_preview_until_100_real_sellable_rows"]],
  ["buyer paid-release verdict", ["buyerPaidReleaseVerdict", "ti.program_cu_buyer_paid_release_verdict.v1", "draft_copy_ready_not_promoted"]],
  ["hosted paid readiness proof", ["hostedPaidReadinessProof", "ti.hosted_apify_paid_readiness_proof.v1", "ti.program_cp_hosted_paid_row_integrity_gate.v1", "secondBatchAudit", "check:hosted-apify-paid-readiness", "TI_APIFY_HOSTED_PROOF_MODE=run", "TI_APIFY_OBSERVED_PROOF_PATH"]],
  ["real-row proof exclusions", ["synthetic, graph-only, stale, restricted-only, caveat-only, held, and coverage-gap rows", "excluded from paid-readiness proof"]],
  ["external unknown marketplace telemetry", ["external_unknown", "cost/useful row", "useful-row density"]],
  ["external analytics only", ["Store views", "paid runs", "runtime", "platform usage", "conversion rates"]]
];

for (const [label, acceptedTerms] of contractMentions) {
  if (!acceptedTerms.some((term) => combinedText.includes(term))) {
    failures.push(`Publication contract must mention ${label}`);
  }
}

for (const [surface, text] of [
  ["README", readme],
  ["launch checklist", launchChecklist],
  ["changelog", changelog]
] as const) {
  for (const term of Object.values(latestShapeSafetyProof)) {
    if (!text.includes(term)) failures.push(`${surface} must mention current buyer preset proof ${term}`);
  }
}

const datasetProperties = datasetSchema.fields?.properties ?? {};
const datasetRequired = stringArray(datasetSchema.fields?.required);
const overviewFields = stringArray(datasetSchema.views?.overview?.transformation?.fields);
const overviewDisplay = datasetSchema.views?.overview?.display?.properties ?? {};

for (const field of requiredDatasetFields) {
  if (!(field in datasetProperties)) failures.push(`Dataset schema missing property ${field}`);
  if (!datasetRequired.includes(field)) failures.push(`Dataset schema must require ${field}`);
}

for (const field of visibleDatasetFields) {
  if (!overviewFields.includes(field)) failures.push(`Dataset overview must show ${field}`);
  if (!(field in overviewDisplay)) failures.push(`Dataset overview display missing ${field}`);
}

const rowTypeEnum = enumValues(datasetProperties.rowType);
if (!rowTypeEnum.includes("coverage_gap")) failures.push("Dataset rowType enum must include coverage_gap");
const paidRowDecisionEnum = enumValues(datasetProperties.paidRowDecision);
for (const decision of ["sellable", "included_with_caveat", "coverage_gap_only", "hold", "suppress"]) {
  if (!paidRowDecisionEnum.includes(decision)) failures.push(`Dataset paidRowDecision enum must include ${decision}`);
}
const billingGuidanceEnum = enumValues(datasetProperties.billingGuidance);
for (const guidance of ["charge", "include_as_context", "do_not_charge_if_metered"]) {
  if (!billingGuidanceEnum.includes(guidance)) failures.push(`Dataset billingGuidance enum must include ${guidance}`);
}
const sourceTypeEnum = enumValues(datasetProperties.sourceType);
if (!sourceTypeEnum.includes("system")) failures.push("Dataset sourceType enum must include system for coverage-gap rows");

const rawContentIncluded = record(datasetProperties.rawContentIncluded);
if (rawContentIncluded?.const !== false) failures.push("Dataset rawContentIncluded must be const false");
const safety = record(datasetProperties.safety);
const safetyProperties = record(safety?.properties);
for (const [field, expected] of Object.entries({
  metadataOnly: true,
  credentialsIncluded: false,
  stolenFilesIncluded: false,
  privateContentIncluded: false,
  actorInteraction: false
})) {
  if (record(safetyProperties?.[field])?.const !== expected) {
    failures.push(`Dataset safety.${field} must be const ${expected}`);
  }
}

const fixtureScheduler = record(fixture.scheduler);
const fixtureInteractive = record(fixtureScheduler?.interactiveSearchFreshness);
const fixtureQueueDecision = record(fixtureInteractive?.queueDecision);
const fixtureSourceCoverage = record(fixture.sourceCoverage);
const fixtureActorMatrix = record(fixtureSourceCoverage?.actorSourceCoverageMatrix);
const fixtureActorRows = recordArray(fixtureActorMatrix?.rows);
const fixtureApt42Coverage = fixtureActorRows.find((row) => row.actor === "APT42");

if (fixtureScheduler?.nextPollSeconds !== 3) failures.push("Fixture must expose 3-second scheduler polling");
if (fixtureQueueDecision?.decision !== "reuse_active_run") failures.push("Fixture must exercise duplicate active-run reuse");
if (fixtureQueueDecision?.retryAfterSeconds !== 3) failures.push("Fixture must exercise retry/backoff visibility");
if (fixtureQueueDecision?.duplicateRunReuse !== "required_before_enqueue") failures.push("Fixture must require duplicate-run reuse before enqueue");
if (!stringArray(fixtureSourceCoverage?.gaps).includes("missing_public_channel_evidence")) {
  failures.push("Fixture must include a public-channel source coverage gap");
}
if (!fixtureApt42Coverage) failures.push("Fixture must include an APT42 actor source coverage matrix row");
if (fixtureApt42Coverage?.freshnessExpectation !== "daily") failures.push("Fixture APT42 coverage row must expose freshnessExpectation");
if (fixtureApt42Coverage?.highestValueMissingFamily !== "public_channel") failures.push("Fixture APT42 coverage row must expose highestValueMissingFamily");
if (fixtureApt42Coverage?.nextBestSourceAction !== "activate_public_channel") failures.push("Fixture APT42 coverage row must expose nextBestSourceAction");
if (fixtureApt42Coverage?.expectedTimeToUsefulSignal !== "1_3_days") failures.push("Fixture APT42 coverage row must expose expectedTimeToUsefulSignal");

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  title: manifest.title,
  categories: manifest.categories,
  exampleQueries: exampleInput?.queries,
  outputContract: "safe_metadata_only.v1"
}));

function parseExampleInput(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function recordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(record(item)))
    : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function enumValues(value: unknown): string[] {
  return stringArray(record(value)?.enum);
}

export {};
