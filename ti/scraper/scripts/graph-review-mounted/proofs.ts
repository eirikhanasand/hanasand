import type { CollectionRun } from "../../src/types.ts";
import { get, unique } from "./types.ts";
import type { ProofResult } from "./types.ts";

export async function acceptedEdgeProof(baseUrl: string, run: CollectionRun): Promise<ProofResult> {
  const payload = await get(baseUrl, `/v1/exports/stix?runId=${run.id}`);
  const readiness = payload.readiness as { ready: boolean; readyCount: number; blockedCount: number; relationships: Array<{ reviewState: string; ready: boolean }> };
  return result("accepted_edge", "/v1/exports/stix", readiness.readyCount > 0 && readiness.relationships.some((relationship) => relationship.reviewState === "accepted" && relationship.ready) && readiness.relationships.every((relationship) => relationship.reviewState === "accepted"), {
    ready: readiness.ready,
    readyCount: readiness.readyCount,
    blockedCount: readiness.blockedCount,
    reviewStates: unique(readiness.relationships.map((relationship) => relationship.reviewState))
  });
}

export async function rejectedEdgeProof(baseUrl: string, run: CollectionRun): Promise<ProofResult> {
  const payload = await get(baseUrl, `/v1/exports/stix?runId=${run.id}`);
  const readiness = payload.readiness as { ready: boolean; readyCount: number; blockedCount: number; relationships: Array<{ reviewState: string; ready: boolean; blockers: string[] }> };
  return result("rejected_edge", "/v1/exports/stix", !readiness.ready && readiness.readyCount === 0 && readiness.blockedCount > 0 && readiness.relationships.every((relationship) => relationship.reviewState === "rejected" && !relationship.ready), {
    ready: readiness.ready,
    readyCount: readiness.readyCount,
    blockedCount: readiness.blockedCount,
    reviewStates: unique(readiness.relationships.map((relationship) => relationship.reviewState)),
    blockerCodes: unique(readiness.relationships.flatMap((relationship) => relationship.blockers))
  });
}

export async function discoveryOnlyManualReviewProof(baseUrl: string, run: CollectionRun): Promise<ProofResult> {
  const example = await actionExample(baseUrl, run, "discovery_only_manual_review_required") as { safety?: string; exportImpact?: { afterEligible?: boolean }; preconditions?: string[] };
  return result("discovery_only_manual_review", "/v1/graph/review-plan", example.safety === "blocked" && example.exportImpact?.afterEligible === false && (example.preconditions ?? []).includes("discovery-only evidence cannot be auto-promoted to export-ready"), {
    safety: example.safety,
    afterEligible: example.exportImpact?.afterEligible,
    preconditions: example.preconditions
  });
}

export async function blockExportProof(baseUrl: string, run: CollectionRun): Promise<ProofResult> {
  const example = await actionExample(baseUrl, run, "block_export") as { action?: string; safety?: string; exportImpact?: { afterEligible?: boolean; blockedReasonCodes?: string[] } };
  return result("block_export", "/v1/graph/review-plan", example.action === "block_export" && example.safety === "blocked" && example.exportImpact?.afterEligible === false, {
    action: example.action,
    safety: example.safety,
    afterEligible: example.exportImpact?.afterEligible,
    blockedReasonCodes: example.exportImpact?.blockedReasonCodes
  });
}

export async function invalidRelationshipProof(baseUrl: string, run: CollectionRun): Promise<ProofResult> {
  const response = await fetch(`${baseUrl}/v1/graph/review-plan?runId=${run.id}&relationshipId=rel_missing`);
  const payload = await response.json() as { error?: { code?: string; details?: Record<string, unknown> } };
  return {
    case: "invalid_relationship_id",
    ok: response.status === 404 && payload.error?.code === "relationship_not_found",
    status: response.status,
    endpoint: "/v1/graph/review-plan",
    expectedOutput: "HTTP 404 error.code=relationship_not_found",
    observed: { errorCode: payload.error?.code, details: payload.error?.details }
  };
}

export async function noExportReadyProof(baseUrl: string, run: CollectionRun): Promise<ProofResult> {
  const payload = await get(baseUrl, `/v1/graph/cutover-report?runId=${run.id}`);
  const report = payload.cutoverReport as { ready: boolean; counts: { exportReady: number; relationships: number }; promotionBlockers: Array<{ code: string }> };
  return result("no_export_ready_relationships", "/v1/graph/cutover-report", !report.ready && report.counts.relationships > 0 && report.counts.exportReady === 0 && report.promotionBlockers.some((blocker) => blocker.code === "no_export_ready_relationships"), {
    ready: report.ready,
    counts: report.counts,
    promotionBlockers: report.promotionBlockers.map((blocker) => blocker.code)
  });
}

async function actionExample(baseUrl: string, run: CollectionRun, name: string): Promise<unknown> {
  const payload = await get(baseUrl, `/v1/graph/review-plan?runId=${run.id}&includeExamples=true`);
  return ((payload.examples as { actionExamples: Record<string, unknown> }).actionExamples)[name] ?? {};
}

function result(
  caseName: ProofResult["case"],
  endpoint: ProofResult["endpoint"],
  ok: boolean,
  observed: Record<string, unknown>
): ProofResult {
  return { case: caseName, ok, status: 200, endpoint, expectedOutput: "HTTP 200 graph review mounted proof", observed };
}
