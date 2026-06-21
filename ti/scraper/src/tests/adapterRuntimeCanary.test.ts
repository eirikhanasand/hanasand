import { describe, expect, test } from "bun:test";
import { buildAdapterRuntimeEnablementPacket } from "../adapters/adapterRuntimeEnablement.ts";
import { browserWorkerIsolationPlan } from "../adapters/browserWorkerIsolation.ts";
import { canary, defaultPoolCaps, defaultThresholds, generatedAt, healthyObservatory, profile, source } from "./helpers/adapterRuntimeFixtures.ts";

describe("adapter runtime canary enablement", () => {
  test("builds canary packet with disabled dynamic browser defaults and route-safe hashes", () => {
    const staticSource = source("src_static_apt29", "static_web", "https://vendor.example.test/apt29");
    const rssSource = source("src_rss_ransomware", "rss", "https://ransom.example.test/feed.xml");
    const dynamicSource = source("src_dynamic_apt42", "dynamic_web", "https://vendor.example.test/apt42");
    const pdfSource = source("src_pdf_vendor_report", "pdf", "https://vendor.example.test/report.pdf");
    const channelSource = source("src_public_channel", "telegram_public", "https://t.me/public_cti");
    const advisorySource = source("src_cert_advisory", "api", "https://cert.example.test/advisory.json");
    const staticProfile = profile(staticSource);
    const rssProfile = profile(rssSource);
    const dynamicProfile = profile(dynamicSource, { requiresJavascript: true });
    const pdfProfile = profile(pdfSource);
    const channelProfile = profile(channelSource, { contentType: "application/json", publicChannelHandoff: true });
    const advisoryProfile = profile(advisorySource);
    const sources = [
      { source: staticSource, sourceFamily: "static_html" as const, parserProfile: staticProfile },
      { source: rssSource, sourceFamily: "rss_feed" as const, parserProfile: rssProfile },
      { source: dynamicSource, sourceFamily: "dynamic_page" as const, parserProfile: dynamicProfile },
      { source: pdfSource, sourceFamily: "pdf_report" as const, parserProfile: pdfProfile },
      { source: channelSource, sourceFamily: "public_channel" as const, parserProfile: channelProfile },
      { source: advisorySource, sourceFamily: "advisory_signal" as const, parserProfile: advisoryProfile }
    ];
    const packet = buildAdapterRuntimeEnablementPacket({ generatedAt, observatory: healthyObservatory(sources.map((entry) => ({ src: entry.source, sourceFamily: entry.sourceFamily, queryClass: "actor", parserProfile: entry.parserProfile }))), browserPlan: browserWorkerIsolationPlan({ enabled: true, maxWorkers: 2, memoryCapMb: 768, timeoutMs: 15_000, allowedHosts: ["vendor.example.test"], robotsAllowed: true, legalNotes: "Public dynamic canary notes." }), canarySources: sources.map(canary), poolCaps: defaultPoolCaps(), thresholds: defaultThresholds() });

    expect(packet.schemaVersion).toBe("ti.adapter_runtime_enablement_packet.v1");
    expect(packet.readyForCanary).toBe(true);
    expect(packet.readyForDefaultEnablement).toBe(false);
    expect(packet.rolloutControls).toMatchObject({ browserWorkersEnabled: false, dynamicRequiresExplicitAllocation: true, screenshotStorage: "hash_only" });
    expect(packet.summary).toMatchObject({ totalAdapters: 6, enabled: 3, canaryOnly: 3, blocked: 0 });
    expect(packet.readiness.find((entry) => entry.adapter === "dynamic_public_browser")).toMatchObject({ readiness: "canary_only", enabledByDefault: false, canaryOnly: true, gates: { browserDisabledByDefault: true, screenshotHashOnly: true }, handoffs: { agent06EvidenceStorage: "hash_only_screenshots", agent09ApiContracts: "canary_only" } });
    expect(packet.rolloutControls.canaryUrlHashes.every((value) => value.startsWith("urlhash:"))).toBe(true);
    expect(JSON.stringify(packet)).not.toContain("https://");
    expect(packet.routeContract.forbiddenFields).toContain("screenshotBytes");
  });
});
