Status: active_program_de_dark_metadata_500_to_750_current_chargeable

# Agent 05 Program DE - Dark Metadata From 500 To 750 Current Chargeable Rows

You are no longer ready. The product has a 500-current dark metadata floor, but the next paid Actor gate is 750 current sellable rows. Your job is to make dark/restricted metadata contribute real parser-ready value toward that gate without counting unsafe or speculative rows.

Goal:
- Raise the dark metadata current-chargeable lane from `currentChargeable500` to a new `currentChargeable750` packet.
- Add at least 250 new metadata-only parser-handoff rows that can plausibly become current sellable Actor findings after public support/parser admission.
- Keep projected, restricted-only, stale, duplicate, unsupported, contradicted, and unsafe rows at 0 paid credit.
- Make every accepted row useful for a buyer pivot: actor/group, victim/target/dataset claim, sector/country when known, claimed/first-seen date, source family, safe summary, confidence, freshness, public-support hash, restricted metadata hash when applicable, no-leak proof, and next verification pivot.

Implementation direction:
- Extend `/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, `/v1/ops/product-slo`, route contracts, and the Apify Actor output surface with `currentChargeable750`.
- Add Program DE rejection buckets for no current public support, stale public support, duplicate claim, contradicted/false claim, generic source-only row, unsafe restricted-only row, missing buyer action, missing actor/target context, and raw-location leak risk.
- Prefer fresh/high-signal public-support pairings over volume. Do not inflate the 60k ladder with rows that are not worth paying for.
- Coordinate with Agent 03 by producing an explicit parser admission handoff, with Agent 07 by exposing audit blockers, and with Agent 10 by keeping paid-release gates honest.

Proof before handoff:
- `bun run check`
- `bun test src/tests/darkwebIndex.test.ts`
- focused API/ops tests touching darkweb/product SLO
- `bun run check:contract-index`
- full `bun test` if the shared tree is stable
- `bun run check:paid-actor-release-audit`

Do not mark ready after a schema-only patch. Continue until the 750 packet is route-visible, tested, no-leak safe, and directly useful to the paid Actor row floor.

## Previous Summary

- Completed Program DD dark metadata public-support lift from 250 to 500 current chargeable rows.
- Added `currentChargeable500` with 500 current rows, 250 newly chargeable Program DD parser-handoff rows, 0 projected paid-credit rows, 0 blocked rows in the 500 packet, current gap to 500 at 0, and gap to 1,000 at 500.
- Enriched safe parser-lift rows with actor attribution only when metadata-only target context, public-support hashes, freshness, no-leak proof, and buyer-value gates are present.
- Kept restricted-only, unsafe, raw-location, credential, payload, private/auth/CAPTCHA, stale, projected, and actor-interaction material out of paid counts and public output.
- Proofs green for `bun run check`, `bun test src/tests/darkwebIndex.test.ts`, focused API/ops tests, and `bun run check:contract-index`; paid-release audit shows the dark metadata lane passing at 500 current rows, with release still held on dirty-tree/hosted marketplace gates.
