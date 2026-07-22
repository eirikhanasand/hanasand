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
  generatedAt?: string;
};

export type TimelinessMetric = {
  sampleSize: number;
  medianSeconds: number | null;
  p95Seconds: number | null;
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
  schemaVersion: "ti.timeliness_workbench.v1";
  generatedAt: string;
  summary: {
    recordCount: number;
    unresolvedReferenceCount: number;
    anomalyCount: number;
    awaitingAlertCount: number;
    awaitingDeliveryCount: number;
    completeCount: number;
    reportToAlertCoverage: number;
    reportToDeliveredCoverage: number;
  };
  metrics: {
    overall: Record<string, TimelinessMetric>;
    bySourceFamily: Array<{ name: string; recordCount: number; metrics: Record<string, TimelinessMetric> }>;
    byActor: Array<{ name: string; recordCount: number; metrics: Record<string, TimelinessMetric> }>;
    byStage: Array<{ name: string } & TimelinessMetric>;
  };
  items: TimelinessRecordView[];
};

const STAGES = [
  ["firstReportedAt", "first_report"],
  ["publishedAt", "publication"],
  ["collectedAt", "collection"],
  ["processedAt", "processing"],
  ["firstVisibleAt", "first_visible"],
  ["alertCreatedAt", "alert_created"],
  ["deliveryAttemptedAt", "delivery_attempt"],
  ["deliveredAt", "delivered"],
] as const;

const INTERVALS = [
  ["reportToPublicationSeconds", "firstReportedAt", "publishedAt"],
  ["firstReportToCollectionSeconds", "firstReportedAt", "collectedAt"],
  ["publicationToCollectionSeconds", "publishedAt", "collectedAt"],
  ["collectionToProcessingSeconds", "collectedAt", "processedAt"],
  ["processingToVisibilitySeconds", "processedAt", "firstVisibleAt"],
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
  const timestamp = requiredIso(input.timestamp, "reference timestamp");
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
  const items = records.map((record) => {
    const derived = deriveTimeliness(record, generatedAt);
    const incidentId = requiredString(derived, "incidentId");
    const captureId = requiredString(derived, "captureId");
    const sourceId = requiredString(derived, "sourceId");
    const incident = incidents.get(incidentId);
    const capture = captures.get(captureId);
    const source = sources.get(sourceId);
    return toView(derived, {
      actorName: actorName(incident, entities, incidentId, captureId),
      sourceName: string(source?.name),
      sourceFamily: string(object(source?.metadata)?.sourceFamily) ?? string(source?.type),
      title: string(incident?.title) ?? string(capture?.title),
    });
  }).sort((left, right) => priority(left.status) - priority(right.status) || Date.parse(right.updatedAt ?? "") - Date.parse(left.updatedAt ?? ""));
  const overall = metrics(items);
  return {
    schemaVersion: "ti.timeliness_workbench.v1",
    generatedAt,
    summary: {
      recordCount: items.length,
      unresolvedReferenceCount: count(items, "unresolved_reference"),
      anomalyCount: count(items, "anomaly"),
      awaitingAlertCount: count(items, "awaiting_alert"),
      awaitingDeliveryCount: count(items, "awaiting_delivery"),
      completeCount: count(items, "complete"),
      reportToAlertCoverage: coverage(items, "reportToAlertSeconds"),
      reportToDeliveredCoverage: coverage(items, "reportToDeliveredSeconds"),
    },
    metrics: {
      overall,
      bySourceFamily: groupedMetrics(items, (item) => item.sourceFamily ?? "unclassified"),
      byActor: groupedMetrics(items, (item) => item.actorName ?? "unattributed"),
      byStage: Object.entries(overall).map(([name, metric]) => ({ name, ...metric })),
    },
    items,
  };
}

function deriveTimeliness(input: JsonObject, generatedAt: string): JsonObject {
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
  const zeroSecondEvidence = zeroEvidence(record, latencies);
  return { ...record, latencies, zeroSecondEvidence, timestampAnomalies: anomalies(record, latencies, zeroSecondEvidence, generatedAt) };
}

function toView(record: JsonObject, labels: { actorName?: string; sourceName?: string; sourceFamily?: string; title?: string }): TimelinessRecordView {
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
    provenance: stageProvenance(record),
    reportReferences: reportReferences(record),
    latencies: numberRecord(record.latencies),
    timestampAnomalies,
    updatedAt: string(record.updatedAt),
  };
}

function statusFor(stages: Record<string, string | undefined>, anomalies: string[]): TimelinessQueueStatus {
  if (!stages.first_report) return "unresolved_reference";
  if (anomalies.length) return "anomaly";
  if (!stages.alert_created) return "awaiting_alert";
  if (!stages.delivery_attempt || !stages.delivered) return "awaiting_delivery";
  return "complete";
}

