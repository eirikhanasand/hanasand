import { describe, expect, test } from "bun:test";
import { findSearchCaptures, findSearchCapturesFromRows, warmSearchCaptureIndex } from "../api/searchCaptureIndex.ts";
import { automaticSourceReviewEvidenceBindingsMatch, sourceAutomaticReviewEvidenceBindings } from "../api/automaticReviewRoutes.ts";
import { SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION, SOURCE_AUTOMATIC_REVIEW_SCHEMA, automaticReviewModelVersion, automaticSourceReviewIdentity, hasApprovedAutomaticSourceReview } from "../policy/sourceAutomaticReview.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { fixtureCapture } from "./helpers/apiFixtures.ts";
import { source } from "./helpers/plannerFixtures.ts";

describe("search capture index", () => {
  test("does not build an in-memory index for PostgreSQL-backed search", () => {
    expect(warmSearchCaptureIndex({
      usesPostgresSearchIndex: false,
      listSearchCaptureChanges: () => { throw new Error("PostgreSQL startup scanned hydrated captures"); }
    })).toEqual({ captureCount: 0, indexedCaptureCount: 0 });
  });

  test("uses retained review evidence when filtering bounded PostgreSQL rows", () => {
    const store = new InMemoryScraperStore();
    const sourceId = "src_reviewed_postgres_search";
    store.saveSource({ ...source({ id: sourceId, metadata: { queryClass: "threat-intel", sourcePortfolioVerification: { outcome: "content_parsed" } } }), tenantId: "tenant_api" });
    const evidence = store.saveCapture(fixtureCapture({ id: "cap_review_evidence", tenantId: "tenant_api", sourceId, url: "https://example.test/review-evidence", body: "Publisher evidence selected by governed review.", contentHash: "review-evidence", metadata: { sourceReviewCandidate: true, safeExcerpt: "Publisher evidence selected by governed review." } }));
    const match = store.saveCapture(fixtureCapture({ id: "cap_review_match", tenantId: "tenant_api", sourceId, url: "https://example.test/review-match", collectedAt: "2026-05-24T01:00:00.000Z", body: "Unfamiliar harmful activity against diplomatic organizations.", contentHash: "review-match", metadata: { sourceReviewCandidate: true, safeExcerpt: "Unfamiliar harmful activity against diplomatic organizations." } }));
    const current = store.getSource(sourceId)!;
    const selectedEvidenceProvenance = sourceAutomaticReviewEvidenceBindings(current, [evidence]);
    expect(selectedEvidenceProvenance).toHaveLength(1);
    const reviewed = store.saveSource({
      ...current,
      metadata: {
        ...current.metadata,
        automaticSourceReview: {
          schemaVersion: SOURCE_AUTOMATIC_REVIEW_SCHEMA,
          state: "approved",
          promptVersion: SOURCE_AUTOMATIC_REVIEW_PROMPT_VERSION,
          configuredModelVersion: automaticReviewModelVersion(),
          sourceIdentity: automaticSourceReviewIdentity(current),
          requestSha256: "a".repeat(64),
          selectedEvidenceIds: selectedEvidenceProvenance.map((item) => item.evidenceId),
          selectedEvidenceProvenance,
          runtimeIdentity: { status: "completed", conversationId: "bounded-postgres-search" },
          decision: { subject: { type: "source", id: sourceId }, action: "confirm", claimValidity: "supported" }
        }
      }
    } as any);

    expect(hasApprovedAutomaticSourceReview(reviewed)).toBe(true);
    expect(automaticSourceReviewEvidenceBindingsMatch(reviewed, (id) => store.getCapture(id))).toBe(true);
    expect(findSearchCapturesFromRows([match], [reviewed], "harmful activity", 10, "tenant_api", undefined, (id) => store.getCapture(id)).map((capture) => capture.id)).toEqual([match.id]);
  });

  test("indexes retained historical actor evidence", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_apt29_history", metadata: { queryClass: "threat-intel" } }));
    store.saveCapture(fixtureCapture({ id: "cap_apt29_history", sourceId: "src_apt29_history", body: undefined, publishedAt: "2025-09-01T00:00:00.000Z", collectedAt: "2026-07-21T00:00:00.000Z", metadata: { safeExcerpt: "Amazon disrupted an APT29 watering hole campaign targeting diplomatic organizations with credential phishing and malware." } }));
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api")).toEqual([expect.objectContaining({ id: "cap_apt29_history" })]);
    expect(findSearchCaptures(store, "APT29 diplomatic", 10, "tenant_api")).toEqual([expect.objectContaining({ id: "cap_apt29_history" })]);
    expect(findSearchCaptures(store, "Definitely Not A Real Actor 2026", 10, "tenant_api")).toEqual([]);
  });

  test("refreshes only changed capture documents", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_incremental_search", metadata: { queryClass: "threat-intel" } }));
    let oldTitleReads = 0;
    const old = fixtureCapture({ id: "cap_old", sourceId: "src_incremental_search", body: undefined, collectedAt: "2026-05-23T00:00:00.000Z", metadata: { safeExcerpt: "APT29 launched a retained credential phishing campaign against diplomatic organizations." } });
    Object.defineProperty(old, "title", { configurable: true, enumerable: true, get: () => { oldTitleReads++; return "Retained report"; } });
    store.saveCapture(old);
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api").map((capture) => capture.id)).toEqual(["cap_old"]);
    const readsAfterInitialIndex = oldTitleReads;

    store.saveCapture(fixtureCapture({ id: "cap_new", sourceId: "src_incremental_search", title: "New report", body: undefined, contentHash: "new-capture-hash", collectedAt: "2026-05-24T00:00:00.000Z", metadata: { safeExcerpt: "APT29 launched another credential phishing campaign against diplomatic organizations." } }));
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api").map((capture) => capture.id)).toEqual(["cap_new", "cap_old"]);
    expect(oldTitleReads).toBe(readsAfterInitialIndex);

    store.updateCaptureMetadata("cap_old", (metadata) => ({ ...metadata, safeExcerpt: "A retained credential phishing report no longer names the queried actor or activity cluster." }));
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api").map((capture) => capture.id)).toEqual(["cap_new"]);
  });

  test("queries only matching postings without enumerating or scoring unrelated captures", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_bounded_search", metadata: { queryClass: "threat-intel" } }));
    store.saveCapture(fixtureCapture({ id: "cap_match", sourceId: "src_bounded_search", body: undefined, contentHash: "bounded-match", metadata: { safeExcerpt: "APT29 targeted diplomatic organizations with credential phishing." } }));
    for (let i = 0; i < 2_000; i++) store.saveCapture(fixtureCapture({ id: `cap_noise_${i}`, sourceId: "src_bounded_search", body: undefined, contentHash: `bounded-noise-${i}`, metadata: { safeExcerpt: `Unrelated retained security bulletin ${i}.` } }));

    expect(warmSearchCaptureIndex(store)).toEqual({ captureCount: 2_001, indexedCaptureCount: 1 });
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api").map((capture) => capture.id)).toEqual(["cap_match"]);
    const noise = store.getCapture("cap_noise_0")!;
    Object.defineProperty(noise, "sourceId", { configurable: true, enumerable: true, get: () => { throw new Error("unrelated capture was scored"); } });
    (store as any).listCaptures = () => { throw new Error("complete capture enumeration is forbidden"); };

    expect(findSearchCaptures(store, "APT29", 10, "tenant_api").map((capture) => capture.id)).toEqual(["cap_match"]);
  });

  test("refreshes tenant, source, incident, and retention projections", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(source({ id: "src_projection", tenantId: "tenant_api", name: "Neutral publisher", metadata: { queryClass: "threat-intel" } }));
    store.saveSource(source({ id: "src_projection_foreign", tenantId: "tenant_other", name: "APT29 foreign publisher", metadata: { queryClass: "threat-intel" } }));
    store.saveCapture(fixtureCapture({ id: "cap_projection", sourceId: "src_projection", title: undefined, body: undefined, contentHash: "projection-capture", metadata: { safeExcerpt: "Lazarus Group credential phishing campaign targeted diplomatic organizations with malware." } }));
    store.saveCapture(fixtureCapture({ id: "cap_projection_foreign", tenantId: "tenant_other", sourceId: "src_projection_foreign", body: undefined, contentHash: "projection-foreign", metadata: { safeExcerpt: "APT29 credential phishing campaign targeted diplomatic organizations." } }));

    expect(findSearchCaptures(store, "APT29", 10, "tenant_api")).toEqual([]);
    store.saveSource(source({ id: "src_projection", tenantId: "tenant_api", name: "APT29 public attribution", metadata: { queryClass: "threat-intel" } }));
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api").map((capture) => capture.id)).toEqual(["cap_projection"]);

    store.saveSource(source({ id: "src_projection", tenantId: "tenant_api", name: "Neutral publisher", metadata: { queryClass: "threat-intel" } }));
    store.saveIncident({ id: "incident_projection", tenantId: "tenant_api", captureId: "cap_projection", title: "APT29 credential phishing", firstSeenAt: "2026-05-23T00:00:00.000Z" } as any);
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api").map((capture) => capture.id)).toEqual(["cap_projection"]);

    store.saveIncident({ id: "incident_projection", tenantId: "tenant_api", captureId: "cap_projection", title: "Credential phishing report", firstSeenAt: "2026-05-23T00:00:00.000Z" } as any);
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api")).toEqual([]);

    store.updateCaptureMetadata("cap_projection", (metadata) => ({ ...metadata, safeExcerpt: "APT29 credential phishing campaign targeted diplomatic organizations." }));
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api").map((capture) => capture.id)).toEqual(["cap_projection"]);
    store.replaceCaptureForRetention({ ...store.getCapture("cap_projection")!, body: undefined, rawText: undefined, metadata: { safeExcerpt: "Credential phishing report retained without actor attribution." } });
    expect(findSearchCaptures(store, "APT29", 10, "tenant_api")).toEqual([]);
    expect(findSearchCaptures(store, "APT29", 10, "tenant_other").map((capture) => capture.id)).toEqual(["cap_projection_foreign"]);
  });
});
