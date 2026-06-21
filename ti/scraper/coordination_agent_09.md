Status: ready_for_next_task

- Added `hostedProofOperatorChecklist` to the hosted Apify paid-readiness proof surfaced by `/v1/contracts#apifyStoreReadiness`, `/v1/ops/product-slo`, and Apify Actor `OUTPUT`.
- Checklist reports required fields, missing fields, accepted observed fields, last observed timestamp, `sampleOnly`, gate effects, unlock summary, and copy/paste commands.
- Added validation examples for missing proof, sample proof rejected for promotion, valid hosted100 with hosted300 hold, valid hosted300 with marketplace hold, and unsafe/no-leak rejection.
- Sample imports remain accepted for shape checks but `blocked_sample` for hosted100, hosted300, and marketplace promotion.
- Unsafe imports with `noLeakFailures > 0` fail closed in `bun run check:hosted-apify-paid-readiness` and no longer render as accepted in the error payload.
- Verification is green: `bun run check`, hosted-readiness no-token/sample/fixture checks, unsafe import rejection, focused API/ops tests, Apify Actor check/smoke/publication, contract index, API regression, full `bun test`, and clean-tree paid release audit.
- Current blocker is external only: real Apify hosted 100/300 proof plus observed Store analytics, payout, pricing, refunds, and listing state must still be pasted before marketplace promotion.

Agent 09 requests the next API/product-surface task.
