import { stableId } from "../utils.ts";

export type ReportRole = "actor" | "victim" | "publisher";
export type TimelinessQueueStatus = "unresolved_reference" | "anomaly" | "awaiting_alert" | "awaiting_delivery" | "complete";

type JsonObject = Record<string, unknown>;

export type PublicReportReferenceInput = {
  role: ReportRole;
  timestamp: string;
  referenceUrl: string;
  referenceTitle?: string;
  evidencePath: string;
  recordedBy: string;
  recordedAt: string;
};

export type TimelinessContext = {
  sources?: JsonObject[];
  incidents?: JsonObject[];
  captures?: JsonObject[];
  entities?: JsonObject[];
  validationRecords?: JsonObject[];
  generatedAt?: string;
};

export type TimelinessMetric = {
  sampleSize: number;
  medianSeconds: number | null;
  p95Seconds: number | null;
  p99Seconds: number | null;
};

export type TimelinessQualityGroup = {
  name: string;
  recordCount: number;
  missing: Record<string, number>;
  issues: Record<string, number>;
};

export type TimelinessRecordView = {
  id: string;
  incidentId: string;
  captureId: string;
  sourceId: string;
  tenantId?: string;
  actorName?: string;
  sourceName?: string;
  sourceFamily?: string;
  title?: string;
  status: TimelinessQueueStatus;
  missingStages: string[];
  stages: Record<string, string | undefined>;
  provenance: Record<string, JsonObject | undefined>;
  reportReferences: JsonObject[];
  latencies: Record<string, number | undefined>;
  timestampAnomalies: string[];
  updatedAt?: string;
};

export type TimelinessWorkbenchDto = {
  schemaVersion: "ti.timeliness_workbench.v2";
  generatedAt: string;
  summary: {
    recordCount: number;
    unresolvedReferenceCount: number;
    anomalyCount: number;
    awaitingAlertCount: number;
    awaitingDeliveryCount: number;
    completeCount: number;
    observedCoverage: number;
    reviewedCoverage: number;
    reportToAlertCoverage: number;
    reportToDeliveredCoverage: number;
    excludedMetricRecordCount: number;
  };
  metrics: {
    overall: Record<string, TimelinessMetric>;
    bySourceFamily: Array<{ name: string; recordCount: number; metrics: Record<string, TimelinessMetric> }>;
    byActor: Array<{ name: string; recordCount: number; metrics: Record<string, TimelinessMetric> }>;
    byStage: Array<{ name: string } & TimelinessMetric>;
  };
  quality: {
    fields: Array<{ name: string; presentCount: number; missingCount: number; coverage: number }>;
    issues: Array<{ name: string; count: number }>;
    bySourceClass: TimelinessQualityGroup[];
  };
  items: TimelinessRecordView[];
};

const STAGES = [
  ["observedAt", "observed"],
  ["firstReportedAt", "first_report"],
  ["publishedAt", "publication"],
  ["collectedAt", "collection"],
  ["processedAt", "processing"],
  ["firstVisibleAt", "first_visible"],
  ["reviewedAt", "reviewed"],
  ["alertCreatedAt", "alert_created"],
  ["deliveryAttemptedAt", "delivery_attempt"],
  ["deliveredAt", "delivered"],
] as const;

const INTERVALS = [
  ["observationToCollectionSeconds", "observedAt", "collectedAt"],
  ["reportToPublicationSeconds", "firstReportedAt", "publishedAt"],
  ["firstReportToCollectionSeconds", "firstReportedAt", "collectedAt"],
  ["publicationToCollectionSeconds", "publishedAt", "collectedAt"],
  ["collectionToProcessingSeconds", "collectedAt", "processedAt"],
  ["processingToVisibilitySeconds", "processedAt", "firstVisibleAt"],
  ["visibilityToReviewSeconds", "firstVisibleAt", "reviewedAt"],
  ["visibilityToAlertSeconds", "firstVisibleAt", "alertCreatedAt"],
  ["alertToDeliveryAttemptSeconds", "alertCreatedAt", "deliveryAttemptedAt"],
  ["deliveryAttemptToDeliveredSeconds", "deliveryAttemptedAt", "deliveredAt"],
  ["reportToVisibilitySeconds", "firstReportedAt", "firstVisibleAt"],
  ["reportToAlertSeconds", "firstReportedAt", "alertCreatedAt"],
  ["reportToDeliveredSeconds", "firstReportedAt", "deliveredAt"],
] as const;

