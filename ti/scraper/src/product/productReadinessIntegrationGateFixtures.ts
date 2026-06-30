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
export const PRODUCT_READINESS_OWNER_LANE_RECEIPT_EXAMPLES_SCHEMA_VERSION =
  "hanasand.product_readiness.owner_lane_receipt_examples.v1" as const;
export const PRODUCT_READINESS_OWNER_LANE_RECEIPT_EXAMPLES_GUARD_SCHEMA_VERSION =
  "hanasand.product_readiness.owner_lane_receipt_examples_guard.v1" as const;
export const PRODUCT_READINESS_LANE_SELF_VALIDATION_EXAMPLES_SCHEMA_VERSION =
  "hanasand.product_readiness.lane_self_validation_examples.v1" as const;
export const PRODUCT_READINESS_LANE_SELF_VALIDATION_GUARD_SCHEMA_VERSION =
  "hanasand.product_readiness.lane_self_validation_guard.v1" as const;
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
  | "missing_stale_threshold"
  | "missing_consumer_proof_command"
  | "prompt_literal_consumer_copy"
  | "missing_workflow_schema_lookup"
  | "partial_workflow_schema_lookup"
  | "stale_workflow_acceptance_receipt"
  | "untested_workflow_acceptance_receipt"
  | "missing_workflow_consumer"
  | "prompt_literal_workflow_copy"
  | "cross_workflow_inconsistency"
  | "missing_owner_lane_schema_lookup"
  | "stale_owner_lane_receipt_example"
  | "untested_owner_lane_receipt_example"
  | "missing_owner_lane_consumer"
  | "prompt_literal_owner_lane_copy"
  | "malformed_owner_lane_receipt_example"
  | "missing_lane_self_validation_example"
  | "stale_lane_self_validation_example"
  | "missing_lane_self_validation_route"
  | "prompt_literal_lane_self_validation_copy"
  | "malformed_lane_self_validation_payload";

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
  "missing_stale_threshold",
  "missing_consumer_proof_command",
  "prompt_literal_consumer_copy",
  "missing_workflow_schema_lookup",
  "partial_workflow_schema_lookup",
  "stale_workflow_acceptance_receipt",
  "untested_workflow_acceptance_receipt",
  "missing_workflow_consumer",
  "prompt_literal_workflow_copy",
  "cross_workflow_inconsistency",
  "missing_owner_lane_schema_lookup",
  "stale_owner_lane_receipt_example",
  "untested_owner_lane_receipt_example",
  "missing_owner_lane_consumer",
  "prompt_literal_owner_lane_copy",
  "malformed_owner_lane_receipt_example",
  "missing_lane_self_validation_example",
  "stale_lane_self_validation_example",
  "missing_lane_self_validation_route",
  "prompt_literal_lane_self_validation_copy",
  "malformed_lane_self_validation_payload"
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
  missing_stale_threshold: [
    "missing_consumer_stale_threshold",
    "missing_workflow_stale_threshold",
    "missing_owner_lane_stale_threshold",
    "missing_lane_self_validation_stale_threshold"
  ],
  missing_consumer_proof_command: ["missing_consumer_proof_command"],
  prompt_literal_consumer_copy: ["consumer_copy_guard_control_room", "consumer_copy_guard_signal"],
  missing_workflow_schema_lookup: ["missing_workflow_schema_lookup"],
  partial_workflow_schema_lookup: ["missing_expected_workflow_schema_lookup"],
  stale_workflow_acceptance_receipt: ["stale_workflow_acceptance_receipt"],
  untested_workflow_acceptance_receipt: ["untested_workflow_acceptance_receipt"],
  missing_workflow_consumer: ["missing_workflow_consumer"],
  prompt_literal_workflow_copy: ["workflow_copy_guard_how_this_feeds", "workflow_copy_guard_signal"],
  cross_workflow_inconsistency: ["cross_workflow_inconsistency"],
  missing_owner_lane_schema_lookup: ["missing_owner_lane_schema_lookup"],
  stale_owner_lane_receipt_example: ["stale_owner_lane_receipt_example"],
  untested_owner_lane_receipt_example: ["untested_owner_lane_receipt_example"],
  missing_owner_lane_consumer: ["missing_owner_lane_consumer"],
  prompt_literal_owner_lane_copy: ["owner_lane_copy_guard_control_room", "owner_lane_copy_guard_signal"],
  malformed_owner_lane_receipt_example: ["missing_owner_lane", "missing_owner_lane_self_validate_command", "missing_owner_lane_payload_shape"],
  missing_lane_self_validation_example: ["missing_lane_self_validation_example"],
  stale_lane_self_validation_example: ["stale_lane_self_validation_example"],
  missing_lane_self_validation_route: ["missing_lane_self_validation_route"],
  prompt_literal_lane_self_validation_copy: ["lane_self_validation_copy_guard_dashboard_slop", "lane_self_validation_copy_guard_signal"],
  malformed_lane_self_validation_payload: ["missing_lane_self_validation_owner", "missing_lane_self_validation_command", "missing_lane_self_validation_payload_shape"]
};

