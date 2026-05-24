import { describe, expect, test } from "bun:test";
import { toSafeCaptureDto } from "../api/captureDtos.ts";
import { buildProgressiveGraphUpdate, exportProgressiveGraphToStixBundle } from "../export/progressiveGraph.ts";
import { validateStixBundle } from "../export/stixValidation.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../storage/memoryStore.ts";
import {
  DEFAULT_RETENTION_POLICIES,
  buildRetentionJob,
  defaultRetentionClassForCapture,
  simulateRetentionEnforcement
} from "../storage/retention.ts";
import type { DiscoveryEvidence, EvidenceDelta, LiveSearchSnapshot, ProgressiveGraphEvidence, RawCapture } from "../types.ts";
import { hashContent, stableId } from "../utils.ts";

describe("raw evidence store", () => {
  test("keeps captures immutable once written", () => {
    const store = new InMemoryScraperStore();
    const capture = fixtureCapture({ id: "cap_immutable" });

    store.saveCapture(capture);

    expect(() => store.saveCapture({
      ...capture,
      metadata: { changed: true }
    })).toThrow("Capture is immutable");
  });

  test("suppresses duplicates by source, canonical URL, and published timestamp", () => {
    const store = new InMemoryScraperStore();
    const first = fixtureCapture({
      id: "cap_first",
      url: "https://Example.test/report?b=2&a=1#section",
      publishedAt: "2026-05-20T10:00:00.000Z"
    });
    const duplicate = fixtureCapture({
      id: "cap_duplicate",
      url: "https://example.test/report?a=1&b=2",
      publishedAt: "2026-05-20T10:00:00.000Z",
      body: "Updated body that should not replace immutable evidence."
    });

    const inserted = store.saveCaptureWithDedupe(first);
    const suppressed = store.saveCaptureWithDedupe(duplicate);

    expect(inserted.status).toBe("inserted");
    expect(suppressed.status).toBe("duplicate");
    expect(suppressed.duplicateOf).toBe(first.id);
    expect(store.listCaptures()).toHaveLength(1);
  });

  test("suppresses duplicates by source, normalized text hash, and published timestamp", () => {
    const store = new InMemoryScraperStore();
    const body = "LockBit claimed a victim in a public post.";
    const first = fixtureCapture({
      id: "cap_text_first",
      url: "https://example.test/a",
      body,
      publishedAt: "2026-05-21T10:00:00.000Z"
    });
    const duplicate = fixtureCapture({
      id: "cap_text_duplicate",
      url: "https://mirror.example.test/a",
      body: "LockBit   claimed a victim in a public post.",
      publishedAt: "2026-05-21T10:00:00.000Z"
    });

    store.saveCapture(first);
    const result = store.saveCaptureWithDedupe(duplicate);

    expect(result.status).toBe("duplicate");
    expect(result.duplicateOf).toBe(first.id);
    expect(store.listCaptures()).toHaveLength(1);
  });

  test("redacts sensitive captures to metadata-only persistence", () => {
    const store = new InMemoryScraperStore();
    const capture = fixtureCapture({
      id: "cap_sensitive",
      body: "private leaked row that must not be stored",
      sensitive: true,
      sensitivityFlags: ["leak_metadata"],
      storageKind: "inline_text"
    });

    const stored = store.saveCapture(capture);

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

    expect(replay?.captureId).toBe("cap_replay");
    expect(replay?.body).toBe(capture.body);
    expect(replay?.extractorVersion).toBe("extractor.test.v1");
  });

  test("records replay results for newer extractor versions without mutating raw evidence", () => {
    const store = new InMemoryScraperStore();
    const original = store.saveCapture(fixtureCapture({
      id: "cap_replay_result",
      body: "APT29 used phishing against Example Corp with CVE-2026-1234."
    }));
    const job = store.createReplayJob({
      captureId: original.id,
      sourceId: original.sourceId,
      fromExtractorVersion: original.provenance?.extractorVersion,
      toExtractorVersion: "extractor.future.v2"
    });

    const result = processCollectedItem({
      sourceId: original.sourceId,
      taskId: original.taskId,
      url: original.url,
      collectedAt: original.collectedAt,
      rawText: original.body ?? "",
      contentHash: original.contentHash,
      links: [],
      metadata: original.metadata,
      sensitive: original.sensitive
    });
    const completed = store.recordReplayResult(job.id, {
      ...result,
      capture: original
    });

    expect(completed.status).toBe("succeeded");
    expect(completed.indicatorCount).toBeGreaterThan(0);
    expect(completed.metadata.rawEvidenceMutated).toBe(false);
    expect(store.getCapture(original.id)).toEqual(original);
    expect(store.listReplayJobs()).toHaveLength(1);
  });

  test("provides test/dev object store records for external object captures", () => {
    const objects = new InMemoryObjectEvidenceStore();
    const record = objects.putObject({
      sourceId: "src_fixture",
      captureId: "cap_object",
      mediaType: "text/html",
      body: "<html>allowed public report</html>",
      contentHash: "hash_object",
      retentionClass: "public_raw"
    });

    expect(record.ref.bucket).toBe("memory-evidence");
    expect(objects.getObject(record.ref)?.captureId).toBe("cap_object");
    expect(objects.deleteObject(record.ref, "test cleanup")).toBe(true);
  });

  test("builds retention jobs by retention class without selecting legal hold", () => {
    const captures = [
      fixtureCapture({ id: "cap_old_short", collectedAt: "2026-01-01T00:00:00.000Z", retentionClass: "short" }),
      fixtureCapture({ id: "cap_hold", collectedAt: "2026-01-01T00:00:00.000Z", retentionClass: "legal_hold" })
    ];

    const shortJob = buildRetentionJob(captures, DEFAULT_RETENTION_POLICIES.short, "2026-05-24T00:00:00.000Z");
    const holdJob = buildRetentionJob(captures, DEFAULT_RETENTION_POLICIES.legal_hold, "2026-05-24T00:00:00.000Z");

    expect(shortJob.affectedCaptureIds).toEqual(["cap_old_short"]);
    expect(holdJob.action).toBe("legal_hold");
    expect(holdJob.affectedCaptureIds).toEqual([]);
  });

  test("safe capture DTOs never expose sensitive bodies or raw object keys", () => {
    const sensitive = fixtureCapture({
      id: "cap_safe_dto_sensitive",
      sensitive: true,
      body: "leaked body",
      storageKind: "inline_text"
    });
    const publicExternal = fixtureCapture({
      id: "cap_safe_dto_external",
      storageKind: "external_object",
      body: undefined,
      objectRef: {
        bucket: "evidence",
        key: "tenant/source/private-key",
        versionId: "v1",
        sizeBytes: 100,
        sha256: "hash"
      }
    });

    expect(toSafeCaptureDto(sensitive, { includeBody: true }).body).toBeUndefined();
    expect(toSafeCaptureDto(sensitive, { includeBody: true }).bodyRedacted).toBe(true);
    expect(toSafeCaptureDto(publicExternal).objectRef).toMatchObject({ bucket: "evidence", keyRedacted: true });
    expect("key" in (toSafeCaptureDto(publicExternal).objectRef ?? {})).toBe(false);
  });

  test("query helpers enforce tenant scope for latest evidence and source freshness", () => {
    const store = new InMemoryScraperStore();
    store.saveCapture(fixtureCapture({
      id: "cap_tenant_a",
      tenantId: "tenant_a",
      sourceId: "src_a",
      collectedAt: "2026-05-24T10:00:00.000Z"
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_tenant_b",
      tenantId: "tenant_b",
      sourceId: "src_b",
      collectedAt: "2026-05-24T11:00:00.000Z"
    }));

    expect(store.queries().latestCaptures({ tenantId: "tenant_a" }).map((capture) => capture.id)).toEqual(["cap_tenant_a"]);
    expect(store.queries().sourceFreshness({ tenantId: "tenant_a" })).toEqual([{
      sourceId: "src_a",
      tenantId: "tenant_a",
      latestCollectedAt: "2026-05-24T10:00:00.000Z",
      captureCount: 1,
      latestCaptureId: "cap_tenant_a"
    }]);
  });

  test("builds immutable provenance chains for APT29 claims", () => {
    const store = new InMemoryScraperStore();
    const rawText = "APT29 used phishing against Example Health with CVE-2026-1234.";
    const result = processCollectedItem({
      sourceId: "src_apt29",
      taskId: "task_apt29",
      url: "https://example.test/apt29",
      collectedAt: "2026-05-24T12:00:00.000Z",
      title: "APT29 report",
      rawText,
      contentHash: hashContent(rawText),
      links: [],
      metadata: { fixture: true },
      sensitive: false
    });
    store.savePipelineResult(result);

    const chain = store.queries().provenanceForClaim({ actor: "APT29" })[0];
    expect(chain).toMatchObject({
      sourceId: "src_apt29",
      taskId: "task_apt29",
      captureId: result.capture.id,
      incidentId: result.incident?.id,
      extractorVersion: result.incident?.extractorVersion,
      contentHash: result.capture.contentHash,
      confidence: result.incident?.confidence
    });
    expect(chain?.claimValues).toContain("APT29");
  });

  test("replay lineage includes run id and diff summary for newer extractors", () => {
    const store = new InMemoryScraperStore();
    const original = store.saveCapture(fixtureCapture({
      id: "cap_replay_lineage",
      body: "APT29 used phishing against Example Corp with CVE-2026-1234."
    }));
    const job = store.createReplayJob({
      captureId: original.id,
      sourceId: original.sourceId,
      toExtractorVersion: "extractor.future.v3",
      runId: "run_replay",
      metadata: { previousIndicatorCount: 0, previousEntityCount: 0 }
    });
    const result = processCollectedItem({
      sourceId: original.sourceId,
      url: original.url,
      collectedAt: original.collectedAt,
      rawText: original.body ?? "",
      contentHash: original.contentHash,
      links: [],
      metadata: original.metadata,
      sensitive: false
    });

    const completed = store.recordReplayResult(job.id, { ...result, capture: original });

    expect(completed.runId).toBe("run_replay");
    expect(completed.diffSummary?.indicatorDelta).toBeGreaterThan(0);
    expect(store.queries().replayStatus({ captureId: original.id })[0]?.id).toBe(job.id);
  });

  test("retention simulation strips expired bodies but never deletes legal-hold metadata", () => {
    const oldPublicChat = fixtureCapture({
      id: "cap_chat_old",
      collectedAt: "2026-01-01T00:00:00.000Z",
      retentionClass: "public_chat_text",
      body: "public channel text"
    });
    const legalHold = fixtureCapture({
      id: "cap_legal_hold",
      collectedAt: "2026-01-01T00:00:00.000Z",
      retentionClass: "legal_hold",
      legalHold: true,
      body: "must stay"
    });

    const simulation = simulateRetentionEnforcement(
      [oldPublicChat, legalHold],
      DEFAULT_RETENTION_POLICIES.public_chat_text,
      "2026-12-31T00:00:00.000Z"
    );

    expect(simulation.mutated.find((capture) => capture.id === "cap_chat_old")?.body).toBeUndefined();
    expect(simulation.mutated.find((capture) => capture.id === "cap_legal_hold")?.metadata).toEqual(legalHold.metadata);
    expect(simulation.mutated.find((capture) => capture.id === "cap_legal_hold")?.body).toBe("must stay");
  });

  test("classifies retention defaults for public reports chats darknet metadata screenshots and sensitive metadata", () => {
    expect(defaultRetentionClassForCapture({ sourceType: "rss" })).toBe("public_report");
    expect(defaultRetentionClassForCapture({ sourceType: "telegram_public" })).toBe("public_chat_text");
    expect(defaultRetentionClassForCapture({ sourceType: "tor_metadata" })).toBe("darknet_metadata");
    expect(defaultRetentionClassForCapture({ metadata: { screenshotHash: "hash" } })).toBe("screenshot_hash");
    expect(defaultRetentionClassForCapture({ sensitive: true })).toBe("sensitive_metadata");
  });

  test("stores discovery snippets separately and promotes them through capture and extraction polling", () => {
    const store = new InMemoryScraperStore();
    const discovery = fixtureDiscovery({
      id: "disc_apt29_1",
      query: "APT29",
      normalizedQuery: "apt29",
      resultId: "result_apt29_1",
      title: "APT29 live snippet",
      snippet: "Search provider observed APT29 phishing against Example Research.",
      url: "https://example.test/apt29-live",
      observedAt: "2026-05-24T13:00:00.000Z"
    });
    store.saveDiscoveryEvidence(discovery);
    store.saveLiveSearchSnapshot(fixtureSnapshot({
      id: "snap_first",
      query: "APT29",
      normalizedQuery: "apt29",
      runId: "run_live",
      status: "partial",
      capturedAt: "2026-05-24T13:00:01.000Z",
      discoveryEvidenceIds: [discovery.id],
      newEvidenceIds: [discovery.id]
    }));

    const firstPoll = store.queries().activeRunEvidence("run_live", { tenantId: "tenant_live" });
    expect(firstPoll.discoveryEvidence.map((item) => item.id)).toEqual([discovery.id]);
    expect(firstPoll.captures).toEqual([]);

    const rawText = "APT29 used phishing against Example Research with CVE-2026-1234.";
    const result = processCollectedItem({
      sourceId: "src_live",
      taskId: "task_live",
      url: discovery.url ?? "",
      collectedAt: "2026-05-24T13:01:00.000Z",
      title: "APT29 promoted report",
      rawText,
      contentHash: hashContent(rawText),
      links: [],
      metadata: { promotedFromDiscoveryId: discovery.id },
      sensitive: false
    });
    store.savePipelineResult({
      ...result,
      capture: { ...result.capture, tenantId: "tenant_live" }
    });
    store.promoteDiscoveryEvidence({
      discoveryEvidenceId: discovery.id,
      taskId: "task_live",
      captureId: result.capture.id,
      incidentId: result.incident?.id,
      promotedAt: "2026-05-24T13:01:01.000Z",
      promotedBy: "pipeline"
    });
    store.saveLiveSearchSnapshot(fixtureSnapshot({
      id: "snap_second",
      query: "APT29",
      normalizedQuery: "apt29",
      runId: "run_live",
      status: "ready",
      capturedAt: "2026-05-24T13:01:02.000Z",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [result.capture.id],
      incidentIds: result.incident ? [result.incident.id] : [],
      newEvidenceIds: [result.capture.id, result.incident?.id].filter((id): id is string => Boolean(id))
    }));

    const secondPoll = store.queries().newlyAvailableEvidenceSince("2026-05-24T13:00:30.000Z", { tenantId: "tenant_live" });
    expect(secondPoll.captures.map((capture) => capture.id)).toEqual([result.capture.id]);
    expect(secondPoll.incidents.map((incident) => incident.id)).toEqual(result.incident ? [result.incident.id] : []);
    expect(store.getDiscoveryEvidence(discovery.id)).toMatchObject({
      id: discovery.id,
      snippet: discovery.snippet,
      promotedToCaptureId: result.capture.id,
      promotedToIncidentId: result.incident?.id
    });
  });

  test("queries live snapshots by query, result provenance, deltas, and stale pruning", () => {
    const store = new InMemoryScraperStore();
    const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({
      id: "disc_stale",
      query: "Scattered Spider",
      normalizedQuery: "scattered spider",
      resultId: "result_stale",
      snippet: "Public channel mentioned Scattered Spider.",
      provider: "public_channel",
      evidenceType: "public_channel_snippet",
      observedAt: "2026-05-24T14:00:00.000Z"
    }));
    store.saveLiveSearchSnapshot(fixtureSnapshot({
      id: "snap_stale",
      query: "Scattered Spider",
      normalizedQuery: "scattered spider",
      status: "partial",
      capturedAt: "2026-05-24T14:00:01.000Z",
      discoveryEvidenceIds: [discovery.id],
      newEvidenceIds: [discovery.id],
      staleAt: "2026-05-24T15:00:00.000Z"
    }));

    expect(store.queries().liveSnapshotsByQuery(" scattered   spider ", { tenantId: "tenant_live" })).toHaveLength(1);
    expect(store.queries().provenanceChainByResultId("result_stale", { tenantId: "tenant_live" })[0]).toMatchObject({
      sourceId: "src_live",
      captureId: "disc_stale",
      extractorVersion: "discovery-evidence:v1"
    });
    expect(store.queries().newlyAvailableEvidenceSince("2026-05-24T13:59:00.000Z", { tenantId: "tenant_live" }).discoveryEvidence).toHaveLength(1);
    expect(store.queries().pruneStaleSnapshots("2026-05-24T15:00:01.000Z", { tenantId: "tenant_live" }).map((snapshot) => snapshot.id)).toEqual(["snap_stale"]);
  });

  test("discovery and live search snapshot retention policies are short-lived metadata policies", () => {
    expect(DEFAULT_RETENTION_POLICIES.discovery_snippet.ttlDays).toBeLessThan(DEFAULT_RETENTION_POLICIES.public_chat_text.ttlDays ?? 0);
    expect(DEFAULT_RETENTION_POLICIES.live_search_snapshot.action).toBe("delete_capture_metadata");
    expect(DEFAULT_RETENTION_POLICIES.evidence_delta.ttlDays).toBeLessThan(DEFAULT_RETENTION_POLICIES.public_report.ttlDays ?? 0);
  });

  test("stores cursor-based evidence deltas across discovery capture extraction relationship and export stages", () => {
    const store = new InMemoryScraperStore();
    const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({
      id: "disc_cursor",
      query: "APT29",
      normalizedQuery: "apt29",
      resultId: "result_cursor",
      observedAt: "2026-05-24T16:00:00.000Z",
      snippet: "Search provider observed APT29 targeting Example Energy."
    }));
    const firstCursor = store.queries().getSearchDeltas("APT29", undefined, { tenantId: "tenant_live" })[0]?.cursor;

    const rawText = "APT29 used phishing against Example Energy with CVE-2026-1234.";
    const result = processCollectedItem({
      sourceId: "src_live",
      taskId: "task_cursor",
      url: discovery.url ?? "",
      collectedAt: "2026-05-24T16:01:00.000Z",
      title: "APT29 promoted report",
      rawText,
      contentHash: hashContent(rawText),
      links: [],
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        runId: "run_cursor",
        promotedFromDiscoveryId: discovery.id
      },
      sensitive: false
    });
    store.savePipelineResult({ ...result, capture: { ...result.capture, tenantId: "tenant_live" } });
    store.promoteDiscoveryEvidence({
      discoveryEvidenceId: discovery.id,
      taskId: "task_cursor",
      captureId: result.capture.id,
      incidentId: result.incident?.id,
      promotedAt: "2026-05-24T16:01:30.000Z",
      promotedBy: "pipeline"
    });

    const graphEvidence = fixtureProgressiveEvidence({
      id: "graph_cursor",
      stage: "promoted",
      captureId: result.capture.id,
      observedAt: "2026-05-24T16:02:00.000Z",
      contentHash: result.capture.contentHash
    });
    const graph = buildProgressiveGraphUpdate([graphEvidence], {
      generatedAt: "2026-05-24T16:02:10.000Z"
    });
    const relationshipId = graph.graph.relationships[0]?.id ?? "rel_missing";
    store.saveEvidenceDelta(fixtureEvidenceDelta({
      id: "delta_relationship",
      query: "APT29",
      normalizedQuery: "apt29",
      runId: "run_cursor",
      kind: "added",
      subjectType: "relationship",
      subjectId: relationshipId,
      observedAt: "2026-05-24T16:02:10.000Z",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [result.capture.id],
      incidentIds: result.incident ? [result.incident.id] : [],
      relationshipIds: [relationshipId]
    }));
    const bundle = exportProgressiveGraphToStixBundle(graph, {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T16:02:20.000Z"
    });
    store.saveEvidenceDelta(fixtureEvidenceDelta({
      id: "delta_stix",
      query: "APT29",
      normalizedQuery: "apt29",
      runId: "run_cursor",
      kind: "promoted",
      subjectType: "policy_event",
      subjectId: "stix_eligible",
      observedAt: "2026-05-24T16:02:20.000Z",
      captureIds: [result.capture.id],
      incidentIds: result.incident ? [result.incident.id] : [],
      relationshipIds: [relationshipId],
      policyEventIds: ["stix_eligible"],
      metadata: { stixObjectCount: bundle.objects.length }
    }));

    expect(validateStixBundle(bundle).valid).toBe(true);
    expect(store.queries().getSearchDeltas("APT29", firstCursor, { tenantId: "tenant_live" }).map((delta) => delta.subjectType)).toEqual([
      "capture",
      "extraction",
      "discovery_evidence",
      "relationship",
      "policy_event"
    ]);
    const active = store.queries().getActiveRunEvidence("run_cursor", firstCursor, { tenantId: "tenant_live" });
    expect(active.captures.map((capture) => capture.id)).toEqual([result.capture.id]);
    expect(active.incidents.map((incident) => incident.id)).toEqual(result.incident ? [result.incident.id] : []);
    expect(active.deltas?.at(-1)?.policyEventIds).toEqual(["stix_eligible"]);
    expect(active.nextCursor).toBe(active.deltas?.at(-1)?.cursor);
  });

  test("records immutable redacted blocked expired downgraded and contradicted deltas for polling clients", () => {
    const store = new InMemoryScraperStore();
    const deltaKinds: EvidenceDelta["kind"][] = ["redacted", "blocked", "expired", "downgraded", "contradicted"];
    for (const [index, kind] of deltaKinds.entries()) {
      store.saveEvidenceDelta(fixtureEvidenceDelta({
        id: `delta_${kind}`,
        kind,
        subjectType: kind === "blocked" || kind === "expired" ? "policy_event" : "relationship",
        subjectId: `${kind}_subject`,
        observedAt: `2026-05-24T17:0${index}:00.000Z`,
        policyEventIds: kind === "blocked" || kind === "expired" ? [`policy_${kind}`] : []
      }));
    }

    expect(() => store.saveEvidenceDelta({
      ...fixtureEvidenceDelta({ id: "delta_blocked", kind: "blocked" }),
      metadata: { changed: true }
    })).toThrow("Evidence delta is immutable");
    expect(store.queries().getEvidenceTimeline("APT29", { tenantId: "tenant_live" }).map((delta) => delta.kind)).toEqual(deltaKinds);
  });
});

