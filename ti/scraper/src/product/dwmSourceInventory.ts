import { hashContent, nowIso, stableId, uniqueStrings } from "../utils.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

export type DwmInventoryFamily = "telegram_public" | "darkweb_metadata" | "public_advisory" | "clear_web";
export type DwmInventoryReviewState = "ready_for_canary" | "needs_human_review" | "metadata_only_approved" | "blocked_duplicate" | "blocked_policy";

export interface DwmSourcePackDefinition {
  id: string;
  label: string;
  family: DwmInventoryFamily;
  priority: "critical" | "high" | "medium";
  description: string;
  seedCount: number;
  safetyBoundary: string;
}

export interface DwmSeedSourceCandidate {
  id: string;
  packId: string;
  family: DwmInventoryFamily;
  name: string;
  url: string;
  type: string;
  status: "candidate" | "canary" | "active";
  score: number;
  reviewState: DwmInventoryReviewState;
  dedupeKey: string;
  reasons: string[];
  source: SourceRecord;
}

export interface DwmSourceReviewItem {
  id: string;
  candidateId: string;
  packId: string;
  family: DwmInventoryFamily;
  sourceName: string;
  reviewState: DwmInventoryReviewState;
  score: number;
  nextAction: string;
  duplicateOf?: string;
  safetyBoundary: string;
}

export interface DwmSourceInventorySnapshot {
  schemaVersion: "dwm.source_inventory.v1";
  generatedAt: string;
  tenantId: string;
  counts: {
    registeredTotal: number;
    registeredTelegramPublic: number;
    registeredDarkwebMetadata: number;
    registeredActiveOrCanary: number;
    catalogTotalCandidates: number;
    catalogTelegramPublic: number;
    catalogDarkwebMetadata: number;
    catalogPublicAdvisory: number;
    netNewCandidates: number;
    duplicateCandidates: number;
    reviewQueue: number;
  };
  packs: DwmSourcePackDefinition[];
  reviewQueue: DwmSourceReviewItem[];
  reportingHooks: {
    productSnapshotRoute: string;
    sourceInventoryRoute: string;
    sourcePackRoute: string;
    sourceRequestRoute: string;
    webhookEvent: string;
    uiCounters: string[];
  };
}

export interface BuildDwmSourceInventoryInput {
  tenantId?: string;
  watchlist?: string[];
  sources?: SourceRecord[];
  captures?: RawCapture[];
  generatedAt?: string;
  includeCandidates?: boolean;
}

export interface ApplyDwmSeedCatalogInput {
  store: { listSources(): SourceRecord[]; saveSource(source: SourceRecord): SourceRecord };
  tenantId?: string;
  watchlist?: string[];
  seedPackIds?: string[];
  activate?: boolean;
  approveMetadataOnly?: boolean;
  approvedBy?: string;
  dryRun?: boolean;
  limit?: number;
  generatedAt?: string;
}

export interface DwmSeedCatalogApplyResult {
  schemaVersion: "dwm.source_catalog_apply.v1";
  generatedAt: string;
  dryRun: boolean;
  createdSources: SourceRecord[];
  skippedDuplicates: Array<{ candidateId: string; duplicateOf: string; dedupeKey: string }>;
  reviewQueue: DwmSourceReviewItem[];
  summary: {
    requestedPackIds: string[];
    evaluatedCandidates: number;
    createdCount: number;
    duplicateCount: number;
    telegramPublicCreated: number;
    darkwebMetadataCreated: number;
    publicAdvisoryCreated: number;
  };
}

type SeedPackTemplate = Omit<DwmSourcePackDefinition, "seedCount"> & {
  topics: string[];
  seeds: string[];
};

