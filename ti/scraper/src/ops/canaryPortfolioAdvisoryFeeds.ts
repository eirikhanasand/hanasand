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
  src("src_canary_grahamcluley", "Graham Cluley", "rss", "https://grahamcluley.com/feed/", ["breach", "ransomware", "phishing"], "journalism")
];

function src(id: string, name: string, type: string, url: string, q: string[], family: string) {
  return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "low", trustScore: 0.85, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q } };
}
