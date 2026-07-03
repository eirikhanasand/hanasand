import assert from "node:assert/strict";
import { createServer } from "node:net";
import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import type { RawCapture, SourceRecord } from "../src/types.ts";

const source: SourceRecord = {
  id: "src_live_probe_tg",
  name: "Live probe public Telegram",
  type: "telegram_public",
  url: "https://t.me/live_probe",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.82,
  legalNotes: "Public Telegram preview only.",
  createdAt: "2026-06-27T21:00:00.000Z",
  updatedAt: "2026-06-27T21:00:00.000Z"
} as SourceRecord;

const capture: RawCapture = {
  id: "cap_live_probe_acme",
  sourceId: source.id,
  url: "https://t.me/live_probe/42",
  collectedAt: "2026-06-27T21:02:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-live-probe-acme",
  sensitive: false,
  body: "acme.com appears in public Telegram chatter for Lumma C2 Okta session cookie exposure.",
  metadata: { adapter: "telegram_public", channel: "live_probe", messageId: 42 }
} as RawCapture;

const darkwebSource: SourceRecord = {
  id: "src_live_probe_onion",
  name: "Live probe onion metadata",
  type: "tor_metadata",
  url: "http://live-probe-acme.onion",
  accessMethod: "approved_proxy",
  status: "active",
  trustScore: 0.8,
  legalNotes: "Metadata-only onion source.",
  createdAt: "2026-06-27T21:00:00.000Z",
  updatedAt: "2026-06-27T21:00:00.000Z"
} as SourceRecord;

const darkwebCapture: RawCapture = {
  id: "cap_live_probe_onion_acme",
  sourceId: darkwebSource.id,
  url: "http://live-probe-acme.onion/acme",
  collectedAt: "2026-06-27T21:04:00.000Z",
  mediaType: "text/plain",
  storageKind: "metadata_only",
  contentHash: "hash-live-probe-onion-acme",
  sensitive: true,
  metadata: {
    adapter: "darknet_metadata",
    leakSite: {
      actorName: "Akira",
      victimName: "acme.com",
      description: "Metadata-only onion page claims acme.com procurement exports.",
      captureMode: "metadata_only"
    }
  }
} as RawCapture;

const duplicateCapture: RawCapture = {
  ...capture,
  id: "cap_live_probe_acme_duplicate",
  url: "https://t.me/live_probe/42?mirror=1",
  collectedAt: "2026-06-27T21:09:00.000Z"
} as RawCapture;

type JsonRecord = Record<string, any>;

const seenDeliveries: Array<{ url: string; body: JsonRecord; headers: Headers }> = [];
const store = new InMemoryScraperStore();
store.saveSource(source);
store.saveCapture(capture);
store.saveSource(darkwebSource);
store.saveCapture(darkwebCapture);

const server = startApiServer({
  port: await getFreePort(),
  store,
  frontier: new FocusedFrontier(),
  webhookFetch: async (url: string, init: RequestInit) => {
    seenDeliveries.push({
      url,
      body: JSON.parse(String(init.body)),
      headers: new Headers(init.headers)
    });
    return new Response("ok", { status: 202 });
  }
});

const baseUrl = `http://127.0.0.1:${server.port}`;

