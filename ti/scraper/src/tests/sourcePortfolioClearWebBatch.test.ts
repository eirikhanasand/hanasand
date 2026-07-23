import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_CANARY_SOURCE_PORTFOLIO } from "../ops/canaryPortfolio.ts";

const batchPath = new URL("../../seeds/source_portfolio_clear_web.json", import.meta.url);
const seedDirectory = dirname(fileURLToPath(batchPath));
const batch = JSON.parse(readFileSync(batchPath, "utf8"));

describe("clear-web source portfolio batch", () => {
  test("contains only canonical executable feeds with complete verification metadata", () => {
    expect(batch).toMatchObject({
      schemaVersion: "ti.source_portfolio_batch.v1",
      family: "clear_web",
      version: 1,
    });
    expect(batch.sources).toHaveLength(12);
    expect(batch.exclusions).toHaveLength(26);

    const ids = new Set<string>();
    const endpoints = new Set<string>();
    for (const source of batch.sources) {
      const key = canonicalFeedKey(source.url);
      expect(source.url).toBe(key);
      expect(ids.has(source.id)).toBe(false);
      expect(endpoints.has(key)).toBe(false);
      ids.add(source.id);
      endpoints.add(key);

      expect(source).toMatchObject({
        id: stableSourceId(key),
        type: "rss",
        accessMethod: "public_http",
        status: "active",
        risk: "low",
        governance: {
          approvalRequired: false,
          approvalState: "approved",
          approvalScope: "safe_public_auto",
          metadataOnly: false,
          policyVersion: "collection-policy:v1",
        },
        metadata: {
          productionCollection: true,
          sourceFamily: "clear_web",
          sourcePortfolioVerification: {
            outcome: "content_parsed",
            httpStatus: 200,
            adapter: "rss",
          },
        },
        catalog: {
          approvalScope: "safe_public_auto",
          retentionClass: "standard",
          adapterCompatibility: ["rss"],
        },
      });
      expect(source.name.trim().split(/\s+/).length).toBeGreaterThan(2);
      expect(source.legalNotes).toContain(source.name);
      expect(source.trustScore).toBeGreaterThanOrEqual(0.7);
      expect(source.crawlFrequencySeconds).toBeGreaterThanOrEqual(3600);
      expect(source.metadata.activityWindowSeconds).toBeGreaterThanOrEqual(source.crawlFrequencySeconds);
      expect(source.metadata.maxItemsPerFetch).toBeGreaterThan(0);
      expect(source.metadata.sourcePortfolioVerification.observedItemCount).toBeGreaterThan(0);
      expect(source.metadata.sourcePortfolioVerification.contentType).toMatch(/(?:rss|atom|xml)/i);
      expect(source.metadata.sourcePortfolioVerification.publisherReference).toMatch(/^https:\/\//);
      expect(Number.isFinite(Date.parse(source.metadata.sourcePortfolioVerification.latestPublishedAt))).toBe(true);
      expect(source.catalog.publisher.name).toBeTruthy();
      expect(source.catalog.legalBasis).toBe(source.legalNotes);
      expect(source.catalog.coverage.topics.length).toBeGreaterThan(0);
      expect(source.catalog.collection.crawlCadenceSeconds).toBe(source.crawlFrequencySeconds);
      for (const prohibited of ["health", "lastSeenAt", "lastUsefulAt", "crawlState"]) {
        expect(Object.hasOwn(source, prohibited)).toBe(false);
      }
    }
  });

  test("deduplicates by normalized endpoint across adapters and every reserved source pack", () => {
    const reserved = new Set<string>();
    for (const file of readdirSync(seedDirectory).filter((name) => name.endsWith(".json") && name !== basename(fileURLToPath(batchPath)))) {
      visit(JSON.parse(readFileSync(join(seedDirectory, file), "utf8")), (value) => {
        if (value && typeof value === "object" && typeof value.url === "string") reserved.add(canonicalFeedKey(value.url));
      });
    }
    for (const source of PUBLIC_CANARY_SOURCE_PORTFOLIO) reserved.add(canonicalFeedKey(source.url));

    for (const source of batch.sources) expect(reserved.has(canonicalFeedKey(source.url))).toBe(false);
    expect(canonicalFeedKey("https://EXAMPLE.test/feed/#fragment")).toBe(canonicalFeedKey("https://example.test/feed"));
  });

  test("keeps exclusions locator-safe and distinct from accepted feeds", () => {
    const acceptedHashes = new Set(batch.sources.map((source: any) => hash(canonicalFeedKey(source.url)).slice(0, 24)));
    for (const exclusion of batch.exclusions) {
      expect(Object.keys(exclusion).sort()).toEqual(["idOrUrlHash", "reason", "verifiedAt"]);
      expect(exclusion.idOrUrlHash).toMatch(/^[a-f0-9]{24}$/);
      expect(exclusion.reason).toMatch(/^[a-z0-9_]+$/);
      expect(exclusion.verifiedAt).toBe(batch.generatedAt);
      expect(acceptedHashes.has(exclusion.idOrUrlHash)).toBe(false);
      expect(JSON.stringify(exclusion)).not.toMatch(/https?:\/\/|\.onion\b|token|credential/i);
    }
  });
});

function canonicalFeedKey(value: string) {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function stableSourceId(url: string) {
  return `src_portfolio_cw_${hash(url).slice(0, 20)}`;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function visit(value: unknown, callback: (value: any) => void): void {
  callback(value);
  if (Array.isArray(value)) value.forEach((item) => visit(item, callback));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => visit(item, callback));
}