export function mergePublicReportReference(
  inputRecord: JsonObject,
  input: PublicReportReferenceInput,
): { record: JsonObject; reference: JsonObject; created: boolean } {
  const incidentId = requiredString(inputRecord, "incidentId");
  const captureId = requiredString(inputRecord, "captureId");
  const sourceId = requiredString(inputRecord, "sourceId");
  const timestamp = requiredZonedIso(input.timestamp, "reference timestamp");
  const recordedAt = requiredIso(input.recordedAt, "recorded timestamp");
  const reference = {
    id: stableId("timeliness-reference", `${incidentId}:${input.role}:${timestamp}:${input.referenceUrl}:${input.evidencePath}`),
    role: input.role,
    timestamp,
    sourceId,
    captureId,
    incidentId,
    referenceUrl: input.referenceUrl,
    referenceTitle: cleanText(input.referenceTitle, 240),
    evidencePath: input.evidencePath,
    extractionMethod: "public_reference",
    recordedBy: input.recordedBy,
    recordedAt,
  };
  const current = reportReferences(inputRecord);
  const exists = current.some((item) => item.id === reference.id);
  const reportTimestamps = exists ? current : sortReferences([...current, reference]);
  const record = deriveTimeliness({
    ...inputRecord,
    incidentId,
    captureId,
    sourceId,
    reportTimestamps,
    updatedAt: exists ? string(inputRecord.updatedAt) : recordedAt,
  }, recordedAt);
  return { record, reference, created: !exists };
}

export function buildTimelinessWorkbench(records: JsonObject[], context: TimelinessContext = {}): TimelinessWorkbenchDto {
  const generatedAt = validIso(context.generatedAt) ?? new Date().toISOString();
  const sources = index(context.sources, "id");
  const incidents = index(context.incidents, "id");
  const captures = index(context.captures, "id");
  const entities = context.entities ?? [];
  const validations = validationIndex(context.validationRecords ?? []);
  const items = records.map((record) => {
    const incidentId = requiredString(record, "incidentId");
    const captureId = requiredString(record, "captureId");
    const sourceId = requiredString(record, "sourceId");
    const incident = incidents.get(incidentId);
    const capture = captures.get(captureId);
    const source = sources.get(sourceId);
    const contextStages = contextualStages(record, capture, incident, uniqueObjects([...(validations.get(incidentId) ?? []), ...(validations.get(captureId) ?? [])]));
    const preliminary = deriveTimeliness({ ...record, ...contextStages.values }, generatedAt);
    const provenance = stageProvenance(preliminary, sourceStageProvenance(preliminary, capture, incident, contextStages.provenance));
    const derived = deriveTimeliness(preliminary, generatedAt, provenance, sourceQualityIssues(preliminary, capture, provenance));
    return toView(derived, {
      actorName: actorName(incident, entities, incidentId, captureId),
      sourceName: string(source?.name),
      sourceFamily: string(object(source?.metadata)?.sourceFamily) ?? string(source?.type),
      title: string(incident?.title) ?? string(capture?.title),
    }, provenance);
  }).sort((left, right) => priority(left.status) - priority(right.status) || Date.parse(right.updatedAt ?? "") - Date.parse(left.updatedAt ?? ""));
  const overall = metrics(items);
  return {
    schemaVersion: "ti.timeliness_workbench.v2",
    generatedAt,
    summary: {
      recordCount: items.length,
      unresolvedReferenceCount: items.filter((item) => !item.stages.first_report).length,
      anomalyCount: items.filter((item) => item.timestampAnomalies.length).length,
      awaitingAlertCount: count(items, "awaiting_alert"),
      awaitingDeliveryCount: count(items, "awaiting_delivery"),
      completeCount: count(items, "complete"),
      observedCoverage: stageCoverage(items, "observed"),
      reviewedCoverage: stageCoverage(items, "reviewed"),
      reportToAlertCoverage: coverage(items, "reportToAlertSeconds"),
      reportToDeliveredCoverage: coverage(items, "reportToDeliveredSeconds"),
      excludedMetricRecordCount: items.filter((item) => item.timestampAnomalies.length).length,
    },
    metrics: {
      overall,
      bySourceFamily: groupedMetrics(items, (item) => item.sourceFamily ?? "unclassified"),
      byActor: groupedMetrics(items, (item) => item.actorName ?? "unattributed"),
      byStage: Object.entries(overall).map(([name, metric]) => ({ name, ...metric })),
    },
    quality: quality(items),
    items,
  };
}

