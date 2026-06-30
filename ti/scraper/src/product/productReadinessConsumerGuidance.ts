import { uniqueStrings } from "../utils.ts";

export const PRODUCT_READINESS_CONSUMER_GUIDANCE_SCHEMA_VERSION = "hanasand.product_readiness.consumer_guidance.v1" as const;
export const PRODUCT_READINESS_ORG_ALERT_CONSUMER_PACKET_FIXTURE_SCHEMA_VERSION = "hanasand.product_readiness.org_alert_consumer_packet_fixture.v1" as const;
export const PRODUCT_READINESS_END_TO_END_WORKFLOW_PACKET_SCHEMA_VERSION = "hanasand.product_readiness.end_to_end_workflow_packet.v1" as const;
export const PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION = "hanasand.product_readiness.customer_workflow_envelope.v1" as const;
export const PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_COMPATIBILITY_SCHEMA_VERSION = "hanasand.product_readiness.customer_workflow_envelope_compatibility.v1" as const;
export const PRODUCT_READINESS_CUSTOMER_WORKFLOW_CONSUMER_FIXTURE_SCHEMA_VERSION = "hanasand.product_readiness.customer_workflow_consumer_fixture.v1" as const;

export type ProductReadinessConsumerState = "ready" | "partial" | "blocked" | "unsupported";
export type ProductReadinessConsumerLane = "org" | "dashboard" | "publicTI" | "alert" | "webhook" | "case" | "helpdesk" | "website" | "integration";

type SafeOutput = {
  metadataOnly?: boolean;
  rawEvidenceExposed?: boolean;
  webhookSecretExposed?: boolean;
  crossOrgDataExposed?: boolean;
};

type ProductReadinessConsumerHandoffRow = {
  consumerId: string;
  state: ProductReadinessConsumerState | string;
  ownerLane: string;
  route: string;
  proof?: {
    routes?: readonly string[];
    contractIds?: readonly string[];
    schemaIds?: readonly string[];
    receiptSchemaIds?: readonly string[];
  };
  fieldAliases?: Record<string, string>;
  orgCapabilityIds: readonly string[];
  missingCapabilityIds?: readonly string[];
  missingFieldAliases?: readonly string[];
  blockerCodes?: readonly string[];
  safeOutput?: SafeOutput;
};

type ProductReadinessOrgCapabilityRow = {
  orgCapabilityId: string;
  workflowId: string;
  state: ProductReadinessConsumerState | string;
  ownerLane: string;
  ownerLanes?: readonly string[];
  proof?: {
    route?: string;
    readinessRoutes?: readonly string[];
    contractIds?: readonly string[];
    schemaIds?: readonly string[];
    receiptSchemaIds?: readonly string[];
  };
  readinessFields?: readonly string[];
  missingReadinessFields?: readonly string[];
  blockerCodes?: readonly string[];
  safeOutput?: SafeOutput;
};

type ProductReadinessSchemaLookupRow = {
  schemaId: string;
  contractId: string;
  route?: string;
  ownerLane?: string;
};

export type ProductReadinessConsumerGuidanceInput = {
  productReadinessConsumerHandoffPacket?: {
    schemaVersion?: string;
    route?: string;
    rows?: ProductReadinessConsumerHandoffRow[];
  };
  productReadinessOrgCapabilityPacket?: {
    schemaVersion?: string;
    route?: string;
    rows?: ProductReadinessOrgCapabilityRow[];
  };
  schemaLookup?: {
    rows?: ProductReadinessSchemaLookupRow[];
  };
};

export type ProductReadinessConsumerGuidanceField = {
  alias: string;
  sourceField: string;
  present: boolean;
  required: true;
};

export type ProductReadinessConsumerGuidanceRow = {
  laneId: ProductReadinessConsumerLane;
  state: ProductReadinessConsumerState;
  ownerLane: string;
  route: string;
  consumerId?: string;
  orgCapabilityIds: string[];
  workflowIds: string[];
  typedFields: ProductReadinessConsumerGuidanceField[];
  missingTypedFields: string[];
  proofLink: {
    route: string;
    contractIds: string[];
    schemaIds: string[];
    receiptSchemaIds: string[];
  };
  blockerCodes: string[];
  safeOutput: Required<SafeOutput>;
};

export type ProductReadinessEndToEndWorkflowStepId =
  | "organization_access"
  | "shared_watchlist"
  | "source_coverage"
  | "matched_alert"
  | "analyst_case"
  | "webhook_destination"
  | "delivery_outcome"
  | "support_audit"
  | "deploy_eligibility";

export type ProductReadinessEndToEndWorkflowField = {
  alias: string;
  sourceField: string;
  stepId: ProductReadinessEndToEndWorkflowStepId;
  consumerLane: ProductReadinessConsumerLane;
  present: boolean;
};

export type ProductReadinessEndToEndWorkflowStep = {
  stepId: ProductReadinessEndToEndWorkflowStepId;
  state: ProductReadinessConsumerState;
  consumerLane: ProductReadinessConsumerLane;
  ownerLane: string;
  route: string;
  typedFields: ProductReadinessEndToEndWorkflowField[];
  missingTypedFields: string[];
  blockerCodes: string[];
  proofLink: ProductReadinessConsumerGuidanceRow["proofLink"];
};

