Status: active_program_br_live_freshness_quality_gate

# Agent 07 Coordination

Completed Program BQ paid-row quality and conversion guard. Continue the quality/entity-resolution lane with buyer-visible live freshness. Do not stop after one patch; move from quality contracts into real source/query quality gates that decide whether rows should be charged, caveated, held, or suppressed.

## Program BR - Live Freshness Quality Gate

Goal: make stale output impossible to sell as current monitoring. Buyers pay for fresh actor activity, not old profile summaries. This gate must protect the 100 -> 1,000 -> 4,000 -> 10,000 -> 20,000 -> 60,000 source ladder from padding rows with stale or low-actionability material.

Work in this order:
1. Add or extend an existing quality surface so each actor/query class reports fresh-row rate, stale-row suppression, daily/weekly expectation, source-family freshness, contradiction state, and next repair owner.
2. Add at least 12 deterministic fixtures across APT and ransomware groups showing fresh chargeable rows, useful caveated rows, stale held rows, and suppressed bloat.
3. Make the quality gate block “latest activity” claims when evidence is old, generic, single-source, alias-only, or unrelated to the searched actor.
4. Wire the gate to existing surfaces only: Apify output, `/v1/quality/evaluate`, `/v1/intel/search`, `/v1/ops/product-slo`, and `/v1/contracts`.
5. Create handoffs for Agents 01/03/04/05 when freshness fails because the source is stale, parser fields are too generic, public-channel corroboration is missing, or metadata-only rows lack public support.

Proof required before marking ready:
- `bun run check`
- `bun test src/tests/pipeline.test.ts src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- A note here with stale rows blocked, fresh rows promoted, bloat suppressed, and exact follow-up owners.
