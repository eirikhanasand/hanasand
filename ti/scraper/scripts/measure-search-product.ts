import { promoteSearchResultToCanonicalCapture } from "../src/adapters/clearWebPromotion.ts";
import { handleApiRequest } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { processCollectedItem } from "../src/pipeline/pipeline.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import type { SourceRecord } from "../src/types.ts";
import type { SeedSourceBundle } from "../src/registry/sourceSeeds.ts";
import { hashContent } from "../src/utils.ts";

type EntityType = "actor" | "cve" | "free_text";

interface QueryFixture {
  query: string;
  entityType: EntityType;
  slug: string;
  title: string;
  expectedTerms: string[];
  disallowedTerms: string[];
  body: string;
}

interface QueryMeasurement {
  query: string;
  status: string;
  latencyMs: number;
  expectedFactRecall: number;
  matchedExpectedTerms: string[];
  unexpectedCrossTalkTerms: string[];
  usefulAnswer: boolean;
  sourceCount: number;
  indicatorCount: number;
  entityCount: number;
  capturedPageCount: number;
  metadataOnlyClaimCount: number;
  summary: string[];
}

interface ScenarioMeasurement {
  scenario: string;
  aggregate: {
    queryCount: number;
    medianLatencyMs: number;
    p95LatencyMs: number;
    averageExpectedFactRecall: number;
    usefulAnswerRate: number;
    averageSourceCount: number;
    averageEvidenceItemCount: number;
    totalUnexpectedCrossTalkTerms: number;
  };
  queries: QueryMeasurement[];
}

const fixtures: QueryFixture[] = [
  {
    query: "APT29",
    entityType: "actor",
    slug: "apt29",
    title: "APT29 phishing campaign against government targets",
    expectedTerms: ["apt29", "phishing", "government", "cve-2026-1001", "wellmess"],
    disallowedTerms: ["scattered spider", "volt typhoon", "akira ransomware", "turla"],
    body: "APT29 used phishing against government targets in the United States and United Kingdom. The report links WellMess activity to CVE-2026-1001 exploitation and command and control infrastructure apt29-command.example.org."
  },
  {
    query: "Scattered Spider",
    entityType: "actor",
    slug: "scattered-spider",
    title: "Scattered Spider intrusion activity in telecommunications",
    expectedTerms: ["scattered spider", "sms phishing", "telecommunications", "credential dumping", "anydesk"],
    disallowedTerms: ["apt29", "volt typhoon", "akira ransomware", "turla"],
    body: "Scattered Spider targeted telecommunications help desks with SMS phishing, credential dumping, and AnyDesk remote access. Victim: Example Telecom. Sector: telecommunications. Country: United States."
  },
  {
    query: "Volt Typhoon",
    entityType: "actor",
    slug: "volt-typhoon",
    title: "Volt Typhoon living off the land activity",
    expectedTerms: ["volt typhoon", "energy", "living off the land", "china", "persistence"],
    disallowedTerms: ["apt29", "scattered spider", "akira ransomware", "turla"],
    body: "Volt Typhoon activity focused on energy and communications organizations. Analysts observed living off the land persistence techniques attributed to China-nexus operations. Sector: energy. Country: China."
  },
  {
    query: "Akira ransomware",
    entityType: "actor",
    slug: "akira-ransomware",
    title: "Akira ransomware campaign against manufacturing",
    expectedTerms: ["akira ransomware", "manufacturing", "ransomware", "exfiltration", "cve-2026-2222"],
    disallowedTerms: ["apt29", "scattered spider", "volt typhoon", "turla"],
    body: "Akira ransomware operators targeted manufacturing companies with data exfiltration and ransomware deployment. Victim: Example Manufacturing. The advisory notes exploitation of CVE-2026-2222."
  },
  {
    query: "Turla",
    entityType: "actor",
    slug: "turla",
    title: "Turla Snake malware campaign",
    expectedTerms: ["turla", "snake", "government", "ukraine", "command and control"],
    disallowedTerms: ["apt29", "scattered spider", "volt typhoon", "akira ransomware"],
    body: "Turla used Snake malware and command and control infrastructure against government organizations in Ukraine. Sector: government. Country: Ukraine."
  },
  {
    query: "CVE-2026-12345",
    entityType: "cve",
    slug: "cve-2026-12345",
    title: "CVE-2026-12345 exploitation advisory",
    expectedTerms: ["cve-2026-12345", "exploit", "intrusion", "indicator", "ransomware"],
    disallowedTerms: ["apt29", "scattered spider", "volt typhoon", "turla"],
    body: "CVE-2026-12345 exploitation has been observed in intrusion activity. Public indicators include exploit telemetry, malicious domain cve-2026-12345-watch.example.com, and ransomware deployment attempts."
  }
];

