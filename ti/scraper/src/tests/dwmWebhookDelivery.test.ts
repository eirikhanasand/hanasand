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

const followupCapture: RawCapture = {
  id: "cap_webhook_acme_followup",
  sourceId: source.id,
  url: "https://t.me/webhook_public/45",
  collectedAt: "2026-06-27T21:11:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-webhook-acme-followup",
  sensitive: false,
  body: "Follow-up Telegram post repeats acme.com Lumma C2 Okta exposure with a new AWS IAM key reference.",
  metadata: { adapter: "telegram_public", channel: "webhook_public", messageId: 45 }
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

    const watchlistResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme", terms: ["acme.com"], webhookUrl: "https://discord.com/api/webhooks/dwm/token" })
    }), options);
    const watchlistPayload = await watchlistResponse.json() as any;
    expect(watchlistResponse.status).toBe(201);
    expect(watchlistPayload.alertRebuild).toMatchObject({
      savedAlertCount: 1,
      sourceFamilies: ["telegram_public"],
      matchedTerms: ["acme.com"]
    });

    const deliverResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme" })
    }), options);
    const delivered = await deliverResponse.json() as any;

    expect(deliverResponse.status).toBe(200);
    expect(delivered.attemptedCount).toBe(1);
    expect(delivered.deliveries[0].status).toBe("delivered");
    expect(delivered.deliveries[0].deliveryKind).toBe("discord");
    expect(seen[0].url).toBe("https://discord.com/api/webhooks/dwm/token");
    expect(seen[0].body.content).toContain("Hanasand alert");
    expect(seen[0].body.embeds[0].fields.some((field: any) => field.name === "Matched term" && field.value === "acme.com")).toBe(true);
    const alertPayload = seen[0].body.hanasand;
    expect(alertPayload.eventType).toBe("darkweb.monitoring.match");
    expect(alertPayload.alertDetailPath).toContain(`/v1/dwm/alerts/${alertPayload.alertId}`);
    expect(alertPayload).toMatchObject({
      tenantId: "tenant_acme",
      sourceFamily: "telegram_public",
      captureIds: ["cap_webhook_acme"],
      selectedCaptureIds: ["cap_webhook_acme"],
      evidenceCount: 1,
      recommendedRoute: "identity_response",
      alertCreatedEvent: {
        schemaVersion: "dwm.alert_created_event.v1",
        eventType: "dwm.alert.created",
        tenantId: "tenant_acme",
        sourceFamily: "telegram_public",
        captureIds: ["cap_webhook_acme"],
        evidenceCount: 1,
        recommendedRoute: "identity_response"
      },
      generationEvidenceWindow: {
        captureIds: ["cap_webhook_acme"],
        sourceFamilies: ["telegram_public"],
        firstObservedAt: "2026-06-27T21:02:00.000Z",
        lastObservedAt: "2026-06-27T21:02:00.000Z"
      },
      deliveryReadinessContext: {
        schemaVersion: "dwm.alert_delivery_persistence.v1",
        selectedCaptureIds: ["cap_webhook_acme"],
        sourceFamily: "telegram_public",
        deliveryDedupeKey: expect.any(String),
        replayMarker: expect.any(String),
        generationEvidenceWindow: {
          captureIds: ["cap_webhook_acme"],
          sourceFamilies: ["telegram_public"],
          firstObservedAt: "2026-06-27T21:02:00.000Z",
          lastObservedAt: "2026-06-27T21:02:00.000Z"
        }
      }
    });
    expect(typeof alertPayload.alertCreatedEvent.id).toBe("string");
    expect(alertPayload.alertCreatedEvent.id).toMatch(/^dwm_alert_created_event_/);
    expect(alertPayload.alertCreatedEventId).toBe(alertPayload.alertCreatedEvent.id);
    expect(alertPayload.alertCreatedAt).toBe(alertPayload.alertCreatedEvent.at);
    expect(alertPayload.alertCreatedEvent.alertDetailPath).toBe(alertPayload.alertDetailPath);
    expect(alertPayload.deliveryReadinessContext.alertDetailPath).toBe(alertPayload.alertDetailPath);
    expect(alertPayload.alertCreatedDispatch).toMatchObject({
      schemaVersion: "dwm.alert_created_event_dispatch.v1",
      ready: true,
      eventId: alertPayload.alertCreatedEvent.id,
      eventType: "dwm.alert.created",
      alertId: expect.any(String),
      tenantId: "tenant_acme",
      sourceFamily: "telegram_public",
      captureIds: ["cap_webhook_acme"],
      selectedCaptureIds: ["cap_webhook_acme"],
      deliveryDedupeKey: expect.any(String),
      workflowEventCount: 0,
      blockerCodes: []
    });
    expect(alertPayload.alertCreatedDispatch.idempotencyKey).toMatch(/^dwm_alert_created_dispatch_/);
    expect(alertPayload.deliveryReadinessContext.alertCreatedEventId).toBe(alertPayload.alertCreatedEvent.id);
    expect(alertPayload.deliveryReadinessContext.alertCreatedAt).toBe(alertPayload.alertCreatedEvent.at);
    expect(alertPayload.caseIdCandidate).toMatch(/^case_/);
    expect(alertPayload.casePath).toContain(`/v1/cases/${alertPayload.caseIdCandidate}`);
    expect(alertPayload.watchlistItemIds[0]).toMatch(/^dwm_watchlist_/);
    expect(alertPayload.watchlistItemIds[0]).toContain("acme.com");
    expect(alertPayload.matchContext).toMatchObject({
      normalizedTerm: "acme.com",
      termKind: "domain"
    });
    expect(alertPayload.evidenceSummary).toMatchObject({
      evidenceCount: 1,
      sourceFamilyCounts: { telegram_public: 1 },
      publicSafeCount: 1
    });
    expect(alertPayload.routingContext).toMatchObject({
      queue: "identity_response",
      urgency: "immediate",
      customerVisibleEvidence: "redacted_excerpt"
    });
    expect(alertPayload.evidence[0].provenance).toMatchObject({
      captureId: "cap_webhook_acme",
      sourceId: "src_webhook_tg",
      metadataOnly: false
    });
    expect(seen[0].headers.get("x-hanasand-event")).toBe("darkweb.monitoring.match");
    expect((store as any).listDwmAlerts()[0].deliveryState).toBe("delivered");
    expect((store as any).listDwmAlerts()[0].deliveryReadinessContext).toMatchObject({
      state: "delivered",
      blockerCodes: expect.arrayContaining(["replay_already_delivered"]),
      deliveryHistoryRefs: [delivered.deliveries[0].id],
      lastDeliveryStatus: "delivered"
    });
    expect((store as any).listDwmWebhookDeliveries()).toHaveLength(1);

    const duplicateResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme", alertId: (store as any).listDwmAlerts()[0].id })
    }), options);
    const duplicate = await duplicateResponse.json() as any;
    expect(duplicateResponse.status).toBe(200);
    expect(duplicate.attemptedCount).toBe(1);
    expect(duplicate.deliveries[0]).toMatchObject({
      status: "skipped",
      endpointHash: "replay_already_delivered",
      error: "Delivery selection blocked by replay already delivered."
    });
    expect(seen).toHaveLength(1);
  });

  test("delivers alert updated event context after a matching follow-up capture rebuild", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source);
    store.saveCapture(capture);
    const seen: Array<{ url: string; body: any }> = [];
    const options = {
      store,
      frontier: new FocusedFrontier(),
      webhookFetch: async (url: string, init: RequestInit) => {
        seen.push({ url, body: JSON.parse(String(init.body)) });
        return new Response("ok", { status: 202 });
      }
    };

    await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme_update", terms: ["acme.com"], webhookUrl: "https://hooks.example.com/dwm-update" })
    }), options);
    const firstRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme_update" })
    }), options);
    const firstRebuild = await firstRebuildResponse.json() as any;
    expect(firstRebuild.savedAlertCount).toBe(1);

    store.saveCapture(followupCapture);
    const secondRebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme_update" })
    }), options);
    const secondRebuild = await secondRebuildResponse.json() as any;
    expect(secondRebuild.savedAlertCount).toBe(1);
    expect(secondRebuild.alerts[0].id).toBe(firstRebuild.alerts[0].id);
    expect(secondRebuild.alerts[0].alertUpdatedEvent).toMatchObject({
      schemaVersion: "dwm.alert_updated_event.v1",
      eventType: "dwm.alert.updated",
      alertId: firstRebuild.alerts[0].id,
      tenantId: "tenant_acme_update",
      sourceFamily: "telegram_public",
      captureIds: ["cap_webhook_acme", "cap_webhook_acme_followup"],
      addedCaptureIds: ["cap_webhook_acme_followup"],
      evidenceCount: 2,
      previousEvidenceCount: 1,
      dedupeKey: firstRebuild.alerts[0].dedupeKey
    });

    const deliverResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme_update" })
    }), options);
    const delivered = await deliverResponse.json() as any;

    expect(deliverResponse.status).toBe(200);
    expect(delivered.attemptedCount).toBe(1);
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("https://hooks.example.com/dwm-update");
    expect(seen[0].body.selectedCaptureIds).toEqual(["cap_webhook_acme", "cap_webhook_acme_followup"]);
    expect(seen[0].body.alertDetailPath).toBe(firstRebuild.alerts[0].alertDetailPath);
    expect(seen[0].body.alertUpdatedEvent).toMatchObject({
      schemaVersion: "dwm.alert_updated_event.v1",
      eventType: "dwm.alert.updated",
      alertDetailPath: firstRebuild.alerts[0].alertDetailPath,
      alertId: firstRebuild.alerts[0].id,
      addedCaptureIds: ["cap_webhook_acme_followup"],
      evidenceCount: 2,
      previousEvidenceCount: 1
    });
    expect(seen[0].body.alertUpdatedEventId).toBe(seen[0].body.alertUpdatedEvent.id);
    expect(seen[0].body.alertUpdatedAt).toBe(seen[0].body.alertUpdatedEvent.at);
    expect(seen[0].body.alertEvents.map((event: any) => event.eventType)).toEqual(["dwm.alert.created", "dwm.alert.updated"]);
    expect(seen[0].body.generationEvidenceWindow).toMatchObject({
      captureIds: ["cap_webhook_acme", "cap_webhook_acme_followup"],
      sourceFamilies: ["telegram_public"],
      firstObservedAt: "2026-06-27T21:02:00.000Z",
      lastObservedAt: "2026-06-27T21:11:00.000Z"
    });
  });

  test("sends Discord alert notifications with customer-safe summaries and evidence excerpts", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source);
    store.saveCapture(capture);
    const seen: Array<{ url: string; body: any }> = [];
    const options = {
      store,
      frontier: new FocusedFrontier(),
      webhookFetch: async (url: string, init: RequestInit) => {
        seen.push({ url, body: JSON.parse(String(init.body)) });
        return new Response("ok", { status: 204 });
      }
    };

    await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      body: JSON.stringify({
        tenantId: "tenant_discord_safe",
        terms: ["acme.com"],
        webhookUrl: "https://discord.com/api/webhooks/discord-safe/discord-secret-token"
      })
    }), options);
    await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_discord_safe" })
    }), options);

    const alert = (store as any).listDwmAlerts()[0];
    (store as any).saveDwmAlert({
      ...alert,
      claimSummary: JSON.stringify({
        actorName: "BlackCat",
        victimName: "Acme Corp",
        claimedData: "Okta tokens exposed",
        sourceFamily: "telegram_public"
      }),
      evidence: [{
        ...alert.evidence[0],
        excerpt: JSON.stringify({
          actorName: "BlackCat",
          victimName: "Acme Corp",
          claimedData: "Okta tokens exposed",
          raw: "unsafe backend details"
        })
      }]
    });

    const deliverResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_discord_safe", alertId: alert.id })
    }), options);
    const delivered = await deliverResponse.json() as any;

    expect(deliverResponse.status).toBe(200);
    expect(delivered.deliveries[0].status).toBe("delivered");
    expect(seen).toHaveLength(1);
    expect(seen[0].body.embeds[0].description).toContain("BlackCat exposure claim for Acme Corp");
    expect(seen[0].body.embeds[0].fields.find((field: any) => field.name === "Evidence excerpt")?.value).toContain("Okta tokens exposed");
    expect(seen[0].body.hanasand.claimSummary).toContain("BlackCat exposure claim for Acme Corp");
    expect(seen[0].body.hanasand.evidence[0].excerpt).toContain("Okta tokens exposed");
    const customerVisibleText = [
      seen[0].body.embeds[0].description,
      seen[0].body.embeds[0].fields.map((field: any) => field.value).join(" "),
      seen[0].body.hanasand.claimSummary,
      seen[0].body.hanasand.evidence[0].excerpt
    ].join(" ");
    expect(customerVisibleText).not.toMatch(/actorName|victimName|claimedData|unsafe backend details|[{}]/);
    expect(JSON.stringify(seen[0].body)).not.toContain("discord-secret-token");
  });

  test("uses alert delivery selection for org webhook destination choice", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source);
    store.saveCapture(capture);
    store.saveOrganization({
      id: "org_webhook_selection",
      name: "Webhook Selection Org",
      status: "active",
      createdAt: "2026-06-27T21:00:00.000Z",
      updatedAt: "2026-06-27T21:00:00.000Z"
    });
    store.saveOrganizationMember({
      id: "member-webhook-selection-owner",
      organizationId: "org_webhook_selection",
      email: "owner@webhook-selection.example",
      userId: "owner-webhook-selection",
      role: "owner",
      status: "active",
      createdAt: "2026-06-27T21:00:00.000Z",
      updatedAt: "2026-06-27T21:00:00.000Z"
    });
    store.saveWebhookDestination({
      id: "webhook_selection_first",
      organizationId: "org_webhook_selection",
      tenantId: "org_webhook_selection",
      name: "First destination",
      url: "https://hooks.example.com/first",
      kind: "generic",
      status: "active",
      createdAt: "2026-06-27T21:00:00.000Z",
      updatedAt: "2026-06-27T21:00:00.000Z"
    });
    store.saveWebhookDestination({
      id: "webhook_selection_chosen",
      organizationId: "org_webhook_selection",
      tenantId: "org_webhook_selection",
      name: "Chosen destination",
      url: "https://hooks.example.com/chosen",
      kind: "generic",
      status: "active",
      createdAt: "2026-06-27T21:00:00.000Z",
      updatedAt: "2026-06-27T21:00:00.000Z"
    });
    const seen: Array<{ url: string; body: any }> = [];
    const options = {
      store,
      frontier: new FocusedFrontier(),
      webhookFetch: async (url: string, init: RequestInit) => {
        seen.push({ url, body: JSON.parse(String(init.body)) });
        return new Response("ok", { status: 202 });
      }
    };

    await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      headers: { "x-user-email": "owner@webhook-selection.example" },
      body: JSON.stringify({ organizationId: "org_webhook_selection", terms: ["acme.com"], webhookDestinationId: "webhook_selection_chosen" })
    }), options);
    const rebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      headers: { "x-user-email": "owner@webhook-selection.example" },
      body: JSON.stringify({ organizationId: "org_webhook_selection" })
    }), options);
    const rebuild = await rebuildResponse.json() as any;
    expect(rebuild.savedAlertCount).toBe(1);
    expect(rebuild.alerts[0].deliveryReadinessContext.webhookDestinationIds).toEqual(["webhook_selection_chosen"]);

    const deliverResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
      method: "POST",
      headers: { "x-user-email": "owner@webhook-selection.example" },
      body: JSON.stringify({ organizationId: "org_webhook_selection", alertId: rebuild.alerts[0].id })
    }), options);
    const delivered = await deliverResponse.json() as any;
    expect(deliverResponse.status).toBe(200);
    expect(delivered.deliveries[0]).toMatchObject({
      status: "delivered",
      webhookDestinationId: "webhook_selection_chosen"
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("https://hooks.example.com/chosen");
    expect(seen[0].body.webhookDestinationId).toBe("webhook_selection_chosen");
    expect(seen[0].body.selectedCaptureIds).toEqual(["cap_webhook_acme"]);
    expect(seen[0].body.generationEvidenceWindow).toMatchObject({
      captureIds: ["cap_webhook_acme"],
      sourceFamilies: ["telegram_public"],
      firstObservedAt: "2026-06-27T21:02:00.000Z",
      lastObservedAt: "2026-06-27T21:02:00.000Z"
    });
    expect(seen[0].body.alertCreatedEvent).toMatchObject({
      schemaVersion: "dwm.alert_created_event.v1",
      organizationId: "org_webhook_selection",
      sourceFamily: "telegram_public",
      watchlistIds: [rebuild.alerts[0].watchlistIds[0]],
      captureIds: ["cap_webhook_acme"]
    });
    expect(seen[0].body.alertCreatedDispatch).toMatchObject({
      schemaVersion: "dwm.alert_created_event_dispatch.v1",
      ready: true,
      eventId: seen[0].body.alertCreatedEvent.id,
      organizationId: "org_webhook_selection",
      sourceFamily: "telegram_public",
      selectedCaptureIds: ["cap_webhook_acme"],
      blockerCodes: []
    });
    expect(seen[0].body.deliveryReadinessContext.alertCreatedEventId).toBe(seen[0].body.alertCreatedEvent.id);
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
    expect((store as any).listDwmAlerts()[0].deliveryReadinessContext).toMatchObject({
      state: "blocked",
      blockerCodes: expect.arrayContaining(["delivery_disabled"]),
      deliveryHistoryRefs: [delivered.deliveries[0].id],
      lastDeliveryStatus: "skipped"
    });
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

  test("attaches a dry-run Discord route to the matched watchlist for real alert replay", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source);
    store.saveCapture(capture);
    let externalSendCount = 0;
    const options = {
      store,
      frontier: new FocusedFrontier(),
      webhookFetch: async () => {
        externalSendCount += 1;
        return new Response("should not send", { status: 500 });
      }
    };

    await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_attach", terms: ["acme.com"] })
    }), options);
    const rebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_attach" })
    }), options);
    const rebuild = await rebuildResponse.json() as any;

    const attachResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
      method: "POST",
      body: JSON.stringify({
        tenantId: "tenant_attach",
        alertId: rebuild.alerts[0].id,
        webhookUrl: "https://discord.com/api/webhooks/attach/token",
        dryRun: true,
        attachToWatchlist: true
      })
    }), options);
    const attached = await attachResponse.json() as any;

    expect(attachResponse.status).toBe(200);
    expect(attached.deliveries[0]).toMatchObject({
      alertId: rebuild.alerts[0].id,
      status: "dry_run",
      deliveryKind: "discord"
    });
    expect(attached.deliveries[0].endpointHash).not.toContain("attach/token");
    expect((store as any).listDwmWatchlists()[0].webhookUrl).toBe("https://discord.com/api/webhooks/attach/token");

    const watchlistResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists?tenantId=tenant_attach"), options);
    const watchlistPayload = await watchlistResponse.json() as any;
    expect(watchlistPayload.watchlists[0].webhookUrl).toBeUndefined();
    expect(watchlistPayload.watchlists[0]).toMatchObject({
      webhookUrlConfigured: true,
      webhookEndpointHint: "https://discord.com/api/webhooks/attach/..."
    });
    expect(JSON.stringify(watchlistPayload)).not.toContain("attach/token");

    const replayResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/webhooks/deliver", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_attach", alertId: rebuild.alerts[0].id, dryRun: true })
    }), options);
    const replay = await replayResponse.json() as any;

    expect(replayResponse.status).toBe(200);
    expect(replay.deliveries[0]).toMatchObject({
      alertId: rebuild.alerts[0].id,
      status: "dry_run",
      deliveryKind: "discord"
    });
    expect(externalSendCount).toBe(0);
  });
});
