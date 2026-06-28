import { describe, expect, test } from "bun:test";
import {
  buildDwmSourcePackPersistenceShape,
  DwmSourcePackPostgresAdapter,
  InMemoryDwmSourcePackRegistryAdapter,
  planDwmSourcePackBulkImport,
  sourcePackRecordFromPostgresRows,
  sourcePackRecordToPostgresRows,
  type DwmSourcePackCandidateRecord,
  type DwmSourcePackPostgresRows,
  type DwmSourcePackRecord,
  type DwmSourcePackSqlDriver
} from "../storage/dwmSourcePackRegistry.ts";

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
    retryHint: input.retryHint
  };
}
