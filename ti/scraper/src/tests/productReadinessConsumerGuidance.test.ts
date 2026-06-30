import { describe, expect, test } from "bun:test";
import { contractIndex } from "../api/contractsRoute.ts";
import {
  PRODUCT_READINESS_CONSUMER_GUIDANCE_SCHEMA_VERSION,
  PRODUCT_READINESS_END_TO_END_WORKFLOW_PACKET_SCHEMA_VERSION,
  PRODUCT_READINESS_ORG_ALERT_CONSUMER_PACKET_FIXTURE_SCHEMA_VERSION,
  buildProductReadinessConsumerGuidance,
  buildProductReadinessEndToEndWorkflowPacket,
  buildProductReadinessOrgAlertConsumerPacketFixture
} from "../product/productReadinessConsumerGuidance.ts";

describe("product readiness consumer guidance", () => {
  test("maps contract readiness into consumer-owned handoff rows", () => {
    const contracts = contractIndex();
    const guidance = buildProductReadinessConsumerGuidance(contracts);
    const rows = new Map(guidance.rows.map((row) => [row.laneId, row]));

    expect(guidance).toMatchObject({
      schemaVersion: PRODUCT_READINESS_CONSUMER_GUIDANCE_SCHEMA_VERSION,
      route: "/v1/contracts",
      producer: "buildProductReadinessConsumerGuidance",
      requiredLaneIds: ["org", "dashboard", "publicTI", "alert", "webhook", "case", "helpdesk", "website"],
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(rows.get("alert")).toMatchObject({
      state: "ready",
      ownerLane: "alert",
      route: "/v1/dwm/alerts/generation-readiness",
      consumerId: "alert_generation",
      orgCapabilityIds: expect.arrayContaining(["shared_watchlist_scope", "org_scoped_alert_bridge", "source_coverage_state"]),
      typedFields: expect.arrayContaining([
        expect.objectContaining({ alias: "orgId", sourceField: "organizationId", present: true }),
        expect.objectContaining({ alias: "watchlistId", sourceField: "watchlistId", present: true }),
        expect.objectContaining({ alias: "alertId", sourceField: "alertId", present: true }),
        expect.objectContaining({ alias: "caseId", sourceField: "caseId", present: true }),
        expect.objectContaining({ alias: "provenanceHash", sourceField: "provenanceHash", present: true }),
        expect.objectContaining({ alias: "sourceCoverage", sourceField: "sourceCoverageState", present: true }),
        expect.objectContaining({ alias: "blockerReason", sourceField: "blockerCodes", present: true }),
        expect.objectContaining({ alias: "owningLane", sourceField: "ownerLane", present: true }),
        expect.objectContaining({ alias: "proofLink", sourceField: "proofLink", present: true })
      ]),
      proofLink: {
        contractIds: expect.arrayContaining(["shared_watchlist_alert_export", "org_scoped_alert_case_workflow", "source_provenance_receipts"]),
        schemaIds: expect.arrayContaining(["organization.watchlist_alert_readiness.v1"]),
        receiptSchemaIds: expect.arrayContaining(["ti.source_provenance_source_activation_decision_receipt.v1"])
      },
      blockerCodes: []
    });
    expect(rows.get("webhook")).toMatchObject({
      state: "ready",
      ownerLane: "webhook",
      typedFields: expect.arrayContaining([
        expect.objectContaining({ alias: "destinationDeliveryState", sourceField: "destinationDeliveryState", present: true }),
        expect.objectContaining({ alias: "workflowState", sourceField: "workflowState", present: true })
      ])
    });
    expect(rows.get("publicTI")).toMatchObject({
      state: "ready",
      ownerLane: "publicTI",
      typedFields: expect.arrayContaining([
        expect.objectContaining({ alias: "sourceCoverage", sourceField: "sourceCoverageState", present: true }),
        expect.objectContaining({ alias: "provenanceHash", sourceField: "provenanceHash", present: true })
      ])
    });
    expect(rows.get("helpdesk")).toMatchObject({
      state: "ready",
      ownerLane: "support",
      route: "/api/admin/support/readiness"
    });
    expect(JSON.stringify(guidance)).not.toContain("https://discord.com");
    expect(JSON.stringify(guidance)).not.toContain("rawEvidenceDump");
  });

  test("classifies unsupported, partial, and blocked consumer handoffs", () => {
    const contracts = JSON.parse(JSON.stringify(contractIndex()));
    contracts.productReadinessConsumerHandoffPacket.rows = contracts.productReadinessConsumerHandoffPacket.rows.filter((row: any) => row.consumerId !== "alert_generation");
    delete contracts.productReadinessConsumerHandoffPacket.rows.find((row: any) => row.consumerId === "public_ti_handoff").fieldAliases.provenanceHash;
    delete contracts.productReadinessConsumerHandoffPacket.rows.find((row: any) => row.consumerId === "public_ti_handoff").fieldAliases.sourceCoverage;
    contracts.productReadinessOrgCapabilityPacket.rows.find((row: any) => row.orgCapabilityId === "source_coverage_state").readinessFields = [];
    contracts.productReadinessOrgCapabilityPacket.rows.find((row: any) => row.orgCapabilityId === "destination_delivery_state").safeOutput.rawEvidenceExposed = true;

    const guidance = buildProductReadinessConsumerGuidance(contracts);
    const rows = new Map(guidance.rows.map((row) => [row.laneId, row]));

    expect(rows.get("alert")).toMatchObject({
      state: "unsupported",
      blockerCodes: expect.arrayContaining(["missing_consumer_handoff_row"])
    });
    expect(rows.get("publicTI")).toMatchObject({
      state: "partial",
      blockerCodes: expect.arrayContaining(["missing_consumer_guidance_field"]),
      missingTypedFields: expect.arrayContaining(["sourceCoverage"])
    });
    expect(rows.get("webhook")).toMatchObject({
      state: "blocked",
      blockerCodes: expect.arrayContaining(["unsafe_org_capability_output"])
    });
  });

  test("builds one org watchlist alert webhook source packet without custom glue", () => {
    const guidance = buildProductReadinessConsumerGuidance(contractIndex());
    const fixture = buildProductReadinessOrgAlertConsumerPacketFixture(guidance);

    expect(fixture).toMatchObject({
      schemaVersion: PRODUCT_READINESS_ORG_ALERT_CONSUMER_PACKET_FIXTURE_SCHEMA_VERSION,
      route: "/v1/contracts",
      producer: "buildProductReadinessOrgAlertConsumerPacketFixture",
      laneIds: ["org", "publicTI", "alert", "webhook", "case"],
      state: "ready",
      fieldAliases: expect.arrayContaining([
        "orgId",
        "watchlistId",
        "alertId",
        "caseId",
        "provenanceHash",
        "sourceCoverage",
        "workflowState",
        "destinationDeliveryState",
        "blockerReason",
        "owningLane",
        "proofLink"
      ]),
      missingTypedFields: [],
      blockerCodes: [],
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(fixture.proofLinks).toContainEqual(expect.objectContaining({
      laneId: "alert",
      route: expect.any(String),
      contractIds: expect.arrayContaining(["shared_watchlist_alert_export"]),
      schemaIds: expect.arrayContaining(["organization.watchlist_alert_readiness.v1"])
    }));
    expect(fixture.proofLinks).toContainEqual(expect.objectContaining({
      laneId: "webhook",
      contractIds: expect.arrayContaining(["org_scoped_alert_case_workflow"]),
      receiptSchemaIds: expect.arrayContaining(["dwm.webhook_event_contract.v1"])
    }));
  });

  test("builds an end-to-end customer workflow readiness packet", () => {
    const guidance = buildProductReadinessConsumerGuidance(contractIndex());
    const packet = buildProductReadinessEndToEndWorkflowPacket(guidance, { lastVerifiedAt: "2026-06-30T12:00:00.000Z" });
    const steps = new Map(packet.steps.map((step) => [step.stepId, step]));

    expect(packet).toMatchObject({
      schemaVersion: PRODUCT_READINESS_END_TO_END_WORKFLOW_PACKET_SCHEMA_VERSION,
      route: "/v1/contracts",
      producer: "buildProductReadinessEndToEndWorkflowPacket",
      state: "ready",
      lastVerifiedAt: "2026-06-30T12:00:00.000Z",
      requiredStepIds: [
        "organization_access",
        "shared_watchlist",
        "source_coverage",
        "matched_alert",
        "analyst_case",
        "webhook_destination",
        "delivery_outcome",
        "support_audit"
      ],
      typedFields: expect.arrayContaining([
        "orgId",
        "memberRef",
        "inviteRef",
        "watchlistId",
        "alertId",
        "caseId",
        "sourceCoverageIds",
        "provenanceHash",
        "workflowStatus",
        "deliveryStatus",
        "supportAuditStatus",
        "blockerReason",
        "owningLane",
        "proofLink",
        "lastVerifiedAt"
      ]),
      missingTypedFields: [],
      blockerCodes: [],
      consumerGuidanceSchemaVersion: PRODUCT_READINESS_CONSUMER_GUIDANCE_SCHEMA_VERSION,
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(steps.get("organization_access")).toMatchObject({
      state: "ready",
      consumerLane: "org",
      typedFields: expect.arrayContaining([
        expect.objectContaining({ alias: "memberRef", sourceField: "member.status", present: true }),
        expect.objectContaining({ alias: "inviteRef", sourceField: "invite.status", present: true })
      ])
    });
    expect(steps.get("matched_alert")).toMatchObject({
      state: "ready",
      consumerLane: "alert",
      typedFields: expect.arrayContaining([
        expect.objectContaining({ alias: "watchlistId", present: true }),
        expect.objectContaining({ alias: "alertId", present: true }),
        expect.objectContaining({ alias: "caseId", present: true }),
        expect.objectContaining({ alias: "provenanceHash", present: true }),
        expect.objectContaining({ alias: "workflowStatus", sourceField: "workflowState", present: true })
      ]),
      proofLink: {
        contractIds: expect.arrayContaining(["shared_watchlist_alert_export", "org_scoped_alert_case_workflow"]),
        schemaIds: expect.arrayContaining(["organization.watchlist_alert_readiness.v1"])
      }
    });
    expect(steps.get("delivery_outcome")).toMatchObject({
      state: "ready",
      consumerLane: "webhook"
    });
    expect(steps.get("delivery_outcome")?.typedFields).toContainEqual(expect.objectContaining({ alias: "deliveryStatus", sourceField: "destinationDeliveryState", present: true }));
    expect(steps.get("webhook_destination")?.typedFields).toContainEqual(expect.objectContaining({ alias: "destinationDeliveryState", present: true }));
    expect(steps.get("delivery_outcome")?.proofLink.receiptSchemaIds).toContain("dwm.webhook_event_contract.v1");
    expect(steps.get("support_audit")).toMatchObject({
      state: "ready",
      consumerLane: "helpdesk",
      typedFields: expect.arrayContaining([
        expect.objectContaining({ alias: "supportAuditStatus", sourceField: "supportAction.status", present: true })
      ])
    });
    expect(JSON.stringify(packet)).not.toContain("https://discord.com");
    expect(JSON.stringify(packet)).not.toContain("rawEvidenceDump");
  });

  test("keeps end-to-end proof links discoverable from the contract index", () => {
    const contracts = contractIndex();
    const guidance = buildProductReadinessConsumerGuidance(contracts);
    const packet = buildProductReadinessEndToEndWorkflowPacket(guidance);
    const matrixContractIds = new Set(contracts.productReadinessReceiptMatrix.rows.flatMap((row: any) => row.contractIds));
    const receiptSchemaIds = new Set(contracts.receiptSchemas.flatMap((row: any) => Object.values(row.schemas)));
    const sourceSchemaIds = new Set(contracts.schemaLookup.rows.map((row: any) => row.schemaId));

    expect([...sourceSchemaIds]).toEqual(expect.arrayContaining([
      contracts.productReadinessConsumerHandoffPacket.schemaVersion,
      contracts.productReadinessOrgCapabilityPacket.schemaVersion
    ]));
    for (const step of packet.steps) {
      expect(step.proofLink.route).toEqual(expect.any(String));
      expect(step.proofLink.contractIds.length).toBeGreaterThan(0);
      expect(step.proofLink.schemaIds.length).toBeGreaterThan(0);
      expect(step.proofLink.contractIds.every((contractId) => matrixContractIds.has(contractId))).toBe(true);
      expect(step.proofLink.receiptSchemaIds.every((schemaId) => receiptSchemaIds.has(schemaId))).toBe(true);
    }
  });

  test("classifies end-to-end partial, blocked, and unsupported states", () => {
    const contracts = JSON.parse(JSON.stringify(contractIndex()));
    contracts.productReadinessConsumerHandoffPacket.rows = contracts.productReadinessConsumerHandoffPacket.rows.filter((row: any) => row.consumerId !== "alert_generation");
    delete contracts.productReadinessConsumerHandoffPacket.rows.find((row: any) => row.consumerId === "public_ti_handoff").fieldAliases.sourceCoverage;
    contracts.productReadinessOrgCapabilityPacket.rows.find((row: any) => row.orgCapabilityId === "source_coverage_state").readinessFields = [];
    delete contracts.productReadinessConsumerHandoffPacket.rows.find((row: any) => row.consumerId === "webhook_delivery").fieldAliases.destinationDeliveryState;
    contracts.productReadinessOrgCapabilityPacket.rows.find((row: any) => row.orgCapabilityId === "destination_delivery_state").safeOutput.rawEvidenceExposed = true;
    const guidance = buildProductReadinessConsumerGuidance(contracts);
    const packet = buildProductReadinessEndToEndWorkflowPacket(guidance);
    const steps = new Map(packet.steps.map((step) => [step.stepId, step]));

    expect(packet).toMatchObject({
      state: "unsupported",
      blockerCodes: expect.arrayContaining([
        "missing_consumer_handoff_row",
        "unsafe_org_capability_output",
        "missing_end_to_end_workflow_field"
      ])
    });
    expect(steps.get("matched_alert")).toMatchObject({
      state: "unsupported",
      blockerCodes: expect.arrayContaining(["missing_consumer_handoff_row"])
    });
    expect(steps.get("source_coverage")).toMatchObject({
      state: "partial",
      blockerCodes: expect.arrayContaining(["missing_end_to_end_workflow_field"]),
      missingTypedFields: expect.arrayContaining(["sourceCoverage"])
    });
    expect(steps.get("webhook_destination")).toMatchObject({
      state: "blocked",
      blockerCodes: expect.arrayContaining(["unsafe_org_capability_output"])
    });
    expect(steps.get("delivery_outcome")).toMatchObject({
      state: "blocked"
    });
    expect(steps.get("delivery_outcome")?.blockerCodes).toContain("unsafe_org_capability_output");
  });
});