const restrictedMetadataFixtures: QueryFixture[] = [
  {
    query: "Fjord Energy AS",
    entityType: "free_text",
    slug: "fjord-energy-restricted-metadata",
    title: "Akira restricted metadata claim for Fjord Energy AS",
    expectedTerms: ["fjord energy as", "akira", "18,432", "employees and customers", "42 gb", "2026-05-20", "payment within 72 hours"],
    disallowedTerms: ["apt29", "scattered spider", "volt typhoon", "turla"],
    body: "metadata-only restricted claim"
  }
];

async function main(): Promise<void> {
  const coldStore = new InMemoryScraperStore();
  const capturedStore = new InMemoryScraperStore();
  const restrictedStore = new InMemoryScraperStore();
  await seedCapturedEvidence(capturedStore);
  seedRestrictedMetadataEvidence(restrictedStore);
  const sourcePacks = [measurementSourcePack()];
  const publicClearWebFetcher = fixtureFetcher();

  const scenarios = [
    await measureScenario("empty_store_on_demand_source_pack", coldStore, { sourcePacks, publicClearWebFetcher }),
    await measureScenario("captured_clear_web_evidence", capturedStore, { sourcePacks, publicClearWebFetcher }),
    await measureScenario("restricted_metadata_only_leak_claims", restrictedStore, {
      disableBundledSourcePack: true,
      disableOnDemandClearWebCapture: true
    }, restrictedMetadataFixtures)
  ];

  console.log(JSON.stringify({
    measuredAt: new Date().toISOString(),
    purpose: "User-visible /v1/intel/search usefulness: expected fact recall, relevant result coverage, and latency.",
    scoring: {
      expectedFactRecall: "matched expected CTI terms in the public search response divided by expected terms for the query",
      usefulAnswer: "expected fact recall >= 0.6, captured-page or metadata-only evidence, and at least one extracted entity or indicator",
      unexpectedCrossTalkTerms: "terms from other fixture actors that appear in the response"
    },
    scenarios
  }, null, 2));
}

async function measureScenario(
  scenario: string,
  store: InMemoryScraperStore,
  options: { sourcePacks?: SeedSourceBundle[]; publicClearWebFetcher?: typeof fetch; disableBundledSourcePack?: boolean; disableOnDemandClearWebCapture?: boolean } = {},
  queryFixtures = fixtures
): Promise<ScenarioMeasurement> {
  const frontier = new FocusedFrontier();
  const queries: QueryMeasurement[] = [];

  for (const fixture of queryFixtures) {
    const started = performance.now();
    const response = await handleApiRequest(
      new Request(`http://local/v1/intel/search?q=${encodeURIComponent(fixture.query)}&entityType=${fixture.entityType}`),
      {
        store,
        frontier,
        sourcePacks: options.sourcePacks,
        publicClearWebFetcher: options.publicClearWebFetcher,
        disableBundledSourcePack: options.disableBundledSourcePack,
        disableOnDemandClearWebCapture: options.disableOnDemandClearWebCapture
      }
    );
    const latencyMs = round(performance.now() - started);
    const payload = await response.json() as Record<string, unknown>;
    queries.push(scoreQuery(fixture, payload, latencyMs));
  }

  return {
    scenario,
    aggregate: {
      queryCount: queries.length,
      medianLatencyMs: percentile(queries.map((item) => item.latencyMs), 0.5),
      p95LatencyMs: percentile(queries.map((item) => item.latencyMs), 0.95),
      averageExpectedFactRecall: average(queries.map((item) => item.expectedFactRecall)),
      usefulAnswerRate: average(queries.map((item) => item.usefulAnswer ? 1 : 0)),
      averageSourceCount: average(queries.map((item) => item.sourceCount)),
      averageEvidenceItemCount: average(queries.map((item) => item.indicatorCount + item.entityCount)),
      totalUnexpectedCrossTalkTerms: queries.reduce((sum, item) => sum + item.unexpectedCrossTalkTerms.length, 0)
    },
    queries
  };
}

