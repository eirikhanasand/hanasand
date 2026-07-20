import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { buildDwmProductSnapshot, classifySourceFamily, normalizeWatchlist } from "../product/dwmProduct.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const telegramSource: SourceRecord = {
  id: "src_telegram_lumma",
  name: "Lumma broker public channel",
  type: "telegram_public",
  url: "https://t.me/lumma_broker_room",
  accessMethod: "official_api",
  status: "active",
  risk: "medium",
  trustScore: 0.82,
  legalNotes: "Public Telegram messages only.",
  tenantId: "tenant_acme",
  createdAt: "2026-06-27T00:00:00.000Z",
  updatedAt: "2026-06-27T00:00:00.000Z"
} as SourceRecord;

const darkwebSource: SourceRecord = {
  id: "src_akira_metadata",
  name: "Akira metadata mirror",
  type: "tor_metadata",
  url: "http://akira-example.onion",
  accessMethod: "approved_proxy",
  status: "active",
  risk: "high",
  trustScore: 0.76,
  legalNotes: "Metadata-only collection; payload paths blocked.",
  tenantId: "tenant_acme",
  createdAt: "2026-06-27T00:00:00.000Z",
  updatedAt: "2026-06-27T00:00:00.000Z"
} as SourceRecord;

const telegramCapture: RawCapture = {
  id: "cap_telegram_1",
  sourceId: "src_telegram_lumma",
  tenantId: "tenant_acme",
  url: "https://t.me/lumma_broker_room/42",
  collectedAt: "2026-06-27T08:10:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-telegram",
  sensitive: false,
  body: "Lumma C2 listing says acme.com has 38 saved logins, Okta live cookie, OAuth token, and AWS IAM admin key.",
  metadata: { adapter: "telegram_public", channel: "lumma_broker_room" }
} as RawCapture;

const telegramFollowupCapture: RawCapture = {
  id: "cap_telegram_2",
  sourceId: "src_telegram_lumma",
  tenantId: "tenant_acme",
  url: "https://t.me/lumma_broker_room/43",
  collectedAt: "2026-06-27T08:16:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-telegram-followup",
  sensitive: false,
  body: "Follow-up public Telegram message repeats acme.com Okta live cookie and AWS IAM admin key exposure.",
  metadata: { adapter: "telegram_public", channel: "lumma_broker_room" }
} as RawCapture;

const telegramDuplicateCapture: RawCapture = {
  id: "cap_telegram_2_duplicate",
  sourceId: "src_telegram_lumma",
  tenantId: "tenant_acme",
  url: "https://t.me/lumma_broker_room/43?mirror=1",
  collectedAt: "2026-06-27T08:18:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-telegram-followup",
  sensitive: false,
  body: "Mirrored copy repeats acme.com Okta live cookie and AWS IAM admin key exposure.",
  metadata: { adapter: "telegram_public", channel: "lumma_broker_room" }
} as RawCapture;

const telegramSubstringFalsePositiveCapture: RawCapture = {
  id: "cap_telegram_notacme",
  sourceId: "src_telegram_lumma",
  tenantId: "tenant_acme",
  url: "https://t.me/lumma_broker_room/44",
  collectedAt: "2026-06-27T08:19:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-telegram-notacme",
  sensitive: false,
  body: "Broker message references notacme.com Okta sessions only; it must not match the customer watchlist.",
  metadata: { adapter: "telegram_public", channel: "lumma_broker_room" }
} as RawCapture;

const darkwebCapture: RawCapture = {
  id: "cap_darkweb_1",
  sourceId: "src_akira_metadata",
  tenantId: "tenant_acme",
  url: "http://akira-example.onion/acme",
  collectedAt: "2026-06-27T08:18:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-darkweb",
  sensitive: true,
  metadata: {
    leakSite: {
      actorName: "Akira",
      victimName: "acme.com",
      description: "Actor-page metadata claims acme.com financial records and supplier contracts.",
      captureMode: "metadata_only"
    }
  }
} as RawCapture;

