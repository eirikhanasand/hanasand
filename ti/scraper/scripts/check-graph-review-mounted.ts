import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { processCollectedItem } from "../src/pipeline/pipeline.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import type { CollectionRun, SourceRecord } from "../src/types.ts";
import { hashContent } from "../src/utils.ts";

type ProofName =
  | "accepted_edge"
  | "rejected_edge"
  | "discovery_only_manual_review"
  | "block_export"
  | "invalid_relationship_id"
  | "no_export_ready_relationships";

interface ProofResult {
  case: ProofName;
  ok: boolean;
  status: number;
  endpoint: "/v1/graph/review-plan" | "/v1/graph/cutover-report" | "/v1/exports/stix";
  expectedOutput: string;
  observed: Record<string, unknown>;
}

const store = new InMemoryScraperStore();
store.saveSource(source());
const acceptedRun = seedRun("accepted", {
  graphReviewState: "accepted",
  graphReviewReason: "analyst accepted mounted endpoint proof"
});
const rejectedRun = seedRun("rejected", {
  graphReviewState: "rejected",
  graphReviewReason: "analyst rejected mounted endpoint proof"
});

const server = startApiServer({ port: 0, store, frontier: new FocusedFrontier() });
const baseUrl = `http://127.0.0.1:${server.port}`;
const results: ProofResult[] = [];

try {
  results.push(await acceptedEdgeProof(acceptedRun));
  results.push(await rejectedEdgeProof(rejectedRun));
  results.push(await discoveryOnlyManualReviewProof(acceptedRun));
  results.push(await blockExportProof(acceptedRun));
  results.push(await invalidRelationshipProof(acceptedRun));
  results.push(await noExportReadyProof(rejectedRun));
} finally {
  server.stop();
}

const ok = results.every((result) => result.ok);
console.log(JSON.stringify({
  ok,
  command: "bun run check:graph-review-mounted",
  endpoints: ["/v1/graph/review-plan", "/v1/graph/cutover-report", "/v1/exports/stix"],
  scenarios: results,
  expectedOutput: "ok=true; accepted edge ready, rejected/no-export-ready blocked, discovery-only manual-review example blocked, block_export example blocked, invalid relationship id returns 404 relationship_not_found"
}, null, 2));

if (!ok) process.exit(1);

async function acceptedEdgeProof(run: CollectionRun): Promise<ProofResult> {
  const payload = await get(`/v1/exports/stix?runId=${run.id}`);
  const readiness = payload.readiness as {
    ready: boolean;
    readyCount: number;
    blockedCount: number;
    relationships: Array<{ reviewState: string; ready: boolean }>;
  };
  return {
    case: "accepted_edge",
    ok: readiness.readyCount > 0
      && readiness.relationships.some((relationship) => relationship.reviewState === "accepted" && relationship.ready === true)
      && readiness.relationships.every((relationship) => relationship.reviewState === "accepted"),
    status: 200,
    endpoint: "/v1/exports/stix",
    expectedOutput: "HTTP 200 readiness.readyCount>0 with at least one ready accepted relationship",
    observed: {
      ready: readiness.ready,
      readyCount: readiness.readyCount,
      blockedCount: readiness.blockedCount,
      reviewStates: unique(readiness.relationships.map((relationship) => relationship.reviewState))
    }
  };
}

async function rejectedEdgeProof(run: CollectionRun): Promise<ProofResult> {
  const payload = await get(`/v1/exports/stix?runId=${run.id}`);
  const readiness = payload.readiness as {
    ready: boolean;
    readyCount: number;
    blockedCount: number;
    relationships: Array<{ reviewState: string; ready: boolean; blockers: string[] }>;
  };
  return {
    case: "rejected_edge",
    ok: readiness.ready === false
      && readiness.readyCount === 0
      && readiness.blockedCount > 0
      && readiness.relationships.every((relationship) => relationship.reviewState === "rejected" && relationship.ready === false),
    status: 200,
    endpoint: "/v1/exports/stix",
    expectedOutput: "HTTP 200 readiness.ready=false readyCount=0 blockedCount>0 reviewState=rejected",
    observed: {
      ready: readiness.ready,
      readyCount: readiness.readyCount,
      blockedCount: readiness.blockedCount,
      reviewStates: unique(readiness.relationships.map((relationship) => relationship.reviewState)),
      blockerCodes: unique(readiness.relationships.flatMap((relationship) => relationship.blockers))
    }
  };
}

async function discoveryOnlyManualReviewProof(run: CollectionRun): Promise<ProofResult> {
  const payload = await get(`/v1/graph/review-plan?runId=${run.id}&includeExamples=true`);
  const example = (((payload.examples as { actionExamples: Record<string, unknown> }).actionExamples)
    .discovery_only_manual_review_required ?? {}) as {
      safety?: string;
      exportImpact?: { afterEligible?: boolean };
      preconditions?: string[];
  };
  return {
    case: "discovery_only_manual_review",
    ok: example.safety === "blocked"
      && example.exportImpact?.afterEligible === false
      && (example.preconditions ?? []).includes("discovery-only evidence cannot be auto-promoted to export-ready"),
    status: 200,
    endpoint: "/v1/graph/review-plan",
    expectedOutput: "HTTP 200 examples.discovery_only_manual_review_required safety=blocked afterEligible=false",
    observed: {
      safety: example.safety,
      afterEligible: example.exportImpact?.afterEligible,
      preconditions: example.preconditions
    }
  };
}

