import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const watchlistDir = resolve(scriptDir, "../apify/public-threat-actor-monitor/src/watchlist");
const outputPath = resolve(scriptDir, "../seeds/public_threat_intel_generated_sources.json");
const GENERATED_AT = "2026-07-02T00:00:00.000Z";
const TARGET_SOURCE_COUNT = 1100;

const watchlistFiles = [
  "apt.ts",
  "ransomware.ts",
  "highYieldRansomware.ts",
  "aliasLift.ts",
  "threatClusters.ts",
  "commercialLift.ts",
  "malwareTools.ts"
];

const baselineTerms = [
  "ransomware victim",
  "data leak site",
  "extortion leak",
  "new victim claim",
  "breach notification",
  "supplier breach",
  "third party breach",
  "credential leak",
  "dark web leak",
  "infostealer logs",
  "CVE exploited in the wild",
  "zero day exploited",
  "supply chain compromise",
  "cloud breach",
  "identity compromise",
  "phishing campaign",
  "business email compromise",
  "ransomware attack",
  "threat actor claims",
  "victim published"
];

const sectors = [
  "healthcare",
  "hospital",
  "municipality",
  "school district",
  "university",
  "law firm",
  "manufacturing",
  "logistics",
  "retail",
  "bank",
  "insurance",
  "energy",
  "utility",
  "telecom",
  "government contractor",
  "managed service provider",
  "SaaS provider",
  "pharmaceutical",
  "aerospace",
  "defense contractor"
];

const vendorsAndProducts = [
  "Microsoft Exchange",
  "Microsoft SharePoint",
  "Microsoft Entra",
  "Fortinet FortiGate",
  "Palo Alto PAN-OS",
  "Ivanti Connect Secure",
  "Cisco ASA",
  "Cisco IOS XE",
  "Citrix NetScaler",
  "VMware ESXi",
  "VMware vCenter",
  "Atlassian Confluence",
  "Atlassian Jira",
  "Apache Struts",
  "Apache Tomcat",
  "Apache Solr",
  "Progress MOVEit",
  "GoAnywhere MFT",
  "SolarWinds",
  "Okta",
  "Duo Security",
  "MFA bypass",
  "Snowflake",
  "Salesforce",
  "ServiceNow",
  "GitHub Actions",
  "GitLab",
  "Jenkins",
  "Kubernetes",
  "Docker",
  "WordPress",
  "Magento",
  "Oracle WebLogic",
  "SAP NetWeaver",
  "F5 BIG-IP",
  "SonicWall",
  "Zyxel",
  "QNAP",
  "Synology",
  "Mitel",
  "3CX",
  "ConnectWise ScreenConnect",
  "Kaseya VSA",
  "ManageEngine",
  "Zoho ManageEngine",
  "JetBrains TeamCity",
  "Veeam Backup",
  "PaperCut",
  "Fortra"
];

const commonNoise = new Set([
  "j",
  "lv",
  "global",
  "payload",
  "mbc",
  "vect",
  "admin",
  "unknown",
  "attack",
  "malware",
  "ransomware",
  "phishing",
  "breach",
  "leak"
]);

function quotedStrings(fileName) {
  const file = resolve(watchlistDir, fileName);
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return [];
  }
  return [...text.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((match) => match[1]);
}

function cleanTerm(term) {
  return String(term ?? "")
    .replace(/\s+/g, " ")
    .replace(/^\W+|\W+$/g, "")
    .trim();
}

