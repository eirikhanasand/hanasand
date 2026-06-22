// @ts-nocheck
export const MOBILE_FRAUD_CANARY_FEEDS = [
  src("src_canary_zimperium", "Zimperium zLabs", "rss", "https://www.zimperium.com/blog/rss.xml", ["mobile", "malware", "smishing"], "vendor"),
  src("src_canary_groupib", "Group-IB Blog", "rss", "https://www.group-ib.com/blog/rss.xml", ["phishing", "fraud", "intrusion"], "vendor")
];

function src(id: string, name: string, type: string, url: string, q: string[], family: string) {
  return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "low", trustScore: 0.84, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q } };
}
