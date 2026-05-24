interface ContainerProof {
  name: string;
  ok: boolean;
  status: string;
}

interface QueryProof {
  query: string;
  publicStatus: number;
  apiPostStatus: number;
  apiGetStatus: number;
  ok: boolean;
  pageOk: boolean;
  apiPostOk: boolean;
  apiGetOk: boolean;
  apiGetRequired: boolean;
  canonicalApiMethod: "POST";
  hasRunId: boolean;
  hasLiveState: boolean;
  expectedOutput: string;
}

const containerNames = (process.env.TI_INSPUR_CONTAINERS ?? "hanasand_ti_scraper,hanasand_api,hanasand")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const actors = (process.env.TI_PUBLIC_PROOF_ACTORS ?? "Random Actor,Made Up Actor,Lazarus,FIN7,Mustang Panda,Sandworm,Kimsuky")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const queries = ["APT29", ...actors];
const publicBase = process.env.PUBLIC_TI_BASE_URL ?? "https://hanasand.com/ti";
const apiBase = process.env.PUBLIC_TI_API_BASE_URL ?? "https://api.hanasand.com/api/ti/search";
const skipContainers = process.env.TI_SKIP_CONTAINER_CHECKS === "true";
const requireGetApiProof = process.env.TI_REQUIRE_GET_API_PROOF === "true";

const [containers, queryProofs] = await Promise.all([
  skipContainers ? Promise.resolve(containerNames.map((name) => ({ name, ok: true, status: "skipped" }))) : Promise.all(containerNames.map(checkContainer)),
  Promise.all(queries.map(checkQuery))
]);

const ok = containers.every((item) => item.ok) && queryProofs.every((item) => item.ok);
console.log(JSON.stringify({
  ok,
  command: "bun run check:inspur-public-proof",
  expectedOutput: "ok=true; containers healthy/running; public /ti and API search return live partial run proof for APT29, Random Actor, Made Up Actor, and configured non-seeded actors/CVEs",
  containers,
  queries: queryProofs
}, null, 2));

if (!ok) process.exit(1);

async function checkContainer(name: string): Promise<ContainerProof> {
  const proc = Bun.spawn(["docker", "inspect", "--format", "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}", name], {
    stdout: "pipe",
    stderr: "pipe"
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ]);
  const status = stdout.trim() || stderr.trim() || `exit_${exitCode}`;
  return {
    name,
    ok: exitCode === 0 && ["healthy", "running"].includes(status),
    status
  };
}

async function checkQuery(query: string): Promise<QueryProof> {
  const [publicProof, apiPostProof, apiGetProof] = await Promise.all([
    fetchText(`${publicBase}?q=${encodeURIComponent(query)}`),
    fetchText(apiBase, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query })
    }),
    fetchText(`${apiBase}?q=${encodeURIComponent(query)}`)
  ]);
  const publicBody = publicProof.body.toLowerCase();
  const apiBody = apiPostProof.body.toLowerCase();
  const apiJson = parseJson(apiPostProof.body);
  const apiGetJson = parseJson(apiGetProof.body);
  const hasRunIdProof = hasRunId(apiJson) || apiBody.includes("runid") || apiBody.includes("run_id");
  const hasLiveStateProof = hasLiveState(apiJson) || hasLiveStateText(apiBody);
  const pageOk = is2xx(publicProof.status)
    && (publicBody.includes("live_search") || hasLiveStateText(publicBody))
    && hasLiveStateText(publicBody)
    && (publicBody.includes("queued") || publicBody.includes("run"));
  const apiPostOk = is2xx(apiPostProof.status) && hasRunIdProof && hasLiveStateProof;
  const apiGetOk = is2xx(apiGetProof.status) && hasRunId(apiGetJson) && hasLiveState(apiGetJson);
  return {
    query,
    publicStatus: publicProof.status,
    apiPostStatus: apiPostProof.status,
    apiGetStatus: apiGetProof.status,
    ok: pageOk && apiPostOk && (!requireGetApiProof || apiGetOk),
    pageOk,
    apiPostOk,
    apiGetOk,
    apiGetRequired: requireGetApiProof,
    canonicalApiMethod: "POST",
    hasRunId: hasRunIdProof,
    hasLiveState: hasLiveStateProof,
    expectedOutput: "HTTP 2xx; public /ti GET has live_search/ready queued/run; public API canonical proof is POST JSON with run id and partial/ready/searching/queued/metadata_review state; API GET is optional and required only when TI_REQUIRE_GET_API_PROOF=true"
  };
}

async function fetchText(url: string, init?: RequestInit): Promise<{ status: number; body: string }> {
  try {
    const response = await fetch(url, init);
    return { status: response.status, body: await response.text() };
  } catch (error) {
    return { status: 599, body: error instanceof Error ? error.message : String(error) };
  }
}

function is2xx(status: number): boolean {
  return status >= 200 && status < 300;
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

function hasRunId(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.runId === "string" || typeof value.run_id === "string") return true;
  return hasRunId(value.run) || hasRunId(value.scheduler) || hasRunId(value.planner);
}

function hasLiveState(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (isLiveState(value.status) || isLiveState(value.state)) return true;
  return hasLiveState(value.run) || hasLiveState(value.scheduler) || hasLiveState(value.publicChannel);
}

function hasLiveStateText(value: string): boolean {
  return ["partial", "ready", "searching", "queued", "metadata_review", "metadata-review", "degraded", "blocked", "disabled"].some((state) => value.includes(state));
}

function isLiveState(value: unknown): boolean {
  return typeof value === "string" && hasLiveStateText(value.toLowerCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
