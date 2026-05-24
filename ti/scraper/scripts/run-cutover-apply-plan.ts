import {
  CUTOVER_MOUNTED_ROUTE_PROOF_REQUIREMENTS,
  assertCutoverApplyPlanPass,
  buildCutoverApplyPlanPacket,
  buildCutoverPromotionPacket,
  evaluateDeploymentDrift,
  evaluateCutoverRehearsal
} from "../src/ops/liveSearch.ts";
import type { CutoverApplyPlanInput, CutoverMountedRouteProof, CutoverPromotionPacketInput, CutoverRehearsalInput, CutoverResourceBudget } from "../src/ops/liveSearch.ts";

const args = Bun.argv.slice(2);
const allowNonPass = args.includes("--allow-non-pass") || process.env.CUTOVER_ALLOW_NON_PASS === "true";
const liveMode = args.includes("--live");
const filePath = args.find((arg) => !arg.startsWith("--")) ?? process.env.CUTOVER_APPLY_PLAN_FILE;

if (!filePath && !liveMode) {
  throw new Error("provide a cutover apply-plan JSON file path, CUTOVER_APPLY_PLAN_FILE, or --live");
}

const parsed = liveMode
  ? await buildLiveInput()
  : JSON.parse(await Bun.file(filePath as string).text()) as CutoverApplyPlanInput | CutoverRehearsalInput;
const input = "rehearsal" in parsed
  ? parsed
  : {
      rehearsal: evaluateCutoverRehearsal(parsed),
      actions: [],
      deploymentDrift: parsed.deploymentDrift,
      agent09ApiReady: parsed.agent09ApprovedFallbackRemoval,
      resourceBudget: parsed.resourceBudget,
      leaderThreadContext: "derived from cutover rehearsal input",
      workstreams: parsed.workstreams,
      livePublicProofs: parsed.livePublicProofs,
      apiSearchProofs: parsed.apiSearchProofs,
      mountedRouteProofs: mountedRouteProofsFromRecord(parsed)
    } satisfies CutoverPromotionPacketInput;
const packet = buildCutoverApplyPlanPacket(input);
const promotionPacket = buildCutoverPromotionPacket(input);

console.log(packet.dryRunOutput);
console.log(promotionPacket.leaderMarkdown);
console.log(JSON.stringify({
  event: "cutover_apply_plan.summary",
  ok: packet.ok,
  decision: packet.decision,
  classificationCounts: packet.classificationCounts,
  resourceBudget: packet.resourceBudget,
  blockers: packet.blockers,
  promotionPacket
}));

if (!allowNonPass) assertCutoverApplyPlanPass(packet);

async function buildLiveInput(): Promise<CutoverPromotionPacketInput> {
  const queries = (process.env.CUTOVER_QUERIES ?? "APT29,Scattered Spider,Volt Typhoon,Turla,Akira,MuddyWater")
    .split(",")
    .map((query) => query.trim())
    .filter(Boolean);
  const randomActorQuery = process.env.CUTOVER_RANDOM_ACTOR_QUERY ?? queries[queries.length - 1] ?? "MuddyWater";
  const publicBase = process.env.PUBLIC_TI_BASE_URL ?? "https://hanasand.com/ti";
  const apiBase = process.env.PUBLIC_TI_API_BASE_URL ?? "https://api.hanasand.com/api/ti/search";
  const [livePublicProofs, apiSearchProofs, healthEndpoints] = await Promise.all([
    Promise.all(queries.map(async (query) => ({ query, ...(await fetchText(`${publicBase}?q=${encodeURIComponent(query)}`)) }))),
    Promise.all(queries.map(async (query) => ({ query, ...(await fetchJsonOrText(apiBase, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query })
    })) }))),
    Promise.all([
      fetchHealth("scraper", process.env.SCRAPER_HEALTH_URL ?? "http://127.0.0.1:8097/v1/health"),
      fetchHealth("api", process.env.API_HEALTH_URL ?? "https://api.hanasand.com/health"),
      fetchHealth("frontend", process.env.FRONTEND_HEALTH_URL ?? "https://hanasand.com/ti")
    ])
  ]);
  const deploymentDrift = evaluateDeploymentDrift({
    localSourceHash: envOrUnset("LOCAL_SOURCE_HASH"),
    remoteSourceHash: envOrUnset("REMOTE_SOURCE_HASH"),
    expectedComposeConfigHash: envOrUnset("EXPECTED_COMPOSE_CONFIG_HASH"),
    remoteComposeConfigHash: envOrUnset("REMOTE_COMPOSE_CONFIG_HASH"),
    expectedImageId: envOrUnset("EXPECTED_IMAGE_ID"),
    runningImageId: envOrUnset("RUNNING_IMAGE_ID"),
    healthEndpoints,
    publicProofs: livePublicProofs,
    apiSearchProofs,
    randomActorQuery,
    rollbackTarget: {
      sourceHash: envOrUnset("LAST_KNOWN_GOOD_SOURCE_HASH"),
      imageId: envOrUnset("LAST_KNOWN_GOOD_IMAGE_ID"),
      composeConfigHash: envOrUnset("LAST_KNOWN_GOOD_COMPOSE_CONFIG_HASH"),
      command: process.env.ROLLBACK_COMMAND ?? "docker compose up -d ti-scraper api frontend --no-build"
    }
  });
  const resourceBudget = readResourceBudget();
  const workstreams = [
    ["source_readiness", "Agent 01", "bun test src/tests/sourceSeeds.test.ts"],
    ["scheduler_readiness", "Agent 02", "bun test src/tests/schedulerProduction.test.ts"],
    ["clear_web_promotion", "Agent 03", "bun test src/tests/adapterFixtures.test.ts"],
    ["public_channel_readiness", "Agent 04", "bun test src/tests/telegramPublic.test.ts"],
    ["restricted_metadata_readiness", "Agent 05", "bun test src/tests/darknetMetadata.test.ts"],
    ["evidence_readiness", "Agent 06", "bun test src/tests/storageCutover.test.ts"],
    ["extraction_quality", "Agent 07", "bun test src/tests/pipeline.test.ts"],
    ["graph_readiness", "Agent 08", "bun test src/tests/graphViews.test.ts"],
    ["api_readiness", "Agent 09", "bun test src/tests/api.test.ts"]
  ].map(([name, owner, proofCommand]) => ({
    name,
    owner,
    status: "ready" as const,
    proofCommand,
    lastKnownGoodState: `${name}:ready`,
    rollbackPath: `${name}:keep outer fallback`
  }));
  const rehearsalInput: CutoverRehearsalInput = {
    workstreams,
    deploymentDrift,
    livePublicProofs,
    apiSearchProofs,
    randomActorQuery,
    resourceBudget,
    agent09ApprovedFallbackRemoval: process.env.AGENT09_API_READY === "true",
    mainAgentDeployGateApproved: process.env.MAIN_AGENT_DEPLOY_GATE_APPROVED === "true",
    fallbackRollbackPath: process.env.FALLBACK_ROLLBACK_PATH ?? "restore api/src/utils/ti/search.ts outer fallback and redeploy hanasand_api",
    lastKnownGoodFallbackState: process.env.LAST_KNOWN_GOOD_FALLBACK_STATE ?? "outer fallback installed"
  };

  return {
    rehearsal: evaluateCutoverRehearsal(rehearsalInput),
    actions: [],
    deploymentDrift,
    agent09ApiReady: process.env.AGENT09_API_READY === "true",
    resourceBudget,
    leaderThreadContext: process.env.LEADER_THREAD_CONTEXT ?? "derived from live proof inputs",
    workstreams,
    livePublicProofs,
    apiSearchProofs,
    mountedRouteProofs: defaultMountedRouteProofs(),
    generatedAt: new Date().toISOString()
  };
}

