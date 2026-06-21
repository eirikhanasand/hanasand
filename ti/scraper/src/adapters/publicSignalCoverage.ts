import type { SourceRecord } from "../types.ts";
import { nowIso } from "../utils.ts";
import { FAMILIES, familyForSource, missingFamilies } from "./publicSignalFamilies.ts";

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

export function buildEnterpriseSourceCoverageRadar(input: any): any {
  const matrix = buildActorSourceCoverageMatrix(input);
  return { generatedAt: matrix.generatedAt, status: matrix.status, gaps: matrix.rows.filter((row: any) => row.status === "coverage_gap"), rows: matrix.rows };
}

export const buildPublicSourcePackExpansion = (input: any): any => ({ generatedAt: input.generatedAt ?? nowIso(), query: input.query, recommendations: FAMILIES.map((family) => ({ family, action: "add_public_source" })) });
export const buildPublicSourceFamilyBenchmarks = (input: any): any => ({ generatedAt: input.generatedAt ?? nowIso(), families: FAMILIES.map((family) => ({ family, usefulRowTarget: 20, freshnessTargetHours: family === "darkweb_metadata" ? 1 : 24 })) });
export const buildPublicIntelligenceCoveragePlan = (input: any): any => ({ generatedAt: input.generatedAt ?? nowIso(), queries: input.queries ?? [input.query ?? "APT29"], requiredFamilies: FAMILIES, rowFloor: 100 });
export const buildPublicFreshnessGapRemediation = (input: any): any => ({ generatedAt: input.generatedAt ?? nowIso(), actions: missingFamilies(input.sources ?? []).map((family) => ({ family, action: "activate_source_or_parser" })) });
export const buildPublicIntelligenceQueryMatrix = (input: any): any => ({ generatedAt: input.generatedAt ?? nowIso(), queries: (input.queries ?? ["APT29", "Scattered Spider", "Akira"]).map((query: string) => ({ query, families: FAMILIES, rowTarget: 100 })) });