function fixtureCapture(overrides: Partial<RawCapture> = {}): RawCapture {
  const body = overrides.body ?? "LockBit ransomware report CVE-2026-1234.";
  return {
    id: "cap_fixture",
    sourceId: "src_fixture",
    url: "https://example.test/report",
    collectedAt: "2026-05-24T10:00:00.000Z",
    contentHash: hashContent(body),
    mediaType: "text/plain",
    storageKind: "inline_text",
    body,
    metadata: { fixture: true },
    sensitive: false,
    ...overrides
  };
}

function fixtureDiscovery(overrides: Partial<DiscoveryEvidence> = {}): DiscoveryEvidence {
  return {
    id: "disc_fixture",
    tenantId: "tenant_live",
    query: "APT29",
    normalizedQuery: "apt29",
    provider: "search_provider",
    evidenceType: "search_snippet",
    resultId: stableId("result", "APT29"),
    observedAt: "2026-05-24T13:00:00.000Z",
    title: "Discovery fixture",
    snippet: "APT29 discovery snippet.",
    url: "https://example.test/discovery",
    sourceId: "src_live",
    rank: 1,
    confidence: 0.55,
    metadata: { fixture: true },
    retentionClass: "discovery_snippet",
    ...overrides
  };
}

function fixtureSnapshot(overrides: Partial<LiveSearchSnapshot> = {}): LiveSearchSnapshot {
  return {
    id: "snap_fixture",
    tenantId: "tenant_live",
    query: "APT29",
    normalizedQuery: "apt29",
    status: "partial",
    capturedAt: "2026-05-24T13:00:01.000Z",
    discoveryEvidenceIds: [],
    captureIds: [],
    incidentIds: [],
    newEvidenceIds: [],
    metadata: { fixture: true },
    retentionClass: "live_search_snapshot",
    ...overrides
  };
}

