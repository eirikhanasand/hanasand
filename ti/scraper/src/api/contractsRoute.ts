import { ORG_ALERT_CASE_ACTION_LEDGER_ROUTE } from "./orgAlertCaseActionLedgerRoutes.ts";
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
    route("GET", ORG_ALERT_CASE_ACTION_LEDGER_ROUTE),
    route("POST", ORG_ALERT_CASE_ACTION_LEDGER_ROUTE)
  ];
  return {
    endpoint: "/v1/contracts",
    schemaVersion: "ti.api_contract_index.compact.v4",
    routeInventory: { count: routes.length, routes },
    surfaces: [
      {
        id: "org_alert_case_action_ledger",
        ownerLane: "case",
        route: ORG_ALERT_CASE_ACTION_LEDGER_ROUTE,
        methods: ["GET", "POST"],
        schemas: {
          list: DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_LIST_SCHEMA_VERSION,
          write: DWM_ORG_ALERT_CASE_ACTION_LEDGER_API_WRITE_SCHEMA_VERSION
        },
        scopeFields: ["tenantId", "organizationId"],
        queryFields: ["receiptId", "alertId", "casePath"],
        writeFields: ["tenantId", "organizationId", "receipt", "recordedAt", "allowBlockedReceipt"],
        recordFields: ["receiptId", "watchlistId", "watchlistItemId", "alertIds", "casePaths", "action", "execution", "auditEventId"],
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

function route(method: "GET" | "POST", path: string) {
  return { method, path };
}
