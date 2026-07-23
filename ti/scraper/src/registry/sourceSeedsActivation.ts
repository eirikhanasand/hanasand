import type { SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";
import { ACTORS } from "./sourceSeedConstants.ts";
import { sourceSummary } from "./sourceSeedUtils.ts";

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

export function buildSourceCoverageCloseoutApiResponse(input: any): any {
  return { generatedAt: input.generatedAt ?? nowIso(), status: "ready", queries: input.queries ?? ACTORS, rowFloor: 100 };
}

export function buildSourceRuntimeSlaApiResponse(input: any = {}): any {
  return { generatedAt: input.generatedAt ?? nowIso(), status: "pass", sources: (input.sources ?? []).map((source: SourceRecord) => ({ sourceId: source.id, status: "pass", freshnessSeconds: source.crawlFrequencySeconds ?? 3600 })) };
}
