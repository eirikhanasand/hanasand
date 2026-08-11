import type { CaptureMetadataStore } from "../storage/evidenceStoreTypes.ts";

const QUERY_CLASSES = [
  { id: "threat_actor", label: "Threat actor", types: ["actor", "threat_actor"] },
  { id: "ransomware_group", label: "Ransomware group", types: ["ransomware_family", "ransomware"] },
  { id: "malware_family", label: "Malware family", types: ["malware", "malware_family", "malware_tool", "tool"] },
  { id: "cve", label: "CVE", types: ["cve", "vulnerability"] },
  { id: "domain", label: "Domain", types: ["domain", "hostname"] },
  { id: "company", label: "Company", types: ["company", "organization"] },
  { id: "country", label: "Country", types: ["country", "region", "geography"] },
  { id: "sector", label: "Sector", types: ["sector", "industry"] },
  { id: "campaign", label: "Campaign", types: ["campaign", "operation"] },
  { id: "infrastructure", label: "Infrastructure", types: ["infrastructure", "ip", "ipv4", "ipv6", "url", "sha256", "sha1", "md5"] },
  { id: "victim", label: "Victim", types: ["victim"] },
  { id: "leaked_data_claim", label: "Leaked-data claim", types: ["claim", "leak", "leaked_data", "ransomware_claim", "extortion_claim"] },
  { id: "ttp", label: "TTP", types: ["ttp", "attack_technique", "technique"] }
] as const;

export function buildQueryCoverageReport(store: CaptureMetadataStore, input: { tenantId?: string; generatedAt?: string } = {}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const inScope = (record: any) => input.tenantId ? record?.tenantId == null || record.tenantId === input.tenantId : true;
  const captures = store.listCaptures().filter(inScope);
  const entities = store.listExtractedEntities().filter(inScope);
  const indicators = store.listIndicators().filter(inScope);
  const incidents = store.listIncidents().filter(inScope);
  const claims = store.listIntelligenceClaims().filter(inScope);
  const labels = store.listEvaluationLabels().filter(inScope);
  const alerts = ((store as any).listDwmAlerts?.() ?? []).filter(inScope);
  return { schemaVersion: "ti.query_coverage.v1", generatedAt, queryClasses: QUERY_CLASSES.map(({ id, label }) => ({ id, label })), rows: QUERY_CLASSES.map((queryClass) => measure(queryClass, { captures, entities, indicators, incidents, claims, labels, alerts }, generatedAt)) };
}

