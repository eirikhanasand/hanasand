import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import type { SourceRecord } from "../src/types.ts";

interface ProofResult {
  scenario: "happy_path" | "blocked_restricted_source" | "invalid_action";
  ok: boolean;
  status: number;
  endpoint: "/v1/sources/apply-plan";
  expectedOutput: string;
  actions?: string[];
  automation?: string[];
  dryRun?: boolean;
  willMutate?: boolean;
  willStartCrawling?: boolean;
  errorCode?: string;
  mutationProof: {
    sourcesUnchanged: boolean;
    queueUnchanged: boolean;
    leasesUnchanged: boolean;
  };
  safetyProof: {
    noStartedCrawl: boolean;
    noRegistryMutationFields: boolean;
    noRestrictedActivation: boolean;
  };
}

const results: ProofResult[] = [];

results.push(await runScenario("happy_path", {
  sources: publicSources(),
  body: {
    queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
    sourcePackIds: ["safe-public-cti-starter-pack"],
    selectedActions: ["approve", "quarantine", "retire", "request_legal_notes", "leave_unchanged"],
    includeExecutionPreview: true
  }
}));
results.push(await runScenario("blocked_restricted_source", {
  sources: restrictedSources(),
  headers: { "x-tenant-id": "tenant_source_proof_restricted" },
  body: {
    queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
    selectedActions: ["activate", "quarantine", "request_legal_notes"],
    includeExecutionPreview: true
  }
}));
results.push(await runScenario("invalid_action", {
  sources: publicSources(),
  body: {
    queryScope: { queries: ["APT29"], entityTypes: ["actor"] },
    selectedActions: ["launch_crawler"]
  }
}));

const ok = results.every((result) => result.ok);
console.log(JSON.stringify({
  ok,
  command: "bun run check:source-apply-plan",
  endpoint: "/v1/sources/apply-plan",
  scenarios: results,
  expectedOutput: "ok=true; happy_path returns HTTP 200 dryRun=true willMutate=false willStartCrawling=false, blocked_restricted_source keeps restricted activation disabled, invalid_action returns HTTP 400 invalid_action, and all source/frontier snapshots remain unchanged"
}, null, 2));

if (!ok) process.exit(1);

async function runScenario(
  scenario: ProofResult["scenario"],
  input: { sources: SourceRecord[]; body: Record<string, unknown>; headers?: Record<string, string> }
): Promise<ProofResult> {
  const store = new InMemoryScraperStore();
  const frontier = new FocusedFrontier();
  for (const source of input.sources) store.saveSource(source);
  const before = snapshot(store, frontier);
  const server = startApiServer({ port: 0, store, frontier });

  try {
    const response = await fetch(`http://127.0.0.1:${server.port}/v1/sources/apply-plan`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(input.headers ?? {}) },
      body: JSON.stringify(input.body)
    });
    const payload = await response.json() as {
      applyPlan?: {
        dryRun: boolean;
        willMutate: boolean;
        willStartCrawling: boolean;
        items: Array<{
          action: string;
          automation: string;
          collectionImpact: { willStartCrawling: boolean; enablesCollection: boolean; remainsDisabled: string[] };
        }>;
      };
      error?: { code: string };
    };
    const after = snapshot(store, frontier);
    const applyPlanSerialized = JSON.stringify(payload.applyPlan ?? {});
    const actions = payload.applyPlan?.items.map((item) => item.action) ?? [];
    const automation = payload.applyPlan?.items.map((item) => item.automation) ?? [];
    const mutationProof = {
      sourcesUnchanged: before.sources === after.sources,
      queueUnchanged: before.queue === after.queue,
      leasesUnchanged: before.leases === after.leases
    };
    const safetyProof = {
      noStartedCrawl: !applyPlanSerialized.includes("startedCrawl") && payload.applyPlan?.items.every((item) => item.collectionImpact.willStartCrawling === false) !== false,
      noRegistryMutationFields: !applyPlanSerialized.includes("updatedSource") && !applyPlanSerialized.includes("reviewDecisionApplied") && !applyPlanSerialized.includes("dbTransaction"),
      noRestrictedActivation: !applyPlanSerialized.includes("restrictedActivation") && (scenario !== "blocked_restricted_source" || payload.applyPlan?.items.flatMap((item) => item.collectionImpact.remainsDisabled).includes("automatic restricted-source activation") === true)
    };
    const statusOk = scenario === "invalid_action" ? response.status === 400 : response.status === 200;
    const scenarioOk = scenario === "happy_path"
      ? payload.applyPlan?.dryRun === true && payload.applyPlan.willMutate === false && payload.applyPlan.willStartCrawling === false && actions.includes("approve") && automation.includes("rollback_only")
      : scenario === "blocked_restricted_source"
        ? payload.applyPlan?.willMutate === false && payload.applyPlan.willStartCrawling === false && payload.applyPlan.items.every((item) => item.collectionImpact.enablesCollection === false)
        : payload.error?.code === "invalid_action";

    return {
      scenario,
      ok: statusOk && scenarioOk && Object.values(mutationProof).every(Boolean) && Object.values(safetyProof).every(Boolean),
      status: response.status,
      endpoint: "/v1/sources/apply-plan",
      expectedOutput: scenario === "invalid_action"
        ? "HTTP 400 invalid_action and source/frontier snapshots unchanged"
        : "HTTP 200 dryRun=true willMutate=false willStartCrawling=false and source/frontier snapshots unchanged",
      actions,
      automation,
      dryRun: payload.applyPlan?.dryRun,
      willMutate: payload.applyPlan?.willMutate,
      willStartCrawling: payload.applyPlan?.willStartCrawling,
      errorCode: payload.error?.code,
      mutationProof,
      safetyProof
    };
  } finally {
    server.stop();
  }
}

