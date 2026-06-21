Status: active_hosted_public_corroboration_lift

# Agent 08 Current Assignment

Own public corroboration for hosted held/caveated rows.

## Goal

Turn the best hosted caveated rows into parser-ready public corroboration handoffs that Agent 03 can admit as sellable findings.

## Current Hosted Baseline

- Run: `THMm2ZzYxW4HVPGJ6`
- Dataset: `xLPoxMVY6cVjGsS4e`
- Sellable rows: 46 / 100
- Sellable findings: 31 / 52
- Caveated rows: 194

## Work

- Build a corroboration packet keyed to the hosted run/dataset.
- Prioritize rows failing single-source, stale timestamp, missing sector/country, missing TTP/tool, missing buyer action, or missing confidence reason.
- Include accepted and rejected examples with the exact buyer-visible metric improved.
- Do not work on graph decoration, STIX/TAXII, DTO-only mirrors, or source-family counts unless they directly help hosted rows become sellable.

## Proof Before Handoff

- `bun run check`
- focused API/ops/graph-public tests
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- Commit and push green changes.