function measure(queryClass: (typeof QUERY_CLASSES)[number], data: any, generatedAt: string) {
  const types = new Set(queryClass.types);
  const subjects = [...data.entities, ...data.indicators, ...data.incidents, ...data.claims].filter((record: any) => types.has(String(record.type ?? "").toLowerCase()));
  const subjectCaptureIds = new Set(subjects.map((record: any) => record.captureId).filter(Boolean).map(String));
  const matchingCaptures = data.captures.filter((capture: any) => subjectCaptureIds.has(String(capture.id)) || captureMatches(queryClass.id, capture));
  const captureIds = new Set(matchingCaptures.map((capture: any) => String(capture.id)));
  const matchingSubjects = subjects.filter((record: any) => !record.captureId || captureIds.has(String(record.captureId)));
  const sourceIds = new Set(matchingCaptures.map((capture: any) => capture.sourceId).filter(Boolean).map(String));
  const latest = [...matchingCaptures].filter((capture: any) => validDate(capture.collectedAt)).sort((a, b) => Date.parse(b.collectedAt) - Date.parse(a.collectedAt))[0];
  const published = [...matchingCaptures].filter((capture: any) => validDate(capture.publishedAt)).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0];
  const complete = matchingCaptures.filter((capture: any) => Boolean(capture.sourceId && capture.url && capture.collectedAt && (capture.body || capture.title) && capture.publishedAt)).length;
  const confidences = matchingSubjects.map((record: any) => Number(record.confidence)).filter(Number.isFinite);
  const matchedCaptureIds = new Set<string>();
  let alertCount = 0;
  for (const alert of data.alerts) {
    const evidence = Array.isArray(alert.evidence) ? alert.evidence : [];
    const ids = [alert.captureId, ...evidence.map((item: any) => item.captureId)].filter(Boolean).map(String);
    if (!ids.some((id) => captureIds.has(id))) continue;
    alertCount++;
    for (const id of ids) if (captureIds.has(id)) matchedCaptureIds.add(id);
  }
  const relevantLabels = data.labels.filter((label: any) => labelMatches(queryClass.id, label.labelType) && (!label.captureId || captureIds.has(String(label.captureId))));
  const falsePositives = relevantLabels.filter((label: any) => label.outcome === "false_positive").length;
  const firstResult = firstResultMeasurement(matchingCaptures, matchingSubjects);
  return {
    queryClass: queryClass.id,
    label: queryClass.label,
    timeToFirstResultMs: firstResult,
    resultCount: captureIds.size || matchingSubjects.length,
    sourceDiversity: sourceIds.size,
    freshness: latest ? { lastCollectedAt: latest.collectedAt, lastPublishedAt: published?.publishedAt ?? null, ageSeconds: ageSeconds(generatedAt, latest.collectedAt), publicationAgeSeconds: published ? ageSeconds(generatedAt, published.publishedAt) : null } : null,
    evidenceCompleteness: { score: matchingCaptures.length ? round(complete / matchingCaptures.length) : null, completeCount: complete, resultCount: matchingCaptures.length },
    extractionQuality: { averageConfidence: confidences.length ? round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length) : null, extractedEntityCount: matchingSubjects.length, confidenceSampleSize: confidences.length },
    falsePositiveRate: { rate: relevantLabels.length ? round(falsePositives / relevantLabels.length) : null, falsePositiveCount: falsePositives, labeledResultCount: relevantLabels.length },
    customerMatchBehavior: { matchedResultCount: matchedCaptureIds.size, alertCount, matchRate: captureIds.size ? round(matchedCaptureIds.size / captureIds.size) : null }
  };
}

function captureMatches(queryClass: string, capture: any) {
  if (queryClass !== "leaked_data_claim") return false;
  const metadata = capture.metadata ?? {};
  return metadata.exposureClaim === true || metadata.leakSite != null || /\b(?:leak|leaked|extortion|ransomware claim|stolen data)\b/i.test(`${capture.title ?? ""} ${capture.body ?? ""}`);
}
function labelMatches(queryClass: string, labelType: unknown) {
  const normalized = String(labelType ?? "").toLowerCase().replace(/_extraction$/, "");
  if (queryClass === "threat_actor") return normalized === "actor" || normalized === "alias";
  if (queryClass === "ransomware_group") return normalized === "ransomware_family" || normalized === "actor";
  if (queryClass === "malware_family") return normalized === "malware" || normalized === "tool";
  if (queryClass === "cve") return normalized === "cve" || normalized === "vulnerability";
  return normalized === queryClass || (queryClass === "victim" && normalized === "company") || (queryClass === "infrastructure" && normalized === "indicator");
}
function firstResultMeasurement(captures: any[], subjects: any[]) {
  const values = [...captures, ...subjects].flatMap((record: any) => [record.timeToFirstResultMs, record.metadata?.timeToFirstResultMs].map(Number)).filter(Number.isFinite);
  return { value: values.length ? Math.min(...values) : null, sampleSize: values.length, status: values.length ? "measured" : "unmeasured" };
}
function validDate(value: unknown) { return Number.isFinite(Date.parse(String(value ?? ""))); }
function ageSeconds(now: string, then: string) { return Math.max(0, (Date.parse(now) - Date.parse(then)) / 1000); }
function round(value: number) { return Number(value.toFixed(3)); }
