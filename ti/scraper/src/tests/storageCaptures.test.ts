import { describe, expect, test } from "bun:test";
import { toSafeCaptureDto } from "../api/captureDtos.ts";
import { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../storage/memoryStore.ts";
import { DEFAULT_RETENTION_POLICIES, buildRetentionJob } from "../storage/retention.ts";
import { fixtureCapture } from "./helpers/storageFixtures.ts";

describe("raw capture storage", () => {
  test("keeps captures immutable once written", () => {
    const store = new InMemoryScraperStore();
    const capture = fixtureCapture({ id: "cap_immutable" });
    store.saveCapture(capture);
    expect(() => store.saveCapture({ ...capture, metadata: { changed: true } })).toThrow("Capture is immutable");
  });

  test("suppresses duplicates by canonical URL, text hash, and timestamp", () => {
    const store = new InMemoryScraperStore();
    const first = fixtureCapture({ id: "cap_first", url: "https://Example.test/report?b=2&a=1#section", publishedAt: "2026-05-20T10:00:00.000Z" });
    const duplicate = fixtureCapture({ id: "cap_duplicate", url: "https://example.test/report?a=1&b=2", publishedAt: first.publishedAt, body: "Updated body that should not replace immutable evidence." });
    const textFirst = fixtureCapture({ id: "cap_text_first", url: "https://example.test/a", body: "LockBit claimed a victim in a public post.", publishedAt: "2026-05-21T10:00:00.000Z" });
    const textDuplicate = fixtureCapture({ id: "cap_text_duplicate", url: "https://mirror.example.test/a", body: "LockBit   claimed a victim in a public post.", publishedAt: textFirst.publishedAt });

    expect(store.saveCaptureWithDedupe(first).status).toBe("inserted");
    expect(store.saveCaptureWithDedupe(duplicate)).toMatchObject({ status: "duplicate", duplicateOf: first.id });
    store.saveCapture(textFirst);
    expect(store.saveCaptureWithDedupe(textDuplicate)).toMatchObject({ status: "duplicate", duplicateOf: textFirst.id });
    expect(store.listCaptures()).toHaveLength(2);
  });

  test("redacts sensitive captures to metadata-only persistence", () => {
    const store = new InMemoryScraperStore();
    const stored = store.saveCapture(fixtureCapture({ id: "cap_sensitive", body: "private leaked row", sensitive: true, sensitivityFlags: ["leak_metadata"], storageKind: "inline_text" }));
    expect(stored.storageKind).toBe("metadata_only");
    expect(stored.body).toBeUndefined();
    expect(stored.retentionClass).toBe("restricted_metadata");
    expect(stored.redaction?.policy).toBe("metadata_only");
  });

  test("returns replayable pipeline inputs without mutating capture evidence", () => {
    const store = new InMemoryScraperStore();
    const capture = fixtureCapture({ id: "cap_replay" });
    store.saveCapture(capture);
    const replay = store.replayInput("cap_replay", "extractor.test.v1");
    expect(replay).toMatchObject({ captureId: "cap_replay", body: capture.body, extractorVersion: "extractor.test.v1" });
  });

  test("provides object-store records for external object captures", () => {
    const objects = new InMemoryObjectEvidenceStore();
    const record = objects.putObject({ sourceId: "src_fixture", captureId: "cap_object", mediaType: "text/html", body: "<html>allowed public report</html>", contentHash: "hash_object", retentionClass: "public_raw" });
    expect(record.ref.bucket).toBe("memory-evidence");
    expect(objects.getObject(record.ref)?.captureId).toBe("cap_object");
    expect(objects.deleteObject(record.ref, "test cleanup")).toBe(true);
  });

  test("builds retention jobs by class without selecting legal hold", () => {
    const captures = [
      fixtureCapture({ id: "cap_old_short", collectedAt: "2026-01-01T00:00:00.000Z", retentionClass: "short" }),
      fixtureCapture({ id: "cap_hold", collectedAt: "2026-01-01T00:00:00.000Z", retentionClass: "legal_hold" })
    ];
    expect(buildRetentionJob(captures, DEFAULT_RETENTION_POLICIES.short, "2026-05-24T00:00:00.000Z").affectedCaptureIds).toEqual(["cap_old_short"]);
    expect(buildRetentionJob(captures, DEFAULT_RETENTION_POLICIES.legal_hold, "2026-05-24T00:00:00.000Z")).toMatchObject({ action: "legal_hold", affectedCaptureIds: [] });
  });

  test("safe capture DTOs hide sensitive bodies and raw object keys", () => {
    const sensitive = fixtureCapture({ id: "cap_safe_dto_sensitive", sensitive: true, body: "leaked body", storageKind: "inline_text" });
    const publicExternal = fixtureCapture({ id: "cap_safe_dto_external", storageKind: "external_object", body: undefined, objectRef: { bucket: "evidence", key: "tenant/source/private-key", versionId: "v1", sizeBytes: 100, sha256: "hash" } });
    expect(toSafeCaptureDto(sensitive, { includeBody: true }).body).toBeUndefined();
    expect(toSafeCaptureDto(sensitive, { includeBody: true }).bodyRedacted).toBe(true);
    expect(toSafeCaptureDto(publicExternal).objectRef).toMatchObject({ bucket: "evidence", keyRedacted: true });
    expect("key" in (toSafeCaptureDto(publicExternal).objectRef ?? {})).toBe(false);
  });

  test("query helpers enforce tenant scope for latest evidence and source freshness", () => {
    const store = new InMemoryScraperStore();
    store.saveCapture(fixtureCapture({ id: "cap_tenant_a", tenantId: "tenant_a", sourceId: "src_a", collectedAt: "2026-05-24T10:00:00.000Z" }));
    store.saveCapture(fixtureCapture({ id: "cap_tenant_b", tenantId: "tenant_b", sourceId: "src_b", collectedAt: "2026-05-24T11:00:00.000Z" }));
    expect(store.queries().latestCaptures({ tenantId: "tenant_a" }).map((capture) => capture.id)).toEqual(["cap_tenant_a"]);
    expect(store.queries().sourceFreshness({ tenantId: "tenant_a" })).toEqual([{ sourceId: "src_a", tenantId: "tenant_a", latestCollectedAt: "2026-05-24T10:00:00.000Z", captureCount: 1, latestCaptureId: "cap_tenant_a" }]);
  });
});
