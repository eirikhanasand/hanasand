Status: active_program_fg_observed_apify_hosted_proof_and_marketplace_truth

# Agent 09 Program FG - Observed Apify Hosted Proof And Marketplace Truth

You are no longer ready. The local data gates are improving, but revenue cannot unlock until hosted proof and marketplace evidence are observed. Own the real Apify-side proof path and keep unknowns explicit.

Goal:
- Import or wire observed-only Apify hosted proof for the Actor: run id, build id, dataset id, default query count, dataset row count, sellable/finding rows, no-leak failures, false-positive audit, second-batch audit, usage cost, charged events, run duration, and failure state.
- Import or wire observed marketplace truth: public/private listing state, pricing model, payout state, analytics visibility, Store views, runs, unique users, paid users, refunds, conversion, and last verified timestamp.
- Keep sample/template/partial/local-only/historical proof blocked from promotion. Missing proof should remain `external_unknown` and hold paid release.
- Add proof commands or scripts that can be run safely with an Apify token from the environment; never commit secrets, tokens, raw leaked data, unsafe URLs, or private content.

Implementation direction:
- Extend the existing hosted readiness and `conversionPayoutTruth` path rather than adding a separate proof system.
- If network/API access is unavailable, make the import contract and validator production-grade so a real observed export can be dropped in and checked.
- Surface the result in `/v1/contracts#apifyStoreReadiness`, Product SLO, Apify Actor `OUTPUT`, publication checks, and `bun run check:paid-actor-release-audit`.
- Make the blocker board distinguish three states: no proof imported, proof imported but insufficient, and proof sufficient for private beta/public traffic.

Proof before handoff:
- `bun run check`
- focused hosted/API/ops tests for changed files
- `bun run check:hosted-apify-paid-readiness`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:apify-publication`
- `bun run check:contract-index`
- `bun run check:paid-actor-release-audit`

Do not mark ready until hosted/marketplace proof is more actionable than a template: either real observed evidence is imported, or every missing external field is named with the exact safe command/import path to collect it. Commit and push green changes before handoff.

## Previous Summary

- Completed Program DD hosted Apify conversion and payout truth: `hostedPaidReadinessProof` now exposes a local current500 gate, hosted100/hosted300/hosted500 proof ladder, and `conversionPayoutTruth` for pricing, payout, analytics, listing state, and hosted500 evidence.
- Added `docs/examples/hosted-apify-observed-proof.hosted500.template.json` as a redacted `sampleOnly=true` import shape; sample, partial, unsafe, historical, local-only, draft listing, missing payout, and unpriced evidence remain blocked from promotion.
- Updated `bun run check:hosted-apify-paid-readiness`, API/ops tests, Apify Actor `OUTPUT`, and Actor smoke checks so marketplace promotion requires hosted500 plus observed pricing, payout, analytics, listing, refunds, no-leak, and second-batch proof.
- Closed the public scraper-native proof gap with network-approved runs for `APT29`, `Random Actor`, and `Made Up Actor`; all passed after sandbox network escalation.
- Verification green: `bun run check`, focused hosted/API/ops tests, `bun run check:hosted-apify-paid-readiness`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and `bun run check:contract-index`. `bun run check:paid-actor-release-audit` is expected to pass after commit because its only hard fail is dirty-worktree hygiene.
- Requesting the next Agent 09 API/product-surface, hosted proof, or marketplace conversion task.
