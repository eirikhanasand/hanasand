import { describe, expect, test } from "bun:test";
import {
  buildSourceMarketplaceApiResponse,
  buildTiSourceAtlasApiResponse,
  buildTiSourceAtlasExportManifestApiResponse,
  importSeedBundle,
  seedDuplicateKey,
  validateSeedBundle,
  type SeedSourceBundle
} from "../registry/sourceSeeds.ts";

function source(url = "https://example.test/feed.xml") {
  return {
    id: "src_test",
    name: "Example CTI Feed",
    type: "rss",
    url,
    accessMethod: "public_http",
    risk: "low",
    trustScore: 0.8,
    crawlFrequencySeconds: 3600,
    legalNotes: "Public RSS feed."
  };
}

describe("compact source seeds", () => {
  test("validates safe public source bundles and catches duplicates", () => {
    const bundle: SeedSourceBundle = { version: 1, name: "test", sources: [source(), { ...source("https://example.test/feed.xml/"), id: "src_dupe" }] };
    const report = importSeedBundle(bundle, { dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.valid).toBe(false);
    expect(report.duplicates[0].key).toBe(seedDuplicateKey(source()));
    expect(validateSeedBundle({ version: 1, name: "safe", sources: [source("https://example.test/other.xml")] }).valid).toBe(true);
  });

  test("rejects unsafe source classes", () => {
    const report = validateSeedBundle({ version: 1, name: "unsafe", sources: [{ ...source("http://bad.onion"), type: "tor_metadata", risk: "high" }] });

    expect(report.valid).toBe(false);
    expect(report.errors[0].message).toContain("safe public CTI");
  });

  test("returns buyer-visible atlas and marketplace rows", () => {
    const atlas = buildTiSourceAtlasApiResponse({ recordLimit: 25, queries: ["APT29"] });
    const manifest = buildTiSourceAtlasExportManifestApiResponse({ recordLimit: 25 });
    const marketplace = buildSourceMarketplaceApiResponse({ limit: 25 });

    expect(atlas.records).toHaveLength(25);
    expect(atlas.coverageMatrix[0].sourceCount).toBeGreaterThan(0);
    expect(manifest.rows.every((row: any) => row.url && row.valueScore >= 60)).toBe(true);
    expect(marketplace.sources.every((row: any) => row.buyerUseCase.includes("Adds public"))).toBe(true);
  });
});
