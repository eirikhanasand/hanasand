import type { TiSearchResponse } from "../types.ts";
import { safeIso, stableHash } from "../utils.ts";

const NVD_API = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const NVD_DETAIL = "https://nvd.nist.gov/vuln/detail";
const RECENT_DAYS = 90;
const PAGE_SIZE = 2000;
const DEFAULT_PUBLISHED_LIMIT = 30_000;
const DEFAULT_MODIFIED_LIMIT = 200_000;
const MIN_REQUEST_INTERVAL_MS = 6_200;
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 6_200;
const FETCH_DEADLINE_MS = 6_300_000;

let lastRequestStartedAt = 0;

type NvdCve = {
  id: string;
  sourceIdentifier?: string;
  published?: string;
  lastModified?: string;
  vulnStatus?: string;
  descriptions?: Array<{ lang?: string; value?: string }>;
  weaknesses?: Array<{ description?: Array<{ lang?: string; value?: string }> }>;
  metrics?: Record<string, Array<{ cvssData?: { baseScore?: number; baseSeverity?: string } }>>;
};

type NvdResponse = {
  totalResults?: number;
  vulnerabilities?: Array<{ cve?: NvdCve }>;
};

type NvdFinding = {
  id: string;
  activityDate: string;
  published: string;
  lastModified?: string;
  activityType: "published" | "modified";
  severity?: string;
  score?: number;
  cwes: string[];
  description: string;
  sourceIdentifier?: string;
};

export async function fetchNvdRecentResponses(options: { publishedLimit?: number; modifiedLimit?: number } = {}): Promise<TiSearchResponse[] | undefined> {
  if (process.env.TI_DISABLE_NVD_RECENT === "true") return undefined;
  const publishedLimit = boundedLimit(process.env.TI_NVD_RECENT_LIMIT, options.publishedLimit ?? DEFAULT_PUBLISHED_LIMIT);
  const modifiedLimit = boundedLimit(process.env.TI_NVD_RECENT_MODIFIED_LIMIT, options.modifiedLimit ?? DEFAULT_MODIFIED_LIMIT);
  if (!publishedLimit && !modifiedLimit) return undefined;

  const findings: NvdFinding[] = [];
  const seen = new Set<string>();
  const startedAt = Date.now();
  await fetchFindings("published", publishedLimit, findings, seen, startedAt);
  await fetchFindings("modified", modifiedLimit, findings, seen, startedAt);

  return findings.length ? chunk(findings, 5_000).map((items, index) => responseForFindings(items, index)) : undefined;
}

async function fetchFindings(mode: "published" | "modified", limit: number, findings: NvdFinding[], seen: Set<string>, startedAt: number): Promise<void> {
  if (!limit) return;
  let accepted = 0;
  const maxPages = Math.ceil(limit / PAGE_SIZE) * 2;
  for (let startIndex = 0, pages = 0; accepted < limit && pages < maxPages; startIndex += PAGE_SIZE, pages += 1) {
    if (Date.now() - startedAt >= FETCH_DEADLINE_MS) {
      console.log(JSON.stringify({ event: "nvd_recent_fetch_deadline", mode, accepted, totalFindings: findings.length }));
      break;
    }
    const page = await fetchPage(startIndex, mode);
    if (!page) continue;
    if (!page.vulnerabilities?.length) break;
    for (const item of page.vulnerabilities) {
      const finding = findingFromCve(item.cve, mode);
      if (!finding || seen.has(finding.id)) continue;
      seen.add(finding.id);
      findings.push(finding);
      accepted += 1;
      if (accepted >= limit) break;
    }
    if (startIndex + PAGE_SIZE >= (page.totalResults ?? 0)) break;
  }
  console.log(JSON.stringify({ event: "nvd_recent_fetch", mode, accepted, totalFindings: findings.length }));
}

async function fetchPage(startIndex: number, mode: "published" | "modified"): Promise<NvdResponse | undefined> {
  const end = new Date();
  const start = new Date(end.getTime() - RECENT_DAYS * 86_400_000);
  const url = new URL(NVD_API);
  if (mode === "published") {
    url.searchParams.set("pubStartDate", nvdDate(start));
    url.searchParams.set("pubEndDate", nvdDate(end));
  } else {
    url.searchParams.set("lastModStartDate", nvdDate(start));
    url.searchParams.set("lastModEndDate", nvdDate(end));
  }
  url.searchParams.set("resultsPerPage", String(PAGE_SIZE));
  url.searchParams.set("startIndex", String(startIndex));
  url.searchParams.set("noRejected", "");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt));
    if (waitMs) await Bun.sleep(waitMs);
    lastRequestStartedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { headers: { "user-agent": "hanasand-ti-apify-actor/0.8 metadata-only" }, signal: controller.signal }).catch(() => undefined);
      if (response?.ok) {
        const parsed = await response.json().catch(() => undefined) as NvdResponse | undefined;
        if (parsed?.vulnerabilities) return parsed;
      }
      console.log(JSON.stringify({ event: "nvd_recent_fetch_retry", mode, startIndex, attempt, status: response?.status ?? "fetch_failed" }));
    } finally {
      clearTimeout(timeout);
    }
    await Bun.sleep(RETRY_DELAY_MS);
  }
  return undefined;
}

