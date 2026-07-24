import { nowIso } from "../utils.ts";

export function buildPublicAdvisoryCorrelation(input: any): any {
  const deltas = input.deltas ?? input.publicSignalDeltas ?? [];
  const grouped = new Map<string, any[]>();
  for (const delta of deltas) for (const actor of delta.matchedEntities?.actors ?? []) grouped.set(actor, [...(grouped.get(actor) ?? []), delta]);
  return { generatedAt: input.generatedAt ?? nowIso(), status: "needs_review", actors: [...grouped.entries()].map(([actor, rows]) => ({ actor, supportCount: rows.length, sources: [...new Set(rows.map((row) => row.sourceId))] })), conflicts: [] };
}

export const buildPublicConflictContradictionResolver = (input: any): any => ({ generatedAt: input.generatedAt ?? nowIso(), rows: (input.deltas ?? []).filter((delta: any) => delta.confidence < 0.45).map((delta: any) => ({ deltaId: delta.id, action: "hold_low_confidence", releaseGate: "hold" })) });
export const buildPublicSignalValueImpact = (input: any): any => ({ generatedAt: input.generatedAt ?? nowIso(), sellableRows: (input.publicSignalDeltas ?? []).length, valueLift: (input.publicSignalDeltas ?? []).filter((row: any) => row.confidence >= 0.6).length, reason: "fresh public signals add actor/victim/TTP pivots" });
export const buildPublicCoverageFreshnessValue = (input: any): any => ({ generatedAt: input.generatedAt ?? nowIso(), freshRows: (input.publicSignalDeltas ?? []).filter((row: any) => !row.publishedAt || Date.parse(row.publishedAt) > Date.now() - 7 * 86400_000).length, totalRows: (input.publicSignalDeltas ?? []).length });

export function buildPublicSignalLiveCollectionLoopDto(input: any): any {
  const sources = input.sources ?? [];
  return { query: input.query, generatedAt: input.generatedAt ?? nowIso(), nextTasks: sources.slice(0, 20).map((source: any) => ({ sourceId: source.sourceId ?? source.id, action: "collect_public_metadata", priority: source.score >= 0.7 ? "high" : "normal" })) };
}