export type ProductReadinessConsumerImplementationNote = {
  consumerLane: ProductReadinessConsumerLane;
  route: string;
  consumesSchemaVersion: typeof PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION;
  requiredFields: string[];
  packetPath: string;
  proofPath: string;
  expectedStates: ProductReadinessConsumerState[];
};

type ProductReadinessConsumerDefinition = {
  laneId: ProductReadinessConsumerLane;
  ownerLane: string;
  route: string;
  consumerId?: string;
  orgCapabilityIds: string[];
  requiredTypedFields: Record<string, string>;
};

type ProductReadinessWorkflowStepDefinition = {
  stepId: ProductReadinessEndToEndWorkflowStepId;
  consumerLane: ProductReadinessConsumerLane;
  requiredFields: Record<string, string>;
};

const safeMetadataOnly = {
  metadataOnly: true,
  rawEvidenceExposed: false,
  webhookSecretExposed: false,
  crossOrgDataExposed: false
};

const consumerDefinitions: ProductReadinessConsumerDefinition[] = [
  {
    laneId: "org",
    ownerLane: "org",
    route: "/v1/organizations",
    orgCapabilityIds: ["organization_membership", "shared_watchlist_scope"],
    requiredTypedFields: {
      orgId: "organizationId",
      watchlistId: "watchlistId",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink"
    }
  },
  {
    laneId: "dashboard",
    ownerLane: "dashboard",
    route: "/dashboard",
    consumerId: "dashboard_readiness",
    orgCapabilityIds: ["organization_membership", "shared_watchlist_scope", "org_scoped_alert_bridge", "destination_delivery_state", "case_workflow_state", "source_coverage_state", "public_ti_handoff"],
    requiredTypedFields: {
      orgId: "organizationId",
      watchlistId: "watchlistId",
      alertId: "alertId",
      caseId: "caseId",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink"
    }
  },
  {
    laneId: "publicTI",
    ownerLane: "publicTI",
    route: "/ti",
    consumerId: "public_ti_handoff",
    orgCapabilityIds: ["source_coverage_state", "public_ti_handoff", "shared_watchlist_scope"],
    requiredTypedFields: {
      orgId: "organizationId",
      watchlistId: "watchlistId",
      provenanceHash: "provenanceHash",
      sourceCoverage: "sourceCoverageState",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink"
    }
  },
  {
    laneId: "alert",
    ownerLane: "alert",
    route: "/v1/dwm/alerts/generation-readiness",
    consumerId: "alert_generation",
    orgCapabilityIds: ["shared_watchlist_scope", "org_scoped_alert_bridge", "source_coverage_state"],
    requiredTypedFields: {
      orgId: "organizationId",
      watchlistId: "watchlistId",
      alertId: "alertId",
      caseId: "caseId",
      provenanceHash: "provenanceHash",
      sourceCoverage: "sourceCoverageState",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink"
    }
  },
  {
    laneId: "webhook",
    ownerLane: "webhook",
    route: "/v1/dwm/webhooks/deliver",
    consumerId: "webhook_delivery",
    orgCapabilityIds: ["org_scoped_alert_bridge", "destination_delivery_state", "case_workflow_state"],
    requiredTypedFields: {
      orgId: "organizationId",
      alertId: "alertId",
      caseId: "caseId",
      workflowState: "workflowState",
      destinationDeliveryState: "destinationDeliveryState",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink"
    }
  },
  {
    laneId: "case",
    ownerLane: "case",
    route: "/v1/dwm/cases",
    orgCapabilityIds: ["org_scoped_alert_bridge", "case_workflow_state", "destination_delivery_state"],
    requiredTypedFields: {
      orgId: "organizationId",
      alertId: "alertId",
      caseId: "caseId",
      workflowState: "workflowState",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink"
    }
  },
  {
    laneId: "helpdesk",
    ownerLane: "support",
    route: "/api/admin/support/readiness",
    consumerId: "support_audit",
    orgCapabilityIds: ["organization_membership", "destination_delivery_state", "case_workflow_state"],
    requiredTypedFields: {
      orgId: "organizationId",
      alertId: "alertId",
      caseId: "caseId",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink"
    }
  },
  {
    laneId: "website",
    ownerLane: "website",
    route: "/",
    consumerId: "public_ti_handoff",
    orgCapabilityIds: ["source_coverage_state", "public_ti_handoff"],
    requiredTypedFields: {
      orgId: "organizationId",
      provenanceHash: "provenanceHash",
      sourceCoverage: "sourceCoverageState",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink"
    }
  },
  {
    laneId: "integration",
    ownerLane: "integration",
    route: "/v1/contracts",
    orgCapabilityIds: ["organization_membership", "shared_watchlist_scope", "org_scoped_alert_bridge", "destination_delivery_state", "case_workflow_state", "source_coverage_state", "public_ti_handoff"],
    requiredTypedFields: {
      orgId: "organizationId",
      watchlistId: "watchlistId",
      alertId: "alertId",
      caseId: "caseId",
      provenanceHash: "provenanceHash",
      sourceCoverage: "sourceCoverageState",
      workflowState: "workflowState",
      destinationDeliveryState: "destinationDeliveryState",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink"
    }
  }
];