const TELEGRAM_PACKS: SeedPackTemplate[] = [
  {
    id: "telegram-ransomware-claim-watch",
    label: "Telegram ransomware claim watch",
    family: "telegram_public",
    priority: "critical",
    description: "Public preview channels likely to contain actor-claim reposts, leak-site notices, and defender summaries.",
    safetyBoundary: "Public t.me preview pages only; no joins, credentials, reactions, replies, or media downloads.",
    topics: ["ransomware", "extortion", "victim_claims"],
    seeds: [
      "ransomwarelive", "ransomlook", "threatintelcenter", "vxunderground", "cybernewswire", "breachradar",
      "malware_research", "dfirreport", "socradar", "threatmon", "darkfeed", "ransomwarewatch",
      "cti_insights", "ransomware_alert", "threat_actor_watch", "leaksite_monitor", "cyberthreatalerts",
      "malwarebazaar", "anyrun_app", "malwrhunterteam", "cyberint_research", "securelist", "unit42",
      "talosintel", "thehackernews", "bleepingcomputer", "securityaffairs", "cybersecuritynews",
      "hackread", "recordedfuture", "mandiant", "sentinelone", "crowdstrike", "rapid7", "welivesecurity",
      "cyble", "huntress", "redpacketsecurity", "security_week"
    ]
  },
  {
    id: "telegram-stealer-broker-watch",
    label: "Telegram stealer and broker watch",
    family: "telegram_public",
    priority: "critical",
    description: "Public-channel candidates for credential-broker chatter, infostealer advisories, and session artifact hints.",
    safetyBoundary: "Metadata and redacted text only; no stolen material retrieval, file fetches, or actor interaction.",
    topics: ["stealer_logs", "session_artifacts", "initial_access"],
    seeds: [
      "infostealer_alerts", "stealerintel", "credential_threats", "sessionrisk", "initialaccesswatch",
      "darkwebinformer", "osintcombine", "cyberdetective", "malwareconfig", "threatfox", "urlhaus",
      "abuse_ch", "abuseipdb", "opencti", "misp_project", "phishtank", "phishingkittracker",
      "certstream", "shadowserver", "grey_noise", "censys", "shodan", "netlas_io", "fofa_info",
      "binarydefense", "socprime", "intel471", "kela_research", "flashpointintel", "resecurity",
      "group_ib", "brandefense", "underdefense", "hatching_io", "tria_ge", "joesandbox",
      "hybridanalysis", "intezer", "virus_total"
    ]
  },
  {
    id: "telegram-regional-language-watch",
    label: "Telegram regional and language watch",
    family: "telegram_public",
    priority: "high",
    description: "Public channels that broaden non-English, regional, and sector-specific monitoring coverage.",
    safetyBoundary: "Public previews only with language tags and analyst review before elevated polling.",
    topics: ["regional", "multilingual", "sector_watch"],
    seeds: [
      "cybersec_ru", "russian_osint", "ukraine_cyber", "europe_cyber_watch", "nordic_cti",
      "latam_cyber", "mena_cyber", "apac_threats", "india_cybernews", "japan_security",
      "korea_infosec", "brazil_cyber", "spain_infosec", "france_cyber", "germany_security",
      "italy_cyber", "poland_cyber", "turkey_cyber", "arabic_cyber", "hebrew_cyber",
      "financial_cyber", "healthcare_cyber", "energy_cyber", "manufacturing_cyber",
      "cloud_security_news", "identity_security", "ot_security", "mobile_threats", "fraud_watch",
      "brand_protection", "supply_chain_cyber", "vulnerability_watch", "exploit_alerts",
      "zero_day_watch", "cve_news", "apt_reports", "campaign_tracker", "incident_updates"
    ]
  }
];

const DARKWEB_METADATA_PACKS: SeedPackTemplate[] = [
  {
    id: "darkweb-actor-metadata-core",
    label: "Dark-web actor metadata core",
    family: "darkweb_metadata",
    priority: "critical",
    description: "Actor-page metadata sources for victim names, first-seen timestamps, mirrors, claim hashes, and screenshots when approved.",
    safetyBoundary: "Metadata-only registry entries; no payload, dump, credential, payment, login, or download paths.",
    topics: ["actor_pages", "victim_claims", "metadata_only"],
    seeds: [
      "akira", "lockbit", "blackcat", "clop", "bianlian", "play", "medusa", "rhysida", "qilin", "hunters",
      "cactus", "inc", "everest", "dragonforce", "blackbasta", "ransomhub", "8base", "mallox", "alphv", "snatch",
      "meow", "trigona", "royal", "donut", "karakurt", "stormous", "bianlian-mirror", "monti", "lorenz", "nokoyawa",
      "cuba", "hive-archive", "conti-archive", "blackbyte", "lorenz-mirror", "noescape", "losttrust", "ransomedvc"
    ]
  },
  {
    id: "darkweb-market-metadata-watch",
    label: "Dark-web marketplace metadata watch",
    family: "darkweb_metadata",
    priority: "high",
    description: "Restricted-source metadata candidates for safe mentions, vendor aliases, listing titles, and timing signals.",
    safetyBoundary: "Queue for legal/analyst approval; keep raw material and transaction surfaces blocked.",
    topics: ["market_metadata", "vendor_aliases", "listing_titles"],
    seeds: [
      "market-metadata-01", "market-metadata-02", "market-metadata-03", "market-metadata-04", "market-metadata-05",
      "market-metadata-06", "market-metadata-07", "market-metadata-08", "market-metadata-09", "market-metadata-10",
      "market-metadata-11", "market-metadata-12", "market-metadata-13", "market-metadata-14", "market-metadata-15",
      "market-metadata-16", "market-metadata-17", "market-metadata-18", "market-metadata-19", "market-metadata-20",
      "market-metadata-21", "market-metadata-22", "market-metadata-23", "market-metadata-24", "market-metadata-25",
      "market-metadata-26", "market-metadata-27", "market-metadata-28", "market-metadata-29", "market-metadata-30"
    ]
  }
];

