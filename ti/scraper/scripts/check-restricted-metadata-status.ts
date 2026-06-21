import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";

const store = new InMemoryScraperStore();
store.saveCapture({
  id: "restricted_meta_smoke",
  sourceId: "darknet_meta_source",
  taskId: "restricted_meta_task",
  url: "hash://restricted-source",
  collectedAt: "2026-06-21T00:00:00.000Z",
  body: undefined,
  storageKind: "metadata_only",
  sensitive: true,
  contentHash: "restricted_hash",
  metadata: { title: "metadata-only restricted claim", evidenceStage: "metadata_only_claim", safeEntityHints: { victims: ["Example Corp"], sectors: ["healthcare"] } }
} as any);

const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
try {
  const response = await fetch(`http://127.0.0.1:${server.port}/v1/restricted-metadata/status?q=Example`);
  const body = await response.json() as any;
  if (response.status !== 200) throw new Error(`status route failed: ${response.status}`);
  if (!JSON.stringify(body).includes("metadata")) throw new Error("metadata status did not mention metadata handling");
  if (/password=|cookie=|privateInvite|rawText|downloadUrl/i.test(JSON.stringify(body))) throw new Error("restricted status leaked unsafe fields");
  console.log(JSON.stringify({ ok: true, command: "bun run check:restricted-metadata-status", endpoint: "/v1/restricted-metadata/status" }, null, 2));
} finally {
  server.stop();
}
