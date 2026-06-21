Status: active_program_dd_parser_500_to_750_current_sellable

# Agent 03 Program DD - Parser Lift From 500 To 750 Current Sellable Rows

You are no longer ready. Program DC closed the local 500-row gate; now move the paid Actor toward the next production floor without padding it with source pages, projected rows, or graph-only context.

Goal:
- Raise current local sellable rows from 500 to at least 750.
- Keep true findings at or above 70% of sellable rows.
- Keep source-provenance-only rows at or below 25% of sellable rows.
- Preserve zero paid credit for projected, graph-only, restricted-only, stale/latest-error, generic source pages, contradiction holds, duplicate claims, sample proofs, unobserved marketplace fields, and rows missing buyer action.

Implementation direction:
- Extend the parser admission ledger with `currentSellable750Lift`.
- Pull candidates from Agent 05 dark metadata public-support rows, Agent 08 public corroboration handoff rows, Agent 04 high-value source replacement rows, and existing current clear-web evidence that can become actor/victim/target/TTP findings.
- Every admitted row must include actor/group, victim or target/context, sector, country/region when available, TTP/tool/campaign when available, dataset/impact claim when available, first/last seen, source family, provenance hash, confidence, freshness state, why a buyer would pay for it, no-leak proof, and next pivot.
- Add strict rejection buckets for stale-only, duplicate, generic profile/source page, weak actor match, wrong actor/alias conflict, restricted-only, graph-only, missing victim/context, missing source family, missing buyer action, missing no-leak proof, and source-provenance-only density overflow.
- Surface the 750-lift packet in Apify Actor `OUTPUT`, `/v1/ops/product-slo`, `/v1/contracts#apifyStoreReadiness`, and `bun run check:paid-actor-release-audit`.

Proof before handoff:
- `bun run check`
- focused parser/API/ops tests
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- `bun run check:api-regression`
- `bun run check:paid-actor-release-audit`

Do not stop after one small patch. If 750 is achieved cleanly, immediately draft the 1,000-current lift plan and begin admitting rows that meet the same quality gates.

## Previous Summary

- Completed Program DC parser lift from 300 to 500 current local sellable rows.
- Added `parserRealSellableLift.findingAdmissionLedger.currentSellable500Lift` and surfaced it through Apify Actor `OUTPUT`, `/v1/ops/product-slo`, `/v1/contracts#apifyStoreReadiness`, and the paid-release audit ladder.
- 500 gate now passes locally with 500 current sellable rows, 413 true findings, 87 source-provenance rows, 82.6% true-finding share, and 17.4% source-provenance share.
- Preserved zero paid credit for projected, graph-only, restricted-only, stale/latest-error, generic, contradicted, duplicate, sample, and unobserved marketplace rows.
- Verification was green for `bun run check`, focused API/ops tests, full `bun test`, Apify Actor check/smoke/publication, contract index, API regression, and paid audit product gates. Paid audit still holds/fails release hygiene until the worktree is committed and external hosted/marketplace proof is observed.
- Ready for the next Agent 03 parser/clear-web collection task.
