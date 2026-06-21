import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { startCanaryCollectionLoop } from "../src/ops/canaryCollection.ts";
import { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import {
  assertNoLeak,
  assertOperator,
  assertProductionReadiness,
  assertProductionSoak,
  assertPublicAnswer,
  assertReadiness,
  assertRun,
  assertSecondRun,
  assertSoak
} from "./canary-proof/assertions.ts";
import { compactAnswer, compactProductionGate, compactReadiness, compactRun, compactRuntime, compactSoak } from "./canary-proof/compact.ts";
import { getJson, postJson } from "./canary-proof/http.ts";
import { canaryResponse, startProofServer } from "./canary-proof/server.ts";

const store = new InMemoryScraperStore();
const frontier = new FocusedFrontier();
const objectStore = new InMemoryObjectEvidenceStore();
const canaryLoop = startCanaryCollectionLoop({
  store,
  frontier,
  objectStore,
  enabled: false,
  intervalSeconds: 300,
  maxSources: 10,
  maxTasks: 3,
  queueLimit: 500,
  activateSources: false,
  now: () => "2026-05-24T11:00:00.000Z"
});
const server = startProofServer({ store, frontier, objectStore, canaryLoop, canaryFetch: async (url) => canaryResponse(url) });
const base = `http://127.0.0.1:${server.port}`;

try {
  await postJson(base, "/v1/sources/canary-activation", approval("2026-05-24T11:00:00.000Z"));
  const run = await postJson(base, "/v1/ops/canary/run", { ...approval("2026-05-24T11:01:00.000Z"), maxSources: 5, maxTasks: 5 });
  const secondRun = await postJson(base, "/v1/ops/canary/run", { ...approval("2026-05-24T11:02:00.000Z"), maxSources: 6, maxTasks: 1 });
  const readiness = await getJson(base, "/v1/ops/canary/readiness?requiredQueries=APT42,Turla&generatedAt=2026-05-24T11:01:00.000Z");
  const productionReadiness = await getJson(base, "/v1/ops/canary/readiness?requiredQueries=APT42,Turla&requireNativeLiveHttp=true&generatedAt=2026-05-24T11:01:00.000Z");
  const soak = await getJson(base, "/v1/ops/canary/soak?minCycles=2&generatedAt=2026-05-24T11:02:00.000Z");
  const productionSoak = await getJson(base, "/v1/ops/canary/soak?minCycles=2&requireNativeLiveHttp=true&generatedAt=2026-05-24T11:02:00.000Z");
  const operator = await getJson(base, "/v1/ops/canary");
  const apt42 = await getJson(base, "/v1/intel/search?q=APT42&entityType=actor");
  const turla = await getJson(base, "/v1/intel/search?q=Turla&entityType=actor");
  assertAll({ run, secondRun, readiness, productionReadiness, soak, productionSoak, operator, apt42, turla });
  console.log(JSON.stringify({
    ok: true,
    command: "bun run check:canary-proof-path",
    expectedOutput: "ok=true; approved public sources collect, externalize captures, pass CI readiness for APT42/Turla, hold production gates without native live HTTP, and feed public answers",
    run: compactRun(run),
    secondRun: compactRun(secondRun),
    readiness: compactReadiness(readiness),
    productionReadiness: compactProductionGate(productionReadiness, "readiness"),
    soak: compactSoak(soak),
    productionSoak: compactProductionGate(productionSoak, "soak"),
    runtime: compactRuntime(operator),
    publicAnswers: [compactAnswer("APT42", apt42), compactAnswer("Turla", turla)]
  }, null, 2));
} finally {
  server.stop();
  canaryLoop.stop();
}

function approval(generatedAt: string) {
  return { operatorApproval: true, approvedBy: "canary-proof", generatedAt };
}

function assertAll(payload: Record<string, Record<string, unknown>>): void {
  assertRun(payload.run);
  assertSecondRun(payload.secondRun);
  assertReadiness(payload.readiness);
  assertProductionReadiness(payload.productionReadiness);
  assertSoak(payload.soak);
  assertProductionSoak(payload.productionSoak);
  assertOperator(payload.operator);
  assertPublicAnswer("APT42", payload.apt42);
  assertPublicAnswer("Turla", payload.turla);
  for (const value of Object.values(payload)) assertNoLeak(value);
}
