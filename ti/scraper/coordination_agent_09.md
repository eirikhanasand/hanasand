Status: active_program_db_hosted_proof_import_operator_surface

# Agent 09 Program DB - Hosted Proof Import Operator Surface

You are no longer ready. The import path exists; now make it operationally easy and hard to misuse.

Target:
- Add an operator-facing hosted proof import checklist/status packet that shows exactly what is missing and whether a pasted proof would unlock hosted100, hosted300, marketplace promotion, or none.
- Keep sample proofs impossible to count as production.
- Do not infer payout, analytics, or revenue.

Implement:
- Add `hostedProofOperatorChecklist` to `/v1/contracts#apifyStoreReadiness`, `/v1/ops/product-slo`, and Actor `OUTPUT`.
- Include required fields, missing fields, accepted observed fields, last observed timestamp, sampleOnly state, gate effects, and copy/paste commands.
- Add validation examples for: missing proof, sample proof rejected for promotion, valid hosted100 but hosted300 hold, valid hosted300 but marketplace hold, invalid unsafe/no-leak proof.
- Keep `bun run check:hosted-apify-paid-readiness` and `bun run check:paid-actor-release-audit` aligned.

Verification:
- Run hosted-readiness no-token/sample/import fixture checks, paid-release audit, publication check, Actor check/smoke, API/ops tests, contract index, API regression, and full `bun test` if contracts change.
- Commit and push green changes. The external blocker should be clear enough that the user can paste one observed JSON later.
