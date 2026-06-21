import { describe, expect, test } from "bun:test";
import { startApiServer } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("mounted evidence endpoint validation", () => {
  test("rejects invalid evidence endpoint query and run id through mounted server", async () => {
    const server = startApiServer({ port: 0, store: new InMemoryScraperStore(), frontier: new FocusedFrontier() });
    try {
      const base = `http://127.0.0.1:${server.port}`;
      const missingQuery = await fetch(`${base}/v1/evidence/replay-plan`);
      const missingRun = await fetch(`${base}/v1/evidence/cutover-report?q=APT29&runId=run_missing`);
      expect(missingQuery.status).toBe(400);
      expect(await missingQuery.json()).toMatchObject({ error: { code: "bad_request" } });
      expect(missingRun.status).toBe(404);
      expect(await missingRun.json()).toMatchObject({ error: { code: "not_found" } });
    } finally {
      server.stop();
    }
  });
});
