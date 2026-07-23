import { describe, expect, test } from "bun:test";
import { evaluateSourceForCollection, isExecutableSource } from "../policy/collectionPolicy.ts";
import { importSeedBundle } from "../registry/sourceSeeds.ts";
import { canonicalFeedKey } from "../registry/sourceSeedUtils.ts";

const portfolioPath = "seeds/source_portfolio_public_telegram.json";

describe("independently verified public Telegram source portfolio", () => {
  test("imports executable publisher-linked channels without endpoint aliases or scraped content", async () => {
    const bundle = await Bun.file(portfolioPath).json();
    const report = importSeedBundle(bundle, { importedAt: bundle.generatedAt });
    const portfolioKeys = bundle.sources.map((source: any) => canonicalFeedKey(source.url));
    const reservedKeys = await existingTelegramKeys();

    expect(bundle).toMatchObject({
      schemaVersion: "ti.source_portfolio_batch.v1",
      family: "public_telegram",
      version: 1,
      disabledByDefault: false
    });
    expect(bundle.sources.length).toBeGreaterThan(0);
    expect(report).toMatchObject({ valid: true, errors: [], duplicates: [] });
    expect(new Set(portfolioKeys).size).toBe(portfolioKeys.length);
    expect(portfolioKeys.filter((key: string) => reservedKeys.has(key))).toEqual([]);
    expect(canonicalFeedKey("https://telegram.me/S/CISOCLUB/")).toBe(canonicalFeedKey("https://t.me/cisoclub"));
    expect(canonicalFeedKey("https://t.me/s/CisoClub?utm_source=copy&before=42")).toBe(canonicalFeedKey("https://t.me/cisoclub"));

    for (const [index, source] of bundle.sources.entries()) {
      const handle = new URL(source.url).pathname.slice(1);
      const verification = source.metadata.sourcePortfolioVerification;

      expect(source).toMatchObject({
        id: `src_portfolio_tg_${handle}`,
        type: "telegram_public",
        url: `https://t.me/${handle}`,
        accessMethod: "public_http",
        status: "active",
        risk: "low",
        language: expect.any(String),
        governance: {
          approvalRequired: true,
          approvalState: "approved",
          approvalScope: "official_public_web_preview",
          metadataOnly: false
        },
        metadata: {
          productionCollection: true,
          sourceFamily: "telegram_public",
          collectionMode: "public_web_preview",
          mediaPolicy: "metadata_only_no_download",
          channelHandle: handle,
          sourcePortfolioVerification: {
            outcome: "content_parsed",
            httpStatus: 200,
            adapter: "telegram_public",
            parserVersion: "telegram-public-preview:v1"
          }
        },
        catalog: {
          publisher: {
            name: expect.any(String),
            country: expect.any(String),
            homepage: expect.stringMatching(/^https:\/\//),
            trustBasis: expect.stringContaining("exact public Telegram handle")
          },
          legalBasis: expect.any(String),
          coverage: {
            topics: expect.any(Array),
            languages: expect.any(Array),
            queryPatterns: expect.any(Array)
          },
          collection: {
            crawlCadenceSeconds: source.crawlFrequencySeconds
          },
          adapterCompatibility: ["telegram_public"]
        }
      });
      expect(source.trustScore).toBeGreaterThan(0);
      expect(source.crawlFrequencySeconds).toBeGreaterThanOrEqual(300);
      expect(source.legalNotes).toContain("unauthenticated public-preview text");
      expect(source.legalNotes).toContain("do not join");
      expect(source.metadata.activityWindowSeconds).toBeGreaterThan(0);
      expect(source.metadata.maxItemsPerFetch).toBeGreaterThan(0);
      expect(verification.verifiedAt).toBe(bundle.generatedAt);
      expect(verification.legalBasisVerifiedAt).toBe(bundle.generatedAt);
      expect(verification.observedItemCount).toBeGreaterThanOrEqual(1);
      expect(verification.observedCadenceSeconds).toBeGreaterThanOrEqual(300);
      expect(verification.contentType).toContain("text/html");
      expect(verification.publisherReference).toMatch(/^https:\/\//);
      expect(verification.publisherReference).not.toMatch(/(?:t\.me|telegram\.me|github\.com\/k0yt)/i);
      expect(evaluateSourceForCollection(report.accepted[index])).toMatchObject({ allowed: true });
      expect(isExecutableSource(report.accepted[index])).toBe(true);
    }

    for (const exclusion of bundle.exclusions) {
      expect(Object.keys(exclusion).sort()).toEqual(["idOrUrlHash", "reason", "verifiedAt"]);
      expect(exclusion.idOrUrlHash).toMatch(/^[a-f0-9]{64}$/);
      expect(exclusion.verifiedAt).toBe(bundle.generatedAt);
    }

    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toMatch(/"(?:sample|rawText|body|messageText|scrapedContent|health|lastSeen|last_seen|lastSuccessful|lastUseful|crawlState)"/);
    expect(serialized).not.toMatch(/"(?:generatedPublicSourcePack|generatedSourcePack|paddedSourcePack|paddedSource)"\s*:\s*true/);
    expect(serialized).not.toMatch(/(?:joinchat|https:\/\/t\.me\/\+|https:\/\/t\.me\/c\/)/i);
  });
});

async function existingTelegramKeys() {
  const keys = new Set<string>();
  for await (const path of new Bun.Glob("seeds/*.json").scan(".")) {
    if (path === portfolioPath) continue;
    collectUrls(await Bun.file(path).json(), keys);
  }
  for await (const path of new Bun.Glob("src/ops/canaryPortfolio*.ts").scan(".")) {
    const text = await Bun.file(path).text();
    for (const match of text.matchAll(/https:\/\/(?:t\.me|telegram\.me)\/(?:s\/)?[a-z0-9_]+/gi)) {
      keys.add(canonicalFeedKey(match[0]));
    }
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
    if (key === "url" && typeof item === "string" && /^https:\/\/(?:t\.me|telegram\.me)\//i.test(item)) {
      keys.add(canonicalFeedKey(item));
    } else {
      collectUrls(item, keys);
    }
  }
}
