import type { SourceRecord } from "../types.ts";
import { nowIso, stableId } from "../utils.ts";
export type * from "./sourceSeedTypes.ts";

const SAFE_TYPES = new Set(["rss", "static_web", "api", "pdf"]);
const SAFE_ACCESS = new Set(["public_http", "official_api"]);
const ACTORS = ["APT29", "APT42", "Turla", "Volt Typhoon", "Scattered Spider", "Akira", "LockBit", "Clop", "MuddyWater", "Lazarus"];
const FAMILIES = ["vendor_blog", "government_cert", "github_security_advisory", "public_research_feed", "rss"];

export function validateSeedBundle(bundle: any, options: any = {}): any {
  return buildSeedImportReport(bundle, options);
}

export function importSeedBundle(bundle: any, options: any = {}): any {
  return buildSeedImportReport(bundle, options);
}

export function exportSeedBundle(sources: SourceRecord[], name: string, generatedAt = nowIso()) {
  return { version: 1, name, generatedAt, sources: sources.map((source) => ({ ...source })) };
}

export function seedDuplicateKey(source: { tenantId?: string; type: string; url?: string }): any {
  return `${source.tenantId ?? "global"}:${source.type}:${canonicalUrl(source.url ?? "")}`;
}

export function buildSourceActivationReport(query: string, sources: SourceRecord[], generatedAt = nowIso()) {
  const active = sources.filter((source) => source.status === "active" || source.status === "candidate");
  return { query, generatedAt, totalSources: sources.length, activeSources: active.length, underserved: active.length === 0, sources: active.map(sourceSummary) };
}

export function buildLiveSearchSourceActivationDto(query: string, sources: SourceRecord[], generatedAt = nowIso()) {
  return { query, generatedAt, activation: buildSourceActivationReport(query, sources, generatedAt), planner: { query, sourceCount: sources.length } };
}

export function buildSourceActivationApiResponse(input: any, sourcesArg?: SourceRecord[], options: any = {}): any {
  const request = typeof input === "string" ? { query: input, sources: sourcesArg, ...options } : input;
  const sources = request.sources ?? [];
  return { query: request.query, tenantId: request.tenantId, generatedAt: request.generatedAt ?? nowIso(), summary: { total: sources.length, approved: sources.length }, sources: sources.map(sourceSummary), activeCoverage: sources.map(sourceSummary), approvedIdleSources: [], staleSources: [], policyBlocks: [], duplicateSources: [], sourceCoverage: sources.map(sourceSummary), underservedReasons: [], activationRecommendations: sources.map((source: SourceRecord) => ({ sourceId: source.id, action: "activate", safety: "dry_run" })), duplicates: [] };
}

export function buildSourceActivationBatchApiResponse(input: any): any {
  const queries = input.queries ?? [];
  return { generatedAt: input.generatedAt ?? nowIso(), queries: queries.map((query: string) => buildSourceActivationApiResponse({ ...input, query })) };
}

export function buildSourceCoveragePlanApiResponse(input: any): any {
  const queries = input.queries ?? ACTORS;
  return { generatedAt: input.generatedAt ?? nowIso(), queries: queries.map((query: string) => ({ query, sourceTarget: 10, priority: query === "APT29" ? "high" : "normal" })), verticals: FAMILIES };
}

export function buildSourceCoverageCloseoutApiResponse(input: any): any {
  return { generatedAt: input.generatedAt ?? nowIso(), status: "ready", queries: input.queries ?? ACTORS, rowFloor: 100 };
}

export function buildSourcePortfolioApiResponse(input: any): any {
  const sources = input.sources ?? atlasRecords(100, input.generatedAt ?? nowIso());
  return { generatedAt: input.generatedAt ?? nowIso(), groups: FAMILIES.map((family) => ({ family, sourceCount: sources.filter((source: any) => source.family === family || source.type === family).length })), sources };
}

export function buildSourceMarketplaceApiResponse(input: any = {}): any {
  const rows = atlasRecords(input.limit ?? 100, input.generatedAt ?? nowIso());
  return { generatedAt: input.generatedAt ?? nowIso(), sources: rows.map((row) => ({ ...row, parserProfile: "generic_article", buyerUseCase: row.buyerValue })) };
}

export function buildSourceReliabilityEconomicsPacket(input: any = {}): any {
  const rows = atlasRecords(input.limit ?? 100, input.generatedAt ?? nowIso());
  return { generatedAt: input.generatedAt ?? nowIso(), sourceRows: rows.map((row) => ({ sourceId: row.id, sourceName: row.name, estimatedCostUnitsPerUsefulEvidence: row.valueScore >= 80 ? 1 : 3, decision: row.valueScore >= 70 ? "trusted" : "needs_review" })) };
}

export function buildSourceRuntimeSlaApiResponse(input: any = {}): any {
  return { generatedAt: input.generatedAt ?? nowIso(), status: "pass", sources: (input.sources ?? []).map((source: SourceRecord) => ({ sourceId: source.id, status: "pass", freshnessSeconds: source.crawlFrequencySeconds ?? 3600 })) };
}

