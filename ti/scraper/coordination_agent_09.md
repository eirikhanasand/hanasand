Status: active_program_bt_marketplace_revenue_conversion_loop

# Agent 09 Coordination

You are not idle. Continue as the owner of Apify marketplace conversion, payout readiness, pricing evidence, and buyer-facing listing quality. The goal is to turn the Actor into a product that can earn from useful fresh data, not to add generic platform polish.

## Current Baseline

- Live Apify proof baseline: run `OThlfd0uzSCNnedAO`, dataset `LSen2fYtwFTtOr7vK`.
- Current proof quality: 10 APT42 rows, 4 sellable, 2 caveated, 4 held, average buyer value 0.577, `ready_for_paid_traffic`.
- Keep real marketplace telemetry as real values only when externally verified. Unknown views, users, starts, paid runs, refunds, and payouts must remain `null` or `unknown`; never invent traction.
- Coordinate with Agent 10 for blocker-board economics and with Agents 01/03/04/05/07/08 for data quality issues that reduce conversion.

## Program BT - Revenue Conversion Loop

Goal: make the next marketplace pass directly measurable in revenue terms: clearer listing, stronger sample output, honest pricing, conversion instrumentation, payout readiness, and a buyer-visible reason to pay.

Work in this order:

1. Audit current Apify listing assets, README, input schema, output schema, examples, and pricing notes for placeholder text, vague claims, or wording that sounds generated. Replace only with short, specific, human copy tied to proof rows.
2. Add a compact conversion checklist to existing product surfaces only: `/v1/ops/product-slo`, `/v1/contracts`, Apify `OUTPUT`, and the Actor README if relevant. Do not create a new endpoint.
3. Add or refine pricing proof fields:
   - starter trial shape for cheap evaluation
   - paid daily-monitoring shape for APT/ransomware activity
   - usage-cost guard so creator revenue is not eaten by platform compute
   - stop-loss criteria when conversion, freshness, or paid row density is poor
4. Add buyer sample rows that demonstrate value without unsafe material:
   - actor summary
   - fresh claim or public activity
   - victim/sector/country/dataset hints when available
   - TTP/targeting hints when supported
   - confidence, caveat, freshness, source-family diversity, provenance hash
   - next analyst pivots
   - explicit no-leak proof
5. Add fake-traction guards and payout blockers to tests: unpaid starts cannot be reported as customers, synthetic users cannot appear as demand, payout setup must distinguish verified payment method from unknown withdrawal readiness.
6. Compare the Actor against common Apify scraper listings only at the level of buyer-visible output, pricing clarity, and store conversion mechanics. Do not add marketing fluff or unsupported claims.
7. If telemetry is still unavailable from Apify APIs or the browser session, expose that as a blocker with the exact next manual verification step.

Metric targets for this batch:

- Every product/readiness surface states whether the Actor is ready for paid traffic, blocked by listing copy, blocked by payout setup, blocked by sample data quality, or blocked by missing telemetry.
- At least 12 buyer sample rows or examples are traceable to safe output fields and no-leak proof.
- Pricing notes are concrete enough to publish but conservative enough to avoid refund risk.
- Payout readiness separates payment method, beneficiary/tax state, withdrawal readiness, and externally verified revenue.

Proof required before marking ready:

- `bun run check`
- `bun test src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- A note here listing listing changes, pricing fields, fake-traction guards, payout blockers, sample-row lift, conversion experiments, and no-leak proof.

When a coherent patch is complete: update this file, commit, push, and continue into the next marketplace conversion batch without waiting. Leave no dangling dirty files.
