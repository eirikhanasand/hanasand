import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { TorMetadataHttpBoundary } from "../adapters/torMetadataBoundary.ts";
import { importRestrictedMetadataSeedBundle } from "../registry/restrictedSourceSeeds.ts";
import { seedDuplicateKey } from "../registry/sourceSeedsBundle.ts";

const seedDirectory = new URL("../../seeds/", import.meta.url);
const batchName = "source_portfolio_lawful_dark_web.json";

describe("lawful dark-web source portfolio batch", () => {
  test("retains a non-qualifying live receipt and exercises the production generic post-title parser", async () => {
    const batch = JSON.parse(readFileSync(new URL(batchName, seedDirectory), "utf8"));
    const report = importRestrictedMetadataSeedBundle(batch, "2026-07-23T10:36:58.280Z");
    const rejected = batch.reviewedRejectedCandidates as Array<Record<string, unknown>>;
    const source = batch.sources[0];
    const receipt = source.metadata.sourcePortfolioVerification;

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
      crawlFrequencySeconds: 86400,
      metadata: {
        parserProfile: "darknet-metadata-v2",
        productionCollectionOutcome: "metadata_only_parser_verified",
        reportedVictimCount: 4
      }
    });
    expect(source).toMatchObject({
      status: "candidate",
      countsAsCoverage: false,
      metadata: {
        parserShape: "generic_post_title",
        observedParsedItemCount: 3,
        qualificationState: "pending_import_and_two_productive_scheduled_cycles",
        supersedesCandidateRefs: ["feat/tor-1000@b3dc212894ac69504e9e2ff3f1f25ec4b606615e"],
        discoveryAuthorityChain: [
          { name: "Ransomware.live", role: "upstream_group_and_victim_source" },
          { name: "Ransomwhere", role: "derived_public_research_inventory" }
        ]
      }
    });
    expect(receipt).toMatchObject({
      outcome: "content_parsed",
      endpointSha256: createHash("sha256").update(new URL(source.url).toString()).digest("hex"),
      httpStatus: 200,
      contentType: "text/html",
      byteBound: 64000,
      responseBytes: 10787,
      responseSha256: "6b883791a922ad392f4d7796d1cf2ddfef854e2e1e3e54d726efae0240ed0812",
      responseTruncated: false,
      parserVersion: "darknet-metadata-v2",
      parserShape: "generic_post_title",
      observedItemCount: 3,
      parsedSourceTimestamp: null,
      authorityReportedVictimCount: 4,
      authorityLatestReportedAt: "2026-05-05T11:53:39.404Z",
      adapter: "tor_metadata"
    });
    expect(receipt.parsedItemFingerprints).toHaveLength(3);
    expect(new Set(receipt.parsedItemFingerprints).size).toBe(3);
    expect(receipt.parsedItemFingerprints.every((value: string) => /^[a-f0-9]{64}$/.test(value))).toBe(true);

    const boundary = new TorMetadataHttpBoundary({
      proxyUrl: "http://onion-tor:8118",
      fetcher: async () => new Response(
        '<title>Current notices</title><div class="post-title">Northwind Health</div><div class="post-title">Contoso Manufacturing</div><div class="post-title">Fabrikam Services</div><time datetime="2026-07-23T10:36:58.280Z"></time>',
        { status: 200, headers: { "content-type": "text/html" } }
      )
    });
    const parsed = await boundary.fetchMetadata({
      url: `http://${"a".repeat(56)}.onion/`,
      actorName: "ms13089",
      maxBytes: receipt.byteBound
    });

    expect(parsed.victimNames).toEqual(["Northwind Health", "Contoso Manufacturing", "Fabrikam Services"]);
    expect(parsed.sourceTimestamp).toBe("2026-07-23T10:36:58.280Z");
    expect(rejected).toHaveLength(25);
    expect(new Set(rejected.map((row) => row.id)).size).toBe(rejected.length);
    expect(rejected.every((row) => row.disposition === "rejected" && row.countsAsCoverage === false)).toBe(true);
    expect(JSON.stringify(rejected)).not.toMatch(/\.onion\b|https?:\/\/[a-z2-7]{56}\b/i);
  });

  test("uses the production seed key against every shipped seed pack", () => {
    const batch = JSON.parse(readFileSync(new URL(batchName, seedDirectory), "utf8"));
    const batchKeys = batch.sources.map(seedDuplicateKey);
    const existing = readdirSync(seedDirectory)
      .filter((name) => name.endsWith(".json") && name !== batchName)
      .flatMap((name) => JSON.parse(readFileSync(new URL(name, seedDirectory), "utf8")).sources ?? []);

    expect(new Set(batchKeys).size).toBe(batchKeys.length);
    expect(existing.filter((source) => batchKeys.includes(seedDuplicateKey(source)))).toEqual([]);
  });
});
