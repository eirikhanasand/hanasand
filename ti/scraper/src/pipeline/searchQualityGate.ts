import type { EvidenceStage, TiConfidenceCaveatCode } from "./intelligenceProfiles.ts";
import type { ExtractionQualityNoteCode } from "./evaluation.ts";
export type { AnalystCaveatPack, GraphReviewState, SearchQualityAnalystActionSummaryDto, SearchQualityApiDto, SearchQualityApiExampleDto, SearchQualityApplyActionDto, SearchQualityApplyActionKind, SearchQualityApplyPlanDto, SearchQualityDashboardDto, SearchQualityDashboardField, SearchQualityDashboardGate, SearchQualityFieldGateDto, SearchQualityGateInput, SearchQualityGateResult, SearchQualityPublicWarningCode, SearchQualityStatus } from "./searchQualityTypes.ts";
import type { GraphReviewState, SearchQualityApiDto, SearchQualityApplyActionDto, SearchQualityApplyActionKind, SearchQualityApplyPlanDto, SearchQualityGateInput, SearchQualityGateResult, SearchQualityPublicWarningCode, SearchQualityStatus } from "./searchQualityTypes.ts";
import { analystCaveatPackFor, analystCaveatPacks } from "./searchQualityPacks.ts";
import { reason, unique } from "./searchQualityReasons.ts";
export { analystCaveatPackFor, analystCaveatPacks } from "./searchQualityPacks.ts";
export { buildSearchQualityDashboardDto } from "./searchQualityDashboard.ts";
export { searchQualityApiExamples } from "./searchQualityExamples.ts";
const RANK: SearchQualityStatus[] = ["contradicted", "stale", "source-biased", "partial", "insufficient-capture", "weak-evidence", "needs-review", "ready"];
export function evaluateSearchQualityGate(input: SearchQualityGateInput): SearchQualityGateResult {
  const dto = input.dto, caveatCodes = (dto.caveats ?? []).map((c: any) => c.code), qualityNoteCodes = calibrationNotes(dto, input.calibration);
  const supportingStatuses = statusesFor(dto, caveatCodes, qualityNoteCodes, input.graphReviewState), status = supportingStatuses.sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b))[0] ?? "partial";
  return { status, supportingStatuses, score: scoreFor(dto, supportingStatuses), reasons: reasonsFor(dto, supportingStatuses, caveatCodes, qualityNoteCodes, input.graphReviewState), caveatCodes, qualityNoteCodes, caveatPack: analystCaveatPackFor(dto.actor || dto.query), apiWarnings: warningsFor(supportingStatuses, caveatCodes, qualityNoteCodes) };
}
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
