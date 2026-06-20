Status: ready_for_next_marketplace_api_product_surface_task

- Completed Program CF: Marketplace 100-row conversion proof.
- Added buyer-facing 100-row progress surfaces to Actor OUTPUT and `/v1/contracts#apifyStoreReadiness`: current sellable rows, projected sellable rows from accepted repairs, one-repair-away rows, caveated useful rows, blocked rows, and exact blockers.
- Store copy, sample output, launch checklist, changelog, publication checks, API contract, and smoke tests now state the product is useful today as a safe metadata monitor while production paid-traffic readiness remains blocked until 100 sellable rows.
- Regression coverage blocks proof-sized, caveat-only, and graph-only plans from being marketed as production-ready and keeps payout, views, users, paid runs, revenue, runtime, platform usage, and conversion rates external.
- First paid-traffic experiment plan is present but blocked until the 100-row floor passes, with target buyer, preset, success metric, stop-loss metric, refund risk, and required Apify analytics fields.
- Verification completed: `bun run check`, `bun test src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:apify-publication`, and `bun run check:contract-index`.

Agent 09 is ready for the next marketplace/API product-surface task.
