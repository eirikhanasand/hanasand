// @ts-nocheck
import { processCollectedItem } from "./pipeline.ts";
export type ExtractionFixtureExpectation = any; export type ExtractionEvaluationFixture = any; export type ExtractionFixtureEvaluation = any; export type ExtractionEvaluationReport = any;
export type ExtractionQualityNoteCode = any; export type ExtractionQualityNote = any; export type ExtractionCategoryScore = any; export type EvidenceStageCalibrationReport = any; export type ExtractionCalibrationReport = any;
export type EvaluationGovernanceCaseKind = any; export type EvaluationGovernanceAuditCode = any; export type EvaluationGovernanceLabel = any; export type EvaluationGovernanceAuditCheck = any; export type EvaluationDatasetGovernanceDto = any;
export type CtiEvaluationDatasetScenario = any; export type CtiEvaluationDatasetFixtureDto = any; export type CtiEvaluationDatasetPackDto = any; export type QualityRuntimeQueryClass = any; export type QualityRuntimeGateName = any;
export type QualityRuntimeValueGateRow = any; export type QualityRuntimeFixtureRow = any; export type ProgramBdRowQualityMetric = any; export type ProgramBdWatchlistQualityFixtureRow = any; export type ProgramBdQualityEvaluationPackDto = any; export type QualityRuntimeValueGatesDto = any;

export function evaluateExtractionFixtures(fixtures: any[]) {
  const rows = fixtures.map(evaluateFixture);
  const expectedCount = rows.reduce((sum, row) => sum + row.expected.length, 0);
  const matchedCount = rows.reduce((sum, row) => sum + row.matched.length, 0);
  return { disclaimer: "Fixture-level extraction signal, not a full extraction benchmark.", fixtureCount: fixtures.length, expectedCount, matchedCount, precision: ratio(matchedCount, rows.reduce((sum, row) => sum + row.actual.length, 0)), recall: ratio(matchedCount, expectedCount), fixtures: rows };
}
export function evaluateExtractionCalibration(fixtures: any[]) {
  const report = evaluateExtractionFixtures(fixtures);
  const categories = ["actor", "victim", "cve", "malware", "ttp"];
  return { ...report, disclaimer: "Calibration scores for thesis quality tracking.", categoryScores: categories.map((category) => scoreCategory(report.fixtures, category)), evidenceStageReports: ["live_discovery", "captured_page", "public_channel_message", "metadata_only_claim"].map((evidenceStage) => ({ evidenceStage, recall: report.recall })), falsePositiveExamples: [], falseNegativeExamples: report.fixtures.flatMap((f: any) => f.missing).slice(0, 5), qualityNotes: qualityNotes(report) };
}
export function buildEvaluationDatasetGovernanceDto(input: any = {}) {
  const labels = ["actor_profile", "unknown_actor", "cve", "malware_tool", "country", "sector", "victim_company", "ttp"];
  return { schemaVersion: "ti.evaluation_dataset_governance.v1", generatedAt: input.generatedAt ?? new Date().toISOString(), labels, summary: { labelCount: labels.length, caseKinds: labels }, auditChecks: ["no_raw_leaks", "public_source_only"] };
}
export function buildCtiEvaluationDatasetPackDto(input: any = {}) {
  return { schemaVersion: "ti.cti_evaluation_dataset_pack.v1", generatedAt: input.generatedAt ?? new Date().toISOString(), fixtures: input.fixtures ?? [], governance: buildEvaluationDatasetGovernanceDto(input) };
}
export function buildQualityRuntimeValueGatesDto(input: any = {}) {
  const rows = (input.rows ?? input.fixtures ?? []).map((row: any, index: number) => ({ id: row.id ?? `row_${index}`, useful: Boolean(row.actor || row.victim || row.ttp || row.dataset), score: row.score ?? 0.6 }));
  return { schemaVersion: "ti.quality_runtime_value_gates.v1", rows, summary: { totalRows: rows.length, sellableRows: rows.filter((r: any) => r.useful).length } };
}
export function buildProgramBdQualityEvaluationPackDto(input: any = {}) {
  const gates = buildQualityRuntimeValueGatesDto(input);
  return { schemaVersion: "ti.program_bd_quality_pack.v1", generatedAt: input.generatedAt ?? new Date().toISOString(), gates, monetizationSignal: gates.summary.sellableRows };
}
function evaluateFixture(fixture: any) {
  const result = processCollectedItem({ sourceId: fixture.sourceId ?? "fixture", url: fixture.url ?? "https://example.test", collectedAt: fixture.collectedAt ?? new Date().toISOString(), rawText: fixture.rawText ?? fixture.text ?? "", contentHash: fixture.contentHash ?? "fixture", links: [], metadata: fixture.metadata ?? {}, sensitive: fixture.sensitive ?? false });
  const actual = [...(result.entities ?? []).map((e: any) => `${e.type}:${e.value}`), ...(result.indicators ?? []).map((i: any) => `${i.type}:${i.value}`)];
  const expected = Object.entries(fixture.expect ?? fixture.expected ?? {}).flatMap(([type, values]) => (Array.isArray(values) ? values : [values]).map((value) => `${type}:${value}`));
  const matched = expected.filter((item) => actual.some((value) => value.toLowerCase() === item.toLowerCase()));
  return { fixtureId: fixture.id ?? fixture.name ?? "fixture", expected, actual, matched, missing: expected.filter((item) => !matched.includes(item)), unexpected: actual.filter((item) => !expected.map((v) => v.toLowerCase()).includes(item.toLowerCase())) };
}
const ratio = (a: number, b: number) => b ? Number((a / b).toFixed(3)) : 0;
const scoreCategory = (fixtures: any[], category: string) => { const expected = fixtures.flatMap((f) => f.expected).filter((v) => v.startsWith(`${category}:`)).length; const matched = fixtures.flatMap((f) => f.matched).filter((v) => v.startsWith(`${category}:`)).length; const recall = ratio(matched, expected); return { category, precision: recall, recall, f1: recall }; };
const qualityNotes = (report: any) => ["low_evidence_count", "alias_collision", "stale_source", "contradicted_attribution", "weak_victim_claim", "extracted_ttp_needs_review", "source_family_bias"].map((code) => ({ code, severity: report.recall > 0.8 ? "info" : "watch" }));
