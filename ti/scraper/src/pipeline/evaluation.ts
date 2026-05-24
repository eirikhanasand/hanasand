import type { CollectedItem, Indicator, PipelineResult } from "../types.ts";
import { hashContent } from "../utils.ts";
import { buildActorQueryExtractionProfile, buildTiSearchResultDto, type EvidenceStage, type TiConfidenceCaveatCode } from "./intelligenceProfiles.ts";
import { processCollectedItem } from "./pipeline.ts";

export interface ExtractionFixtureExpectation {
  actors?: string[];
  cves?: string[];
  iocs?: Array<{ type: Indicator["type"]; value: string }>;
  victims?: string[];
  sectors?: string[];
  countries?: string[];
  ttpHints?: string[];
  malwareTools?: string[];
  campaignNames?: string[];
  confidenceCaveats?: TiConfidenceCaveatCode[];
  temporalLabels?: string[];
  uncertaintyLabels?: string[];
}

export interface ExtractionEvaluationFixture {
  id: string;
  title: string;
  query?: string;
  evidenceStage?: EvidenceStage;
  rawText: string;
  language?: string;
  sensitive?: boolean;
  metadata?: Record<string, unknown>;
  expected: ExtractionFixtureExpectation;
  absent?: ExtractionFixtureExpectation;
}

export interface ExtractionFixtureEvaluation {
  fixtureId: string;
  expectedCount: number;
  matchedCount: number;
  matched: string[];
  missing: string[];
  unexpected: string[];
  reviewReasons: string[];
}

export interface ExtractionEvaluationReport {
  disclaimer: string;
  fixtureCount: number;
  expectedCount: number;
  matchedCount: number;
  missingCount: number;
  unexpectedCount: number;
  fixtures: ExtractionFixtureEvaluation[];
}

export type ExtractionQualityNoteCode =
  | "low_evidence_count"
  | "alias_collision"
  | "stale_source"
  | "contradicted_attribution"
  | "weak_victim_claim"
  | "extracted_ttp_needs_review"
  | "source_family_bias";

export interface ExtractionQualityNote {
  code: ExtractionQualityNoteCode;
  severity: "info" | "warning" | "critical";
  message: string;
  fixtureIds: string[];
}