function deriveTimeliness(
  input: JsonObject,
  generatedAt: string,
  provenance = stageProvenance(input),
  additionalAnomalies: string[] = [],
): JsonObject {
  const reportTimestamps = sortReferences(reportReferences(input));
  const first = reportTimestamps[0];
  const actor = reportTimestamps.find((item) => item.role === "actor");
  const victim = reportTimestamps.find((item) => item.role === "victim");
  const publisher = reportTimestamps.find((item) => item.role === "publisher");
  const record: JsonObject = {
    ...input,
    reportTimestamps,
    actorReportedAt: string(actor?.timestamp),
    victimReportedAt: string(victim?.timestamp),
    publisherReportedAt: string(publisher?.timestamp),
    firstReportedAt: string(first?.timestamp),
    reportedAt: string(first?.timestamp),
    firstReportedKind: string(first?.role),
    firstReportedProvenance: first,
    alertCreatedAt: string(input.alertCreatedAt) ?? string(input.alertedAt),
  };
  const latencies = latencyFields(record);
  const currentProvenance = stageProvenance(record, provenance);
  const zeroSecondEvidence = zeroEvidence(record, latencies, currentProvenance);
  return { ...record, latencies, zeroSecondEvidence, timestampAnomalies: anomalies(record, latencies, zeroSecondEvidence, generatedAt, additionalAnomalies) };
}

function toView(
  record: JsonObject,
  labels: { actorName?: string; sourceName?: string; sourceFamily?: string; title?: string },
  provenance = stageProvenance(record),
): TimelinessRecordView {
  const stages = Object.fromEntries(STAGES.map(([field, name]) => [name, string(record[field])])) as Record<string, string | undefined>;
  const timestampAnomalies = stringArray(record.timestampAnomalies);
  const missingStages = Object.entries(stages).filter(([, value]) => !value).map(([name]) => name);
  return {
    id: requiredString(record, "id"),
    incidentId: requiredString(record, "incidentId"),
    captureId: requiredString(record, "captureId"),
    sourceId: requiredString(record, "sourceId"),
    tenantId: string(record.tenantId),
    ...labels,
    status: statusFor(stages, timestampAnomalies),
    missingStages,
    stages,
    provenance: stageProvenance(record, provenance),
    reportReferences: reportReferences(record),
    latencies: numberRecord(record.latencies),
    timestampAnomalies,
    updatedAt: string(record.updatedAt),
  };
}

function statusFor(stages: Record<string, string | undefined>, anomalies: string[]): TimelinessQueueStatus {
  if (anomalies.length) return "anomaly";
  if (!stages.first_report) return "unresolved_reference";
  if (!stages.alert_created) return "awaiting_alert";
  if (!stages.delivery_attempt || !stages.delivered) return "awaiting_delivery";
  return "complete";
}

