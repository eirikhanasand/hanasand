import { randomUUID } from "node:crypto";
import { sanitizeDwmCustomerText } from "../product/dwmCustomerDisplay.ts";
import { hashContent, nowIso, stableId } from "../utils.ts";
import { authenticateOperatorRequest } from "./requestAuthentication.ts";
import { error, json, readJson } from "./http.ts";
import type { ApiServerOptions } from "./serverTypes.ts";
import { inTenantScope, resolveTenantScope } from "./tenantScope.ts";

const BASE = "/v1/intel/evaluation/benchmarks";
const LABEL_TYPES = ["actor", "ransomware", "victim", "cve", "malware", "ttp", "country", "sector", "impact", "dataset"] as const;
const LABEL_TYPE_SET = new Set<string>(LABEL_TYPES);

export async function handleEvaluationBenchmarkRequest(request: Request, options: ApiServerOptions): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(BASE)) return undefined;
  const authentication = await authenticateOperatorRequest(request, options);
  if (authentication.error) return authentication.error;
  if (!authentication.identity) return error("authentication_required", "A valid analyst or service session is required", 401);
  const service = authentication.identity.roles.includes("service");
  if (service && !(url.pathname === BASE && request.method === "POST")) return error("analyst_forbidden", "Automated identities may create benchmark manifests but cannot review them", 403);
  if (!service && !authentication.identity.roles.some((role) => ["admin", "administrator", "system_admin", "analyst"].includes(role))) return error("analyst_forbidden", "Evaluation benchmarks require an analyst role", 403);
  const actor = authentication.identity;

  if (url.pathname === BASE && request.method === "GET") {
    const scope = resolveTenantScope(request, url);
    if (scope.error) return scope.error;
    const benchmarks = records(options.store, "listEvaluationBenchmarks").filter((row) => inTenantScope(row, scope.tenantId));
    return json({ benchmarks: benchmarks.map((benchmark) => benchmarkSummary(options.store, benchmark)), total: benchmarks.length });
  }
  if (url.pathname === BASE && request.method === "POST") return createBenchmark(request, options, actor);

  const tasksMatch = url.pathname.match(/^\/v1\/intel\/evaluation\/benchmarks\/([^/]+)\/tasks$/);
  if (tasksMatch && request.method === "GET") return listTasks(request, options, tasksMatch[1], actor.id);
  const annotationsMatch = url.pathname.match(/^\/v1\/intel\/evaluation\/benchmarks\/([^/]+)\/annotations$/);
  if (annotationsMatch && request.method === "POST") return createAnnotation(request, options, annotationsMatch[1], actor.id);
  const adjudicationMatch = url.pathname.match(/^\/v1\/intel\/evaluation\/benchmarks\/([^/]+)\/tasks\/([^/]+)\/adjudicate$/);
  if (adjudicationMatch && request.method === "POST") return adjudicateTask(request, options, adjudicationMatch[1], adjudicationMatch[2], actor.id);
  return error("evaluation_route_not_found", "Evaluation benchmark route not found", 404);
}

