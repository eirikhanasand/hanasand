import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const telegramSource: SourceRecord = {
  id: "src_bootstrap_tg",
  name: "Bootstrap public Telegram",
  type: "telegram_public",
  url: "https://t.me/bootstrap_public",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.82,
  legalNotes: "Public channel metadata only.",
  createdAt: "2026-06-30T10:00:00.000Z",
  updatedAt: "2026-06-30T10:00:00.000Z"
} as SourceRecord;

const darkwebSource: SourceRecord = {
  id: "src_bootstrap_onion",
  name: "Bootstrap onion metadata",
  type: "tor_metadata",
  url: "http://bootstrap-source.example.onion",
  accessMethod: "approved_proxy",
  status: "active",
  trustScore: 0.78,
  legalNotes: "Metadata-only onion source.",
  createdAt: "2026-06-30T10:00:00.000Z",
  updatedAt: "2026-06-30T10:00:00.000Z"
} as SourceRecord;

const telegramCapture: RawCapture = {
  id: "cap_bootstrap_tg_acme",
  sourceId: telegramSource.id,
  url: "https://t.me/bootstrap_public/12",
  collectedAt: "2026-06-30T10:04:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-bootstrap-tg-acme",
  sensitive: false,
  body: "acme.com appears in Lumma C2 public Telegram chatter with Okta live cookie exposure.",
  metadata: { adapter: "telegram_public", channel: "bootstrap_public", messageId: 12 }
} as RawCapture;

const darkwebCapture: RawCapture = {
  id: "cap_bootstrap_onion_acme",
  sourceId: darkwebSource.id,
  url: "http://bootstrap-source.example.onion/acme",
  collectedAt: "2026-06-30T10:08:00.000Z",
  mediaType: "text/plain",
  storageKind: "metadata_only",
  contentHash: "hash-bootstrap-onion-acme",
  sensitive: true,
  metadata: {
    adapter: "darknet_metadata",
    leakSite: {
      actorName: "Akira",
      victimName: "acme.com",
      description: "Metadata-only onion actor page claims acme.com procurement files.",
      captureMode: "metadata_only"
    }
  }
} as RawCapture;

