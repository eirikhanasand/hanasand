import { contractIndex } from "../src/api/contractsRoute.ts";
import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";

const server = startApiServer({ port: 0, store: new InMemoryScraperStore(), frontier: new FocusedFrontier() });
const routes = contractIndex().routeInventory.routes;
const results: Array<Record<string, unknown>> = [];

try {
  for (const route of routes) {
    const dynamic = route.path.includes(":");
    let path = route.path
      .replace(":claimId", "missing_claim")
      .replace(":sourceId", "missing_source")
      .replace(":alertId", "missing_alert")
      .replace(":caseId", "missing_case");
    if (["/v1/intel/search", "/api/ti/search", "/v1/quality/evaluate"].includes(path)) path += "?q=Made%20Up%20Actor";
    const response = await fetch(`http://127.0.0.1:${server.port}${path}`, {
      method: route.method,
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "tenant_route_inventory",
        "x-actor-id": "actor_route_inventory",
        "idempotency-key": `route-${route.method}-${route.path}`,
      },
      body: route.method === "GET" ? undefined : JSON.stringify(bodyFor(route.path)),
    });
    const text = await response.text();
    const mounted = response.status !== 405 && (dynamic || response.status !== 404);
    const safe = !/authorization:|cookie=|password=|\.onion|object_key|webhook_secret/i.test(text);
    results.push({ signature: `${route.method} ${route.path}`, status: response.status, mounted, safe });
  }
} finally {
  server.stop();
}

const failures = results.filter((result) => !result.mounted || !result.safe);
const ok = failures.length === 0;
console.log(JSON.stringify({
  ok,
  command: "bun run check:route-inventory",
  expectedOutput: "ok=true; every declared static route is mounted and all responses are safe",
  routeCount: results.length,
  failures,
}, null, 2));
if (!ok) process.exit(1);

function bodyFor(path: string): Record<string, unknown> {
  if (path === "/v1/intel/runs") return { query: "APT29", entityType: "actor" };
  if (path === "/v1/restricted-metadata/apply-plan" || path.includes("restricted-metadata/apply-plan")) return {};
  return {};
}
