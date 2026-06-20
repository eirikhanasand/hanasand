import { describe, expect, test } from "bun:test";
import {
  inferAdvisoryFamily,
  PublicAdvisoryAdapter,
  publicAdvisoryItemsToSignalRecords,
  searchPublicAdvisoryItems,
  type PublicAdvisorySafeDelta
} from "../adapters/publicAdvisory.ts";
import { buildLiveCaptureCanaryPacket, buildLiveCaptureRuntimePacket } from "../adapters/liveCaptureRuntime.ts";
import { buildPublicAdvisoryCorrelation, buildPublicAdvisorySignalConnector } from "../adapters/publicSignalFusion.ts";
import { RssAdapter } from "../adapters/rss.ts";
import { StaticWebAdapter } from "../adapters/staticWeb.ts";
import type { AdapterRunResult, CollectedItem, CollectionTask, SourceRecord } from "../types.ts";
import { hashContent } from "../utils.ts";

const createdAt = new Date(0).toISOString();

function source(input: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: input.id ?? "src_ghsa",
    name: input.name ?? "GitHub Security Advisories",
    type: input.type ?? "api",
    url: input.url ?? "https://api.github.com/advisories",
    accessMethod: input.accessMethod ?? "official_api",
    status: input.status ?? "active",
    risk: input.risk ?? "low",
    trustScore: input.trustScore ?? 0.9,
    language: input.language ?? "en",
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 1800,
    legalNotes: input.legalNotes ?? "Official public advisory API; public-only collection.",
    createdAt,
    updatedAt: createdAt,
    tags: input.tags ?? ["github", "GHSA", "CVE", "APT29"],
    governance: input.governance,
    metadata: input.metadata
  };
}

function task(src: SourceRecord, input: Partial<CollectionTask> = {}): CollectionTask {
  return {
    id: input.id ?? "task_public_advisory",
    sourceId: src.id,
    targetUrl: input.targetUrl ?? src.url,
    sourceType: input.sourceType ?? "api",
    queuedAt: input.queuedAt ?? "2026-05-24T12:00:00.000Z",
    priority: input.priority ?? 0.9,
    reason: input.reason ?? "fixture",
    retryCount: input.retryCount ?? 0,
    maxBytes: input.maxBytes
  };
}

