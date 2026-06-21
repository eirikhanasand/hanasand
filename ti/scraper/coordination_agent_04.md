Status: active_program_bg_high_value_source_replacement_4000_to_10000

# Agent 04 Current Assignment - Program BG: High-Value Source Replacement 4000 -> 10000

You are no longer waiting for a task. Read `coordination_product_focus.md` first, then continue source acquisition only where it improves paid data quality.

Current monetization target: 4,000 evaluated candidates, 1,468 payworthy (36.7%), target 2,880 payworthy (72%), shortfall 1,412. Your lane owns low source value, low freshness, low evidence yield, and low public answer impact. Do not pad source count. The next candidates must be worth paying for.

Mission:
- Replace low-value candidates with high-value public sources across vendor CTI, CERT/government, advisories/APIs, ransomware trackers, public datasets, malware research, cloud/SaaS, ICS/OT, exploit intelligence, and public-channel descriptors that stay review-only until approved.
- Expand from first-1,000 toward 4,000/10,000 with value-gated ranked rows, but stop promotion unless payworthy density improves.
- For each source family, report expected fresh rows/day, evidence yield, actor/ransomware coverage, parser readiness, legal/robots state, and buyer-visible row effect.
- Prioritize sources that improve APT29/APT28/APT42/Volt Typhoon/Lazarus/Scattered Spider/FIN7/LockBit/Akira coverage within 1-3 days.

Proof:
- `bun run check`
- focused source/public-signal/API tests
- `bun run check:route-inventory`
- `bun run check:contract-index`
- full `bun test` if shared source contracts change

When coherent, update this file, commit, push, and continue into the next source batch without waiting.

# Agent 04 Summary

- Added `highValueReplacementBatch.dailyActorPresetCanaryPacket` to `/v1/sources/atlas`, deriving actor-slot source IDs, scheduler cadence, expected fresh/useful rows, source-family diversity gates, and no-leak acceptance thresholds for the daily paid 100-name Actor preset without activating sources or starting crawls.
- Verification is green for this pass: `bun run check`, `bun test src/tests/sourceSeeds.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test` with 529 passing tests.
- Added public-monitor gap summary totals for freshness canary source count plus expected fresh/useful rows per day, derived from per-query freshness canaries so Agent 09/10 can consume buyer-visible lift without recomputing query rows.
- Verification is green for this pass: `bun run check`, `bun test src/tests/sourceSeeds.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test` with 529 passing tests.
- Added per-query `freshnessCanarySourceIds`, expected fresh rows/day, and expected useful rows/day to `publicMonitorSourceGapHandoff` so Apify/public-monitor gap rows can prefer ready, current-review sources that should improve buyer-visible freshness first.
- Verification is green for this pass: `bun run check`, `bun test src/tests/sourceSeeds.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test` with 529 passing tests.
- Added freshness-first activation canary fields to `/v1/sources/atlas`: 25 p0 source ids, expected fresh/useful rows per day, acceptance criteria, and rollback triggers derived from the high-value freshness queue without starting crawls or mutating registry state.
- Verification is green for this pass: `bun run check`, `bun test src/tests/sourceSeeds.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test` with 529 passing tests.
- Added `paidSourceTierPlan.highValueReplacementBatch.freshnessPriorityQueue` for the 4,000-source monetization gate, ranking concrete atlas source ids by p0/p1 freshness lift, expected useful/fresh rows per day, scheduler cadence, actor/ransomware coverage, parser/legal action, measurement gates, and no-leak boundaries.
- Added freshness actor/family rollups for APT29, APT28, APT42, Volt Typhoon, Lazarus, Scattered Spider, FIN7, LockBit, and Akira so the next acquisition pass is driven by buyer-visible fresh-row lift instead of source-count padding.
- Verification is green for this pass: `bun run check`, `bun test src/tests/sourceSeeds.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test` with 529 passing tests.
- Continued Program BG high-value source replacement for the 4,000 -> 10,000 source ladder.
- Added `paidSourceTierPlan.payworthyRepairQueue` with dry-run queues for `duplicate_suppressed`, `legal_review_not_current`, and `not_ready_for_dry_run`, including repair/replace/retire decisions, exact unblock actions, safe source hashes, buyer-visible row lift, legal/robots evidence, replacement candidate ids, and no-leak boundaries.
- Added `paidSourceTierPlan.highValueReplacementBatch` for low source value, low freshness, low evidence yield, and low public-answer-impact blockers, with expected fresh rows/day, evidence yield, actor/ransomware coverage, parser readiness, legal/robots state, source-family/actor plans, buyer-visible row effect, and projected payworthy-source lift.
- Added `paidSourceTierPlan.highValueReplacementBatch.activationRunbook` with day-1 canary, day-3 parser/legal clearance, and held replacement actions derived from replacement rows, including source ids, source families, actors, blockers addressed, expected fresh/actor/ransomware rows/day, expected payworthy lift, parser/legal/scheduler work, buyer-visible row effect, measurement work, and Agent 01/02/03/07/09/10 handoffs.
- Preserved dry-run/no-crawl/no-activation/no-private/no-auth/no-CAPTCHA/no-payload/no-actor-interaction boundaries.
- Verification is green: `bun test src/tests/sourceSeeds.test.ts`, `bun run check`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test` with 527 passing tests.
- Continue next with additional high-value public source replacement batches that raise the source payworthy rate toward 72% and then prove useful/fresh Actor row lift.

- Completed Program BL source acquisition to 1,000 for `/v1/sources/atlas`.
- Added a ranked first-1,000 acquisition packet with evaluated/unevaluated candidate counts, decision buckets, safe locator hashes, source family/domain, public access method, legal/robots review, parser family, expected actor/query/entity coverage, freshness expectation, dedupe group, buyer-value score, row-lift estimate, activation priority, rejection reason, and owner handoff.
- Split acquisition rows into `activate_canary`, `parser_needed`, `review_needed`, `duplicate`, `low_value`, and `reject` while preserving dry-run/no-crawl/no-activation/no-private/no-auth/no-CAPTCHA/no-actor-interaction boundaries.
- Added transition summaries for APT29, APT28, Volt Typhoon, Sandworm, Lazarus, LockBit, Clop, Akira, Black Basta, Play, and Scattered Spider so the next source-family gaps are visible.
- Verification is green: `bun run check`, focused source/API/public-signal/advisory tests, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test` with 527 passing tests.
