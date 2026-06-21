Status: active_program_fg_parser_current_750_to_1000_sellable_rows

# Agent 03 Program FG - Parser Current 750 To 1,000 Sellable Rows

You are no longer ready. The 750 local sellable gate is real progress; the next monetization blocker is the 1,000 current local sellable gate and the useful-row density required for private beta. Own the parser/clear-web lift from 750 to 1,000 without weakening evidence quality.

Goal:
- Add at least 250 additional observed current local sellable rows, lifting the paid-release audit from 750 to 1,000 current sellable rows.
- Keep true-finding share >= 55%, source-provenance share <= 40%, stale/latest-error rows at 0, graph-only rows at 0 paid credit, restricted-only rows at 0 paid credit, and projected rows at 0 paid credit.
- Improve useful-row count and useful density, not only row count. Rows should help actor, victim, target sector/country, TTP/tool, dataset claim, source-family, freshness, confidence, contradiction, and next-pivot decisions.
- Ensure every admitted row has buyer action, source family, provenance hash, no-leak proof, freshness state, confidence reason, and a specific next search pivot.

Implementation direction:
- Extend the existing `parserRealSellableLift.findingAdmissionLedger` path rather than adding a parallel parser ledger.
- Prefer admitted rows that convert caveated/source-provenance rows into true findings, suppress stale/latest-activity defects, or add fresh public corroboration for APT/ransomware actors.
- Surface the 1,000-current packet through Product SLO, `/v1/contracts#apifyStoreReadiness`, Apify Actor `OUTPUT`, and the paid-release audit.
- Add/adjust focused tests so the 1,000-current gate cannot pass with duplicates, generic source pages, unsupported actor aliases, stale/latest errors, graph-only context, restricted-only metadata, or synthetic rows.

Proof before handoff:
- `bun run check`
- focused parser/API/ops tests for changed files
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- `bun run check:api-regression`
- `bun run check:paid-actor-release-audit`
- full `bun test` if the shared tree is stable

Do not mark ready until the release audit shows the current1000 local sellable gate moved materially, blockers are explicit, and your coherent changes are committed and pushed.

## Previous Summary

- Completed Program DD parser lift from 500 to 750 current local sellable rows.
- Added `parserRealSellableLift.findingAdmissionLedger.currentSellable750Lift` with 250 admitted current rows, 30 source-provenance conversions, strict rejection buckets, no-leak proof, next pivots, and a 1,000-current draft plan.
- Current local gates now show 750 sellable rows, 693 true findings, 57 source-provenance rows, 92.4% true-finding share, and 7.6% source-provenance share.
- Surfaced the 750 packet through Apify Actor `OUTPUT`, `/v1/ops/product-slo`, `/v1/contracts#apifyStoreReadiness`, and `bun run check:paid-actor-release-audit`.
- Preserved zero paid credit for projected, graph-only, restricted-only, stale/latest-error, generic source pages, contradiction holds, duplicates, sample proofs, unobserved marketplace fields, missing buyer action, and missing no-leak proof.
- Verification was green for `bun run check`, full `bun test`, focused parser/API/ops tests, Apify Actor check/smoke, contract index, and API regression. Paid-release audit integrity passes; public paid release remains held on external hosted/marketplace proof and current1000 gates.

Requesting the next Agent 03 parser/clear-web collection task.
