Status: active_program_bf_parser_repair_execution_for_top_sources

# Agent 03 Current Assignment - Program BF: Parser Repair Execution For Top Sources

You are no longer waiting for a task. Read `coordination_product_focus.md` first, then turn the parser coverage proof into repair execution for the sources most likely to sell the Actor.

Current measurable target: 2,532 of the evaluated 4,000 source candidates fail the paid-source gate. The 4,000 tier needs 2,880 payworthy sources, has 1,468, and is short 1,412. The gap-closure packet identifies 1,527 repairable candidates, including 285 parser-not-certified failures. Prioritize parser repairs that convert existing high-potential sources into payworthy sources: certified parser, non-generic summary, actor/victim/sector/country/TTP/date extraction, and before/after Actor row examples. Report how many sources moved from rejected to payworthy.

Mission:
- Convert the first-100 parser impact table into concrete parser improvements and canary fixtures.
- Make paid rows richer than headline/source repetition by extracting actor, victim, sector, country, impact, TTP, malware/tool, first/last reported time, publisher/corroboration, and summary-specific facts.
- Prioritize APT29 freshness, APT28 evidence recovery, and ransomware victim/activity extraction.

Build:
- Add parser repair fixtures for the top failing/high-value source families from Agents 01/04.
- Produce before/after normalized rows for at least 10 high-impact sources or representative fixtures.
- Add failure taxonomy and repair ownership that Agent 07 can quality-gate and Agent 10 can measure as cost/useful-row lift.
- Keep output safe: no raw source bodies, no unsafe URLs in public rows, no private/auth/CAPTCHA material.

Proof:
- `bun run check`
- focused adapter/parser/source tests
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:apify-threat-actor-monitor`
- full `bun test` if shared extraction contracts change

When your patch is coherent, update this file, commit, push, and leave no hanging files.

# Agent 03 Summary

- Added first-100 source-ladder parser coverage proof on `/v1/sources/atlas` via `sourceLadder`.
- Added parsed/failed/held parser counts, parser impact table, ranked parser repair priorities, and before/after `CollectedItem` sample rows.
- Covered APT28 evidence recovery, APT29 freshness, public advisory/blog extraction, ransomware victim/activity extraction, and richer summaries beyond "Reported by X."
- Preserved dry-run/no-leak boundaries: no source activation, no crawling, no raw unsafe URLs, no private/auth/CAPTCHA access, and no raw source payloads.
- Verified `bun run check`, focused Agent 03/source tests, and full `bun test` are green.

## Continue Without Waiting

The active Program BF assignment above supersedes old task requests. Continue repairing the highest-value parser failures until at least 10 source families or representative fixtures show before/after rows with richer actor, victim, sector, country, impact, TTP, malware/tool, first/last reported time, corroboration, and specific summary facts. When that is done, continue into parser repair for the 100 -> 1,000 source ladder without waiting for another prompt.
