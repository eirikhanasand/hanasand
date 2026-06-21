Status: active_program_dd_hosted_apify_conversion_and_payout_truth

# Agent 09 Program DD - Hosted Apify Conversion And Payout Truth

You are no longer ready. Local data quality is improving, but revenue depends on hosted proof, pricing, payout readiness, and marketplace conversion telemetry that must be observed rather than inferred.

Goal:
- Make hosted Apify proof and paid-readiness state explicit, reproducible, and hard to overclaim.
- Verify whether the live Actor can return at least 100 hosted safe rows and the current 500 local sellable-row packet without breaking no-leak rules.
- Expose pricing, payout, analytics, and marketplace observed-state as `observed`, `blocked`, or `external_unknown` with exact next operator action.
- Keep sample, local-only, partial, unsafe, historical, draft marketplace, missing-payout, and unpriced evidence blocked from promotion.

Implementation direction:
- Extend hosted proof tooling/contracts with a 500-row local gate and hosted 100/300/500 proof ladder.
- If `APIFY_TOKEN` is present, run a hosted proof on the default 100-name preset and import observed run id, dataset id, row count, sellable/useful rows, no-leak result, usage, pricing status, and marketplace state. If not present, fail cleanly with a redacted command checklist and do not invent values.
- Check payout readiness and pricing state from Apify only when authenticated evidence is available; otherwise keep it as `external_unknown`.
- Improve Store/API product surfaces only where they help buyers understand dataset usefulness, result fields, freshness, and safe metadata limits.
- Coordinate with Agent 10 so release gates distinguish local quality from hosted monetization proof.

Proof before handoff:
- `bun run check`
- focused hosted-readiness/API/ops tests
- `bun run check:hosted-apify-paid-readiness`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- `bun run check:paid-actor-release-audit`

Do not mark ready until the hosted proof ladder is clearer than before and no placeholder pricing/payout language remains in product-facing output.

## Previous Summary

- Added the Program DC hosted proof operator action board to `hostedProofOperatorChecklist` with run/verify/import readiness, missing secrets, missing observed fields, next command, expected unlock, and remaining blockers.
- Added a redacted hosted300 observed-proof template that remains `sampleOnly=true`, plus command examples across `/v1/contracts#apifyStoreReadiness`, `/v1/ops/product-slo`, Apify Actor `OUTPUT`, and `bun run check:hosted-apify-paid-readiness`.
- Aligned hosted300 proof requirements to 300 sellable rows and 150 finding rows, while keeping sample, partial, unsafe, local-only, historical, and draft marketplace proofs blocked from promotion.
- Added hosted-readiness tests for no token, token plan shape, sample blocked, partial import blocked, hosted100-only, hosted300 marketplace hold, unsafe/no-leak rejection, and complete observed marketplace acceptance.
- Verification is green for `bun run check`, full `bun test`, focused API/ops/hosted-readiness tests, hosted-readiness fixture imports/rejections, Apify Actor check/smoke/publication, contract index, and API regression.
- Ready for the next Agent 09 API/product-surface or hosted proof task.
