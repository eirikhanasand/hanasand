// @ts-nocheck
export const IDENTITY_CANARY_FEEDS = [
  src("src_canary_flare", "Flare Threat Intelligence", "rss", "https://flare.io/feed/", ["infostealer", "credential", "identity"], "vendor"),
  src("src_canary_constella", "Constella Intelligence", "rss", "https://constellaintelligence.com/feed/", ["infostealer", "identity", "phishing"], "vendor")
];

function src(id: string, name: string, type: string, url: string, q: string[], family: string) {
  return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "low", trustScore: 0.82, language: "en", crawlFrequencySeconds: 3600, legalNotes: "Public source", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q } };
}
