import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildEvidenceClaimLedgerDto } from "../api/evidenceDtos.ts";
import {
  analystClaimLedgerEntryFromPostgresRow,
  analystClaimLedgerEntryToPostgresRow,
  analystLoopSnapshotFromPostgresRows,
  analystLoopSnapshotToPostgresRows,
  analystMetadataReviewTaskFromPostgresRow,
  analystMetadataReviewTaskToPostgresRow,
  analystSourceActivationPacketFromPostgresRow,
  analystSourceActivationPacketToPostgresRow,
  analystVictimNotificationPacketFromPostgresRow,
  analystVictimNotificationPacketToPostgresRow
} from "../storage/analystLoopPostgres.ts";
import {
  buildEvidenceCutoverRehearsalReport,
  buildEvidenceBackupIntegrityReport,
  buildEvidenceBackendParityReport,
  buildEvidenceReplayProof,
  buildEvidenceTrustLedgerReport,
  buildObjectEvidenceManifest,
  saveCaptureWithObject,
  verifyObjectEvidenceManifest,
  type CaptureMetadataStore,
  type EvidencePostgresTable,
  type ObjectEvidenceStore,
  type ObjectEvidenceWrite,
  type PostgresEvidenceRepository,
  type PostgresEvidenceTransaction
} from "../storage/evidenceStore.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";
import { FileObjectEvidenceStore } from "../storage/fileObjectStore.ts";
import { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../storage/memoryStore.ts";
import { DEFAULT_RETENTION_POLICIES, simulateInterruptedRetentionEnforcement } from "../storage/retention.ts";
import type {
  AnalystClaimLedgerEntry,
  AnalystLoopSnapshot,
  AnalystMetadataReviewTask,
  AnalystSourceActivationPacket,
  AnalystVictimNotificationPacket,
  DiscoveryEvidence,
  EvidenceDelta,
  LiveSearchSnapshot,
  ObjectStoreRef,
  PipelineResult,
  RawCapture
} from "../types.ts";
import { hashContent } from "../utils.ts";

describe("evidence storage cutover", () => {
  test("migration keeps production indexes aligned with in-memory query helpers", async () => {
    const sql = await Bun.file(new URL("../../migrations/003_evidence_store.sql", import.meta.url)).text();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS raw_captures");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS discovery_evidence");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS live_search_snapshots");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS evidence_deltas");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS extraction_results");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS capture_replay_jobs");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS retention_jobs");

    expect(sql).toContain("raw_captures_tenant_source_latest_idx");
    expect(sql).toContain("raw_captures_tenant_retention_idx");
    expect(sql).toContain("raw_captures_legal_hold_idx");
    expect(sql).toContain("discovery_evidence_query_observed_idx");
    expect(sql).toContain("discovery_evidence_result_idx");
    expect(sql).toContain("discovery_evidence_promotion_capture_idx");
    expect(sql).toContain("discovery_evidence_promotion_incident_idx");
    expect(sql).toContain("discovery_evidence_promotion_task_idx");
    expect(sql).toContain("live_search_snapshots_query_idx");
    expect(sql).toContain("live_search_snapshots_run_idx");
    expect(sql).toContain("evidence_deltas_query_cursor_idx");
    expect(sql).toContain("evidence_deltas_run_cursor_idx");
    expect(sql).toContain("evidence_deltas_subject_idx");
    expect(sql).toContain("extraction_results_capture_idx");
    expect(sql).toContain("extraction_results_incident_idx");
    expect(sql).toContain("extraction_results_version_idx");
    expect(sql).toContain("source_content_published");
    expect(sql).toContain("promoted_to_capture_id TEXT REFERENCES raw_captures(id) ON DELETE RESTRICT");
  });

  test("analyst loop migration persists review workflow without raw leak material", async () => {
    const sql = await Bun.file(new URL("../../migrations/004_analyst_loop.sql", import.meta.url)).text();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS collection_plans");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS collection_tasks");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS collection_runs");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS metadata_review_tasks");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS source_activation_packets");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS victim_notification_packets");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS claim_ledger_entries");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS analyst_loop_snapshots");

    expect(sql).toContain("'queued'");
    expect(sql).toContain("'metadata_review'");
    expect(sql).toContain("'blocked_unsafe_target'");
    expect(sql).toContain("'needs_source_activation'");
    expect(sql).toContain("'ready'");
    expect(sql).toContain("'notify_company'");
    expect(sql).toContain("'mark_duplicate'");
    expect(sql).toContain("'request_approval'");
    expect(sql).toContain("'escalate'");

    expect(sql).toContain("company TEXT");
    expect(sql).toContain("victim TEXT");
    expect(sql).toContain("affected_accounts_text TEXT");
    expect(sql).toContain("dataset_size_text TEXT");
    expect(sql).toContain("actor_statement_summary TEXT");
    expect(sql).toContain("source_hash TEXT NOT NULL");
    expect(sql).toContain("unsafe_material_accessed BOOLEAN NOT NULL DEFAULT FALSE CHECK (unsafe_material_accessed = FALSE)");
    expect(sql).toContain("what_was_not_accessed TEXT[] NOT NULL DEFAULT ARRAY");
    expect(sql).toContain("dry_run BOOLEAN NOT NULL DEFAULT TRUE CHECK (dry_run = TRUE)");

    expect(sql).toContain("collection_plans_query_created_idx");
    expect(sql).toContain("collection_tasks_plan_state_idx");
    expect(sql).toContain("collection_runs_plan_status_idx");
    expect(sql).toContain("metadata_review_tasks_status_idx");
    expect(sql).toContain("metadata_review_tasks_source_hash_idx");
    expect(sql).toContain("source_activation_packets_plan_idx");
    expect(sql).toContain("victim_notification_packets_review_idx");
    expect(sql).toContain("claim_ledger_entries_dedupe_idx");
    expect(sql).toContain("analyst_loop_snapshots_query_idx");

    expect(sql).not.toContain("body TEXT");
    expect(sql).not.toContain("payload BYTEA");
    expect(sql).not.toContain("leaked_rows");
    expect(sql).not.toContain("credential_value");
    expect(sql).not.toContain("download_url TEXT");
  });

  test("analyst loop Postgres rows round-trip safe metadata workflow without raw leak material", () => {
    const reviewTask: AnalystMetadataReviewTask = {
      id: "review_fjord",
      tenantId: "tenant_cutover",
      planId: "plan_fjord",
      runId: "run_fjord",
      taskId: "task_fjord",
      sourceId: "src_onion",
      captureId: "cap_fjord_metadata",
      status: "open",
      resultState: "metadata_review",
      company: "Fjord Energy AS",
      victim: "Fjord Energy AS",
      affectedAccounts: "50k accounts",
      affectedAccountsCount: 50_000,
      accountSubjects: ["employees", "contractors"],
      datasetSize: "20 GB",
      datasetSizeBytes: 20_000_000_000,
      actorStatement: "Actor claims Fjord Energy AS leaked, 50k accounts, 20 GB.",
      claimedAt: "2026-05-20T00:00:00.000Z",
      observedAt: "2026-05-24T10:00:00.000Z",
      sourceUrl: "redacted://hash/urlhash",
      sourceHash: "urlhash",
      provenance: {
        sourceId: "src_onion",
        captureId: "cap_fjord_metadata",
        contentHash: "contenthash",
        unsafeMaterialAccessed: false
      },
      allowedActions: ["notify_company", "mark_duplicate", "request_approval", "escalate"],
      confidence: 0.82,
      unsafeMaterialAccessed: false,
      whatWasNotAccessed: [
        "No restricted dataset was downloaded or opened.",
        "No credentials, cookies, private channels, or invite-only areas were accessed.",
        "No threat actor interaction was performed."
      ],
      createdAt: "2026-05-24T10:01:00.000Z",
      updatedAt: "2026-05-24T10:01:00.000Z"
    };
    const activationPacket: AnalystSourceActivationPacket = {
      id: "activation_fjord",
      tenantId: "tenant_cutover",
      planId: "plan_fjord",
      runId: "run_fjord",
      sourceId: "src_onion",
      action: "request_operator_approval",
      execution: "approval_required",
      reason: "Operator approval required before metadata-only source restoration.",
      expectedEffect: "Queue safe metadata only.",
      rollback: "Keep source disabled.",
      dryRun: true,
      createdAt: "2026-05-24T10:01:00.000Z"
    };
    const notificationPacket: AnalystVictimNotificationPacket = {
      id: "notification_fjord",
      tenantId: "tenant_cutover",
      reviewTaskId: reviewTask.id,
      status: "draft",
      company: "Fjord Energy AS",
      victim: "Fjord Energy AS",
      claimSummary: "Fjord Energy AS was named in a metadata-only leak claim; 50k accounts were claimed affected; 20 GB was claimed.",
      affectedAccounts: "50k accounts",
      datasetSize: "20 GB",
      actorStatement: reviewTask.actorStatement,
      claimedAt: reviewTask.claimedAt,
      observedAt: reviewTask.observedAt,
      sourceHash: reviewTask.sourceHash,
      confidence: 0.82,
      provenance: reviewTask.provenance,
      redactions: ["restricted_dataset_material", "credential_material", "private_access_material", "actor_interaction"],
      whatWasNotAccessed: reviewTask.whatWasNotAccessed,
      safeToSend: false,
      createdAt: "2026-05-24T10:02:00.000Z",
      updatedAt: "2026-05-24T10:02:00.000Z"
    };
    const claimLedgerEntry: AnalystClaimLedgerEntry = {
      id: "claim_fjord_dataset",
      tenantId: "tenant_cutover",
      normalizedQuery: "fjord energy as",
      reviewTaskId: reviewTask.id,
      captureId: reviewTask.captureId,
      sourceId: reviewTask.sourceId,
      claimKind: "dataset_size_claim",
      company: "Fjord Energy AS",
      victim: "Fjord Energy AS",
      claimTextSummary: "20 GB was claimed as dataset size or volume.",
      sourceHash: reviewTask.sourceHash,
      confidence: 0.82,
      ledgerStatus: "metadata_review",
      observedAt: reviewTask.observedAt,
      provenance: reviewTask.provenance,
      createdAt: "2026-05-24T10:03:00.000Z"
    };
    const loopSnapshot: AnalystLoopSnapshot = {
      id: "snapshot_fjord",
      tenantId: "tenant_cutover",
      planId: "plan_fjord",
      runId: "run_fjord",
      normalizedQuery: "fjord energy as",
      resultState: "metadata_review",
      headline: "1 metadata review task",
      queuedTasks: 0,
      reviewTasks: 1,
      rejectedSources: 0,
      blockedUnsafeTargets: 0,
      meaningfulWorkCount: 1,
      nextSteps: [{
        state: "metadata_review",
        label: "Review leak metadata",
        detail: "Review safe metadata before notification.",
        tone: "watch"
      }],
      reviewTaskIds: [reviewTask.id],
      activationPacketIds: [activationPacket.id],
      victimNotificationPacketId: notificationPacket.id,
      capturedAt: "2026-05-24T10:04:00.000Z"
    };

    const reviewRow = analystMetadataReviewTaskToPostgresRow(reviewTask);
    const activationRow = analystSourceActivationPacketToPostgresRow(activationPacket);
    const notificationRow = analystVictimNotificationPacketToPostgresRow(notificationPacket);
    const claimRow = analystClaimLedgerEntryToPostgresRow(claimLedgerEntry);
    const snapshotRows = analystLoopSnapshotToPostgresRows({
      metadataReviewTasks: [reviewTask],
      sourceActivationPackets: [activationPacket],
      victimNotificationPackets: [notificationPacket],
      claimLedgerEntries: [claimLedgerEntry],
      loopSnapshots: [loopSnapshot]
    });

    expect(reviewRow).toMatchObject({
      plan_id: "plan_fjord",
      result_state: "metadata_review",
      affected_accounts_text: "50k accounts",
      dataset_size_text: "20 GB",
      unsafe_material_accessed: false
    });
    expect(activationRow).toMatchObject({
      execution: "approval_required",
      dry_run: true
    });
    expect(notificationRow).toMatchObject({
      review_task_id: "review_fjord",
      safe_to_send: false
    });
    expect(claimRow).toMatchObject({
      claim_kind: "dataset_size_claim",
      ledger_status: "metadata_review"
    });
    expect(analystMetadataReviewTaskFromPostgresRow(reviewRow)).toEqual(reviewTask);
    expect(analystSourceActivationPacketFromPostgresRow(activationRow)).toEqual(activationPacket);
    expect(analystVictimNotificationPacketFromPostgresRow(notificationRow)).toEqual(notificationPacket);
    expect(analystClaimLedgerEntryFromPostgresRow(claimRow)).toEqual(claimLedgerEntry);
    expect(analystLoopSnapshotFromPostgresRows(snapshotRows)).toEqual({
      metadataReviewTasks: [reviewTask],
      sourceActivationPackets: [activationPacket],
      victimNotificationPackets: [notificationPacket],
      claimLedgerEntries: [claimLedgerEntry],
      loopSnapshots: [loopSnapshot]
    });
    expect(JSON.stringify(snapshotRows)).not.toContain("leakedRows");
    expect(JSON.stringify(snapshotRows)).not.toContain("credentialValues");
    expect(() => analystMetadataReviewTaskToPostgresRow({
      ...reviewTask,
      provenance: {
        ...reviewTask.provenance,
        rawPayload: "do not persist"
      }
    })).toThrow("Unsafe analyst provenance key");
    expect(() => analystSourceActivationPacketToPostgresRow({
      ...activationPacket,
      dryRun: false as true
    })).toThrow("dry-run");
  });

  test("fake Postgres repository exposes transaction boundary and delta subject helpers", () => {
    const repo = new FakePostgresEvidenceRepository();

    repo.beginTransaction((tx) => {
      expect(repo.tableNameFor("evidence_deltas")).toBe("evidence_deltas");
      tx.saveRelationshipDelta(fixtureDelta({
        id: "delta_rel_added",
        kind: "added",
        subjectType: "relationship",
        subjectId: "rel_apt29_targets",
        relationshipIds: ["rel_apt29_targets"]
      }));
      tx.savePolicyEventDelta(fixtureDelta({
        id: "delta_policy_blocked",
        cursor: "2026-05-24T20:00:01.000Z#delta_policy_blocked",
        kind: "blocked",
        subjectType: "policy_event",
        subjectId: "policy_blocked",
        policyEventIds: ["policy_blocked"]
      }));
      tx.recordRedaction(fixtureDelta({
        id: "delta_redacted",
        cursor: "2026-05-24T20:00:02.000Z#delta_redacted",
        kind: "redacted",
        subjectType: "capture",
        subjectId: "cap_redacted",
        captureIds: ["cap_redacted"]
      }));
      tx.recordExpiration(fixtureDelta({
        id: "delta_expired",
        cursor: "2026-05-24T20:00:03.000Z#delta_expired",
        kind: "expired",
        subjectType: "policy_event",
        subjectId: "retention_expired",
        policyEventIds: ["retention_expired"]
      }));
    });

    expect(repo.queries().getSearchDeltas("APT29", undefined, { tenantId: "tenant_cutover" }).map((delta) => delta.kind)).toEqual([
      "added",
      "blocked",
      "redacted",
      "expired"
    ]);
  });

  test("rejects duplicate cursor writes even when delta ids differ", () => {
    const store = new InMemoryScraperStore();
    store.saveEvidenceDelta(fixtureDelta({ id: "delta_cursor_a", cursor: "2026-05-24T20:00:00.000Z#cursor" }));

    expect(() => store.saveEvidenceDelta(fixtureDelta({
      id: "delta_cursor_b",
      cursor: "2026-05-24T20:00:00.000Z#cursor"
    }))).toThrow("Evidence delta cursor must be unique");
  });

  test("replays cursor deltas after repository restart", () => {
    const beforeRestart = new InMemoryScraperStore();
    const first = beforeRestart.saveEvidenceDelta(fixtureDelta({
      id: "delta_restart_first",
      cursor: "2026-05-24T20:00:00.000Z#delta_restart_first"
    }));
    beforeRestart.saveEvidenceDelta(fixtureDelta({
      id: "delta_restart_second",
      cursor: "2026-05-24T20:00:01.000Z#delta_restart_second",
      kind: "promoted",
      subjectType: "capture",
      subjectId: "cap_restart",
      captureIds: ["cap_restart"]
    }));

    const afterRestart = new InMemoryScraperStore();
    for (const delta of beforeRestart.listEvidenceDeltas()) afterRestart.saveEvidenceDelta(delta);

    expect(afterRestart.queries().getSearchDeltas("APT29", first.cursor, { tenantId: "tenant_cutover" }).map((delta) => delta.id)).toEqual([
      "delta_restart_second"
    ]);
  });

  test("file-backed store rehydrates evidence deltas and analyst claim workflow rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "ti-file-backed-evidence-"));
    try {
      const snapshotPath = join(dir, "scraper-store.json");
      const beforeRestart = new FileBackedScraperStore({ snapshotPath });
      const replayCapture = beforeRestart.saveCapture(fixtureCapture({
        id: "cap_file_replay",
        tenantId: "tenant_cutover",
        sourceId: "src_cutover",
        body: "APT29 replayable public report text.",
        contentHash: hashContent("APT29 replayable public report text."),
        metadata: {
          query: "APT29",
          normalizedQuery: "apt29",
          runId: "run_file_restart"
        }
      }));
      const replayJob = beforeRestart.createReplayJob({
        id: "replay_file_restart",
        tenantId: "tenant_cutover",
        captureId: replayCapture.id,
        sourceId: replayCapture.sourceId,
        fromExtractorVersion: "extractor.fixture.v1",
        toExtractorVersion: "extractor.fixture.v2",
        runId: "run_file_restart",
        requestedAt: "2026-05-24T20:00:03.000Z"
      });
      beforeRestart.recordReplayResult(replayJob.id, {
        capture: replayCapture,
        indicators: [],
        entities: []
      });
      beforeRestart.saveEvidenceDelta(fixtureDelta({
        id: "delta_file_restart",
        cursor: "2026-05-24T20:00:04.000Z#delta_file_restart"
      }));
      beforeRestart.saveAnalystMetadataReviewTask({
        id: "review_file_restart",
        tenantId: "tenant_cutover",
        planId: "plan_file_restart",
        sourceId: "src_restricted_hash",
        status: "open",
        resultState: "metadata_review",
        company: "Fjord Energy AS",
        affectedAccounts: "18,432 accounts",
        affectedAccountsCount: 18_432,
        accountSubjects: ["employees", "customers"],
        datasetSize: "42 GB",
        datasetSizeBytes: 42_000_000_000,
        actorStatement: "payment within 72 hours",
        claimedAt: "2026-05-20T00:00:00.000Z",
        observedAt: "2026-05-24T20:00:04.000Z",
        sourceHash: "hash_only_source",
        provenance: { source: "metadata-only fixture" },
        allowedActions: ["notify_company", "mark_duplicate", "request_approval", "escalate"],
        confidence: 0.86,
        unsafeMaterialAccessed: false,
        whatWasNotAccessed: ["No restricted dataset was downloaded or opened."],
        createdAt: "2026-05-24T20:00:04.000Z",
        updatedAt: "2026-05-24T20:00:04.000Z"
      });
      beforeRestart.saveAnalystClaimLedgerEntry({
        id: "claim_file_restart",
        tenantId: "tenant_cutover",
        normalizedQuery: "fjord energy as",
        reviewTaskId: "review_file_restart",
        sourceId: "src_restricted_hash",
        claimKind: "affected_accounts_claim",
        company: "Fjord Energy AS",
        claimTextSummary: "18,432 affected accounts",
        sourceHash: "hash_only_source",
        confidence: 0.86,
        ledgerStatus: "metadata_review",
        observedAt: "2026-05-24T20:00:04.000Z",
        provenance: { reviewTaskId: "review_file_restart" },
        createdAt: "2026-05-24T20:00:04.000Z"
      });
      beforeRestart.saveAnalystVictimNotificationPacket({
        id: "victim_packet_file_restart",
        tenantId: "tenant_cutover",
        reviewTaskId: "review_file_restart",
        status: "draft",
        company: "Fjord Energy AS",
        claimSummary: "Akira metadata claim against Fjord Energy AS",
        affectedAccounts: "18,432 accounts",
        datasetSize: "42 GB",
        actorStatement: "payment within 72 hours",
        claimedAt: "2026-05-20T00:00:00.000Z",
        observedAt: "2026-05-24T20:00:04.000Z",
        sourceHash: "hash_only_source",
        confidence: 0.86,
        provenance: { reviewTaskId: "review_file_restart" },
        redactions: ["no credentials", "no raw restricted rows"],
        whatWasNotAccessed: ["No restricted dataset was downloaded or opened."],
        safeToSend: false,
        createdAt: "2026-05-24T20:00:04.000Z",
        updatedAt: "2026-05-24T20:00:04.000Z"
      });
      beforeRestart.saveAnalystLoopSnapshot({
        id: "loop_file_restart",
        tenantId: "tenant_cutover",
        planId: "plan_file_restart",
        normalizedQuery: "fjord energy as",
        resultState: "metadata_review",
        headline: "Metadata review ready",
        queuedTasks: 0,
        reviewTasks: 1,
        rejectedSources: 0,
        blockedUnsafeTargets: 0,
        meaningfulWorkCount: 1,
        nextSteps: [{
          state: "metadata_review",
          label: "Review metadata claim",
          detail: "Review safe metadata fields before notification.",
          tone: "watch"
        }],
        reviewTaskIds: ["review_file_restart"],
        activationPacketIds: [],
        victimNotificationPacketId: "victim_packet_file_restart",
        capturedAt: "2026-05-24T20:00:04.000Z"
      });

      const afterRestart = new FileBackedScraperStore({ snapshotPath });
      expect(afterRestart.queries().getSearchDeltas("APT29", undefined, { tenantId: "tenant_cutover" }).map((delta) => delta.id)).toContain("delta_file_restart");
      expect(afterRestart.listReplayJobs()[0]).toMatchObject({
        id: "replay_file_restart",
        status: "succeeded",
        captureId: "cap_file_replay",
        metadata: {
          rawEvidenceMutated: false
        }
      });
      expect(afterRestart.getAnalystMetadataReviewTask("review_file_restart")).toMatchObject({
        company: "Fjord Energy AS",
        unsafeMaterialAccessed: false,
        sourceHash: "hash_only_source"
      });
      expect(afterRestart.listAnalystClaimLedgerEntries()[0]).toMatchObject({
        claimKind: "affected_accounts_claim",
        ledgerStatus: "metadata_review"
      });
      expect(afterRestart.listAnalystVictimNotificationPackets()[0]).toMatchObject({
        safeToSend: false,
        sourceHash: "hash_only_source"
      });
      expect(afterRestart.listAnalystLoopSnapshots()[0]).toMatchObject({
        resultState: "metadata_review",
        reviewTaskIds: ["review_file_restart"]
      });
      expect(JSON.stringify(afterRestart.listAnalystVictimNotificationPackets())).not.toContain("password");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects partial discovery promotion when durable capture lineage is missing", () => {
    const store = new InMemoryScraperStore();
    const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({ id: "disc_partial_promotion" }));

    expect(() => store.promoteDiscoveryEvidence({
      discoveryEvidenceId: discovery.id,
      captureId: "cap_missing",
      promotedAt: "2026-05-24T20:01:00.000Z",
      promotedBy: "pipeline"
    })).toThrow("Unknown capture for discovery promotion");
    expect(store.getDiscoveryEvidence(discovery.id)?.promotedToCaptureId).toBeUndefined();
  });

  test("does not persist capture metadata when object-store write fails", () => {
    const store = new InMemoryScraperStore();
    const objects = new FailingObjectStore();
    const capture = fixtureCapture({
      id: "cap_object_failure",
      storageKind: "external_object",
      body: undefined,
      retentionClass: "public_report"
    });

    expect(() => saveCaptureWithObject(store, objects, capture, "<html>public report</html>")).toThrow("object store unavailable");
    expect(store.getCapture(capture.id)).toBeUndefined();
  });

  test("builds no-key object evidence manifests for backup export and restore verification", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    const body = "<html>APT29 public evidence for durable object manifest.</html>";
    const capture = saveCaptureWithObject(store, objects, fixtureCapture({
      id: "cap_manifest",
      tenantId: "tenant_cutover",
      sourceId: "src_cutover",
      storageKind: "external_object",
      body: undefined,
      contentHash: hashContent(body),
      retentionClass: "public_report"
    }), body);

    const manifest = buildObjectEvidenceManifest(store, objects, {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:03:00.000Z"
    });
    expect(manifest).toMatchObject({
      schemaVersion: "ti.object_evidence_manifest.v1",
      entryCount: 1,
      presentCount: 1,
      missingCount: 0,
      hashMismatchCount: 0,
      safeOutput: {
        objectKeysExposed: false,
        rawBodiesExposed: false,
        unsafeRestrictedMetadataExposed: false
      }
    });
    expect(manifest.entries[0]).toMatchObject({
      captureId: "cap_manifest",
      sourceId: "src_cutover",
      retentionClass: "public_report",
      present: true,
      hashMatches: true
    });
    expect(JSON.stringify(manifest)).not.toContain(capture.objectRef?.key);
    expect(JSON.stringify(manifest)).not.toContain(body);

    const healthyVerification = verifyObjectEvidenceManifest(manifest, store, objects, {
      generatedAt: "2026-05-24T20:04:00.000Z"
    });
    expect(healthyVerification).toMatchObject({
      expectedCount: 1,
      verifiedCount: 1,
      missingObjectCaptureIds: [],
      hashMismatchCaptureIds: [],
      safeToRestore: true
    });

    if (!capture.objectRef) throw new Error("Expected external object ref");
    objects.deleteObject(capture.objectRef, "restore drill missing object");
    const missingVerification = verifyObjectEvidenceManifest(manifest, store, objects, {
      generatedAt: "2026-05-24T20:05:00.000Z"
    });
    expect(missingVerification).toMatchObject({
      expectedCount: 1,
      verifiedCount: 0,
      missingObjectCaptureIds: ["cap_manifest"],
      safeToRestore: false
    });
    expect(JSON.stringify(missingVerification)).not.toContain(capture.objectRef.key);
  });

  test("proves memory file-backed and postgres-style read-model parity for API cutover", () => {
    const dir = mkdtempSync(join(tmpdir(), "ti-backend-parity-"));
    try {
      const memoryStore = new InMemoryScraperStore();
      const memoryObjects = new InMemoryObjectEvidenceStore();
      seedBackendParityFixture(memoryStore, memoryObjects);

      const fileSnapshotPath = join(dir, "scraper-store.json");
      const fileObjectRoot = join(dir, "objects");
      const fileStoreBeforeRestart = new FileBackedScraperStore({ snapshotPath: fileSnapshotPath });
      const fileObjects = new FileObjectEvidenceStore({ rootDir: fileObjectRoot });
      seedBackendParityFixture(fileStoreBeforeRestart, fileObjects);
      const fileStoreAfterRestart = new FileBackedScraperStore({ snapshotPath: fileSnapshotPath });

      const postgresStore = new FakePostgresEvidenceRepository();
      const postgresObjects = new InMemoryObjectEvidenceStore();
      postgresStore.beginTransaction((tx) => seedBackendParityFixture(tx, postgresObjects));

      const report = buildEvidenceBackendParityReport([
        { name: "memory", store: memoryStore, objects: memoryObjects },
        { name: "file_backed_after_restart", store: fileStoreAfterRestart, objects: fileObjects },
        { name: "postgres_style_transaction", store: postgresStore, objects: postgresObjects }
      ], "APT29", {
        tenantId: "tenant_cutover",
        generatedAt: "2026-05-24T20:06:00.000Z"
      });

      expect(report).toMatchObject({
        schemaVersion: "ti.evidence_backend_parity_report.v1",
        baselineBackend: "memory",
        apiCutoverReady: true,
        parity: {
          capturesMatch: true,
          discoveryEvidenceMatch: true,
          deltasMatch: true,
          liveSnapshotsMatch: true,
          cursorReplayMatch: true,
          objectManifestsSafe: true,
          noUnsafeRestrictedBodies: true,
          matchesBaseline: true
        },
        mismatches: []
      });
      expect(report.backends.map((backend) => backend.name)).toEqual([
        "memory",
        "file_backed_after_restart",
        "postgres_style_transaction"
      ]);
      expect(report.backends.every((backend) => backend.objectManifestEntryCount === 1)).toBe(true);
      expect(report.backends.every((backend) => backend.replayable)).toBe(true);
      expect(JSON.stringify(report)).not.toContain("object/key");
      expect(JSON.stringify(report)).not.toContain("APT29 parity public report body");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("suppresses duplicate capture content hashes before production cutover", () => {
    const store = new InMemoryScraperStore();
    const first = fixtureCapture({
      id: "cap_hash_first",
      url: "https://example.test/report-a",
      body: undefined,
      storageKind: "external_object",
      contentHash: "same_hash",
      publishedAt: "2026-05-24T20:00:00.000Z"
    });
    const duplicate = fixtureCapture({
      id: "cap_hash_second",
      url: "https://example.test/report-b",
      body: undefined,
      storageKind: "external_object",
      contentHash: "same_hash",
      publishedAt: "2026-05-24T20:00:00.000Z"
    });

    expect(store.saveCaptureWithDedupe(first).status).toBe("inserted");
    const suppressed = store.saveCaptureWithDedupe(duplicate);

    expect(suppressed.status).toBe("duplicate");
    expect(suppressed.duplicateOf).toBe("cap_hash_first");
  });

  test("keeps restricted metadata redacted and cursor-visible", () => {
    const store = new InMemoryScraperStore();
    const stored = store.saveCapture(fixtureCapture({
      id: "cap_restricted_redacted",
      body: "credential material must not persist",
      sensitive: true,
      sensitivityFlags: ["credential_material"],
      metadata: { query: "APT29", normalizedQuery: "apt29", runId: "run_cutover" },
      storageKind: "inline_text"
    }));

    expect(stored.storageKind).toBe("metadata_only");
    expect(stored.body).toBeUndefined();
    expect(stored.redaction?.policy).toBe("metadata_only");
    expect(store.queries().getSearchDeltas("APT29", undefined, { tenantId: "tenant_cutover" }).map((delta) => delta.kind)).toContain("redacted");
  });

  test("builds backup integrity reports for Agent 10 restore drills", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    const objectRecord = objects.putObject({
      tenantId: "tenant_cutover",
      sourceId: "src_cutover",
      captureId: "cap_object_present",
      mediaType: "text/html",
      body: "<html>APT29 public report</html>",
      contentHash: "hash_present",
      retentionClass: "public_report"
    });
    store.saveCapture(fixtureCapture({
      id: "cap_object_present",
      body: undefined,
      storageKind: "external_object",
      objectRef: objectRecord.ref,
      contentHash: "hash_present",
      retentionClass: "public_report"
    }));
    store.saveCapture(fixtureCapture({
      id: "cap_object_missing",
      url: "https://example.test/cutover-missing-object",
      body: undefined,
      storageKind: "external_object",
      objectRef: {
        bucket: "memory-evidence",
        key: "missing",
        sizeBytes: 1,
        sha256: "hash_missing"
      },
      contentHash: "hash_missing",
      retentionClass: "public_report"
    }));
    store.saveDiscoveryEvidence(fixtureDiscovery({
      id: "disc_orphan",
      promotedToCaptureId: "cap_missing_lineage"
    }));

    const report = buildEvidenceBackupIntegrityReport(store, objects, {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:10:00.000Z",
      rollbackNotes: ["restore previous metadata snapshot if object verification fails"]
    });

    expect(report.expectedObjectCount).toBe(2);
    expect(report.verifiedObjectCount).toBe(1);
    expect(report.missingObjectIds).toEqual(["cap_object_missing"]);
    expect(report.orphanRows).toEqual([{
      table: "discovery_evidence",
      id: "disc_orphan",
      reason: "missing promoted capture cap_missing_lineage"
    }]);
    expect(report.retentionExpiryCounts.public_report).toBe(2);
    expect(report.rollbackNotes).toHaveLength(1);
  });

  test("builds evidence cutover rehearsal reports from discovery through API cursor replay", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({
      id: "disc_rehearsal",
      resultId: "result_rehearsal"
    }));
    const capture = store.saveCapture(fixtureCapture({
      id: "cap_rehearsal",
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        runId: "run_rehearsal",
        promotedFromDiscoveryId: discovery.id
      }
    }));
    store.promoteDiscoveryEvidence({
      discoveryEvidenceId: discovery.id,
      captureId: capture.id,
      promotedAt: "2026-05-24T20:01:00.000Z",
      promotedBy: "pipeline"
    });
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_rehearsal_extraction",
      cursor: "2026-05-24T20:01:01.000Z#delta_rehearsal_extraction",
      kind: "updated",
      subjectType: "extraction",
      subjectId: "incident_rehearsal",
      captureIds: [capture.id],
      incidentIds: ["incident_rehearsal"]
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_rehearsal_relationship",
      cursor: "2026-05-24T20:01:02.000Z#delta_rehearsal_relationship",
      kind: "added",
      subjectType: "relationship",
      subjectId: "rel_rehearsal",
      captureIds: [capture.id],
      incidentIds: ["incident_rehearsal"],
      relationshipIds: ["rel_rehearsal"]
    }));
    store.saveLiveSearchSnapshot(fixtureSnapshot({
      id: "snap_rehearsal",
      runId: "run_rehearsal",
      capturedAt: "2026-05-24T20:01:03.000Z",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [capture.id],
      incidentIds: ["incident_rehearsal"],
      newEvidenceIds: [capture.id, "incident_rehearsal", "rel_rehearsal"]
    }));

    const proof = buildEvidenceReplayProof(store, "APT29", { tenantId: "tenant_cutover", runId: "run_rehearsal" });
    const report = buildEvidenceCutoverRehearsalReport(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      runId: "run_rehearsal",
      generatedAt: "2026-05-24T20:02:00.000Z"
    });

    expect(proof.replayable).toBe(true);
    expect(proof.steps.map((step) => step.stage)).toEqual(["discovery", "capture", "extraction", "relationship_delta", "api_cursor"]);
    expect(report.readiness.overall).toBe("ready");
    expect(report.promotionGate.agent09Fields.cursorReplayReady).toBe(true);
    expect(report.promotionGate.agent09Fields.nextCursor).toBeDefined();
    expect(report.promotionGate.agent10Fields.objectIntegrityReady).toBe(true);
    expect(report.reconciliation.relationshipDeltaIds).toEqual(["delta_rehearsal_relationship"]);
  });

  test("holds rehearsal on stale snapshots and graph export blockers", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({ id: "disc_blocked" }));
    const capture = store.saveCapture(fixtureCapture({
      id: "cap_blocked",
      metadata: { query: "APT29", normalizedQuery: "apt29", promotedFromDiscoveryId: discovery.id }
    }));
    store.promoteDiscoveryEvidence({
      discoveryEvidenceId: discovery.id,
      captureId: capture.id,
      promotedAt: "2026-05-24T20:01:00.000Z",
      promotedBy: "pipeline"
    });
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_blocked_extraction",
      cursor: "2026-05-24T20:01:01.000Z#delta_blocked_extraction",
      subjectType: "extraction",
      subjectId: "incident_blocked",
      captureIds: [capture.id]
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_blocked_relationship",
      cursor: "2026-05-24T20:01:02.000Z#delta_blocked_relationship",
      kind: "contradicted",
      subjectType: "relationship",
      subjectId: "rel_blocked",
      relationshipIds: ["rel_blocked"],
      captureIds: [capture.id]
    }));
    store.saveLiveSearchSnapshot(fixtureSnapshot({
      id: "snap_stale_rehearsal",
      capturedAt: "2026-05-24T20:01:03.000Z",
      staleAt: "2026-05-24T20:01:30.000Z",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [capture.id]
    }));

    const report = buildEvidenceCutoverRehearsalReport(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:02:00.000Z"
    });

    expect(report.readiness.agent09).toBe("hold");
    expect(report.readiness.overall).toBe("hold");
    expect(report.counts.staleSnapshots).toBe(1);
    expect(report.exportBlockers).toContainEqual({ id: "delta_blocked_relationship", reason: "delta_contradicted" });
    expect(report.promotionGate.blockers).toContain("export_blockers");
  });

  test("blocks rehearsal on missing object hold and reports restricted metadata redaction", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    store.saveCapture(fixtureCapture({
      id: "cap_missing_rehearsal_object",
      body: undefined,
      storageKind: "external_object",
      objectRef: {
        bucket: "memory-evidence",
        key: "missing-rehearsal",
        sizeBytes: 42,
        sha256: "missing_rehearsal_hash"
      },
      contentHash: "missing_rehearsal_hash",
      retentionClass: "public_report"
    }));
    const restricted = store.saveCapture(fixtureCapture({
      id: "cap_rehearsal_restricted",
      url: "https://example.test/restricted",
      body: "restricted payload",
      sensitive: true,
      sensitivityFlags: ["restricted_protocol"],
      metadata: { query: "APT29", normalizedQuery: "apt29", runId: "run_rehearsal" },
      storageKind: "inline_text"
    }));

    const report = buildEvidenceCutoverRehearsalReport(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:02:00.000Z",
      rollbackNotes: ["hold cutover until missing object is restored"]
    });

    expect(restricted.body).toBeUndefined();
    expect(report.readiness.overall).toBe("blocked");
    expect(report.counts.missingObjects).toBe(1);
    expect(report.redactionState.metadataOnlyCaptureIds).toContain("cap_rehearsal_restricted");
    expect(report.redactionState.unsafeBodyCaptureIds).toEqual([]);
    expect(report.promotionGate.agent10Fields.missingObjectCount).toBe(1);
    expect(report.promotionGate.agent10Fields.rollbackNotes).toEqual(["hold cutover until missing object is restored"]);
  });

  test("marks interrupted retention jobs failed and preserves unapplied evidence", () => {
    const first = fixtureCapture({
      id: "cap_retention_first",
      collectedAt: "2026-01-01T00:00:00.000Z",
      retentionClass: "public_chat_text",
      body: "first expired public message"
    });
    const second = fixtureCapture({
      id: "cap_retention_second",
      collectedAt: "2026-01-02T00:00:00.000Z",
      retentionClass: "public_chat_text",
      body: "second expired public message"
    });

    const interrupted = simulateInterruptedRetentionEnforcement(
      [first, second],
      DEFAULT_RETENTION_POLICIES.public_chat_text,
      1,
      "2026-12-31T00:00:00.000Z"
    );

    expect(interrupted.job.status).toBe("failed");
    expect(interrupted.job.error).toContain("retention interrupted");
    expect(interrupted.deletionAudit.map((event) => event.captureId)).toEqual(["cap_retention_first"]);
    expect(interrupted.mutated.find((capture) => capture.id === first.id)?.body).toBeUndefined();
    expect(interrupted.mutated.find((capture) => capture.id === second.id)?.body).toBe(second.body);
  });

  test("builds claim-level evidence trust ledger for soak and public answer gates", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    const trusted = seedTrustLedgerClaim(store, objects, {
      id: "trusted",
      text: "APT29 used CVE-2026-1234 against victim: Example Health during a phishing campaign.",
      objectBacked: true
    });
    const lowConfidence = seedTrustLedgerClaim(store, objects, {
      id: "low",
      text: "APT29 mentioned possible activity.",
      objectBacked: false
    });
    const missingObject = seedTrustLedgerClaim(store, objects, {
      id: "missing_object",
      text: "APT29 used CVE-2026-5678 against victim: Example Energy during an intrusion.",
      objectBacked: true,
      deleteObject: true
    });
    const duplicate = store.listIncidents().find((incident) => incident.id === trusted.incidentId);
    if (!duplicate) throw new Error("missing trusted fixture incident");
    store.saveIncident({ ...duplicate, id: "inc_trust_duplicate" });
    const sinceCursor = store.queries().getEvidenceTimeline("APT29", { tenantId: "tenant_cutover" })[0]?.cursor;

    const ledger = buildEvidenceTrustLedgerReport(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      runId: "run_cutover",
      sinceCursor,
      generatedAt: "2026-05-24T20:30:00.000Z"
    });

    expect(ledger.trustGate).toBe("blocked");
    expect(ledger.counts).toMatchObject({
      claims: 3,
      trusted: 1,
      degraded: 1,
      blocked: 1,
      duplicateClaimsSuppressed: 1,
      replayable: true
    });
    expect(ledger.claims.find((claim) => claim.captureId === trusted.captureId)).toMatchObject({
      trustStatus: "trusted",
      ledgerIds: ["ledger_trust_trusted", "ledger_trust_alias"],
      evidenceStage: "captured",
      graphRelationshipIds: ["rel_trust_trusted"],
      retentionClass: "public_report",
      redaction: {
        applied: false,
        metadataOnly: false,
        legalHold: false
      },
      provenance: {
        sourcePresent: true,
        capturePresent: true,
        contentHashPresent: true,
        extractorVersionPresent: true,
        confidencePresent: true
      },
      replay: { replayable: true }
    });
    expect(ledger.claims.find((claim) => claim.captureId === lowConfidence.captureId)?.blockers).toContain("low_confidence");
    expect(ledger.claims.find((claim) => claim.captureId === lowConfidence.captureId)).toMatchObject({
      reviewState: "needs-human-review",
      redaction: { legalHold: true },
      blockers: expect.arrayContaining(["source_retired_or_deleted"])
    });
    expect(ledger.claims.find((claim) => claim.captureId === missingObject.captureId)).toMatchObject({
      trustStatus: "blocked",
      blockers: expect.arrayContaining(["missing_object"])
    });
    expect(ledger.changesSinceCursor).toMatchObject({
      sinceCursor,
      added: expect.any(Number),
      promoted: expect.any(Number),
      downgraded: 1,
      expired: 1,
      contradicted: 1,
      reviewRequired: 1,
      missingObjectCaptureIds: [missingObject.captureId]
    });
    expect(Object.keys(ledger.changesSinceCursor)).toContain("promoted");
    expect(ledger.cutover.promotionGate.blockers).toContain("missing_objects");
    expect(ledger.safeOutput).toEqual({
      sensitiveBodiesExposed: false,
      objectKeysExposed: false,
      unsafeRestrictedMetadataExposed: false
    });
    const claimLedger = buildEvidenceClaimLedgerDto(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      runId: "run_cutover",
      sinceCursor,
      generatedAt: "2026-05-24T20:30:00.000Z"
    });
    expect(claimLedger.certification).toMatchObject({
      status: "hold",
      releaseAction: "hold",
      canCutover: false,
      objectStore: {
        expectedObjectCount: 2,
        verifiedObjectCount: 1,
        missingObjectIds: [missingObject.captureId],
        hashMismatchCount: 0,
        writeFailureFixture: "covered"
      },
      postgresRepository: {
        immutableCaptureRows: true,
        transactionBoundary: "capture_object_extraction_delta",
        duplicateClaimSuppression: "covered",
        deletionAudit: "metadata_only_with_reason"
      },
      cursorReplay: {
        replayable: true,
        cursorGap: false,
        restartReplayFixture: "covered"
      },
      retention: {
        legalHoldCount: 1,
        retentionExpiryFixture: "covered"
      },
      claimPromotion: {
        duplicateClaimsSuppressed: 1,
        lowConfidenceClaims: [lowConfidence.incidentId],
        retiredSourceClaims: [lowConfidence.incidentId],
        staleExtractorReplayClaims: [],
        graphExportHeldRelationshipIds: expect.arrayContaining(["rel_trust_low", "rel_trust_missing_object"])
      },
      fixtures: {
        cleanCutover: "covered",
        missingObject: "covered",
        hashMismatch: "covered",
        staleExtractorReplay: "covered",
        restrictedMetadataRedaction: "covered",
        retiredSource: "covered",
        graphHold: "covered",
        lowConfidence: "covered",
        duplicateClaim: "covered",
        cursorGap: "covered",
        retentionExpiry: "covered",
        legalHold: "covered",
        objectStoreWriteFailure: "covered"
      },
      downstream: {
        agent07AnswerReadiness: "blocked",
        agent08ExportGate: "blocked",
        agent10ReleaseTrain: "hold"
      }
    });
    expect(JSON.stringify(ledger)).not.toContain("object/key");
    expect(JSON.stringify(claimLedger)).not.toContain("object/key");
  });
});

