// @ts-nocheck
export const RANSOMWARE_CANARY_FEEDS = [
  src("src_canary_ransomwarelive_victims_json", "ransomware.live Victims JSON", "json_api", "https://data.ransomware.live/victims.json", ["ransomware", "extortion", "victim", "leak"], "public_metadata"),
  src("src_canary_ransomwarelive_groups_json", "ransomware.live Groups JSON", "json_api", "https://data.ransomware.live/groups.json", ["ransomware", "extortion", "actor", "leak site"], "public_metadata"),
  src("src_canary_ransomlook_recent", "RansomLook Recent", "json_api", "https://www.ransomlook.io/api/recent", ["ransomware", "extortion", "victim", "leak"], "public_metadata"),
  src("src_canary_ransomlook_posts", "RansomLook Posts", "json_api", "https://www.ransomlook.io/api/posts", ["ransomware", "extortion", "victim", "leak"], "public_metadata"),
  src("src_canary_ransomlook_rss", "RansomLook RSS", "rss", "https://www.ransomlook.io/rss.xml", ["ransomware", "extortion", "victim", "leak"], "public_metadata"),
  src("src_canary_dls_monitor_posts", "DLS Monitor Posts", "json_api", "https://raw.githubusercontent.com/cyberiskvision/dls-monitor/main/posts.json", ["ransomware", "dark leak site", "victim", "extortion"], "public_metadata")
];

function src(id: string, name: string, type: string, url: string, q: string[], family: string) {
  return { id, name, type, url, accessMethod: "public_http", status: "paused", risk: "medium", trustScore: 0.87, language: "en", crawlFrequencySeconds: 900, legalNotes: "Public metadata feed; store metadata only, no leaked material", metadata: { canaryPortfolio: true, sourceFamily: family, actorQueries: q, maxItemsPerFetch: 120 } };
}