const endToEndWorkflowDefinitions: ProductReadinessWorkflowStepDefinition[] = [
  {
    stepId: "organization_access",
    consumerLane: "org",
    requiredFields: {
      orgId: "organizationId",
      memberRef: "member.status",
      inviteRef: "invite.status",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink",
      lastVerifiedAt: "lastVerifiedAt"
    }
  },
  {
    stepId: "shared_watchlist",
    consumerLane: "org",
    requiredFields: {
      orgId: "organizationId",
      watchlistId: "watchlistId",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink",
      lastVerifiedAt: "lastVerifiedAt"
    }
  },
  {
    stepId: "source_coverage",
    consumerLane: "publicTI",
    requiredFields: {
      orgId: "organizationId",
      sourceCoverageId: "sourceIds[0]",
      sourceCoverageIds: "sourceIds",
      provenanceHash: "provenanceHash",
      sourceCoverage: "sourceCoverageState",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink",
      lastVerifiedAt: "lastVerifiedAt"
    }
  },
  {
    stepId: "matched_alert",
    consumerLane: "alert",
    requiredFields: {
      orgId: "organizationId",
      watchlistId: "watchlistId",
      alertId: "alertId",
      caseId: "caseId",
      sourceCoverageId: "sourceIds[0]",
      provenanceHash: "provenanceHash",
      sourceCoverage: "sourceCoverageState",
      workflowStatus: "workflowState",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink",
      lastVerifiedAt: "lastVerifiedAt"
    }
  },
  {
    stepId: "analyst_case",
    consumerLane: "case",
    requiredFields: {
      orgId: "organizationId",
      alertId: "alertId",
      caseId: "caseId",
      workflowStatus: "workflowState",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink",
      lastVerifiedAt: "lastVerifiedAt"
    }
  },
  {
    stepId: "webhook_destination",
    consumerLane: "webhook",
    requiredFields: {
      orgId: "organizationId",
      alertId: "alertId",
      caseId: "caseId",
      destinationDeliveryState: "destinationDeliveryState",
      deliveryStatus: "destinationDeliveryState",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink",
      lastVerifiedAt: "lastVerifiedAt"
    }
  },
  {
    stepId: "delivery_outcome",
    consumerLane: "webhook",
    requiredFields: {
      orgId: "organizationId",
      alertId: "alertId",
      caseId: "caseId",
      deliveryStatus: "destinationDeliveryState",
      workflowStatus: "workflowState",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink",
      lastVerifiedAt: "lastVerifiedAt"
    }
  },
  {
    stepId: "support_audit",
    consumerLane: "helpdesk",
    requiredFields: {
      orgId: "organizationId",
      alertId: "alertId",
      caseId: "caseId",
      supportAuditStatus: "supportAction.status",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink",
      lastVerifiedAt: "lastVerifiedAt"
    }
  },
  {
    stepId: "deploy_eligibility",
    consumerLane: "integration",
    requiredFields: {
      orgId: "organizationId",
      version: "schemaVersion",
      watchlistId: "watchlistId",
      alertId: "alertId",
      caseId: "caseId",
      provenanceHash: "provenanceHash",
      sourceCoverage: "sourceCoverageState",
      workflowStatus: "workflowState",
      destinationDeliveryState: "destinationDeliveryState",
      supportAuditStatus: "supportAction.status",
      blockerReason: "blockerCodes",
      owningLane: "ownerLane",
      proofLink: "proofLink",
      lastVerifiedAt: "lastVerifiedAt"
    }
  }
];

const requiredEnvelopeFieldAliases = [
  "version",
  "orgId",
  "memberRef",
  "inviteRef",
  "watchlistId",
  "alertId",
  "caseId",
  "sourceCoverageId",
  "sourceCoverageIds",
  "provenanceHash",
  "workflowStatus",
  "destinationDeliveryState",
  "deliveryStatus",
  "supportAuditStatus",
  "blockerReason",
  "owningLane",
  "proofLink",
  "lastVerifiedAt"
];

const workflowConsumerFixtureLanes: ProductReadinessConsumerLane[] = ["dashboard", "website", "integration"];

