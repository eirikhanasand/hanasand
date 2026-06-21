Status: active_program_fh_hosted_default_parser_lift_46_to_100

# Agent 03 Current Assignment

Own parser/admission lift for the hosted 100-name Actor run.

## Goal

Move hosted proof from 46 sellable rows / 31 findings toward at least 100 sellable rows / 52 findings without false-positive inflation.

## Current Hosted Baseline

- Run: `THMm2ZzYxW4HVPGJ6`
- Dataset: `xLPoxMVY6cVjGsS4e`
- Rows: 313
- Sellable rows: 46 / 100
- Sellable findings: 31 / 52
- Caveated rows: 194
- No-leak failures: 0

## Work

- Identify high-volume held/caveated row patterns that are parser-fixable.
- Admit rows only with current public support, actor specificity, claim context, first/last seen, buyer action, confidence reason, and no-leak proof.
- Keep stale latest-activity, alias/wrong-actor, generic source pages, graph-only, restricted-only, duplicate, contradiction, and caveated rows out of paid counts.
- Surface before/after counters in Apify `OUTPUT`, Product SLO, contracts, and release audit.

## Proof Before Handoff

- `bun run check`
- focused parser/API/ops tests
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- `bun run check:api-regression`
- Commit and push green changes.