function scoreQuery(fixture: QueryFixture, payload: Record<string, unknown>, latencyMs: number): QueryMeasurement {
  const actorProfile = record(payload.actorProfile);
  const answer = record(payload.answer);
  const text = stringValues({
    summary: actorProfile.summary ?? payload.summary,
    aliases: actorProfile.aliases,
    recentActivity: actorProfile.recentActivity,
    targets: actorProfile.targets,
    ttps: actorProfile.ttps,
    malwareTools: actorProfile.malwareTools,
    vulnerabilities: actorProfile.vulnerabilities,
    publicAnswerSummary: answer.summary,
    claims: answer.claims,
    timeline: answer.timeline,
    warnings: answer.warnings
  }).join("\n").toLowerCase();
  const matchedExpectedTerms = fixture.expectedTerms.filter((term) => text.includes(term.toLowerCase()));
  const unexpectedCrossTalkTerms = fixture.disallowedTerms.filter((term) => text.includes(term.toLowerCase()));
  const datasets = record(record(payload.actorProfile)?.datasets ?? record(record(payload.answer)?.datasets));
  const quality = record(payload.quality);
  const stageCounts = record(quality.evidenceStageCounts ?? datasets.evidenceStageCounts);
  const sourceCount = numberValue(datasets.sourceCount);
  const indicatorCount = numberValue(datasets.indicatorCount);
  const entityCount = numberValue(datasets.entityCount);
  const capturedPageCount = numberValue(stageCounts.captured_page);
  const metadataOnlyClaimCount = numberValue(stageCounts.metadata_only_claim);
  const expectedFactRecall = round(matchedExpectedTerms.length / fixture.expectedTerms.length);
  return {
    query: fixture.query,
    status: typeof payload.status === "string" ? payload.status : "unknown",
    latencyMs,
    expectedFactRecall,
    matchedExpectedTerms,
    unexpectedCrossTalkTerms,
    usefulAnswer: expectedFactRecall >= 0.6 && (capturedPageCount > 0 || metadataOnlyClaimCount > 0) && indicatorCount + entityCount > 0,
    sourceCount,
    indicatorCount,
    entityCount,
    capturedPageCount,
    metadataOnlyClaimCount,
    summary: stringArray(record(payload.actorProfile)?.summary ?? payload.summary).slice(0, 3)
  };
}

async function seedCapturedEvidence(store: InMemoryScraperStore): Promise<void> {
  const fetcher = fixtureFetcher();
  for (const [index, fixture] of fixtures.entries()) {
    for (const source of measurementCaptureSources(fixture)) {
      store.saveSource(source);
      const url = `https://measure.example.test/research/${fixture.slug}?utm_source=${source.id}#summary`;
      await promoteSearchResultToCanonicalCapture(store, source, {
        query: fixture.query,
        provider: "fixture_public_search",
        resultId: `fixture-${fixture.slug}-${source.id}`,
        title: fixture.title,
        snippet: fixture.body.slice(0, 180),
        url,
        rank: index + 1,
        observedAt: "2026-05-24T00:00:00.000Z",
        confidence: 0.78
      }, {
        checkRobots: false,
        fetcher
      });
    }
  }
}

