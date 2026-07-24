import { ORG_ALERT_CASE_ACTION_LEDGER_ROUTE, ORG_ALERT_CASE_ACTION_TIMELINE_ROUTE } from "./orgAlertCaseActionLedgerRoutes.ts";
import { DWM_ORG_ALERT_CASE_ACTION_TIMELINE_SCHEMA_VERSION } from "../product/orgAlertCaseActionTimeline.ts";
import {
  DWM_ORG_ALERT_CASE_ACTION_AUDIT_EVENT_SCHEMA_VERSION,
  DWM_ORG_ALERT_CASE_ACTION_RECEIPT_SCHEMA_VERSION
} from "../product/orgAlertWorkflowBridge.ts";
import {
  ORG_SHARED_WATCHLIST_ALERT_CONSUMERS_SCHEMA_VERSION,
  ORG_SHARED_WATCHLIST_ALERT_EXPORT_SCHEMA_VERSION,
  ORG_SHARED_WATCHLIST_READINESS_PROOF_SCHEMA_VERSION,
  PRODUCT_READINESS_RECEIPT_MATRIX_SCHEMA_VERSION,
  PRODUCT_READINESS_SCHEMA_VERSION,
  SUPPORT_ACTION_EXECUTION_HANDOFF_SCHEMA_VERSION,
  SUPPORT_ACTION_EXECUTOR_READINESS_SCHEMA_VERSION
} from "../product/analystHandoffConsumer.ts";
import {
  TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_GAP_RECEIPT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_ALERT_REBUILD_RECEIPT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_DECISION_RECEIPT_SCHEMA_VERSION,
  TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_RECEIPT_SCHEMA_VERSION
} from "../product/sourceProvenanceTiPageContract.ts";
import {
  DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_LIST_SCHEMA_VERSION,
  DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_WRITE_SCHEMA_VERSION
} from "../storage/orgAlertCaseActionLedgerPostgres.ts";

export const PRODUCT_READINESS_PROOF_VIEW_SCHEMA_VERSION = "hanasand.product_readiness.proof_view.v1" as const;
export const PRODUCT_READINESS_ORG_CAPABILITY_PACKET_SCHEMA_VERSION = "hanasand.product_readiness.org_capability_packet.v1" as const;
export const PRODUCT_READINESS_CONSUMER_HANDOFF_PACKET_SCHEMA_VERSION = "hanasand.product_readiness.consumer_handoff_packet.v1" as const;

