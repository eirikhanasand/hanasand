import { describe, expect, test } from "bun:test";
import {
  applyDwmSourcePackValidationResults,
  buildDwmSourcePackCollectionJobHandoff,
  buildDwmSourcePackPersistenceShape,
  buildDwmSourcePackWorkerIntegrationShape,
  DwmSourcePackPostgresAdapter,
  InMemoryDwmSourcePackActiveSourceAdapter,
  InMemoryDwmSourcePackRegistryAdapter,
  InMemoryDwmSourcePackValidationQueueAdapter,
  enqueueDwmSourcePackValidationJobs,
  persistDwmSourcePackSourceRecords,
  persistDwmSourcePackActiveSources,
  planDwmSourcePackBulkImport,
  planDwmSourcePackValidationBatch,
  runDwmSourcePackValidationJob,
  sourcePackHealthRollup,
  sourcePackWorkerReadinessCounters,
  sourcePackRecordFromPostgresRows,
  sourcePackRecordToPostgresRows,
  type DwmSourceCandidateValidationResult,
  type DwmSourcePackCandidateRecord,
  type DwmSourcePackPostgresRows,
  type DwmSourcePackRecord,
  type DwmSourcePackSqlDriver
} from "../storage/dwmSourcePackRegistry.ts";
import type { SourceRecord } from "../types.ts";
import { sourceRecordToPostgresRows } from "../storage/sourceRegistryPostgres.ts";