const consumerImplementationNotes: ProductReadinessConsumerImplementationNote[] = [
  {
    consumerLane: "dashboard",
    route: "/dashboard",
    consumesSchemaVersion: PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION,
    requiredFields: ["orgId", "watchlistId", "alertId", "caseId", "workflowStatus", "deliveryStatus", "blockerReason", "proofLink"],
    packetPath: "workflowPacket.steps",
    proofPath: "workflowPacket.steps[].proofLink",
    expectedStates: ["ready", "partial", "blocked", "unsupported"]
  },
  {
    consumerLane: "publicTI",
    route: "/ti",
    consumesSchemaVersion: PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION,
    requiredFields: ["orgId", "sourceCoverageIds", "provenanceHash", "sourceCoverage", "proofLink"],
    packetPath: "workflowPacket.steps[source_coverage]",
    proofPath: "workflowPacket.steps[source_coverage].proofLink",
    expectedStates: ["ready", "partial", "blocked"]
  },
  {
    consumerLane: "org",
    route: "/v1/organizations",
    consumesSchemaVersion: PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION,
    requiredFields: ["orgId", "memberRef", "inviteRef", "watchlistId", "blockerReason", "proofLink"],
    packetPath: "workflowPacket.steps[organization_access|shared_watchlist]",
    proofPath: "workflowPacket.steps[].proofLink",
    expectedStates: ["ready", "partial", "blocked", "unsupported"]
  },
  {
    consumerLane: "alert",
    route: "/v1/dwm/alerts/generation-readiness",
    consumesSchemaVersion: PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION,
    requiredFields: ["orgId", "watchlistId", "alertId", "caseId", "provenanceHash", "sourceCoverage", "workflowStatus", "proofLink"],
    packetPath: "workflowPacket.steps[matched_alert]",
    proofPath: "workflowPacket.steps[matched_alert].proofLink",
    expectedStates: ["ready", "partial", "blocked", "unsupported"]
  },
  {
    consumerLane: "webhook",
    route: "/v1/dwm/webhooks/deliver",
    consumesSchemaVersion: PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION,
    requiredFields: ["orgId", "alertId", "caseId", "destinationDeliveryState", "deliveryStatus", "workflowStatus", "proofLink"],
    packetPath: "workflowPacket.steps[webhook_destination|delivery_outcome]",
    proofPath: "workflowPacket.steps[].proofLink",
    expectedStates: ["ready", "partial", "blocked"]
  },
  {
    consumerLane: "helpdesk",
    route: "/api/admin/support/readiness",
    consumesSchemaVersion: PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION,
    requiredFields: ["orgId", "alertId", "caseId", "supportAuditStatus", "blockerReason", "owningLane", "proofLink"],
    packetPath: "workflowPacket.steps[support_audit]",
    proofPath: "workflowPacket.steps[support_audit].proofLink",
    expectedStates: ["ready", "partial", "blocked"]
  },
  {
    consumerLane: "website",
    route: "/",
    consumesSchemaVersion: PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION,
    requiredFields: ["orgId", "provenanceHash", "sourceCoverage", "blockerReason", "proofLink"],
    packetPath: "consumerGuidance.rows[website]",
    proofPath: "consumerGuidance.rows[website].proofLink",
    expectedStates: ["ready", "partial", "blocked"]
  },
  {
    consumerLane: "integration",
    route: "/v1/contracts",
    consumesSchemaVersion: PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION,
    requiredFields: requiredEnvelopeFieldAliases,
    packetPath: "workflowPacket",
    proofPath: "workflowPacket.steps[].proofLink",
    expectedStates: ["ready", "partial", "blocked", "unsupported"]
  }
];

export function buildProductReadinessConsumerGuidance(input: ProductReadinessConsumerGuidanceInput) {
  const handoffRows = input.productReadinessConsumerHandoffPacket?.rows || [];
  const capabilityRows = input.productReadinessOrgCapabilityPacket?.rows || [];
  const schemaLookupRows = input.schemaLookup?.rows || [];
  const handoffById = new Map(handoffRows.map((row) => [row.consumerId, row]));
  const capabilityById = new Map(capabilityRows.map((row) => [row.orgCapabilityId, row]));
  const schemaLookupIds = new Set(schemaLookupRows.map((row) => row.schemaId));
  const sourceSchemaIds = [
    input.productReadinessConsumerHandoffPacket?.schemaVersion,
    input.productReadinessOrgCapabilityPacket?.schemaVersion
  ].filter(Boolean) as string[];
  const rows = consumerDefinitions.map((definition) => buildConsumerGuidanceRow(definition, handoffById, capabilityById, schemaLookupIds, sourceSchemaIds));
  return {
    schemaVersion: PRODUCT_READINESS_CONSUMER_GUIDANCE_SCHEMA_VERSION,
    route: "/v1/contracts",
    producer: "buildProductReadinessConsumerGuidance",
    sourceSchemas: {
      consumerHandoffPacket: input.productReadinessConsumerHandoffPacket?.schemaVersion,
      orgCapabilityPacket: input.productReadinessOrgCapabilityPacket?.schemaVersion
    },
    requiredLaneIds: consumerDefinitions.map((definition) => definition.laneId),
    rows,
    safeOutput: safeMetadataOnly
  };
}

export function buildProductReadinessOrgAlertConsumerPacketFixture(guidance: ReturnType<typeof buildProductReadinessConsumerGuidance>) {
  const requiredLaneIds: ProductReadinessConsumerLane[] = ["org", "publicTI", "alert", "webhook", "case"];
  const rows = requiredLaneIds.map((laneId) => guidance.rows.find((row) => row.laneId === laneId)).filter(Boolean) as ProductReadinessConsumerGuidanceRow[];
  const fieldAliases = uniqueStrings(rows.flatMap((row) => row.typedFields.filter((field) => field.present).map((field) => field.alias)));
  const missingTypedFields = uniqueStrings(rows.flatMap((row) => row.missingTypedFields));
  const blockerCodes = uniqueStrings(rows.flatMap((row) => row.blockerCodes));
  return {
    schemaVersion: PRODUCT_READINESS_ORG_ALERT_CONSUMER_PACKET_FIXTURE_SCHEMA_VERSION,
    route: "/v1/contracts",
    producer: "buildProductReadinessOrgAlertConsumerPacketFixture",
    laneIds: requiredLaneIds,
    state: rows.every((row) => row.state === "ready") && missingTypedFields.length === 0 ? "ready" : rows.some((row) => row.state === "blocked") ? "blocked" : "partial",
    fieldAliases,
    missingTypedFields,
    proofLinks: rows.map((row) => ({
      laneId: row.laneId,
      route: row.proofLink.route,
      contractIds: row.proofLink.contractIds,
      schemaIds: row.proofLink.schemaIds,
      receiptSchemaIds: row.proofLink.receiptSchemaIds
    })),
    blockerCodes,
    safeOutput: safeMetadataOnly
  };
}

