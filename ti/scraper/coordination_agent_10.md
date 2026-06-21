Status: active_program_de_paid_beta_and_1000_row_release_truth

# Agent 10 Program DE - Paid Beta And 1,000-Row Release Truth

You are no longer ready. Local gates are useful, but money starts only when hosted proof, pricing, payout, analytics, and buyer-visible data quality line up. Own the release truth for the next paid beta step.

Goal:
- Turn the release board into an operator-ready decision for `ready_for_private_paid_beta` once local current750, 1,000 useful rows, hosted observed proof, pricing, payout, and analytics are all proven.
- Keep public paid traffic held until external marketplace telemetry proves views/runs/conversions and the Actor output has enough current sellable rows.
- Make every blocker measurable: row gap, useful-row gap, hosted proof gap, pricing/payout gap, analytics gap, conversion gap, no-leak proof, dirty-tree/test status, and cost per useful row.
- Preserve the anti-bloat guard so coordination-only, DTO-only, STIX/TAXII-only, or synthetic index work cannot improve the release score unless buyer-visible rows or hosted revenue proof improve.

Implementation direction:
- Extend Product SLO, paid-release audit, Apify Actor output, smoke checks, and operations docs with a Program DE release board.
- Add exact thresholds for private paid beta versus public paid traffic, including local current750, current1000 useful density, hosted dataset proof, pricing published, payout readiness, analytics visibility, and minimum conversion evidence.
- Expose the top five next revenue actions ranked by impact, owner, expected row lift, expected conversion lift, and proof command.
- Keep observed external values `external_unknown` unless Agent 09 imports verifiable hosted evidence; do not infer payout or conversion from local data.
- Keep release hygiene strict: dirty tree, failing checks, unsafe output, raw leak/credential exposure, or stale/latest-activity defects block paid release.

Proof before handoff:
- `bun run check`
- focused API/ops/scheduler tests
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:apify-publication`
- `bun run check:contract-index`
- `bun run check:api-regression`
- `bun run check:paid-actor-release-audit`
- full `bun test` if shared tree is stable

Do not mark ready until the private paid beta/public paid traffic decision is more operationally useful than it is now and the board names exactly what must happen next to earn money.

## Previous Summary

- Completed Program DD release gates for current750/current1000, hosted proof, pricing, payout, marketplace state, analytics, and release hygiene.
- Added one clear paid-release decision path: `hold_paid_release`, `ready_for_private_paid_beta`, or `ready_for_public_paid_traffic`, with local progress kept separate from hosted revenue readiness.
- Added current750/current1000 local gates, useful-row density proof, non-monetizing-work guard, and ranked revenue-impact blockers for parser, dark metadata, public corroboration, hosted proof, pricing/payout/analytics, and useful-row density gaps.
- Scheduler daily Actor cadence now treats current500 as passed, current750 sellable rows as the active local gate, and current1000 useful rows as the next density/cost proof target.
- Verification is green for `bun run check`, focused API/ops/scheduler tests, and Apify Actor smoke; paid release remains honestly held on current750/current1000 and observed hosted/marketplace proof.
