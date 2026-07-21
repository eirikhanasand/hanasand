import { describe, expect, test } from "bun:test";
import { isSellableIntelText } from "../value/sellableIntel.ts";

describe("sellable intelligence freshness", () => {
  test("retains historical actor reporting without relaxing fresh exposure alerts", () => {
    const evidence = { sourceId: "src_actor_report", text: "APT29 launched a credential phishing campaign against diplomatic organizations using a malware backdoor.", publishedAt: "2025-09-01T00:00:00.000Z", now: "2026-07-21T00:00:00.000Z" };
    expect(isSellableIntelText(evidence)).toBe(false);
    expect(isSellableIntelText({ ...evidence, maxAgeDays: 365 })).toBe(true);
  });
});
