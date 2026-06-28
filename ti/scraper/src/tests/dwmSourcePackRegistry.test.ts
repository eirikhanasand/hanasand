import { describe, expect, test } from "bun:test";
import {
  buildDwmSourcePackPersistenceShape,
  InMemoryDwmSourcePackRegistryAdapter,
  type DwmSourcePackCandidateRecord,
  type DwmSourcePackRecord
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
      guardrails: expect.arrayContaining(["target_raw_stored must remain false"])
    });
  });
});

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
