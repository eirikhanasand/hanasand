# Source Registry Operator Notes

## Purpose
The source registry controls what the scraper may collect and how each source should be handled.

## Source Fields
- `id`, `name`, `type`, `url`, `accessMethod`, `status`.
- `trustScore`, `crawlFrequencySeconds`, `language`, `tags`.
- `risk`, `legalNotes`, `approvedAt`, `approvedBy`.
- `governance.metadataOnly` for restricted or darknet sources.
- `crawlState` for backoff, last collection, and retries.

## Activation
1. Import or create candidate sources.
2. Run policy and adapter checks.
3. Activate only sources that can produce buyer-visible actor/victim/TTP/source pivots.
4. Keep low-value, stale, duplicate-heavy, or generic sources inactive.

## Recommended Source Mix
- High-signal vendor blogs and advisories.
- CERT/government feeds.
- Public ransomware/actor metadata pages.
- Public Telegram/channel sources where legal and API-safe.
- Search-result discovery sources that produce current, corroborated leads.

## High-Value Exposure Candidate Pack
`seeds/high_value_exposure_source_candidates.json` is the current sellable-source expansion pack.
It is dry-run only and must not activate crawling by import. The pack prioritizes sources that
help customer monitoring rather than generic CTI volume:

- `urlscan.io` for brand/domain phishing and suspicious page discovery.
- `Have I Been Pwned` domain, breach, and stealer-log metadata for authorized customer domains.
- `ThreatFox` recent IOC metadata for malware/infrastructure enrichment.
- `URLhaus` active malware URL/hostname metadata for fresh infrastructure matching.
- `ransomware.live` as victim/group/infostealer seed data that should lead to direct verification,
  not public-row resale.
- Certificate Transparency search for brand/domain drift and lookalike infrastructure.

Activation rule: treat these as source-atlas candidates first. Each candidate needs terms review,
commercial-use review where applicable, parser certification, canary output, dedupe proof, freshness
score, and customer-watchlist value before moving into active collection.

Buyer value rule: the paid product is not access to these public sources. The paid product is a fast,
filtered alert and actor/company overview that joins watchlists, direct actor-page verification,
freshness, source confidence, and safe metadata review.

## Rejection Reasons
- Private/auth/CAPTCHA access required.
- Raw credential or leaked payload retrieval.
- Unsafe URL shape or payload/download affordance.
- Duplicate-only or stale-only output.
- Too generic to support actor-specific intelligence.

## SLOs
- Fresh actor rows should show first/last seen and provenance.
- Sources should maintain useful-row density, not just capture volume.
- Coverage expansion should move 100 to 1,000 to 4,000+ rows only when row quality remains payworthy.
