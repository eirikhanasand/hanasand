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
export const PRODUCT_READINESS_CONSUMER_VERIFICATION_LEDGER_SCHEMA_VERSION =
  "hanasand.product_readiness.consumer_verification_ledger.v1" as const;
export const PRODUCT_READINESS_CONSUMER_VERIFICATION_GUARD_SCHEMA_VERSION =
  "hanasand.product_readiness.consumer_verification_guard.v1" as const;
export const PRODUCT_READINESS_WORKFLOW_ACCEPTANCE_RECEIPTS_SCHEMA_VERSION =
  "hanasand.product_readiness.workflow_acceptance_receipts.v1" as const;
export const PRODUCT_READINESS_WORKFLOW_ACCEPTANCE_GUARD_SCHEMA_VERSION =
  "hanasand.product_readiness.workflow_acceptance_guard.v1" as const;
const PRODUCT_READINESS_CONSUMER_VERIFIED_AT = "2026-06-30T00:00:00.000Z";
const PRODUCT_READINESS_CONSUMER_STALE_BEFORE = "2026-06-23T00:00:00.000Z";
const PRODUCT_READINESS_CONSUMER_PROOF_COMMAND = "cd ti/scraper && /Users/eirikhanasand/.bun/bin/bun run check:product-readiness-contracts";

export type ProductReadinessIntegrationGateFixtureKind =
  | "valid"
  | "missing_required_receipt"
  | "stale_receipt_reference"
  | "missing_schema_lookup"
  | "prompt_literal_copy"
  | "unsafe_receipt_output"
  | "malformed_consumer_proof_metadata"
  | "malformed_schema_lookup_metadata"
  | "missing_customer_workflow"
  | "missing_consumer_verification"
  | "stale_consumer_verification"
  | "missing_consumer_proof_command"
  | "prompt_literal_consumer_copy"
  | "missing_workflow_schema_lookup"
  | "stale_workflow_acceptance_receipt"
  | "untested_workflow_acceptance_receipt"
  | "missing_workflow_consumer"
  | "prompt_literal_workflow_copy"
  | "cross_workflow_inconsistency";

const FIXTURE_KINDS: ProductReadinessIntegrationGateFixtureKind[] = [
  "valid",
  "missing_required_receipt",
  "stale_receipt_reference",
  "missing_schema_lookup",
  "prompt_literal_copy",
  "unsafe_receipt_output",
  "malformed_consumer_proof_metadata",
  "malformed_schema_lookup_metadata",
  "missing_customer_workflow",
  "missing_consumer_verification",
  "stale_consumer_verification",
  "missing_consumer_proof_command",
  "prompt_literal_consumer_copy",
  "missing_workflow_schema_lookup",
  "stale_workflow_acceptance_receipt",
  "untested_workflow_acceptance_receipt",
  "missing_workflow_consumer",
  "prompt_literal_workflow_copy",
  "cross_workflow_inconsistency"
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
    case "missing_customer_workflow": {
      const row = contractLike.productReadinessReceiptMatrix.rows.find((item) => item.capabilityId === "source_activation");
      if (row) row.customerWorkflowIds = [];
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
  ],
  missing_customer_workflow: ["missing_customer_workflow_ids", "missing_customer_workflow"],
  missing_consumer_verification: ["missing_consumer_verification"],
  stale_consumer_verification: ["stale_consumer_verification"],
  missing_consumer_proof_command: ["missing_consumer_proof_command"],
  prompt_literal_consumer_copy: ["consumer_copy_guard_control_room", "consumer_copy_guard_signal"],
  missing_workflow_schema_lookup: ["missing_workflow_schema_lookup"],
  stale_workflow_acceptance_receipt: ["stale_workflow_acceptance_receipt"],
  untested_workflow_acceptance_receipt: ["untested_workflow_acceptance_receipt"],
  missing_workflow_consumer: ["missing_workflow_consumer"],
  prompt_literal_workflow_copy: ["workflow_copy_guard_how_this_feeds", "workflow_copy_guard_signal"],
  cross_workflow_inconsistency: ["cross_workflow_inconsistency"]
};

