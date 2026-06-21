Status: active_program_fi_release_gate_after_hosted_floor_lift

# Agent 10 Current Assignment - Program FI: Release Gate After Hosted Floor Lift

You are no longer ready. Program FG separated private beta from public paid traffic; now own the release gate that consumes the next hosted proof after Agents 03/08/09 lift and reverify the hosted default.

Goal:
- Keep the paid release board brutally honest while the hosted baseline is below floor: current baseline `THMm2ZzYxW4HVPGJ6` has 46 sellable rows and 31 findings; required next floor is 100 sellable rows and 52 findings.
- Add or refine release-audit messaging so the next pass reports exactly which gate moved: hosted row/finding lift, second-batch audit, false-positive audit, pricing, payout, analytics, listing, conversion/refunds, or cost/useful-row.
- Prevent new local-only, coordination-only, DTO-only, source-count-only, or synthetic-index work from being counted as monetization progress.

Implementation direction:
- Consume `programFgObservedEvidenceBoard`, `programFgPrivateBetaDecision`, and hosted proof checker output; do not duplicate proof logic.
- Add regression coverage for the 46/31 hosted baseline staying blocked and for a hypothetical 100/52 hosted proof still requiring audit/marketplace fields.
- Keep operator output short enough to act on: one ordered blocker list and one next safe command.

Proof before handoff:
- `bun run check`
- focused ops/API/release-audit tests for changed files
- `bun run check:paid-actor-release-audit`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- Commit and push green changes before marking ready.

# Previous Summary

- Completed Program FG private-beta release decision and cost/useful-row guard across Product SLO, `/v1/contracts#apifyStoreReadiness`, paid-release audit, Apify Actor `OUTPUT`, and smoke/API/ops tests.
- Added `programFgPrivateBetaDecision` with separate `hold_paid_release`, `ready_for_private_paid_beta`, and `ready_for_public_paid_traffic` decisions so local 1,000-row proof cannot unlock hosted paid release by itself.
- Kept cost/useful-row observed-only from hosted usage data; missing hosted cost remains `unknown` and blocking rather than estimated from local rows.
- Ranked remaining revenue blockers: current1000 local sellable/useful rows, hosted100/300/500 proof, pricing, payout, analytics, conversion/refunds, no-leak/stale-latest proof, and clean test/release hygiene.
- Preserved anti-bloat guards: coordination-only, DTO-only, STIX/TAXII-only, synthetic-index, sample, partial, and local-only proof do not improve release score without buyer-visible rows or observed hosted marketplace proof.
- Verified `bun run check`, focused API/ops tests, Apify Actor check/smoke/publication checks, contract index, API regression, and paid-release audit behavior; paid traffic remains safely held until observed hosted and marketplace evidence arrives.
- Request the next Agent 10 deployment, observability, release, capacity, resource-control, or operations task.
