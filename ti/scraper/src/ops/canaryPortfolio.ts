// @ts-nocheck
import { ADVISORY_CANARY_FEEDS } from "./canaryPortfolioAdvisoryFeeds.ts";
import { CLOUD_CANARY_FEEDS } from "./canaryPortfolioCloudFeeds.ts";
import { EXPLOIT_CANARY_FEEDS } from "./canaryPortfolioExploitFeeds.ts";
import { IDENTITY_CANARY_FEEDS } from "./canaryPortfolioIdentityFeeds.ts";
import { INCIDENT_CANARY_FEEDS } from "./canaryPortfolioIncidentFeeds.ts";
import { JOURNALISM_CANARY_FEEDS } from "./canaryPortfolioJournalismFeeds.ts";
import { MOBILE_FRAUD_CANARY_FEEDS } from "./canaryPortfolioMobileFraudFeeds.ts";
import { RANSOMWARE_CANARY_FEEDS } from "./canaryPortfolioRansomwareFeeds.ts";
import { REVENUE_CANARY_FEEDS } from "./canaryPortfolioRevenueFeeds.ts";
export const canaryQueries = ["APT29", "APT42", "Turla", "Volt Typhoon", "Scattered Spider", "Akira", "CVE"];
export const PUBLIC_CANARY_SOURCE_PORTFOLIO = [
  src("src_canary_cisa_alerts", "CISA Cybersecurity Alerts", "rss", "https://www.cisa.gov/cybersecurity-advisories/all.xml", ["APT29", "Volt Typhoon", "CVE"], "government"),
  src("src_canary_cisa_known_exploited", "CISA Known Exploited Vulnerabilities", "static_web", "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", ["CVE"], "government"),
  src("src_canary_cisa_known_exploited_json", "CISA KEV JSON Feed", "json_api", "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", ["CVE", "exploited in the wild", "known exploited"], "government"),
  src("src_canary_nvd_recent", "NVD Recent CVE API", "json_api", "https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=40", ["CVE", "vulnerability", "exploit"], "government"),
  src("src_canary_microsoft_threat_intelligence", "Microsoft Threat Intelligence Blog", "rss", "https://www.microsoft.com/en-us/security/blog/topic/threat-intelligence/feed/", ["APT29", "APT42", "Volt Typhoon", "Scattered Spider"], "vendor"),
  src("src_canary_google_cloud_threat_intel", "Google Cloud Threat Intelligence Blog", "rss", "https://cloud.google.com/blog/products/identity-security/rss", ["APT42", "Turla", "Akira"], "vendor"),
  src("src_canary_mandiant", "Mandiant Threat Intelligence Blog", "rss", "https://cloud.google.com/blog/topics/threat-intelligence/rss", ["APT29", "APT42", "Turla"], "vendor"),
  src("src_canary_unit42", "Unit 42 Threat Research", "rss", "https://unit42.paloaltonetworks.com/feed/", ["APT42", "Akira", "Scattered Spider"], "vendor"),
  src("src_canary_recorded_future", "Recorded Future Research", "rss", "https://www.recordedfuture.com/research/feed", ["APT29", "Turla", "Akira"], "vendor"),
  src("src_canary_thehackernews", "The Hacker News", "rss", "https://feeds.feedburner.com/TheHackersNews", ["APT29", "APT42", "Akira", "CVE"], "community"),
  src("src_canary_bleepingcomputer", "BleepingComputer Security", "rss", "https://www.bleepingcomputer.com/feed/", ["Akira", "Scattered Spider", "CVE"], "community"),
  src("src_canary_mitre_attack", "MITRE ATT&CK Groups", "static_web", "https://attack.mitre.org/groups/", ["APT29", "APT42", "Turla", "Volt Typhoon"], "standards_body"),
  src("src_canary_krebs", "KrebsOnSecurity", "rss", "https://krebsonsecurity.com/feed/", ["ransomware", "breach", "botnet", "CVE"], "journalism"),
  src("src_canary_securelist", "Securelist", "rss", "https://securelist.com/feed/", ["APT", "malware", "ransomware", "campaign"], "vendor"),
  src("src_canary_talos", "Cisco Talos Blog", "rss", "https://blog.talosintelligence.com/rss/", ["APT", "malware", "ransomware", "CVE"], "vendor"),
  src("src_canary_welivesecurity", "ESET WeLiveSecurity", "rss", "https://www.welivesecurity.com/feed/", ["APT", "malware", "ransomware"], "vendor"),
  src("src_canary_proofpoint", "Proofpoint Threat Insight", "rss", "https://www.proofpoint.com/us/rss.xml", ["TA", "phishing", "malware", "APT"], "vendor"),
  src("src_canary_sentinelone_labs", "SentinelOne Labs", "rss", "https://www.sentinelone.com/labs/feed/", ["ransomware", "APT", "malware"], "vendor"),
  src("src_canary_elastic_labs", "Elastic Security Labs", "rss", "https://www.elastic.co/security-labs/rss/feed.xml", ["malware", "APT", "ransomware"], "vendor"),
  src("src_canary_checkpoint", "Check Point Research", "rss", "https://research.checkpoint.com/feed/", ["APT", "malware", "ransomware"], "vendor"),
  src("src_canary_sophos", "Sophos Threat Research", "rss", "https://news.sophos.com/en-us/category/threat-research/feed/", ["ransomware", "malware", "CVE"], "vendor"),
  src("src_canary_huntress", "Huntress Blog", "rss", "https://www.huntress.com/blog/rss.xml", ["ransomware", "identity", "malware"], "vendor"),
  src("src_canary_malwarebytes", "Malwarebytes Labs", "rss", "https://www.malwarebytes.com/blog/feed/index.xml", ["malware", "ransomware", "phishing"], "vendor"),
  src("src_canary_sekoia", "SEKOIA.IO Blog", "rss", "https://blog.sekoia.io/feed/", ["APT", "ransomware", "malware"], "vendor"),
  src("src_canary_cert_ua", "CERT-UA Alerts", "rss", "https://cert.gov.ua/api/articles/rss", ["Sandworm", "Gamaredon", "UAC", "APT"], "government"),
  src("src_canary_crowdstrike", "CrowdStrike Blog", "rss", "https://www.crowdstrike.com/en-us/blog/feed/", ["APT", "ransomware", "eCrime"], "vendor"),
  src("src_canary_cybereason", "Cybereason Blog", "rss", "https://www.cybereason.com/blog/rss.xml", ["ransomware", "malware", "APT"], "vendor"),
  src("src_canary_redcanary", "Red Canary Blog", "rss", "https://redcanary.com/blog/feed/", ["threat detection", "malware", "ransomware"], "vendor"),
  src("src_canary_sans_isc", "SANS ISC Diary", "rss", "https://isc.sans.edu/rssfeed_full.xml", ["malware", "phishing", "CVE", "ransomware"], "community"),
  src("src_canary_darkreading", "Dark Reading", "rss", "https://www.darkreading.com/rss.xml", ["breach", "ransomware", "APT", "CVE"], "journalism"),
  src("src_canary_securityweek", "SecurityWeek", "rss", "https://www.securityweek.com/feed/", ["breach", "ransomware", "APT", "CVE"], "journalism"),
  src("src_canary_helpnetsecurity", "Help Net Security", "rss", "https://www.helpnetsecurity.com/feed/", ["malware", "ransomware", "vulnerability"], "journalism"),
  src("src_canary_rapid7", "Rapid7 Blog", "rss", "https://www.rapid7.com/blog/rss/", ["CVE", "exploit", "ransomware"], "vendor"),
  src("src_canary_qualys_vtr", "Qualys Threat Research", "rss", "https://blog.qualys.com/category/vulnerabilities-threat-research/feed", ["CVE", "exploit", "vulnerability"], "vendor"),
  src("src_canary_tenable", "Tenable Blog", "rss", "https://www.tenable.com/blog/feed", ["CVE", "exploit", "vulnerability"], "vendor"),
  src("src_canary_wiz", "Wiz Research", "rss", "https://www.wiz.io/blog/rss.xml", ["cloud", "CVE", "breach", "exploit"], "vendor"),
  src("src_canary_watchtowr", "watchTowr Labs", "rss", "https://labs.watchtowr.com/rss/", ["exploit", "vulnerability", "CVE"], "vendor"),
  src("src_canary_assetnote", "Assetnote Research", "rss", "https://www.assetnote.io/resources/research/rss.xml", ["exploit", "vulnerability", "CVE"], "vendor"),
  src("src_canary_sonatype", "Sonatype Blog", "rss", "https://www.sonatype.com/blog/rss.xml", ["supply-chain", "malware", "CVE"], "vendor"),
  src("src_canary_reversinglabs", "ReversingLabs Blog", "rss", "https://www.reversinglabs.com/blog/rss.xml", ["malware", "supply-chain", "ransomware"], "vendor"),
  src("src_canary_eclecticiq", "EclecticIQ Blog", "rss", "https://blog.eclecticiq.com/rss.xml", ["APT", "ransomware", "malware"], "vendor"),
  src("src_canary_nviso", "NVISO Labs", "rss", "https://blog.nviso.eu/feed/", ["malware", "phishing", "APT"], "vendor"),
  src("src_canary_intezer", "Intezer Blog", "rss", "https://intezer.com/blog/feed/", ["malware", "ransomware", "cloud"], "vendor"),
  ...REVENUE_CANARY_FEEDS,
  ...ADVISORY_CANARY_FEEDS, ...INCIDENT_CANARY_FEEDS, ...EXPLOIT_CANARY_FEEDS,
  ...JOURNALISM_CANARY_FEEDS, ...RANSOMWARE_CANARY_FEEDS, ...IDENTITY_CANARY_FEEDS,
  ...MOBILE_FRAUD_CANARY_FEEDS, ...CLOUD_CANARY_FEEDS
];
function src(id: string, name: string, type: string, url: string, q: string[], family: string) { return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "low", trustScore: 0.85, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q } }; }
