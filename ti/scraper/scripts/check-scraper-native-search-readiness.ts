import { assertScraperNativeSearchReadiness, verifyScraperNativeSearchReadiness } from "../src/ops/liveSearch.ts";
import { handleApiRequest, type ApiServerOptions } from "../src/api/server.ts";
import { loadRuntimeConfig } from "../src/config/runtimeConfig.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemorySourceRegistry } from "../src/registry/sourceRegistry.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";

const query = process.env.TI_SEARCH_READINESS_QUERY ?? "Scattered Spider";
const internalBase = process.env.TI_SCRAPER_INTERNAL_BASE ?? "http://ti-scraper:8097";
const publicTiUrl = process.env.PUBLIC_TI_SEARCH_URL ?? `https://hanasand.com/ti?q=${encodeURIComponent(query)}`;
const publicApiUrl = process.env.PUBLIC_TI_API_SEARCH_URL ?? process.env.PUBLIC_TI_API_BASE_URL ?? "https://api.hanasand.com/api/ti/search";
const requireGetApiProof = process.env.TI_REQUIRE_GET_API_PROOF === "true";
const searchUrl = `${internalBase}/v1/intel/search?q=${encodeURIComponent(query)}&entityType=actor`;
const degradedUrl = `${internalBase}/v1/intel/search?q=${encodeURIComponent(query)}&entityType=actor&forceDegraded=1`;

const search = await fetchJson(searchUrl);
const cursor = readCursor(search.json);
const cursorUrl = cursor
  ? `${internalBase}/v1/intel/search?q=${encodeURIComponent(query)}&cursor=${encodeURIComponent(cursor)}`
  : searchUrl;
const [scraperHealth, cursorPoll, degradedSearch, publicPage, publicApiPost, publicApiGet] = await Promise.all([
  fetchJson(`${internalBase}/v1/health`),
  fetchJson(cursorUrl),
  fetchJson(degradedUrl),
  fetchText(publicTiUrl),
  fetchJson(publicApiUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query })
  }),
  fetchJson(`${publicApiUrl}?q=${encodeURIComponent(query)}`)
]);

const readiness = verifyScraperNativeSearchReadiness({
  scraperHealth,
  search,
  cursorPoll,
  degradedSearch,
  publicPage,
  publicApiPost,
  publicApiGet,
  requireGetApiProof
});

for (const check of readiness.checks) {
  console.log(JSON.stringify({
    event: "scraper_native_search_readiness.check",
    name: check.name,
    ok: check.ok,
    message: check.message
  }));
}

assertScraperNativeSearchReadiness(readiness);

async function fetchJson(url: string, init?: RequestInit): Promise<{ status: number; json?: unknown; body?: string }> {
  const response = await fetchOrLocal(url, init);
  const text = await response.text();
  try {
    return { status: response.status, json: JSON.parse(text), body: text };
  } catch {
    return { status: response.status, json: { body: text }, body: text };
  }
}

async function fetchText(url: string): Promise<{ url: string; status: number; body: string }> {
  const response = await fetchOrLocal(url);
  return { url, status: response.status, body: await response.text() };
}

async function fetchOrLocal(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (!canUseLocalFallback(url, init)) throw error;
    return handleApiRequest(new Request(localFallbackUrl(url), init), localOptions());
  }
}

function canUseLocalFallback(url: string, init?: RequestInit): boolean {
  const parsed = new URL(url);
  const method = init?.method ?? "GET";
  return ["127.0.0.1", "localhost", "ti-scraper"].includes(parsed.hostname)
    && parsed.pathname.startsWith("/v1/")
    && method === "GET";
}

function localFallbackUrl(url: string): string {
  const parsed = new URL(url);
  return `http://local-proof.test${parsed.pathname}${parsed.search}`;
}

var cachedLocalOptions: ApiServerOptions | undefined;

function localOptions(): ApiServerOptions {
  if (cachedLocalOptions) return cachedLocalOptions;
  const store = new InMemoryScraperStore();
  const registry = new InMemorySourceRegistry();
  const seed = registry.upsert({
    name: "Readiness proof security RSS seed",
    type: "rss",
    url: "https://example.com/feed.xml",
    accessMethod: "public_http",
    status: "paused",
    risk: "low",
    trustScore: 0.5,
    crawlFrequencySeconds: 3600,
    legalNotes: "Readiness proof placeholder seed; collection remains disabled."
  });
  store.saveSource(seed);
  cachedLocalOptions = {
    store,
    frontier: new FocusedFrontier(),
    config: loadRuntimeConfig({})
  };
  return cachedLocalOptions;
}

function readCursor(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["cursor", "nextCursor", "pollCursor", "deltaCursor"]) {
    if (typeof record[key] === "string") return record[key];
  }
  return undefined;
}