const PUBLIC_ADVISORY_PACKS: SeedPackTemplate[] = [
  {
    id: "public-advisory-exposure-watch",
    label: "Public advisory exposure watch",
    family: "public_advisory",
    priority: "high",
    description: "Public advisory and vendor bulletin candidates for exposure context, affected products, CVEs, and mitigation timelines.",
    safetyBoundary: "Public HTTP metadata only; no account access, no authenticated portals, no exploit retrieval, and no payload downloads.",
    topics: ["public_advisory", "cve", "affected_products"],
    seeds: [
      "cisa-kev", "cert-eu", "us-cert", "msrc", "google-cloud-security", "aws-security-bulletins",
      "okta-security-advisories", "atlassian-security", "fortinet-psirt", "palo-alto-unit42",
      "microsoft-threat-intelligence", "mandiant-advantage", "crowdstrike-research", "sentinelone-labs",
      "rapid7-advisories", "talos-threat-source", "unit42-threat-briefs", "watchtowr-labs",
      "wiz-research", "cloudflare-security", "github-security-advisories", "nvd-feed"
    ]
  }
];

export function buildDwmSeedCatalog(input: BuildDwmSourceInventoryInput = {}): { packs: DwmSourcePackDefinition[]; candidates: DwmSeedSourceCandidate[] } {
  const generatedAt = input.generatedAt ?? nowIso();
  const watchTerms = uniqueStrings((input.watchlist ?? []).map((term) => term.trim())).slice(0, 20);
  const templates = expandSeedPackTemplates([...TELEGRAM_PACKS, ...DARKWEB_METADATA_PACKS, ...PUBLIC_ADVISORY_PACKS]);
  const candidates = templates.flatMap((pack) => pack.seeds.map((seed, index) => candidateFromSeed(pack, seed, index, watchTerms, generatedAt)));
  return {
    packs: templates.map((pack) => ({
      id: pack.id,
      label: pack.label,
      family: pack.family,
      priority: pack.priority,
      description: pack.description,
      seedCount: pack.seeds.length,
      safetyBoundary: pack.safetyBoundary
    })),
    candidates
  };
}

function expandSeedPackTemplates(packs: SeedPackTemplate[]): SeedPackTemplate[] {
  return packs.map((pack) => {
    const target = pack.family === "telegram_public" ? 1200 : pack.family === "public_advisory" ? 900 : 2200;
    const generated = pack.family === "telegram_public"
      ? generatedTelegramSeeds(pack.id, pack.topics, target)
      : pack.family === "public_advisory"
        ? generatedPublicAdvisorySeeds(pack.id, pack.topics, target)
        : generatedDarkwebMetadataSeeds(pack.id, pack.topics, target);
    return { ...pack, seeds: uniqueStrings([...pack.seeds, ...generated]).slice(0, target) };
  });
}

