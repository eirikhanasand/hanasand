Status: active_program_cx_observed_marketplace_telemetry_and_paid_release_runbook

# Agent 10 Summary

- Completed Program CW paid conversion observability and release control for `/v1/ops/product-slo`, `/v1/contracts#apifyStoreReadiness`, and Apify Actor `OUTPUT`.
- Added route-visible `conversionObservability` fields for `current_sellable`, `projected_after_repair`, `blocked_by_public_support`, `blocked_by_parser`, `blocked_by_freshness`, `blocked_by_suppression`, `blocked_by_no_leak`, and `external_marketplace_unknown`.
- Kept current paid inventory grounded in observed Apify smoke output while keeping the 159 one-repair-away SLO projection marked `canCountNow: false`.
- Preserved external marketplace truth: Store views, Actor runs, paid runs, pricing, payout, refunds, revenue, and conversion remain `external_unknown`/null unless externally observed.
- Verification passed: `bun run check`, focused API/ops tests, Apify Actor check/smoke, route inventory, contract index, API regression, focused darkweb test, and full `bun test` (529 pass).

# Current Task: Program CX Observed Marketplace Telemetry And Paid Release Runbook

You are no longer idle. Own the next monetization-control pass that turns the product from internally promising into externally measurable.

Scope:
- Keep `paidReleaseTruthBoard` and `conversionObservability` grounded in observed data only. Never count projected rows, graph-only pivots, caveated rows, dark-metadata-only rows, source counts, or worker claims as current sellable rows.
- Add an observed telemetry ingestion contract for Apify Store analytics and billing fields: Store views, unique users, trial runs, paid runs, actor starts, actor runs, dataset rows, failed runs, repeat users, refunds, platform usage cost, estimated creator revenue, payout state, and pricing state.
- If external telemetry is unavailable locally, keep every value `external_unknown`/`null` and expose the exact manual/API import path, validation checks, and proof commands needed to fill it later.
- Produce a paid-release runbook with promote/hold/rollback rules tied to measurable gates: 100 current sellable rows, >=25% sellable row rate, >=40% useful row density, >=0.55 average buyer value, no-leak proof green, no stale latest-activity errors, no refunds, and known payout readiness.
- Keep this focused on buyer-visible monetization. Do not add STIX/TAXII economics, broad dashboards, or architecture layers unless they directly change paid release, conversion measurement, or refund risk.

Definition of done:
- `/v1/ops/product-slo`, `/v1/contracts#apifyStoreReadiness`, and Apify `OUTPUT` show the same observed-vs-projected monetization truth.
- Tests prove unknown external metrics stay unknown, observed metrics validate schema/ranges, and paid traffic remains blocked unless all gates pass.
- Update this file and `coordination.md`, run `bun run check`, focused API/ops/Apify checks, and full `bun test` when practical, then commit and push a coherent green patch.
