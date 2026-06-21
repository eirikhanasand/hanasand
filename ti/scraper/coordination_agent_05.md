Status: active_program_fg_dark_metadata_750_to_1000_current_chargeable

# Agent 05 Program FG - Dark Metadata 750 To 1,000 Current Chargeable Rows

You are no longer ready. The dark metadata lane has reached 750 current chargeable rows; the next sellable product blocker is a 1,000-row safe metadata supply that can feed parser admission and buyer search without leaking raw restricted material.

Goal:
- Lift `currentChargeable750` to a `currentChargeable1000` packet with at least 250 additional current, metadata-only, no-leak, parser-handoff rows.
- Preserve 0 projected paid-credit rows, 0 unsafe/raw-location rows, 0 credential/payload rows, 0 private/auth/CAPTCHA rows, 0 actor-interaction rows, and 0 stale/latest-error rows counted as chargeable.
- Each accepted row must have actor/group context, target or dataset claim context, sector/country when inferable, source family, freshness, confidence, public-support hash, no-leak proof, safe summary, and next verification pivot.
- Reject low-value rows instead of padding: duplicates, unsupported actor context, missing target/dataset context, generic index pages, contradiction holds, restricted-only rows without public support, and legal/safety review material.

Implementation direction:
- Extend the existing dark metadata product handoff (`/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, Product SLO, `/v1/contracts`, Apify output source-packet surface).
- Add the 1,000-row advancement criteria toward the later 4,000/10,000/20,000/60,000 ladder, but only count rows that are useful now.
- Add tests that prove the 1,000 packet is searchable, parser-ready, safe, and excluded from paid counts unless admitted by parser/source support.

Proof before handoff:
- `bun run check`
- `bun test src/tests/darkwebIndex.test.ts`
- focused API/ops tests for changed files
- `bun run check:contract-index`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:paid-actor-release-audit`
- full `bun test` if stable

Do not mark ready until dark metadata materially improves current1000 supply and every accepted row is safe metadata only. Commit and push green changes before handoff.

## Previous Summary

- Completed Program DE dark metadata lift from 500 to 750 current chargeable metadata rows.
- Added `currentChargeable750` with 750 current rows, 250 newly chargeable Program DE parser-handoff rows, 0 projected paid-credit rows, 0 blocked rows, current gap to 750 at 0, and gap to 1,000 at 250.
- Added explicit zero-count Program DE rejection buckets for missing actor/group context, missing target/dataset context, and raw-location leak risk.
- Kept accepted rows metadata-only, hash-only, no-leak safe, and populated with actor/group, target/dataset, sector/country, source family, freshness, confidence, public support hash, no-leak proof, and next verification pivot.
- Exposed the 750 packet through `/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, `/v1/ops/product-slo`, `/v1/contracts`, and the Apify Actor release-ladder source packet surface.
- Proofs green for `bun run check`, `bun test src/tests/darkwebIndex.test.ts`, focused API/ops tests, full `bun test`, `bun run check:contract-index`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and `bun run check:apify-publication`; paid-release audit correctly remains held on external hosted/marketplace proof blockers while dark metadata passes at 750 current chargeable rows.
- Request next metadata-only dark/restricted metadata task.
