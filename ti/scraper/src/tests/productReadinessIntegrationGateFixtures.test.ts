import { describe, expect, test } from "bun:test";
import {
  PRODUCT_READINESS_CONSUMER_PROOF_METADATA_GUARD_SCHEMA_VERSION,
  PRODUCT_READINESS_INTEGRATION_GATE_FIXTURE_SCHEMA_VERSION,
  buildProductReadinessIntegrationGateFixture,
  buildProductReadinessIntegrationGateFixtures,
  productReadinessConsumerProofMetadataGuard
} from "../product/productReadinessIntegrationGateFixtures.ts";
import { contractIndex } from "../api/contractsRoute.ts";

describe("product readiness integration gate fixtures", () => {
  test("keeps the valid readiness contract passing", () => {
    const fixture = buildProductReadinessIntegrationGateFixture("valid");

    expect(fixture).toMatchObject({
      schemaVersion: PRODUCT_READINESS_INTEGRATION_GATE_FIXTURE_SCHEMA_VERSION,
      kind: "valid",
      passed: true,
      expectedBlockerCodes: [],
      gate: {
        ok: true,
        decision: "pass",
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false,
          crossOrgDataExposed: false
        }
      }
    });
    expect(fixture.coverage.failingRows).toEqual([]);
    expect(fixture.copyGuard.violationCount).toBe(0);
    expect(fixture.consumerProofMetadata).toMatchObject({
      schemaVersion: PRODUCT_READINESS_CONSUMER_PROOF_METADATA_GUARD_SCHEMA_VERSION,
      ok: true,
      blockerCodes: []
    });
  });

  test("fails clear canaries for missing, stale, malformed, unsafe, and prompt-literal readiness", () => {
    const fixtures = buildProductReadinessIntegrationGateFixtures();
    const byKind = new Map(fixtures.map((fixture) => [fixture.kind, fixture]));

    expect(byKind.get("missing_required_receipt")).toMatchObject({
      passed: true,
      gate: { ok: false, decision: "hold" },
      expectedBlockerCodes: ["missing_required_receipt_schema"],
      actualBlockerCodes: expect.arrayContaining(["missing_required_receipt_schema"]),
      coverage: {
        failingRows: expect.arrayContaining([
          expect.objectContaining({
            capabilityId: "source_activation",
            blockerCodes: expect.arrayContaining(["missing_required_receipt_schema"])
          })
        ])
      }
    });
    expect(byKind.get("stale_receipt_reference")).toMatchObject({
      passed: true,
      gate: { ok: false, decision: "hold" },
      expectedBlockerCodes: ["stale_receipt_schema_reference"],
      actualBlockerCodes: expect.arrayContaining(["stale_receipt_schema_reference"]),
      coverage: {
        failingRows: expect.arrayContaining([
          expect.objectContaining({
            capabilityId: "webhook_delivery",
            unindexedReceiptSchemaIds: ["hanasand.fixture_stale_webhook_receipt.v1"]
          })
        ])
      }
    });
    expect(byKind.get("missing_schema_lookup")).toMatchObject({
      passed: true,
      gate: { ok: false, decision: "hold" },
      expectedBlockerCodes: ["missing_matrix_schema_lookup"],
      actualBlockerCodes: expect.arrayContaining(["missing_matrix_schema_lookup"])
    });
    expect(byKind.get("prompt_literal_copy")).toMatchObject({
      passed: true,
      gate: { ok: false, decision: "hold" },
      expectedBlockerCodes: ["copy_guard_dashboard_slop"],
      actualBlockerCodes: expect.arrayContaining(["copy_guard_dashboard_slop"]),
      copyGuard: {
        violationCount: 1,
        violations: expect.arrayContaining([
          expect.objectContaining({
            source: "productReadinessReceiptMatrix",
            capabilityId: "website_product_surface",
            term: "dashboard slop"
          })
        ])
      }
    });
    expect(byKind.get("unsafe_receipt_output")).toMatchObject({
      passed: true,
      gate: { ok: false, decision: "hold" },
      expectedBlockerCodes: ["unsafe_receipt_matrix_row"],
      actualBlockerCodes: expect.arrayContaining(["unsafe_receipt_matrix_row"]),
      coverage: {
        failingRows: expect.arrayContaining([
          expect.objectContaining({
            capabilityId: "alert_case_workflow",
            unsafeFields: ["safeOutput.rawEvidenceExposed"]
          })
        ])
      }
    });
    expect(byKind.get("malformed_consumer_proof_metadata")).toMatchObject({
      passed: true,
      gate: { ok: true, decision: "pass" },
      expectedBlockerCodes: ["missing_consumer_route", "missing_consumer_required_fields", "downstream_owner_mismatch"],
      actualBlockerCodes: expect.arrayContaining([
        "missing_consumer_route",
        "missing_consumer_required_fields",
        "downstream_owner_mismatch"
      ]),
      consumerProofMetadata: {
        ok: false,
        blockerCodes: expect.arrayContaining([
          "missing_consumer_route",
          "missing_consumer_required_fields",
          "downstream_owner_mismatch"
        ]),
        rows: expect.arrayContaining([
          expect.objectContaining({
            capabilityId: "shared_watchlists",
            ok: false,
            downstreamConsumerCount: 1,
            consumerProofs: [expect.objectContaining({
              ownerLane: "alert",
              route: "",
              requiredFieldCount: 0
            })]
          })
        ])
      }
    });
  });

  test("keeps fixture output metadata-only for integration logs", () => {
    const serialized = JSON.stringify(buildProductReadinessIntegrationGateFixtures());

    expect(serialized).not.toContain("https://discord.com");
    expect(serialized).not.toContain("authorization:");
    expect(serialized).not.toContain("webhookUrl");
    expect(serialized).not.toContain("rawText");
    expect(serialized).not.toContain("password");
  });

  test("validates downstream consumer proof metadata without route internals", () => {
    const contract = JSON.parse(JSON.stringify(contractIndex())) as ReturnType<typeof contractIndex>;
    const guard = productReadinessConsumerProofMetadataGuard(contract);

    expect(guard).toMatchObject({
      schemaVersion: PRODUCT_READINESS_CONSUMER_PROOF_METADATA_GUARD_SCHEMA_VERSION,
      route: "/v1/contracts",
      ok: true,
      blockerCodes: [],
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });

    const broken = JSON.parse(JSON.stringify(contract)) as ReturnType<typeof contractIndex>;
    const row = broken.productReadinessReceiptMatrix.rows.find((item) => item.capabilityId === "dashboard_operator_workspace");
    if (!row) throw new Error("dashboard_operator_workspace row missing from readiness fixture");
    row.downstreamConsumers = [{ ownerLane: "", route: "dashboard/no-leading-slash", requiredFields: [] }];
    row.downstreamOwners = ["dashboard", "case"];

    const brokenGuard = productReadinessConsumerProofMetadataGuard(broken);

    expect(brokenGuard).toMatchObject({
      ok: false,
      blockerCodes: expect.arrayContaining([
        "missing_consumer_owner",
        "missing_consumer_route",
        "missing_consumer_required_fields",
        "downstream_owner_mismatch"
      ]),
      rows: expect.arrayContaining([
        expect.objectContaining({
          capabilityId: "dashboard_operator_workspace",
          ok: false,
          blockerCodes: expect.arrayContaining([
            "missing_consumer_owner",
            "missing_consumer_route",
            "missing_consumer_required_fields",
            "downstream_owner_mismatch"
          ])
        })
      ])
    });
  });
});
