Status: active_program_co_live_source_parser_to_100_real_rows

# Agent 03 Task - Program CO Live Source Parser Lift Toward 100 Paid Rows

Your previous Program CJ parser lift is accepted as a repair packet, but it is still not enough. The monetization blocker is now simple: convert real current public rows into admitted sellable rows until the product has at least 100 rows that a buyer could reasonably pay for today.

## Mission

Convert the next batch of one-repair-away public intelligence rows into production-admission candidates with concrete parser fields. Do not add new architecture, DTO-only work, broad readiness language, or synthetic proof rows unless it directly moves a row from `hold`, `coverage_gap_only`, `included_with_caveat`, or `suppress` into either:

- `sellable` with buyer-actionable fields and provenance, or
- explicitly useful caveated context that remains outside the paid floor but gives another agent a precise repair action.

## Required Scope

- Target 30-50 candidate rows across APT and ransomware groups, prioritizing APT29, APT28, APT42, Volt Typhoon, Lazarus Group, Turla, Sandworm, Scattered Spider, LockBit, Akira, Clop, Black Basta, RansomHub, Play, Qilin, and other actors already present in the default watchlist.
- For every promoted candidate, emit or repair: actor, actor family, victim/target when available, sector, country/region, dataset or impact claim, TTP/tool/CVE when present, first seen, last seen, source family, confidence, caveat, contradiction state, provenance hash, no-leak proof, and next buyer search.
- Suppress rows that are generic actor summaries, stale reposts presented as current activity, alias collisions, wrong-actor co-mentions, graph-only projections, synthetic proof rows, or restricted-only metadata without safe public support.
- Coordinate with Agent 04 and Agent 05 when a parser row needs public source support; coordinate with Agent 07 when a row should be suppressed; coordinate with Agent 10 for release-floor counting.

## Buyer-Visible Deliverable

Produce a compact row admission packet visible through the existing product surfaces, preferably by extending existing Program CN/CH/CJ structures rather than inventing new layers. The packet must clearly show:

- how many rows moved to `sellable`,
- how many were downgraded to useful caveated context,
- how many were suppressed,
- how many rows remain one repair away,
- the estimated progress toward the 100 sellable row floor.

## Verification And Handoff

Before stopping:

- Run `bun run check`.
- Run focused tests that cover the changed route/quality/smoke surfaces.
- Update `coordination.md` and this file with exact row-count deltas, remaining blockers, and handoffs to other agents.
- Commit and push coherent green changes. Do not leave dirty files hanging for other workers.