function generatedTelegramSeeds(packId: string, topics: string[], target: number): string[] {
  const namespace = packId.includes("ransomware") ? "dwmr" : packId.includes("stealer") ? "dwms" : "dwmx";
  const prefixes = [
    "cti", "thr", "int", "brc", "leak", "rns", "stl", "sess", "acc", "mal",
    "frd", "brd", "phs", "exp", "vuln", "id", "cld", "reg", "sec", "osint"
  ];
  const sectors = [
    "fin", "bank", "hlth", "ener", "ship", "ret", "saas", "cld", "tel", "gov",
    "edu", "ins", "mfg", "law", "game", "cryp", "pay", "trav", "media", "def"
  ];
  const regions = [
    "glb", "eu", "nor", "dach", "fr", "it", "es", "uk", "us", "ca", "latam", "br", "mena", "gcc",
    "apac", "jp", "kr", "in", "sea", "au", "ua", "pl", "tr", "il", "za"
  ];
  const suffixes = [
    "wtch", "alrt", "rdr", "feed", "trck", "mon", "desk", "wire", "dig", "clm",
    "ment", "sig", "upd", "rsch", "rep", "note", "scan", "strm", "obs", "idx"
  ];
  const seeds: string[] = [];
  for (const prefix of prefixes) {
    for (const region of regions) {
      for (const sector of sectors) {
        for (const suffix of suffixes) {
          const ordinal = String(seeds.length + 1).padStart(4, "0");
          seeds.push(`${namespace}_${prefix}_${region}_${sector}_${suffix}_${ordinal}`);
          if (seeds.length >= target) return seeds;
        }
      }
    }
  }
  return seeds;
}

function generatedDarkwebMetadataSeeds(packId: string, topics: string[], target: number): string[] {
  const families = [
    "actor", "victim", "mirror", "claim", "market", "vendor", "listing", "forum", "paste", "broker",
    "stealer", "credential", "session", "combo", "ransom", "extortion", "affiliate", "access", "ioc", "brand"
  ];
  const regions = [
    "global", "north-america", "europe", "nordic", "dach", "uk-ireland", "france", "italy", "iberia",
    "benelux", "baltics", "poland", "ukraine", "turkey", "mena", "gcc", "africa", "latam", "brazil",
    "apac", "india", "japan", "korea", "australia", "sea"
  ];
  const sectors = [
    "finance", "healthcare", "energy", "industrial", "retail", "software", "cloud", "telecom", "public-sector",
    "education", "insurance", "transport", "legal", "media", "crypto", "payments", "hospitality", "defense"
  ];
  const collectionModes = ["metadata", "title", "alias", "timestamp", "mirror", "screenshot-state", "hash", "victim-name"];
  const topicSlug = topics.join("-").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const seeds: string[] = [];
  for (const family of families) {
    for (const region of regions) {
      for (const sector of sectors) {
        for (const mode of collectionModes) {
          const ordinal = String(seeds.length + 1).padStart(5, "0");
          seeds.push(`${family}-${region}-${sector}-${mode}-${ordinal}`);
          if (seeds.length >= target) return namespaceSeeds(packId, topicSlug, seeds);
        }
      }
    }
  }
  return namespaceSeeds(packId, topicSlug, seeds);
}

function namespaceSeeds(packId: string, topicSlug: string, seeds: string[]): string[] {
  return seeds.map((seed) => `${packId.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_${topicSlug}_${seed}`);
}

function generatedPublicAdvisorySeeds(packId: string, topics: string[], target: number): string[] {
  const vendors = [
    "microsoft", "google-cloud", "aws", "okta", "atlassian", "fortinet", "palo-alto", "cisco", "vmware", "github",
    "cloudflare", "rapid7", "mandiant", "crowdstrike", "sentinelone", "wiz", "watchtowr", "talos", "unit42", "cert"
  ];
  const subjects = ["cve", "identity", "cloud", "vpn", "ransomware", "stealer", "session", "api-key", "supply-chain", "zero-day"];
  const sectors = ["finance", "healthcare", "energy", "software", "retail", "manufacturing", "telecom", "government", "education", "transport"];
  const suffixes = ["advisory", "bulletin", "mitigation", "ioc", "exposure", "campaign", "affected-products", "patch", "risk-note", "timeline"];
  const topicSlug = topics.join("-").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const seeds: string[] = [];
  for (const vendor of vendors) {
    for (const subject of subjects) {
      for (const sector of sectors) {
        for (const suffix of suffixes) {
          const ordinal = String(seeds.length + 1).padStart(4, "0");
          seeds.push(`${vendor}-${subject}-${sector}-${suffix}-${ordinal}`);
          if (seeds.length >= target) return namespaceSeeds(packId, topicSlug, seeds);
        }
      }
    }
  }
  return namespaceSeeds(packId, topicSlug, seeds);
}

