import { ORG_ALERT_CASE_ACTION_LEDGER_ROUTE, ORG_ALERT_CASE_ACTION_TIMELINE_ROUTE } from "./orgAlertCaseActionLedgerRoutes.ts";
import { DWM_ORG_ALERT_CASE_ACTION_TIMELINE_SCHEMA_VERSION } from "../product/orgAlertCaseActionTimeline.ts";
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
    route("POST", "/v1/dwm/alerts/:alertId/case-handoff"),
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
        recordFields: ["alertId", "caseId", "casePath", "captureIds", "sourceIds", "contentHashes", "auditEventId", "workflowEventId", "dedupeKey", "replayState"],
        blockerCodes: ["alert_not_found", "missing_alert_provenance", "organization_visibility_denied", "case_read_only_member", "invalid_case_owner_role"],
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
    semantics: { safeMetadataOnly: true, noCredentialCollection: true, noThreatActorInteraction: true },
    publicCompatibility: { canonicalSearchRoute: "/api/ti/search", unknownQueryCopy: "searching", noDefaultActor: true }
  };
}

function route(method: "GET" | "POST" | "PATCH", path: string) {
  return { method, path };
}
