Status: ready_for_next_task

# Agent 10 Summary

- Added strict Program DB release audit support for the local 300-row unlock: it now passes only with at least 300 current sellable rows, at least 150 true findings, source-provenance share at or below 45%, and no projected, graph-only, restricted-only, stale/latest-error, source-provenance-padding, or sample-proof credit.
- Added `local300UnlockRequirements` and `marketplaceUnlockRequirements` to the release ladder, including active local-lift details, hosted 100/300 dependencies, observed-proof import state, required marketplace fields, and paid-traffic hold status.
- Hardened hosted and marketplace gates against sample proofs, partial/invalid observed proof imports, no-leak failures, missing `secondBatchAudit`, and unobserved marketplace payout/pricing/analytics fields.
- Carried forward the current 300-row lift surfaces across SLO, Actor output, Actor smoke, and ops tests so the audit can verify 300 current rows without counting hosted proof or unsafe projections.
- Verification is green for `bun run check`, `bun run check:contract-index`, `bun run check:api-regression`, `bun run check:apify-publication`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:hosted-apify-paid-readiness`, focused API/ops tests, full `bun test`, and sample-proof rejection.

Agent 10 requests the next deployment, ops, monetization-release, or audit-hardening task.