export function buildProductReadinessEndToEndWorkflowPacket(
  guidance: ReturnType<typeof buildProductReadinessConsumerGuidance>,
  options: { lastVerifiedAt?: string } = {}
) {
  const lastVerifiedAt = options.lastVerifiedAt || "2026-06-30T00:00:00.000Z";
  const guidanceByLane = new Map(guidance.rows.map((row) => [row.laneId, row]));
  const steps = endToEndWorkflowDefinitions.map((definition) => buildEndToEndWorkflowStep(definition, guidanceByLane, lastVerifiedAt));
  const blockerCodes = uniqueStrings(steps.flatMap((step) => step.blockerCodes));
  const state = steps.some((step) => step.state === "unsupported")
    ? "unsupported"
    : steps.some((step) => step.state === "blocked")
      ? "blocked"
      : steps.some((step) => step.state === "partial")
        ? "partial"
        : "ready";
  return {
    schemaVersion: PRODUCT_READINESS_END_TO_END_WORKFLOW_PACKET_SCHEMA_VERSION,
    route: "/v1/contracts",
    producer: "buildProductReadinessEndToEndWorkflowPacket",
    state,
    lastVerifiedAt,
    requiredStepIds: endToEndWorkflowDefinitions.map((definition) => definition.stepId),
    steps,
    typedFields: uniqueStrings(steps.flatMap((step) => step.typedFields.filter((field) => field.present).map((field) => field.alias))),
    missingTypedFields: uniqueStrings(steps.flatMap((step) => step.missingTypedFields)),
    blockerCodes,
    consumerGuidanceSchemaVersion: guidance.schemaVersion,
    safeOutput: safeMetadataOnly
  };
}

export function buildProductReadinessCustomerWorkflowEnvelope(
  input: ProductReadinessConsumerGuidanceInput,
  options: { lastVerifiedAt?: string } = {}
) {
  const consumerGuidance = buildProductReadinessConsumerGuidance(input);
  const workflowPacket = buildProductReadinessEndToEndWorkflowPacket(consumerGuidance, options);
  const envelope = {
    schemaVersion: PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION,
    route: "/v1/contracts",
    producer: "buildProductReadinessCustomerWorkflowEnvelope",
    state: workflowPacket.state,
    lastVerifiedAt: workflowPacket.lastVerifiedAt,
    sourceSchemas: consumerGuidance.sourceSchemas,
    workflowPacket,
    consumerGuidance,
    consumerImplementationNotes: cloneConsumerImplementationNotes(),
    safeOutput: safeMetadataOnly
  };
  return {
    ...envelope,
    compatibility: validateProductReadinessCustomerWorkflowEnvelope(envelope)
  };
}

export function buildProductReadinessCustomerWorkflowConsumerFixture(
  envelope: ReturnType<typeof buildProductReadinessCustomerWorkflowEnvelope>
) {
  const availableFields = new Set(envelope.workflowPacket.typedFields);
  const stepsByLane = new Map<ProductReadinessConsumerLane, ProductReadinessEndToEndWorkflowStep[]>();
  for (const step of envelope.workflowPacket.steps) {
    stepsByLane.set(step.consumerLane, [...(stepsByLane.get(step.consumerLane) || []), step]);
  }
  const consumers = workflowConsumerFixtureLanes.map((laneId) => {
    const note = envelope.consumerImplementationNotes.find((candidate) => candidate.consumerLane === laneId);
    const requiredFields = Array.isArray(note?.requiredFields) ? note.requiredFields : [];
    const missingRequiredFields = requiredFields.filter((field) => !availableFields.has(field));
    const steps = stepsByLane.get(laneId) || [];
    const states = steps.map((step) => step.state);
    const state = missingRequiredFields.length > 0
      ? "blocked"
      : states.includes("blocked")
        ? "blocked"
        : states.includes("unsupported")
          ? "unsupported"
          : states.includes("partial")
            ? "partial"
            : "ready";
    return {
      laneId,
      route: note?.route || "/v1/contracts",
      state,
      consumesSchemaVersion: note?.consumesSchemaVersion || PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION,
      requiredFields,
      missingRequiredFields,
      stepIds: steps.map((step) => step.stepId),
      proofLinks: steps.map((step) => step.proofLink),
      canReadEnvelope: Boolean(note) && missingRequiredFields.length === 0,
      safeOutput: safeMetadataOnly
    };
  });
  return {
    schemaVersion: PRODUCT_READINESS_CUSTOMER_WORKFLOW_CONSUMER_FIXTURE_SCHEMA_VERSION,
    route: "/v1/contracts",
    producer: "buildProductReadinessCustomerWorkflowConsumerFixture",
    envelopeSchemaVersion: envelope.schemaVersion,
    workflowPacketSchemaVersion: envelope.workflowPacket.schemaVersion,
    state: consumers.every((consumer) => consumer.state === "ready" && consumer.canReadEnvelope) ? "ready" : "blocked",
    consumers,
    compatibility: envelope.compatibility,
    safeOutput: safeMetadataOnly
  };
}

