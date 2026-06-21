// @ts-nocheck
import type { SourceRecord } from "../types.ts";
import { hashContent, nowIso } from "../utils.ts";

export type PublicSignalSourceFamily = "public_channel" | "github_advisory" | "cert_government" | "vendor_report" | "malware_report_feed" | "public_research_feed" | "public_social" | "clear_web" | "darkweb_metadata";
export type PublicSignalMatchedEntities = Record<string, string[]>;
export type PublicSignalDeltaDto = any;
export type PublicAdvisorySignalRecord = any;
export type PublicSignalFusionInput = any;

const FAMILIES: PublicSignalSourceFamily[] = ["public_channel", "github_advisory", "cert_government", "vendor_report", "malware_report_feed", "public_research_feed", "public_social", "clear_web", "darkweb_metadata"];

export function buildPublicSignalFusionWorkbench(input: PublicSignalFusionInput): any {
  const generatedAt = input.generatedAt ?? nowIso();
  const selectedSources = selectSources(input.sources ?? [], input.query, input.maxSelectedSources ?? 25);
  const publicSignalDeltas = [
    ...((input.evidence ?? []).map((item: any) => deltaFromEvidence(item, generatedAt))),
    ...((input.advisorySignals ?? []).map((item: any) => deltaFromAdvisory(item, generatedAt))),
    ...((input.darkwebMetadataSignals ?? []).map((item: any) => deltaFromDarkweb(item, generatedAt)))
  ].filter((delta) => delta.summary || delta.title || delta.matchedEntities);
  const actorSourceCoverageMatrix = buildActorSourceCoverageMatrix({ query: input.query, sources: input.sources ?? [], deltas: publicSignalDeltas, generatedAt });
  const publicSignalLiveCollectionLoop = buildPublicSignalLiveCollectionLoopDto({ query: input.query, sources: selectedSources, deltas: publicSignalDeltas, generatedAt });
  return {
    query: input.query,
    generatedAt,
    status: publicSignalDeltas.length ? "ready" : selectedSources.length ? "partial" : "coverage_gap",
    selectedSources,
    familyCoverage: { familiesCovered: FAMILIES, missingFamilies: missingFamilies(selectedSources), diversityScore: FAMILIES.length },
    publicSignalDeltas,
    sourceCoverageGaps: missingFamilies(selectedSources).map((family) => ({ family, reason: "no selected source" })),
    coverageStatus: actorSourceCoverageMatrix.status,
    actorSourceCoverageMatrix,
    publicSignalLiveCollectionLoop,
    publicSignalValueImpact: buildPublicSignalValueImpact({ publicSignalDeltas, selectedSources, generatedAt }),
    publicCoverageFreshnessValue: buildPublicCoverageFreshnessValue({ publicSignalDeltas, selectedSources, generatedAt }),
    advisoryCorrelation: buildPublicAdvisoryCorrelation({ deltas: publicSignalDeltas, generatedAt }),
    publicConflictContradictionResolver: buildPublicConflictContradictionResolver({ deltas: publicSignalDeltas, generatedAt }),
    analystSourceWorkbench: { rows: selectedSources, action: "collect_public_metadata" }
  };
}

export function buildPublicAdvisorySignalConnector(input: any): any {
  const generatedAt = input.generatedAt ?? nowIso();
  const signals = (input.signals ?? []).slice(0, input.maxSignals ?? 100).map((signal: any) => deltaFromAdvisory(signal, generatedAt));
  return { query: input.query, generatedAt, status: signals.length ? "ready" : "partial", fastInitialSummary: { query: input.query, signalCount: signals.length, usefulSignalCount: signals.length, sourceCount: new Set(signals.map((signal: any) => signal.sourceId)).size, canAnswerImmediately: signals.length > 0 }, signals, rankedSignals: signals, sourceCount: new Set(signals.map((signal: any) => signal.sourceId)).size };
}

export function buildAnalystPublicSourceWorkbench(input: any): any {
  const workbench = buildPublicSignalFusionWorkbench(input);
  return { generatedAt: workbench.generatedAt, rows: workbench.selectedSources, decisions: workbench.selectedSources.map((source: any) => ({ sourceId: source.sourceId, action: "collect_public_metadata" })) };
}

