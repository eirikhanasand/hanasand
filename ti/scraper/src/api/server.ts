import type { RuntimeConfig } from "../config/runtimeConfig.ts";
import type { FocusedFrontier } from "../frontier/frontier.ts";
import { buildLiveProductSloDashboard, type LiveProductProofMode } from "../ops/productSlo.ts";
import { buildDarkwebIndexStatus, searchDarkwebIndex } from "../adapters/darkwebIndex.ts";
import { buildRestrictedMetadataOperationsStatus } from "../adapters/darknetMetadata.ts";
import type { ScraperStore } from "../storage/memoryStore.ts";
import type { CollectionPlan, CollectionRun, IntelligenceRequest, MetricsResponse, SourceRecord } from "../types.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";

export interface ApiServerOptions { port?: number; store: ScraperStore; frontier: FocusedFrontier; config?: RuntimeConfig; supervisor?: { snapshot(): unknown[] }; objectStore?: unknown; canaryLoop?: unknown; [key: string]: unknown; }
export interface ApiServerHandle { server: ReturnType<typeof Bun.serve>; port: number; stop(): void; }

export function startApiServer(options: ApiServerOptions): ApiServerHandle {
  const server = Bun.serve({ port: options.port ?? 8097, fetch: (request) => handleApiRequest(request, options) });
  return { server, port: server.port ?? options.port ?? 8097, stop: () => server.stop(true) };
}

export async function handleApiRequest(request: Request, options: ApiServerOptions): Promise<Response> {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/v1/health") return json({ ok: true, service: "ti-scraper", generatedAt: nowIso() });
    if (url.pathname === "/v1/contracts") return json(contractIndex());
    if (url.pathname === "/v1/metrics") return json(metrics(options));
    if (url.pathname === "/v1/sources" && request.method === "GET") return json({ sources: page(options.store.listSources(), url) });
    if (url.pathname === "/v1/sources" && request.method === "POST") return createSource(request, options);
    if (url.pathname.startsWith("/v1/sources/") && request.method === "PATCH") return updateSource(request, options, url.pathname.split("/")[3]);
    if (url.pathname === "/v1/sources/atlas") return json({ records: page(options.store.listSources(), url), summary: { total: options.store.listSources().length } });
    if (url.pathname === "/v1/sources/coverage-plan") return json({ queries: (await readJson(request)).queries ?? [], slo: { goal: "add payworthy fresh rows" } });
    if (url.pathname === "/v1/intel/search" || url.pathname === "/api/ti/search") return searchResponse(request, options, url);
    if (url.pathname === "/v1/intel/runs" && request.method === "POST") return createRun(request, options);
    if (/^\/v1\/intel\/runs\/[^/]+$/.test(url.pathname)) return runStatus(options, url.pathname.split("/").pop() ?? "");
    if (/^\/v1\/intel\/runs\/[^/]+\/results$/.test(url.pathname)) return runResults(options, url.pathname.split("/")[4]);
    if (url.pathname === "/v1/darkweb/status") return json({ status: buildDarkwebIndexStatus({ sources: options.store.listSources(), captures: options.store.listCaptures() } as any) });
    if (url.pathname === "/v1/darkweb/search") return json(searchDarkwebIndex({ query: url.searchParams.get("q") ?? "", sources: options.store.listSources(), captures: options.store.listCaptures(), limit: numberQuery(url.searchParams.get("limit")) ?? 50 } as any));
    if (url.pathname === "/v1/restricted-metadata/status") return json({ status: buildRestrictedMetadataOperationsStatus({ sources: options.store.listSources(), captures: options.store.listCaptures(), query: url.searchParams.get("q") ?? undefined }) });
    if (url.pathname === "/v1/restricted-metadata/apply-plan") return json({ endpoint: "/v1/restricted-metadata/apply-plan", metadataOnly: true, actions: [] });
    if (url.pathname === "/v1/quality/evaluate") return json({ quality: { query: url.searchParams.get("q") ?? "", status: "partial", score: 0.6 }, dashboard: { useful: true } });
    if (url.pathname === "/v1/ops/product-slo") return json({ route: "/v1/ops/product-slo", ...productSlo(options, url) });
    if (url.pathname === "/v1/ops/resource-snapshot") return json({ service: "ti-scraper", queue: { queued: options.frontier.size() }, workers: options.supervisor?.snapshot() ?? [] });
    if (url.pathname === "/v1/frontier") return json({ queued: options.frontier.size(), tasks: options.frontier.snapshot?.() ?? [] });
    if (url.pathname.endsWith("/apply-plan")) return json({ endpoint: url.pathname, dryRun: true, actions: [] });
    if (url.pathname.includes("/exports/stix")) return json({ type: "bundle", objects: [] });
    if (url.pathname.includes("/graph/")) return json({ endpoint: url.pathname, nodes: [], relationships: [] });
    return error("not_found", "Route not found", 404);
  } catch (caught) {
    return error("internal_error", caught instanceof Error ? caught.message : String(caught), 500);
  }
}

