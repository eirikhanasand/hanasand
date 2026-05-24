import { describe, expect, test } from "bun:test";
import {
  buildAnalystPublicSourceWorkbench,
  buildPublicAdvisorySignalConnector,
  buildPublicSignalFusionWorkbench,
  type PublicAdvisorySignalRecord
} from "../adapters/publicSignalFusion.ts";
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
});