function stageProvenance(record: JsonObject, overrides: Record<string, JsonObject | undefined> = {}): Record<string, JsonObject | undefined> {
  const captureId = string(record.captureId);
  const incidentId = string(record.incidentId);
  const sourceId = string(record.sourceId);
  return {
    observed: string(record.observedAt) ? { event: "observed", timestamp: record.observedAt, evidencePath: "timeliness_record.observedAt" } : undefined,
    first_report: object(record.firstReportedProvenance),
    publication: string(record.publishedAt) ? { event: "publication", sourceId, captureId, timestamp: record.publishedAt, evidencePath: "timeliness_record.publishedAt" } : undefined,
    collection: string(record.collectedAt) ? { event: "collection", sourceId, captureId, timestamp: record.collectedAt, evidencePath: "timeliness_record.collectedAt" } : undefined,
    processing: string(record.processedAt) ? { event: "processing", captureId, timestamp: record.processedAt, evidencePath: "timeliness_record.processedAt" } : undefined,
    first_visible: string(record.firstVisibleAt) ? { event: "first_visible", incidentId, timestamp: record.firstVisibleAt, evidencePath: "timeliness_record.firstVisibleAt" } : undefined,
    reviewed: string(record.reviewedAt) ? { event: "reviewed", timestamp: record.reviewedAt, evidencePath: "timeliness_record.reviewedAt" } : undefined,
    alert_created: object(record.alertCreatedProvenance),
    delivery_attempt: object(record.deliveryAttemptProvenance),
    delivered: object(record.deliveredProvenance),
    ...overrides,
  };
}

function contextualStages(record: JsonObject, capture: JsonObject | undefined, incident: JsonObject | undefined, validations: JsonObject[]) {
  const observed = firstTimestamp([
    [record.observedAt, "timeliness_record.observedAt", record],
    [capture?.observedAt, "capture.observedAt", capture],
    [object(capture?.metadata)?.observedAt, "capture.metadata.observedAt", capture],
    [incident?.observedAt, "incident.observedAt", incident],
    [object(incident?.metadata)?.observedAt, "incident.metadata.observedAt", incident],
  ]);
  const explicitReview = firstTimestamp([
    [record.reviewedAt, "timeliness_record.reviewedAt", record],
    [capture?.reviewedAt, "capture.reviewedAt", capture],
    [incident?.reviewedAt, "incident.reviewedAt", incident],
  ]);
  const validation = [...validations]
    .filter((item) => validIso(item.matchedAt) && string(item.reviewerId))
    .sort((left, right) => Date.parse(requiredIso(left.matchedAt, "validation match timestamp")) - Date.parse(requiredIso(right.matchedAt, "validation match timestamp")))[0];
  const review = explicitReview ?? (validation ? {
    timestamp: requiredIso(validation.matchedAt, "validation match timestamp"),
    provenance: {
      event: "reviewed",
      validationId: string(validation.id),
      reviewerId: string(validation.reviewerId),
      validationStatus: string(validation.status),
      referenceUrl: string(validation.referenceUrl),
      timestamp: requiredIso(validation.matchedAt, "validation match timestamp"),
      evidencePath: "validation.matchedAt",
    },
  } : undefined);
  return {
    values: { observedAt: observed?.timestamp, reviewedAt: review?.timestamp },
    provenance: { observed: observed?.provenance, reviewed: review?.provenance },
  };
}

function firstTimestamp(candidates: Array<[unknown, string, JsonObject | undefined]>) {
  for (const [value, evidencePath, source] of candidates) {
    const timestamp = validIso(value);
    if (timestamp) return { timestamp, provenance: { event: evidencePath.split(".").at(-1)?.replace("At", "").toLowerCase(), timestamp, evidencePath, id: string(source?.id) } };
  }
  return undefined;
}

