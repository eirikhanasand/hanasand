import { buildTimelinessWorkbench, mergePublicReportReference, type ReportRole, type TimelinessQueueStatus } from "../pipeline/timelinessGroundTruth.ts";
import { authenticateRequest } from "./requestAuthentication.ts";
import { error, json, numberQuery, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { inTenantScope, resolveTenantScope } from "./tenantScope.ts";

type JsonObject = Record<string, unknown>;
type TimelinessStore = {
  getCapture(id: string): JsonObject | undefined;
  getIncident(id: string): JsonObject | undefined;
  getTimelinessRecord(id: string): JsonObject | undefined;
  listCaptures(): JsonObject[];
  listExtractedEntities(): JsonObject[];
  listIncidents(): JsonObject[];
  listSources(): JsonObject[];
  listTimelinessRecords(): JsonObject[];
  saveTimelinessRecord(record: JsonObject): JsonObject;
};

const WORKBENCH = "/v1/intel/timeliness/workbench";
const REFERENCES = "/v1/intel/timeliness/references";
const ROLES = new Set(["owner", "admin", "administrator", "system_admin", "analyst"]);
const STATUSES = new Set<TimelinessQueueStatus>(["unresolved_reference", "anomaly", "awaiting_alert", "awaiting_delivery", "complete"]);

export async function handleTimelinessRequest(request: Request, options: ApiServerOptions): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (url.pathname !== WORKBENCH && url.pathname !== REFERENCES) return undefined;
  const authentication = await authenticateRequest(request, options);
  if (authentication.error) return authentication.error;
  if (!authentication.identity?.roles.some((role) => ROLES.has(role))) return error("timeliness_forbidden", "Timeliness operations require an analyst role", 403);
  if (url.pathname === WORKBENCH && request.method === "GET") return workbench(request, url, options);
  if (url.pathname === REFERENCES && request.method === "POST") return addReference(request, url, options, authentication.identity.id);
  return error("timeliness_method_not_allowed", "Use GET for the workbench or POST for report references", 405);
}

function workbench(request: Request, url: URL, options: ApiServerOptions): Response {
  const scope = resolveTenantScope(request, url);
  if (scope.error) return scope.error;
  const store = options.store as unknown as TimelinessStore;
  const records = store.listTimelinessRecords().filter((record) => inTenantScope(record, scope.tenantId));
  const context = {
    sources: store.listSources().filter((record) => inTenantScope(record, scope.tenantId)),
    incidents: store.listIncidents().filter((record) => inTenantScope(record, scope.tenantId)),
    captures: store.listCaptures().filter((record) => inTenantScope(record, scope.tenantId)),
    entities: store.listExtractedEntities().filter((record) => inTenantScope(record, scope.tenantId)),
  };
  const snapshot = buildTimelinessWorkbench(records, context);
  const requestedStatus = url.searchParams.get("status") as TimelinessQueueStatus | null;
  if (requestedStatus && !STATUSES.has(requestedStatus)) return error("invalid_timeliness_status", "Unsupported timeliness queue status", 400);
  const query = url.searchParams.get("q")?.trim().toLowerCase();
  const limit = Math.floor(Math.min(200, Math.max(1, numberQuery(url.searchParams.get("limit")) ?? 100)));
  const offset = Math.floor(Math.max(0, numberQuery(url.searchParams.get("cursor")) ?? 0));
  const filtered = snapshot.items.filter((item) => (!requestedStatus || item.status === requestedStatus)
    && (!query || JSON.stringify([item.actorName, item.title, item.sourceName, item.incidentId, item.timestampAnomalies]).toLowerCase().includes(query)));
  return json({
    ...snapshot,
    items: filtered.slice(offset, offset + limit),
    page: { total: filtered.length, limit, cursor: offset, nextCursor: offset + limit < filtered.length ? String(offset + limit) : null },
  });
}

async function addReference(request: Request, url: URL, options: ApiServerOptions, recordedBy: string): Promise<Response> {
  const body = await readJson<JsonObject>(request);
  const scope = resolveTenantScope(request, url, body.tenantId);
  if (scope.error) return scope.error;
  const store = options.store as unknown as TimelinessStore;
  const recordId = cleanId(body.recordId) ?? cleanId(body.incidentId);
  if (!recordId) return error("timeliness_record_required", "Select a stored timeliness record", 400);
  const current = store.getTimelinessRecord(recordId);
  if (!current || !inTenantScope(current, scope.tenantId)) return error("timeliness_record_not_found", "Timeliness record not found", 404);
  const incidentId = cleanId(current.incidentId);
  const captureId = cleanId(current.captureId);
  const incident = incidentId ? store.getIncident(incidentId) : undefined;
  const capture = captureId ? store.getCapture(captureId) : undefined;
  if (!incidentId || !captureId || !inTenantScope(incident, scope.tenantId) || !inTenantScope(capture, scope.tenantId)) {
    return error("timeliness_evidence_missing", "The retained incident and capture are required before recording first-report evidence", 409);
  }
  const role = String(body.role ?? "") as ReportRole;
  const timestamp = validIso(body.timestamp);
  const referenceUrl = publicReferenceUrl(body.referenceUrl);
  const evidencePath = safeEvidencePath(body.evidencePath);
  const referenceTitle = safeText(body.referenceTitle, 240);
  if (!["actor", "victim", "publisher"].includes(role) || !timestamp || !referenceUrl || !evidencePath) {
    return error("invalid_timeliness_reference", "A role, exact timestamp, public reference URL, and source-field path are required", 400);
  }
  const merged = mergePublicReportReference(current, {
    role,
    timestamp,
    referenceUrl,
    referenceTitle,
    evidencePath,
    recordedBy,
    recordedAt: new Date().toISOString(),
  });
  const saved = merged.created ? store.saveTimelinessRecord(merged.record) : merged.record;
  const snapshot = buildTimelinessWorkbench([saved], {
    sources: store.listSources().filter((record) => inTenantScope(record, scope.tenantId)),
    incidents: store.listIncidents().filter((record) => inTenantScope(record, scope.tenantId)),
    captures: store.listCaptures().filter((record) => inTenantScope(record, scope.tenantId)),
    entities: store.listExtractedEntities().filter((record) => inTenantScope(record, scope.tenantId)),
  });
  return json({ created: merged.created, reference: merged.reference, item: snapshot.items[0] }, merged.created ? 201 : 200);
}

function cleanId(value: unknown): string | undefined {
  const result = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9_.:-]{1,200}$/.test(result) ? result : undefined;
}

function validIso(value: unknown): string | undefined {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

function safeEvidencePath(value: unknown): string | undefined {
  const result = typeof value === "string" ? value.trim() : "";
  return /^[A-Za-z0-9_.$:[\]-]{3,200}$/.test(result) ? result : undefined;
}

function safeText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.replace(/\0/g, "").replace(/\s+/g, " ").trim();
  return result ? result.slice(0, max) : undefined;
}

function publicReferenceUrl(value: unknown): string | undefined {
  try {
    const url = new URL(String(value ?? ""));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.toString().length > 2_048) return undefined;
    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".onion") || host.endsWith(".i2p") || privateHost(host)) return undefined;
    if ([...url.searchParams.keys()].some((key) => /token|secret|password|authorization|cookie|api[_-]?key|signature/i.test(key))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function privateHost(host: string): boolean {
  if (host === "::1" || host.includes(":")) return true;
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || octets[0] >= 224
    || octets[0] === 169 && octets[1] === 254
    || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31
    || octets[0] === 192 && octets[1] === 168;
}