async function createBenchmark(request: Request, options: ApiServerOptions, actor: { id: string }) {
  const body = await readJson<any>(request);
  const scope = resolveTenantScope(request, new URL(request.url), body.tenantId);
  if (scope.error) return scope.error;
  const labelTypes: string[] = unique((Array.isArray(body.labelTypes) ? body.labelTypes : LABEL_TYPES).map(String).map((value) => value.trim().toLowerCase()));
  if (!labelTypes.length || labelTypes.some((value) => !LABEL_TYPE_SET.has(value))) return error("invalid_benchmark_label_types", `Use ${LABEL_TYPES.join(", ")} label types`, 400);
  const sampleSize = Math.max(1, Math.min(200, Math.floor(Number(body.sampleSize) || 100)));
  const requiredReviewers = Math.max(2, Math.min(3, Math.floor(Number(body.requiredReviewers) || 2)));
  const datasetSplit = ["validation", "test"].includes(body.datasetSplit) ? body.datasetSplit : "test";
  const createdAt = nowIso();
  const seed = hashContent(randomUUID());
  const sources = records(options.store, "listSources").filter((row) => inTenantScope(row, scope.tenantId));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const eligible = records(options.store, "listCaptures")
    .filter((capture) => inTenantScope(capture, scope.tenantId) && sourceById.has(capture.sourceId) && Boolean(blindExcerpt(capture)))
    .filter((capture) => !capture.metadata?.fixture && !capture.metadata?.synthetic);
  const selected = balancedSample(eligible, sourceById, sampleSize, seed);
  if (!selected.length) return error("benchmark_corpus_empty", "No safe stored captures are available in this scope", 409);
  const id = stableId("evaluation-benchmark", `${scope.tenantId ?? "global"}:${seed}:${createdAt}`);
  const entities = records(options.store, "listExtractedEntities").filter((entity) => inTenantScope(entity, scope.tenantId));
  const manifest = selected.flatMap((capture) => labelTypes.map((labelType) => {
    const predictions = entities.filter((entity) => entity.captureId === capture.id && entityMatches(labelType, entity.type));
    const observedPredictions = predictionSnapshot(predictions);
    return {
      id: stableId("evaluation-task", `${id}:${capture.id}:${labelType}`), benchmarkId: id, captureId: capture.id, labelType,
      contentHash: capture.contentHash, excerptHash: hashContent(blindExcerpt(capture)), sourceFamily: sourceFamily(sourceById.get(capture.sourceId), capture),
      observedValues: observedPredictions.map((prediction) => prediction.value),
      observedPredictions,
      extractorVersions: unique(predictions.map((entity) => String(entity.extractorVersion ?? "unknown"))).sort()
    };
  }));
  const benchmark = {
    id,
    tenantId: scope.tenantId,
    name: cleanText(body.name, 160) ?? `Independent extraction benchmark ${createdAt.slice(0, 10)}`,
    status: "annotating",
    datasetSplit,
    labelTypes,
    requiredReviewers,
    selectionSeed: seed,
    selectionSeedSource: "server_generated",
    samplingMethod: "stable_hash_balanced_source_family",
    selectionFrameHash: hashContent(eligible.map((capture) => `${capture.id}:${capture.contentHash}:${hashContent(blindExcerpt(capture))}`).sort().join("\n")),
    eligibleCaptureCount: eligible.length,
    captureIds: selected.map((capture) => capture.id),
    taskCount: manifest.length,
    manifest,
    manifestHash: hashContent(JSON.stringify(manifest)),
    protocol: {
      version: "ti.independent_extraction_benchmark.v2", labelSchemaVersion: "ti.extraction_label.v2",
      blinded: true, predictionHiddenUntilSubmission: true, predictionHiddenFromReviewers: true, predictionSnapshotAt: createdAt,
      exhaustiveExpectedValues: true, consensusRequired: true, independentAdjudicatorForDisagreement: true,
      reviewerIndependenceAttestationRequired: true, holdoutLockedAt: createdAt,
      datasetUsage: datasetSplit === "test" ? "locked_final_evaluation" : "model_selection_only", testSplitLocked: datasetSplit === "test"
    },
    createdBy: actor.id,
    createdAt,
    updatedAt: createdAt
  };
  (options.store as any).saveEvaluationBenchmark(benchmark);
  return json({ benchmark: benchmarkSummary(options.store, benchmark) }, 201);
}

async function listTasks(request: Request, options: ApiServerOptions, benchmarkId: string, reviewerId: string) {
  const benchmark = scopedBenchmark(request, options, benchmarkId);
  if (benchmark instanceof Response) return benchmark;
  const annotations = benchmarkAnnotations(options.store, benchmark.id);
  const adjudications = benchmarkAdjudications(options.store, benchmark.id);
  const sourceById = new Map(records(options.store, "listSources").map((source) => [source.id, source]));
  const captureById = new Map(records(options.store, "listCaptures").map((capture) => [capture.id, capture]));
  const tasks = benchmarkTasks(benchmark).map((task) => taskDto(task, captureById.get(task.captureId), sourceById, annotations, adjudications, reviewerId, benchmark.requiredReviewers));
  return json({ benchmark: benchmarkSummary(options.store, benchmark), tasks, total: tasks.length });
}

