Status: active_program_cm_release_gate_real_100_rows_and_60k_ladder

# Agent 10 Summary

- Completed Program CG 100-row release decision and revenue truth for `/v1/ops/product-slo`.
- Added `releaseDecision` with current sellable rows, useful caveated rows, rows blocked from billing, one-repair-away rows, projected accepted-repair lift, cost/useful row, paid-traffic hold/promote decision, and external Apify analytics/payout/revenue truth.
- Added tier-gate truth for 100, 1,000, 4,000, 10,000, 20,000, and 60,000 rows with current/eligible/rejected counts, payworthy density, freshness, source-family diversity, no-leak proof, and next action.
- Confirmed synthetic, graph-only, stale, restricted-only, and caveat-only rows do not count as sellable for the 100-row paid-traffic floor.
- Verification passed: `bun run check`, `bun test src/tests/ops.test.ts src/tests/api.test.ts`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test`.

# Current Task: Program CM Release Gate For Real 100 Rows And Honest 60k Ladder

Own the revenue truth gate. The product must not look monetized because of projections, contracts, graph pivots, or source counts. It becomes production paid-data only when real output contains enough buyer-useful, fresh, safe, corroborated rows.

Scope:
- Keep paid traffic blocked until `currentSellableRows >= 100` from actual current output, not projected repairs, graph support, synthetic rows, stale rows, restricted-only rows, or caveated rows.
- Make the tier ladder honest for 100 -> 1,000 -> 4,000 -> 10,000 -> 20,000 -> 60,000. Each tier should report current rows, eligible rows, rejected rows, payworthy density, freshness, source-family diversity, no-leak proof, cost/useful row, and the exact next blocker.
- Add or tighten tests that reject fake scale: graph-only rows, directory-only rows, unsupported onion index entries, stale reposts, low-value generic markets, caveat-only rows, and uncorroborated restricted metadata must not advance paid tiers.
- Add a route-visible blocker board ranked by monetization impact: missing real rows, parser field gaps, source support gaps, freshness gaps, evidence/provenance gaps, Apify listing/payout/analytics gaps, and cost risks.
- Keep external Apify proof honest. If payout, paid runs, views, conversion, retention, or revenue are not verified, mark them as external unknown rather than estimated proof.
- Coordinate with Agent 03 for parser repairs, Agent 05 for dark metadata candidate quality, Agent 07 for false-positive/quality holds, Agent 08 for graph support that does not count as rows, and Agent 09 for marketplace truth.

Definition of done:
- `/v1/ops/product-slo` clearly says what is blocking paid traffic today and which work will increase sellable rows fastest.
- Tier ladder advancement is measurable and cannot be inflated by non-sellable data.
- `bun run check`, focused ops/API/Apify tests where relevant, contract checks, API regression, and full `bun test` are green.
- Update this file and `coordination.md`, then commit and push a coherent change. Do not leave dirty files behind.
