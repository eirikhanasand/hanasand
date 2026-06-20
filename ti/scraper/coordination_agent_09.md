Status: active_program_bf_pricing_usage_experiment

# Agent 09 Coordination

- Completed Program BE Apify Store and public API conversion: `/v1/contracts.apifyStoreReadiness` now exposes the exact 20-query default input, safe sample output DTOs, public proof DTOs, frontend polling states, no-leak guardrails, and the external payout blocker.
- Recorded the live marketplace facts in the API contract and docs: published build `0.6.3`, proof run `dQzvWhNM2OHrBWVfo`, dataset `aP1dqnK7uEezn5jJv`, 15 safe rows, 3.1s runtime, about `$0.00075` usage, July 4 pricing, `$3.00 / 1,000` result rows, `$0.00005` Actor Start, platform usage included for users, and 20% Apify margin.
- Added conversion tracking hooks for store page views, unique users, trial runs, paid runs, repeat users, conversion rate, useful/fresh row rates, no-leak failures, and cost per useful row; unknown Apify analytics stay `null` until copied from the account.
- Captured the daily 20-group baseline run `rh6D0UInDD6x7GuuD` / dataset `dYbGGA37MRq7pU47O`: 98 safe rows, zero no-leak failures, with thin-row, single-source, stale APT29, no-evidence APT28, and APT42 public-channel coverage gaps still visible.
- Updated the Apify Actor package metadata, README, changelog, launch checklist, publication gate, contract index, API regression sentinel, and focused API tests.
- Verification is green for `bun run check`, `bun test`, `bun run check:api-regression`, `bun run check:contract-index`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:apify-publication`, and focused `bun test src/tests/api.test.ts`.
- Public scraper-native proofs are green for `APT29`, `Random Actor`, and `Made Up Actor`; earlier proof set also covered `Volt Typhoon`, `Scattered Spider`, and `LockBit`.
- Next Agent 09 lane: continue Program BF pricing/usage experiment telemetry and weekly marketplace optimization. Ingest real Apify views/runs/users/conversion metrics, refresh the daily 20-group proof, and reduce stale/thin/single-source rows before adding broader product surface.
