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

  test("normalizes public Telegram candidate packs without marking them collectable", () => {
    const report = importSeedBundle({
      version: 1,
      name: "public telegram candidates",
      disabledByDefault: true,
      sources: [
        {
          id: "tg_candidate_test",
          name: "Public Test Channel Candidate",
          channelHandle: "public_test_channel",
          publicUrl: "https://t.me/public_test_channel",
          legalNotes: "Candidate public channel; review before collection.",
          approvalState: "pending",
          topicTags: ["ransomware"],
          focus: { ransomware: ["Akira"] },
          rateLimit: { minIntervalSeconds: 600 },
          compliance: { approvalScope: "public_requires_review", legalBasis: "Public CTI monitoring review." },
          trustScore: 0.52
        }
      ]
    }, { dryRun: true, importedAt: "2026-07-02T00:00:00.000Z" });

    expect(report.valid).toBe(true);
    expect(report.accepted[0]).toMatchObject({
      id: "tg_candidate_test",
      type: "telegram_public",
      url: "https://t.me/public_test_channel",
      accessMethod: "public_http",
      status: "candidate",
      risk: "medium",
      governance: { approvalState: "pending", approvalRequired: true },
      metadata: {
        publicTelegramCandidate: true,
        disabledByDefault: true,
        sourceFamily: "telegram_public"
      }
    });
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