describe("dwm source pack registry adapter", () => {
  test("persists packs across adapter restarts and supports family search", () => {
    const adapter = new InMemoryDwmSourcePackRegistryAdapter();
    const saved = adapter.save(pack({
      id: "pack_adapter_mixed",
      label: "Adapter mixed pack",
      candidates: [
        candidate({ id: "cand_tg", declaredFamily: "telegram", decision: "queued_for_review", status: "queued" }),
        candidate({ id: "cand_onion", declaredFamily: "darkweb_onion", decision: "queued_for_review", status: "approval_required" })
      ]
    }));
    const restarted = new InMemoryDwmSourcePackRegistryAdapter([saved]);

    expect(restarted.get("pack_adapter_mixed")).toMatchObject({
      id: "pack_adapter_mixed",
      candidates: [
        { id: "cand_tg", targetRef: { rawStored: false } },
        { id: "cand_onion", declaredFamily: "darkweb_onion" }
      ]
    });
    expect(restarted.list({ family: "telegram" })).toMatchObject({ total: 1, items: [{ id: "pack_adapter_mixed" }] });
    expect(restarted.list({ family: "public_advisory" })).toMatchObject({ total: 0, items: [] });
  });

  test("filters by decision activation parser failure request label and created window", () => {
    const adapter = new InMemoryDwmSourcePackRegistryAdapter([
      pack({
        id: "pack_filter_1",
        label: "Telegram filter pack",
        requestId: "req_filter_1",
        requestedAt: "2026-06-01T00:00:00.000Z",
        candidates: [
          candidate({
            id: "cand_filter_1",
            declaredFamily: "telegram",
            decision: "approved",
            activationState: "active_canary",
            parserStatus: "telegram_public_parser_ready",
            status: "active"
          })
        ]
      }),
      pack({
        id: "pack_filter_2",
        label: "Failure filter pack",
        requestId: "req_filter_2",
        requestedAt: "2026-06-02T00:00:00.000Z",
        candidates: [
          candidate({
            id: "cand_filter_2",
            declaredFamily: "telegram",
            decision: "retry_scheduled",
            activationState: "candidate_review",
            parserStatus: "parser_retry_scheduled",
            status: "retry_scheduled",
            failure: { code: "parser_timeout", message: "parser timed out" }
          })
        ]
      })
    ]);

    expect(adapter.list({ decision: "approved" })).toMatchObject({ total: 1, items: [{ id: "pack_filter_1" }] });
    expect(adapter.list({ activationState: "active_canary" })).toMatchObject({ total: 1, items: [{ id: "pack_filter_1" }] });
    expect(adapter.list({ parserStatus: "parser_retry_scheduled" })).toMatchObject({ total: 1, items: [{ id: "pack_filter_2" }] });
    expect(adapter.list({ lastFailure: "parser_timeout" })).toMatchObject({ total: 1, items: [{ id: "pack_filter_2" }] });
    expect(adapter.list({ requestId: "req_filter_1" })).toMatchObject({ total: 1, items: [{ id: "pack_filter_1" }] });
    expect(adapter.list({ label: "Failure" })).toMatchObject({ total: 1, items: [{ id: "pack_filter_2" }] });
    expect(adapter.list({ createdFrom: "2026-06-02T00:00:00.000Z", createdTo: "2026-06-03T00:00:00.000Z" })).toMatchObject({ total: 1, items: [{ id: "pack_filter_2" }] });
  });

  test("paginates and upserts duplicate pack ids without duplicating the pack", () => {
    const adapter = new InMemoryDwmSourcePackRegistryAdapter([
      pack({ id: "pack_page_1", label: "Page 1", updatedAt: "2026-06-01T00:00:00.000Z" }),
      pack({ id: "pack_page_2", label: "Page 2", updatedAt: "2026-06-02T00:00:00.000Z" })
    ]);

    const first = adapter.list({ limit: 1 });
    expect(first).toMatchObject({ total: 2, nextCursor: "1", items: [{ id: "pack_page_2" }] });
    expect(adapter.list({ limit: 1, cursor: first.nextCursor })).toMatchObject({ total: 2, items: [{ id: "pack_page_1" }] });

    adapter.save(pack({
      id: "pack_page_1",
      label: "Page 1 updated",
      updatedAt: "2026-06-03T00:00:00.000Z",
      candidates: [candidate({ id: "cand_page_2", declaredFamily: "telegram" })]
    }));
    expect(adapter.list()).toMatchObject({
      total: 2,
      items: [
        { id: "pack_page_1", label: "Page 1 updated", candidates: [{ id: "cand_page_1" }, { id: "cand_page_2" }] },
        { id: "pack_page_2" }
      ]
    });
  });

  test("rejects unsafe raw target and payload fields", () => {
    const adapter = new InMemoryDwmSourcePackRegistryAdapter();
    expect(() => adapter.save(pack({
      id: "pack_unsafe_target",
      candidates: [{ ...candidate({ id: "cand_unsafe" }), target: "@raw_channel" } as unknown as DwmSourcePackCandidateRecord]
    }))).toThrow("raw target");
    expect(() => adapter.save(pack({
      id: "pack_unsafe_raw",
      candidates: [{ ...candidate({ id: "cand_unsafe_raw" }), rawText: "secret raw body" } as unknown as DwmSourcePackCandidateRecord]
    }))).toThrow("Unsafe source pack registry field");
    expect(() => adapter.save(pack({
      id: "pack_unsafe_stored",
      candidates: [{ ...candidate({ id: "cand_unsafe_stored" }), targetRef: { hash: "x", preview: "telegram:x", family: "telegram", rawStored: true } } as unknown as DwmSourcePackCandidateRecord]
    }))).toThrow("rawStored");
  });

  test("exposes table shape for durable implementation without starting collection", () => {
    expect(buildDwmSourcePackPersistenceShape()).toMatchObject({
      schemaVersion: "ti.dwm_source_pack_registry.v1",
      tables: {
        dwm_source_packs: expect.arrayContaining(["pack_id", "family_coverage_json", "health_rollup_json"]),
        dwm_source_pack_candidates: expect.arrayContaining(["target_hash", "target_raw_stored", "policy_boundary_json"])
      },
      indexes: expect.arrayContaining([
        "CREATE INDEX IF NOT EXISTS idx_dwm_source_pack_candidates_family ON dwm_source_pack_candidates(declared_family)",
        "CREATE INDEX IF NOT EXISTS idx_dwm_source_pack_candidates_failure ON dwm_source_pack_candidates((failure_json->>'code'))"
      ]),
      sql: {
        createPacksTable: expect.stringContaining("CREATE TABLE IF NOT EXISTS dwm_source_packs"),
        createCandidatesTable: expect.stringContaining("target_raw_stored BOOLEAN NOT NULL DEFAULT FALSE CHECK")
      },
      guardrails: expect.arrayContaining(["target_raw_stored must remain false"])
    });
  });

  test("maps source pack records to DB rows without raw payload columns", () => {
    const record = pack({
      id: "pack_rows",
      candidates: [
        candidate({ id: "cand_rows", declaredFamily: "telegram", failure: { code: "parser_timeout", message: "timed out" } })
      ]
    });
    const rows = sourcePackRecordToPostgresRows(record);

    expect(rows.packs[0]).toMatchObject({
      pack_id: "pack_rows",
      family_coverage_json: { telegram: { total: 1 } },
      safe_output_json: { rawUnsafeRowsStored: false }
    });
    expect(rows.candidates[0]).toMatchObject({
      candidate_id: "cand_rows",
      declared_family: "telegram",
      target_hash: "hash_cand_rows",
      target_raw_stored: false,
      failure_json: { code: "parser_timeout" }
    });
    expect(JSON.stringify(rows)).not.toContain("rawText");
    expect(JSON.stringify(rows)).not.toContain("rawPayload");
    expect(sourcePackRecordFromPostgresRows(rows)).toMatchObject({ id: "pack_rows", candidates: [{ id: "cand_rows" }] });
  });

  test("uses a DB-backed adapter contract through a fake SQL driver", () => {
    const driver = new FakeSourcePackSqlDriver();
    const adapter = new DwmSourcePackPostgresAdapter(driver);
    adapter.save(pack({
      id: "pack_db_driver",
      label: "DB Telegram driver pack",
      requestId: "req_db_driver",
      candidates: [
        candidate({ id: "cand_db_tg", declaredFamily: "telegram", decision: "approved", activationState: "active_canary", status: "active" }),
        candidate({ id: "cand_db_fail", declaredFamily: "telegram", decision: "retry_scheduled", parserStatus: "parser_retry_scheduled", failure: { code: "parser_timeout" } })
      ]
    }));

    expect(driver.upsertCount).toBe(1);
    expect(adapter.get("pack_db_driver")).toMatchObject({ id: "pack_db_driver", candidates: [{ id: "cand_db_tg" }, { id: "cand_db_fail" }] });
    expect(adapter.list({ family: "telegram", decision: "approved" })).toMatchObject({ total: 1, items: [{ id: "pack_db_driver" }] });
    expect(adapter.list({ parserStatus: "parser_retry_scheduled", lastFailure: "parser_timeout" })).toMatchObject({ total: 1, items: [{ id: "pack_db_driver" }] });
    expect(adapter.list({ requestId: "req_db_driver", label: "Telegram" })).toMatchObject({ total: 1, items: [{ id: "pack_db_driver" }] });
  });

  test("plans bulk imports with size chunks duplicate policy family caps and safe rejected rows", () => {
    const plan = planDwmSourcePackBulkImport([
      pack({ id: "pack_bulk_1", candidates: [candidate({ id: "cand_bulk_1", declaredFamily: "telegram" })] }),
      pack({ id: "pack_bulk_2", candidates: [candidate({ id: "cand_bulk_2", declaredFamily: "darkweb_onion" })] }),
      pack({ id: "pack_bulk_1", candidates: [candidate({ id: "cand_bulk_dup", declaredFamily: "telegram" })] }),
      pack({
        id: "pack_bulk_oversize",
        candidates: [
          candidate({ id: "cand_over_1", declaredFamily: "telegram" }),
          candidate({ id: "cand_over_2", declaredFamily: "telegram" }),
          candidate({ id: "cand_over_3", declaredFamily: "telegram" })
        ]
      }),
      pack({
        id: "pack_bulk_cap",
        candidates: [
          candidate({ id: "cand_cap_1", declaredFamily: "darkweb_onion" }),
          candidate({ id: "cand_cap_2", declaredFamily: "darkweb_onion" })
        ]
      })
    ], {
      maxPackSize: 2,
      chunkSize: 1,
      duplicatePackId: "reject",
      perFamilyCaps: { darkweb_onion: 1 }
    });

    expect(plan.summary).toMatchObject({
      requestedPackCount: 5,
      acceptedPackCount: 2,
      rejectedPackCount: 3,
      maxPackSize: 2,
      chunkSize: 1,
      duplicatePackIdBehavior: "reject"
    });
    expect(plan.chunks).toEqual([
      { cursor: "0", nextCursor: "1", packIds: ["pack_bulk_1"] },
      { cursor: "1", nextCursor: undefined, packIds: ["pack_bulk_2"] }
    ]);
    expect(plan.rejectedPacks.map((item) => item.reason)).toEqual([
      "duplicate pack id rejected by policy",
      "pack exceeds maxPackSize 2",
      "family cap exceeded for darkweb_onion: 2/1"
    ]);
    expect(plan.rejectedPacks.every((item) => item.safeCandidateRefs.every((ref) => ref.rawStored === false))).toBe(true);
    expect(JSON.stringify(plan)).not.toContain("@");
    expect(plan.safeOutput).toMatchObject({ rawUnsafeRowsStored: false, restrictedPayloadDownloadAllowed: false });
  });

  test("plans validation jobs with chunks backoff concurrency duplicate handling and safe rejected rows", () => {
    const validationPack = pack({
      id: "pack_validation_plan",
      candidates: [
        candidate({ id: "cand_validate_tg", declaredFamily: "telegram", targetRef: { hash: "target_shared", preview: "telegram:shared", family: "telegram", rawStored: false } }),
        candidate({ id: "cand_validate_onion", declaredFamily: "darkweb_onion" }),
        candidate({ id: "cand_validate_adv", declaredFamily: "public_advisory" }),
        candidate({ id: "cand_validate_dup", declaredFamily: "telegram", targetRef: { hash: "target_shared", preview: "telegram:duplicate", family: "telegram", rawStored: false } })
      ]
    });

    const plan = planDwmSourcePackValidationBatch([validationPack], {
      chunkSize: 2,
      maxAttempts: 3,
      backoffSeconds: 60,
      perFamilyConcurrency: { telegram: 4, darkweb_onion: 1 },
      generatedAt: "2026-06-28T12:00:00.000Z"
    });

    expect(plan.summary).toEqual({
      packCount: 1,
      candidateCount: 4,
      jobCount: 2,
      chunkSize: 2,
      duplicateCandidateCount: 1,
      perFamilyConcurrency: { telegram: 4, darkweb_onion: 1 }
    });
    expect(plan.jobs[0]).toMatchObject({
      id: "source_pack_validation_0",
      packIds: ["pack_validation_plan"],
      status: "queued",
      cursor: "0",
      nextCursor: "2",
      candidateIds: ["cand_validate_tg", "cand_validate_onion"],
      familyConcurrency: { telegram: 4, darkweb_onion: 1 },
      parserStatus: {
        cand_validate_tg: "queued_for_validation",
        cand_validate_onion: "queued_for_validation"
      },
      retry: { attempt: 0, maxAttempts: 3, backoffSeconds: 60 }
    });
    expect(plan.duplicateTargetRefs).toEqual([{ hash: "target_shared", candidateIds: ["cand_validate_tg", "cand_validate_dup"] }]);
    expect(plan.safeRejectedRows).toEqual([{
      candidateId: "cand_validate_dup",
      targetRef: { hash: "target_shared", preview: "telegram:duplicate", family: "telegram", rawStored: false },
      reason: "duplicate_target_ref"
    }]);
    expect(JSON.stringify(plan)).not.toContain("@raw");
    expect(plan.safeOutput).toMatchObject({ rawDuplicateTargetsStored: false, liveNetworkScrapeStarted: false });
  });

  test("exposes worker integration shape for DB-backed validation queues and active source rows", () => {
    expect(buildDwmSourcePackWorkerIntegrationShape()).toMatchObject({
      schemaVersion: "ti.dwm_source_pack_worker_integration.v1",
      tables: {
        dwm_source_pack_validation_jobs: expect.arrayContaining(["job_key", "pack_ids_json", "request_ids_json", "family_concurrency_json", "safe_rejected_rows_json"]),
        dwm_source_pack_active_source_rows: expect.arrayContaining(["source_id", "candidate_id", "target_raw_stored", "validation_job_key"])
      },
      indexes: expect.arrayContaining([
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_dwm_source_pack_validation_jobs_key ON dwm_source_pack_validation_jobs(job_key)"
      ]),
      guardrails: expect.arrayContaining(["job_key is the idempotency key and must be unique"]),
      safeOutput: { liveNetworkScrapeStarted: false }
    });
  });

  test("enqueues source pack validation jobs idempotently with worker controls and safe rejected rows", () => {
    const queue = new InMemoryDwmSourcePackValidationQueueAdapter();
    const sourcePack = pack({
      id: "pack_worker_queue",
      requestId: "req_worker_queue",
      candidates: [
        candidate({ id: "cand_worker_tg", declaredFamily: "telegram", targetRef: { hash: "worker_shared", preview: "telegram:worker", family: "telegram", rawStored: false } }),
        candidate({ id: "cand_worker_onion", declaredFamily: "darkweb_onion" }),
        candidate({ id: "cand_worker_dup", declaredFamily: "telegram", targetRef: { hash: "worker_shared", preview: "telegram:duplicate", family: "telegram", rawStored: false } })
      ]
    });
    const plan = planDwmSourcePackValidationBatch([sourcePack], {
      chunkSize: 3,
      perFamilyConcurrency: { telegram: 5, darkweb_onion: 1 },
      maxAttempts: 4,
      backoffSeconds: 90,
      generatedAt: "2026-06-28T12:00:00.000Z"
    });

    const first = enqueueDwmSourcePackValidationJobs(queue, [sourcePack], plan, { generatedAt: "2026-06-28T12:01:00.000Z" });
    const second = enqueueDwmSourcePackValidationJobs(queue, [sourcePack], plan, { generatedAt: "2026-06-28T12:02:00.000Z" });

    expect(first.summary).toMatchObject({ enqueuedCount: 1, duplicateCount: 0, jobCount: 1, candidateCount: 3, safeRejectedRowCount: 1 });
    expect(second.summary).toMatchObject({ enqueuedCount: 0, duplicateCount: 1, jobCount: 1 });
    expect(queue.list()).toHaveLength(1);
    expect(queue.list()[0]).toMatchObject({
      packIds: ["pack_worker_queue"],
      requestIds: ["req_worker_queue"],
      status: "queued",
      candidateIds: ["cand_worker_tg", "cand_worker_onion", "cand_worker_dup"],
      familyConcurrency: { telegram: 5, darkweb_onion: 1 },
      retry: { attempt: 0, maxAttempts: 4, backoffSeconds: 90 },
      safeRejectedRows: [{
        candidateId: "cand_worker_dup",
        targetRef: { rawStored: false },
        reason: "duplicate_target_ref"
      }]
    });
    expect(queue.list()[0].jobKey).toContain("pack_worker_queue:req_worker_queue:0");
    expect(JSON.stringify(queue.list())).not.toContain("@raw");
  });

  test("runs fake no-network validators across source families and validation states", () => {
    const validationPack = pack({
      id: "pack_validation_families",
      candidates: [
        candidate({ id: "cand_state_tg", declaredFamily: "telegram" }),
        candidate({ id: "cand_state_onion", declaredFamily: "darkweb_onion" }),
        candidate({ id: "cand_state_actor", declaredFamily: "actor_page" }),
        candidate({ id: "cand_state_advisory", declaredFamily: "public_advisory" }),
        candidate({ id: "cand_state_clear", declaredFamily: "clear_web" })
      ]
    });
    const plan = planDwmSourcePackValidationBatch([validationPack], {
      chunkSize: 5,
      generatedAt: "2026-06-28T12:00:00.000Z",
      backoffSeconds: 120
    });

    const run = runDwmSourcePackValidationJob(plan.jobs[0], validationPack, fakeValidator, {
      generatedAt: "2026-06-28T12:05:00.000Z"
    });

    expect(run.started.status).toBe("validating");
    expect(run.job.status).toBe("partially_active");
    expect(run.job.parserStatus).toMatchObject({
      cand_state_tg: "telegram_public_parser_ready",
      cand_state_onion: "metadata_parser_ready",
      cand_state_actor: "actor_page_parser_ready",
      cand_state_advisory: "parser_retry_scheduled",
      cand_state_clear: "clear_web_parser_disabled"
    });
    expect(run.job.lastFailure).toMatchObject({ candidateId: "cand_state_advisory", code: "parser_timeout" });
    expect(run.results.map((result) => result.state)).toEqual(["active", "active", "active", "retry_scheduled", "disabled"]);

    const allFailed = runDwmSourcePackValidationJob(plan.jobs[0], validationPack, (candidate) => ({
      candidateId: candidate.id,
      state: "failed",
      parserStatus: "parser_failed",
      failure: { code: "parser_failed", message: "fixture failure" }
    }), { generatedAt: "2026-06-28T12:06:00.000Z" });
    const allRetry = runDwmSourcePackValidationJob(plan.jobs[0], validationPack, (candidate) => ({
      candidateId: candidate.id,
      state: "retry_scheduled",
      parserStatus: "parser_retry_scheduled",
      failure: { code: "rate_limited", message: "fixture retry" }
    }), { generatedAt: "2026-06-28T12:07:00.000Z" });
    const allDisabled = runDwmSourcePackValidationJob(plan.jobs[0], validationPack, (candidate) => ({
      candidateId: candidate.id,
      state: "disabled",
      parserStatus: "parser_disabled"
    }), { generatedAt: "2026-06-28T12:08:00.000Z" });

    expect(allFailed.job.status).toBe("failed");
    expect(allRetry.job).toMatchObject({ status: "retry_scheduled", retry: { attempt: 1, retryAfter: expect.any(String) } });
    expect(allDisabled.job.status).toBe("disabled");
    expect(run.safeOutput).toMatchObject({ liveNetworkScrapeStarted: false, rawUnsafeRowsStored: false });
  });

  test("applies validation results into active source rows without live network collection", () => {
    const queue = new InMemoryDwmSourcePackValidationQueueAdapter();
    const sourcePack = pack({
      id: "pack_worker_activation",
      requestId: "req_worker_activation",
      candidates: [
        candidate({ id: "cand_activation_tg", declaredFamily: "telegram" }),
        candidate({ id: "cand_activation_onion", declaredFamily: "darkweb_metadata", policyBoundary: { metadataOnly: true, noPrivateAccess: true } }),
        candidate({ id: "cand_activation_retry", declaredFamily: "public_advisory" }),
        candidate({ id: "cand_activation_disabled", declaredFamily: "clear_web" })
      ]
    });
    const plan = planDwmSourcePackValidationBatch([sourcePack], { chunkSize: 4, generatedAt: "2026-06-28T12:00:00.000Z" });
    const receipt = enqueueDwmSourcePackValidationJobs(queue, [sourcePack], plan, { generatedAt: "2026-06-28T12:00:00.000Z" }).receipts[0];
    const run = runDwmSourcePackValidationJob(receipt.record.job, sourcePack, fakeValidator, {
      generatedAt: "2026-06-28T12:05:00.000Z"
    });
    queue.transition(receipt.jobKey, run.job.status, { job: run.job, updatedAt: "2026-06-28T12:05:00.000Z" });

    const activation = applyDwmSourcePackValidationResults(sourcePack, queue.get(receipt.jobKey)!, run.results, {
      generatedAt: "2026-06-28T12:06:00.000Z",
      actor: "source-pack-worker"
    });

    expect(activation.summary).toEqual({
      activeSourceCount: 2,
      blockedCandidateCount: 2,
      retryScheduledCount: 1,
      failedCount: 0,
      disabledCount: 1
    });
    expect(activation.activeSources).toMatchObject([
      {
        sourceId: "src_cand_activation_tg",
        candidateId: "cand_activation_tg",
        packId: "pack_worker_activation",
        requestId: "req_worker_activation",
        family: "telegram",
        targetRawStored: false,
        activationState: "active_canary",
        validationJobKey: receipt.jobKey,
        alertGradeEvidenceEligible: true
      },
      {
        sourceId: "src_cand_activation_onion",
        candidateId: "cand_activation_onion",
        family: "darkweb_metadata",
        targetRawStored: false,
        activationState: "metadata_only_active",
        alertGradeEvidenceEligible: true
      }
    ]);
    expect(activation.pack.candidates).toMatchObject([
      { id: "cand_activation_tg", status: "active", decision: "approved", activationState: "active_canary" },
      { id: "cand_activation_onion", status: "active", decision: "approved", activationState: "metadata_only_active" },
      { id: "cand_activation_retry", status: "retry_scheduled", decision: "retry_scheduled", failure: { code: "parser_timeout" } },
      { id: "cand_activation_disabled", status: "disabled", decision: "suppressed" }
    ]);
    expect(activation.safeOutput).toMatchObject({ liveNetworkScrapeStarted: false, rawUnsafeRowsStored: false });
    expect(JSON.stringify(activation)).not.toContain("rawPayload");
  });

  test("persists validated candidates and hands them to the scheduled collector", () => {
    const store = new FakeSourceStore();
    const queue = new InMemoryDwmSourcePackValidationQueueAdapter();
    const sourcePack = pack({
      id: "pack_durable_growth",
      requestId: "req_durable_growth",
      candidates: [
        candidate({
          id: "cand_durable_tg",
          declaredFamily: "telegram",
          targetRef: { hash: "hash_durable_tg", preview: "https://t.me/durable_public", family: "telegram", rawStored: false }
        }),
        candidate({
          id: "cand_durable_dark",
          declaredFamily: "darkweb_metadata",
          policyBoundary: { metadataOnly: true, noPrivateAccess: true, noPayloadDownload: true }
        }),
        candidate({
          id: "cand_durable_blocked",
          declaredFamily: "darkweb_onion",
          policyBoundary: { metadataOnly: false, noPrivateAccess: true }
        }),
        candidate({ id: "cand_durable_retry", declaredFamily: "public_advisory" })
      ]
    });
    const plan = planDwmSourcePackValidationBatch([sourcePack], {
      chunkSize: 4,
      maxAttempts: 4,
      backoffSeconds: 120,
      generatedAt: "2026-06-28T13:00:00.000Z"
    });
    const receipt = enqueueDwmSourcePackValidationJobs(queue, [sourcePack], plan, { generatedAt: "2026-06-28T13:00:00.000Z" }).receipts[0];
    const run = runDwmSourcePackValidationJob(receipt.record.job, sourcePack, durableGrowthValidator, {
      generatedAt: "2026-06-28T13:01:00.000Z"
    });
    queue.transition(receipt.jobKey, run.job.status, { job: run.job, updatedAt: "2026-06-28T13:01:00.000Z" });
    const activation = applyDwmSourcePackValidationResults(sourcePack, queue.get(receipt.jobKey)!, run.results, {
      generatedAt: "2026-06-28T13:02:00.000Z",
      actor: "source-pack-worker"
    });
    const sourceWrite = persistDwmSourcePackSourceRecords(store, activation.activeSources, {
      tenantId: "tenant_growth",
      generatedAt: "2026-06-28T13:03:00.000Z",
      approvedBy: "source-growth-worker"
    });
    const duplicateWrite = persistDwmSourcePackSourceRecords(store, activation.activeSources, {
      tenantId: "tenant_growth",
      generatedAt: "2026-06-28T13:04:00.000Z",
      approvedBy: "source-growth-worker"
    });
    const handoff = buildDwmSourcePackCollectionJobHandoff(activation.activeSources, { generatedAt: "2026-06-28T13:05:00.000Z" });

    expect(activation.summary).toEqual({
      activeSourceCount: 2,
      blockedCandidateCount: 2,
      retryScheduledCount: 1,
      failedCount: 1,
      disabledCount: 0
    });
    expect(activation.blockedCandidates).toEqual(expect.arrayContaining([
      { candidateId: "cand_durable_blocked", state: "failed", reason: "Restricted source candidate requires metadataOnly policy boundary before activation" },
      { candidateId: "cand_durable_retry", state: "retry_scheduled", reason: "fixture retry" }
    ]));
    expect(sourceWrite.summary).toEqual({
      insertedCount: 2,
      duplicateCount: 0,
      blockedCount: 0,
      sourceRecordCount: 2,
      collectionEligibleCount: 2
    });
    expect(duplicateWrite.summary).toMatchObject({ insertedCount: 0, duplicateCount: 2, sourceRecordCount: 2 });
    expect(store.listSources()).toMatchObject([
      {
        id: "src_cand_durable_tg",
        tenantId: "tenant_growth",
        type: "telegram_public",
        url: "https://t.me/durable_public",
        status: "active",
        governance: { metadataOnly: false, approvalState: "approved" },
        metadata: { sourcePack: { packId: "pack_durable_growth", validationScore: 0.93, targetRawStored: false } }
      },
      {
        id: "src_cand_durable_dark",
        tenantId: "tenant_growth",
        type: "tor_metadata",
        url: "source-pack://darkweb_metadata/hash_cand_durable_dark",
        status: "active",
        governance: { metadataOnly: true, approvalState: "approved" },
        metadata: { sourcePack: { collectionMode: "metadata_only", targetRawStored: false } }
      }
    ]);
    const darkRows = sourceRecordToPostgresRows(store.getSource("src_cand_durable_dark")!);
    expect(darkRows.sources[0]).toMatchObject({
      id: "src_cand_durable_dark",
      type: "tor_metadata",
      status: "active",
      metadata: { sourcePack: { packId: "pack_durable_growth", targetRawStored: false } }
    });
    expect(darkRows.source_governance[0]).toMatchObject({
      source_id: "src_cand_durable_dark",
      approval_state: "approved",
      metadata_only: true
    });
    expect(handoff.jobs).toMatchObject([
      {
        sourceId: "src_cand_durable_tg",
        status: "awaiting_scheduler",
        collectionMode: "bounded_public_preview",
        targetRawStored: false
      },
      {
        sourceId: "src_cand_durable_dark",
        status: "awaiting_scheduler",
        collectionMode: "metadata_only",
        targetRawStored: false
      }
    ]);
    expect(JSON.stringify({ sourceWrite, handoff })).not.toContain("rawPayload");
    expect(JSON.stringify({ sourceWrite, handoff })).not.toContain("password");
  });

  test("turns thousands-scale validated candidates into capped durable active rows and collection job handoffs", () => {
    const queue = new InMemoryDwmSourcePackValidationQueueAdapter();
    const activeSources = new InMemoryDwmSourcePackActiveSourceAdapter();
    const sourcePack = pack({
      id: "pack_worker_scale",
      requestId: "req_worker_scale",
      candidates: scaleCandidates(1000)
    });
    const plan = planDwmSourcePackValidationBatch([sourcePack], {
      chunkSize: 200,
      perFamilyConcurrency: { telegram: 25, darkweb_metadata: 8, darkweb_onion: 2, public_advisory: 5 },
      maxAttempts: 5,
      backoffSeconds: 180,
      generatedAt: "2026-06-28T12:00:00.000Z"
    });
    const queued = enqueueDwmSourcePackValidationJobs(queue, [sourcePack], plan, { generatedAt: "2026-06-28T12:01:00.000Z" });
    const activations = queued.receipts.map((receipt, index) => {
      const run = runDwmSourcePackValidationJob(receipt.record.job, sourcePack, scaleValidator, {
        generatedAt: `2026-06-28T12:${String(index + 2).padStart(2, "0")}:00.000Z`
      });
      queue.transition(receipt.jobKey, run.job.status, { job: run.job, updatedAt: "2026-06-28T12:10:00.000Z" });
      return applyDwmSourcePackValidationResults(sourcePack, queue.get(receipt.jobKey)!, run.results, {
        generatedAt: "2026-06-28T12:11:00.000Z",
        actor: "source-pack-worker"
      });
    });
    const mergedActivation = {
      ...activations[0],
      activeSources: activations.flatMap((activation) => activation.activeSources),
      blockedCandidates: activations.flatMap((activation) => activation.blockedCandidates),
      summary: {
        activeSourceCount: activations.reduce((total, activation) => total + activation.summary.activeSourceCount, 0),
        blockedCandidateCount: activations.reduce((total, activation) => total + activation.summary.blockedCandidateCount, 0),
        retryScheduledCount: activations.reduce((total, activation) => total + activation.summary.retryScheduledCount, 0),
        failedCount: activations.reduce((total, activation) => total + activation.summary.failedCount, 0),
        disabledCount: activations.reduce((total, activation) => total + activation.summary.disabledCount, 0)
      }
    };

    const persisted = persistDwmSourcePackActiveSources(activeSources, mergedActivation, {
      perFamilyCaps: { telegram: 400, darkweb_metadata: 200 }
    });
    const repeated = persistDwmSourcePackActiveSources(activeSources, mergedActivation, {
      perFamilyCaps: { telegram: 400, darkweb_metadata: 200 }
    });
    const handoff = buildDwmSourcePackCollectionJobHandoff(activeSources.list(), { generatedAt: "2026-06-28T12:12:00.000Z" });
    const counters = sourcePackWorkerReadinessCounters(activations.map((activation) => activation.pack), queue.list(), activeSources.list());

    expect(plan.summary).toMatchObject({ packCount: 1, candidateCount: 1000, jobCount: 5, chunkSize: 200 });
    expect(queued.summary).toMatchObject({ enqueuedCount: 5, duplicateCount: 0, jobCount: 5, candidateCount: 1000, safeRejectedRowCount: 1 });
    expect(queue.list().every((record) => record.familyConcurrency.telegram === 25 && record.retry.maxAttempts === 5)).toBe(true);
    expect(mergedActivation.summary).toEqual({
      activeSourceCount: 750,
      blockedCandidateCount: 250,
      retryScheduledCount: 100,
      failedCount: 50,
      disabledCount: 100
    });
    expect(persisted.summary).toEqual({
      insertedCount: 600,
      duplicateCount: 0,
      skippedCount: 150,
      activeSourceCount: 600,
      collectionReadyCount: 600
    });
    expect(repeated.summary).toMatchObject({ insertedCount: 0, duplicateCount: 600, skippedCount: 150, activeSourceCount: 600 });
    expect(handoff.jobs).toHaveLength(600);
    expect(handoff.jobs[0]).toMatchObject({
      status: "awaiting_scheduler",
      targetRawStored: false,
      retry: { maxAttempts: 5, backoffSeconds: 180 },
      validationScore: expect.any(Number)
    });
    expect(new Set(handoff.jobs.map((job) => job.collectionMode))).toEqual(new Set(["bounded_public_preview", "metadata_only"]));
    expect(counters).toMatchObject({
      queuedValidationJobs: 0,
      activeSourceRows: 600,
      collectionReadyRows: 600,
      safeRejectedRows: 1,
      byFamily: {
        telegram: { active: 400, collectionReady: 400 },
        darkweb_metadata: { active: 200, collectionReady: 200 },
        public_advisory: { retryScheduled: 100 },
        clear_web: { blocked: 100 }
      }
    });
    expect(JSON.stringify({ queued, persisted, handoff })).not.toContain("rawPayload");
    expect(JSON.stringify({ queued, persisted, handoff })).not.toContain("@raw");
  });

  test("computes source health rollups for stale parser failures activation lag and retry windows", () => {
    const rollup = sourcePackHealthRollup(pack({
      id: "pack_health_rollup",
      candidates: [
        candidate({
          id: "cand_health_active",
          declaredFamily: "telegram",
          decision: "approved",
          activationState: "active_canary",
          status: "active",
          lastTestOutcome: { captureAt: "2026-06-20T12:00:00.000Z" }
        }),
        candidate({
          id: "cand_health_pending",
          declaredFamily: "telegram",
          decision: "queued_for_review",
          status: "queued",
          requestedAt: "2026-06-27T12:00:00.000Z"
        }),
        candidate({
          id: "cand_health_failed",
          declaredFamily: "telegram",
          decision: "retry_scheduled",
          status: "retry_scheduled",
          parserStatus: "parser_retry_scheduled",
          failure: { code: "parser_timeout", message: "timed out" },
          retryHint: "retry after 2026-06-28T13:00:00.000Z"
        }),
        candidate({
          id: "cand_health_disabled",
          declaredFamily: "telegram",
          decision: "suppressed",
          status: "disabled"
        })
      ]
    }), {
      generatedAt: "2026-06-28T12:00:00.000Z",
      staleAfterSeconds: 3600
    });

    expect(rollup.coverage.telegram).toEqual({ total: 4, active: 1, pending: 1, failed: 1, disabled: 1 });
    expect(rollup.staleSources).toEqual([{
      candidateId: "cand_health_active",
      lastCaptureAt: "2026-06-20T12:00:00.000Z",
      staleSeconds: 691200
    }]);
    expect(rollup.parserFailures).toEqual([{
      candidateId: "cand_health_failed",
      parserStatus: "parser_retry_scheduled",
      failure: { code: "parser_timeout", message: "timed out" }
    }]);
    expect(rollup.activationLag).toEqual([{
      candidateId: "cand_health_pending",
      requestedAt: "2026-06-27T12:00:00.000Z",
      pendingSeconds: 86400,
      status: "queued"
    }]);
    expect(rollup.nextRetryWindows).toEqual([{
      candidateId: "cand_health_failed",
      retryAfter: "2026-06-28T13:00:00.000Z",
      retryHint: "retry after 2026-06-28T13:00:00.000Z",
      failure: { code: "parser_timeout", message: "timed out" }
    }]);
  });
});

