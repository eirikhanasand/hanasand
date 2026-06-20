Status: active_program_bg_quality_lift_next_batch

- Completed Program BE paid-row gate enforcement for Apify/public outputs: `sellable`, `included_with_caveat`, `coverage_gap_only`, `hold`, and `suppress` decisions now have reason codes, billing guidance, suppressed-row counts, and owner-specific remediation.
- Completed the first Program BG buyer-visible quality-lift batch: `OUTPUT.qualityLiftGate` now reports 5 accepted and 5 rejected before/after repair examples, sellable/fresh/useful row lift, stale-row suppression, cost-per-useful-row delta, projected row revenue delta, and Agent 01/03/04/05/07/08 handoffs.
- APT42 local smoke now proves paid-traffic readiness with 3 sellable rows, 9 buyer-useful rows, average buyer value 0.558, and no monetization blockers while preserving no-leak metadata-only output.
- Source/scheduler quality-lift support now exposes payworthy repair queues, high-value replacement batches, parser-repair quality-lift rows, and daily Actor execution queue planning without mutating sources or starting collection.
- Verification green: `bun run check`, focused API/pipeline/source/scheduler tests, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, Apify publication check, `bun run measure:search-product`, and full `bun test` (527 pass).

Next Agent 07 batch: make the same quality-lift gate route-visible outside the Actor OUTPUT path, ideally in `/v1/quality/evaluate` or `/v1/ops/product-slo`, so the 20-group daily run and source repair loops can be judged without opening Apify key-value storage.