function responseForFindings(findings: NvdFinding[], index: number): TiSearchResponse {
  const generatedAt = new Date().toISOString();
  return {
    query: `nvd_recent_cves_${index + 1}`,
    generatedAt,
    mode: "nvd_recent_cve_api",
    status: "partial",
    runId: `nvd_recent_${stableHash(`${findings[0]?.id}:${findings.length}:${generatedAt}`)}`,
    refreshAfterSeconds: 21_600,
    summary: `Recent NVD CVE vulnerability-disclosure metadata batch ${index + 1}.`,
    confidence: 0.72,
    lastSeen: findings[0]?.activityDate ?? generatedAt,
    aliases: [],
    targets: [],
    ttps: [],
    datasets: [],
    recentActivity: findings.map((finding, itemIndex) => ({
      date: finding.activityDate,
      title: finding.activityType === "modified" ? `NVD vulnerability update: ${finding.id}` : `NVD vulnerability disclosure: ${finding.id}`,
      detail: detail(finding),
      confidence: confidenceFor(finding),
      sourceIds: [`nvd_${index}_${itemIndex}`],
      url: `${NVD_DETAIL}/${finding.id}`,
      claimType: "vulnerability_disclosure",
      ttp: finding.id,
      attackId: finding.id,
      tactic: "vulnerability disclosure",
      firstReportedAt: finding.published,
      lastReportedAt: finding.activityDate,
      publisherCount: 1,
      impact: finding.activityType === "modified" ? "public CVE vulnerability metadata update" : "public CVE vulnerability metadata"
    })),
    sources: findings.map((finding, itemIndex) => ({
      id: `nvd_${index}_${itemIndex}`,
      name: `NVD CVE metadata: ${finding.id}`,
      type: "clear_web",
      provenance: "NVD public CVE API metadata",
      url: `${NVD_DETAIL}/${finding.id}`
    })),
    notes: ["NVD public CVE metadata; descriptions only; no exploit payloads, credentials, or unsafe URLs"]
  };
}

function findingFromCve(cve: NvdCve | undefined, mode: "published" | "modified"): NvdFinding | undefined {
  if (!cve?.id) return undefined;
  const published = safeIso(cve.published ?? "");
  const lastModified = safeIso(cve.lastModified ?? "");
  const activityDate = mode === "modified" ? lastModified : published;
  if (!published || !activityDate || !isRecent(activityDate)) return undefined;
  const metrics = metric(cve);
  return {
    id: cve.id,
    activityDate,
    published,
    lastModified,
    activityType: mode,
    severity: metrics.severity,
    score: metrics.score,
    cwes: cwes(cve),
    description: description(cve),
    sourceIdentifier: cve.sourceIdentifier
  };
}

function detail(finding: NvdFinding): string {
  return [
    finding.activityType === "modified" && `Updated: ${finding.activityDate.slice(0, 10)}`,
    finding.activityType === "modified" && `Published: ${finding.published.slice(0, 10)}`,
    finding.severity && `Severity: ${finding.severity}`,
    finding.score !== undefined && `CVSS: ${finding.score}`,
    finding.cwes.length ? `CWE: ${finding.cwes.slice(0, 3).join(", ")}` : undefined,
    finding.description
  ].filter(Boolean).join(". ").slice(0, 700);
}

function metric(cve: NvdCve): { severity?: string; score?: number } {
  for (const key of ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]) {
    const metric = cve.metrics?.[key]?.[0]?.cvssData;
    if (metric) return { severity: metric.baseSeverity, score: metric.baseScore };
  }
  return {};
}

function cwes(cve: NvdCve): string[] {
  return [...new Set((cve.weaknesses ?? []).flatMap((weakness) => weakness.description ?? [])
    .filter((item) => item.lang === "en" && item.value)
    .map((item) => item.value as string))];
}

function description(cve: NvdCve): string {
  return cve.descriptions?.find((item) => item.lang === "en")?.value?.replace(/\s+/g, " ").trim().slice(0, 500) ?? "NVD CVE metadata row.";
}

function confidenceFor(finding: NvdFinding): number {
  if ((finding.score ?? 0) >= 9) return 0.78;
  if ((finding.score ?? 0) >= 7) return 0.74;
  return 0.7;
}

function isRecent(iso: string): boolean {
  return Date.now() - Date.parse(iso) <= RECENT_DAYS * 86_400_000;
}

function nvdDate(date: Date): string {
  return date.toISOString().replace("Z", "");
}

function boundedLimit(value: string | undefined, fallback: number): number {
  return Math.max(0, Math.min(Number(value ?? fallback), fallback));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}