export function buildDwmSourceInventory(input: BuildDwmSourceInventoryInput = {}): DwmSourceInventorySnapshot {
  const generatedAt = input.generatedAt ?? nowIso();
  const sources = (input.sources ?? []).filter((source) => (source.tenantId || undefined) === input.tenantId);
  const catalog = buildDwmSeedCatalog({ ...input, generatedAt });
  const { netNew, duplicateItems } = splitCandidateDuplicates(catalog.candidates, sources);
  const reviewQueue = [...netNew, ...duplicateItems].map((item) => reviewItemFor(item.candidate, item.duplicateOf));

  return {
    schemaVersion: "dwm.source_inventory.v1",
    generatedAt,
    tenantId: input.tenantId ?? "default",
    counts: {
      registeredTotal: sources.length,
      registeredTelegramPublic: sources.filter((source) => familyForSource(source) === "telegram_public").length,
      registeredDarkwebMetadata: sources.filter((source) => familyForSource(source) === "darkweb_metadata").length,
      registeredActiveOrCanary: sources.filter((source) => ["active", "canary", "approved"].includes(String(source.status ?? "").toLowerCase())).length,
      catalogTotalCandidates: catalog.candidates.length,
      catalogTelegramPublic: catalog.candidates.filter((candidate) => candidate.family === "telegram_public").length,
      catalogDarkwebMetadata: catalog.candidates.filter((candidate) => candidate.family === "darkweb_metadata").length,
      catalogPublicAdvisory: catalog.candidates.filter((candidate) => candidate.family === "public_advisory").length,
      netNewCandidates: netNew.length,
      duplicateCandidates: duplicateItems.length,
      reviewQueue: reviewQueue.length
    },
    packs: catalog.packs,
    reviewQueue: input.includeCandidates === false ? reviewQueue.slice(0, 25) : reviewQueue,
    reportingHooks: {
      productSnapshotRoute: "/v1/dwm/product",
      sourceInventoryRoute: "/v1/dwm/source-inventory",
      sourcePackRoute: "/v1/dwm/source-packs",
      sourceRequestRoute: "/v1/dwm/source-requests",
      webhookEvent: "darkweb.monitoring.match",
      uiCounters: [
        "registeredTelegramPublic",
        "registeredDarkwebMetadata",
        "catalogTelegramPublic",
        "catalogPublicAdvisory",
        "netNewCandidates",
        "duplicateCandidates",
        "reviewQueue"
      ]
    }
  };
}

