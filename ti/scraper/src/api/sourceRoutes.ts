import { handleSourceApplyPlanRoute } from "./sourceApplyPlanRoute.ts";
import { json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import type { SourceRecord } from "../types.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";
import { sanitizeDwmApiPayload } from "../product/dwmCustomerDisplay.ts";
import { inTenantScope, resolveTenantScope } from "./tenantScope.ts";

export async function sourceApplyPlan(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson(request);
  const scope = resolveTenantScope(request, new URL(request.url), body.tenantId);
  if (scope.error) return scope.error;
  const result = handleSourceApplyPlanRoute({ request: { ...body, tenantId: scope.tenantId }, sources: options.store.listSources().filter((source) => inTenantScope(source, scope.tenantId)), sourcePacks: starterPacks(body.sourcePackIds) });
  return json(result.body, result.status);
}

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
  const input = await readJson<Partial<SourceRecord>>(request);
  const scope = resolveTenantScope(request, new URL(request.url), input.tenantId);
  if (scope.error) return scope.error;
  const source = { id: input.id ?? stableId("source", input.url ?? input.name ?? nowIso()), tenantId: scope.tenantId, name: input.name ?? input.url ?? "source", type: input.type ?? "rss", url: input.url ?? "", accessMethod: input.accessMethod ?? "public_http", status: input.status ?? "active", risk: input.risk ?? "low", trustScore: input.trustScore ?? 0.5, language: input.language ?? "en", crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600, legalNotes: input.legalNotes ?? "public source", createdAt: nowIso(), updatedAt: nowIso(), metadata: input.metadata ?? {} } as SourceRecord;
  options.store.saveSource(source);
  return json({ source: toSafeSourceDto(source) }, 201);
}

export async function updateSource(request: Request, options: ApiServerOptions, sourceId: string | undefined): Promise<Response> {
  const source = options.store.getSource?.(sourceId ?? "");
  if (!source) return json({ error: { code: "not_found", message: "Source not found" } }, 404);
  const patch = await readJson<Partial<SourceRecord>>(request);
  const scope = resolveTenantScope(request, new URL(request.url), patch.tenantId);
  if (scope.error) return scope.error;
  if (!inTenantScope(source, scope.tenantId)) return json({ error: { code: "not_found", message: "Source not found" } }, 404);
  const updated = { ...source, ...patch, id: source.id, tenantId: source.tenantId, trustScore: patch.trustScore === undefined ? source.trustScore : Math.max(0, Math.min(1, patch.trustScore)), updatedAt: nowIso() };
  options.store.saveSource(updated);
  return json({ source: toSafeSourceDto(updated) });
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

function starterPacks(ids: unknown) {
  const names = Array.isArray(ids) ? ids.map(String) : [];
  if (!names.includes("safe-public-cti-starter-pack")) return [];
  return [{ version: 1, name: "safe-public-cti-starter-pack", sources: [starterSource()] }];
}

function starterSource() {
  return { id: "src_safe_public_cti_starter_feed", name: "Safe Public CTI Starter Feed", type: "rss", url: "https://starter.example.test/cti/rss.xml", accessMethod: "public_http", status: "candidate", risk: "low", trustScore: 0.72, crawlFrequencySeconds: 3600, legalNotes: "Public security RSS metadata collection basis.", catalog: { approvalScope: "safe_public_auto", adapterCompatibility: ["rss"], collection: { freshnessTargetSeconds: 3600 } } };
}
