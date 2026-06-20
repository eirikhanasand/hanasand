type ActorManifest = {
  title?: string;
  description?: string;
  categories?: string[];
  exampleRunInput?: {
    body?: string;
    contentType?: string;
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

const requiredCategories = ["SECURITY", "MONITORING", "NEWS"];
const manifest = await Bun.file(".actor/actor.json").json() as ActorManifest;
const readme = await Bun.file("README.md").text();
const changelog = await Bun.file("CHANGELOG.md").text();
const datasetSchema = await Bun.file(".actor/DATASET_SCHEMA.json").text();
const inputSchema = await Bun.file(".actor/INPUT_SCHEMA.json").text();

const failures: string[] = [];

for (const field of ["title", "description"] as const) {
  if (!manifest[field]?.trim()) failures.push(`Missing actor manifest ${field}`);
}

for (const category of requiredCategories) {
  if (!manifest.categories?.includes(category)) failures.push(`Missing ${category} category`);
}

for (const generic of ["DEVELOPER_TOOLS", "AUTOMATION"]) {
  if (manifest.categories?.includes(generic)) failures.push(`Remove generic ${generic} category`);
}

const exampleInput = parseExampleInput(manifest.exampleRunInput?.body);
if (!exampleInput) {
  failures.push("Missing parseable exampleRunInput.body");
} else {
  const queries = Array.isArray(exampleInput.queries) ? exampleInput.queries : [];
  for (const query of ["APT29", "Volt Typhoon", "LockBit"]) {
    if (!queries.includes(query)) failures.push(`Example input must include ${query}`);
  }
  if (exampleInput.includeCoverageGaps !== true) failures.push("Example input must include coverage gaps");
  if (exampleInput.includeDatasets !== false) failures.push("Example input should keep dataset coverage disabled by default");
}

const combinedText = [
  JSON.stringify(manifest, null, 2),
  readme,
  changelog,
  datasetSchema,
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
  ["scheduler decision", ["schedulerDecision"]]
];

for (const [label, acceptedTerms] of contractMentions) {
  if (!acceptedTerms.some((term) => combinedText.includes(term))) {
    failures.push(`Publication contract must mention ${label}`);
  }
}

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

export {};
