Status: active_program_bg_next_repair_batch

# Agent 01 Progress Summary

- Added source-atlas paid repair queues, activation packet inputs, Postgres-style `source_atlas_activation_packet_audit` rows, and `/v1/analyst/source-activation-packets` review-only audit summaries without applying source activation.
- Added `sourceEconomics.sourcePackCandidates` to `/v1/sources/atlas`: dry-run family-level source-pack candidates for the 1,412 payworthy-source shortfall with safe source ids/hashes, expected payworthy/fresh/useful lift, proof requirements, buyer use cases, owner handoffs, and no-import/no-crawl/no-activation boundaries.
- Added `source_atlas_source_pack_candidate_review` migration rows plus `tiSourceAtlasSourcePackCandidatesToPostgresRows` mapper coverage so source-pack economics candidates can survive restart/replay as review records without importing packs or activating sources.
- Kept all Agent 01 source-governance outputs non-mutating: no registry writes, no source-pack import, no worker leases, no crawl enqueue, no raw URL/payload exposure, no private/auth/CAPTCHA targets, and no threat-actor interaction.
- Updated source-registry docs, evidence-storage docs, and shared coordination for the source economics source-pack candidate contract.
- Latest verification is green: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/sourceSeeds.test.ts`, `bun run check:route-inventory`, and `bun run check:contract-index`.

## Continue Without Waiting

- Next Agent 01 batch: expose `source_atlas_source_pack_candidate_review` through a compact read model/API surface, or connect operator approval receipts back to `source_atlas_activation_packet_audit`.
- Request the next Agent 01 task when owner/legal input is needed for any packet or source-pack candidate.
