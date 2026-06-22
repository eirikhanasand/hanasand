import type { TiSearchResponse } from "../types.ts";
import { safeIso, stableHash } from "../utils.ts";

const CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const CISA_KEV_CATALOG_URL = "https://www.cisa.gov/known-exploited-vulnerabilities-catalog";
const DEFAULT_LIMIT = 5_000;
const REQUEST_TIMEOUT_MS = 30_000;

type CisaKevResponse = {
  title?: string;
  catalogVersion?: string;
  dateReleased?: string;
  vulnerabilities?: CisaKevItem[];
};

type CisaKevItem = {
  cveID?: string;
  vendorProject?: string;
  product?: string;
  vulnerabilityName?: string;
  dateAdded?: string;
  shortDescription?: string;
  requiredAction?: string;
  dueDate?: string;
  knownRansomwareCampaignUse?: string;
  notes?: string;
};

type KevFinding = {
  cve: string;
  vendorProject?: string;
  product?: string;
  vulnerabilityName?: string;
  dateAdded: string;
  requiredAction?: string;
  dueDate?: string;
  knownRansomwareCampaignUse?: string;
  shortDescription?: string;
};

export async function fetchCisaKevResponses(limit = DEFAULT_LIMIT): Promise<TiSearchResponse[] | undefined> {
  if (process.env.TI_DISABLE_CISA_KEV === "true" || limit <= 0) return undefined;
  const feed = await fetchFeed();
  const findings = (feed?.vulnerabilities ?? [])
    .map(findingFromItem)
    .filter((finding): finding is KevFinding => Boolean(finding))
    .sort((left, right) => Date.parse(right.dateAdded) - Date.parse(left.dateAdded))
    .slice(0, limit);

  console.log(JSON.stringify({ event: "cisa_kev_fetch", accepted: findings.length, catalogVersion: feed?.catalogVersion }));
  return findings.length ? chunk(findings, 5_000).map((items, index) => responseForFindings(items, feed, index)) : undefined;
}

async function fetchFeed(): Promise<CisaKevResponse | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(CISA_KEV_URL, {
      headers: { "user-agent": "hanasand-ti-apify-actor/0.9 metadata-monitor" },
      signal: controller.signal
    }).catch(() => undefined);
    if (!response?.ok) {
      console.log(JSON.stringify({ event: "cisa_kev_fetch_failed", status: response?.status ?? "fetch_failed" }));
      return undefined;
    }
    return await response.json().catch(() => undefined) as CisaKevResponse | undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function responseForFindings(findings: KevFinding[], feed: CisaKevResponse | undefined, index: number): TiSearchResponse {
  const generatedAt = new Date().toISOString();
  const lastSeen = safeIso(findings[0]?.dateAdded ?? "") ?? generatedAt;
  return {
    query: `cisa_kev_${index + 1}`,
    generatedAt,
    mode: "cisa_known_exploited_vulnerabilities",
    status: "partial",
    runId: `cisa_kev_${stableHash(`${feed?.catalogVersion ?? ""}:${findings[0]?.cve}:${findings.length}:${generatedAt}`)}`,
    refreshAfterSeconds: 21_600,
    summary: `CISA Known Exploited Vulnerabilities catalog entries, version ${feed?.catalogVersion ?? "current"}.`,
    confidence: 0.82,
    lastSeen,
    aliases: ["CISA KEV", "Known Exploited Vulnerabilities"],
    targets: [],
    ttps: [],
    datasets: [],
    recentActivity: findings.map((finding, itemIndex) => ({
      date: finding.dateAdded,
      title: `CISA KEV exploited vulnerability: ${finding.cve}`,
      detail: detail(finding),
      confidence: confidenceFor(finding),
      sourceIds: [`cisa_kev_${index}_${itemIndex}`],
      url: CISA_KEV_CATALOG_URL,
      claimType: "vulnerability_disclosure",
      ttp: finding.cve,
      attackId: finding.cve,
      tactic: "known exploited vulnerability",
      firstReportedAt: finding.dateAdded,
      lastReportedAt: finding.dateAdded,
      publisherCount: 1,
      affectedSectors: ["Organizations using affected products"],
      impact: finding.knownRansomwareCampaignUse === "Known"
        ? "known exploited vulnerability with reported ransomware campaign use"
        : "known exploited vulnerability"
    })),
    sources: findings.map((finding, itemIndex) => ({
      id: `cisa_kev_${index}_${itemIndex}`,
      name: `CISA KEV catalog: ${finding.cve}`,
      type: "clear_web",
      provenance: "CISA Known Exploited Vulnerabilities catalog",
      url: CISA_KEV_CATALOG_URL
    })),
    notes: ["CISA Known Exploited Vulnerabilities public catalog"]
  };
}

function findingFromItem(item: CisaKevItem): KevFinding | undefined {
  if (!item.cveID || !item.dateAdded) return undefined;
  const dateAdded = safeIso(item.dateAdded);
  if (!dateAdded) return undefined;
  return {
    cve: item.cveID,
    vendorProject: clean(item.vendorProject),
    product: clean(item.product),
    vulnerabilityName: clean(item.vulnerabilityName),
    dateAdded,
    requiredAction: clean(item.requiredAction),
    dueDate: clean(item.dueDate),
    knownRansomwareCampaignUse: clean(item.knownRansomwareCampaignUse),
    shortDescription: clean(item.shortDescription)
  };
}

function detail(finding: KevFinding): string {
  return [
    finding.vendorProject && finding.product && `${finding.vendorProject} ${finding.product}`,
    finding.vulnerabilityName,
    `Added to CISA KEV: ${finding.dateAdded.slice(0, 10)}`,
    finding.knownRansomwareCampaignUse && `Ransomware use: ${finding.knownRansomwareCampaignUse}`,
    finding.dueDate && `Remediation due: ${finding.dueDate}`,
    finding.shortDescription,
    finding.requiredAction && `Action: ${finding.requiredAction}`
  ].filter(Boolean).join(". ").slice(0, 700);
}

function confidenceFor(finding: KevFinding): number {
  return finding.knownRansomwareCampaignUse === "Known" ? 0.86 : 0.82;
}

function clean(value: string | undefined): string | undefined {
  return value?.replace(/\s+/g, " ").trim() || undefined;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}