function sourceStageProvenance(
  record: JsonObject,
  capture: JsonObject | undefined,
  incident: JsonObject | undefined,
  contextual: Record<string, JsonObject | undefined>,
): Record<string, JsonObject | undefined> {
  const candidates: Array<[string, string, JsonObject | undefined, string]> = [
    ["publication", "publishedAt", capture, "capture.publishedAt"],
    ["publication", "publishedAt", incident, "incident.publishedAt"],
    ["collection", "collectedAt", capture, "capture.collectedAt"],
    ["collection", "collectedAt", incident, "incident.collectedAt"],
    ["processing", "processedAt", capture, "capture.processedAt"],
    ["processing", "processedAt", incident, "incident.processedAt"],
    ["first_visible", "firstVisibleAt", incident, "incident.firstVisibleAt"],
    ["first_visible", "firstVisibleAt", capture, "capture.firstVisibleAt"],
  ];
  const result = { ...contextual };
  for (const [stage, field, source, evidencePath] of candidates) {
    if (result[stage] || !sameTime(record[field], source?.[field])) continue;
    result[stage] = { event: stage, timestamp: validIso(record[field]), evidencePath, id: string(source?.id), sourceId: string(record.sourceId), captureId: string(record.captureId), incidentId: string(record.incidentId) };
  }
  return result;
}

function sourceQualityIssues(record: JsonObject, capture: JsonObject | undefined, provenance: Record<string, JsonObject | undefined>): string[] {
  const result = new Set<string>();
  if (validIso(record.processedAt) && validIso(capture?.processedAt) && !sameTime(record.processedAt, capture?.processedAt)) result.add("source_mismatch:processing");
  const publisher = reportReferences(record).find((reference) => reference.role === "publisher");
  if (sameTime(record.publishedAt, record.collectedAt) && !sameTime(record.publishedAt, publisher?.timestamp)) result.add("suspected_copy:publication_collection");
  for (const reference of objectArray(record.reportTimestamps)) {
    if (validIso(reference.timestamp) && !zonedIso(reference.timestamp)) result.add("timezone_missing:first_report_reference");
  }
  for (const [field, stage] of STAGES) if (string(record[field]) && !provenance[stage]) result.add(`provenance_missing:${stage}`);
  return [...result];
}

function latencyFields(record: JsonObject): Record<string, number | undefined> {
  return Object.fromEntries(INTERVALS.map(([name, from, to]) => [name, elapsed(string(record[from]), string(record[to]))]));
}

function zeroEvidence(record: JsonObject, latencies: Record<string, number | undefined>, provenance: Record<string, JsonObject | undefined>): JsonObject {
  const byField = new Map(STAGES.map(([field, stage]) => [field, stage]));
  return Object.fromEntries(INTERVALS.flatMap(([name, from, to]) => latencies[name] === 0 ? [[name, {
    verified: Boolean(provenance[byField.get(from)!] && provenance[byField.get(to)!]),
    from: record[from],
    to: record[to],
    fromEvidence: provenance[byField.get(from)!],
    toEvidence: provenance[byField.get(to)!],
  }]] : []));
}

function anomalies(record: JsonObject, latencies: Record<string, number | undefined>, zeroSecondEvidence: JsonObject, generatedAt: string, additional: string[] = []): string[] {
  const result = new Set<string>(additional);
  for (const [name] of INTERVALS) if (latencies[name] !== undefined && latencies[name]! < 0) result.add(`negative:${name}`);
  if (string(record.firstReportedAt) && !object(record.firstReportedProvenance)) result.add("first_report_provenance_missing");
  for (const [name, evidence] of Object.entries(zeroSecondEvidence)) if (object(evidence)?.verified !== true) result.add(`unverified_zero:${name}`);
  for (const [field, stage] of STAGES) {
    const value = string(record[field]);
    if (value && Date.parse(value) > Date.parse(generatedAt) + 300_000) result.add(`future_timestamp:${stage}`);
  }
  return [...result];
}

