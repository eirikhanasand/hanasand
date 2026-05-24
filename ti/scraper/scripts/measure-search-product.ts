import { promoteSearchResultToCanonicalCapture } from "../src/adapters/clearWebPromotion.ts";
import { handleApiRequest } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import type { SourceRecord } from "../src/types.ts";

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

async function main(): Promise<void> {
  const coldStore = new InMemoryScraperStore();
  const capturedStore = new InMemoryScraperStore();
  await seedCapturedEvidence(capturedStore);

  const scenarios = [
    await measureScenario("empty_store_cold_start", coldStore),
    await measureScenario("captured_clear_web_evidence", capturedStore)
  ];

  console.log(JSON.stringify({
    measuredAt: new Date().toISOString(),
    purpose: "User-visible /v1/intel/search usefulness: expected fact recall, relevant result coverage, and latency.",
    scoring: {
      expectedFactRecall: "matched expected CTI terms in the public search response divided by expected terms for the query",
      usefulAnswer: "expected fact recall >= 0.6, at least one captured page, and at least one extracted entity or indicator",
      unexpectedCrossTalkTerms: "terms from other fixture actors that appear in the response"
    },
    scenarios
  }, null, 2));
}

async function measureScenario(scenario: string, store: InMemoryScraperStore): Promise<ScenarioMeasurement> {
  const frontier = new FocusedFrontier();
  const queries: QueryMeasurement[] = [];

  for (const fixture of fixtures) {
    const started = performance.now();
    const response = await handleApiRequest(
      new Request(`http://local/v1/intel/search?q=${encodeURIComponent(fixture.query)}&entityType=${fixture.entityType}`),
      { store, frontier }
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
  const expectedFactRecall = round(matchedExpectedTerms.length / fixture.expectedTerms.length);
  return {
    query: fixture.query,
    status: typeof payload.status === "string" ? payload.status : "unknown",
    latencyMs,
    expectedFactRecall,
    matchedExpectedTerms,
    unexpectedCrossTalkTerms,
    usefulAnswer: expectedFactRecall >= 0.6 && capturedPageCount > 0 && indicatorCount + entityCount > 0,
    sourceCount,
    indicatorCount,
    entityCount,
    capturedPageCount,
    summary: stringArray(record(payload.actorProfile)?.summary ?? payload.summary).slice(0, 3)
  };
}

async function seedCapturedEvidence(store: InMemoryScraperStore): Promise<void> {
  const source = measurementSource();
  store.saveSource(source);
  const fetcher = fixtureFetcher();
  for (const [index, fixture] of fixtures.entries()) {
    const url = `https://measure.example.test/research/${fixture.slug}?utm_source=search#summary`;
    await promoteSearchResultToCanonicalCapture(store, source, {
      query: fixture.query,
      provider: "fixture_public_search",
      resultId: `fixture-${fixture.slug}`,
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

function fixtureFetcher() {
  return async (input: string | URL | Request): Promise<Response> => {
    const url = typeof input === "string" || input instanceof URL ? new URL(input.toString()) : new URL(input.url);
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

function measurementSource(): SourceRecord {
  const timestamp = "2026-05-24T00:00:00.000Z";
  return {
    id: "src_measure_clear_web",
    name: "Measured Clear Web Fixture",
    type: "static_web",
    url: "https://measure.example.test/research/index",
    accessMethod: "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.9,
    language: "en",
    crawlFrequencySeconds: 3600,
    legalNotes: "Synthetic safe public CTI pages used to measure search usefulness without contacting external sites.",
    createdAt: timestamp,
    updatedAt: timestamp
  };
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