function slugify(value) {
  return cleanTerm(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function uniqueTerms(values) {
  const out = [];
  const seen = new Set();
  for (const raw of values) {
    const term = cleanTerm(raw);
    const key = term.toLowerCase();
    if (!term || term.length < 3 || commonNoise.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out;
}

const watchlistTerms = uniqueTerms([
  ...watchlistFiles.flatMap(quotedStrings),
  ...baselineTerms,
  ...sectors.map((sector) => `${sector} ransomware`),
  ...sectors.map((sector) => `${sector} data breach`),
  ...vendorsAndProducts.map((vendor) => `${vendor} exploited`),
  ...vendorsAndProducts.map((vendor) => `${vendor} vulnerability`)
]);

const sources = [];
const seenUrls = new Set();

function addSource({ id, name, type, url, family, term, queryClass, trustScore = 0.72, crawlFrequencySeconds = 86_400 }) {
  if (sources.length >= TARGET_SOURCE_COUNT) return;
  if (seenUrls.has(url)) return;
  seenUrls.add(url);
  sources.push({
    id,
    name,
    type,
    url,
    accessMethod: "public_http",
    status: "candidate",
    risk: "low",
    trustScore,
    language: "en",
    crawlFrequencySeconds,
    legalNotes: "Public CTI, public news, or public advisory endpoint used for defensive monitoring; collect metadata and safe excerpts only.",
    metadata: {
      generatedPublicSourcePack: true,
      sourceFamily: family,
      queryTerm: term,
      queryClass,
      productionCollection: true,
      maxItemsPerFetch: queryClass === "victim-exposure" ? 4 : 2,
      contentPolicy: "metadata_and_safe_excerpt_only"
    },
    catalog: {
      approvalScope: "safe_public_cti_metadata",
      adapterCompatibility: [type],
      collection: {
        freshnessTargetSeconds: crawlFrequencySeconds
      }
    },
    governance: {
      approvalRequired: false,
      approvalState: "approved",
      metadataOnly: true
    }
  });
}

function gdeltUrl(query) {
  return `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&format=json&maxrecords=25&sort=DateDesc`;
}

function googleNewsUrl(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

function nvdUrl(query) {
  return `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(query)}`;
}

function githubAdvisoryUrl(query) {
  return `https://github.com/advisories?query=${encodeURIComponent(query)}`;
}

for (const term of watchlistTerms) {
  const slug = slugify(term);
  const exposureQuery = `"${term}" (ransomware OR extortion OR "data leak" OR "victim" OR "breach")`;
  const threatQuery = `"${term}" ("threat actor" OR malware OR campaign OR exploit OR CVE)`;

  addSource({
    id: `src_gen_gdelt_exposure_${slug}`,
    name: `GDELT exposure monitor: ${term}`,
    type: "api",
    url: gdeltUrl(exposureQuery),
    family: "public_news_api",
    term,
    queryClass: "victim-exposure",
    trustScore: 0.68
  });

  addSource({
    id: `src_gen_google_exposure_${slug}`,
    name: `Google News exposure RSS: ${term}`,
    type: "rss",
    url: googleNewsUrl(exposureQuery),
    family: "public_news_rss",
    term,
    queryClass: "victim-exposure",
    trustScore: 0.7
  });

  addSource({
    id: `src_gen_gdelt_threat_${slug}`,
    name: `GDELT threat monitor: ${term}`,
    type: "api",
    url: gdeltUrl(threatQuery),
    family: "public_news_api",
    term,
    queryClass: "threat-intel",
    trustScore: 0.66
  });

  addSource({
    id: `src_gen_google_threat_${slug}`,
    name: `Google News threat RSS: ${term}`,
    type: "rss",
    url: googleNewsUrl(threatQuery),
    family: "public_news_rss",
    term,
    queryClass: "threat-intel",
    trustScore: 0.68
  });
}

for (const term of [...vendorsAndProducts, ...baselineTerms]) {
  const slug = slugify(term);
  addSource({
    id: `src_gen_nvd_${slug}`,
    name: `NVD keyword monitor: ${term}`,
    type: "api",
    url: nvdUrl(term),
    family: "public_vulnerability_api",
    term,
    queryClass: "vulnerability",
    trustScore: 0.86,
    crawlFrequencySeconds: 86_400
  });
  addSource({
    id: `src_gen_github_advisory_${slug}`,
    name: `GitHub advisory monitor: ${term}`,
    type: "static_web",
    url: githubAdvisoryUrl(term),
    family: "public_advisory_page",
    term,
    queryClass: "vulnerability",
    trustScore: 0.78,
    crawlFrequencySeconds: 86_400
  });
}

if (sources.length < TARGET_SOURCE_COUNT) {
  throw new Error(`generated ${sources.length} sources; expected ${TARGET_SOURCE_COUNT}`);
}

const bundle = {
  version: 1,
  name: "Generated public CTI, exposure, news, and advisory source pack",
  generatedAt: GENERATED_AT,
  description: "Durable production bootstrap pack of public CTI/news/advisory query endpoints for daily metadata-only monitoring.",
  targetSourceCount: TARGET_SOURCE_COUNT,
  sources
};

writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`wrote ${sources.length} sources to ${outputPath}`);