function metrics(items: TimelinessRecordView[]): Record<string, TimelinessMetric> {
  return Object.fromEntries(INTERVALS.map(([name]) => [name, distribution(items.flatMap((item) => validMetric(item, name) ? [item.latencies[name]!] : []))]));
}

function validMetric(item: TimelinessRecordView, field: string): boolean {
  const value = item.latencies[field];
  if (value === undefined || value < 0 || item.timestampAnomalies.length) return false;
  const evidence = object(item.provenance.first_report);
  if (field.startsWith("report") || field.startsWith("firstReport")) return Boolean(evidence);
  return true;
}

function distribution(values: number[]): TimelinessMetric {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    sampleSize: sorted.length,
    medianSeconds: percentile(sorted, 0.5),
    p95Seconds: percentile(sorted, 0.95),
    p99Seconds: percentile(sorted, 0.99),
  };
}

function stageCoverage(items: TimelinessRecordView[], stage: string): number {
  return items.length ? items.filter((item) => item.stages[stage] && item.provenance[stage]).length / items.length : 0;
}

function quality(items: TimelinessRecordView[]): TimelinessWorkbenchDto["quality"] {
  const fields = STAGES.map(([, name]) => {
    const presentCount = items.filter((item) => item.stages[name]).length;
    return { name, presentCount, missingCount: items.length - presentCount, coverage: items.length ? presentCount / items.length : 0 };
  });
  const issueCounts = (records: TimelinessRecordView[]) => countStrings(records.flatMap((item) => item.timestampAnomalies));
  return {
    fields,
    issues: namedCounts(issueCounts(items)),
    bySourceClass: groups(items, (item) => item.sourceFamily ?? "unclassified").map(([name, records]) => ({
      name,
      recordCount: records.length,
      missing: Object.fromEntries(STAGES.map(([, stage]) => [stage, records.filter((item) => !item.stages[stage]).length])),
      issues: Object.fromEntries(issueCounts(records)),
    })),
  };
}

function groupedMetrics(items: TimelinessRecordView[], key: (item: TimelinessRecordView) => string) {
  return groups(items, key).map(([name, records]) => ({ name, recordCount: records.length, metrics: metrics(records) }));
}

function actorName(incident: JsonObject | undefined, entities: JsonObject[], incidentId: string, captureId: string): string | undefined {
  const direct = string(incident?.actorName) ?? string(incident?.actor) ?? string(incident?.canonicalActorName) ?? string(object(incident?.metadata)?.actorName);
  if (direct) return direct;
  return string(entities.find((entity) => string(entity.type) === "actor" && (string(entity.incidentId) === incidentId || string(entity.captureId) === captureId))?.value);
}

function reportReferences(record: JsonObject): JsonObject[] {
  return objectArray(record.reportTimestamps).flatMap((reference) => {
    const role = string(reference.role);
    const timestamp = zonedIso(reference.timestamp);
    const extractionMethod = string(reference.extractionMethod);
    const hasStoredLineage = string(reference.sourceId) && string(reference.captureId) && string(reference.evidencePath);
    const hasAcceptedOrigin = extractionMethod === "source_field" || extractionMethod === "public_reference" && string(reference.referenceUrl);
    if (!timestamp || !["actor", "victim", "publisher"].includes(role ?? "") || !hasStoredLineage || !hasAcceptedOrigin) return [];
    return [{ ...reference, id: string(reference.id) ?? stableId("timeliness-reference", `${string(record.incidentId)}:${role}:${timestamp}:${string(reference.referenceUrl)}:${string(reference.evidencePath)}`), role, timestamp }];
  });
}

function sortReferences(values: JsonObject[]): JsonObject[] {
  const deduped = new Map(values.map((value) => [requiredString(value, "id"), value]));
  return [...deduped.values()].sort((left, right) => Date.parse(requiredString(left, "timestamp")) - Date.parse(requiredString(right, "timestamp")) || roleRank(string(left.role)) - roleRank(string(right.role)));
}

