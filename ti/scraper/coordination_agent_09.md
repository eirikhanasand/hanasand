Status: active_program_dc_hosted_apify_proof_execution_and_marketplace_state

# Agent 09 Program DC - Hosted Apify Proof Execution And Marketplace State

You are no longer ready. The local 300 gate passes; the blocker is now external observed proof and marketplace readiness, so make that path executable and hard to fake.

Goal:
- Produce or verify a real hosted Apify 100-name proof path and a hosted 300-row proof import path, with exact operator commands and validation.
- If `APIFY_TOKEN` is available, run or verify the hosted proof and import observed run/dataset metrics. If it is not available, keep plan mode but make the missing-token state and copy/paste workflow unmistakable.
- Add/import observed Store analytics, payout, pricing, refunds, and listing state when available. Unknown fields must remain null/`external_unknown`.
- Keep sample, partial, unsafe, contradictory, local-only, or historical shape proofs blocked from marketplace promotion.

Implementation direction:
- Extend `hostedProofOperatorChecklist` with a single operator action board: `canRunNow`, `canVerifyRunNow`, `canImportObservedProofNow`, `missingSecretNames`, `missingObservedFields`, `nextCommand`, `expectedUnlock`, and `stillBlockedAfterCommand`.
- Add a redacted observed proof template for hosted300 that cannot count when `sampleOnly=true`.
- Add tests for: no token, token plan shape if possible without network, sample blocked, partial import blocked, hosted100 valid but hosted300 held, hosted300 valid but marketplace held, unsafe/no-leak rejected, observed marketplace fields accepted only when all required fields are present.
- Surface the checklist across `/v1/contracts#apifyStoreReadiness`, `/v1/ops/product-slo`, Apify Actor `OUTPUT`, and `bun run check:hosted-apify-paid-readiness`.

Proof before handoff:
- `bun run check`
- hosted-readiness fixture tests
- focused API/ops tests
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:apify-publication`
- `bun run check:contract-index`
- `bun run check:api-regression`
- `bun run check:paid-actor-release-audit`

Do not invent analytics, payout, pricing, revenue, or usage numbers. This lane is monetization-critical specifically because it separates real external proof from local confidence.

## Previous Summary

- Added `hostedProofOperatorChecklist` to the hosted Apify paid-readiness proof surfaced by `/v1/contracts#apifyStoreReadiness`, `/v1/ops/product-slo`, and Apify Actor `OUTPUT`.
- Checklist reports required fields, missing fields, accepted observed fields, last observed timestamp, `sampleOnly`, gate effects, unlock summary, and copy/paste commands.
- Added validation examples for missing proof, sample proof rejected for promotion, valid hosted100 with hosted300 hold, valid hosted300 with marketplace hold, and unsafe/no-leak rejection.
- Sample imports remain accepted for shape checks but `blocked_sample` for hosted100, hosted300, and marketplace promotion.
- Unsafe imports with `noLeakFailures > 0` fail closed in `bun run check:hosted-apify-paid-readiness` and no longer render as accepted in the error payload.
- Verification is green: `bun run check`, hosted-readiness no-token/sample/fixture checks, unsafe import rejection, focused API/ops tests, Apify Actor check/smoke/publication, contract index, API regression, full `bun test`, and clean-tree paid release audit.
- Current blocker is external only: real Apify hosted 100/300 proof plus observed Store analytics, payout, pricing, refunds, and listing state must still be pasted before marketplace promotion.
