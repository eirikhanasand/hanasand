import { nowIso } from "../utils.ts";
import { ACTORS, FAMILIES } from "./sourceSeedConstants.ts";

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

function atlasRecords(count: number, generatedAt: string) {
  return Array.from({ length: count }, (_, index) => {
    const actor = ACTORS[index % ACTORS.length]!;
    const family = FAMILIES[index % FAMILIES.length]!;
    return { id: `atlas_${String(index + 1).padStart(5, "0")}`, name: `${actor} ${family} source ${index + 1}`, url: `https://source-${index + 1}.example/cti/${actor.toLowerCase().replaceAll(" ", "-")}`, family, actors: [actor], valueScore: 60 + (index % 40), generatedAt, buyerValue: `Adds public ${actor} collection coverage from ${family}.` };
  });
}
