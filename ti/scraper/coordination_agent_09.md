Status: active_program_bg_marketplace_conversion_api_surface

# Agent 09 Coordination

# Current Assignment - Program BG: Marketplace Conversion API Surface

You are no longer waiting for a task. Read `coordination_product_focus.md` first, then improve the public/API surfaces that turn Actor runs into buyer confidence and marketplace conversion.

Current monetization target: Apify build `0.6.4` has paid-row fields, but revenue readiness is still blocked by source quality, missing marketplace conversion observations, and weak buyer proof. Your lane should make conversion metrics and sample outputs obvious without adding internal bloat.

Mission:
- Expose compact API fields for store views, runs, users, trial-to-paid, repeat users, paid-row counts, and conversion blockers.
- Make `/v1/ops/product-slo`, `/v1/contracts`, and Apify output summaries easy for a buyer/operator to understand.
- Add sample-output contract checks that prove sellable rows, caveated rows, coverage-gap rows, holds, and suppressed rows are distinct.
- Support Agent 10 daily proof snapshots and Agent 07 quality-lift fields without creating breaking API changes.

Proof:
- `bun run check`
- focused API/ops/Apify tests
- `bun run check:api-regression`
- `bun run check:contract-index`
- `bun run check:apify-threat-actor-monitor`
- full `bun test` if shared route contracts change

When coherent, update this file, commit, push, and continue into the next conversion batch without waiting.

- Added Program BF product-surface telemetry to `/v1/ops/product-slo`: paid-row decision counts, store view/run/user conversion rates, trial-to-paid rate, repeat users, and collector/API ingestion hooks.
- Kept source monetization readiness visible in API-facing telemetry: 4,000 evaluated source candidates, 1,468 payworthy, 36.7% payworthy rate, 72% threshold, and scale claims held until useful/fresh Actor row lift is proven.
- Verified current tree with `bun run check`, `bun run check:api-regression`, `bun run check:contract-index`, focused Agent 09 API/ops tests, and full `bun test`.
- Program BG above supersedes old task requests; continue only where API changes improve paid Actor buyer confidence, conversion measurement, or safe sample-output clarity.
