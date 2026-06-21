import type { EvidenceStage, TiConfidenceCaveatCode } from "./intelligenceProfiles.ts";
import type { ExtractionQualityNoteCode } from "./evaluation.ts";
export type { AnalystCaveatPack, GraphReviewState, SearchQualityAnalystActionSummaryDto, SearchQualityApiDto, SearchQualityApiExampleDto, SearchQualityApplyActionDto, SearchQualityApplyActionKind, SearchQualityApplyPlanDto, SearchQualityDashboardDto, SearchQualityDashboardField, SearchQualityDashboardGate, SearchQualityFieldGateDto, SearchQualityGateInput, SearchQualityGateResult, SearchQualityPublicWarningCode, SearchQualityStatus } from "./searchQualityTypes.ts";
import type { AnalystCaveatPack, GraphReviewState, SearchQualityApiDto, SearchQualityApiExampleDto, SearchQualityApplyActionDto, SearchQualityApplyActionKind, SearchQualityApplyPlanDto, SearchQualityDashboardDto, SearchQualityFieldGateDto, SearchQualityGateInput, SearchQualityGateResult, SearchQualityPublicWarningCode, SearchQualityStatus } from "./searchQualityTypes.ts";

const RANK: SearchQualityStatus[] = ["contradicted", "stale", "source-biased", "partial", "insufficient-capture", "weak-evidence", "needs-review", "ready"];
const PACKS: Record<string, AnalystCaveatPack> = {
  apt29: pack("APT29", "APT29 reporting is alias-heavy; separate current activity from historical tradecraft.", ["current campaign dates", "victim attribution", "TTP freshness"]),
  "scattered spider": pack("Scattered Spider", "Scattered Spider reporting often overlaps adjacent cybercrime naming.", ["alias collision", "social engineering TTPs", "victim confidence"]),
  "volt typhoon": pack("Volt Typhoon", "Volt Typhoon infrastructure claims require freshness and source diversity.", ["critical infrastructure targeting", "contradictions"]),
  turla: pack("Turla", "Turla profiles often include long-lived tooling and stale background material.", ["staleness", "current victim claims"]),
  akira: pack("Akira", "Akira evidence often arrives as metadata-only victim claims.", ["victim claim strength", "restricted metadata"]),
  muddywater: pack("MuddyWater", "MuddyWater reporting mixes vendor aliases, campaigns, and malware names.", ["alias mapping", "government targeting"]),
  shinyhunters: pack("ShinyHunters", "ShinyHunters reporting has naming drift with adjacent cybercrime clusters.", ["alias collision", "relationship confidence"]),
  unknown: pack("Unknown actor", "Unknown actor searches stay partial until attributed evidence is captured.", ["low evidence count", "capture completeness"])
};

export function evaluateSearchQualityGate(input: SearchQualityGateInput): SearchQualityGateResult {
  const dto = input.dto, caveatCodes = (dto.caveats ?? []).map((c: any) => c.code), qualityNoteCodes = calibrationNotes(dto, input.calibration);
  const supportingStatuses = statusesFor(dto, caveatCodes, qualityNoteCodes, input.graphReviewState), status = supportingStatuses.sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b))[0] ?? "partial";
  return { status, supportingStatuses, score: scoreFor(dto, supportingStatuses), reasons: reasonsFor(dto, supportingStatuses, caveatCodes, qualityNoteCodes, input.graphReviewState), caveatCodes, qualityNoteCodes, caveatPack: analystCaveatPackFor(dto.actor || dto.query), apiWarnings: warningsFor(supportingStatuses, caveatCodes, qualityNoteCodes) };
}

export const analystCaveatPackFor = (actor: string): AnalystCaveatPack => PACKS[String(actor).toLowerCase()] ?? PACKS.unknown;
export const analystCaveatPacks = (): AnalystCaveatPack[] => Object.values(PACKS);

