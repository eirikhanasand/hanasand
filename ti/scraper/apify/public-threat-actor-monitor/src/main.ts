interface ActorInput {
  query?: string;
  queries?: string[];
  maxRowsPerQuery?: number;
  includeActivity?: boolean;
  includeTargets?: boolean;
  includeTtps?: boolean;
  includeSources?: boolean;
  includeDatasets?: boolean;
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
  notes: string[];
}

interface MarketplaceRow {
  query: string;
  rowType: "profile" | "activity" | "target" | "ttp" | "source" | "dataset";
  actor: string;
  title: string;
  summary: string;
  sourceType: "clear_web" | "public_channel" | "darknet_metadata" | "system";
  sourceName?: string;
  sourceUrl?: string;
  victimName?: string;
  claimedDate?: string;
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
  activityCount: number;
  freshnessStatus: "current" | "recent" | "stale" | "unknown";
  evidenceGrade: "corroborated" | "single_source" | "unverified";
  isActionable: boolean;
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

const DEFAULT_API_BASE = "https://api.hanasand.com/api/ti/search";
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

  await writeOutputs(rows);
  console.log(JSON.stringify({
    ok: true,
    rowCount: rows.length,
    queries: input.queries,
    outputContract: "safe_metadata_only.v1"
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
      rows.push({
        ...baseRow(response, generatedAt, lastSeen),
        rowType: "activity",
        title: item.title,
        summary: item.detail,
        sourceType: sourceType(source?.type),
        sourceName: source?.name,
        sourceUrl: safePublicUrl(item.url ?? source?.url),
        claimedDate: item.date,
        confidence: clampNumber(item.confidence, 0, 1),
        ...qualityFields(response, item.date, item.confidence, evidenceCount),
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
        provenanceHash: stableHash([response.query, ttp.name, ttp.attackId ?? "", ttp.tactic, ttp.detail].join("|"))
      });
    }
  }

  if (input.includeSources) {
    for (const source of response.sources) {
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
        provenanceHash: stableHash([response.query, dataset.name, dataset.type, dataset.coverage, dataset.status].join("|"))
      });
    }
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
    sourceCount: response.sources.length,
    sourceFamilyCount: quality.sourceFamilyCount,
    activityCount: response.recentActivity.length,
    freshnessStatus: quality.freshnessStatus,
    evidenceGrade: quality.evidenceGrade,
    isActionable: quality.isActionable,
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
  const sourceFamilies = new Set(response.sources.map((source) => sourceType(source.type)).filter((type) => type !== "system"));
  const freshnessStatus = freshnessFor(observedAt);
  const normalizedConfidence = clampNumber(confidence, 0, 1);
  const evidenceGrade = evidenceCount >= 2
    ? "corroborated"
    : evidenceCount === 1
      ? "single_source"
      : "unverified";

  return {
    sourceFamilyCount: sourceFamilies.size,
    freshnessStatus,
    evidenceGrade: evidenceGrade as MarketplaceRow["evidenceGrade"],
    isActionable: normalizedConfidence >= 0.6
      && evidenceCount > 0
      && (freshnessStatus === "current" || freshnessStatus === "recent"),
    hasDarknetMetadata: response.sources.some((source) => sourceType(source.type) === "darknet_metadata"),
    hasPublicChannelCoverage: response.sources.some((source) => sourceType(source.type) === "public_channel")
  };
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

async function writeOutputs(rows: MarketplaceRow[]) {
  await Bun.write("output.json", JSON.stringify(rows, null, 2));
  await pushRemoteApifyOutputs(rows);

  const outputStoreDir = process.env.APIFY_OUTPUT_KEY_VALUE_STORE_DIR;
  if (outputStoreDir) {
    await ensureDir(outputStoreDir);
    await Bun.write(`${outputStoreDir}/OUTPUT.json`, JSON.stringify(rows, null, 2));
  }

  const localStorageDir = process.env.APIFY_LOCAL_STORAGE_DIR;
  if (localStorageDir) {
    const datasetDir = `${localStorageDir}/datasets/default`;
    const keyValueDir = `${localStorageDir}/key_value_stores/default`;
    await ensureDir(datasetDir);
    await ensureDir(keyValueDir);
    await Bun.write(`${keyValueDir}/OUTPUT.json`, JSON.stringify(rows, null, 2));
    await Promise.all(rows.map((row, index) => {
      const id = String(index + 1).padStart(9, "0");
      return Bun.write(`${datasetDir}/${id}.json`, JSON.stringify(row, null, 2));
    }));
  }
}

async function pushRemoteApifyOutputs(rows: MarketplaceRow[]) {
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
      body: JSON.stringify(rows)
    });
    if (!response.ok) throw new Error(`Apify output record write returned ${response.status}`);
  }
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
  if (type.includes("web") || type.includes("rss") || type.includes("clear")) return "clear_web";
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
  if (response.datasets.some((dataset) => dataset.type === "darknet_metadata" && dataset.status === "metadata_only")) {
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

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value as number)));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
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