class FakePostgresEvidenceRepository extends InMemoryScraperStore implements PostgresEvidenceRepository, PostgresEvidenceTransaction {
  beginTransaction<T>(operation: (transaction: PostgresEvidenceTransaction) => T): T {
    return operation(this);
  }

  tableNameFor(kind: EvidencePostgresTable): string {
    return kind;
  }

  saveExtractionResult(result: PipelineResult): PipelineResult {
    return this.savePipelineResult(result);
  }

  saveRelationshipDelta(delta: EvidenceDelta): EvidenceDelta {
    return this.saveEvidenceDelta({ ...delta, subjectType: "relationship" });
  }

  savePolicyEventDelta(delta: EvidenceDelta): EvidenceDelta {
    return this.saveEvidenceDelta({ ...delta, subjectType: "policy_event" });
  }

  recordRedaction(delta: EvidenceDelta): EvidenceDelta {
    return this.saveEvidenceDelta({ ...delta, kind: "redacted" });
  }

  recordExpiration(delta: EvidenceDelta): EvidenceDelta {
    return this.saveEvidenceDelta({ ...delta, kind: "expired" });
  }
}

class FailingObjectStore implements ObjectEvidenceStore {
  putObject(_input: ObjectEvidenceWrite): never {
    throw new Error("object store unavailable");
  }