function roleRank(value?: string): number { return value === "actor" ? 0 : value === "victim" ? 1 : 2; }
function priority(value: TimelinessQueueStatus): number { return ["unresolved_reference", "anomaly", "awaiting_alert", "awaiting_delivery", "complete"].indexOf(value); }
function count(items: TimelinessRecordView[], status: TimelinessQueueStatus): number { return items.filter((item) => item.status === status).length; }
function coverage(items: TimelinessRecordView[], field: string): number { return items.length ? items.filter((item) => validMetric(item, field)).length / items.length : 0; }
function elapsed(from?: string, to?: string): number | undefined { const start = Date.parse(from ?? ""), end = Date.parse(to ?? ""); return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 1000) : undefined; }
function percentile(values: number[], value: number): number | null { return values.length ? values[Math.min(values.length - 1, Math.ceil(values.length * value) - 1)] : null; }
function groups(items: TimelinessRecordView[], key: (item: TimelinessRecordView) => string): Array<[string, TimelinessRecordView[]]> { const result = new Map<string, TimelinessRecordView[]>(); for (const item of items) result.set(key(item), [...(result.get(key(item)) ?? []), item]); return [...result].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])); }
function validationIndex(values: JsonObject[]): Map<string, JsonObject[]> { const result = new Map<string, JsonObject[]>(); for (const value of values) for (const key of [string(value.incidentId), string(value.captureId)]) if (key) result.set(key, [...(result.get(key) ?? []), value]); return result; }
function uniqueObjects(values: JsonObject[]): JsonObject[] { return [...new Map(values.map((value) => [string(value.id) ?? JSON.stringify(value), value])).values()]; }
function countStrings(values: string[]): Map<string, number> { const result = new Map<string, number>(); for (const value of values) result.set(value, (result.get(value) ?? 0) + 1); return result; }
function namedCounts(values: Map<string, number>): Array<{ name: string; count: number }> { return [...values].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)); }
function index(values: JsonObject[] | undefined, key: string): Map<string, JsonObject> { return new Map((values ?? []).flatMap((value) => string(value[key]) ? [[string(value[key])!, value] as const] : [])); }
function object(value: unknown): JsonObject | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined; }
function objectArray(value: unknown): JsonObject[] { return Array.isArray(value) ? value.flatMap((item) => object(item) ? [object(item)!] : []) : []; }
function string(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.flatMap((item) => string(item) ? [string(item)!] : []) : []; }
function numberRecord(value: unknown): Record<string, number | undefined> { const record = object(value); return Object.fromEntries(Object.entries(record ?? {}).map(([key, item]) => [key, typeof item === "number" && Number.isFinite(item) ? item : undefined])); }
function requiredString(record: JsonObject, key: string): string { const value = string(record[key]); if (!value) throw new Error(`Timeliness record is missing ${key}`); return value; }
function validIso(value: unknown): string | undefined { const time = Date.parse(String(value ?? "")); return Number.isFinite(time) ? new Date(time).toISOString() : undefined; }
function zonedIso(value: unknown): string | undefined { const raw = string(value); return raw && /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) ? validIso(raw) : undefined; }
function requiredIso(value: unknown, label: string): string { const result = validIso(value); if (!result) throw new Error(`Invalid ${label}`); return result; }
function requiredZonedIso(value: unknown, label: string): string { const result = zonedIso(value); if (!result) throw new Error(`Invalid ${label}; include an explicit timezone`); return result; }
function sameTime(left: unknown, right: unknown): boolean { const a = validIso(left), b = validIso(right); return Boolean(a && b && a === b); }
function cleanText(value: unknown, max: number): string | undefined { const result = string(value)?.replace(/\s+/g, " "); return result?.slice(0, max); }
