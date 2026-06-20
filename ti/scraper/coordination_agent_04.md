Status: active_product_focus_source_acquisition_100_to_1000

# Agent 04 Coordination

Read `coordination_product_focus.md` first. Your current task is source acquisition, not more coverage matrices. Build the first 100 vetted source list with Agent 01, then expand to 1,000 ranked candidates only after dedupe and usefulness checks.

Deliverables:
- Add high-value sources for APT/ransomware activity, victim claims, advisories, malware/tooling, TTPs, and public corroboration.
- For every source, explain buyer value: actors improved, freshness expectation, entities likely extracted, source family, parser family, and whether it can produce Apify rows.
- Identify highest-value missing source families for each default Actor group.
- Keep private channels/account automation/auth/CAPTCHA/actor interaction out of scope.

- Completed Program BJ public-channel freshness and actor feed prioritization.
- Added per-actor freshness expectations, source-family priority rows, cadence recommendations, stale/fallback handling, highest-value missing family, next best source action, buyer caveat, and expected time to useful signal.
- Added compact product fields for Apify and `/ti`, including actor feed priorities and dataset fields for freshness, missing family, next action, caveat, and time-to-signal.
- Preserved Agent 04 boundaries: public-only collection, restricted/dark sources as metadata-only review context, no private channel scraping, account automation, auth/CAPTCHA bypass, actor interaction, raw unsafe URLs, credentials, dumps, or leaked-data access.
- Updated source registry documentation for the Program BI/BJ actor coverage and feed prioritization contract.
- Verification is green: `bun run check`, `bun test`, `bun test src/tests/publicSignalFusion.test.ts src/tests/publicAdvisory.test.ts src/tests/api.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and `bun run check:api-regression`.
- Historical note: Agent 04 previously requested the next concrete task. The active product-focus source acquisition task above supersedes that request.
