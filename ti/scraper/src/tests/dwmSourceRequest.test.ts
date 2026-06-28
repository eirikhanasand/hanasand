import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

describe("dwm source requests", () => {
  test("creates an active bounded public Telegram source", async () => {
    const store = new InMemoryScraperStore();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "https://t.me/public_threat_test", type: "telegram_channel", tenantId: "tenant_acme", priority: "high" })
    }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body.source.type).toBe("telegram_public");
    expect(body.source.status).toBe("active");
    expect(body.source.metadata.canaryPortfolio).toBe(true);
    expect(body.source.metadata.collectionBoundary.noPrivateAccess).toBe(true);
    expect(store.listSources()).toHaveLength(1);
  });

  test("blocks private Telegram invite links", async () => {
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "https://t.me/+privateInvite", type: "telegram_channel" })
    }), { store: new InMemoryScraperStore(), frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("telegram_policy_blocked");
  });

  test("queues restricted metadata requests instead of activating them", async () => {
    const store = new InMemoryScraperStore();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ target: "http://example.onion/posts", type: "restricted_metadata" })
    }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(202);
    expect(body.request.approvalState).toBe("queued");
    expect(store.listSources()).toHaveLength(0);
  });

  test("applies dark-web seed packs only when metadata-only approval is explicit", async () => {
    const store = new InMemoryScraperStore();
    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({
        seedPackIds: ["darkweb-actor-metadata-core"],
        activate: true,
        approveMetadataOnly: true,
        approvedBy: "analyst-1",
        limit: 4
      })
    }), { store, frontier: new FocusedFrontier() });
    const body = await response.json() as any;

    expect(response.status).toBe(201);
    expect(body.summary.darkwebMetadataCreated).toBe(4);
    expect(store.listSources()).toHaveLength(4);
    expect(store.listSources().every((source) => source.status === "active")).toBe(true);
    expect(store.listSources().every((source) => source.governance?.metadataOnly === true)).toBe(true);
  });
});
