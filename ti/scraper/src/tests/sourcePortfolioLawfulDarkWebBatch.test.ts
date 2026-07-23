import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { TorMetadataHttpBoundary } from "../adapters/torMetadataBoundary.ts";
import { importRestrictedMetadataSeedBundle } from "../registry/restrictedSourceSeeds.ts";
import { seedDuplicateKey } from "../registry/sourceSeedsBundle.ts";

const seedDirectory = new URL("../../seeds/", import.meta.url);
const batchName = "source_portfolio_lawful_dark_web.json";
const boundaryModule = new URL("../adapters/torMetadataBoundary.ts", import.meta.url);
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const receiptCore = (receipt: Record<string, any>) => ({
  adapter: receipt.adapter,
  authorityLatestReportedAt: receipt.authorityLatestReportedAt,
  authorityReportedVictimCount: receipt.authorityReportedVictimCount,
  byteBound: receipt.byteBound,
  contentType: receipt.contentType,
  endpointSha256: receipt.endpointSha256,
  httpStatus: receipt.httpStatus,
  observedItemCount: receipt.observedItemCount,
  parsedItemFingerprints: [...receipt.parsedItemFingerprints].sort(),
  parsedSourceTimestamp: receipt.parsedSourceTimestamp,
  parserShape: receipt.parserShape,
  parserVersion: receipt.parserVersion,
  responseBytes: receipt.responseBytes,
  responseSha256: receipt.responseSha256,
  responseTruncated: receipt.responseTruncated
});
const liveBoundaryTest = process.env.TI_TOR_METADATA_PROXY ? test : test.skip;

describe("lawful dark-web source portfolio batch", () => {
  test("retains a non-qualifying live receipt and exercises the production generic post-title parser", async () => {
    const batch = JSON.parse(readFileSync(new URL(batchName, seedDirectory), "utf8"));
    const report = importRestrictedMetadataSeedBundle(batch, "2026-07-23T10:47:05.333Z");
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
      endpointSha256: sha256(new URL(source.url).toString()),
      httpStatus: 200,
      contentType: "text/html",
      byteBound: 64000,
      responseTruncated: false,
      parserVersion: "darknet-metadata-v2",
      parserShape: "generic_post_title",
      observedItemCount: 3,
      parsedSourceTimestamp: null,
      authorityReportedVictimCount: 4,
      authorityLatestReportedAt: "2026-05-05T11:53:39.404Z",
      adapter: "tor_metadata"
    });
    expect(receipt.responseBytes).toBeGreaterThan(0);
    expect(receipt.responseBytes).toBeLessThanOrEqual(receipt.byteBound);
    expect(receipt.responseSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.boundaryModuleSha256).toBe(sha256(readFileSync(boundaryModule)));
    expect(receipt.receiptSha256).toBe(sha256(JSON.stringify(receiptCore(receipt))));
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

  liveBoundaryTest("reproduces the recorded receipt through the approved production boundary", async () => {
    const batch = JSON.parse(readFileSync(new URL(batchName, seedDirectory), "utf8"));
    const source = batch.sources[0];
    const recorded = source.metadata.sourcePortfolioVerification;
    let responseReceipt: Record<string, unknown> = {};
    const boundary = new TorMetadataHttpBoundary({
      proxyUrl: process.env.TI_TOR_METADATA_PROXY!,
      fetcher: async (input, init) => {
        const response = await fetch(input, init);
        const reader = response.clone().body?.getReader();
        const responseHash = createHash("sha256");
        let responseBytes = 0;
        let responseTruncated = false;
        if (reader) while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          const remaining = recorded.byteBound - responseBytes;
          if (remaining <= 0) {
            responseTruncated = true;
            await reader.cancel();
            break;
          }
          const accepted = chunk.value.byteLength > remaining ? chunk.value.subarray(0, remaining) : chunk.value;
          responseHash.update(accepted);
          responseBytes += accepted.byteLength;
          if (accepted.byteLength < chunk.value.byteLength) {
            responseTruncated = true;
            await reader.cancel();
            break;
          }
        }
        responseReceipt = {
          httpStatus: response.status,
          contentType: (response.headers.get("content-type") ?? "").split(";")[0],
          responseBytes,
          responseSha256: responseHash.digest("hex"),
          responseTruncated
        };
        return response;
      }
    });
    const parsed = await boundary.fetchMetadata({
      url: source.url,
      actorName: source.metadata.actorName,
      maxBytes: recorded.byteBound
    });
    const reproduced = {
      adapter: "tor_metadata",
      authorityLatestReportedAt: recorded.authorityLatestReportedAt,
      authorityReportedVictimCount: recorded.authorityReportedVictimCount,
      byteBound: recorded.byteBound,
      contentType: responseReceipt.contentType,
      endpointSha256: sha256(new URL(source.url).toString()),
      httpStatus: responseReceipt.httpStatus,
      observedItemCount: parsed.victimNames.length,
      parsedItemFingerprints: parsed.victimNames.map((value: string) => sha256(value.trim().toLowerCase())).sort(),
      parsedSourceTimestamp: parsed.sourceTimestamp ?? null,
      parserShape: "generic_post_title",
      parserVersion: "darknet-metadata-v2",
      responseBytes: responseReceipt.responseBytes,
      responseSha256: responseReceipt.responseSha256,
      responseTruncated: responseReceipt.responseTruncated
    };

    expect(reproduced).toEqual(receiptCore(recorded));
    expect(sha256(JSON.stringify(reproduced))).toBe(recorded.receiptSha256);
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
