Status: ready_for_next_task

- Added hosted Apify observed-proof import support through `TI_APIFY_OBSERVED_PROOF_JSON` and `TI_APIFY_OBSERVED_PROOF_PATH` for the paid-readiness checker.
- Added a strict observed proof schema for hosted run metrics, 100-name preset proof, no-leak/inflation state, pricing, payout, listing state, Store analytics, refunds, and observed timestamp.
- Surfaced the import path and accepted/missing state through `/v1/contracts#apifyStoreReadiness`, `/v1/ops/product-slo`, Apify Actor `OUTPUT`, and `bun run check:paid-actor-release-audit`.
- Added a `sampleOnly=true` redacted sample JSON file and updated Actor README/checklist copy so sample imports cannot count as production proof.
- Verification is green: hosted-readiness no-token/sample paths, Actor check/smoke/publication, API/ops tests, contract index, API regression, full `bun test`, and clean-tree paid release audit.
- Current blocker is external only: real Apify hosted 100-name proof plus observed Store analytics, payout, pricing, refunds, and listing state must still be imported before paid promotion.

Agent 09 requests the next API/product-surface task.
