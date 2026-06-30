import { describe, expect, test } from "bun:test";
import {
  PRODUCT_READINESS_CONSUMER_PROOF_METADATA_GUARD_SCHEMA_VERSION,
  PRODUCT_READINESS_CONSUMER_VERIFICATION_GUARD_SCHEMA_VERSION,
  PRODUCT_READINESS_CONSUMER_VERIFICATION_LEDGER_SCHEMA_VERSION,
  PRODUCT_READINESS_INTEGRATION_GATE_FIXTURE_SCHEMA_VERSION,
  PRODUCT_READINESS_OWNER_LANE_RECEIPT_EXAMPLES_GUARD_SCHEMA_VERSION,
  PRODUCT_READINESS_OWNER_LANE_RECEIPT_EXAMPLES_SCHEMA_VERSION,
  PRODUCT_READINESS_SCHEMA_LOOKUP_METADATA_GUARD_SCHEMA_VERSION,
  PRODUCT_READINESS_WORKFLOW_ACCEPTANCE_GUARD_SCHEMA_VERSION,
  PRODUCT_READINESS_WORKFLOW_ACCEPTANCE_RECEIPTS_SCHEMA_VERSION,
  buildProductReadinessConsumerVerificationLedger,
  buildProductReadinessIntegrationGateFixture,
  buildProductReadinessIntegrationGateFixtures,
  buildProductReadinessOwnerLaneReceiptExamples,
  buildProductReadinessWorkflowAcceptanceReceipts,
  productReadinessConsumerProofMetadataGuard,
  productReadinessConsumerVerificationGuard,
  productReadinessOwnerLaneReceiptExamplesGuard,
  productReadinessSchemaLookupMetadataGuard,
  productReadinessWorkflowAcceptanceGuard
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
    expect(fixture.workflowAcceptance).toMatchObject({
      schemaVersion: PRODUCT_READINESS_WORKFLOW_ACCEPTANCE_GUARD_SCHEMA_VERSION,
      ok: true,
      blockerCodes: [],
      requiredWorkflowIds: [
        "org_setup",
        "shared_watchlists",
        "source_health",
        "alert_generation",
        "webhook_delivery",
        "case_workflow",
        "public_ti_handoff",
        "support_recovery",
        "website_readiness"
      ]
    });
    expect(fixture.ownerLaneReceiptExamples).toMatchObject({
      schemaVersion: PRODUCT_READINESS_OWNER_LANE_RECEIPT_EXAMPLES_GUARD_SCHEMA_VERSION,
      ok: true,
      blockerCodes: [],
      requiredWorkflowIds: [
        "org_setup",
        "shared_watchlists",
        "source_health",
        "alert_generation",
        "webhook_delivery",
        "case_workflow",
        "public_ti_handoff",
        "support_recovery",
        "website_readiness"
      ]
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
    expect(byKind.get("missing_workflow_schema_lookup")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["missing_workflow_schema_lookup"],
      actualBlockerCodes: expect.arrayContaining(["missing_workflow_schema_lookup"]),
      workflowAcceptance: {
        ok: false,
        rows: expect.arrayContaining([
          expect.objectContaining({ workflowId: "source_health", schemaLookupRefCount: 0 })
        ])
      }
    });
    expect(byKind.get("stale_workflow_acceptance_receipt")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["stale_workflow_acceptance_receipt"],
      actualBlockerCodes: expect.arrayContaining(["stale_workflow_acceptance_receipt"])
    });
    expect(byKind.get("untested_workflow_acceptance_receipt")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["untested_workflow_acceptance_receipt"],
      actualBlockerCodes: expect.arrayContaining(["untested_workflow_acceptance_receipt"])
    });
    expect(byKind.get("missing_workflow_consumer")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["missing_workflow_consumer"],
      actualBlockerCodes: expect.arrayContaining(["missing_workflow_consumer"])
    });
    expect(byKind.get("prompt_literal_workflow_copy")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["workflow_copy_guard_how_this_feeds", "workflow_copy_guard_signal"],
      actualBlockerCodes: expect.arrayContaining(["workflow_copy_guard_how_this_feeds", "workflow_copy_guard_signal"])
    });
    expect(byKind.get("cross_workflow_inconsistency")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["cross_workflow_inconsistency"],
      actualBlockerCodes: expect.arrayContaining(["cross_workflow_inconsistency"]),
      workflowAcceptance: {
        rows: expect.arrayContaining([
          expect.objectContaining({
            workflowId: "source_health",
            missingExpectedCustomerWorkflows: ["source_health"]
          })
        ])
      }
    });
    expect(byKind.get("missing_owner_lane_schema_lookup")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["missing_owner_lane_schema_lookup"],
      actualBlockerCodes: expect.arrayContaining(["missing_owner_lane_schema_lookup"]),
      ownerLaneReceiptExamples: {
        ok: false,
        rows: expect.arrayContaining([
          expect.objectContaining({ workflowId: "source_health", schemaLookupRefCount: 0 })
        ])
      }
    });
    expect(byKind.get("stale_owner_lane_receipt_example")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["stale_owner_lane_receipt_example"],
      actualBlockerCodes: expect.arrayContaining(["stale_owner_lane_receipt_example"])
    });
    expect(byKind.get("untested_owner_lane_receipt_example")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["untested_owner_lane_receipt_example"],
      actualBlockerCodes: expect.arrayContaining(["untested_owner_lane_receipt_example"])
    });
    expect(byKind.get("missing_owner_lane_consumer")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["missing_owner_lane_consumer"],
      actualBlockerCodes: expect.arrayContaining(["missing_owner_lane_consumer"])
    });
    expect(byKind.get("prompt_literal_owner_lane_copy")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["owner_lane_copy_guard_control_room", "owner_lane_copy_guard_signal"],
      actualBlockerCodes: expect.arrayContaining(["owner_lane_copy_guard_control_room", "owner_lane_copy_guard_signal"])
    });
    expect(byKind.get("malformed_owner_lane_receipt_example")).toMatchObject({
      passed: true,
      expectedBlockerCodes: ["missing_owner_lane", "missing_owner_lane_self_validate_command", "missing_owner_lane_payload_shape"],
      actualBlockerCodes: expect.arrayContaining([
        "missing_owner_lane",
        "missing_owner_lane_self_validate_command",
        "missing_owner_lane_payload_shape"
      ])
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

  test("validates workflow acceptance receipts for the full customer path", () => {
    const contract = JSON.parse(JSON.stringify(contractIndex())) as ReturnType<typeof contractIndex>;
    const receipts = buildProductReadinessWorkflowAcceptanceReceipts(contract);
    const guard = productReadinessWorkflowAcceptanceGuard(receipts);

    expect(receipts).toMatchObject({
      schemaVersion: PRODUCT_READINESS_WORKFLOW_ACCEPTANCE_RECEIPTS_SCHEMA_VERSION,
      route: "/v1/contracts",
      proofCommand: expect.stringContaining("check:product-readiness-contracts"),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(receipts.receipts.map((receipt) => receipt.workflowId)).toEqual([
      "org_setup",
      "shared_watchlists",
      "source_health",
      "alert_generation",
      "webhook_delivery",
      "case_workflow",
      "public_ti_handoff",
      "support_recovery",
      "website_readiness"
    ]);
    expect(guard).toMatchObject({
      schemaVersion: PRODUCT_READINESS_WORKFLOW_ACCEPTANCE_GUARD_SCHEMA_VERSION,
      route: "/v1/contracts",
      ok: true,
      blockerCodes: [],
      missingWorkflowIds: [],
      proofCommand: expect.stringContaining("check:product-readiness-contracts")
    });

    const broken = JSON.parse(JSON.stringify(receipts)) as typeof receipts;
    const source = broken.receipts.find((receipt) => receipt.workflowId === "source_health");
    if (!source) throw new Error("source_health workflow acceptance receipt missing");
    source.schemaLookupRefs = [];
    source.consumers = [];
    source.focusedCheck.result = "not_run" as "pass";
    source.focusedCheck.checkedAt = "2026-06-01T00:00:00.000Z";
    source.uiCopyLabel = "how this feeds signal";
    source.customerWorkflowIds = ["webhook_delivery"];

    const brokenGuard = productReadinessWorkflowAcceptanceGuard(broken);

    expect(brokenGuard).toMatchObject({
      ok: false,
      blockerCodes: expect.arrayContaining([
        "missing_workflow_schema_lookup",
        "missing_workflow_consumer",
        "untested_workflow_acceptance_receipt",
        "stale_workflow_acceptance_receipt",
        "workflow_copy_guard_how_this_feeds",
        "workflow_copy_guard_signal",
        "cross_workflow_inconsistency"
      ])
    });
  });

  test("publishes owner-lane receipt examples for adjacent lane self-validation", () => {
    const contract = JSON.parse(JSON.stringify(contractIndex())) as ReturnType<typeof contractIndex>;
    const workflowReceipts = buildProductReadinessWorkflowAcceptanceReceipts(contract);
    const examples = buildProductReadinessOwnerLaneReceiptExamples(workflowReceipts);
    const guard = productReadinessOwnerLaneReceiptExamplesGuard(examples);

    expect(examples).toMatchObject({
      schemaVersion: PRODUCT_READINESS_OWNER_LANE_RECEIPT_EXAMPLES_SCHEMA_VERSION,
      route: "/v1/contracts",
      proofCommand: expect.stringContaining("check:product-readiness-contracts"),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(examples.examples.map((example) => [example.workflowId, example.ownerLane])).toEqual([
      ["org_setup", "org"],
      ["shared_watchlists", "watchlist"],
      ["source_health", "source"],
      ["alert_generation", "alert"],
      ["webhook_delivery", "webhook"],
      ["case_workflow", "case"],
      ["public_ti_handoff", "publicTI"],
      ["support_recovery", "support"],
      ["website_readiness", "website"]
    ]);
    expect(examples.examples.every((example) => example.selfValidateCommand.includes("check:product-readiness-contracts"))).toBe(true);
    expect(examples.examples.every((example) => example.payloadShape.requiredFields.includes("ownerLane"))).toBe(true);
    expect(guard).toMatchObject({
      schemaVersion: PRODUCT_READINESS_OWNER_LANE_RECEIPT_EXAMPLES_GUARD_SCHEMA_VERSION,
      route: "/v1/contracts",
      ok: true,
      blockerCodes: [],
      proofCommand: expect.stringContaining("check:product-readiness-contracts")
    });

    const broken = JSON.parse(JSON.stringify(examples)) as typeof examples;
    const source = broken.examples.find((example) => example.workflowId === "source_health");
    if (!source) throw new Error("source_health owner-lane example missing");
    source.ownerLane = "";
    source.schemaLookupRefs = [];
    source.consumerOwnerLanes = [];
    source.focusedCheck.result = "not_run" as "pass";
    source.focusedCheck.checkedAt = "2026-06-01T00:00:00.000Z";
    source.selfValidateCommand = "";
    source.payloadShape.requiredFields = [];
    source.uiCopyLabel = "control room signal";

    const brokenGuard = productReadinessOwnerLaneReceiptExamplesGuard(broken);

    expect(brokenGuard).toMatchObject({
      ok: false,
      blockerCodes: expect.arrayContaining([
        "missing_owner_lane",
        "missing_owner_lane_schema_lookup",
        "missing_owner_lane_consumer",
        "untested_owner_lane_receipt_example",
        "stale_owner_lane_receipt_example",
        "missing_owner_lane_self_validate_command",
        "missing_owner_lane_payload_shape",
        "owner_lane_copy_guard_control_room",
        "owner_lane_copy_guard_signal"
      ])
    });
  });
});
