import { acceptedEvaluationLabelSet } from "../api/evaluationBenchmarkRoutes.ts";
import type {
  CaptureMetadataStore,
  EvaluationAdjudicationRecord,
  EvaluationAnnotationRecord,
  EvaluationBenchmarkRecord,
  EvaluationIndependenceContext,
  EvaluationLabelRecord,
  EvaluationLineageIdentity,
  EvaluationSourceHealthRecord,
  EvaluationStoreRecord,
  EvaluationTaskRecord,
  EvaluationTimelinessRecord
} from "../storage/evidenceStoreTypes.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const LATENCIES = [
  "reportToPublicationSeconds",
  "firstReportToCollectionSeconds",
  "publicationToCollectionSeconds",
  "collectionToProcessingSeconds",
  "processingToVisibilitySeconds",
  "visibilityToAlertSeconds",
  "alertToDeliveryAttemptSeconds",
  "deliveryAttemptToDeliveredSeconds",
  "publicationToAlertSeconds",
  "reportToVisibilitySeconds",
  "reportToAlertSeconds",
  "reportToDeliveredSeconds"
] as const;
const REQUIRED_BENCHMARK_LABEL_TYPES = ["actor", "ransomware", "victim", "incident", "cve", "malware", "ttp", "country", "sector", "indicator", "impact", "dataset", "business_mechanism"];
const INDEPENDENT_BENCHMARK_PROTOCOL = "ti.independent_extraction_benchmark.v4";
const INDEPENDENT_TRUTH_BASIS = "separately_retained_authoritative_reference";

type MetricSubject = EvaluationStoreRecord & {
  captureId?: string;
  captureIds?: string[];
  sourceId?: string;
  sourceIds?: string[];
  extractorVersion?: string;
  type?: string;
  value?: string;
  normalizedValue?: string;
};

type EvaluationMetricRow = {
  benchmarkId?: string;
  taskId?: string;
  captureId?: string;
  labelType: string;
  datasetSplit: string;
  bucket: string;
  labelingMethod: string;
  parserVersion: string;
  sourceFamily: string;
  reviewerModelVersion: string;
  reviewPromptVersion: string;
  reviewSchemaVersion: string;
  labeledAt?: string;
  predictionConfidence?: number;
  exhaustiveExpectedValues: boolean;
};
type ActorTimelineRecord = EvaluationTimelinessRecord & { actorName: string };
type AdjudicatedTaskTruth = {
  benchmarkId?: string;
  taskId?: string;
  captureId?: string;
  labelType: string;
  positive: boolean;
};