async function createAnnotation(request: Request, options: ApiServerOptions, benchmarkId: string, reviewerId: string) {
  const body = await readJson<any>(request);
  const benchmark = scopedBenchmark(request, options, benchmarkId, body.tenantId);
  if (benchmark instanceof Response) return benchmark;
  const task = benchmarkTasks(benchmark).find((candidate) => candidate.id === body.taskId);
  if (!task) return error("evaluation_task_not_found", "Evaluation task not found in this benchmark", 404);
  if (benchmarkAdjudications(options.store, benchmark.id).some((row) => row.taskId === task.id)) return error("task_already_adjudicated", "Evaluation task is already adjudicated", 409);
  const expectedValues = annotationValues(body.expectedValues);
  if (!expectedValues) return error("invalid_annotation_values", "expectedValues must be a bounded array of entity values", 400);
  if (body.independenceAttested !== true) return error("reviewer_independence_required", "Confirm that the review was completed independently from extractor development and without prediction access", 400);
  const id = stableId("evaluation-annotation", `${benchmark.id}:${task.id}:${reviewerId}`);
  if ((options.store as any).getEvaluationAnnotation(id)) return error("annotation_already_submitted", "This reviewer already submitted the task", 409);
  const capture = (options.store as any).getCapture(task.captureId);
  if (!capture) return error("evaluation_capture_missing", "The immutable benchmark capture is unavailable", 409);
  if (!taskEvidenceMatches(task, capture)) return error("evaluation_evidence_changed", "The benchmark evidence changed after sampling and cannot be reviewed", 409);
  const annotatedAt = nowIso();
  const annotation = {
    id, tenantId: benchmark.tenantId, benchmarkId: benchmark.id, taskId: task.id, captureId: task.captureId, labelType: task.labelType,
    reviewerId, expectedValues, notes: cleanText(body.notes, 1_000), sourceExcerptHash: task.excerptHash,
    blinded: true, predictionAccessed: false, independenceAttested: true, annotatedAt, createdAt: annotatedAt, updatedAt: annotatedAt
  };
  (options.store as any).saveEvaluationAnnotation(annotation);
  const adjudication = autoAdjudicate(options.store, benchmark, task);
  refreshBenchmark(options.store, benchmark);
  return json({ annotation, taskStatus: adjudication ? "adjudicated" : taskStatus(options.store, benchmark, task), predictionDisclosed: false }, 201);
}

async function adjudicateTask(request: Request, options: ApiServerOptions, benchmarkId: string, taskId: string, reviewerId: string) {
  const body = await readJson<any>(request);
  const benchmark = scopedBenchmark(request, options, benchmarkId, body.tenantId);
  if (benchmark instanceof Response) return benchmark;
  const task = benchmarkTasks(benchmark).find((candidate) => candidate.id === taskId);
  if (!task) return error("evaluation_task_not_found", "Evaluation task not found in this benchmark", 404);
  const annotations = benchmarkAnnotations(options.store, benchmark.id).filter((row) => row.taskId === task.id);
  if (new Set(annotations.map((row) => row.reviewerId)).size < benchmark.requiredReviewers) return error("adjudication_not_ready", `${benchmark.requiredReviewers} independent annotations are required before adjudication`, 409);
  if (annotations.some((row) => row.reviewerId === reviewerId)) return error("adjudicator_not_independent", "A disagreement must be resolved by a reviewer who did not submit either annotation", 409);
  const expectedValues = annotationValues(body.expectedValues);
  if (!expectedValues) return error("invalid_annotation_values", "expectedValues must be a bounded array of entity values", 400);
  if (body.independenceAttested !== true) return error("reviewer_independence_required", "Confirm that adjudication was completed independently from extractor development and without prediction access", 400);
  if ((options.store as any).getEvaluationAdjudication(stableId("evaluation-adjudication", task.id))) return error("task_already_adjudicated", "Evaluation task is already adjudicated", 409);
  const adjudicatedAt = nowIso();
  const adjudication = saveAdjudication(options.store, benchmark, task, expectedValues, reviewerId, annotations.map((row) => row.id), "independent_adjudicator", adjudicatedAt);
  refreshBenchmark(options.store, benchmark);
  return json({ adjudication, predictionDisclosed: false }, 201);
}

