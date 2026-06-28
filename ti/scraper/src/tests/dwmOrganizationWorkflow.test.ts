import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir } from "./apiTestHarness.ts";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const source: SourceRecord = {
  id: "src_org_tg",
  name: "Org public Telegram",
  type: "telegram_public",
  url: "https://t.me/org_public",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.8,
  legalNotes: "Public preview only.",
  createdAt: "2026-06-28T12:00:00.000Z",
  updatedAt: "2026-06-28T12:00:00.000Z"
} as SourceRecord;

const capture: RawCapture = {
  id: "cap_org_acme",
  sourceId: source.id,
  url: "https://t.me/org_public/77",
  collectedAt: "2026-06-28T12:05:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-org-acme",
  sensitive: false,
  body: "acme.com appears in public Telegram chatter tied to Lumma C2 and Okta session cookie exposure.",
  metadata: { adapter: "telegram_public", channel: "org_public", messageId: 77 }
} as RawCapture;

describe("organization shared DWM workflow", () => {
  test("persists org membership, shared watchlists, alerts, and Discord delivery", async () => {
    const dir = mkdtempSync(join(tmpdir(), "dwm-org-workflow-"));
    try {
      const snapshotPath = join(dir, "store.json");
      const store = new FileBackedScraperStore({ snapshotPath });
      store.saveSource(source);
      store.saveCapture(capture);
      const seen: Array<{ url: string; body: any; headers: Headers }> = [];
      const options = {
        store,
        frontier: new FocusedFrontier(),
        webhookFetch: async (url: string, init: RequestInit) => {
          seen.push({ url, body: JSON.parse(String(init.body)), headers: new Headers(init.headers) });
          return new Response("accepted", { status: 204 });
        }
      };

      const orgResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/organizations", {
        method: "POST",
        headers: { "x-actor-id": "owner-1" },
        body: JSON.stringify({ name: "Acme Security", ownerEmail: "owner@acme.com" })
      }), options);
      const orgPayload = await orgResponse.json() as any;
      const organizationId = orgPayload.organization.id;

      expect(orgResponse.status).toBe(201);
      expect(orgPayload.organization.tenantId).toBe(organizationId);
      expect(orgPayload.owner.role).toBe("owner");
      expect(orgPayload.owner.status).toBe("active");

      const inviteEmails = Array.from({ length: 10 }, (_, index) => `analyst${index + 1}@acme.com`);
      const inviteResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/invites`, {
        method: "POST",
        headers: { "x-actor-id": "owner-1" },
        body: JSON.stringify({ emails: inviteEmails, role: "analyst" })
      }), options);
      const invitePayload = await inviteResponse.json() as any;

      expect(inviteResponse.status).toBe(201);
      expect(invitePayload.invites).toHaveLength(10);
      expect(invitePayload.members.filter((member: any) => member.status === "invited")).toHaveLength(10);

      const webhookResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/organizations/${organizationId}/webhooks`, {
        method: "POST",
        headers: { "x-actor-id": "owner-1" },
        body: JSON.stringify({ name: "SOC Discord", url: "https://discord.com/api/webhooks/123/token" })
      }), options);
      const webhookPayload = await webhookResponse.json() as any;

      expect(webhookResponse.status).toBe(201);
      expect(webhookPayload.destination.kind).toBe("discord");
      expect(webhookPayload.destination.organizationId).toBe(organizationId);

      const watchlistResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
        method: "POST",
        body: JSON.stringify({
          organizationId,
          name: "Shared Acme exposure watchlist",
          terms: ["acme.com", "Acme Security"],
          webhookDestinationId: webhookPayload.destination.id
        })
      }), options);
      const watchlistPayload = await watchlistResponse.json() as any;

      expect(watchlistResponse.status).toBe(201);
      expect(watchlistPayload.watchlist.organizationId).toBe(organizationId);
      expect(watchlistPayload.watchlist.tenantId).toBe(organizationId);
      expect(watchlistPayload.watchlist.webhookDestinationId).toBe(webhookPayload.destination.id);

      const rebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
        method: "POST",
        body: JSON.stringify({ organizationId })
      }), options);
      const rebuildPayload = await rebuildResponse.json() as any;

      expect(rebuildResponse.status).toBe(200);
      expect(rebuildPayload.savedAlertCount).toBe(1);
      expect(rebuildPayload.alerts[0].organizationId).toBe(organizationId);
      expect(rebuildPayload.alerts[0].tenantId).toBe(organizationId);

      const listResponse = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts?organizationId=${organizationId}`), options);
      const listPayload = await listResponse.json() as any;
      expect(listPayload.alerts).toHaveLength(1);

      const deliverResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
        method: "POST",
        body: JSON.stringify({ organizationId })
      }), options);
      const deliverPayload = await deliverResponse.json() as any;

      expect(deliverResponse.status).toBe(200);
      expect(deliverPayload.attemptedCount).toBe(1);
      expect(deliverPayload.deliveries[0]).toMatchObject({
        organizationId,
        webhookDestinationId: webhookPayload.destination.id,
        deliveryKind: "discord",
        status: "delivered"
      });
      expect(seen[0].url).toBe("https://discord.com/api/webhooks/123/token");
      expect(seen[0].headers.get("x-hanasand-event")).toBe("darkweb.monitoring.match");
      expect(seen[0].body.content).toContain("Hanasand alert");
      expect(seen[0].body.embeds[0].fields.some((field: any) => field.name === "Matched term" && field.value === "acme.com")).toBe(true);
      expect(seen[0].body.hanasand.organizationId).toBe(organizationId);

      const rehydrated = new FileBackedScraperStore({ snapshotPath });
      expect((rehydrated as any).listOrganizations()).toHaveLength(1);
      expect((rehydrated as any).listOrganizationMembers()).toHaveLength(11);
      expect((rehydrated as any).listOrganizationInvites()).toHaveLength(10);
      expect((rehydrated as any).listWebhookDestinations()).toHaveLength(1);
      expect((rehydrated as any).listDwmWatchlists()[0].organizationId).toBe(organizationId);
      expect((rehydrated as any).listDwmAlerts()[0].organizationId).toBe(organizationId);
      expect((rehydrated as any).listDwmWebhookDeliveries()[0].deliveryKind).toBe("discord");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
