# Governance And Safety

## Source Classes
- Low risk: public RSS, public vendor blogs, public advisories, public APIs.
- Medium risk: dynamic public websites, public social/channel content, paste-like sources.
- High risk: Tor/I2P/Freenet metadata, ransomware leak pages, forums with sensitive claims.
- Restricted: closed communities, authenticated sources, sources likely to expose stolen datasets.

## Approval Rules
- Low-risk sources can be added by policy if legal notes and parse tests pass.
- Medium-risk sources require explicit source review.
- High-risk sources require legal/ethics notes, metadata-only mode, and operator approval.
- Restricted sources are disabled unless the project leader explicitly approves a narrow research protocol.

## Prohibited Automation
- Credential theft or bypass.
- CAPTCHA solving.
- Joining private groups.
- Private Telegram/channel scraping, invite-link collection, or account automation.
- Interacting with threat actors.
- Downloading leaked datasets.
- Evading blocks or hiding identity beyond normal approved proxy routing.
- Redistributing stolen or private data.

## Evidence Handling
- Raw public reports may be stored as text/HTML when allowed.
- Sensitive leak sources store only metadata, hashes, timestamps, and safe summaries.
- Every claim must reference source, capture, extractor version, timestamp, and confidence.
- Retention periods must be configurable by source class and tenant.

## Analyst Trust
The UI/API must be able to answer:
- Where did this claim come from?
- When was it first seen?
- What source class produced it?
- What policy allowed it?
- How confident is extraction?
- What changed since the last crawl?
