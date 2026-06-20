Status: active_program_cq_100_row_release_truth_and_paid_traffic_analytics

# Agent 10 Summary

- Completed Program CM release-gate truth for `/v1/ops/product-slo`: paid traffic stays blocked until real current sellable rows reach 100, with projections, graph-only rows, synthetic proof rows, stale rows, restricted-only metadata, and caveated rows excluded from the paid floor.
- Added/verified an honest 100 -> 1,000 -> 4,000 -> 10,000 -> 20,000 -> 60,000 ladder with current/eligible/rejected counts, density, freshness, source-family support, no-leak proof, cost/useful-row checks, and exact next blockers.
- Added a monetization-impact-ranked `revenueBlockerBoard` with blocker categories, secondary categories, blocked sellable-row estimates, cost-risk visibility, and owner handoffs for the fastest path to 100 real rows.
- Tightened fake-scale tests through `first100AdmissionQuality` so graph-only, synthetic proof, stale/duplicate, restricted-only, caveated, generic market/source-page, low-value, alias, and wrong-actor rows cannot advance paid tiers.
- Kept external Apify proof honest: smoke output remains blocked for paid traffic with 3 chargeable rows, and unverified payout/conversion/revenue analytics remain outside production proof.
- Verification passed: `bun run check`, `bun test src/tests/ops.test.ts src/tests/api.test.ts`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test` (529 pass).

# Current Task: Program CQ 100-Row Release Truth And Paid Traffic Analytics

Own the paid-release truth board from the current proof state to 100 real chargeable rows. The product should be sold only when the data is useful enough, but the path to that point must be exact, visible, and grounded in real rows rather than projections.

Scope:
- Build or tighten a route-visible release board that starts from the current observed proof: Apify smoke has 3 sellable rows, 9 buyer-useful rows, average buyer value around 0.558, and paid traffic is blocked until 100 real sellable rows.
- Show the exact row delta to 100 by owner/source/parser bucket: rows already chargeable, rows blocked by missing public support, parser repair, freshness, alias collision, source-family gap, dark metadata public support, no-leak proof, and marketplace output gap.
- Do not count synthetic rows, graph-only rows, restricted-only metadata, caveated rows, stale rows, generic source pages, or projected rows toward the paid floor.
- If external Apify analytics/payout/listing proof is available through safe local state or the console, expose it as explicit observed fields. If not available, keep fields `external_unknown` or null; do not fabricate views, conversions, revenue, payout state, or customer demand.
- Make the release board useful to the other agents: each blocker should name the fastest next task, expected row gain, confidence, risk, and owning coordination file.
- Keep the work buyer-visible and monetization-aligned. Avoid broad architecture, DTO, STIX/TAXII, or dashboard polish unless it directly improves paid release confidence or conversion proof.

Definition of done:
- `/v1/ops/product-slo` and the Apify smoke/product proof expose an honest paid-release board with no fake metrics and a measurable path to 100 rows.
- Tests prove only real current sellable rows advance paid traffic readiness.
- Update this file and `coordination.md`, run appropriate Bun checks/tests, commit and push a coherent green change.
- If you finish early, continue by turning the largest blocker bucket into concrete task packets for Agents 03/04/05/07/08/09.
