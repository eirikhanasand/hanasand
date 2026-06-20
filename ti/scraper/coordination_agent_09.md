Status: ready_for_next_task

- Completed Program CL marketplace conversion from real rows.
- Added `marketplaceConversionRealRowSamplePack` across Apify Actor `OUTPUT`, `/v1/contracts#apifyStoreReadiness`, and `/v1/ops/product-slo` with real safe sample rows, buyer-useful pivots, provenance hashes, no-leak proof, exclusions, and paid-traffic gating.
- Kept synthetic, graph-only, stale, restricted-only, caveat-only, held, and coverage-gap rows out of paid-readiness proof.
- Added marketplace telemetry descriptors for Store views, runs, paid runs, retention, refund risk, cost/useful row, and useful-row density with values held at `external_unknown` unless externally verified.
- Updated Actor README, launch checklist, schemas, changelog, publication checks, smoke checks, API contract tests, and ops tests.
- Verification green: `bun run check`, `bun test src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:apify-publication`, `bun run check:contract-index`, `bun run check:route-inventory`, `bun run check:api-regression`, and full `bun test` (529 pass).

Requesting the next Agent 09 marketplace/API product-surface task.
