import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { buildDwmProductSnapshot, classifySourceFamily, matchTimingForEvidence, normalizeWatchlist } from "../product/dwmProduct.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const telegramSource: SourceRecord = {
  id: "src_telegram_lumma",
  name: "Lumma broker public channel",
  type: "telegram_public",
  url: "https://t.me/lumma_broker_room",
  accessMethod: "public_http",
  status: "active",
  risk: "medium",
  trustScore: 0.82,
  legalNotes: "Public Telegram messages only.",
  approvedAt: "2026-06-26T00:00:00.000Z",
  approvedBy: "source-reviewer",
  governance: {
    approvalRequired: true,
    approvalState: "approved",
    metadataOnly: false,
    approvedAt: "2026-06-26T00:00:00.000Z",
    approvedBy: "source-reviewer"
  },
  metadata: { productionCollection: true, collectionMode: "public_web_preview" },
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
  approvedAt: "2026-06-26T00:00:00.000Z",
  approvedBy: "source-reviewer",
  governance: {
    approvalRequired: true,
    approvalState: "approved",
    metadataOnly: true,
    approvedAt: "2026-06-26T00:00:00.000Z",
    approvedBy: "source-reviewer"
  },
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

function timingEvidence(id: string, publishedAt: string, collectedAt: string) {
  return {
    id,
    firstSeenAt: publishedAt,
    observedAt: publishedAt,
    provenance: { publishedAt, collectedAt }
  } as any;
}

describe("dwm product snapshot", () => {
  test("classifies backfill from each retained publication-to-collection gap", () => {
    const historical = timingEvidence("historical", "2026-01-01T00:00:00.000Z", "2026-01-03T00:00:00.000Z");
    const current = timingEvidence("current", "2026-01-03T00:00:00.000Z", "2026-01-03T00:05:00.000Z");

    expect(matchTimingForEvidence([historical], "2026-01-03T00:10:00.000Z")).toMatchObject({
      kind: "historical_backfill",
      historicalEvidenceCount: 1
    });
    expect(matchTimingForEvidence([current], "2026-01-03T00:10:00.000Z")).toMatchObject({
      kind: "new_evidence",
      historicalEvidenceCount: 0
    });
    expect(matchTimingForEvidence([historical, current], "2026-01-03T00:10:00.000Z")).toMatchObject({
      kind: "new_evidence",
      historicalEvidenceCount: 1
    });
    expect(matchTimingForEvidence([current], "2030-01-01T00:00:00.000Z")).toMatchObject({
      kind: "new_evidence",
      historicalEvidenceCount: 0
    });
  });
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
    expect(snapshot.sourceInventory.counts).toMatchObject({ registeredTelegramPublic: 1, registeredDarkwebMetadata: 1, registeredActiveOrCanary: 2 });
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
    expect(body.alerts.find((alert: any) => alert.sourceFamily === "darkweb_metadata").evidence[0].url).toBeUndefined();
    expect(body.alerts.find((alert: any) => alert.sourceFamily === "darkweb_metadata").evidence[0].urlHash).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain(".onion");
    expect(store.getCapture("cap_darkweb_1")?.url).toBe(darkwebCapture.url);
  });

  test("keeps persisted workflow alerts out of the derived product snapshot", async () => {
    const store = new InMemoryScraperStore();
    store.saveDwmAlert({
      id: "alert_saved_only",
      tenantId: "tenant_acme",
      dedupeKey: "saved-only",
      evidence: [],
      deliveryState: "pending_review"
    });

    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/product?tenantId=tenant_acme&watchlist=acme.com"), {
      store,
      frontier: new FocusedFrontier()
    });
    const body = await response.json() as any;

    expect(response.status).toBe(200);
    expect(body.alerts).toEqual([]);
    expect(store.listDwmAlerts()).toHaveLength(1);
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

  test("includes global operations evidence without crossing tenant scope", async () => {
    const store = new InMemoryScraperStore();
    const globalSource = { ...telegramSource, id: "src_global", tenantId: undefined } as SourceRecord;
    const tenantASource = { ...darkwebSource, id: "src_tenant_a", tenantId: "tenant_a" } as SourceRecord;
    const tenantBSource = { ...darkwebSource, id: "src_tenant_b", tenantId: "tenant_b" } as SourceRecord;
    store.saveSource(globalSource);
    store.saveSource(tenantASource);
    store.saveSource(tenantBSource);
    store.saveCapture({ ...telegramCapture, id: "cap_global", sourceId: globalSource.id, tenantId: undefined });
    store.saveCapture({ ...darkwebCapture, id: "cap_tenant_a", sourceId: tenantASource.id, tenantId: "tenant_a" });
    store.saveCapture({ ...darkwebCapture, id: "cap_tenant_b", sourceId: tenantBSource.id, tenantId: "tenant_b" });
    store.saveRun({ id: "run_global", requestId: "req_public_canary", status: "completed", tenantId: undefined, captureCount: 9, taskCount: 9, updatedAt: "2026-07-22T12:03:00.000Z" });
    store.saveRun({ id: "run_tenant_a", requestId: "req_public_canary", status: "completed", tenantId: "tenant_a", captureCount: 2, taskCount: 2, updatedAt: "2026-07-22T12:01:00.000Z" });
    store.saveRun({ id: "run_tenant_b", requestId: "req_public_canary", status: "completed", tenantId: "tenant_b", captureCount: 1, taskCount: 1, updatedAt: "2026-07-22T12:02:00.000Z" });

    const options = { store, frontier: new FocusedFrontier() };
    const tenantA = await (await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/operations?tenantId=tenant_a"), options)).json() as any;
    const tenantB = await (await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/operations?tenantId=tenant_b"), options)).json() as any;
    const productA = await (await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/product?tenantId=tenant_a"), options)).json() as any;
    const empty = await (await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/operations?tenantId=tenant_empty"), {
      store: new InMemoryScraperStore(),
      frontier: new FocusedFrontier()
    })).json() as any;

    expect(tenantA.counts).toMatchObject({ sourceCount: 2, activeSourceCount: 2, captureCount: 2 });
    expect(tenantA.latestRun).toMatchObject({ id: "run_tenant_a", captureCount: 2 });
    expect(tenantB.latestRun).toMatchObject({ id: "run_tenant_b", captureCount: 1 });
    expect(tenantA.sourceHealth.map((row: any) => row.sourceId).sort()).toEqual(["src_global", "src_tenant_a"]);
    expect(tenantB.sourceHealth.map((row: any) => row.sourceId).sort()).toEqual(["src_global", "src_tenant_b"]);
    expect(productA.sourceInventory.counts.registeredTotal).toBe(tenantA.counts.sourceCount);
    expect(empty.counts).toMatchObject({ sourceCount: 0, activeSourceCount: 0, captureCount: 0 });
    expect(empty.latestRun).toBeUndefined();
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