function cloneConsumerImplementationNotes(): ProductReadinessConsumerImplementationNote[] {
  return consumerImplementationNotes.map((note) => ({
    ...note,
    requiredFields: [...note.requiredFields],
    expectedStates: [...note.expectedStates]
  }));
}

export function validateProductReadinessCustomerWorkflowEnvelope(envelope: {
  schemaVersion: string;
  workflowPacket?: {
    schemaVersion?: string;
    state?: string;
    lastVerifiedAt?: string;
    typedFields?: readonly string[];
    steps?: readonly ProductReadinessEndToEndWorkflowStep[];
    safeOutput?: SafeOutput;
  };
  consumerGuidance?: {
    schemaVersion?: string;
    rows?: readonly ProductReadinessConsumerGuidanceRow[];
    safeOutput?: SafeOutput;
  };
  consumerImplementationNotes?: readonly ProductReadinessConsumerImplementationNote[];
  safeOutput?: SafeOutput;
}) {
  const availableFields = new Set(envelope.workflowPacket?.typedFields || []);
  const missingRequiredFields = requiredEnvelopeFieldAliases.filter((field) => !availableFields.has(field));
  const requiredStepIds = endToEndWorkflowDefinitions.map((definition) => definition.stepId);
  const stepIds = new Set((envelope.workflowPacket?.steps || []).map((step) => step.stepId));
  const missingStepIds = requiredStepIds.filter((stepId) => !stepIds.has(stepId));
  const noteLanes = new Set((envelope.consumerImplementationNotes || []).map((note) => note.consumerLane));
  const requiredNoteLanes = consumerImplementationNotes.map((note) => note.consumerLane);
  const missingConsumerNotes = requiredNoteLanes.filter((lane) => !noteLanes.has(lane));
  const missingProofSteps = (envelope.workflowPacket?.steps || [])
    .filter((step) => step.proofLink.contractIds.length === 0 || step.proofLink.schemaIds.length === 0)
    .map((step) => step.stepId);
  const unsafeOutputs = [
    !isSafe(envelope.safeOutput) ? "envelope" : "",
    !isSafe(envelope.workflowPacket?.safeOutput) ? "workflowPacket" : "",
    !isSafe(envelope.consumerGuidance?.safeOutput) ? "consumerGuidance" : ""
  ].filter(Boolean);
  const blockerCodes = uniqueStrings([
    ...missingRequiredFields.map(() => "missing_customer_workflow_field"),
    ...missingStepIds.map(() => "missing_customer_workflow_step"),
    ...missingConsumerNotes.map(() => "missing_consumer_implementation_note"),
    ...missingProofSteps.map(() => "missing_customer_workflow_proof_link"),
    ...unsafeOutputs.map(() => "unsafe_customer_workflow_output")
  ]);
  return {
    schemaVersion: PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_COMPATIBILITY_SCHEMA_VERSION,
    route: "/v1/contracts",
    ok: blockerCodes.length === 0,
    state: blockerCodes.length === 0 ? "ready" : "blocked",
    checkedSchemaVersion: envelope.schemaVersion,
    workflowPacketSchemaVersion: envelope.workflowPacket?.schemaVersion,
    consumerGuidanceSchemaVersion: envelope.consumerGuidance?.schemaVersion,
    requiredFieldAliases: requiredEnvelopeFieldAliases,
    acceptedFutureFields: (envelope.workflowPacket?.typedFields || []).filter((field) => !requiredEnvelopeFieldAliases.includes(field)),
    missingRequiredFields,
    requiredStepIds,
    missingStepIds,
    requiredConsumerNoteLanes: requiredNoteLanes,
    missingConsumerNotes,
    missingProofSteps,
    blockerCodes,
    safeOutput: safeMetadataOnly
  };
}

