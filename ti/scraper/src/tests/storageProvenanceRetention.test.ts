import { describe, expect, test } from "bun:test";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { DEFAULT_RETENTION_POLICIES, defaultRetentionClassForCapture, enforceRetentionPolicy, normalizeDefaultRetentionClasses, simulateRetentionEnforcement } from "../storage/retention.ts";
import { InMemoryObjectEvidenceStore } from "../storage/memoryObjectEvidenceStore.ts";
import { hashContent } from "../utils.ts";
import { actorIdentity } from "./apiTestHarness.ts";
import { fixtureCapture } from "./helpers/storageFixtures.ts";

describe("storage provenance replay and retention", () => {
  test("records replay results without mutating raw evidence", () => {
    const store = new InMemoryScraperStore();
    const original = store.saveCapture(fixtureCapture({ id: "cap_replay_result", body: "APT29 used phishing against Example Corp with CVE-2026-1234." }));
    const job = store.createReplayJob({ captureId: original.id, sourceId: original.sourceId, fromExtractorVersion: original.provenance?.extractorVersion, toExtractorVersion: "extractor.future.v2" });
    const result = processCollectedItem({ sourceId: original.sourceId, taskId: original.taskId, url: original.url, collectedAt: original.collectedAt, rawText: original.body ?? "", contentHash: original.contentHash, links: [], metadata: original.metadata, sensitive: original.sensitive });
    const completed = store.recordReplayResult(job.id, { ...result, capture: original });
    expect(completed.status).toBe("succeeded");
    expect(completed.indicatorCount).toBeGreaterThan(0);
    expect(completed.metadata.rawEvidenceMutated).toBe(false);
    expect(store.getCapture(original.id)).toEqual(original);
  });

  test("builds immutable provenance chains for APT29 claims", () => {
    const store = new InMemoryScraperStore();
    const rawText = "APT29 used phishing against Example Health with CVE-2026-1234.";
    const result = processCollectedItem({ sourceId: "src_apt29", taskId: "task_apt29", url: "https://example.test/apt29", collectedAt: "2026-05-24T12:00:00.000Z", title: "APT29 report", rawText, contentHash: hashContent(rawText), links: [], metadata: { fixture: true }, sensitive: false }, {
      actorIdentities: [actorIdentity("G0016", "APT29", ["Nobelium", "Cozy Bear", "Midnight Blizzard"])]
    });
    store.savePipelineResult(result);
    const chain = store.queries().provenanceForClaim({ actor: "APT29" })[0];
    expect(chain).toMatchObject({ sourceId: "src_apt29", taskId: "task_apt29", captureId: result.capture.id, incidentId: result.incident?.id, extractorVersion: result.incident?.extractorVersion, contentHash: result.capture.contentHash, confidence: result.incident?.confidence });
    expect(chain?.claimValues).toContain("APT29");
  });

  test("replay lineage includes run id and diff summary for newer extractors", () => {
    const store = new InMemoryScraperStore();
    const original = store.saveCapture(fixtureCapture({ id: "cap_replay_lineage", body: "APT29 used phishing against Example Corp with CVE-2026-1234." }));
    const job = store.createReplayJob({ captureId: original.id, sourceId: original.sourceId, toExtractorVersion: "extractor.future.v3", runId: "run_replay", metadata: { previousIndicatorCount: 0, previousEntityCount: 0 } });
    const result = processCollectedItem({ sourceId: original.sourceId, url: original.url, collectedAt: original.collectedAt, rawText: original.body ?? "", contentHash: original.contentHash, links: [], metadata: original.metadata, sensitive: false });
    const completed = store.recordReplayResult(job.id, { ...result, capture: original });
    expect(completed.runId).toBe("run_replay");
    expect(completed.diffSummary?.indicatorDelta).toBeGreaterThan(0);
    expect(store.queries().replayStatus({ captureId: original.id })[0]?.id).toBe(job.id);
  });

  test("retention simulation strips expired bodies but never legal-hold metadata", () => {
    const oldPublicChat = fixtureCapture({ id: "cap_chat_old", collectedAt: "2026-01-01T00:00:00.000Z", retentionClass: "public_chat_text", body: "public channel text" });
    const legalHold = fixtureCapture({ id: "cap_legal_hold", collectedAt: "2026-01-01T00:00:00.000Z", retentionClass: "legal_hold", legalHold: true, body: "must stay" });
    const simulation = simulateRetentionEnforcement([oldPublicChat, legalHold], DEFAULT_RETENTION_POLICIES.public_chat_text, "2026-12-31T00:00:00.000Z");
    expect(simulation.mutated.find((capture) => capture.id === "cap_chat_old")?.body).toBeUndefined();
    expect(simulation.mutated.find((capture) => capture.id === "cap_legal_hold")?.metadata).toEqual(legalHold.metadata);
    expect(simulation.mutated.find((capture) => capture.id === "cap_legal_hold")?.body).toBe("must stay");
  });

  test("enforces expired object retention once and records a safe audit", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    const capture = fixtureCapture({ id: "cap_expired_object", collectedAt: "2025-01-01T00:00:00.000Z", retentionClass: "public_raw", body: undefined, storageKind: "object_ref" });
    const object = objects.putObject({ sourceId: capture.sourceId, captureId: capture.id, mediaType: capture.mediaType, body: "expired public evidence", contentHash: capture.contentHash, retentionClass: capture.retentionClass });
    store.saveCapture({ ...capture, objectRef: object.ref });

    const first = enforceRetentionPolicy(store, DEFAULT_RETENTION_POLICIES.public_raw, objects, "2026-12-31T00:00:00.000Z");
    expect(first.deletionAudit).toHaveLength(1);
    expect(objects.getObject(object.ref)).toBeUndefined();
    expect(store.getCapture(capture.id)).toMatchObject({ storageKind: "metadata_only", objectRef: undefined, metadata: { retentionAudit: [expect.objectContaining({ action: "delete_object" })] } });
    expect(enforceRetentionPolicy(store, DEFAULT_RETENTION_POLICIES.public_raw, objects, "2027-01-01T00:00:00.000Z").deletionAudit).toHaveLength(0);
  });

  test("classifies retention defaults by source and sensitivity", () => {
    expect(defaultRetentionClassForCapture({ sourceType: "rss" })).toBe("public_report");
    expect(defaultRetentionClassForCapture({ sourceType: "telegram_public" })).toBe("public_chat_text");
    expect(defaultRetentionClassForCapture({ sourceType: "tor_metadata" })).toBe("darknet_metadata");
    expect(defaultRetentionClassForCapture({ metadata: { screenshotHash: "hash" } })).toBe("screenshot_hash");
    expect(defaultRetentionClassForCapture({ sensitive: true })).toBe("sensitive_metadata");
    expect(DEFAULT_RETENTION_POLICIES.discovery_snippet.ttlDays).toBeLessThan(DEFAULT_RETENTION_POLICIES.public_chat_text.ttlDays ?? 0);
  });

  test("assigns source-aware retention to new and existing captures", () => {
    const result = processCollectedItem({
      sourceId: "src_retention_rss",
      url: "https://example.test/advisory",
      collectedAt: "2026-05-24T12:00:00.000Z",
      rawText: "Public advisory evidence.",
      contentHash: "hash_retention_rss",
      links: [],
      metadata: { adapter: "rss" },
      sensitive: false
    });
    expect(result.capture).toMatchObject({ retentionClass: "public_report", metadata: { retentionPolicy: { class: "public_report", assignedFrom: "rss" } } });

    const store = new InMemoryScraperStore();
    store.saveCapture(fixtureCapture({ id: "cap_legacy_telegram", retentionClass: "standard", metadata: { adapter: "telegram_public" } }));
    expect(normalizeDefaultRetentionClasses(store, "2026-07-20T00:00:00.000Z")).toBe(1);
    expect(store.getCapture("cap_legacy_telegram")).toMatchObject({ retentionClass: "public_chat_text", metadata: { retentionPolicy: { assignedAt: "2026-07-20T00:00:00.000Z" } } });
  });
});
