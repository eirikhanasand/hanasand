import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { TorMetadataHttpBoundary } from "../adapters/torMetadataBoundary.ts";
import { importRestrictedMetadataSeedBundle } from "../registry/restrictedSourceSeeds.ts";

const portfolioPath = "seeds/source_portfolio_lawful_dark_web.json";

describe("independently verified lawful dark-web source portfolio", () => {
  test("imports only endpoint-unique parser-verified metadata sources", async () => {
    const bundle = await Bun.file(portfolioPath).json();
    const report = importRestrictedMetadataSeedBundle(bundle, bundle.generatedAt);
    const portfolioKeys = bundle.sources.map((source: any) => canonicalFeedKey(source.url));
    const reservedKeys = await existingRestrictedKeys();

    expect(bundle).toMatchObject({
      schemaVersion: "ti.source_portfolio_batch.v1",
      family: "lawful_dark_web",
      version: 1,
      disabledByDefault: true,
      network: "tor",
      proxyBoundaryId: "tor-approved-metadata-proxy",
      approvalScope: "metadata_only",
      retentionClass: "restricted_metadata"
    });
    expect(report).toMatchObject({ valid: true, errors: [], duplicates: [] });
    expect(bundle.sources).toHaveLength(1);
    expect(new Set(portfolioKeys).size).toBe(portfolioKeys.length);
    expect(portfolioKeys.filter((key: string) => reservedKeys.has(key))).toEqual([]);

    const source = bundle.sources[0];
    expect(source).toMatchObject({
      id: "restricted_ms13089_victim_blog",
      type: "tor_metadata",
      accessMethod: "approved_proxy",
      status: "candidate",
      risk: "restricted",
      crawlFrequencySeconds: 86400,
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvalScope: "metadata_only"
      },
      metadata: {
        sourceFamily: "dark_web_victim_feed",
        actorName: "MS13089",
        productionCollectionOutcome: "metadata_only_parser_verified",
        parserProfile: "generic_news_item_or_post_title",
        reportedVictimCount: 4,
        collectionScope: "metadata_only",
        retainRawContent: false,
        sourcePortfolioVerification: {
          outcome: "content_parsed",
          observedItemCount: 3,
          httpStatus: 200,
          adapter: "tor_metadata",
          parserVersion: "darknet-metadata-v2"
        }
      }
    });
    expect(source.metadata.sourcePortfolioVerification.verifiedAt).toBe(bundle.generatedAt);
    expect(source.metadata.sourcePortfolioVerification.legalBasisVerifiedAt).toBe(bundle.generatedAt);
    expect(Date.parse(bundle.generatedAt) - Date.parse(source.metadata.lastReportedVictimAt)).toBeLessThan(90 * 86_400_000);
    expect(report.accepted[0]).toMatchObject({
      id: source.id,
      status: "candidate",
      governance: { approvalState: "approved", metadataOnly: true },
      metadata: {
        actorName: "MS13089",
        parserProfile: "generic_news_item_or_post_title",
        productionCollectionOutcome: "metadata_only_parser_verified"
      }
    });

    const boundary = new TorMetadataHttpBoundary({
      proxyUrl: "http://onion-tor:8118",
      fetcher: async () => new Response(
        '<title>MS13089 disclosures</title><div class="post-title">Northwind Health</div><div class="post-title">Contoso Manufacturing</div><div class="post-title">Fabrikam Services</div>',
        { headers: { "content-type": "text/html" } }
      )
    });
    const metadata = await boundary.fetchMetadata({ url: source.url, actorName: "MS13089" });
    expect(metadata.victimNames).toEqual(["Northwind Health", "Contoso Manufacturing", "Fabrikam Services"]);
    expect(metadata.links).toEqual([]);

    expect(bundle.reviewedRejectedCandidates).toHaveLength(59);
    expect(bundle.reviewedRejectedCandidates.every((item: any) =>
      item.disposition === "rejected"
      && item.countsAsCoverage === false
      && /^[a-z0-9_]+$/.test(item.id)
      && /^https:\/\//.test(item.discoveryAuthorityRecordUrl)
      && !JSON.stringify(item).includes(".onion")
    )).toBe(true);

    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toMatch(/"(?:rawText|body|messageText|scrapedContent|health|lastSeen|last_seen|lastSuccessful|lastUseful|crawlState)"/);
    expect(serialized).not.toMatch(/"(?:generatedPublicSourcePack|generatedSourcePack|paddedSourcePack|paddedSource)"\s*:\s*true/);
    expect(source.metadata.sourcePortfolioVerification.endpointHash).toBeUndefined();
    expect(createHash("sha256").update(canonicalFeedKey(source.url)).digest("hex")).toMatch(/^[a-f0-9]{64}$/);
  });
});

function canonicalFeedKey(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/$/, "");
  url.searchParams.sort();
  return url.toString();
}

async function existingRestrictedKeys() {
  const keys = new Set<string>();
  for await (const path of new Bun.Glob("seeds/*.json").scan(".")) {
    if (path === portfolioPath) continue;
    collectUrls(await Bun.file(path).json(), keys);
  }
  return keys;
}

function collectUrls(value: unknown, keys: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, keys);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (key === "url" && typeof item === "string") {
      try {
        if (new URL(item).hostname.toLowerCase().endsWith(".onion")) keys.add(canonicalFeedKey(item));
      } catch {}
    } else {
      collectUrls(item, keys);
    }
  }
}