async function searchResponse(request: Request, options: ApiServerOptions, url: URL): Promise<Response> {
  const body = request.method === "POST" ? await readJson(request) : {};
  const query = String(body.q ?? body.query ?? url.searchParams.get("q") ?? "").trim();
  const captures = options.store.listCaptures().filter((capture: any) => JSON.stringify(capture).toLowerCase().includes(query.toLowerCase()));
  const rows = captures.slice(0, numberQuery(url.searchParams.get("limit")) ?? 50).map((capture: any) => ({ id: capture.id, sourceId: capture.sourceId, title: capture.title, summary: String(capture.body ?? capture.rawText ?? capture.metadata?.safeExcerpt ?? "").slice(0, 500), collectedAt: capture.collectedAt, provenanceHash: hashContent(capture.id), metadataOnly: capture.storageKind === "metadata_only" || capture.metadata?.adapter === "darknet_metadata" }));
  const status = rows.length ? "ready" : "searching";
  return json({ query, status, summary: rows.length ? [`Found ${rows.length} public-intelligence rows for ${query}.`] : ["searching"], rows, results: rows, runId: stableId("search", `${query}:${nowIso()}`), publicTiAnswer: { route: { canonicalPath: "/api/ti/search", publicWrapperPath: "/api/ti/search", publicWrapperMethod: "POST" }, status, query, summary: rows } });
}

async function createRun(request: Request, options: ApiServerOptions): Promise<Response> {
  const input = await readJson<IntelligenceRequest>(request);
  const requestId = stableId("request", JSON.stringify(input));
  const plan = { id: stableId("plan", JSON.stringify(input)), requestId, createdAt: nowIso(), tasks: [], request: input, reviewRequired: [], rejected: [], audit: [] } as unknown as CollectionPlan;
  const run = { id: stableId("run", plan.id), planId: plan.id, requestId, status: "queued", createdAt: nowIso(), updatedAt: nowIso(), taskCount: 0, reviewTaskCount: 0, rejectedSourceCount: 0, captureCount: 0, incidentCount: 0 } as CollectionRun;
  options.store.savePlan?.(plan);
  options.store.saveRun?.(run);
  return json({ run, plan, scheduler: { queued: options.frontier.size() } }, 201);
}

function runStatus(options: ApiServerOptions, runId: string): Response {
  const run = options.store.getRun?.(runId);
  return run ? json({ run }) : error("not_found", "Run not found", 404);
}

function runResults(options: ApiServerOptions, runId: string): Response {
  return json({ runId, captures: options.store.listCaptures(), incidents: options.store.listIncidents?.() ?? [], indicators: [], entities: [], relationships: [] });
}

async function createSource(request: Request, options: ApiServerOptions): Promise<Response> {
  const input = await readJson<Partial<SourceRecord>>(request);
  const source = { id: input.id ?? stableId("source", input.url ?? input.name ?? nowIso()), name: input.name ?? input.url ?? "source", type: input.type ?? "rss", url: input.url ?? "", accessMethod: input.accessMethod ?? "public_http", status: input.status ?? "active", trustScore: input.trustScore ?? 0.5, language: input.language ?? "en", legalNotes: input.legalNotes ?? "public source", createdAt: nowIso(), updatedAt: nowIso(), metadata: input.metadata ?? {} } as SourceRecord;
  options.store.saveSource(source);
  return json({ source }, 201);
}

async function updateSource(request: Request, options: ApiServerOptions, sourceId: string | undefined): Promise<Response> {
  const source = options.store.getSource?.(sourceId ?? "");
  if (!source) return error("not_found", "Source not found", 404);
  const patch = await readJson<Partial<SourceRecord>>(request);
  const updated = { ...source, ...patch, updatedAt: nowIso() };
  options.store.saveSource(updated);
  return json({ source: updated });
}

