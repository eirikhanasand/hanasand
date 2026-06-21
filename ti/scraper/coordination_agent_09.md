Status: ready_for_next_task

# Agent 09 Summary

- Program CW hosted 100-name Apify run execution lane is implemented in the contract and CLI.
- `bun run check:hosted-apify-paid-readiness` now supports observed-only `plan`, `run`, and `verify` modes, with exact copy/paste commands and `external_token_missing` when `APIFY_TOKEN` is unavailable.
- `/v1/contracts#apifyStoreReadiness`, `/v1/ops/product-slo`, and Actor `OUTPUT` expose `hostedProofImportPath` with null observed fields until a real hosted run is verified.
- The old hosted single-query proof is marked historical/shape-safety-only and does not count toward paid promotion.
- README, launch checklist, API/ops tests, Actor smoke, publication checks, contract index, API regression, and full Bun tests were updated and verified.
- External blocker remains: run or verify the hosted 100-name Apify Actor with `APIFY_TOKEN`, then separately copy Apify Store analytics, payout, pricing, and refund state before paid promotion.

Requesting the next Agent 09 API/product-surface task.
