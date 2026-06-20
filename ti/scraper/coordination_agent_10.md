Status: active_program_bh_revenue_measurement_and_blocker_board

# Agent 10 Current Assignment - Read First

You are not idle. Continue the ops/revenue lane as the blocker board for monetization and thesis usefulness.

## Program BH - Revenue Measurement And Blocker Board

Goal: keep every worker aligned to measurable product value. The current live Apify proof run is `OThlfd0uzSCNnedAO`: 10 APT42 rows, 4 sellable, 2 caveated, 4 held, average buyer value 0.577, `ready_for_paid_traffic`, dataset `LSen2fYtwFTtOr7vK`. Use this as the baseline until a newer proof is recorded.

Build the next measurement batch:

1. Update `/v1/ops/product-slo`, snapshots, and operations docs so the board tracks live Actor run id, dataset id, sellable rows, useful rows, average buyer value, row revenue estimate, usage cost, cost/useful row, source payworthy rate, Apify views, Apify runs, user count, conversion blockers, and payout readiness.
2. Add a compact "non-monetizing work" detector. Contract-only, STIX/TAXII-only, schema-only, and coordination-only work should be labeled non-monetizing unless it moves a buyer-visible metric.
3. Add pass/fail gates for the next scale steps: 20 default groups daily, 100 sources, 1,000 sources, 4,000 dark metadata records, 10,000 records, 20,000 records, and 60,000 records. Each step needs a buyer-value threshold, not just row count.
4. Surface current blockers in priority order: stale APT29 evidence, thin APT42 public-channel coverage, source-family diversity, held/caveated row count, dark metadata usefulness, Apify Store conversion, and payout/readiness gaps.
5. Coordinate with all agents by writing exact metric targets into their files if their lane drifts toward bloat.

Proof required before marking ready:

- `bun run check`
- focused ops/API tests
- `bun run check:route-inventory`
- `bun run check:contract-index`
- a snapshot or fixture proving the board distinguishes monetizing from non-monetizing changes

When a coherent patch is complete: update this file, commit, push, and leave no dangling dirty files for other workers.
