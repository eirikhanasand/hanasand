import { uniqueStrings } from "../utils.ts";

export const PRODUCT_READINESS_CONSUMER_GUIDANCE_SCHEMA_VERSION = "hanasand.product_readiness.consumer_guidance.v1" as const;
export const PRODUCT_READINESS_ORG_ALERT_CONSUMER_PACKET_FIXTURE_SCHEMA_VERSION = "hanasand.product_readiness.org_alert_consumer_packet_fixture.v1" as const;

export type ProductReadinessConsumerState = "ready" | "partial" | "blocked" | "unsupported";
export type ProductReadinessConsumerLane = "org" | "dashboard" | "publicTI" | "alert" | "webhook" | "case" | "helpdesk" | "website";

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

type ProductReadinessConsumerDefinition = {
  laneId: ProductReadinessConsumerLane;
  ownerLane: string;
  route: string;
  consumerId?: string;
  orgCapabilityIds: string[];
  requiredTypedFields: Record<string, string>;
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
