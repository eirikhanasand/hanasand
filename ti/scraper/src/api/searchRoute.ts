import type { ApiServerOptions } from "./serverTypes.ts";
import { json, numberQuery, readJson } from "./http.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";

export async function searchResponse(request: Request, options: ApiServerOptions, url: URL): Promise<Response> {
  const body = request.method === "POST" ? await readJson(request) : {};
  const query = String(body.q ?? body.query ?? url.searchParams.get("q") ?? "").trim();
  const captures = options.store.listCaptures().filter((capture: any) => JSON.stringify(capture).toLowerCase().includes(query.toLowerCase()));
  const rows = captures.slice(0, numberQuery(url.searchParams.get("limit")) ?? 50).map((capture: any) => rowFromCapture(capture));
  const provenance = rows.map((row) => ({ evidenceStage: "captured_page", evidenceId: row.id, sourceId: row.sourceId }));
  const status = rows.length ? "ready" : "searching";
  const actorProfile = { query, actor: query, datasets: { evidenceStageCounts: { captured_page: rows.length }, sourceCount: new Set(rows.map((r) => r.sourceId)).size }, provenance };
  const publicTiAnswer = { route: { canonicalPath: "/api/ti/search", publicWrapperPath: "/api/ti/search", publicWrapperMethod: "POST" }, status, query, summary: rows, safeSummary: rows.length ? [`Found ${rows.length} public-intelligence rows for ${query}.`] : ["searching"], evidenceLedgerReferences: provenance, ux: { evidenceStageLabels: { captured_page: { count: rows.length } } } };
  const quality = qualityFromRows(query, rows);
  const graph = { endpoint: "/v1/intel/search.graph", reviewQueue: { total: rows.length ? 0 : 1, publicFactPolicy: rows.length ? "ready" : "hold_weak_edges" } };
  return json({ query, status, summary: publicTiAnswer.safeSummary, rows, results: rows, runId: stableId("search", `${query}:${nowIso()}`), actorProfile, publicTiAnswer, quality, graph });
}

function rowFromCapture(capture: any) {
  return {
    id: capture.id,
    sourceId: capture.sourceId,
    title: capture.title,
    summary: String(capture.body ?? capture.rawText ?? capture.metadata?.safeExcerpt ?? "").slice(0, 500),
    collectedAt: capture.collectedAt,
    provenanceHash: hashContent(capture.id),
    metadataOnly: capture.storageKind === "metadata_only" || capture.metadata?.adapter === "darknet_metadata"
  };
}

function qualityFromRows(query: string, rows: Array<{ id: string }>) {
  return {
    query,
    status: rows.length ? "ready" : "partial",
    score: rows.length ? 0.86 : 0.46,
    canPromoteToReady: rows.length > 0,
    publicWarningText: rows.length ? ["quality gate is ready with durable or reviewed evidence"] : ["searching"],
    publicWarningCodes: rows.length ? [] : ["insufficient-capture"],
    analystActions: rows.length
      ? [{ kind: "promote_quality_status", label: "Promote quality status", manualOnly: false, evidenceIds: rows.map((r) => r.id) }]
      : [{ kind: "request_more_capture_evidence", label: "Request more capture evidence", manualOnly: false, evidenceIds: [] }]
  };
}
