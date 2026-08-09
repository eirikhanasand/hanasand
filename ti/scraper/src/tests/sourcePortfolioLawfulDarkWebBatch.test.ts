import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { importRestrictedMetadataSeedBundle } from "../registry/restrictedSourceSeeds.ts";
import { canonicalFeedKey } from "../registry/sourceSeedUtils.ts";

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
    const report = importRestrictedMetadataSeedBundle(batch, "2026-08-09T10:00:00.000Z");
    const rejected = batch.reviewedRejectedCandidates as Array<Record<string, unknown>>;
    const source = batch.sources.find((row: any) => row.id === "restricted_ms13089_victim_blog");
    const revalidated = batch.sources.find((row: any) => row.id === "restricted_deadlock_victim_blog");
    const feedKeys = [...existing.sources, ...batch.sources].map((row) => canonicalFeedKey(row.url));
    const expectedProfiles = new Map([
      ["restricted_ms13089_victim_blog", ["post_title_victim_listing", 3]],
      ["restricted_deadlock_victim_blog", ["news_item_headline", 10]],
      ["restricted_cmdorganization_victim_blog", ["item_header_link", 3]],
      ["restricted_exfilsquad_victim_blog", ["company_header_name", 13]],
      ["restricted_global_secret_group_victim_blog", ["card_body_title", 24]],
      ["restricted_triple_x_victim_blog", ["post_container_title", 4]],
      ["restricted_exitium_victim_blog", ["target_card_title", 4]],
      ["restricted_insomnia_victim_blog", ["book_card_info_title", 24]],
      ["restricted_dragonforce_victim_blog", ["companies_status_link", 24]],
      ["restricted_incransom_victim_api", ["json_announcements_company_name", 15]],
      ["restricted_ransomhouse_victim_blog", ["json_data_header", 22]]
    ]);

    expect(batch).toMatchObject({
      schemaVersion: "ti.source_portfolio_batch.v1",
      family: "lawful_dark_web",
      disabledByDefault: true,
      network: "tor",
      approvalScope: "metadata_only",
      retentionClass: "restricted_metadata"
    });
    expect(report).toMatchObject({ valid: true, errors: [] });
    expect(report.accepted).toHaveLength(11);
    expect(report.accepted.find((row) => row.id === "restricted_ms13089_victim_blog")).toMatchObject({
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
    expect(revalidated).toMatchObject({
      metadata: {
        observedParsedItemCount: 10,
        qualificationState: "pending_import_and_two_productive_scheduled_cycles",
        sourcePortfolioVerification: { outcome: "content_parsed", observedItemCount: 10, httpStatus: 200 }
      }
    });
    for (const accepted of report.accepted) {
      const expected = expectedProfiles.get(accepted.id);
      expect(expected).toBeDefined();
      expect(accepted).toMatchObject({
        status: "candidate",
        type: "tor_metadata",
        accessMethod: "approved_proxy",
        metadata: {
          parserProfile: expected![0],
          productionCollectionOutcome: "metadata_only_parser_verified",
          sourcePortfolioVerification: {
            outcome: "content_parsed",
            observedItemCount: expected![1],
            httpStatus: 200,
            adapter: "tor_metadata"
          }
        }
      });
      expect(accepted.metadata.reportedVictimCount).toBeGreaterThan(0);
      expect(Number.isFinite(Date.parse(accepted.metadata.lastReportedVictimAt))).toBe(true);
    }
    expect(new Set(feedKeys).size).toBe(feedKeys.length);
    expect(rejected).toHaveLength(78);
    expect(new Set(rejected.map((row) => row.id)).size).toBe(rejected.length);
    expect(rejected.every((row) => row.disposition === "rejected" && row.countsAsCoverage === false)).toBe(true);
    expect(JSON.stringify(rejected)).not.toMatch(/\.onion\b|https?:\/\/[a-z2-7]{56}\b/i);
  });
});
