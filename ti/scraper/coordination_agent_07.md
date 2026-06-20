Status: active_program_be_paid_row_gate_enforcement

# Agent 07 Current Assignment - Program BE: Paid Row Gate Enforcement

You are no longer waiting for a task. Read `coordination_product_focus.md` first, then turn the paid-row quality gate from measurement into enforcement for Apify/public outputs.

Current measurable target: enforce the new paid-source tier plan. A source is not payworthy unless it is parser-ready, fresh, legally current, non-duplicate, sourceValueScore >= 0.66, evidenceYield >= 0.58, freshness >= 0.66, and downstreamPublicAnswerImpact >= 0.6. Build quality feedback that tells Agents 01/03/04 which rejected candidates can be repaired versus replaced.

Mission:
- Prevent rows that buyers should not pay for from looking equivalent to useful rows.
- Gate stale-only actor activity, generic summaries, unsupported victim extraction, weak single-source claims, alias collisions, contradiction holds, and unsafe/source-poor rows.
- Keep the output useful: downgrade, label, or move low-quality rows into coverage-gap/remediation rows rather than hiding all signal.

Build:
- Add route-visible and Apify-compatible quality decisions: `sellable`, `included_with_caveat`, `coverage_gap_only`, `hold`, and `suppress`.
- Add row-level reason fields and remediation actions that Agents 01/03/04/05 can act on.
- Prove enforcement against latest baselines: `iMQGeezZ8bx7WtlhQ` and the 20-group daily run shape.
- Update smoke/schema/docs only if needed to make the paid row decision visible and compact.

Proof:
- `bun run check`
- focused quality/API/pipeline tests
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run measure:search-product`
- full `bun test` if shared routes/contracts change

When your patch is coherent, update this file, commit, push, and leave no hanging files.

- Added `ti.program_bd_paid_row_quality_gate.v1` to the Program BD quality evaluation packet, anchored to Apify proof runs `iMQGeezZ8bx7WtlhQ` and `rh6D0UInDD6x7GuuD`.
- Added paid-row usefulness metrics for useful/fresh rows, stale suppression, summary specificity, source-family diversity, corroboration, buyer caveats, and no-leak proof.
- Added 100 -> 60k source-tier gates so daily 20-group runs and expansion tiers can be judged for buyer-visible freshness, specificity, support, safety, and sellability.
- Extended route/API fixtures and docs for the paid quality gate, Apify pricing fields, live baselines, source-tier thresholds, dataset fields, and remediation actions.
- Updated the TI source atlas first-100 ladder rows with buyer-value metadata, curated approved public source names, source-family priorities, hashed locators, missing-family hints, and 1-3 day Apify row improvement signals.
- Verification green: `bun run check`, full `bun test` (527 pass), focused pipeline/API/source tests, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, Apify publication check, and `bun run measure:search-product`.

## Continue Without Waiting

The active Program BE assignment above supersedes this old request. Continue paid-row enforcement until Apify/public outputs clearly separate sellable rows, caveated rows, coverage-gap-only rows, holds, and suppressed rows. Then continue into replay promotion history only where it improves buyer-visible trust: route-visible quality decisions, remediation owners, and proof that stale/thin/single-source rows are not billed or presented as equivalent to useful findings.