type ConsumerVerificationLedger = ReturnType<typeof buildProductReadinessConsumerVerificationLedger>;
type WorkflowAcceptanceReceipts = ReturnType<typeof buildProductReadinessWorkflowAcceptanceReceipts>;

const REQUIRED_WORKFLOW_ACCEPTANCE_IDS = [
  "org_setup",
  "shared_watchlists",
  "source_health",
  "alert_generation",
  "webhook_delivery",
  "case_workflow",
  "public_ti_handoff",
  "support_recovery",
  "website_readiness"
] as const;

const WORKFLOW_ACCEPTANCE_SPECS: Array<{
  workflowId: typeof REQUIRED_WORKFLOW_ACCEPTANCE_IDS[number];
  customerWorkflowIds: string[];
  capabilityIds: string[];
  schemaLookupContractIds: string[];
  producer: string;
}> = [
  {
    workflowId: "org_setup",
    customerWorkflowIds: ["org_membership"],
    capabilityIds: ["organization_lifecycle", "support_controls"],
    schemaLookupContractIds: ["product_readiness_receipt_matrix", "support_action_receipts"],
    producer: "contractIndex.productReadinessReceiptMatrix.organization_lifecycle"
  },
  {
    workflowId: "shared_watchlists",
    customerWorkflowIds: ["shared_watchlists"],
    capabilityIds: ["shared_watchlists"],
    schemaLookupContractIds: ["product_readiness_receipt_matrix"],
    producer: "contractIndex.productReadinessReceiptMatrix.shared_watchlists"
  },
  {
    workflowId: "source_health",
    customerWorkflowIds: ["source_health"],
    capabilityIds: ["source_activation"],
    schemaLookupContractIds: ["source_provenance_receipts"],
    producer: "contractIndex.productReadinessReceiptMatrix.source_activation"
  },
  {
    workflowId: "alert_generation",
    customerWorkflowIds: ["alert_generation"],
    capabilityIds: ["shared_watchlists", "source_activation", "alert_case_workflow"],
    schemaLookupContractIds: ["product_readiness_receipt_matrix", "source_provenance_receipts"],
    producer: "contractIndex.productReadinessReceiptMatrix.alert_case_workflow"
  },
  {
    workflowId: "webhook_delivery",
    customerWorkflowIds: ["webhook_delivery"],
    capabilityIds: ["alert_case_workflow", "webhook_delivery"],
    schemaLookupContractIds: ["webhook_delivery_receipts"],
    producer: "contractIndex.productReadinessReceiptMatrix.webhook_delivery"
  },
  {
    workflowId: "case_workflow",
    customerWorkflowIds: ["case_workflow"],
    capabilityIds: ["alert_case_workflow", "dashboard_operator_workspace", "public_ti_actor_handoff"],
    schemaLookupContractIds: ["org_alert_case_action_receipt"],
    producer: "contractIndex.productReadinessReceiptMatrix.alert_case_workflow"
  },
  {
    workflowId: "public_ti_handoff",
    customerWorkflowIds: ["public_ti_handoff"],
    capabilityIds: ["source_activation", "public_ti_actor_handoff", "website_product_surface"],
    schemaLookupContractIds: ["source_provenance_receipts", "product_readiness_receipt_matrix"],
    producer: "contractIndex.productReadinessReceiptMatrix.public_ti_actor_handoff"
  },
  {
    workflowId: "support_recovery",
    customerWorkflowIds: ["org_membership"],
    capabilityIds: ["support_controls"],
    schemaLookupContractIds: ["support_action_receipts"],
    producer: "contractIndex.productReadinessReceiptMatrix.support_controls"
  },
  {
    workflowId: "website_readiness",
    customerWorkflowIds: ["public_ti_handoff"],
    capabilityIds: ["website_product_surface"],
    schemaLookupContractIds: ["product_readiness_receipt_matrix"],
    producer: "contractIndex.productReadinessReceiptMatrix.website_product_surface"
  }
];

