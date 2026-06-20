Status: active_program_bg_daily_revenue_and_source_quality_proof

# Agent 10 Current Assignment - Program BG: Daily Revenue And Source Quality Proof

You are no longer waiting for a task. Read `coordination_product_focus.md` first, then make monetization progress measurable every pass.

Current baseline:
- Deployed Inspur `hanasand_ti_scraper` is healthy after current image build.
- `/v1/ops/product-slo` reports source monetization alert: 4,000 evaluated candidates, 1,468 payworthy, 36.7% payworthy rate, 72% threshold.
- `/v1/sources/atlas` gap closure reports target 2,880 payworthy, shortfall 1,412, repairable pool 1,527, projected 72% after repair.

Mission:
- Create daily proof snapshots that combine Apify Actor run rows, paid-row decisions, useful/fresh/sellable row rates, source payworthy gate, marketplace conversion, and cost/useful-row.
- Make every source/parser/quality/dark-metadata change report monetization delta: payworthy sources added, sellable rows added, fresh rows added, projected row revenue, cost per useful row, and conversion blockers removed.
- Keep public/Inspur proof commands compact and reliable so we can cite exact curl/wget outputs instead of giant JSON blobs.
- Flag bloat: any task that adds schema/export/internal DTOs without improving source quality, row usefulness, freshness, or buyer conversion should be marked non-monetizing.

Proof:
- `bun run check`
- focused ops/API tests
- `bun run check:route-inventory`
- `bun run check:contract-index`
- deployed `/v1/ops/product-slo` compact proof after safe deployment
- full `bun test` if shared contracts change

When coherent, update this file, commit, push, and continue into the next measurement batch without waiting.

# Agent 10 Summary

- Added `sourceMonetizationGate` to `/v1/ops/product-slo` with the current paid-source baseline: 4,000 evaluated candidates, 1,468 payworthy sources, 36.7% payworthy rate, 72% threshold, ready/held tiers, proof-run comparison, blocker codes, and cost/useful-row impact.
- Made `source_payworthy_rate` a blocking product SLO so below-threshold source quality drives dashboard `alert` state instead of being hidden behind otherwise healthy runtime metrics.
- Extended product SLO snapshots with `sourceMonetizationGate` output and `TI_PRODUCT_SLO_SOURCE_*` env/query inputs; stale deployed endpoints now fail snapshot validation if the gate is missing.
- Updated route inventory, contract surface, operations docs, and ops/API tests for source monetization, paid-row decision counts, marketplace conversion metrics, and deployed proof commands.
- Repaired current `public_channel_probe` scheduler/planner type drift without changing resource ceilings or enabling GPU/browser-heavy behavior.
- Verification is green: `bun run check`, `bun test src/tests/ops.test.ts src/tests/api.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, focused scheduler tests, and full `bun test` (527 pass).
- Deployment note: main agent deployed the current scraper image after `bun test` and `bun run check` passed in Docker; `hanasand_ti_scraper` is healthy and `/v1/ops/product-slo` exposes the source monetization alert live.

## Continue Without Waiting

The active Program BG assignment above supersedes old task requests. Continue proving monetization deltas and blocking non-buyer-visible bloat.

## 2026-06-20 Main-Agent Monetization Gate Update

The Apify Actor output now includes `monetizationReadiness` next to `paidRowQuality`. Current local APT42 smoke proof is correctly blocked for paid-traffic confidence: 9 rows, 0 sellable, 6 useful caveated, target 3 sellable, average buyer value 0.40. This is now the conversion metric to track, not raw row count.

Add this gate to the daily proof snapshots and product SLO narrative. A pass only increases monetization value if it moves one of these numbers: sellable rows, useful fresh rows, average buyer value, payworthy source rate, Apify views/runs/conversions, or cost per useful row. Mark contract/export/schema-only changes as non-monetizing unless a proof run shows row-quality lift.