describe("DWM source-matched alert bootstrap", () => {
  test("backfills delivery routing for an existing source-matched watchlist before readiness", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(telegramSource);
    store.saveSource(darkwebSource);
    store.saveCapture(telegramCapture);
    store.saveCapture(darkwebCapture);
    (store as any).saveDwmWatchlist({
      id: "dwm_watchlist_existing_source_matched",
      tenantId: "default",
      name: "Existing source-matched exposure watchlist",
      terms: [{ value: "acme.com", kind: "domain" }],
      status: "active",
      createdAt: "2026-06-30T10:10:00.000Z",
      updatedAt: "2026-06-30T10:10:00.000Z"
    });

    const options = { store, frontier: new FocusedFrontier() };
    const readiness = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/generation-readiness"), options);
    const readinessPayload = await readiness.json() as any;

    expect(readiness.status).toBe(200);
    expect(readinessPayload.readiness.readyForCustomerDelivery).toBe(true);
    expect(readinessPayload.readiness.webhookReadiness).toMatchObject({
      ready: true,
      missingRouteCandidateCount: 0
    });
    const savedWatchlist = (store as any).getDwmWatchlist("dwm_watchlist_existing_source_matched");
    expect(savedWatchlist.webhookDestinationId).toEqual(expect.any(String));
    expect(savedWatchlist.orgWatchlistTerms).toEqual([expect.objectContaining({
      organizationId: "default",
      value: "acme.com",
      alertGeneratorKey: expect.stringContaining("org:default:watchlist:")
    })]);
  });

  test("attaches generated source-matched terms to the default delivery route for public intake", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(telegramSource);
    store.saveSource(darkwebSource);
    store.saveCapture(telegramCapture);
    store.saveCapture(darkwebCapture);

    const options = { store, frontier: new FocusedFrontier() };
    const list = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts"), options);
    const payload = await list.json() as any;

    expect(list.status).toBe(200);
    expect(payload.alerts.length).toBeGreaterThan(0);
    const savedWatchlist = (store as any).listDwmWatchlists()[0];
    const webhookDestinationId = String(savedWatchlist.webhookDestinationId);
    expect(savedWatchlist).toMatchObject({
      tenantId: "default",
      status: "active",
      webhookDestinationId: expect.any(String),
      orgWatchlistTerms: [expect.objectContaining({
        organizationId: "default",
        alertGeneratorKey: expect.stringContaining("org:default:watchlist:")
      })]
    });

    const destinations = (store as any).listWebhookDestinations();
    expect(destinations).toEqual([expect.objectContaining({
      organizationId: "default",
      tenantId: "default",
      status: "active",
      url: "https://hanasand.com/api/dwm/webhook-sink"
    })]);

    const acmeAlert = payload.alerts.find((alert: any) => alert.matchedTerm?.value === "acme.com");
    expect(acmeAlert).toBeTruthy();
    expect(acmeAlert.workflowContext.alertGeneratorKeys).toEqual([expect.stringContaining("org:default:watchlist:")]);
    expect(acmeAlert.workflowContext.webhookDestinationIds).toEqual([webhookDestinationId]);
    expect(acmeAlert.deliveryReadinessContext.blockerCodes).not.toContain("missing_org_ref");
    expect(acmeAlert.deliveryReadinessContext.blockerCodes).not.toContain("delivery_disabled");

    const readiness = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/generation-readiness"), options);
    const readinessText = await readiness.text();
    expect(`${readiness.status} ${readinessText}`).toStartWith("200 ");
    const readinessPayload = JSON.parse(readinessText) as any;
    expect(readinessPayload.readiness.readyForCustomerDelivery).toBe(true);
    expect(readinessPayload.readiness.webhookReadiness).toMatchObject({
      ready: true,
      missingRouteCandidateCount: 0
    });
    expect(readinessPayload.readiness.webhookReadiness.candidateIdsMissingRoute).toEqual([]);
  });

  test("persists an org-scoped alert from recent captures when saved watchlists miss, then preserves workflow on rebuild", async () => {
    const store = new InMemoryScraperStore();
    store.saveOrganization({
      id: "org_bootstrap_acme",
      tenantId: "tenant_bootstrap_acme",
      name: "Acme Payments",
      slug: "acme-payments",
      status: "active",
      createdAt: "2026-06-30T09:59:00.000Z",
      updatedAt: "2026-06-30T09:59:00.000Z"
    });
    store.saveOrganizationMember({
      id: "member_bootstrap_owner",
      organizationId: "org_bootstrap_acme",
      email: "analyst@acme.example",
      role: "owner",
      status: "active",
      createdAt: "2026-06-30T09:59:00.000Z",
      updatedAt: "2026-06-30T09:59:00.000Z"
    });
    store.saveWebhookDestination({
      id: "webhook_bootstrap_acme",
      organizationId: "org_bootstrap_acme",
      tenantId: "tenant_bootstrap_acme",
      name: "Acme security webhook",
      url: "https://hooks.example.test/acme",
      kind: "generic",
      status: "active",
      createdAt: "2026-06-30T09:59:00.000Z",
      updatedAt: "2026-06-30T09:59:00.000Z"
    });
    store.saveSource(telegramSource);
    store.saveSource(darkwebSource);
    store.saveCapture(telegramCapture);
    store.saveCapture(darkwebCapture);

    const options = { store, frontier: new FocusedFrontier() };
    const firstList = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts?organizationId=org_bootstrap_acme", {
      headers: { "x-user-email": "analyst@acme.example" }
    }), options);
    const firstPayload = await firstList.json() as any;

    expect(firstList.status).toBe(200);
    expect(firstPayload.alerts).toHaveLength(2);
    expect(firstPayload.alerts.map((alert: any) => alert.sourceFamily).sort()).toEqual(["darkweb_metadata", "telegram_public"]);
    const telegramAlert = firstPayload.alerts.find((alert: any) => alert.sourceFamily === "telegram_public");
    expect(telegramAlert).toMatchObject({
      organizationId: "org_bootstrap_acme",
      tenantId: "tenant_bootstrap_acme",
      matchedTerm: { value: "acme.com", kind: "domain" },
      recommendedRoute: expect.any(String),
      sourceFamily: "telegram_public"
    });
    expect(telegramAlert.evidence.length).toBeGreaterThan(0);
    expect(telegramAlert.confidenceReasoning.join(" ")).toContain("Watchlist term matched");
    expect(telegramAlert.provenance.captureIds).toEqual(expect.arrayContaining(["cap_bootstrap_tg_acme"]));
    expect(telegramAlert.sourceProvenanceSummary.generationEvidenceWindow.captureIds).toEqual(expect.arrayContaining(["cap_bootstrap_tg_acme", "cap_bootstrap_onion_acme"]));
    expect(telegramAlert.watchlistIds).toHaveLength(1);
    expect(telegramAlert.deliveryReadinessContext.webhookDestinationIds).toEqual(["webhook_bootstrap_acme"]);

    const savedWatchlist = (store as any).listDwmWatchlists()[0];
    expect(savedWatchlist).toMatchObject({
      organizationId: "org_bootstrap_acme",
      tenantId: "tenant_bootstrap_acme",
      status: "active",
      terms: [expect.objectContaining({ value: "acme.com", kind: "domain" })]
    });

    const alertId = telegramAlert.id;
    const patch = await handleApiRequest(new Request(`http://127.0.0.1/v1/dwm/alerts/${alertId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-user-email": "analyst@acme.example" },
      body: JSON.stringify({
        organizationId: "org_bootstrap_acme",
        status: "investigating",
        assignedOwner: "analyst@acme.example",
        note: "Validated Acme watchlist match."
      })
    }), options);
    expect(patch.status).toBe(200);

    const rebuild = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-email": "analyst@acme.example" },
      body: JSON.stringify({ organizationId: "org_bootstrap_acme" })
    }), options);
    const rebuildPayload = await rebuild.json() as any;
    expect(rebuild.status).toBe(200);
    expect(rebuildPayload.savedAlertCount).toBe(2);
    const rebuiltTelegramAlert = rebuildPayload.alerts.find((alert: any) => alert.id === alertId);
    expect(rebuiltTelegramAlert).toMatchObject({
      id: alertId,
      workflowStatus: "investigating",
      assignedOwner: "analyst@acme.example",
      workflowNote: "Validated Acme watchlist match."
    });
    expect(rebuiltTelegramAlert.workflowEvents.length).toBeGreaterThan(0);
    expect(rebuiltTelegramAlert.workflowContext.captureIds).toEqual(expect.arrayContaining(["cap_bootstrap_tg_acme"]));
    expect(rebuiltTelegramAlert.workflowContext.generationEvidenceWindow.captureIds).toEqual(expect.arrayContaining(["cap_bootstrap_tg_acme", "cap_bootstrap_onion_acme"]));
  });
});
