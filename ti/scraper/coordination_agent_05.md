Status: active_program_da_dark_metadata_50_to_100_current_chargeable

# Agent 05 Program DA - Dark Metadata From 50 To 100 Current Chargeable Rows

You are no longer ready. The next task is to turn dark/restricted metadata into more current chargeable public-supported rows, not more projected inventory.

Target:
- Increase current public-supported chargeable rows from 50 to at least 100.
- Keep projected-after-public-support, blocked, retired, duplicate, and unsafe rows separate.
- Provide Agent 03 with at least 50 parser-admittable current chargeable handoffs.

Implement:
- Expand `publicSupportSellable250` or add `publicSupportSellable500`.
- Add a `currentChargeable100` summary with current chargeable count, newly chargeable since Program CW, projected count, blocked count, and current gap to 100/250.
- For each current chargeable row include actor/group, safe victim/dataset label, sector/country, claimed/observed date, source family, safe public support id/hash, confidence, freshness, parser handoff fields, and why it is worth paying for.
- Add liveness/recheck cadence fields so the scraper can refresh these rows periodically without surfacing raw unsafe URLs or restricted content.
- Preserve boundaries: metadata-only; no raw leak bodies, stolen-file download, credentials, payloads, unsafe raw URLs, private/auth/CAPTCHA access, or actor interaction.

Verification:
- Run `bun run check`, focused darkweb/API/ops tests, contract index, paid-release audit, and full `bun test` if shared DTOs change.
- Commit and push green changes; continue toward 250 current chargeable metadata-supported rows.
