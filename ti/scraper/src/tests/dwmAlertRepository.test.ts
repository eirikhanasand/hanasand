import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { rebuildDwmRuntimeAlerts, dwmAlertToSqlRecord } from "../storage/dwmAlertRepository.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const telegramSource: SourceRecord = {
  id: "src_repo_tg",
  name: "Repository public Telegram",
  type: "telegram_public",
  url: "https://t.me/repo_public",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.82,
  legalNotes: "Public channel preview only.",
  createdAt: "2026-06-28T13:00:00.000Z",
  updatedAt: "2026-06-28T13:00:00.000Z"
} as SourceRecord;

const darkwebSource: SourceRecord = {
  id: "src_repo_darkweb",
  name: "Repository actor metadata",
  type: "tor_metadata",
  url: "http://repo-example.onion",
  accessMethod: "approved_proxy",
  status: "active",
  trustScore: 0.77,
  legalNotes: "Metadata-only collection.",
  createdAt: "2026-06-28T13:00:00.000Z",
  updatedAt: "2026-06-28T13:00:00.000Z"
} as SourceRecord;

const telegramCapture: RawCapture = {
  id: "cap_repo_tg_acme",
  sourceId: telegramSource.id,
  url: "https://t.me/repo_public/101",
  collectedAt: "2026-06-28T13:04:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-repo-tg-acme",
  sensitive: false,
  body: "acme.com appears in Lumma C2 public Telegram chatter with Okta live cookie and AWS IAM key exposure.",
  metadata: { adapter: "telegram_public", channel: "repo_public", messageId: 101 }
} as RawCapture;

const telegramFollowupCapture: RawCapture = {
  id: "cap_repo_tg_acme_followup",
  sourceId: telegramSource.id,
  url: "https://t.me/repo_public/102",
  collectedAt: "2026-06-28T13:16:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-repo-tg-acme-followup",
  sensitive: false,
  body: "Follow-up public Telegram post repeats acme.com Lumma C2 Okta live cookie and AWS IAM key exposure.",
  metadata: { adapter: "telegram_public", channel: "repo_public", messageId: 102 }
} as RawCapture;

const darkwebCapture: RawCapture = {
  id: "cap_repo_darkweb_acme",
  sourceId: darkwebSource.id,
  url: "http://repo-example.onion/acme",
  collectedAt: "2026-06-28T13:09:00.000Z",
  mediaType: "text/plain",
  storageKind: "metadata_only",
  contentHash: "hash-repo-darkweb-acme",
  sensitive: true,
  metadata: {
    adapter: "darknet_metadata",
    leakSite: {
      actorName: "Akira",
      victimName: "acme.com",
      description: "Actor-page metadata claims acme.com supplier contracts.",
      captureMode: "metadata_only"
    }
  }
} as RawCapture;

