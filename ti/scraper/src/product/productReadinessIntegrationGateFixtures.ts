import {
  contractIndex,
  productReadinessContractCopyGuard,
  productReadinessIntegrationGate,
  productReadinessReceiptMatrixCoverage
} from "../api/contractsRoute.ts";

export const PRODUCT_READINESS_INTEGRATION_GATE_FIXTURE_SCHEMA_VERSION =
  "hanasand.product_readiness.integration_gate_fixture.v1" as const;
export const PRODUCT_READINESS_CONSUMER_PROOF_METADATA_GUARD_SCHEMA_VERSION =
  "hanasand.product_readiness.consumer_proof_metadata_guard.v1" as const;
export const PRODUCT_READINESS_SCHEMA_LOOKUP_METADATA_GUARD_SCHEMA_VERSION =
  "hanasand.product_readiness.schema_lookup_metadata_guard.v1" as const;

export type ProductReadinessIntegrationGateFixtureKind =
  | "valid"
  | "missing_required_receipt"
  | "stale_receipt_reference"
  | "missing_schema_lookup"
  | "prompt_literal_copy"
  | "unsafe_receipt_output"
  | "malformed_consumer_proof_metadata"
  | "malformed_schema_lookup_metadata";

const FIXTURE_KINDS: ProductReadinessIntegrationGateFixtureKind[] = [
  "valid",
  "missing_required_receipt",
  "stale_receipt_reference",
  "missing_schema_lookup",
  "prompt_literal_copy",
  "unsafe_receipt_output",
  "malformed_consumer_proof_metadata",
  "malformed_schema_lookup_metadata"
];

function cloneJson<T>(input: T): T {
  return JSON.parse(JSON.stringify(input));
}

