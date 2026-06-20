Status: active_program_ct_apify_conversion_from_100_real_rows

# Agent 09 Coordination

- Completed Program CL marketplace conversion from real rows.
- Added `marketplaceConversionRealRowSamplePack` across Apify Actor `OUTPUT`, `/v1/contracts#apifyStoreReadiness`, and `/v1/ops/product-slo` with real safe sample rows, buyer-useful pivots, provenance hashes, no-leak proof, exclusions, and paid-traffic gating.
- Kept synthetic, graph-only, stale, restricted-only, caveat-only, held, and coverage-gap rows out of paid-readiness proof.
- Added marketplace telemetry descriptors for Store views, runs, paid runs, retention, refund risk, cost/useful row, and useful-row density with values held at `external_unknown` unless externally verified.
- Updated Actor README, launch checklist, schemas, changelog, publication checks, smoke checks, API contract tests, and ops tests.
- Verification green: `bun run check`, `bun test src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:apify-publication`, `bun run check:contract-index`, `bun run check:route-inventory`, `bun run check:api-regression`, and full `bun test` (529 pass).

# Current Task: Program CT Apify Conversion From 100 Real Rows

Own the marketplace conversion surface, but tie every change to real data. The Store page, schemas, examples, and pricing proof should make the Actor easier to buy once the first 100 chargeable rows exist; they must not imply production scale before the row floor is met.

Scope:
- Extend the Apify output and Store-facing docs around the path to 100 real rows: current sellable count, useful-but-not-chargeable count, top blocker buckets, no-leak proof, freshness proof, and exact row examples that are safe to show.
- Prepare a buyer-facing sample pack format for the first 100 rows, but keep it blocked/preview until Agent 10 release truth says the 100-row paid floor is met.
- Make README, schemas, launch checklist, and smoke/publication checks clear, compact, and human-written. Remove placeholder wording, TODO pricing, inflated claims, and any text that reads like internal agent coordination.
- If real Apify analytics, payout, pricing, or conversion data is available from safe local/console state, wire it as observed. Otherwise keep it explicit `external_unknown`; do not fabricate customers, views, revenue, payout readiness, or demand.
- Coordinate with Agent 03/04/05/07/08/10 so Store copy reflects what rows actually contain: claims, victims, targeting, TTP/tool, dataset claim, freshness, confidence, provenance, contradictions, source coverage, and next pivots.

Definition of done:
- Apify Actor check/smoke/publication gates prove the Store/output surface cannot claim production paid readiness before 100 real sellable rows.
- Buyer-facing docs and schemas explain exactly what is useful now and what is blocked, without bloat or fake scale.
- Update this file and `coordination.md`, run appropriate Bun checks/tests, commit and push a coherent green change.
- If finished early, continue improving sample-row clarity and pricing/conversion evidence rather than stopping.