function buildConsumerGuidanceRow(
  definition: ProductReadinessConsumerDefinition,
  handoffById: Map<string, ProductReadinessConsumerHandoffRow>,
  capabilityById: Map<string, ProductReadinessOrgCapabilityRow>,
  schemaLookupIds: Set<string>,
  sourceSchemaIds: string[]
): ProductReadinessConsumerGuidanceRow {
  const handoffRow = definition.consumerId ? handoffById.get(definition.consumerId) : undefined;
  const capabilityRows = definition.orgCapabilityIds.map((id) => capabilityById.get(id)).filter(Boolean) as ProductReadinessOrgCapabilityRow[];
  const missingCapabilityIds = definition.orgCapabilityIds.filter((id) => !capabilityById.has(id));
  const capabilityStates = capabilityRows.map((row) => normalizeState(row.state));
  const stateCandidates = [...capabilityStates, ...(handoffRow ? [normalizeState(handoffRow.state)] : [])];
  const aliasSourceFields = {
    ...buildCapabilityAliases(capabilityRows),
    ...(handoffRow?.fieldAliases || {}),
    blockerReason: "blockerCodes",
    owningLane: "ownerLane",
    proofLink: "proofLink"
  };
  const proofLink = buildProofLink(definition, handoffRow, capabilityRows);
  const sourceSchemaMissing = sourceSchemaIds.filter((schemaId) => !schemaLookupIds.has(schemaId));
  const typedFields = Object.entries(definition.requiredTypedFields).map(([alias, sourceField]) => ({
    alias,
    sourceField: aliasSourceFields[alias] || sourceField,
    present: alias === "proofLink" ? proofLink.contractIds.length > 0 && proofLink.schemaIds.length > 0 : Boolean(aliasSourceFields[alias]),
    required: true as const
  }));
  const missingTypedFields = typedFields.filter((field) => !field.present).map((field) => field.alias);
  const safeBlockers = [
    ...(!isSafe(handoffRow?.safeOutput) && handoffRow ? ["unsafe_consumer_handoff_output"] : []),
    ...capabilityRows.filter((row) => !isSafe(row.safeOutput)).map(() => "unsafe_org_capability_output")
  ];
  const blockerCodes = uniqueStrings([
    ...(handoffRow?.blockerCodes || []),
    ...capabilityRows.flatMap((row) => row.blockerCodes || []),
    ...missingCapabilityIds.map(() => "missing_capability_packet_row"),
    ...(!handoffRow && definition.consumerId ? ["missing_consumer_handoff_row"] : []),
    ...missingTypedFields.map(() => "missing_consumer_guidance_field"),
    ...sourceSchemaMissing.map(() => "missing_guidance_schema_lookup"),
    ...safeBlockers
  ]);
  const state = classifyConsumerGuidanceState({
    missingConsumer: Boolean(definition.consumerId && !handoffRow),
    missingCapabilityIds,
    missingTypedFields,
    sourceSchemaMissing,
    safeBlockers,
    stateCandidates
  });
  return {
    laneId: definition.laneId,
    state,
    ownerLane: definition.ownerLane,
    route: definition.route,
    consumerId: definition.consumerId,
    orgCapabilityIds: definition.orgCapabilityIds,
    workflowIds: uniqueStrings(capabilityRows.map((row) => row.workflowId)),
    typedFields,
    missingTypedFields,
    proofLink,
    blockerCodes,
    safeOutput: safeMetadataOnly
  };
}

function buildEndToEndWorkflowStep(
  definition: ProductReadinessWorkflowStepDefinition,
  guidanceByLane: Map<ProductReadinessConsumerLane, ProductReadinessConsumerGuidanceRow>,
  lastVerifiedAt: string
): ProductReadinessEndToEndWorkflowStep {
  const guidanceRow = guidanceByLane.get(definition.consumerLane);
  const availableAliases = new Map((guidanceRow?.typedFields || [])
    .filter((field) => field.present)
    .map((field) => [field.alias, field.sourceField]));
  const syntheticFields = buildSyntheticWorkflowFields(definition, guidanceRow, lastVerifiedAt);
  for (const [alias, sourceField] of Object.entries(syntheticFields)) {
    availableAliases.set(alias, sourceField);
  }
  const typedFields = Object.entries(definition.requiredFields).map(([alias, sourceField]) => ({
    alias,
    sourceField: availableAliases.get(alias) || sourceField,
    stepId: definition.stepId,
    consumerLane: definition.consumerLane,
    present: availableAliases.has(alias)
  }));
  const missingTypedFields = typedFields.filter((field) => !field.present).map((field) => field.alias);
  const blockerCodes = uniqueStrings([
    ...(guidanceRow?.blockerCodes || []),
    ...(!guidanceRow ? ["missing_consumer_guidance_row"] : []),
    ...missingTypedFields.map(() => "missing_end_to_end_workflow_field")
  ]);
  const state = !guidanceRow
    ? "unsupported"
    : guidanceRow.state === "ready" && missingTypedFields.length > 0
      ? "partial"
      : guidanceRow.state;
  return {
    stepId: definition.stepId,
    state,
    consumerLane: definition.consumerLane,
    ownerLane: guidanceRow?.ownerLane || definition.consumerLane,
    route: guidanceRow?.route || "/v1/contracts",
    typedFields,
    missingTypedFields,
    blockerCodes,
    proofLink: guidanceRow?.proofLink || {
      route: "/v1/contracts",
      contractIds: [],
      schemaIds: [],
      receiptSchemaIds: []
    }
  };
}