export function buildSearchQualityApplyPlan(dto: any, gate: SearchQualityGateResult): SearchQualityApplyPlanDto {
  const ids = (dto.provenance ?? []).map((p: any) => p.evidenceId), actions: SearchQualityApplyActionDto[] = [];
  const add = (kind: SearchQualityApplyActionKind, label = kind.replaceAll("_", " "), manualOnly = false) => actions.push({ kind, label, prerequisites: [], evidenceIds: ids, expectedApiEffect: label, graphEffect: label, rollback: "recompute quality from original evidence", manualOnly });
  if (gate.supportingStatuses.includes("needs-review")) add("analyst_review", "Request analyst review", true);
  if (gate.supportingStatuses.includes("weak-evidence")) add("lower_confidence", "Lower confidence");
  if (gate.supportingStatuses.some((s) => ["insufficient-capture", "partial", "source-biased"].includes(s))) add("request_more_capture_evidence", "Request more capture evidence");
  if (hasAliasCollisionWarning(dto, gate)) add("suppress_noisy_alias", "Suppress noisy alias", true);
  if (gate.supportingStatuses.includes("contradicted")) add("mark_contradiction", "Mark contradiction", true);
  if (gate.supportingStatuses.includes("stale")) add("expire_stale_claim", "Expire stale claim", true);
  const canPromoteToReady = canPromote(gate, dto);
  if (canPromoteToReady) add("promote_quality_status", "Promote quality status");
  return { query: dto.query, currentStatus: gate.status, targetStatus: canPromoteToReady ? "ready" : gate.status, canPromoteToReady, actions };
}

export function buildSearchQualityApiDto(dto: any, gate: SearchQualityGateResult): SearchQualityApiDto {
  const plan = buildSearchQualityApplyPlan(dto, gate), alias = hasAliasCollisionWarning(dto, gate);
  const publicWarningCodes = [...gate.apiWarnings.map((w) => w.code), ...(alias ? ["alias_collision_warning" as const] : [])];
  return { status: gate.status, score: gate.score, caveatCodes: gate.caveatCodes, qualityNoteCodes: gate.qualityNoteCodes, evidenceStageCounts: dto.datasets.evidenceStageCounts, analystActions: plan.actions.map(({ kind, label, manualOnly, evidenceIds }) => ({ kind, label, manualOnly, evidenceIds })), canPromoteToReady: plan.canPromoteToReady, publicWarningText: [...new Set([...gate.apiWarnings.map((w) => w.message), ...(alias ? ["actor aliases or ransomware rebrand overlap require analyst review before public promotion"] : []), ...(gate.apiWarnings.length ? [] : [gate.status === "ready" ? "quality gate is ready with durable or reviewed evidence" : reason(gate.status)]), ...(dto.falsePositiveControls ?? [])])], publicWarningCodes: [...new Set(publicWarningCodes)] as SearchQualityPublicWarningCode[] };
}

export function buildSearchQualityDashboardDto(dto: any, gate: SearchQualityGateResult, generatedAt = new Date().toISOString()): SearchQualityDashboardDto {
  const fields = dashboardFields(dto, gate), hold = gate.status === "contradicted" || fields.some((f) => f.gate === "hold"), promote = gate.status === "ready" && fields.every((f) => !["hold", "missing"].includes(f.gate));
  return { schemaVersion: "ti.search_quality_dashboard.v1", query: dto.query, generatedAt, status: gate.status, score: gate.score, metrics: { usefulAnswerRate: ratio(fields.filter((f) => ["pass", "warn"].includes(f.gate)).length / fields.length), expectedFactRecall: ratio(fields.filter((f) => f.evidenceCount > 0).length / fields.length), sourceFamilyDiversity: sourceFamilies(dto).length, evidenceCount: (dto.provenance ?? []).length, citationAvailability: ratio(citations(dto) / Math.max(1, (dto.provenance ?? []).length)), freshnessScore: ratio(dto.recentActivity?.freshnessScore ?? 0) }, releaseGate: { decision: promote ? "promote" : hold ? "hold" : "partial", reasons: unique([...gate.reasons, ...fields.filter((f) => ["hold", "missing"].includes(f.gate)).map((f) => `${f.field}: ${f.reasons[0] ?? f.gate}`)]).slice(0, 12) }, fields, reviewQueues: { sourceActivation: queue(fields, "source_activation"), parserRepair: queue(fields, "parser_repair"), graphReview: queue(fields, "graph_review"), analystReview: queue(fields, "analyst_review") } };
}