class FakeSourcePackSqlDriver implements DwmSourcePackSqlDriver {
  readonly rows = new Map<string, DwmSourcePackPostgresRows>();
  upsertCount = 0;

  upsertPack(rows: DwmSourcePackPostgresRows): void {
    this.upsertCount += 1;
    const packId = rows.packs[0].pack_id;
    this.rows.set(packId, rows);
  }

  getPack(packId: string): DwmSourcePackPostgresRows | undefined {
    return this.rows.get(packId);
  }

  listPacks(query = {}) {
    const adapter = new InMemoryDwmSourcePackRegistryAdapter([...this.rows.values()].map(sourcePackRecordFromPostgresRows));
    const result = adapter.list(query);
    return { rows: result.items.map(sourcePackRecordToPostgresRows), total: result.total, nextCursor: result.nextCursor };
  }
}

class FakeSourceStore {
  readonly sources = new Map<string, SourceRecord>();

  saveSource(source: SourceRecord): SourceRecord {
    this.sources.set(source.id, source);
    return source;
  }

  getSource(id: string): SourceRecord | undefined {
    return this.sources.get(id);
  }

  listSources(): SourceRecord[] {
    return [...this.sources.values()];
  }
}

function fakeValidator(candidate: DwmSourcePackCandidateRecord): DwmSourceCandidateValidationResult {
  if (candidate.declaredFamily === "telegram") {
    return { candidateId: candidate.id, state: "active", parserStatus: "telegram_public_parser_ready" };
  }
  if (candidate.declaredFamily === "darkweb_onion" || candidate.declaredFamily === "darkweb_metadata") {
    return { candidateId: candidate.id, state: "active", parserStatus: "metadata_parser_ready" };
  }
  if (candidate.declaredFamily === "actor_page") {
    return { candidateId: candidate.id, state: "active", parserStatus: "actor_page_parser_ready" };
  }
  if (candidate.declaredFamily === "public_advisory") {
    return {
      candidateId: candidate.id,
      state: "retry_scheduled",
      parserStatus: "parser_retry_scheduled",
      failure: { code: "parser_timeout", message: "advisory parser timed out" }
    };
  }
  return { candidateId: candidate.id, state: "disabled", parserStatus: "clear_web_parser_disabled" };
}

