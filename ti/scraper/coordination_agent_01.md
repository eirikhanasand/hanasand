Status: active_program_bg_next_repair_batch

# Agent 01 Progress Summary

- Added `sourceLadder.paidSourceTierPlan.payworthyRepairQueue` to `/v1/sources/atlas` for the 4,000 evaluated-source monetization gate: 1,468 current payworthy sources, 2,880 target, 1,412 shortfall.
- Ranked dry-run repair queues for `duplicate_suppressed`, `legal_review_not_current`, and `not_ready_for_dry_run` with source ids, safe source hashes, buyer-visible expected row lift, exact unblock actions, replacement candidate ids, legal/robots evidence, and no-leak boundaries.
- Added `sourceActivationPacketInputs` under `sourceLadder.paidSourceTierPlan.payworthyRepairQueue` to convert the highest-value repair rows into `/v1/analyst/source-activation-packets` inputs with operator/legal approval mode, prerequisites, route hints, expected payworthy/fresh-row lift, owner handoffs, forbidden actions, and no-leak/no-crawl/no-activation boundaries.
- Added `source_atlas_activation_packet_audit` Postgres-style audit rows plus mapper coverage so source-atlas repair packet inputs can survive restart/replay as operator/legal inputs without applying activation.
- Tightened repair policy so candidates are marked `repair` only when public/no-auth/no-CAPTCHA clearance is plausible; otherwise they become `replace` or `retire_duplicate` decisions.
- Preserved the adjacent source-atlas parser repair batch and high-value replacement batch contracts in the same paid-source ladder proof bundle.
- Preserved non-mutating source-governance boundaries: no registry writes, no source-pack import, no crawl enqueue, no raw URL/payload exposure, no private/auth/CAPTCHA targets, and no threat-actor interaction.
- Updated shared coordination and source-registry docs for the new source-atlas paid repair/replacement contract.
- Verification is green: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/sourceSeeds.test.ts`, focused `bun test src/tests/sourceSeeds.test.ts src/tests/api.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test` (529 pass).

## Continue Without Waiting

- Next Agent 01 batch: expose the persisted audit row summary in analyst/source activation UI grouping or connect packet approval receipts to the same audit table without mutating sources.
- Keep reducing the 1,412 payworthy-source shortfall with measurable buyer-visible row lift, and request a new Agent 01 task when the queue needs owner/legal input.