function fixtureEvidenceDelta(overrides: Partial<EvidenceDelta> = {}): EvidenceDelta {
  const id = overrides.id ?? "delta_fixture";
  const observedAt = overrides.observedAt ?? "2026-05-24T16:00:00.000Z";
  return {
    id,
    tenantId: "tenant_live",
    query: "APT29",
    normalizedQuery: "apt29",
    runId: "run_live",
    cursor: overrides.cursor ?? `${observedAt}#${id}`,
    kind: "added",
    subjectType: "discovery_evidence",
    subjectId: "disc_fixture",
    observedAt,
    sourceId: "src_live",
    discoveryEvidenceIds: [],
    captureIds: [],
    incidentIds: [],
    relationshipIds: [],
    policyEventIds: [],
    retentionClass: "evidence_delta",
    metadata: { fixture: true },
    ...overrides
  };
}

function fixtureProgressiveEvidence(overrides: Partial<ProgressiveGraphEvidence> = {}): ProgressiveGraphEvidence {
  return {
    id: "graph_fixture",
    stage: "promoted",
    observedAt: "2026-05-24T16:02:00.000Z",
    sourceId: "src_live",
    captureId: "cap_graph",
    url: "https://example.test/apt29",
    contentHash: "hash_graph",
    extractorVersion: "progressive-test",
    relationships: [{
      source: { type: "actor", value: "APT29", confidence: 0.82 },
      target: { type: "victim", value: "Example Energy", confidence: 0.72 },
      type: "targets",
      confidence: 0.76
    }],
    ...overrides
  };
}
