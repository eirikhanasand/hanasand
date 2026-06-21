import { describe, expect, test } from "bun:test";
import { adapterPromotionContract, selectParserProfile } from "../adapters/parserProfiles.ts";
import { source } from "./helpers/adapterContractFixtures.ts";

describe("parser promotion contracts", () => {
  test("selects parser profiles without one-off source logic and emits standalone contracts", () => {
    expect(selectParserProfile({ sourceType: "dynamic_web", url: "https://x.test" }).profile).toBe("dynamic_page");
    expect(selectParserProfile({ sourceType: "static_web", url: "https://x.test/report.pdf", contentType: "application/pdf" }).profile).toBe("pdf_report");
    expect(selectParserProfile({ sourceType: "rss", url: "https://x.test/feed.xml" }).fallbackOrder).toEqual(["rss_entry", "static_html"]);
    expect(selectParserProfile({ sourceType: "telegram_public", url: "https://t.me/example", publicChannelHandoff: true }).profile).toBe("public_channel_handoff");
    const profile = selectParserProfile({ sourceType: "static_web", url: "https://x.test" });
    const contract = adapterPromotionContract({ source: source({ id: "src_contract", type: "static_web", url: "https://x.test" }), result: { items: [], discovered: [], warnings: [], metadata: { failureCategory: "duplicate_canonical" } }, profile, adapter: "static_web", costClass: "low" });
    expect(contract).toMatchObject({ status: "blocked", failureCategory: "duplicate_canonical", agent09: { retryable: false }, agent10: { dashboardState: "blocked" } });
  });
});
