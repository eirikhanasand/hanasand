// @ts-nocheck
export const STAGES = ["discovery", "captured", "extracted", "reviewed", "promoted"];
export const PRIORITY = { promoted: 100, contradicted: 95, downgraded: 90, added: 70, updated: 45, stale: 20 };

export function relationshipStixEligibility(relationship) {
  const stage = stageOf(relationship);
  const promoted = relationship.properties?.promoted === true || stage === "promoted";
  const accepted = reviewState(relationship) === "accepted";
  return {
    discoveryOnly: stage === "discovery" && !promoted,
    captureBacked: idx(stage) >= idx("captured") || promoted,
    extracted: idx(stage) >= idx("extracted") || promoted,
    reviewed: idx(stage) >= idx("reviewed") || promoted,
    promoted,
    accepted,
    includedByDefault: accepted || promoted
  };
}

export function reviewState(rel) {
  return rel.properties?.reviewState ?? (rel.properties?.contradicted ? "contradicted" : stageOf(rel) === "promoted" ? "accepted" : stageOf(rel) === "discovery" ? "needs_review" : "unreviewed");
}

export function stageOf(rel) {
  const stage = rel.properties?.stage ?? "discovery";
  return STAGES.includes(stage) ? stage : "discovery";
}

export function sourceIds(rel) {
  return uniq(rel.sourceIds ?? rel.provenance?.map((p) => p.sourceId) ?? []);
}

export function compareDeltas(a, b) {
  return (PRIORITY[b.kind] ?? 0) - (PRIORITY[a.kind] ?? 0) || b.relationship.confidence - a.relationship.confidence || a.relationship.id.localeCompare(b.relationship.id);
}

export function reviewReasons(delta, stage) {
  return uniq([delta.kind === "contradicted" ? "contradicted evidence" : "", delta.kind === "stale" ? "stale relationship" : "", stage === "discovery" ? "discovery-only evidence" : "", delta.relationship.confidence < 0.5 ? "low confidence" : ""]);
}

export function actionAvailability(rel) {
  const state = reviewState(rel);
  return { accept: state !== "accepted", reject: state !== "rejected", supersede: true, resolveContradiction: rel.properties?.contradicted === true };
}

export function idx(stage) {
  return STAGES.indexOf(stage);
}

export function highest(stages) {
  return stages.sort((a, b) => idx(b) - idx(a))[0] ?? "discovery";
}

export function uniq(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}
