Status: active_release_integrity_drift_audit

# Agent 07 Current Assignment

Own paid-row integrity while other agents expand rows.

## Goal

Prevent stale, generic, wrong-actor, graph-only, restricted-only, projected-only, source-provenance-only, caveated, or unsafe rows from becoming paid sellable findings.

## Current Context

- Hosted baseline is below floor: 46 sellable rows / 31 findings.
- Local proof can be useful for development but does not unlock paid release.
- Paid promotion must wait for hosted row/finding proof, zero no-leak failures, zero false-positive inflation, second-batch audit, and marketplace truth.

## Work

- Keep Apify `OUTPUT`, Product SLO, `/v1/quality/evaluate`, `/v1/intel/search`, contracts, and paid-release audit aligned.
- Add drift tests when new rows or surfaces are added.
- Maintain row-level reasons, buyer actions, provenance hashes, uncertainty, and no-leak proof.
- Send actionable handoffs to Agents 03/04/05/06/08/09/10 when rows are held.

## Proof Before Handoff

- `bun run check`
- focused API/ops/quality tests
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- Commit and push green changes.