function durableGrowthValidator(candidate: DwmSourcePackCandidateRecord): DwmSourceCandidateValidationResult {
  if (candidate.id === "cand_durable_tg") {
    return { candidateId: candidate.id, state: "active", parserStatus: "telegram_public_parser_ready", validationScore: 0.93 };
  }
  if (candidate.id === "cand_durable_dark" || candidate.id === "cand_durable_blocked") {
    return { candidateId: candidate.id, state: "active", parserStatus: "metadata_parser_ready", validationScore: 0.87 };
  }
  return {
    candidateId: candidate.id,
    state: "retry_scheduled",
    parserStatus: "parser_retry_scheduled",
    validationScore: 0.41,
    failure: { code: "parser_timeout", message: "fixture retry" }
  };
}

function scaleValidator(candidate: DwmSourcePackCandidateRecord): DwmSourceCandidateValidationResult {
  if (candidate.declaredFamily === "telegram") {
    return { candidateId: candidate.id, state: "active", parserStatus: "telegram_public_parser_ready", validationScore: 0.94 };
  }
  if (candidate.declaredFamily === "darkweb_metadata" || candidate.declaredFamily === "darkweb_onion") {
    return { candidateId: candidate.id, state: "active", parserStatus: "metadata_parser_ready", validationScore: 0.88 };
  }
  if (candidate.declaredFamily === "public_advisory") {
    return {
      candidateId: candidate.id,
      state: "retry_scheduled",
      parserStatus: "parser_retry_scheduled",
      validationScore: 0.42,
      failure: { code: "parser_timeout", message: "fixture parser timeout" }
    };
  }
  return { candidateId: candidate.id, state: "disabled", parserStatus: "parser_disabled", validationScore: 0.1 };
}