function buildSyntheticWorkflowFields(
  definition: ProductReadinessWorkflowStepDefinition,
  guidanceRow: ProductReadinessConsumerGuidanceRow | undefined,
  lastVerifiedAt: string
) {
  const fields: Record<string, string> = {
    lastVerifiedAt: lastVerifiedAt ? "lastVerifiedAt" : "",
    version: PRODUCT_READINESS_CUSTOMER_WORKFLOW_ENVELOPE_SCHEMA_VERSION
  };
  if (!guidanceRow) {
    return fields;
  }
  const proofContractIds = new Set(guidanceRow.proofLink.contractIds);
  const proofSchemaIds = new Set(guidanceRow.proofLink.schemaIds);
  if (definition.stepId === "organization_access") {
    if (proofSchemaIds.has("organization.lifecycle_readiness.v1")) {
      fields.memberRef = "member.status";
    }
    if (proofContractIds.has("support_action_receipts")) {
      fields.inviteRef = "invite.status";
    }
  }
  if (definition.stepId === "source_coverage" && proofContractIds.has("source_provenance_receipts")) {
    fields.sourceCoverageId = "sourceIds[0]";
    fields.sourceCoverageIds = "sourceIds";
  }
  if ((definition.stepId === "matched_alert" || definition.stepId === "deploy_eligibility") && proofContractIds.has("source_provenance_receipts")) {
    fields.sourceCoverageId = "sourceIds[0]";
  }
  if (definition.stepId === "matched_alert" || definition.stepId === "analyst_case" || definition.stepId === "delivery_outcome" || definition.stepId === "deploy_eligibility") {
    const workflowField = guidanceRow.typedFields.find((field) => field.alias === "workflowState" && field.present);
    if (workflowField) {
      fields.workflowStatus = workflowField.sourceField;
    } else if (proofContractIds.has("org_scoped_alert_case_workflow") || proofContractIds.has("org_alert_case_workflow")) {
      fields.workflowStatus = "workflowState";
    }
  }
  if ((definition.stepId === "webhook_destination" || definition.stepId === "delivery_outcome") && proofContractIds.has("webhook_delivery_receipts")) {
    fields.deliveryStatus = "destinationDeliveryState";
  }
  if ((definition.stepId === "support_audit" || definition.stepId === "deploy_eligibility") && proofContractIds.has("support_action_receipts")) {
    fields.supportAuditStatus = "supportAction.status";
  }
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => Boolean(value)));
}

function buildCapabilityAliases(capabilityRows: ProductReadinessOrgCapabilityRow[]) {
  const readinessFields = new Set(capabilityRows.flatMap((row) => row.readinessFields || []));
  const aliases: Record<string, string> = {};
  const aliasMap: Record<string, string> = {
    orgId: "organizationId",
    watchlistId: "watchlistId",
    alertId: "alertId",
    caseId: "caseId",
    provenanceHash: "provenanceHash",
    sourceCoverage: "sourceCoverageState",
    workflowState: "workflowState",
    destinationDeliveryState: "destinationDeliveryState"
  };
  for (const [alias, field] of Object.entries(aliasMap)) {
    if (readinessFields.has(field)) {
      aliases[alias] = field;
    }
  }
  return aliases;
}

function buildProofLink(
  definition: ProductReadinessConsumerDefinition,
  handoffRow: ProductReadinessConsumerHandoffRow | undefined,
  capabilityRows: ProductReadinessOrgCapabilityRow[]
) {
  const routes = uniqueStrings([...(handoffRow?.proof?.routes || []), ...capabilityRows.flatMap((row) => row.proof?.readinessRoutes || []), ...capabilityRows.map((row) => row.proof?.route).filter(Boolean) as string[]]);
  const contractIds = uniqueStrings([...(handoffRow?.proof?.contractIds || []), ...capabilityRows.flatMap((row) => row.proof?.contractIds || [])]);
  const schemaIds = uniqueStrings([...(handoffRow?.proof?.schemaIds || []), ...capabilityRows.flatMap((row) => row.proof?.schemaIds || [])]);
  const receiptSchemaIds = uniqueStrings([...(handoffRow?.proof?.receiptSchemaIds || []), ...capabilityRows.flatMap((row) => row.proof?.receiptSchemaIds || [])]);
  return {
    route: routes[0] || handoffRow?.route || definition.route,
    contractIds,
    schemaIds,
    receiptSchemaIds
  };
}

function classifyConsumerGuidanceState(input: {
  missingConsumer: boolean;
  missingCapabilityIds: string[];
  missingTypedFields: string[];
  sourceSchemaMissing: string[];
  safeBlockers: string[];
  stateCandidates: ProductReadinessConsumerState[];
}): ProductReadinessConsumerState {
  if (input.missingConsumer || input.missingCapabilityIds.length > 0) {
    return "unsupported";
  }
  if (input.safeBlockers.length > 0 || input.stateCandidates.includes("blocked")) {
    return "blocked";
  }
  if (input.missingTypedFields.length > 0 || input.sourceSchemaMissing.length > 0 || input.stateCandidates.includes("partial")) {
    return "partial";
  }
  return "ready";
}

function normalizeState(state: string): ProductReadinessConsumerState {
  return state === "ready" || state === "partial" || state === "blocked" || state === "unsupported" ? state : "blocked";
}

function isSafe(safeOutput: SafeOutput | undefined) {
  return safeOutput?.metadataOnly !== false
    && safeOutput?.rawEvidenceExposed !== true
    && safeOutput?.webhookSecretExposed !== true
    && safeOutput?.crossOrgDataExposed !== true;
}
