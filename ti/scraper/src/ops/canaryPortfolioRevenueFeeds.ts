// @ts-nocheck
export const REVENUE_CANARY_FEEDS = [
  src("src_canary_cso", "CSO Online", "rss", "https://www.csoonline.com/feed/", ["APT", "breach", "ransomware"], "journalism"),
  src("src_canary_infosecurity_mag", "Infosecurity Magazine", "rss", "https://www.infosecurity-magazine.com/rss/news/", ["breach", "ransomware", "CVE"], "journalism"),
  src("src_canary_cybersecurity_dive", "Cybersecurity Dive", "rss", "https://www.cybersecuritydive.com/feeds/news/", ["breach", "ransomware", "CVE"], "journalism"),
  src("src_canary_itsecurityguru", "IT Security Guru", "rss", "https://www.itsecurityguru.org/feed/", ["breach", "malware", "ransomware"], "journalism"),
  src("src_canary_the_record", "The Record", "rss", "https://therecord.media/feed", ["ransomware", "breach", "APT"], "journalism"),
  src("src_canary_databreaches", "DataBreaches.net", "rss", "https://www.databreaches.net/feed/", ["breach", "leak", "victim"], "journalism"),
  src("src_canary_databreachtoday", "DataBreachToday", "rss", "https://www.databreachtoday.com/rss-feeds", ["breach", "ransomware", "victim"], "journalism"),
  src("src_canary_flashpoint", "Flashpoint Blog", "rss", "https://www.flashpoint.io/blog/feed/", ["ransomware", "dark web", "breach"], "vendor"),
  src("src_canary_kela", "KELA Cyber Threat Intelligence", "rss", "https://www.kelacyber.com/feed/", ["ransomware", "dark web", "actor"], "vendor"),
  src("src_canary_socradar", "SOCRadar Blog", "rss", "https://socradar.io/feed/", ["ransomware", "dark web", "breach"], "vendor"),
  src("src_canary_threatfabric", "ThreatFabric", "rss", "https://www.threatfabric.com/blogs/rss.xml", ["malware", "banking", "fraud"], "vendor"),
  src("src_canary_rhino", "Rhino Security Labs", "rss", "https://rhinosecuritylabs.com/feed/", ["exploit", "cloud", "vulnerability"], "vendor"),
  src("src_canary_praetorian", "Praetorian Blog", "rss", "https://www.praetorian.com/blog/rss/", ["exploit", "vulnerability", "cloud"], "vendor"),
  src("src_canary_horizon3", "Horizon3.ai Blog", "rss", "https://www.horizon3.ai/feed/", ["exploit", "CVE", "vulnerability"], "vendor")
];

function src(id: string, name: string, type: string, url: string, q: string[], family: string) {
  return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "low", trustScore: 0.85, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q } };
}
