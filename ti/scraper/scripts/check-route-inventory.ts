import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import { routeChecks } from "./routeInventoryChecks.ts";
import { runRouteCheck } from "./routeInventoryRunner.ts";
import { seedStore } from "./routeInventorySeed.ts";
import type { RouteResult } from "./routeInventoryTypes.ts";

const store = new InMemoryScraperStore();
const frontier = new FocusedFrontier();
seedStore(store, frontier);

const server = startApiServer({ port: 0, store, frontier });

try {
  const base = `http://127.0.0.1:${server.port}`;
  const results: RouteResult[] = [];
  for (const check of routeChecks()) {
    results.push(await runRouteCheck(base, check));
  }
  const ok = results.every((result) => result.ok);
  console.log(JSON.stringify({
    ok,
    command: "bun run check:route-inventory",
    expectedOutput: "ok=true; every mounted /v1 route returns compact safe response",
    routeCount: results.length,
    routes: results
  }, null, 2));
  if (!ok) process.exit(1);
} finally {
  server.stop();
}
