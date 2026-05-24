import { startApiServer } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { startCanaryCollectionLoop } from "../src/ops/canaryCollection.ts";
import { InMemoryObjectEvidenceStore, InMemoryScraperStore } from "../src/storage/memoryStore.ts";

type JsonObject = Record<string, unknown>;

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

const server = startProofServer({
  store,
  frontier,
  objectStore,
  canaryLoop,
  canaryFetch: async (url) => canaryResponse(url)
});

const base = `http://127.0.0.1:${server.port}`;

try {
  await postJson("/v1/sources/canary-activation", {
    operatorApproval: true,
    approvedBy: "canary-proof",
    generatedAt: "2026-05-24T11:00:00.000Z"
  });
  const run = await postJson("/v1/ops/canary/run", {
    operatorApproval: true,
    approvedBy: "canary-proof",
    maxSources: 5,
    maxTasks: 5,
    generatedAt: "2026-05-24T11:01:00.000Z"
  });
  const secondRun = await postJson("/v1/ops/canary/run", {
    operatorApproval: true,
    approvedBy: "canary-proof",
    maxSources: 6,
    maxTasks: 1,
    generatedAt: "2026-05-24T11:02:00.000Z"
  });
  const readiness = await getJson("/v1/ops/canary/readiness?requiredQueries=APT42,Turla&generatedAt=2026-05-24T11:01:00.000Z");
  const productionReadiness = await getJson("/v1/ops/canary/readiness?requiredQueries=APT42,Turla&requireNativeLiveHttp=true&generatedAt=2026-05-24T11:01:00.000Z");
  const soak = await getJson("/v1/ops/canary/soak?minCycles=2&generatedAt=2026-05-24T11:02:00.000Z");
  const productionSoak = await getJson("/v1/ops/canary/soak?minCycles=2&requireNativeLiveHttp=true&generatedAt=2026-05-24T11:02:00.000Z");
  const operator = await getJson("/v1/ops/canary");
  const apt42 = await getJson("/v1/intel/search?q=APT42&entityType=actor");
  const turla = await getJson("/v1/intel/search?q=Turla&entityType=actor");
  assertRun(run);
  assertSecondRun(secondRun);
  assertReadiness(readiness);
  assertProductionReadiness(productionReadiness);
  assertSoak(soak);
  assertProductionSoak(productionSoak);
  assertOperator(operator);
  assertPublicAnswer("APT42", apt42);
  assertPublicAnswer("Turla", turla);
  assertNoLeak(readiness);
  assertNoLeak(soak);
  assertNoLeak(apt42);
  assertNoLeak(turla);
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
    publicAnswers: [
      compactAnswer("APT42", apt42),
      compactAnswer("Turla", turla)
    ]
  }, null, 2));
} finally {
  server.stop();
  canaryLoop.stop();
}

function canaryResponse(url: string): Response {
  if (url.includes("microsoft.com")) {
    return rss("APT42 credential theft infrastructure observed", "APT42 targeted public sector victims with phishing infrastructure and malware delivery.");
  }
  if (url.includes("cloud.google.com/blog/products/identity-security")) {
    return rss("Turla Snake malware activity", "Turla operators used Snake malware against government victims with command infrastructure.");
  }
  if (url.includes("cloud.google.com/blog/topics/threat-intelligence")) {
    return rss("Turla and APT42 public research roundup", "Public threat research references Turla, APT42, phishing, malware, and defensive indicators.");
  }
  return rss("CVE-2026-11111 public advisory", "Public advisory references CVE-2026-11111 exploitation and malware activity.");
}

function rss(title: string, description: string): Response {
  return new Response(`
    <rss><channel><item>
      <title>${title}</title>
      <link>https://example.test/canary/${encodeURIComponent(title.toLowerCase().replaceAll(" ", "-"))}</link>
      <description>${description}</description>
      <pubDate>Sun, 24 May 2026 11:01:00 GMT</pubDate>
    </item></channel></rss>
  `, { status: 200, headers: { "content-type": "application/rss+xml" } });
}

async function postJson(path: string, body: JsonObject): Promise<JsonObject> {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse(path, response);
}

async function getJson(path: string): Promise<JsonObject> {
  return parseResponse(path, await fetch(`${base}${path}`));
}