  getObject(_ref: ObjectStoreRef): undefined {
    return undefined;
  }

  deleteObject(_ref: ObjectStoreRef, _reason: string): boolean {
    return false;
  }
}

function seedBackendParityFixture(store: CaptureMetadataStore, objects: ObjectEvidenceStore): void {
  const body = "APT29 parity public report body with CVE-2026-7777 and WellMess.";
  const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({
    id: "disc_backend_parity",
    resultId: "result_backend_parity",
    snippet: "APT29 parity discovery evidence."
  }));
  const capture = saveCaptureWithObject(store, objects, fixtureCapture({
    id: "cap_backend_parity",
    body: undefined,
    storageKind: "external_object",
    contentHash: hashContent(body),
    retentionClass: "public_report",
    metadata: {
      query: "APT29",
      normalizedQuery: "apt29",
      runId: "run_backend_parity",
      promotedFromDiscoveryId: discovery.id
    }
  }), body);
  store.promoteDiscoveryEvidence({
    discoveryEvidenceId: discovery.id,
    captureId: capture.id,
    promotedAt: "2026-05-24T20:06:01.000Z",
    promotedBy: "pipeline"
  });
  store.saveEvidenceDelta(fixtureDelta({
    id: "delta_backend_parity_extraction",
    cursor: "2026-05-24T20:06:02.000Z#delta_backend_parity_extraction",
    kind: "updated",
    subjectType: "extraction",
    subjectId: "incident_backend_parity",
    discoveryEvidenceIds: [discovery.id],
    captureIds: [capture.id],
    incidentIds: ["incident_backend_parity"]
  }));
  store.saveEvidenceDelta(fixtureDelta({
    id: "delta_backend_parity_relationship",
    cursor: "2026-05-24T20:06:03.000Z#delta_backend_parity_relationship",
    kind: "added",
    subjectType: "relationship",
    subjectId: "rel_backend_parity",
    discoveryEvidenceIds: [discovery.id],
    captureIds: [capture.id],
    incidentIds: ["incident_backend_parity"],
    relationshipIds: ["rel_backend_parity"]
  }));
  store.saveLiveSearchSnapshot(fixtureSnapshot({
    id: "snap_backend_parity",
    runId: "run_backend_parity",
    capturedAt: "2026-05-24T20:06:04.000Z",
    discoveryEvidenceIds: [discovery.id],
    captureIds: [capture.id],
    incidentIds: ["incident_backend_parity"],
    newEvidenceIds: [discovery.id, capture.id, "incident_backend_parity", "rel_backend_parity"]
  }));
}

