import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_CANARY_SOURCE_PORTFOLIO } from "../ops/canaryPortfolio.ts";
import { importSeedBundle, seedDuplicateKey } from "../registry/sourceSeedsBundle.ts";
import { expandSourcePortfolioBatch, validateSourcePortfolioBatch } from "../registry/sourcePortfolioBatch.ts";
import { canonicalUrl } from "../registry/sourceSeedUtils.ts";
import { hasThreatTerm } from "../value/sellableIntel.ts";

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
    expect(batch.sources).toHaveLength(302);
    expect(batch.exclusions).toHaveLength(317);

    const generatedAt = Date.parse(rawBatch.generatedAt);
    const evidenceTimes = [
      ...batch.sources.flatMap((source: any) => [source.metadata.sourcePortfolioVerification.verifiedAt, source.metadata.sourcePortfolioVerification.legalBasisVerifiedAt]),
      ...batch.exclusions.map((exclusion: any) => exclusion.verifiedAt),
    ].map(Date.parse);
    expect(Math.max(...evidenceTimes)).toBeLessThanOrEqual(generatedAt);
    expect(validateSourcePortfolioBatch(rawBatch, new Date().toISOString())).toEqual({ recognized: true, valid: true, errors: [] });

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

  test("keeps ledger 017 current, source-tolerant, and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["SICK PSIRT Advisories", [68, 68, 9, 9, "2026-07-28T15:00:00+01:00"]],
      ["Jenkins Security Advisories", [101, 101, 7, 0, "Wed, 5 Aug 2026 12:00:00 +0000"]],
      ["WordPress Security News", [10, 10, 4, 0, "Thu, 06 Aug 2026 18:55:30 +0000"]],
      ["Debian Security Advisories", [29, 29, 29, 16, "2026-08-08"]],
      ["Debian LTS Security Advisories", [30, 30, 30, 23, "2026-08-07"]],
      ["Grafana Security Advisories", [10, 10, 10, 4, "Wed, 22 Jul 2026 00:00:00 +0000"]],
      ["F5 Labs Threat Research", [250, 250, 15, 7, "Sat, 08 Aug 2026 00:42:00 GMT"]],
      ["North Macedonia MKD-CIRT Cybersecurity Alerts", [10, 10, 10, 3, "Fri, 31 Jul 2026 10:15:46 +0000"]],
      ["Denmark SAMSIK Cybersecurity Advisories", [10, 10, 10, 0, "Wed, 08 Jul 2026 11:05:10 +0000"]],
      ["Okta Security Research", [85, 85, 4, 2, "Mon, 03 Aug 2026 00:00:00 GMT"]],
      ["IRONSCALES Threat Intelligence", [50, 50, 50, 37, "Sun, 09 Aug 2026 11:00:00 GMT"]],
      ["Kubernetes Official CVE Feed", [91, 91, 4, 0, "Fri, 10 Apr 2026 17:54:42 +0000"]],
      ["PostgreSQL Security News", [10, 10, 7, 4, "Mon, 06 Jul 2026 00:00:00 +0000"]],
      ["Rocky Linux Errata", [20, 20, 20, 20, "Sat, 08 Aug 2026 00:07:50 +0000"]],
      ["AlmaLinux Security Announcements", [30, 30, 30, 2, "Fri, 07 Aug 2026 17:00:06 +0000"]],
      ["SonicWall PSIRT Security Advisories", [215, 215, 7, 7, "Thu, 06 Aug 2026 19:51:21 +0000"]],
      ["TWCERT/CC Vulnerability Notes", [20, 20, 20, 20, "Fri, 31 Jul 2026 05:46:00 GMT"]],
      ["KISA KrCERT Security Notices", [10, 10, 10, 0, "2026-08-07"]],
      ["KISA Vulnerability Information", [10, 10, 2, 2, "2026-02-27"]],
      ["KISA Reports and Guides", [10, 10, 10, 0, "2026-07-30"]],
      ["CERT.at Daily Cybersecurity Reports", [50, 50, 50, 47, "Fri, 07 Aug 2026 17:27:30 GMT+0100"]],
      ["CERT.at Current Cybersecurity Incidents", [50, 50, 11, 5, "Fri, 24 Jul 2026 13:14:46 GMT+0100"]],
      ["CERT.at Threat Research Blog", [50, 50, 2, 1, "Thu, 18 Jun 2026 12:51:21 GMT+0100"]],
      ["AusCERT Security Bulletins", [100, 100, 100, 0, "Fri, 07 Aug 2026 01:59:08 +0000"]],
      ["Estonia RIA/CERT-EE News", [100, 100, 33, 0, "Wed, 05 Aug 2026 10:12:56 +0300"]],
      ["Romania DNSC Alerts and News", [10, 10, 10, 0, "Thu, 06 Aug 2026 14:58:29 +0300"]],
      ["Citizen Lab Targeted Threat Research", [10, 10, 10, 4, "Fri, 07 Aug 2026 15:22:13 +0000"]],
      ["Bitdefender Labs Threat Research", [15, 15, 10, 6, "Mon, 03 Aug 2026 12:51:24 GMT"]],
      ["MongoDB Security Alerts", [172, 172, 72, 10, "Wed, 22 Jul 2026 19:23:17 GMT"]],
    ] as const);
    const sourceTolerant = new Set([
      "Jenkins Security Advisories",
      "WordPress Security News",
      "Denmark SAMSIK Cybersecurity Advisories",
      "Kubernetes Official CVE Feed",
      "KISA KrCERT Security Notices",
      "KISA Reports and Guides",
      "AusCERT Security Bulletins",
      "Estonia RIA/CERT-EE News",
      "Romania DNSC Alerts and News",
    ]);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    const totals = { parsed: 0, dated: 0, current: 0, useful: 0 };
    for (const source of sources) {
      const [observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(canonicalUrl(source.url)).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({ observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt });
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
    expect(totals).toEqual({ parsed: 1626, dated: 1626, current: 586, useful: 229 });

    const exclusions = new Map(batch.exclusions.map((entry: any) => [entry.idOrUrlHash, entry.reason]));
    for (const source of sources) expect(exclusions.has(hash(canonicalUrl(source.url)).slice(0, 24))).toBe(false);
    expect(exclusions.get(hash(canonicalUrl("https://developer.apple.com/news/releases/rss/releases.rss")).slice(0, 24))).toBe("product_release_feed_not_security_intelligence");
    expect(exclusions.get(hash(canonicalUrl("https://www.cisa.gov/uscert/ncas/all.xml")).slice(0, 24))).toBe("duplicate_publisher_feed_content");
    expect(exclusions.get(hash(canonicalUrl("https://security.archlinux.org/issues/all.json")).slice(0, 24))).toBe("parser_missing_published_timestamp");

    const auscert = sources.find((source: any) => source.name === "AusCERT Security Bulletins");
    expect(auscert.legalNotes).toContain("public unauthenticated RSS response");
    expect(auscert.legalNotes).toContain("does not access member-only portal content");
  });

  test("keeps ledger 018 production-parser-positive and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["Arctic Wolf Labs Security Research", [10, 10, 10, 7, "Thu, 06 Aug 2026 23:15:55 +0000"]],
      ["Netskope Threat Labs Research", [10, 10, 10, 5, "Thu, 06 Aug 2026 11:36:05 +0000"]],
      ["Seqrite Labs Malware Research", [10, 10, 10, 8, "Mon, 03 Aug 2026 10:32:04 +0000"]],
      ["Python Security Announcements", [30, 30, 30, 30, "Wed, 29 Jul 2026 18:35:14 +0000"]],
      ["Socket Software Supply Chain Research", [10, 10, 10, 6, "2026-08-07T06:49:17.320Z"]],
      ["StepSecurity Software Supply Chain Research", [100, 100, 97, 64, "Tue, 04 Aug 2026 20:33:23 GMT"]],
      ["Chainguard Software Supply Chain Research", [246, 246, 97, 32, "Tue, 04 Aug 2026 00:00:00 GMT"]],
      ["GitGuardian Secrets Security Research", [15, 15, 15, 10, "Fri, 07 Aug 2026 13:09:44 GMT"]],
      ["Wallarm API Threat Research", [10, 10, 10, 2, "Mon, 27 Jul 2026 19:57:27 +0000"]],
      ["Endor Labs Software Supply Chain Research", [100, 100, 100, 24, "Tue, 04 Aug 2026 23:05:06 GMT"]],
      ["Legit Security Application Security Research", [10, 10, 10, 1, "Wed, 05 Aug 2026 23:50:27 GMT"]],
      ["Semgrep Application Security Research", [250, 250, 61, 24, "Tue, 04 Aug 26 00:00:00 +0000"]],
      ["Praetorian Offensive Security Research", [10, 10, 10, 3, "Fri, 10 Jul 2026 20:27:03 +0000"]],
      ["Include Security Vulnerability Research", [10, 10, 3, 1, "Fri, 05 Jun 2026 16:01:11 +0000"]],
      ["Pen Test Partners Security Research", [10, 10, 10, 3, "Fri, 07 Aug 2026 11:38:33 +0000"]],
      ["Bishop Fox Security Research", [50, 50, 42, 7, "Fri, 31 Jul 2026 06:00:00 -0700"]],
      ["Horizon3 Attack Research", [10, 10, 5, 2, "Fri, 12 Jun 2026 15:38:26 +0000"]],
      ["VulnCheck Exploitation Intelligence Research", [179, 179, 26, 16, "2026-08-05T00:00:00.000Z"]],
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
    expect(totals).toEqual({ parsed: 1070, dated: 1070, current: 556, useful: 245 });

    expect(sources.find((source: any) => source.name === "Semgrep Application Security Research").url).toBe("https://semgrep.dev/blog/rss/");
    expect(sources.find((source: any) => source.name === "Bishop Fox Security Research").url).toBe("https://bishopfox.com/feeds/blog.rss");
    const exclusions = new Map(batch.exclusions.map((entry: any) => [entry.idOrUrlHash, entry.reason]));
    expect(exclusions.get(hash(canonicalUrl("https://blog.talosintelligence.com/rss/")).slice(0, 24))).toBe("response_exceeds_max_bytes");
    expect(exclusions.get(hash(canonicalUrl("https://securitylab.github.com/feed.xml")).slice(0, 24))).toBe("parser_zero_items");
    expect(exclusions.get(hash(canonicalUrl("https://www.php.net/releases/feed.php")).slice(0, 24))).toBe("product_release_feed_not_security_intelligence");
  });

  test("keeps ledger 019 current, source-tolerant, and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["S2 Grupo Lab52 Threat Intelligence Research", [6, 6, 6, 4, "Fri, 03 Jul 2026 17:28:57 +0000"]],
      ["Morphisec Threat Research", [20, 20, 6, 4, "Tue, 16 Jun 2026 13:00:00 +0000"]],
      ["HP Wolf Security Threat Research", [5, 5, 5, 4, "Thu, 11 Jun 2026 07:00:05 +0000"]],
      ["Emsisoft Ransomware and Malware Research", [12, 12, 12, 9, "Tue, 21 Jul 2026 11:39:54 +0000"]],
      ["IOActive Cybersecurity Research", [10, 10, 10, 6, "Thu, 06 Aug 2026 20:12:18 +0000"]],
      ["Pentera Adversarial Exposure Research", [12, 12, 8, 2, "Thu, 30 Jul 2026 07:33:17 +0000"]],
      ["XM Cyber Exposure Research", [10, 10, 10, 6, "Thu, 30 Jul 2026 12:51:55 +0000"]],
      ["Compass Security Vulnerability Research", [10, 10, 10, 2, "Tue, 04 Aug 2026 07:00:00 +0000"]],
      ["SCRT Offensive Security Research", [10, 10, 2, 2, "Tue, 21 Apr 2026 12:47:26 +0000"]],
      ["TrustedSec Threat Hunting and Vulnerability Research", [10, 10, 10, 1, "Thu, 06 Aug 2026 00:00:00 -0400"]],
      ["QNAP Product Security Advisories", [20, 20, 16, 16, "Wed, 17 Jun 2026 00:00:00 +0800"]],
      ["Qt Product Security Advisories", [10, 10, 6, 5, "Thu, 23 Jul 2026 12:27:55 GMT"]],
      ["Node.js Security and Release News", [250, 250, 43, 1, "Wed, 05 Aug 2026 16:25:55 GMT"]],
      ["ownCloud Product Security Advisories", [10, 10, 1, 1, "Sat, 28 Mar 2026 10:42:15 +0000"]],
      ["Uzbekistan UZCERT Cybersecurity Advisories", [10, 10, 10, 3, "Fri, 07 Aug 2026 08:28:00 +0000"]],
      ["Albania AKSK Cybersecurity Advisories", [10, 10, 10, 0, "Tue, 04 Aug 2026 11:32:33 +0000"]],
      ["Germany CERT-Bund Security Advisories", [250, 250, 250, 0, "Fri, 07 Aug 2026 11:26:06 GMT"]],
      ["Trinidad and Tobago TT-CSIRT Security Advisories", [10, 10, 10, 6, "Tue, 21 Jul 2026 17:20:54 +0000"]],
    ] as const);
    const sourceTolerant = new Set([
      "Albania AKSK Cybersecurity Advisories",
      "Germany CERT-Bund Security Advisories",
    ]);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    const totals = { parsed: 0, dated: 0, current: 0, useful: 0 };
    for (const source of sources) {
      const [observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(canonicalUrl(source.url)).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({ observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt });
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
    expect(totals).toEqual({ parsed: 675, dated: 675, current: 425, useful: 72 });
  });

  test("keeps ledger 020 current, source-tolerant, and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["VMware Security Research Blog", [10, 10, 10, 4, "Thu, 06 Aug 2026 12:57:51 +0000"]],
      ["Binarly Firmware Security Research", [83, 83, 8, 6, "Thu, 06 Aug 2026 04:46:28 GMT"]],
      ["Exodus Intelligence Vulnerability Research", [10, 10, 7, 7, "Mon, 27 Jul 2026 15:02:32 +0000"]],
      ["ERNW Insinuator Security Research", [10, 10, 10, 2, "Mon, 27 Jul 2026 09:45:23 +0000"]],
      ["Picus Security Threat Research", [10, 10, 10, 6, "Sun, 09 Aug 2026 08:00:01 GMT"]],
      ["NSFOCUS Security Labs Research", [10, 10, 10, 8, "Fri, 07 Aug 2026 08:06:23 +0000"]],
      ["MalwareTech Vulnerability Research", [10, 10, 1, 1, "Wed, 03 Jun 2026 10:13:00 +0000"]],
      ["Zero Day Initiative Upcoming Advisories", [200, 200, 200, 200, "Fri, 07 Aug 2026 00:00:00 -0500"]],
      ["Josh Allman Independent Security Research", [5, 5, 2, 1, "Mon, 20 Apr 2026 09:00:00 GMT"]],
      ["Secure Blink Threat Research", [20, 20, 2, 2, "Fri, 24 Apr 2026 15:13:04 GMT"]],
      ["TecSecurity Vulnerability Disclosure Research", [250, 250, 23, 23, "Wed, 15 Jul 2026 12:00:00 +1000"]],
      ["Corgea Vulnerability Research Advisories", [105, 105, 105, 105, "Thu, 06 Aug 2026 00:00:00 GMT"]],
      ["Google Bug Hunters Security Engineering", [74, 74, 13, 3, "05 Jun 26 00:00 +0000"]],
      ["Tails Security Release Advisories", [10, 10, 10, 7, "Wed, 05 Aug 2026 00:00:00 +0000"]],
      ["Horizon3 Vulnerability Advisories and Research", [10, 10, 10, 10, "Fri, 07 Aug 2026 13:15:00 +0000"]],
      ["JFrog Software Supply Chain Research", [10, 10, 10, 2, "Thu, 06 Aug 2026 13:01:55 +0000"]],
      ["Reverse Society Apple Security Research", [23, 23, 2, 0, "Fri, 15 May 2026 00:00:00 GMT"]],
      ["RedSecLabs Security Research Insights", [15, 15, 15, 4, "Fri, 07 Aug 2026 16:43:10 GMT"]],
    ] as const);
    const sourceTolerant = new Set(["Reverse Society Apple Security Research"]);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    const totals = { parsed: 0, dated: 0, current: 0, useful: 0 };
    for (const source of sources) {
      const [observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(canonicalUrl(source.url)).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({ observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt });
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
    expect(totals).toEqual({ parsed: 865, dated: 865, current: 448, useful: 391 });

    const exclusions = new Map(batch.exclusions.map((entry: any) => [entry.idOrUrlHash, entry.reason]));
    expect(exclusions.get(hash(canonicalUrl("https://www.praetorian.com/blog/feed/")).slice(0, 24))).toBe("duplicate_publisher_feed_content");
    expect(exclusions.get(hash(canonicalUrl("https://www.zerodayinitiative.com/rss/published/")).slice(0, 24))).toBe("duplicate_canonical_endpoint");
    expect(exclusions.get(hash(canonicalUrl("https://www.secureblink.com/rss-feeds/threat-feed")).slice(0, 24))).toBe("copied_news_aggregator");
    expect(exclusions.get(hash(canonicalUrl("https://www.sophos.com/en-us/category/threat-research/feed")).slice(0, 24))).toBe("fetch_timeout");
  });

  test("keeps ledger 021 current, source-tolerant, and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["ProjectDiscovery Vulnerability Research", [20, 20, 17, 16, "Mon, 03 Aug 2026 16:34:21 GMT"]],
      ["Intigriti Vulnerability Research", [20, 20, 20, 18, "Tue, 04 Aug 2026 00:00:00 GMT"]],
      ["Hexacorn Windows Security Research", [5, 5, 5, 0, "Sun, 07 Jun 2026 00:41:46 +0000"]],
      ["DoublePulsar Incident and Vulnerability Research", [10, 10, 5, 2, "Thu, 30 Jul 2026 13:36:19 GMT"]],
      ["Troy Hunt Data Breach Analysis", [15, 15, 15, 15, "Mon, 03 Aug 2026 06:38:05 GMT"]],
      ["Scott Helme Web Security Research", [15, 15, 15, 6, "Wed, 08 Jul 2026 16:11:31 GMT"]],
      ["NetSPI Technical Security Research", [10, 10, 10, 5, "Mon, 27 Jul 2026 20:01:07 +0000"]],
      ["Sansec Ecommerce Malware Research", [105, 105, 19, 19, "2026-07-02T00:00:00Z"]],
      ["Indusface Web Application Threat Research", [10, 10, 10, 7, "Wed, 05 Aug 2026 11:41:52 +0000"]],
      ["Sweet Security Cloud Threat Research", [94, 94, 23, 10, "Mon, 03 Aug 2026 19:54:29 GMT"]],
      ["Doctor Web Virus Alerts", [20, 20, 3, 2, "Fri, 10 Jul 2026 04:00:00 GMT"]],
      ["Infoblox DNS Threat Intelligence", [12, 12, 12, 6, "Tue, 21 Jul 2026 19:10:44 +0000"]],
      ["NETSCOUT ASERT DDoS Threat Research", [140, 140, 1, 1, "Tue, 07 Apr 2026 13:50:42 -0400"]],
      ["NowSecure Mobile Threat Research", [10, 10, 10, 5, "Wed, 08 Jul 2026 17:29:34 +0000"]],
      ["Promon Mobile Threat Research", [10, 10, 10, 5, "Wed, 05 Aug 2026 11:56:28 GMT"]],
      ["Silent Push Threat Infrastructure Research", [10, 10, 10, 7, "Mon, 03 Aug 2026 17:16:20 +0000"]],
    ] as const);
    const sourceTolerant = new Set(["Hexacorn Windows Security Research"]);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    const totals = { parsed: 0, dated: 0, current: 0, useful: 0 };
    for (const source of sources) {
      const [observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(canonicalUrl(source.url)).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({ observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt });
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
    expect(totals).toEqual({ parsed: 506, dated: 506, current: 185, useful: 124 });

    const exclusions = new Map(batch.exclusions.map((entry: any) => [entry.idOrUrlHash, entry.reason]));
    expect(exclusions.get(hash(canonicalUrl("https://www.intel471.com/blog/feed")).slice(0, 24))).toBe("duplicate_publisher_feed_content");
    expect(exclusions.get(hash(canonicalUrl("https://projectdiscovery.io/blog/category/vulnerability-research/rss.xml")).slice(0, 24))).toBe("response_exceeds_max_bytes");
    expect(exclusions.get(hash(canonicalUrl("https://community.hpe.com/hpeb/rss/board?board.id=HPE_Threat_Labs")).slice(0, 24))).toBe("http_403");
    expect(exclusions.get(hash(canonicalUrl("https://www.forescout.com/blog/feed/")).slice(0, 24))).toBe("parser_zero_items");
  });

  test("keeps ledger 022 current, source-tolerant, and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["Ivanti Product Security Advisory Updates", [19, 19, 7, 7, "Tue, 14 Jul 2026 14:15:30 Z"]],
      ["Juniper Mist Security Alerts", [10, 10, 1, 0, "Fri, 13 Mar 2026 02:34:53 +0000"]],
      ["Kaspersky ICS CERT Threat Research", [250, 250, 18, 12, "Thu, 06 Aug 2026 09:00:00 +0000"]],
      ["Expel Threat Research", [10, 10, 10, 5, "Thu, 06 Aug 2026 14:50:00 +0000"]],
      ["Sygnia Threat Research", [9, 9, 9, 8, "Wed, 05 Aug 2026 19:19:07 +0000"]],
      ["Lumu Threat Intelligence Research", [15, 15, 15, 8, "Tue, 04 Aug 2026 18:22:45 +0000"]],
      ["SOC Prime Threat Detection Research", [10, 10, 10, 9, "Fri, 07 Aug 2026 14:36:28 +0000"]],
      ["Salt Project Security Advisories", [26, 26, 2, 1, "Fri, 10 Jul 2026 00:00:00 +0000"]],
      ["Zabbix Product Security Advisories", [86, 86, 9, 4, "Wed, 06 May 2026 00:00:00 GMT"]],
      ["Mattermost Product Security Releases", [10, 10, 10, 6, "Thu, 16 Jul 2026 13:00:00 +0000"]],
      ["Huawei Product Security Incident Response Advisories", [20, 20, 3, 3, "2026-03-25T20:54:29"]],
      ["Claroty Team82 Vulnerability Disclosures", [30, 30, 30, 0, "Thu, 12 Mar 2026 13:38:00 +0000"]],
      ["Darktrace Threat Research", [100, 100, 23, 8, "Tue, 28 Jul 2026 13:30:00 GMT"]],
      ["Tailscale Product Security Bulletins", [45, 45, 9, 8, "Fri, 24 Jul 2026 00:00:00 GMT"]],
      ["STAR Labs Security Research", [79, 79, 6, 5, "Mon, 27 Jul 2026 00:00:00 +0000"]],
      ["Fujitsu Product Security Advisories", [89, 89, 20, 20, "Sat, 1 Aug 2026 23:00:00 +0200"]],
      ["SolarWinds Product Security Advisories", [229, 227, 28, 28, "Thu, 23 Jul 2026 06:00:00 GMT"]],
      ["HP Product Security Bulletins", [111, 111, 65, 60, "Thu, 30 Jul 2026 00:00:00 GMT"]],
      ["Xerox Product Security Bulletins", [10, 10, 10, 0, "Sun, 19 Jul 2026 14:51:30 +0000"]],
      ["Schneier Security Analysis", [10, 10, 10, 5, "2026-08-07T21:07:09Z"]],
      ["Orange Cyberdefense World Watch Intelligence", [10, 10, 10, 9, "Tue, 04 Aug 2026 14:33:47 +0000"]],
      ["WatchGuard Product Security Advisories", [10, 10, 10, 10, "Thu, 02 Jul 2026 23:00:30 +0000"]],
      ["CISA Cybersecurity Alerts", [30, 30, 30, 30, "Fri, 07 Aug 26 12:00:00 +0000"]],
      ["Uganda National CERT Cybersecurity Advisories", [10, 10, 10, 7, "Thu, 23 Jul 2026 07:05:18 +0000"]],
      ["Bhutan BtCIRT Cybersecurity Advisories", [5, 5, 5, 4, "Fri, 07 Aug 2026 11:21:42 +0000"]],
      ["Cambodia CamCERT Cybersecurity Advisories", [14, 14, 14, 5, "Wed, 29 Jul 2026 06:25:48 +0000"]],
      ["Amnesty International Security Lab Research", [12, 12, 5, 2, "Thu, 16 Jul 2026 04:32:54 +0000"]],
      ["Matrix Protocol Security Advisories", [15, 15, 1, 1, "2026-02-18T21:21:47+00:00"]],
      ["Intrusion Truth Threat Actor Research", [10, 10, 2, 0, "Tue, 28 Jul 2026 11:06:21 +0000"]],
      ["Sophos Product Security Advisories", [10, 10, 5, 2, "Thu, 06 Aug 2026 00:00:00 GMT"]],
      ["Benin CSIRT Cybersecurity Advisories", [10, 10, 10, 10, "Fri, 07 Aug 2026 18:59:33 +0000"]],
      ["Republic of Srpska CERT Cybersecurity Advisories", [10, 10, 10, 2, "Fri, 07 Aug 2026 08:38:39 +0000"]],
      ["Togo CERT Cybersecurity Advisories", [10, 10, 1, 1, "Mon, 23 Feb 2026 18:46:48 +0000"]],
      ["Cameroon CIRT Cybersecurity Advisories", [10, 10, 10, 1, "Fri, 17 Jul 2026 08:02:38 +0000"]],
      ["Valencian Community CSIRT Cybersecurity Advisories", [10, 10, 10, 7, "Tue, 19 May 2026 12:35:13 +0000"]],
      ["Telconet CSIRT Cybersecurity Advisories", [10, 10, 10, 10, "Thu, 06 Aug 2026 14:32:37 +0000"]],
      ["Cordoba CSIRT Cybersecurity Advisories", [10, 10, 4, 1, "Fri, 19 Jun 2026 13:49:21 +0000"]],
      ["Jamaica CIRT Security Alerts", [10, 10, 9, 9, "Wed, 05 Aug 2026 14:36:04 +0000"]],
      ["CraftedTrust Touchstone Security Advisories", [27, 27, 27, 19, "Sun, 05 Jul 2026 09:00:31 GMT"]],
      ["JUMPSEC Threat Research", [10, 10, 10, 2, "Fri, 24 Jul 2026 12:54:28 +0000"]],
      ["ClearSky Cyber Security Research", [9, 9, 1, 1, "Tue, 03 Mar 2026 14:22:39 +0000"]],
      ["Brandefense Malware Analysis Reports", [10, 10, 6, 5, "Mon, 11 May 2026 13:00:55 +0000"]],
      ["Brandefense Threat Actor Research", [10, 10, 10, 8, "Thu, 16 Jul 2026 13:00:57 +0000"]],
      ["Chainalysis Crypto Threat Research", [10, 10, 10, 1, "Thu, 06 Aug 2026 14:22:56 +0000"]],
      ["Nextron Systems Threat Research", [10, 10, 10, 2, "Tue, 04 Aug 2026 12:09:00 +0000"]],
      ["runZero Vulnerability Research", [50, 50, 50, 41, "2026-08-05T18:35:00-04:00"]],
      ["WatchGuard Secplicity Threat Research", [128, 128, 35, 18, "Mon, 27 Jul 2026 12:42:10 -0700"]],
      ["WithSecure Labs Threat Research", [10, 10, 9, 4, "Thu, 28 May 2026 09:06:11 +0000"]],
    ] as const);
    const sourceTolerant = new Set([
      "Juniper Mist Security Alerts",
      "Claroty Team82 Vulnerability Disclosures",
      "Xerox Product Security Bulletins",
      "Intrusion Truth Threat Actor Research",
    ]);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    const totals = { parsed: 0, dated: 0, current: 0, useful: 0 };
    for (const source of sources) {
      const [observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(canonicalUrl(source.url)).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({ observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt });
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
    expect(totals).toEqual({ parsed: 1648, dated: 1646, current: 619, useful: 409 });

    const exclusions = new Map(batch.exclusions.map((entry: any) => [entry.idOrUrlHash, entry.reason]));
    expect(exclusions.get(hash(canonicalUrl("https://pcsupport.lenovo.com/us/en/api/v4/search/psrss?language=en&country=us&brand=TPG,EBG")).slice(0, 24))).toBe("http_403");
    expect(exclusions.get(hash(canonicalUrl("https://www.bsp.gov.ph/_layouts/15/listfeed.aspx?List=9b0a2117-49d8-4e96-80ba-8651a0e3e17a&View=be72ff0e-7b72-4309-8c5f-e502d9d324a9")).slice(0, 24))).toBe("mixed_non_operational_current_items");
    expect(exclusions.get(hash(canonicalUrl("https://gna.moksha.dk/feed.xml")).slice(0, 24))).toBe("bulk_restamped_current_items");
    expect(exclusions.get(hash(canonicalUrl("https://rss.app/feeds/_22lRQJMKndkBEjVr.xml")).slice(0, 24))).toBe("generated_third_party_feed");
    expect(exclusions.get(hash(canonicalUrl("https://www.welivesecurity.com/en/rss/feed/")).slice(0, 24))).toBe("duplicate_publisher_feed_content");
    expect(exclusions.get(hash(canonicalUrl("https://sec.cloudapps.cisco.com/security/center/eventResponses_20.xml")).slice(0, 24))).toBe("legal_terms_commercial_use_restricted");

    const withSecure = sources.find((source: any) => source.name === "WithSecure Labs Threat Research");
    expect(withSecure.url).toBe("https://www.withsecure.com/en/feed/?post_type=lab_item");
  });

  test("keeps ledger 023 current, source-tolerant, and candidate-only until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["AhnLab ASEC Korean Threat Research", [30, 30, 30, 10, "Thu, 06 Aug 2026 07:38:56 +0000"]],
      ["Ecuador EcuCERT Cybersecurity Advisories", [10, 10, 1, 0, "Thu, 21 May 2026 19:28:52 +0000"]],
      ["Dominican Republic CNCS Cybersecurity Updates", [10, 10, 10, 0, "Wed, 29 Jul 2026 16:12:03 +0000"]],
      ["Invicti Web Security Research", [100, 100, 100, 38, "Fri, 07 Aug 2026 00:00:00 GMT"]],
      ["Acunetix Web Vulnerability Research", [9, 9, 3, 2, "Thu, 25 Jun 2026 15:29:34 +0000"]],
      ["OffSec Security Research", [250, 250, 26, 5, "Fri, 07 Aug 2026 15:22:46 GMT"]],
      ["Sysdig Cloud Threat Research", [100, 100, 85, 28, "Tue, 04 Aug 2026 00:00:00 GMT"]],
      ["Imperva Application Security Research", [10, 10, 10, 5, "Sun, 09 Aug 2026 09:50:54 +0000"]],
      ["Mozilla Hacks Security Engineering", [20, 20, 3, 1, "Thu, 07 May 2026 16:01:21 +0000"]],
      ["SUSE Security Research and Guidance", [9, 9, 1, 1, "Thu, 07 May 2026 21:55:04 +0000"]],
      ["WPScan WordPress Vulnerability Research", [10, 10, 1, 0, "Wed, 20 May 2026 16:55:25 +0000"]],
      ["Searchlight Cyber Threat Intelligence Research", [10, 10, 10, 8, "Thu, 06 Aug 2026 16:35:04 +0000"]],
      ["Flare Cybercrime Threat Research", [10, 10, 10, 6, "Fri, 07 Aug 2026 22:00:03 +0000"]],
      ["Detectify Labs Web Security Research", [10, 10, 1, 0, "Mon, 04 May 2026 09:45:39 +0000"]],
      ["TRM Labs Crypto Threat Intelligence", [100, 100, 100, 9, "Fri, 07 Aug 2026 21:36:00 GMT"]],
      ["AttackIQ Adversary Research", [10, 10, 10, 5, "Tue, 04 Aug 2026 11:54:44 +0000"]],
      ["SCYTHE Adversary Emulation Research", [10, 10, 9, 2, "Wed, 22 Jul 2026 21:47:20 GMT"]],
      ["OpenZeppelin Smart Contract Security Research", [10, 10, 10, 0, "Thu, 06 Aug 2026 14:30:00 GMT"]],
      ["Avira Consumer Threat Research", [10, 10, 10, 0, "Tue, 04 Aug 2026 16:18:46 +0000"]],
      ["Tenable Cyber Exposure Alerts", [10, 10, 10, 10, "Tue, 28 Jul 2026 23:19:08"]],
    ] as const);
    const sourceTolerant = new Set([
      "Ecuador EcuCERT Cybersecurity Advisories",
      "Dominican Republic CNCS Cybersecurity Updates",
      "WPScan WordPress Vulnerability Research",
      "Detectify Labs Web Security Research",
      "OpenZeppelin Smart Contract Security Research",
      "Avira Consumer Threat Research",
    ]);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    const totals = { parsed: 0, dated: 0, current: 0, useful: 0 };
    for (const source of sources) {
      const [observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(canonicalUrl(source.url)).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({ observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt });
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
    expect(totals).toEqual({ parsed: 738, dated: 738, current: 440, useful: 130 });

    const exclusions = new Map(batch.exclusions.map((entry: any) => [entry.idOrUrlHash, entry.reason]));
    expect(exclusions.get(hash(canonicalUrl("https://github.blog/security/feed/")).slice(0, 24))).toBe("duplicate_canonical_endpoint");
    expect(exclusions.get(hash(canonicalUrl("https://www.chainguard.dev/unchained/rss.xml")).slice(0, 24))).toBe("duplicate_publisher_feed_content");
    expect(exclusions.get(hash(canonicalUrl("https://bishopfox.com/blog/feed")).slice(0, 24))).toBe("redirected_to_duplicate_canonical_endpoint");
    expect(exclusions.get(hash(canonicalUrl("https://discussion.fedoraproject.org/c/news/security/7.rss")).slice(0, 24))).toBe("redirected_generic_project_news");
    expect(exclusions.get(hash(canonicalUrl("https://www.synacktiv.com/en/feed/lastblog.xml")).slice(0, 24))).toBe("parser_missing_published_timestamp");
    expect(exclusions.get(hash(canonicalUrl("https://cert.europa.eu/publications/threat-intelligence-rss")).slice(0, 24))).toBe("parser_invalid_published_timestamp");
    expect(exclusions.get(hash(canonicalUrl("https://www.freebsd.org/security/feed.xml")).slice(0, 24))).toBe("parser_invalid_published_timestamp");
    expect(exclusions.get(hash(canonicalUrl("https://www.mitiga.io/blog/rss.xml")).slice(0, 24))).toBe("bulk_restamped_current_items");
    expect(exclusions.get(hash(canonicalUrl("https://www.domaintools.com/blog/rss.xml")).slice(0, 24))).toBe("bulk_restamped_current_items");
  });

  test("recovers ledger 024 soft exclusions as neutral-named candidates until productive scheduled cycles exist", () => {
    const expected = new Map([
      ["Fedora Package Announcement Feed", [30, 30, 30, 0, "Sun, 09 Aug 2026 01:18:12 +0000"]],
      ["CERT.br Cyber Publications", [12, 12, 3, 0, "Mon, 29 Jun 2026 17:15:00 +0000"]],
      ["Docker Engineering Blog", [10, 10, 10, 2, "Tue, 04 Aug 2026 15:10:16 +0000"]],
      ["NGINX Engineering Blog", [10, 10, 10, 0, "Mon, 22 Jun 2026 15:48:29 +0000"]],
      ["Nextcloud Product Update Feed", [10, 10, 9, 0, "Fri, 24 Jul 2026 08:46:03 +0000"]],
      ["Android Developer Update Feed", [25, 25, 2, 2, "2026-05-08T10:41:30.095-07:00"]],
      ["Guardsquare Mobile Engineering Blog", [10, 10, 10, 0, "Tue, 04 Aug 2026 13:02:55 GMT"]],
      ["CERT-FR Current Affairs Bulletins", [40, 40, 27, 26, "Mon, 03 Aug 2026 00:00:00 +0000"]],
      ["CERT Polska Public Advisories", [10, 10, 10, 4, "Fri, 07 Aug 2026 14:22:41 +0000"]],
      ["WatchGuard Technical Blog", [250, 250, 75, 12, "Fri, 07 Aug 2026 07:00:00 -0700"]],
      ["ReliaQuest Research Blog", [10, 10, 10, 2, "Thu, 06 Aug 2026 09:00:00 GMT"]],
      ["WithSecure Corporate Publications", [10, 10, 10, 0, "Wed, 01 Jul 2026 06:35:03 +0000"]],
      ["VirusTotal Research Blog", [25, 25, 2, 2, "Mon, 08 Jun 2026 21:46:34 +0000"]],
      ["Doctor Web Public Updates", [20, 20, 13, 6, "Thu, 23 Jul 2026 09:54:20 GMT"]],
      ["Center for Internet Security Blog", [50, 50, 35, 6, "Thu, 06 Aug 2026 16:33:00 -0400"]],
      ["Intigriti Research Blog", [20, 20, 20, 7, "Thu, 06 Aug 2026 00:00:00 GMT"]],
      ["NowSecure Mobile Research Blog", [10, 10, 10, 3, "Wed, 05 Aug 2026 12:00:00 +0000"]],
      ["Infoblox Network Research Blog", [12, 12, 12, 3, "Thu, 06 Aug 2026 16:00:34 +0000"]],
      ["Morphisec Endpoint Research Blog", [20, 20, 20, 11, "Wed, 05 Aug 2026 13:00:00 +0000"]],
      ["Brandefense Research Blog", [10, 10, 10, 10, "Fri, 07 Aug 2026 16:35:17 +0000"]],
    ] as const);
    const sourceTolerant = new Set([
      "Fedora Package Announcement Feed",
      "CERT.br Cyber Publications",
      "NGINX Engineering Blog",
      "Nextcloud Product Update Feed",
      "Guardsquare Mobile Engineering Blog",
      "WithSecure Corporate Publications",
    ]);
    const sources = batch.sources.filter((source: any) => expected.has(source.name));
    expect(sources).toHaveLength(expected.size);
    const totals = { parsed: 0, dated: 0, current: 0, useful: 0 };
    const exclusions = new Set(batch.exclusions.map((entry: any) => entry.idOrUrlHash));
    for (const source of sources) {
      const [observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt] = expected.get(source.name)!;
      expect(source.id).toBe(`src_portfolio_cw_${hash(canonicalUrl(source.url)).slice(0, 20)}`);
      expect(source.metadata.sourcePortfolioVerification).toMatchObject({ observedItemCount, datedItemCount, currentItemCount, keywordUsefulItemCount, latestPublishedAt });
      expect(currentItemCount).toBeGreaterThan(0);
      if (sourceTolerant.has(source.name)) expect(keywordUsefulItemCount).toBe(0);
      else expect(keywordUsefulItemCount).toBeGreaterThan(0);
      expect(hasThreatTerm(source.name)).toBe(false);
      expect(Date.parse(batch.generatedAt) - Date.parse(latestPublishedAt)).toBeLessThanOrEqual(source.metadata.activityWindowSeconds * 1000);
      expect(source.metadata).not.toHaveProperty("countsAsCoverage");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioQualificationState");
      expect(source.metadata).not.toHaveProperty("sourcePortfolioProductiveCheckCount");
      expect(exclusions.has(hash(canonicalUrl(source.url)).slice(0, 24))).toBe(false);
      totals.parsed += observedItemCount;
      totals.dated += datedItemCount;
      totals.current += currentItemCount;
      totals.useful += keywordUsefulItemCount;
    }
    expect(totals).toEqual({ parsed: 594, dated: 594, current: 328, useful: 96 });
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
