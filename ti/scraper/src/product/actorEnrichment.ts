import { nowIso, stableId } from "../utils.ts";

export type ActorEnrichmentRun = {
  id: string;
  tenantId?: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  finishedAt: string | null;
  actorCount: number;
  sourceCount: number;
  changedFieldCount: number;
  evidenceCount: number;
  failureCount: number;
  errorCategories: string[];
  error: string | null;
  cursor: number;
  resumeOf: string | null;
  retryOf: string | null;
  createdAt: string;
  updatedAt: string;
};

export function actorEnrichmentRun(input: Partial<ActorEnrichmentRun> & { tenantId?: string; status?: ActorEnrichmentRun["status"] }): ActorEnrichmentRun {
  const startedAt = input.startedAt ?? nowIso();
  return {
    id: input.id ?? stableId("actor_enrichment_run", `${input.tenantId ?? "global"}:${startedAt}:${Math.random()}`),
    tenantId: input.tenantId,
    status: input.status ?? "completed",
    startedAt,
    finishedAt: input.finishedAt ?? startedAt,
    actorCount: Number(input.actorCount ?? 0),
    sourceCount: Number(input.sourceCount ?? 0),
    changedFieldCount: Number(input.changedFieldCount ?? 0),
    evidenceCount: Number(input.evidenceCount ?? 0),
    failureCount: Number(input.failureCount ?? 0),
    errorCategories: [...new Set(input.errorCategories ?? [])],
    error: input.error ?? null,
    cursor: Number(input.cursor ?? 0),
    resumeOf: input.resumeOf ?? null,
    retryOf: input.retryOf ?? null,
    createdAt: input.createdAt ?? startedAt,
    updatedAt: input.updatedAt ?? input.finishedAt ?? startedAt,
  };
}

export function actorEnrichmentRunSummary(run: ActorEnrichmentRun | undefined) {
  return run ? {
    id: run.id,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    actorCount: run.actorCount,
    sourceCount: run.sourceCount,
    changedFieldCount: run.changedFieldCount,
    evidenceCount: run.evidenceCount,
    failureCount: run.failureCount,
    errorCategories: run.errorCategories,
    error: run.error,
    cursor: run.cursor,
    resumeOf: run.resumeOf,
    retryOf: run.retryOf,
  } : null;
}

export function actorProfileTimeline(record: any) {
  const metadata = record?.metadata && typeof record.metadata === "object" ? record.metadata : {};
  const characterization = metadata.characterization && typeof metadata.characterization === "object" ? metadata.characterization : {};
  const changes = Array.isArray(metadata.changes) ? metadata.changes : [];
  const changedFields = [
    ...changes.map((change: any) => String(change.field ?? "")).filter(Boolean),
    ...Object.keys(characterization),
    ...(Array.isArray(metadata.aliasesAdded) ? metadata.aliasesAdded.map((alias: unknown) => `alias: ${String(alias)}`) : []),
  ];
  const previousValues = Object.fromEntries(changes.filter((change: any) => change.field).map((change: any) => [change.field, change.previousValue]));
  const newValues = Object.fromEntries(changes.filter((change: any) => change.field).map((change: any) => [change.field, change.newValue]));
  return {
    id: String(record.id),
    actorId: String(record.subjectId),
    observedAt: String(record.observedAt),
    changedFields: [...new Set(changedFields)],
    previousValues: record.previousValues ?? previousValues,
    newValues: record.newValues ?? (Object.keys(newValues).length ? newValues : characterization),
    sourceId: record.sourceId ?? null,
    captureIds: Array.isArray(record.captureIds) ? record.captureIds : [],
    evidenceCount: Array.isArray(record.captureIds) ? record.captureIds.length : 0,
    extractionMethod: record.extractionMethod ?? metadata.extractionMethod ?? "extracted",
    confidence: record.confidence ?? null,
    kind: record.kind ?? "updated",
  };
}
