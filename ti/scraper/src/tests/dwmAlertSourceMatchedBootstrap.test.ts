import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

describe("DWM source-matched alert bootstrap", () => {
  test("does not invent customer watchlists or delivery routes from global captures", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource({
      id: "src_bootstrap_tg",
      name: "Bootstrap public Telegram",
      type: "telegram_public",
      url: "https://t.me/bootstrap_public",
      accessMethod: "public_http",
      status: "active",
      trustScore: 0.82,
      legalNotes: "Public channel metadata only.",
      createdAt: "2026-06-30T10:00:00.000Z",
      updatedAt: "2026-06-30T10:00:00.000Z"
    } as SourceRecord);
    store.saveCapture({
      id: "cap_bootstrap_tg_acme",
      sourceId: "src_bootstrap_tg",
      url: "https://t.me/bootstrap_public/12",
      collectedAt: "2026-06-30T10:04:00.000Z",
      mediaType: "text/plain",
      storageKind: "inline_text",
      contentHash: "hash-bootstrap-tg-acme",
      sensitive: false,
      body: "acme.com appears in public Telegram chatter with a claimed cookie exposure.",
      metadata: { adapter: "telegram_public", channel: "bootstrap_public", messageId: 12 }
    } as RawCapture);

    const response = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts"), {
      store,
      frontier: new FocusedFrontier()
    });
    const payload = await response.json() as any;

    expect(response.status).toBe(200);
    expect(payload.alerts).toEqual([]);
    expect(store.listDwmWatchlists()).toEqual([]);
    expect(store.listWebhookDestinations()).toEqual([]);
  });
});
