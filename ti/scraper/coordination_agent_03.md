Status: active_program_dc_parser_300_to_500_current_sellable

# Agent 03 Program DC - Parser Lift From 300 To 500 Current Sellable Rows

You are no longer ready. The local 300 gate is closed; now move the product toward the 1,000-row tier with real current findings, not source-provenance padding.

Goal:
- Raise current local sellable rows from 300 to at least 500.
- Keep true findings at or above 55% of sellable rows.
- Keep source-provenance-only rows at or below 40% of sellable rows.
- Preserve zero paid credit for projected rows, graph-only rows, restricted-only rows, stale/latest-error rows, generic profile/source pages, contradiction holds, duplicate claims, sample proofs, and unobserved marketplace fields.

Implementation direction:
- Extend the existing parser admission ledger with `currentSellable500Lift`.
- Admit rows from Agent 05 `currentChargeable250`, Agent 08 parser-ready public proof, Agent 04 high-value public source replacement rows, and existing current public-source evidence.
- Every accepted row must include actor/group, victim or target/context, sector, country/region when available, TTP/tool/campaign when available, dataset/impact claim when available, first/last seen, source family, provenance hash, confidence, freshness state, why worth paying for, and no-leak proof.
- Add strict rejection buckets for low-value, stale, generic, source-provenance-only-risk, graph-only, restricted-only, contradicted, duplicated, missing victim/context, missing source family, and missing buyer action.
- Surface the 500-lift packet in Apify Actor `OUTPUT`, `/v1/ops/product-slo`, and `bun run check:paid-actor-release-audit`.

Proof before handoff:
- `bun run check`
- focused parser/API/ops tests
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- `bun run check:api-regression`
- `bun run check:paid-actor-release-audit`

Do not stop after one small patch. If 500 is achieved cleanly, immediately continue toward a 750 current sellable row plan with the same quality gates.

## Previous Summary

- Completed Program DB parser lift from 250 to 300 current local sellable rows.
- Added `parserRealSellableLift.findingAdmissionLedger.currentSellable300Lift` to Apify Actor `OUTPUT` and `/v1/ops/product-slo`.
- Admitted 50 current local rows: 30 from Agent 05 `currentChargeable150`, 15 from Agent 08 parser-ready public proof, and 5 from existing public-source evidence.
- Converted 5 source-provenance rows into true findings, ending at 300 current sellable rows, 193 true findings, 107 source-provenance rows, and 35.7% source-provenance share.
- Preserved hosted-proof separation: all new rows count toward local current paid proof only and never toward hosted/marketplace promotion.
- Updated paid-release audit inputs and integrity checks so the local 300 gate passes only from current, public-supported, no-leak rows.
- Verification is green for `bun run check`, Actor check/smoke/publication, focused API/ops tests, route inventory, contract index, API regression, and full `bun test`.