function scaleCandidates(count: number): DwmSourcePackCandidateRecord[] {
  return Array.from({ length: count }, (_, index) => {
    if (index < 500) return candidate({
      id: `cand_scale_tg_${index}`,
      declaredFamily: "telegram",
      index,
      targetRef: {
        hash: index === 499 ? "scale_duplicate_hash" : `hash_scale_tg_${index}`,
        preview: `telegram:scale:${index}`,
        family: "telegram",
        rawStored: false
      }
    });
    if (index < 750) return candidate({
      id: `cand_scale_darkweb_${index}`,
      declaredFamily: "darkweb_metadata",
      index,
      policyBoundary: { metadataOnly: true, noPrivateAccess: true, noPayloadDownload: true }
    });
    if (index < 800) return candidate({
      id: `cand_scale_onion_blocked_${index}`,
      declaredFamily: "darkweb_onion",
      index,
      policyBoundary: { metadataOnly: false, noPrivateAccess: true }
    });
    if (index < 900) return candidate({ id: `cand_scale_advisory_${index}`, declaredFamily: "public_advisory", index });
    return candidate({
      id: `cand_scale_clear_${index}`,
      declaredFamily: "clear_web",
      index,
      targetRef: {
        hash: index === 999 ? "scale_duplicate_hash" : `hash_scale_clear_${index}`,
        preview: `clear_web:scale:${index}`,
        family: "clear_web",
        rawStored: false
      }
    });
  });
}

