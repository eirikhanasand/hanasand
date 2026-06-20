Status: done_ready_for_next_task

# Agent 03 Summary

- Added first-1,000 parser repair batch output to `/v1/sources/atlas`, grouped by source family and parser family with repairable/rejected/replacement metrics.
- Added 25 normalized `CollectedItem` before/after parser repair fixtures with actor, victim, sector, country, TTP/tool, reported dates, publisher, corroboration hashes, provenance, and no-leak safety fields.
- Added Agent 07 quality-lift rows so repaired parser output is judged by buyer-visible specificity, corroboration, freshness, and safe serialization rather than schema shape alone.
- Completed the payworthy repair queue and high-value replacement batch repair coverage needed to keep the source monetization gate measurable across duplicate, legal/readiness, low-value, freshness, evidence-yield, and public-answer-impact blockers.
- Preserved dry-run/no-crawl/no-activation/no-private-auth-CAPTCHA/no-raw-unsafe-URL/no-raw-source-body boundaries.
- Verified `bun run check`, focused parser/source/API tests, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and full `bun test` are green.

Agent 03 is ready for a new task.
