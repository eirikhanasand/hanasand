import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildEvidenceClaimLedgerDto } from "../api/evidenceDtos.ts";
import {
  analystCollectionPlanFromPostgresRow,
  analystCollectionPlanToPostgresRow,
  analystCollectionRunFromPostgresRow,
  analystCollectionRunToPostgresRow,
  analystCollectionTaskFromPostgresRow,
  analystCollectionTaskToPostgresRow,
  analystClaimLedgerEntryFromPostgresRow,
  analystClaimLedgerEntryToPostgresRow,
  analystLoopSnapshotFromPostgresRows,
  analystLoopSnapshotToPostgresRows,
  analystMetadataReviewTaskFromPostgresRow,
  analystMetadataReviewTaskToPostgresRow,
  analystSourceActivationPacketFromPostgresRow,
  analystSourceActivationPacketToPostgresRow,
  analystVictimNotificationPacketFromPostgresRow,
  analystVictimNotificationPacketToPostgresRow,
  buildAnalystLoopPersistenceReadinessPacket
} from "../storage/analystLoopPostgres.ts";
import {
  buildEvidenceChainOfCustodyReport,
  buildEvidenceCutoverRehearsalReport,
  buildEvidenceBackupIntegrityReport,
  buildEvidenceBackendParityReport,
  buildEvidenceDisasterRecoveryManifest,
  buildEvidenceIndexReplayMigrationReport,
  buildEvidenceObjectIntegrityRepairReport,
  buildEvidenceReplayBenchmarkReport,
  buildEvidenceRetentionRuntimeReport,
  buildEvidenceSearchBackendMigrationReadinessReport,
  buildEvidenceSearchConsistencySloReport,
  buildEvidenceSearchIndexHandoff,
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
import {
  buildEvidencePromotionTransactionPlan,
  buildEvidencePromotionTransactionAuditReplay,
  buildEvidenceActorProductImpactReplay,
  buildEvidenceSearchReadModelBackendWriteSet,
  buildEvidenceSearchReadModelPromotionReplay,
  createEvidenceSearchReadModelRepository,
  evidencePromotionExecutionFromPostgresRows,
  evidencePromotionExecutionToPostgresRows,
  executeEvidencePromotionTransactionPlan,
  evidenceSearchDocumentFromPostgresRow,
  evidenceSearchDocumentToPgvectorCandidate,
  evidenceSearchReadModelReadiness,
  evidenceSearchTombstoneRowForDocument
} from "../storage/evidenceSearchReadModel.ts";
import { DEFAULT_RETENTION_POLICIES, simulateInterruptedRetentionEnforcement } from "../storage/retention.ts";
import {
  buildSourceRegistryPersistenceReadinessPacket,
  tiSourceAtlasExportManifestToPostgresRows,
  tiSourceAtlasRecordFromPostgresRow,
  tiSourceAtlasRecordToPostgresRow,
  sourceRecordFromPostgresRows,
  sourceRecordToPostgresRows
} from "../storage/sourceRegistryPostgres.ts";
import {
  buildTiSourceAtlasApiResponse,
  buildTiSourceAtlasExportManifestApiResponse
} from "../registry/sourceSeeds.ts";
import type {
  AnalystClaimLedgerEntry,
  AnalystLoopSnapshot,
  AnalystMetadataReviewTask,
  AnalystSourceActivationPacket,
  AnalystVictimNotificationPacket,
  CollectionPlan,
  CollectionRun,
  CollectionTask,
  DiscoveryEvidence,
  EvidenceDelta,
  LiveSearchSnapshot,
  ObjectStoreRef,
  PipelineResult,
  RawCapture,
  SourceRecord
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

  test("source registry migration and mappers persist governance-ready sources", async () => {
    const sql = await Bun.file(new URL("../../migrations/001_source_registry.sql", import.meta.url)).text();

    expect(sql).toContain("CREATE TABLE sources");
    expect(sql).toContain("CREATE TABLE source_governance");
    expect(sql).toContain("CREATE TABLE source_legal_notes");
    expect(sql).toContain("CREATE TABLE source_health");
    expect(sql).toContain("CREATE TABLE source_scoring_inputs");
    expect(sql).toContain("CREATE TABLE source_crawl_state");
    expect(sql).toContain("CREATE TABLE source_lifecycle_events");
    expect(sql).toContain("CREATE TABLE source_atlas_records");
    expect(sql).toContain("CREATE TABLE source_atlas_review_queue");
    expect(sql).toContain("CREATE TABLE source_atlas_export_manifest");
    expect(sql).toContain("reject_unapproved_active_sources");
    expect(sql).toContain("metadata source % must be governed as metadata-only");
    expect(sql).toContain("approval_required boolean NOT NULL DEFAULT true CHECK (approval_required = true)");
    expect(sql).toContain("auto_activation_allowed boolean NOT NULL DEFAULT false CHECK (auto_activation_allowed = false)");
    expect(sql).toContain("will_start_crawling boolean NOT NULL DEFAULT false CHECK (will_start_crawling = false)");
    expect(sql).toContain("source_atlas_records_tenant_family_idx");
    expect(sql).toContain("source_atlas_review_queue_tenant_decision_idx");
    expect(sql).toContain("source_atlas_export_manifest_tenant_plan_idx");

    const source: SourceRecord = {
      id: "src_registry_tor_metadata",
      tenantId: "tenant_registry",
      name: "Restricted metadata blog",
      type: "tor_metadata",
      url: "http://source.example/posts",
      accessMethod: "approved_proxy",
      status: "active",
      risk: "restricted",
      trustScore: 0.83,
      language: "en",
      crawlFrequencySeconds: 3600,
      legalNotes: "Approved metadata-only monitoring for victim notification workflow.",
      createdAt: "2026-05-24T09:00:00.000Z",
      updatedAt: "2026-05-24T10:00:00.000Z",
      lastSeenAt: "2026-05-24T09:45:00.000Z",
      approvalRequired: true,
      approvedAt: "2026-05-24T09:05:00.000Z",
      approvedBy: "legal-1",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: "2026-05-24T09:05:00.000Z",
        approvedBy: "legal-1",
        approvalExpiresAt: "2026-06-24T09:05:00.000Z",
        reviewTicket: "LEGAL-101",
        policyVersion: "collection-policy:v1",
        riskJustification: "Metadata-only threat-actor claim monitoring; no dataset access.",
        legalContact: "legal@example.test"
      },
      health: {
        status: "healthy",
        checkedAt: "2026-05-24T09:50:00.000Z",
        lastSuccessAt: "2026-05-24T09:50:00.000Z",
        consecutiveFailures: 0,
        errorRate: 0.05,
        medianLatencyMs: 220
      },
      scoring: {
        reliability: 0.8,
        freshness: 0.9,
        relevance: 0.85,
        uniqueness: 0.7,
        parseability: 0.75,
        policyRiskPenalty: 0.2,
        operatorBoost: 0.1
      },
      crawlState: {
        lastScheduledAt: "2026-05-24T09:40:00.000Z",
        nextEligibleAt: "2026-05-24T10:40:00.000Z",
        lastCollectedAt: "2026-05-24T09:45:00.000Z",
        etag: "etag-1",
        lastModified: "Sun, 24 May 2026 09:45:00 GMT",
        cursor: "cursor-1",
        retryCount: 0
      },
      lifecycle: [{
        at: "2026-05-24T09:05:00.000Z",
        from: "needs_review",
        to: "active",
        reason: "operator_request",
        actorId: "legal-1",
        note: "Approved metadata-only collection."
      }],
      tags: ["akira", "victim-claims"],
      metadata: { network: "tor", metadataOnly: true },
      catalog: {
        canonicalId: "restricted-metadata-blog",
        publisher: { name: "Restricted metadata publisher", trustBasis: "unknown" },
        tier: "watchlist",
        approvalScope: "metadata_only",
        license: "Restricted metadata review only",
        legalBasis: "Defensive notification workflow",
        reliability: 0.72,
        intelligenceValue: 0.81,
        retentionClass: "darknet_metadata",
        coverage: {
          topics: ["ransomware"],
          actors: ["Akira"],
          aliases: [],
          industries: ["energy"],
          regions: ["Europe"],
          countries: ["NO"],
          languages: ["en"],
          queryPatterns: ["victim leak claim"]
        },
        collection: {
          freshnessTargetSeconds: 3600,
          collectionSlaSeconds: 7200,
          budgetClass: "normal",
          crawlCadenceSeconds: 3600
        },
        adapterCompatibility: ["tor_metadata"]
      }
    };

    const rows = sourceRecordToPostgresRows(source);
    expect(rows.sources[0]).toMatchObject({
      id: source.id,
      tenant_id: "tenant_registry",
      status: "active",
      risk: "restricted"
    });
    expect(rows.sources[0]?.metadata).toMatchObject({
      network: "tor",
      metadataOnly: true,
      catalog: {
        canonicalId: "restricted-metadata-blog",
        approvalScope: "metadata_only"
      }
    });
    expect(rows.source_governance[0]).toMatchObject({
      source_id: source.id,
      approval_required: true,
      approval_state: "approved",
      metadata_only: true,
      approved_by: "legal-1"
    });
    expect(rows.source_legal_notes[0]?.note).toContain("metadata-only monitoring");
    expect(rows.source_health[0]).toMatchObject({ status: "healthy", error_rate: 0.05 });
    expect(rows.source_scoring_inputs[0]).toMatchObject({ reliability: 0.8, policy_risk_penalty: 0.2 });
    expect(rows.source_crawl_state[0]).toMatchObject({ cursor_value: "cursor-1", retry_count: 0 });
    expect(rows.source_lifecycle_events[0]).toMatchObject({ to_status: "active", reason: "operator_request" });

    const roundTrip = sourceRecordFromPostgresRows({
      source: rows.sources[0]!,
      governance: rows.source_governance[0],
      legalNotes: rows.source_legal_notes,
      health: rows.source_health[0],
      scoring: rows.source_scoring_inputs[0],
      crawlState: rows.source_crawl_state[0],
      lifecycle: rows.source_lifecycle_events
    });
    expect(roundTrip).toMatchObject({
      id: source.id,
      tenantId: "tenant_registry",
      legalNotes: source.legalNotes,
      governance: {
        approvalState: "approved",
        metadataOnly: true,
        approvedBy: "legal-1"
      },
      health: { status: "healthy" },
      scoring: { reliability: 0.8 },
      crawlState: { cursor: "cursor-1" },
      catalog: { approvalScope: "metadata_only" }
    });

    const readiness = buildSourceRegistryPersistenceReadinessPacket("2026-05-24T10:00:00.000Z");
    expect(readiness).toMatchObject({
      migration: "migrations/001_source_registry.sql",
      dryRun: true,
      willMutate: false,
      willConnectToDatabase: false
    });
    expect(readiness.workflowTables.map((table) => table.table)).toEqual(expect.arrayContaining([
      "sources",
      "source_governance",
      "source_legal_notes",
      "source_health",
      "source_scoring_inputs",
      "source_crawl_state",
      "source_lifecycle_events",
      "source_atlas_records",
      "source_atlas_review_queue",
      "source_atlas_export_manifest"
    ]));
    expect(readiness.guardrails).toEqual(expect.arrayContaining([
      "source registry persistence does not lease work or start crawling",
      "restricted and darknet metadata sources keep governance.metadataOnly=true",
      "source atlas rows are staged dry-run records and do not become active sources without explicit approval",
      "source atlas export manifest rows are audit records only and do not import source packs"
    ]));
  });

  test("source atlas Postgres rows persist staged records and export manifests without activation", () => {
    const generatedAt = "2026-05-24T14:00:00.000Z";
    const tenantId = "tenant_atlas_pg";
    const atlas = buildTiSourceAtlasApiResponse({
      tenantId,
      generatedAt,
      queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234"],
      recordLimit: 500
    });
    const record = atlas.records[0]!;
    const recordRow = tiSourceAtlasRecordToPostgresRow(record, { tenantId, generatedAt });

    expect(recordRow).toMatchObject({
      tenant_id: tenantId,
      atlas_source_id: record.id,
      domain: record.domain,
      family: record.family,
      approval_required: true,
      auto_activation_allowed: false,
      public_only: true,
      private_invite_auth_captcha: false,
      raw_payload_target: false,
      auto_activate: false
    });
    expect(recordRow.source_value_score).toBeGreaterThan(0);
    expect(recordRow.query_class_coverage.length).toBeGreaterThan(0);

    const roundTrip = tiSourceAtlasRecordFromPostgresRow(recordRow);
    expect(roundTrip).toMatchObject({
      id: record.id,
      domain: record.domain,
      family: record.family,
      sourceValueScore: record.sourceValueScore,
      activationReadiness: {
        approvalRequired: true,
        autoActivationAllowed: false,
        state: record.activationReadiness.state
      },
      safety: {
        publicOnly: true,
        privateInviteAuthCaptcha: false,
        rawPayloadTarget: false,
        autoActivate: false
      }
    });

    const exportPacket = buildTiSourceAtlasExportManifestApiResponse({
      tenantId,
      generatedAt,
      queries: ["APT29", "Akira ransomware victims", "CVE-2024-1234"],
      planLabel: "first_100",
      recordLimit: 500
    });
    const rows = tiSourceAtlasExportManifestToPostgresRows(exportPacket);

    expect(rows.source_atlas_records).toEqual([]);
    expect(rows.source_atlas_review_queue).toHaveLength(100);
    expect(rows.source_atlas_export_manifest).toHaveLength(100);
    expect(rows.source_atlas_review_queue.every((row) => row.dry_run && !row.will_mutate && !row.will_start_crawling)).toBe(true);
    expect(rows.source_atlas_export_manifest.every((row) => row.approval_required && !row.auto_activation_allowed && row.manifest_schema_version === "ti.source_atlas_export.v1")).toBe(true);
    expect(rows.source_atlas_review_queue.map((row) => row.decision)).toContain("stage_for_canary");
    expect(rows.source_atlas_review_queue.map((row) => row.decision)).toContain("hold_descriptor_only");

    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain('"auto_activation_allowed":true');
    expect(serialized).not.toContain('"will_mutate":true');
    expect(serialized).not.toContain('"will_start_crawling":true');
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
    const collectionTask: CollectionTask = {
      id: "task_fjord",
      tenantId: "tenant_cutover",
      sourceId: "src_onion",
      targetUrl: "redacted://hash/urlhash",
      sourceType: "tor_metadata",
      queuedAt: "2026-05-24T10:00:30.000Z",
      priority: 89,
      reason: "Safe metadata-only leak claim review for Fjord Energy AS.",
      retryCount: 0,
      intelRequestId: "req_fjord",
      runId: "run_fjord",
      maxBytes: 0,
      planning: {
        budgetClass: "restricted_darknet_metadata_sweep",
        decision: "blocked-by-approval",
        reason: "Operator approval is required before metadata-only collection.",
        queryTerms: ["fjord", "energy"],
        freshness: 0.91,
        safetyEnvelope: {
          allowClearWeb: false,
          allowPublicChannel: false,
          allowRestrictedMetadata: true,
          metadataOnlyRestricted: true,
          forbiddenOperations: ["download leaked datasets", "persist credential values", "interact with threat actors"]
        },
        sourceTrust: 0.72,
        selectedFor: "metadata"
      }
    };
    const collectionPlan: CollectionPlan = {
      id: "plan_fjord",
      tenantId: "tenant_cutover",
      request: {
        id: "req_fjord",
        tenantId: "tenant_cutover",
        query: "Fjord Energy AS",
        entityType: "victim",
        includeClearWeb: true,
        includeTelegram: true,
        includeDarknetMetadata: true,
        maxTasks: 4,
        createdAt: "2026-05-24T10:00:00.000Z",
        requesterId: "analyst-1",
        priority: "high",
        reason: "Analyst loop persistence cutover proof.",
        budgetClass: "restricted_darknet_metadata_sweep"
      },
      tasks: [],
      reviewRequired: [collectionTask],
      rejected: [{ sourceId: "src_blocked_download", reason: "Raw leak download target blocked by policy." }],
      explanations: [{
        sourceId: "src_onion",
        status: "blocked-by-approval",
        reason: "Metadata-only source requires approval.",
        targetUrl: "redacted://hash/urlhash",
        taskId: collectionTask.id,
        priority: 89,
        budgetClass: "restricted_darknet_metadata_sweep",
        queryTerms: ["fjord", "energy"]
      }],
      queryTerms: ["fjord", "energy"],
      audit: [{
        id: "audit_fjord_plan",
        tenantId: "tenant_cutover",
        actorId: "analyst-1",
        action: "planner.metadata_review_queued",
        subjectType: "collection_plan",
        subjectId: "plan_fjord",
        occurredAt: "2026-05-24T10:00:00.000Z",
        metadata: { resultState: "metadata_review", unsafeMaterialAccessed: false }
      }]
    };
    const collectionRun: CollectionRun = {
      id: "run_fjord",
      tenantId: "tenant_cutover",
      planId: collectionPlan.id,
      requestId: collectionPlan.request.id,
      status: "queued",
      createdAt: "2026-05-24T10:00:10.000Z",
      updatedAt: "2026-05-24T10:01:00.000Z",
      idempotencyKey: "tenant_cutover:req_fjord",
      requestHash: "requesthash",
      taskCount: 0,
      reviewTaskCount: 1,
      rejectedSourceCount: 1,
      captureCount: 0,
      incidentCount: 0
    };
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
      ledgerStatus: "trusted",
      retentionClass: "restricted_metadata",
      legalHold: false,
      graphEligible: true,
      stixEligible: true,
      reviewedBy: "analyst-6",
      reviewedAt: "2026-05-24T10:03:30.000Z",
      updatedAt: "2026-05-24T10:03:30.000Z",
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

    const planRow = analystCollectionPlanToPostgresRow(collectionPlan);
    const taskRow = analystCollectionTaskToPostgresRow(collectionTask, {
      planId: collectionPlan.id,
      metadata: {
        resultState: "metadata_review",
        unsafeMaterialAccessed: false
      }
    });
    const runRow = analystCollectionRunToPostgresRow(collectionRun);
    const reviewRow = analystMetadataReviewTaskToPostgresRow(reviewTask);
    const activationRow = analystSourceActivationPacketToPostgresRow(activationPacket);
    const notificationRow = analystVictimNotificationPacketToPostgresRow(notificationPacket);
    const claimRow = analystClaimLedgerEntryToPostgresRow(claimLedgerEntry);
    const snapshotRows = analystLoopSnapshotToPostgresRows({
      collectionPlans: [collectionPlan],
      collectionTasks: [{
        task: collectionTask,
        planId: collectionPlan.id,
        metadata: {
          resultState: "metadata_review",
          unsafeMaterialAccessed: false
        }
      }],
      collectionRuns: [collectionRun],
      metadataReviewTasks: [reviewTask],
      sourceActivationPackets: [activationPacket],
      victimNotificationPackets: [notificationPacket],
      claimLedgerEntries: [claimLedgerEntry],
      loopSnapshots: [loopSnapshot]
    });

    expect(planRow).toMatchObject({
      request_id: "req_fjord",
      normalized_query: "fjord energy as",
      result_state: "metadata_review",
      review_required_count: 1,
      rejected_source_count: 1
    });
    expect(taskRow).toMatchObject({
      plan_id: "plan_fjord",
      task_state: "review_required",
      target_kind: "source_activation_gap",
      target_url: "redacted://hash/urlhash"
    });
    expect(runRow).toMatchObject({
      result_state: "metadata_review",
      review_task_count: 1,
      rejected_source_count: 1
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
      ledger_status: "trusted",
      retention_class: "restricted_metadata",
      legal_hold: false,
      graph_eligible: true,
      stix_eligible: true,
      reviewed_by: "analyst-6"
    });
    expect(analystCollectionPlanFromPostgresRow(planRow, [], [collectionTask], collectionPlan.rejected)).toEqual(collectionPlan);
    expect(analystCollectionTaskFromPostgresRow(taskRow)).toEqual(collectionTask);
    expect(analystCollectionRunFromPostgresRow(runRow)).toEqual(collectionRun);
    expect(analystMetadataReviewTaskFromPostgresRow(reviewRow)).toEqual(reviewTask);
    expect(analystSourceActivationPacketFromPostgresRow(activationRow)).toEqual(activationPacket);
    expect(analystVictimNotificationPacketFromPostgresRow(notificationRow)).toEqual(notificationPacket);
    expect(analystClaimLedgerEntryFromPostgresRow(claimRow)).toEqual(claimLedgerEntry);
    const restoredRows = analystLoopSnapshotFromPostgresRows(snapshotRows);
    expect(restoredRows.collectionPlans[0]).toMatchObject({
      id: collectionPlan.id,
      request: collectionPlan.request,
      queryTerms: ["fjord", "energy"]
    });
    expect(restoredRows.collectionTasks[0]).toEqual(collectionTask);
    expect(restoredRows.collectionRuns[0]).toMatchObject(collectionRun);
    expect(restoredRows.metadataReviewTasks[0]).toMatchObject(reviewTask);
    expect(restoredRows.sourceActivationPackets[0]).toMatchObject(activationPacket);
    expect(restoredRows.victimNotificationPackets[0]).toMatchObject(notificationPacket);
    expect(restoredRows.claimLedgerEntries[0]).toMatchObject(claimLedgerEntry);
    expect(restoredRows.loopSnapshots).toEqual([loopSnapshot]);
    expect(JSON.stringify(snapshotRows)).not.toContain("leakedRows");
    expect(JSON.stringify(snapshotRows)).not.toContain("credentialValues");
    expect(() => analystMetadataReviewTaskToPostgresRow({
      ...reviewTask,
      provenance: {
        ...reviewTask.provenance,
        rawPayload: "do not persist"
      }
    })).toThrow("Unsafe analyst provenance key");
    expect(() => analystCollectionPlanToPostgresRow({
      ...collectionPlan,
      request: {
        ...collectionPlan.request,
        rawPayload: "do not persist"
      } as CollectionPlan["request"]
    })).toThrow("Unsafe analyst provenance key");
    expect(() => analystSourceActivationPacketToPostgresRow({
      ...activationPacket,
      dryRun: false as true
    })).toThrow("dry-run");

    const readiness = buildAnalystLoopPersistenceReadinessPacket("2026-05-24T10:05:00.000Z");
    expect(readiness).toMatchObject({
      endpoint: "/v1/analyst/persistence-readiness",
      dryRun: true,
      willMutate: false,
      willConnectToDatabase: false,
      readiness: {
        state: "ready",
        mappedTableCount: 8,
        blockers: []
      }
    });
    expect(readiness.workflowTables.map((table) => table.table)).toEqual([
      "collection_plans",
      "collection_tasks",
      "collection_runs",
      "metadata_review_tasks",
      "source_activation_packets",
      "victim_notification_packets",
      "claim_ledger_entries",
      "analyst_loop_snapshots"
    ]);
    expect(readiness.dependencies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: "sources",
        migration: "migrations/001_source_registry.sql"
      })
    ]));
    expect(readiness.sourceRegistryPersistence).toMatchObject({
      schemaVersion: "ti.source_registry_persistence_readiness.v1",
      migration: "migrations/001_source_registry.sql",
      dryRun: true,
      willMutate: false,
      willConnectToDatabase: false,
      cutoverRole: "restore source records, governance approvals, legal notes, health, scoring inputs, crawl state, and lifecycle history before replaying analyst-loop tasks"
    });
    expect(readiness.sourceRegistryPersistence.workflowTables.map((table) => table.table)).toEqual(expect.arrayContaining([
      "sources",
      "source_governance",
      "source_legal_notes",
      "source_health",
      "source_scoring_inputs",
      "source_crawl_state",
      "source_lifecycle_events",
      "source_atlas_records",
      "source_atlas_review_queue",
      "source_atlas_export_manifest"
    ]));
    expect(readiness.sourceRegistryPersistence.guardrails).toEqual(expect.arrayContaining([
      "restricted and darknet metadata sources keep governance.metadataOnly=true",
      "medium high and restricted active sources require approved governance rows",
      "source atlas rows are staged dry-run records and do not become active sources without explicit approval"
    ]));
    expect(JSON.stringify(readiness)).not.toContain("object_key");
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

  test("builds point-in-time disaster recovery manifests without leaking evidence material", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    const body = "APT29 public report with replayable DR evidence.";
    const capture = saveCaptureWithObject(store, objects, fixtureCapture({
      id: "cap_dr_manifest",
      body,
      contentHash: hashContent(body),
      storageKind: "inline_text",
      retentionClass: "public_report",
      metadata: {
        normalizedQuery: "apt29",
        extractorVersion: "extractor-v1",
        graphReviewState: "accepted"
      }
    }), body);
    store.saveDiscoveryEvidence(fixtureDiscovery({ id: "disc_dr_manifest", promotedToCaptureId: capture.id }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_dr_capture",
      subjectType: "capture",
      subjectId: capture.id,
      captureIds: [capture.id],
      discoveryEvidenceIds: ["disc_dr_manifest"]
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_dr_extraction",
      cursor: "2026-05-24T20:01:00.000Z#delta_dr_extraction",
      subjectType: "extraction",
      subjectId: "incident_dr_manifest",
      captureIds: [capture.id],
      incidentIds: ["incident_dr_manifest"]
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_dr_relationship",
      cursor: "2026-05-24T20:02:00.000Z#delta_dr_relationship",
      kind: "promoted",
      subjectType: "relationship",
      subjectId: "rel_dr_manifest",
      captureIds: [capture.id],
      incidentIds: ["incident_dr_manifest"],
      relationshipIds: ["rel_dr_manifest"],
      metadata: { reviewState: "accepted" }
    }));
    store.saveLiveSearchSnapshot(fixtureSnapshot({
      id: "snap_dr_manifest",
      captureIds: [capture.id],
      newEvidenceIds: ["delta_dr_capture", "delta_dr_extraction", "delta_dr_relationship"]
    }));
    store.saveAnalystMetadataReviewTask({
      id: "review_dr_manifest",
      tenantId: "tenant_cutover",
      planId: "plan_dr_manifest",
      sourceId: "src_cutover",
      captureId: capture.id,
      status: "notified",
      resultState: "metadata_review",
      company: "Fjord Energy AS",
      victim: "Fjord Energy AS",
      accountSubjects: ["employees"],
      observedAt: "2026-05-24T20:02:00.000Z",
      sourceHash: "hash_dr_manifest",
      provenance: { sourceFamily: "restricted_metadata" },
      allowedActions: ["notify_company"],
      confidence: 0.82,
      unsafeMaterialAccessed: false,
      whatWasNotAccessed: ["No restricted dataset was downloaded or opened."],
      createdAt: "2026-05-24T20:02:00.000Z",
      updatedAt: "2026-05-24T20:02:00.000Z"
    });
    store.saveAnalystClaimLedgerEntry({
      id: "claim_dr_manifest",
      tenantId: "tenant_cutover",
      normalizedQuery: "apt29",
      reviewTaskId: "review_dr_manifest",
      captureId: capture.id,
      sourceId: "src_cutover",
      claimKind: "actor_claim",
      claimTextSummary: "APT29 public report claim reviewed for DR replay.",
      sourceHash: "hash_dr_manifest",
      confidence: 0.82,
      ledgerStatus: "trusted",
      retentionClass: "public_report",
      legalHold: false,
      graphEligible: true,
      stixEligible: true,
      observedAt: "2026-05-24T20:02:00.000Z",
      provenance: { sourceFamily: "public_report" },
      createdAt: "2026-05-24T20:02:00.000Z"
    });
    store.saveAnalystLoopSnapshot({
      id: "loop_dr_manifest",
      tenantId: "tenant_cutover",
      planId: "plan_dr_manifest",
      normalizedQuery: "apt29",
      resultState: "ready",
      headline: "DR replay ready",
      queuedTasks: 0,
      reviewTasks: 1,
      rejectedSources: 0,
      blockedUnsafeTargets: 0,
      meaningfulWorkCount: 1,
      nextSteps: [],
      reviewTaskIds: ["review_dr_manifest"],
      activationPacketIds: [],
      capturedAt: "2026-05-24T20:03:00.000Z"
    });

    const manifest = buildEvidenceDisasterRecoveryManifest(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:05:00.000Z",
      extractorVersion: "extractor-v2"
    });

    expect(manifest).toMatchObject({
      schemaVersion: "ti.evidence_disaster_recovery_manifest.v1",
      restoreReady: true,
      pointInTime: {
        captureCount: 1,
        deltaCount: 6,
        claimLedgerEntryCount: 1,
        analystReviewTaskCount: 1,
        apiSnapshotCount: 1
      },
      objectVerification: { safeToRestore: true },
      claimLedger: {
        trustedEntryIds: ["claim_dr_manifest"],
        graphEligibleEntryIds: ["claim_dr_manifest"],
        stixEligibleEntryIds: ["claim_dr_manifest"]
      },
      graphPromotion: {
        promotedRelationshipIds: ["rel_dr_manifest"]
      },
      apiReadModels: {
        liveSnapshotIds: ["snap_dr_manifest"],
        replayable: true
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        restrictedMaterialExposed: false,
        credentialsExposed: false
      }
    });
    expect(manifest.restorePlan.map((step) => step.step)).toEqual(["objects", "captures", "discovery", "deltas", "claim_ledger", "analyst_review", "api_read_models", "graph_promotion"]);
    expect(manifest.replayInputs[0]).toMatchObject({
      captureId: "cap_dr_manifest",
      objectBacked: true,
      extractorVersion: "extractor-v2",
      retentionClass: "public_report"
    });
    expect(JSON.stringify(manifest)).not.toContain(body);
    expect(JSON.stringify(manifest)).not.toContain(capture.objectRef?.key);
    expect(JSON.stringify(manifest)).not.toContain("password");
  });

  test("builds search and vector handoff documents without leaking restricted material", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    store.saveSource({
      id: "src_public_search",
      tenantId: "tenant_cutover",
      name: "Public CTI reports",
      type: "static_web",
      url: "https://public.example/reports",
      accessMethod: "public_http",
      status: "active",
      risk: "low",
      trustScore: 0.9,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public reports only.",
      createdAt: "2026-05-24T20:00:00.000Z",
      updatedAt: "2026-05-24T20:10:00.000Z",
      tags: ["apt29", "public-report"]
    });
    store.saveSource({
      id: "src_restricted_search",
      tenantId: "tenant_cutover",
      name: "Restricted metadata claims",
      type: "tor_metadata",
      url: "http://abcdefghijklmnopqrstuvwxyzabcdef.onion/leaks",
      accessMethod: "approved_proxy",
      status: "needs_review",
      risk: "restricted",
      trustScore: 0.7,
      crawlFrequencySeconds: 7200,
      legalNotes: "Metadata-only victim claims; no dataset downloads.",
      createdAt: "2026-05-24T20:00:00.000Z",
      updatedAt: "2026-05-24T20:10:00.000Z",
      approvalRequired: true,
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: true
      },
      tags: ["apt29", "victim-claim"]
    });

    const rawPublicBody = "SECRET_PUBLIC_BODY_SHOULD_NOT_LEAK APT29 public detail.";
    const publicCapture = saveCaptureWithObject(store, objects, fixtureCapture({
      id: "cap_search_public",
      sourceId: "src_public_search",
      body: rawPublicBody,
      contentHash: hashContent(rawPublicBody),
      storageKind: "inline_text",
      retentionClass: "public_report",
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        title: "APT29 public intrusion report",
        summary: "APT29 used phishing and custom tooling against public-sector targets.",
        extractorVersion: "extractor-v1",
        confidence: 0.88
      }
    }), rawPublicBody);
    const restrictedCapture = store.saveCapture(fixtureCapture({
      id: "cap_search_restricted",
      sourceId: "src_restricted_search",
      url: "http://abcdefghijklmnopqrstuvwxyzabcdef.onion/leaks/apt29",
      body: "PASSWORD_SHOULD_NOT_LEAK credential rows raw leak body",
      contentHash: hashContent("PASSWORD_SHOULD_NOT_LEAK credential rows raw leak body"),
      sensitive: true,
      sensitivityFlags: ["leak_metadata", "restricted_protocol"],
      retentionClass: "restricted_metadata",
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        title: "Metadata-only victim claim",
        company: "Fjord Energy AS",
        victim: "Fjord Energy AS",
        affectedAccounts: "50k accounts",
        datasetSize: "20 GB",
        actorStatementSummary: "Actor claims Fjord Energy AS was named with 50k accounts and 20 GB.",
        claimedAt: "2026-05-20T00:00:00.000Z",
        sourceHash: "sourcehash-restricted"
      }
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_search_public_capture",
      cursor: "2026-05-24T20:10:00.000Z#delta_search_public_capture",
      subjectType: "capture",
      subjectId: publicCapture.id,
      sourceId: "src_public_search",
      captureIds: [publicCapture.id],
      metadata: { contentHash: publicCapture.contentHash, extractorVersion: "extractor-v1" }
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_search_relationship",
      cursor: "2026-05-24T20:11:00.000Z#delta_search_relationship",
      kind: "promoted",
      subjectType: "relationship",
      subjectId: "rel_apt29_fjord",
      sourceId: "src_restricted_search",
      captureIds: [restrictedCapture.id],
      relationshipIds: ["rel_apt29_fjord"],
      retentionClass: "restricted_metadata",
      metadata: { reviewState: "needs-human-review", confidence: 0.76 }
    }));
    store.saveAnalystClaimLedgerEntry({
      id: "claim_search_fjord",
      tenantId: "tenant_cutover",
      normalizedQuery: "apt29",
      captureId: restrictedCapture.id,
      sourceId: "src_restricted_search",
      claimKind: "affected_accounts_claim",
      company: "Fjord Energy AS",
      victim: "Fjord Energy AS",
      claimTextSummary: "Fjord Energy AS was named in a metadata-only claim with 50k affected accounts and 20 GB.",
      sourceHash: "sourcehash-restricted",
      confidence: 0.8,
      ledgerStatus: "metadata_review",
      retentionClass: "restricted_metadata",
      legalHold: false,
      graphEligible: false,
      stixEligible: false,
      observedAt: "2026-05-24T20:11:00.000Z",
      provenance: { sourceFamily: "restricted_metadata", unsafeMaterialAccessed: false },
      createdAt: "2026-05-24T20:12:00.000Z"
    });

    const handoff = buildEvidenceSearchIndexHandoff(store, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:15:00.000Z"
    });

    expect(handoff).toMatchObject({
      schemaVersion: "ti.evidence_search_index_handoff.v1",
      tenantId: "tenant_cutover",
      normalizedQuery: "apt29",
      backendContract: {
        vendorNeutral: true,
        openSearchCompatible: true,
        vectorCompatible: true,
        tenantScopedRouting: true,
        replayIdRequired: true,
        citationSpansRequired: true
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        restrictedMaterialExposed: false,
        credentialsExposed: false,
        unsafeUrlsExposed: false
      }
    });
    expect(handoff.counts).toMatchObject({
      captures: 2,
      claims: 1,
      graphRelationships: 1,
      sources: 2
    });
    expect(handoff.counts.embeddingEligible).toBeGreaterThanOrEqual(1);
    expect(handoff.counts.restrictedMetadataExcludedFromEmbedding).toBeGreaterThanOrEqual(3);
    const publicDoc = handoff.documents.find((document) => document.captureId === publicCapture.id && document.kind === "capture");
    expect(publicDoc).toMatchObject({
      embedding: { eligible: true, reason: "public_text" },
      redaction: {
        metadataOnly: false,
        restricted: false,
        rawBodyIncluded: false,
        objectKeyIncluded: false
      }
    });
    expect(publicDoc?.embedding.inputTextHash).toBeDefined();
    const restrictedDoc = handoff.documents.find((document) => document.captureId === restrictedCapture.id && document.kind === "capture");
    expect(restrictedDoc).toMatchObject({
      summary: expect.stringContaining("Fjord Energy AS"),
      embedding: { eligible: false, reason: "restricted_metadata_excluded" },
      redaction: {
        metadataOnly: true,
        restricted: true,
        rawBodyIncluded: false,
        objectKeyIncluded: false,
        unsafeUrlIncluded: false
      }
    });
    expect(handoff.documents.every((document) => document.replay.replayId && document.citationSpans.length > 0)).toBe(true);
    expect(handoff.documents.every((document) => document.backendHints.routingKey.startsWith("tenant_cutover:"))).toBe(true);

    const serialized = JSON.stringify(handoff);
    expect(serialized).not.toContain(rawPublicBody);
    expect(serialized).not.toContain(publicCapture.objectRef?.key);
    expect(serialized).not.toContain("PASSWORD_SHOULD_NOT_LEAK");
    expect(serialized).not.toContain("credential rows");
    expect(serialized).not.toContain(".onion");
    expect(serialized).toContain("Fjord Energy AS");

    const otherTenant = buildEvidenceSearchIndexHandoff(store, "APT29", {
      tenantId: "tenant_other",
      generatedAt: "2026-05-24T20:15:00.000Z"
    });
    expect(otherTenant.counts.total).toBe(0);
  });

  test("indexes evidence search handoff through a disabled-by-default read-model adapter boundary", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    store.saveSource({
      id: "src_read_model_public",
      tenantId: "tenant_cutover",
      name: "Read model public CTI",
      type: "static_web",
      url: "https://read-model.example/reports",
      accessMethod: "public_http",
      status: "active",
      risk: "low",
      trustScore: 0.91,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public CTI reports.",
      createdAt: "2026-05-24T21:40:00.000Z",
      updatedAt: "2026-05-24T21:40:00.000Z",
      tags: ["apt29"]
    });
    store.saveSource({
      id: "src_read_model_restricted",
      tenantId: "tenant_cutover",
      name: "Read model restricted metadata",
      type: "tor_metadata",
      url: "http://abcdefghijklmnopqrstuvwxyzabcdef.onion/read-model",
      accessMethod: "approved_proxy",
      status: "needs_review",
      risk: "restricted",
      trustScore: 0.72,
      crawlFrequencySeconds: 7200,
      legalNotes: "Metadata-only restricted victim claims.",
      createdAt: "2026-05-24T21:40:00.000Z",
      updatedAt: "2026-05-24T21:40:00.000Z",
      governance: { approvalRequired: true, approvalState: "pending", metadataOnly: true },
      tags: ["apt29", "victim-claim"]
    });
    const publicBody = "APT29 read-model evidence with WellMess and phishing.";
    const publicCapture = saveCaptureWithObject(store, objects, fixtureCapture({
      id: "cap_read_model_public",
      sourceId: "src_read_model_public",
      body: publicBody,
      contentHash: hashContent(publicBody),
      retentionClass: "public_report",
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        title: "APT29 read-model report",
        summary: "APT29 used phishing and WellMess.",
        extractorVersion: "extractor-v1",
        confidence: 0.9
      }
    }), publicBody);
    const restrictedRaw = "PASSWORD_SHOULD_NOT_LEAK raw credential rows";
    const restrictedCapture = store.saveCapture(fixtureCapture({
      id: "cap_read_model_restricted",
      sourceId: "src_read_model_restricted",
      url: "http://abcdefghijklmnopqrstuvwxyzabcdef.onion/read-model/fjord",
      body: restrictedRaw,
      contentHash: hashContent(restrictedRaw),
      sensitive: true,
      sensitivityFlags: ["leak_metadata", "restricted_protocol"],
      retentionClass: "restricted_metadata",
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        title: "Metadata-only Fjord Energy AS claim",
        company: "Fjord Energy AS",
        victim: "Fjord Energy AS",
        affectedAccounts: "18,432 accounts",
        datasetSize: "42 GB",
        actorStatementSummary: "Actor claims payment within 72 hours."
      }
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_read_model_public",
      cursor: "2026-05-24T21:41:00.000Z#delta_read_model_public",
      subjectType: "extraction",
      subjectId: "incident_read_model_public",
      sourceId: "src_read_model_public",
      captureIds: [publicCapture.id],
      incidentIds: ["incident_read_model_public"],
      metadata: { contentHash: publicCapture.contentHash, extractorVersion: "extractor-v1" }
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_read_model_relationship",
      cursor: "2026-05-24T21:42:00.000Z#delta_read_model_relationship",
      kind: "promoted",
      subjectType: "relationship",
      subjectId: "rel_read_model_fjord",
      sourceId: "src_read_model_restricted",
      captureIds: [restrictedCapture.id],
      relationshipIds: ["rel_read_model_fjord"],
      retentionClass: "restricted_metadata",
      metadata: { reviewState: "needs-human-review", confidence: 0.78 }
    }));
    store.saveAnalystClaimLedgerEntry({
      id: "claim_read_model_fjord",
      tenantId: "tenant_cutover",
      normalizedQuery: "apt29",
      captureId: restrictedCapture.id,
      sourceId: "src_read_model_restricted",
      claimKind: "affected_accounts_claim",
      company: "Fjord Energy AS",
      victim: "Fjord Energy AS",
      claimTextSummary: "Fjord Energy AS was listed with 18,432 affected accounts and 42 GB.",
      sourceHash: "hash_read_model_fjord",
      confidence: 0.8,
      ledgerStatus: "metadata_review",
      retentionClass: "restricted_metadata",
      observedAt: "2026-05-24T21:42:00.000Z",
      provenance: { sourceFamily: "restricted_metadata", unsafeMaterialAccessed: false },
      createdAt: "2026-05-24T21:42:00.000Z"
    });

    const handoff = buildEvidenceSearchIndexHandoff(store, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T21:43:00.000Z"
    });
    const repository = createEvidenceSearchReadModelRepository({
      backend: "embedded_memory",
      generatedAt: "2026-05-24T21:44:00.000Z"
    });
    const write = repository.writeHandoff(handoff);
    expect(write).toMatchObject({
      acceptedDocuments: handoff.counts.total,
      restrictedMetadataEmbedded: false,
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      }
    });
    expect(write.embeddingEligible).toBe(handoff.counts.embeddingEligible);
    expect(write.restrictedMetadataIndexed).toBeGreaterThan(0);

    const backendWriteSet = buildEvidenceSearchReadModelBackendWriteSet(handoff, {
      generatedAt: "2026-05-24T21:44:30.000Z"
    });
    expect(backendWriteSet).toMatchObject({
      schemaVersion: "ti.evidence_search_read_model_backend_write_set.v1",
      handoffId: write.handoffId,
      counts: {
        postgresDocuments: handoff.counts.total,
        openSearchDocuments: handoff.counts.total,
        pgvectorCandidates: handoff.counts.embeddingEligible,
        restrictedMetadataDocuments: expect.any(Number),
        metadataOnlyDocuments: expect.any(Number),
        unsafeDocumentsSkipped: 0
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      }
    });
    const restrictedBackendRows = backendWriteSet.postgresDocuments.filter((row) => row.restricted_metadata);
    expect(restrictedBackendRows.length).toBeGreaterThan(0);
    expect(backendWriteSet.pgvectorCandidates.every((row) => !row.restricted_metadata && !row.metadata_only && !row.raw_text_present)).toBe(true);
    expect(backendWriteSet.openSearchDocuments.some((document) => document.restrictedMetadata && !document.embeddingEligible && document.embeddingInputHash === undefined)).toBe(true);
    expect(backendWriteSet.postgresDocuments.some((row) => row.restricted_metadata && row.embedding_input_hash === undefined)).toBe(true);

    const promotionReplay = buildEvidenceSearchReadModelPromotionReplay(backendWriteSet, {
      query: "APT29",
      normalizedQuery: "apt29",
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T21:44:45.000Z"
    });
    expect(promotionReplay).toMatchObject({
      schemaVersion: "ti.evidence_search_read_model_promotion_replay.v1",
      state: "partial",
      canPromotePublicAnswer: true,
      canPromoteGraph: false,
      publicAnswer: {
        status: "ready",
        metadataOnlyClaimCount: expect.any(Number),
        warnings: expect.arrayContaining(["restricted_metadata_used_as_caveated_defensive_context"])
      },
      graphPromotion: {
        status: "hold",
        blockers: expect.arrayContaining(["restricted_relationship_review_required"])
      },
      retention: {
        tombstoneRowsRequired: backendWriteSet.counts.postgresDocuments,
        staleExtractorReplayRequired: true
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      }
    });
    expect(promotionReplay.publicAnswer.restrictedMetadataDocumentIds.length).toBeGreaterThan(0);
    expect(promotionReplay.replayInputs.every((input) => input.replayId && input.citationCount > 0)).toBe(true);

    const promotionTransaction = buildEvidencePromotionTransactionPlan(backendWriteSet, promotionReplay, {
      generatedAt: "2026-05-24T21:44:45.000Z"
    });
    expect(promotionTransaction).toMatchObject({
      schemaVersion: "ti.evidence_promotion_transaction_plan.v1",
      state: "partial",
      dryRun: true,
      willMutate: false,
      sourceReplay: "durable_read_model_rows",
      consumers: {
        publicAnswer: { status: "ready", targetReadModel: "public_answer_read_model" },
        graph: { status: "hold", targetReadModel: "graph_relationship_read_model" },
        stix: { status: "hold", targetReadModel: "stix_preview_read_model" },
        api: { status: "ready", targetReadModel: "api_intel_search_answer_cache" }
      },
      restrictedHandling: {
        caveatedPublicAnswerAllowed: true,
        stixExportHeld: true,
        vectorPromotionAllowed: false
      },
      replayGuarantees: {
        requiresReplayIds: true,
        requiresCitationSpans: true,
        requiresClaimLedgerRefs: true,
        requiresRetentionState: true,
        requiresReviewState: true,
        deterministicIdempotencyKeys: true
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      }
    });
    expect(promotionTransaction.transactionSteps.map((step) => step.consumer)).toEqual(["public_answer", "graph", "stix", "api"]);
    expect(promotionTransaction.transactionSteps.every((step) => step.idempotencyKey.length > 0)).toBe(true);
    expect(promotionTransaction.restrictedHandling.metadataOnlyDocumentIds.length).toBeGreaterThan(0);
    expect(promotionTransaction.restrictedHandling.graphRelationshipsHeld).toEqual(expect.arrayContaining(["rel_read_model_fjord"]));

    const disabledExecution = executeEvidencePromotionTransactionPlan(promotionTransaction, {
      generatedAt: "2026-05-24T21:44:50.000Z"
    });
    expect(disabledExecution).toMatchObject({
      schemaVersion: "ti.evidence_promotion_transaction_execution.v1",
      state: "blocked",
      enabled: false,
      willMutateProductionConsumers: false,
      sourcePlan: "ti.evidence_promotion_transaction_plan.v1",
      appliedSteps: [],
      failClosedReasons: expect.arrayContaining(["promotion_transaction_repository_disabled"]),
      committedConsumerRows: {
        publicAnswer: 0,
        graph: 0,
        stix: 0,
        api: 0
      },
      audit: {
        dryRunPlanAccepted: true,
        deterministicReceipts: true,
        liveBackendConnection: false,
        explicitEnablementRequired: true
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      }
    });
    expect(disabledExecution.heldSteps.map((step) => step.consumer)).toEqual(expect.arrayContaining(["public_answer", "api"]));
    expect(disabledExecution.rollbackRefs).toEqual([]);

    const partialExecution = executeEvidencePromotionTransactionPlan(promotionTransaction, {
      enabled: true,
      allowPartial: true,
      generatedAt: "2026-05-24T21:44:55.000Z",
      operator: "agent_06_test"
    });
    expect(partialExecution).toMatchObject({
      state: "partial",
      enabled: true,
      failClosedReasons: [],
      committedConsumerRows: {
        publicAnswer: promotionTransaction.consumers.publicAnswer.supportDocumentIds.length,
        graph: 0,
        stix: 0,
        api: promotionTransaction.consumers.api.supportDocumentIds.length
      },
      restrictedHandling: {
        caveatedPublicAnswerAllowed: true,
        stixExportHeld: true,
        vectorPromotionAllowed: false
      },
      audit: {
        operator: "agent_06_test",
        liveBackendConnection: false,
        explicitEnablementRequired: true
      }
    });
    expect(partialExecution.appliedSteps.map((step) => step.consumer)).toEqual(["public_answer", "api"]);
    expect(partialExecution.heldSteps.map((step) => step.consumer)).toEqual(expect.arrayContaining(["graph", "stix"]));
    expect(partialExecution.appliedSteps.every((step) => step.receiptId.length > 0 && step.idempotencyKey.length > 0)).toBe(true);
    expect(partialExecution.rollbackRefs).toHaveLength(partialExecution.appliedSteps.length);

    const executionRows = evidencePromotionExecutionToPostgresRows(partialExecution);
    expect(executionRows.execution_receipts).toHaveLength(1);
    expect(executionRows.execution_receipts[0]).toMatchObject({
      schema_version: "ti.evidence_promotion_transaction_execution.v1",
      transaction_id: partialExecution.transactionId,
      handoff_id: partialExecution.handoffId,
      state: "partial",
      enabled: true,
      will_mutate_production_consumers: false,
      operator: "agent_06_test",
      deterministic_receipts: true,
      live_backend_connection: false,
      explicit_enablement_required: true,
      safe_output: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      }
    });
    expect(executionRows.execution_steps.map((row) => row.consumer)).toEqual(["public_answer", "api"]);
    expect(executionRows.held_steps.map((row) => row.consumer)).toEqual(expect.arrayContaining(["graph", "stix"]));
    expect(executionRows.rollback_refs).toHaveLength(partialExecution.rollbackRefs.length);
    expect(JSON.stringify(executionRows)).not.toContain("hidden sensitive body");
    expect(JSON.stringify(executionRows)).not.toContain("tenant/source/private-key");
    const restoredExecution = evidencePromotionExecutionFromPostgresRows(executionRows);
    expect(restoredExecution).toMatchObject({
      schemaVersion: "ti.evidence_promotion_transaction_execution.v1",
      state: "partial",
      transactionId: partialExecution.transactionId,
      appliedSteps: partialExecution.appliedSteps,
      committedConsumerRows: partialExecution.committedConsumerRows,
      audit: {
        operator: "agent_06_test",
        liveBackendConnection: false,
        explicitEnablementRequired: true
      }
    });
    const auditReplay = buildEvidencePromotionTransactionAuditReplay(executionRows, {
      generatedAt: "2026-05-24T21:45:05.000Z"
    });
    expect(auditReplay).toMatchObject({
      schemaVersion: "ti.evidence_promotion_transaction_audit_replay.v1",
      transactionId: partialExecution.transactionId,
      handoffId: partialExecution.handoffId,
      state: "partial",
      repository: {
        backend: "postgres_transaction_audit",
        enabled: false,
        disabledByDefault: true,
        liveBackendConnection: false
      },
      rowCounts: {
        executionReceipts: 1,
        appliedSteps: partialExecution.appliedSteps.length,
        heldSteps: partialExecution.heldSteps.length,
        rollbackRefs: partialExecution.rollbackRefs.length
      },
      replayReady: true,
      deterministicReceiptIds: true,
      canReplayWithoutRawEvidence: true,
      committedConsumerRows: partialExecution.committedConsumerRows,
      failClosedReasons: [],
      restrictedHandling: {
        caveatedPublicAnswerAllowed: true,
        stixExportHeld: true,
        vectorPromotionAllowed: false
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      }
    });
    const actorProductImpactReplay = buildEvidenceActorProductImpactReplay(backendWriteSet, promotionTransaction, auditReplay, {
      generatedAt: "2026-05-24T21:45:10.000Z"
    });
    expect(actorProductImpactReplay).toMatchObject({
      schemaVersion: "ti.evidence_actor_product_impact_replay.v1",
      productSurface: "apify_public_threat_actor_monitor",
      actorBuild: "0.6.3",
      latestProofRunId: "dQzvWhNM2OHrBWVfo",
      state: "partial",
      answerImpact: {
        canImprovePaidActorResult: true,
        freshnessWindowDays: 30,
        staleSuppressionRequired: true,
        darkMetadataSearchable: true,
        darkMetadataCaveated: true,
        replayableFromDurableRows: true
      },
      replayProof: {
        handoffId: backendWriteSet.handoffId,
        promotionTransactionId: promotionTransaction.transactionId,
        auditReplaySchemaVersion: "ti.evidence_promotion_transaction_audit_replay.v1",
        proofRunId: "dQzvWhNM2OHrBWVfo",
        proofDatasetId: "aP1dqnK7uEezn5jJv",
        commands: expect.arrayContaining(["bun run measure:search-product"])
      },
      noLeakGuarantees: {
        restrictedRowsMetadataOnly: true,
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false,
        vectorEmbeddingsForRestrictedRows: false
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      }
    });
    expect(actorProductImpactReplay.usefulActorRows.freshRowsImprovingActorResult.some((row) => row.sourceFamily === "public_report")).toBe(true);
    expect(actorProductImpactReplay.usefulActorRows.restrictedMetadataRows.some((row) => row.sourceFamily === "restricted_metadata")).toBe(true);
    expect(actorProductImpactReplay.usefulActorRows.staleRowsSuppressed.some((row) => row.staleReason === "missing_extractor_version_refresh_required")).toBe(true);
    expect(actorProductImpactReplay.usefulActorRows.missingSourceFamilies.map((row) => row.family)).toEqual(expect.arrayContaining(["public_channel", "advisory"]));
    const actorProductSerialized = JSON.stringify(actorProductImpactReplay);
    expect(actorProductSerialized).toContain("Fjord Energy AS");
    expect(actorProductSerialized).not.toContain(restrictedRaw);
    expect(actorProductSerialized).not.toContain("tenant/source/private-key");
    expect(actorProductSerialized).not.toContain(".onion");

    const publicRow = backendWriteSet.postgresDocuments.find((row) => row.capture_id === publicCapture.id);
    const restrictedRow = backendWriteSet.postgresDocuments.find((row) => row.capture_id === restrictedCapture.id || row.claim_ledger_entry_id === "claim_read_model_fjord");
    expect(publicRow).toBeDefined();
    expect(restrictedRow).toBeDefined();
    expect(evidenceSearchDocumentFromPostgresRow(publicRow!)).toMatchObject({
      schemaVersion: "ti.evidence_search_index_document.v1",
      captureId: publicCapture.id,
      embedding: { eligible: true, modelBoundary: "external_vector_backend" },
      redaction: { rawBodyIncluded: false, objectKeyIncluded: false, unsafeUrlIncluded: false }
    });
    expect(evidenceSearchDocumentFromPostgresRow(restrictedRow!)).toMatchObject({
      embedding: { eligible: false, reason: "restricted_metadata_excluded" },
      redaction: { metadataOnly: true, restricted: true, rawBodyIncluded: false, objectKeyIncluded: false, unsafeUrlIncluded: false }
    });
    expect(evidenceSearchDocumentToPgvectorCandidate(evidenceSearchDocumentFromPostgresRow(restrictedRow!))).toBeUndefined();
    const tombstoneRow = evidenceSearchTombstoneRowForDocument(evidenceSearchDocumentFromPostgresRow(restrictedRow!), {
      tombstonedAt: "2026-05-24T21:45:00.000Z",
      reason: "retention_expiry_test"
    });
    expect(tombstoneRow).toMatchObject({
      retention_class: "restricted_metadata",
      legal_hold: false,
      reason: "retention_expiry_test",
      replay_id: expect.any(String)
    });

    const stats = repository.stats();
    expect(stats).toMatchObject({
      backend: "embedded_memory",
      enabled: true,
      documentCount: handoff.counts.total,
      activeDocumentCount: handoff.counts.total,
      restrictedMetadataEmbedded: false
    });
    expect(stats.tenantRoutingKeys.every((key) => key.startsWith("tenant_cutover:"))).toBe(true);

    const restrictedResults = repository.search({
      query: "Fjord Energy 18,432 accounts",
      tenantId: "tenant_cutover",
      includeRestrictedMetadata: true
    });
    expect(restrictedResults.length).toBeGreaterThan(0);
    expect(restrictedResults[0]).toMatchObject({
      restrictedMetadata: true,
      metadataOnly: true,
      embeddingEligible: false,
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false
      }
    });
    expect(restrictedResults[0]?.summary).toContain("Fjord Energy AS");
    expect(restrictedResults[0]?.embeddingInputHash).toBeUndefined();

    const vectorResults = repository.search({
      query: "APT29 WellMess phishing",
      tenantId: "tenant_cutover",
      embeddingEligibleOnly: true
    });
    expect(vectorResults.length).toBeGreaterThan(0);
    expect(vectorResults.every((result) => result.embeddingEligible && !result.restrictedMetadata && result.embeddingInputHash)).toBe(true);

    const deletion = repository.deleteByRetention({
      retentionClasses: ["restricted_metadata"],
      reason: "retention_expiry_test"
    });
    expect(deletion.tombstonedDocuments).toBeGreaterThan(0);
    expect(repository.search({ query: "Fjord Energy", tenantId: "tenant_cutover" })).toEqual([]);
    expect(repository.search({ query: "WellMess", tenantId: "tenant_cutover" }).length).toBeGreaterThan(0);

    const disabled = createEvidenceSearchReadModelRepository({ backend: "opensearch_pgvector" });
    expect(disabled.readiness()).toMatchObject({
      schemaVersion: "ti.evidence_search_read_model_adapter.v1",
      backend: "opensearch_pgvector",
      enabled: false,
      disabledByDefault: true,
      canWrite: false,
      canSearch: false,
      failClosedWithoutExplicitEnable: true,
      liveBackendConnection: false,
      noLeakGuarantees: {
        restrictedMetadataSearchable: true,
        restrictedMetadataEmbedded: false,
        rawBodiesStored: false,
        objectKeysStored: false,
        unsafeUrlsStored: false
      }
    });
    expect(() => disabled.writeHandoff(handoff)).toThrow("disabled until explicit feature-flagged cutover");
    expect(evidenceSearchReadModelReadiness({ backend: "postgres_read_model" }).postgresTables).toEqual(expect.arrayContaining([
      "evidence_search_documents",
      "evidence_search_tombstones",
      "evidence_search_replay_checkpoints"
    ]));

    const serialized = JSON.stringify({ write, backendWriteSet, tombstoneRow, stats, restrictedResults, vectorResults, deletion, readiness: disabled.readiness() });
    expect(serialized).not.toContain(publicBody);
    expect(serialized).not.toContain(restrictedRaw);
    expect(serialized).not.toContain(publicCapture.objectRef?.key);
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("PASSWORD_SHOULD_NOT_LEAK");
  });

  test("builds evidence index replay migration reports with rollback and restricted metadata holds", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    store.saveSource({
      id: "src_index_public",
      tenantId: "tenant_cutover",
      name: "Index migration public source",
      type: "static_web",
      url: "https://index.example/reports",
      accessMethod: "public_http",
      status: "active",
      risk: "low",
      trustScore: 0.92,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public CTI reports.",
      createdAt: "2026-05-24T20:00:00.000Z",
      updatedAt: "2026-05-24T20:10:00.000Z",
      tags: ["apt29", "index"]
    });
    store.saveSource({
      id: "src_index_restricted",
      tenantId: "tenant_cutover",
      name: "Index migration restricted metadata source",
      type: "tor_metadata",
      url: "http://abcdefghijklmnopqrstuvwxyzabcdef.onion/index",
      accessMethod: "approved_proxy",
      status: "needs_review",
      risk: "restricted",
      trustScore: 0.7,
      crawlFrequencySeconds: 7200,
      legalNotes: "Metadata-only victim claims; no dataset downloads.",
      createdAt: "2026-05-24T20:00:00.000Z",
      updatedAt: "2026-05-24T20:10:00.000Z",
      governance: { approvalRequired: true, approvalState: "pending", metadataOnly: true },
      tags: ["apt29", "victim-claim"]
    });
    const body = "APT29 public migration report with phishing and WellMess.";
    const publicCapture = saveCaptureWithObject(store, objects, fixtureCapture({
      id: "cap_index_public",
      sourceId: "src_index_public",
      body,
      contentHash: hashContent(body),
      retentionClass: "public_report",
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        runId: "run_index_migration",
        title: "APT29 index migration report",
        summary: "APT29 public report mentions phishing and WellMess.",
        extractorVersion: "extractor-v1",
        confidence: 0.91
      }
    }), body);
    const restrictedCapture = store.saveCapture(fixtureCapture({
      id: "cap_index_restricted",
      sourceId: "src_index_restricted",
      url: "http://abcdefghijklmnopqrstuvwxyzabcdef.onion/index/apt29",
      body: undefined,
      storageKind: "metadata_only",
      contentHash: hashContent("restricted metadata claim"),
      sensitive: true,
      sensitivityFlags: ["leak_metadata", "restricted_protocol"],
      retentionClass: "restricted_metadata",
      redaction: { applied: true, policy: "metadata_only", reason: "restricted metadata remains safe fields only" },
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        runId: "run_index_migration",
        title: "Metadata-only claim",
        company: "Fjord Energy AS",
        affectedAccounts: "50k accounts",
        datasetSize: "20 GB",
        actorStatementSummary: "Actor claims Fjord Energy AS was named with 50k accounts and 20 GB.",
        extractorVersion: "extractor-v1",
        confidence: 0.78
      }
    }));
    store.saveIncident({
      id: "incident_index_public",
      sourceId: "src_index_public",
      captureId: publicCapture.id,
      extractorVersion: "extractor-v1",
      title: "APT29 index migration incident",
      summary: "APT29 public migration report mentions phishing and WellMess.",
      firstSeenAt: publicCapture.collectedAt,
      confidence: 0.91,
      entities: [{ type: "actor", value: "APT29", confidence: 0.91 }],
      indicators: [],
      reviewReasons: []
    });
    const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({
      id: "disc_index_public",
      sourceId: "src_index_public",
      promotedToCaptureId: publicCapture.id,
      promotedToIncidentId: "incident_index_public",
      metadata: { runId: "run_index_migration" }
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_index_extraction",
      cursor: "2026-05-24T20:20:00.000Z#delta_index_extraction",
      runId: "run_index_migration",
      subjectType: "extraction",
      subjectId: "extract_index_public",
      sourceId: "src_index_public",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [publicCapture.id],
      incidentIds: ["incident_index_public"],
      metadata: { contentHash: publicCapture.contentHash, extractorVersion: "extractor-v1", confidence: 0.91 }
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_index_relationship",
      cursor: "2026-05-24T20:21:00.000Z#delta_index_relationship",
      runId: "run_index_migration",
      kind: "promoted",
      subjectType: "relationship",
      subjectId: "rel_index_apt29_fjord",
      sourceId: "src_index_restricted",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [restrictedCapture.id],
      relationshipIds: ["rel_index_apt29_fjord"],
      retentionClass: "restricted_metadata",
      metadata: { contentHash: restrictedCapture.contentHash, reviewState: "accepted", confidence: 0.78, stixEligible: true }
    }));
    store.saveAnalystClaimLedgerEntry({
      id: "claim_index_fjord",
      tenantId: "tenant_cutover",
      normalizedQuery: "apt29",
      captureId: restrictedCapture.id,
      sourceId: "src_index_restricted",
      claimKind: "affected_accounts_claim",
      company: "Fjord Energy AS",
      victim: "Fjord Energy AS",
      claimTextSummary: "Fjord Energy AS was named in a metadata-only claim with 50k affected accounts and 20 GB.",
      sourceHash: restrictedCapture.contentHash,
      confidence: 0.82,
      ledgerStatus: "trusted",
      retentionClass: "restricted_metadata",
      legalHold: false,
      graphEligible: true,
      stixEligible: true,
      observedAt: "2026-05-24T20:21:00.000Z",
      reviewedAt: "2026-05-24T20:22:00.000Z",
      provenance: { sourceFamily: "restricted_metadata", unsafeMaterialAccessed: false },
      createdAt: "2026-05-24T20:22:00.000Z"
    });
    store.saveLiveSearchSnapshot(fixtureSnapshot({
      id: "snap_index_migration",
      runId: "run_index_migration",
      capturedAt: "2026-05-24T20:22:30.000Z",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [publicCapture.id, restrictedCapture.id],
      newEvidenceIds: [discovery.id, publicCapture.id, restrictedCapture.id],
      metadata: { runId: "run_index_migration" }
    }));

    const report = buildEvidenceIndexReplayMigrationReport(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:23:00.000Z"
    });

    expect(report).toMatchObject({
      schemaVersion: "ti.evidence_index_replay_migration.v1",
      targetBackends: {
        openSearchIndex: "ti-evidence-v1",
        vectorNamespace: "ti-evidence",
        aliasCutover: "blue_green_alias_swap"
      },
      validation: {
        status: "ready",
        checks: {
          objectRefsVerified: true,
          cursorReplayComplete: true,
          redactionSafe: true,
          restrictedMetadataHeldFromEmbedding: true,
          graphRelationshipsConsistent: true,
          apiAnswersConsistent: true,
          stixExportReviewed: true,
          rollbackReady: true
        }
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedMaterialExposed: false
      }
    });
    expect(report.replayInputs.handoffDocumentCount).toBeGreaterThanOrEqual(5);
    expect(report.replayInputs.embeddingEligibleDocumentCount).toBeGreaterThanOrEqual(1);
    expect(report.replayInputs.restrictedMetadataDocumentCount).toBeGreaterThanOrEqual(2);
    expect(report.consistency.restrictedMetadataHoldDocumentIds.length).toBeGreaterThanOrEqual(2);
    expect(report.plan.map((step) => step.step)).toEqual([
      "source_registry_backfill",
      "object_manifest_verify",
      "capture_index_rebuild",
      "extraction_index_replay",
      "claim_ledger_replay",
      "graph_relationship_replay",
      "opensearch_bulk_commit",
      "vector_upsert_commit",
      "api_answer_refresh",
      "stix_preview_gate"
    ]);

    const slo = buildEvidenceSearchConsistencySloReport(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:23:30.000Z"
    });
    expect(slo).toMatchObject({
      schemaVersion: "ti.evidence_search_consistency_slo.v1",
      summary: {
        status: "ready",
        publicAnswerState: "ready",
        indexRefreshState: "ready",
        vectorState: "ready",
        rollbackReady: true
      },
      latencyBudget: {
        initialPartialP95Ms: 3000,
        cursorReplayP95Ms: 3000,
        indexRefreshP95Ms: 30000,
        vectorUpsertP95Ms: 30000
      },
      consistency: {
        checks: {
          documentsPresent: true,
          deterministicDocumentIds: true,
          tenantRoutingPresent: true,
          replayIdsPresent: true,
          citationSpansPresent: true,
          objectManifestVerified: true,
          cursorReplayComplete: true,
          restrictedMetadataSearchableNotEmbedded: true,
          vectorInputsHashOnly: true,
          graphAndStixRespectReviewHolds: true,
          apiAnswerRefreshSafe: true
        }
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false
      }
    });
    expect(slo.counts.restrictedMetadataDocuments).toBeGreaterThanOrEqual(2);
    expect(slo.latencyBudget.estimatedInitialPartialMs).toBeLessThanOrEqual(slo.latencyBudget.initialPartialP95Ms);
    expect(slo.repairQueue).toEqual([]);

    const missingObjectReport = buildEvidenceIndexReplayMigrationReport(store, new InMemoryObjectEvidenceStore(), "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:24:00.000Z"
    });
    expect(missingObjectReport.validation.status).toBe("blocked");
    expect(missingObjectReport.validation.blockers).toContain(`missing_object_ref:${publicCapture.id}`);
    expect(missingObjectReport.plan.find((step) => step.step === "object_manifest_verify")).toMatchObject({
      ready: false,
      rollbackAction: "restore missing object refs before index alias swap"
    });
    const missingObjectSlo = buildEvidenceSearchConsistencySloReport(store, new InMemoryObjectEvidenceStore(), "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:24:30.000Z"
    });
    expect(missingObjectSlo.summary.status).toBe("blocked");
    expect(missingObjectSlo.consistency.blockers).toContain(`missing_object_ref:${publicCapture.id}`);
    expect(missingObjectSlo.repairQueue.map((packet) => packet.code)).toContain("object_manifest_repair");

    const repair = buildEvidenceObjectIntegrityRepairReport(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:23:45.000Z"
    });
    expect(repair).toMatchObject({
      schemaVersion: "ti.evidence_object_integrity_repair.v1",
      summary: {
        status: "ready",
        publicAnswerImpact: "none",
        indexCutoverImpact: "none",
        rollbackReady: true
      },
      counts: {
        expectedObjects: 1,
        verifiedObjects: 1,
        missingObjects: 0,
        hashMismatches: 0
      },
      validation: {
        checks: {
          manifestComplete: true,
          hashesMatch: true,
          noObjectKeysExposed: true,
          noRawBodiesExposed: true,
          metadataOnlyCapturesHaveNoObjects: true,
          replayAfterRepairReady: true,
          searchConsistencyHeldOnMissingObjects: true
        }
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false
      }
    });
    expect(repair.objectChecks).toEqual([
      expect.objectContaining({
        captureId: publicCapture.id,
        state: "verified",
        repairAction: "none",
        blockers: []
      })
    ]);
    expect(repair.operatorRunbook.map((step) => step.code)).toEqual([
      "verify_manifest",
      "restore_missing_object",
      "quarantine_hash_mismatch",
      "replay_indexes",
      "refresh_public_answer",
      "legal_hold_preserve"
    ]);

    const missingObjectRepair = buildEvidenceObjectIntegrityRepairReport(store, new InMemoryObjectEvidenceStore(), "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:24:45.000Z"
    });
    expect(missingObjectRepair.summary).toMatchObject({
      status: "blocked",
      publicAnswerImpact: "hold",
      indexCutoverImpact: "hold"
    });
    expect(missingObjectRepair.counts.missingObjects).toBe(1);
    expect(missingObjectRepair.validation.blockers).toContain(`missing_object:${publicCapture.id}`);
    expect(missingObjectRepair.objectChecks.find((check) => check.captureId === publicCapture.id)).toMatchObject({
      state: "missing",
      repairAction: "restore_object_from_backup",
      blockers: ["missing_object"]
    });

    const backendReadiness = buildEvidenceSearchBackendMigrationReadinessReport(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:25:00.000Z"
    });
    expect(backendReadiness).toMatchObject({
      schemaVersion: "ti.evidence_search_backend_migration_readiness.v1",
      summary: {
        status: "ready",
        openSearchReady: true,
        pgvectorReady: true,
        aliasCutoverReady: true,
        deletionReplayReady: true,
        rollbackReady: true
      },
      backends: {
        openSearch: {
          candidateIndex: "ti-evidence-v1-candidate",
          readAlias: "ti-evidence-read",
          writeAlias: "ti-evidence-write-candidate",
          ready: true
        },
        pgvector: {
          namespace: "ti-evidence",
          candidateTable: "evidence_vector_candidate",
          inputHashOnly: true,
          ready: true
        },
        postgres: {
          cursorSource: "evidence_delta_cursor",
          ready: true
        }
      },
      policy: {
        redactionSafe: true,
        legalHoldPreserved: true,
        restrictedMetadataSearchable: true,
        restrictedMetadataEmbedded: false,
        deletionReplayMode: "tombstone_then_delete_object",
        metadataOnlyRestrictedMode: "index_safe_metadata_only"
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      }
    });
    expect(backendReadiness.checkpoints.map((checkpoint) => checkpoint.checkpoint)).toEqual([
      "snapshot_source",
      "bulk_index",
      "vector_upsert",
      "delete_replay",
      "alias_swap",
      "api_refresh",
      "rollback"
    ]);
    expect(backendReadiness.fixtures.map((fixture) => fixture.name)).toEqual(expect.arrayContaining([
      "clean_cutover",
      "missing_object",
      "hash_mismatch",
      "restricted_metadata",
      "legal_hold",
      "redaction_delete",
      "rollback_alias"
    ]));

    const replayBenchmark = buildEvidenceReplayBenchmarkReport(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T20:26:00.000Z"
    });
    expect(replayBenchmark).toMatchObject({
      schemaVersion: "ti.evidence_replay_benchmark.v1",
      summary: {
        simulatedCaptureMetadataRecords: 1_000_000,
        chunks: 100,
        chunkSize: 10_000,
        replayable: true,
        publicAnswerRebuild: "ready",
        graphRebuild: "ready"
      },
      scaleModel: {
        simulatedCaptureMetadataRecords: 1_000_000,
        chunkSize: 10_000,
        chunkCount: 100,
        metadataOnlyRowsIndexed: true,
        restrictedRowsEmbedded: false,
        restrictedMetadataRowsEstimated: 60_000,
        replayCursorCheckpointEveryRows: 10_000
      },
      rebuildBehavior: {
        searchIndexAlias: "blue_green_alias_swap",
        publicAnswer: {
          state: "ready",
          sourceEvidenceRequired: true,
          restrictedMetadataCanSupportDefensiveFacts: true
        },
        graph: {
          relationshipDeltaReplay: true,
          reviewHoldsRespected: true
        },
        stix: {
          descriptorOnlyRestrictedMetadata: true,
          reviewedExportRequired: true
        }
      },
      safety: {
        restrictedMetadataSearchable: true,
        restrictedMetadataEmbedded: false,
        rawBodiesLoadedDuringBenchmark: false,
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        restrictedRawContentExposed: false,
        actorInteractionExposed: false
      }
    });
    expect(replayBenchmark.fixtures.map((fixture) => fixture.name)).toEqual(expect.arrayContaining([
      "one_million_public_metadata",
      "restricted_metadata_60k",
      "mixed_tenant_10k_sources",
      "missing_object_replay_hold",
      "legal_hold_deletion_replay",
      "cursor_gap_resume",
      "graph_stix_rebuild"
    ]));

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(body);
    expect(serialized).not.toContain(publicCapture.objectRef?.key);
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("PASSWORD_SHOULD_NOT_LEAK");
    expect(JSON.stringify(repair)).not.toContain(publicCapture.objectRef?.key);
    expect(JSON.stringify(missingObjectRepair)).not.toContain(publicCapture.objectRef?.key);
    expect(JSON.stringify(replayBenchmark)).not.toContain(publicCapture.objectRef?.key);
  });

  test("builds retention and legal-hold runtime enforcement without leaking raw evidence", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    store.saveSource({
      id: "src_retention_runtime",
      tenantId: "tenant_cutover",
      name: "Retention runtime public source",
      type: "static_web",
      url: "https://retention.example/reports",
      accessMethod: "public_http",
      status: "active",
      risk: "low",
      trustScore: 0.9,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public CTI reports.",
      createdAt: "2026-05-24T22:00:00.000Z",
      updatedAt: "2026-05-24T22:00:00.000Z",
      tags: ["apt29"]
    });
    store.saveSource({
      id: "src_retention_restricted",
      tenantId: "tenant_cutover",
      name: "Retention runtime restricted metadata",
      type: "tor_metadata",
      url: "http://abcdefghijklmnopqrstuvwxyzabcdef.onion/retention",
      accessMethod: "approved_proxy",
      status: "needs_review",
      risk: "restricted",
      trustScore: 0.72,
      crawlFrequencySeconds: 7200,
      legalNotes: "Metadata-only restricted claims.",
      createdAt: "2026-05-24T22:00:00.000Z",
      updatedAt: "2026-05-24T22:00:00.000Z",
      governance: { approvalRequired: true, approvalState: "pending", metadataOnly: true },
      tags: ["apt29", "victim-claim"]
    });
    const publicBody = "APT29 legal hold public report with WellMess.";
    const publicCapture = saveCaptureWithObject(store, objects, fixtureCapture({
      id: "cap_retention_runtime_public",
      sourceId: "src_retention_runtime",
      body: publicBody,
      contentHash: hashContent(publicBody),
      retentionClass: "legal_hold",
      legalHold: true,
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        runId: "run_retention_runtime",
        extractorVersion: "extractor-v1",
        confidence: 0.9,
        title: "APT29 legal hold public report",
        summary: "APT29 public report under legal hold."
      }
    }), publicBody);
    const restrictedRaw = "PASSWORD_SHOULD_NOT_LEAK credential rows raw restricted content";
    const restrictedCapture = store.saveCapture(fixtureCapture({
      id: "cap_retention_runtime_restricted",
      sourceId: "src_retention_restricted",
      url: "http://abcdefghijklmnopqrstuvwxyzabcdef.onion/retention/apt29",
      body: restrictedRaw,
      contentHash: hashContent(restrictedRaw),
      sensitive: true,
      sensitivityFlags: ["leak_metadata", "restricted_protocol"],
      retentionClass: "restricted_metadata",
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        runId: "run_retention_runtime",
        extractorVersion: "extractor-v1",
        company: "Fjord Energy AS",
        datasetSize: "20 GB",
        actorStatementSummary: "Actor claims Fjord Energy AS was listed."
      }
    }));
    const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({
      id: "disc_retention_runtime",
      sourceId: "src_retention_runtime",
      promotedToCaptureId: publicCapture.id,
      promotedToIncidentId: "incident_retention_runtime"
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_retention_runtime_extraction",
      cursor: "2026-05-24T22:01:00.000Z#delta_retention_runtime_extraction",
      runId: "run_retention_runtime",
      subjectType: "extraction",
      subjectId: "incident_retention_runtime",
      sourceId: "src_retention_runtime",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [publicCapture.id],
      incidentIds: ["incident_retention_runtime"],
      metadata: { contentHash: publicCapture.contentHash, extractorVersion: "extractor-v1", confidence: 0.9 }
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_retention_runtime_relationship",
      cursor: "2026-05-24T22:02:00.000Z#delta_retention_runtime_relationship",
      runId: "run_retention_runtime",
      kind: "promoted",
      subjectType: "relationship",
      subjectId: "rel_retention_runtime",
      sourceId: "src_retention_restricted",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [restrictedCapture.id],
      relationshipIds: ["rel_retention_runtime"],
      retentionClass: "restricted_metadata",
      metadata: { contentHash: restrictedCapture.contentHash, reviewState: "needs-human-review", stixEligible: true }
    }));
    store.saveAnalystClaimLedgerEntry({
      id: "claim_retention_runtime",
      tenantId: "tenant_cutover",
      normalizedQuery: "apt29",
      captureId: restrictedCapture.id,
      sourceId: "src_retention_restricted",
      claimKind: "victim_claim",
      company: "Fjord Energy AS",
      claimTextSummary: "Fjord Energy AS was listed in restricted metadata.",
      sourceHash: restrictedCapture.contentHash,
      confidence: 0.76,
      ledgerStatus: "metadata_review",
      retentionClass: "restricted_metadata",
      legalHold: false,
      graphEligible: true,
      stixEligible: true,
      observedAt: "2026-05-24T22:02:00.000Z",
      provenance: { sourceFamily: "restricted_metadata", unsafeMaterialAccessed: false },
      createdAt: "2026-05-24T22:02:30.000Z"
    });
    store.saveLiveSearchSnapshot(fixtureSnapshot({
      id: "snap_retention_runtime",
      runId: "run_retention_runtime",
      capturedAt: "2026-05-24T22:03:00.000Z",
      discoveryEvidenceIds: [discovery.id],
      captureIds: [publicCapture.id, restrictedCapture.id],
      incidentIds: ["incident_retention_runtime"],
      newEvidenceIds: [discovery.id, publicCapture.id, restrictedCapture.id]
    }));

    const report = buildEvidenceRetentionRuntimeReport(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T22:04:00.000Z"
    });

    expect(report).toMatchObject({
      schemaVersion: "ti.evidence_retention_runtime_enforcement.v1",
      summary: {
        status: "hold",
        publicAnswerRefresh: "partial",
        graphExportEligibility: "hold",
        stixPreviewEligibility: "hold",
        rollbackReady: true
      },
      validation: {
        checks: {
          objectManifestVerified: true,
          legalHoldPreserved: true,
          restrictedMetadataSearchableNotEmbedded: true,
          graphExportHonorsHolds: true,
          stixPreviewHonorsHolds: true,
          retentionTransitionsAudited: true
        }
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        credentialsExposed: false,
        privateMaterialExposed: false,
        restrictedRawContentExposed: false
      }
    });
    expect(report.validation.blockers).toEqual([]);
    expect(report.validation.warnings).toEqual(expect.arrayContaining(["legal_hold_present", "restricted_metadata_excluded_from_embedding"]));
    expect(report.validation.warnings.some((warning) => warning.startsWith("export_without_review:"))).toBe(true);
    expect(report.surfaces.find((surface) => surface.captureId === publicCapture.id && surface.surface === "raw_capture")).toMatchObject({
      effectiveAction: "legal_hold",
      legalHold: true,
      eligibility: { publicAnswer: "partial", graphExport: "hold", stixPreview: "hold" }
    });
    expect(report.surfaces.find((surface) => surface.captureId === restrictedCapture.id && surface.surface === "restricted_metadata")).toMatchObject({
      redaction: { metadataOnly: true, restricted: true, repairRequired: false },
      blockers: []
    });
    expect(report.surfaces.some((surface) => surface.surface === "vector_index" && surface.effectiveAction === "exclude_from_vector")).toBe(true);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(publicBody);
    expect(serialized).not.toContain(restrictedRaw);
    expect(serialized).not.toContain(publicCapture.objectRef?.key);
    expect(serialized).not.toContain(".onion");
    expect(serialized).not.toContain("PASSWORD_SHOULD_NOT_LEAK");
  });

  test("builds immutable chain-of-custody reports and detects broken lineage gates", () => {
    const store = new InMemoryScraperStore();
    const objects = new InMemoryObjectEvidenceStore();
    store.saveSource({
      id: "src_custody_public",
      tenantId: "tenant_cutover",
      name: "Custody public CTI source",
      type: "static_web",
      url: "https://custody.example/reports",
      accessMethod: "public_http",
      status: "active",
      risk: "low",
      trustScore: 0.91,
      crawlFrequencySeconds: 3600,
      legalNotes: "Public report custody source.",
      createdAt: "2026-05-24T21:00:00.000Z",
      updatedAt: "2026-05-24T21:00:10.000Z",
      lastSeenAt: "2026-05-24T21:00:20.000Z",
      lifecycle: [{
        at: "2026-05-24T21:00:10.000Z",
        to: "active",
        reason: "operator_request",
        note: "Approved public custody source."
      }],
      tags: ["apt29"]
    });
    const body = "APT29 custody report with phishing, WellMess, and CVE-2026-1001.";
    const capture = saveCaptureWithObject(store, objects, fixtureCapture({
      id: "cap_custody_public",
      sourceId: "src_custody_public",
      body,
      contentHash: hashContent(body),
      storageKind: "inline_text",
      retentionClass: "public_report",
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        runId: "run_custody",
        extractorVersion: "extractor-v1",
        confidence: 0.9,
        reviewState: "accepted"
      }
    }), body);
    const discovery = store.saveDiscoveryEvidence(fixtureDiscovery({
      id: "disc_custody_public",
      sourceId: "src_custody_public",
      promotedToCaptureId: capture.id
    }));
    store.promoteDiscoveryEvidence({
      discoveryEvidenceId: discovery.id,
      captureId: capture.id,
      promotedAt: "2026-05-24T21:01:00.000Z",
      promotedBy: "pipeline"
    });
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_custody_extraction",
      runId: "run_custody",
      cursor: "2026-05-24T21:02:00.000Z#delta_custody_extraction",
      kind: "added",
      subjectType: "extraction",
      subjectId: "incident_custody",
      sourceId: "src_custody_public",
      captureIds: [capture.id],
      incidentIds: ["incident_custody"],
      metadata: {
        contentHash: capture.contentHash,
        extractorVersion: "extractor-v1",
        confidence: 0.9,
        reviewState: "accepted"
      }
    }));
    store.saveEvidenceDelta(fixtureDelta({
      id: "delta_custody_relationship",
      runId: "run_custody",
      cursor: "2026-05-24T21:03:00.000Z#delta_custody_relationship",
      kind: "promoted",
      subjectType: "relationship",
      subjectId: "rel_custody_apt29",
      sourceId: "src_custody_public",
      captureIds: [capture.id],
      incidentIds: ["incident_custody"],
      relationshipIds: ["rel_custody_apt29"],
      metadata: {
        contentHash: capture.contentHash,
        confidence: 0.86,
        reviewState: "accepted"
      }
    }));
    store.saveAnalystClaimLedgerEntry({
      id: "claim_custody_apt29",
      tenantId: "tenant_cutover",
      normalizedQuery: "apt29",
      captureId: capture.id,
      sourceId: "src_custody_public",
      claimKind: "actor_claim",
      claimTextSummary: "APT29 public custody report was reviewed and trusted.",
      sourceHash: capture.contentHash,
      confidence: 0.9,
      ledgerStatus: "trusted",
      retentionClass: "public_report",
      legalHold: false,
      graphEligible: true,
      stixEligible: true,
      reviewedBy: "analyst-6",
      reviewedAt: "2026-05-24T21:04:00.000Z",
      observedAt: "2026-05-24T21:02:00.000Z",
      provenance: { sourceFamily: "public_report", unsafeMaterialAccessed: false },
      createdAt: "2026-05-24T21:02:30.000Z"
    });
    store.saveLiveSearchSnapshot(fixtureSnapshot({
      id: "snap_custody_public",
      runId: "run_custody",
      capturedAt: "2026-05-24T21:05:00.000Z",
      captureIds: [capture.id],
      incidentIds: ["incident_custody"],
      newEvidenceIds: ["delta_custody_extraction", "delta_custody_relationship"]
    }));

    const report = buildEvidenceChainOfCustodyReport(store, objects, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T21:06:00.000Z",
      extractorVersion: "extractor-v1"
    });

    expect(report).toMatchObject({
      schemaVersion: "ti.evidence_chain_of_custody.v1",
      verification: {
        status: "ready",
        blockers: [],
        checks: {
          sourceRegistryEvent: true,
          scheduledRun: true,
          rawCapture: true,
          objectRefsVerified: true,
          extraction: true,
          claimLedger: true,
          graphRelationship: true,
          apiSearchAnswer: true,
          stixExportReviewed: true,
          replayable: true,
          redactionSafe: true,
          hashChainIntact: true
        }
      },
      safeOutput: {
        rawBodiesExposed: false,
        objectKeysExposed: false,
        unsafeUrlsExposed: false,
        secretMaterialExposed: false,
        restrictedMaterialExposed: false,
        actorInteractionExposed: false
      }
    });
    expect(report.counts).toMatchObject({
      source_registry_event: 1,
      scheduled_run: 1,
      raw_capture: 1,
      object_ref: 1,
      extraction: 1,
      claim_ledger: 1,
      graph_relationship: 1,
      api_search_answer: 1,
      stix_export_preview: 1
    });
    expect(report.stages.every((stage) => stage.replay.replayId)).toBe(true);
    expect(report.stages.find((stage) => stage.stage === "object_ref")?.objectRefHash).toBeDefined();
    expect(report.stages.find((stage) => stage.stage === "raw_capture")?.links.nextStageIds.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(body);
    expect(serialized).not.toContain(capture.objectRef?.key);
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("credential_value");

    const broken = new InMemoryScraperStore();
    const brokenObjects = new InMemoryObjectEvidenceStore();
    broken.saveSource({
      id: "src_custody_restricted",
      tenantId: "tenant_cutover",
      name: "Restricted custody metadata source",
      type: "tor_metadata",
      url: "http://abcdefghijklmnopqrstuvwxyzabcdef.onion/post",
      accessMethod: "approved_proxy",
      status: "needs_review",
      risk: "restricted",
      trustScore: 0.7,
      crawlFrequencySeconds: 7200,
      legalNotes: "Metadata-only restricted custody source.",
      createdAt: "2026-05-24T21:00:00.000Z",
      updatedAt: "2026-05-24T21:00:10.000Z",
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: true
      }
    });
    const objectRaw = "APT29 object custody body with stale parser.";
    const objectCapture = saveCaptureWithObject(broken, brokenObjects, fixtureCapture({
      id: "cap_custody_object_missing",
      sourceId: "src_custody_restricted",
      body: objectRaw,
      contentHash: hashContent(objectRaw),
      storageKind: "inline_text",
      retentionClass: "public_report",
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        runId: "run_custody_broken",
        extractorVersion: "extractor-v1"
      }
    }), objectRaw);
    if (objectCapture.objectRef) brokenObjects.deleteObject(objectCapture.objectRef, "custody missing object fixture");
    const restrictedRaw = "PASSWORD_SHOULD_NOT_LEAK credential dump raw rows";
    const restrictedCapture = broken.saveCapture(fixtureCapture({
      id: "cap_custody_restricted",
      sourceId: "src_custody_restricted",
      url: "http://abcdefghijklmnopqrstuvwxyzabcdef.onion/post",
      body: restrictedRaw,
      contentHash: hashContent(restrictedRaw),
      sensitive: true,
      sensitivityFlags: ["leak_metadata", "restricted_protocol"],
      retentionClass: "restricted_metadata",
      metadata: {
        query: "APT29",
        normalizedQuery: "apt29",
        runId: "run_custody_broken",
        extractorVersion: "extractor-v1",
        company: "Fjord Energy AS",
        datasetSize: "20 GB",
        actorStatementSummary: "Actor claims Fjord Energy AS was listed."
      }
    }));
    const replay = broken.createReplayJob({
      captureId: objectCapture.id,
      sourceId: objectCapture.sourceId,
      fromExtractorVersion: "extractor-v1",
      toExtractorVersion: "extractor-v2",
      runId: "run_custody_broken"
    });
    broken.recordReplayResult(replay.id, {
      capture: objectCapture,
      indicators: [],
      entities: []
    });
    broken.saveEvidenceDelta(fixtureDelta({
      id: "delta_custody_broken_extraction",
      cursor: "2026-05-24T21:10:00.000Z#delta_custody_broken_extraction",
      subjectType: "extraction",
      subjectId: "incident_custody_broken",
      sourceId: "src_custody_restricted",
      captureIds: [objectCapture.id],
      retentionClass: "restricted_metadata",
      metadata: {
        contentHash: "wrong_hash",
        extractorVersion: "extractor-v1"
      }
    }));
    broken.saveEvidenceDelta(fixtureDelta({
      id: "delta_custody_export_without_review",
      cursor: "2026-05-24T21:11:00.000Z#delta_custody_export_without_review",
      kind: "promoted",
      subjectType: "relationship",
      subjectId: "rel_custody_unreviewed",
      sourceId: "src_custody_restricted",
      captureIds: [objectCapture.id, "cap_missing_relationship"],
      relationshipIds: ["rel_custody_unreviewed"],
      retentionClass: "restricted_metadata",
      metadata: {
        reviewState: "needs-human-review",
        exportReady: true,
        stixEligible: true
      }
    }));
    broken.saveAnalystClaimLedgerEntry({
      id: "claim_custody_unreviewed",
      tenantId: "tenant_cutover",
      normalizedQuery: "apt29",
      captureId: restrictedCapture.id,
      sourceId: "src_custody_restricted",
      claimKind: "victim_claim",
      company: "Fjord Energy AS",
      claimTextSummary: "Fjord Energy AS was named in restricted metadata.",
      sourceHash: "sourcehash-custody",
      confidence: 0.74,
      ledgerStatus: "metadata_review",
      retentionClass: "restricted_metadata",
      graphEligible: true,
      stixEligible: true,
      observedAt: "2026-05-24T21:12:00.000Z",
      provenance: { unsafeMaterialAccessed: false },
      createdAt: "2026-05-24T21:12:00.000Z"
    });

    const brokenReport = buildEvidenceChainOfCustodyReport(broken, brokenObjects, "APT29", {
      tenantId: "tenant_cutover",
      generatedAt: "2026-05-24T21:13:00.000Z"
    });

    expect(brokenReport.verification.status).toBe("blocked");
    expect(brokenReport.verification.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining("missing_object_ref"),
      expect.stringContaining("broken_hash_chain"),
      expect.stringContaining("missing_relationship_capture")
    ]));
    expect(brokenReport.verification.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("parser_version_drift"),
      expect.stringContaining("export_without_review")
    ]));
    expect(brokenReport.counts.restrictedMetadataStages).toBeGreaterThan(0);
    expect(brokenReport.stages.find((stage) => stage.captureId === restrictedCapture.id && stage.stage === "raw_capture")?.redaction).toMatchObject({
      metadataOnly: true,
      restricted: true,
      rawBodyIncluded: false,
      objectKeyIncluded: false,
      unsafeUrlIncluded: false
    });
    const brokenSerialized = JSON.stringify(brokenReport);
    expect(brokenSerialized).not.toContain(restrictedRaw);
    expect(brokenSerialized).not.toContain(objectRaw);
    expect(brokenSerialized).not.toContain(objectCapture.objectRef?.key);
    expect(brokenSerialized).not.toContain(".onion");
    expect(brokenSerialized).not.toContain("PASSWORD_SHOULD_NOT_LEAK");
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
        retiredSourceClaims: [lowConfidence.incidentId]
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
    expect(claimLedger.certification.claimPromotion.staleExtractorReplayClaims).toEqual([]);
    expect(claimLedger.certification.claimPromotion.graphExportHeldRelationshipIds).toEqual(expect.arrayContaining([
      "rel_trust_low",
      "rel_trust_missing_object"
    ]));
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
