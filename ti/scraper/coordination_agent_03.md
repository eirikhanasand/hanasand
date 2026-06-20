Status: active_program_cv_parser_admission_to_live_rows

# Agent 03 Summary

- Completed Program CO live-source parser admission lift by extending `parserRealSellableLift` with a 40-candidate `liveSourceAdmissionPacket`.
- Added 30 sellable admission rows worth 36 projected sellable-row deltas, 6 useful-caveated rows worth 8 caveated deltas, and 4 suppressions covering 10 non-billable rows.
- Release-decision progress now includes `parserRealSellableLift.liveSourceAdmissionPacket`, moving projected first-100 progress to 52/100 with 48 rows remaining and no production paid-traffic claim.
- Apify `OUTPUT`, `/v1/ops/product-slo`, API tests, ops tests, and smoke checks now guard row-level actor/family/victim/sector/country/impact/TTP/date/source/confidence/caveat/provenance/no-leak/next-search fields.
- Handoffs: Agent 04 owns second-source public corroboration for 4 caveated rows; Agent 05 owns safe public support for 8 metadata-derived rows; Agent 07 owns 8 stale/alias/generic suppression checks; Agent 10 owns release-floor counting.
- Verification green: `bun run check`, `bun test src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test`.

# Current Task: Program CV Parser Admission To Live Rows

You are no longer idle. Convert the Program CO admission packet into real parser/runtime value. The 40 candidates are not enough as projections; the monetization goal is current, public-supported, chargeable Actor rows.

Scope:
- Start from `parserRealSellableLift.liveSourceAdmissionPacket`: 40 candidates, 36 projected sellable deltas, 8 useful caveated deltas, 10 suppressed rows, 48 rows remaining to the first-100 floor.
- For the 30 sellable candidates, add or tighten parser fixtures/runtime extraction paths that prove actor, victim/target, sector, country, dataset/impact, TTP/tool/CVE, first/last seen, source family support, confidence, caveat, contradiction state, provenance hash, and next buyer search.
- For the 6 useful-caveated candidates, emit precise parser/source gaps for Agent 01/04/05 to resolve; do not count them as sellable until public corroboration exists.
- For the 4 suppressed candidates, harden stale/latest-activity, alias-collision, generic-summary, and restricted-only suppression so they cannot be sold by accident.
- Prefer improving actual Actor output rows, source-specific extraction quality, and live public source replay. Avoid DTO-only expansion unless it directly changes row admission, suppression, or proof.

Definition of done:
- Apify smoke/output and `/v1/ops/product-slo` show more real chargeable rows or a narrower, tested path to them.
- Tests prove new parser rows are not generic, stale, unsupported, or restricted-only.
- Update this file and `coordination.md`, run focused parser/API/Apify tests plus `bun run check`, then commit and push a coherent green patch.
