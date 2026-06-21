// @ts-nocheck
export const INCIDENT_CANARY_FEEDS = [
  src("src_canary_dfirreport", "The DFIR Report", "rss", "https://thedfirreport.com/feed/", ["intrusion", "ransomware", "malware"], "community"),
  src("src_canary_volexity", "Volexity Blog", "rss", "https://www.volexity.com/blog/feed/", ["APT", "intrusion", "malware"], "vendor"),
  src("src_canary_netskope", "Netskope Threat Labs", "rss", "https://www.netskope.com/blog/category/netskope-threat-labs/feed", ["cloud", "malware", "phishing"], "vendor"),
  src("src_canary_censys", "Censys Blog", "rss", "https://censys.com/feed/", ["infrastructure", "CVE", "exposed"], "vendor"),
  src("src_canary_anyrun", "ANY.RUN Blog", "rss", "https://any.run/cybersecurity-blog/feed/", ["malware", "phishing", "C2"], "vendor"),
  src("src_canary_bitsight", "BitSight Blog", "rss", "https://www.bitsight.com/blog/rss.xml", ["breach", "botnet", "vulnerability"], "vendor"),
  src("src_canary_mandiant_adv", "Mandiant Advantage Blog", "rss", "https://www.mandiant.com/resources/blog/rss.xml", ["APT", "intrusion", "ransomware"], "vendor"),
  src("src_canary_teamt5", "TeamT5 Blog", "rss", "https://teamt5.org/en/posts/rss.xml", ["APT", "espionage", "malware"], "vendor"),
  src("src_canary_foxit", "Fox-IT Blog", "rss", "https://blog.fox-it.com/feed/", ["APT", "malware", "intrusion"], "vendor")
];

function src(id: string, name: string, type: string, url: string, q: string[], family: string) {
  return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "low", trustScore: 0.86, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q } };
}
