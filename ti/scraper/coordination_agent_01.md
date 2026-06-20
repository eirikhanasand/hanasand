Status: active_program_bg_source_payworthy_repair_queue

# Agent 01 Current Assignment - Program BG: Source Payworthy Repair Queue

You are no longer waiting for a task. Read `coordination_product_focus.md` first, then build the source-governance repair queue that moves the 4,000 evaluated source tier toward paid readiness.

Current monetization target: 4,000 evaluated candidates, 1,468 payworthy (36.7%), target 2,880 payworthy (72%), shortfall 1,412. Your lane owns duplicate, legal/robots, activation-readiness, and registry-governance blockers. Do not add source volume unless the candidates are more likely to become payworthy than the weak candidates they replace.

Mission:
- Turn duplicate/legal/readiness failures into concrete repair or replacement decisions.
- Produce ranked queues for `duplicate_suppressed`, `legal_review_not_current`, and `not_ready_for_dry_run` with source ids, why buyers would care, expected row lift, and exact unblock action.
- Mark candidates as repairable only when legal/robots/current-public-source evidence can plausibly clear without private/auth/CAPTCHA access.
- Replace weak or unsafe candidates with higher-value public sources only when source family, freshness, and downstream public answer impact improve.

Proof:
- `bun run check`
- focused source/API tests
- `bun run check:route-inventory`
- `bun run check:contract-index`
- full `bun test` if shared source contracts change

When coherent, update this file, commit, push, and continue into the next repair batch without waiting.

# Agent 01 Coordination Summary

- Completed Program BK source activation-to-live-value slice for `/v1/sources/atlas`.
- Added `sourceLadder.activationReadinessPlan` for first-25 and first-100 sources with `approve`, `canary`, `hold`, `reject`, and `retire_duplicate` decisions.
- Included source health, legal/robots notes, parser owner, expected entities, actor/query classes, freshness SLOs, duplicate groups, canary expectations, rollback plans, non-mutating Agent 02/03/07/09/10 apply-plan handoffs, and expected useful/fresh row plus revenue impact.
- Preserved dry-run/no-mutation boundaries: no source-pack import, no registry mutation, no crawl enqueue, no silent activation, no unsafe raw URLs, no payloads, no private/auth/CAPTCHA targets, and no threat-actor interaction.
- Updated coordination and source registry docs for the additive source-atlas activation-readiness contract.
- Added a narrow `public_channel_probe` planning budget/work-class type correction so scheduler retry-plan contracts remain type-aligned.
- Verification is green: `bun run check`, focused `bun test src/tests/sourceSeeds.test.ts src/tests/api.test.ts src/tests/schedulerProduction.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test` (527 pass).

## Continue Without Waiting

The active Program BG assignment above supersedes old task requests. Keep converting source-governance blockers into measurable payworthy-source lift until the 4,000 tier reaches 72% or the remaining blockers require operator/legal input.
