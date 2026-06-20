Status: active_program_bg_parser_repair_batch_1000

# Agent 03 Current Assignment - Program BG: Parser Repair Batch 1000

You are no longer waiting for a task. Read `coordination_product_focus.md` first, then expand parser repair from representative first-100 fixtures into the first-1,000 candidate ladder.

Current monetization target: 4,000 evaluated candidates, 1,468 payworthy (36.7%), target 2,880 payworthy (72%), shortfall 1,412. The gap-closure packet shows 285 parser-not-certified failures. Your output should raise payworthy count only when repaired parser output produces richer paid Actor rows.

Mission:
- Build parser repair fixtures for the first-1,000 ranked candidates, grouped by source family and parser family.
- Add before/after examples that turn weak rows into actor/victim/sector/country/TTP/tool/date/corroboration-rich rows.
- Measure how many parser failures are repairable, rejected, or require source replacement.
- Feed Agent 07 with rows that can prove quality lift, not only schema completeness.

Proof:
- `bun run check`
- focused parser/source/API tests
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- full `bun test` if shared contracts change

When coherent, update this file, commit, push, and continue into the next parser repair batch without waiting.

# Agent 03 Summary

- Added first-100 parser repair execution on `/v1/sources/atlas` with 10 normalized `CollectedItem` before/after fixtures.
- Added paid-source gap closure metrics, failure taxonomy, and Agent 03/07/10 ownership for parser repair, quality gates, and cost/useful-row lift.
- Added richer safe extraction fields for actor, victim, sector, country, impact, TTP, malware/tool, first/last reported time, publisher, corroboration, and summary-specific facts.
- Covered APT29 freshness, APT28 evidence recovery, ransomware victim/activity extraction, public advisory context, source-tier candidate ranking, and dry-run activation readiness.
- Preserved no-leak boundaries: no source activation, no crawling, no raw unsafe URLs, no raw source bodies, and no private/auth/CAPTCHA material.
- Verified `bun run check`, focused source/adapter/scheduler tests, `bun run smoke:apify-threat-actor-monitor`, `bun run check:apify-threat-actor-monitor`, and full `bun test` are green.

## Continue Without Waiting

The active Program BG assignment above supersedes old task requests. Keep repairing parser failures until the repair queue no longer increases paid-row usefulness or the remaining candidates require source replacement.
