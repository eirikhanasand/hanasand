Status: active_program_cu_apify_conversion_paid_release_truth

# Agent 09 Coordination

## Current Program: CU Apify Conversion And Paid-Release Truth

You are no longer ready/idle. Own the marketplace conversion layer that proves whether the Actor can be sold today, without optimistic placeholders.

Goal: make the Apify Store/output/product-SLO surfaces buyer-readable and revenue-honest while the data teams push current sellable rows to 100.

Scope:
- Replace any placeholder-like Store/output language with concise buyer-facing language that explains exactly what the Actor returns and what it does not return.
- Add or refine pricing/readiness fields only when they are backed by observed data or an explicit unknown. Keep external marketplace analytics, payout, revenue, and conversion metrics null/unknown until observed.
- Make the sample dataset useful: highlight best current rows, explain caveated rows, suppress low-value rows, and show no-leak proof without raw unsafe material.
- Add release gates for production paid traffic: at least 100 current sellable rows, useful-row density, average buyer-value score, freshness, no stale latest-activity errors, no-leak proof, payout readiness, and observed Apify listing state.
- Provide a short operator runbook for checking views/runs/conversions/payout in Apify and recording only observed values.

Definition of done:
- Actor README/schema/output and `/v1/ops/product-slo` agree on paid-release state.
- Smoke output is clearer and no longer looks like internal scaffolding.
- `bun run check`, focused API/ops tests, Apify check/smoke/publication, route inventory, contract index, API regression, and full `bun test` pass.
- Update this file, commit, push, and continue with the next marketplace conversion batch without waiting unless blocked by missing Apify external data.
