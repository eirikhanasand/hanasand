Status: active_program_dc_dark_metadata_150_to_250_current_chargeable

# Agent 05 Program DC - Dark Metadata From 150 To 250 Current Chargeable Rows

You are no longer ready. The next paid-data unlock is to make restricted/dark metadata useful enough to feed current parser rows without leaking raw material.

Goal:
- Raise dark metadata current chargeable rows from 150 to at least 250.
- Provide at least 100 new parser-admittable current handoff rows to Agent 03.
- Keep projected-after-public-support rows excluded from current paid counts.
- Keep restricted-only, stale, duplicate, generic, contradiction-held, victim-sensitive, and unsafe rows out of current chargeable rows.

Implementation direction:
- Extend the existing stable `publicSupportLift1000.publicSupportSellable500` packet with `currentChargeable250`.
- For each newly current row include actor/group, victim/dataset label or safe target context, sector, country/region, dataset/impact claim, TTP/tool where available, claimed/observed date, first/last seen, public-support source family, safe public source id/hash, provenance hash, confidence, freshness/liveness/recheck cadence, parser handoff fields, and why it is worth paying for.
- Add blocker buckets for no current public support, stale support, contradiction/false-claim hold, duplicate claim, generic source-only, unsafe restricted-only, victim too sensitive to surface, and missing buyer action.
- Surface the 250-current state through `/v1/darkweb/status`, `/v1/darkweb/search`, `/v1/ops/product-slo`, `/v1/contracts`, and `bun run check:paid-actor-release-audit`.
- Do not crawl, expose raw onion/unsafe URLs, download stolen files, collect credentials, follow payload links, bypass auth/CAPTCHA, or interact with threat actors.

Proof before handoff:
- `bun run check`
- focused darkweb/API/ops tests
- `bun run check:contract-index`
- full or relevant `bun test`
- `bun run check:paid-actor-release-audit`

If 250 is clean, continue into a 500-current dark metadata plan only after proving useful-row density and source-family diversity.

## Previous Coordination

- Completed Program DB dark metadata 100-to-150 current chargeable row lift.
- Kept `publicSupportLift1000.publicSupportSellable500` as the stable route-visible packet and expanded it to 150 current public-supported chargeable rows.
- Added `currentChargeable150` with 50 newly chargeable rows since Program DA, 48 projected-after-public-support rows, 302 blocked/not-chargeable rows, current gap to 150 at 0, current gap to 250 at 100, and projected gap to 250 at 52.
- Limited `newlyChargeableParserHandoffRows` to the 50 Program DB rows so Agent 03 receives fresh parser-admittable current handoffs with actor, victim/dataset, sector, country, TTP/tool, dataset claim, date, public source family, safe public source id/hash, provenance hash, freshness, liveness/recheck cadence, and why-worth-paying-for fields.
- Added explicit `contradiction_hold` blocker bucket alongside needs-public-support, stale-public-support, duplicate, unsafe-restricted-only, generic-source-only, and victim-sensitive holds.
- Updated `/v1/ops/product-slo.darkMetadataPublicSupportLift4000.publicSupportSellable500` and paid-release audit to read the 150-current dark metadata state while keeping projected and restricted-only rows out of paid counts.
- Preserved approved boundaries: metadata-only; no raw leak bodies, stolen-file download, credentials, payloads, unsafe raw URLs, private/auth/CAPTCHA access, or threat-actor interaction.
- Proofs green before handoff: `bun run check`, focused darkweb/API/ops tests, `bun run check:contract-index`, full `bun test`, and clean-tree paid-release audit after commit/push.
