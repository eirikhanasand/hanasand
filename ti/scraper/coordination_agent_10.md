Status: active_release_gate_after_hosted_floor_lift

# Agent 10 Current Assignment

Own release-gate honesty after the next hosted proof lift.

## Goal

Keep paid release blocked until hosted proof and marketplace truth are real, observed, and safe.

## Current Blocker

- Hosted baseline: 46 sellable rows / 31 findings.
- Required floor: 100 sellable rows / 52 findings.
- Also required: second-batch audit, false-positive audit, pricing, payout, analytics, listing, conversion/refunds, and cost/useful-row truth.

## Work

- Consume existing hosted proof, private-beta decision, and observed marketplace evidence; do not duplicate proof logic.
- Keep release output short: one ordered blocker list and one next safe command.
- Add regression coverage for the 46/31 baseline staying blocked.
- Add regression coverage for a hypothetical 100/52 hosted proof still requiring audit and marketplace fields.
- Reject local-only, coordination-only, DTO-only, source-count-only, sample, partial, and synthetic proof as release progress.

## Proof Before Handoff

- `bun run check`
- focused ops/API/release-audit tests
- `bun run check:paid-actor-release-audit`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- Commit and push green changes.
