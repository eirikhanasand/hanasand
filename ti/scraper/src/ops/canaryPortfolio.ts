// @ts-nocheck
export const canaryQueries = ["APT29", "APT42", "Turla", "Volt Typhoon", "Scattered Spider", "Akira", "CVE"];

export const PUBLIC_CANARY_SOURCE_PORTFOLIO = [
  src("src_canary_cisa_alerts", "CISA Cybersecurity Alerts", "rss", "https://www.cisa.gov/cybersecurity-advisories/all.xml", ["APT29", "Volt Typhoon", "CVE"], "government"),
  src("src_canary_cisa_known_exploited", "CISA Known Exploited Vulnerabilities", "static_web", "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", ["CVE"], "government"),
  src("src_canary_microsoft_threat_intelligence", "Microsoft Threat Intelligence Blog", "rss", "https://www.microsoft.com/en-us/security/blog/topic/threat-intelligence/feed/", ["APT29", "APT42", "Volt Typhoon", "Scattered Spider"], "vendor"),
  src("src_canary_google_cloud_threat_intel", "Google Cloud Threat Intelligence Blog", "rss", "https://cloud.google.com/blog/products/identity-security/rss", ["APT42", "Turla", "Akira"], "vendor"),
  src("src_canary_mandiant", "Mandiant Threat Intelligence Blog", "rss", "https://cloud.google.com/blog/topics/threat-intelligence/rss", ["APT29", "APT42", "Turla"], "vendor"),
  src("src_canary_unit42", "Unit 42 Threat Research", "rss", "https://unit42.paloaltonetworks.com/feed/", ["APT42", "Akira", "Scattered Spider"], "vendor"),
  src("src_canary_recorded_future", "Recorded Future Research", "rss", "https://www.recordedfuture.com/research/feed", ["APT29", "Turla", "Akira"], "vendor"),
  src("src_canary_thehackernews", "The Hacker News", "rss", "https://feeds.feedburner.com/TheHackersNews", ["APT29", "APT42", "Akira", "CVE"], "community"),
  src("src_canary_bleepingcomputer", "BleepingComputer Security", "rss", "https://www.bleepingcomputer.com/feed/", ["Akira", "Scattered Spider", "CVE"], "community"),
  src("src_canary_mitre_attack", "MITRE ATT&CK Groups", "static_web", "https://attack.mitre.org/groups/", ["APT29", "APT42", "Turla", "Volt Typhoon"], "standards_body")
];

function src(id: string, name: string, type: string, url: string, q: string[], family: string) {
  return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "low", trustScore: 0.85, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q } };
}
