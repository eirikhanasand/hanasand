Status: active_program_bh_live_parser_capture_lift

# Agent 03 Current Assignment - Read First

You are not idle. Continue the adapter/parser lane with a buyer-visible live-data program, not more readiness paperwork.

## Program BH - Live Parser And Capture Lift For Paid Rows

Goal: increase sellable and useful Apify/public TI rows by improving real source parsing and capture output for the source ladder. The current remote proof is better but still too thin: live APT42 proof `OThlfd0uzSCNnedAO` produced 10 rows, 4 sellable, 2 caveated, 4 held, average buyer value 0.577. Your job is to make the next 20-group/default run produce more fresh, evidence-backed, entity-rich rows without weakening the evidence gates.

Build this as a multi-pass program:

1. Inspect first-100 and first-1,000 source atlas candidates and identify which parser/capture failures suppress buyer-visible fields: actor, victim, sector, country, claim type, first/last reported time, publisher count, TTP/tool, confidence, source family, and corroborating source ids.
2. Add parser/capture repair logic only where it improves dataset rows, not just internal packets. Prioritize RSS/security blogs, public vendor reports, CERT/advisory pages, public GitHub/security advisories, and high-signal public channel handoff rows.
3. Produce before/after fixture rows that show paid-row movement: `hold -> included_with_caveat`, `coverage_gap_only -> included_with_caveat`, or `included_with_caveat -> sellable`.
4. Add tests that prove rejected repairs do not count: stale reports, single-source low-context mentions, duplicate syndication, unsafe/restricted captures, auth/CAPTCHA/private sources, raw URL/body leaks, and credential/payload material.
5. Wire the result into current product surfaces already used by buyers: Apify row output, `/v1/sources/atlas`, `/v1/ops/product-slo`, and the evidence promotion preview if the repo already exposes the path.
6. Update coordination with concrete metrics: rows lifted, source families improved, estimated sellable-row delta, freshness delta, and blocker codes removed.

Do not stop after one helper or one schema. Keep working until you either have measurable paid-row lift with green checks, or a documented blocker requiring Agent 01/04/06/07/09 input.

## Proof Required Before Marking Ready

- `bun run check`
- `bun test` or a focused suite plus a clear reason if full test is too expensive
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- At least one source/parser focused test proving buyer-visible row lift

When a coherent patch is complete: update this file, commit, push, and leave no dangling dirty files for other workers.