async function blockExportProof(run: CollectionRun): Promise<ProofResult> {
  const payload = await get(`/v1/graph/review-plan?runId=${run.id}&includeExamples=true`);
  const example = (((payload.examples as { actionExamples: Record<string, unknown> }).actionExamples)
    .block_export ?? {}) as {
      action?: string;
      safety?: string;
      exportImpact?: { afterEligible?: boolean; blockedReasonCodes?: string[] };
  };
  return {
    case: "block_export",
    ok: example.action === "block_export"
      && example.safety === "blocked"
      && example.exportImpact?.afterEligible === false,
    status: 200,
    endpoint: "/v1/graph/review-plan",
    expectedOutput: "HTTP 200 examples.block_export action=block_export safety=blocked afterEligible=false",
    observed: {
      action: example.action,
      safety: example.safety,
      afterEligible: example.exportImpact?.afterEligible,
      blockedReasonCodes: example.exportImpact?.blockedReasonCodes
    }
  };
}

async function invalidRelationshipProof(run: CollectionRun): Promise<ProofResult> {
  const response = await fetch(`${baseUrl}/v1/graph/review-plan?runId=${run.id}&relationshipId=rel_missing`);
  const payload = await response.json() as { error?: { code?: string; details?: Record<string, unknown> } };
  return {
    case: "invalid_relationship_id",
    ok: response.status === 404 && payload.error?.code === "relationship_not_found",
    status: response.status,
    endpoint: "/v1/graph/review-plan",
    expectedOutput: "HTTP 404 error.code=relationship_not_found",
    observed: {
      errorCode: payload.error?.code,
      details: payload.error?.details
    }
  };
}

async function noExportReadyProof(run: CollectionRun): Promise<ProofResult> {
  const payload = await get(`/v1/graph/cutover-report?runId=${run.id}`);
  const report = payload.cutoverReport as {
    ready: boolean;
    counts: { exportReady: number; relationships: number };
    promotionBlockers: Array<{ code: string }>;
  };
  return {
    case: "no_export_ready_relationships",
    ok: report.ready === false
      && report.counts.relationships > 0
      && report.counts.exportReady === 0
      && report.promotionBlockers.some((blocker) => blocker.code === "no_export_ready_relationships"),
    status: 200,
    endpoint: "/v1/graph/cutover-report",
    expectedOutput: "HTTP 200 cutover.ready=false counts.exportReady=0 promotionBlockers include no_export_ready_relationships",
    observed: {
      ready: report.ready,
      counts: report.counts,
      promotionBlockers: report.promotionBlockers.map((blocker) => blocker.code)
    }
  };
}

async function get(path: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`Proof request failed: ${path} -> ${response.status}`);
  return await response.json() as Record<string, unknown>;
}

function seedRun(name: string, metadata: Record<string, unknown>): CollectionRun {
  const run: CollectionRun = {
    id: `run_graph_mounted_${name}`,
    tenantId: "tenant_graph_mounted",
    planId: `plan_graph_mounted_${name}`,
    requestId: `request_graph_mounted_${name}`,
    status: "completed",
    createdAt: "2026-05-24T04:00:00.000Z",
    updatedAt: "2026-05-24T04:01:00.000Z",
    taskCount: 1,
    reviewTaskCount: 0,
    rejectedSourceCount: 0,
    captureCount: 1,
    incidentCount: 1
  };
  const taskId = `task_graph_mounted_${name}`;
  store.savePlan({
    id: run.planId,
    tenantId: run.tenantId,
    request: { id: run.requestId, query: "APT29", entityType: "actor", tenantId: run.tenantId },
    tasks: [{
      id: taskId,
      runId: run.id,
      sourceId: "src_graph_mounted",
      sourceType: "rss",
      url: `https://graph-mounted.example.test/${name}`,
      priority: 100,
      status: "completed",
      createdAt: run.createdAt,
      updatedAt: run.updatedAt
    }],
    reviewRequired: [],
    rejected: [],
    createdAt: run.createdAt
  });
  store.saveRun(run);
  const rawText = `APT29 used phishing and Cobalt Strike against Northwind Health in healthcare from https://evil.example.com/${name} and exploited CVE-2025-12345.`;
  const result = processCollectedItem({
    sourceId: "src_graph_mounted",
    taskId,
    url: `https://graph-mounted.example.test/${name}`,
    collectedAt: "2026-05-24T04:02:00.000Z",
    title: `APT29 graph mounted ${name}`,
    rawText,
    contentHash: hashContent(`${name}:${rawText}`),
    links: [],
    metadata,
    sensitive: false
  });
  store.savePipelineResult({
    ...result,
    capture: { ...result.capture, tenantId: run.tenantId, metadata: { ...result.capture.metadata, ...metadata } }
  });
  return run;
}

function source(): SourceRecord {
  return {
    id: "src_graph_mounted",
    name: "Graph Mounted Proof RSS",
    type: "rss",
    url: "https://graph-mounted.example.test/feed.xml",
    accessMethod: "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.9,
    crawlFrequencySeconds: 3600,
    legalNotes: "Mounted graph review endpoint proof fixture.",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
