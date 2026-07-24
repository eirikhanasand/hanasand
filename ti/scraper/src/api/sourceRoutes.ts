import { json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import type { SourceRecord } from "../types.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";
import { sanitizeDwmApiPayload } from "../product/dwmCustomerDisplay.ts";
import { inTenantScope, resolveTenantScope } from "./tenantScope.ts";
import { authenticateRequest } from "./requestAuthentication.ts";
import { validateSource } from "../registry/sourceRegistry.ts";

export function listSources(request: Request, options: ApiServerOptions): Response {
  const url = new URL(request.url);
  const scope = resolveTenantScope(request, url);
  if (scope.error) return scope.error;
  const records = options.store.listSources().filter((source) => inTenantScope(source, scope.tenantId)).map(toSafeSourceDto);
  const result = paginated(records, url);
  return json({ sources: result.records, total: records.length, nextCursor: result.nextCursor });
}

export function sourceAtlas(request: Request, options: ApiServerOptions): Response {
  const url = new URL(request.url);
  const scope = resolveTenantScope(request, url);
  if (scope.error) return scope.error;
  const records = options.store.listSources().filter((source) => inTenantScope(source, scope.tenantId)).map(toSafeSourceDto);
  const result = paginated(records, url);
  return json({ records: result.records, nextCursor: result.nextCursor, summary: { total: records.length } });
}

export async function createSource(request: Request, options: ApiServerOptions): Promise<Response> {
  const access = await sourceAdminAccess(request, options);
  if (access) return access;
  const input = await readJson<Partial<SourceRecord>>(request);
  const scope = resolveTenantScope(request, new URL(request.url), input.tenantId);
  if (scope.error) return scope.error;
  const source = { id: input.id ?? stableId("source", input.url ?? input.name ?? nowIso()), tenantId: scope.tenantId, name: input.name ?? input.url ?? "source", type: input.type ?? "rss", url: input.url ?? "", accessMethod: input.accessMethod ?? "public_http", status: input.status ?? "active", risk: input.risk ?? "low", trustScore: input.trustScore ?? 0.5, language: input.language ?? "en", crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600, legalNotes: input.legalNotes ?? "public source", createdAt: nowIso(), updatedAt: nowIso(), metadata: input.metadata ?? {} } as SourceRecord;
  const invalid = invalidSource(source);
  if (invalid) return invalid;
  options.store.saveSource(source);
  return json({ source: toSafeSourceDto(source) }, 201);
}

export async function updateSource(request: Request, options: ApiServerOptions, sourceId: string | undefined): Promise<Response> {
  const access = await sourceAdminAccess(request, options);
  if (access) return access;
  const source = options.store.getSource?.(sourceId ?? "");
  if (!source) return json({ error: { code: "not_found", message: "Source not found" } }, 404);
  const patch = await readJson<Partial<SourceRecord>>(request);
  const scope = resolveTenantScope(request, new URL(request.url), patch.tenantId);
  if (scope.error) return scope.error;
  if (!inTenantScope(source, scope.tenantId)) return json({ error: { code: "not_found", message: "Source not found" } }, 404);
  const updated = { ...source, ...patch, id: source.id, tenantId: source.tenantId, trustScore: patch.trustScore === undefined ? source.trustScore : Math.max(0, Math.min(1, patch.trustScore)), updatedAt: nowIso() };
  const invalid = invalidSource(updated);
  if (invalid) return invalid;
  options.store.saveSource(updated);
  return json({ source: toSafeSourceDto(updated) });
}

async function sourceAdminAccess(request: Request, options: ApiServerOptions): Promise<Response | undefined> {
  const authentication = await authenticateRequest(request, options);
  if (authentication.error) return authentication.error;
  if (!authentication.identity!.roles.some((role) => ["owner", "admin", "source_admin", "source_operator"].includes(role))) {
    return json({ error: { code: "source_admin_forbidden", message: "Source changes require a source administrator role" } }, 403);
  }
}

function invalidSource(source: SourceRecord): Response | undefined {
  try {
    validateSource(source);
  } catch (cause) {
    return json({ error: { code: "invalid_source", message: cause instanceof Error ? cause.message : "Source validation failed" } }, 400);
  }
}

export function toSafeSourceDto(source: SourceRecord) {
  const url = safeSourceUrl(source);
  return sanitizeDwmApiPayload({
    id: source.id,
    tenantId: source.tenantId,
    name: source.name,
    type: source.type,
    status: source.status,
    risk: source.risk,
    trustScore: source.trustScore,
    language: source.language,
    tags: source.tags ?? [],
    url,
    urlHash: hashContent(String(source.url ?? source.id)),
    locatorRedacted: !url,
    operatingMode: {
      accessMethod: restrictedSource(source) ? "metadata_only_proxy" : source.accessMethod,
      metadataOnly: Boolean(source.governance?.metadataOnly || source.metadata?.captureMode === "metadata_only"),
      approvalState: source.governance?.approvalState ?? (source.approvedAt ? "approved" : "not_recorded"),
      policyVersion: source.governance?.policyVersion
    },
    publisher: source.catalog?.publisher ? {
      name: source.catalog.publisher.name,
      country: source.catalog.publisher.country,
      homepage: safeHttpUrl(source.catalog.publisher.homepage),
      trustBasis: source.catalog.publisher.trustBasis
    } : undefined,
    coverage: source.catalog?.coverage,
    collection: {
      cadenceSeconds: source.crawlFrequencySeconds,
      freshnessTargetSeconds: source.catalog?.collection?.freshnessTargetSeconds,
      lastSeenAt: source.lastSeenAt,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt
    }
  });
}

function restrictedSource(source: SourceRecord): boolean {
  return Boolean(source.governance?.metadataOnly || source.metadata?.captureMode === "metadata_only" || String(source.type).endsWith("_metadata") || /(?:\.onion|\.i2p)(?:\/|$)/i.test(String(source.url ?? "")));
}

function safeSourceUrl(source: SourceRecord): string | undefined {
  return restrictedSource(source) ? undefined : safeHttpUrl(source.url);
}

function safeHttpUrl(value: unknown): string | undefined {
  try {
    const url = new URL(String(value ?? ""));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /(?:\.onion|\.i2p)$/i.test(url.hostname)) return undefined;
    if ([...url.searchParams.keys()].some((key) => /(?:token|secret|password|authorization|cookie|api[_-]?key|signature)/i.test(key))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function paginated<T>(records: T[], url: URL) {
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? url.searchParams.get("recordLimit") ?? 50) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("cursor") ?? 0) || 0);
  return { records: records.slice(offset, offset + limit), nextCursor: offset + limit < records.length ? String(offset + limit) : undefined };
}
