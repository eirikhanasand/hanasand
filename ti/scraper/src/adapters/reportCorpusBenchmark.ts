import { agent07ExtractionHandoff, selectParserProfile, type Agent07ExtractionHandoffDto, type ParserProfileInput } from "./parserProfiles.ts";
import type { AdapterRunResult, CollectedItem, SourceRecord } from "../types.ts";
import { hashContent } from "../utils.ts";

export interface ReportCorpusFixture {
  id: string;
  source: SourceRecord;
  profileInput: ParserProfileInput;
  title: string;
  text: string;
  publishedAt?: string;
  expectedLanguage?: string;
  parserWarnings?: string[];
}

export interface ReportCorpusBenchmarkRow {
  fixtureId: string;
  parserProfile: string;
  extractionScore: number;
  confidenceBand: string;
  languageHint?: string;
  citationSpanCount: number;
  warningCount: number;
  stalePublication: boolean;
  handoffQuality: "pass" | "warn" | "fail";
  handoff: Agent07ExtractionHandoffDto;
}

export interface ReportCorpusBenchmarkReport {
  schemaVersion: "ti.report_corpus_benchmark.v1";
  rows: ReportCorpusBenchmarkRow[];
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
    averageScore: number;
  };
}

export function runReportCorpusBenchmark(fixtures: ReportCorpusFixture[], now: string): ReportCorpusBenchmarkReport {
  const rows = fixtures.map((fixture) => benchmarkFixture(fixture, now));
  const pass = rows.filter((row) => row.handoffQuality === "pass").length;
  const warn = rows.filter((row) => row.handoffQuality === "warn").length;
  const fail = rows.filter((row) => row.handoffQuality === "fail").length;
  const averageScore = rows.length ? rows.reduce((total, row) => total + row.extractionScore, 0) / rows.length : 0;
  return {
    schemaVersion: "ti.report_corpus_benchmark.v1",
    rows,
    summary: {
      total: rows.length,
      pass,
      warn,
      fail,
      averageScore: Number(averageScore.toFixed(3))
    }
  };
}

function benchmarkFixture(fixture: ReportCorpusFixture, now: string): ReportCorpusBenchmarkRow {
  const profile = selectParserProfile({
    ...fixture.profileInput,
    textSample: fixture.text,
    language: fixture.profileInput.language ?? fixture.expectedLanguage,
    parserWarnings: fixture.parserWarnings
  });
  const collected: CollectedItem = {
    sourceId: fixture.source.id,
    taskId: `benchmark_${fixture.id}`,
    url: fixture.source.url,
    collectedAt: now,
    publishedAt: fixture.publishedAt,
    title: fixture.title,
    rawText: fixture.text,
    contentHash: hashContent(fixture.text),
    language: profile.languageHint,
    links: [],
    sensitive: false,
    metadata: {
      citationSpans: citationSpans(fixture.text),
      parserWarnings: fixture.parserWarnings ?? []
    }
  };
  const result: AdapterRunResult = { items: [collected], discovered: [], warnings: [], metadata: {} };
  const handoff = agent07ExtractionHandoff({ source: fixture.source, result, profile });
  const stalePublication = fixture.publishedAt ? Date.parse(now) - Date.parse(fixture.publishedAt) > 180 * 24 * 60 * 60 * 1000 : true;
  const handoffQuality = qualityFor(handoff, stalePublication);
  return {
    fixtureId: fixture.id,
    parserProfile: profile.profile,
    extractionScore: profile.extractionScore,
    confidenceBand: profile.extractionConfidenceBand,
    languageHint: profile.languageHint,
    citationSpanCount: handoff.citationSpans.length,
    warningCount: handoff.parserWarnings.length,
    stalePublication,
    handoffQuality,
    handoff
  };
}

function citationSpans(text: string): Array<{ start: number; end: number; label: string }> {
  if (!text.trim()) return [];
  return [{ start: 0, end: Math.min(140, text.length), label: "benchmark_excerpt" }];
}

function qualityFor(handoff: Agent07ExtractionHandoffDto, stalePublication: boolean): ReportCorpusBenchmarkRow["handoffQuality"] {
  if (handoff.extractionConfidenceBand === "blocked" || handoff.extractionConfidenceBand === "low" || handoff.citationSpans.length === 0) return "fail";
  if (handoff.parserWarnings.length > 1 || stalePublication || handoff.extractionConfidenceBand === "medium") return "warn";
  return "pass";
}
