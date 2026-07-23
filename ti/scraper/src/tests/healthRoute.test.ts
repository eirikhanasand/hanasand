import { describe, expect, test } from "bun:test";
import { startApiServer } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("health route", () => {
  test("reports pending storage without waiting for unrelated writes to flush", async () => {
    const store = new InMemoryScraperStore();
    let release = () => {};
    const blockedFlush = new Promise<void>((resolve) => { release = resolve; });
    const blockedHealth = new Promise<void>(() => {});
    (store as any).flush = () => blockedFlush;
    (store as any).databaseHealth = () => blockedHealth;
    (store as any).databaseHealthSnapshot = () => ({ ok: true, backend: "postgresql", pendingWrites: 42 });
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });

    try {
      const response = await Promise.race([
        fetch(`http://127.0.0.1:${server.port}/v1/health`),
        Bun.sleep(200).then(() => undefined),
      ]);
      expect(response).toBeInstanceOf(Response);
      expect(await response!.json()).toMatchObject({ ok: true, storage: { pendingWrites: 42 } });
    } finally {
      release();
      await server.stop();
    }
  });
});
