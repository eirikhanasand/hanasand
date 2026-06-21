import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";

const store = new InMemoryScraperStore();
store.saveCapture({
  id: "rc_cap_apt29",
  sourceId: "rc_public_source",
  taskId: "rc_task",
  url: "https://example.test/apt29",
  collectedAt: "2026-06-21T00:00:00.000Z",
  body: "APT29 linked to phishing against Northwind Health in healthcare. First seen 2026-06-20.",
  contentHash: "rc_hash",
  metadata: { title: "APT29 public activity", evidenceStage: "captured_page" }
} as any);

const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
const base = `http://127.0.0.1:${server.port}`;

try {
  const search = await get("/api/ti/search?q=APT29");
  const quality = await get("/v1/quality/evaluate?q=Akira");
  const darkweb = await get("/v1/darkweb/search?q=APT29&limit=5");
  const checks = [
    search.status === "ready" && search.rows?.length >= 1 && search.quality?.canPromoteToReady === true,
    quality.quality?.publicWarningCodes?.includes("alias_collision_warning"),
    Array.isArray(darkweb.results ?? darkweb.rows ?? [])
  ];
  const ok = checks.every(Boolean);
  console.log(JSON.stringify({ ok, command: "bun run check:ti-release-candidate", checks: { searchRows: search.rows?.length ?? 0, qualityWarnings: quality.quality?.publicWarningCodes ?? [], darkwebRoute: true } }, null, 2));
  if (!ok) process.exit(1);
} finally {
  server.stop();
}

async function get(path: string) {
  const response = await fetch(`${base}${path}`);
  if (response.status !== 200) throw new Error(`${path} failed with ${response.status}`);
  return await response.json() as any;
}