function autoAdjudicate(store: any, benchmark: any, task: any) {
  const annotations = benchmarkAnnotations(store, benchmark.id).filter((row) => row.taskId === task.id);
  if (new Set(annotations.map((row) => row.reviewerId)).size < benchmark.requiredReviewers) return undefined;
  const compared = annotations.slice(0, benchmark.requiredReviewers);
  if (!compared.every((row) => canonicalValues(row.expectedValues) === canonicalValues(compared[0].expectedValues))) return undefined;
  const adjudicatedAt = compared.map((row) => row.annotatedAt).sort().at(-1) ?? nowIso();
  return saveAdjudication(store, benchmark, task, compared[0].expectedValues, `consensus:${hashContent(compared.map((row) => row.reviewerId).sort().join("|"))}`, compared.map((row) => row.id), "independent_reviewer_consensus", adjudicatedAt);
}

function saveAdjudication(store: any, benchmark: any, task: any, expectedValues: string[], adjudicatedBy: string, annotationIds: string[], method: string, adjudicatedAt: string) {
  const id = stableId("evaluation-adjudication", task.id);
  const existing = store.getEvaluationAdjudication(id);
  if (existing) return existing;
  const adjudication = { id, tenantId: benchmark.tenantId, benchmarkId: benchmark.id, taskId: task.id, captureId: task.captureId, labelType: task.labelType, expectedValues, annotationIds, method, adjudicatedBy, independenceAttested: true, adjudicatedAt, createdAt: adjudicatedAt, updatedAt: adjudicatedAt };
  store.saveEvaluationAdjudication(adjudication);
  for (const label of labelsForAdjudication(store, benchmark, task, adjudication)) store.saveEvaluationLabel(label);
  return adjudication;
}

function labelsForAdjudication(_store: any, benchmark: any, task: any, adjudication: any) {
  const expected = valueMap(adjudication.expectedValues);
  const observed = valueMap(task.observedValues ?? []);
  const values = unique([...expected.keys(), ...observed.keys()]);
  const units = values.length ? values : ["__none__"];
  return units.map((unit) => {
    const expectedValue = expected.get(unit);
    const observedValue = observed.get(unit);
    const observedPrediction = (task.observedPredictions ?? []).find((prediction: any) => normalize(prediction.value) === unit);
    const outcome = unit === "__none__" ? "true_negative" : expectedValue && observedValue ? "true_positive" : expectedValue ? "false_negative" : "false_positive";
    const evaluationUnitId = `${task.id}:${unit}`;
    return {
      id: stableId("evaluation-label", evaluationUnitId), tenantId: benchmark.tenantId, captureId: task.captureId,
      evaluationUnitId, benchmarkId: benchmark.id, taskId: task.id, annotationIds: adjudication.annotationIds,
      labelType: `${task.labelType}_extraction`, expectedValue: expectedValue ?? null, observedValue: observedValue ?? null, outcome,
      predictionConfidence: observedValue ? normalizedConfidence(observedPrediction?.confidence) ?? null : 0,
      datasetSplit: benchmark.datasetSplit, labeledBy: adjudication.adjudicatedBy, labelingMethod: "manual_source_review",
      parserVersion: task.extractorVersions?.join(",") || "unknown", sourceFamily: task.sourceFamily,
      independentFromExtractor: true, blinded: true, exhaustiveExpectedValues: true, adjudicationStatus: "adjudicated", adjudicationMethod: adjudication.method,
      labeledAt: adjudication.adjudicatedAt, updatedAt: adjudication.adjudicatedAt,
      notes: "Prediction-hidden exhaustive source review; labels materialized only after independent consensus or adjudication."
    };
  });
}