function seedTrustLedgerClaim(
  store: InMemoryScraperStore,
  objects: InMemoryObjectEvidenceStore,
  input: { id: string; text: string; objectBacked: boolean; deleteObject?: boolean }
): { captureId: string; incidentId: string } {
  const url = `https://example.test/trust/${input.id}`;
  const result = processCollectedItem({
    sourceId: "src_cutover",
    taskId: `task_${input.id}`,
    url,
    collectedAt: `2026-05-24T20:${input.id === "trusted" ? "10" : input.id === "low" ? "11" : "12"}:00.000Z`,
    title: `APT29 trust ${input.id}`,
    rawText: input.text,
    contentHash: hashContent(input.text),
    links: [],
    metadata: {
      query: "APT29",
      normalizedQuery: "apt29",
      runId: "run_cutover"
    },
    sensitive: false
  });
  if (!result.incident) throw new Error(`Expected trust ledger incident for ${input.id}`);

  const capture = input.objectBacked
    ? saveCaptureWithObject(store, objects, {
      ...result.capture,
      id: `cap_trust_${input.id}`,
      tenantId: "tenant_cutover",
      metadata: {
        ...result.capture.metadata,
        query: "APT29",
        normalizedQuery: "apt29",
        runId: "run_cutover",
        evidenceStage: "captured",
        ...(input.id === "low" ? { sourceStatus: "retired", reviewState: "needs-human-review" } : {}),
        ...(input.id === "trusted" ? { evidenceLedgerIds: ["ledger_trust_trusted"], trustLedgerId: "ledger_trust_alias" } : {})
      },
      storageKind: "external_object",
      body: undefined,
      retentionClass: "public_report"
    }, input.text)
    : store.saveCapture({
      ...result.capture,
      id: `cap_trust_${input.id}`,
      tenantId: "tenant_cutover",
      legalHold: input.id === "low",
      retentionClass: input.id === "low" ? "legal_hold" : result.capture.retentionClass,
      metadata: {
        ...result.capture.metadata,
        query: "APT29",
        normalizedQuery: "apt29",
        runId: "run_cutover",
        evidenceStage: "captured",
        ...(input.id === "low" ? { sourceStatus: "retired", reviewState: "needs-human-review" } : {}),
        ...(input.id === "trusted" ? { evidenceLedgerIds: ["ledger_trust_trusted"], trustLedgerId: "ledger_trust_alias" } : {})
      }
    });
  if (input.deleteObject && capture.objectRef) objects.deleteObject(capture.objectRef, "trust ledger missing object fixture");
  const incident = store.saveIncident({ ...result.incident, id: `inc_trust_${input.id}`, captureId: capture.id });
  if (input.id === "low") {
    const replay = store.createReplayJob({
      tenantId: "tenant_cutover",
      captureId: capture.id,
      sourceId: capture.sourceId,
      fromExtractorVersion: incident.extractorVersion,
      toExtractorVersion: "extractor.future.v2",
      runId: "run_cutover"
    });
    store.recordReplayResult(replay.id, {
      ...result,
      capture,
      incident: { ...incident, extractorVersion: "extractor.future.v2" }
    });
    const staleReplay = store.createReplayJob({
      tenantId: "tenant_cutover",
      captureId: capture.id,
      sourceId: capture.sourceId,
      fromExtractorVersion: "extractor.future.v2",
      toExtractorVersion: "extractor.future.v3",
      runId: "run_cutover"
    });
    store.recordReplayResult(staleReplay.id, {
      ...result,
      capture,
      incident: undefined
    });
  }
  const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({
    id: `disc_trust_${input.id}`,
    resultId: `result_trust_${input.id}`,
    observedAt: capture.collectedAt,
    url,
    confidence: incident.confidence
  }));
  store.promoteDiscoveryEvidence({
    discoveryEvidenceId: discovery.id,
    taskId: `task_${input.id}`,
    captureId: capture.id,
    incidentId: incident.id,
    promotedAt: capture.collectedAt,
    promotedBy: "pipeline"
  });
  store.saveEvidenceDelta(fixtureDelta({
    id: `delta_trust_extraction_${input.id}`,
    cursor: "",
    kind: "added",
    subjectType: "extraction",
    subjectId: incident.id,
    observedAt: capture.collectedAt,
    discoveryEvidenceIds: [discovery.id],
    captureIds: [capture.id],
    incidentIds: [incident.id],
    metadata: { extractorVersion: incident.extractorVersion, contentHash: capture.contentHash }
  }));
  store.saveEvidenceDelta(fixtureDelta({
    id: `delta_trust_relationship_${input.id}`,
    cursor: "",
    kind: "promoted",
    subjectType: "relationship",
    subjectId: `rel_trust_${input.id}`,
    observedAt: capture.collectedAt,
    discoveryEvidenceIds: [discovery.id],
    captureIds: [capture.id],
    incidentIds: [incident.id],
    relationshipIds: [`rel_trust_${input.id}`]
  }));
  if (input.id === "low") {
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_trust_downgraded_low",
      cursor: "",
      kind: "downgraded",
      subjectType: "relationship",
      subjectId: "rel_trust_low",
      observedAt: "2026-05-24T20:11:30.000Z",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [capture.id],
      incidentIds: [incident.id],
      relationshipIds: ["rel_trust_low"],
      metadata: { reviewRequired: true, reviewState: "needs-human-review" }
    }));
  }
  if (input.id === "missing_object") {
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_trust_expired_missing_object",
      cursor: "",
      kind: "expired",
      subjectType: "capture",
      subjectId: capture.id,
      observedAt: "2026-05-24T20:12:30.000Z",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [capture.id],
      incidentIds: [incident.id]
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_trust_contradicted_missing_object",
      cursor: "",
      kind: "contradicted",
      subjectType: "relationship",
      subjectId: "rel_trust_missing_object",
      observedAt: "2026-05-24T20:12:31.000Z",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [capture.id],
      incidentIds: [incident.id],
      relationshipIds: ["rel_trust_missing_object"]
    }));
  }
  store.saveLiveSearchSnapshot(fixtureSnapshot({
    id: `snap_trust_${input.id}`,
    capturedAt: capture.collectedAt,
    discoveryEvidenceIds: [discovery.id],
    captureIds: [capture.id],
    incidentIds: [incident.id],
    newEvidenceIds: [discovery.id, capture.id, incident.id]
  }));

  return { captureId: capture.id, incidentId: incident.id };
}

