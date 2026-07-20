import {
  buildEvidenceClaimLedgerDto,
  buildEvidenceCutoverReportDto,
  buildEvidenceReplayPlanDto,
  buildEvidenceTrustLedgerDto,
  evidenceClaimLedgerApiContract,
  evidenceCutoverReportApiContract,
  evidenceReplayPlanApiContract,
  evidenceTrustLedgerApiContract
} from "./evidenceDtos.ts";
import { error, json } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { inTenantScope, resolveTenantScope } from "./tenantScope.ts";

const EVIDENCE_ROUTES = new Set([
  "/v1/evidence/replay-plan",
  "/v1/evidence/cutover-report",
  "/v1/evidence/trust-ledger",
  "/v1/evidence/claim-ledger"
]);

export async function handleEvidenceRequest(request: Request, options: ApiServerOptions): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (!EVIDENCE_ROUTES.has(url.pathname)) return undefined;
  if (request.method !== "GET") return error("method_not_allowed", "Evidence endpoints support GET requests only", 405);
  const scope = resolveTenantScope(request, url);
  if (scope.error) return scope.error;

  const query = url.searchParams.get("q")?.trim();
  if (!query) return error("bad_request", "Query parameter q is required", 400);
  if (query.length > 500) return error("bad_request", "Query parameter q must not exceed 500 characters", 400);

  const runId = optionalValue(url.searchParams.get("runId"));
  if (runId && !runExists(options.store, runId, scope.tenantId)) return error("not_found", `Collection run not found: ${runId}`, 404);
  const generatedAt = optionalValue(url.searchParams.get("generatedAt"));
  if (generatedAt && !Number.isFinite(Date.parse(generatedAt))) return error("bad_request", "generatedAt must be an ISO-8601 timestamp", 400);

  const buildOptions = {
    tenantId: scope.tenantId,
    runId,
    sinceCursor: optionalValue(url.searchParams.get("sinceCursor")),
    generatedAt
  };
  const objectStore = options.objectStore;

  switch (url.pathname) {
    case "/v1/evidence/replay-plan":
      return json({ contract: evidenceReplayPlanApiContract(), replayPlan: buildEvidenceReplayPlanDto(options.store, query, buildOptions) });
    case "/v1/evidence/cutover-report":
      return json({ contract: evidenceCutoverReportApiContract(), cutoverReport: buildEvidenceCutoverReportDto(options.store, objectStore, query, buildOptions) });
    case "/v1/evidence/trust-ledger":
      return json({ contract: evidenceTrustLedgerApiContract(), trustLedger: buildEvidenceTrustLedgerDto(options.store, objectStore, query, buildOptions) });
    case "/v1/evidence/claim-ledger":
      return json({ contract: evidenceClaimLedgerApiContract(), claimLedger: buildEvidenceClaimLedgerDto(options.store, objectStore, query, buildOptions) });
  }
}

function runExists(store: any, runId: string, tenantId?: string): boolean {
  if (typeof store?.getRun === "function") return inTenantScope(store.getRun(runId), tenantId);
  return typeof store?.listRuns === "function" && store.listRuns().some((run: any) => run.id === runId && inTenantScope(run, tenantId));
}

function optionalValue(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
