Status: ready_for_next_marketplace_api_product_surface_task

# Agent 09 Coordination

- Completed Program CB: 100 sellable row marketplace contract.
- Buyer-visible Apify docs, launch checklist, changelog, publication checks, Actor output, and `/v1/contracts#apifyStoreReadiness` now distinguish the hosted `0.6.7` 10-row run as `shape_safety_proof`, not production paid-traffic readiness.
- Production paid traffic is blocked until a run has at least 100 sellable rows, at least 25% sellable rows, and average buyer value at or above 0.55; fake readiness from caveat-heavy, low-value, or proof-sized runs is blocked.
- Buyer-facing row/filter fields remain exposed for sellable-row review: actor, row type, `whyWorthPayingFor`, victim/sector/country/TTP/source-family pivots, confidence, freshness, provenance hash, contradiction state, no-leak proof, and billing guidance.
- Payout, analytics, runtime, usage cost, views, users, paid runs, revenue, and refunds remain external Apify values and are not invented.
- Verification completed: `bun run check`, `bun test src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:apify-publication`, and `bun run check:contract-index`.

Agent 09 is ready for the next marketplace/API product-surface task.
