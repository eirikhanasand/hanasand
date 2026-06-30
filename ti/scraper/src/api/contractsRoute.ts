import { ORG_ALERT_CASE_ACTION_LEDGER_ROUTE, ORG_ALERT_CASE_ACTION_TIMELINE_ROUTE } from "./orgAlertCaseActionLedgerRoutes.ts";
import { DWM_ORG_ALERT_CASE_ACTION_TIMELINE_SCHEMA_VERSION } from "../product/orgAlertCaseActionTimeline.ts";
import {
  DWM_ORG_ALERT_CASE_ACTION_AUDIT_EVENT_SCHEMA_VERSION,
  DWM_ORG_ALERT_CASE_ACTION_RECEIPT_SCHEMA_VERSION
} from "../product/orgAlertWorkflowBridge.ts";
import {
  DWM_WEBHOOK_DISPATCH_RETRY_AUDIT_SCHEMA_VERSION,
  DWM_WEBHOOK_EVENT_CONTRACT_SCHEMA_VERSION,
  DWM_WEBHOOK_EVENT_SUPPORT_HANDOFF_SCHEMA_VERSION,
  DWM_WEBHOOK_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION
} from "../product/webhookEventContract.ts";
import {
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

export function contractIndex() {
  const routes = [
    route("GET", "/v1/health"),
    route("GET", "/v1/intel/search"),
    route("GET", "/api/ti/search"),
    route("POST", "/v1/intel/runs"),
    route("GET", "/v1/darkweb/status"),
    route("GET", "/v1/darkweb/search"),
    route("GET", "/v1/sources"),
    route("GET", "/v1/sources/atlas"),
    route("GET", "/v1/quality/evaluate"),
    route("GET", "/v1/ops/product-slo"),
    route("GET", "/v1/contracts"),
    route("GET", "/v1/dwm/watchlists"),
    route("POST", "/v1/dwm/watchlists"),
    route("GET", "/v1/dwm/alerts/generation-readiness"),
    route("POST", "/v1/dwm/alerts/:alertId/case-handoff"),
    route("POST", "/v1/cases/:caseId/handoff-action"),
    route("PATCH", "/v1/cases/:caseId"),
    route("GET", ORG_ALERT_CASE_ACTION_LEDGER_ROUTE),
    route("POST", ORG_ALERT_CASE_ACTION_LEDGER_ROUTE),
    route("GET", ORG_ALERT_CASE_ACTION_TIMELINE_ROUTE)
  ];
  return {
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
        methods: ["POST"],
        schemas: {
          receipt: "dwm.case_handoff_action_receipt.v1",
          readiness: "dwm.case_handoff_action_readiness.v1",
          detail: "analyst.case_detail.v1"
        },
        scopeFields: ["tenantId", "organizationId", "caseId", "alertId", "actionId"],
        writeFields: ["organizationId", "actionId", "note", "idempotencyKey"],
        recordFields: ["receiptId", "caseId", "alertId", "actionId", "route", "method", "auditEventId", "workflowEventId", "idempotencyKey", "dedupeKey", "captureIds", "sourceIds", "contentHashes"],
        blockerCodes: ["case_not_found", "missing_case_alert", "unsupported_handoff_action", "handoff_action_not_ready", "case_read_only_member", "organization_visibility_denied", "missing_webhook_destination"],
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
        methods: ["PATCH"],
        schemas: {
          transition: "analyst.case_workflow_transition.v1",
          detail: "analyst.case_detail.v1"
        },
        scopeFields: ["tenantId", "organizationId", "caseId", "alertId"],
        writeFields: ["organizationId", "action", "status", "assignedOwner", "note", "idempotencyKey"],
        recordFields: ["caseId", "alertId", "organizationId", "action", "fromStatus", "toStatus", "fromOwner", "toOwner", "auditEventId", "eventId", "idempotencyKey", "dedupeKey", "replayState"],
        blockerCodes: ["organization_visibility_denied", "case_read_only_member", "invalid_case_transition", "unsupported_case_action", "invalid_case_owner_role"],
        safeOutput: {
          metadataOnly: true,
          rawEvidenceExposed: false,
          webhookSecretExposed: false
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
        id: "webhook_delivery_receipts",
        ownerLane: "webhook",
        schemas: {
          event: DWM_WEBHOOK_EVENT_CONTRACT_SCHEMA_VERSION,
          supportHandoff: DWM_WEBHOOK_EVENT_SUPPORT_HANDOFF_SCHEMA_VERSION,
          supportActionRequest: DWM_WEBHOOK_SUPPORT_ACTION_REQUEST_SCHEMA_VERSION,
          retryAudit: DWM_WEBHOOK_DISPATCH_RETRY_AUDIT_SCHEMA_VERSION
        },
        routes: ["/v1/dwm/webhooks/deliver", "/api/organizations/:id/webhooks", "/api/admin/support/readiness"],
        scopeFields: ["tenantId", "organizationId", "alertId", "caseId", "webhookDestinationId", "webhookDeliveryId"],
        requiredFields: ["eventKind", "occurredAt", "delivery.status", "delivery.endpointHash", "evidence.evidenceCount"],
        blockerCodes: ["missing_webhook_destination", "webhook_not_verified", "unsupported_destination", "organization_visibility_denied"],
        downstreamConsumers: [
          { ownerLane: "case", route: "/v1/cases/:caseId", requiredFields: ["webhookDeliveryId", "status", "caseId"] },
          { ownerLane: "support", route: "/api/admin/support/readiness", requiredFields: ["organizationId", "webhookDestinationId", "auditEventId"] }
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
          schemaId: DWM_WEBHOOK_EVENT_CONTRACT_SCHEMA_VERSION,
          contractId: "webhook_delivery_receipts",
          ownerLane: "webhook",
          route: "/v1/dwm/webhooks/deliver",
          scopeFields: ["tenantId", "organizationId", "alertId", "caseId", "webhookDestinationId", "webhookDeliveryId"],
          blockerCodes: ["missing_webhook_destination", "webhook_not_verified", "unsupported_destination", "organization_visibility_denied"],
          downstreamConsumers: [
            { ownerLane: "case", route: "/v1/cases/:caseId", requiredFields: ["webhookDeliveryId", "status", "caseId"] },
            { ownerLane: "support", route: "/api/admin/support/readiness", requiredFields: ["organizationId", "webhookDestinationId", "auditEventId"] }
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
    semantics: { safeMetadataOnly: true, noCredentialCollection: true, noThreatActorInteraction: true },
    publicCompatibility: { canonicalSearchRoute: "/api/ti/search", unknownQueryCopy: "searching", noDefaultActor: true }
  };
}

function route(method: "GET" | "POST" | "PATCH", path: string) {
  return { method, path };
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

function schemaLookupRow(input: {
  schemaId: string;
  contractId: string;
  ownerLane: "case" | "webhook" | "source" | "support";
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