function seedRestrictedMetadataEvidence(store: InMemoryScraperStore): void {
  const source = restrictedMetadataSource();
  store.saveSource(source);
  const rawText = [
    "actor: Akira",
    "victim: Fjord Energy AS",
    "accounts affected: 18,432",
    "account subjects: employees and customers",
    "dataset size: 42 GB",
    "actor statement: payment within 72 hours",
    "date: 2026-05-20",
    "sector: energy",
    "country: Norway",
    "data category: employee records and customer contact data",
    "post status: listed",
    "source timestamp: 2026-05-20T09:30:00.000Z",
    "url hash: hash_restricted_fjord_energy",
    "screenshot hash: hash_screen_fjord_energy"
  ].join(" | ");
  store.savePipelineResult(processCollectedItem({
    sourceId: source.id,
    taskId: "task_restricted_metadata_measurement",
    url: "restricted-metadata://hash/hash_restricted_fjord_energy",
    collectedAt: "2026-05-24T00:00:00.000Z",
    publishedAt: "2026-05-20T09:30:00.000Z",
    title: "Akira / Fjord Energy AS restricted metadata claim",
    rawText,
    contentHash: hashContent(rawText),
    links: [],
    metadata: {
      adapter: "darknet_metadata",
      evidenceStage: "metadata_only_claim",
      safeExcerpt: rawText,
      leakSite: {
        actorName: "Akira",
        victimName: "Fjord Energy AS",
        affectedAccounts: "18,432",
        accountSubjects: "employees and customers",
        datasetSize: "42 GB",
        actorStatement: "payment within 72 hours",
        claimDate: "2026-05-20",
        claimedSector: "energy",
        claimedCountry: "Norway",
        claimedDataType: "employee records and customer contact data",
        claimedDataCategory: "employee records and customer contact data",
        postStatus: "listed",
        confidence: 0.68,
        sourceTimestamp: "2026-05-20T09:30:00.000Z",
        urlHash: "hash_restricted_fjord_energy",
        screenshotHash: "hash_screen_fjord_energy"
      },
      policyDecision: {
        id: "policy_restricted_metadata_measurement",
        allowed: true,
        metadataOnly: true
      }
    },
    sensitive: true
  }));
}

function restrictedMetadataSource(): SourceRecord {
  const timestamp = "2026-05-24T00:00:00.000Z";
  return {
    id: "src_measure_restricted_metadata",
    name: "Measured Restricted Metadata Source",
    type: "tor_metadata",
    url: "restricted-metadata://approved/hash-only",
    accessMethod: "approved_proxy",
    status: "active",
    risk: "high",
    trustScore: 0.72,
    language: "en",
    crawlFrequencySeconds: 3600,
    legalNotes: "Synthetic restricted metadata fixture; metadata only, no raw leak data or credentials.",
    createdAt: timestamp,
    updatedAt: timestamp,
    approvedAt: timestamp,
    approvedBy: "agent-06",
    governance: {
      approvalRequired: true,
      approvalState: "approved",
      metadataOnly: true,
      policyVersion: "collection-policy:v1"
    }
  };
}

function fixtureFetcher() {
  return async (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" || input instanceof URL ? new URL(input.toString()) : new URL(input.url);
    if (url.pathname === "/robots.txt") return new Response("User-agent: *\nAllow: /\n", { status: 200 });
    const feedFixture = fixtures.find((item) => url.pathname.endsWith(`/feeds/${item.slug}.xml`));
    if (feedFixture) {
      return new Response(rssFor(feedFixture), {
        status: 200,
        headers: {
          "content-type": "application/rss+xml; charset=utf-8",
          "etag": `"feed-${feedFixture.slug}"`
        }
      });
    }
    const fixture = fixtures.find((item) => url.pathname.endsWith(`/research/${item.slug}`));
    if (!fixture) return new Response("Not found", { status: 404 });
    const canonical = `https://measure.example.test/research/${fixture.slug}`;
    const html = [
      "<!doctype html>",
      "<html lang=\"en\">",
      "<head>",
      `<title>${escapeHtml(fixture.title)}</title>`,
      `<link rel=\"canonical\" href=\"${canonical}\">`,
      "</head>",
      "<body>",
      `<article><h1>${escapeHtml(fixture.title)}</h1><p>${escapeHtml(fixture.body)}</p></article>`,
      "</body>",
      "</html>"
    ].join("");
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "etag": `"${fixture.slug}"`
      }
    });
  };
}

