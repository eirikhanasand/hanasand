// @ts-nocheck
import type { SearchQualityDashboardDto, SearchQualityFieldGateDto, SearchQualityGateResult } from "./searchQualityTypes.ts";
import { ratio, unique } from "./searchQualityReasons.ts";

export function buildSearchQualityDashboardDto(dto: any, gate: SearchQualityGateResult, generatedAt = new Date().toISOString()): SearchQualityDashboardDto {
  const fields = dashboardFields(dto, gate), hold = gate.status === "contradicted" || fields.some((f) => f.gate === "hold"), promote = gate.status === "ready" && fields.every((f) => !["hold", "missing"].includes(f.gate));
  return { schemaVersion: "ti.search_quality_dashboard.v1", query: dto.query, generatedAt, status: gate.status, score: gate.score, metrics: { usefulAnswerRate: ratio(fields.filter((f) => ["pass", "warn"].includes(f.gate)).length / fields.length), expectedFactRecall: ratio(fields.filter((f) => f.evidenceCount > 0).length / fields.length), sourceFamilyDiversity: sourceFamilies(dto).length, evidenceCount: (dto.provenance ?? []).length, citationAvailability: ratio(citations(dto) / Math.max(1, (dto.provenance ?? []).length)), freshnessScore: ratio(dto.recentActivity?.freshnessScore ?? 0) }, releaseGate: { decision: promote ? "promote" : hold ? "hold" : "partial", reasons: unique([...gate.reasons, ...fields.filter((f) => ["hold", "missing"].includes(f.gate)).map((f) => `${f.field}: ${f.reasons[0] ?? f.gate}`)]).slice(0, 12) }, fields, reviewQueues: { sourceActivation: queue(fields, "source_activation"), parserRepair: queue(fields, "parser_repair"), graphReview: queue(fields, "graph_review"), analystReview: queue(fields, "analyst_review") } };
}

const fields: Array<[SearchQualityDashboardDto["fields"][number]["field"], (d: any) => number]> = [["actor_summary", (d) => d.summaryBullets?.length ?? 0], ["aliases", (d) => d.aliases?.length ?? 0], ["recent_activity", (d) => d.recentActivity?.notes?.length || d.recentActivity?.lastSeen ? 1 : 0], ["targets", (d) => d.targets?.victims?.length ?? 0], ["sectors", (d) => d.targets?.sectors?.length ?? 0], ["countries", (d) => d.targets?.regions?.length ?? 0], ["tools_malware", (d) => d.malwareTools?.length ?? 0], ["cves", (d) => d.vulnerabilities?.length ?? 0], ["ttps", (d) => d.ttps?.length ?? 0], ["campaigns", (d) => d.campaigns?.length ?? 0], ["infrastructure", (d) => d.infrastructure?.length ?? 0], ["datasets", (d) => d.datasets?.coverage?.length ?? 0], ["victim_company_claims", (d) => d.targets?.victims?.length ?? 0], ["iocs", (d) => d.datasets?.indicatorCount ?? 0], ["confidence", (d) => d.confidence >= 0.35 ? 1 : 0], ["freshness", (d) => d.recentActivity?.freshnessScore > 0 ? 1 : 0], ["provenance", (d) => d.provenance?.length ?? 0]];

function dashboardFields(dto: any, gate: SearchQualityGateResult): SearchQualityFieldGateDto[] {
  return fields.map(([field, fn]) => { const evidenceCount = fn(dto), confidence = field === "freshness" ? dto.recentActivity?.freshnessScore ?? 0 : dto.confidence ?? 0, reasons = unique([...(evidenceCount ? [] : ["field has no supporting extracted evidence"]), ...(gate.supportingStatuses.includes("contradicted") ? ["contradicted evidence prevents promotion"] : []), ...(confidence < 0.35 ? ["field confidence is low"] : [])]); const g = gate.supportingStatuses.includes("contradicted") ? "hold" : evidenceCount === 0 ? "missing" : confidence < 0.35 || reasons.some((r) => /stale|review|low/i.test(r)) ? "warn" : "pass"; return { field, gate: g, confidence: ratio(confidence), evidenceCount, citationCount: citations(dto), freshnessScore: ratio(dto.recentActivity?.freshnessScore ?? 0), reasons, feedbackTargets: targets(g, reasons, field) }; });
}

function targets(gate: string, reasons: string[], field: string) {
  const t = new Set<string>();
  if (gate === "missing") t.add("source_activation");
  if (reasons.some((r) => /extracted|parser|IOC|CVE|TTP|malware|infrastructure/i.test(r))) t.add("parser_repair");
  if (reasons.some((r) => /contradicted|stale|source-family/i.test(r))) t.add("graph_review");
  if (reasons.some((r) => /review|victim|company|low/i.test(r))) t.add("analyst_review");
  if (["hold", "missing"].includes(gate) || ["confidence", "freshness"].includes(field)) t.add("public_answer_hold");
  return [...t] as any;
}

const queue = (fields: SearchQualityFieldGateDto[], target: string) => fields.filter((f) => f.feedbackTargets.includes(target as any)).map((f) => `${f.field}: ${f.reasons[0] ?? f.gate}`).slice(0, 12);
const sourceFamilies = (dto: any) => unique((dto.provenance ?? []).map((p: any) => String(p.sourceId ?? "").split("_").slice(0, 3).join("_")).filter(Boolean));
const citations = (dto: any) => (dto.provenance ?? []).filter((p: any) => p.ledgerIds?.length || p.captureId || p.url).length;
