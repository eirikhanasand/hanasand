import { describe, expect, test } from "bun:test";
import { cleanSearchText, rowFromCapture } from "../api/searchRows.ts";

describe("search row semantics", () => {
  test("removes repeated titles and navigation tails from persisted public captures", () => {
    const row = rowFromCapture({
      id: "cap_mitre_apt29",
      sourceId: "src_seed_mitre_attack_apt29",
      url: "https://attack.mitre.org/groups/G0016/",
      title: "MITRE ATT&CK APT29 Group",
      body: "MITRE ATT&CK APT29 Group MITRE ATT&CK APT29 Group APT29, NOBELIUM, Cozy Bear, Group G0016 | MITRE ATT&CK® Matrices Enterprise Mobile ICS Tactics Enterprise Mobile ICS Techniques",
      collectedAt: "2026-07-21T09:53:53.332Z"
    }, { name: "MITRE ATT&CK APT29 Group", type: "static_web" });

    expect(row.summary).toBe("APT29, NOBELIUM, Cozy Bear, Group G0016");
    expect(row.summary).not.toMatch(/Matrices|Tactics|Techniques/);
    expect(row.publishedAt).toBeUndefined();
  });

  test("collapses repeated RSS source, headline, and publisher wrappers", () => {
    const row = rowFromCapture({
      id: "cap_google_apt29",
      sourceId: "src_gen_google_threat_apt29",
      url: "https://news.google.com/rss/articles/opaque-aggregator-id?oc=5",
      title: "What is APT29? - wiz.io",
      body: "Google News threat RSS: APT29 What is APT29? - wiz.io What is APT29? wiz.io",
      publishedAt: "2026-02-12T08:00:00.000Z",
    }, { name: "Google News threat RSS: APT29", type: "rss" });

    expect(row.summary).toBe("Captured source record from Google News threat RSS: APT29.");
    expect(row.url).toBeUndefined();
  });

  test("removes bare Telegram contacts before public serialization", () => {
    const text = cleanSearchText("Contact t.me/private_channel, telegram.me/other_channel, tg://resolve?domain=third_channel, or analyst@example.com.");
    expect(text).not.toMatch(/private_channel|other_channel|third_channel|analyst@example\.com/);
  });
});
