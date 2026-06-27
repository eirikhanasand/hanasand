import { describe, expect, test } from "bun:test";
import { feedItems } from "../ops/canaryFeedItems.ts";
import { fetchItems } from "../ops/canaryHelpers.ts";

const source = {
  id: "src_public_telegram_test",
  name: "Public Telegram Test Channel",
  type: "telegram_public",
  url: "https://t.me/public_threat_test",
  metadata: { maxItemsPerFetch: 5 }
};

const task = {
  id: "task_public_telegram_test",
  sourceId: source.id,
  targetUrl: source.url,
  sourceType: source.type
};

const html = `
<html><body><section>
  <div class="tgme_widget_message" data-post="public_threat_test/42">
    <a class="tgme_widget_message_author">Threat research feed</a>
    <div class="tgme_widget_message_text">Acme Payments acme.com mentioned in Lumma C2 session cookie and OAuth token chatter. No files attached.</div>
    <time datetime="2026-06-27T21:00:00+00:00"></time>
  </div>
  <div class="tgme_widget_message" data-post="public_threat_test/43">
    <div class="tgme_widget_message_text">Northwind Supplier appears in actor-page mirror metadata only.</div>
    <time datetime="2026-06-27T21:03:00+00:00"></time>
  </div>
</section></body></html>`;

describe("public Telegram canary collection", () => {
  test("parses t.me public preview messages into safe collected rows", () => {
    const rows = feedItems(source, task, html, "2026-06-27T21:05:00.000Z", { fetchMode: "test" }, 10);

    expect(rows).toHaveLength(2);
    expect(rows[0].url).toBe("https://t.me/public_threat_test/42");
    expect(rows[0].metadata.adapter).toBe("telegram_public");
    expect(rows[0].metadata.channel).toBe("public_threat_test");
    expect(rows[0].metadata.messageId).toBe(42);
    expect(rows[0].metadata.mediaPolicy).toBe("metadata_only_no_download");
    expect(rows[0].rawText).toContain("acme.com");
  });

  test("fetches Telegram public preview URL instead of the channel landing page", async () => {
    let requested = "";
    const rows = await fetchItems(source, task, async (url: string) => {
      requested = url;
      return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
    }, "injected_proof_fetch", "2026-06-27T21:05:00.000Z", 100_000);

    expect(requested).toBe("https://t.me/s/public_threat_test");
    expect(rows[0].metadata.fetchProvenance.sourceUrlHash).toBeDefined();
    expect(rows[0].metadata.adapter).toBe("telegram_public");
  });
});
