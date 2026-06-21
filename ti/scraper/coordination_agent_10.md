Status: active_program_dc_release_gates_for_500_1000_and_hosted_marketplace

# Agent 10 Program DC - Release Gates For 500, 1,000, Hosted Proof, And Marketplace Promotion

You are no longer ready. Local 300 is passed; now keep the next paid gates honest while other agents scale rows and hosted proof.

Goal:
- Add explicit release ladder gates for current500, current1000, hosted100, hosted300, and marketplace promotion.
- current500 should require at least 500 current sellable rows, at least 55% true findings, source-provenance share <=40%, and zero projected/graph-only/restricted-only/stale/sample credit.
- current1000 should remain hold until at least 1,000 useful rows, 300+ sellable rows, useful-row density, fresh-row density, source-family diversity, no-leak proof, and cost/useful-row proof pass.
- Hosted and marketplace gates must stay observed-only and fail closed on sample/partial/unsafe proof.

Implementation direction:
- Extend `bun run check:paid-actor-release-audit` and route/SLO/Actor output fields with `current500Gate`, `current1000Gate`, `hostedProofExecutionGate`, and `marketplacePaidTrafficGate`.
- Make blocker text current: Agent 03 is now 300->500, Agent 05 is 150->250 dark metadata, Agent 08 is 175->300 parser-ready public proof, Agent 09 is hosted proof execution/import.
- Assert clean git state, branch pushed, no dirty worker files, no invented external marketplace metrics.
- Keep the audit useful to monetization: concise pass/hold/fail fields, exact gaps, and exact next owner actions.

Proof before handoff:
- `bun run check`
- `bun run check:paid-actor-release-audit`
- `bun run check:hosted-apify-paid-readiness`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:apify-publication`
- `bun run check:contract-index`
- `bun run check:api-regression`
- focused API/ops tests

Do not add broad ops theory. This is a release gate and monetization truth lane.

## Previous Summary

- Added strict Program DB release audit support for the local 300-row unlock: it now passes only with at least 300 current sellable rows, at least 150 true findings, source-provenance share at or below 45%, and no projected, graph-only, restricted-only, stale/latest-error, source-provenance-padding, or sample-proof credit.
- Added `local300UnlockRequirements` and `marketplaceUnlockRequirements` to the release ladder, including active local-lift details, hosted 100/300 dependencies, observed-proof import state, required marketplace fields, and paid-traffic hold status.
- Hardened hosted and marketplace gates against sample proofs, partial/invalid observed proof imports, no-leak failures, missing `secondBatchAudit`, and unobserved marketplace payout/pricing/analytics fields.
- Carried forward the current 300-row lift surfaces across SLO, Actor output, Actor smoke, and ops tests so the audit can verify 300 current rows without counting hosted proof or unsafe projections.
- Verification is green for `bun run check`, `bun run check:contract-index`, `bun run check:api-regression`, `bun run check:apify-publication`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:hosted-apify-paid-readiness`, focused API/ops tests, full `bun test`, and sample-proof rejection.