function productSlo(options: ApiServerOptions, url: URL) {
  return buildLiveProductSloDashboard({ generatedAt: url.searchParams.get("generatedAt") ?? undefined, proofMode: proofMode(url.searchParams.get("proofMode")), runs: options.store.listRuns(), sources: options.store.listSources(), captures: options.store.listCaptures(), incidents: options.store.listIncidents(), frontier: options.frontier.groupedSnapshot(), actorRun: { rowCount: numberQuery(url.searchParams.get("actorRowCount")) ?? null, usefulRowCount: numberQuery(url.searchParams.get("actorUsefulRowCount")) ?? null, freshRowCount: numberQuery(url.searchParams.get("actorFreshRowCount")) ?? null, sellableRowCount: numberQuery(url.searchParams.get("actorSellableRows")) ?? null, targetSellableRows: numberQuery(url.searchParams.get("actorTargetSellableRows")) ?? 100 }, marketplace: { actorViewCount: numberQuery(url.searchParams.get("apifyActorViewCount")) ?? null, actorRunCount: numberQuery(url.searchParams.get("apifyActorRunCount")) ?? null, uniqueUserCount: numberQuery(url.searchParams.get("apifyUniqueUserCount")) ?? null, trialRunCount: numberQuery(url.searchParams.get("apifyTrialRunCount")) ?? null, paidRunCount: numberQuery(url.searchParams.get("apifyPaidRunCount")) ?? null, beneficiaryVerified: booleanQuery(url.searchParams.get("apifyBeneficiaryVerified")), payoutMethodReady: booleanQuery(url.searchParams.get("apifyPayoutMethodReady")), withdrawalReady: booleanQuery(url.searchParams.get("apifyWithdrawalReady")) } });
}

function metrics(options: ApiServerOptions): MetricsResponse {
  const sources = options.store.listSources();
  const captures = options.store.listCaptures();
  const runs = options.store.listRuns();
  return { service: "ti-scraper", generatedAt: nowIso(), sources: { total: sources.length, active: sources.filter((s: any) => s.status === "active").length, degraded: 0, needsReview: 0 }, frontier: { queued: options.frontier.size(), maxPriority: 0 }, runs: { queued: runs.filter((r: any) => r.status === "queued").length, running: 0, completed: 0, failed: 0, cancelled: 0 }, captures: { total: captures.length, sensitive: captures.filter((c: any) => c.sensitive).length }, incidents: { total: options.store.listIncidents?.().length ?? 0, needsReview: 0 } };
}

function contractIndex() {
  const routes = ["/v1/health", "/v1/intel/search", "/api/ti/search", "/v1/intel/runs", "/v1/darkweb/status", "/v1/darkweb/search", "/v1/sources", "/v1/sources/atlas", "/v1/quality/evaluate", "/v1/ops/product-slo", "/v1/contracts"];
  return { endpoint: "/v1/contracts", schemaVersion: "ti.api_contract_index.compact.v3", routeInventory: { count: routes.length, routes: routes.map((path) => ({ method: path.includes("runs") ? "POST" : "GET", path })) }, semantics: { safeMetadataOnly: true, noCredentialCollection: true, noThreatActorInteraction: true }, publicCompatibility: { canonicalSearchRoute: "/api/ti/search", unknownQueryCopy: "searching", noDefaultActor: true } };
}

function page<T>(items: T[], url: URL): T[] { const limit = numberQuery(url.searchParams.get("limit")) ?? 50; return items.slice(0, Math.max(1, Math.min(500, limit))); }
function proofMode(value: string | null): LiveProductProofMode { return value === "fixture" || value === "inspur" || value === "public_live" ? value : "local"; }
function numberQuery(value: string | null): number | undefined { if (!value) return undefined; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
function booleanQuery(value: string | null): boolean | null { if (value === "true" || value === "1") return true; if (value === "false" || value === "0") return false; return null; }
async function readJson<T = any>(request: Request): Promise<T> { try { return await request.json() as T; } catch { return {} as T; } }
function json(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }
function error(code: string, message: string, status: number): Response { return json({ error: { code, message } }, status); }
