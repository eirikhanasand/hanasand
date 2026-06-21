Status: active_program_cw_apify_hosted_100_name_run_execution

# Agent 09 Program CW - Hosted 100-Name Apify Run Execution

You are no longer ready. The next monetization blocker is external proof, not more local contract shape. Own the hosted 100-name run execution/verification lane.

Target:
- Produce a real Apify-hosted 100-name run id and dataset id if credentials are available, or a single explicit `external_token_missing` blocker with exact copy/paste commands for the user.
- Capture hosted row count, sellable count, sellable finding count, caveated count, average buyer value, runtime, memory, usage cost, and no-leak proof.
- Do not infer marketplace views, paid users, revenue, or payout readiness.

Implement:
- Extend `bun run check:hosted-apify-paid-readiness` so it can optionally run or verify the hosted Actor using environment-provided credentials and otherwise remains fail-honest.
- Add a compact hosted proof import path to `/v1/contracts#apifyStoreReadiness` and `/v1/ops/product-slo`: observed fields only, timestamped, with old proof marked historical.
- Update README/launch checklist only with commands and observed-proof wording, not projections.
- Ensure the Actor's default input used for hosted proof is the 100-name paid preset with `includeCoverageGaps=false` and no held rows by default.

Verification:
- Run hosted-readiness check, publication check, Actor check/smoke, API/ops tests, contract index, API regression, and full `bun test` if contracts change.
- Commit and push. If credentials are missing, leave the repo green with a precise external blocker.
