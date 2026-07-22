import { describe, expect, test } from "bun:test";
import {
  minimizeTelegramPii,
  parseTelegramTarget,
  publicChannelEvidenceFromCollectedItem,
  validateTelegramPublicSourceCompliance
} from "../adapters/telegramPublic.ts";
import type { CollectedItem, SourceRecord } from "../types.ts";

const source: SourceRecord = {
  id: "src_channel",
  name: "Public channel",
  type: "telegram_public",
  url: "https://t.me/securityalerts",
  accessMethod: "official_api",
  status: "active",
  risk: "medium",
  trustScore: 0.74,
  crawlFrequencySeconds: 900,
  legalNotes: "Public channel metadata only.",
  createdAt: "2026-06-21T00:00:00.000Z",
  updatedAt: "2026-06-21T00:00:00.000Z"
};

describe("compact Telegram public adapter", () => {
  test("allows public channels and blocks private access patterns", () => {
    expect(validateTelegramPublicSourceCompliance(source)).toEqual({ allowed: true });
    expect(validateTelegramPublicSourceCompliance({ ...source, url: "https://t.me/+invite" }).allowed).toBe(false);
    expect(validateTelegramPublicSourceCompliance({ ...source, url: "http://t.me/securityalerts" }).allowed).toBe(false);
    expect(validateTelegramPublicSourceCompliance({ ...source, url: "https://example.test/t.me/securityalerts" }).allowed).toBe(false);
    expect(validateTelegramPublicSourceCompliance({ ...source, url: "https://t.me/securityalerts/42" }).allowed).toBe(false);
    expect(validateTelegramPublicSourceCompliance({ ...source, url: "https://t.me/securityalerts?token=secret" }).allowed).toBe(false);
    expect(validateTelegramPublicSourceCompliance({ ...source, url: "https://t.me/securityalerts#private" }).allowed).toBe(false);
    expect(validateTelegramPublicSourceCompliance({ ...source, metadata: { requiresAuthentication: true } }).allowed).toBe(false);
    expect(validateTelegramPublicSourceCompliance({ ...source, metadata: { captchaRequired: true } }).allowed).toBe(false);
    expect(validateTelegramPublicSourceCompliance({ ...source, metadata: { botToken: "123:secret" } }).allowed).toBe(false);
    expect(parseTelegramTarget("https://t.me/securityalerts").channel).toBe("securityalerts");
  });

  test("minimizes obvious PII and converts collected messages to evidence", () => {
    const rawText = "APT29 update from analyst@example.com +47 999 99 999 api_key=abcdef1234567890 bot=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcd1234 https://example.test/report";
    const item: CollectedItem = {
      sourceId: source.id,
      url: "https://t.me/securityalerts/42",
      collectedAt: "2026-06-21T00:00:00.000Z",
      rawText: minimizeTelegramPii(rawText),
      contentHash: "hash",
      links: ["https://example.test/report"],
      metadata: { adapter: "telegram_public", channel: "securityalerts", messageId: 42 },
      sensitive: false
    };
    const evidence = publicChannelEvidenceFromCollectedItem(item);

    expect(item.rawText).not.toContain("analyst@example.com");
    expect(item.rawText).not.toContain("abcdef1234567890");
    expect(item.rawText).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZabcd1234");
    expect(item.rawText).toContain("[credential]");
    expect(minimizeTelegramPii("CVE-2021-22681 198.51.100.42 2026-07-22 +47 999 99 999")).toBe("CVE-2021-22681 198.51.100.42 2026-07-22 [phone]");
    expect(evidence?.messageUrl).toBe("https://t.me/securityalerts/42");
    expect(evidence?.extractedUrls).toContain("https://example.test/report");
  });
});
