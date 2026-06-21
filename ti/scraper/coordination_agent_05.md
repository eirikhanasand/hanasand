Status: active_program_dd_dark_metadata_250_to_500_current_chargeable

# Agent 05 Program DD - Dark Metadata Public-Support Lift From 250 To 500 Current Chargeable Rows

You are no longer ready. The dark metadata lane now needs to feed the 750/1,000 paid Actor row gates with fresh, metadata-only, buyer-useful rows, not just a bigger index.

Goal:
- Raise `publicSupportSellable500.currentChargeable250` to a new `currentChargeable500` packet with at least 500 current chargeable dark/restricted metadata support rows.
- Add at least 250 new parser-handoff rows that Agent 03 can evaluate for current sellable findings.
- Keep projected rows at 0 for paid credit, and keep all restricted-only rows blocked until public support and no-leak proof are present.
- Reject low-value expansion rather than counting it toward the 60k ladder.

Implementation direction:
- Extend `/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, `/v1/ops/product-slo`, `/v1/contracts#darkwebIndex`, and Apify Actor `OUTPUT` with `currentChargeable500`.
- Each accepted row must include actor/group, victim/dataset or target context, sector, country/region when available, claimed date or first seen, source family, public-support evidence id/hash, restricted metadata hash if relevant, safe summary, confidence, freshness, recheck cadence, why it is worth paying for, and no-leak proof.
- Add rejection buckets for no current public support, stale public support, duplicate claim, contradicted/false claim, generic source-only row, unsafe restricted-only row, sensitive victim exposure risk, missing buyer action, and raw-location leak risk.
- Make search return buyer-visible safe summaries and pivots only. Do not emit raw unsafe URLs, stolen data, credentials, payload links, private/auth/CAPTCHA material, or actor-interaction content.
- Coordinate with Agent 03 by producing an explicit parser admission handoff and with Agent 07 by exposing quality/audit blockers.

Proof before handoff:
- `bun run check`
- `bun test src/tests/darkwebIndex.test.ts`
- focused API/ops darkweb tests
- `bun run check:contract-index`
- full `bun test` if shared tree is stable
- `bun run check:paid-actor-release-audit`

Do not mark ready after a schema-only patch. Keep working until the 500 current-chargeable packet is route-visible, tested, and useful to Agent 03.

## Previous Summary

- Completed Program DC dark metadata 150-to-250 current chargeable row lift.
- Extended `publicSupportLift1000.publicSupportSellable500` with `currentChargeable250`: 250 current rows, 100 newly chargeable since Program DC, 0 projected rows, 250 blocked rows, current gap to 250 at 0, and current gap to 500 at 250.
- Provided 100 fresh Agent 03 parser handoff rows with safe metadata-only actor, victim/dataset, sector, country, TTP/tool, claim/date, public source, provenance, confidence, freshness, liveness, recheck cadence, and buyer-value fields.
- Added blocker buckets for no current public support, stale public support, contradiction/false-claim hold, duplicate claim, generic source-only, unsafe restricted-only, victim too sensitive to surface, and missing buyer action.
- Updated darkweb status/search, product SLO, contracts, and paid-release audit while keeping projected, restricted-only, unsafe, stale, duplicate, generic, sensitive, and contradicted rows out of current paid counts.
- Proofs green before handoff: `bun run check`, focused darkweb/API/ops tests, `bun run check:contract-index`, and full `bun test`.
- Request the next Agent 05 metadata-only dark/restricted metadata task.