async function parseResponse(path: string, response: Response): Promise<JsonObject> {
  const text = await response.text();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${text}`);
  return JSON.parse(text) as JsonObject;
}

function assertRun(payload: JsonObject): void {
  const run = record(payload.canaryRun);
  if (run.mode !== "production_canary") throw new Error("canary run did not use production_canary mode");
  if (run.activationApplied !== false) throw new Error("canary run unexpectedly activated sources");
  if (number(run.completedTaskCount) < 5) throw new Error("canary run did not complete the expected bounded task set");
  if (number(run.insertedCaptureCount) < 5) throw new Error("canary run did not persist fresh captures");
  if (number(run.incidentCount) < 2) throw new Error("canary run did not promote extraction evidence");
}

function assertSecondRun(payload: JsonObject): void {
  const run = record(payload.canaryRun);
  if (run.activationApplied !== false) throw new Error("second canary run unexpectedly activated sources");
  if (number(run.completedTaskCount) < 1) throw new Error("second canary cycle did not collect a due portfolio source");
  if (number(run.insertedCaptureCount) < 1) throw new Error("second canary cycle did not persist a fresh capture");
}

function assertReadiness(payload: JsonObject): void {
  const readiness = record(payload.readiness);
  if (readiness.schemaVersion !== "ti.public_canary_readiness.v1") throw new Error("missing canary readiness schema");
  if (readiness.decision !== "promote") throw new Error(`expected canary readiness promote, got ${String(readiness.decision)}`);
  const evidence = record(readiness.evidence);
  if (number(evidence.activeSourceCount) < 8) throw new Error("too few active canary sources");
  if (number(evidence.externalObjectCaptureCount) < 5) throw new Error("captures did not cross the object evidence boundary");
  if (number(evidence.missingObjectReferenceCount) !== 0) throw new Error("external object references are missing");
  if (number(evidence.injectedProofFetchCaptureCount) < 5) throw new Error("local canary proof did not preserve injected fetch provenance counts");
  for (const query of ["APT42", "Turla"]) {
    const row = array(readiness.queryReadiness).map(record).find((item) => item.query === query);
    if (!row?.readyForPublicAnswer) throw new Error(`${query} is not ready for public answer promotion`);
  }
  const controls = record(readiness.controls);
  if (controls.activationRequiresHumanApproval !== true || controls.continuousLoopAutoActivation !== false || controls.restrictedSourcesExcluded !== true || controls.liveFetchProvenanceAvailable !== true) {
    throw new Error("canary readiness controls are not fail-closed");
  }
}

function assertProductionReadiness(payload: JsonObject): void {
  const readiness = record(payload.readiness);
  if (readiness.decision !== "hold") throw new Error(`expected production readiness hold without native live HTTP, got ${String(readiness.decision)}`);
  const controls = record(readiness.controls);
  if (controls.nativeLiveHttpRequired !== true) throw new Error("production readiness did not enforce native live HTTP");
  if (!array(readiness.blockers).includes("no native live HTTP canary captures are available for production readiness")) {
    throw new Error("production readiness did not explain missing native live HTTP evidence");
  }
}

function assertSoak(payload: JsonObject): void {
  const soak = record(payload.soak);
  if (soak.schemaVersion !== "ti.public_canary_soak.v1") throw new Error("missing canary soak schema");
  if (soak.decision !== "promote") throw new Error(`expected canary soak promote, got ${String(soak.decision)}`);
  const metrics = record(soak.metrics);
  if (number(metrics.cycleCount) < 2) throw new Error("canary soak did not record repeated cycles");
  if (number(metrics.externalObjectCaptureCount) < 6) throw new Error("canary soak did not preserve object-boundary captures");
  if (number(metrics.injectedProofFetchCaptureCount) < 6) throw new Error("canary soak did not preserve fetch provenance counts");
  if (number(metrics.totalIncidentCount) < 3) throw new Error("canary soak did not preserve extraction promotion yield");
  const controls = record(soak.controls);
  if (controls.canaryPortfolioOnly !== true || controls.continuousLoopAutoActivation !== false || controls.restrictedSourcesExcluded !== true || controls.fetchProvenanceRequired !== true) {
    throw new Error("canary soak controls are not fail-closed");
  }
}

function assertProductionSoak(payload: JsonObject): void {
  const soak = record(payload.soak);
  if (soak.decision !== "hold") throw new Error(`expected production soak hold without native live HTTP, got ${String(soak.decision)}`);
  const controls = record(soak.controls);
  if (controls.nativeLiveHttpRequired !== true) throw new Error("production soak did not enforce native live HTTP");
  if (!array(soak.blockers).includes("no native live HTTP canary captures are available in the soak window")) {
    throw new Error("production soak did not explain missing native live HTTP evidence");
  }
}

function assertOperator(payload: JsonObject): void {
  const operatorView = record(payload.operatorView);
  const runtime = record(operatorView.runtime);
  if (runtime.schemaVersion !== "ti.public_canary_loop_runtime.v1") throw new Error("missing canary runtime schema");
  if (runtime.supervisorAttached !== true) throw new Error("canary runtime supervisor is not attached");
  if (runtime.enabled !== false) throw new Error("local proof runtime should stay disabled and explicit");
  if (runtime.activateSources !== false) throw new Error("canary runtime unexpectedly allows implicit activation");
  if (number(runtime.intervalSeconds) !== 300) throw new Error("canary runtime cadence was not reported");
  if (number(runtime.queueLimit) !== 500) throw new Error("canary runtime queue limit was not reported");
  const controls = record(runtime.controls);
  if (controls.canaryPortfolioOnly !== true || controls.activationRequiresHumanApproval !== true || controls.continuousLoopAutoActivation !== false || controls.dedupeBeforeWrite !== true || controls.retriesBounded !== true || controls.restrictedSourcesExcluded !== true) {
    throw new Error("canary runtime controls are not fail-closed");
  }
  const evidenceStorage = record(operatorView.evidenceStorage);
  if (evidenceStorage.productionEvidenceMode !== "injected_proof_only") {
    throw new Error(`expected injected proof evidence mode in local canary proof, got ${String(evidenceStorage.productionEvidenceMode)}`);
  }
}

function assertPublicAnswer(query: string, payload: JsonObject): void {
  const answer = record(payload.publicTiAnswer);
  if (JSON.stringify(answer).includes("Searching")) throw new Error(`${query} public answer is still only searching`);
  const profile = record(payload.actorProfile);
  const datasets = record(profile.datasets);
  const counts = record(datasets.evidenceStageCounts);
  if (number(counts.captured_page) <= 0) throw new Error(`${query} public answer is not backed by captured-page evidence`);
}

function assertNoLeak(payload: JsonObject): void {
  const serialized = JSON.stringify(payload).toLowerCase();
  for (const forbidden of ["public-canary-evidence/", "password=", "authorization:", "set-cookie", "cookie="]) {
    if (serialized.includes(forbidden)) throw new Error(`unsafe canary proof output leaked ${forbidden}`);
  }
}

function compactRun(payload: JsonObject): JsonObject {
  const run = record(payload.canaryRun);
  return {
    runId: run.runId,
    activationApplied: run.activationApplied,
    completedTaskCount: run.completedTaskCount,
    insertedCaptureCount: run.insertedCaptureCount,
    incidentCount: run.incidentCount
  };
}

function compactReadiness(payload: JsonObject): JsonObject {
  const readiness = record(payload.readiness);
  const evidence = record(readiness.evidence);
  return {
    decision: readiness.decision,
    activeSourceCount: evidence.activeSourceCount,
    externalObjectCaptureCount: evidence.externalObjectCaptureCount,
    promotionYield: evidence.promotionYield,
    queryReadiness: readiness.queryReadiness
  };
}

function compactSoak(payload: JsonObject): JsonObject {
  const soak = record(payload.soak);
  return {
    decision: soak.decision,
    metrics: soak.metrics,
    cycleCount: array(soak.cycles).length
  };
}

function compactProductionGate(payload: JsonObject, key: "readiness" | "soak"): JsonObject {
  const value = record(payload[key]);
  return {
    decision: value.decision,
    blockers: value.blockers,
    controls: value.controls
  };
}

function compactRuntime(payload: JsonObject): JsonObject {
  const runtime = record(record(payload.operatorView).runtime);
  return {
    supervisorAttached: runtime.supervisorAttached,
    enabled: runtime.enabled,
    intervalSeconds: runtime.intervalSeconds,
    queueLimit: runtime.queueLimit,
    activateSources: runtime.activateSources,
    controls: runtime.controls
  };
}

function compactAnswer(query: string, payload: JsonObject): JsonObject {
  return {
    query,
    status: payload.status,
    runId: payload.runId,
    capturedPageCount: record(record(record(payload.actorProfile).datasets).evidenceStageCounts).captured_page
  };
}

function record(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function startProofServer(options: Parameters<typeof startApiServer>[0]) {
  const configured = Number.parseInt(Bun.env.TI_CANARY_PROOF_PORT ?? "", 10);
  const candidates = Number.isFinite(configured)
    ? [configured]
    : Array.from({ length: 20 }, (_, index) => 18_097 + index);
  let lastError: unknown;
  for (const port of candidates) {
    try {
      return startApiServer({ ...options, port });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("unable to start canary proof server");
}
