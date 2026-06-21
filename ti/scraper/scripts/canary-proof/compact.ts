import { array, record } from "./types.ts";
import type { JsonObject } from "./types.ts";

export function compactRun(payload: JsonObject): JsonObject {
  const run = record(payload.canaryRun);
  return {
    runId: run.runId,
    activationApplied: run.activationApplied,
    completedTaskCount: run.completedTaskCount,
    insertedCaptureCount: run.insertedCaptureCount,
    incidentCount: run.incidentCount
  };
}

export function compactReadiness(payload: JsonObject): JsonObject {
  const readiness = record(payload.readiness);
  const evidence = record(readiness.evidence);
  return {
    decision: readiness.decision,
    activeSourceCount: evidence.activeSourceCount,
    externalObjectCaptureCount: evidence.externalObjectCaptureCount,
    promotionYield: evidence.promotionYield,
    queryReadiness: readiness.queryReadiness
  };
}

export function compactSoak(payload: JsonObject): JsonObject {
  const soak = record(payload.soak);
  return {
    decision: soak.decision,
    metrics: soak.metrics,
    cycleCount: array(soak.cycles).length
  };
}

export function compactProductionGate(payload: JsonObject, key: "readiness" | "soak"): JsonObject {
  const value = record(payload[key]);
  return {
    decision: value.decision,
    blockers: value.blockers,
    controls: value.controls
  };
}

export function compactRuntime(payload: JsonObject): JsonObject {
  const runtime = record(record(payload.operatorView).runtime);
  return {
    supervisorAttached: runtime.supervisorAttached,
    enabled: runtime.enabled,
    intervalSeconds: runtime.intervalSeconds,
    queueLimit: runtime.queueLimit,
    activateSources: runtime.activateSources,
    controls: runtime.controls
  };
}

export function compactAnswer(query: string, payload: JsonObject): JsonObject {
  return {
    query,
    status: payload.status,
    runId: payload.runId,
    capturedPageCount: record(record(record(payload.actorProfile).datasets).evidenceStageCounts).captured_page
  };
}