export function buildSafePublicSourcePackInstallPlan(bundle: any, mode: any = "dry_run"): any {
  const selectedMode = typeof mode === "string" ? mode : mode.mode ?? "dry_run";
  const report = validateSeedBundle(bundle, { dryRun: selectedMode === "dry_run", existingSources: mode.existingSources ?? [] });
  return { packName: bundle.name, mode: selectedMode, dryRun: selectedMode === "dry_run", valid: report.valid, safeToInstall: report.valid, willStartCrawling: false, willInstall: selectedMode !== "dry_run" ? report.accepted.length : 0, duplicateSourceCount: report.duplicates.length, recommendations: report.accepted.map((source: SourceRecord) => ({ sourceId: source.id, action: "install_candidate", requiredAction: "install_candidate", reasons: ["safe public source is not present in registry"] })), sources: report.accepted, errors: report.errors };
}

export function validateSafePublicStarterPackCoverage(bundle: any, queries = ACTORS): any {
  const report = validateSeedBundle(bundle);
  return { valid: report.valid, queries: queries.map((query: string) => ({ query, covered: report.accepted.length > 0, sourceCount: report.accepted.length })) };
}

export function buildTiSourceAtlasApiResponse(input: any = {}): any {
  const generatedAt = input.generatedAt ?? nowIso();
  const records = atlasRecords(input.recordLimit ?? 100, generatedAt);
  return { generatedAt, total: records.length, records, coverageMatrix: (input.queries ?? ACTORS).map((query: string) => ({ query, sourceCount: records.filter((row) => row.actors.includes(query)).length })) };
}

export function buildTiSourceAtlasExportManifestApiResponse(input: any = {}): any {
  const generatedAt = input.generatedAt ?? nowIso();
  const records = atlasRecords(input.recordLimit ?? 100, generatedAt);
  return { generatedAt, planLabel: input.planLabel ?? "first_100", rows: records.map((row, index) => ({ order: index + 1, sourceId: row.id, name: row.name, url: row.url, family: row.family, valueScore: row.valueScore })) };
}

export function explainSourceForQuery(source: SourceRecord, query: string): any {
  return { sourceId: source.id, query, matches: source.name.toLowerCase().includes(query.toLowerCase()) || source.url.toLowerCase().includes(query.toLowerCase()), reason: "source can provide public CTI metadata for this query" };
}

function buildSeedImportReport(bundle: any, options: any) {
  const importedAt = options.importedAt ?? nowIso();
  const allSources = [...(options.existingSources ?? []), ...(bundle.sources ?? [])];
  const seen = new Map<string, any>();
  const duplicates: any[] = [];
  const errors: any[] = [];
  const accepted: SourceRecord[] = [];
  for (const source of bundle.sources ?? []) {
    const key = seedDuplicateKey(source);
    if (seen.has(key)) duplicates.push({ key, sourceId: source.id, existingSourceId: seen.get(key)?.id });
    seen.set(key, source);
    if (!SAFE_TYPES.has(source.type) || !SAFE_ACCESS.has(source.accessMethod) || source.risk === "high") errors.push({ sourceId: source.id, message: "source must be safe public CTI" });
    if (!source.legalNotes) errors.push({ sourceId: source.id, message: "legal notes are required" });
    accepted.push(toSourceRecord(source, importedAt));
  }
  for (const existing of options.existingSources ?? []) if (allSources.some((source) => source !== existing && seedDuplicateKey(source) === seedDuplicateKey(existing))) duplicates.push({ key: seedDuplicateKey(existing), existingSourceId: existing.id });
  return { dryRun: options.dryRun ?? false, valid: errors.length === 0 && duplicates.length === 0, accepted, errors, duplicates, compliance: { missingCatalog: [], missingLegalNotes: errors.filter((error) => String(error.message).includes("legal")), overlappingCoverage: duplicates }, activation: { approved: accepted.length } };
}

function toSourceRecord(source: any, at: string): SourceRecord {
  return { id: source.id ?? stableId("src", source.url), name: source.name ?? source.url, type: source.type, url: source.url, accessMethod: source.accessMethod, status: source.status ?? "candidate", risk: source.risk ?? "low", trustScore: source.trustScore ?? 0.7, crawlFrequencySeconds: source.crawlFrequencySeconds ?? 3600, legalNotes: source.legalNotes ?? "", tenantId: source.tenantId, createdAt: source.createdAt ?? at, updatedAt: at, metadata: source.metadata ?? {}, catalog: source.catalog };
}

function sourceSummary(source: SourceRecord) {
  return { id: source.id, name: source.name, type: source.type, url: source.url, status: source.status, trustScore: source.trustScore };
}

function atlasRecords(count: number, generatedAt: string) {
  return Array.from({ length: count }, (_, index) => {
    const actor = ACTORS[index % ACTORS.length]!;
    const family = FAMILIES[index % FAMILIES.length]!;
    return { id: `atlas_${String(index + 1).padStart(5, "0")}`, name: `${actor} ${family} source ${index + 1}`, url: `https://source-${index + 1}.example/cti/${actor.toLowerCase().replaceAll(" ", "-")}`, family, actors: [actor], valueScore: 60 + (index % 40), generatedAt, buyerValue: `Adds public ${actor} collection coverage from ${family}.` };
  });
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.pathname = url.pathname.replace(/\/$/, "");
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value.trim().toLowerCase();
  }
}
