export function collectionStrategy() {
  return {
    thesis: "Use public indexes as seeds and corroboration, then create value through our own high-speed metadata capture, actor mapping, and company/vendor notifications.",
    productFocus: [
      "recent victim and company claims",
      "actor, date, claimed-data, sector, country, and source metadata",
      "fast notifications when a watched company, vendor, domain, brand, or portfolio company appears",
      "UI-friendly actor overviews with provenance, freshness, confidence, and safety boundaries"
    ],
    sourcePosture: [
      {
        source: "RansomLook and ransomware.live",
        role: "primary_seed",
        summary: "Good starting mix for recent victim claims, actor names, company names, claimed dates, sector/country context, and claimed-data descriptions.",
        buyerValue: "Useful for bootstrapping coverage and cross-checking our captures, but not enough by itself because anyone can index the same public rows.",
        limitations: "Treat as seed and corroboration, not the final product."
      },
      {
        source: "Direct actor infrastructure collection",
        role: "owned_collection_target",
        summary: "Metadata-first collection from actor-controlled public leak/extortion infrastructure where policy allows.",
        buyerValue: "This is where defensible value comes from: faster discovery, verified claims, freshness deltas, actor-page changes, and watchlist alerts that are not just copied from another index."
      },
      {
        source: "RansomLook markets/crypto/notes/leaks/urls/torrent-health",
        role: "rejected_paid_rows",
        summary: "Mostly infrastructure, aliases, wallet references, old breach inventory, or sensitive-adjacent distribution metadata.",
        buyerValue: "Keep as analyst context or actor overview enrichment only; do not sell as paid rows for now."
      },
      {
        source: "Infostealer and credential-exposure metadata",
        role: "owned_collection_target",
        summary: "Potentially high-value if collected as metadata and routed through safety review.",
        buyerValue: "Valuable for company/domain exposure alerts, but it must avoid credential values, raw dumps, private access, auth bypass, and unsafe redistribution."
      }
    ],
    ownedCollection: {
      priority: "primary",
      summary: "The long-term system should run isolated collectors and parsers that verify claims directly, store safe metadata, and feed the threat actor graph and notification pipeline.",
      requirements: [
        "isolated disposable collectors",
        "metadata-only storage by default",
        "source, freshness, hash, and provenance tracking",
        "no raw leak downloads or credential values",
        "review queues for sensitive or ambiguous captures",
        "actor/victim/domain graph edges for the overview UI"
      ],
      prohibited: [
        "raw leaked files",
        "credential values",
        "private or authenticated communities",
        "CAPTCHA bypass",
        "threat actor interaction",
        "payload or dump redistribution"
      ]
    },
    distribution: {
      primarySurface: "hanasand.com",
      secondarySurface: "apify",
      summary: "hanasand.com is the product surface for monitoring, notifications, and actor overview. Apify is secondary distribution only and should not dictate the product shape."
    }
  };
}