function publicSources(): SourceRecord[] {
  const reviewedAt = new Date().toISOString();
  return [
    source({ id: "src_source_proof_candidate", status: "candidate", tenantId: "tenant_source_proof", tags: ["apt29"], url: "https://candidate.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } }),
    source({ id: "src_source_proof_unhealthy", status: "active", tenantId: "tenant_source_proof", tags: ["apt29"], url: "https://unhealthy.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt }, health: { status: "failing", consecutiveFailures: 5, errorRate: 0.9 } }),
    source({ id: "src_source_proof_duplicate_a", tenantId: "tenant_source_proof", tags: ["apt29"], url: "https://duplicate.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } }),
    source({ id: "src_source_proof_duplicate_b", tenantId: "tenant_source_proof", tags: ["apt29"], url: "https://duplicate.example.test/feed", metadata: { legalNotesReviewedAt: reviewedAt } })
  ];
}

function restrictedSources(): SourceRecord[] {
  return [
    source({
      id: "src_source_proof_restricted",
      name: "Restricted source apply-plan proof",
      type: "tor_metadata",
      url: "http://restricted-proof.onion",
      accessMethod: "approved_proxy",
      risk: "restricted",
      status: "approved",
      tenantId: "tenant_source_proof_restricted",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: "2026-05-24T00:00:00.000Z",
        approvedBy: "legal",
        policyVersion: "collection-policy:v1"
      },
      metadata: { legalNotesReviewedAt: new Date().toISOString() },
      tags: ["apt29"]
    })
  ];
}

function source(input: Partial<SourceRecord>): SourceRecord {
  return {
    id: input.id ?? "src_source_proof",
    name: input.name ?? "Source apply-plan proof fixture",
    type: input.type ?? "rss",
    url: input.url ?? "https://example.test/feed.xml",
    accessMethod: input.accessMethod ?? "public_http",
    status: input.status ?? "active",
    risk: input.risk ?? "low",
    tenantId: input.tenantId,
    trustScore: input.trustScore ?? 0.9,
    language: input.language,
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Mounted source apply-plan proof fixture.",
    approvedAt: input.approvedAt,
    approvedBy: input.approvedBy,
    governance: input.governance,
    health: input.health,
    tags: input.tags,
    metadata: input.metadata,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString()
  };
}

function snapshot(store: InMemoryScraperStore, frontier: FocusedFrontier): { sources: string; queue: string; leases: string } {
  return {
    sources: JSON.stringify(store.listSources().map((item) => `${item.id}:${item.status}:${item.updatedAt}`).sort()),
    queue: JSON.stringify(frontier.snapshot().map((item) => item.task.id).sort()),
    leases: JSON.stringify(frontier.leasedSnapshot().map((task) => task.id).sort())
  };
}
