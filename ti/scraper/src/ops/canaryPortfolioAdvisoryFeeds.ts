// @ts-nocheck
export const ADVISORY_CANARY_FEEDS = [
  src("src_canary_cisco_psirt", "Cisco PSIRT Advisories", "rss", "https://sec.cloudapps.cisco.com/security/center/psirtrss20/CiscoSecurityAdvisory.xml", ["CVE", "exploit", "vulnerability"], "vendor"),
  src("src_canary_gitlab_releases", "GitLab Security Releases", "rss", "https://about.gitlab.com/security-releases.xml", ["CVE", "vulnerability", "supply-chain"], "vendor"),
  src("src_canary_sonarsource", "SonarSource Blog", "rss", "https://www.sonarsource.com/blog/rss.xml", ["CVE", "vulnerability", "exploit"], "vendor"),
  src("src_canary_portswigger_research", "PortSwigger Research", "rss", "https://portswigger.net/research/rss", ["vulnerability", "exploit", "research"], "vendor"),
  src("src_canary_trailofbits", "Trail of Bits Blog", "rss", "https://blog.trailofbits.com/feed/", ["vulnerability", "supply-chain", "research"], "vendor"),
  src("src_canary_google_online_security", "Google Online Security Blog", "rss", "https://security.googleblog.com/feeds/posts/default", ["vulnerability", "malware", "APT"], "vendor"),
  src("src_canary_mozilla_security", "Mozilla Security Blog", "rss", "https://blog.mozilla.org/security/feed/", ["vulnerability", "CVE", "exploit"], "vendor"),
  src("src_canary_google_workspace_updates", "Google Workspace Updates", "rss", "https://workspaceupdates.googleblog.com/feeds/posts/default", ["phishing", "threat", "breach"], "vendor"),
  src("src_canary_aws_security", "AWS Security Blog", "rss", "https://aws.amazon.com/blogs/security/feed/", ["cloud", "vulnerability", "threat"], "vendor"),
  src("src_canary_paloalto_psirt", "Palo Alto Security Advisories", "rss", "https://security.paloaltonetworks.com/rss.xml", ["CVE", "vulnerability", "exploit"], "vendor"),
  src("src_canary_tenable_cve", "Tenable CVE Blog", "rss", "https://www.tenable.com/cve/feeds?sort=newest", ["CVE", "vulnerability", "exploit"], "vendor"),
  src("src_canary_jpcert", "JPCERT/CC Alerts", "rss", "https://www.jpcert.or.jp/rss/jpcert.rdf", ["advisory", "malware", "CVE"], "government"),
  src("src_canary_cyberscoop", "CyberScoop", "rss", "https://cyberscoop.com/feed/", ["breach", "APT", "ransomware"], "journalism"),
  src("src_canary_grahamcluley", "Graham Cluley", "rss", "https://grahamcluley.com/feed/", ["breach", "ransomware", "phishing"], "journalism"),
  src("src_canary_canada_cyber_centre", "Canadian Centre for Cyber Security Alerts", "rss", "https://www.cyber.gc.ca/api/cccs/rss/v1/get?feed=alerts_advisories&lang=en", ["CVE", "exploitation", "cyber threat"], "government", { publisherReference: "https://www.cyber.gc.ca/en/alerts-advisories", trustScore: 0.9 }),
  src("src_canary_ncsc_nl_advisories", "NCSC Netherlands Advisories", "rss", "https://advisories.ncsc.nl/rss/advisories", ["kwetsbaarheden", "CVE", "exploit"], "government", { language: "nl", publisherReference: "https://advisories.ncsc.nl", trustScore: 0.9 }),
  src("src_canary_cert_bund_wid", "CERT-Bund Security Advisories", "rss", "https://wid.cert-bund.de/content/public/securityAdvisory/rss", ["Schwachstellen", "Angriff", "Schadsoftware"], "government", { language: "de", publisherReference: "https://www.cert-bund.de", trustScore: 0.9 }),
  src("src_canary_cert_se", "CERT-SE Advisories", "rss", "https://www.cert.se/feed/", ["sårbarheter", "skadlig kod", "angrepp"], "government", { language: "sv", publisherReference: "https://www.cert.se", trustScore: 0.88 }),
  src("src_canary_cert_hr", "Croatian National CERT Advisories", "rss", "https://www.cert.hr/feed/", ["phishing", "curenje podataka", "napad"], "government", { language: "hr", publisherReference: "https://www.cert.hr", trustScore: 0.86 }),
  src("src_canary_incibe_cert", "INCIBE-CERT Advisories", "rss", "https://www.incibe.es/incibe-cert/alerta-temprana/avisos/feed", ["vulnerabilidad", "explotación", "malware"], "government", { language: "es", publisherReference: "https://www.incibe.es/incibe-cert", trustScore: 0.88 }),
  src("src_canary_cert_agid", "CERT-AGID Alerts", "rss", "https://cert-agid.gov.it/feed/", ["vulnerabilità", "campagna malevola", "phishing"], "government", { language: "it", publisherReference: "https://cert-agid.gov.it", trustScore: 0.86 }),
  src("src_canary_cert_pl", "CERT Polska Advisories", "rss", "https://cert.pl/rss.xml", ["podatność", "złośliwe oprogramowanie", "atak"], "government", { language: "pl", publisherReference: "https://cert.pl", trustScore: 0.9 }),
  src("src_canary_cert_si", "SI-CERT Advisories", "rss", "https://www.cert.si/feed/", ["ranljivost", "napad", "phishing"], "government", { language: "sl", publisherReference: "https://www.cert.si", trustScore: 0.86 }),
  src("src_canary_nsfocus_global", "NSFOCUS Global Threat Intelligence", "rss", "https://nsfocusglobal.com/feed/", ["CVE", "malware", "exploit"], "vendor", { publisherReference: "https://nsfocusglobal.com", trustScore: 0.82 }),
  src("src_canary_ubuntu_security_notices", "Ubuntu Security Notices", "rss", "https://ubuntu.com/security/notices/rss.xml", ["CVE", "vulnerability", "exploit"], "vendor", { publisherReference: "https://ubuntu.com/security/notices", trustScore: 0.88 }),
  src("src_canary_drupal_security", "Drupal Security Advisories", "rss", "https://www.drupal.org/security/rss.xml", ["CVE", "vulnerability", "exploit"], "community", { publisherReference: "https://www.drupal.org/security", trustScore: 0.84 }),
  src("src_canary_infoblox_threat_intel", "Infoblox Threat Intelligence", "rss", "https://blogs.infoblox.com/category/threat-intelligence/feed/", ["malware", "phishing", "threat actor"], "vendor", { publisherReference: "https://blogs.infoblox.com/category/threat-intelligence", trustScore: 0.82 }),
  src("src_canary_barracuda_research", "Barracuda Threat Research", "rss", "https://blog.barracuda.com/feed/", ["ransomware", "breach", "malware"], "vendor", { publisherReference: "https://blog.barracuda.com", trustScore: 0.8 }),
  src("src_canary_searchlight_cyber", "Searchlight Cyber Research", "rss", "https://slcyber.io/feed/", ["ransomware", "dark web", "threat actor"], "vendor", { publisherReference: "https://slcyber.io/resources", trustScore: 0.8 }),
  src("src_canary_citizen_lab", "Citizen Lab Research", "rss", "https://citizenlab.ca/feed/", ["spyware", "targeted attack", "threat actor"], "research", { publisherReference: "https://citizenlab.ca/category/research", trustScore: 0.88 }),
  src("src_canary_sysdig_research", "Sysdig Threat Research", "rss", "https://www.sysdig.com/blog/rss.xml", ["cloud threat", "malware", "ransomware"], "vendor", { publisherReference: "https://www.sysdig.com/blog", trustScore: 0.82 }),
  src("src_canary_vulncheck", "VulnCheck Research", "rss", "https://www.vulncheck.com/feed/blog/atom.xml", ["CVE", "exploitation", "vulnerability"], "vendor", { publisherReference: "https://www.vulncheck.com/blog", trustScore: 0.84 }),
  src("src_canary_arctic_wolf_research", "Arctic Wolf Security Research", "rss", "https://arcticwolf.com/resources/category/blog/feed/", ["ransomware", "CVE", "threat actor"], "vendor", { publisherReference: "https://arcticwolf.com/resources/blog", trustScore: 0.8 }),
  src("src_canary_seqrite_labs", "Seqrite Labs Research", "rss", "https://www.seqrite.com/blog/feed/", ["malware", "phishing", "threat actor"], "vendor", { publisherReference: "https://www.seqrite.com/blog", trustScore: 0.82 })
];

function src(id: string, name: string, type: string, url: string, q: string[], family: string, options: { language?: string; publisherReference?: string; trustScore?: number } = {}) {
  const publisherReference = options.publisherReference ?? new URL(url).origin;
  return {
    id, name, type, url, accessMethod: "public_http", status: "paused", risk: "low",
    trustScore: options.trustScore ?? 0.85, language: options.language ?? "en", crawlFrequencySeconds: 3600,
    legalNotes: `Publisher-operated public feed collected read-only; publisher reference: ${publisherReference}`,
    metadata: { canaryPortfolio: true, productionCollection: true, sourceFamily: family, actorQueries: q, publisherReference, provenance: "publisher_operated_public_feed" }
  };
}
