import { describe, expect, test } from "bun:test";
import { buildAdapterSlaRepairPacket } from "../adapters/adapterSlaRepair.ts";
import { generatedAt, observation, profile, result, source } from "./helpers/adapterSlaFixtures.ts";

describe("adapter SLA clean contracts", () => {
  test("passes clean RSS static and advisory contracts without repairs", () => {
    const staticSrc = source("src_static_clean", "static_web", "https://vendor.example.test/clean");
    const rssSrc = source("src_rss_clean", "rss", "https://news.example.test/feed.xml");
    const apiSrc = source("src_api_clean", "api", "https://advisories.example.test/cve.json");
    const observations = [
      observation({ src: staticSrc, run: result(staticSrc, { text: "APT29 public report with malware, infrastructure, CVEs, mitigations, and sectors.", canonicalUrl: staticSrc.url }), prof: profile(staticSrc) }),
      observation({ src: rssSrc, run: result(rssSrc, { text: "Ransomware incident summary with victim context, sectors, and defensive guidance.", canonicalUrl: rssSrc.url }), prof: profile(rssSrc), queryClass: "ransomware" }),
      observation({ src: apiSrc, run: result(apiSrc, { text: "CVE advisory record with exploitation status, vendor mitigation, and affected products.", canonicalUrl: apiSrc.url }), prof: profile(apiSrc), queryClass: "cve" })
    ];
    const packet = buildAdapterSlaRepairPacket({ generatedAt, observations });
    expect(packet.repairs).toEqual([]);
    expect(packet.contracts.find((contract) => contract.adapter === "static_html")?.status).toBe("pass");
    expect(packet.contracts.find((contract) => contract.adapter === "rss_feed")?.status).toBe("pass");
    expect(packet.contracts.find((contract) => contract.adapter === "advisory_signal")?.status).toBe("pass");
    expect(packet.summary.canonicalUrlHashes.every((hash) => hash.startsWith("urlhash:"))).toBe(true);
  });
});