function pack(input: Partial<DwmSourcePackRecord> = {}): DwmSourcePackRecord {
  const requestedAt = input.requestedAt ?? "2026-06-01T00:00:00.000Z";
  return {
    id: input.id ?? "pack_test",
    label: input.label ?? "Test source pack",
    tenantId: input.tenantId ?? "tenant_acme",
    scope: input.scope ?? "APT29",
    requestedBy: input.requestedBy ?? "source-growth-worker",
    requestedAt,
    updatedAt: input.updatedAt ?? requestedAt,
    requestId: input.requestId ?? `req_${input.id ?? "pack_test"}`,
    familyCoverage: input.familyCoverage ?? { telegram: { total: 1 } },
    healthRollup: input.healthRollup ?? { queuedForCollectionCount: 0 },
    safeOutput: input.safeOutput ?? {
      rawUnsafeRowsStored: false,
      rawRejectedTargetsStored: false,
      rawDuplicateTargetsStored: false,
      liveNetworkScrapeStarted: false,
      restrictedPayloadDownloadAllowed: false
    },
    candidates: input.candidates ?? [candidate({ id: input.id === "pack_page_1" ? "cand_page_1" : "cand_test" })],
    audit: input.audit ?? [{ at: requestedAt, action: "pack_intake", actor: "source-growth-worker" }]
  };
}

