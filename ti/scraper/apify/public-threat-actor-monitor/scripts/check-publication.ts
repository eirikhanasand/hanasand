type ActorManifest = {
  title?: string;
  description?: string;
  categories?: string[];
  exampleRunInput?: { body?: string };
};
type DatasetSchema = { fields?: { properties?: Record<string, unknown>; required?: unknown } };
import { safePublicUrl } from "../src/utils.ts";

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
rejectTerms(buyerText, ["governance", "DTO", "readiness theater", "agent_", "as an ai", "proof", "safe metadata"]);
requireMentions(readme, ["public ransomware victim claims", "RansomLook recent posts", "RansomLook RSS", "RansomLook search", "broader post index", "ransomware.live", "DLS Monitor", "public source link", "source page", "what data the actor says", "matchedSearchTerm", "claimedDataSummary", "claimedDataTypes", "CISA Known Exploited Vulnerabilities", "recent NVD CVE updates", "Preview mode", "Full Monitoring Runs", "buyerSummary", "recommendedBuyerAction", "keyPivots", "$1.00 / 1,000 rows"]);
checkExampleInput();
checkDatasetSchema();
checkFixtureFreshness();
checkUrlSafety();

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, title: manifest.title, categories: manifest.categories, outputContract: "safe_metadata_only.v1" }));

function checkExampleInput() {
  const parsed = parseObject(manifest.exampleRunInput?.body);
  if (!parsed) return failures.push("Missing parseable exampleRunInput.body");
  if (parsed.runMode !== "preview") failures.push("Example input should default to preview mode");
  if (!Array.isArray(parsed.queries) || parsed.queries.length < 3 || parsed.queries.length > 10) failures.push("Example input should use a focused preview watchlist");
  if (parsed.maxTotalRows !== 500) failures.push("Example input should cap preview total rows at 500");
  if (parsed.maxRowsPerQuery !== 250) failures.push("Example input should cap preview rows per query at 250");
  if (parsed.includeSources !== false) failures.push("Example input should disable source reference rows for preview");
  if (parsed.includeCoverageGaps !== false) failures.push("Example input should disable coverage gaps");
  if (parsed.includeHeldRows !== false) failures.push("Example input should disable held rows");
  if (parsed.includeDatasets !== false) failures.push("Example input should disable datasets");
}

function checkDatasetSchema() {
  const properties = datasetSchema.fields?.properties ?? {};
  const required = stringArray(datasetSchema.fields?.required);
  for (const field of ["query", "rowType", "actor", "title", "summary", "matchedSearchTerm", "victimWebsite", "claimedDataSummary", "claimedDataSize", "claimedDataTypes", "actorPostUrl", "paidRowDecision", "buyerValueScore", "billingGuidance", "nextSearchPivots", "rawContentIncluded", "safety"]) {
    if (!(field in properties)) failures.push(`Dataset schema missing ${field}`);
  }
  for (const field of ["query", "rowType", "actor", "title", "summary", "paidRowDecision", "buyerValueScore", "billingGuidance", "nextSearchPivots", "rawContentIncluded", "safety"]) {
    if (!required.includes(field)) failures.push(`Dataset schema must require ${field}`);
  }
  const claimTypes = stringArray(record(properties.claimType)?.enum);
  if (!claimTypes.includes("vulnerability_disclosure")) failures.push("Dataset schema must allow vulnerability_disclosure claimType");
  if (record(properties.rawContentIncluded)?.const !== false) failures.push("Dataset rawContentIncluded must be const false");
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

function checkUrlSafety() {
  if (safePublicUrl("http://exampleabcd1234.onion/path")) failures.push("safePublicUrl must suppress onion URLs");
  if (safePublicUrl("https://www.ransomlook.io/blog/example") !== "https://www.ransomlook.io/blog/example") failures.push("safePublicUrl must allow normal HTTPS source URLs");
}

function requireCategory(category: string) { if (!manifest.categories?.includes(category)) failures.push(`Missing ${category} category`); }
function rejectCategory(category: string) { if (manifest.categories?.includes(category)) failures.push(`Remove generic ${category} category`); }
function requireText(value: string | undefined, label: string) { if (!value?.trim()) failures.push(`Missing ${label}`); }
function rejectTerms(text: string, terms: string[]) { for (const term of terms) if (text.toLowerCase().includes(term.toLowerCase())) failures.push(`Buyer-facing text contains ${term}`); }
function requireMentions(text: string, terms: string[]) { for (const term of terms) if (!text.includes(term)) failures.push(`README must mention ${term}`); }
function parseObject(value: string | undefined): Record<string, unknown> | null { try { return record(JSON.parse(value ?? "")) ?? null; } catch { return null; } }
function record(value: unknown): Record<string, unknown> | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

export {};