function benchmarkSummary(store: any, benchmark: any) {
  const { manifest: _manifest, ...publicBenchmark } = benchmark;
  const tasks = benchmarkTasks(benchmark);
  const annotations = benchmarkAnnotations(store, benchmark.id);
  const adjudications = benchmarkAdjudications(store, benchmark.id);
  const compared = tasks.map((task) => annotations.filter((row) => row.taskId === task.id).slice(0, benchmark.requiredReviewers)).filter((rows) => rows.length === benchmark.requiredReviewers);
  const agreements = compared.filter((rows) => rows.every((row) => canonicalValues(row.expectedValues) === canonicalValues(rows[0].expectedValues))).length;
  return {
    ...publicBenchmark,
    progress: {
      taskCount: tasks.length, annotationCount: annotations.length, adjudicatedTaskCount: adjudications.length,
      pendingTaskCount: tasks.length - adjudications.length, reviewerCount: new Set(annotations.map((row) => row.reviewerId)).size,
      doubleAnnotatedTaskCount: compared.length, exactSetAgreement: compared.length ? Number((agreements / compared.length).toFixed(3)) : null
    }
  };
}

function refreshBenchmark(store: any, benchmark: any) {
  const complete = benchmarkAdjudications(store, benchmark.id).length === benchmark.taskCount;
  store.saveEvaluationBenchmark({ ...benchmark, status: complete ? "complete" : "annotating", completedAt: complete ? nowIso() : undefined, updatedAt: nowIso() });
}

function scopedBenchmark(request: Request, options: ApiServerOptions, id: string, bodyTenantId?: string): any | Response {
  const scope = resolveTenantScope(request, new URL(request.url), bodyTenantId);
  if (scope.error) return scope.error;
  const benchmark = (options.store as any).getEvaluationBenchmark(id);
  return benchmark && inTenantScope(benchmark, scope.tenantId) ? benchmark : error("evaluation_benchmark_not_found", "Evaluation benchmark not found", 404);
}

function benchmarkTasks(benchmark: any) {
  return benchmark.manifest ?? benchmark.captureIds.flatMap((captureId: string) => benchmark.labelTypes.map((labelType: string) => ({ id: stableId("evaluation-task", `${benchmark.id}:${captureId}:${labelType}`), benchmarkId: benchmark.id, captureId, labelType })));
}

function taskDto(task: any, capture: any, sourceById: Map<string, any>, annotations: any[], adjudications: any[], reviewerId: string, requiredReviewers: number) {
  const source = sourceById.get(capture?.sourceId);
  const taskAnnotations = annotations.filter((row) => row.taskId === task.id);
  const adjudicated = adjudications.some((row) => row.taskId === task.id);
  return {
    id: task.id, benchmarkId: task.benchmarkId, captureId: task.captureId, labelType: task.labelType,
    status: adjudicated ? "adjudicated" : new Set(taskAnnotations.map((row) => row.reviewerId)).size >= requiredReviewers ? "needs_adjudication" : taskAnnotations.length ? "awaiting_second_review" : "pending",
    annotationCount: new Set(taskAnnotations.map((row) => row.reviewerId)).size, submittedByCurrentReviewer: taskAnnotations.some((row) => row.reviewerId === reviewerId),
    evidence: taskEvidenceMatches(task, capture) ? { title: sanitizeDwmCustomerText(capture?.title, "Untitled source evidence", 180), excerpt: blindExcerpt(capture), sourceName: source?.name ?? "Unknown source", sourceFamily: task.sourceFamily ?? sourceFamily(source, capture), publishedAt: capture?.publishedAt, collectedAt: capture?.collectedAt, contentHash: capture?.contentHash } : { unavailable: true, reason: "evidence_changed_after_sampling" },
    protocol: { predictionHidden: true, exhaustiveExpectedValues: true }
  };
}

function taskStatus(store: any, benchmark: any, task: any) {
  if (benchmarkAdjudications(store, benchmark.id).some((row) => row.taskId === task.id)) return "adjudicated";
  const count = new Set(benchmarkAnnotations(store, benchmark.id).filter((row) => row.taskId === task.id).map((row) => row.reviewerId)).size;
  return count >= benchmark.requiredReviewers ? "needs_adjudication" : count ? "awaiting_second_review" : "pending";
}