export function buildEvaluationMetrics(store: CaptureMetadataStore, input: { tenantId?: string; datasetSplit?: string; generatedAt?: string } = {}) {
  const scoped = <T extends { tenantId?: string }>(values: T[]) => values.filter((record) => sameTenant(record.tenantId, input.tenantId));
  const sources = scoped(store.listSources()), captures = scoped(store.listCaptures()), entities = scoped(store.listExtractedEntities()) as MetricSubject[], indicators = scoped(store.listIndicators()) as MetricSubject[], incidents = scoped(store.listIncidents()) as MetricSubject[], claims = scoped(store.listIntelligenceClaims()) as MetricSubject[];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const captureById = new Map(captures.map((capture) => [capture.id, capture]));
  const subjects = new Map([...entities, ...indicators, ...incidents, ...claims].map((record) => [record.id, record]));
  const labelEvents = scoped(store.listEvaluationLabels()).filter((label) => !input.datasetSplit || label.datasetSplit === input.datasetSplit);
  const labels = latestLabels(labelEvents);
  const timeliness = scoped(store.listTimelinessRecords());
  const actorByCapture = actorNamesByCapture(entities);
  const actorTimeliness: ActorTimelineRecord[] = timeliness.flatMap((record) => (actorByCapture.get(record.captureId ?? "") ?? ["unattributed"]).map((actorName) => ({ ...record, actorName })));
  const health = scoped(store.listSourceHealthObservations());
  const validations = scoped(store.listValidationRecords());
  const allBenchmarks = scoped(store.listEvaluationBenchmarks()).filter((benchmark) => !input.datasetSplit || benchmark.datasetSplit === input.datasetSplit);
  const benchmarks = allBenchmarks.filter((benchmark) => benchmark.protocol?.version === INDEPENDENT_BENCHMARK_PROTOCOL);
  const allBenchmarkIds = new Set(allBenchmarks.map((benchmark) => benchmark.id));
  const benchmarkIds = new Set(benchmarks.map((benchmark) => benchmark.id));
  const allAnnotations = scoped(store.listEvaluationAnnotations()).filter((annotation) => annotation.benchmarkId && allBenchmarkIds.has(annotation.benchmarkId));
  const allAdjudications = scoped(store.listEvaluationAdjudications()).filter((adjudication) => adjudication.benchmarkId && allBenchmarkIds.has(adjudication.benchmarkId));
  const annotations = allAnnotations.filter((annotation) => annotation.benchmarkId && benchmarkIds.has(annotation.benchmarkId));
  const adjudications = allAdjudications.filter((adjudication) => adjudication.benchmarkId && benchmarkIds.has(adjudication.benchmarkId));
  const completedBenchmarks = benchmarks.filter((benchmark) => terminalBenchmark(benchmark, adjudications));
  const completedBenchmarkIds = new Set(completedBenchmarks.map((benchmark) => benchmark.id));
  const completedBenchmarkById = new Map(completedBenchmarks.map((benchmark) => [benchmark.id, benchmark]));
  const benchmarkTasks = new Map<string, EvaluationTaskRecord>(completedBenchmarks.flatMap((benchmark) => (benchmark.manifest ?? []).map((task) => [`${benchmark.id}\u0000${task.id}`, task] as [string, EvaluationTaskRecord])));
  const groupedAdjudications = recordsByTask(adjudications.filter((adjudication) => adjudication.benchmarkId && completedBenchmarkIds.has(adjudication.benchmarkId)));
  const groupedLabels = recordsByTask(labelEvents.filter((label) => label.benchmarkId && completedBenchmarkIds.has(label.benchmarkId)));
  const independentLabels = [...benchmarkTasks].flatMap(([key, task]) => {
    const benchmark = completedBenchmarkById.get(key.slice(0, key.indexOf("\u0000")));
    const taskLabels = groupedLabels.get(key) ?? [];
    const taskAdjudications = groupedAdjudications.get(key) ?? [];
    return benchmark && acceptedEvaluationLabelSet(store, benchmark, task, taskAdjudications, taskLabels) ? taskLabels : [];
  });
  const diagnosticLabels = labels.filter((label) => !independentLabels.includes(label));
  const rows = independentLabels.map((label) => labelRow(label, subjects, captureById, sourceById));
  const diagnosticRows = diagnosticLabels.map((label) => labelRow(label, subjects, captureById, sourceById));
  const independentlyMeasuredBenchmarkIds = new Set(rows.map((row) => row.benchmarkId).filter((id): id is string => Boolean(id)));
  const measuredBenchmarks = completedBenchmarks.filter((benchmark) => independentlyMeasuredBenchmarkIds.has(benchmark.id));
  const completedAnnotations = annotations.filter((annotation) => annotation.benchmarkId && completedBenchmarkIds.has(annotation.benchmarkId));
  const completedAdjudications = adjudications.filter((adjudication) => adjudication.benchmarkId && completedBenchmarkIds.has(adjudication.benchmarkId));
  const independentTaskIds = new Set(rows.map((row) => `${row.benchmarkId}:${row.taskId}`));
  const independentAnnotations = completedAnnotations.filter((annotation) => independentTaskIds.has(`${annotation.benchmarkId}:${annotation.taskId}`));
  const independentAdjudications = completedAdjudications.filter((adjudication) => independentTaskIds.has(`${adjudication.benchmarkId}:${adjudication.taskId}`));
  const benchmarkReviewerCount = new Set(independentAnnotations.map((annotation) => annotation.reviewerId).filter(Boolean)).size;
  const benchmarkTaskCount = independentTaskIds.size;
  const benchmarkCaptureCount = new Set(rows.map((row) => row.captureId).filter(Boolean)).size;
  const heldOutBenchmarks = measuredBenchmarks.filter((benchmark) => benchmark.datasetSplit === "test" && benchmark.protocol?.testSplitLocked === true && benchmark.protocol?.datasetUsage === "locked_final_evaluation");
  const heldOutBenchmarkIds = new Set(heldOutBenchmarks.map((benchmark) => benchmark.id));
  const heldOutRows = rows.filter((row) => Boolean(row.benchmarkId && heldOutBenchmarkIds.has(row.benchmarkId)));
  const heldOutAnnotations = independentAnnotations.filter((annotation) => Boolean(annotation.benchmarkId && heldOutBenchmarkIds.has(annotation.benchmarkId)));
  const heldOutAdjudications = independentAdjudications.filter((adjudication) => Boolean(adjudication.benchmarkId && heldOutBenchmarkIds.has(adjudication.benchmarkId)));
  const heldOutCaptureCount = new Set(heldOutRows.map((row) => row.captureId).filter(isString)).size;
  const heldOutReviewerCount = new Set(heldOutAnnotations.map((annotation) => annotation.reviewerId).filter(isString)).size;
  const heldOutTaskTruth = adjudicatedTaskTruth(heldOutAdjudications, heldOutRows, heldOutBenchmarks);
  const heldOutCaseCoverage = evaluationCaseCoverage(heldOutBenchmarks, heldOutAnnotations, heldOutAdjudications);
  const labelTypeCoverage = REQUIRED_BENCHMARK_LABEL_TYPES.map((name) => {
    const values = heldOutTaskTruth.filter((row) => row.labelType === name);
    return { name, sampleSize: values.length, positiveCount: values.filter((row) => row.positive).length, negativeCount: values.filter((row) => !row.positive).length };
  });
  const stratifiedCoverageComplete = labelTypeCoverage.every((row) => row.positiveCount >= 5 && row.negativeCount >= 5);
  const representativeFailureCoverageComplete = heldOutCaseCoverage.ambiguousTaskCount > 0 && heldOutCaseCoverage.parserFailureTaskCount > 0 && heldOutCaseCoverage.unsupportedAttributionTaskCount > 0;
  const heldOutBenchmarkCount = heldOutBenchmarks.length;
  const validationStatus = heldOutBenchmarkCount > 0 && heldOutCaptureCount >= 50 && heldOutReviewerCount >= 2 && stratifiedCoverageComplete && representativeFailureCoverageComplete ? "validated" : benchmarks.length ? "pilot_only" : "not_started";

  return {
    schemaVersion: "ti.evaluation_metrics.v3",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    scope: { tenantId: input.tenantId ?? null, datasetSplit: input.datasetSplit ?? "all" },
    quality: {
      status: validationStatus === "validated" ? "measured" : independentLabels.length ? "pilot_only" : labels.length ? "diagnostic_only" : "unmeasured",
      labelEventCount: labelEvents.length,
      evaluatedUnitCount: independentLabels.length,
      diagnosticUnitCount: diagnosticLabels.length,
      supersededLabelCount: labelEvents.length - labels.length,
      classifiedCount: rows.filter((row) => row.bucket !== "needs_review").length,
      needsReviewCount: rows.filter((row) => row.bucket === "needs_review").length,
      overall: score(rows),
      byLabelType: groupedScores(rows, (row) => row.labelType),
      byParser: groupedScores(rows, (row) => row.parserVersion),
      bySourceFamily: groupedScores(rows, (row) => row.sourceFamily),
      byReviewerModelVersion: groupedScores(rows, (row) => row.reviewerModelVersion),
      byPromptVersion: groupedScores(rows, (row) => row.reviewPromptVersion),
      bySchemaVersion: groupedScores(rows, (row) => row.reviewSchemaVersion),
      byDatasetSplit: groupedScores(rows, (row) => row.datasetSplit),
      endToEnd: endToEndMetrics(rows, measuredBenchmarks),
      drift: evaluationDrift(rows, measuredBenchmarks),
      errorBreakdown: {
        byOutcome: countBy(rows, (row) => row.bucket),
        byLabelType: groupedErrors(rows, (row) => row.labelType),
        byParser: groupedErrors(rows, (row) => row.parserVersion),
        bySourceFamily: groupedErrors(rows, (row) => row.sourceFamily),
        byReviewerModelVersion: groupedErrors(rows, (row) => row.reviewerModelVersion),
        byDatasetSplit: groupedErrors(rows, (row) => row.datasetSplit)
      },
      benchmarkEvidence: {
        benchmarkCount: benchmarks.length,
        completedBenchmarkCount: measuredBenchmarks.length,
        completedTaskCount: benchmarkTaskCount,
        completedCaptureCount: benchmarkCaptureCount,
        annotationCount: independentAnnotations.length,
        adjudicationCount: independentAdjudications.length,
        reviewerCount: benchmarkReviewerCount,
        heldOutBenchmarkCount,
        heldOutCaptureCount,
        heldOutReviewerCount,
        labelTypeCoverage,
        caseCoverage: evaluationCaseCoverage(measuredBenchmarks, independentAnnotations, independentAdjudications),
        heldOutCaseCoverage,
        stratifiedCoverageComplete,
        representativeFailureCoverageComplete,
        validationStatus,
        diagnostics: {
          legacyBenchmarkCount: allBenchmarks.length - benchmarks.length,
          partialAnnotationCount: allAnnotations.length - independentAnnotations.length,
          partialAdjudicationCount: allAdjudications.length - independentAdjudications.length
        }
      },
      diagnostics: {
        overall: score(diagnosticRows),
        byLabelingMethod: groupedScores(diagnosticRows, (row) => row.labelingMethod)
      }
    },
    timeliness: {
      status: timeliness.some(completeTimeline) ? "measured" : timeliness.length ? "partial" : "unmeasured",
      recordCount: timeliness.length,
      actorReportedRecordCount: timeliness.filter((record) => record.actorReportedAt).length,
      victimReportedRecordCount: timeliness.filter((record) => record.victimReportedAt).length,
      publisherReportedRecordCount: timeliness.filter((record) => record.publisherReportedAt).length,
      reportedRecordCount: timeliness.filter((record) => record.firstReportedAt ?? record.reportedAt).length,
      firstReportedProvenanceCount: timeliness.filter((record) => record.firstReportedProvenance).length,
      alertCreatedRecordCount: timeliness.filter((record) => record.alertCreatedAt ?? record.alertedAt).length,
      alertedRecordCount: timeliness.filter((record) => record.alertCreatedAt ?? record.alertedAt).length,
      deliveryAttemptedRecordCount: timeliness.filter((record) => record.deliveryAttemptedAt).length,
      deliveredRecordCount: timeliness.filter((record) => record.deliveredAt).length,
      reportToAlertRecordCount: timeliness.filter((record) => (record.firstReportedAt ?? record.reportedAt) && (record.alertCreatedAt ?? record.alertedAt)).length,
      reportToDeliveredRecordCount: timeliness.filter((record) => (record.firstReportedAt ?? record.reportedAt) && record.deliveredAt).length,
      completeTimelineRecordCount: timeliness.filter(completeTimeline).length,
      firstReportedByKind: countBy(timeliness.filter((record) => record.firstReportedKind), (record) => record.firstReportedKind ?? "unknown"),
      verifiedZeroSecondCount: zeroSecondCount(timeliness, true),
      unverifiedZeroSecondCount: zeroSecondCount(timeliness, false),
      anomalyCount: timeliness.filter((record) => record.timestampAnomalies?.length || unverifiedZeroSecondFields(record).length).length,
      overall: latencySummary(timeliness),
      byPipelineStage: pipelineStageLatencies(timeliness),
      bySourceFamily: groupedLatencies(timeliness, (record) => sourceFamily(sourceById.get(record.sourceId))),
      byActor: groupedLatencies(actorTimeliness, (record) => record.actorName)
    },
    coverage: coverage(sources, captures, entities, health, claims, rows),
    validation: {
      recordCount: validations.length,
      statuses: countBy(validations, (record) => record.status ?? "unknown"),
      referenceHostCount: new Set(validations.map((record) => hostname(record.referenceUrl)).filter(isString)).size
    },
    limitations: [
      !labels.length && "no evaluation labels in scope",
      labels.length > 0 && !independentLabels.length && "no independently reviewed evaluation labels in scope; automated checks are diagnostic only",
      !rows.some((row) => row.exhaustiveExpectedValues) && "recall is unmeasured until an exhaustive prediction-hidden benchmark is adjudicated",
      measuredBenchmarks.length === 0 && "no independently reviewed benchmark is complete",
      !timeliness.some((record) => record.firstReportedAt ?? record.reportedAt) && "first-report latency is unmeasured until an actor, victim, or publisher timestamp has source-field provenance",
      !timeliness.some((record) => record.alertCreatedAt ?? record.alertedAt) && "alert-creation latency is unmeasured",
      !timeliness.some((record) => record.deliveredAt) && "confirmed alert-delivery latency is unmeasured"
    ].filter(Boolean)
  };
}

