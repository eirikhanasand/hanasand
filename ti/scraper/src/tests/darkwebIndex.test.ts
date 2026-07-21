import { describe, expect, test } from "bun:test";
import { buildDarkwebIndexStatus, darkwebIndexContract, darkwebIndexFixtureRecords, searchDarkwebIndex } from "../adapters/darkwebIndex.ts";

describe("compact darkweb metadata index", () => {
  test("keeps a searchable metadata-only index with sellable rows", () => {
    const records = darkwebIndexFixtureRecords(120);
    const status = buildDarkwebIndexStatus(records);
    const search = searchDarkwebIndex({ records, q: "akira", network: "tor", limit: 10 });
    expect(records).toHaveLength(120);
    expect(status.metadataOnly).toBe(true);
    expect(status.indexedRecordCount).toBe(120);
    expect(status.monitoredSourceCount).toBe(120);
    expect(status).not.toHaveProperty("targetRecordCount");
    expect(status).not.toHaveProperty("indexedRecordEstimate");
    expect(status.sellableRowCount).toBeGreaterThan(20);
    expect(status.productHandoff.buyerSearchRows[0].safeLocatorHash).toStartWith("h_");
    expect(search.rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(search.rows)).not.toMatch(/\\.onion|rawUrl|bodyHtml/);
  });

  test("derives counts and search rows from persisted captures", () => {
    const sources = [{ id: "source-akira", type: "tor_metadata" }];
    const captures = [{
      id: "capture-akira-acme",
      sourceId: "source-akira",
      storageKind: "metadata_only",
      collectedAt: "2026-07-21T08:00:00.000Z",
      publishedAt: "2026-07-21T07:55:00.000Z",
      metadata: { leakSite: { actorName: "Akira", victimName: "Acme Industries", claimedSector: "manufacturing" } },
    }];
    const status = buildDarkwebIndexStatus({ sources, captures });
    const result = searchDarkwebIndex({ sources, captures, q: "akira", network: "tor" });
    const unrelated = searchDarkwebIndex({ sources, captures, q: "lockbit" });

    expect(status.indexedRecordCount).toBe(1);
    expect(status.monitoredSourceCount).toBe(1);
    expect(status.latestRecordAt).toBe("2026-07-21T08:00:00.000Z");
    expect(result.count).toBe(1);
    expect(result.rows[0]).toMatchObject({ title: "Akira Acme Industries", actorHints: ["Akira"], victimHints: ["Acme Industries"] });
    expect(unrelated).toMatchObject({ count: 0, rows: [] });
  });

  test("documents the public API contract without unsafe output", () => {
    const contract = darkwebIndexContract();
    expect(contract.routes).toContain("/v1/darkweb/search");
    expect(contract.safety).toMatchObject({
      metadataOnly: true,
      noPayloadFollowing: true,
      noCredentialDownloads: true,
      noThreatActorInteraction: true
    });
  });
});