export function contractIndex() {
  const routes = [
    route("GET", "/v1/health"),
    route("GET", "/v1/auth/integration-notes"),
    route("GET", "/v1/intel/search"),
    route("GET", "/api/ti/search"),
    route("GET", "/v1/intel/sources"),
    route("GET", "/v1/intel/captures"),
    route("GET", "/v1/intel/entities"),
    route("GET", "/v1/intel/indicators"),
    route("GET", "/v1/intel/incidents"),
    route("GET", "/v1/intel/actor-profiles"),
    route("GET", "/v1/intel/actor-aliases"),
    route("GET", "/v1/intel/evidence-links"),
    route("GET", "/v1/intel/claims"),
    route("GET", "/v1/intel/claim-evidence"),
    route("GET", "/v1/intel/claim-reviews"),
    route("GET", "/v1/intel/alerts"),
    route("POST", "/v1/intel/claims/:claimId/reviews"),
    route("POST", "/v1/intel/governance-actions"),
    route("GET", "/v1/intel/collection-runs"),
    route("GET", "/v1/intel/source-health"),
    route("GET", "/v1/intel/source-operations"),
    route("GET", "/v1/intel/timeliness"),
    route("GET", "/v1/evidence/replay-plan"),
    route("GET", "/v1/evidence/cutover-report"),
    route("GET", "/v1/evidence/trust-ledger"),
    route("GET", "/v1/evidence/claim-ledger"),
    route("GET", "/v1/analyst/claim-ledger"),
    route("POST", "/v1/analyst/claim-ledger/:claimId/actions"),
    route("GET", "/v1/intel/validation-records"),
    route("POST", "/v1/intel/validation-records"),
    route("GET", "/v1/intel/evaluation-labels"),
    route("POST", "/v1/intel/evaluation-labels"),
    route("GET", "/v1/intel/evaluation"),
    route("GET", "/v1/intel/evaluation/benchmarks"),
    route("POST", "/v1/intel/evaluation/benchmarks"),
    route("GET", "/v1/intel/evaluation/benchmarks/:benchmarkId/tasks"),
    route("POST", "/v1/intel/evaluation/benchmarks/:benchmarkId/annotations"),
    route("POST", "/v1/intel/evaluation/benchmarks/:benchmarkId/tasks/:taskId/adjudicate"),
    route("POST", "/v1/intel/evaluation/benchmarks/:benchmarkId/tasks/:taskId/retry"),
    route("POST", "/v1/intel/evaluation/benchmarks/:benchmarkId/run"),
    route("POST", "/v1/intel/runs"),
    route("GET", "/v1/darkweb/status"),
    route("GET", "/v1/darkweb/search"),
    route("GET", "/v1/sources"),
    route("GET", "/v1/sources/atlas"),
    route("GET", "/v1/quality/evaluate"),
    route("GET", "/v1/restricted-metadata/status"),
    route("POST", "/v1/restricted-metadata/apply-plan"),
    route("POST", "/v1/sources/:sourceId/restricted-metadata/apply-plan"),
    route("GET", "/v1/ops/product-slo"),
    route("GET", "/v1/contracts"),
    route("GET", "/v1/dwm/watchlists"),
    route("POST", "/v1/dwm/watchlists"),
    route("GET", "/v1/dwm/alerts/generation-readiness"),
    route("POST", "/v1/dwm/alerts/:alertId/case-handoff"),
    route("GET", "/v1/cases"),
    route("GET", "/v1/cases/:caseId/action-replay-export"),
    route("GET", "/v1/cases/:caseId/handoff-actions"),
    route("GET", "/v1/cases/:caseId/workflow-transitions"),
    route("GET", "/v1/cases/:caseId/webhook-replay-readiness"),
    route("POST", "/v1/cases/:caseId/handoff-action"),
    route("PATCH", "/v1/cases/:caseId"),
    route("GET", ORG_ALERT_CASE_ACTION_LEDGER_ROUTE),
    route("POST", ORG_ALERT_CASE_ACTION_LEDGER_ROUTE),
    route("GET", ORG_ALERT_CASE_ACTION_TIMELINE_ROUTE)
  ];
  const index = {
    endpoint: "/v1/contracts",
    schemaVersion: "ti.api_contract_index.compact.v4",
    routeInventory: { count: routes.length, routes },
    surfaces: [
      {
        id: "shared_watchlist_alert_export",
        ownerLane: "org",
        route: "/v1/dwm/watchlists",
        downstreamRoutes: {
          alertGenerationReadiness: "/v1/dwm/alerts/generation-readiness",
          alertRebuild: "/v1/dwm/alerts/rebuild",
          webhookDelivery: "/v1/dwm/webhooks/deliver"
        },
        methods: ["GET", "POST"],
        schemas: {
          export: "organization.shared_watchlist_alert_generation_export.v1",
          consumers: "organization.shared_watchlist_alert_generation_consumers.v1",
          runtimeWatchlist: "organization.watchlist_alert_generation.v1"
        },
        scopeFields: ["tenantId", "organizationId", "member.role", "member.status"],
        writeFields: ["organizationId", "terms", "webhookDestinationId", "reason"],
        recordFields: ["watchlistId", "watchlistItemId", "term", "normalizedTerm", "alertGeneratorKey", "lifecycle.status", "dedupe.key"],
        consumerFields: ["runtimeWatchlists", "termExport.alertGeneratorKeys", "termExport.watchlistItemIds", "blockers.code"],
        blockerCodes: ["not_member", "member_inactive", "role_not_allowed", "visibility_denied", "org_lifecycle_blocked", "term_org_mismatch", "no_active_watchlist_terms"],
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false
        }
      },
      {
        id: "alert_case_handoff",
        ownerLane: "case",
        route: "/v1/dwm/alerts/:alertId/case-handoff",
        methods: ["POST"],
        schemas: {
          handoff: "dwm.alert_case_handoff.v1",
          case: "analyst.case_detail.v1"
        },
        scopeFields: ["tenantId", "organizationId", "alertId", "caseId", "watchlistIds", "watchlistItemIds"],
        writeFields: ["organizationId", "assignedOwner", "note", "idempotencyKey"],
        recordFields: ["alertId", "caseId", "casePath", "webhookDestinationIds", "captureIds", "sourceIds", "contentHashes", "auditEventId", "workflowEventId", "dedupeKey", "deliveryDedupeKey", "replayState", "readiness", "consumerActions"],
        caseDetailFields: ["alertCaseHandoffContext", "handoffActionReadiness", "handoffActionReadiness.readyActionIds", "handoffActionReadiness.actions.alertReplay", "handoffActionReadiness.actions.webhookDryRun"],
        consumerActions: [
          { id: "alertReplay", route: "/v1/dwm/alerts/:alertId/replay", method: "POST", bodyFields: ["organizationId", "caseId", "casePath", "expectedWorkflowEventCount"] },
          { id: "webhookDryRun", route: "/v1/dwm/webhooks/deliver", method: "POST", bodyFields: ["organizationId", "alertId", "caseId", "casePath", "webhookDestinationId", "webhookDestinationIds", "dryRun", "limit"] }
        ],
        blockerCodes: ["alert_not_found", "missing_alert_provenance", "missing_webhook_destination", "missing_alert_id", "case_closed", "organization_visibility_denied", "case_read_only_member", "invalid_case_owner_role"],
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false
        }
      },
      {
        id: "case_handoff_action_receipt",
        ownerLane: "case",
        route: "/v1/cases/:caseId/handoff-action",
        historyRoute: "/v1/cases/:caseId/handoff-actions",
        replayExportRoute: "/v1/cases/:caseId/action-replay-export",
        webhookReplayReadinessRoute: "/v1/cases/:caseId/webhook-replay-readiness",
        methods: ["GET", "POST"],
        schemas: {
          receipt: "dwm.case_handoff_action_receipt.v1",
          history: "dwm.case_handoff_action_history.v1",
          replayExport: "dwm.case_action_replay_export.v1",
          alertReasonContext: "dwm.case_alert_reason_context.v1",
          organizationAccessReadiness: "dwm.case_org_access_replay_readiness.v1",
          webhookReplayFixture: "dwm.case_to_webhook_replay_readiness_fixture.v1",
          publicTiHandoffReadiness: "dwm.case_public_ti_handoff_replay_readiness.v1",
          webhookDryRunReadiness: "dwm.case_webhook_dry_run_replay_readiness.v1",
          webhookDeliveryReplayContext: "dwm.case_webhook_delivery_replay_context.v1",
          webhookReplayReadinessResponse: "dwm.case_webhook_replay_readiness_response.v1",
          customerNotificationReadiness: "dwm.case_customer_notification_readiness.v1",
          sourceHandoffReadiness: "dwm.case_source_handoff_replay_readiness.v1",
          supportRecoveryReadiness: "dwm.case_support_recovery_readiness.v1",
          workflowTransitionHistory: "dwm.case_workflow_transition_history.v1",
          workflowActionPolicy: "analyst.case_workflow_action_policy.v1",
          auditTimeline: "dwm.case_replay_audit_timeline.v1",
          readiness: "dwm.case_handoff_action_readiness.v1",
          detail: "analyst.case_detail.v1"
        },
        scopeFields: ["tenantId", "organizationId", "caseId", "alertId", "actionId"],
        writeFields: ["organizationId", "actionId", "note", "idempotencyKey"],
        queryFields: ["organizationId", "actionId", "idempotencyKey", "dedupeKey", "actor", "eventAction"],
        recordFields: ["receiptId", "caseId", "alertId", "actionId", "route", "method", "auditEventId", "workflowEventId", "idempotencyKey", "dedupeKey", "captureIds", "sourceIds", "contentHashes", "webhookDeliveryId", "webhookDestinationId", "endpointHash", "payloadHash", "alertReasonContext", "organizationAccessReadiness", "publicTiHandoffReadiness", "sourceFamily", "sourceHandoffReadiness", "supportRecoveryReadiness", "webhookDeliveryReplayContext", "webhookReplayReadinessResponse", "customerNotificationReadiness", "workflowTransitionHistory", "workflowActionPolicy", "auditTimeline", "nextAnalystActions", "nextWebhookActions"],
        blockerCodes: ["case_not_found", "missing_case_alert", "unsupported_handoff_action", "handoff_action_not_ready", "case_read_only_member", "organization_visibility_denied", "missing_webhook_destination", "missing_webhook_dry_run_receipt", "missing_delivered_webhook", "missing_watchlist_match", "missing_watchlist_id", "missing_source_evidence", "missing_alert_source_handoff_readiness", "public_ti_handoff_not_ready", "missing_case_owner", "missing_organization_scope", "case_closed"],
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false
        }
      },
      {
        id: "case_customer_notification",
        ownerLane: "case",
        route: "/v1/cases/:caseId/customer-notification",
        methods: ["POST"],
        schemas: {
          receipt: "analyst.case_customer_notification.v1",
          readiness: "dwm.case_customer_notification_readiness.v1",
          replayExport: "dwm.case_action_replay_export.v1",
          detail: "analyst.case_detail.v1"
        },
        scopeFields: ["tenantId", "organizationId", "caseId", "alertId", "webhookDeliveryId", "webhookDestinationId"],
        writeFields: ["organizationId", "webhookDeliveryId", "deliveryMode", "externalReference", "rationale"],
        recordFields: ["receiptId", "caseId", "alertId", "organizationId", "deliveryMode", "webhookDeliveryId", "webhookDestinationId", "webhookStatus", "externalReference", "evidenceCount", "deliveryCount", "sourceIds", "contentHashes", "auditEventId", "workflowEventId", "idempotencyKey"],
        blockerCodes: ["case_not_found", "organization_visibility_denied", "case_read_only_member", "missing_rationale", "missing_delivered_webhook", "missing_external_reference"],
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false
        }
      },
      {
        id: "case_workflow_transition",
        ownerLane: "case",
        route: "/v1/cases/:caseId",
        listRoute: "/v1/cases",
        historyRoute: "/v1/cases/:caseId/workflow-transitions",
        methods: ["GET", "PATCH"],
        schemas: {
          transition: "analyst.case_workflow_transition.v1",
          transitionHistory: "dwm.case_workflow_transition_history.v1",
          transitionHistoryResponse: "dwm.case_workflow_transition_history_response.v1",
          actionPolicy: "analyst.case_workflow_action_policy.v1",
          detail: "analyst.case_detail.v1"
        },
        scopeFields: ["tenantId", "organizationId", "caseId", "alertId"],
        writeFields: ["organizationId", "action", "status", "assignedOwner", "note", "idempotencyKey"],
        queryFields: ["organizationId", "eventAction", "action", "idempotencyKey", "actor"],
        recordFields: ["caseId", "alertId", "organizationId", "action", "fromStatus", "toStatus", "fromOwner", "toOwner", "note", "auditEventId", "eventId", "idempotencyKey", "dedupeKey", "replayState", "workflowTransitionHistory", "workflowActionPolicy", "workflowActionPolicySummary"],
        workflowActions: ["note", "assign", "escalate", "suppress", "false_positive", "close", "reopen"],
        blockerCodes: ["organization_visibility_denied", "case_read_only_member", "invalid_case_transition", "unsupported_case_action", "invalid_case_owner_role", "missing_note", "missing_assigned_owner"],
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false
        }
      },
      {
        id: "product_readiness_receipt_matrix",
        ownerLane: "integration",
        route: "/v1/contracts",
        methods: ["GET"],
        schemas: {
          matrix: PRODUCT_READINESS_RECEIPT_MATRIX_SCHEMA_VERSION,
          aggregate: PRODUCT_READINESS_SCHEMA_VERSION
        },
        scopeFields: ["tenantId", "organizationId", "member.role", "member.status", "capabilityId", "ownerLane"],
        recordFields: ["id", "customerWorkflowIds", "contractIds", "schemaIds", "receiptSchemaIds", "blockerCodes", "readinessRoute", "scopeFields", "downstreamOwners", "safeOutput"],
        blockerCodes: [
          "missing_contract_reference",
          "missing_customer_workflow",
          "missing_customer_workflow_ids",
          "unknown_customer_workflow_id",
          "missing_contract_ids",
          "missing_schema_ids",
          "missing_scope_fields",
          "unsafe_receipt_matrix_row"
        ],
        downstreamConsumers: [
          { ownerLane: "integration", route: "/v1/contracts", requiredFields: ["productReadinessReceiptMatrix.rows", "schemaLookup.rows", "receiptSchemas"] },
          { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["id", "customerVisibleState", "blockerCodes", "readinessRoute"] },
          { ownerLane: "support", route: "/api/admin/support/readiness", requiredFields: ["organizationId", "ownerLane", "blockerCodes", "scopeFields"] }
        ],
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false,
          crossOrgDataExposed: false
        }
      },
      {
        id: "product_readiness_proof_view",
        ownerLane: "integration",
        route: "/v1/contracts",
        methods: ["GET"],
        schemas: {
          proofView: PRODUCT_READINESS_PROOF_VIEW_SCHEMA_VERSION,
          matrix: PRODUCT_READINESS_RECEIPT_MATRIX_SCHEMA_VERSION
        },
        scopeFields: ["tenantId", "organizationId", "customerWorkflowId", "capabilityId", "ownerLane"],
        recordFields: ["workflowId", "state", "capabilityIds", "readinessRoutes", "schemaIds", "receiptSchemaIds", "handoffFields", "downstreamConsumers", "safeOutput"],
        blockerCodes: ["workflow_unsupported", "workflow_partial", "workflow_blocked", "missing_contract_ids", "missing_schema_ids", "missing_required_receipt_schema", "unsafe_receipt_matrix_row"],
        downstreamConsumers: [
          { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["workflowId", "state", "blockerCodes", "readinessRoutes", "handoffFields"] },
          { ownerLane: "alert", route: "/v1/dwm/alerts/generation-readiness", requiredFields: ["workflowId", "capabilityIds", "schemaIds", "handoffFields"] },
          { ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", requiredFields: ["workflowId", "state", "webhookDestinationId", "destinationDeliveryState"] },
          { ownerLane: "publicTI", route: "/ti", requiredFields: ["workflowId", "state", "provenanceHash", "sourceFamilies"] },
          { ownerLane: "support", route: "/api/admin/support/readiness", requiredFields: ["workflowId", "state", "blockerCodes", "scopeFields"] }
        ],
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false,
          crossOrgDataExposed: false
        }
      },
      {
        id: "product_readiness_org_capability_packet",
        ownerLane: "integration",
        route: "/v1/contracts",
        methods: ["GET"],
        schemas: {
          orgCapabilityPacket: PRODUCT_READINESS_ORG_CAPABILITY_PACKET_SCHEMA_VERSION,
          proofView: PRODUCT_READINESS_PROOF_VIEW_SCHEMA_VERSION
        },
        scopeFields: ["tenantId", "organizationId", "workflowId", "orgCapabilityId", "ownerLane"],
        recordFields: ["orgCapabilityId", "workflowId", "state", "proof", "readinessFields", "missingReadinessFields", "blockerCodes", "downstreamConsumers", "safeOutput"],
        blockerCodes: ["workflow_unsupported", "workflow_partial", "workflow_blocked", "missing_org_capability_fields"],
        downstreamConsumers: [
          { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["orgCapabilityId", "state", "proof", "blockerCodes"] },
          { ownerLane: "alert", route: "/v1/dwm/alerts/generation-readiness", requiredFields: ["organizationId", "watchlistId", "alertId", "caseId", "provenanceHash"] },
          { ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", requiredFields: ["organizationId", "alertId", "caseId", "destinationDeliveryState"] },
          { ownerLane: "publicTI", route: "/ti", requiredFields: ["organizationId", "provenanceHash", "sourceCoverageState"] },
          { ownerLane: "support", route: "/api/admin/support/readiness", requiredFields: ["organizationId", "orgCapabilityId", "blockerCodes"] }
        ],
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false,
          crossOrgDataExposed: false
        }
      },
      {
        id: "product_readiness_consumer_handoff_packet",
        ownerLane: "integration",
        route: "/v1/contracts",
        methods: ["GET"],
        schemas: {
          consumerHandoffPacket: PRODUCT_READINESS_CONSUMER_HANDOFF_PACKET_SCHEMA_VERSION,
          orgCapabilityPacket: PRODUCT_READINESS_ORG_CAPABILITY_PACKET_SCHEMA_VERSION
        },
        scopeFields: ["tenantId", "organizationId", "consumerId", "orgCapabilityIds", "ownerLane"],
        recordFields: ["consumerId", "state", "ownerLane", "orgCapabilityIds", "proof", "fieldAliases", "blockerCodes", "safeOutput"],
        blockerCodes: ["consumer_handoff_unsupported", "consumer_handoff_partial", "consumer_handoff_blocked", "missing_consumer_handoff_fields"],
        downstreamConsumers: [
          { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["consumerId", "state", "orgCapabilityIds", "blockerCodes"] },
          { ownerLane: "alert", route: "/v1/dwm/alerts/generation-readiness", requiredFields: ["orgId", "watchlistId", "alertId", "caseId", "provenanceHash", "sourceCoverage"] },
          { ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", requiredFields: ["orgId", "alertId", "caseId", "destinationDeliveryState", "workflowState"] },
          { ownerLane: "publicTI", route: "/ti", requiredFields: ["orgId", "provenanceHash", "sourceCoverage"] },
          { ownerLane: "support", route: "/api/admin/support/readiness", requiredFields: ["orgId", "blockerReason", "owningLane"] }
        ],
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false,
          crossOrgDataExposed: false
        }
      },
      {
        id: "org_alert_case_action_ledger",
        ownerLane: "case",
        route: ORG_ALERT_CASE_ACTION_LEDGER_ROUTE,
        timelineRoute: ORG_ALERT_CASE_ACTION_TIMELINE_ROUTE,
        methods: ["GET", "POST"],
        schemas: {
          list: DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_LIST_SCHEMA_VERSION,
          write: DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_WRITE_SCHEMA_VERSION,
          timeline: DWM_ORG_ALERT_CASE_ACTION_TIMELINE_SCHEMA_VERSION
        },
        scopeFields: ["tenantId", "organizationId"],
        queryFields: ["receiptId", "alertId", "casePath"],
        writeFields: ["tenantId", "organizationId", "receipt", "recordedAt", "allowBlockedReceipt"],
        recordFields: [
          "receiptId",
          "watchlistId",
          "watchlistItemId",
          "alertIds",
          "casePaths",
          "action",
          "execution",
          "auditEventId",
          "replayState",
          "idempotencyKey",
          "dedupeKey"
        ],
        caseQueueFilters: ["caseActionReceiptId", "caseActionAuditEventId", "caseActionIdempotencyKey", "caseActionDedupeKey", "caseActionReplayState"],
        blockerCodes: ["missing_tenant_scope", "missing_organization_scope", "organization_scope_mismatch", "blocked_receipt"],
        routeErrorCodes: ["missing_receipt", "method_not_allowed"],
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false
        }
      }
    ],
    receiptSchemas: [
      receiptSchema({
        id: "org_alert_case_action_receipt",
        ownerLane: "case",
        schemas: {
          receipt: DWM_ORG_ALERT_CASE_ACTION_RECEIPT_SCHEMA_VERSION,
          auditEvent: DWM_ORG_ALERT_CASE_ACTION_AUDIT_EVENT_SCHEMA_VERSION,
          ledgerWrite: DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_WRITE_SCHEMA_VERSION,
          ledgerList: DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_LIST_SCHEMA_VERSION,
          timeline: DWM_ORG_ALERT_CASE_ACTION_TIMELINE_SCHEMA_VERSION
        },
        routes: [ORG_ALERT_CASE_ACTION_LEDGER_ROUTE, ORG_ALERT_CASE_ACTION_TIMELINE_ROUTE, "/v1/cases/:caseId"],
        scopeFields: ["tenantId", "organizationId", "alertId", "casePath", "receiptId"],
        requiredFields: ["receiptId", "action", "execution.status", "auditEventId", "idempotencyKey", "dedupeKey"],
        blockerCodes: ["missing_tenant_scope", "missing_organization_scope", "organization_scope_mismatch", "blocked_receipt"],
        downstreamConsumers: [
          { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["receiptId", "action", "execution.status"] },
          { ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", requiredFields: ["alertIds", "casePaths", "replayState"] }
        ]
      }),
      receiptSchema({
        id: "source_provenance_receipts",
        ownerLane: "source",
        schemas: {
          alertRebuildReceipt: TI_SOURCE_PROVENANCE_ALERT_REBUILD_RECEIPT_SCHEMA_VERSION,
          actorEnrichmentGapReceipt: TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_GAP_RECEIPT_SCHEMA_VERSION,
          sourcePackIntakeReceipt: TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_RECEIPT_SCHEMA_VERSION,
          sourceActivationDecisionReceipt: TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_DECISION_RECEIPT_SCHEMA_VERSION
        },
        routes: ["/v1/dwm/source-requests/readiness", "/v1/dwm/alerts/rebuild", "/ti"],
        scopeFields: ["tenantId", "organizationId", "sourceIds", "captureIds", "contentHashes", "actor"],
        requiredFields: ["sourceIds", "captureIds", "provenance.refs", "freshnessState", "blockers.code"],
        blockerCodes: ["source_inactive", "source_policy_inactive", "missing_source_provenance", "case_handoff_blocked"],
        downstreamConsumers: [
          { ownerLane: "alert", route: "/v1/dwm/alerts/rebuild", requiredFields: ["sourceIds", "captureIds", "contentHashes"] },
          { ownerLane: "publicTI", route: "/ti", requiredFields: ["actor", "provenance.refs", "sourceFamilies"] }
        ]
      }),
      receiptSchema({
        id: "support_action_receipts",
        ownerLane: "support",
        schemas: {
          executionHandoff: SUPPORT_ACTION_EXECUTION_HANDOFF_SCHEMA_VERSION,
          executorReadiness: SUPPORT_ACTION_EXECUTOR_READINESS_SCHEMA_VERSION
        },
        routes: ["/api/admin/support/readiness", "/api/admin/support/organizations/:id/access-recovery", "/api/admin/support/organizations/:id/invites"],
        scopeFields: ["tenantId", "organizationId", "actorId", "action", "idempotencyKey", "audit.reason"],
        requiredFields: ["action", "executorContract.path", "executorReadiness.ready", "execution.path", "audit.blockerCode"],
        blockerCodes: ["support_executor_unavailable", "helpdesk_audit_unavailable", "missing_invite_teammate_executor"],
        downstreamConsumers: [
          { ownerLane: "org", route: "GET /api/organizations/:id/members", requiredFields: ["member.status", "invite.status", "auditEventId"] },
          { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["organizationId", "supportAction.status"] }
        ]
      })
    ],
    schemaLookup: {
      schemaVersion: "ti.api_contract_schema_lookup.v1",
      rows: [
        schemaLookupRow({
          schemaId: PRODUCT_READINESS_RECEIPT_MATRIX_SCHEMA_VERSION,
          contractId: "product_readiness_receipt_matrix",
          ownerLane: "integration",
          route: "/v1/contracts",
          scopeFields: ["tenantId", "organizationId", "member.role", "member.status", "capabilityId", "ownerLane"],
          blockerCodes: [
            "missing_contract_reference",
            "missing_customer_workflow",
            "missing_customer_workflow_ids",
            "unknown_customer_workflow_id",
            "missing_contract_ids",
            "missing_schema_ids",
            "missing_scope_fields",
            "unsafe_receipt_matrix_row"
          ],
          downstreamConsumers: [
            { ownerLane: "integration", route: "/v1/contracts", requiredFields: ["productReadinessReceiptMatrix.rows", "schemaLookup.rows", "receiptSchemas"] },
            { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["id", "customerVisibleState", "blockerCodes"] }
          ]
        }),
        schemaLookupRow({
          schemaId: PRODUCT_READINESS_PROOF_VIEW_SCHEMA_VERSION,
          contractId: "product_readiness_proof_view",
          ownerLane: "integration",
          route: "/v1/contracts",
          scopeFields: ["tenantId", "organizationId", "customerWorkflowId", "capabilityId", "ownerLane"],
          blockerCodes: ["workflow_unsupported", "workflow_partial", "workflow_blocked", "missing_contract_ids", "missing_schema_ids", "missing_required_receipt_schema"],
          downstreamConsumers: [
            { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["workflowId", "state", "readinessRoutes", "handoffFields"] },
            { ownerLane: "alert", route: "/v1/dwm/alerts/generation-readiness", requiredFields: ["workflowId", "capabilityIds", "schemaIds"] },
            { ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", requiredFields: ["workflowId", "webhookDestinationId", "destinationDeliveryState"] },
            { ownerLane: "publicTI", route: "/ti", requiredFields: ["workflowId", "provenanceHash", "sourceFamilies"] }
          ]
        }),
        schemaLookupRow({
          schemaId: PRODUCT_READINESS_ORG_CAPABILITY_PACKET_SCHEMA_VERSION,
          contractId: "product_readiness_org_capability_packet",
          ownerLane: "integration",
          route: "/v1/contracts",
          scopeFields: ["tenantId", "organizationId", "workflowId", "orgCapabilityId", "ownerLane"],
          blockerCodes: ["workflow_unsupported", "workflow_partial", "workflow_blocked", "missing_org_capability_fields"],
          downstreamConsumers: [
            { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["orgCapabilityId", "state", "proof"] },
            { ownerLane: "alert", route: "/v1/dwm/alerts/generation-readiness", requiredFields: ["organizationId", "watchlistId", "alertId", "caseId", "provenanceHash"] },
            { ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", requiredFields: ["organizationId", "alertId", "caseId", "destinationDeliveryState"] },
            { ownerLane: "publicTI", route: "/ti", requiredFields: ["organizationId", "provenanceHash", "sourceCoverageState"] }
          ]
        }),
        schemaLookupRow({
          schemaId: PRODUCT_READINESS_CONSUMER_HANDOFF_PACKET_SCHEMA_VERSION,
          contractId: "product_readiness_consumer_handoff_packet",
          ownerLane: "integration",
          route: "/v1/contracts",
          scopeFields: ["tenantId", "organizationId", "consumerId", "orgCapabilityIds", "ownerLane"],
          blockerCodes: ["consumer_handoff_unsupported", "consumer_handoff_partial", "consumer_handoff_blocked", "missing_consumer_handoff_fields"],
          downstreamConsumers: [
            { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["consumerId", "state", "orgCapabilityIds", "blockerCodes"] },
            { ownerLane: "alert", route: "/v1/dwm/alerts/generation-readiness", requiredFields: ["orgId", "watchlistId", "alertId", "caseId", "provenanceHash", "sourceCoverage"] },
            { ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", requiredFields: ["orgId", "alertId", "caseId", "destinationDeliveryState", "workflowState"] },
            { ownerLane: "publicTI", route: "/ti", requiredFields: ["orgId", "provenanceHash", "sourceCoverage"] },
            { ownerLane: "support", route: "/api/admin/support/readiness", requiredFields: ["orgId", "blockerReason", "owningLane"] }
          ]
        }),
        schemaLookupRow({
          schemaId: DWM_ORG_ALERT_CASE_ACTION_RECEIPT_SCHEMA_VERSION,
          contractId: "org_alert_case_action_receipt",
          ownerLane: "case",
          route: ORG_ALERT_CASE_ACTION_LEDGER_ROUTE,
          scopeFields: ["tenantId", "organizationId", "alertId", "casePath", "receiptId"],
          blockerCodes: ["missing_tenant_scope", "missing_organization_scope", "organization_scope_mismatch", "blocked_receipt"],
          downstreamConsumers: [
            { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["receiptId", "action", "execution.status"] },
            { ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", requiredFields: ["alertIds", "casePaths", "replayState"] }
          ]
        }),
        schemaLookupRow({
          schemaId: TI_SOURCE_PROVENANCE_ALERT_REBUILD_RECEIPT_SCHEMA_VERSION,
          contractId: "source_provenance_receipts",
          ownerLane: "source",
          route: "/v1/dwm/alerts/rebuild",
          scopeFields: ["tenantId", "organizationId", "sourceIds", "captureIds", "contentHashes", "actor"],
          blockerCodes: ["source_inactive", "source_policy_inactive", "missing_source_provenance", "case_handoff_blocked"],
          downstreamConsumers: [
            { ownerLane: "alert", route: "/v1/dwm/alerts/rebuild", requiredFields: ["sourceIds", "captureIds", "contentHashes"] },
            { ownerLane: "publicTI", route: "/ti", requiredFields: ["actor", "provenance.refs", "sourceFamilies"] }
          ]
        }),
        schemaLookupRow({
          schemaId: SUPPORT_ACTION_EXECUTION_HANDOFF_SCHEMA_VERSION,
          contractId: "support_action_receipts",
          ownerLane: "support",
          route: "/api/admin/support/readiness",
          scopeFields: ["tenantId", "organizationId", "actorId", "action", "idempotencyKey", "audit.reason"],
          blockerCodes: ["support_executor_unavailable", "helpdesk_audit_unavailable", "missing_invite_teammate_executor"],
          downstreamConsumers: [
            { ownerLane: "org", route: "GET /api/organizations/:id/members", requiredFields: ["member.status", "invite.status", "auditEventId"] },
            { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["organizationId", "supportAction.status"] }
          ]
        })
      ],
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    },
    productReadinessReceiptMatrix: {
      schemaVersion: PRODUCT_READINESS_RECEIPT_MATRIX_SCHEMA_VERSION,
      aggregateSchemaVersion: PRODUCT_READINESS_SCHEMA_VERSION,
      route: "/v1/contracts",
      reportField: "productReadinessReceiptMatrix",
      producer: "buildProductReadinessReceiptMatrix",
      validator: "validateProductReadinessReceiptMatrix",
      rows: [
        productReadinessReceiptMatrixRow({
          capabilityId: "organization_lifecycle",
          customerWorkflowIds: ["org_membership"],
          ownerLane: "org",
          readinessRoute: "GET /api/organizations/:id/readiness-lifecycle",
          contractIds: ["organization_lifecycle", "organization_lifecycle_readiness"],
          schemaIds: ["organization.lifecycle_readiness.v1"],
          blockerCodes: ["org_missing", "missing_active_owner", "member_inactive"],
          scopeFields: ["tenantId", "organizationId", "member.role", "member.status"],
          downstreamConsumers: [
            { ownerLane: "watchlist", route: "GET /api/organizations/:id/watchlists/alert-terms", requiredFields: ["organizationId", "tenantId", "member.role", "member.status"] },
            { ownerLane: "support", route: "POST /api/admin/support/organizations/:id/access-recovery", requiredFields: ["organizationId", "actorId", "audit.reason"] }
          ]
        }),
        productReadinessReceiptMatrixRow({
          capabilityId: "shared_watchlists",
          customerWorkflowIds: ["shared_watchlists", "alert_generation"],
          ownerLane: "watchlist",
          readinessRoute: "GET /api/organizations/:id/watchlists/alert-terms",
          contractIds: ["shared_watchlist_alert_export", "shared_watchlist_alert_generation"],
          schemaIds: [
            ORG_SHARED_WATCHLIST_ALERT_EXPORT_SCHEMA_VERSION,
            ORG_SHARED_WATCHLIST_ALERT_CONSUMERS_SCHEMA_VERSION,
            ORG_SHARED_WATCHLIST_READINESS_PROOF_SCHEMA_VERSION
          ],
          blockerCodes: ["not_member", "member_inactive", "role_not_allowed", "term_org_mismatch", "no_active_watchlist_terms"],
          scopeFields: ["tenantId", "organizationId", "member.role", "member.status", "watchlistId", "watchlistItemIds"],
          downstreamConsumers: [
            { ownerLane: "alert", route: "/v1/dwm/alerts/generation-readiness", requiredFields: ["runtimeWatchlists", "termExport.alertGeneratorKeys", "termExport.watchlistItemIds"] },
            { ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", requiredFields: ["runtimeWatchlists[].webhookDestinationId", "termExport.alertGeneratorKeys"] },
            { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["state", "member.role", "termExport", "blockers.code"] }
          ]
        }),
        productReadinessReceiptMatrixRow({
          capabilityId: "source_activation",
          customerWorkflowIds: ["source_health", "alert_generation", "public_ti_handoff"],
          ownerLane: "source",
          readinessRoute: "GET /v1/dwm/source-requests/readiness",
          contractIds: ["source_activation_and_provenance", "source_provenance_readiness", "source_provenance_receipts"],
          schemaIds: ["dwm.source_worker_readiness.v1", "dwm.source_pack_action_contract.v1"],
          receiptSchemaIds: [
            TI_SOURCE_PROVENANCE_ALERT_REBUILD_RECEIPT_SCHEMA_VERSION,
            TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_GAP_RECEIPT_SCHEMA_VERSION,
            TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_RECEIPT_SCHEMA_VERSION,
            TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_DECISION_RECEIPT_SCHEMA_VERSION
          ],
          blockerCodes: ["source_inactive", "source_policy_inactive", "source_worker_not_ready", "missing_source_provenance"],
          scopeFields: ["tenantId", "organizationId", "sourceIds", "sourceFamily", "provenance.refs"],
          downstreamConsumers: [
            { ownerLane: "alert", route: "POST /v1/dwm/alerts/rebuild", requiredFields: ["sourceIds", "captureIds", "freshProvenance"] },
            { ownerLane: "publicTI", route: "/ti", requiredFields: ["artifactId", "provenance", "backedIds.sourceIds"] }
          ]
        }),
        productReadinessReceiptMatrixRow({
          capabilityId: "alert_case_workflow",
          customerWorkflowIds: ["alert_generation", "case_workflow", "webhook_delivery"],
          ownerLane: "alert",
          readinessRoute: "POST /v1/dwm/alerts/rebuild -> POST /v1/cases",
          contractIds: ["org_scoped_alert_case_workflow", "org_alert_case_workflow", "org_alert_case_action_receipt"],
          schemaIds: ["organization.watchlist_alert_readiness.v1", "dwm.alert_case_handoff.v1", "analyst.case_detail.v1"],
          receiptSchemaIds: [DWM_ORG_ALERT_CASE_ACTION_RECEIPT_SCHEMA_VERSION, DWM_ORG_ALERT_CASE_ACTION_AUDIT_EVENT_SCHEMA_VERSION],
          blockerCodes: ["missing_alert_provenance", "missing_alert_id", "case_closed", "organization_visibility_denied", "case_read_only_member"],
          scopeFields: ["tenantId", "organizationId", "alertId", "caseId", "casePath", "watchlistItemIds"],
          downstreamConsumers: [
            { ownerLane: "case", route: "PATCH /v1/cases/:caseId", requiredFields: ["alertId", "casePath", "workflowState", "timeline"] },
            { ownerLane: "webhook", route: "/v1/dwm/webhooks/deliver", requiredFields: ["alertId", "casePath", "webhookDestinationIds"] },
            { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["alertId", "casePath", "nextAllowedActions"] }
          ]
        }),
        productReadinessReceiptMatrixRow({
          capabilityId: "webhook_delivery",
          customerWorkflowIds: ["webhook_delivery"],
          ownerLane: "webhook",
          readinessRoute: "POST /api/organizations/:id/webhooks -> POST /v1/dwm/webhooks/deliver",
          contractIds: ["webhook_destination"],
          schemaIds: ["dwm.webhook.destination_lifecycle.v1", "dwm.webhook.audit_event.v1"],
          blockerCodes: ["missing_webhook_destination", "webhook_not_verified", "unsupported_destination", "organization_visibility_denied"],
          scopeFields: ["tenantId", "organizationId", "destinationId", "webhookDestinationIds", "alertId", "casePath"],
          downstreamConsumers: [
            { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["deliveryId", "destination.status", "lastAttempt.status"] },
            { ownerLane: "support", route: "/api/admin/support/readiness", requiredFields: ["organizationId", "destinationId", "auditEventId"] }
          ]
        }),
        productReadinessReceiptMatrixRow({
          capabilityId: "support_controls",
          customerWorkflowIds: ["org_membership"],
          ownerLane: "support",
          readinessRoute: "POST /api/admin/support/organizations/:id/access-recovery",
          contractIds: ["support_executor", "support_recovery_receipts", "support_action_receipts"],
          schemaIds: [SUPPORT_ACTION_EXECUTION_HANDOFF_SCHEMA_VERSION, SUPPORT_ACTION_EXECUTOR_READINESS_SCHEMA_VERSION],
          receiptSchemaIds: [SUPPORT_ACTION_EXECUTION_HANDOFF_SCHEMA_VERSION, SUPPORT_ACTION_EXECUTOR_READINESS_SCHEMA_VERSION],
          blockerCodes: ["support_executor_unavailable", "helpdesk_audit_unavailable", "missing_invite_teammate_executor"],
          scopeFields: ["tenantId", "organizationId", "actorId", "action", "audit.reason", "idempotencyKey"],
          downstreamConsumers: [
            { ownerLane: "org", route: "GET /api/organizations/:id/members", requiredFields: ["member.status", "invite.status", "auditEventId"] },
            { ownerLane: "dashboard", route: "/dashboard", requiredFields: ["organizationId", "supportAction.status"] }
          ]
        }),
        productReadinessReceiptMatrixRow({
          capabilityId: "dashboard_operator_workspace",
          customerWorkflowIds: ["case_workflow"],
          ownerLane: "dashboard",
          readinessRoute: "/dashboard",
          contractIds: ["dashboard_operator_workspace"],
          schemaIds: ["hanasand.ui_quality_proof.v1", "analyst.case_detail.v1"],
          blockerCodes: ["missing_dashboard_ui_quality_proof", "case_read_only_member", "organization_visibility_denied"],
          scopeFields: ["tenantId", "organizationId", "member.role", "alertId", "caseId"],
          downstreamConsumers: [
            { ownerLane: "alert", route: "PATCH /v1/cases/:caseId", requiredFields: ["status", "assignedOwner", "rationale"] },
            { ownerLane: "support", route: "/api/admin/support/readiness", requiredFields: ["organizationId", "caseId", "auditEventId"] }
          ]
        }),
        productReadinessReceiptMatrixRow({
          capabilityId: "public_ti_actor_handoff",
          customerWorkflowIds: ["public_ti_handoff", "shared_watchlists", "case_workflow"],
          ownerLane: "publicTI",
          readinessRoute: "/ti",
          contractIds: ["public_ti_actor_handoff"],
          schemaIds: ["ti.public_actor.authenticated_bridge.v1", "ti.public_actor.readiness.v1"],
          blockerCodes: ["public_ti_contract_mismatch", "missing_source_provenance", "source_coverage_required_for_ti"],
          scopeFields: ["tenantId", "organizationId", "artifactId", "query", "provenance.refs"],
          downstreamConsumers: [
            { ownerLane: "watchlist", route: "GET /api/organizations/:id/watchlists/alert-terms", requiredFields: ["watchlistTerms", "actorAliases", "provenance"] },
            { ownerLane: "case", route: "POST /v1/cases", requiredFields: ["actorId", "casePath", "sourceRefs"] }
          ]
        }),
        productReadinessReceiptMatrixRow({
          capabilityId: "website_product_surface",
          customerWorkflowIds: ["public_ti_handoff"],
          ownerLane: "website",
          readinessRoute: "/",
          contractIds: ["website_product_surface"],
          schemaIds: ["hanasand.ui_quality_proof.v1", PRODUCT_READINESS_SCHEMA_VERSION],
          blockerCodes: ["missing_website_ui_quality_proof"],
          scopeFields: ["route", "checkedAt", "proofArtifactId"],
          downstreamConsumers: [
            { ownerLane: "integration", route: "/v1/contracts", requiredFields: ["routeInventory", "surfaces", "publicCompatibility"] }
          ]
        })
      ],
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    },
    semantics: { safeMetadataOnly: true, noCredentialCollection: true, noThreatActorInteraction: true },
    publicCompatibility: { canonicalSearchRoute: "/api/ti/search", unknownQueryCopy: "searching", noDefaultActor: true }
  };
  const productReadinessReceiptMatrixCoverageArtifact = productReadinessReceiptMatrixCoverage(
    index.productReadinessReceiptMatrix,
    index.receiptSchemas,
    index.schemaLookup.rows
  );
  const productReadinessProofViewArtifact = buildProductReadinessProofView(
    index.productReadinessReceiptMatrix,
    productReadinessReceiptMatrixCoverageArtifact
  );
  const productReadinessOrgCapabilityPacketArtifact = buildProductReadinessOrgCapabilityPacket(
    productReadinessProofViewArtifact
  );
  const productReadinessConsumerHandoffPacketArtifact = buildProductReadinessConsumerHandoffPacket(
    productReadinessOrgCapabilityPacketArtifact
  );
  const productReadinessContractCopyGuardArtifact = productReadinessContractCopyGuard(index);
  return {
    ...index,
    productReadinessReceiptMatrixCoverage: productReadinessReceiptMatrixCoverageArtifact,
    productReadinessProofView: productReadinessProofViewArtifact,
    productReadinessOrgCapabilityPacket: productReadinessOrgCapabilityPacketArtifact,
    productReadinessConsumerHandoffPacket: productReadinessConsumerHandoffPacketArtifact,
    productReadinessContractCopyGuard: productReadinessContractCopyGuardArtifact,
    productReadinessIntegrationGate: productReadinessIntegrationGate({
      coverage: productReadinessReceiptMatrixCoverageArtifact,
      copyGuard: productReadinessContractCopyGuardArtifact
    })
  };
}

function route(method: "GET" | "POST" | "PATCH", path: string) {
  return { method, path };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function receiptSchema(input: {
  id: string;
  ownerLane: "case" | "webhook" | "source" | "support";
  schemas: Record<string, string>;
  routes: string[];
  scopeFields: string[];
  requiredFields: string[];
  blockerCodes: string[];
  downstreamConsumers: Array<{ ownerLane: string; route: string; requiredFields: string[] }>;
}) {
  return {
    ...input,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

function productReadinessReceiptMatrixRow(input: {
  capabilityId: string;
  customerWorkflowIds: Array<"org_membership" | "shared_watchlists" | "alert_generation" | "webhook_delivery" | "case_workflow" | "source_health" | "public_ti_handoff">;
  ownerLane: "org" | "watchlist" | "source" | "alert" | "webhook" | "support" | "dashboard" | "publicTI" | "website";
  readinessRoute: string;
  contractIds: string[];
  schemaIds: string[];
  receiptSchemaIds?: string[];
  blockerCodes: string[];
  scopeFields: string[];
  downstreamConsumers: Array<{ ownerLane: string; route: string; requiredFields: string[] }>;
}) {
  return {
    ...input,
    receiptSchemaIds: input.receiptSchemaIds || [],
    downstreamOwners: [...new Set(input.downstreamConsumers.map((consumer) => consumer.ownerLane))],
    missingContract: false,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

export function productReadinessReceiptMatrixCoverage(
  matrix: {
    schemaVersion: string;
    rows: Array<{
      capabilityId: string;
      customerWorkflowIds: string[];
      ownerLane: string;
      readinessRoute: string;
      contractIds: string[];
      schemaIds: string[];
      receiptSchemaIds: string[];
      blockerCodes: string[];
      scopeFields: string[];
      downstreamConsumers: Array<{ ownerLane: string; route: string; requiredFields: string[] }>;
      safeOutput?: { metadataOnly?: boolean; rawEvidenceExposed?: boolean; webhookSecretExposed?: boolean; crossOrgDataExposed?: boolean };
    }>;
    safeOutput?: { metadataOnly?: boolean; rawEvidenceExposed?: boolean; webhookSecretExposed?: boolean; crossOrgDataExposed?: boolean };
  },
  receiptSchemas: Array<{ schemas: Record<string, string> }>,
  schemaLookupRows: Array<{ schemaId: string; contractId: string }>
) {
  const requiredCapabilityIds = [
    "organization_lifecycle",
    "shared_watchlists",
    "source_activation",
    "alert_case_workflow",
    "webhook_delivery",
    "support_controls",
    "dashboard_operator_workspace",
    "public_ti_actor_handoff",
    "website_product_surface"
  ];
  const requiredCustomerWorkflowIds = [
    "org_membership",
    "shared_watchlists",
    "alert_generation",
    "webhook_delivery",
    "case_workflow",
    "source_health",
    "public_ti_handoff"
  ];
  const knownReceiptSchemaIds = new Set([
    ...schemaLookupRows.map((row) => row.schemaId),
    ...receiptSchemas.flatMap((receipt) => Object.values(receipt.schemas))
  ]);
  const requiredReceiptSchemaIdsByCapability: Record<string, string[]> = {
    source_activation: [
      TI_SOURCE_PROVENANCE_ALERT_REBUILD_RECEIPT_SCHEMA_VERSION,
      TI_SOURCE_PROVENANCE_ACTOR_ENRICHMENT_GAP_RECEIPT_SCHEMA_VERSION,
      TI_SOURCE_PROVENANCE_SOURCE_PACK_INTAKE_RECEIPT_SCHEMA_VERSION,
      TI_SOURCE_PROVENANCE_SOURCE_ACTIVATION_DECISION_RECEIPT_SCHEMA_VERSION
    ],
    alert_case_workflow: [
      DWM_ORG_ALERT_CASE_ACTION_RECEIPT_SCHEMA_VERSION,
      DWM_ORG_ALERT_CASE_ACTION_AUDIT_EVENT_SCHEMA_VERSION
    ],
    support_controls: [
      SUPPORT_ACTION_EXECUTION_HANDOFF_SCHEMA_VERSION,
      SUPPORT_ACTION_EXECUTOR_READINESS_SCHEMA_VERSION
    ]
  };
  const matrixCapabilityIds = new Set(matrix.rows.map((row) => row.capabilityId));
  const missingCapabilityIds = requiredCapabilityIds.filter((id) => !matrixCapabilityIds.has(id));
  const matrixCustomerWorkflowIds = new Set(matrix.rows.flatMap((row) => row.customerWorkflowIds || []));
  const missingCustomerWorkflowIds = requiredCustomerWorkflowIds.filter((id) => !matrixCustomerWorkflowIds.has(id));
  const diffRows = matrix.rows.map((row) => {
    const missingContractIds = !Array.isArray(row.contractIds) || row.contractIds.length === 0 ? ["contractIds"] : [];
    const missingSchemaIds = !Array.isArray(row.schemaIds) || row.schemaIds.length === 0 ? ["schemaIds"] : [];
    const missingCustomerWorkflowIds = !Array.isArray(row.customerWorkflowIds) || row.customerWorkflowIds.length === 0 ? ["customerWorkflowIds"] : [];
    const unknownCustomerWorkflowIds = (row.customerWorkflowIds || []).filter((workflowId) => !requiredCustomerWorkflowIds.includes(workflowId));
    const missingScopeFields = !Array.isArray(row.scopeFields) || row.scopeFields.length === 0 ? ["scopeFields"] : [];
    const missingDownstreamConsumers = !Array.isArray(row.downstreamConsumers) || row.downstreamConsumers.length === 0 ? ["downstreamConsumers"] : [];
    const requiredReceiptSchemaIds = requiredReceiptSchemaIdsByCapability[row.capabilityId] || [];
    const missingRequiredReceiptSchemaIds = requiredReceiptSchemaIds.filter((schemaId) => !(row.receiptSchemaIds || []).includes(schemaId));
    const unindexedReceiptSchemaIds = (row.receiptSchemaIds || []).filter((schemaId) => !knownReceiptSchemaIds.has(schemaId));
    const unsafeFields = [
      !row.safeOutput?.metadataOnly ? "safeOutput.metadataOnly" : "",
      row.safeOutput?.rawEvidenceExposed ? "safeOutput.rawEvidenceExposed" : "",
      row.safeOutput?.webhookSecretExposed ? "safeOutput.webhookSecretExposed" : "",
      row.safeOutput?.crossOrgDataExposed ? "safeOutput.crossOrgDataExposed" : ""
    ].filter(Boolean);
    const blockerCodes = [
      ...missingContractIds.map(() => "missing_contract_ids"),
      ...missingCustomerWorkflowIds.map(() => "missing_customer_workflow_ids"),
      ...unknownCustomerWorkflowIds.map(() => "unknown_customer_workflow_id"),
      ...missingSchemaIds.map(() => "missing_schema_ids"),
      ...missingScopeFields.map(() => "missing_scope_fields"),
      ...missingDownstreamConsumers.map(() => "missing_downstream_consumers"),
      ...missingRequiredReceiptSchemaIds.map(() => "missing_required_receipt_schema"),
      ...unindexedReceiptSchemaIds.map(() => "stale_receipt_schema_reference"),
      ...unsafeFields.map(() => "unsafe_receipt_matrix_row")
    ];
    return {
      capabilityId: row.capabilityId,
      ownerLane: row.ownerLane,
      readinessRoute: row.readinessRoute,
      ok: blockerCodes.length === 0,
      blockerCodes,
      missingContractIds,
      missingCustomerWorkflowIds,
      unknownCustomerWorkflowIds,
      missingSchemaIds,
      missingScopeFields,
      missingDownstreamConsumers,
      requiredReceiptSchemaIds,
      missingRequiredReceiptSchemaIds,
      unindexedReceiptSchemaIds,
      unsafeFields
    };
  });
  const unsafeMatrixFields = [
    !matrix.safeOutput?.metadataOnly ? "safeOutput.metadataOnly" : "",
    matrix.safeOutput?.rawEvidenceExposed ? "safeOutput.rawEvidenceExposed" : "",
    matrix.safeOutput?.webhookSecretExposed ? "safeOutput.webhookSecretExposed" : "",
    matrix.safeOutput?.crossOrgDataExposed ? "safeOutput.crossOrgDataExposed" : ""
  ].filter(Boolean);
  const matrixSchemaLookupPresent = schemaLookupRows.some((row) => row.schemaId === matrix.schemaVersion && row.contractId === "product_readiness_receipt_matrix");
  const blockerCodes = [
    ...(!matrixSchemaLookupPresent ? ["missing_matrix_schema_lookup"] : []),
    ...missingCapabilityIds.map(() => "missing_capability_row"),
    ...missingCustomerWorkflowIds.map(() => "missing_customer_workflow"),
    ...unsafeMatrixFields.map(() => "unsafe_receipt_matrix"),
    ...diffRows.flatMap((row) => row.blockerCodes)
  ];
  return {
    schemaVersion: "hanasand.product_readiness.receipt_matrix_coverage.v1",
    matrixSchemaVersion: matrix.schemaVersion,
    route: "/v1/contracts",
    ok: blockerCodes.length === 0,
    rowCount: matrix.rows.length,
    requiredCapabilityIds,
    requiredCustomerWorkflowIds,
    requiredReceiptCapabilityIds: Object.keys(requiredReceiptSchemaIdsByCapability).sort(),
    requiredReceiptSchemaIdsByCapability,
    missingCapabilityIds,
    missingCustomerWorkflowIds,
    matrixSchemaLookupPresent,
    blockerCodes: [...new Set(blockerCodes)].sort(),
    diffRows,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

export function buildProductReadinessProofView(
  matrix: {
    schemaVersion: string;
    route: string;
    rows: Array<{
      capabilityId: string;
      customerWorkflowIds: string[];
      ownerLane: string;
      readinessRoute: string;
      contractIds: string[];
      schemaIds: string[];
      receiptSchemaIds: string[];
      blockerCodes: string[];
      scopeFields: string[];
      downstreamConsumers: Array<{ ownerLane: string; route: string; requiredFields: string[] }>;
      safeOutput?: { metadataOnly?: boolean; rawEvidenceExposed?: boolean; webhookSecretExposed?: boolean; crossOrgDataExposed?: boolean };
    }>;
  },
  coverage: ReturnType<typeof productReadinessReceiptMatrixCoverage>
) {
  const requiredWorkflowIds = [
    "org_membership",
    "shared_watchlists",
    "alert_generation",
    "webhook_delivery",
    "case_workflow",
    "source_health",
    "public_ti_handoff"
  ];
  const handoffFieldsByWorkflow: Record<string, string[]> = {
    org_membership: ["organizationId", "member.role", "member.status", "invite.status", "auditEventId"],
    shared_watchlists: ["organizationId", "watchlistId", "watchlistItemIds", "termExport.alertGeneratorKeys"],
    alert_generation: ["organizationId", "watchlistId", "watchlistItemIds", "alertId", "caseId", "provenanceHash", "sourceIds", "captureIds", "sourceCoverageState", "workflowState", "destinationDeliveryState"],
    webhook_delivery: ["organizationId", "alertId", "caseId", "webhookDestinationId", "destinationDeliveryState", "deliveryId"],
    case_workflow: ["organizationId", "alertId", "caseId", "casePath", "workflowState", "replayState"],
    source_health: ["organizationId", "sourceIds", "captureIds", "provenanceHash", "freshnessState", "sourceCoverageState"],
    public_ti_handoff: ["organizationId", "artifactId", "actor", "provenanceHash", "sourceFamilies"]
  };
  const coverageByCapability = new Map(coverage.diffRows.map((row) => [row.capabilityId, row]));
  const rows = requiredWorkflowIds.map((workflowId) => {
    const capabilityRows = matrix.rows.filter((row) => row.customerWorkflowIds.includes(workflowId));
    const diffRows = capabilityRows.map((row) => coverageByCapability.get(row.capabilityId)).filter(Boolean) as typeof coverage.diffRows;
    const blockerCodes = [...new Set(diffRows.flatMap((row) => row.blockerCodes))].sort();
    const hardBlockerCodes = blockerCodes.filter((code) => (
      code === "missing_contract_ids"
      || code === "missing_schema_ids"
      || code === "missing_customer_workflow_ids"
      || code === "unsafe_receipt_matrix_row"
    ));
    const state = capabilityRows.length === 0
      ? "unsupported"
      : hardBlockerCodes.length > 0
        ? "blocked"
        : blockerCodes.length > 0
          ? "partial"
          : "ready";
    const stateBlockerCodes = state === "unsupported" ? ["workflow_unsupported"] : blockerCodes;
    return {
      workflowId,
      state,
      stateBlockerCodes,
      ownerLanes: uniqueStrings(capabilityRows.map((row) => row.ownerLane)),
      capabilityIds: uniqueStrings(capabilityRows.map((row) => row.capabilityId)),
      readinessRoutes: uniqueStrings(capabilityRows.map((row) => row.readinessRoute)),
      contractIds: uniqueStrings(capabilityRows.flatMap((row) => row.contractIds)),
      schemaIds: uniqueStrings(capabilityRows.flatMap((row) => row.schemaIds)),
      receiptSchemaIds: uniqueStrings(capabilityRows.flatMap((row) => row.receiptSchemaIds)),
      scopeFields: uniqueStrings(capabilityRows.flatMap((row) => row.scopeFields)),
      handoffFields: handoffFieldsByWorkflow[workflowId],
      downstreamConsumers: capabilityRows.flatMap((row) => row.downstreamConsumers).map((consumer) => ({
        ownerLane: consumer.ownerLane,
        route: consumer.route,
        requiredFields: consumer.requiredFields
      })),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    };
  });
  return {
    schemaVersion: PRODUCT_READINESS_PROOF_VIEW_SCHEMA_VERSION,
    matrixSchemaVersion: matrix.schemaVersion,
    route: "/v1/contracts",
    producer: "buildProductReadinessProofView",
    stateSemantics: {
      ready: "all referenced matrix rows pass contract coverage",
      partial: "one or more referenced receipt or consumer references are incomplete",
      blocked: "required contract shape or safe-output checks are failing",
      unsupported: "no matrix row advertises the workflow"
    },
    requiredWorkflowIds,
    rows,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

export function buildProductReadinessOrgCapabilityPacket(proofView: ReturnType<typeof buildProductReadinessProofView>) {
  const requiredFieldsByWorkflow: Record<string, string[]> = {
    org_membership: ["organizationId", "member.role", "member.status"],
    shared_watchlists: ["organizationId", "watchlistId", "watchlistItemIds"],
    alert_generation: ["organizationId", "watchlistId", "alertId", "caseId", "provenanceHash", "sourceCoverageState", "workflowState", "destinationDeliveryState"],
    webhook_delivery: ["organizationId", "alertId", "caseId", "destinationDeliveryState"],
    case_workflow: ["organizationId", "alertId", "caseId", "workflowState"],
    source_health: ["organizationId", "sourceCoverageState", "provenanceHash"],
    public_ti_handoff: ["organizationId", "provenanceHash"]
  };
  const orgCapabilityIdByWorkflow: Record<string, string> = {
    org_membership: "organization_membership",
    shared_watchlists: "shared_watchlist_scope",
    alert_generation: "org_scoped_alert_bridge",
    webhook_delivery: "destination_delivery_state",
    case_workflow: "case_workflow_state",
    source_health: "source_coverage_state",
    public_ti_handoff: "public_ti_handoff"
  };
  const readinessFieldNames = ["organizationId", "watchlistId", "alertId", "caseId", "provenanceHash", "sourceCoverageState", "workflowState", "destinationDeliveryState"];
  const rows = proofView.rows.map((row) => {
    const requiredFields = requiredFieldsByWorkflow[row.workflowId] || [];
    const missingReadinessFields = requiredFields.filter((field) => !row.handoffFields.includes(field));
    const state = row.state === "ready" && missingReadinessFields.length > 0 ? "partial" : row.state;
    const blockerCodes = uniqueStrings([
      ...row.stateBlockerCodes,
      ...missingReadinessFields.map(() => "missing_org_capability_fields")
    ]);
    return {
      orgCapabilityId: orgCapabilityIdByWorkflow[row.workflowId] || row.workflowId,
      workflowId: row.workflowId,
      state,
      ownerLane: row.ownerLanes[0] || "integration",
      ownerLanes: row.ownerLanes,
      proof: {
        route: row.readinessRoutes[0] || "/v1/contracts",
        readinessRoutes: row.readinessRoutes,
        contractIds: row.contractIds,
        schemaIds: row.schemaIds,
        receiptSchemaIds: row.receiptSchemaIds
      },
      readinessFields: readinessFieldNames.filter((field) => row.handoffFields.includes(field)),
      missingReadinessFields,
      blockerCodes,
      downstreamConsumers: row.downstreamConsumers,
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    };
  });
  return {
    schemaVersion: PRODUCT_READINESS_ORG_CAPABILITY_PACKET_SCHEMA_VERSION,
    proofViewSchemaVersion: proofView.schemaVersion,
    route: "/v1/contracts",
    producer: "buildProductReadinessOrgCapabilityPacket",
    stateSemantics: proofView.stateSemantics,
    requiredOrgCapabilityIds: rows.map((row) => row.orgCapabilityId),
    readinessFieldNames,
    rows,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

export function buildProductReadinessConsumerHandoffPacket(orgCapabilityPacket: ReturnType<typeof buildProductReadinessOrgCapabilityPacket>) {
  const capabilityById = new Map(orgCapabilityPacket.rows.map((row) => [row.orgCapabilityId, row]));
  const consumerDefinitions = [
    {
      consumerId: "dashboard_readiness",
      ownerLane: "dashboard",
      route: "/dashboard",
      orgCapabilityIds: ["organization_membership", "shared_watchlist_scope", "org_scoped_alert_bridge", "destination_delivery_state", "case_workflow_state", "source_coverage_state", "public_ti_handoff"],
      requiredFieldAliases: {
        orgId: "organizationId",
        blockerReason: "blockerCodes",
        owningLane: "ownerLane",
        workflowState: "workflowState"
      }
    },
    {
      consumerId: "alert_generation",
      ownerLane: "alert",
      route: "/v1/dwm/alerts/generation-readiness",
      orgCapabilityIds: ["shared_watchlist_scope", "org_scoped_alert_bridge", "source_coverage_state"],
      requiredFieldAliases: {
        orgId: "organizationId",
        watchlistId: "watchlistId",
        alertId: "alertId",
        caseId: "caseId",
        provenanceHash: "provenanceHash",
        sourceCoverage: "sourceCoverageState",
        blockerReason: "blockerCodes",
        owningLane: "ownerLane"
      }
    },
    {
      consumerId: "webhook_delivery",
      ownerLane: "webhook",
      route: "/v1/dwm/webhooks/deliver",
      orgCapabilityIds: ["org_scoped_alert_bridge", "destination_delivery_state", "case_workflow_state"],
      requiredFieldAliases: {
        orgId: "organizationId",
        alertId: "alertId",
        caseId: "caseId",
        workflowState: "workflowState",
        destinationDeliveryState: "destinationDeliveryState",
        blockerReason: "blockerCodes",
        owningLane: "ownerLane"
      }
    },
    {
      consumerId: "public_ti_handoff",
      ownerLane: "publicTI",
      route: "/ti",
      orgCapabilityIds: ["source_coverage_state", "public_ti_handoff", "shared_watchlist_scope"],
      requiredFieldAliases: {
        orgId: "organizationId",
        watchlistId: "watchlistId",
        provenanceHash: "provenanceHash",
        sourceCoverage: "sourceCoverageState",
        blockerReason: "blockerCodes",
        owningLane: "ownerLane"
      }
    },
    {
      consumerId: "support_audit",
      ownerLane: "support",
      route: "/api/admin/support/readiness",
      orgCapabilityIds: ["organization_membership", "destination_delivery_state", "case_workflow_state"],
      requiredFieldAliases: {
        orgId: "organizationId",
        alertId: "alertId",
        caseId: "caseId",
        blockerReason: "blockerCodes",
        owningLane: "ownerLane"
      }
    }
  ] as const;
  const rows = consumerDefinitions.map((definition) => {
    const capabilityRows = definition.orgCapabilityIds.map((id) => capabilityById.get(id)).filter(Boolean) as Array<ReturnType<typeof buildProductReadinessOrgCapabilityPacket>["rows"][number]>;
    const missingCapabilityIds = definition.orgCapabilityIds.filter((id) => !capabilityById.has(id));
    const knownFields = new Set(capabilityRows.flatMap((row) => [...row.readinessFields, "blockerCodes", "ownerLane"]));
    const missingFieldAliases = Object.entries(definition.requiredFieldAliases)
      .filter(([, field]) => !knownFields.has(field))
      .map(([alias]) => alias);
    const stateRank: Record<string, number> = { unsupported: 3, blocked: 2, partial: 1, ready: 0 };
    const highestState = capabilityRows.reduce((current, row) => stateRank[row.state] > stateRank[current] ? row.state : current, "ready");
    const state = missingCapabilityIds.length > 0
      ? "unsupported"
      : highestState === "ready" && missingFieldAliases.length > 0
        ? "partial"
        : highestState;
    const blockerCodes = uniqueStrings([
      ...capabilityRows.flatMap((row) => row.blockerCodes),
      ...missingCapabilityIds.map(() => "consumer_handoff_unsupported"),
      ...missingFieldAliases.map(() => "missing_consumer_handoff_fields"),
      ...(state === "unsupported" ? ["consumer_handoff_unsupported"] : []),
      ...(state === "blocked" ? ["consumer_handoff_blocked"] : []),
      ...(state === "partial" ? ["consumer_handoff_partial"] : [])
    ]);
    return {
      consumerId: definition.consumerId,
      state,
      ownerLane: definition.ownerLane,
      route: definition.route,
      orgCapabilityIds: definition.orgCapabilityIds,
      proof: {
        routes: uniqueStrings(capabilityRows.flatMap((row) => row.proof.readinessRoutes)),
        contractIds: uniqueStrings(capabilityRows.flatMap((row) => row.proof.contractIds)),
        schemaIds: uniqueStrings(capabilityRows.flatMap((row) => row.proof.schemaIds)),
        receiptSchemaIds: uniqueStrings(capabilityRows.flatMap((row) => row.proof.receiptSchemaIds))
      },
      fieldAliases: definition.requiredFieldAliases,
      missingCapabilityIds,
      missingFieldAliases,
      blockerCodes,
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    };
  });
  return {
    schemaVersion: PRODUCT_READINESS_CONSUMER_HANDOFF_PACKET_SCHEMA_VERSION,
    orgCapabilityPacketSchemaVersion: orgCapabilityPacket.schemaVersion,
    route: "/v1/contracts",
    producer: "buildProductReadinessConsumerHandoffPacket",
    stateSemantics: orgCapabilityPacket.stateSemantics,
    rows,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

export function productReadinessContractCopyGuard(index: {
  surfaces: Array<Record<string, unknown>>;
  schemaLookup: { rows: Array<Record<string, unknown>> };
  productReadinessReceiptMatrix: { rows: Array<Record<string, unknown>> };
}) {
  const forbiddenTerms = [
    "control room",
    "how this feeds",
    "dashboard slop",
    "named examples",
    "signal",
    "acceptance criteria",
    "acceptance-criteria",
    "acceptance criterion",
    "coordinator"
  ];
  const violations: Array<{
    source: "surface" | "schemaLookup" | "productReadinessReceiptMatrix";
    path: string;
    term: string;
    ownerLane?: string;
    capabilityId?: string;
  }> = [];
  let scannedFieldCount = 0;
  const scanValue = (
    source: "surface" | "schemaLookup" | "productReadinessReceiptMatrix",
    path: string,
    value: unknown,
    context: { ownerLane?: string; capabilityId?: string } = {}
  ) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => scanValue(source, `${path}[${index}]`, item, context));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) scanValue(source, `${path}.${key}`, item, context);
      return;
    }
    if (typeof value !== "string") return;
    scannedFieldCount += 1;
    const normalized = value.toLowerCase();
    for (const term of forbiddenTerms) {
      if (normalized.includes(term)) {
        violations.push({ source, path, term, ...context });
      }
    }
  };
  for (const [indexPosition, surface] of index.surfaces.entries()) {
    scanValue("surface", `surfaces[${indexPosition}]`, surface, { ownerLane: String(surface.ownerLane || "") || undefined });
  }
  for (const [indexPosition, row] of index.schemaLookup.rows.entries()) {
    scanValue("schemaLookup", `schemaLookup.rows[${indexPosition}]`, row, { ownerLane: String(row.ownerLane || "") || undefined });
  }
  for (const [indexPosition, row] of index.productReadinessReceiptMatrix.rows.entries()) {
    scanValue("productReadinessReceiptMatrix", `productReadinessReceiptMatrix.rows[${indexPosition}]`, row, {
      ownerLane: String(row.ownerLane || "") || undefined,
      capabilityId: String(row.capabilityId || "") || undefined
    });
  }
  return {
    schemaVersion: "hanasand.product_readiness.contract_copy_guard.v1",
    route: "/v1/contracts",
    ok: violations.length === 0,
    scannedFieldCount,
    violationCount: violations.length,
    violations,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

export function productReadinessIntegrationGate(input: {
  coverage: {
    ok: boolean;
    schemaVersion: string;
    route: string;
    blockerCodes: string[];
    missingCapabilityIds: string[];
    missingCustomerWorkflowIds: string[];
    matrixSchemaLookupPresent: boolean;
    diffRows: Array<{
      capabilityId: string;
      ownerLane: string;
      ok: boolean;
      blockerCodes: string[];
      missingCustomerWorkflowIds: string[];
      unknownCustomerWorkflowIds: string[];
      missingRequiredReceiptSchemaIds: string[];
      unindexedReceiptSchemaIds: string[];
      unsafeFields: string[];
    }>;
  };
  copyGuard: {
    ok: boolean;
    schemaVersion: string;
    route: string;
    violationCount: number;
    violations: Array<{ source: string; path: string; term: string; ownerLane?: string; capabilityId?: string }>;
  };
}) {
  const checks = [
    {
      id: "receipt_matrix_coverage",
      ownerLane: "integration",
      route: input.coverage.route,
      artifact: "productReadinessReceiptMatrixCoverage",
      ok: input.coverage.ok,
      blockerCodes: input.coverage.blockerCodes,
      evidence: {
        schemaVersion: input.coverage.schemaVersion,
        missingCapabilityIds: input.coverage.missingCapabilityIds,
        missingCustomerWorkflowIds: input.coverage.missingCustomerWorkflowIds,
        matrixSchemaLookupPresent: input.coverage.matrixSchemaLookupPresent,
        failingRows: input.coverage.diffRows.filter((row) => !row.ok).map((row) => ({
          capabilityId: row.capabilityId,
          ownerLane: row.ownerLane,
          blockerCodes: row.blockerCodes,
          missingCustomerWorkflowIds: row.missingCustomerWorkflowIds,
          unknownCustomerWorkflowIds: row.unknownCustomerWorkflowIds,
          missingRequiredReceiptSchemaIds: row.missingRequiredReceiptSchemaIds,
          unindexedReceiptSchemaIds: row.unindexedReceiptSchemaIds,
          unsafeFields: row.unsafeFields
        }))
      }
    },
    {
      id: "contract_copy_guard",
      ownerLane: "integration",
      route: input.copyGuard.route,
      artifact: "productReadinessContractCopyGuard",
      ok: input.copyGuard.ok,
      blockerCodes: input.copyGuard.violations.map((violation) => `copy_guard_${violation.term.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`),
      evidence: {
        schemaVersion: input.copyGuard.schemaVersion,
        violationCount: input.copyGuard.violationCount,
        violations: input.copyGuard.violations
      }
    }
  ];
  const blockerCodes = [...new Set(checks.flatMap((check) => check.blockerCodes))].sort();
  return {
    schemaVersion: "hanasand.product_readiness.integration_gate.v1",
    route: "/v1/contracts",
    ok: checks.every((check) => check.ok),
    decision: checks.every((check) => check.ok) ? "pass" : "hold",
    checkCount: checks.length,
    blockerCodes,
    checks,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}

function schemaLookupRow(input: {
  schemaId: string;
  contractId: string;
  ownerLane: "case" | "webhook" | "source" | "support" | "integration";
  route: string;
  scopeFields: string[];
  blockerCodes: string[];
  downstreamConsumers: Array<{ ownerLane: string; route: string; requiredFields: string[] }>;
}) {
  return {
    ...input,
    safeOutput: {
      metadataOnly: true,
      rawEvidenceExposed: false,
      webhookSecretExposed: false,
      crossOrgDataExposed: false
    }
  };
}