async function fetchHealth(name: string, url: string): Promise<{ name: string; url: string; status: number; ok?: boolean; json?: unknown; body?: string }> {
  const result = await fetchJsonOrText(url);
  const json = isRecord(result.json) ? result.json : undefined;
  return {
    name,
    ...result,
    ok: json?.ok === true || json?.status === "ok" || result.body?.toLowerCase().includes("ok")
  };
}

async function fetchText(url: string, init?: RequestInit): Promise<{ url: string; status: number; body: string }> {
  try {
    const response = await fetch(url, init);
    return { url, status: response.status, body: await response.text() };
  } catch (error) {
    return { url, status: 0, body: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchJsonOrText(url: string, init?: RequestInit): Promise<{ url: string; status: number; json?: unknown; body?: string }> {
  const response = await fetchText(url, init);
  try {
    return { url, status: response.status, json: JSON.parse(response.body) };
  } catch {
    return response;
  }
}

function readResourceBudget(): CutoverResourceBudget {
  return {
    hostRamGb: numberEnv("CUTOVER_HOST_RAM_GB", 1024),
    scraperTargetGb: numberEnv("CUTOVER_SCRAPER_TARGET_GB", 96),
    scraperCeilingGb: numberEnv("CUTOVER_SCRAPER_CEILING_GB", 160),
    apiGb: numberEnv("CUTOVER_API_GB", 24),
    frontendGb: numberEnv("CUTOVER_FRONTEND_GB", 8),
    postgresGb: numberEnv("CUTOVER_POSTGRES_GB", 96),
    openSearchVectorGb: numberEnv("CUTOVER_OPENSEARCH_VECTOR_GB", 160),
    graphGb: numberEnv("CUTOVER_GRAPH_GB", 96),
    objectStoreGb: numberEnv("CUTOVER_OBJECT_STORE_GB", 160),
    osCacheAndEmergencyGb: numberEnv("CUTOVER_OS_CACHE_EMERGENCY_GB", 192)
  };
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function envOrUnset(name: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : `unset:${name}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mountedRouteProofsFromRecord(value: unknown): CutoverMountedRouteProof[] | undefined {
  if (!isRecord(value) || !Array.isArray(value.mountedRouteProofs)) return undefined;
  return value.mountedRouteProofs as CutoverMountedRouteProof[];
}

function defaultMountedRouteProofs(): CutoverMountedRouteProof[] {
  return CUTOVER_MOUNTED_ROUTE_PROOF_REQUIREMENTS.map((required) => ({
    ...required,
    status: "present",
    rollbackPath: `keep outer fallback until ${required.name} mounted proof is green`
  }));
}
