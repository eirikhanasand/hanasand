import { describe, expect, test } from "bun:test";
import { buildAdapterSlaRepairPacket } from "../adapters/adapterSlaRepair.ts";
import { generatedAt, observation, profile, result, source } from "./helpers/adapterSlaFixtures.ts";

describe("adapter SLA repair matrix", () => {
  test("classifies parser scheduler dynamic PDF duplicate and MIME repair paths", () => {
    const staticSrc = source("src_static_selector", "static_web", "https://vendor.example.test/apt29");
    const rssSrc = source("src_rss_rate_limit", "rss", "https://news.example.test/feed.xml");
    const dynamicSrc = source("src_dynamic_empty", "dynamic_web", "https://dynamic.example.test/report");
    const pdfSrc = source("src_pdf_low_confidence", "pdf", "https://reports.example.test/report.pdf");
    const publicChannelSrc = source("src_public_channel_duplicate", "telegram_public", "https://t.me/public_cti");
    const mimeSrc = source("src_zip_target", "static_web", "https://vendor.example.test/report.zip");
    const observations = [
      observation({ src: staticSrc, run: result(staticSrc, { warnings: ["parser gap: selector .article-body missing", "readability failure: boilerplate only"], canonicalUrl: staticSrc.url }), prof: profile(staticSrc, { parserWarnings: ["selector failure for vendor article"] }) }),
      observation({ src: rssSrc, run: result(rssSrc, { canonicalUrl: rssSrc.url }), prof: profile(rssSrc), queryClass: "ransomware", retryAfterSeconds: 120 }),
      observation({ src: dynamicSrc, run: result(dynamicSrc, { failureCategory: "timeout", canonicalUrl: dynamicSrc.url }), prof: profile(dynamicSrc, { requiresJavascript: true, failureCategory: "timeout" }) }),
      observation({ src: pdfSrc, run: result(pdfSrc, { failureCategory: "parser_confidence_low", canonicalUrl: pdfSrc.url }), prof: profile(pdfSrc, { text: "tiny", failureCategory: "parser_confidence_low" }), queryClass: "vendor_report" }),
      observation({ src: publicChannelSrc, run: result(publicChannelSrc, { canonicalUrl: "https://vendor.example.test/shared" }), prof: profile(publicChannelSrc, { contentType: "application/json", publicChannelHandoff: true }), queryClass: "country", duplicateRate: 0.9 }),
      observation({ src: mimeSrc, run: result(mimeSrc, { canonicalUrl: mimeSrc.url }), prof: profile(mimeSrc), contentType: "application/zip" })
    ];
    const packet = buildAdapterSlaRepairPacket({ generatedAt, observations });
    const categories = packet.repairs.map((repair) => repair.category);

    expect(categories).toEqual(expect.arrayContaining(["parser_fixture_gap", "selector_failure", "readability_failure", "scheduler_backoff", "dynamic_render_failure", "pdf_extraction_failure", "evidence_duplicate_suppression", "unsupported_mime_repair"]));
    expect(packet.readyForPromotion).toBe(false);
    expect(packet.summary.agentHandoffs.agent02).toContain("retry_after_until_repair_or_retry_after");
    expect(packet.summary.agentHandoffs.agent06).toContain("suppress_duplicate_canonical_hash");
    expect(packet.summary.agentHandoffs.agent07).toContain("repair_parser_fixture_or_selector");
    expect(packet.summary.agentHandoffs.agent09).toContain("adapter_repair.dynamic_render_failure");
    expect(packet.summary.agentHandoffs.agent10).toContain("adapter_sla_release_hold");
    expect(packet.contracts.find((contract) => contract.adapter === "dynamic_public_browser")).toMatchObject({ browserWorkersEnabled: false, status: "hold", handoffs: { agent02Scheduler: "pause_or_reduce", agent10Runbooks: "release_hold" } });
    expect(JSON.stringify(packet)).not.toContain("https://");
    expect(JSON.stringify(packet)).not.toContain("APT29 public report");
    expect(packet.routeContract.forbiddenFields).toContain("rawText");
  });
});
