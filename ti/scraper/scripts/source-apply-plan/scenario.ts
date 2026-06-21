import { startApiServer } from "../../src/api/server.ts";
import { FocusedFrontier } from "../../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../../src/storage/memoryStore.ts";
import type { ApplyPlanPayload, ProofResult, ScenarioInput } from "./types.ts";

export async function runScenario(
  scenario: ProofResult["scenario"],
  input: ScenarioInput
): Promise<ProofResult> {
  const store = new InMemoryScraperStore();
  const frontier = new FocusedFrontier();
  for (const source of input.sources) store.saveSource(source);
  const before = snapshot(store, frontier);
  const server = startApiServer({ port: 0, store, frontier });

  try {
    const { status, payload } = await postApplyPlan(server.port, input);
    const after = snapshot(store, frontier);
    const mutationProof = mutations(before, after);
    const safetyProof = safety(scenario, payload);
    const statusOk = scenario === "invalid_action" ? status === 400 : status === 200;

    return {
      scenario,
      ok: statusOk && scenarioOk(scenario, payload) && allTrue(mutationProof) && allTrue(safetyProof),
      status,
      endpoint: "/v1/sources/apply-plan",
      expectedOutput: scenario === "invalid_action"
        ? "HTTP 400 invalid_action and snapshots unchanged"
        : "HTTP 200 dryRun=true willMutate=false willStartCrawling=false and snapshots unchanged",
      actions: payload.applyPlan?.items.map((item) => item.action) ?? [],
      automation: payload.applyPlan?.items.map((item) => item.automation) ?? [],
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

async function postApplyPlan(port: number, input: ScenarioInput): Promise<{ status: number; payload: ApplyPlanPayload }> {
  const response = await fetch(`http://127.0.0.1:${port}/v1/sources/apply-plan`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(input.headers ?? {}) },
    body: JSON.stringify(input.body)
  });
  return { status: response.status, payload: await response.json() as ApplyPlanPayload };
}

function snapshot(store: InMemoryScraperStore, frontier: FocusedFrontier): { sources: string; queue: string; leases: string } {
  return {
    sources: JSON.stringify(store.listSources().map((item) => `${item.id}:${item.status}:${item.updatedAt}`).sort()),
    queue: JSON.stringify(frontier.snapshot().map((item) => item.task.id).sort()),
    leases: JSON.stringify(frontier.leasedSnapshot().map((task) => task.id).sort())
  };
}

function mutations(before: ReturnType<typeof snapshot>, after: ReturnType<typeof snapshot>) {
  return {
    sourcesUnchanged: before.sources === after.sources,
    queueUnchanged: before.queue === after.queue,
    leasesUnchanged: before.leases === after.leases
  };
}

function safety(scenario: ProofResult["scenario"], payload: ApplyPlanPayload) {
  const serialized = JSON.stringify(payload.applyPlan ?? {});
  const disabled = payload.applyPlan?.items.flatMap((item) => item.collectionImpact.remainsDisabled) ?? [];
  return {
    noStartedCrawl: !serialized.includes("startedCrawl") && payload.applyPlan?.items.every((item) => !item.collectionImpact.willStartCrawling) !== false,
    noRegistryMutationFields: !serialized.includes("updatedSource") && !serialized.includes("reviewDecisionApplied") && !serialized.includes("dbTransaction"),
    noRestrictedActivation: !serialized.includes("restrictedActivation") && (scenario !== "blocked_restricted_source" || disabled.includes("automatic restricted-source activation"))
  };
}

function scenarioOk(scenario: ProofResult["scenario"], payload: ApplyPlanPayload): boolean {
  if (scenario === "invalid_action") return payload.error?.code === "invalid_action";
  if (!payload.applyPlan || payload.applyPlan.willMutate || payload.applyPlan.willStartCrawling) return false;
  if (scenario === "happy_path") {
    const actions = payload.applyPlan.items.map((item) => item.action);
    const automation = payload.applyPlan.items.map((item) => item.automation);
    return actions.includes("approve") && automation.includes("rollback_only");
  }
  return payload.applyPlan.items.every((item) => !item.collectionImpact.enablesCollection);
}

function allTrue(value: Record<string, boolean>): boolean {
  return Object.values(value).every(Boolean);
}
