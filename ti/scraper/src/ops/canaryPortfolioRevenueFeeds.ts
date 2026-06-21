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
  src("src_canary_horizon3", "Horizon3.ai Blog", "rss", "https://www.horizon3.ai/feed/", ["exploit", "CVE", "vulnerability"], "vendor"),
  src("src_canary_deepwatch", "Deepwatch Blog", "rss", "https://www.deepwatch.com/feed/", ["ransomware", "threat", "CVE"], "vendor"),
  src("src_canary_cloudflare", "Cloudflare Blog", "rss", "https://blog.cloudflare.com/rss/", ["DDoS", "phishing", "threat"], "vendor"),
  src("src_canary_greynoise", "GreyNoise Blog", "rss", "https://www.greynoise.io/blog/rss.xml", ["CVE", "exploit", "botnet"], "vendor"),
  src("src_canary_cofense", "Cofense Blog", "rss", "https://cofense.com/feed/", ["phishing", "malware", "threat"], "vendor"),
  src("src_canary_malwaretraffic", "Malware-Traffic-Analysis", "rss", "https://www.malware-traffic-analysis.net/blog-entries.rss", ["malware", "traffic", "IOC"], "community"),
  src("src_canary_blackfog", "BlackFog Blog", "rss", "https://www.blackfog.com/feed/", ["ransomware", "exfiltration", "breach"], "vendor"),
  src("src_canary_varonis", "Varonis Blog", "rss", "https://www.varonis.com/blog/rss.xml", ["breach", "ransomware", "data"], "vendor"),
  src("src_canary_hackread", "Hackread", "rss", "https://www.hackread.com/feed/", ["breach", "ransomware", "leak"], "journalism"),
  src("src_canary_securityaffairs", "Security Affairs", "rss", "https://securityaffairs.com/feed", ["breach", "ransomware", "APT"], "journalism"),
  src("src_canary_heimdalsecurity", "Heimdal Security Blog", "rss", "https://heimdalsecurity.com/blog/feed/", ["ransomware", "malware", "breach"], "vendor"),
  src("src_canary_exploitdb", "Exploit-DB", "rss", "https://www.exploit-db.com/rss.xml", ["exploit", "CVE", "vulnerability"], "community"),
  src("src_canary_seclists_fulldisclosure", "Full Disclosure", "rss", "https://seclists.org/rss/fulldisclosure.rss", ["vulnerability", "exploit", "CVE"], "community"),
  src("src_canary_seclists_bugtraq", "Bugtraq", "rss", "https://seclists.org/rss/bugtraq.rss", ["vulnerability", "exploit", "CVE"], "community"),
  src("src_canary_projectzero", "Google Project Zero", "rss", "https://googleprojectzero.blogspot.com/feeds/posts/default", ["zero-day", "exploit", "vulnerability"], "vendor"),
  src("src_canary_redhat_security", "Red Hat Security Blog", "rss", "https://www.redhat.com/en/rss/blog/channel/security", ["CVE", "vulnerability", "exploit"], "vendor"),
  src("src_canary_snyk", "Snyk Blog", "rss", "https://snyk.io/blog/feed.xml", ["CVE", "supply-chain", "vulnerability"], "vendor"),
  src("src_canary_aikido", "Aikido Security Blog", "rss", "https://www.aikido.dev/blog/rss.xml", ["CVE", "supply-chain", "vulnerability"], "vendor"),
  src("src_canary_jfrog", "JFrog Security Research", "rss", "https://jfrog.com/blog/category/security-research/feed/", ["CVE", "supply-chain", "malware"], "vendor"),
  src("src_canary_checkmarx", "Checkmarx Blog", "rss", "https://checkmarx.com/blog/feed/", ["CVE", "supply-chain", "vulnerability"], "vendor"),
  src("src_canary_netlab360", "Netlab 360", "rss", "https://blog.netlab.360.com/rss/", ["botnet", "malware", "C2"], "vendor"),
  src("src_canary_cyble", "Cyble Blog", "rss", "https://cyble.com/blog/feed/", ["ransomware", "breach", "malware"], "vendor"),
  src("src_canary_asec", "ASEC Blog", "rss", "https://asec.ahnlab.com/en/feed/", ["malware", "ransomware", "APT"], "vendor")
];

function src(id: string, name: string, type: string, url: string, q: string[], family: string) {
  return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "low", trustScore: 0.85, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q } };
}
