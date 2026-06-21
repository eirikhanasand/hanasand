Status: active_program_fh_hosted_default_parser_lift_46_to_100

# Agent 03 Current Assignment - Program FH: Hosted Default Parser Lift 46 -> 100

You are no longer ready. The main-agent hosted Apify verification for run `THMm2ZzYxW4HVPGJ6` proved the real blocker: the 100-name hosted default produced 313 rows but only 46 sellable rows and 31 sellable findings. Local 1,000-row proof does not count for paid release until the hosted default clears at least 100 sellable rows and 52 true findings with no false-positive inflation.

Goal:
- Repair parser specificity and row admission for the hosted 100-name default, not synthetic/local-only packets.
- Convert stale/single-source/generic hosted rows into buyer-visible sellable findings only when current public support, actor specificity, claim context, first/last seen, buyer action, confidence reason, and no-leak proof are present.
- Preserve strict rejection for stale latest-activity claims, alias/wrong-actor rows, generic source pages, graph-only rows, restricted-only rows, duplicates, contradictions, and caveated rows.

Implementation direction:
- Start from the hosted run evidence in `check:hosted-apify-paid-readiness` (`runId=THMm2ZzYxW4HVPGJ6`, dataset `xLPoxMVY6cVjGsS4e`): identify the highest-volume held/caveated row patterns that are parser-fixable.
- Add deterministic extraction/admission improvements that increase hosted sellable findings, especially actor-specific activity, victim/target, sector/country, TTP/tool, dataset/impact, first/last seen, and next-pivot fields.
- Expose before/after counters in Apify `OUTPUT`, `/v1/ops/product-slo`, `/v1/contracts#apifyStoreReadiness`, and the paid-release audit so Agent 09 can rerun hosted proof and verify the lift.

Proof before handoff:
- `bun run check`
- focused parser/API/ops tests for changed files
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- `bun run check:api-regression`
- Do not mark ready until you have either increased the hosted-default sellable/finding path measurably or documented the exact source/support blockers that prevent it. Commit and push green changes before handoff.

# Previous Summary

- Completed Program FG parser lift from 750 to 1,000 current local sellable rows.
- Added `parserRealSellableLift.findingAdmissionLedger.currentSellable1000Lift` with 250 admitted current rows, 20 source-provenance conversions, confidence reasons, no-leak proof, next pivots, and strict rejection buckets.
- Current local gates now show 1,000 sellable rows, 963 true findings, 37 source-provenance rows, 96.3% true-finding share, and 3.7% source-provenance share.
- Surfaced the 1,000 packet through Apify Actor `OUTPUT`, `/v1/ops/product-slo`, `/v1/contracts#apifyStoreReadiness`, and `bun run check:paid-actor-release-audit`.
- Preserved zero paid credit for projected, graph-only, restricted-only, stale/latest-error, generic source pages, contradiction holds, duplicates, sample proofs, unobserved marketplace fields, missing buyer action, missing confidence reason, and missing no-leak proof.
- Verification is green for `bun run check`, full `bun test`, focused API/ops tests, Apify Actor check/smoke, contract index, and API regression. Paid-release audit integrity passes; public paid release remains held on external hosted/marketplace proof, pricing, payout, analytics, refunds, and cost/useful-row evidence.

Requesting the next Agent 03 parser/clear-web collection task.
