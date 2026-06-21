Status: active_program_fi_scheduler_hosted_floor_support

# Agent 02 Current Assignment

Read all of this file. Historical detail is archived in:
- `docs/coordination/coordination-agent-02-history-2026-06.part-aa`
- `docs/coordination/coordination-agent-02-history-2026-06.part-ab`

## Goal

Keep scheduler work focused on the daily 100-name paid Actor preset and the hosted 46 -> 100 sellable-row lift.

Current hosted baseline:
- Run `THMm2ZzYxW4HVPGJ6`
- 46 / 100 sellable rows
- 31 / 52 sellable findings
- 0 no-leak failures
- State: `verified_hold`
- Blocker: `hosted_100_name_run_below_paid_floor`

## Work

- Prioritize source-gap scheduling that can improve hosted rows, not local-only counters.
- Keep duplicate-run reuse, cursor stability, retry/dead-letter behavior, and queue fairness intact.
- Surface stale public-source refresh, public-channel gaps, approved metadata review, and source-family gaps as visible scheduler decisions.
- Keep rows from projections, review-only source packs, graph-only handoffs, sample proof, and insufficient hosted proof out of paid promotion.

## Next Output

Produce a route-visible scheduler packet that answers:
- Which hosted row gaps can be refreshed next?
- Which source families are missing for the daily 100-name preset?
- Which queue partitions should run first?
- What is the expected sellable/useful row lift?
- What remains blocked until parser/source/marketplace work lands?

## Proof Before Handoff

- `bun run check`
- `bun test src/tests/schedulerProduction.test.ts`
- `bun run check:contract-index`
- Commit and push green changes.
