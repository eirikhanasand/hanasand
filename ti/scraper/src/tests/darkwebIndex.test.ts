import { describe, expect, test } from "bun:test";
import { buildDarkwebIndexStatus, darkwebIndexContract, darkwebIndexFixtureRecords, searchDarkwebIndex } from "../adapters/darkwebIndex.ts";

describe("compact darkweb metadata index", () => {
  test("keeps a searchable metadata-only index with sellable rows", () => {
    const records = darkwebIndexFixtureRecords(120);
    const status = buildDarkwebIndexStatus(records);
    const search = searchDarkwebIndex({ records, q: "akira", network: "tor", limit: 10 });
    expect(records).toHaveLength(120);
    expect(status.metadataOnly).toBe(true);
    expect(status.sellableRowCount).toBeGreaterThan(20);
    expect(status.productHandoff.buyerSearchRows[0].safeLocatorHash).toStartWith("h_");
    expect(search.rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(search.rows)).not.toMatch(/\\.onion|rawUrl|bodyHtml/);
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
