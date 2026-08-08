import { describe, expect, test } from "bun:test";
import {
  buildActorSourceCoverageMatrix,
  buildPublicAdvisoryCorrelation,
  buildPublicSignalFusionWorkbench,
  buildPublicSignalLiveCollectionLoopDto,
  buildPublicSignalValueImpact
} from "../adapters/publicSignalFusion.ts";
import type { SourceRecord } from "../types.ts";

const sources: SourceRecord[] = [
  { id: "src_vendor", name: "APT29 vendor report", type: "rss", url: "https://vendor.example/rss", accessMethod: "public_http", status: "active", risk: "low", trustScore: 0.86, crawlFrequencySeconds: 3600, legalNotes: "Public feed.", createdAt: "2026-06-21T00:00:00.000Z", updatedAt: "2026-06-21T00:00:00.000Z" },
  { id: "src_dark", name: "Darkweb metadata monitor", type: "tor_metadata", url: "metadata://darkweb", accessMethod: "approved_proxy", status: "active", risk: "medium", trustScore: 0.7, crawlFrequencySeconds: 900, legalNotes: "Metadata only.", createdAt: "2026-06-21T00:00:00.000Z", updatedAt: "2026-06-21T00:00:00.000Z" }
] as SourceRecord[];

const advisory = {
  id: "adv_apt29",
  sourceId: "src_vendor",
  family: "vendor_report",
  title: "APT29 phishing update",
  url: "https://vendor.example/apt29",
  summary: "APT29 phishing campaign against diplomatic targets.",
  confidence: 0.78,
  matchedEntities: { actors: ["APT29"], sectors: ["government"], victims: ["diplomatic targets"] }
};

describe("compact public signal fusion", () => {
  test("builds buyer-visible public signal rows", () => {
    const fusion = buildPublicSignalFusionWorkbench({ query: "APT29", sources, advisorySignals: [advisory] });

    expect(fusion.status).toBe("ready");
    expect(fusion.selectedSources.length).toBeGreaterThan(0);
    expect(fusion.publicSignalDeltas[0].matchedEntities.actors).toContain("APT29");
    expect(fusion.publicSignalValueImpact.sellableRows).toBe(1);
  });

  test("surfaces coverage and next collection tasks", () => {
    const matrix = buildActorSourceCoverageMatrix({ query: "APT29", sources, deltas: [advisory] });
    const loop = buildPublicSignalLiveCollectionLoopDto({ query: "APT29", sources });
    const value = buildPublicSignalValueImpact({ publicSignalDeltas: [advisory] });
    const correlation = buildPublicAdvisoryCorrelation({ deltas: [advisory] });

    expect(matrix.rows.some((row: any) => row.status === "ready")).toBe(true);
    expect(loop.nextTasks[0].action).toBe("collect_public_metadata");
    expect(value.sellableRows).toBe(1);
    expect(correlation.actors[0].actor).toBe("APT29");
  });

  test("does not count registered sources as observed coverage", () => {
    const matrix = buildActorSourceCoverageMatrix({ query: "APT29", sources, deltas: [] });
    const fusion = buildPublicSignalFusionWorkbench({ query: "APT29", sources });

    expect(matrix.rows.every((row: any) => row.sourceCount === 0 && row.status === "coverage_gap")).toBe(true);
    expect(fusion.familyCoverage).toMatchObject({ familiesCovered: [], diversityScore: 0, evidenceBacked: true });
    expect(fusion.sourceCoverageGaps.every((row: any) => row.reason === "no retained evidence observed")).toBe(true);
  });

  test("does not promote deltas whose source is not in the monitored registry", () => {
    const fusion = buildPublicSignalFusionWorkbench({
      query: "APT29",
      sources,
      advisorySignals: [{ ...advisory, sourceId: "unregistered_source" }],
    });

    expect(fusion.status).toBe("partial");
    expect(fusion.publicSignalDeltas).toEqual([]);
    expect(fusion.publicSignalValueImpact.sellableRows).toBe(0);
  });

  test("does not promote evidence from inactive or non-coverage sources", () => {
    const fusion = buildPublicSignalFusionWorkbench({
      query: "APT29",
      sources: [
        ...sources,
        { ...sources[0], id: "src_retired", status: "retired" },
        { ...sources[0], id: "src_held", status: "active", countsAsCoverage: false },
      ],
      advisorySignals: [
        { ...advisory, sourceId: "src_retired" },
        { ...advisory, id: "adv_held", sourceId: "src_held" },
      ],
    });

    expect(fusion.publicSignalDeltas).toEqual([]);
    expect(fusion.publicSignalValueImpact.sellableRows).toBe(0);
    expect(fusion.selectedSources.map((source: any) => source.id)).not.toEqual(expect.arrayContaining(["src_retired", "src_held"]));
  });
});