function responseFixture(body: unknown, init: ResponseInit, url: string): Response {
  const response = new Response(typeof body === "string" ? body : JSON.stringify(body), init);
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("public advisory adapter", () => {
  test("normalizes public GitHub Security Advisory JSON into CollectedItem-compatible evidence", async () => {
    const src = source();
    const adapter = new PublicAdvisoryAdapter({
      fetcher: async (input, init) => {
        expect(String(input)).toBe("https://api.github.com/advisories");
        expect(init?.headers).toMatchObject({ "user-agent": "ti-scraper/0.1 public-cti-research" });
        return responseFixture([
          {
            ghsa_id: "GHSA-abcd-1234-wxyz",
            cve_id: "CVE-2026-4242",
            summary: "APT29 exploitation advisory for CVE-2026-4242",
            description: "Public GitHub Security Advisory describing exploitation, mitigation, and affected package details for APT29-linked activity.",
            html_url: "https://github.com/advisories/GHSA-abcd-1234-wxyz",
            published_at: "2026-05-24T08:00:00Z",
            updated_at: "2026-05-24T09:00:00Z",
            vulnerabilities: [{ package: { ecosystem: "npm", name: "example-lib" } }],
            cwes: ["CWE-79"]
          }
        ], {
          status: 200,
          headers: {
            "content-type": "application/json",
            etag: "\"ghsa-etag\"",
            "last-modified": "Sun, 24 May 2026 09:00:00 GMT"
          }
        }, src.url);
      }
    });

    const result = await adapter.collect(src, task(src));
    const item = result.items[0]!;

    expect(result.metadata).toMatchObject({
      adapter: "public_advisory",
      family: "github_advisory",
      parsedRecords: 1,
      capturedRecords: 1,
      etag: "\"ghsa-etag\""
    });
    expect(item).toMatchObject({
      sourceId: src.id,
      url: "https://github.com/advisories/GHSA-abcd-1234-wxyz",
      publishedAt: "2026-05-24T08:00:00.000Z",
      title: "APT29 exploitation advisory for CVE-2026-4242",
      sensitive: false
    });
    expect(item.rawText).toContain("CVE-2026-4242");
    expect(item.rawText).toContain("example-lib");
    const safeDelta = item.metadata.publicSignalDelta as PublicAdvisorySafeDelta;
    expect(JSON.stringify(safeDelta)).not.toContain("https://");
    expect(safeDelta).toMatchObject({
      schemaVersion: "ti.public_advisory_signal_delta.v1",
      family: "github_advisory",
      canonicalUrlHash: expect.stringMatching(/^urlhash:/),
      evidenceReplayRef: expect.stringMatching(/^evidence_replay_ref:/),
      provenance: {
        publicOnly: true,
        officialOrPublicHttp: true
      }
    });
    expect(item.metadata).toMatchObject({
      adapter: "public_advisory",
      connectorFamily: "github_advisory",
      parserProfile: "advisory_signal",
      matchedEntities: {
        actors: expect.arrayContaining(["APT29"]),
        cves: expect.arrayContaining(["CVE-2026-4242"]),
        tools: expect.arrayContaining(["example-lib", "npm"])
      },
      publicSignalDelta: expect.any(Object)
    });
    expect(String(item.metadata.dedupeKey)).toContain("github_advisory");
    expect(safeDelta.forbiddenFields).toContain("rawText");
    expect(JSON.stringify(safeDelta)).not.toContain("must-not-leak");
  });

  test("parses CISA KEV-style records and provides useful advisory search hits", async () => {
    const src = source({
      id: "src_cisa_kev",
      name: "CISA KEV Catalog",
      url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
      accessMethod: "public_http",
      tags: ["CISA", "KEV", "government"]
    });
    const adapter = new PublicAdvisoryAdapter({
      fetcher: async () => responseFixture({
        knownExploitedVulnerabilities: [
          {
            cveID: "CVE-2024-3094",
            vendorProject: "XZ Utils",
            product: "XZ Utils",
            vulnerabilityName: "XZ Utils backdoor vulnerability",
            dateAdded: "2026-05-20",
            requiredAction: "Apply vendor mitigations and verify affected versions.",
            notes: "Government advisory for critical infrastructure defenders."
          },
          {
            cveID: "CVE-2026-9999",
            vulnerabilityName: "Unrelated vulnerability",
            dateAdded: "2026-05-19"
          }
        ]
      }, {
        status: 200,
        headers: { "content-type": "application/json" }
      }, src.url)
    });

    const result = await adapter.collect(src, task(src));
    expect(result.items).toHaveLength(2);
    const hits = searchPublicAdvisoryItems(result.items, "XZ Utils CVE-2024-3094 critical infrastructure");
    expect(hits[0]?.item.title).toBe("XZ Utils backdoor vulnerability");
    expect(hits[0]?.matchedFields).toEqual(expect.arrayContaining(["title", "cves", "sectors"]));
    expect(hits[0]?.score ?? 0).toBeGreaterThan(0.3);

    expect(result.items[0]?.metadata).toMatchObject({
      connectorFamily: "cert_government",
      matchedEntities: {
        cves: expect.arrayContaining(["CVE-2024-3094"]),
        sectors: expect.arrayContaining(["critical infrastructure"])
      }
    });
  });

  test("suppresses private repo advisories payload URLs secret-bearing URLs and onion links", async () => {
    const src = source({
      id: "src_vendor_advisories",
      name: "Vendor Advisory Feed",
      url: "https://vendor.example.test/advisories.json",
      accessMethod: "public_http",
      tags: ["vendor", "advisory"]
    });
    const adapter = new PublicAdvisoryAdapter({
      fetcher: async () => responseFixture([
        {
          title: "Safe public vendor advisory for Akira ransomware",
          description: "Public advisory with mitigation context for healthcare victims.",
          url: "https://vendor.example.test/advisories/akira-healthcare",
          publishedAt: "2026-05-24T10:00:00Z"
        },
        {
          title: "Private GHSA path",
          url: "https://github.com/acme/private-repo/security/advisories/GHSA-secret",
          publishedAt: "2026-05-24T10:00:00Z"
        },
        {
          title: "Payload link",
          url: "https://vendor.example.test/download/payload.bin",
          publishedAt: "2026-05-24T10:00:00Z"
        },
        {
          title: "Secret token link",
          url: "https://vendor.example.test/advisory?token=must-not-leak",
          publishedAt: "2026-05-24T10:00:00Z"
        },
        {
          title: "Onion mirror",
          url: "http://exampleabcd1234.onion/advisory",
          publishedAt: "2026-05-24T10:00:00Z"
        }
      ], {
        status: 200,
        headers: { "content-type": "application/json" }
      }, src.url)
    });

    const result = await adapter.collect(src, task(src));
    expect(result.items).toHaveLength(1);
    expect(result.warnings).toContain("suppressed 4 advisory records before capture");
    expect(result.metadata?.suppressedRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: "private_repo_advisory_path", unsafeUrlHash: expect.stringMatching(/^unsafe_url_hash:/) }),
      expect.objectContaining({ reason: "payload_or_download_affordance", unsafeUrlHash: expect.stringMatching(/^unsafe_url_hash:/) }),
      expect.objectContaining({ reason: "secret_bearing_url", unsafeUrlHash: expect.stringMatching(/^unsafe_url_hash:/) }),
      expect.objectContaining({ reason: "onion_link_forbidden", unsafeUrlHash: expect.stringMatching(/^unsafe_url_hash:/) })
    ]));
    const serialized = JSON.stringify(result.metadata);
    expect(serialized).not.toContain("GHSA-secret");
    expect(serialized).not.toContain("payload.bin");
    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain(".onion");
  });

  test("uses conditional requests and returns not_modified without emitting items", async () => {
    const src = source();
    const cache = new Map<string, { etag?: string; lastModified?: string }>();
    const adapter = new PublicAdvisoryAdapter({
      cache,
      fetcher: async (_input, init) => {
        expect(init?.headers).toMatchObject({ "if-none-match": "\"cached\"" });
        return responseFixture("", { status: 304 }, src.url);
      }
    });
    cache.set("https://api.github.com/advisories", { etag: "\"cached\"" });

    const result = await adapter.collect(src, task(src));
    expect(result.items).toEqual([]);
    expect(result.metadata).toMatchObject({
      adapter: "public_advisory",
      failureCategory: "not_modified",
      responseStatus: 304
    });
  });

  test("infers public advisory source families from registry hints", () => {
    expect(inferAdvisoryFamily(source({ name: "OSV GHSA", url: "https://api.github.com/advisories" }))).toBe("github_advisory");
    expect(inferAdvisoryFamily(source({ name: "Norwegian CERT", url: "https://cert.example.test/feed", tags: ["CERT"] }))).toBe("cert_government");
    expect(inferAdvisoryFamily(source({ name: "ThreatFox malware feed", url: "https://threatfox.abuse.ch/api/", tags: ["malware"] }))).toBe("malware_report_feed");
  });

  test("bridges captured advisory CollectedItems into ranked and correlated public signal records", async () => {
    const ghsa = source({
      id: "src_ghsa",
      name: "GitHub Security Advisories",
      url: "https://api.github.com/advisories",
      accessMethod: "official_api",
      tags: ["github", "GHSA", "APT29", "CVE-2026-4242"]
    });
    const cisa = source({
      id: "src_cisa_kev",
      name: "CISA KEV Catalog",
      url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
      accessMethod: "public_http",
      tags: ["CISA", "KEV", "government", "CVE-2026-4242"]
    });
    const adapter = new PublicAdvisoryAdapter({
      fetcher: async (input) => {
        const url = String(input);
        if (url.includes("api.github.com")) {
          return responseFixture([
            {
              ghsa_id: "GHSA-abcd-1234-wxyz",
              cve_id: "CVE-2026-4242",
              summary: "APT29 exploitation advisory for CVE-2026-4242",
              description: "Public advisory connecting APT29 exploitation activity to CVE-2026-4242 and mitigation guidance.",
              html_url: "https://github.com/advisories/GHSA-abcd-1234-wxyz",
              published_at: "2026-05-24T08:00:00Z",
              updated_at: "2026-05-24T09:00:00Z"
            }
          ], { status: 200, headers: { "content-type": "application/json" } }, ghsa.url);
        }
        return responseFixture({
          knownExploitedVulnerabilities: [
            {
              cveID: "CVE-2026-4242",
              vulnerabilityName: "APT29 exploited enterprise gateway vulnerability",
              dateAdded: "2026-05-24",
              notes: "Government advisory for CVE-2026-4242 exploitation affecting critical infrastructure."
            }
          ]
        }, { status: 200, headers: { "content-type": "application/json" } }, cisa.url);
      }
    });

    const ghsaItems = (await adapter.collect(ghsa, task(ghsa))).items;
    const cisaItems = (await adapter.collect(cisa, task(cisa))).items;
    const signals = publicAdvisoryItemsToSignalRecords([...ghsaItems, ...cisaItems], {
      sourceById: new Map([[ghsa.id, ghsa], [cisa.id, cisa]])
    });

    expect(signals).toHaveLength(2);
    expect(signals[0]?.family).toBe("github_advisory");
    expect(signals[0]?.matchedEntities?.actors).toContain("APT29");
    expect(signals[0]?.matchedEntities?.cves).toContain("CVE-2026-4242");
    expect(signals[0]?.provenance?.connector).toBe("github_security_advisory");
    expect(signals[0]?.provenance?.parserVersion).toBe("public-advisory-item-bridge-v1");
    expect(signals[0]?.policy?.publicOnly).toBe(true);
    expect(signals[0]?.policy?.privateRepo).toBe(false);
    expect(signals[0]?.policy?.exploitPayloadDownload).toBe(false);

    const connector = buildPublicAdvisorySignalConnector({
      query: "APT29 CVE-2026-4242",
      entityType: "actor",
      sources: [ghsa, cisa],
      signals,
      generatedAt: "2026-05-24T12:00:00.000Z"
    });
    expect(connector.status).toBe("ready");
    expect(connector.fastInitialSummary).toMatchObject({
      canAnswerImmediately: true,
      usefulSignalCount: 2
    });
    expect(connector.rankedSignals.map((signal) => signal.family)).toEqual(expect.arrayContaining(["github_advisory", "cert_government"]));

    const correlation = buildPublicAdvisoryCorrelation({
      query: "APT29 CVE-2026-4242",
      entityType: "actor",
      advisoryConnector: connector,
      publicSignalDeltas: connector.rankedSignals,
      generatedAt: "2026-05-24T12:00:00.000Z"
    });
    expect(correlation.status).toBe("needs_review");
    expect(correlation.correlatedEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entity: "APT29",
        sourceFamilies: expect.arrayContaining(["github_advisory", "cert_government"]),
        analystAction: "review_conflict",
        conflictTypes: expect.arrayContaining(["sector_country_ambiguity"])
      }),
      expect.objectContaining({
        entity: "CVE-2026-4242",
        sourceFamilies: expect.arrayContaining(["github_advisory", "cert_government"])
      })
    ]));
    expect(JSON.stringify(correlation)).not.toContain("private-repo");
    expect(correlation.guardrails).toMatchObject({
      publicOnly: true,
      noPrivateChannels: true,
      noUnsafeUrlsExposed: true
    });
  });

  test("builds live capture runtime packet across advisory RSS static HTML and report-index fixtures", async () => {
    const generatedAt = "2026-05-24T12:00:00.000Z";
    const ghsa = source({ id: "src_ghsa_runtime", url: "https://api.github.com/advisories", tags: ["github", "GHSA", "APT29"] });
    const cisa = source({ id: "src_cisa_runtime", name: "CISA KEV", url: "https://www.cisa.gov/kev.json", accessMethod: "public_http", tags: ["CISA", "KEV"] });
    const vendorAdvisory = source({ id: "src_vendor_advisory_runtime", name: "Vendor Advisory API", url: "https://vendor.example.test/advisories.json", accessMethod: "public_http", tags: ["vendor"] });
    const certHtml = source({ id: "src_cert_html_runtime", name: "National CERT HTML", type: "static_web", url: "https://cert.example.test/cve-2026-4242", accessMethod: "public_http", tags: ["CERT", "government"] });
    const vendorBlog = source({ id: "src_vendor_blog_runtime", name: "Vendor Blog", type: "static_web", url: "https://vendor.example.test/blog/apt29", accessMethod: "public_http", tags: ["vendor", "APT29"] });
    const rss = source({ id: "src_rss_runtime", name: "RSS Advisory Feed", type: "rss", url: "https://feeds.example.test/security.xml", accessMethod: "public_http", tags: ["rss"] });
    const reportIndex = source({ id: "src_report_index_runtime", name: "Report Index", type: "static_web", url: "https://reports.example.test/index", accessMethod: "public_http", tags: ["reports", "index"] });

    const advisoryAdapter = new PublicAdvisoryAdapter({
      fetcher: async (input) => {
        const url = String(input);
        if (url.includes("github")) {
          return responseFixture([{
            ghsa_id: "GHSA-abcd-1234-wxyz",
            cve_id: "CVE-2026-4242",
            summary: "APT29 GitHub advisory for CVE-2026-4242",
            description: "Public GHSA mitigation record with affected package and campaign context.",
            html_url: "https://github.com/advisories/GHSA-abcd-1234-wxyz",
            published_at: "2026-05-24T08:00:00Z"
          }], { status: 200, headers: { "content-type": "application/json" } }, url);
        }
        if (url.includes("cisa")) {
          return responseFixture({ knownExploitedVulnerabilities: [{
            cveID: "CVE-2024-3094",
            vulnerabilityName: "XZ Utils backdoor vulnerability",
            dateAdded: "2026-05-23",
            notes: "Government KEV entry for critical infrastructure defenders."
          }] }, { status: 200, headers: { "content-type": "application/json" } }, url);
        }
        return responseFixture([{
          title: "Vendor advisory for Akira ransomware healthcare targeting",
          description: "Public vendor advisory with mitigation and victim-sector context.",
          url: "https://vendor.example.test/advisories/akira-healthcare",
          publishedAt: "2026-05-22T00:00:00Z"
        }], { status: 200, headers: { "content-type": "application/json" } }, url);
      }
    });
    const staticAdapter = new StaticWebAdapter({
      checkRobots: false,
      fetcher: async (input) => {
        const url = String(input);
        const title = url.includes("cert") ? "CERT advisory CVE-2026-4242" : url.includes("reports") ? "Public report index" : "Vendor blog APT29 campaign";
        const body = `<html><head><link rel="canonical" href="${url}"><title>${title}</title></head><body><main>${title}. APT29 and CVE-2026-4242 mitigation details for government and healthcare defenders.</main><a href="/next">next</a></body></html>`;
        return responseFixture(body, { status: 200, headers: { "content-type": "text/html" } }, url);
      }
    });
    const rssAdapter = new RssAdapter({
      fetcher: async (input) => responseFixture(`<?xml version="1.0"?><rss><channel><item><title>RSS advisory CVE-2026-4242</title><link>https://feeds.example.test/items/cve-2026-4242</link><description>APT29 RSS item with mitigation context.</description><pubDate>Sun, 24 May 2026 09:00:00 GMT</pubDate></item></channel></rss>`, {
        status: 200,
        headers: { "content-type": "application/rss+xml" }
      }, String(input))
    });

    const captures = [
      { source: ghsa, adapter: "public_advisory" as const, result: await advisoryAdapter.collect(ghsa, task(ghsa)), queryClass: "cve_advisory" as const },
      { source: cisa, adapter: "public_advisory" as const, result: await advisoryAdapter.collect(cisa, task(cisa)), queryClass: "cve_advisory" as const },
      { source: vendorAdvisory, adapter: "public_advisory" as const, result: await advisoryAdapter.collect(vendorAdvisory, task(vendorAdvisory)), queryClass: "ransomware" as const },
      { source: certHtml, adapter: "static_html" as const, result: await staticAdapter.collect(certHtml, task(certHtml, { sourceType: "static_web" })), queryClass: "cve_advisory" as const },
      { source: vendorBlog, adapter: "static_html" as const, result: await staticAdapter.collect(vendorBlog, task(vendorBlog, { sourceType: "static_web" })), queryClass: "actor" as const },
      { source: rss, adapter: "rss_feed" as const, result: await rssAdapter.collect(rss, task(rss, { sourceType: "rss" })), queryClass: "cve_advisory" as const },
      { source: reportIndex, adapter: "report_index" as const, result: await staticAdapter.collect(reportIndex, task(reportIndex, { sourceType: "static_web" })), queryClass: "actor" as const }
    ];
    const packet = buildLiveCaptureRuntimePacket({ generatedAt, captures });

    expect(packet.schemaVersion).toBe("ti.live_capture_runtime_packet.v1");
    expect(packet.readyForEvidenceReplay).toBe(true);
    expect(packet.rows).toHaveLength(7);
    expect(packet.conformance.missingFixtureClasses).toEqual([]);
    expect(packet.observability).toMatchObject({ captured: 7, failed: 0, duplicate: 0 });
    expect(packet.rows.every((row) => row.replayId?.startsWith("evidence_replay_ref:"))).toBe(true);
    expect(packet.rows.every((row) => row.agent06Handoff.rawCaptureDescriptor.captureId.startsWith("capture_"))).toBe(true);
    expect(packet.rows.every((row) => row.agent06Handoff.textProjectionDescriptor.textHash?.startsWith("texthash:"))).toBe(true);
    expect(packet.sourcePackIntegration.agent01ReadySourceIds.length).toBe(7);
    expect(packet.sourcePackIntegration.agent02CadenceHints.every((hint) => hint.cadenceHint === "normal")).toBe(true);
    expect(packet.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["url", "rawText", "html", "objectKey"]));
    expect(packet.safety).toMatchObject({
      publicOnly: true,
      noPrivateGithubRepos: true,
      noAuthBypass: true,
      noPayloadDownloads: true,
      unsafeUrlExposed: false
    });
    expect(JSON.stringify(packet)).not.toContain("https://github.com/advisories");
    expect(JSON.stringify(packet)).not.toContain("<html>");

    const pdfReport = source({ id: "src_pdf_report_canary", name: "Vendor PDF Report", type: "pdf", url: "https://reports.example.test/apt29.pdf", accessMethod: "public_http", tags: ["report", "pdf"] });
    const unsupportedPdf = source({ id: "src_unsupported_mime_canary", name: "Unsupported Report", type: "pdf", url: "https://reports.example.test/file.bin", accessMethod: "public_http", tags: ["report"] });
    const hostile = source({ id: "src_hostile_link_canary", name: "Hostile Link Advisory", url: "https://vendor.example.test/hostile.json", accessMethod: "public_http", tags: ["vendor"] });
    const pdfText = "APT29 public report text layer for CVE-2026-4242 with enough context, mitigation, and citation spans for evidence replay.";
    const pdfItem: CollectedItem = {
      sourceId: pdfReport.id,
      taskId: "task_pdf_canary",
      url: "https://reports.example.test/apt29.pdf",
      collectedAt: generatedAt,
      publishedAt: "2026-05-24T07:00:00.000Z",
      title: "APT29 public PDF report",
      rawText: pdfText,
      contentHash: hashContent(pdfText),
      language: "en",
      links: [],
      metadata: {
        adapter: "pdf",
        extractionConfidence: 0.82,
        parserWarnings: [],
        citationSpans: [{ start: 0, end: 40, text: "APT29 public report text layer" }]
      },
      sensitive: false
    };
    const unsupportedResult: AdapterRunResult = {
      items: [],
      discovered: [],
      warnings: ["unsupported PDF media type application/octet-stream"],
      metadata: { failureCategory: "unsupported_media", contentType: "application/octet-stream", responseStatus: 200 }
    };
    const hostileResult: AdapterRunResult = {
      items: [],
      discovered: [],
      warnings: ["suppressed 1 advisory records before capture"],
      metadata: {
        suppressedRecords: [{ title: "payload link", reason: "payload_or_download_affordance", unsafeUrlHash: "unsafe_url_hash:test" }]
      }
    };
    const canary = buildLiveCaptureCanaryPacket({
      generatedAt,
      canaryPhase: "fixture_replay",
      captures: [
        ...captures,
        { source: pdfReport, adapter: "pdf_report", result: { items: [pdfItem], discovered: [], warnings: [], metadata: { contentType: "application/pdf", contentBytes: 1024 } }, queryClass: "actor" },
        { source: unsupportedPdf, adapter: "pdf_report", result: unsupportedResult, contentType: "application/octet-stream", queryClass: "actor" },
        { source: hostile, adapter: "public_advisory", result: hostileResult, queryClass: "actor" }
      ],
      sourceFamilyMinimums: { static_html: 3 }
    });

    expect(canary.schemaVersion).toBe("ti.live_capture_canary_packet.v1");
    expect(canary.disabledByDefault).toBe(true);
    expect(canary.safety).toMatchObject({
      willStartNetworkCollection: false,
      willMutateSources: false,
      willLeaseQueueWork: false,
      unsafeUrlExposed: false
    });
    expect(canary.conformance.missingFixtureClasses).toEqual([]);
    expect(canary.promotion.promoteSourceIds).toEqual(expect.arrayContaining(["src_ghsa_runtime", "src_pdf_report_canary"]));
    expect(canary.promotion.holdSourceIds).toEqual(expect.arrayContaining(["src_unsupported_mime_canary", "src_hostile_link_canary"]));
    expect(canary.parserRepairQueue).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "unsupported_mime", needed: true }),
      expect.objectContaining({ category: "unsafe_link_suppression", needed: true })
    ]));
    expect(canary.sourceFamilyShortages).toEqual([{ sourceFamily: "static_html", required: 3, observedPromotable: 2 }]);
    expect(canary.rows.every((row) => row.noLeakPolicyResult.passed && row.noLeakPolicyResult.rawContentExposed === false)).toBe(true);
    expect(canary.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["url", "rawText", "html", "objectKey"]));
    expect(JSON.stringify(canary)).not.toContain("https://reports.example.test/apt29.pdf");
    expect(JSON.stringify(canary)).not.toContain(pdfText);
  });
});
