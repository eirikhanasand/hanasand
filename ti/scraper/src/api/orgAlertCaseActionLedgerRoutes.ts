import { error, json, readJson } from "./http.ts";
import {
  DWM_ORG_ALERT_CASE_ACTION_RECEIPT_SCHEMA_VERSION,
  type OrgAlertCaseActionReceipt
} from "../product/orgAlertWorkflowBridge.ts";
import {
  buildOrgAlertCaseActionLedgerApiList,
  type InMemoryOrgAlertCaseActionLedgerRepository,
  writeOrgAlertCaseActionLedgerApiRecord
} from "../storage/orgAlertCaseActionLedgerPostgres.ts";

export const ORG_ALERT_CASE_ACTION_LEDGER_ROUTE = "/v1/dwm/org-alert-case-actions" as const;

export type OrgAlertCaseActionLedgerRouteDeps = {
  repository: InMemoryOrgAlertCaseActionLedgerRepository;
};

export type OrgAlertCaseActionLedgerWriteBody = {
  tenantId?: string;
  organizationId?: string;
  receipt?: OrgAlertCaseActionReceipt;
  recordedAt?: string;
  allowBlockedReceipt?: boolean;
};

export async function handleOrgAlertCaseActionLedgerRequest(
  request: Request,
  deps: OrgAlertCaseActionLedgerRouteDeps
): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (url.pathname !== ORG_ALERT_CASE_ACTION_LEDGER_ROUTE) return undefined;

  if (request.method === "GET") return listOrgAlertCaseActionLedger(url, request, deps);
  if (request.method === "POST") return writeOrgAlertCaseActionLedger(request, deps);

  return error("method_not_allowed", "Use GET to list case action receipts or POST to record a receipt.", 405);
}

function listOrgAlertCaseActionLedger(url: URL, request: Request, deps: OrgAlertCaseActionLedgerRouteDeps): Response {
  const response = buildOrgAlertCaseActionLedgerApiList({
    repository: deps.repository,
    tenantId: scopedParam(url, request, "tenantId", "x-tenant-id"),
    organizationId: scopedParam(url, request, "organizationId", "x-organization-id"),
    receiptId: optionalParam(url, "receiptId"),
    alertId: optionalParam(url, "alertId"),
    casePath: optionalParam(url, "casePath")
  });
  return json(response, response.statusCode);
}

async function writeOrgAlertCaseActionLedger(
  request: Request,
  deps: OrgAlertCaseActionLedgerRouteDeps
): Promise<Response> {
  const body = await readJson<OrgAlertCaseActionLedgerWriteBody>(request);
  if (!isOrgAlertCaseActionReceipt(body.receipt)) {
    return error("missing_receipt", "Request body must include an org alert case action receipt.", 400);
  }

  const response = writeOrgAlertCaseActionLedgerApiRecord({
    repository: deps.repository,
    receipt: body.receipt,
    tenantId: body.tenantId ?? request.headers.get("x-tenant-id") ?? undefined,
    organizationId: body.organizationId ?? request.headers.get("x-organization-id") ?? undefined,
    recordedAt: body.recordedAt,
    allowBlockedReceipt: body.allowBlockedReceipt
  });
  return json(response, response.statusCode);
}

function scopedParam(url: URL, request: Request, key: string, header: string): string | undefined {
  return optionalParam(url, key) ?? request.headers.get(header) ?? undefined;
}

function optionalParam(url: URL, key: string): string | undefined {
  return url.searchParams.get(key) ?? undefined;
}

function isOrgAlertCaseActionReceipt(value: unknown): value is OrgAlertCaseActionReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Partial<OrgAlertCaseActionReceipt>;
  return receipt.schemaVersion === DWM_ORG_ALERT_CASE_ACTION_RECEIPT_SCHEMA_VERSION && typeof receipt.id === "string";
}
