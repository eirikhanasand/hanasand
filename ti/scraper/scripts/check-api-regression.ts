import { handleApiRequest } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";

const store = new InMemoryScraperStore();
const frontier = new FocusedFrontier();
const options = { store, frontier };
const failures: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) failures.push(message);
};
const request = (path: string, init?: RequestInit) =>
  handleApiRequest(new Request(`http://127.0.0.1${path}`, init), options);

const contractsResponse = await request("/v1/contracts");
const contracts = await contractsResponse.json() as any;
const routeSignatures = (contracts.routeInventory?.routes ?? []).map((route: any) => `${route.method} ${route.path}`);
check(contractsResponse.status === 200, "contracts endpoint must return 200");
check(contracts.schemaVersion === "ti.api_contract_index.compact.v4", "contract schema version drifted");
check(contracts.routeInventory?.count === routeSignatures.length, "route inventory count drifted");
for (const signature of [
  "GET /v1/intel/search",
  "GET /api/ti/search",
  "POST /v1/intel/runs",
  "GET /v1/intel/captures",
  "GET /v1/darkweb/search",
  "GET /v1/contracts",
]) check(routeSignatures.includes(signature), `stable route missing: ${signature}`);
check(contracts.semantics?.safeMetadataOnly === true, "metadata-only contract missing");
check(contracts.semantics?.noCredentialCollection === true, "credential collection guard missing");

const searchResponse = await request("/v1/intel/search?q=Made%20Up%20Actor&entityType=actor");
const search = await searchResponse.json() as any;
check(searchResponse.status === 200, "unknown actor search must return 200");
check(search.status === "searching", "unknown actor search must remain searching");
check(search.publicTiAnswer?.noResult === true, "unknown actor search must expose no-result state");
check(search.publicTiAnswer?.safeSummary?.[0] === "Searching", "unknown actor search copy drifted");

const runInit = (query: string): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", "x-tenant-id": "tenant_regression", "idempotency-key": "regression-run" },
  body: JSON.stringify({ query, entityType: "actor" }),
});
const firstRunResponse = await request("/v1/intel/runs", runInit("APT29"));
const firstRun = await firstRunResponse.json() as any;
const reusedRunResponse = await request("/v1/intel/runs", runInit("APT29"));
const reusedRun = await reusedRunResponse.json() as any;
const conflictResponse = await request("/v1/intel/runs", runInit("APT28"));
const conflict = await conflictResponse.json() as any;
check(firstRunResponse.status === 201, "first idempotent run must be created");
check(reusedRunResponse.status === 200 && reusedRun.run?.id === firstRun.run?.id, "idempotent run must be reused");
check(conflictResponse.status === 409 && conflict.error?.code === "idempotency_conflict", "idempotency conflict contract drifted");

for (const index of [1, 2]) {
  store.saveCapture({
    id: `cap_regression_${index}`,
    tenantId: "tenant_regression",
    sourceId: "src_regression",
    url: `https://example.test/${index}`,
    collectedAt: `2026-07-20T00:00:0${index}.000Z`,
    contentHash: `hash_${index}`,
    mediaType: "text/plain",
    storageKind: "inline_text",
    body: `private regression body ${index}`,
    metadata: {},
    sensitive: false,
  } as any);
}
const pageResponse = await request("/v1/intel/captures?limit=1", { headers: { "x-tenant-id": "tenant_regression" } });
const page = await pageResponse.json() as any;
check(pageResponse.status === 200 && page.captures?.length === 1, "capture pagination page size drifted");
check(page.total === 2 && page.nextCursor === "1", "capture cursor pagination drifted");
check(page.captures?.[0]?.bodyRedacted === true, "capture body redaction drifted");

const mismatchResponse = await request("/v1/intel/search?q=APT29&tenantId=tenant_b", { headers: { "x-tenant-id": "tenant_a" } });
const mismatch = await mismatchResponse.json() as any;
check(mismatchResponse.status === 403 && mismatch.error?.code === "tenant_scope_mismatch", "tenant mismatch must fail closed");
const invalidResponse = await request("/v1/intel/search?q=");
const invalid = await invalidResponse.json() as any;
check(invalidResponse.status === 400 && invalid.error?.code === "invalid_search_query", "error envelope drifted");

const serialized = JSON.stringify({ contracts, search, firstRun, reusedRun, conflict, page, mismatch, invalid });
check(!/authorization:|cookie=|password=|private regression body|\.onion|object_key/i.test(serialized), "regression responses expose forbidden material");

const ok = failures.length === 0;
console.log(JSON.stringify({ event: "api_regression.check", ok, routeCount: routeSignatures.length, checks: 20, failures }));
if (!ok) process.exit(1);