function stageProvenance(record: JsonObject): Record<string, JsonObject | undefined> {
  const captureId = string(record.captureId);
  const incidentId = string(record.incidentId);
  const sourceId = string(record.sourceId);
  return {
    first_report: object(record.firstReportedProvenance),
    publication: string(record.publishedAt) ? { event: "publication", sourceId, captureId, timestamp: record.publishedAt, evidencePath: "capture.publishedAt" } : undefined,
    collection: string(record.collectedAt) ? { event: "collection", sourceId, captureId, timestamp: record.collectedAt, evidencePath: "capture.collectedAt" } : undefined,
    processing: string(record.processedAt) ? { event: "processing", captureId, timestamp: record.processedAt, evidencePath: "capture.processedAt" } : undefined,
    first_visible: string(record.firstVisibleAt) ? { event: "first_visible", incidentId, timestamp: record.firstVisibleAt, evidencePath: "incident.firstVisibleAt" } : undefined,
    alert_created: object(record.alertCreatedProvenance),
    delivery_attempt: object(record.deliveryAttemptProvenance),
    delivered: object(record.deliveredProvenance),
  };
}

function latencyFields(record: JsonObject): Record<string, number | undefined> {
  return Object.fromEntries(INTERVALS.map(([name, from, to]) => [name, elapsed(string(record[from]), string(record[to]))]));
}

function zeroEvidence(record: JsonObject, latencies: Record<string, number | undefined>): JsonObject {
  const provenance = stageProvenance(record);
  const byField = new Map(STAGES.map(([field, stage]) => [field, stage]));
  return Object.fromEntries(INTERVALS.flatMap(([name, from, to]) => latencies[name] === 0 ? [[name, {
    verified: Boolean(provenance[byField.get(from)!] && provenance[byField.get(to)!]),
    from: record[from],
    to: record[to],
    fromEvidence: provenance[byField.get(from)!],
    toEvidence: provenance[byField.get(to)!],
  }]] : []));
}

function anomalies(record: JsonObject, latencies: Record<string, number | undefined>, zeroSecondEvidence: JsonObject, generatedAt: string): string[] {
  const result = new Set<string>();
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
  };
}

function groupedMetrics(items: TimelinessRecordView[], key: (item: TimelinessRecordView) => string) {
  const groups = new Map<string, TimelinessRecordView[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return [...groups].map(([name, records]) => ({ name, recordCount: records.length, metrics: metrics(records) })).sort((a, b) => b.recordCount - a.recordCount || a.name.localeCompare(b.name));
}

function actorName(incident: JsonObject | undefined, entities: JsonObject[], incidentId: string, captureId: string): string | undefined {
  const direct = string(incident?.actorName) ?? string(incident?.actor) ?? string(incident?.canonicalActorName) ?? string(object(incident?.metadata)?.actorName);
  if (direct) return direct;
  return string(entities.find((entity) => string(entity.type) === "actor" && (string(entity.incidentId) === incidentId || string(entity.captureId) === captureId))?.value);
}

function reportReferences(record: JsonObject): JsonObject[] {
  return objectArray(record.reportTimestamps).flatMap((reference) => {
    const role = string(reference.role);
    const timestamp = validIso(reference.timestamp);
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
function index(values: JsonObject[] | undefined, key: string): Map<string, JsonObject> { return new Map((values ?? []).flatMap((value) => string(value[key]) ? [[string(value[key])!, value] as const] : [])); }
function object(value: unknown): JsonObject | undefined { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined; }
function objectArray(value: unknown): JsonObject[] { return Array.isArray(value) ? value.flatMap((item) => object(item) ? [object(item)!] : []) : []; }
function string(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.flatMap((item) => string(item) ? [string(item)!] : []) : []; }
function numberRecord(value: unknown): Record<string, number | undefined> { const record = object(value); return Object.fromEntries(Object.entries(record ?? {}).map(([key, item]) => [key, typeof item === "number" && Number.isFinite(item) ? item : undefined])); }
function requiredString(record: JsonObject, key: string): string { const value = string(record[key]); if (!value) throw new Error(`Timeliness record is missing ${key}`); return value; }
function validIso(value: unknown): string | undefined { const time = Date.parse(String(value ?? "")); return Number.isFinite(time) ? new Date(time).toISOString() : undefined; }
function requiredIso(value: unknown, label: string): string { const result = validIso(value); if (!result) throw new Error(`Invalid ${label}`); return result; }
function cleanText(value: unknown, max: number): string | undefined { const result = string(value)?.replace(/\s+/g, " "); return result?.slice(0, max); }
