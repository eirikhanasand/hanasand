Status: active_program_da_hosted_run_and_marketplace_state_import

# Agent 09 Program DA - Hosted Run And Marketplace State Import

You are no longer ready. The next blocker is still external proof, but make the import path easy enough that the user can paste observed data once and unblock release truth.

Target:
- Keep `external_token_missing` honest when no `APIFY_TOKEN` exists.
- Add a single observed marketplace state import JSON shape for hosted 100-name run metrics, Store analytics, pricing, payout, refunds, and listing state.
- Make the paid-readiness check consume that observed JSON from env/file and update release audit/SLO/Actor OUTPUT without guesses.

Implement:
- Add support for `TI_APIFY_OBSERVED_PROOF_JSON` or `TI_APIFY_OBSERVED_PROOF_PATH` to `bun run check:hosted-apify-paid-readiness`.
- Validate required fields: hosted run id, dataset id, 100-name preset proof, dataset items, sellable rows, true findings, caveated rows, runtime, memory, usage/cost, no-leak result, pricing model, payout enabled, listing state, views/runs/users/paid users/refunds, observed timestamp.
- Reject partial or contradictory imports with exact missing-field reasons.
- Surface imported observed state into `/v1/contracts#apifyStoreReadiness`, `/v1/ops/product-slo`, Actor `OUTPUT`, and `bun run check:paid-actor-release-audit`.
- Include a redacted sample JSON file or docs snippet with placeholder values only, clearly marked not production proof.

Verification:
- Run hosted-readiness check in no-token mode and sample-import mode, publication check, Actor check/smoke, API/ops tests, contract index, API regression, paid-release audit, and full `bun test` if contracts change.
- Commit and push green changes. If no real token/proof exists, leave only the external blocker, not code ambiguity.
