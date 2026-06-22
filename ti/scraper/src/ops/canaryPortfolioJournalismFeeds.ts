// @ts-nocheck
export const JOURNALISM_CANARY_FEEDS = [
  src("src_canary_theregister_security", "The Register Security", "rss", "https://www.theregister.com/security/headlines.atom", ["breach", "ransomware", "malware"], "journalism"),
  src("src_canary_techcrunch_security", "TechCrunch Security", "rss", "https://techcrunch.com/category/security/feed/", ["breach", "ransomware", "hack"], "journalism"),
  src("src_canary_404media", "404 Media", "rss", "https://www.404media.co/rss/", ["breach", "leak", "credential"], "journalism"),
  src("src_canary_govinfosecurity", "GovInfoSecurity", "rss", "https://www.govinfosecurity.com/rss-feeds", ["breach", "ransomware", "government"], "journalism"),
  src("src_canary_bankinfosecurity", "BankInfoSecurity", "rss", "https://www.bankinfosecurity.com/rss-feeds", ["breach", "ransomware", "finance"], "journalism")
];

function src(id: string, name: string, type: string, url: string, q: string[], family: string) {
  return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "low", trustScore: 0.82, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q } };
}
