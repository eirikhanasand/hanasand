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
const expectedDefaultQueries = [
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
  "buyerCaveat",
  "expectedTimeToUsefulSignal",
  "pollingHint",
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
  "buyerCaveat",
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
const mainSource = await Bun.file("src/main.ts").text();
const datasetSchema = await Bun.file(".actor/DATASET_SCHEMA.json").json() as DatasetSchema;
const inputSchema = await Bun.file(".actor/INPUT_SCHEMA.json").text();
const fixture = await Bun.file("fixtures/apt42.json").json() as Record<string, unknown>;

const failures: string[] = [];

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
  for (const query of expectedDefaultQueries) {
    if (!queries.includes(query)) failures.push(`Example input must include ${query}`);
  }
  if (queries.length !== expectedDefaultQueries.length) failures.push(`Example input must contain exactly ${expectedDefaultQueries.length} default queries`);
  if (exampleInput.includeCoverageGaps !== true) failures.push("Example input must include coverage gaps");
  if (exampleInput.includeDatasets !== false) failures.push("Example input should keep dataset coverage disabled by default");
}

const combinedText = [
  JSON.stringify(manifest, null, 2),
  readme,
  changelog,
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
  ["scheduler decision", ["schedulerDecision"]],
  ["pay-per-event pricing", ["pay-per-event", "apify-default-dataset-item"]],
  ["actor start charge event", ["apify-actor-start"]],
  ["synthetic Apify event billing", ["apify_synthetic_events", "default dataset"]]
];

for (const [label, acceptedTerms] of contractMentions) {
  if (!acceptedTerms.some((term) => combinedText.includes(term))) {
    failures.push(`Publication contract must mention ${label}`);
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
