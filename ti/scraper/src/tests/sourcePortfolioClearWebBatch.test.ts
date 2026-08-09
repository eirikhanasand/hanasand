import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_CANARY_SOURCE_PORTFOLIO } from "../ops/canaryPortfolio.ts";
import { importSeedBundle, seedDuplicateKey } from "../registry/sourceSeedsBundle.ts";
import { expandSourcePortfolioBatch } from "../registry/sourcePortfolioBatch.ts";
import { canonicalUrl } from "../registry/sourceSeedUtils.ts";

const batchPath = new URL("../../seeds/source_portfolio_clear_web.json", import.meta.url);
const seedDirectory = dirname(fileURLToPath(batchPath));
const rawBatch = JSON.parse(readFileSync(batchPath, "utf8"));
const batch = expandSourcePortfolioBatch(rawBatch);

describe("clear-web source portfolio batch", () => {
  test("contains only canonical executable feeds with complete verification metadata", () => {
    expect(batch).toMatchObject({
      schemaVersion: "ti.source_portfolio_batch.v1",
      family: "clear_web",
      version: 1,
    });
    expect(batch.sources).toHaveLength(115);
    expect(batch.exclusions).toHaveLength(151);

    const ids = new Set<string>();
    const endpoints = new Set<string>();
    for (const source of batch.sources) {
      const key = canonicalUrl(source.url);
      expect(new URL(source.url).hostname).toBe(new URL(source.url).hostname.toLowerCase());
      expect(new URL(source.url).hash).toBe("");
      expect(ids.has(source.id)).toBe(false);
      expect(endpoints.has(key)).toBe(false);
      ids.add(source.id);
      endpoints.add(key);

      expect(source).toMatchObject({
        type: "rss",
        accessMethod: "public_http",
        status: "active",
        risk: "low",
        governance: {
          approvalRequired: false,
          approvalState: "approved",
          approvalScope: "safe_public_auto",
          metadataOnly: false,
          policyVersion: "collection-policy:v1",
        },
        metadata: {
          productionCollection: true,
          sourceFamily: "clear_web",
          sourcePortfolioVerification: {
            outcome: "content_parsed",
            httpStatus: 200,
            adapter: "rss",
          },
        },
      });
      expect(source.name.trim().split(/\s+/).length).toBeGreaterThan(2);
      expect(source.legalNotes).toContain(source.name);
      expect(source.trustScore).toBeGreaterThanOrEqual(0.7);
      expect(source.crawlFrequencySeconds).toBeGreaterThanOrEqual(3600);
      expect(source.metadata.activityWindowSeconds).toBeGreaterThanOrEqual(source.crawlFrequencySeconds);
      expect(source.metadata.maxItemsPerFetch).toBeGreaterThan(0);
      expect(source.metadata.sourcePortfolioVerification.observedItemCount).toBeGreaterThan(0);
      expect(source.metadata.sourcePortfolioVerification.contentType).toMatch(/(?:rss|atom|xml)/i);
      expect(source.metadata.sourcePortfolioVerification.publisherReference).toMatch(/^https:\/\//);
      expect(Number.isFinite(Date.parse(source.metadata.sourcePortfolioVerification.latestPublishedAt))).toBe(true);
      expect(source.catalog.publisher.name).toBeTruthy();
      for (const prohibited of ["health", "lastSeenAt", "lastUsefulAt", "crawlState"]) {
        expect(Object.hasOwn(source, prohibited)).toBe(false);
      }
    }
  });

  test("keeps ledger 009 current and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["New Relic Security Bulletins", [42, "2026-05-08T00:00:00.000Z"]],
      ["SAS Security Bulletins", [24, "2026-07-09T04:00:00.000Z"]],
      ["Google Cloud Security Bulletins", [30, "2026-07-22T16:14:36.073Z"]],
      ["Google Kubernetes Engine Security Bulletins", [30, "2026-06-18T00:00:00.000Z"]],
      ["Google Apigee Security Bulletins", [7, "2026-06-24T08:48:38.749Z"]],
      ["Google Vertex AI Security Bulletins", [4, "2026-02-20T00:00:00.000Z"]],
      ["Google Agent Platform Security Bulletins", [2, "2025-10-22T17:03:06.093Z"]],
      ["Google Developer Connect Security Bulletins", [1, "2026-07-13T00:00:00.000Z"]],
      ["Google Compute Engine Security Bulletins", [30, "2026-06-09T18:38:16.410Z"]],
      ["Google Cloud Service Mesh Security Bulletins", [25, "2026-06-29T21:23:09.915Z"]],
      ["Google Confidential VM Security Bulletins", [7, "2026-04-14T23:41:36.964Z"]],
      ["Google Cloud VMware Engine Security Bulletins", [23, "2026-05-27T18:38:43.030Z"]],
    ] as const);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    for (const source of sources) {
      const [observedItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(source.url).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({ observedItemCount, latestPublishedAt });
      expect(Date.parse(batch.generatedAt) - Date.parse(latestPublishedAt)).toBeLessThanOrEqual(source.metadata.activityWindowSeconds * 1000);
      expect(source.metadata).not.toHaveProperty("countsAsCoverage");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioQualificationState");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioProductiveCheckCount");
    }
  });

  test("keeps ledger 010 current and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["Siemens ProductCERT Security Advisories", [150, "2026-07-23T00:00:00.000Z"]],
      ["Elastic Product Security Announcements", [25, "2026-07-21T23:08:36.000Z"]],
      ["CERT Polska English Security Publications", [100, "2026-07-22T13:55:00.000Z"]],
      ["JPCERT Coordination Center Threat Research", [15, "2026-07-23T02:32:28.000Z"]],
      ["Japan Vulnerability Notes Updates", [20, "2026-07-23T06:00:30.000Z"]],
      ["HashiCorp Product Security Updates", [25, "2026-07-08T20:18:59.000Z"]],
    ] as const);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    for (const source of sources) {
      const [observedItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(source.url).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({ observedItemCount, latestPublishedAt });
      expect(Date.parse(batch.generatedAt) - Date.parse(latestPublishedAt)).toBeLessThanOrEqual(source.metadata.activityWindowSeconds * 1000);
      expect(source.metadata).not.toHaveProperty("countsAsCoverage");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioQualificationState");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioProductiveCheckCount");
    }
  });

  test("keeps ledger 011 current and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["Fortinet Threat Research Blog", [10, "2026-07-22T13:00:00.000Z"]],
      ["Canadian Centre for Cyber Security Alerts and Advisories", [50, "2026-07-24T19:38:17.000Z"]],
      ["Ireland NCSC Security Alerts", [225, "2026-07-22T00:00:00.000Z"]],
      ["CERT.at Security Warnings", [50, "2026-07-20T09:01:31.000Z"]],
    ] as const);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    for (const source of sources) {
      const [observedItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(source.url).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({ observedItemCount, latestPublishedAt });
      expect(Date.parse(batch.generatedAt) - Date.parse(latestPublishedAt)).toBeLessThanOrEqual(source.metadata.activityWindowSeconds * 1000);
      expect(source.metadata).not.toHaveProperty("countsAsCoverage");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioQualificationState");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioProductiveCheckCount");
    }
  });

  test("keeps ledger 012 parser-useful and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["National Cyber Security Centre Finland English Updates", [250, 250, 5, 2, "2026-07-23T08:15:10.000Z"]],
      ["CERT Polska Polish Security Publications", [100, 100, 100, 95, "2026-08-08T17:00:00.000Z"]],
      ["JPCERT Coordination Center Japanese Threat Research", [15, 15, 12, 1, "2026-08-07T06:28:06.000Z"]],
      ["Norway NSM Vulnerability Alerts", [10, 10, 10, 6, "2026-07-14T21:11:10.000Z"]],
      ["Qubes OS Security News", [10, 10, 10, 4, "2026-07-28T00:00:00.000Z"]],
    ] as const);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    for (const source of sources) {
      const [observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(canonicalUrl(source.url)).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({
        observedItemCount,
        datedItemCount,
        currentItemCount,
        keywordUsefulItemCount,
        latestPublishedAt,
      });
      expect(currentItemCount).toBeGreaterThan(0);
      expect(keywordUsefulItemCount).toBeGreaterThan(0);
      expect(Date.parse(batch.generatedAt) - Date.parse(latestPublishedAt)).toBeLessThanOrEqual(source.metadata.activityWindowSeconds * 1000);
      expect(source.metadata).not.toHaveProperty("countsAsCoverage");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioQualificationState");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioProductiveCheckCount");
    }
  });

  test("keeps ledger 013 current, source-tolerant, and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["Center for Internet Security Current Vulnerability Advisories", [50, 50, 50, 50, "2026-08-07T03:22:07.000Z"]],
      ["CERT@VDE Industrial Product Security Advisories", [150, 150, 80, 65, "2026-08-07T10:00:00.000Z"]],
      ["Centre for Cybersecurity Belgium Critical Advisories", [10, 10, 10, 10, "2026-08-07T14:02:31.000Z"]],
      ["CERT.at English Cyber Security Analysis", [50, 50, 5, 3, "2026-06-01T13:21:06.000Z"]],
      ["Croatia National CERT Security Warnings", [10, 10, 10, 2, "2026-07-06T08:29:47.000Z"]],
      ["Danish DKCERT Threat and Vulnerability News", [10, 10, 10, 10, "2026-07-17T11:55:43.000Z"]],
      ["Hong Kong GovCERT Security Alerts", [150, 150, 150, 150, "2026-08-07T04:00:00.000Z"]],
      ["Italian National Cybersecurity Agency Security Updates", [50, 50, 50, 2, "2026-08-07T14:52:07.000Z"]],
      ["JPCERT Coordination Center English Security Alerts", [6, 6, 6, 3, "2026-07-31T09:00:00.000Z"]],
      ["Slovenian SI-CERT Security News", [10, 10, 4, 2, "2026-05-29T07:16:33.000Z"]],
      ["Spain INCIBE-CERT Early Warning Advisories", [10, 10, 10, 10, "2026-07-30T09:10:46.000Z"]],
      ["Swiss NCSC Cyber Threat News", [94, 94, 6, 2, "2026-05-20T00:00:00.000Z"]],
      ["NCSC Netherlands Current Cybersecurity News", [100, 100, 53, 31, "2026-08-07T14:04:56.000Z"]],
      ["Czech NUKIB Cyber Threat Warnings", [15, 15, 6, 0, "2026-08-07T08:59:00.000Z"]],
      ["Estonian RIA Cyber Incident and Threat Updates", [100, 100, 33, 0, "2026-08-05T07:12:56.000Z"]],
      ["Romanian DNSC Cybersecurity Alerts", [10, 10, 10, 0, "2026-08-06T11:58:29.000Z"]],
      ["Oracle Product Security Alerts and Patch Updates", [127, 127, 6, 0, "2026-07-21T19:30:54.000Z"]],
    ] as const);
    const sourceTolerant = new Set([
      "Czech NUKIB Cyber Threat Warnings",
      "Estonian RIA Cyber Incident and Threat Updates",
      "Romanian DNSC Cybersecurity Alerts",
      "Oracle Product Security Alerts and Patch Updates",
    ]);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    for (const source of sources) {
      const [observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(canonicalUrl(source.url)).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({
        observedItemCount,
        datedItemCount,
        currentItemCount,
        keywordUsefulItemCount,
        latestPublishedAt,
      });
      expect(currentItemCount).toBeGreaterThan(0);
      if (sourceTolerant.has(source.name)) expect(keywordUsefulItemCount).toBe(0);
      else expect(keywordUsefulItemCount).toBeGreaterThan(0);
      expect(Date.parse(batch.generatedAt) - Date.parse(latestPublishedAt)).toBeLessThanOrEqual(source.metadata.activityWindowSeconds * 1000);
      expect(source.metadata).not.toHaveProperty("countsAsCoverage");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioQualificationState");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioProductiveCheckCount");
    }
  });

  test("keeps ledger 014 production-parser-positive and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["Joomla Security Announcements", [25, 25, 25, 25, "2026-07-07T14:00:01.000Z"]],
      ["Spring Security Advisories", [50, 50, 50, 5, "2026-07-29T00:00:00.000Z"]],
      ["Splunk Product Security Advisories", [30, 30, 30, 26, "2026-07-15T00:00:00.000Z"]],
      ["Microsoft Security Response Center Update Guide", [150, 150, 150, 73, "2026-08-09T08:43:45.000Z"]],
      ["Google Threat Intelligence Research", [20, 20, 20, 14, "2026-08-06T14:00:00.000Z"]],
      ["Trend Micro Security Research", [50, 50, 50, 35, "2026-07-30T00:00:00.000Z"]],
      ["Quarkslab Security Research", [15, 15, 15, 4, "2026-07-05T22:00:00.000Z"]],
      ["Ruby Language Security and Release News", [10, 10, 10, 2, "2026-07-16T05:08:11.000Z"]],
      ["Rust Project Release and Security News", [10, 10, 10, 3, "2026-08-04T00:00:00.000Z"]],
      ["JetBrains Security Research", [12, 12, 1, 0, "2026-06-17T16:11:49.000Z"]],
      ["OpenJS Foundation CNA Security Advisories", [72, 72, 68, 1, "2026-08-03T00:00:00.000Z"]],
      ["Wireshark Release and Security Announcements", [20, 20, 7, 0, "2026-07-08T22:11:39.000Z"]],
      ["Ruby on Rails Security Announcements", [25, 25, 14, 10, "2026-07-31T00:51:48.000Z"]],
      ["Django Project Release and Security News", [10, 10, 10, 2, "2026-08-06T14:45:00.000Z"]],
      ["Drupal Public Security Announcements", [20, 20, 2, 0, "2026-07-22T17:59:58.000Z"]],
      ["Tenable Security Research Advisories", [10, 10, 10, 6, "2026-07-29T06:40:54.000Z"]],
      ["Tenable Product Security Advisories", [10, 10, 10, 10, "2026-08-03T14:57:09.000Z"]],
    ] as const);
    const sourceTolerant = new Set([
      "JetBrains Security Research",
      "Wireshark Release and Security Announcements",
      "Drupal Public Security Announcements",
    ]);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    const totals = { parsed: 0, dated: 0, current: 0, useful: 0 };
    for (const source of sources) {
      const [observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(canonicalUrl(source.url)).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({
        observedItemCount,
        datedItemCount,
        currentItemCount,
        keywordUsefulItemCount,
        latestPublishedAt,
      });
      expect(currentItemCount).toBeGreaterThan(0);
      if (sourceTolerant.has(source.name)) expect(keywordUsefulItemCount).toBe(0);
      else expect(keywordUsefulItemCount).toBeGreaterThan(0);
      expect(Date.parse(batch.generatedAt) - Date.parse(latestPublishedAt)).toBeLessThanOrEqual(source.metadata.activityWindowSeconds * 1000);
      expect(source.metadata).not.toHaveProperty("countsAsCoverage");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioQualificationState");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioProductiveCheckCount");
      totals.parsed += observedItemCount;
      totals.dated += datedItemCount;
      totals.current += currentItemCount;
      totals.useful += keywordUsefulItemCount;
    }
    expect(totals).toEqual({ parsed: 539, dated: 539, current: 482, useful: 216 });
  });

  test("keeps ledger 015 production-parser-positive and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["K7 Computing Malware Research", [1, 1, 1, 1, "2026-08-03T07:13:40.000Z"]],
      ["Rapid7 Emergent Threat Response", [20, 20, 20, 19, "2026-08-07T14:32:47.000Z"]],
      ["Rapid7 Security Research", [20, 20, 20, 13, "2026-07-22T13:28:02.000Z"]],
      ["Aqua Nautilus Threat Research", [10, 10, 1, 1, "2026-08-04T15:02:02.000Z"]],
      ["Wiz Cloud Security Research", [250, 250, 129, 38, "2026-08-06T14:03:03.000Z"]],
      ["eSentire Security Advisories", [250, 250, 24, 22, "2026-08-04T04:00:00.000Z"]],
      ["ABB Product Security Advisories", [88, 88, 21, 21, "2026-07-30T01:35:00.000Z"]],
      ["Red Hat Security Advisories", [41, 41, 41, 37, "2026-08-07T18:53:06.000Z"]],
      ["Nozomi Networks Product Security Advisories", [59, 59, 16, 0, "2026-07-07T00:00:00.000Z"]],
      ["ConnectWise Trust Security Advisories", [21, 21, 1, 0, "2026-03-17T04:00:00.000Z"]],
      ["ConnectWise Product Security Bulletins", [41, 41, 3, 0, "2026-05-20T04:00:00.000Z"]],
      ["RaptX Independent Security Research", [30, 30, 17, 6, "2026-03-28T00:00:00.000Z"]],
      ["Rockwell Automation Product Security Advisories", [60, 60, 21, 9, "2026-07-30T15:21:00.000Z"]],
      ["Bosch Product Security Advisories", [10, 10, 3, 3, "2026-07-30T00:00:00.000Z"]],
      ["Fortinet Outbreak Alert Reports", [20, 20, 14, 14, "2026-08-07T07:00:00.000Z"]],
      ["Fortinet Threat Signal Reports", [10, 10, 10, 10, "2026-07-30T04:33:51.000Z"]],
      ["Veeam Product Security Advisories", [20, 20, 12, 7, "2026-08-04T00:00:00.000Z"]],
      ["Datadog Security Labs Research", [30, 30, 30, 19, "2026-08-04T00:00:00.000Z"]],
      ["Lithuania NCSC Cybersecurity News", [30, 30, 14, 0, "2026-07-13T10:11:16.000Z"]],
      ["TYPO3 Product Security Advisories", [30, 30, 25, 1, "2026-07-14T10:00:00.000Z"]],
    ] as const);
    const sourceTolerant = new Set([
      "Nozomi Networks Product Security Advisories",
      "ConnectWise Trust Security Advisories",
      "ConnectWise Product Security Bulletins",
      "Lithuania NCSC Cybersecurity News",
    ]);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    const totals = { parsed: 0, dated: 0, current: 0, useful: 0 };
    for (const source of sources) {
      const [observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(canonicalUrl(source.url)).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({
        observedItemCount,
        datedItemCount,
        currentItemCount,
        keywordUsefulItemCount,
        latestPublishedAt,
      });
      expect(currentItemCount).toBeGreaterThan(0);
      if (sourceTolerant.has(source.name)) expect(keywordUsefulItemCount).toBe(0);
      else expect(keywordUsefulItemCount).toBeGreaterThan(0);
      expect(Date.parse(batch.generatedAt) - Date.parse(latestPublishedAt)).toBeLessThanOrEqual(source.metadata.activityWindowSeconds * 1000);
      expect(source.metadata).not.toHaveProperty("countsAsCoverage");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioQualificationState");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioProductiveCheckCount");
      totals.parsed += observedItemCount;
      totals.dated += datedItemCount;
      totals.current += currentItemCount;
      totals.useful += keywordUsefulItemCount;
    }
    expect(totals).toEqual({ parsed: 1041, dated: 1041, current: 423, useful: 221 });
  });

  test("keeps ledger 016 current, collision-free, and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["Moxa Product Security Advisories", [200, 200, 13, 11, "2026-07-24T18:36:34.000Z"]],
      ["Qualys Security Research Blog", [10, 10, 10, 9, "2026-08-03T16:00:49.000Z"]],
      ["Akamai Security and Threat Research", [249, 249, 138, 20, "2026-08-07T13:00:00.000Z"]],
      ["Cloudflare Security Research Blog", [20, 20, 20, 6, "2026-07-09T14:00:00.000Z"]],
      ["Permiso Cloud Identity Threat Research", [10, 10, 10, 3, "2026-07-09T12:27:17.000Z"]],
      ["Cloudflare WAF Vulnerability Mitigation Updates", [106, 106, 28, 24, "2026-08-04T00:00:00.000Z"]],
      ["Cloudflare Security Center Threat Intelligence Updates", [24, 24, 14, 6, "2026-06-10T00:00:00.000Z"]],
      ["Mitsubishi Electric Product Security Advisories", [5, 5, 5, 5, "2026-07-30T03:00:00.000Z"]],
      ["New Zealand NCSC Cybersecurity News", [53, 53, 7, 4, "2026-08-03T21:00:00.000Z"]],
      ["Latvia CERT Cybersecurity and Threat Updates", [20, 20, 6, 1, "2026-06-26T06:42:59.000Z"]],
      ["Finland NCSC Information Security Now", [193, 193, 17, 6, "2026-08-07T06:41:36.000Z"]],
      ["Estonia RIA English Cybersecurity Updates", [100, 100, 14, 4, "2026-08-06T07:06:50.000Z"]],
      ["Slovenia SI-CERT Cybersecurity Alerts", [10, 10, 10, 2, "2026-07-21T09:01:13.000Z"]],
      ["Spain INCIBE-CERT Spanish Security Advisories", [10, 10, 10, 10, "2026-08-07T08:43:09.000Z"]],
      ["Italy CERT-AGID Public Cyber Threat Reports", [10, 10, 10, 4, "2026-08-08T09:53:12.000Z"]],
      ["Bulgaria Government CERT Cybersecurity Alerts", [10, 10, 6, 1, "2026-07-21T08:17:53.000Z"]],
      ["ThaiCERT Cybersecurity Advisories", [10, 10, 10, 2, "2026-08-07T09:34:02.000Z"]],
      ["Paraguay CERT-PY Cybersecurity Advisories", [70, 70, 70, 70, "2026-08-07T17:33:47.000Z"]],
    ] as const);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    const totals = { parsed: 0, dated: 0, current: 0, useful: 0 };
    for (const source of sources) {
      const [observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(canonicalUrl(source.url)).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({ observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt });
      expect(currentItemCount).toBeGreaterThan(0);
      expect(keywordUsefulItemCount).toBeGreaterThan(0);
      expect(Date.parse(batch.generatedAt) - Date.parse(latestPublishedAt)).toBeLessThanOrEqual(source.metadata.activityWindowSeconds * 1000);
      expect(source.metadata).not.toHaveProperty("countsAsCoverage");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioQualificationState");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioProductiveCheckCount");
      totals.parsed += observedItemCount;
      totals.dated += datedItemCount;
      totals.current += currentItemCount;
      totals.useful += keywordUsefulItemCount;
    }
    expect(totals).toEqual({ parsed: 1110, dated: 1110, current: 398, useful: 188 });

    const exclusions = new Map(batch.exclusions.map((entry: any) => [entry.idOrUrlHash, entry.reason]));
    expect(exclusions.get(hash(canonicalUrl("https://www.crowdstrike.com/blog/feed/")).slice(0, 24))).toBe("redirected_to_duplicate_canonical_endpoint");
    expect(exclusions.get(hash(canonicalUrl("https://cert.lv/en/rss/news.xml")).slice(0, 24))).toBe("duplicate_publisher_feed_content");
    expect(exclusions.get(hash(canonicalUrl("https://developers.cloudflare.com/changelog/rss/application-security.xml")).slice(0, 24))).toBe("duplicate_publisher_feed_content");
    expect(batch.sources.some((source: any) => canonicalUrl(source.url) === canonicalUrl("https://www.crowdstrike.com/en-us/blog/feed"))).toBe(false);

    const certAgid = sources.find((source: any) => source.name === "Italy CERT-AGID Public Cyber Threat Reports");
    expect(certAgid.legalNotes).toContain("public unauthenticated website RSS feed");
    expect(certAgid.legalNotes).toContain("does not access or redistribute CERT-AGID's restricted tokenized IoC service");
  });

  test("deduplicates by normalized endpoint across adapters and every reserved source pack", () => {
    const reserved = new Set<string>();
    for (const file of readdirSync(seedDirectory).filter((name) => name.endsWith(".json") && name !== basename(fileURLToPath(batchPath)))) {
      visit(JSON.parse(readFileSync(join(seedDirectory, file), "utf8")), (value) => {
        if (value && typeof value === "object" && typeof value.url === "string") reserved.add(canonicalUrl(value.url));
      });
    }
    for (const source of PUBLIC_CANARY_SOURCE_PORTFOLIO) reserved.add(canonicalUrl(source.url));

    for (const source of batch.sources) expect(reserved.has(seedDuplicateKey(source))).toBe(false);
    expect(canonicalUrl("https://EXAMPLE.test/feed/#fragment")).toBe(canonicalUrl("https://example.test/feed"));

    const certFr = batch.sources.find((source: any) => source.name === "CERT-FR Immediate Security Alerts");
    expect(certFr.url).toBe("https://www.cert.ssi.gouv.fr/alerte/feed/");
    expect(seedDuplicateKey(certFr)).toBe(canonicalUrl("https://www.cert.ssi.gouv.fr/alerte/feed"));
    const imported = importSeedBundle(batch, { importedAt: batch.generatedAt }).accepted.find((source: any) => source.id === certFr.id);
    expect(imported.url).toBe(certFr.url);
  });

  test("keeps exclusions locator-safe and distinct from accepted feeds", () => {
    const acceptedHashes = new Set(batch.sources.map((source: any) => hash(canonicalUrl(source.url)).slice(0, 24)));
    for (const exclusion of batch.exclusions) {
      expect(Object.keys(exclusion).sort()).toEqual(["idOrUrlHash", "reason", "verifiedAt"]);
      expect(exclusion.idOrUrlHash).toMatch(/^[a-f0-9]{24}$/);
      expect(exclusion.reason).toMatch(/^[a-z0-9_]+$/);
      expect(Number.isFinite(Date.parse(exclusion.verifiedAt))).toBe(true);
      expect(Date.parse(exclusion.verifiedAt)).toBeLessThanOrEqual(Date.parse(batch.generatedAt));
      expect(acceptedHashes.has(exclusion.idOrUrlHash)).toBe(false);
      expect(JSON.stringify(exclusion)).not.toMatch(/https?:\/\/|\.onion\b|token|credential/i);
    }
  });
});

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function visit(value: unknown, callback: (value: any) => void): void {
  callback(value);
  if (Array.isArray(value)) value.forEach((item) => visit(item, callback));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => visit(item, callback));
}