try {
  const org = await postJson("/v1/organizations", {
    id: "org_live_probe_acme",
    name: "Acme Live Probe",
    slug: "acme-live-probe",
    ownerEmail: "analyst@acme.example",
    ownerUserId: "user_live_probe_owner"
  });
  assert.equal(org.response.status, 201, "organization create should return 201");
  const organizationId = String(org.body.organization?.id ?? "");
  const tenantId = String(org.body.organization?.tenantId ?? "");
  assert.equal(organizationId, "org_live_probe_acme");
  assert.equal(tenantId, organizationId);

  const persistedAlertCountBeforeWatchlist = store.listDwmAlerts().length;
  assert.equal(persistedAlertCountBeforeWatchlist, 0, "captures alone should not persist alerts before a monitored term is added.");

  const watchlist = await postJson("/v1/dwm/watchlists", {
    organizationId,
    name: "Acme exposure watchlist",
    terms: ["acme.com"],
    webhookUrl: "https://discord.com/api/webhooks/live-probe/token"
  });
  assert.equal(watchlist.response.status, 201, "watchlist create should return 201");
  assert.equal(watchlist.body.alertRebuild?.savedAlertCount, 2);
  assert.deepEqual([...watchlist.body.alertRebuild?.sourceFamilies].sort(), ["darkweb_metadata", "telegram_public"]);
  assert.deepEqual(watchlist.body.alertRebuild?.matchedTerms, ["acme.com"]);

  const alerts = await getJson(`/v1/dwm/alerts?organizationId=${encodeURIComponent(organizationId)}`);
  assert.equal(alerts.response.status, 200, "alert list should return 200");
  assert.equal(alerts.body.alerts?.length, 2);
  assert.equal(store.listDwmAlerts().length - persistedAlertCountBeforeWatchlist, 2);
  const alert = alerts.body.alerts.find((row: JsonRecord) => row.sourceFamily === "telegram_public");
  const darkwebAlert = alerts.body.alerts.find((row: JsonRecord) => row.sourceFamily === "darkweb_metadata");
  assert.ok(alert, "telegram alert should be visible.");
  assert.ok(darkwebAlert, "darkweb metadata alert should be visible.");
  assert.equal(alert.sourceFamily, "telegram_public");
  assert.equal(alert.matchedTerm?.value ?? alert.matchedTerm, "acme.com");
  assert.equal(alert.recommendedRoute, "identity_response");
  assert.equal(alert.evidenceCount ?? alert.evidenceSummary?.evidenceCount, 1);
  assert.match(String(alert.alertDetailPath ?? ""), /\/v1\/dwm\/alerts\//);
  assert.equal(darkwebAlert.sourceFamily, "darkweb_metadata");
  assert.equal(darkwebAlert.matchedTerm?.value ?? darkwebAlert.matchedTerm, "acme.com");
  assert.equal(darkwebAlert.evidenceCount ?? darkwebAlert.evidenceSummary?.evidenceCount, 1);

  const detail = await getJson(String(alert.alertDetailPath));
  assert.equal(detail.response.status, 200, "alert detail should return 200");
  assert.equal(detail.body.schemaVersion, "dwm.alert_detail.v1");
  assert.equal(detail.body.alert?.sourceFamily, "telegram_public");
  assert.equal(detail.body.evidenceReplay?.[0]?.provenance?.captureId, capture.id);
  assert.equal(detail.body.evidenceReplay?.[0]?.provenance?.sourceId, source.id);
  assert.equal(detail.body.alert?.matchContext?.normalizedTerm, "acme.com");
  assert.equal(detail.body.alert?.routingContext?.queue, "identity_response");
  assert.equal(detail.body.downstreamHandoff?.caseReadiness?.route, "/v1/cases");
  assert.match(String(detail.body.downstreamHandoff?.caseReadiness?.casePath ?? ""), /\/v1\/cases\//);
  assert.equal(detail.body.consumerContract?.alertDetailPath, alert.alertDetailPath);

  const darkwebDetail = await getJson(String(darkwebAlert.alertDetailPath));
  assert.equal(darkwebDetail.response.status, 200, "darkweb alert detail should return 200");
  assert.equal(darkwebDetail.body.alert?.sourceFamily, "darkweb_metadata");
  assert.equal(darkwebDetail.body.evidenceReplay?.[0]?.provenance?.captureId, darkwebCapture.id);

  const transition = await patchJson(String(alert.alertDetailPath), {
    status: "investigating",
    assignedOwner: "analyst-live-probe",
    severityOverride: "high",
    note: "Confirmed monitored term in Telegram source.",
    actor: "user_live_probe_owner"
  });
  assert.equal(transition.response.status, 200, "alert workflow transition should return 200");
  assert.equal(transition.body.alert?.workflowSummary?.status, "investigating");
  assert.equal(transition.body.alert?.workflowSummary?.assignedOwner, "analyst-live-probe");
  assert.equal(transition.body.alert?.workflowSummary?.severityOverride, "high");
  assert.equal(transition.body.alert?.workflowSummary?.eventCount, 1);

  store.saveCapture(duplicateCapture);
  const rebuild = await postJson("/v1/dwm/alerts/rebuild", { organizationId });
  assert.equal(rebuild.response.status, 200, "duplicate rebuild should return 200");
  assert.equal(rebuild.body.savedAlertCount, 2);

  const preservedDetail = await getJson(String(alert.alertDetailPath));
  assert.equal(preservedDetail.response.status, 200, "preserved alert detail should return 200");
  assert.equal(preservedDetail.body.workflowSummary?.status, "investigating");
  assert.equal(preservedDetail.body.workflowSummary?.assignedOwner, "analyst-live-probe");
  assert.equal(preservedDetail.body.workflowSummary?.severityOverride, "high");
  assert.equal(preservedDetail.body.workflowSummary?.eventCount, 1);
  assert.equal(preservedDetail.body.alert?.evidenceCount ?? preservedDetail.body.alert?.evidenceSummary?.evidenceCount, 1);
  assert.deepEqual(preservedDetail.body.alert?.workflowContext?.captureIds, [capture.id]);
  assert.ok(!JSON.stringify(preservedDetail.body).includes(duplicateCapture.id), "duplicate capture should not inflate alert evidence.");

  const delivery = await postJson("/v1/dwm/webhooks/deliver", { organizationId });
  assert.equal(delivery.response.status, 200, "webhook delivery should return 200");
  assert.equal(delivery.body.deliveredCount ?? delivery.body.deliveries?.filter((row: JsonRecord) => row.status === "delivered").length, 2);
  assert.equal(seenDeliveries.length, 2);
  assert.equal(seenDeliveries[0].url, "https://discord.com/api/webhooks/live-probe/token");
  assert.equal(seenDeliveries[0].headers.get("x-hanasand-event"), "darkweb.monitoring.match");
  assert.match(String(seenDeliveries[0].body.content ?? ""), new RegExp(organizationId));
  assert.deepEqual(seenDeliveries[0].body.allowed_mentions, { parse: [] });
  const notificationField = seenDeliveries[0].body.embeds?.[0]?.fields?.find((field: JsonRecord) => field.name === "Notification target");
  assert.ok(notificationField, "Discord alert embed should include notification target context.");
  assert.match(String(notificationField.value ?? ""), new RegExp(organizationId));

  const payload = seenDeliveries[0].body.hanasand;
  assert.equal(payload.eventType, "darkweb.monitoring.match");
  assert.equal(payload.organizationId, organizationId);
  assert.equal(payload.tenantId, tenantId);
  assert.equal(payload.sourceFamily, "telegram_public");
  assert.deepEqual(payload.captureIds, [capture.id]);
  assert.equal(payload.evidenceCount, 1);
  assert.equal(payload.recommendedRoute, "identity_response");
  assert.equal(payload.matchContext?.normalizedTerm, "acme.com");
  assert.equal(payload.evidence?.[0]?.provenance?.captureId, capture.id);
  assert.match(String(payload.alertDetailPath ?? ""), /\/v1\/dwm\/alerts\//);
  assert.equal(payload.notificationTarget?.organizationId, organizationId);
  assert.equal(payload.notificationTarget?.tenantId, tenantId);
  assert.equal(payload.notificationTarget?.watchlistId, watchlist.body.watchlist.id);
  assert.equal(payload.notificationTarget?.deliveryKind, "discord");

  console.log(JSON.stringify({
    event: "realtime_alert_discord_smoke",
    ok: true,
    organizationId,
    persistedAlertCountBeforeWatchlist,
    savedAlertCount: watchlist.body.alertRebuild.savedAlertCount,
    listAlertCount: alerts.body.alerts.length,
    persistedAlertCountDelta: store.listDwmAlerts().length - persistedAlertCountBeforeWatchlist,
    deliveredCount: delivery.body.deliveredCount ?? seenDeliveries.length,
    sourceFamilies: watchlist.body.alertRebuild.sourceFamilies,
    matchedTerms: watchlist.body.alertRebuild.matchedTerms,
    alertId: alert.id,
    alertDetailPath: alert.alertDetailPath,
    workflowPreservedAfterDuplicateRebuild: true
  }));
} finally {
  server.stop();
}

async function postJson(path: string, body: JsonRecord) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-actor-id": "user_live_probe_owner",
      "x-user-email": "analyst@acme.example"
    },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() as JsonRecord };
}

async function patchJson(pathOrUrl: string, body: JsonRecord) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl}${pathOrUrl}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-actor-id": "user_live_probe_owner",
      "x-user-email": "analyst@acme.example"
    },
    body: JSON.stringify(body)
  });
  return { response, body: await response.json() as JsonRecord };
}

async function getJson(pathOrUrl: string) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl}${pathOrUrl}`;
  const response = await fetch(url, {
    headers: {
      "x-actor-id": "user_live_probe_owner",
      "x-user-email": "analyst@acme.example"
    }
  });
  return { response, body: await response.json() as JsonRecord };
}

async function getFreePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address && typeof address.port === "number") {
          resolve(address.port);
          return;
        }
        reject(new Error("Could not allocate a free localhost port."));
      });
    });
  });
}
