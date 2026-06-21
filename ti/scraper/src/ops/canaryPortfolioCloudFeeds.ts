// @ts-nocheck
export const CLOUD_CANARY_FEEDS = [
  src("src_canary_stairwell", "Stairwell Blog", "rss", "https://stairwell.com/blog/feed/", ["malware", "APT", "threat"], "vendor"),
  src("src_canary_threatdown", "ThreatDown Blog", "rss", "https://www.threatdown.com/blog/feed/", ["malware", "ransomware", "threat"], "vendor"),
  src("src_canary_uptycs", "Uptycs Blog", "rss", "https://www.uptycs.com/blog/rss.xml", ["cloud", "malware", "threat"], "vendor"),
  src("src_canary_crowdsec", "CrowdSec Blog", "rss", "https://www.crowdsec.net/blog/rss.xml", ["botnet", "attack", "infrastructure"], "vendor"),
  src("src_canary_securonix", "Securonix Threat Research", "rss", "https://www.securonix.com/blog/feed/", ["APT", "malware", "cloud"], "vendor"),
  src("src_canary_isc_handlers", "SANS ISC Handlers Diary", "rss", "https://isc.sans.edu/rssfeed.xml", ["botnet", "malware", "phishing"], "community"),
  src("src_canary_aws_security_bulletins", "AWS Security Bulletins", "rss", "https://aws.amazon.com/security/security-bulletins/rss/feed/", ["cloud", "CVE", "advisory"], "vendor"),
  src("src_canary_cloudsek", "CloudSEK Blog", "rss", "https://www.cloudsek.com/blog/rss.xml", ["dark web", "credential", "breach"], "vendor"),
  src("src_canary_inky", "INKY Blog", "rss", "https://www.inky.com/blog/rss.xml", ["phishing", "credential", "threat"], "vendor"),
  src("src_canary_orca", "Orca Security Blog", "rss", "https://orca.security/resources/blog/feed/", ["cloud", "CVE", "vulnerability"], "vendor"),
  src("src_canary_sigmahq", "SigmaHQ Releases", "rss", "https://github.com/SigmaHQ/sigma/releases.atom", ["detection", "malware", "APT"], "community")
];

function src(id: string, name: string, type: string, url: string, q: string[], family: string) {
  return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "low", trustScore: 0.85, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q } };
}