export function buildEnterpriseSourceCoverageRadar(input: any): any {
  const matrix = buildActorSourceCoverageMatrix(input);
  return { generatedAt: matrix.generatedAt, status: matrix.status, gaps: matrix.rows.filter((row: any) => row.status === "coverage_gap"), rows: matrix.rows };
}

export function buildPublicAdvisoryCorrelation(input: any): any {
  const deltas = input.deltas ?? input.publicSignalDeltas ?? [];
  const grouped = new Map<string, any[]>();
  for (const delta of deltas) for (const actor of delta.matchedEntities?.actors ?? []) grouped.set(actor, [...(grouped.get(actor) ?? []), delta]);
  return { generatedAt: input.generatedAt ?? nowIso(), status: "needs_review", actors: [...grouped.entries()].map(([actor, rows]) => ({ actor, supportCount: rows.length, sources: [...new Set(rows.map((row) => row.sourceId))] })), conflicts: [] };
}

export function buildActorSourceCoverageMatrix(input: any): any {
  const generatedAt = input.generatedAt ?? nowIso();
  const query = input.query ?? "unknown";
  const sources = input.sources ?? [];
  const rows = FAMILIES.map((family) => {
    const sourceCount = sources.filter((source: SourceRecord) => familyForSource(source) === family).length;
    return { family, sourceCount, status: sourceCount > 0 ? "ready" : "coverage_gap", freshness: sourceCount > 0 ? "fresh" : "unknown" };
  });
  return { query, generatedAt, status: rows.some((row) => row.status === "ready") ? "partial" : "coverage_gap", rows };
}

export function buildPublicSourcePackExpansion(input: any): any {
  return { generatedAt: input.generatedAt ?? nowIso(), query: input.query, recommendations: FAMILIES.map((family) => ({ family, action: "add_public_source" })) };
}

export function buildPublicSourceFamilyBenchmarks(input: any): any {
  return { generatedAt: input.generatedAt ?? nowIso(), families: FAMILIES.map((family) => ({ family, usefulRowTarget: 20, freshnessTargetHours: family === "darkweb_metadata" ? 1 : 24 })) };
}

export function buildPublicIntelligenceCoveragePlan(input: any): any {
  return { generatedAt: input.generatedAt ?? nowIso(), queries: input.queries ?? [input.query ?? "APT29"], requiredFamilies: FAMILIES, rowFloor: 100 };
}

export function buildPublicFreshnessGapRemediation(input: any): any {
  return { generatedAt: input.generatedAt ?? nowIso(), actions: missingFamilies(input.sources ?? []).map((family) => ({ family, action: "activate_source_or_parser" })) };
}

export function buildPublicIntelligenceQueryMatrix(input: any): any {
  const queries = input.queries ?? ["APT29", "Scattered Spider", "Akira"];
  return { generatedAt: input.generatedAt ?? nowIso(), queries: queries.map((query: string) => ({ query, families: FAMILIES, rowTarget: 100 })) };
}

export function buildPublicConflictContradictionResolver(input: any): any {
  const deltas = input.deltas ?? [];
  return { generatedAt: input.generatedAt ?? nowIso(), rows: deltas.filter((delta: any) => delta.confidence < 0.45).map((delta: any) => ({ deltaId: delta.id, action: "hold_low_confidence", releaseGate: "hold" })) };
}

export function buildPublicSignalLiveCollectionLoopDto(input: any): any {
  const sources = input.sources ?? [];
  return { query: input.query, generatedAt: input.generatedAt ?? nowIso(), nextTasks: sources.slice(0, 20).map((source: any) => ({ sourceId: source.sourceId ?? source.id, action: "collect_public_metadata", priority: source.score >= 0.7 ? "high" : "normal" })), queryFixtures: [] };
}

