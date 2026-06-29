import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const source: SourceRecord = {
  id: "src_webhook_tg",
  name: "Webhook Telegram",
  type: "telegram_public",
  url: "https://t.me/webhook_public",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.8,
  legalNotes: "Public preview only.",
  createdAt: "2026-06-27T21:00:00.000Z",
  updatedAt: "2026-06-27T21:00:00.000Z"
} as SourceRecord;

const capture: RawCapture = {
  id: "cap_webhook_acme",
  sourceId: source.id,
  url: "https://t.me/webhook_public/44",
  collectedAt: "2026-06-27T21:02:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-webhook-acme",
  sensitive: false,
  body: "acme.com appears in public Telegram chatter for Lumma C2 Okta session cookie exposure.",
  metadata: { adapter: "telegram_public", channel: "webhook_public", messageId: 44 }
} as RawCapture;

describe("dwm webhook delivery", () => {
  test("delivers saved alerts and records delivery attempts", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source);
    store.saveCapture(capture);
    const seen: Array<{ url: string; body: any; headers: Headers }> = [];
    const options = {
      store,
      frontier: new FocusedFrontier(),
      webhookFetch: async (url: string, init: RequestInit) => {
        seen.push({ url, body: JSON.parse(String(init.body)), headers: new Headers(init.headers) });
        return new Response("ok", { status: 202 });
      }
    };

    await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme", terms: ["acme.com"], webhookUrl: "https://hooks.example.com/dwm" })
    }), options);
    await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme" })
    }), options);

    const deliverResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme" })
    }), options);
    const delivered = await deliverResponse.json() as any;

    expect(deliverResponse.status).toBe(200);
    expect(delivered.attemptedCount).toBe(1);
    expect(delivered.deliveries[0].status).toBe("delivered");
    expect(seen[0].url).toBe("https://hooks.example.com/dwm");
    expect(seen[0].body.eventType).toBe("darkweb.monitoring.match");
    expect(seen[0].body).toMatchObject({
      tenantId: "tenant_acme",
      sourceFamily: "telegram_public",
      captureIds: ["cap_webhook_acme"],
      evidenceCount: 1,
      recommendedRoute: "identity_response"
    });
    expect(seen[0].body.caseIdCandidate).toMatch(/^case_/);
    expect(seen[0].body.casePath).toContain(`/v1/cases/${seen[0].body.caseIdCandidate}`);
    expect(seen[0].body.watchlistItemIds[0]).toContain("acme.com");
    expect(seen[0].body.matchContext).toMatchObject({
      normalizedTerm: "acme.com",
      termKind: "domain"
    });
    expect(seen[0].body.evidenceSummary).toMatchObject({
      evidenceCount: 1,
      sourceFamilyCounts: { telegram_public: 1 },
      publicSafeCount: 1
    });
    expect(seen[0].body.routingContext).toMatchObject({
      queue: "identity_response",
      urgency: "immediate",
      customerVisibleEvidence: "redacted_excerpt"
    });
    expect(seen[0].body.evidence[0].provenance).toMatchObject({
      captureId: "cap_webhook_acme",
      sourceId: "src_webhook_tg",
      metadataOnly: false
    });
    expect(seen[0].headers.get("x-hanasand-event")).toBe("darkweb.monitoring.match");
    expect((store as any).listDwmAlerts()[0].deliveryState).toBe("delivered");
    expect((store as any).listDwmWebhookDeliveries()).toHaveLength(1);
  });

  test("records skipped delivery when the watchlist has no webhook URL", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source);
    store.saveCapture(capture);
    const options = { store, frontier: new FocusedFrontier() };

    await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme", terms: ["acme.com"] })
    }), options);
    await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme" })
    }), options);

    const deliverResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme" })
    }), options);
    const delivered = await deliverResponse.json() as any;

    expect(deliverResponse.status).toBe(200);
    expect(delivered.attemptedCount).toBe(1);
    expect(delivered.deliveries[0].status).toBe("skipped");
    expect(delivered.deliveries[0].error).toContain("No webhook URL");
  });

  test("tests webhook delivery before a real alert exists", async () => {
    const store = new InMemoryScraperStore();
    const seen: Array<{ url: string; body: any; headers: Headers }> = [];
    const options = {
      store,
      frontier: new FocusedFrontier(),
      webhookFetch: async (url: string, init: RequestInit) => {
        seen.push({ url, body: JSON.parse(String(init.body)), headers: new Headers(init.headers) });
        return new Response("ok", { status: 204 });
      }
    };

    const invalidResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme", terms: ["acme.com"], webhookUrl: "ftp://hooks.example.com/dwm" })
    }), options);
    expect(invalidResponse.status).toBe(400);

    await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme", terms: ["acme.com"], webhookUrl: "https://hooks.example.com/dwm" })
    }), options);

    const testResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/test", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme" })
    }), options);
    const tested = await testResponse.json() as any;

    expect(testResponse.status).toBe(200);
    expect(tested.ok).toBe(true);
    expect(tested.delivery.status).toBe("delivered");
    expect(tested.delivery.alertId).toBe("webhook_test");
    expect(seen[0].url).toBe("https://hooks.example.com/dwm");
    expect(seen[0].body.eventType).toBe("darkweb.monitoring.test");
    expect(seen[0].headers.get("x-hanasand-event")).toBe("darkweb.monitoring.test");
    expect((store as any).listDwmWebhookDeliveries()).toHaveLength(1);
  });
});
