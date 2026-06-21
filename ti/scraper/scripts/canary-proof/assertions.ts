import { array, number, record } from "./types.ts";
import type { JsonObject } from "./types.ts";

export function assertRun(payload: JsonObject): void {
  const run = record(payload.canaryRun);
  if (run.mode !== "production_canary") throw new Error("canary run did not use production_canary mode");
  if (run.activationApplied !== false) throw new Error("canary run unexpectedly activated sources");
  if (number(run.completedTaskCount) < 5) throw new Error("canary run did not complete the expected bounded task set");
  if (number(run.insertedCaptureCount) < 5) throw new Error("canary run did not persist fresh captures");
  if (number(run.incidentCount) < 2) throw new Error("canary run did not promote extraction evidence");
}

export function assertSecondRun(payload: JsonObject): void {
  const run = record(payload.canaryRun);
  if (run.activationApplied !== false) throw new Error("second canary run unexpectedly activated sources");
  if (number(run.completedTaskCount) < 1) throw new Error("second canary cycle did not collect a due portfolio source");
  if (number(run.insertedCaptureCount) < 1) throw new Error("second canary cycle did not persist a fresh capture");
}

export function assertReadiness(payload: JsonObject): void {
  const readiness = record(payload.readiness);
  if (readiness.schemaVersion !== "ti.public_canary_readiness.v1") throw new Error("missing canary readiness schema");
  if (readiness.decision !== "promote") throw new Error(`expected canary readiness promote, got ${String(readiness.decision)}`);
  const evidence = record(readiness.evidence);
  if (number(evidence.activeSourceCount) < 8) throw new Error("too few active canary sources");
  if (number(evidence.externalObjectCaptureCount) < 5) throw new Error("captures did not cross the object evidence boundary");
  if (number(evidence.missingObjectReferenceCount) !== 0) throw new Error("external object references are missing");
  if (number(evidence.injectedProofFetchCaptureCount) < 5) throw new Error("local canary proof did not preserve injected fetch provenance counts");
  for (const query of ["APT42", "Turla"]) {
    const row = array(readiness.queryReadiness).map(record).find((item) => item.query === query);
    if (!row?.readyForPublicAnswer) throw new Error(`${query} is not ready for public answer promotion`);
  }
  const controls = record(readiness.controls);
  if (controls.activationRequiresHumanApproval !== true || controls.continuousLoopAutoActivation !== false || controls.restrictedSourcesExcluded !== true || controls.liveFetchProvenanceAvailable !== true) {
    throw new Error("canary readiness controls are not fail-closed");
  }
}

export function assertProductionReadiness(payload: JsonObject): void {
  const readiness = record(payload.readiness);
  if (readiness.decision !== "hold") throw new Error(`expected production readiness hold without native live HTTP, got ${String(readiness.decision)}`);
  const controls = record(readiness.controls);
  if (controls.nativeLiveHttpRequired !== true) throw new Error("production readiness did not enforce native live HTTP");
  if (!array(readiness.blockers).includes("no native live HTTP canary captures are available for production readiness")) {
    throw new Error("production readiness did not explain missing native live HTTP evidence");
  }
}

export function assertSoak(payload: JsonObject): void {
  const soak = record(payload.soak);
  if (soak.schemaVersion !== "ti.public_canary_soak.v1") throw new Error("missing canary soak schema");
  if (soak.decision !== "promote") throw new Error(`expected canary soak promote, got ${String(soak.decision)}`);
  const metrics = record(soak.metrics);
  if (number(metrics.cycleCount) < 2) throw new Error("canary soak did not record repeated cycles");
  if (number(metrics.externalObjectCaptureCount) < 6) throw new Error("canary soak did not preserve object-boundary captures");
  if (number(metrics.injectedProofFetchCaptureCount) < 6) throw new Error("canary soak did not preserve fetch provenance counts");
  if (number(metrics.totalIncidentCount) < 3) throw new Error("canary soak did not preserve extraction promotion yield");
  const controls = record(soak.controls);
  if (controls.canaryPortfolioOnly !== true || controls.continuousLoopAutoActivation !== false || controls.restrictedSourcesExcluded !== true || controls.fetchProvenanceRequired !== true) {
    throw new Error("canary soak controls are not fail-closed");
  }
}

export function assertProductionSoak(payload: JsonObject): void {
  const soak = record(payload.soak);
  if (soak.decision !== "hold") throw new Error(`expected production soak hold without native live HTTP, got ${String(soak.decision)}`);
  const controls = record(soak.controls);
  if (controls.nativeLiveHttpRequired !== true) throw new Error("production soak did not enforce native live HTTP");
  if (!array(soak.blockers).includes("no native live HTTP canary captures are available in the soak window")) {
    throw new Error("production soak did not explain missing native live HTTP evidence");
  }
}

export function assertOperator(payload: JsonObject): void {
  const runtime = record(record(payload.operatorView).runtime);
  if (runtime.schemaVersion !== "ti.public_canary_loop_runtime.v1") throw new Error("missing canary runtime schema");
  if (runtime.supervisorAttached !== true) throw new Error("canary runtime supervisor is not attached");
  if (runtime.enabled !== false) throw new Error("local proof runtime should stay disabled and explicit");
  if (runtime.activateSources !== false) throw new Error("canary runtime unexpectedly allows implicit activation");
  if (number(runtime.intervalSeconds) !== 300 || number(runtime.queueLimit) !== 500) throw new Error("canary runtime limits drifted");
  const controls = record(runtime.controls);
  if (controls.canaryPortfolioOnly !== true || controls.activationRequiresHumanApproval !== true || controls.continuousLoopAutoActivation !== false || controls.dedupeBeforeWrite !== true || controls.retriesBounded !== true || controls.restrictedSourcesExcluded !== true) {
    throw new Error("canary runtime controls are not fail-closed");
  }
  if (record(record(payload.operatorView).evidenceStorage).productionEvidenceMode !== "injected_proof_only") {
    throw new Error("expected injected proof evidence mode in local canary proof");
  }
}

export function assertPublicAnswer(query: string, payload: JsonObject): void {
  if (JSON.stringify(record(payload.publicTiAnswer)).includes("Searching")) throw new Error(`${query} public answer is still only searching`);
  const counts = record(record(record(payload.actorProfile).datasets).evidenceStageCounts);
  if (number(counts.captured_page) <= 0) throw new Error(`${query} public answer is not backed by captured-page evidence`);
}

export function assertNoLeak(payload: JsonObject): void {
  const serialized = JSON.stringify(payload).toLowerCase();
  for (const forbidden of ["public-canary-evidence/", "password=", "authorization:", "set-cookie", "cookie="]) {
    if (serialized.includes(forbidden)) throw new Error(`unsafe canary proof output leaked ${forbidden}`);
  }
}
