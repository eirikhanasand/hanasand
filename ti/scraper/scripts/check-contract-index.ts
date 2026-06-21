import { handleApiRequest } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";

const response = await handleApiRequest(new Request("http://127.0.0.1/v1/contracts"), {
  store: new InMemoryScraperStore(),
  frontier: new FocusedFrontier()
});
const payload = await response.json() as any;
const routes = payload?.routeInventory?.routes ?? [];
const required = ["/api/ti/search", "/v1/intel/search", "/v1/darkweb/search", "/v1/quality/evaluate"];
const missing = required.filter((path) => !routes.some((route: any) => route.path === path));

if (response.status !== 200) throw new Error(`contract endpoint failed: ${response.status}`);
if (payload.endpoint !== "/v1/contracts") throw new Error("contract endpoint marker missing");
if (payload.publicCompatibility?.unknownQueryCopy !== "searching") throw new Error("unknown query copy regressed");
if (payload.semantics?.safeMetadataOnly !== true) throw new Error("safe metadata contract missing");
if (missing.length) throw new Error(`missing buyer-visible routes: ${missing.join(", ")}`);

console.log(JSON.stringify({ ok: true, routes: routes.length, requiredRoutes: required }, null, 2));
