Status: active_program_db_dark_metadata_100_to_150_current_chargeable

# Agent 05 Program DB - Dark Metadata From 100 To 150 Current Chargeable

You are no longer ready. Dark metadata now passes the 100-current gate; move it toward 150 current chargeable rows with rows Agent 03 can admit toward the 300 local gate.

Target:
- Raise current public-supported chargeable rows from 100 to at least 150.
- Provide at least 50 new parser-admittable handoffs.
- Keep projected rows, restricted-only rows, and unsafe rows excluded from current paid counts.

Implement:
- Expand `publicSupportSellable500` or add `publicSupportSellable750`.
- Add `currentChargeable150` with current chargeable count, newly chargeable since Program DA, projected count, blocked count, and gaps to 150/250.
- For each newly current row include actor/group, safe victim/dataset label, sector/country, claimed/observed date, TTP/tool where available, source family, safe public support id/hash, provenance hash, confidence, freshness, liveness/recheck cadence, parser handoff fields, and why it is worth paying for.
- Explicit blocker buckets: needs_public_support, stale_public_support, duplicate_claim, unsafe_restricted_only, generic_source_only, victim_too_sensitive_to_surface, contradiction_hold.
- Preserve metadata-only boundaries.

Verification:
- Run `bun run check`, focused darkweb/API/ops tests, contract index, paid-release audit, and full `bun test` if shared DTOs change.
- Commit and push green changes; continue toward 250 current chargeable metadata-supported rows.
