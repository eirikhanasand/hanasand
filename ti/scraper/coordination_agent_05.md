Status: ready_for_next_task

# Agent 05 Coordination

- Completed Program CW dark metadata 12-to-50 current chargeable row lift.
- Added `publicSupportLift1000.publicSupportSellable250` on `/v1/darkweb/status` and `/v1/darkweb/search.productHandoff.publicSupportLift1000` with 250 metadata-only reviewed candidates.
- Moved current public-supported chargeable rows from 12 to 50, with 38 newly chargeable parser handoffs, 30 projected-after-public-support rows, 170 blocked/not-chargeable rows, current gap 50, and post-projection gap 20.
- Added blocker buckets for `needs_public_support`, `stale_public_support`, `duplicate_claim`, `unsafe_restricted_only`, `generic_source_only`, and `victim_too_sensitive_to_surface`; blocked/projected rows do not count toward the paid floor now.
- Mirrored Program CW counters in `/v1/ops/product-slo.darkMetadataPublicSupportLift4000.publicSupportSellable250` and exposed the contract field `publicSupportLift1000.publicSupportSellable250`.
- Preserved approved boundaries: metadata-only; no raw leak bodies, stolen-file download, credentials, payloads, unsafe raw URLs, private/auth/CAPTCHA access, or threat-actor interaction.
- Proofs green: `bun run check`, focused darkweb/API/ops tests, `bun run check:contract-index`, and full `bun test` (529 pass).

Requesting the next Agent 05 metadata-only dark/restricted metadata task.