function candidate(input: Partial<DwmSourcePackCandidateRecord> = {}): DwmSourcePackCandidateRecord {
  const declaredFamily = input.declaredFamily ?? "telegram";
  return {
    id: input.id ?? "cand_test",
    sourceId: input.sourceId,
    family: input.family ?? (declaredFamily === "telegram" ? "telegram_public" : "darkweb_metadata"),
    declaredFamily,
    type: input.type ?? (declaredFamily === "telegram" ? "telegram_channel" : "restricted_metadata"),
    refLabel: input.refLabel,
    parserExpectation: input.parserExpectation ?? (declaredFamily === "telegram" ? "telegram_public_metadata_and_text_fixture" : "restricted_onion_metadata_fixture"),
    index: input.index ?? 0,
    targetRef: input.targetRef ?? { hash: `hash_${input.id ?? "cand_test"}`, preview: `${declaredFamily}:hash`, family: declaredFamily, rawStored: false },
    requestedBy: input.requestedBy ?? "source-growth-worker",
    requestedAt: input.requestedAt ?? "2026-06-01T00:00:00.000Z",
    status: input.status ?? "queued",
    intakeStatus: input.intakeStatus ?? "accepted",
    decision: input.decision ?? "queued_for_review",
    activationState: input.activationState ?? "candidate_review",
    parserStatus: input.parserStatus ?? "telegram_public_parser_ready",
    healthStatus: input.healthStatus ?? "not_tested",
    failure: input.failure,
    policyBoundary: input.policyBoundary ?? { publicOnly: true, noPrivateAccess: true },
    validationResult: input.validationResult ?? { allowed: true },
    lastTestOutcome: input.lastTestOutcome,
    retryHint: input.retryHint
  };
}
