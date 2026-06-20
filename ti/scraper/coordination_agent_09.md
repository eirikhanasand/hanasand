Status: active_program_by_apify_conversion_telemetry_loop

# Agent 09 Coordination

- Completed Program BT marketplace revenue conversion loop for the Apify public threat actor monitor.
- Added compact revenue conversion proof across `/v1/ops/product-slo`, `/v1/contracts#apifyStoreReadiness`, and Actor `OUTPUT`: listing/sample/pricing/telemetry/payout states, fake-traction guards, no-leak sample proof, and the exact Apify analytics/billing manual verification step.
- Added concrete pricing proof fields for starter trial, paid daily monitoring, usage-cost guardrails, stop-loss criteria, and payout/revenue separation without inventing unverified traction.
- Added 12 safe buyer sample rows with actor/fresh-claim/victim-or-dataset/TTP hints, confidence, caveats, freshness, source-family diversity, provenance hashes, next analyst pivots, and no-leak proof.
- Tightened API, ops, contract-index, Apify check, smoke, and focused tests so unpaid starts, synthetic users, unknown payout state, and unsafe sample leakage cannot pass as marketplace readiness.
- Updated Actor README and launch checklist with conservative listing/pricing/payout-readiness language.
- Verification completed: `bun run check`, `bun test src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and full `bun test`.

You are not idle. Continue as the marketplace/API owner, but only add work that improves paid conversion, payout proof, buyer trust, or Apify Store usefulness. Do not build generic API/enterprise layers unless they change the Actor listing, dataset rows, pricing proof, analytics proof, or buyer samples.

## Program BY - Apify Conversion Telemetry Loop

Goal: make the Actor objectively revenue-measurable. Operators should be able to copy Apify analytics/billing numbers into one snapshot command and see whether paid traffic is ready, blocked by payout, blocked by sample quality, blocked by conversion, or blocked by cost.

Work in this order:

1. Inspect `scripts/collect-product-slo-snapshot.ts`, `/v1/ops/product-slo`, `/v1/contracts#apifyStoreReadiness`, Actor `OUTPUT`, README, and launch checklist for missing or stale marketplace fields.
2. Ensure the product snapshot path accepts and preserves all Apify facts needed for monetization:
   - store views
   - unique users
   - trial runs
   - paid runs
   - actor starts
   - actor runs
   - dataset rows
   - failed runs
   - repeat users
   - refunds
   - platform usage cost
   - creator revenue
   - beneficiary verification
   - payout method readiness
   - withdrawal readiness
3. Add tests or smoke proof that a fully populated marketplace snapshot changes payout readiness, conversion rates, usage-cost guardrails, and next revenue action without inventing unknown numbers.
4. Add one compact operator runbook section that says exactly which Apify console fields to copy and how to run the snapshot command.
5. Tighten fake-traction guards: local sample runs, owner runs, and synthetic proof rows must never be counted as users, paid runs, revenue, or conversion.
6. Update Actor README only if it improves buyer trust or explains pricing/output clearly. Avoid placeholder claims and inflated revenue language.
7. Handoff data quality blockers to Agents 01/03/04/05/07/08 and economics/deployment blockers to Agent 10.

Metric targets:

- A populated snapshot with real marketplace values should remove telemetry/payout unknown blockers.
- A missing snapshot should continue to say unknown, not ready.
- Conversion and cost values must be visible enough to decide whether to send paid traffic.
- No unverified views, users, paid runs, revenue, payout status, or buyer claims.

Proof required before marking ready:

- `bun run check`
- `bun test src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:contract-index`
- `bun run check:route-inventory`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- A note here with telemetry fields covered, blockers removed or preserved, fake-traction guards, docs changed, and exact remaining external Apify blockers.

When a coherent patch is complete: update this file, commit, push, and continue into the next marketplace conversion batch without waiting. Leave no dangling dirty files.
