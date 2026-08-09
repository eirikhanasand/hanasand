import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("run result evidence lookup", () => {
  test("resolves persisted run capture ids without enumerating the corpus", async () => {
    const store = new InMemoryScraperStore();
    store.saveCapture({
      id: "run_capture", tenantId: "tenant_run", sourceId: "source_run", url: "https://example.test/report",
      contentHash: "hash_run", collectedAt: "2026-08-09T10:00:00.000Z", processedAt: "2026-08-09T10:00:01.000Z",
      firstVisibleAt: "2026-08-09T10:00:02.000Z", mediaType: "text/html", storageKind: "inline_text", body: "Retained report", metadata: {}
    } as any);
    store.saveRun({ id: "run_results", tenantId: "tenant_run", status: "completed", captureIds: ["run_capture"] } as any);
    store.listCaptures = (() => { throw new Error("run results must not enumerate captures"); }) as any;

    const response = await handleApiRequest(new Request("http://local/v1/intel/runs/run_results/results", { headers: { "x-tenant-id": "tenant_run" } }), {
      store, frontier: new FocusedFrontier()
    } as any);
    expect(response.status).toBe(200);
    expect((await response.json() as any).results.captures.items).toHaveLength(1);
  });
});
