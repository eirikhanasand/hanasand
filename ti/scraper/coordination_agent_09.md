Status: active_program_bj_marketplace_conversion_and_payout_proof

# Agent 09 Coordination

- Completed the Program BI/BR product-surface pass for measurable marketplace and freshness readiness.
- `/v1/ops/product-slo`, `/v1/contracts`, route inventory, and relevant API tests now expose compact live monetization, quality-conversion, live-freshness, darkweb tier-10,000 refresh/search value, evidence search read-model, and Apify proof surfaces without unsafe payload leaks.
- Preserved null/unknown traction semantics so unverified analytics are not displayed as real marketplace demand.
- Verification is green for `bun run check`, focused API/ops/darkweb/pipeline/storage tests, route inventory, contract index, and full `bun test` (527 pass).

## Main Agent Assignment - 2026-06-20 20:35 CEST

You are not idle. Continue as the owner of marketplace conversion, payout readiness, and buyer-facing product contracts. The goal is to prove whether the Apify Actor can earn, not to add generic API polish.

## Program BJ - Marketplace Conversion And Payout Proof

Goal: make revenue readiness measurable from real or explicitly-null marketplace data. Buyers should see a clean product; operators should see views, starts, runs, rows, conversion, costs, payouts, and blockers without fake traction.

Work in this order:

1. Add a compact Apify marketplace telemetry input contract for store views, unique users, trial runs, paid runs, actor starts, dataset rows, failed runs, repeat users, refunds, platform usage cost, estimated creator revenue, payout method state, beneficiary state, and withdrawal readiness.
2. Expose telemetry only through existing product surfaces: `/v1/ops/product-slo`, `/v1/contracts#apifyStoreReadiness`, route inventory, and Apify output summary if already appropriate. Do not create a new endpoint unless existing surfaces cannot carry the data.
3. Keep all unverified metrics as `null` or `unknown`; add tests that fail if synthetic views, fake users, invented paid runs, or placeholder payout claims appear as real traction.
4. Add three conversion experiment slots with concrete success/stop-loss criteria:
   - starter actor-query pack for low-cost evaluation users
   - high-freshness APT monitoring pack for daily actor activity
   - ransomware/public-claim metadata pack for victim/dataset leads
5. Tie every experiment to buyer-visible output fields: sellable row count, useful row count, freshness, actor/victim/TTP specificity, source-family diversity, confidence, caveats, next pivots, and no-leak proof.
6. Add an operator blocker board mapping low conversion to owners: Agent 01 source value, Agent 03 parser specificity, Agent 04 public-channel/source coverage, Agent 05 dark metadata usefulness, Agent 07 freshness and bloat suppression, Agent 08 graph pivots, Agent 10 release economics.
7. Update Apify listing/readiness copy only if needed, keeping it human, concise, and free from placeholder or AI-generated language. Do not inflate claims beyond the proof runs.

Metric targets for this batch:

- Marketplace telemetry fields are route-visible with real/null semantics.
- Payout readiness explicitly says what is verified externally versus unknown.
- Conversion experiments have measurable thresholds and buyer row fields.
- Product SLO can say whether the next action is paid traffic, listing repair, data-quality repair, pricing test, or payout setup.

Proof required before marking ready:

- `bun run check`
- `bun test src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- A note here listing telemetry fields, conversion experiments, fake-traction guards, payout blockers, owner handoffs, and no-leak proof.

When a coherent patch is complete: update this file, commit, push, and continue into the next marketplace conversion batch without waiting. Leave no dangling dirty files.
