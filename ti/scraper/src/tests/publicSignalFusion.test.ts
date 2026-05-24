import { describe, expect, test } from "bun:test";
import {
  buildAnalystPublicSourceWorkbench,
  buildEnterpriseSourceCoverageRadar,
  buildPublicAdvisoryCorrelation,
  buildPublicAdvisorySignalConnector,
  buildPublicFreshnessGapRemediation,
  buildPublicIntelligenceCoveragePlan,
  buildPublicSourceFamilyBenchmarks,
  buildPublicSourcePackExpansion,
  buildPublicSignalFusionWorkbench,
  type PublicAdvisorySignalRecord,
  type PublicSignalDeltaDto
} from "../adapters/publicSignalFusion.ts";
import type { TelegramPublicSourcePack } from "../adapters/telegramPublicTypes.ts";
import type { SourceRecord } from "../types.ts";

function source(input: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: input.id ?? "src_public_advisory",
    name: input.name ?? "Public Advisory Source",
    type: input.type ?? "api",
    url: input.url ?? "https://api.github.com/advisories/GHSA-test",
    accessMethod: input.accessMethod ?? "official_api",
    status: input.status ?? "active",
    risk: input.risk ?? "low",
    trustScore: input.trustScore ?? 0.85,
    language: input.language ?? "en",
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 3600,
    legalNotes: input.legalNotes ?? "Approved public advisory API; public-only official endpoint.",
    createdAt: input.createdAt ?? "2026-05-01T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-05-24T10:00:00.000Z",
    lastSeenAt: input.lastSeenAt,
    governance: input.governance ?? {
      approvalRequired: true,
      approvalState: "approved",
      metadataOnly: true,
      approvedAt: "2026-05-01T00:00:00.000Z",
      approvedBy: "agent04-test"
    },
    health: input.health,
    crawlState: input.crawlState,
    tags: input.tags,
    catalog: input.catalog,
    metadata: input.metadata
  };
}

const generatedAt = "2026-05-24T12:00:00.000Z";

function signal(input: Partial<PublicAdvisorySignalRecord> & Pick<PublicAdvisorySignalRecord, "id" | "sourceId" | "family" | "title" | "url">): PublicAdvisorySignalRecord {
  return {
    publishedAt: "2026-05-24T08:00:00.000Z",
    observedAt: "2026-05-24T09:00:00.000Z",
    updatedAt: "2026-05-24T10:00:00.000Z",
    language: "en",
    region: "global",
    tags: ["public", "advisory"],
    confidence: 0.8,
    reliabilityScore: 0.84,
    state: "active",
    access: "official_api",
    policy: { publicOnly: true },
    provenance: { connector: "public_report_index", collectedAt: generatedAt, parserVersion: "fixture:v1" },
    ...input
  };
}