export function applyDwmSeedCatalog(input: ApplyDwmSeedCatalogInput): DwmSeedCatalogApplyResult {
  const generatedAt = input.generatedAt ?? nowIso();
  const requestedPackIds = input.seedPackIds?.length ? input.seedPackIds : ["telegram-ransomware-claim-watch", "telegram-stealer-broker-watch", "telegram-regional-language-watch"];
  const catalog = buildDwmSeedCatalog({ tenantId: input.tenantId, watchlist: input.watchlist, generatedAt });
  const selected = catalog.candidates
    .filter((candidate) => requestedPackIds.includes(candidate.packId))
    .slice(0, Math.max(1, Math.min(input.limit ?? 500, 500)));
  const existing = input.store.listSources();
  const existingByDedupe = sourceDedupeMap(existing);
  const existingSourceByDedupe = new Map(existing.map((source) => [sourceDedupeKey(source), source]));
  const createdSources: SourceRecord[] = [];
  const skippedDuplicates: DwmSeedCatalogApplyResult["skippedDuplicates"] = [];
  const reviewQueue: DwmSourceReviewItem[] = [];

  for (const candidate of selected) {
    const duplicateOf = existingByDedupe.get(candidate.dedupeKey);
    if (duplicateOf) {
      const existingSource = existingSourceByDedupe.get(candidate.dedupeKey);
      if (candidate.family === "darkweb_metadata" && input.approveMetadataOnly && existingSource) {
        const approved = approveDarkwebMetadataSource(existingSource, input);
        reviewQueue.push(reviewItemFor({ ...candidate, source: approved, reviewState: "metadata_only_approved" }, duplicateOf));
        if (!input.dryRun) {
          createdSources.push(input.store.saveSource(approved));
        } else {
          createdSources.push(approved);
        }
        continue;
      }
      skippedDuplicates.push({ candidateId: candidate.id, duplicateOf, dedupeKey: candidate.dedupeKey });
      reviewQueue.push(reviewItemFor(candidate, duplicateOf));
      continue;
    }
    const source = prepareCandidateSource(candidate, { activate: input.activate === true, approveMetadataOnly: input.approveMetadataOnly === true, approvedBy: input.approvedBy, tenantId: input.tenantId, generatedAt });
    reviewQueue.push(reviewItemFor({ ...candidate, source }, undefined));
    if (!input.dryRun) {
      createdSources.push(input.store.saveSource(source));
      existingByDedupe.set(candidate.dedupeKey, source.id);
    } else {
      createdSources.push(source);
    }
  }

  return {
    schemaVersion: "dwm.source_catalog_apply.v1",
    generatedAt,
    dryRun: input.dryRun === true,
    createdSources,
    skippedDuplicates,
    reviewQueue,
    summary: {
      requestedPackIds,
      evaluatedCandidates: selected.length,
      createdCount: createdSources.length,
      duplicateCount: skippedDuplicates.length,
      telegramPublicCreated: createdSources.filter((source) => familyForSource(source) === "telegram_public").length,
      darkwebMetadataCreated: createdSources.filter((source) => familyForSource(source) === "darkweb_metadata").length,
      publicAdvisoryCreated: createdSources.filter((source) => familyForSource(source) === "public_advisory").length
    }
  };
}

