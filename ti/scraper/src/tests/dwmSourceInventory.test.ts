import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { applyDwmSeedCatalog, buildDwmSeedCatalog, buildDwmSourceInventory } from "../product/dwmSourceInventory.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { SourceRecord } from "../types.ts";

const generatedAt = "2026-06-27T12:00:00.000Z";

describe("dwm source inventory", () => {
  test("generates public Telegram and metadata-only dark-web seed catalogs", () => {
    const catalog = buildDwmSeedCatalog({ watchlist: ["acme.com", "Acme Payments"], generatedAt });

    expect(catalog.packs.length).toBeGreaterThanOrEqual(5);
    expect(catalog.candidates.filter((candidate) => candidate.family === "telegram_public").length).toBeGreaterThanOrEqual(3000);
    expect(catalog.candidates.filter((candidate) => candidate.family === "darkweb_metadata").length).toBeGreaterThanOrEqual(4000);
    expect(catalog.candidates.every((candidate) => candidate.source.metadata.mediaPolicy === "metadata_only_no_download")).toBe(true);
    expect(catalog.candidates.find((candidate) => candidate.family === "darkweb_metadata")?.source.legalNotes).toContain("No credential bypass");
  });

  test("dedupes registered sources into review workflow instead of creating duplicate candidates", () => {
    const existing: SourceRecord = {
      id: "src_existing_tg",
      name: "Existing ransomware live",
      type: "telegram_public",
      url: "https://t.me/ransomwarelive",
      accessMethod: "public_http",
      status: "active",
      trustScore: 0.8,
      legalNotes: "Public preview only.",
      createdAt: generatedAt,
      updatedAt: generatedAt
    } as SourceRecord;

    const inventory = buildDwmSourceInventory({ sources: [existing], watchlist: ["acme.com"], generatedAt, includeCandidates: true });

    expect(inventory.counts.registeredTelegramPublic).toBe(1);
    expect(inventory.counts.duplicateCandidates).toBeGreaterThanOrEqual(1);
    expect(inventory.reviewQueue.some((item) => item.reviewState === "blocked_duplicate" && item.duplicateOf === "src_existing_tg")).toBe(true);
  });

  test("applies Telegram seed packs as canary-safe sources and reports duplicates", () => {
    const store = new InMemoryScraperStore();
    const first = applyDwmSeedCatalog({
      store,
      seedPackIds: ["telegram-ransomware-claim-watch"],
      watchlist: ["acme.com"],
      activate: true,
      limit: 12,
      generatedAt
    });
    const second = applyDwmSeedCatalog({
      store,
      seedPackIds: ["telegram-ransomware-claim-watch"],
      activate: true,
      limit: 12,
      generatedAt
    });

    expect(first.summary.createdCount).toBe(12);
    expect(first.summary.telegramPublicCreated).toBe(12);
    expect(first.createdSources.every((source) => source.status === "canary")).toBe(true);
    expect(first.createdSources.every((source) => source.metadata.collectionBoundary.noPrivateAccess === true)).toBe(true);
    expect(second.summary.createdCount).toBe(0);
    expect(second.summary.duplicateCount).toBe(12);
  });

  test("approves dark-web seed packs as metadata-only active sources", () => {
    const store = new InMemoryScraperStore();
    const first = applyDwmSeedCatalog({
      store,
      seedPackIds: ["darkweb-actor-metadata-core"],
      activate: true,
      approveMetadataOnly: true,
      approvedBy: "analyst-1",
      limit: 6,
      generatedAt
    });
    const second = applyDwmSeedCatalog({
      store,
      seedPackIds: ["darkweb-actor-metadata-core"],
      activate: true,
      approveMetadataOnly: true,
      approvedBy: "analyst-1",
      limit: 6,
      generatedAt: "2026-06-27T12:30:00.000Z"
    });

    expect(first.summary.createdCount).toBe(6);
    expect(first.summary.darkwebMetadataCreated).toBe(6);
    expect(first.createdSources.every((source) => source.status === "active")).toBe(true);
    expect(first.createdSources.every((source) => source.governance?.metadataOnly === true)).toBe(true);
    expect(first.createdSources.every((source) => source.governance?.approvalState === "approved")).toBe(true);
    expect(second.summary.createdCount).toBe(6);
    expect(second.summary.duplicateCount).toBe(0);
    expect(store.listSources().filter((source) => source.type === "darkweb_metadata")).toHaveLength(6);
    expect(store.listSources().every((source) => source.metadata?.metadataOnlyApproved === true)).toBe(true);
  });

  test("mounts source pack and source inventory API routes", async () => {
    const store = new InMemoryScraperStore();
    const options = { store, frontier: new FocusedFrontier() };

    const applyResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-requests", {
      method: "POST",
      body: JSON.stringify({ seedPackIds: ["telegram-stealer-broker-watch"], activate: true, limit: 10, scope: "acme.com" })
    }), options);
    const applyBody = await applyResponse.json() as any;
    const inventoryResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-inventory?watchlist=acme.com"), options);
    const inventoryBody = await inventoryResponse.json() as any;
    const packsResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/source-packs"), options);
    const packsBody = await packsResponse.json() as any;

    expect(applyResponse.status).toBe(201);
    expect(applyBody.summary.createdCount).toBe(10);
    expect(inventoryBody.schemaVersion).toBe("dwm.source_inventory.v1");
    expect(inventoryBody.counts.registeredTelegramPublic).toBe(10);
    expect(packsBody.counts.telegramPublic).toBeGreaterThanOrEqual(3000);
  });
});