describe("public advisory signal connector", () => {
  test("ranks advisory-grade signals across public source families with mergeable deltas", () => {
    const sources = [
      source({ id: "src_ghsa", name: "GitHub Security Advisories", url: "https://api.github.com/advisories", tags: ["github", "GHSA", "CVE"] }),
      source({ id: "src_cisa", name: "CISA KEV", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", tags: ["CISA", "KEV", "government"] }),
      source({ id: "src_cert", name: "NCSC UK advisories", url: "https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml", tags: ["CERT", "government", "APT29"] }),
      source({ id: "src_vendor", name: "Mandiant research", type: "static_web", accessMethod: "public_http", url: "https://www.mandiant.com/resources/blog", tags: ["vendor", "APT29", "APT42"] }),
      source({ id: "src_malware", name: "ThreatFox malware feed", url: "https://threatfox.abuse.ch/api/", tags: ["malware", "tool", "Snake"] })
    ];
    const signals = [
      signal({
        id: "sig_apt29_ghsa",
        sourceId: "src_ghsa",
        family: "github_advisory",
        title: "GHSA advisory for CVE-2026-4242 used by APT29",
        url: "https://github.com/advisories/GHSA-apt29",
        matchedEntities: { actors: ["APT29", "Cozy Bear"], cves: ["CVE-2026-4242"], tools: ["Nobelium tooling"] },
        tags: ["APT29", "GHSA", "CVE-2026-4242"]
      }),
      signal({
        id: "sig_apt29_cisa",
        sourceId: "src_cisa",
        family: "cert_government",
        title: "CISA KEV entry mentions CVE-2026-4242 exploitation",
        url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search=CVE-2026-4242",
        matchedEntities: { actors: ["APT29"], cves: ["CVE-2026-4242"], sectors: ["government"] },
        tags: ["CISA", "KEV", "APT29"]
      }),
      signal({
        id: "sig_apt29_vendor",
        sourceId: "src_vendor",
        family: "vendor_report",
        title: "Mandiant reports APT29 campaign activity",
        url: "https://www.mandiant.com/resources/blog/apt29-campaign",
        matchedEntities: { actors: ["APT29"], campaigns: ["diplomatic intrusion campaign"], countries: ["US"] },
        tags: ["APT29", "campaign", "vendor"]
      }),
      signal({
        id: "sig_snake_malware",
        sourceId: "src_malware",
        family: "malware_report_feed",
        title: "Snake malware infrastructure report",
        url: "https://threatfox.abuse.ch/ioc/snake-malware",
        matchedEntities: { malware: ["Snake"], tools: ["Snake"], actors: ["Turla"] },
        tags: ["Snake", "Turla", "malware"]
      })
    ];

    const connector = buildPublicAdvisorySignalConnector({
      query: "APT29",
      entityType: "actor",
      sources,
      signals,
      generatedAt
    });

    expect(connector.status).toBe("ready");
    expect(connector.fastInitialSummary).toMatchObject({
      canAnswerImmediately: true,
      usefulSignalCount: expect.any(Number)
    });
    expect(connector.rankedSignals[0]).toMatchObject({
      sourceId: expect.stringMatching(/^src_/),
      mergeTarget: "clear_web_capture_evidence",
      provenance: { publicOnly: true, evidenceBacked: true, safeUrl: true },
      matchedEntities: expect.objectContaining({ actors: expect.arrayContaining(["APT29"]) })
    });
    expect(connector.sourceFamilySummary.github_advisory.selectedCount).toBe(1);
    expect(connector.sourceFamilySummary.cert_government.selectedCount).toBe(1);
    expect(connector.sourceFamilySummary.vendor_report.selectedCount).toBe(1);
    expect(connector.guardrails).toMatchObject({
      publicOnly: true,
      noPrivateRepoAccess: true,
      noAuthBypass: true,
      noExploitPayloadDownload: true,
      unsafeUrlsExposed: false
    });
  });

  test("suppresses duplicate unsafe unavailable stale and policy-disabled advisory records", () => {
    const sources = [
      source({ id: "src_vendor", name: "Vendor report", type: "static_web", accessMethod: "public_http", url: "https://vendor.example/reports" }),
      source({ id: "src_disabled", name: "Disabled advisory", status: "disabled", url: "https://disabled.example/advisory" }),
      source({ id: "src_stale", name: "Stale CERT feed", url: "https://cert.example/feed.xml", updatedAt: "2025-01-01T00:00:00.000Z" })
    ];
    const first = signal({
      id: "sig_vendor_akira",
      sourceId: "src_vendor",
      family: "vendor_report",
      title: "Akira ransomware victim advisory",
      url: "https://vendor.example/reports/akira-victim",
      matchedEntities: { actors: ["Akira"], victims: ["Fjord Energy AS"], sectors: ["energy"] }
    });
    const signals = [
      first,
      { ...first, id: "sig_vendor_akira_dup", url: "https://vendor.example/reports/akira-victim/" },
      signal({
        id: "sig_unsafe",
        sourceId: "src_vendor",
        family: "vendor_report",
        title: "Unsafe payload link",
        url: "https://vendor.example/download?token=secret",
        matchedEntities: { actors: ["Akira"] },
        policy: { publicOnly: true, exploitPayloadDownload: true }
      }),
      signal({
        id: "sig_disabled",
        sourceId: "src_disabled",
        family: "github_advisory",
        title: "Private repo advisory should not be used",
        url: "https://github.com/private/advisories/GHSA-secret",
        matchedEntities: { cves: ["CVE-2026-1111"] },
        state: "policy_disabled",
        policy: { publicOnly: false, privateRepo: true }
      }),
      signal({
        id: "sig_stale",
        sourceId: "src_stale",
        family: "cert_government",
        title: "Old CERT advisory for Akira",
        url: "https://cert.example/old-akira",
        matchedEntities: { actors: ["Akira"] },
        publishedAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-02T00:00:00.000Z",
        state: "stale"
      }),
      signal({
        id: "sig_unavailable",
        sourceId: "src_vendor",
        family: "vendor_report",
        title: "Removed Akira report",
        url: "https://vendor.example/reports/removed-akira",
        matchedEntities: { actors: ["Akira"] },
        state: "unavailable"
      }),
      signal({
        id: "sig_edited",
        sourceId: "src_vendor",
        family: "vendor_report",
        title: "Edited Akira report with corrected victim",
        url: "https://vendor.example/reports/edited-akira",
        matchedEntities: { actors: ["Akira"], victims: ["Fjord Energy AS"] },
        state: "edited"
      })
    ];

    const connector = buildPublicAdvisorySignalConnector({
      query: "Akira",
      entityType: "ransomware",
      sources,
      signals,
      generatedAt
    });

    expect(connector.suppressed.duplicateDedupeKeys.length).toBeGreaterThan(0);
    expect(connector.suppressed.unsafeUrls).toEqual(expect.arrayContaining([expect.stringMatching(/^unsafe_url_hash:/)]));
    expect(connector.suppressed.policyDisabledSignalIds).toEqual(expect.arrayContaining(["sig_disabled", "sig_unsafe"]));
    expect(connector.suppressed.staleSignalIds).toEqual(expect.arrayContaining(["sig_stale"]));
    expect(connector.suppressed.unavailableSignalIds).toEqual(expect.arrayContaining(["sig_unavailable"]));
    expect(connector.rankedSignals).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.any(String), state: "edited", title: "Edited Akira report with corrected victim" }),
      expect.objectContaining({ state: "duplicate_suppressed", suppressionReason: "duplicate canonical advisory/entity dedupe key" })
    ]));
    expect(JSON.stringify(connector)).not.toContain("token=secret");
  });

  test("fusion workbench merges advisory connector output for actor CVE malware country sector victim and unknown queries", () => {
    const sources = [
      source({ id: "src_ghsa", name: "GitHub Security Advisories", url: "https://api.github.com/advisories", tags: ["github", "GHSA", "CVE"] }),
      source({ id: "src_cisa", name: "CISA KEV", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", tags: ["CISA", "government"] }),
      source({ id: "src_vendor", name: "Vendor Research", type: "rss", accessMethod: "public_http", url: "https://vendor.example/rss.xml", tags: ["APT42", "Volt Typhoon", "Scattered Spider", "Lazarus", "Sandworm"] }),
      source({ id: "src_malware", name: "Malware feed", url: "https://threatfox.abuse.ch/api/", tags: ["Snake", "Turla", "FIN7"] })
    ];
    const signals = [
      signal({ id: "sig_apt42", sourceId: "src_vendor", family: "vendor_report", title: "APT42 phishing campaign advisory", url: "https://vendor.example/apt42", matchedEntities: { actors: ["APT42"], campaigns: ["phishing campaign"], countries: ["IR"] } }),
      signal({ id: "sig_turla", sourceId: "src_malware", family: "malware_report_feed", title: "Turla Snake malware advisory", url: "https://threatfox.abuse.ch/snake", matchedEntities: { actors: ["Turla"], malware: ["Snake"], tools: ["Snake"] } }),
      signal({ id: "sig_volt", sourceId: "src_cisa", family: "cert_government", title: "Volt Typhoon critical infrastructure advisory", url: "https://www.cisa.gov/volt-typhoon", matchedEntities: { actors: ["Volt Typhoon"], sectors: ["critical infrastructure"], countries: ["US"] } }),
      signal({ id: "sig_scattered", sourceId: "src_vendor", family: "vendor_report", title: "Scattered Spider social engineering report", url: "https://vendor.example/scattered-spider", matchedEntities: { actors: ["Scattered Spider"], sectors: ["telecommunications"] } }),
      signal({ id: "sig_cve", sourceId: "src_ghsa", family: "github_advisory", title: "GHSA for CVE-2026-9999", url: "https://github.com/advisories/GHSA-cve-2026-9999", matchedEntities: { cves: ["CVE-2026-9999"] } }),
      signal({ id: "sig_country", sourceId: "src_cisa", family: "cert_government", title: "Norway energy sector alert", url: "https://www.cisa.gov/norway-energy", matchedEntities: { countries: ["Norway"], sectors: ["energy"] } }),
      signal({ id: "sig_victim", sourceId: "src_vendor", family: "vendor_report", title: "Fjord Energy AS Akira victim report", url: "https://vendor.example/fjord-energy-akira", matchedEntities: { victims: ["Fjord Energy AS"], actors: ["Akira"], sectors: ["energy"] } }),
      signal({ id: "sig_fin7", sourceId: "src_malware", family: "malware_report_feed", title: "FIN7 tooling report", url: "https://threatfox.abuse.ch/fin7", matchedEntities: { actors: ["FIN7"], tools: ["Carbanak"] } }),
      signal({ id: "sig_lazarus", sourceId: "src_vendor", family: "vendor_report", title: "Lazarus supply chain campaign", url: "https://vendor.example/lazarus", matchedEntities: { actors: ["Lazarus"], campaigns: ["supply chain"] } }),
      signal({ id: "sig_sandworm", sourceId: "src_vendor", family: "vendor_report", title: "Sandworm destructive malware report", url: "https://vendor.example/sandworm", matchedEntities: { actors: ["Sandworm"], malware: ["wiper"] } })
    ];
    for (const [query, entityType] of [
      ["APT42", "actor"],
      ["Turla", "actor"],
      ["Volt Typhoon", "actor"],
      ["Scattered Spider", "actor"],
      ["CVE-2026-9999", "cve"],
      ["Snake", "malware"],
      ["Fjord Energy AS", "victim"],
      ["Norway", "country"],
      ["energy", "sector"],
      ["Unknown Quartz Actor", "actor"]
    ] as const) {
      const fusion = buildPublicSignalFusionWorkbench({ query, entityType, sources, advisorySignals: signals, generatedAt });
      expect(fusion.guardrails.publicOnly).toBe(true);
      expect(fusion.advisoryConnector?.guardrails.noPrivateRepoAccess).toBe(true);
      expect(fusion.publicSignalDeltas.every((delta) => delta.mergeTarget === "clear_web_capture_evidence" || delta.mergeTarget === "public_channel_partial_evidence")).toBe(true);
      if (query === "Unknown Quartz Actor") {
        expect(fusion.advisoryConnector?.fastInitialSummary.canAnswerImmediately).toBe(false);
      } else {
        expect(fusion.advisoryConnector?.fastInitialSummary.canAnswerImmediately).toBe(true);
      }
    }
  });

  test("builds analyst public source workbench decisions and dry-run actions without mutating or leaking unsafe data", () => {
    const sources = [
      source({ id: "src_apt29", name: "APT29 vendor report", type: "rss", accessMethod: "public_http", url: "https://vendor.example/apt29.xml", tags: ["APT29"], metadata: { actors: ["APT29"], evidenceYield: 0.9 } }),
      source({ id: "src_apt42", name: "APT42 government advisory", url: "https://cert.example/apt42", tags: ["APT42"], metadata: { actors: ["APT42"] } }),
      source({ id: "src_turla", name: "Turla malware feed", url: "https://threatfox.abuse.ch/turla", tags: ["Turla", "Snake"], metadata: { actors: ["Turla"], malware: ["Snake"] } }),
      source({ id: "src_volt", name: "Volt Typhoon CISA", url: "https://www.cisa.gov/volt-typhoon", tags: ["Volt Typhoon"], metadata: { actors: ["Volt Typhoon"], sectors: ["critical infrastructure"] } }),
      source({ id: "src_scattered", name: "Scattered Spider vendor", url: "https://vendor.example/scattered-spider", tags: ["Scattered Spider"], metadata: { actors: ["Scattered Spider"] } }),
      source({ id: "src_akira", name: "Akira victim report", url: "https://vendor.example/akira", tags: ["Akira"], metadata: { actors: ["Akira"], victims: ["Fjord Energy AS"] } }),
      source({ id: "src_cve", name: "CVE advisory", url: "https://github.com/advisories/GHSA-cve-2026-9999", tags: ["CVE-2026-9999"], metadata: { cves: ["CVE-2026-9999"] } }),
      source({ id: "src_country_sector", name: "Norway energy alert", url: "https://cert.example/norway-energy", tags: ["Norway", "energy"], metadata: { countries: ["Norway"], sectors: ["energy"] } }),
      source({ id: "src_duplicate", name: "Duplicate APT29 mirror", url: "https://vendor.example/apt29.xml", tags: ["APT29"], metadata: { duplicateOf: "src_apt29", actors: ["APT29"] } }),
      source({ id: "src_stale", name: "Stale Akira source", url: "https://vendor.example/stale-akira", tags: ["Akira"], updatedAt: "2025-01-01T00:00:00.000Z", lastSeenAt: "2025-01-01T00:00:00.000Z" }),
      source({ id: "src_unavailable", name: "Unavailable advisory source", status: "retired", url: "https://vendor.example/removed", tags: ["APT29"] }),
      source({ id: "src_parser_gap", name: "Parser gap PDF", type: "pdf", url: "https://vendor.example/report.pdf", tags: ["malware"], metadata: { parserStatus: "needs_repair", malware: ["Snake"] } }),
      source({ id: "src_legal_hold", name: "Legal review source", url: "https://vendor.example/legal-review", tags: ["APT42"], legalNotes: "Pending legal review and robots review before activation.", metadata: { robotsReviewState: "stale", legalReviewState: "stale" } }),
      source({ id: "src_low_yield", name: "Unknown actor low yield", url: "https://vendor.example/random", tags: ["unknown"], trustScore: 0.2, metadata: { evidenceYield: 0.05 } }),
      source({ id: "src_policy_disabled", name: "Policy disabled source", status: "disabled", accessMethod: "disabled", url: "https://private.example/secret?token=secret", tags: ["APT29"], governance: { approvalRequired: true, approvalState: "rejected", metadataOnly: true } })
    ];
    const signals = [
      signal({ id: "sig_apt29", sourceId: "src_apt29", family: "vendor_report", title: "APT29 vendor campaign", url: "https://vendor.example/apt29-report", matchedEntities: { actors: ["APT29"] } }),
      signal({ id: "sig_duplicate_a", sourceId: "src_duplicate", family: "vendor_report", title: "APT29 duplicate mirror", url: "https://vendor.example/apt29-report", matchedEntities: { actors: ["APT29"] } }),
      signal({ id: "sig_duplicate_b", sourceId: "src_duplicate", family: "vendor_report", title: "APT29 duplicate mirror", url: "https://vendor.example/apt29-report/", matchedEntities: { actors: ["APT29"] } }),
      signal({ id: "sig_edited", sourceId: "src_akira", family: "vendor_report", title: "Edited Akira victim note", url: "https://vendor.example/akira-edited", matchedEntities: { actors: ["Akira"], victims: ["Fjord Energy AS"] }, state: "edited" }),
      signal({ id: "sig_stale", sourceId: "src_stale", family: "vendor_report", title: "Old Akira note", url: "https://vendor.example/stale-akira/report", matchedEntities: { actors: ["Akira"] }, publishedAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-02T00:00:00.000Z", state: "stale" }),
      signal({ id: "sig_parser", sourceId: "src_parser_gap", family: "public_research_feed", title: "Snake PDF report", url: "https://vendor.example/report.pdf", matchedEntities: { malware: ["Snake"], actors: ["Turla"] } }),
      signal({ id: "sig_policy", sourceId: "src_policy_disabled", family: "vendor_report", title: "Unsafe private source", url: "https://private.example/download?token=secret", matchedEntities: { actors: ["APT29"] }, policy: { publicOnly: false, privateRepo: true, authRequired: true } })
    ];
    const fusion = buildPublicSignalFusionWorkbench({
      query: "APT29",
      entityType: "actor",
      sources,
      advisorySignals: signals,
      generatedAt
    });
    const workbench = fusion.analystSourceWorkbench;
    const reasons = workbench.decisions.map((decision) => decision.decision);

    expect(reasons).toEqual(expect.arrayContaining([
      "trusted",
      "merged",
      "duplicate",
      "stale",
      "unavailable",
      "edited_deleted",
      "policy_disabled",
      "parser_gap",
      "legal_robots_hold",
      "low_yield"
    ]));
    expect(workbench.dryRunActions.map((action) => action.action)).toEqual(expect.arrayContaining([
      "approve_source",
      "disable_source",
      "lower_trust",
      "raise_trust",
      "raise_cadence",
      "lower_cadence",
      "mark_duplicate",
      "request_parser_repair",
      "request_legal_robots_review",
      "promote_source_pack_candidate"
    ]));
    expect(workbench.dryRunActions.every((action) => action.willMutate === false && action.willStartCrawling === false)).toBe(true);
    expect(workbench.handoffs).toMatchObject({
      agent01Governance: expect.arrayContaining(["approval_review", "legal_robots_review", "source_pack_promotion"]),
      agent02Scheduler: expect.arrayContaining(["raise_cadence", "lower_cadence", "pause_or_disable"]),
      agent06EvidenceYield: expect.arrayContaining(["merge_duplicate_evidence", "monitor_low_yield"]),
      agent07QualityGates: expect.arrayContaining(["parser_gap", "hold_policy_disabled", "review_stale_or_edited"]),
      agent09ApiFields: ["publicSignalFusion.analystSourceWorkbench"],
      agent10SloDashboard: expect.arrayContaining(["source_health_watch", "release_hold"])
    });
    expect(workbench.guardrails).toMatchObject({
      publicOnly: true,
      noPrivateRepoAccess: true,
      noCaptchaSolving: true,
      noExploitPayloadDownload: true,
      unsafeUrlsExposed: false,
      dryRunOnly: true
    });
    expect(JSON.stringify(workbench)).not.toContain("token=secret");

    const directWorkbench = buildAnalystPublicSourceWorkbench({
      query: "Unknown Quartz Actor",
      sources,
      advisoryConnector: fusion.advisoryConnector,
      missingFamilies: ["github_advisory", "cert_government", "malware_report_feed", "public_research_feed"],
      generatedAt
    });
    expect(directWorkbench.dryRunActions.map((action) => action.action)).toContain("promote_source_pack_candidate");
  });

  test("builds enterprise source coverage radar with gap scoring source-pack recommendations and conflict handoffs", () => {
    const sources = [
      source({ id: "src_apt29_vendor", name: "APT29 vendor source", type: "rss", accessMethod: "public_http", url: "https://vendor.example/apt29.xml", tags: ["APT29", "vendor"], metadata: { actors: ["APT29"], evidenceYield: 0.8 } }),
      source({ id: "src_stale_akira", name: "Stale Akira source", type: "rss", accessMethod: "public_http", url: "https://vendor.example/akira.xml", tags: ["Akira"], updatedAt: "2025-01-01T00:00:00.000Z", lastSeenAt: "2025-01-01T00:00:00.000Z", metadata: { actors: ["Akira"], victims: ["Fjord Energy AS"] } }),
      source({ id: "src_parser_gap_pdf", name: "Turla Snake parser gap", type: "pdf", accessMethod: "public_http", url: "https://research.example/snake.pdf", tags: ["Turla", "Snake"], metadata: { parserStatus: "needs_repair", malware: ["Snake"], actors: ["Turla"] } }),
      source({ id: "src_duplicate_apt42", name: "Duplicate APT42 mirror", type: "static_web", accessMethod: "public_http", url: "https://vendor.example/apt42", tags: ["APT42"], metadata: { duplicateOf: "src_apt42_primary", actors: ["APT42"] } }),
      source({ id: "src_volt_country", name: "Volt Typhoon country note", type: "static_web", accessMethod: "public_http", url: "https://vendor.example/volt", tags: ["Volt Typhoon", "country"], metadata: { actors: ["Volt Typhoon"], countries: ["US"], sectors: ["critical infrastructure"] } }),
      source({ id: "src_scattered_sector", name: "Scattered Spider telecom note", type: "static_web", accessMethod: "public_http", url: "https://vendor.example/scattered", tags: ["Scattered Spider", "telecommunications"], metadata: { actors: ["Scattered Spider"], sectors: ["telecommunications"] } }),
      source({ id: "src_cve_vendor", name: "Vendor CVE advisory", type: "static_web", accessMethod: "public_http", url: "https://vendor.example/cve-2026-9999", tags: ["CVE-2026-9999"], metadata: { cves: ["CVE-2026-9999"] } }),
      source({ id: "src_unknown_low", name: "Unknown actor low yield", type: "rss", accessMethod: "public_http", url: "https://vendor.example/unknown", tags: ["unknown"], trustScore: 0.25, metadata: { evidenceYield: 0.05 } })
    ];
    const signals = [
      signal({ id: "sig_apt29_vendor", sourceId: "src_apt29_vendor", family: "vendor_report", title: "APT29 vendor attribution to CVE-2026-9999", url: "https://vendor.example/apt29-cve", matchedEntities: { actors: ["APT29"], cves: ["CVE-2026-9999"], campaigns: ["embassy phishing"] }, tags: ["exploited"] }),
      signal({ id: "sig_cve_vendor", sourceId: "src_cve_vendor", family: "vendor_report", title: "Vendor says CVE-2026-9999 patched with unknown exploitation", url: "https://vendor.example/cve-2026-9999", matchedEntities: { actors: ["APT42"], cves: ["CVE-2026-9999"] }, tags: ["patched", "unknown"] }),
      signal({ id: "sig_akira_stale", sourceId: "src_stale_akira", family: "vendor_report", title: "Old Akira victim claim", url: "https://vendor.example/akira-old", matchedEntities: { actors: ["Akira"], victims: ["Fjord Energy AS"], sectors: ["energy"] }, publishedAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-02T00:00:00.000Z", state: "stale" }),
      signal({ id: "sig_parser_gap", sourceId: "src_parser_gap_pdf", family: "public_research_feed", title: "Turla Snake PDF needs parser", url: "https://research.example/snake.pdf", matchedEntities: { actors: ["Turla"], malware: ["Snake"], tools: ["Snake"] } }),
      signal({ id: "sig_duplicate_a", sourceId: "src_duplicate_apt42", family: "vendor_report", title: "APT42 duplicate", url: "https://vendor.example/apt42-report", matchedEntities: { actors: ["APT42"] } }),
      signal({ id: "sig_duplicate_b", sourceId: "src_duplicate_apt42", family: "vendor_report", title: "APT42 duplicate", url: "https://vendor.example/apt42-report/", matchedEntities: { actors: ["APT42"] } })
    ];
    const sourcePacks: TelegramPublicSourcePack[] = [{
      version: 1,
      id: "public-gap-pack",
      name: "Public gap pack",
      disabledByDefault: true,
      generatedAt,
      sources: [{
        id: "pack_cisa_cve",
        name: "CISA CVE advisory channel",
        channelHandle: "cisa_advisories",
        publicUrl: "https://t.me/cisa_advisories",
        legalNotes: "Public channel metadata only.",
        approvalState: "pending",
        retentionClass: "public_chat_text",
        topicTags: ["cert", "government", "CVE-2026-9999"],
        focus: { actors: [], ransomware: ["Akira"], cves: ["CVE-2026-9999"], victims: ["Fjord Energy AS"], sectors: ["energy"], countries: ["Norway"] },
        rateLimit: { minIntervalSeconds: 60, pageSize: 20 },
        compliance: { legalBasis: "public", license: "public", approvalScope: "public_requires_review", termsReviewedAt: "2026-05-01T00:00:00.000Z" },
        trustScore: 0.7
      }]
    }];

    const fusion = buildPublicSignalFusionWorkbench({
      query: "CVE-2026-9999",
      entityType: "cve",
      sources,
      sourcePacks,
      advisorySignals: signals,
      generatedAt
    });
    const radar = fusion.coverageRadar;
    const gapCodes = radar.gaps.map((gap) => gap.code);

    expect(radar.schemaVersion).toBe("ti.enterprise_source_coverage_radar.v1");
    expect(gapCodes).toEqual(expect.arrayContaining([
      "missing_advisory_family",
      "weak_cve_advisory_coverage",
      "stale_source_gap",
      "parser_gap",
      "duplicate_source_gap"
    ]));
    expect(radar.coverageScore).toBeLessThan(1);
    expect(radar.sourcePackRecommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourcePackId: "public-gap-pack",
        sourceId: "pack_cisa_cve",
        publicOnly: true,
        willMutate: false,
        willStartCrawling: false,
        activationReadiness: "needs_review"
      })
    ]));
    expect(radar.conflictIndicators).toEqual(expect.arrayContaining([
      expect.objectContaining({
        conflictType: "actor_attribution",
        entity: "CVE-2026-9999",
        handoff: expect.objectContaining({
          agent07QualityGate: "contradiction_review",
          agent08GraphPivot: "hold_conflicting_relationship"
        })
      })
    ]));
    expect(radar.handoffs).toMatchObject({
      agent01Onboarding: expect.arrayContaining(["review_safe_public_source_pack_or_family_gap"]),
      agent03ParserRepair: expect.arrayContaining(["repair_parser_or_adapter_before_source_counts_for_coverage"]),
      agent09ApiFields: ["publicSignalFusion.coverageRadar"],
      agent10SloMonitoring: expect.arrayContaining(["include_gap_in_release_candidate_source_coverage_packet"])
    });
    expect(radar.guardrails).toMatchObject({
      publicOnly: true,
      safePublicOnly: true,
      restrictedMetadataReviewHeldOnly: true,
      unsafeUrlsExposed: false,
      dryRunOnly: true
    });
    expect(JSON.stringify(radar)).not.toContain("token=");

    const directRadar = buildEnterpriseSourceCoverageRadar({
      query: "Unknown Quartz Actor",
      entityType: "actor",
      sources,
      selectedSources: [],
      sourcePacks,
      generatedAt
    });
    expect(directRadar.gaps.map((gap) => gap.code)).toContain("poor_useful_answer_rate");
    expect(directRadar.queryClassUsefulAnswer.canAnswerImmediately).toBe(false);
  });

  test("benchmarks public source families with expansion recommendations and searching semantics", () => {
    const sources = [
      source({ id: "src_vendor", name: "Vendor APT29 report", type: "static_web", accessMethod: "public_http", url: "https://vendor.example/apt29", tags: ["APT29", "vendor"], metadata: { actors: ["APT29"], campaigns: ["embassy phishing"], evidenceYield: 0.8 } }),
      source({ id: "src_cert", name: "CERT APT29 alert", type: "api", accessMethod: "official_api", url: "https://cert.example/apt29", tags: ["APT29", "government"], metadata: { actors: ["APT29"], cves: ["CVE-2026-4242"] } }),
      source({ id: "src_ghsa", name: "GitHub Advisory", type: "api", accessMethod: "official_api", url: "https://github.com/advisories/GHSA-apt29", tags: ["GHSA", "CVE-2026-4242"], metadata: { cves: ["CVE-2026-4242"] } }),
      source({ id: "src_channel", name: "Public security channel", type: "telegram_public", accessMethod: "official_api", url: "https://t.me/securityalerts", tags: ["APT29"], metadata: { actors: ["APT29"] } }),
      source({ id: "src_parser_gap", name: "Research PDF parser gap", type: "pdf", accessMethod: "public_http", url: "https://research.example/apt29.pdf", tags: ["APT29", "research"], metadata: { actors: ["APT29"], parserStatus: "needs_repair" } })
    ];
    const signals = [
      signal({ id: "sig_vendor", sourceId: "src_vendor", family: "vendor_report", title: "Vendor APT29 campaign", url: "https://vendor.example/apt29/report", matchedEntities: { actors: ["APT29"], campaigns: ["embassy phishing"], cves: ["CVE-2026-4242"] } }),
      signal({ id: "sig_cert", sourceId: "src_cert", family: "cert_government", title: "CERT APT29 advisory", url: "https://cert.example/apt29", matchedEntities: { actors: ["APT29"], cves: ["CVE-2026-4242"], sectors: ["government"] } }),
      signal({ id: "sig_ghsa", sourceId: "src_ghsa", family: "github_advisory", title: "GHSA CVE-2026-4242", url: "https://github.com/advisories/GHSA-apt29", matchedEntities: { cves: ["CVE-2026-4242"] } }),
      signal({ id: "sig_duplicate", sourceId: "src_vendor", family: "vendor_report", title: "Vendor APT29 campaign mirror", url: "https://vendor.example/apt29/report", matchedEntities: { actors: ["APT29"], cves: ["CVE-2026-4242"] } }),
      signal({ id: "sig_conflict", sourceId: "src_cert", family: "cert_government", title: "CERT says CVE attributed to APT42", url: "https://cert.example/apt42-cve", matchedEntities: { actors: ["APT42"], cves: ["CVE-2026-4242"] } }),
      signal({ id: "sig_parser_gap", sourceId: "src_parser_gap", family: "public_research_feed", title: "APT29 PDF needs parser", url: "https://research.example/apt29.pdf", matchedEntities: { actors: ["APT29"] } })
    ];
    const sourcePacks: TelegramPublicSourcePack[] = [{
      version: 1,
      id: "bench-pack",
      name: "Benchmark source pack",
      disabledByDefault: true,
      generatedAt,
      sources: [{
        id: "pack_public_research",
        name: "Public research feed",
        channelHandle: "public_research_feed",
        publicUrl: "https://t.me/public_research_feed",
        legalNotes: "Public channel metadata only.",
        approvalState: "pending",
        retentionClass: "public_chat_text",
        topicTags: ["research", "APT29", "CVE-2026-4242"],
        focus: { actors: ["APT29"], ransomware: [], cves: ["CVE-2026-4242"], victims: [], sectors: ["government"], countries: ["US"] },
        rateLimit: { minIntervalSeconds: 180, pageSize: 20 },
        compliance: { legalBasis: "public", license: "public", approvalScope: "public_requires_review", termsReviewedAt: "2026-05-01T00:00:00.000Z" },
        trustScore: 0.68
      }]
    }];

    const fusion = buildPublicSignalFusionWorkbench({
      query: "CVE-2026-4242 APT29",
      entityType: "cve",
      sources,
      sourcePacks,
      advisorySignals: signals,
      generatedAt
    });
    const benchmarks = fusion.sourceFamilyBenchmarks;
    const coveragePlan = fusion.publicIntelligenceCoveragePlan;
    const remediation = fusion.freshnessGapRemediation;
    const queryMatrix = fusion.publicIntelligenceQueryMatrix;
    const vendorRow = benchmarks.rows.find((row) => row.family === "vendor_report");
    const certRow = benchmarks.rows.find((row) => row.family === "cert_government");

    expect(benchmarks.schemaVersion).toBe("ti.public_source_family_benchmarks.v1");
    expect(benchmarks.queryClassCoverage.requiredFamilies).toEqual(expect.arrayContaining(["github_advisory", "cert_government", "vendor_report"]));
    expect(benchmarks.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ family: "vendor_report", usefulSignalCount: expect.any(Number), actorCampaignCveRichness: expect.any(Number) }),
      expect.objectContaining({ family: "cert_government", contradictionRate: expect.any(Number) }),
      expect.objectContaining({ family: "github_advisory", evidenceYield: expect.any(Number) }),
      expect.objectContaining({ family: "public_research_feed", recommendedAction: expect.any(String) })
    ]));
    expect(vendorRow?.usefulSignalCount).toBeGreaterThan(0);
    expect(certRow?.contradictionRate).toBeGreaterThan(0);
    expect(benchmarks.expansionRecommendations).toEqual(expect.any(Array));
    expect(benchmarks.handoffs).toMatchObject({
      agent03AdapterCertification: expect.arrayContaining(["certify_or_repair_parsers_for_undercovered_families"]),
      agent09ApiFields: ["publicSignalFusion.sourceFamilyBenchmarks"]
    });
    expect(benchmarks.guardrails).toMatchObject({
      publicOnly: true,
      dryRunOnly: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noUnsafeUrlsExposed: true,
      noDemoDefaults: true,
      noDefaultActorAssumption: true
    });
    expect(JSON.stringify(benchmarks)).not.toContain("https://");
    expect(coveragePlan.schemaVersion).toBe("ti.public_intelligence_coverage_plan.v1");
    expect(coveragePlan.queryClassSourceMap).toEqual(expect.arrayContaining([
      expect.objectContaining({
        queryClass: "cve_advisory",
        requiredFamilies: expect.arrayContaining(["github_advisory", "cert_government", "vendor_report"]),
        currentQuery: true
      }),
      expect.objectContaining({ queryClass: "victim_company", responseState: expect.any(String) })
    ]));
    expect(coveragePlan.blindSpots.map((spot) => spot.code)).toEqual(expect.arrayContaining(["contradiction_cluster"]));
    expect(coveragePlan.safeSourcePackRecommendations.every((item) => item.dryRunOnly && item.willMutate === false && item.willStartCrawling === false && item.unsafeUrlExposed === false)).toBe(true);
    expect(coveragePlan.responsiveness).toMatchObject({
      refreshAfterSeconds: 3,
      staleCacheCopyAllowed: false,
      demoFallbackAllowed: false,
      defaultActorAssumptionAllowed: false
    });
    expect(coveragePlan.handoffs.agent09ApiFields).toEqual(["publicSignalFusion.publicIntelligenceCoveragePlan"]);
    expect(coveragePlan.guardrails).toMatchObject({
      publicOnly: true,
      dryRunOnly: true,
      approvedPublicSourcesPrioritized: true,
      metadataOnlyPublicChannelHandoffs: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noRawUrlsExposed: true,
      noDemoDefaults: true,
      noDefaultActorAssumption: true,
      noStaleCacheCopy: true
    });
    expect(JSON.stringify(coveragePlan)).not.toContain("https://");

    const searchingBenchmarks = buildPublicSourceFamilyBenchmarks({
      query: "Unknown Quartz Actor",
      entityType: "actor",
      selectedSources: [],
      publicSignalDeltas: [],
      advisoryConnector: buildPublicAdvisorySignalConnector({
        query: "Unknown Quartz Actor",
        sources,
        signals: [],
        generatedAt
      }),
      generatedAt
    });
    expect(searchingBenchmarks.status).toBe("searching");
    expect(searchingBenchmarks.queryClassCoverage.unknownQuerySearching).toBe(true);
    expect(searchingBenchmarks.unknownQueryHandling).toMatchObject({
      noDefaultActorAssumption: true,
      displayState: "searching",
      allowedSummary: "Searching",
      staleCacheProseAllowed: false
    });
    expect(searchingBenchmarks.expansionRecommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: expect.any(String),
        dryRunOnly: true,
        willMutate: false,
        willStartCrawling: false,
        publicOnly: true,
        unsafeUrlExposed: false
      })
    ]));
    expect(searchingBenchmarks.expansionRecommendations.map((recommendation) => recommendation.family)).toEqual(expect.arrayContaining(["vendor_report", "cert_government", "public_channel"]));

    const searchingPlan = buildPublicIntelligenceCoveragePlan({
      query: "Unknown Quartz Actor",
      entityType: "actor",
      selectedSources: [],
      publicSignalDeltas: [],
      advisoryConnector: buildPublicAdvisorySignalConnector({
        query: "Unknown Quartz Actor",
        sources,
        signals: [],
        generatedAt
      }),
      sourceFamilyBenchmarks: searchingBenchmarks,
      generatedAt
    });
    expect(searchingPlan.status).toBe("hold");
    expect(searchingPlan.responsiveness).toMatchObject({
      initialContext: "hold",
      incrementalEvidenceExpected: true,
      staleCacheCopyAllowed: false,
      demoFallbackAllowed: false,
      defaultActorAssumptionAllowed: false
    });
    expect(searchingPlan.blindSpots.map((spot) => spot.code)).toEqual(expect.arrayContaining(["source_family_blind_spot", "no_public_evidence"]));
    expect(searchingPlan.blindSpots.find((spot) => spot.code === "no_public_evidence")?.releaseImpact).toBe("searching_only");
    expect(remediation.schemaVersion).toBe("ti.public_freshness_gap_remediation.v1");
    expect(remediation.answerState).toMatchObject({
      refreshAfterSeconds: 3,
      staleOnlyRecentActivityRejected: expect.any(Boolean)
    });
    expect(remediation.remediationActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        owner: "agent08_graph_pivot",
        action: "add_graph_pivot_review",
        dryRunOnly: true,
        willMutate: false,
        willStartCrawling: false,
        unsafeUrlExposed: false
      }),
      expect.objectContaining({
        owner: "agent09_api_field",
        action: "expose_status_field"
      })
    ]));
    expect(remediation.queryFixtures.map((fixture) => fixture.query)).toEqual(expect.arrayContaining([
      "APT29",
      "APT42",
      "Sandworm",
      "Volt Typhoon",
      "Lazarus",
      "LockBit ransomware",
      "Akira ransomware",
      "Made Up Actor"
    ]));
    expect(remediation.queryFixtures.every((fixture) => fixture.staleRecentActivityAllowed === false && fixture.defaultActorFallbackAllowed === false)).toBe(true);
    expect(remediation.apiFields.publicSignalFusionField).toBe("publicSignalFusion.freshnessGapRemediation");
    expect(remediation.guardrails).toMatchObject({
      publicOnly: true,
      dryRunOnly: true,
      noDefaultActorAssumption: true,
      noDemoFallback: true,
      noStaleCacheCopy: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noRestrictedRawCollection: true,
      noRawUrlsExposed: true
    });
    expect(JSON.stringify(remediation)).not.toContain("https://");
    expect(queryMatrix.schemaVersion).toBe("ti.public_intelligence_query_matrix.v1");
    expect(queryMatrix.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        queryClass: "cve_advisory",
        currentQuery: true,
        sourceFamilies: expect.objectContaining({ required: expect.arrayContaining(["github_advisory", "cert_government", "vendor_report"]) }),
        scores: expect.objectContaining({
          coverage: expect.any(Number),
          freshness: expect.any(Number),
          evidenceYield: expect.any(Number),
          contradictionRisk: expect.any(Number),
          parserReadiness: expect.any(Number),
          graphReadiness: expect.any(Number),
          publicAnswerReadiness: expect.any(Number),
          analystActionability: expect.any(Number)
        }),
        staleRecentActivityAllowed: false,
        defaultActorFallbackAllowed: false
      }),
      expect.objectContaining({ query: "Made Up Actor", state: "searching", recommendedNextActions: expect.arrayContaining(["show_searching"]) })
    ]));
    expect(queryMatrix.summary.weakestQueryClasses.length).toBeGreaterThan(0);
    expect(queryMatrix.apiFields.publicSignalFusionField).toBe("publicSignalFusion.publicIntelligenceQueryMatrix");
    expect(queryMatrix.guardrails).toMatchObject({
      publicOnly: true,
      noDefaultActorAssumption: true,
      noDemoFallback: true,
      noStaleCacheCopy: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noAuthBypass: true,
      noCaptchaSolving: true,
      noRestrictedRawCollection: true,
      noRawUrlsExposed: true
    });
    expect(JSON.stringify(queryMatrix)).not.toContain("https://");
  });

  test("turns stale high-volume actor coverage into remediation actions instead of recent activity promotion", () => {
    const staleRecord = signal({
      id: "sig_old_apt29",
      sourceId: "src_vendor_old",
      family: "vendor_report",
      title: "APT29 historical activity roundup",
      url: "https://vendor.example/old-apt29",
      publishedAt: "2026-01-01T00:00:00.000Z",
      observedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      matchedEntities: { actors: ["APT29"], malware: [], tools: [], cves: [], campaigns: ["historical espionage"], sectors: [], countries: [], victims: [] },
      tags: ["APT29", "historical"]
    });
    const staleDelta: PublicSignalDeltaDto = {
      id: staleRecord.id,
      sourceId: staleRecord.sourceId,
      family: staleRecord.family,
      title: staleRecord.title,
      summary: staleRecord.summary ?? staleRecord.title,
      url: staleRecord.url,
      publishedAt: staleRecord.publishedAt,
      observedAt: staleRecord.observedAt,
      matchedEntities: {
        actors: staleRecord.matchedEntities?.actors ?? [],
        malware: staleRecord.matchedEntities?.malware ?? [],
        tools: staleRecord.matchedEntities?.tools ?? [],
        cves: staleRecord.matchedEntities?.cves ?? [],
        campaigns: staleRecord.matchedEntities?.campaigns ?? [],
        sectors: staleRecord.matchedEntities?.sectors ?? [],
        countries: staleRecord.matchedEntities?.countries ?? [],
        victims: staleRecord.matchedEntities?.victims ?? []
      },
      tags: staleRecord.tags ?? [],
      confidence: staleRecord.confidence ?? 0.8,
      state: "new" as const,
      contentHash: "contenthash:stale-apt29",
      mergeTarget: "clear_web_capture_evidence" as const,
      collectedAt: generatedAt,
      provenance: { sourceId: staleRecord.sourceId, publicOnly: true as const, evidenceBacked: true, safeUrl: true }
    };
    const plan = buildPublicIntelligenceCoveragePlan({
      query: "APT29",
      entityType: "actor",
      selectedSources: [],
      publicSignalDeltas: [staleDelta],
      generatedAt
    });
    const remediation = buildPublicFreshnessGapRemediation({
      query: "APT29",
      entityType: "actor",
      selectedSources: [],
      publicSignalDeltas: [staleDelta],
      coveragePlan: plan,
      generatedAt
    });

    expect(remediation.highVolumeActorFreshness).toMatchObject({
      matchedActor: "APT29",
      state: "stale",
      staleRecentActivityPromotionAllowed: false
    });
    expect(remediation.answerState.staleOnlyRecentActivityRejected).toBe(true);
    expect(remediation.releaseGate.canPromoteRecentActivity).toBe(false);
    expect(remediation.remediationActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ owner: "agent02_scheduler_cadence", action: "raise_cadence", priority: "high" }),
      expect.objectContaining({ owner: "agent07_quality_hold", action: "hold_answer_quality", priority: "high" })
    ]));
  });

  test("correlates public advisories and emits conflict-aware evidence holds", () => {
    const sources = [
      source({ id: "src_vendor_a", name: "Vendor A", type: "static_web", accessMethod: "public_http", url: "https://vendor-a.example/reports", tags: ["APT29", "CVE-2026-4242"] }),
      source({ id: "src_vendor_b", name: "Vendor B", type: "static_web", accessMethod: "public_http", url: "https://vendor-b.example/reports", tags: ["APT42", "CVE-2026-4242"] }),
      source({ id: "src_cisa", name: "CISA KEV", type: "api", accessMethod: "official_api", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", tags: ["CISA", "KEV"] }),
      source({ id: "src_public_channel", name: "Security Alerts", type: "telegram_public", accessMethod: "official_api", url: "https://t.me/securityalerts", tags: ["Akira", "Fjord Energy AS"] })
    ];
    const signals = [
      signal({
        id: "sig_vendor_apt29",
        sourceId: "src_vendor_a",
        family: "vendor_report",
        title: "Vendor A says APT29 exploited CVE-2026-4242 against government",
        url: "https://vendor-a.example/reports/cve-2026-4242",
        matchedEntities: { actors: ["APT29"], cves: ["CVE-2026-4242"], sectors: ["government"], countries: ["US"], campaigns: ["diplomatic phishing"] },
        tags: ["exploitation", "APT29"]
      }),
      signal({
        id: "sig_vendor_apt42",
        sourceId: "src_vendor_b",
        family: "vendor_report",
        title: "Vendor B attributes CVE-2026-4242 to APT42",
        url: "https://vendor-b.example/reports/cve-2026-4242",
        matchedEntities: { actors: ["APT42"], cves: ["CVE-2026-4242"], sectors: ["energy"], countries: ["Norway"] },
        tags: ["exploitation", "APT42"]
      }),
      signal({
        id: "sig_cisa_stale",
        sourceId: "src_cisa",
        family: "cert_government",
        title: "Old CISA repost for CVE-2026-4242 exploitation status",
        url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search=CVE-2026-4242",
        matchedEntities: { cves: ["CVE-2026-4242"], sectors: ["government"] },
        publishedAt: "2025-01-01T00:00:00.000Z",
        observedAt: "2025-01-02T00:00:00.000Z",
        updatedAt: "2025-01-02T00:00:00.000Z",
        state: "stale"
      }),
      signal({
        id: "sig_vendor_duplicate",
        sourceId: "src_vendor_b",
        family: "vendor_report",
        title: "Vendor B attributes CVE-2026-4242 to APT42",
        url: "https://vendor-b.example/reports/cve-2026-4242/",
        matchedEntities: { actors: ["APT42"], cves: ["CVE-2026-4242"], sectors: ["energy"], countries: ["Norway"] },
        tags: ["syndicated"]
      })
    ];
    const evidence = [{
      sourceId: "src_public_channel",
      channel: "securityalerts",
      messageUrl: "https://t.me/securityalerts/20",
      messageTimestamp: "2026-05-24T08:10:00.000Z",
      snippet: "Akira claims Fjord Energy AS",
      extractedUrls: [],
      confidence: 0.54,
      messageId: 20,
      editedAt: "2026-05-24T08:20:00.000Z",
      extractionHandoff: {
        actorAliases: ["Akira"],
        cves: [],
        victims: ["Fjord Energy AS"],
        uncertaintyMarkers: ["public-channel-only"]
      }
    }];

    const fusion = buildPublicSignalFusionWorkbench({
      query: "CVE-2026-4242",
      entityType: "cve",
      sources,
      advisorySignals: signals,
      evidence,
      generatedAt
    });
    const correlation = fusion.advisoryCorrelation;

    expect(correlation.schemaVersion).toBe("ti.public_advisory_correlation.v1");
    expect(correlation.status).toBe("hold");
    expect(correlation.correlatedEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: "cves",
        entity: "CVE-2026-4242",
        conflictTypes: expect.arrayContaining(["actor_attribution_disagreement", "stale_or_reposted_advisory", "sector_country_ambiguity"]),
        analystAction: "hold_graph_promotion",
        provenance: expect.objectContaining({ publicOnly: true, unsafeUrlExposed: false })
      }),
      expect.objectContaining({
        entityType: "victims",
        entity: "Fjord Energy AS",
        conflictTypes: expect.arrayContaining(["edited_deleted_public_channel", "public_channel_only_claim"]),
        analystAction: "review_conflict",
        provenance: expect.objectContaining({ publicChannelOnly: true })
      })
    ]));
    expect(correlation.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        conflictType: "actor_attribution_disagreement",
        entity: "CVE-2026-4242",
        severity: "hold",
        analystHold: "graph_stix_hold",
        handoff: expect.objectContaining({
          agent07QualityGate: "public_advisory_conflict_review",
          agent08GraphStixHold: "hold_conflicted_public_relationship",
          agent09ApiField: "publicSignalFusion.advisoryCorrelation"
        })
      }),
      expect.objectContaining({
        conflictType: "public_channel_only_claim",
        entity: "Fjord Energy AS",
        severity: "review"
      })
    ]));
    expect(correlation.summary).toMatchObject({
      conflictCount: expect.any(Number),
      holdCount: expect.any(Number),
      publicChannelOnlyCount: expect.any(Number),
      staleEvidenceCount: expect.any(Number)
    });
    expect(correlation.handoffs).toMatchObject({
      agent07QualityGates: ["public_advisory_conflict_review"],
      agent08GraphStixHolds: ["hold_conflicted_public_relationship"],
      agent09ApiFields: ["publicSignalFusion.advisoryCorrelation"]
    });
    expect(correlation.guardrails).toMatchObject({
      publicOnly: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noUnsafeUrlsExposed: true
    });
    expect(JSON.stringify(correlation)).not.toContain("https://");

    const resolver = fusion.publicConflictContradictionResolver;
    expect(resolver.schemaVersion).toBe("ti.public_conflict_contradiction_resolver.v1");
    expect(resolver.status).toBe("hold");
    expect(resolver.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        contradictionType: "actor_attribution_conflict",
        entity: "CVE-2026-4242",
        affectedQueryClasses: expect.arrayContaining(["cve_advisory"]),
        publicAnswerEffect: "hold_fact_promotion",
        graphStixEffect: "stix_export_blocked",
        releaseGate: "hold",
        analystActions: expect.arrayContaining(["compare_sources", "hold_public_answer", "review_graph_relationship"]),
        handoffs: expect.objectContaining({
          agent06Evidence: expect.arrayContaining(["verify_resolver_evidence_ids"]),
          agent07Quality: ["public_contradiction_quality_hold"],
          agent08GraphStix: ["block_conflicted_relationship_export"],
          agent09ApiFields: ["publicSignalFusion.publicConflictContradictionResolver"]
        })
      }),
      expect.objectContaining({
        contradictionType: "contradictory_victim_claim",
        entity: "Fjord Energy AS",
        affectedQueryClasses: expect.arrayContaining(["victim_company"]),
        publicAnswerEffect: "keep_partial",
        graphStixEffect: "graph_review_required",
        releaseGate: "review",
        analystActions: expect.arrayContaining(["review_victim_claim", "request_more_sources"])
      })
    ]));
    expect(resolver.summary).toMatchObject({
      holdCount: expect.any(Number),
      reviewCount: expect.any(Number),
      affectedQueryClasses: expect.arrayContaining(["cve_advisory", "victim_company"]),
      releaseGate: "hold"
    });
    expect(resolver.apiFields).toMatchObject({
      publicSignalFusionField: "publicSignalFusion.publicConflictContradictionResolver",
      compactRowFields: expect.arrayContaining(["contradictionType", "publicAnswerEffect", "graphStixEffect", "releaseGate"])
    });
    expect(resolver.guardrails).toMatchObject({
      publicOnly: true,
      noRawUrlsExposed: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noDefaultActorAssumption: true,
      noStaleCacheCopy: true
    });
    expect(JSON.stringify(resolver)).not.toContain("https://");

    const directCorrelation = buildPublicAdvisoryCorrelation({
      query: "Unknown Quartz Actor",
      advisoryConnector: buildPublicAdvisorySignalConnector({
        query: "Unknown Quartz Actor",
        sources,
        signals: [],
        generatedAt
      }),
      publicSignalDeltas: [],
      generatedAt
    });
    expect(directCorrelation.status).toBe("insufficient_public_evidence");
  });

  test("builds a route-visible public signal to live collection loop with safe metadata holds", () => {
    const sources = [
      source({
        id: "src_vendor_akira",
        name: "Vendor ransomware reports",
        type: "static_web",
        accessMethod: "public_http",
        url: "https://vendor.example/reports/akira",
        tags: ["Akira", "ransomware", "vendor"],
        metadata: { actors: ["Akira"], victims: ["Fjord Energy AS"], parserGap: true, evidenceYield: 0.35 },
        updatedAt: "2025-01-01T00:00:00.000Z"
      }),
      source({
        id: "src_public_channel",
        name: "Security Alerts",
        type: "telegram_public",
        accessMethod: "official_api",
        url: "https://t.me/securityalerts",
        tags: ["Akira", "victim", "public channel"],
        metadata: { actors: ["Akira"], victims: ["Fjord Energy AS"], sectors: ["energy"], countries: ["Norway"] }
      })
    ];
    const evidence = [{
      sourceId: "src_public_channel",
      channel: "securityalerts",
      messageUrl: "https://t.me/securityalerts/44",
      messageTimestamp: "2026-05-24T08:10:00.000Z",
      snippet: "Akira claims Fjord Energy AS in Norway energy sector",
      extractedUrls: [],
      confidence: 0.55,
      messageId: 44,
      extractionHandoff: {
        actorAliases: ["Akira"],
        cves: [],
        victims: ["Fjord Energy AS"],
        uncertaintyMarkers: ["public-channel-only"]
      }
    }];
    const advisorySignals = [
      signal({
        id: "sig_vendor_akira_stale",
        sourceId: "src_vendor_akira",
        family: "vendor_report",
        title: "Akira ransomware public overview",
        summary: "Akira is a ransomware group also known as a threat actor background overview.",
        url: "https://vendor.example/reports/akira",
        publishedAt: "2025-01-01T00:00:00.000Z",
        observedAt: "2025-01-02T00:00:00.000Z",
        updatedAt: "2025-01-02T00:00:00.000Z",
        matchedEntities: { actors: ["Akira"], victims: ["Fjord Energy AS"], sectors: ["energy"], countries: ["Norway"] },
        state: "stale"
      })
    ];

    const query = "Akira Fjord Energy AS victim claim";
    const fusion = buildPublicSignalFusionWorkbench({
      query,
      entityType: "victim",
      sources,
      advisorySignals,
      evidence,
      darkwebMetadataSignals: [{
        id: "restricted_meta_akira_fjord",
        redactedSiteId: "dwsite_redacted_fjord_01",
        category: "ransomware_leak",
        risk: "high",
        liveness: "active",
        observedAt: "2026-05-24T07:00:00.000Z",
        actors: ["Akira"],
        victims: ["Fjord Energy AS"],
        sectors: ["energy"],
        countries: ["Norway"],
        ttps: ["data leak extortion"],
        blockedPayloadMarkers: ["raw_url", "credential", "dump", "payload_link"],
        metadataOnly: true
      }],
      generatedAt
    });

    const loop = fusion.publicSignalLiveCollectionLoop;
    expect(loop.schemaVersion).toBe("ti.public_signal_live_collection_loop.v1");
    expect(loop.status).toMatch(/partial|held/);
    expect(loop.intakeContract).toMatchObject({
      normalizedPayloadOnly: true,
      collectedItemProvenanceRequired: true,
      acceptedFamilies: expect.arrayContaining(["public_channel", "vendor_report", "source_atlas", "darkweb_metadata"]),
      unsafePayloadFieldsRejected: expect.arrayContaining(["rawText", "payload", "credential", "onionUrl"])
    });
    expect(loop.normalizedIntake).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: "darkweb_metadata",
        state: "held",
        redactedSiteIds: ["dwsite_redacted_fjord_01"],
        blockedPayloadMarkers: expect.arrayContaining(["unsafe_locator", "dump", "payload_marker"]),
        provenance: expect.objectContaining({
          metadataOnly: true,
          rawUrlExposed: false,
          unsafePayloadExposed: false
        }),
        penalties: expect.arrayContaining(["metadata_only_hold"])
      }),
      expect.objectContaining({
        family: "public_channel",
        provenance: expect.objectContaining({
          normalizedToCollectedItem: true,
          publicOnly: true,
          safeForApi: true
        })
      })
    ]));
    expect(loop.score).toMatchObject({
      overall: expect.any(Number),
      familyDiversity: expect.any(Number),
      penalties: expect.arrayContaining(["metadata_only_hold"])
    });
    expect(loop.playbook).toMatchObject({
      queryClass: "victim_company",
      requiredFamilies: expect.arrayContaining(["vendor_report", "cert_government", "public_channel", "public_research_feed"]),
      parserExpectations: expect.arrayContaining(["victim names", "sector/country hints", "claim timestamp", "public corroboration caveats"]),
      evidenceRequirements: expect.arrayContaining(["at least one evidence-backed CollectedItem delta for public answer promotion"]),
      graphStixHandoff: expect.stringMatching(/review_required|blocked_until_review/)
    });
    expect(loop.nextSafeCollectionTasks).toEqual(expect.arrayContaining([
      expect.objectContaining({ owner: "agent01_source_activation", action: "activate_source_family", dryRunOnly: true, willMutate: false, noUnsafePayload: true }),
      expect.objectContaining({ owner: "agent05_restricted_metadata", action: "request_restricted_metadata_review" }),
      expect.objectContaining({ owner: "agent09_api", action: "expose_api_state" }),
      expect.objectContaining({ owner: "agent10_release", action: "release_gate_watch" })
    ]));
    expect(loop.queryFixtures).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "high_value_known_actor", query: "APT29" }),
      expect.objectContaining({ name: "random_unknown_actor", expectedState: "searching" }),
      expect.objectContaining({ name: "darkweb_metadata_only_held", expectedState: "held", includesDarkwebMetadataHold: true })
    ]));
    expect(loop.handoffs).toMatchObject({
      agent05DarkwebMetadata: ["provide_redacted_metadata_only_context_with_blocked_payload_markers"],
      agent09ApiFields: ["publicSignalFusion.publicSignalLiveCollectionLoop"]
    });
    expect(loop.guardrails).toMatchObject({
      publicOnly: true,
      safeDarkwebMetadataOnly: true,
      noRawUnsafeUrls: true,
      noCredentials: true,
      noDumps: true,
      noPayloadLinks: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noDefaultActorAssumption: true,
      noStaleCacheCopy: true
    });
    expect(JSON.stringify(loop)).not.toContain("https://");
    expect(JSON.stringify(loop)).not.toContain(".onion");

    const valueImpact = fusion.publicSignalValueImpact;
    expect(valueImpact.schemaVersion).toBe("ti.public_signal_value_impact.v1");
    expect(valueImpact.status).toMatch(/improves_answer|metadata_only_hold|needs_public_evidence|no_lift/);
    expect(valueImpact.answerImpact).toMatchObject({
      currentReadiness: expect.any(Number),
      projectedWithSourceAtlas: expect.any(Number),
      projectedWithDarkwebMetadata: expect.any(Number),
      projectedWithBoth: expect.any(Number),
      bestLift: expect.any(Number)
    });
    expect(valueImpact.sourceAtlasImpact).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: "cert_government",
        missingFamily: true,
        improvesAnswer: true,
        evidencePrerequisites: expect.arrayContaining(["CollectedItem provenance", "fresh public evidence delta"]),
        safeActivationAction: expect.stringMatching(/activate_source_family|promote_source_pack_candidate|repair_parser_before_activation/)
      })
    ]));
    expect(valueImpact.darkwebIndexImpact).toEqual(expect.arrayContaining([
      expect.objectContaining({
        redactedSiteIds: ["dwsite_redacted_fjord_01"],
        reviewState: "review_required",
        improvesTriage: true,
        promotesPublicAnswer: false
      })
    ]));
    expect(valueImpact.gapClosure[0]).toMatchObject({
      queryClass: "victim_company",
      missingFamilies: expect.arrayContaining(["cert_government", "public_research_feed"])
    });
    expect(valueImpact.nextBestActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ owner: "agent01_source_atlas", action: "stage_source_atlas_candidate", dryRunOnly: true, willMutate: false, noUnsafePayload: true }),
      expect.objectContaining({ owner: "agent05_darkweb_index", action: "review_metadata_only_context" }),
      expect.objectContaining({ owner: "agent09_api", action: "expose_value_lift" })
    ]));
    expect(valueImpact.guardrails).toMatchObject({
      publicOnlyAnswerPromotion: true,
      darkwebMetadataNeverPromotesPublicAnswer: true,
      noRawUnsafeUrls: true,
      noCredentials: true,
      noDumps: true,
      noPayloadLinks: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noDefaultActorAssumption: true,
      noStaleCacheCopy: true
    });
    expect(JSON.stringify(valueImpact)).not.toContain("https://");
    expect(JSON.stringify(valueImpact)).not.toContain(".onion");

    const freshnessValue = fusion.publicCoverageFreshnessValue;
    expect(freshnessValue.schemaVersion).toBe("ti.public_coverage_freshness_value.v1");
    expect(freshnessValue.status).toMatch(/ready_value_fresh|freshness_improving|stale_value_risk|coverage_gap|held_metadata_only/);
    expect(freshnessValue.summary).toMatchObject({
      coverageFreshnessScore: expect.any(Number),
      currentAnswerReadiness: expect.any(Number),
      expectedAnswerLift: expect.any(Number),
      missingFamilyCount: expect.any(Number),
      publicEvidenceReady: expect.any(Boolean),
      darkwebMetadataOnlyHold: expect.any(Boolean)
    });
    expect(freshnessValue.familyFreshness).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: "cert_government",
        requiredForQuery: true,
        targetFreshnessDays: 3,
        expectedAnswerLift: expect.any(Number),
        nextAction: expect.stringMatching(/activate_source_family|raise_cadence|repair_parser|replay_evidence|quality_hold|none/)
      }),
      expect.objectContaining({
        family: "public_research_feed",
        requiredForQuery: true
      })
    ]));
    expect(freshnessValue.queryClassFreshness).toEqual(expect.arrayContaining([
      expect.objectContaining({
        queryClass: "victim_company",
        currentQuery: true,
        missingFamilies: expect.arrayContaining(["cert_government", "public_research_feed"]),
        canImprovePublicAnswer: true
      })
    ]));
    expect(freshnessValue.sourceAtlasFreshnessImpact).toEqual(expect.arrayContaining([
      expect.objectContaining({
        family: "cert_government",
        expectedFreshnessGain: expect.any(Number),
        expectedEvidenceYieldGain: expect.any(Number),
        expectedAnswerLift: expect.any(Number),
        safeForPublicPromotion: expect.any(Boolean)
      })
    ]));
    expect(freshnessValue.highValueCoverage).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entity: "Akira",
        entityType: "ransomware",
        targetFreshnessDays: 14,
        nextAction: expect.any(String)
      }),
      expect.objectContaining({
        entity: "Akira Fjord Energy AS victim claim",
        entityType: "query_entity",
        matchedCurrentQuery: true
      })
    ]));
    expect(freshnessValue.staleRisk).toMatchObject({
      staleOnlyRecentActivityRejected: expect.any(Boolean),
      noEvidenceFamilies: expect.arrayContaining(["cert_government", "public_research_feed"]),
      metadataOnlyFamilies: expect.arrayContaining(["darkweb_metadata"])
    });
    expect(freshnessValue.handoffs).toMatchObject({
      agent02SchedulerCadence: expect.any(Array),
      agent03AdapterRepair: expect.any(Array),
      agent09ApiFields: ["publicSignalFusion.publicCoverageFreshnessValue"]
    });
    expect(freshnessValue.guardrails).toMatchObject({
      publicOnly: true,
      darkwebMetadataTriageOnly: true,
      noRawUnsafeUrls: true,
      noCredentials: true,
      noPayloadLinks: true,
      noPrivateChannels: true,
      noAccountAutomation: true,
      noDefaultActorAssumption: true,
      noStaleCacheCopy: true
    });
    expect(JSON.stringify(freshnessValue)).not.toContain("https://");
    expect(JSON.stringify(freshnessValue)).not.toContain(".onion");
  });

  test("expands public source packs across enterprise query classes with suppression and parser labels", () => {
    const sources = [
      source({ id: "src_existing_vendor", name: "Existing vendor", type: "static_web", accessMethod: "public_http", url: "https://vendor.example/apt29", tags: ["APT29", "vendor"] })
    ];
    const sourcePacks: TelegramPublicSourcePack[] = [{
      version: 1,
      id: "enterprise-public-pack",
      name: "Enterprise public pack",
      disabledByDefault: true,
      generatedAt,
      sources: [
        {
          id: "pack_cisa_kev",
          name: "CISA KEV public advisory",
          channelHandle: "cisa_kev",
          publicUrl: "https://t.me/cisa_kev",
          legalNotes: "Public advisory channel.",
          approvalState: "approved",
          retentionClass: "public_chat_text",
          topicTags: ["cert", "government", "kev", "CVE-2026-4242"],
          focus: { actors: ["APT29"], ransomware: [], cves: ["CVE-2026-4242"], victims: [], sectors: ["government"], countries: ["US"] },
          rateLimit: { minIntervalSeconds: 120, pageSize: 50, expectedRequestsPerHour: 20 },
          compliance: { legalBasis: "public", license: "public", approvalScope: "metadata_only", termsReviewedAt: "2026-05-20T00:00:00.000Z" },
          trustScore: 0.82
        },
        {
          id: "pack_malware_pdf",
          name: "Snake malware PDF feed",
          channelHandle: "snake_reports",
          publicUrl: "https://t.me/snake_reports",
          legalNotes: "Public report index.",
          approvalState: "pending",
          retentionClass: "public_chat_text",
          topicTags: ["malware", "tool", "Snake", "Turla"],
          focus: { actors: ["Turla"], ransomware: [], cves: [], victims: [], sectors: [], countries: ["Russia"] },
          rateLimit: { minIntervalSeconds: 600, pageSize: 20 },
          compliance: { legalBasis: "public", license: "public", approvalScope: "public_requires_review", termsReviewedAt: "2026-02-01T00:00:00.000Z" },
          metadata: { parserStatus: "needs_repair" },
          trustScore: 0.64
        },
        {
          id: "pack_duplicate",
          name: "Duplicate CISA KEV mirror",
          channelHandle: "@cisa_kev",
          publicUrl: "https://t.me/cisa_kev/",
          legalNotes: "Duplicate public channel.",
          approvalState: "pending",
          retentionClass: "public_chat_text",
          topicTags: ["cert", "government", "CVE-2026-4242"],
          focus: { actors: [], ransomware: [], cves: ["CVE-2026-4242"], victims: [], sectors: [], countries: [] },
          rateLimit: { minIntervalSeconds: 120, pageSize: 50 },
          compliance: { legalBasis: "public", license: "public", approvalScope: "public_requires_review", termsReviewedAt: "2026-05-20T00:00:00.000Z" }
        },
        {
          id: "pack_stale_sector",
          name: "Old energy sector mirror",
          channelHandle: "old_energy_sector",
          publicUrl: "https://t.me/old_energy_sector",
          legalNotes: "Public but review is stale.",
          approvalState: "pending",
          retentionClass: "public_chat_text",
          topicTags: ["sector", "energy", "ransomware"],
          focus: { actors: [], ransomware: ["Akira"], cves: [], victims: ["Fjord Energy AS"], sectors: ["energy"], countries: ["Norway"] },
          rateLimit: { minIntervalSeconds: 900, pageSize: 10 },
          compliance: { legalBasis: "public", license: "public", approvalScope: "public_requires_review", termsReviewedAt: "2024-01-01T00:00:00.000Z" }
        },
        {
          id: "pack_blocked",
          name: "Blocked private-looking source",
          channelHandle: "private_actor_feed",
          publicUrl: "https://t.me/private_actor_feed",
          legalNotes: "Blocked by policy.",
          approvalState: "disabled",
          retentionClass: "public_chat_text",
          topicTags: ["APT29"],
          focus: { actors: ["APT29"], ransomware: [], cves: [], victims: [], sectors: [], countries: [] },
          rateLimit: { minIntervalSeconds: 60, pageSize: 10 },
          compliance: { legalBasis: "public", license: "unknown", approvalScope: "disabled" }
        }
      ]
    }];

    const expansion = buildPublicSourcePackExpansion({
      query: "CVE-2026-4242 APT29 exploitation",
      entityType: "cve",
      sources,
      sourcePacks,
      selectedSources: [
        {
          sourceId: "src_existing_vendor",
          name: "Existing vendor",
          url: "https://vendor.example/apt29",
          family: "vendor_report",
          status: "active",
          selected: true,
          score: 0.8,
          reliability: 0.8,
          freshness: 0.8,
          queryFit: 0.7,
          diversityBoost: 0.1,
          decayReasons: [],
          matchedTerms: ["apt29"],
          regions: [],
          rateLimit: { delayed: false },
          availability: { unavailable: false, takedownOrRetired: false, deletedOrUnavailablePublicMessages: 0, editedPublicMessages: 0 },
          hints: { githubAdvisory: false, certGovernment: false, vendorReport: true, malwareReportFeed: false, publicChannel: false, publicSocial: false, clearWebPromotion: false },
          provenance: { sourceId: "src_existing_vendor", sourceType: "static_web", accessMethod: "public_http", legalNotes: "Approved public source.", approvedPublic: true, metadataOnly: false }
        }
      ],
      generatedAt
    });

    expect(expansion.schemaVersion).toBe("ti.public_source_pack_expansion.v1");
    expect(expansion.queryClass).toBe("cve_advisory");
    expect(expansion.familyCoverage.missingFamilies).toEqual(expect.arrayContaining(["github_advisory", "cert_government", "public_research_feed"]));
    expect(expansion.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: "pack_cisa_kev",
        family: "cert_government",
        publicUrlHash: expect.any(String),
        dedupeKey: expect.stringContaining("cert_government"),
        parserCapability: "metadata_only",
        onboardingRecommendation: "review_public_source",
        provenance: expect.objectContaining({ publicOnly: true, unsafeUrlExposed: false })
      }),
      expect.objectContaining({
        sourceId: "pack_malware_pdf",
        parserCapability: "needs_parser",
        onboardingRecommendation: "repair_parser_before_activation"
      })
    ]));
    expect(expansion.suppressed.duplicateDedupeKeys.length).toBeGreaterThan(0);
    expect(expansion.suppressed.staleSourceIds).toEqual(expect.arrayContaining(["pack_stale_sector"]));
    expect(expansion.suppressed.blockedSourceIds).toEqual(expect.arrayContaining(["pack_blocked"]));
    expect(expansion.handoffs).toMatchObject({
      agent03ParserRepair: expect.arrayContaining(["repair_parser_before_source_activation"]),
      agent09ApiFields: ["publicSignalFusion.sourcePackExpansion"]
    });
    expect(JSON.stringify(expansion)).not.toContain("https://t.me/cisa_kev");
    expect(expansion.guardrails).toMatchObject({
      publicOnly: true,
      dryRunOnly: true,
      noPrivateChannelAccess: true,
      noAccountAutomation: true,
      unsafeUrlsExposed: false
    });
  });
});