function labelRow(label: EvaluationLabelRecord, subjects: Map<string, MetricSubject>, captures: Map<string, RawCapture>, sources: Map<string, SourceRecord>): EvaluationMetricRow {
  const subjectId = label.entityId ?? label.indicatorId ?? label.incidentId ?? label.claimId;
  const subject = subjectId ? subjects.get(subjectId) : undefined;
  const captureId = label.captureId ?? subject?.captureId ?? subject?.captureIds?.[0];
  const capture = captureId ? captures.get(captureId) : undefined;
  const sourceId = capture?.sourceId ?? subject?.sourceId ?? subject?.sourceIds?.[0];
  const source = sourceId ? sources.get(sourceId) : undefined;
  return {
    benchmarkId: label.benchmarkId,
    taskId: label.taskId,
    captureId: label.captureId ?? capture?.id,
    labelType: label.labelType ?? "unknown",
    datasetSplit: label.datasetSplit ?? "unassigned",
    bucket: outcomeBucket(label.outcome),
    labelingMethod: evaluationLabelMethod(label),
    parserVersion: label.parserVersion ?? subject?.extractorVersion ?? capture?.metadata?.extractorVersion ?? capture?.provenance?.extractorVersion ?? "unknown",
    sourceFamily: label.sourceFamily ?? sourceFamily(source),
    reviewerModelVersion: label.reviewerModelVersion ?? label.modelVersion ?? "unknown",
    reviewPromptVersion: label.reviewPromptVersion ?? "unknown",
    reviewSchemaVersion: label.reviewSchemaVersion ?? "unknown",
    labeledAt: label.labeledAt,
    predictionConfidence: normalizedConfidence(label.predictionConfidence),
    exhaustiveExpectedValues: label.exhaustiveExpectedValues === true && label.blinded === true && label.adjudicationStatus === "adjudicated"
  };
}