describe("dwm product snapshot", () => {
  test("normalizes watchlists and classifies source families", () => {
    expect(normalizeWatchlist([" acme.com ", "acme.com", "Acme Payments"])).toEqual([
      { value: "acme.com", kind: "domain" },
      { value: "Acme Payments", kind: "company" }
    ]);
    expect(classifySourceFamily(telegramSource)).toBe("telegram_public");
    expect(classifySourceFamily(darkwebSource)).toBe("darkweb_metadata");
  });

  test("builds workflow-ready alerts from Telegram and metadata-only darkweb captures", () => {
    const snapshot = buildDwmProductSnapshot({
      tenantId: "tenant_acme",
      watchlist: ["acme.com"],
      sources: [telegramSource, darkwebSource],
      captures: [telegramCapture, telegramFollowupCapture, telegramDuplicateCapture, telegramSubstringFalsePositiveCapture, darkwebCapture],
      generatedAt: "2026-06-27T08:20:00.000Z"
    });

    expect(snapshot.readiness.decision).toBe("production_ready_with_live_sources");
    expect(snapshot.alerts).toHaveLength(2);
    expect(snapshot.alerts[0].severity).toBe("critical");
    expect(snapshot.alerts[0].sourceCount).toBe(1);
    expect(snapshot.alerts[0].evidence).toHaveLength(2);
    expect(snapshot.alerts[0]).toMatchObject({
      assertionKind: "source_claim",
      observedMatchSummary: "2 captured records from 1 source matched acme.com. This confirms the source mention, not the underlying incident."
    });
    expect(snapshot.alerts[0].evidence.map((item) => item.id)).not.toContain("cap_telegram_2_duplicate");
    expect(snapshot.alerts[0].evidence.map((item) => item.id)).not.toContain("cap_telegram_notacme");
    expect(snapshot.alerts.flatMap((alert) => alert.provenance.captureIds)).not.toContain("cap_telegram_notacme");
    expect(snapshot.alerts[0].evidenceSummary).toMatchObject({
      evidenceCount: 2,
      sourceFamilyCounts: { telegram_public: 2 },
      publicSafeCount: 2,
      firstObservedAt: "2026-06-27T08:10:00.000Z",
      lastObservedAt: "2026-06-27T08:18:00.000Z"
    });
    expect(snapshot.alerts[0].matchContext).toMatchObject({
      normalizedTerm: "acme.com",
      termKind: "domain",
      matchType: "bounded_text_or_metadata"
    });
    expect(snapshot.alerts[0].matchContext.matchedFieldHints).toContain("body");
    expect(snapshot.alerts[0].routingContext).toMatchObject({
      queue: "identity_response",
      urgency: "immediate",
      customerVisibleEvidence: "redacted_excerpt"
    });
    expect(snapshot.alerts[0].dedupeKey).toMatch(/^dwm_dedupe_/);
    expect(snapshot.alerts[0].confidenceReasoning.join(" ")).toContain("Watchlist term matched");
    expect(snapshot.alerts[0].provenance.matchBasis).toBe("watchlist_capture_text");
    expect(snapshot.alerts[0].recommendedRoute).toBe("identity_response");
    expect(snapshot.alerts[0].webhookDelivery.recommendedRoute).toBe("identity_response");
    expect(snapshot.sourceInventory.counts.catalogTelegramPublic).toBeGreaterThanOrEqual(100);
    expect(snapshot.sourceInventory.reportingHooks.sourceInventoryRoute).toBe("/v1/dwm/source-inventory");
    expect(snapshot.alerts.some((alert) => alert.sourceFamily === "darkweb_metadata")).toBe(true);
    const darkwebAlert = snapshot.alerts.find((alert) => alert.sourceFamily === "darkweb_metadata");
    expect(darkwebAlert?.evidence[0].redactionState).toBe("metadata_only");
    expect(darkwebAlert?.evidenceSummary.metadataOnlyCount).toBe(1);
    expect(darkwebAlert?.routingContext.customerVisibleEvidence).toBe("metadata_only");
    expect(darkwebAlert?.provenance.metadataOnly).toBe(true);
    expect(darkwebAlert?.evidence[0].provenance.metadataOnly).toBe(true);
    expect(snapshot.actorOverviews.find((actor) => actor.actor === "Akira")).toMatchObject({
      watchState: "metadata_only",
      sourceCount: 1,
      captureCount: 1
    });
  });

  test("reports missing production blockers instead of hiding behind demo data", () => {
    const snapshot = buildDwmProductSnapshot({ watchlist: ["acme.com"], sources: [], captures: [], generatedAt: "2026-06-27T08:20:00.000Z" });
    expect(snapshot.readiness.decision).toBe("blocked_missing_live_sources");
    expect(snapshot.alerts).toEqual([]);
    expect(snapshot.onDemandQueue).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain("demo");
    expect(snapshot.readiness.blockers).toContain("No live public Telegram source is registered for this tenant.");
    expect(snapshot.readiness.blockers).toContain("No approved metadata-only dark web source is active for this tenant.");
  });

  test("treats zero matches as ready when watchlist and live sources exist", () => {
    const snapshot = buildDwmProductSnapshot({
      tenantId: "tenant_acme",
      watchlist: ["quiet.example"],
      sources: [telegramSource, darkwebSource],
      captures: [],
      generatedAt: "2026-06-27T08:20:00.000Z"
    });

    expect(snapshot.readiness.decision).toBe("production_ready_with_live_sources");
    expect(snapshot.alerts).toHaveLength(0);
    expect(snapshot.readiness.blockers).toEqual([]);
    expect(snapshot.sourceCoverage.find((row) => row.family === "actor_page")).toMatchObject({ sourceCount: 1, activeCount: 1 });
  });

  test("mounts the DWM product API route", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(telegramSource);
    store.saveSource(darkwebSource);
    store.saveCapture(telegramCapture);
    store.saveCapture(darkwebCapture);

    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/product?tenantId=tenant_acme&watchlist=acme.com"), {
      store,
      frontier: new FocusedFrontier()
    });
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body.schemaVersion).toBe("dwm.product.v1");
    expect(body.alerts).toHaveLength(2);
    expect(body.sourceCoverage.find((row: any) => row.family === "telegram_public").activeCount).toBe(1);
  });

  test("mounts the DWM operations API route with safe recent capture proof", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(telegramSource);
    store.saveSource(darkwebSource);
    store.saveCapture(telegramCapture);
    store.saveCapture(darkwebCapture);

    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/operations?tenantId=tenant_acme&watchlist=quiet.example"), {
      store,
      frontier: new FocusedFrontier()
    });
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body.schemaVersion).toBe("dwm.operations.v1");
    expect(body.counts.latestCaptureCount).toBe(2);
    expect(body.zeroAlertExplanation.state).toBe("monitoring_no_matches");
    expect(body.latestCaptures.some((capture: any) => capture.redactionState === "metadata_only")).toBe(true);
    expect(JSON.stringify(body)).not.toContain(".onion/acme");
  });

  test("keeps product evidence in the exact tenant scope", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(telegramSource);
    store.saveCapture(telegramCapture);
    store.saveSource({ ...darkwebSource, id: "src_other", tenantId: "tenant_other" });
    store.saveCapture({ ...darkwebCapture, id: "cap_other", sourceId: "src_other", tenantId: "tenant_other" });

    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/product?tenantId=tenant_acme&watchlist=acme.com"), {
      store,
      frontier: new FocusedFrontier()
    });
    const body = await response.json() as any;

    expect(body.alerts).toHaveLength(1);
    expect(body.alerts[0].provenance.captureIds).toEqual(["cap_telegram_1"]);
    expect(JSON.stringify(body)).not.toContain("cap_other");
  });
});
