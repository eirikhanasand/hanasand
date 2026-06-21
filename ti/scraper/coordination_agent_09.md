Status: active_program_fi_hosted_100_floor_rerun_and_marketplace_import

# Agent 09 Current Assignment - Program FI: Hosted 100 Floor Rerun And Marketplace Import

You are no longer ready. Program FH fixed proof semantics; now own the next observed hosted proof loop after Agents 03/08 lift the output.

Goal:
- Rerun or verify the hosted 100-name default whenever parser/public-corroboration fixes land, and report the exact hosted floor state: rows, sellable rows, true finding rows, caveated rows, no-leak failures, second-batch audit, false-positive audit, cost, and charged events.
- Import Store-side marketplace truth when available: pricing model, payout enabled/state, analytics visible, Store views/runs/users/paid users/refunds, conversion rate, listing visibility, public listing status, and observed timestamp.
- Keep paid release blocked unless hosted proof clears the row/finding/audit gates and marketplace truth is observed. No local-only, sample, template, partial, or screenshot-only proof should count.

Implementation direction:
- Use the current baseline as the comparison target: `THMm2ZzYxW4HVPGJ6`, 46 sellable rows, 31 findings, `externalBlocker=hosted_100_name_run_below_paid_floor`.
- Add a compact “delta since previous hosted proof” surface if the next hosted run improves or regresses.
- If marketplace fields remain unavailable, leave them `external_unknown` and produce a minimal no-secret import template rather than blocking workers with vague TODOs.

Proof before handoff:
- `bun run check`
- `bun test src/tests/hostedApifyPaidReadiness.test.ts src/tests/ops.test.ts src/tests/api.test.ts`
- `bun run check:hosted-apify-paid-readiness` with a real hosted run if token is available
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- Commit and push green changes before marking ready.

# Previous Summary

- Completed Program FH hosted proof import handling for the real Apify run `THMm2ZzYxW4HVPGJ6`: observed 313 hosted rows, 46 sellable rows, 31 sellable findings, 194 caveated rows, zero no-leak failures, actor-start billing observed, and release held below the hosted100 100/52 floor.
- Updated the hosted proof checker path so a real hosted run below threshold reports `status=verified_hold` with `externalBlocker=hosted_100_name_run_below_paid_floor` instead of looking like a missing run.
- Preserved partial hosted proof as diagnostic only: local/sample/partial proof still cannot unlock paid readiness, second-batch and false-positive audits remain required, and marketplace pricing/payout/analytics/listing truth remains observed-only.
- Added/verified marketplace-missing-field import guidance and a focused regression test proving the exact 46/31 shortfall, actor-start billing field, and safe no-secret marketplace template.
- Verification target remains a safe hold until hosted output reaches at least 100 sellable rows and 52 findings, second-batch audit is observed, false-positive inflation is zero, and Store pricing/payout/analytics/listing/conversion/refund fields are imported.
- Requesting the next Agent 09 API/product-surface, hosted proof, marketplace conversion, or release-readiness task.
