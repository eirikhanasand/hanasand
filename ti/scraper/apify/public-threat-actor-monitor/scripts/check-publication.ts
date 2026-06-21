type ActorManifest = {
  title?: string;
  description?: string;
  categories?: string[];
  exampleRunInput?: { body?: string };
};

type DatasetSchema = {
  fields?: {
    properties?: Record<string, unknown>;
    required?: unknown;
  };
};

const manifest = await Bun.file(".actor/actor.json").json() as ActorManifest;
const readme = await Bun.file("README.md").text();
const datasetSchema = await Bun.file(".actor/DATASET_SCHEMA.json").json() as DatasetSchema;
const inputSchema = await Bun.file(".actor/INPUT_SCHEMA.json").text();
const outputSchema = await Bun.file(".actor/OUTPUT_SCHEMA.json").text();
const fixture = await Bun.file("fixtures/apt42.json").json() as Record<string, unknown>;

const failures: string[] = [];
const buyerText = [JSON.stringify(manifest), readme, inputSchema, outputSchema].join("\n");

requireText(manifest.title, "actor title");
requireText(manifest.description, "actor description");
requireCategory("SECURITY");
requireCategory("MONITORING");
rejectCategory("DEVELOPER_TOOLS");
rejectCategory("AUTOMATION");
rejectCategory("NEWS");
rejectTerms(buyerText, ["helloWorld", "placeholder", "TODO", "as an AI", "AI-generated", "ChatGPT", "language model"]);
rejectTerms(buyerText, ["governance", "DTO", "readiness theater", "agent_"]);
requireMentions(readme, [
  "fresh public threat actor and ransomware activity",
  "Safe metadata only",
  "no credential values",
  "pay-per-event",
  "100-name default watchlist",
  "paidRowDecision",
  "buyerValueScore",
  "nextSearchPivots"
]);
checkExampleInput();
checkDatasetSchema();
checkFixtureFreshness();

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  title: manifest.title,
  categories: manifest.categories,
  outputContract: "safe_metadata_only.v1"
}));

function checkExampleInput() {
  const parsed = parseObject(manifest.exampleRunInput?.body);
  if (!parsed) return failures.push("Missing parseable exampleRunInput.body");
  if (Array.isArray(parsed.queries) && parsed.queries.length > 0) {
    failures.push("Example input should use the default 100-name watchlist");
  }
  if (parsed.includeCoverageGaps !== false) failures.push("Example input should disable coverage gaps");
  if (parsed.includeHeldRows !== false) failures.push("Example input should disable held rows");
  if (parsed.includeDatasets !== false) failures.push("Example input should disable datasets");
}

function checkDatasetSchema() {
  const properties = datasetSchema.fields?.properties ?? {};
  const required = stringArray(datasetSchema.fields?.required);
  for (const field of [
    "query",
    "rowType",
    "actor",
    "title",
    "summary",
    "paidRowDecision",
    "buyerValueScore",
    "billingGuidance",
    "nextSearchPivots",
    "rawContentIncluded",
    "safety"
  ]) {
    if (!(field in properties)) failures.push(`Dataset schema missing ${field}`);
    if (!required.includes(field)) failures.push(`Dataset schema must require ${field}`);
  }
  if (record(properties.rawContentIncluded)?.const !== false) {
    failures.push("Dataset rawContentIncluded must be const false");
  }
  const safety = record(record(properties.safety)?.properties);
  if (record(safety?.metadataOnly)?.const !== true) failures.push("Dataset safety.metadataOnly must be true");
  if (record(safety?.credentialsIncluded)?.const !== false) failures.push("Dataset safety.credentialsIncluded must be false");
  if (record(safety?.stolenFilesIncluded)?.const !== false) failures.push("Dataset safety.stolenFilesIncluded must be false");
}

function checkFixtureFreshness() {
  const scheduler = record(fixture.scheduler);
  const queueDecision = record(record(scheduler?.interactiveSearchFreshness)?.queueDecision);
  const gaps = stringArray(record(fixture.sourceCoverage)?.gaps);
  if (scheduler?.nextPollSeconds !== 3) failures.push("Fixture must expose fast polling");
  if (queueDecision?.decision !== "reuse_active_run") failures.push("Fixture must reuse active runs");
  if (!gaps.includes("missing_public_channel_evidence")) failures.push("Fixture must expose a source coverage gap");
}

function requireCategory(category: string) {
  if (!manifest.categories?.includes(category)) failures.push(`Missing ${category} category`);
}

function rejectCategory(category: string) {
  if (manifest.categories?.includes(category)) failures.push(`Remove generic ${category} category`);
}

function requireText(value: string | undefined, label: string) {
  if (!value?.trim()) failures.push(`Missing ${label}`);
}

function rejectTerms(text: string, terms: string[]) {
  for (const term of terms) {
    if (text.toLowerCase().includes(term.toLowerCase())) failures.push(`Buyer-facing text contains ${term}`);
  }
}

function requireMentions(text: string, terms: string[]) {
  for (const term of terms) {
    if (!text.includes(term)) failures.push(`README must mention ${term}`);
  }
}

function parseObject(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return record(parsed) ?? null;
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export {};