function consumerKind(route: string, ownerLane: string): "ui" | "api" | "workflow" {
  if (route === "/" || route.startsWith("/dashboard") || route.startsWith("/ti")) return "ui";
  if (ownerLane === "alert" || ownerLane === "case" || ownerLane === "webhook" || ownerLane === "source") return "workflow";
  return "api";
}

function consumerLabel(ownerLane: string, route: string) {
  const routeKind = consumerKind(route, ownerLane);
  return `${ownerLane}_${routeKind}_consumer`;
}

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

export function buildProductReadinessConsumerVerificationLedger(contractLike: Pick<ReturnType<typeof contractIndex>, "productReadinessReceiptMatrix">) {
  return {
    schemaVersion: PRODUCT_READINESS_CONSUMER_VERIFICATION_LEDGER_SCHEMA_VERSION,
    route: "/v1/contracts",
    verifiedAt: PRODUCT_READINESS_CONSUMER_VERIFIED_AT,
    staleBefore: PRODUCT_READINESS_CONSUMER_STALE_BEFORE,
    proofCommand: PRODUCT_READINESS_CONSUMER_PROOF_COMMAND,
    rows: contractLike.productReadinessReceiptMatrix.rows.map((row) => ({
      capabilityId: row.capabilityId,
      ownerLane: row.ownerLane,
      customerWorkflowIds: row.customerWorkflowIds || [],
      consumerVerifications: (row.downstreamConsumers || []).map((consumer) => ({
        ownerLane: consumer.ownerLane,
        route: consumer.route,
        consumerKind: consumerKind(consumer.route, consumer.ownerLane),
        consumerLabel: consumerLabel(consumer.ownerLane, consumer.route),
        requiredFields: consumer.requiredFields || [],
        verifiedAt: PRODUCT_READINESS_CONSUMER_VERIFIED_AT,
        staleBefore: PRODUCT_READINESS_CONSUMER_STALE_BEFORE,
        proofCommand: PRODUCT_READINESS_CONSUMER_PROOF_COMMAND
      }))
    })),
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

function mutateConsumerVerificationLedger(ledger: ConsumerVerificationLedger, kind: ProductReadinessIntegrationGateFixtureKind) {
  const firstSourceRow = ledger.rows.find((row) => row.capabilityId === "source_activation");
  const firstConsumer = firstSourceRow?.consumerVerifications[0];
  switch (kind) {
    case "missing_consumer_verification":
      if (firstSourceRow) firstSourceRow.consumerVerifications = [];
      break;
    case "stale_consumer_verification":
      if (firstConsumer) firstConsumer.verifiedAt = "2026-06-01T00:00:00.000Z";
      break;
    case "missing_consumer_proof_command":
      if (firstConsumer) firstConsumer.proofCommand = "";
      break;
    case "prompt_literal_consumer_copy":
      if (firstConsumer) firstConsumer.consumerLabel = "control room signal";
      break;
  }
}

export function productReadinessConsumerVerificationGuard(ledger: ConsumerVerificationLedger) {
  const forbiddenTerms = ["control room", "how this feeds", "dashboard slop", "named examples", "signal", "acceptance criteria", "acceptance-criteria"];
  const rows = ledger.rows.map((row) => {
    const verifications = Array.isArray(row.consumerVerifications) ? row.consumerVerifications : [];
    const blockerCodes = [
      ...(!Array.isArray(row.customerWorkflowIds) || row.customerWorkflowIds.length === 0 ? ["missing_customer_workflow_ids"] : []),
      ...(!verifications.length ? ["missing_consumer_verification"] : []),
      ...verifications.flatMap((verification) => {
        const blockers: string[] = [];
        if (!verification.ownerLane) blockers.push("missing_consumer_owner");
        if (!hasConsumerRouteShape(verification.route)) blockers.push("missing_consumer_route");
        if (!verification.consumerKind) blockers.push("missing_consumer_kind");
        if (!Array.isArray(verification.requiredFields) || verification.requiredFields.length === 0) blockers.push("missing_consumer_required_fields");
        if (!verification.verifiedAt) blockers.push("missing_consumer_verified_at");
        if (verification.verifiedAt && verification.verifiedAt < verification.staleBefore) blockers.push("stale_consumer_verification");
        if (!verification.proofCommand) blockers.push("missing_consumer_proof_command");
        const label = String(verification.consumerLabel || "").toLowerCase();
        for (const term of forbiddenTerms) {
          if (label.includes(term)) blockers.push(`consumer_copy_guard_${term.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`);
        }
        return blockers;
      })
    ];
    return {
      capabilityId: row.capabilityId,
      ownerLane: row.ownerLane,
      ok: blockerCodes.length === 0,
      blockerCodes: [...new Set(blockerCodes)].sort(),
      customerWorkflowIds: row.customerWorkflowIds,
      consumerVerificationCount: verifications.length,
      consumerVerifications: verifications.map((verification) => ({
        ownerLane: verification.ownerLane,
        route: verification.route,
        consumerKind: verification.consumerKind,
        consumerLabel: verification.consumerLabel,
        requiredFieldCount: Array.isArray(verification.requiredFields) ? verification.requiredFields.length : 0,
        verifiedAt: verification.verifiedAt,
        staleBefore: verification.staleBefore,
        proofCommand: verification.proofCommand
      }))
    };
  });
  const blockerCodes = [...new Set(rows.flatMap((row) => row.blockerCodes))].sort();
  return {
    schemaVersion: PRODUCT_READINESS_CONSUMER_VERIFICATION_GUARD_SCHEMA_VERSION,
    route: "/v1/contracts",
    ok: blockerCodes.length === 0,
    rowCount: rows.length,
    verifiedAt: ledger.verifiedAt,
    staleBefore: ledger.staleBefore,
    proofCommand: ledger.proofCommand,
    blockerCodes,
    rows,
    safeOutput: ledger.safeOutput
  };
}

export function buildProductReadinessWorkflowAcceptanceReceipts(contractLike: Pick<ReturnType<typeof contractIndex>, "productReadinessReceiptMatrix" | "schemaLookup">) {
  const matrixRows = contractLike.productReadinessReceiptMatrix.rows;
  const schemaLookupRows = contractLike.schemaLookup.rows;
  return {
    schemaVersion: PRODUCT_READINESS_WORKFLOW_ACCEPTANCE_RECEIPTS_SCHEMA_VERSION,
    route: "/v1/contracts",
    verifiedAt: PRODUCT_READINESS_CONSUMER_VERIFIED_AT,
    staleBefore: PRODUCT_READINESS_CONSUMER_STALE_BEFORE,
    proofCommand: PRODUCT_READINESS_CONSUMER_PROOF_COMMAND,
    receipts: WORKFLOW_ACCEPTANCE_SPECS.map((spec) => {
      const capabilityRows = matrixRows.filter((row) => spec.capabilityIds.includes(row.capabilityId));
      const schemaLookupRefs = schemaLookupRows
        .filter((row) => spec.schemaLookupContractIds.includes(row.contractId))
        .map((row) => ({
          contractId: row.contractId,
          schemaId: row.schemaId,
          route: row.route,
          ownerLane: row.ownerLane
        }));
      const consumers = capabilityRows.flatMap((row) => row.downstreamConsumers || []).map((consumer) => ({
        ownerLane: consumer.ownerLane,
        route: consumer.route,
        consumerKind: consumerKind(consumer.route, consumer.ownerLane),
        requiredFields: consumer.requiredFields || []
      }));
      return {
        workflowId: spec.workflowId,
        customerWorkflowIds: spec.customerWorkflowIds,
        capabilityIds: spec.capabilityIds,
        schemaLookupContractIds: spec.schemaLookupContractIds,
        schemaLookupRefs,
        producer: spec.producer,
        consumers,
        focusedCheck: {
          command: PRODUCT_READINESS_CONSUMER_PROOF_COMMAND,
          result: "pass" as const,
          checkedAt: PRODUCT_READINESS_CONSUMER_VERIFIED_AT,
          staleBefore: PRODUCT_READINESS_CONSUMER_STALE_BEFORE
        },
        uiCopyLabel: `${spec.workflowId}_workflow_acceptance`,
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false,
          crossOrgDataExposed: false
        }
      };
    }),
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

function mutateWorkflowAcceptanceReceipts(receipts: WorkflowAcceptanceReceipts, kind: ProductReadinessIntegrationGateFixtureKind) {
  const sourceReceipt = receipts.receipts.find((receipt) => receipt.workflowId === "source_health");
  switch (kind) {
    case "missing_workflow_schema_lookup":
      if (sourceReceipt) sourceReceipt.schemaLookupRefs = [];
      break;
    case "stale_workflow_acceptance_receipt":
      if (sourceReceipt) sourceReceipt.focusedCheck.checkedAt = "2026-06-01T00:00:00.000Z";
      break;
    case "untested_workflow_acceptance_receipt":
      if (sourceReceipt) sourceReceipt.focusedCheck.result = "not_run" as "pass";
      break;
    case "missing_workflow_consumer":
      if (sourceReceipt) sourceReceipt.consumers = [];
      break;
    case "prompt_literal_workflow_copy":
      if (sourceReceipt) sourceReceipt.uiCopyLabel = "how this feeds signal";
      break;
    case "cross_workflow_inconsistency":
      if (sourceReceipt) sourceReceipt.customerWorkflowIds = ["webhook_delivery"];
      break;
  }
}

export function productReadinessWorkflowAcceptanceGuard(receipts: WorkflowAcceptanceReceipts) {
  const forbiddenTerms = ["control room", "how this feeds", "dashboard slop", "named examples", "signal", "acceptance criteria", "acceptance-criteria"];
  const receiptWorkflowIds = new Set(receipts.receipts.map((receipt) => receipt.workflowId));
  const missingWorkflowIds = REQUIRED_WORKFLOW_ACCEPTANCE_IDS.filter((workflowId) => !receiptWorkflowIds.has(workflowId));
  const rows = receipts.receipts.map((receipt) => {
    const expectedSpec = WORKFLOW_ACCEPTANCE_SPECS.find((spec) => spec.workflowId === receipt.workflowId);
    const missingExpectedCustomerWorkflows = (expectedSpec?.customerWorkflowIds || []).filter((workflowId) => !receipt.customerWorkflowIds.includes(workflowId));
    const unsafeFields = [
      !receipt.safeOutput?.metadataOnly ? "safeOutput.metadataOnly" : "",
      receipt.safeOutput?.rawEvidenceExposed ? "safeOutput.rawEvidenceExposed" : "",
      receipt.safeOutput?.webhookSecretExposed ? "safeOutput.webhookSecretExposed" : "",
      receipt.safeOutput?.crossOrgDataExposed ? "safeOutput.crossOrgDataExposed" : ""
    ].filter(Boolean);
    const label = String(receipt.uiCopyLabel || "").toLowerCase();
    const copyBlockers = forbiddenTerms
      .filter((term) => label.includes(term))
      .map((term) => `workflow_copy_guard_${term.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`);
    const blockerCodes = [
      ...(!receipt.schemaLookupRefs.length ? ["missing_workflow_schema_lookup"] : []),
      ...(!receipt.producer ? ["missing_workflow_producer"] : []),
      ...(!receipt.consumers.length ? ["missing_workflow_consumer"] : []),
      ...(!receipt.focusedCheck?.command ? ["missing_workflow_check_command"] : []),
      ...(receipt.focusedCheck?.result !== "pass" ? ["untested_workflow_acceptance_receipt"] : []),
      ...(!receipt.focusedCheck?.checkedAt ? ["missing_workflow_verified_at"] : []),
      ...(receipt.focusedCheck?.checkedAt && receipt.focusedCheck.checkedAt < receipt.focusedCheck.staleBefore ? ["stale_workflow_acceptance_receipt"] : []),
      ...missingExpectedCustomerWorkflows.map(() => "cross_workflow_inconsistency"),
      ...copyBlockers,
      ...unsafeFields.map(() => "unsafe_workflow_acceptance_receipt")
    ];
    return {
      workflowId: receipt.workflowId,
      ok: blockerCodes.length === 0,
      blockerCodes: [...new Set(blockerCodes)].sort(),
      customerWorkflowIds: receipt.customerWorkflowIds,
      missingExpectedCustomerWorkflows,
      capabilityIds: receipt.capabilityIds,
      schemaLookupRefCount: receipt.schemaLookupRefs.length,
      consumerCount: receipt.consumers.length,
      focusedCheck: receipt.focusedCheck,
      unsafeFields
    };
  });
  const blockerCodes = [...new Set([
    ...missingWorkflowIds.map(() => "missing_workflow_acceptance_receipt"),
    ...rows.flatMap((row) => row.blockerCodes)
  ])].sort();
  return {
    schemaVersion: PRODUCT_READINESS_WORKFLOW_ACCEPTANCE_GUARD_SCHEMA_VERSION,
    route: "/v1/contracts",
    ok: blockerCodes.length === 0,
    rowCount: rows.length,
    requiredWorkflowIds: [...REQUIRED_WORKFLOW_ACCEPTANCE_IDS],
    missingWorkflowIds,
    verifiedAt: receipts.verifiedAt,
    staleBefore: receipts.staleBefore,
    proofCommand: receipts.proofCommand,
    blockerCodes,
    rows,
    safeOutput: receipts.safeOutput
  };
}

export function buildProductReadinessIntegrationGateFixture(kind: ProductReadinessIntegrationGateFixtureKind) {
  const contractLike = cloneJson(contractIndex());
  mutateFixtureContract(contractLike, kind);
  const { coverage, copyGuard, gate } = buildGateFromContractLike(contractLike);
  const consumerProofMetadata = productReadinessConsumerProofMetadataGuard(contractLike);
  const schemaLookupMetadata = productReadinessSchemaLookupMetadataGuard(contractLike);
  const consumerVerificationLedger = buildProductReadinessConsumerVerificationLedger(contractLike);
  mutateConsumerVerificationLedger(consumerVerificationLedger, kind);
  const consumerVerification = productReadinessConsumerVerificationGuard(consumerVerificationLedger);
  const workflowAcceptanceReceipts = buildProductReadinessWorkflowAcceptanceReceipts(contractLike);
  mutateWorkflowAcceptanceReceipts(workflowAcceptanceReceipts, kind);
  const workflowAcceptance = productReadinessWorkflowAcceptanceGuard(workflowAcceptanceReceipts);
  const expectedBlockerCodes = EXPECTED_BLOCKERS[kind];
  const actualBlockerCodes = [...new Set([
    ...gate.blockerCodes,
    ...consumerProofMetadata.blockerCodes,
    ...schemaLookupMetadata.blockerCodes,
    ...consumerVerification.blockerCodes,
    ...workflowAcceptance.blockerCodes
  ])].sort();
  const expectedBlockersPresent = expectedBlockerCodes.every((code) => actualBlockerCodes.includes(code));
  const liveOk = gate.ok && consumerProofMetadata.ok && schemaLookupMetadata.ok && consumerVerification.ok && workflowAcceptance.ok;
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
          missingCustomerWorkflowIds: row.missingCustomerWorkflowIds,
          unknownCustomerWorkflowIds: row.unknownCustomerWorkflowIds,
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
    consumerVerification,
    workflowAcceptance,
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