function balancedSample(captures: any[], sourceById: Map<string, any>, size: number, seed: string) {
  const groups = new Map<string, any[]>();
  for (const capture of captures) {
    const family = sourceFamily(sourceById.get(capture.sourceId), capture);
    groups.set(family, [...(groups.get(family) ?? []), capture]);
  }
  for (const rows of groups.values()) rows.sort((a, b) => hashContent(`${seed}:${a.id}`).localeCompare(hashContent(`${seed}:${b.id}`)));
  const selected: any[] = [], names = [...groups.keys()].sort();
  while (selected.length < Math.min(size, captures.length)) {
    let progressed = false;
    for (const name of names) { const row = groups.get(name)?.shift(); if (row) { selected.push(row); progressed = true; if (selected.length === Math.min(size, captures.length)) break; } }
    if (!progressed) break;
  }
  return selected;
}

function blindExcerpt(capture: any): string {
  const value = capture?.metadata?.safeExcerpt ?? capture?.metadata?.excerpt ?? (!capture?.sensitive && capture?.storageKind !== "metadata_only" ? capture?.body : undefined) ?? capture?.title;
  return (sanitizeDwmCustomerText(value, "", 1_200) ?? "").trim();
}
function taskEvidenceMatches(task: any, capture: any) { return Boolean(capture) && (!task.contentHash || task.contentHash === capture.contentHash) && (!task.excerptHash || task.excerptHash === hashContent(blindExcerpt(capture))); }
function sourceFamily(source: any, capture: any) { return source?.metadata?.sourceFamily ?? capture?.metadata?.sourceFamily ?? source?.type ?? capture?.metadata?.adapter ?? "unknown"; }
function benchmarkAnnotations(store: any, id: string) { return records(store, "listEvaluationAnnotations").filter((row) => row.benchmarkId === id); }
function benchmarkAdjudications(store: any, id: string) { return records(store, "listEvaluationAdjudications").filter((row) => row.benchmarkId === id); }
function records(store: any, method: string): any[] { return typeof store?.[method] === "function" ? store[method]() : []; }
function annotationValues(value: unknown): string[] | undefined { if (!Array.isArray(value) || value.length > 50) return undefined; const values = unique(value.map((item) => cleanText(item, 200)).filter(Boolean) as string[]); return values; }
function canonicalValues(values: string[]) { return values.map(normalize).sort().join("\n"); }
function valueMap(values: unknown[]) { return new Map(values.map((value) => String(value ?? "").trim()).filter(Boolean).map((value) => [normalize(value), value])); }
function normalize(value: string) { return value.trim().toLowerCase().replace(/\s+/g, " "); }
function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
function cleanText(value: unknown, max: number): string | undefined { return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined; }
function entityMatches(labelType: string, entityType: string) {
  const type = String(entityType).toLowerCase();
  if (labelType === "actor") return ["actor", "threat_actor"].includes(type);
  if (labelType === "ransomware") return type === "ransomware_family";
  if (labelType === "victim") return type === "victim";
  if (labelType === "cve") return type === "cve";
  if (labelType === "malware") return ["malware", "malware_tool", "tool"].includes(type);
  if (labelType === "ttp") return ["ttp", "attack_technique", "technique"].includes(type);
  if (labelType === "country") return type === "country";
  if (labelType === "sector") return type === "sector";
  if (labelType === "impact") return type === "impact";
  return labelType === "dataset" && ["dataset", "data_type"].includes(type);
}

function predictionSnapshot(predictions: any[]) {
  const byValue = new Map<string, { value: string; confidence?: number; entityType: string; extractorVersion: string }>();
  for (const prediction of predictions) {
    const value = String(prediction.value ?? prediction.normalizedValue ?? "").trim();
    if (!value) continue;
    const key = normalize(value), confidence = normalizedConfidence(prediction.confidence), current = byValue.get(key);
    if (!current || (confidence ?? -1) > (current.confidence ?? -1)) byValue.set(key, { value, confidence, entityType: String(prediction.type ?? "unknown"), extractorVersion: String(prediction.extractorVersion ?? "unknown") });
  }
  return [...byValue.values()].sort((left, right) => normalize(left.value).localeCompare(normalize(right.value)));
}

function normalizedConfidence(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? Number(Math.max(0, Math.min(1, number > 1 ? number / 100 : number)).toFixed(3)) : undefined;
}
