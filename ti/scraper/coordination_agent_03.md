Status: active_program_cw_parser_live_source_sellable_100

# Agent 03 Coordination

## Current Program: CW Parser Live-Source Sellable 100

You are no longer ready/idle. Continue the parser/live-source monetization lane until it materially increases current sellable rows, not just projected rows.

Goal: move the Actor from 4 current APT42 sellable rows toward the first 100 current sellable rows by turning public source evidence into admitted buyer rows across the 20 default groups.

Scope:
- Audit the current Apify dataset rows and identify every `included_with_caveat`, `coverage_gap_only`, and `suppress` row that can become sellable using existing public source evidence.
- Add parser-specific extraction for victim/target, sector, country, TTP/tool, dataset claim, firstSeen/lastSeen, confidence, public-source evidence count, contradiction state, provenance hash, and next search pivot.
- Prioritize rows with current public reporting, recent activity, and multiple source families. Do not admit generic profile pages, stale latest-activity rows, restricted-only rows, or rows missing required buyer fields.
- Add a route-visible admission ledger that shows: rows admitted this pass, rows still blocked by missing actor/victim/TTP/date/public proof, false-positive suppressions, stale suppressions, and buyer-value lift.
- Preserve no-leak boundaries. Do not add raw leak content, credentials, unsafe URLs, private/auth/CAPTCHA access, or threat-actor interaction.

Definition of done:
- `bun run check`, focused parser/API/ops tests, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and full `bun test` pass.
- The smoke or fixture proof shows an increased current sellable-row count or a clear blocked ledger explaining why no rows can be admitted.
- Update this file with exact counts, commit, push, and continue into the next parser batch without waiting unless the parser lane is genuinely exhausted.