export function searchQualityApiExamples(): SearchQualityApiExampleDto[] {
  return ["ready", "partial", "weak-evidence", "contradicted", "stale", "source-biased", "insufficient-capture", "needs-review"].map((status) => example(status as SearchQualityStatus));
}

function statusesFor(dto: any, caveats: TiConfidenceCaveatCode[], notes: ExtractionQualityNoteCode[], graph?: GraphReviewState): SearchQualityStatus[] {
  const s = new Set<SearchQualityStatus>(), c = dto.datasets.evidenceStageCounts, durable = (c.captured_page ?? 0) + (c.reviewed_promoted ?? 0) + (c.extracted_relationship ?? 0), partial = (c.live_discovery ?? 0) + (c.public_channel_message ?? 0) + (c.metadata_only_claim ?? 0) + (c.seeded ?? 0);
  if (graph === "contradiction" || caveats.includes("contradicted")) s.add("contradicted");
  if (graph === "stale" || caveats.includes("stale") || notes.includes("stale_source")) s.add("stale");
  if (notes.includes("source_family_bias") || ((c.public_channel_message > 0 || c.metadata_only_claim > 0 || c.seeded > 0) && durable === 0)) s.add("source-biased");
  if (durable === 0 && partial > 0) s.add("insufficient-capture");
  if ((dto.confidence ?? 0) < 0.35 || notes.includes("low_evidence_count") || (dto.datasets.entityCount ?? 0) + (dto.datasets.indicatorCount ?? 0) < 2) s.add("weak-evidence");
  if (dto.needsAnalystReview || graph === "needs-human-review" || notes.includes("weak_victim_claim") || notes.includes("extracted_ttp_needs_review")) s.add("needs-review");
  if (partial > 0 || (dto.caveats ?? []).some((c: any) => c.severity !== "info")) s.add("partial");
  if ((!s.size || graph === "accepted") && (dto.confidence ?? 0) >= 0.65 && durable > 0 && !s.has("contradicted") && !s.has("stale")) s.add("ready");
  return [...s];
}

function calibrationNotes(dto: any, calibration?: any): ExtractionQualityNoteCode[] {
  const active = Object.entries(dto.datasets.evidenceStageCounts ?? {}).filter(([, n]) => Number(n) > 0).map(([s]) => s);
  return unique((calibration?.evidenceStageReports ?? []).filter((r: any) => active.includes(r.evidenceStage)).flatMap((r: any) => (r.qualityNotes ?? []).map((n: any) => n.code)));
}

function scoreFor(dto: any, statuses: SearchQualityStatus[]) {
  const penalties: Record<string, number> = { contradicted: 0.5, stale: 0.25, "source-biased": 0.15, "insufficient-capture": 0.2, "weak-evidence": 0.25, "needs-review": 0.12, partial: 0.08 };
  const durable = ["captured_page", "extracted_relationship", "reviewed_promoted"].some((k) => (dto.datasets.evidenceStageCounts[k] ?? 0) > 0);
  return Math.max(0, Math.min(1, (dto.confidence ?? 0) + (durable ? 0.2 : 0) - Math.min(0.35, statuses.reduce((n, s) => n + (penalties[s] ?? 0), 0))));
}

