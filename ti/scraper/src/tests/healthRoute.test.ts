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

  test("reports a materially backlogged write queue as unavailable", async () => {
    const store = new InMemoryScraperStore();
    (store as any).databaseHealthSnapshot = () => ({ ok: true, backend: "postgresql", pendingWrites: 1_200 });
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });

    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/v1/health`);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ ok: false, storage: { ok: false, status: "backlogged", pendingWrites: 1_200 } });
    } finally {
      await server.stop();
    }
  });

  test("keeps the service available when actor-scope integrity is degraded", async () => {
    const store = new InMemoryScraperStore();
    (store as any).databaseHealthSnapshot = () => ({ ok: false, databaseAvailable: true, actorProfileScopeReady: false, pendingWrites: 1 });
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });

    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/v1/health`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ ok: true, storage: { databaseAvailable: true, actorProfileScopeReady: false } });
    } finally {
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

  test("keeps source operations responsive while unrelated writes flush", async () => {
    const store = new InMemoryScraperStore();
    let release = () => {};
    const blockedFlush = new Promise<void>((resolve) => { release = resolve; });
    (store as any).flush = () => blockedFlush;
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier(), serviceToken: "source-ops-test" });

    try {
      const response = await Promise.race([
        fetch(`http://127.0.0.1:${server.port}/v1/intel/source-operations?summary=true`, {
          headers: { "x-hanasand-service-token": "source-ops-test" }
        }),
        Bun.sleep(200).then(() => undefined),
      ]);
      expect(response).toBeInstanceOf(Response);
      expect(response!.status).toBe(200);
    } finally {
      release();
      await server.stop();
    }
  });

  test("keeps public coverage responsive while unrelated writes flush", async () => {
    const store = new InMemoryScraperStore();
    let release = () => {};
    const blockedFlush = new Promise<void>((resolve) => { release = resolve; });
    (store as any).flush = () => blockedFlush;
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });

    try {
      const response = await Promise.race([
        fetch(`http://127.0.0.1:${server.port}/v1/public/coverage`),
        Bun.sleep(200).then(() => undefined),
      ]);
      expect(response).toBeInstanceOf(Response);
      expect(response!.status).toBe(200);
    } finally {
      release();
      await server.stop();
    }
  });

  test("keeps DWM product reads available while unrelated writes flush", async () => {
    const store = new InMemoryScraperStore();
    let release = () => {};
    const blockedFlush = new Promise<void>((resolve) => { release = resolve; });
    (store as any).flush = () => blockedFlush;
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });

    try {
      const response = await Promise.race([
        fetch(`http://127.0.0.1:${server.port}/v1/dwm/product`),
        Bun.sleep(200).then(() => undefined),
      ]);
      expect(response).toBeInstanceOf(Response);
      expect(response!.status).toBe(200);
      expect(await response!.json()).toMatchObject({ schemaVersion: "dwm.product.v1" });
    } finally {
      release();
      await server.stop();
    }
  });

  test("keeps DWM alerts readable while lazy projection repair persists", async () => {
    const store = new InMemoryScraperStore();
    (store as any).batch = async () => { throw new Error("read path must not flush storage"); };
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });

    try {
      const response = await fetch(`http://127.0.0.1:${server.port}/v1/dwm/alerts`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ alerts: [] });
    } finally {
      await server.stop();
    }
  });

  test("keeps the live exposure queue responsive while mutations wait for storage", async () => {
    const store = new InMemoryScraperStore();
    let release = () => {};
    const blockedFlush = new Promise<void>((resolve) => { release = resolve; });
    (store as any).flush = () => blockedFlush;
    const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier(), serviceToken: "queue-test-secret" });

    try {
      const response = await Promise.race([
        fetch(`http://127.0.0.1:${server.port}/v1/dwm/exposure-queue?limit=1&tenantId=default`, { headers: { "x-hanasand-service-token": "queue-test-secret" } }),
        Bun.sleep(200).then(() => undefined),
      ]);
      expect(response).toBeInstanceOf(Response);
      expect(await response!.json()).toMatchObject({ schemaVersion: "dwm.exposure_queue.v1", page: { total: 0 } });
    } finally {
      release();
      await server.stop();
    }
  });
});
