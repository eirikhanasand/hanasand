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
    const matrix = buildActorSourceCoverageMatrix({ query: "APT29", sources });
    const loop = buildPublicSignalLiveCollectionLoopDto({ query: "APT29", sources });
    const value = buildPublicSignalValueImpact({ publicSignalDeltas: [advisory] });
    const correlation = buildPublicAdvisoryCorrelation({ deltas: [advisory] });

    expect(matrix.rows.some((row: any) => row.status === "ready")).toBe(true);
    expect(loop.nextTasks[0].action).toBe("collect_public_metadata");
    expect(value.sellableRows).toBe(1);
    expect(correlation.actors[0].actor).toBe("APT29");
  });
});
