import { describe, expect, test } from "bun:test";
import {
  PRODUCT_READINESS_CONSUMER_PROOF_METADATA_GUARD_SCHEMA_VERSION,
  PRODUCT_READINESS_CONSUMER_VERIFICATION_GUARD_SCHEMA_VERSION,
  PRODUCT_READINESS_CONSUMER_VERIFICATION_LEDGER_SCHEMA_VERSION,
  PRODUCT_READINESS_INTEGRATION_GATE_FIXTURE_SCHEMA_VERSION,
  PRODUCT_READINESS_SCHEMA_LOOKUP_METADATA_GUARD_SCHEMA_VERSION,
  buildProductReadinessConsumerVerificationLedger,
  buildProductReadinessIntegrationGateFixture,
  buildProductReadinessIntegrationGateFixtures,
  productReadinessConsumerProofMetadataGuard,
  productReadinessConsumerVerificationGuard,
  productReadinessSchemaLookupMetadataGuard
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
    expect(fixture.schemaLookupMetadata).toMatchObject({
      schemaVersion: PRODUCT_READINESS_SCHEMA_LOOKUP_METADATA_GUARD_SCHEMA_VERSION,
      ok: true,
      blockerCodes: []
    });
    expect(fixture.consumerVerification).toMatchObject({
      schemaVersion: PRODUCT_READINESS_CONSUMER_VERIFICATION_GUARD_SCHEMA_VERSION,
      ok: true,
      blockerCodes: [],
      proofCommand: expect.stringContaining("check:product-readiness-contracts")
    });
    expect(fixture.coverage.failingRows).toEqual([]);
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
    expect(byKind.get("malformed_schema_lookup_metadata")).toMatchObject({
      passed: true,
      gate: { ok: true, decision: "pass" },
      expectedBlockerCodes: [
        "missing_schema_lookup_route",
        "missing_schema_lookup_scope_fields",
        "missing_schema_lookup_blocker_codes",
        "missing_schema_lookup_consumer_route",
        "missing_schema_lookup_consumer_required_fields",
        "unsafe_schema_lookup_row"
      ],
      actualBlockerCodes: expect.arrayContaining([
        "missing_schema_lookup_route",
        "missing_schema_lookup_scope_fields",
        "missing_schema_lookup_blocker_codes",
        "missing_schema_lookup_consumer_route",
        "missing_schema_lookup_consumer_required_fields",
        "unsafe_schema_lookup_row"
      ]),
      schemaLookupMetadata: {
        ok: false,
        rows: expect.arrayContaining([
          expect.objectContaining({
            contractId: "product_readiness_receipt_matrix",
            ok: false,
            unsafeFields: ["safeOutput.rawEvidenceExposed"]
          })
        ])
      }
    });
    expect(byKind.get("missing_customer_workflow")).toMatchObject({
      passed: true,
      gate: { ok: false, decision: "hold" },
      expectedBlockerCodes: ["missing_customer_workflow_ids", "missing_customer_workflow"],
      actualBlockerCodes: expect.arrayContaining(["missing_customer_workflow_ids", "missing_customer_workflow"]),
      coverage: {
        failingRows: expect.arrayContaining([
          expect.objectContaining({
            capabilityId: "source_activation",
            missingCustomerWorkflowIds: ["customerWorkflowIds"],
            blockerCodes: expect.arrayContaining(["missing_customer_workflow_ids"])
          })
        ])
      }
    });
    expect(byKind.get("missing_consumer_verification")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["missing_consumer_verification"],
      actualBlockerCodes: expect.arrayContaining(["missing_consumer_verification"]),
      consumerVerification: {
        ok: false,
        rows: expect.arrayContaining([
          expect.objectContaining({
            capabilityId: "source_activation",
            consumerVerificationCount: 0,
            blockerCodes: expect.arrayContaining(["missing_consumer_verification"])
          })
        ])
      }
    });
    expect(byKind.get("stale_consumer_verification")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["stale_consumer_verification"],
      actualBlockerCodes: expect.arrayContaining(["stale_consumer_verification"]),
      consumerVerification: {
        ok: false,
        rows: expect.arrayContaining([
          expect.objectContaining({
            capabilityId: "source_activation",
            blockerCodes: expect.arrayContaining(["stale_consumer_verification"])
          })
        ])
      }
    });
    expect(byKind.get("missing_consumer_proof_command")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["missing_consumer_proof_command"],
      actualBlockerCodes: expect.arrayContaining(["missing_consumer_proof_command"])
    });
    expect(byKind.get("prompt_literal_consumer_copy")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["consumer_copy_guard_control_room", "consumer_copy_guard_signal"],
      actualBlockerCodes: expect.arrayContaining(["consumer_copy_guard_control_room", "consumer_copy_guard_signal"])
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

  test("validates schema lookup metadata for contract consumers", () => {
    const contract = JSON.parse(JSON.stringify(contractIndex())) as ReturnType<typeof contractIndex>;
    const guard = productReadinessSchemaLookupMetadataGuard(contract);

    expect(guard).toMatchObject({
      schemaVersion: PRODUCT_READINESS_SCHEMA_LOOKUP_METADATA_GUARD_SCHEMA_VERSION,
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
    const row = broken.schemaLookup.rows.find((item) => item.contractId === "source_provenance_receipts");
    if (!row) throw new Error("source provenance schema lookup row missing from readiness fixture");
    row.schemaId = "";
    row.contractId = "";
    row.ownerLane = "" as any;
    row.route = "source/no-leading-slash";
    row.scopeFields = [];
    row.blockerCodes = [];
    row.downstreamConsumers = [{ ownerLane: "", route: "", requiredFields: [] }];
    row.safeOutput = { ...row.safeOutput, crossOrgDataExposed: true };

    const brokenGuard = productReadinessSchemaLookupMetadataGuard(broken);

    expect(brokenGuard).toMatchObject({
      ok: false,
      blockerCodes: expect.arrayContaining([
        "missing_schema_lookup_schema_id",
        "missing_schema_lookup_contract_id",
        "missing_schema_lookup_owner_lane",
        "missing_schema_lookup_route",
        "missing_schema_lookup_scope_fields",
        "missing_schema_lookup_blocker_codes",
        "missing_schema_lookup_consumer_owner",
        "missing_schema_lookup_consumer_route",
        "missing_schema_lookup_consumer_required_fields",
        "unsafe_schema_lookup_row"
      ])
    });
  });

  test("validates consumer verification ledger for integration acceptance", () => {
    const contract = JSON.parse(JSON.stringify(contractIndex())) as ReturnType<typeof contractIndex>;
    const ledger = buildProductReadinessConsumerVerificationLedger(contract);
    const guard = productReadinessConsumerVerificationGuard(ledger);

    expect(ledger).toMatchObject({
      schemaVersion: PRODUCT_READINESS_CONSUMER_VERIFICATION_LEDGER_SCHEMA_VERSION,
      route: "/v1/contracts",
      proofCommand: expect.stringContaining("check:product-readiness-contracts"),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(guard).toMatchObject({
      schemaVersion: PRODUCT_READINESS_CONSUMER_VERIFICATION_GUARD_SCHEMA_VERSION,
      route: "/v1/contracts",
      ok: true,
      blockerCodes: [],
      proofCommand: expect.stringContaining("check:product-readiness-contracts"),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });

    const broken = JSON.parse(JSON.stringify(ledger)) as typeof ledger;
    const row = broken.rows.find((item) => item.capabilityId === "webhook_delivery");
    if (!row) throw new Error("webhook_delivery row missing from consumer verification ledger");
    const verification = row.consumerVerifications[0];
    verification.verifiedAt = "2026-06-01T00:00:00.000Z";
    verification.proofCommand = "";
    verification.consumerLabel = "named examples signal";

    const brokenGuard = productReadinessConsumerVerificationGuard(broken);

    expect(brokenGuard).toMatchObject({
      ok: false,
      blockerCodes: expect.arrayContaining([
        "stale_consumer_verification",
        "missing_consumer_proof_command",
        "consumer_copy_guard_named_examples",
        "consumer_copy_guard_signal"
      ])
    });
  });
});