function hasConsumerRouteShape(route: string | undefined): boolean {
  return !!route && (/^\//.test(route) || /^[A-Z]+ \//.test(route));
}

function buildGateFromContractLike(contractLike: ReturnType<typeof contractIndex>) {
  const coverage = productReadinessReceiptMatrixCoverage(
    contractLike.productReadinessReceiptMatrix,
    contractLike.receiptSchemas,
    contractLike.schemaLookup.rows
  );
  const copyGuard = productReadinessContractCopyGuard({
    surfaces: contractLike.surfaces,
    schemaLookup: contractLike.schemaLookup,
    productReadinessReceiptMatrix: contractLike.productReadinessReceiptMatrix
  });
  const gate = productReadinessIntegrationGate({ coverage, copyGuard });
  return { coverage, copyGuard, gate };
}

function mutateFixtureContract(
  contractLike: ReturnType<typeof contractIndex>,
  kind: ProductReadinessIntegrationGateFixtureKind
) {
  switch (kind) {
    case "valid":
      break;
    case "missing_required_receipt": {
      const row = contractLike.productReadinessReceiptMatrix.rows.find((item) => item.capabilityId === "source_activation");
      if (row) row.receiptSchemaIds = [];
      break;
    }
    case "stale_receipt_reference": {
      const row = contractLike.productReadinessReceiptMatrix.rows.find((item) => item.capabilityId === "webhook_delivery");
      if (row) row.receiptSchemaIds = [...row.receiptSchemaIds, "hanasand.fixture_stale_webhook_receipt.v1"];
      break;
    }
    case "missing_schema_lookup":
      contractLike.schemaLookup.rows = contractLike.schemaLookup.rows.filter(
        (row) => row.schemaId !== contractLike.productReadinessReceiptMatrix.schemaVersion
      );
      break;
    case "prompt_literal_copy": {
      const row = contractLike.productReadinessReceiptMatrix.rows.find((item) => item.capabilityId === "website_product_surface");
      if (row) row.blockerCodes = [...row.blockerCodes, "dashboard slop"];
      break;
    }
    case "unsafe_receipt_output": {
      const row = contractLike.productReadinessReceiptMatrix.rows.find((item) => item.capabilityId === "alert_case_workflow");
      if (row) row.safeOutput = { ...row.safeOutput, rawEvidenceExposed: true };
      break;
    }
    case "malformed_consumer_proof_metadata": {
      const row = contractLike.productReadinessReceiptMatrix.rows.find((item) => item.capabilityId === "shared_watchlists");
      if (row) {
        row.downstreamConsumers = [{ ownerLane: "alert", route: "", requiredFields: [] }];
        row.downstreamOwners = ["dashboard"];
      }
      break;
    }
    case "malformed_schema_lookup_metadata": {
      const row = contractLike.schemaLookup.rows.find((item) => item.contractId === "product_readiness_receipt_matrix");
      if (row) {
        row.route = "contracts/no-leading-slash";
        row.scopeFields = [];
        row.blockerCodes = [];
        row.downstreamConsumers = [{ ownerLane: "dashboard", route: "", requiredFields: [] }];
        row.safeOutput = { ...row.safeOutput, rawEvidenceExposed: true };
      }
      break;
    }
  }
}

const EXPECTED_BLOCKERS: Record<ProductReadinessIntegrationGateFixtureKind, string[]> = {
  valid: [],
  missing_required_receipt: ["missing_required_receipt_schema"],
  stale_receipt_reference: ["stale_receipt_schema_reference"],
  missing_schema_lookup: ["missing_matrix_schema_lookup"],
  prompt_literal_copy: ["copy_guard_dashboard_slop"],
  unsafe_receipt_output: ["unsafe_receipt_matrix_row"],
  malformed_consumer_proof_metadata: ["missing_consumer_route", "missing_consumer_required_fields", "downstream_owner_mismatch"],
  malformed_schema_lookup_metadata: [
    "missing_schema_lookup_route",
    "missing_schema_lookup_scope_fields",
    "missing_schema_lookup_blocker_codes",
    "missing_schema_lookup_consumer_route",
    "missing_schema_lookup_consumer_required_fields",
    "unsafe_schema_lookup_row"
  ]
};

export function productReadinessConsumerProofMetadataGuard(contractLike: Pick<ReturnType<typeof contractIndex>, "productReadinessReceiptMatrix">) {
  const rows = contractLike.productReadinessReceiptMatrix.rows.map((row) => {
    const consumers = Array.isArray(row.downstreamConsumers) ? row.downstreamConsumers : [];
    const expectedOwners = [...new Set(consumers.map((consumer) => consumer.ownerLane).filter(Boolean))].sort();
    const declaredOwners = Array.isArray(row.downstreamOwners) ? [...row.downstreamOwners].sort() : [];
    const blockerCodes = [
      ...(!consumers.length ? ["missing_consumer_proof_metadata"] : []),
      ...consumers.flatMap((consumer) => {
        const blockers: string[] = [];
        if (!consumer.ownerLane) blockers.push("missing_consumer_owner");
        if (!hasConsumerRouteShape(consumer.route)) blockers.push("missing_consumer_route");
        if (!Array.isArray(consumer.requiredFields) || consumer.requiredFields.length === 0) blockers.push("missing_consumer_required_fields");
        return blockers;
      }),
      ...(JSON.stringify(expectedOwners) !== JSON.stringify(declaredOwners) ? ["downstream_owner_mismatch"] : [])
    ];
    return {
      capabilityId: row.capabilityId,
      ownerLane: row.ownerLane,
      ok: blockerCodes.length === 0,
      blockerCodes: [...new Set(blockerCodes)].sort(),
      downstreamOwnerCount: declaredOwners.length,
      downstreamConsumerCount: consumers.length,
      expectedDownstreamOwners: expectedOwners,
      declaredDownstreamOwners: declaredOwners,
      consumerProofs: consumers.map((consumer) => ({
        ownerLane: consumer.ownerLane,
        route: consumer.route,
        requiredFieldCount: Array.isArray(consumer.requiredFields) ? consumer.requiredFields.length : 0
      }))
    };
  });
  const blockerCodes = [...new Set(rows.flatMap((row) => row.blockerCodes))].sort();
  return {
    schemaVersion: PRODUCT_READINESS_CONSUMER_PROOF_METADATA_GUARD_SCHEMA_VERSION,
    route: "/v1/contracts",
    ok: blockerCodes.length === 0,
    rowCount: rows.length,
    blockerCodes,
    rows,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

export function productReadinessSchemaLookupMetadataGuard(contractLike: Pick<ReturnType<typeof contractIndex>, "schemaLookup">) {
  const rows = contractLike.schemaLookup.rows.map((row) => {
    const consumers = Array.isArray(row.downstreamConsumers) ? row.downstreamConsumers : [];
    const unsafeFields = [
      !row.safeOutput?.metadataOnly ? "safeOutput.metadataOnly" : "",
      row.safeOutput?.rawEvidenceExposed ? "safeOutput.rawEvidenceExposed" : "",
      row.safeOutput?.webhookSecretExposed ? "safeOutput.webhookSecretExposed" : "",
      row.safeOutput?.crossOrgDataExposed ? "safeOutput.crossOrgDataExposed" : ""
    ].filter(Boolean);
    const blockerCodes = [
      ...(!row.schemaId ? ["missing_schema_lookup_schema_id"] : []),
      ...(!row.contractId ? ["missing_schema_lookup_contract_id"] : []),
      ...(!row.ownerLane ? ["missing_schema_lookup_owner_lane"] : []),
      ...(!hasConsumerRouteShape(row.route) ? ["missing_schema_lookup_route"] : []),
      ...(!Array.isArray(row.scopeFields) || row.scopeFields.length === 0 ? ["missing_schema_lookup_scope_fields"] : []),
      ...(!Array.isArray(row.blockerCodes) || row.blockerCodes.length === 0 ? ["missing_schema_lookup_blocker_codes"] : []),
      ...(!consumers.length ? ["missing_schema_lookup_downstream_consumers"] : []),
      ...consumers.flatMap((consumer) => {
        const blockers: string[] = [];
        if (!consumer.ownerLane) blockers.push("missing_schema_lookup_consumer_owner");
        if (!hasConsumerRouteShape(consumer.route)) blockers.push("missing_schema_lookup_consumer_route");
        if (!Array.isArray(consumer.requiredFields) || consumer.requiredFields.length === 0) {
          blockers.push("missing_schema_lookup_consumer_required_fields");
        }
        return blockers;
      }),
      ...unsafeFields.map(() => "unsafe_schema_lookup_row")
    ];
    return {
      schemaId: row.schemaId,
      contractId: row.contractId,
      ownerLane: row.ownerLane,
      route: row.route,
      ok: blockerCodes.length === 0,
      blockerCodes: [...new Set(blockerCodes)].sort(),
      scopeFieldCount: Array.isArray(row.scopeFields) ? row.scopeFields.length : 0,
      blockerCodeCount: Array.isArray(row.blockerCodes) ? row.blockerCodes.length : 0,
      downstreamConsumerCount: consumers.length,
      unsafeFields
    };
  });
  const blockerCodes = [...new Set(rows.flatMap((row) => row.blockerCodes))].sort();
  return {
    schemaVersion: PRODUCT_READINESS_SCHEMA_LOOKUP_METADATA_GUARD_SCHEMA_VERSION,
    route: "/v1/contracts",
    ok: blockerCodes.length === 0,
    rowCount: rows.length,
    blockerCodes,
    rows,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

export function buildProductReadinessIntegrationGateFixture(kind: ProductReadinessIntegrationGateFixtureKind) {
  const contractLike = cloneJson(contractIndex());
  mutateFixtureContract(contractLike, kind);
  const { coverage, copyGuard, gate } = buildGateFromContractLike(contractLike);
  const consumerProofMetadata = productReadinessConsumerProofMetadataGuard(contractLike);
  const schemaLookupMetadata = productReadinessSchemaLookupMetadataGuard(contractLike);
  const expectedBlockerCodes = EXPECTED_BLOCKERS[kind];
  const actualBlockerCodes = [...new Set([
    ...gate.blockerCodes,
    ...consumerProofMetadata.blockerCodes,
    ...schemaLookupMetadata.blockerCodes
  ])].sort();
  const expectedBlockersPresent = expectedBlockerCodes.every((code) => actualBlockerCodes.includes(code));
  const liveOk = gate.ok && consumerProofMetadata.ok && schemaLookupMetadata.ok;
  const passed = kind === "valid" ? liveOk : !liveOk && expectedBlockersPresent;

  return {
    schemaVersion: PRODUCT_READINESS_INTEGRATION_GATE_FIXTURE_SCHEMA_VERSION,
    kind,
    passed,
    expectedBlockerCodes,
    actualBlockerCodes,
    gate: {
      schemaVersion: gate.schemaVersion,
      route: gate.route,
      ok: gate.ok,
      decision: gate.decision,
      blockerCodes: gate.blockerCodes,
      checks: gate.checks.map((check) => ({
        id: check.id,
        ownerLane: check.ownerLane,
        artifact: check.artifact,
        ok: check.ok,
        blockerCodes: check.blockerCodes
      })),
      safeOutput: gate.safeOutput
    },
    coverage: {
      schemaVersion: coverage.schemaVersion,
      ok: coverage.ok,
      blockerCodes: coverage.blockerCodes,
      failingRows: coverage.diffRows
        .filter((row) => !row.ok)
        .map((row) => ({
          capabilityId: row.capabilityId,
          ownerLane: row.ownerLane,
          blockerCodes: row.blockerCodes,
          missingRequiredReceiptSchemaIds: row.missingRequiredReceiptSchemaIds,
          unindexedReceiptSchemaIds: row.unindexedReceiptSchemaIds,
          unsafeFields: row.unsafeFields
        }))
    },
    copyGuard: {
      schemaVersion: copyGuard.schemaVersion,
      ok: copyGuard.ok,
      violationCount: copyGuard.violationCount,
      violations: copyGuard.violations.map((violation) => ({
        source: violation.source,
        path: violation.path,
        term: violation.term,
        ownerLane: violation.ownerLane,
        capabilityId: violation.capabilityId
      }))
    },
    consumerProofMetadata,
    schemaLookupMetadata,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

export function buildProductReadinessIntegrationGateFixtures() {
  return FIXTURE_KINDS.map((kind) => buildProductReadinessIntegrationGateFixture(kind));
}