describe("dwm alert repository", () => {
  test("rebuilds tenant/org alerts from watchlist and fixture Telegram/darkweb captures with SQL-shaped persistence", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(telegramSource);
    store.saveSource(darkwebSource);
    store.saveCapture(telegramCapture);
    store.saveCapture(darkwebCapture);
    (store as any).saveDwmWatchlist({
      id: "watch_repo_acme",
      tenantId: "tenant_repo_acme",
      organizationId: "org_repo_acme",
      name: "Acme exposure watch",
      terms: [{ value: "acme.com", kind: "domain" }],
      status: "active",
      createdAt: "2026-06-28T13:00:00.000Z",
      updatedAt: "2026-06-28T13:00:00.000Z"
    });

    const first = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "tenant_repo_acme", organizationId: "org_repo_acme" });

    expect(first.savedAlertCount).toBe(2);
    expect(first.alerts.map((alert) => alert.sourceFamily).sort()).toEqual(["darkweb_metadata", "telegram_public"]);
    expect(first.alerts.every((alert) => alert.organizationId === "org_repo_acme")).toBe(true);
    expect(first.alerts.every((alert) => alert.dedupeKey === alert.webhookDelivery.dedupeKey)).toBe(true);
    expect(first.alerts.every((alert) => alert.provenance.matchBasis === "watchlist_capture_text")).toBe(true);
    expect(first.alerts.find((alert) => alert.sourceFamily === "telegram_public")?.recommendedRoute).toBe("identity_response");
    expect(first.alerts.find((alert) => alert.sourceFamily === "darkweb_metadata")?.provenance.metadataOnly).toBe(true);

    const telegramSql = dwmAlertToSqlRecord(first.alerts.find((alert) => alert.sourceFamily === "telegram_public"));
    expect(telegramSql).toMatchObject({
      tenant_id: "tenant_repo_acme",
      organization_id: "org_repo_acme",
      event_type: "darkweb.monitoring.match",
      source_family: "telegram_public",
      recommended_route: "identity_response",
      delivery_state: "pending_review"
    });
    expect(telegramSql.dedupe_key).toMatch(/^dwm_dedupe_/);
    expect(telegramSql.provenance.captureIds).toContain("cap_repo_tg_acme");
    expect(telegramSql.evidence[0].provenance.captureId).toBe("cap_repo_tg_acme");
    expect(telegramSql.watchlist_ids).toEqual(["watch_repo_acme"]);

    const existing = first.alerts[0];
    store.saveDwmAlert({
      ...existing,
      reviewState: "reviewing",
      deliveryState: "ready_to_send",
      assignedOwner: "analyst-1",
      workflowNote: "Owner confirmed this is the customer domain.",
      workflowEvents: [{ id: "evt_1", at: "2026-06-28T13:12:00.000Z", toReviewState: "reviewing" }],
      replayCount: 2,
      lastReplayedAt: "2026-06-28T13:13:00.000Z"
    });
    store.saveCapture(telegramFollowupCapture);

    const second = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "tenant_repo_acme", organizationId: "org_repo_acme" });
    const preserved = second.alerts.find((alert) => alert.id === existing.id);

    expect(preserved?.reviewState).toBe("reviewing");
    expect(preserved?.deliveryState).toBe("ready_to_send");
    expect(preserved?.assignedOwner).toBe("analyst-1");
    expect(preserved?.workflowNote).toBe("Owner confirmed this is the customer domain.");
    expect(preserved?.workflowEvents).toHaveLength(1);
    expect(preserved?.replayCount).toBe(2);
    expect(preserved?.lastReplayedAt).toBe("2026-06-28T13:13:00.000Z");
    expect(preserved?.sourceCount).toBe(2);
    expect(preserved?.evidence.map((item: any) => item.id)).toContain("cap_repo_tg_acme_followup");
    expect(preserved?.provenance.captureIds).toContain("cap_repo_tg_acme_followup");
  });

  test("API rebuild and list expose generated alerts in product-ready shape", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(telegramSource);
    store.saveCapture(telegramCapture);
    const options = { store, frontier: new FocusedFrontier() };

    const watchlistResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      body: JSON.stringify({
        tenantId: "tenant_api_acme",
        name: "API Acme exposure watch",
        terms: ["acme.com"]
      })
    }), options);
    expect(watchlistResponse.status).toBe(201);

    const rebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_api_acme" })
    }), options);
    const rebuild = await rebuildResponse.json() as any;

    expect(rebuildResponse.status).toBe(200);
    expect(rebuild.savedAlertCount).toBe(1);
    expect(rebuild.alerts[0]).toMatchObject({
      tenantId: "tenant_api_acme",
      eventType: "darkweb.monitoring.match",
      sourceFamily: "telegram_public",
      recommendedRoute: "identity_response",
      deliveryState: "pending_review"
    });
    expect(rebuild.alerts[0].dedupeKey).toMatch(/^dwm_dedupe_/);
    expect(rebuild.alerts[0].confidenceReasoning.join(" ")).toContain("Watchlist term matched");
    expect(rebuild.alerts[0].provenance.captureIds).toContain("cap_repo_tg_acme");
    expect(rebuild.alerts[0].evidence[0].provenance.captureId).toBe("cap_repo_tg_acme");

    const listResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts?tenantId=tenant_api_acme"), options);
    const list = await listResponse.json() as any;

    expect(listResponse.status).toBe(200);
    expect(list.alerts).toHaveLength(1);
    expect(list.alerts[0].watchlistIds).toHaveLength(1);
    expect(list.alerts[0].webhookDelivery.dedupeKey).toBe(list.alerts[0].dedupeKey);
  });
});
