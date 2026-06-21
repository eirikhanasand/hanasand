import { handleSourceApplyPlanRoute } from "./sourceApplyPlanRoute.ts";
import { json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import type { SourceRecord } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";

export async function sourceApplyPlan(request: Request, options: ApiServerOptions): Promise<Response> {
  const body = await readJson(request);
  const tenantId = body.tenantId ?? request.headers.get("x-tenant-id") ?? undefined;
  const result = handleSourceApplyPlanRoute({ request: { ...body, tenantId }, sources: options.store.listSources(), sourcePacks: starterPacks(body.sourcePackIds) });
  return json(result.body, result.status);
}

export async function createSource(request: Request, options: ApiServerOptions): Promise<Response> {
  const input = await readJson<Partial<SourceRecord>>(request);
  const source = { id: input.id ?? stableId("source", input.url ?? input.name ?? nowIso()), name: input.name ?? input.url ?? "source", type: input.type ?? "rss", url: input.url ?? "", accessMethod: input.accessMethod ?? "public_http", status: input.status ?? "active", trustScore: input.trustScore ?? 0.5, language: input.language ?? "en", legalNotes: input.legalNotes ?? "public source", createdAt: nowIso(), updatedAt: nowIso(), metadata: input.metadata ?? {} } as SourceRecord;
  options.store.saveSource(source);
  return json({ source }, 201);
}

export async function updateSource(request: Request, options: ApiServerOptions, sourceId: string | undefined): Promise<Response> {
  const source = options.store.getSource?.(sourceId ?? "");
  if (!source) return json({ error: { code: "not_found", message: "Source not found" } }, 404);
  const patch = await readJson<Partial<SourceRecord>>(request);
  const updated = { ...source, ...patch, updatedAt: nowIso() };
  options.store.saveSource(updated);
  return json({ source: updated });
}

function starterPacks(ids: unknown) {
  const names = Array.isArray(ids) ? ids.map(String) : [];
  if (!names.includes("safe-public-cti-starter-pack")) return [];
  return [{ version: 1, name: "safe-public-cti-starter-pack", sources: [starterSource()] }];
}

function starterSource() {
  return { id: "src_safe_public_cti_starter_feed", name: "Safe Public CTI Starter Feed", type: "rss", url: "https://starter.example.test/cti/rss.xml", accessMethod: "public_http", status: "candidate", risk: "low", trustScore: 0.72, crawlFrequencySeconds: 3600, legalNotes: "Public security RSS metadata collection basis.", catalog: { approvalScope: "safe_public_auto", adapterCompatibility: ["rss"], collection: { freshnessTargetSeconds: 3600 } } };
}
