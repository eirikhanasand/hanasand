import { describe, expect, test } from "bun:test";
import {
  TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION,
  buildSourceProvenanceTiPageContract
} from "../product/sourceProvenanceTiPageContract.ts";

describe("source provenance TI page contract", () => {
  test("builds public TI page provenance payload from fresh source evidence", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      rows: [sourceRow(), {
        ...sourceRow(),
        sourceId: "src_actor_page",
        sourceName: "Actor profile",
        sourceFamily: "actor_page",
        captureId: "cap_actor_page_apt29",
        contentHash: "hash_actor_page_apt29",
        provenance: "Actor profile cites campaign and infrastructure observations.",
        confidence: 0.74,
        relationship: "infrastructure"
      }]
    });

    expect(contract).toMatchObject({
      schemaVersion: TI_SOURCE_PROVENANCE_PAGE_CONTRACT_SCHEMA_VERSION,
      ok: true,
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      page: {
        route: "/ti/APT29",
        customerVisible: true,
        redacted: true
      },
      summary: {
        sourceCount: 2,
        captureCount: 2,
        activeSourceCount: 2,
        sourceFamilies: ["telegram_public", "actor_page"],
        newestEvidenceAt: "2026-06-29T10:15:00.000Z",
        averageConfidence: 0.8
      },
      blockers: []
    });
    expect(contract.rows).toEqual([
      expect.objectContaining({
        sourceId: "src_telegram",
        captureId: "cap_telegram_apt29",
        contentHash: "hash_telegram_apt29",
        confidence: 0.86,
        ready: true,
        blockerCodes: []
      }),
      expect.objectContaining({
        sourceId: "src_actor_page",
        sourceFamily: "actor_page",
        relationship: "infrastructure",
        ready: true
      })
    ]);
    expect(contract.page.payloadShape).toEqual(expect.arrayContaining(["rows[].sourceId", "rows[].captureId", "rows[].contentHash", "blockers[]"]));
    expect(JSON.stringify(contract)).not.toContain("rawText");
    expect(JSON.stringify(contract)).not.toContain("password");
  });

  test("returns owner-coded blockers for incomplete stale or cross-org provenance", () => {
    const contract = buildSourceProvenanceTiPageContract({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      actor: "APT29",
      generatedAt: "2026-06-29T12:00:00.000Z",
      maxAgeDays: 30,
      rows: [{
        ...sourceRow(),
        sourceId: undefined,
        captureId: undefined,
        contentHash: undefined,
        provenance: undefined,
        capturedAt: "2025-01-01T00:00:00.000Z",
        sourceStatus: "paused"
      }, {
        ...sourceRow(),
        organizationId: "org_other",
        captureId: "cap_other_org",
        contentHash: "hash_other_org"
      }]
    });

    expect(contract.ok).toBe(false);
    expect(contract.rows[0]).toMatchObject({
      ready: false,
      blockerCodes: expect.arrayContaining([
        "missing_source_id",
        "missing_capture_id",
        "missing_content_hash",
        "missing_provenance",
        "inactive_source",
        "stale_evidence"
      ])
    });
    expect(contract.rows[1]).toMatchObject({
      ready: false,
      blockerCodes: ["organization_scope_mismatch"]
    });
    expect(contract.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing_source_id", ownerLane: "source", path: "rows[].sourceId" }),
      expect.objectContaining({ code: "stale_evidence", ownerLane: "source", path: "rows[].capturedAt" }),
      expect.objectContaining({ code: "organization_scope_mismatch", ownerLane: "publicTI", path: "rows[].organizationId" })
    ]));
  });
});

function sourceRow() {
  return {
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    actor: "APT29",
    sourceId: "src_telegram",
    sourceName: "Public Telegram channel",
    sourceFamily: "telegram_public",
    sourceStatus: "active",
    captureId: "cap_telegram_apt29",
    capturedAt: "2026-06-29T10:15:00.000Z",
    contentHash: "hash_telegram_apt29",
    provenance: "Public channel capture mentions APT29 infrastructure and phishing activity.",
    confidence: 0.86,
    route: "/ti/APT29",
    relationship: "actor_activity"
  };
}
