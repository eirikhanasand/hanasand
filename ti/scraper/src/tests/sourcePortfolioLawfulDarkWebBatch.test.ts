import { readFileSync } from "node:fs";
import { importRestrictedMetadataSeedBundle } from "../registry/restrictedSourceSeeds.ts";

describe("lawful dark-web source portfolio batch", () => {
  test("admits only parser-verified feeds and keeps failed probes out of coverage", () => {
    const batch = JSON.parse(readFileSync(
      new URL("../../seeds/source_portfolio_lawful_dark_web.json", import.meta.url),
      "utf8"
    ));
    const existing = JSON.parse(readFileSync(
      new URL("../../seeds/restricted_metadata_source_packs.json", import.meta.url),
      "utf8"
    ));
    const report = importRestrictedMetadataSeedBundle(batch, "2026-07-23T10:06:20.000Z");
    const rejected = batch.reviewedRejectedCandidates as Array<Record<string, unknown>>;
    const source = batch.sources[0];
    const hosts = [...existing.sources, ...batch.sources].map((row) => new URL(row.url).hostname);

    expect(batch).toMatchObject({
      schemaVersion: "ti.source_portfolio_batch.v1",
      family: "lawful_dark_web",
      disabledByDefault: true,
      network: "tor",
      approvalScope: "metadata_only",
      retentionClass: "restricted_metadata"
    });
    expect(report).toMatchObject({ valid: true, errors: [] });
    expect(report.accepted).toHaveLength(1);
    expect(report.accepted[0]).toMatchObject({
      id: "restricted_ms13089_victim_blog",
      status: "candidate",
      metadata: {
        parserProfile: "post_title_victim_listing",
        productionCollectionOutcome: "metadata_only_parser_verified",
        reportedVictimCount: 4
      }
    });
    expect(source.metadata.sourcePortfolioVerification).toMatchObject({
      outcome: "content_parsed",
      observedItemCount: 3,
      httpStatus: 200,
      adapter: "tor_metadata"
    });
    expect(new Set(hosts).size).toBe(hosts.length);
    expect(rejected).toHaveLength(25);
    expect(new Set(rejected.map((row) => row.id)).size).toBe(rejected.length);
    expect(rejected.every((row) => row.disposition === "rejected" && row.countsAsCoverage === false)).toBe(true);
    expect(JSON.stringify(rejected)).not.toMatch(/\.onion\b|https?:\/\/[a-z2-7]{56}\b/i);
  });
});