function rssFor(fixture: QueryFixture): string {
  const link = `https://measure.example.test/research/${fixture.slug}`;
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<rss version=\"2.0\"><channel>",
    "<title>Measured CTI Feed</title>",
    "<item>",
    `<title>${escapeHtml(fixture.title)}</title>`,
    `<link>${link}</link>`,
    `<description>${escapeHtml(fixture.body)}</description>`,
    "<pubDate>Sun, 24 May 2026 00:00:00 GMT</pubDate>",
    "</item>",
    "</channel></rss>"
  ].join("");
}

function measurementSourcePack(): SeedSourceBundle {
  return {
    version: 1,
    name: "measured-safe-public-source-pack",
    description: "Synthetic safe-public source pack for product-usefulness measurement.",
    generatedAt: "2026-05-24T00:00:00.000Z",
    sources: fixtures.flatMap((fixture) => [
      measurementPackSource(fixture, "rss"),
      measurementPackSource(fixture, "static_web")
    ])
  };
}

function measurementPackSource(fixture: QueryFixture, type: "rss" | "static_web") {
  const slug = fixture.slug.replace(/-/g, "_");
  const isRss = type === "rss";
  return {
    id: `src_measure_pack_${slug}_${type}`,
    name: `Measured ${isRss ? "feed" : "research page"} ${fixture.title}`,
    type,
    url: isRss ? `https://measure.example.test/feeds/${fixture.slug}.xml` : `https://measure.example.test/research/${fixture.slug}`,
    accessMethod: "public_http",
    risk: "low",
    trustScore: isRss ? 0.88 : 0.84,
    language: "en",
    crawlFrequencySeconds: 3600,
    legalNotes: "Synthetic safe public CTI source used to measure on-demand collection behavior.",
    tags: ["public", "measurement", fixture.entityType],
    catalog: {
      canonicalId: `measurement:${fixture.slug}:${type}`,
      publisher: {
        name: isRss ? "Measurement Feed" : "Measurement Research",
        country: "US",
        homepage: "https://measure.example.test",
        trustBasis: "research"
      },
      tier: isRss ? "tier_1" : "tier_2",
      approvalScope: "safe_public_auto",
      license: "Synthetic measurement content.",
      legalBasis: "Synthetic public defensive CTI measurement fixture.",
      reliability: isRss ? 0.88 : 0.84,
      intelligenceValue: isRss ? 0.88 : 0.84,
      retentionClass: "standard",
      analystOwner: "agent-06",
      coverage: {
        topics: fixture.entityType === "cve" ? ["CVE", "vulnerability", "exploitation"] : ["actor", "threat-report", "TTP"],
        actors: fixture.entityType === "actor" ? [fixture.query] : [],
        aliases: [],
        industries: ["government", "telecommunications", "energy", "manufacturing"],
        regions: ["global"],
        countries: ["United States"],
        languages: ["en"],
        queryPatterns: [fixture.query]
      },
      collection: {
        freshnessTargetSeconds: 3600,
        collectionSlaSeconds: 3600,
        budgetClass: "low",
        crawlCadenceSeconds: 3600
      },
      adapterCompatibility: [type],
      rollback: {}
    }
  } as const;
}

function measurementCaptureSources(fixture: QueryFixture): SourceRecord[] {
  const timestamp = "2026-05-24T00:00:00.000Z";
  return ["primary", "corroborating"].map((variant, index) => ({
    id: `src_measure_clear_web_${fixture.slug.replace(/-/g, "_")}_${variant}`,
    name: `Measured ${variant} clear web fixture for ${fixture.title}`,
    type: "static_web",
    url: `https://measure.example.test/research/${fixture.slug}`,
    accessMethod: "public_http",
    status: "active",
    risk: "low",
    trustScore: index === 0 ? 0.9 : 0.82,
    language: "en",
    crawlFrequencySeconds: 3600,
    legalNotes: "Synthetic safe public CTI pages used to measure search usefulness without contacting external sites.",
    createdAt: timestamp,
    updatedAt: timestamp
  }));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(stringValues);
  return [];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * quantile) - 1))] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

await main();
