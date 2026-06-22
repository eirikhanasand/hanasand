// @ts-nocheck
export const RANSOMWARE_CANARY_FEEDS = [
  src("src_canary_ransomwarelive", "Ransomware.live Victim Feed", "rss", "https://www.ransomware.live/rss.xml", ["ransomware", "extortion", "victim", "leak"], "public_metadata")
];

function src(id: string, name: string, type: string, url: string, q: string[], family: string) {
  return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "medium", trustScore: 0.87, language: "en", crawlFrequencySeconds: 900, legalNotes: "Public metadata feed; store metadata only, no leaked material", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q } };
}