type ConsumerVerificationLedger = ReturnType<typeof buildProductReadinessConsumerVerificationLedger>;
type WorkflowAcceptanceReceipts = ReturnType<typeof buildProductReadinessWorkflowAcceptanceReceipts>;
type OwnerLaneReceiptExamples = ReturnType<typeof buildProductReadinessOwnerLaneReceiptExamples>;
type LaneSelfValidationExamples = ReturnType<typeof buildProductReadinessLaneSelfValidationExamples>;

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

const REQUIRED_SELF_VALIDATION_LANES = [
  "org",
  "watchlist",
  "source",
  "alert",
  "webhook",
  "case",
  "dashboard",
  "publicTI",
  "support",
  "website"
] as const;

const WORKFLOW_ACCEPTANCE_SPECS: Array<{
  workflowId: typeof REQUIRED_WORKFLOW_ACCEPTANCE_IDS[number];
  customerWorkflowIds: string[];
  capabilityIds: string[];
  schemaLookupContractIds: string[];
  producer: string;
  ownerLane: string;
}> = [
  {
    workflowId: "org_setup",
    customerWorkflowIds: ["org_membership"],
    capabilityIds: ["organization_lifecycle", "support_controls"],
    schemaLookupContractIds: ["product_readiness_receipt_matrix", "support_action_receipts"],
    producer: "contractIndex.productReadinessReceiptMatrix.organization_lifecycle",
    ownerLane: "org"
  },
  {
    workflowId: "shared_watchlists",
    customerWorkflowIds: ["shared_watchlists"],
    capabilityIds: ["shared_watchlists"],
    schemaLookupContractIds: ["product_readiness_receipt_matrix"],
    producer: "contractIndex.productReadinessReceiptMatrix.shared_watchlists",
    ownerLane: "watchlist"
  },
  {
    workflowId: "source_health",
    customerWorkflowIds: ["source_health"],
    capabilityIds: ["source_activation"],
    schemaLookupContractIds: ["source_provenance_receipts"],
    producer: "contractIndex.productReadinessReceiptMatrix.source_activation",
    ownerLane: "source"
  },
  {
    workflowId: "alert_generation",
    customerWorkflowIds: ["alert_generation"],
    capabilityIds: ["shared_watchlists", "source_activation", "alert_case_workflow"],
    schemaLookupContractIds: ["product_readiness_receipt_matrix", "source_provenance_receipts"],
    producer: "contractIndex.productReadinessReceiptMatrix.alert_case_workflow",
    ownerLane: "alert"
  },
  {
    workflowId: "webhook_delivery",
    customerWorkflowIds: ["webhook_delivery"],
    capabilityIds: ["alert_case_workflow", "webhook_delivery"],
    schemaLookupContractIds: ["webhook_delivery_receipts"],
    producer: "contractIndex.productReadinessReceiptMatrix.webhook_delivery",
    ownerLane: "webhook"
  },
  {
    workflowId: "case_workflow",
    customerWorkflowIds: ["case_workflow"],
    capabilityIds: ["alert_case_workflow", "dashboard_operator_workspace", "public_ti_actor_handoff"],
    schemaLookupContractIds: ["org_alert_case_action_receipt"],
    producer: "contractIndex.productReadinessReceiptMatrix.alert_case_workflow",
    ownerLane: "case"
  },
  {
    workflowId: "public_ti_handoff",
    customerWorkflowIds: ["public_ti_handoff"],
    capabilityIds: ["source_activation", "public_ti_actor_handoff", "website_product_surface"],
    schemaLookupContractIds: ["source_provenance_receipts", "product_readiness_receipt_matrix"],
    producer: "contractIndex.productReadinessReceiptMatrix.public_ti_actor_handoff",
    ownerLane: "publicTI"
  },
  {
    workflowId: "support_recovery",
    customerWorkflowIds: ["org_membership"],
    capabilityIds: ["support_controls"],
    schemaLookupContractIds: ["support_action_receipts"],
    producer: "contractIndex.productReadinessReceiptMatrix.support_controls",
    ownerLane: "support"
  },
  {
    workflowId: "website_readiness",
    customerWorkflowIds: ["public_ti_handoff"],
    capabilityIds: ["website_product_surface"],
    schemaLookupContractIds: ["product_readiness_receipt_matrix"],
    producer: "contractIndex.productReadinessReceiptMatrix.website_product_surface",
    ownerLane: "website"
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
    case "missing_stale_threshold":
      if (firstConsumer) firstConsumer.staleBefore = "";
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
        if (!verification.staleBefore) blockers.push("missing_consumer_stale_threshold");
        if (verification.verifiedAt && verification.staleBefore && verification.verifiedAt < verification.staleBefore) blockers.push("stale_consumer_verification");
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
        ownerLane: spec.ownerLane,
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
  const alertReceipt = receipts.receipts.find((receipt) => receipt.workflowId === "alert_generation");
  switch (kind) {
    case "missing_workflow_schema_lookup":
      if (sourceReceipt) sourceReceipt.schemaLookupRefs = [];
      break;
    case "partial_workflow_schema_lookup":
      if (alertReceipt) {
        alertReceipt.schemaLookupRefs = alertReceipt.schemaLookupRefs.filter((ref) => ref.contractId !== "source_provenance_receipts");
      }
      break;
    case "stale_workflow_acceptance_receipt":
      if (sourceReceipt) sourceReceipt.focusedCheck.checkedAt = "2026-06-01T00:00:00.000Z";
      break;
    case "missing_stale_threshold":
      if (sourceReceipt) sourceReceipt.focusedCheck.staleBefore = "";
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
    const presentSchemaLookupContractIds = new Set(receipt.schemaLookupRefs.map((ref) => ref.contractId).filter(Boolean));
    const missingExpectedSchemaLookupContractIds = receipt.schemaLookupContractIds.filter((contractId) => !presentSchemaLookupContractIds.has(contractId));
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
      ...(!receipt.ownerLane ? ["missing_workflow_owner_lane"] : []),
      ...(!receipt.schemaLookupRefs.length ? ["missing_workflow_schema_lookup"] : []),
      ...missingExpectedSchemaLookupContractIds.map(() => "missing_expected_workflow_schema_lookup"),
      ...(!receipt.producer ? ["missing_workflow_producer"] : []),
      ...(!receipt.consumers.length ? ["missing_workflow_consumer"] : []),
      ...(!receipt.focusedCheck?.command ? ["missing_workflow_check_command"] : []),
      ...(receipt.focusedCheck?.result !== "pass" ? ["untested_workflow_acceptance_receipt"] : []),
      ...(!receipt.focusedCheck?.checkedAt ? ["missing_workflow_verified_at"] : []),
      ...(!receipt.focusedCheck?.staleBefore ? ["missing_workflow_stale_threshold"] : []),
      ...(receipt.focusedCheck?.checkedAt && receipt.focusedCheck.staleBefore && receipt.focusedCheck.checkedAt < receipt.focusedCheck.staleBefore ? ["stale_workflow_acceptance_receipt"] : []),
      ...missingExpectedCustomerWorkflows.map(() => "cross_workflow_inconsistency"),
      ...copyBlockers,
      ...unsafeFields.map(() => "unsafe_workflow_acceptance_receipt")
    ];
    return {
      workflowId: receipt.workflowId,
      ownerLane: receipt.ownerLane,
      ok: blockerCodes.length === 0,
      blockerCodes: [...new Set(blockerCodes)].sort(),
      customerWorkflowIds: receipt.customerWorkflowIds,
      missingExpectedCustomerWorkflows,
      capabilityIds: receipt.capabilityIds,
      schemaLookupContractIds: receipt.schemaLookupContractIds,
      missingExpectedSchemaLookupContractIds,
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

export function buildProductReadinessOwnerLaneReceiptExamples(workflowReceipts: WorkflowAcceptanceReceipts) {
  return {
    schemaVersion: PRODUCT_READINESS_OWNER_LANE_RECEIPT_EXAMPLES_SCHEMA_VERSION,
    route: "/v1/contracts",
    verifiedAt: PRODUCT_READINESS_CONSUMER_VERIFIED_AT,
    staleBefore: PRODUCT_READINESS_CONSUMER_STALE_BEFORE,
    proofCommand: PRODUCT_READINESS_CONSUMER_PROOF_COMMAND,
    examples: workflowReceipts.receipts.map((receipt) => ({
      exampleId: `${receipt.workflowId}_owner_lane_receipt_example`,
      workflowId: receipt.workflowId,
      ownerLane: receipt.ownerLane,
      customerWorkflowIds: receipt.customerWorkflowIds,
      capabilityIds: receipt.capabilityIds,
      schemaLookupContractIds: receipt.schemaLookupContractIds,
      schemaLookupRefs: receipt.schemaLookupRefs,
      producer: receipt.producer,
      consumerOwnerLanes: [...new Set(receipt.consumers.map((consumer) => consumer.ownerLane).filter(Boolean))].sort(),
      consumerRoutes: receipt.consumers.map((consumer) => consumer.route).filter(Boolean).sort(),
      focusedCheck: receipt.focusedCheck,
      selfValidateCommand: PRODUCT_READINESS_CONSUMER_PROOF_COMMAND,
      payloadShape: {
        schemaVersion: PRODUCT_READINESS_WORKFLOW_ACCEPTANCE_RECEIPTS_SCHEMA_VERSION,
        requiredFields: [
          "workflowId",
          "ownerLane",
          "customerWorkflowIds",
          "capabilityIds",
          "schemaLookupContractIds",
          "schemaLookupRefs",
          "producer",
          "consumers",
          "focusedCheck",
          "safeOutput"
        ],
        forbiddenFields: ["rawText", "html", "webhookUrl", "authorization", "password", "credential"]
      },
      uiCopyLabel: `${receipt.workflowId}_owner_lane_receipt_example`,
      safeOutput: receipt.safeOutput
    })),
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

function mutateOwnerLaneReceiptExamples(examples: OwnerLaneReceiptExamples, kind: ProductReadinessIntegrationGateFixtureKind) {
  const sourceExample = examples.examples.find((example) => example.workflowId === "source_health");
  switch (kind) {
    case "missing_owner_lane_schema_lookup":
      if (sourceExample) sourceExample.schemaLookupRefs = [];
      break;
    case "stale_owner_lane_receipt_example":
      if (sourceExample) sourceExample.focusedCheck.checkedAt = "2026-06-01T00:00:00.000Z";
      break;
    case "untested_owner_lane_receipt_example":
      if (sourceExample) sourceExample.focusedCheck.result = "not_run" as "pass";
      break;
    case "missing_owner_lane_consumer":
      if (sourceExample) sourceExample.consumerOwnerLanes = [];
      break;
    case "prompt_literal_owner_lane_copy":
      if (sourceExample) sourceExample.uiCopyLabel = "control room signal";
      break;
    case "malformed_owner_lane_receipt_example":
      if (sourceExample) {
        sourceExample.ownerLane = "";
        sourceExample.selfValidateCommand = "";
        sourceExample.payloadShape.requiredFields = [];
      }
      break;
  }
}

export function productReadinessOwnerLaneReceiptExamplesGuard(examples: OwnerLaneReceiptExamples) {
  const forbiddenTerms = ["control room", "how this feeds", "dashboard slop", "named examples", "signal", "acceptance criteria", "acceptance-criteria"];
  const exampleWorkflowIds = new Set(examples.examples.map((example) => example.workflowId));
  const missingWorkflowIds = REQUIRED_WORKFLOW_ACCEPTANCE_IDS.filter((workflowId) => !exampleWorkflowIds.has(workflowId));
  const rows = examples.examples.map((example) => {
    const unsafeFields = [
      !example.safeOutput?.metadataOnly ? "safeOutput.metadataOnly" : "",
      example.safeOutput?.rawEvidenceExposed ? "safeOutput.rawEvidenceExposed" : "",
      example.safeOutput?.webhookSecretExposed ? "safeOutput.webhookSecretExposed" : "",
      example.safeOutput?.crossOrgDataExposed ? "safeOutput.crossOrgDataExposed" : ""
    ].filter(Boolean);
    const label = String(example.uiCopyLabel || "").toLowerCase();
    const copyBlockers = forbiddenTerms
      .filter((term) => label.includes(term))
      .map((term) => `owner_lane_copy_guard_${term.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`);
    const requiredPayloadFields = Array.isArray(example.payloadShape?.requiredFields) ? example.payloadShape.requiredFields : [];
    const presentSchemaLookupContractIds = new Set(example.schemaLookupRefs.map((ref) => ref.contractId).filter(Boolean));
    const missingExpectedSchemaLookupContractIds = example.schemaLookupContractIds.filter((contractId) => !presentSchemaLookupContractIds.has(contractId));
    const blockerCodes = [
      ...(!example.ownerLane ? ["missing_owner_lane"] : []),
      ...(!example.schemaLookupRefs.length ? ["missing_owner_lane_schema_lookup"] : []),
      ...missingExpectedSchemaLookupContractIds.map(() => "missing_expected_owner_lane_schema_lookup"),
      ...(!example.producer ? ["missing_owner_lane_producer"] : []),
      ...(!example.consumerOwnerLanes.length ? ["missing_owner_lane_consumer"] : []),
      ...(!example.focusedCheck?.command ? ["missing_owner_lane_check_command"] : []),
      ...(example.focusedCheck?.result !== "pass" ? ["untested_owner_lane_receipt_example"] : []),
      ...(!example.focusedCheck?.checkedAt ? ["missing_owner_lane_verified_at"] : []),
      ...(!example.focusedCheck?.staleBefore ? ["missing_owner_lane_stale_threshold"] : []),
      ...(example.focusedCheck?.checkedAt && example.focusedCheck.staleBefore && example.focusedCheck.checkedAt < example.focusedCheck.staleBefore ? ["stale_owner_lane_receipt_example"] : []),
      ...(!example.selfValidateCommand ? ["missing_owner_lane_self_validate_command"] : []),
      ...(!requiredPayloadFields.length ? ["missing_owner_lane_payload_shape"] : []),
      ...copyBlockers,
      ...unsafeFields.map(() => "unsafe_owner_lane_receipt_example")
    ];
    return {
      exampleId: example.exampleId,
      workflowId: example.workflowId,
      ownerLane: example.ownerLane,
      ok: blockerCodes.length === 0,
      blockerCodes: [...new Set(blockerCodes)].sort(),
      customerWorkflowIds: example.customerWorkflowIds,
      capabilityIds: example.capabilityIds,
      schemaLookupContractIds: example.schemaLookupContractIds,
      missingExpectedSchemaLookupContractIds,
      schemaLookupRefCount: example.schemaLookupRefs.length,
      consumerOwnerLanes: example.consumerOwnerLanes,
      consumerRouteCount: example.consumerRoutes.length,
      focusedCheck: example.focusedCheck,
      selfValidateCommand: example.selfValidateCommand,
      payloadShapeRequiredFieldCount: requiredPayloadFields.length,
      unsafeFields
    };
  });
  const blockerCodes = [...new Set([
    ...missingWorkflowIds.map(() => "missing_owner_lane_receipt_example"),
    ...rows.flatMap((row) => row.blockerCodes)
  ])].sort();
  return {
    schemaVersion: PRODUCT_READINESS_OWNER_LANE_RECEIPT_EXAMPLES_GUARD_SCHEMA_VERSION,
    route: "/v1/contracts",
    ok: blockerCodes.length === 0,
    rowCount: rows.length,
    requiredWorkflowIds: [...REQUIRED_WORKFLOW_ACCEPTANCE_IDS],
    missingWorkflowIds,
    verifiedAt: examples.verifiedAt,
    staleBefore: examples.staleBefore,
    proofCommand: examples.proofCommand,
    blockerCodes,
    rows,
    safeOutput: examples.safeOutput
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

export function buildProductReadinessLaneSelfValidationExamples(ownerLaneExamples: OwnerLaneReceiptExamples) {
  return {
    schemaVersion: PRODUCT_READINESS_LANE_SELF_VALIDATION_EXAMPLES_SCHEMA_VERSION,
    route: "/v1/contracts",
    verifiedAt: PRODUCT_READINESS_CONSUMER_VERIFIED_AT,
    staleBefore: PRODUCT_READINESS_CONSUMER_STALE_BEFORE,
    proofCommand: PRODUCT_READINESS_CONSUMER_PROOF_COMMAND,
    examples: REQUIRED_SELF_VALIDATION_LANES.map((lane) => {
      const related = ownerLaneExamples.examples.filter((example) => (
        example.ownerLane === lane || example.consumerOwnerLanes.includes(lane)
      ));
      const producerWorkflows = related.filter((example) => example.ownerLane === lane).map((example) => example.workflowId);
      const consumerWorkflows = related.filter((example) => example.consumerOwnerLanes.includes(lane)).map((example) => example.workflowId);
      const routeRefs = uniqueSorted([
        ...related.flatMap((example) => example.schemaLookupRefs.map((ref) => ref.route)),
        ...related.flatMap((example) => example.consumerRoutes)
      ]);
      return {
        laneId: lane,
        ownerLane: lane,
        producerWorkflowIds: uniqueSorted(producerWorkflows),
        consumerWorkflowIds: uniqueSorted(consumerWorkflows),
        workflowIds: uniqueSorted(related.map((example) => example.workflowId)),
        customerWorkflowIds: uniqueSorted(related.flatMap((example) => example.customerWorkflowIds)),
        capabilityIds: uniqueSorted(related.flatMap((example) => example.capabilityIds)),
        schemaLookupContractIds: uniqueSorted(related.flatMap((example) => example.schemaLookupContractIds)),
        schemaLookupRefs: related.flatMap((example) => example.schemaLookupRefs),
        routeRefs,
        focusedCheck: {
          command: PRODUCT_READINESS_CONSUMER_PROOF_COMMAND,
          result: "pass" as const,
          checkedAt: PRODUCT_READINESS_CONSUMER_VERIFIED_AT,
          staleBefore: PRODUCT_READINESS_CONSUMER_STALE_BEFORE
        },
        selfValidateCommand: PRODUCT_READINESS_CONSUMER_PROOF_COMMAND,
        payloadShape: {
          schemaVersion: PRODUCT_READINESS_LANE_SELF_VALIDATION_EXAMPLES_SCHEMA_VERSION,
          requiredFields: [
            "laneId",
            "ownerLane",
            "workflowIds",
            "customerWorkflowIds",
            "schemaLookupContractIds",
            "schemaLookupRefs",
            "routeRefs",
            "focusedCheck",
            "selfValidateCommand",
            "safeOutput"
          ],
          forbiddenFields: ["rawText", "html", "webhookUrl", "authorization", "password", "credential"]
        },
        uiCopyLabel: `${lane}_lane_self_validation_example`,
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

function mutateLaneSelfValidationExamples(examples: LaneSelfValidationExamples, kind: ProductReadinessIntegrationGateFixtureKind) {
  const dashboardExample = examples.examples.find((example) => example.laneId === "dashboard");
  switch (kind) {
    case "missing_lane_self_validation_example":
      examples.examples = examples.examples.filter((example) => example.laneId !== "dashboard");
      break;
    case "stale_lane_self_validation_example":
      if (dashboardExample) dashboardExample.focusedCheck.checkedAt = "2026-06-01T00:00:00.000Z";
      break;
    case "missing_stale_threshold":
      if (dashboardExample) dashboardExample.focusedCheck.staleBefore = "";
      break;
    case "missing_lane_self_validation_route":
      if (dashboardExample) dashboardExample.routeRefs = [];
      break;
    case "prompt_literal_lane_self_validation_copy":
      if (dashboardExample) dashboardExample.uiCopyLabel = "dashboard slop signal";
      break;
    case "malformed_lane_self_validation_payload":
      if (dashboardExample) {
        dashboardExample.ownerLane = "" as typeof dashboardExample.ownerLane;
        dashboardExample.selfValidateCommand = "";
        dashboardExample.payloadShape.requiredFields = [];
      }
      break;
  }
}

export function productReadinessLaneSelfValidationGuard(examples: LaneSelfValidationExamples) {
  const forbiddenTerms = ["control room", "how this feeds", "dashboard slop", "named examples", "signal", "acceptance criteria", "acceptance-criteria"];
  const laneIds = new Set(examples.examples.map((example) => example.laneId));
  const missingLaneIds = REQUIRED_SELF_VALIDATION_LANES.filter((lane) => !laneIds.has(lane));
  const rows = examples.examples.map((example) => {
    const unsafeFields = [
      !example.safeOutput?.metadataOnly ? "safeOutput.metadataOnly" : "",
      example.safeOutput?.rawEvidenceExposed ? "safeOutput.rawEvidenceExposed" : "",
      example.safeOutput?.webhookSecretExposed ? "safeOutput.webhookSecretExposed" : "",
      example.safeOutput?.crossOrgDataExposed ? "safeOutput.crossOrgDataExposed" : ""
    ].filter(Boolean);
    const label = String(example.uiCopyLabel || "").toLowerCase();
    const copyBlockers = forbiddenTerms
      .filter((term) => label.includes(term))
      .map((term) => `lane_self_validation_copy_guard_${term.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`);
    const requiredPayloadFields = Array.isArray(example.payloadShape?.requiredFields) ? example.payloadShape.requiredFields : [];
    const presentSchemaLookupContractIds = new Set(example.schemaLookupRefs.map((ref) => ref.contractId).filter(Boolean));
    const missingExpectedSchemaLookupContractIds = example.schemaLookupContractIds.filter((contractId) => !presentSchemaLookupContractIds.has(contractId));
    const blockerCodes = [
      ...(!example.ownerLane ? ["missing_lane_self_validation_owner"] : []),
      ...(!example.workflowIds.length ? ["missing_lane_self_validation_workflow"] : []),
      ...(!example.schemaLookupRefs.length ? ["missing_lane_self_validation_schema_lookup"] : []),
      ...missingExpectedSchemaLookupContractIds.map(() => "missing_expected_lane_schema_lookup"),
      ...(!example.routeRefs.length ? ["missing_lane_self_validation_route"] : []),
      ...(!example.focusedCheck?.command ? ["missing_lane_self_validation_check_command"] : []),
      ...(example.focusedCheck?.result !== "pass" ? ["untested_lane_self_validation_example"] : []),
      ...(!example.focusedCheck?.checkedAt ? ["missing_lane_self_validation_verified_at"] : []),
      ...(!example.focusedCheck?.staleBefore ? ["missing_lane_self_validation_stale_threshold"] : []),
      ...(example.focusedCheck?.checkedAt && example.focusedCheck.staleBefore && example.focusedCheck.checkedAt < example.focusedCheck.staleBefore ? ["stale_lane_self_validation_example"] : []),
      ...(!example.selfValidateCommand ? ["missing_lane_self_validation_command"] : []),
      ...(!requiredPayloadFields.length ? ["missing_lane_self_validation_payload_shape"] : []),
      ...copyBlockers,
      ...unsafeFields.map(() => "unsafe_lane_self_validation_example")
    ];
    return {
      laneId: example.laneId,
      ownerLane: example.ownerLane,
      ok: blockerCodes.length === 0,
      blockerCodes: [...new Set(blockerCodes)].sort(),
      producerWorkflowIds: example.producerWorkflowIds,
      consumerWorkflowIds: example.consumerWorkflowIds,
      workflowIds: example.workflowIds,
      customerWorkflowIds: example.customerWorkflowIds,
      schemaLookupContractIds: example.schemaLookupContractIds,
      missingExpectedSchemaLookupContractIds,
      schemaLookupRefCount: example.schemaLookupRefs.length,
      routeRefs: example.routeRefs,
      focusedCheck: example.focusedCheck,
      selfValidateCommand: example.selfValidateCommand,
      payloadShapeRequiredFieldCount: requiredPayloadFields.length,
      unsafeFields
    };
  });
  const blockerCodes = [...new Set([
    ...missingLaneIds.map(() => "missing_lane_self_validation_example"),
    ...rows.flatMap((row) => row.blockerCodes)
  ])].sort();
  return {
    schemaVersion: PRODUCT_READINESS_LANE_SELF_VALIDATION_GUARD_SCHEMA_VERSION,
    route: "/v1/contracts",
    ok: blockerCodes.length === 0,
    rowCount: rows.length,
    requiredLaneIds: [...REQUIRED_SELF_VALIDATION_LANES],
    missingLaneIds,
    verifiedAt: examples.verifiedAt,
    staleBefore: examples.staleBefore,
    proofCommand: examples.proofCommand,
    blockerCodes,
    rows,
    safeOutput: examples.safeOutput
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
  const ownerLaneReceiptExamples = buildProductReadinessOwnerLaneReceiptExamples(workflowAcceptanceReceipts);
  mutateOwnerLaneReceiptExamples(ownerLaneReceiptExamples, kind);
  const ownerLaneReceiptExamplesGuard = productReadinessOwnerLaneReceiptExamplesGuard(ownerLaneReceiptExamples);
  const laneSelfValidationExamples = buildProductReadinessLaneSelfValidationExamples(ownerLaneReceiptExamples);
  mutateLaneSelfValidationExamples(laneSelfValidationExamples, kind);
  const laneSelfValidation = productReadinessLaneSelfValidationGuard(laneSelfValidationExamples);
  const expectedBlockerCodes = EXPECTED_BLOCKERS[kind];
  const actualBlockerCodes = [...new Set([
    ...gate.blockerCodes,
    ...consumerProofMetadata.blockerCodes,
    ...schemaLookupMetadata.blockerCodes,
    ...consumerVerification.blockerCodes,
    ...workflowAcceptance.blockerCodes,
    ...ownerLaneReceiptExamplesGuard.blockerCodes,
    ...laneSelfValidation.blockerCodes
  ])].sort();
  const expectedBlockersPresent = expectedBlockerCodes.every((code) => actualBlockerCodes.includes(code));
  const liveOk = gate.ok
    && consumerProofMetadata.ok
    && schemaLookupMetadata.ok
    && consumerVerification.ok
    && workflowAcceptance.ok
    && ownerLaneReceiptExamplesGuard.ok
    && laneSelfValidation.ok;
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
    ownerLaneReceiptExamples: ownerLaneReceiptExamplesGuard,
    laneSelfValidation,
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
