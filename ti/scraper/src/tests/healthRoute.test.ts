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

  test("keeps public search responsive while mutations wait for storage", async () => {
    const store = new InMemoryScraperStore();
    let release = () => {};
    const blockedFlush = new Promise<void>((resolve) => { release = resolve; });
    (store as any).flush = () => blockedFlush;
    const server = startApiServer({
      port: 0,
      store,
      frontier: new FocusedFrontier(),
      authApiBase: "http://auth.test/api",
      authFetch: async () => Response.json({ id: "source-admin", roles: [{ id: "source_admin" }] }),
    } as any);

    try {
      for (const [path, init] of [
        ["/v1/intel/search?q=APT29", undefined],
        ["/api/ti/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "APT29" }) }],
      ] as const) {
        const response = await Promise.race([
          fetch(`http://127.0.0.1:${server.port}${path}`, init),
          Bun.sleep(200).then(() => undefined),
        ]);
        expect(response).toBeInstanceOf(Response);
        expect(response!.status).toBe(200);
      }

      const mutation = fetch(`http://127.0.0.1:${server.port}/v1/sources`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer valid", id: "source-admin" },
        body: JSON.stringify({
          name: "Vendor API",
          type: "api",
          url: "https://api.example.test/intel?q={query}",
          accessMethod: "official_api",
          status: "candidate",
          risk: "medium",
          legalNotes: "Approved vendor API fixture.",
        }),
      });
      expect(await Promise.race([mutation.then(() => true), Bun.sleep(50).then(() => false)])).toBe(false);
      expect(store.listSources()).toHaveLength(1);
      release();
      expect((await mutation).status).toBe(201);
    } finally {
      release();
      await server.stop();
    }
  });
});
