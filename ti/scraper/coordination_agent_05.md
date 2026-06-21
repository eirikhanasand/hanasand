Status: active_program_cw_dark_metadata_12_to_50_current_chargeable

# Agent 05 Program CW - Dark Metadata From 12 To 50 Current Chargeable Rows

You are no longer ready. Own the next dark/restricted metadata monetization lift: move current public-supported chargeable rows from 12 toward 50 without weakening safety or counting projections.

Target:
- Increase current public-supported chargeable rows from 12 to at least 50 in the deterministic review packet, or explain exact blockers by actor/source family.
- Keep projected-after-public-support separate from current chargeable rows.
- Add exact Agent 03 parser handoffs for every newly chargeable candidate.

Implement:
- Expand `publicSupportSellable100` or add `publicSupportSellable250` with current chargeable, projected, retired, and blocked buckets.
- For each current chargeable row include actor/group, safe victim/dataset label when appropriate, sector/country, claimed/observed date, public support source family, provenance hash, confidence, and parser handoff fields.
- Add blocker buckets for `needs_public_support`, `stale_public_support`, `duplicate_claim`, `unsafe_restricted_only`, `generic_source_only`, and `victim_too_sensitive_to_surface`.
- Keep all output metadata-only: no raw leak bodies, stolen files, credentials, payloads, unsafe raw URLs, private/auth/CAPTCHA access, or actor interaction.

Verification:
- Run `bun run check`, focused darkweb/API/ops tests, contract index, and full `bun test` if DTO contracts change.
- Commit and push green changes; continue toward 100 current chargeable dark-metadata-supported rows.