export interface ExtractionCategoryScore {
  category: string;
  expected: number;
  matched: number;
  missing: number;
  unexpected: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface EvidenceStageCalibrationReport {
  evidenceStage: EvidenceStage;
  fixtureCount: number;
  expected: number;
  matched: number;
  missing: number;
  unexpected: number;
  precision: number;
  recall: number;
  qualityNotes: ExtractionQualityNote[];
}

export interface ExtractionCalibrationReport {
  disclaimer: string;
  fixtureCount: number;
  categoryScores: ExtractionCategoryScore[];
  evidenceStageReports: EvidenceStageCalibrationReport[];
  falsePositiveExamples: Array<{ fixtureId: string; unexpected: string[] }>;
  falseNegativeExamples: Array<{ fixtureId: string; missing: string[] }>;
  qualityNotes: ExtractionQualityNote[];
}

export function evaluateExtractionFixtures(fixtures: ExtractionEvaluationFixture[]): ExtractionEvaluationReport {
  const fixtureReports = fixtures.map((fixture) => evaluateFixture(fixture, processCollectedItem(collectedItemFor(fixture))));
  const expectedCount = sum(fixtureReports.map((report) => report.expectedCount));
  const matchedCount = sum(fixtureReports.map((report) => report.matchedCount));
  const missingCount = sum(fixtureReports.map((report) => report.missing.length));
  const unexpectedCount = sum(fixtureReports.map((report) => report.unexpected.length));

  return {
    disclaimer: "Precision-ish fixture counts for deterministic regression checks only; this is not a full extraction benchmark.",
    fixtureCount: fixtures.length,
    expectedCount,
    matchedCount,
    missingCount,
    unexpectedCount,
    fixtures: fixtureReports
  };
}

export function evaluateExtractionCalibration(fixtures: ExtractionEvaluationFixture[]): ExtractionCalibrationReport {
  const evaluations = fixtures.map((fixture) => evaluateFixture(fixture, processCollectedItem(collectedItemFor(fixture))));
  const categories = ["actor", "victim", "sector", "country", "ttp", "malware", "ioc", "cve", "campaign", "caveat", "temporal", "uncertainty"];
  const categoryScores = categories.map((category) => categoryScore(category, evaluations));
  const evidenceStages = [...new Set(fixtures.map((fixture) => fixture.evidenceStage ?? evidenceStageFromFixture(fixture)))];
  const evidenceStageReports = evidenceStages.map((stage) => {
    const stageEvaluations = evaluations.filter((evaluation) => evaluation.evidenceStage === stage);
    const qualityNotes = mergeQualityNotes(stageEvaluations.flatMap((evaluation) => evaluation.qualityNotes));
    const expected = sum(stageEvaluations.map((evaluation) => evaluation.expectedCount));
    const matched = sum(stageEvaluations.map((evaluation) => evaluation.matchedCount));
    const missing = sum(stageEvaluations.map((evaluation) => evaluation.missing.length));
    const unexpected = sum(stageEvaluations.map((evaluation) => evaluation.unexpected.length));
    return {
      evidenceStage: stage,
      fixtureCount: stageEvaluations.length,
      expected,
      matched,
      missing,
      unexpected,
      precision: precision(matched, unexpected),
      recall: recall(matched, missing),
      qualityNotes
    };
  });

  return {
    disclaimer: "Calibration scores are deterministic fixture signals for trend and gate checks; they are not a statistically representative benchmark.",
    fixtureCount: fixtures.length,
    categoryScores,
    evidenceStageReports,
    falsePositiveExamples: evaluations
      .filter((evaluation) => evaluation.unexpected.length > 0)
      .map((evaluation) => ({ fixtureId: evaluation.fixtureId, unexpected: evaluation.unexpected })),
    falseNegativeExamples: evaluations
      .filter((evaluation) => evaluation.missing.length > 0)
      .map((evaluation) => ({ fixtureId: evaluation.fixtureId, missing: evaluation.missing })),
    qualityNotes: mergeQualityNotes(evaluations.flatMap((evaluation) => evaluation.qualityNotes))
  };
}

function evaluateFixture(fixture: ExtractionEvaluationFixture, result: PipelineResult): ExtractionFixtureEvaluation & { evidenceStage: EvidenceStage; qualityNotes: ExtractionQualityNote[] } {
  const expected = expectedKeys(fixture.expected);
  const actual = actualKeys(result);
  const matched = expected.filter((key) => actual.has(key));
  const missing = expected.filter((key) => !actual.has(key));
  const absent = new Set(expectedKeys(fixture.absent ?? {}));
  const unexpected = [...actual].filter((key) => absent.has(key));
  const evidenceStage = fixture.evidenceStage ?? evidenceStageFromFixture(fixture);

  return {
    fixtureId: fixture.id,
    expectedCount: expected.length,
    matchedCount: matched.length,
    matched,
    missing,
    unexpected,
    reviewReasons: result.incident?.reviewReasons ?? [],
    evidenceStage,
    qualityNotes: qualityNotesForFixture(fixture, result, evidenceStage)
  };
}

function expectedKeys(expected: ExtractionFixtureExpectation): string[] {
  return [
    ...(expected.actors ?? []).map((value) => key("actor", value)),
    ...(expected.cves ?? []).map((value) => key("cve", value)),
    ...(expected.iocs ?? []).map((ioc) => key(`ioc:${ioc.type}`, ioc.value)),
    ...(expected.victims ?? []).map((value) => key("victim", value)),
    ...(expected.sectors ?? []).map((value) => key("sector", value)),
    ...(expected.countries ?? []).map((value) => key("country", value)),
    ...(expected.ttpHints ?? []).map((value) => key("ttp", value)),
    ...(expected.malwareTools ?? []).map((value) => key("malware", value)),
    ...(expected.campaignNames ?? []).map((value) => key("campaign", value)),
    ...(expected.confidenceCaveats ?? []).map((value) => key("caveat", value)),
    ...(expected.temporalLabels ?? []).map((value) => key("temporal", value)),
    ...(expected.uncertaintyLabels ?? []).map((value) => key("uncertainty", value))
  ];
}

function actualKeys(result: PipelineResult): Set<string> {
  const keys = new Set<string>();
  for (const entity of result.entities) {
    if (entity.type === "actor") keys.add(key("actor", entity.value));
    if (entity.type === "victim") keys.add(key("victim", entity.value));
    if (entity.type === "sector") keys.add(key("sector", entity.value));
    if (entity.type === "country") keys.add(key("country", entity.value));
    if (entity.type === "ttp") keys.add(key("ttp", entity.value));
    if (entity.type === "malware" || entity.type === "ransomware_family") keys.add(key("malware", entity.value));
    if (entity.type === "cve") keys.add(key("cve", entity.value));
    for (const reason of entity.reviewReasons ?? []) keys.add(key("uncertainty", reason));
  }
  for (const indicator of result.indicators) {
    if (indicator.type === "cve") keys.add(key("cve", indicator.value));
    keys.add(key(`ioc:${indicator.type}`, indicator.value));
    for (const reason of indicator.reviewReasons ?? []) keys.add(key("uncertainty", reason));
  }
  for (const reason of result.incident?.reviewReasons ?? []) keys.add(key("uncertainty", reason));
  const profile = buildActorQueryExtractionProfile(result.incident?.title ?? "fixture", result);
  if (profile.temporal.reportPublishedAt) keys.add(key("temporal", "reportPublishedAt"));
  if (profile.temporal.incidentDate) keys.add(key("temporal", "incidentDate"));
  if (profile.temporal.firstSeenAt) keys.add(key("temporal", "firstSeenAt"));
  if (profile.temporal.lastSeenAt) keys.add(key("temporal", "lastSeenAt"));
  if (profile.temporal.claimedLeakDate) keys.add(key("temporal", "claimedLeakDate"));
  if (profile.temporal.observedInfrastructureDate) keys.add(key("temporal", "observedInfrastructureDate"));
  for (const campaign of profile.campaignNames) keys.add(key("campaign", campaign));
  const dto = buildTiSearchResultDto(result.incident?.title ?? "fixture", result);
  for (const caveat of dto.caveats) keys.add(key("caveat", caveat.code));
  return keys;
}

function collectedItemFor(fixture: ExtractionEvaluationFixture): CollectedItem {
  const metadata = { fixture: true, evidenceStage: fixture.evidenceStage, ...fixture.metadata };
  return {
    sourceId: `fixture_${fixture.id}`,
    url: `https://fixture.local/extraction/${fixture.id}`,
    collectedAt: "2026-05-24T00:00:00.000Z",
    title: fixture.title,
    rawText: fixture.rawText,
    contentHash: hashContent(fixture.rawText),
    language: fixture.language,
    links: [],
    metadata,
    sensitive: fixture.sensitive ?? false
  };
}

function qualityNotesForFixture(fixture: ExtractionEvaluationFixture, result: PipelineResult, evidenceStage: EvidenceStage): ExtractionQualityNote[] {
  const dto = buildTiSearchResultDto(fixture.query ?? fixture.title, result);
  const actors = result.entities.filter((entity) => entity.type === "actor");
  const victims = result.entities.filter((entity) => entity.type === "victim");
  const ttps = result.entities.filter((entity) => entity.type === "ttp");
  const notes: ExtractionQualityNote[] = [];
  if (result.entities.length + result.indicators.length < 2) {
    notes.push(qualityNote("low_evidence_count", "warning", "low evidence count limits extraction confidence", fixture.id));
  }
  if (new Set(actors.map((actor) => actor.value)).size > 1) {
    notes.push(qualityNote("alias_collision", "warning", "multiple actor names or aliases require collision review", fixture.id));
  }
  if (dto.caveats.some((caveat) => caveat.code === "stale")) {
    notes.push(qualityNote("stale_source", "warning", "source appears stale for current actor search calibration", fixture.id));
  }
  if (dto.caveats.some((caveat) => caveat.code === "contradicted")) {
    notes.push(qualityNote("contradicted_attribution", "critical", "source text indicates contradicted or disputed attribution", fixture.id));
  }
  if (victims.some((victim) => victim.confidence < 0.65) || (evidenceStage === "metadata_only_claim" && victims.length > 0)) {
    notes.push(qualityNote("weak_victim_claim", "warning", "victim extraction needs review before promotion", fixture.id));
  }
  if (ttps.length > 0 && dto.needsAnalystReview) {
    notes.push(qualityNote("extracted_ttp_needs_review", "warning", "extracted TTP needs review due to stage or confidence caveats", fixture.id));
  }
  if (evidenceStage === "live_discovery" || evidenceStage === "public_channel_message" || evidenceStage === "metadata_only_claim") {
    notes.push(qualityNote("source_family_bias", "info", "single partial source family may bias calibration", fixture.id));
  }
  return notes;
}

function qualityNote(code: ExtractionQualityNoteCode, severity: ExtractionQualityNote["severity"], message: string, fixtureId: string): ExtractionQualityNote {
  return { code, severity, message, fixtureIds: [fixtureId] };
}

function mergeQualityNotes(notes: ExtractionQualityNote[]): ExtractionQualityNote[] {
  const byCode = new Map<ExtractionQualityNoteCode, ExtractionQualityNote>();
  for (const note of notes) {
    const existing = byCode.get(note.code);
    byCode.set(note.code, existing
      ? { ...existing, fixtureIds: [...new Set([...existing.fixtureIds, ...note.fixtureIds])] }
      : note);
  }
  return [...byCode.values()];
}

function categoryScore(category: string, evaluations: Array<ExtractionFixtureEvaluation & { qualityNotes: ExtractionQualityNote[] }>): ExtractionCategoryScore {
  const matched = sum(evaluations.map((evaluation) => evaluation.matched.filter((item) => belongsToCategory(item, category)).length));
  const missing = sum(evaluations.map((evaluation) => evaluation.missing.filter((item) => belongsToCategory(item, category)).length));
  const unexpected = sum(evaluations.map((evaluation) => evaluation.unexpected.filter((item) => belongsToCategory(item, category)).length));
  const expectedCount = matched + missing;
  return {
    category,
    expected: expectedCount,
    matched,
    missing,
    unexpected,
    precision: precision(matched, unexpected),
    recall: recall(matched, missing),
    f1: f1(matched, missing, unexpected)
  };
}

function belongsToCategory(keyValue: string, category: string): boolean {
  if (category === "ioc") return keyValue.startsWith("ioc:");
  return keyValue.startsWith(`${category}:`);
}

function evidenceStageFromFixture(fixture: ExtractionEvaluationFixture): EvidenceStage {
  if (fixture.sensitive) return "metadata_only_claim";
  const explicit = fixture.metadata?.evidenceStage;
  return isEvidenceStage(explicit) ? explicit : "captured_page";
}

function isEvidenceStage(value: unknown): value is EvidenceStage {
  return value === "seeded"
    || value === "live_discovery"
    || value === "captured_page"
    || value === "public_channel_message"
    || value === "metadata_only_claim"
    || value === "extracted_relationship"
    || value === "reviewed_promoted";
}

function precision(matched: number, unexpected: number): number {
  return matched + unexpected === 0 ? 1 : matched / (matched + unexpected);
}

function recall(matched: number, missing: number): number {
  return matched + missing === 0 ? 1 : matched / (matched + missing);
}

function f1(matched: number, missing: number, unexpected: number): number {
  const p = precision(matched, unexpected);
  const r = recall(matched, missing);
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

function key(type: string, value: string): string {
  return `${type}:${value.toLowerCase()}`;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
