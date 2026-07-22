type Probe = { status: number; body: string; json?: Record<string, unknown> };

const queries = (process.env.TI_SEARCH_READINESS_QUERIES ?? process.env.TI_SEARCH_READINESS_QUERY ?? "Scattered Spider")
  .split(",")
  .map((query) => query.trim())
  .filter(Boolean);
const scraperBase = base(process.env.TI_SCRAPER_INTERNAL_BASE ?? "http://ti-scraper:8097");
const publicPageBase = process.env.PUBLIC_TI_SEARCH_URL;
const publicApiUrl = process.env.PUBLIC_TI_API_SEARCH_URL ?? process.env.PUBLIC_TI_API_BASE_URL ?? "https://api.hanasand.com/api/ti/search";
const requireGetApiProof = process.env.TI_REQUIRE_GET_API_PROOF === "true";
const failures: string[] = [];

for (const query of queries) {
  const searchUrl = `${scraperBase}/v1/intel/search?q=${encodeURIComponent(query)}&entityType=actor`;
  const [health, search, publicPage, publicApiPost, publicApiGet] = await Promise.all([
    probe(`${scraperBase}/v1/health`),
    probe(searchUrl),
    probe(publicPageBase ?? `https://hanasand.com/ti?q=${encodeURIComponent(query)}`),
    probe(publicApiUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query }) }),
    requireGetApiProof ? probe(`${publicApiUrl}?q=${encodeURIComponent(query)}`) : undefined
  ]);
  const checks = [
    check("scraper_health", health.status === 200 && health.json?.ok === true, health.status),
    check("scraper_search", search.status === 200 && safe(search.body), search.status),
    check("scraper_search_contract", validSearch(search.json, query), search.status),
    check("public_ti_page", publicPage.status >= 200 && publicPage.status < 400 && safe(publicPage.body), publicPage.status),
    check("public_api_post", publicApiPost.status >= 200 && publicApiPost.status < 400 && safe(publicApiPost.body), publicApiPost.status),
    ...(publicApiGet ? [check("public_api_get", publicApiGet.status >= 200 && publicApiGet.status < 400 && safe(publicApiGet.body), publicApiGet.status)] : [])
  ];
  for (const result of checks) {
    console.log(JSON.stringify({ event: "scraper_native_search_readiness.check", query, ...result }));
    if (!result.ok) failures.push(`${query}: ${result.name} returned ${result.status}`);
  }
}

console.log(JSON.stringify({ event: "scraper_native_search_readiness.summary", ok: failures.length === 0, queryCount: queries.length, failures }));
if (failures.length) throw new Error(failures.join("\n"));

async function probe(url: string, init?: RequestInit): Promise<Probe> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    const body = await response.text();
    let json: Record<string, unknown> | undefined;
    try {
      const value: unknown = JSON.parse(body);
      if (value && typeof value === "object" && !Array.isArray(value)) json = value as Record<string, unknown>;
    } catch {
    }
    return { status: response.status, body, json };
  } catch (error) {
    return { status: 599, body: error instanceof Error ? error.message : String(error) };
  }
}

function safe(body: string): boolean {
  return !/local-proof\.test|readiness proof placeholder|fixture_public_search|outer fallback/i.test(body);
}

function validSearch(record: Record<string, unknown> | undefined, query: string): boolean {
  return record?.query === query
    && record.mode === "scraper"
    && typeof record.runId === "string"
    && typeof record.generatedAt === "string"
    && typeof record.refreshAfterSeconds === "number"
    && record.publicTiAnswer !== null
    && typeof record.publicTiAnswer === "object";
}

function check(name: string, ok: boolean, status: number) {
  return { name, ok, status };
}

function base(value: string): string {
  return value.replace(/\/$/, "");
}