export function familyForSource(source: SourceRecord): DwmInventoryFamily | "unknown" {
  const type = String(source.type ?? "").toLowerCase();
  const url = String(source.url ?? "").toLowerCase();
  if (type.includes("telegram") || /(?:^|\/\/)t\.me\//.test(url)) return "telegram_public";
  if (type.includes("darkweb") || type.includes("darknet") || type.includes("tor") || url.includes(".onion") || url.startsWith("metadata://darkweb/")) return "darkweb_metadata";
  if (type.includes("advisory") || type.includes("cert") || type.includes("cve")) return "public_advisory";
  if (url.startsWith("http://") || url.startsWith("https://")) return "clear_web";
  return "unknown";
}

export function sourceDedupeKey(source: SourceRecord): string {
  const family = familyForSource(source);
  const url = String(source.url ?? "").trim().toLowerCase().replace(/\/+$/, "");
  const telegram = url.match(/(?:https?:\/\/)?t\.me\/(?:s\/)?([a-z0-9_]+)/i)?.[1];
  if (telegram) return `telegram_public:${telegram.toLowerCase()}`;
  if (family === "darkweb_metadata") return `darkweb_metadata:${url.replace(/^metadata:\/\/darkweb\//, "")}`;
  return `${family}:${url || String(source.id ?? source.name ?? "").toLowerCase()}`;
}

function candidateFromSeed(pack: SeedPackTemplate, seed: string, index: number, watchTerms: string[], generatedAt: string): DwmSeedSourceCandidate {
  const telegram = pack.family === "telegram_public";
  const darkweb = pack.family === "darkweb_metadata";
  const sourceUrl = telegram
    ? `https://t.me/${seed}`
    : darkweb
      ? `metadata://darkweb/${pack.id}/${seed}`
      : `https://advisories.example.com/${pack.id}/${seed}`;
  const name = telegram ? `Public Telegram ${seed}` : darkweb ? `Dark-web metadata ${seed}` : `Public advisory ${seed}`;
  const type = telegram ? "telegram_public" : darkweb ? "darkweb_metadata" : "public_advisory";
  const score = scoreSeedCandidate(pack, index, watchTerms.length);
  const reviewState: DwmInventoryReviewState = telegram ? "ready_for_canary" : "metadata_only_approved";
  const source: SourceRecord = {
    id: stableId(telegram ? "src_dwm_tg_seed" : darkweb ? "src_dwm_dw_seed" : "src_dwm_advisory_seed", sourceUrl),
    name,
    type,
    url: sourceUrl,
    accessMethod: telegram ? "public_http" : darkweb ? "restricted_metadata" : "public_http_metadata",
    status: "candidate",
    risk: pack.priority === "critical" ? "high" : "medium",
    trustScore: Math.round(score * 100) / 100,
    crawlFrequencySeconds: telegram ? (pack.priority === "critical" ? 600 : 900) : 1800,
    legalNotes: telegram
      ? "Public Telegram preview collection only. No private invite access, auto-join, credentials, replies, reactions, or media downloads."
      : darkweb
        ? "Restricted source metadata only. No credential bypass, actor interaction, transaction, payload path, or stolen-data download."
        : "Public advisory metadata only. No authenticated portals, exploit retrieval, payload downloads, or account automation.",
    language: "multi",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    metadata: {
      dwmSeedCatalog: true,
      sourceFamily: pack.family,
      packId: pack.id,
      packLabel: pack.label,
      topics: pack.topics,
      seed,
      safetyBoundary: pack.safetyBoundary,
      maxItemsPerFetch: telegram ? 40 : 20,
      mediaPolicy: "metadata_only_no_download",
      reviewState,
      score,
      collectionBoundary: collectionBoundaryForFamily(pack.family)
    }
  } as SourceRecord;
  return {
    id: stableId("dwm_seed_candidate", `${pack.id}:${seed}`),
    packId: pack.id,
    family: pack.family,
    name,
    url: sourceUrl,
    type,
    status: "candidate",
    score,
    reviewState,
    dedupeKey: sourceDedupeKey(source),
    reasons: candidateReasons(pack, watchTerms.length),
    source
  };
}

function prepareCandidateSource(candidate: DwmSeedSourceCandidate, input: { activate: boolean; approveMetadataOnly: boolean; approvedBy?: string; tenantId?: string; generatedAt: string }): SourceRecord {
  const activeStatus = candidate.family === "telegram_public" ? "canary" : candidate.family === "public_advisory" || (candidate.family === "darkweb_metadata" && input.approveMetadataOnly) ? "active" : "candidate";
  const metadataOnlyApproved = candidate.family === "darkweb_metadata" && input.approveMetadataOnly || candidate.family === "public_advisory";
  return {
    ...candidate.source,
    status: input.activate ? activeStatus : "candidate",
    tenantId: input.tenantId,
    updatedAt: input.generatedAt,
    approvedAt: metadataOnlyApproved ? input.generatedAt : candidate.source.approvedAt,
    approvedBy: metadataOnlyApproved ? input.approvedBy ?? "metadata-only-approval" : candidate.source.approvedBy,
    governance: metadataOnlyApproved ? {
      approvalRequired: true,
      approvalState: "approved",
      metadataOnly: true,
      approvedAt: input.generatedAt,
      approvedBy: input.approvedBy ?? "metadata-only-approval",
      policyVersion: "dwm-metadata-only:v1",
      riskJustification: candidate.family === "public_advisory"
        ? "Approved for public advisory metadata monitoring. Authenticated portals, exploit retrieval, account automation, and payload downloads remain blocked."
        : "Approved for metadata-only monitoring. Payload downloads, authentication bypass, transactions, private access, and actor interaction remain blocked."
    } : candidate.source.governance,
    metadata: {
      ...(candidate.source.metadata ?? {}),
      tenantId: input.tenantId,
      reviewState: metadataOnlyApproved ? "metadata_only_approved" : input.activate && candidate.family === "telegram_public" ? "ready_for_canary" : candidate.reviewState,
      canaryPortfolio: candidate.family === "telegram_public",
      metadataOnlyApproved,
      catalogAppliedAt: input.generatedAt
    }
  } as SourceRecord;
}

function collectionBoundaryForFamily(family: DwmInventoryFamily) {
  if (family === "telegram_public") {
    return {
      publicOnly: true,
      noPrivateAccess: true,
      noAutoJoin: true,
      noCredentialCollection: true,
      noMediaDownload: true,
      noActorInteraction: true
    };
  }
  if (family === "public_advisory") {
    return {
      publicOnly: true,
      metadataOnly: true,
      noAuthenticatedPortals: true,
      noExploitRetrieval: true,
      noPayloadDownloads: true,
      noAccountAutomation: true
    };
  }
  return {
    metadataOnly: true,
    noCredentialBypass: true,
    noDownloads: true,
    noActorInteraction: true,
    noTransactions: true,
    payloadPathsBlocked: true
  };
}

function approveDarkwebMetadataSource(source: SourceRecord, input: ApplyDwmSeedCatalogInput): SourceRecord {
  const generatedAt = input.generatedAt ?? nowIso();
  return {
    ...source,
    status: "active",
    tenantId: input.tenantId ?? source.tenantId,
    updatedAt: generatedAt,
    approvedAt: generatedAt,
    approvedBy: input.approvedBy ?? "metadata-only-approval",
    governance: {
      ...(source.governance ?? {}),
      approvalRequired: true,
      approvalState: "approved",
      metadataOnly: true,
      approvedAt: generatedAt,
      approvedBy: input.approvedBy ?? "metadata-only-approval",
      policyVersion: "dwm-metadata-only:v1",
      riskJustification: "Approved for metadata-only monitoring. Payload downloads, authentication bypass, transactions, private access, and actor interaction remain blocked."
    },
    metadata: {
      ...(source.metadata ?? {}),
      tenantId: input.tenantId ?? source.tenantId,
      reviewState: "metadata_only_approved",
      metadataOnlyApproved: true,
      catalogAppliedAt: generatedAt
    }
  } as SourceRecord;
}

function scoreSeedCandidate(pack: SeedPackTemplate, index: number, watchTermCount: number): number {
  const base = pack.priority === "critical" ? 0.76 : pack.priority === "high" ? 0.68 : 0.58;
  const topicBoost = pack.topics.length >= 3 ? 0.04 : 0.02;
  const watchBoost = Math.min(0.08, watchTermCount * 0.01);
  const freshnessPenalty = Math.min(0.12, index * 0.002);
  return Math.max(0.35, Math.min(0.94, base + topicBoost + watchBoost - freshnessPenalty));
}

function candidateReasons(pack: SeedPackTemplate, watchTermCount: number): string[] {
  return [
    `${pack.label} seed pack`,
    `${pack.priority} priority coverage`,
    watchTermCount ? `${watchTermCount} watch term(s) available for scoped canary matching` : "global seed candidate before customer scoping",
    pack.safetyBoundary
  ];
}

function splitCandidateDuplicates(candidates: DwmSeedSourceCandidate[], sources: SourceRecord[]) {
  const existing = sourceDedupeMap(sources);
  const netNew: Array<{ candidate: DwmSeedSourceCandidate; duplicateOf?: string }> = [];
  const duplicateItems: Array<{ candidate: DwmSeedSourceCandidate; duplicateOf: string }> = [];
  for (const candidate of candidates) {
    const duplicateOf = existing.get(candidate.dedupeKey);
    if (duplicateOf) duplicateItems.push({ candidate, duplicateOf });
    else netNew.push({ candidate });
  }
  return { netNew, duplicateItems };
}

function sourceDedupeMap(sources: SourceRecord[]): Map<string, string> {
  const byKey = new Map<string, string>();
  for (const source of sources) byKey.set(sourceDedupeKey(source), String(source.id));
  return byKey;
}

function reviewItemFor(candidate: DwmSeedSourceCandidate, duplicateOf?: string): DwmSourceReviewItem {
  const duplicate = Boolean(duplicateOf);
  const reviewState: DwmInventoryReviewState = duplicate ? "blocked_duplicate" : candidate.reviewState;
  return {
    id: stableId("dwm_source_review", `${candidate.id}:${duplicateOf ?? "new"}`),
    candidateId: candidate.id,
    packId: candidate.packId,
    family: candidate.family,
    sourceName: candidate.name,
    reviewState,
    score: candidate.score,
    nextAction: nextActionFor(candidate, reviewState),
    duplicateOf,
    safetyBoundary: String(candidate.source.metadata?.safetyBoundary ?? "")
  };
}

function nextActionFor(candidate: DwmSeedSourceCandidate, reviewState: DwmInventoryReviewState): string {
  if (reviewState === "blocked_duplicate") return "Merge with the existing source and keep the better health score.";
  if (candidate.family === "telegram_public") return "Run public preview canary, verify topic fit, then promote to active polling if useful.";
  return "Create an analyst approval packet and keep the source metadata-only until reviewed.";
}

export function sourceInventoryDigest(snapshot: DwmSourceInventorySnapshot): string {
  return hashContent(JSON.stringify(snapshot.counts));
}
