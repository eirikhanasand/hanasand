import { afterAll, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";

const originalBase = Bun.env.HANASAND_AI_API_BASE;
const originalPath = Bun.env.HANASAND_AI_HEALTH_PATH;
let upstreamStatus = 200;
let requests = 0;
const upstream = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => {
  requests++;
  return Response.json({ status: upstreamStatus === 200 ? "ready" : "blocked" }, { status: upstreamStatus });
} });
Bun.env.HANASAND_AI_API_BASE = `http://127.0.0.1:${upstream.port}`;
Bun.env.HANASAND_AI_HEALTH_PATH = "/health";
afterAll(() => {
  upstream.stop(true);
  if (originalBase === undefined) delete Bun.env.HANASAND_AI_API_BASE;
  else Bun.env.HANASAND_AI_API_BASE = originalBase;
  if (originalPath === undefined) delete Bun.env.HANASAND_AI_HEALTH_PATH;
  else Bun.env.HANASAND_AI_HEALTH_PATH = originalPath;
});
const options = { store: new InMemoryScraperStore(), frontier: new FocusedFrontier(), ready: false, serviceToken: "startup-test-token" };
const request = (path: string, authenticated = true, method = "GET") => new Request(`http://localhost${path}`, {
  method, headers: authenticated ? { "x-hanasand-service-token": options.serviceToken } : {}
});

test("both parser health routes probe the bridge while source storage loads", async () => {
  for (const path of ["/v1/dwm/exposure-parser/health", "/api/dwm/exposure-parser/health"]) {
    const response = await handleApiRequest(request(path), options);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ready", httpStatus: 200 });
  }
});
test("parser health still requires authentication during startup", async () => {
  const before = requests;
  expect((await handleApiRequest(request("/v1/dwm/exposure-parser/health", false), options)).status).toBe(401);
  expect(requests).toBe(before);
});
test("an unavailable parser still fails the health check", async () => {
  upstreamStatus = 503;
  try {
    const response = await handleApiRequest(request("/v1/dwm/exposure-parser/health"), options);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ status: "blocked", httpStatus: 503 });
  } finally { upstreamStatus = 200; }
});
test("storage routes and non-GET requests remain blocked during startup", async () => {
  for (const [path, method] of [["/v1/health", "GET"], ["/v1/dwm/exposure-queue", "GET"], ["/v1/dwm/exposure-parser/health", "POST"]]) {
    const response = await handleApiRequest(request(path, true, method), options);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "service_starting" } });
  }
});
