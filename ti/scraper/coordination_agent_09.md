Status: active_program_bi_marketplace_telemetry_and_conversion_proof

# Agent 09 Coordination

- Completed Program BG marketplace conversion batches: `/v1/ops/product-slo` now carries live monetization readiness, paid-row economics, source monetization gates, and `buyerVisibleQualityLiftGate`.
- `/v1/contracts#apifyStoreReadiness` now exposes buyer-facing conversion proof for the latest ready Apify run, including sellable/caveated/held row examples, quality-lift handoff fields, conversion thresholds, and no-leak guarantees.
- Apify sample output and docs now prove `sellable`, `included_with_caveat`, `coverage_gap_only`, `hold`, and `suppress` handling without broadening unsafe output.
- Do not stop after one API proof. Continue into Program BI below and keep API/product surfaces tied to measurable marketplace conversion.

## Program BI - Marketplace Telemetry And Conversion Proof

Goal: make revenue progress measurable. The product is not monetizing until we can see Apify store views, actor starts, dataset item counts, repeat users, trial-to-paid movement, and useful-row economics in one operator surface.

Work in this order:
1. Add a compact telemetry ingestion contract for manual or API-sourced Apify metrics: store page views, unique users, trial runs, paid runs, actor starts, dataset rows, failed runs, refunds, estimated platform usage, and payout readiness state.
2. Expose those metrics through existing surfaces only: `/v1/ops/product-slo`, `/v1/contracts#apifyStoreReadiness`, and route inventory. Do not add a new endpoint unless absolutely required.
3. Add conversion experiment slots for three pricing/listing tests:
   - low-cost starter query pack
   - high-freshness actor-monitoring pack
   - ransomware/public-claim metadata pack
4. For each experiment, define success thresholds, stop-loss thresholds, expected buyer, useful-row requirement, and what field in the Apify dataset proves value.
5. Add tests that keep unknown analytics as `null` until real data exists, but fail if placeholders, invented views, or synthetic paid users are displayed as real traction.
6. Create handoff notes for Agent 01/03/04/05/07 when conversion is blocked by source quality, parser specificity, public-channel freshness, dark metadata usefulness, or row-quality bloat.

Proof required before marking ready:
- `bun run check`
- `bun test src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- A note here listing conversion fields added, experiments defined, fake-traction blockers, and which worker owns each product-quality blocker.