export function evaluationLabelMethod(label: EvaluationLabelRecord): string {
  if (typeof label?.labelingMethod === "string" && label.labelingMethod.trim()) return label.labelingMethod.trim();
  if (label?.labeledBy === "cisa-kev-authoritative-v1") return "source_field_parity";
  if (label?.labeledBy === "cross-source-corroboration-v1") return "cross_source_corroboration";
  if (label?.labeledBy === "thesis-evaluation-audit") return "manual_source_review";
  return "unspecified";
}

export function isIndependentEvaluationLabel(label: EvaluationLabelRecord): boolean {
  const method = evaluationLabelMethod(label);
  return ["manual_source_review", "automatic_model_review"].includes(method)
    && (method !== "automatic_model_review" || automaticIndependenceRecorded(label?.independenceContext))
    && label?.independentFromExtractor === true
    && Boolean(label?.benchmarkId)
    && label?.blinded === true
    && label?.exhaustiveExpectedValues === true
    && label?.adjudicationStatus === "adjudicated";
}

function automaticIndependenceRecorded(context: EvaluationIndependenceContext | undefined) {
  const evaluationIdentity = metricLineage(context?.evaluationModelIdentity);
  const extractionIdentities = Array.isArray(context?.extractionDecisionLineage) ? context.extractionDecisionLineage.map(metricLineage).filter(Boolean) : [];
  return context?.extractorPredictionsExcluded === true
    && context?.reviewerContextsIsolated === true
    && context?.governedEvidenceComplete === true
    && context?.authoritativeReferenceSetComplete === true
    && context?.evaluationModelIsolated === true
    && extractionIdentities.length > 0
    && Boolean(evaluationIdentity)
    && extractionIdentities.every((identity) => metricLineageKey(identity) !== metricLineageKey(evaluationIdentity))
    && Boolean(context?.evaluationModelConversationId)
    && Boolean(context?.evaluationModelResponseId)
    && context?.truthBasis === INDEPENDENT_TRUTH_BASIS
    && Boolean(context?.truthReferenceValidationId)
    && Boolean(context?.truthReferenceCaptureId)
    && Boolean(context?.truthReferenceSourceId)
    && Boolean(context?.truthReferenceContentHash)
    && Boolean(context?.truthReferenceExcerptHash)
    && Boolean(context?.authoritativeReferenceSetHash)
    && Boolean(context?.truthSnapshotHash);
}