function fixtureCapture(overrides: Partial<RawCapture> = {}): RawCapture {
  const body = overrides.body ?? "APT29 public report CVE-2026-1234.";
  return {
    id: "cap_cutover_fixture",
    tenantId: "tenant_cutover",
    sourceId: "src_cutover",
    url: "https://example.test/cutover",
    collectedAt: "2026-05-24T20:00:00.000Z",
    contentHash: hashContent(body),
    mediaType: "text/plain",
    storageKind: "inline_text",
    body,
    metadata: { query: "APT29", normalizedQuery: "apt29", runId: "run_cutover" },
    sensitive: false,
    ...overrides
  };
}

function fixtureDiscovery(overrides: Partial<DiscoveryEvidence> = {}): DiscoveryEvidence {
  return {
    id: "disc_cutover_fixture",
    tenantId: "tenant_cutover",
    query: "APT29",
    normalizedQuery: "apt29",
    provider: "search_provider",
    evidenceType: "search_snippet",
    resultId: "result_cutover",
    observedAt: "2026-05-24T20:00:00.000Z",
    title: "APT29 cutover fixture",
    snippet: "APT29 discovery evidence.",
    url: "https://example.test/cutover",
    sourceId: "src_cutover",
    confidence: 0.6,
    metadata: { fixture: true },
    retentionClass: "discovery_snippet",
    ...overrides
  };
}

