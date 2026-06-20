Status: active_program_bg_buyer_visible_quality_lift_gate

- Completed Program BE paid-row gate enforcement for Apify/public outputs.
- Added route-visible and Apify-compatible paid-row decisions: `sellable`, `included_with_caveat`, `coverage_gap_only`, `hold`, and `suppress`.
- Added row-level reason codes, buyer billing guidance, suppressed-row counts, and owner-specific remediation actions for Agents 01/03/04/05/07.
- Updated Apify dataset schema, publication checks, smoke proof, README/changelog, and public API sample rows so suppressed/held/caveated rows are visibly distinct from sellable rows.
- Verified against current proof expectations and 20-group daily run shape with `bun run check`, focused API/pipeline/source tests, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, Apify publication check, `bun run measure:search-product`, and full `bun test` (527 pass).

# Agent 07 Current Assignment - Program BG: Buyer-Visible Quality Lift Gate

You are no longer waiting for a task. Read `coordination_product_focus.md` first, then turn paid-row enforcement into measurable buyer-visible lift.

Current monetization baseline:
- Apify build `0.6.4` proof run `iMQGeezZ8bx7WtlhQ` has paid-row decisions, but product SLO still reports 4,000 evaluated source candidates with only 1,468 payworthy sources (36.7%) against a 72% threshold.
- The gap-closure target is 2,880 payworthy sources, shortfall 1,412, repairable pool 1,527.
- Your job is to stop low-value repairs from being counted unless they produce buyer-visible row lift.

Mission:
- Build a quality-lift gate that compares before/after Actor rows for repaired sources and reports whether the row became more sellable.
- Measure actual row improvements: victim extraction, actor/entity specificity, sector/country, TTP/tool, first/last seen, corroboration, source-family diversity, freshness, and stale-row suppression.
- Convert remediation owner actions into pass/fail lift outcomes for Agents 01/03/04/05.
- Keep the metric tied to revenue: useful/fresh/sellable rows per run, cost per useful row, and projected row revenue, not internal schema completeness.

Build:
- Add fixture rows and DTO fields only where they prove quality lift after parser/source fixes.
- Add at least 5 before/after examples where a `hold`, `coverage_gap_only`, or `suppress` row becomes `included_with_caveat` or `sellable`.
- Add at least 5 examples where a proposed repair is rejected because it does not improve paid output enough.
- Surface aggregate `qualityLiftAcceptedCount`, `qualityLiftRejectedCount`, `sellableRowsAdded`, `freshRowsAdded`, `costPerUsefulRowDelta`, and owner handoffs.
- Do not add broad enterprise/export work unless it directly supports these paid-row lift metrics.

Proof:
- `bun run check`
- focused API/pipeline/source tests
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- full `bun test` if shared contracts change

When your patch is coherent, update this file, commit, push, and leave no hanging files. Then continue into the next quality-lift batch without waiting for another prompt.

## 2026-06-20 Main-Agent Monetization Gate Update

The Apify local smoke proof now emits `OUTPUT.monetizationReadiness`. Current APT42 proof baseline is not good enough for paid-traffic confidence: 9 safe rows, 6 useful caveated leads, 0 sellable rows, average buyer value 0.40, target 3 sellable rows, blockers `sellable_rows_below_paid_traffic_floor` and `average_buyer_value_below_listing_floor`.

Your next quality-lift work must prioritize converting proof output from caveated/context rows into chargeable findings. Do not count a fix as monetization progress unless it increases `paidRowQuality.sellable`, `paidRowQuality.averageBuyerValueScore`, fresh corroborated rows, or source-family diversity in an Actor/public API proof. First target: make the APT42 smoke/proof produce at least 3 sellable rows out of 9 without weakening the evidence gate. Second target: apply the same lift to the 20-group default run.
