import { describe, expect, test } from "bun:test";
import { contractIndex } from "../api/contractsRoute.ts";
import {
  PRODUCT_READINESS_CONSUMER_GUIDANCE_SCHEMA_VERSION,
  PRODUCT_READINESS_ORG_ALERT_CONSUMER_PACKET_FIXTURE_SCHEMA_VERSION,
  buildProductReadinessConsumerGuidance,
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
});