export function buildPublicSignalValueImpact(input: any): any {
  const rows = input.publicSignalDeltas ?? [];
  return { generatedAt: input.generatedAt ?? nowIso(), sellableRows: rows.length, valueLift: rows.filter((row: any) => row.confidence >= 0.6).length, reason: "fresh public signals add actor/victim/TTP pivots" };
}

export function buildPublicCoverageFreshnessValue(input: any): any {
  const rows = input.publicSignalDeltas ?? [];
  return { generatedAt: input.generatedAt ?? nowIso(), freshRows: rows.filter((row: any) => !row.publishedAt || Date.parse(row.publishedAt) > Date.now() - 7 * 86400_000).length, totalRows: rows.length };
}

export const buildPublicSignalLiveCollectionLoop = buildPublicSignalLiveCollectionLoopDto;

function selectSources(sources: SourceRecord[], query: string, limit: number) {
  return sources.map((source) => ({ ...sourceSummary(source), family: familyForSource(source), selected: true, score: scoreSource(source, query), reliability: source.trustScore ?? 0.5, freshness: 0.7 })).sort((a, b) => b.score - a.score).slice(0, limit);
}

function deltaFromEvidence(item: any, generatedAt: string) {
  return { id: item.id ?? hashContent(JSON.stringify(item)), sourceId: item.sourceId, family: "public_channel", title: item.title, summary: item.summary ?? item.text, url: item.url ?? item.evidenceUrl ?? "metadata-only", confidence: item.confidence ?? 0.55, matchedEntities: item.matchedEntities ?? {}, collectedAt: item.collectedAt ?? generatedAt, provenance: { sourceId: item.sourceId, publicOnly: true, evidenceBacked: true, safeUrl: true } };
}

function deltaFromAdvisory(item: any, generatedAt: string) {
  return { id: item.id ?? hashContent(item.url ?? item.title ?? JSON.stringify(item)), sourceId: item.sourceId, family: item.family ?? "vendor_report", title: item.title, summary: item.summary, url: item.url, confidence: item.confidence ?? 0.7, matchedEntities: item.matchedEntities ?? {}, publishedAt: item.publishedAt, collectedAt: item.observedAt ?? generatedAt, provenance: { sourceId: item.sourceId, publicOnly: true, evidenceBacked: true, safeUrl: true } };
}

function deltaFromDarkweb(item: any, generatedAt: string) {
  return { id: item.id ?? hashContent(item.urlHash ?? JSON.stringify(item)), sourceId: item.sourceId ?? "darkweb_metadata", family: "darkweb_metadata", title: item.actor ?? item.siteTitle, summary: item.summary, url: item.urlHash ?? "metadata-only", confidence: item.confidence ?? 0.6, matchedEntities: { actors: [item.actor].filter(Boolean), victims: [item.victim].filter(Boolean) }, collectedAt: item.observedAt ?? generatedAt, provenance: { sourceId: item.sourceId ?? "darkweb_metadata", publicOnly: true, evidenceBacked: true, safeUrl: true } };
}

function sourceSummary(source: SourceRecord) {
  return { sourceId: source.id, id: source.id, name: source.name, url: source.url, type: source.type, status: source.status, trustScore: source.trustScore };
}

function familyForSource(source: SourceRecord): PublicSignalSourceFamily {
  if (source.type === "telegram_public") return "public_channel";
  if (source.type === "github_advisory") return "github_advisory";
  if (source.type === "tor_metadata" || source.type === "i2p_metadata") return "darkweb_metadata";
  if (source.name.toLowerCase().includes("cert")) return "cert_government";
  if (source.name.toLowerCase().includes("vendor")) return "vendor_report";
  return source.type === "rss" ? "public_research_feed" : "clear_web";
}

function scoreSource(source: SourceRecord, query: string) {
  const text = `${source.name} ${source.url}`.toLowerCase();
  return Math.min(1, (source.trustScore ?? 0.5) + (text.includes(query.toLowerCase()) ? 0.25 : 0));
}

function missingFamilies(selected: any[]) {
  const present = new Set(selected.map((source) => source.family ?? familyForSource(source)));
  return FAMILIES.filter((family) => !present.has(family));
}