const canPromote = (gate: SearchQualityGateResult, dto: any) => gate.status === "ready" && gate.score >= 0.65 && !gate.supportingStatuses.some((s) => s !== "ready") && ["captured_page", "extracted_relationship", "reviewed_promoted"].some((k) => (dto.datasets.evidenceStageCounts[k] ?? 0) > 0);
const hasAliasCollisionWarning = (dto: any, gate: SearchQualityGateResult) => gate.qualityNoteCodes.includes("alias_collision") || (dto.falsePositiveControls ?? []).some((r: string) => /alias collision|rebrand overlap/i.test(r));
const warningsFor = (statuses: SearchQualityStatus[], caveats: TiConfidenceCaveatCode[], notes: ExtractionQualityNoteCode[]) => [...statuses.filter((s) => s !== "ready").map((code) => ({ code, message: reason(code), severity: code === "contradicted" ? "critical" as const : "warning" as const })), ...caveats.map((code) => ({ code, message: `confidence caveat: ${code}`, severity: ["contradicted", "metadata_only_leak_claim"].includes(code) ? "critical" as const : "warning" as const })), ...notes.map((code) => ({ code, message: `quality note: ${code}`, severity: code === "contradicted_attribution" ? "critical" as const : "warning" as const }))];
const reasonsFor = (dto: any, statuses: SearchQualityStatus[], caveats: TiConfidenceCaveatCode[], notes: ExtractionQualityNoteCode[], graph?: GraphReviewState) => [...statuses.map(reason), ...(graph ? [`graph review state: ${graph}`] : []), ...(caveats.length ? [`confidence caveats: ${caveats.join(", ")}`] : []), ...(notes.length ? [`quality notes: ${notes.join(", ")}`] : []), ...(dto.falsePositiveControls ?? [])];
const reason = (s: SearchQualityStatus) => ({ ready: "evidence is sufficiently captured and confident for ranked intelligence", partial: "result includes partial or caveated evidence", "weak-evidence": "evidence volume or confidence is weak", "needs-review": "analyst review is required before promotion", contradicted: "contradicted attribution or relationship signal is present", stale: "stale source or graph state is present", "source-biased": "source family coverage is narrow or biased", "insufficient-capture": "captured-page or reviewed evidence is insufficient" }[s]);
function pack(actor: string, summary: string, reviewFocus: string[]): AnalystCaveatPack { return { actor, summary, caveats: [summary], reviewFocus }; }
const fields: Array<[SearchQualityDashboardDto["fields"][number]["field"], (d: any) => number]> = [["actor_summary", (d) => d.summaryBullets?.length ?? 0], ["aliases", (d) => d.aliases?.length ?? 0], ["recent_activity", (d) => d.recentActivity?.notes?.length || d.recentActivity?.lastSeen ? 1 : 0], ["targets", (d) => d.targets?.victims?.length ?? 0], ["sectors", (d) => d.targets?.sectors?.length ?? 0], ["countries", (d) => d.targets?.regions?.length ?? 0], ["tools_malware", (d) => d.malwareTools?.length ?? 0], ["cves", (d) => d.vulnerabilities?.length ?? 0], ["ttps", (d) => d.ttps?.length ?? 0], ["campaigns", (d) => d.campaigns?.length ?? 0], ["infrastructure", (d) => d.infrastructure?.length ?? 0], ["datasets", (d) => d.datasets?.coverage?.length ?? 0], ["victim_company_claims", (d) => d.targets?.victims?.length ?? 0], ["iocs", (d) => d.datasets?.indicatorCount ?? 0], ["confidence", (d) => d.confidence >= 0.35 ? 1 : 0], ["freshness", (d) => d.recentActivity?.freshnessScore > 0 ? 1 : 0], ["provenance", (d) => d.provenance?.length ?? 0]];
function dashboardFields(dto: any, gate: SearchQualityGateResult): SearchQualityFieldGateDto[] { return fields.map(([field, fn]) => { const evidenceCount = fn(dto), confidence = field === "freshness" ? dto.recentActivity?.freshnessScore ?? 0 : dto.confidence ?? 0, reasons = unique([...(evidenceCount ? [] : ["field has no supporting extracted evidence"]), ...(gate.supportingStatuses.includes("contradicted") ? ["contradicted evidence prevents promotion"] : []), ...(confidence < 0.35 ? ["field confidence is low"] : [])]); const g = gate.supportingStatuses.includes("contradicted") ? "hold" : evidenceCount === 0 ? "missing" : confidence < 0.35 || reasons.some((r) => /stale|review|low/i.test(r)) ? "warn" : "pass"; return { field, gate: g, confidence: ratio(confidence), evidenceCount, citationCount: citations(dto), freshnessScore: ratio(dto.recentActivity?.freshnessScore ?? 0), reasons, feedbackTargets: targets(g, reasons, field) }; }); }
function targets(gate: string, reasons: string[], field: string) { const t = new Set<string>(); if (gate === "missing") t.add("source_activation"); if (reasons.some((r) => /extracted|parser|IOC|CVE|TTP|malware|infrastructure/i.test(r))) t.add("parser_repair"); if (reasons.some((r) => /contradicted|stale|source-family/i.test(r))) t.add("graph_review"); if (reasons.some((r) => /review|victim|company|low/i.test(r))) t.add("analyst_review"); if (["hold", "missing"].includes(gate) || ["confidence", "freshness"].includes(field)) t.add("public_answer_hold"); return [...t] as any; }
const queue = (fields: SearchQualityFieldGateDto[], target: string) => fields.filter((f) => f.feedbackTargets.includes(target as any)).map((f) => `${f.field}: ${f.reasons[0] ?? f.gate}`).slice(0, 12);
const sourceFamilies = (dto: any) => unique((dto.provenance ?? []).map((p: any) => String(p.sourceId ?? "").split("_").slice(0, 3).join("_")).filter(Boolean));
const citations = (dto: any) => (dto.provenance ?? []).filter((p: any) => p.ledgerIds?.length || p.captureId || p.url).length;
const ratio = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 100) / 100;
const unique = <T extends string>(v: T[]) => [...new Set(v.filter(Boolean))];
function example(status: SearchQualityStatus): SearchQualityApiExampleDto { const counts = zeroCounts(); counts[status === "ready" ? "captured_page" : "live_discovery"] = 1; const dto = { query: status, actor: status, summaryBullets: ["example"], aliases: [], recentActivity: { freshnessScore: 0.7, notes: ["example"] }, targets: { victims: [], sectors: [], regions: [] }, campaigns: [], ttps: [], infrastructure: [], malwareTools: [], vulnerabilities: [], datasets: { coverage: ["example"], sourceCount: 1, indicatorCount: 1, entityCount: 1, evidenceStageCounts: counts }, caveats: [], confidence: status === "ready" ? 0.86 : 0.46, provenance: [{ evidenceId: `example-${status}`, ledgerIds: ["ledger"], sourceId: "example_source", captureId: "cap", evidenceStage: "captured_page", grounding: [], confidence: 0.7 }], profileDeltas: [], falsePositiveControls: [], readiness: { fields: {}, sourceFamilyCount: 1, evidenceStageCounts: counts }, needsAnalystReview: status === "needs-review" }; const gate: SearchQualityGateResult = { status, supportingStatuses: [status], score: dto.confidence, reasons: [reason(status)], caveatCodes: [], qualityNoteCodes: [], caveatPack: analystCaveatPackFor(status), apiWarnings: status === "ready" ? [] : [{ code: status, message: reason(status), severity: status === "contradicted" ? "critical" : "warning" }] }; return { name: `${status} example`, query: status, quality: buildSearchQualityApiDto(dto, gate), dashboard: buildSearchQualityDashboardDto(dto, gate, "2026-05-24T00:00:00.000Z") }; }
function zeroCounts(): Record<EvidenceStage, number> { return { seeded: 0, live_discovery: 0, public_channel_message: 0, metadata_only_claim: 0, captured_page: 0, extracted_relationship: 0, reviewed_promoted: 0 }; }