function fixtureDelta(overrides: Partial<EvidenceDelta> = {}): EvidenceDelta {
  return {
    id: "delta_cutover_fixture",
    tenantId: "tenant_cutover",
    query: "APT29",
    normalizedQuery: "apt29",
    runId: "run_cutover",
    cursor: "2026-05-24T20:00:00.000Z#delta_cutover_fixture",
    kind: "added",
    subjectType: "discovery_evidence",
    subjectId: "disc_cutover_fixture",
    observedAt: "2026-05-24T20:00:00.000Z",
    sourceId: "src_cutover",
    discoveryEvidenceIds: ["disc_cutover_fixture"],
    captureIds: [],
    incidentIds: [],
    relationshipIds: [],
    policyEventIds: [],
    retentionClass: "evidence_delta",
    metadata: { fixture: true },
    ...overrides
  };
}

function fixtureSnapshot(overrides: Partial<LiveSearchSnapshot> = {}): LiveSearchSnapshot {
  return {
    id: "snap_cutover_fixture",
    tenantId: "tenant_cutover",
    query: "APT29",
    normalizedQuery: "apt29",
    runId: "run_cutover",
    status: "ready",
    capturedAt: "2026-05-24T20:00:10.000Z",
    discoveryEvidenceIds: [],
    captureIds: [],
    incidentIds: [],
    newEvidenceIds: [],
    metadata: { fixture: true },
    retentionClass: "live_search_snapshot",
    ...overrides
  };
}