function metricLineage(value: unknown): EvaluationLineageIdentity | undefined {
  if (!isRecord(value)) return undefined;
  const provider = normalizeMetricValue(value.provider);
  const model = normalizeMetricValue(value.model);
  const version = normalizeMetricValue(value.version);
  return provider && model && version && version !== "unknown" ? { provider, model, version } : undefined;
}
function metricLineageKey(value: EvaluationLineageIdentity | undefined) { return value ? `${value.provider}\u0000${value.model}\u0000${value.version}` : ""; }

function latestLabels(labels: EvaluationLabelRecord[]): EvaluationLabelRecord[] {
  const latest = new Map<string, EvaluationLabelRecord>();
  for (const label of labels) {
    const subjectId = label.captureId ?? label.entityId ?? label.indicatorId ?? label.incidentId ?? label.claimId ?? "unknown";
    const key = label.evaluationUnitId ?? `${subjectId}:${label.labelType ?? "unknown"}:${label.datasetSplit ?? "unassigned"}`;
    const previous = latest.get(key);
    if (!previous || String(label.labeledAt ?? label.id).localeCompare(String(previous.labeledAt ?? previous.id)) > 0) latest.set(key, label);
  }
  return [...latest.values()];
}

function recordsByTask<T extends { benchmarkId?: string; taskId?: string }>(records: T[]) {
  const grouped = new Map<string, T[]>();
  for (const record of records) if (record.benchmarkId && record.taskId) {
    const key = `${record.benchmarkId}\u0000${record.taskId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }
  return grouped;
}

function score(rows: EvaluationMetricRow[]) {
  const counts = { truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0, needsReview: 0 };
  for (const row of rows) {
    if (row.bucket === "true_positive") counts.truePositive++;
    else if (row.bucket === "false_positive") counts.falsePositive++;
    else if (row.bucket === "false_negative") counts.falseNegative++;
    else if (row.bucket === "true_negative") counts.trueNegative++;
    else counts.needsReview++;
  }
  const precision = ratio(counts.truePositive, counts.truePositive + counts.falsePositive);
  const exhaustive = rows.filter((row) => row.exhaustiveExpectedValues);
  const exhaustiveTruePositive = exhaustive.filter((row) => row.bucket === "true_positive").length;
  const exhaustiveFalseNegative = exhaustive.filter((row) => row.bucket === "false_negative").length;
  const exhaustiveTrueNegative = exhaustive.filter((row) => row.bucket === "true_negative").length;
  const exhaustiveFalsePositive = exhaustive.filter((row) => row.bucket === "false_positive").length;
  const recall = ratio(exhaustiveTruePositive, exhaustiveTruePositive + exhaustiveFalseNegative);
  const specificity = ratio(exhaustiveTrueNegative, exhaustiveTrueNegative + exhaustiveFalsePositive);
  const positiveCount = exhaustiveTruePositive + exhaustiveFalseNegative, negativeCount = exhaustiveTrueNegative + exhaustiveFalsePositive;
  return {
    ...counts,
    precision,
    recall,
    specificity,
    recallSampleSize: positiveCount,
    f1: precision === null || recall === null ? null : precision + recall === 0 ? 0 : round((2 * precision * recall) / (precision + recall)),
    classBalance: { positiveCount, negativeCount, positiveRate: ratio(positiveCount, positiveCount + negativeCount) },
    confidenceIntervals: {
      level: 0.95,
      method: "wilson",
      precision: wilson(counts.truePositive, counts.truePositive + counts.falsePositive),
      recall: wilson(exhaustiveTruePositive, positiveCount),
      specificity: wilson(exhaustiveTrueNegative, negativeCount)
    },
    calibration: calibration(rows)
  };
}

function groupedScores(rows: EvaluationMetricRow[], key: (row: EvaluationMetricRow) => string) {
  return group(rows, key).map(([name, values]) => ({ name, sampleSize: values.length, ...score(values) }));
}

function groupedErrors(rows: EvaluationMetricRow[], key: (row: EvaluationMetricRow) => string) {
  return group(rows.filter((row) => row.bucket === "false_positive" || row.bucket === "false_negative"), key).map(([name, values]) => ({ name, falsePositive: values.filter((row) => row.bucket === "false_positive").length, falseNegative: values.filter((row) => row.bucket === "false_negative").length }));
}

function terminalBenchmark(benchmark: EvaluationBenchmarkRecord, adjudications: EvaluationAdjudicationRecord[]) {
  if (!["complete", "complete_with_failures"].includes(benchmark.status)) return false;
  const adjudicated = new Set(adjudications.filter((row) => row.benchmarkId === benchmark.id).map((row) => row.taskId));
  const tasks = Array.isArray(benchmark.manifest) ? benchmark.manifest : [];
  if (tasks.length) return tasks.every((task) => adjudicated.has(task.id) || ["dead_letter", "failed"].includes(task.automation?.status ?? ""));
  return adjudicated.size === Number(benchmark.taskCount);
}

function benchmarkTaskMap(benchmarks: EvaluationBenchmarkRecord[]) {
  return new Map<string, EvaluationTaskRecord>(benchmarks.flatMap((benchmark) => (benchmark.manifest ?? []).map((task) => [task.id, task])));
}

function adjudicatedTaskTruth(adjudications: EvaluationAdjudicationRecord[], rows: EvaluationMetricRow[], benchmarks: EvaluationBenchmarkRecord[]): AdjudicatedTaskTruth[] {
  const tasks = benchmarkTaskMap(benchmarks);
  const rowsByTask = new Map<string, EvaluationMetricRow[]>();
  for (const row of rows) if (row.taskId) rowsByTask.set(row.taskId, [...(rowsByTask.get(row.taskId) ?? []), row]);
  return adjudications.map((adjudication) => {
    const task = adjudication.taskId ? tasks.get(adjudication.taskId) : undefined;
    const taskRows = adjudication.taskId ? rowsByTask.get(adjudication.taskId) ?? [] : [];
    const expectedValues = Array.isArray(adjudication.expectedValues) ? adjudication.expectedValues : undefined;
    return {
      benchmarkId: adjudication.benchmarkId,
      taskId: adjudication.taskId,
      captureId: adjudication.captureId ?? task?.captureId ?? taskRows[0]?.captureId,
      labelType: String(adjudication.labelType ?? task?.labelType ?? taskRows[0]?.labelType ?? "").replace(/_extraction$/, ""),
      positive: expectedValues ? expectedValues.length > 0 : taskRows.some((row) => ["true_positive", "false_negative"].includes(row.bucket))
    };
  });
}

function evaluationCaseCoverage(benchmarks: EvaluationBenchmarkRecord[], annotations: EvaluationAnnotationRecord[], adjudications: EvaluationAdjudicationRecord[]) {
  const tasks = benchmarkTaskMap(benchmarks);
  const annotationByTask = new Map<string, EvaluationAnnotationRecord[]>();
  for (const annotation of annotations) if (annotation.taskId) annotationByTask.set(annotation.taskId, [...(annotationByTask.get(annotation.taskId) ?? []), annotation]);
  const facts = adjudications.map((adjudication) => {
    const task = adjudication.taskId ? tasks.get(adjudication.taskId) : undefined;
    const reviews = adjudication.taskId ? annotationByTask.get(adjudication.taskId) ?? [] : [];
    const decisions = new Set(reviews.map((review) => JSON.stringify([...(review.expectedValues ?? [])].map(normalizeMetricValue).sort())));
    const expectedValues = Array.isArray(adjudication.expectedValues) ? adjudication.expectedValues : [];
    const truthBasis = adjudication.independenceContext?.truthBasis ?? task?.independenceContext?.truthBasis;
    return {
      positive: expectedValues.length > 0,
      ambiguous: reviews.some((review) => review.decision === "ambiguous") || decisions.size > 1,
      parserFailure: Array.isArray(task?.caseTags) && task.caseTags.includes("parser_failure"),
      unsupportedAttribution: ["actor", "ransomware"].includes(adjudication.labelType ?? task?.labelType ?? "") && expectedValues.length === 0 && Boolean(task?.observedValues?.length),
      truthBasis
    };
  });
  return {
    adjudicatedTaskCount: facts.length,
    positiveTaskCount: facts.filter((row) => row.positive).length,
    negativeTaskCount: facts.filter((row) => !row.positive).length,
    ambiguousTaskCount: facts.filter((row) => row.ambiguous).length,
    parserFailureTaskCount: facts.filter((row) => row.parserFailure).length,
    unsupportedAttributionTaskCount: facts.filter((row) => row.unsupportedAttribution).length,
    independentlySourcedTaskCount: facts.filter((row) => row.truthBasis === INDEPENDENT_TRUTH_BASIS).length,
    immutableTruthTaskCount: facts.filter((row) => row.truthBasis === INDEPENDENT_TRUTH_BASIS).length
  };
}

function endToEndMetrics(rows: EvaluationMetricRow[], benchmarks: EvaluationBenchmarkRecord[]) {
  const taskGroups = group(rows.filter((row) => row.taskId), (row) => `${row.benchmarkId}:${row.taskId}`);
  const taskResults = taskGroups.map(([, values]) => values.every((row) => ["true_positive", "true_negative"].includes(row.bucket)));
  const measuredTaskIds = new Set(rows.map((row) => row.taskId).filter(Boolean));
  const captureGroups = new Map<string, string[]>();
  for (const benchmark of benchmarks) for (const captureId of benchmark.captureIds ?? []) {
    const taskIds = (benchmark.manifest ?? []).filter((task) => task.captureId === captureId).map((task) => task.id);
    if (taskIds.length && taskIds.every((taskId) => measuredTaskIds.has(taskId))) captureGroups.set(`${benchmark.id}:${captureId}`, taskIds);
  }
  const exactTaskIds = new Set(taskGroups.filter(([, values]) => values.every((row) => ["true_positive", "true_negative"].includes(row.bucket))).map(([, values]) => values[0].taskId));
  const captureResults = [...captureGroups.values()].map((taskIds) => taskIds.every((taskId) => exactTaskIds.has(taskId)));
  return { taskSetExactMatch: exactMatchSummary(taskResults), captureExactMatch: exactMatchSummary(captureResults) };
}

function exactMatchSummary(results: boolean[]) {
  const exactMatchCount = results.filter(Boolean).length;
  return { sampleSize: results.length, exactMatchCount, errorCount: results.length - exactMatchCount, exactMatchRate: ratio(exactMatchCount, results.length), confidenceInterval: wilson(exactMatchCount, results.length) };
}

function normalizeMetricValue(value: unknown) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }

function evaluationDrift(rows: EvaluationMetricRow[], benchmarks: EvaluationBenchmarkRecord[]) {
  const series = benchmarks
    .map((benchmark) => {
      const values = rows.filter((row) => row.benchmarkId === benchmark.id);
      const result = score(values);
      return {
        benchmarkId: benchmark.id,
        completedAt: benchmark.completedAt ?? benchmark.updatedAt,
        datasetSplit: benchmark.datasetSplit,
        sampleSize: values.length,
        precision: result.precision,
        recall: result.recall,
        specificity: result.specificity,
        f1: result.f1,
        reviewerModelVersions: [...new Set(values.map((row) => row.reviewerModelVersion))].sort(),
        parserVersions: [...new Set(values.map((row) => row.parserVersion))].sort()
      };
    })
    .filter((row) => row.sampleSize > 0)
    .sort((left, right) => String(left.completedAt).localeCompare(String(right.completedAt)));
  const latest = series.at(-1);
  const previous = latest ? series.slice(0, -1).reverse().find((row) => row.datasetSplit === latest.datasetSplit) : undefined;
  return {
    status: latest && previous ? "measured" : "insufficient_history",
    series,
    latestDelta: latest && previous ? {
      precision: metricDelta(latest.precision, previous.precision),
      recall: metricDelta(latest.recall, previous.recall),
      specificity: metricDelta(latest.specificity, previous.specificity),
      f1: metricDelta(latest.f1, previous.f1)
    } : null
  };
}

function calibration(rows: EvaluationMetricRow[]) {
  const values = rows.filter((row) => row.predictionConfidence !== undefined).map((row) => ({ confidence: row.predictionConfidence as number, target: row.bucket === "true_positive" || row.bucket === "false_negative" ? 1 : 0 }));
  if (!values.length) return { sampleSize: 0, brierScore: null, expectedCalibrationError: null, bins: [] };
  const bins = Array.from({ length: 5 }, (_, index) => {
    const selected = values.filter((row) => Math.min(4, Math.floor(row.confidence * 5)) === index);
    const averageConfidence = selected.length ? round(selected.reduce((sum, row) => sum + row.confidence, 0) / selected.length) : null;
    const observedFrequency = selected.length ? round(selected.reduce((sum, row) => sum + row.target, 0) / selected.length) : null;
    return { lowerBound: index / 5, upperBound: (index + 1) / 5, sampleSize: selected.length, averageConfidence, observedFrequency };
  }).filter((bin) => bin.sampleSize > 0);
  const brierScore = round(values.reduce((sum, row) => sum + ((row.confidence - row.target) ** 2), 0) / values.length);
  const expectedCalibrationError = round(bins.reduce((sum, bin) => sum + (bin.sampleSize / values.length) * Math.abs((bin.averageConfidence ?? 0) - (bin.observedFrequency ?? 0)), 0));
  return { sampleSize: values.length, brierScore, expectedCalibrationError, bins };
}

function latencySummary(records: EvaluationTimelinessRecord[]) {
  return Object.fromEntries(LATENCIES.map((field) => {
    const values = records.flatMap((record) => {
      const value = numericLatency(record, field);
      if (value === undefined || value < 0) return [];
      if (value === 0 && record.zeroSecondEvidence?.[field]?.verified !== true) return [];
      return [value];
    });
    return [field, { sampleSize: values.length, medianSeconds: percentile(values, 0.5), p95Seconds: percentile(values, 0.95) }];
  }));
}

function unverifiedZeroSecondFields(record: EvaluationTimelinessRecord): string[] {
  return LATENCIES.filter((field) => numericLatency(record, field) === 0 && record.zeroSecondEvidence?.[field]?.verified !== true);
}

function zeroSecondCount(records: EvaluationTimelinessRecord[], verified: boolean): number {
  return records.reduce((total, record) => total + LATENCIES.filter((field) => {
    if (numericLatency(record, field) !== 0) return false;
    return (record.zeroSecondEvidence?.[field]?.verified === true) === verified;
  }).length, 0);
}

function numericLatency(record: EvaluationTimelinessRecord, field: string): number | undefined {
  const raw = record.latencies?.[field];
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function groupedLatencies<T extends EvaluationTimelinessRecord>(records: T[], key: (record: T) => string) {
  return group(records, key).map(([name, values]) => ({ name, recordCount: values.length, metrics: latencySummary(values) }));
}

function pipelineStageLatencies(records: EvaluationTimelinessRecord[]) {
  const summary = latencySummary(records);
  return LATENCIES.map((name) => ({ name, ...summary[name] }));
}

function actorNamesByCapture(entities: MetricSubject[]) {
  const names = new Map<string, Set<string>>();
  for (const entity of entities.filter((row) => row.type === "actor" || row.type === "ransomware_family")) {
    const name = String(entity.value ?? entity.normalizedValue ?? "").trim();
    if (!name || !entity.captureId) continue;
    const values = names.get(entity.captureId) ?? new Set<string>();
    values.add(name);
    names.set(entity.captureId, values);
  }
  return new Map([...names].map(([captureId, values]) => [captureId, [...values].sort()]));
}

function completeTimeline(record: EvaluationTimelinessRecord) {
  return Boolean((record.firstReportedAt ?? record.reportedAt) && record.publishedAt && record.collectedAt && record.processedAt && record.firstVisibleAt && (record.alertCreatedAt ?? record.alertedAt) && record.deliveryAttemptedAt && record.deliveredAt && record.firstReportedProvenance && record.alertCreatedProvenance && record.deliveryAttemptProvenance && record.deliveredProvenance && !record.timestampAnomalies?.length && !unverifiedZeroSecondFields(record).length);
}

function coverage(sources: SourceRecord[], captures: RawCapture[], entities: MetricSubject[], health: EvaluationSourceHealthRecord[], claims: MetricSubject[], labels: EvaluationMetricRow[]) {
  const active = sources.filter((source) => ["active", "canary", "probation", "degraded"].includes(source.status));
  const attempted = new Set(health.map((row) => row.sourceId));
  const successful = new Set(health.filter((row) => row.success).map((row) => row.sourceId));
  const useful = new Set(health.filter((row) => row.useful).map((row) => row.sourceId));
  const activeIds = new Set(active.map((source) => source.id));
  const activeAttempts = health.filter((row) => activeIds.has(row.sourceId));
  const classifiedLabels = labels.filter((row) => row.bucket !== "needs_review");
  const corroborated = claims.filter((claim) => claim.corroborationState === "corroborated");
  const contradicted = claims.filter((claim) => claim.reviewState === "contradicted" || claim.corroborationState === "contradicted");
  const observedItems = sum(health, "itemCount"), duplicates = sum(health, "duplicateCount");
  return {
    registeredSourceCount: sources.length,
    activeSourceCount: active.length,
    attemptedSourceCount: attempted.size,
    successfulSourceCount: successful.size,
    usefulSourceCount: useful.size,
    capturedSourceCount: new Set(captures.map((capture) => capture.sourceId)).size,
    actorCount: new Set(entities.filter((entity) => entity.type === "actor" || entity.type === "ransomware_family").map((entity) => String(entity.normalizedValue ?? entity.value).toLowerCase())).size,
    activeAttemptRate: ratio([...attempted].filter((sourceId) => active.some((source) => source.id === sourceId)).length, active.length),
    attemptSuccessRate: ratio(successful.size, attempted.size),
    usefulSourceRate: ratio(useful.size, attempted.size),
    sourceAttemptCount: health.length,
    activeSourceReliabilityRate: ratio(activeAttempts.filter((row) => row.success).length, activeAttempts.length),
    usefulAttemptRate: ratio(health.filter((row) => row.useful).length, health.length),
    duplicateObservationCount: duplicates,
    duplicationRate: ratio(duplicates, observedItems),
    claimCount: claims.length,
    corroboratedClaimCount: corroborated.length,
    contradictedClaimCount: contradicted.length,
    corroborationRate: ratio(corroborated.length, claims.length),
    falsePositiveRate: ratio(classifiedLabels.filter((row) => row.bucket === "false_positive").length, classifiedLabels.length),
    falsePositiveSampleSize: classifiedLabels.length,
    sourceFamilies: countBy(sources, sourceFamily)
  };
}
function sum(rows: EvaluationStoreRecord[], field: string): number { return rows.reduce((total, row) => total + Math.max(0, Number(row[field]) || 0), 0); }

function outcomeBucket(outcome: string | undefined): string {
  if (outcome === "true_positive" || outcome === "correct") return "true_positive";
  if (outcome === "false_positive" || outcome === "incorrect") return "false_positive";
  if (outcome === "false_negative") return "false_negative";
  if (outcome === "true_negative") return "true_negative";
  return "needs_review";
}

function sourceFamily(source: SourceRecord | undefined): string { return source?.metadata?.sourceFamily ?? source?.catalog?.canonicalId ?? source?.type ?? "unknown"; }
function sameTenant(recordTenant: unknown, scopeTenant: string | undefined): boolean { return recordTenant === scopeTenant || (recordTenant == null && scopeTenant === undefined); }
function group<T>(values: T[], key: (value: T) => string): Array<[string, T[]]> { const groups = new Map<string, T[]>(); for (const value of values) { const name = key(value) || "unknown"; groups.set(name, [...(groups.get(name) ?? []), value]); } return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)); }
function countBy<T>(values: T[], key: (value: T) => string): Record<string, number> { return Object.fromEntries(group(values, key).map(([name, rows]) => [name, rows.length])); }
function ratio(numerator: number, denominator: number): number | null { return denominator > 0 ? round(numerator / denominator) : null; }
function wilson(successes: number, total: number) {
  if (total <= 0) return { lower: null, upper: null, sampleSize: 0 };
  const z = 1.959963984540054, p = successes / total, denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) / denominator;
  return { lower: round(Math.max(0, center - margin)), upper: round(Math.min(1, center + margin)), sampleSize: total };
}
function metricDelta(current: number | null, previous: number | null): number | null { return current === null || previous === null ? null : round(current - previous); }
function percentile(values: number[], percentileValue: number): number | null { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.max(0, Math.ceil(sorted.length * percentileValue) - 1)] ?? null; }
function round(value: number): number { return Number(value.toFixed(3)); }
function normalizedConfidence(value: unknown): number | undefined { if (value === null || value === undefined || value === "") return undefined; const number = Number(value); return Number.isFinite(number) && number >= 0 && number <= 1 ? number : undefined; }
function hostname(value: unknown): string | undefined { try { return new URL(String(value)).hostname.toLowerCase(); } catch { return undefined; } }
function isString(value: unknown): value is string { return typeof value === "string" && Boolean(value); }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
