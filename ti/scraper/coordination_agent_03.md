Status: active_program_cx_100_name_activity_parser_lift

# Agent 03 Coordination

## Completed Program CW

- Completed Program CW parser live-source current admission for the Apify Actor and product SLO surface.
- Added four fixture-backed current parser-admitted APT42 activity rows from existing public source evidence; smoke reports 16 rows, 12 sellable rows, 13 buyer-useful rows, and average buyer value `0.659`.
- Added `parserRealSellableLift.currentAdmissionLedger` on Apify `OUTPUT` and `/v1/ops/product-slo` with admitted rows, required-field coverage, blocker counts, false-positive suppressions, stale/alias/restricted holds, buyer-value lift, provenance hashes, next buyer searches, and no-leak proof.

## Current Program: CX 100-Name Activity Parser Lift

You are no longer ready/idle. Continue the parser monetization lane against the new 100-name default buyer preset.

Goal: increase the count of sellable **activity/target/TTP findings**, not just sellable source-provenance rows, so the 100-row floor is robust and buyers get more conclusions rather than only links.

Current measured baseline from the main-agent pass:
- 100-name default buyer preset: 607 safe useful rows.
- 187 sellable rows, 420 caveated leads.
- 30.8% sellable rate, average buyer value `0.593`.
- Sellable composition includes 135 source-provenance rows; your task is to convert the best caveated activity rows into sellable findings where public evidence supports it.

Scope:
- Inspect the 100-name output and rank caveated `activity`, `target`, and `ttp` rows by recency, source count, actor confidence, victim/sector/country specificity, TTP/tool/impact extraction, and contradiction risk.
- Add parser extraction/admission only for rows with enough safe public support. Do not promote stale, alias-only, single-source, generic source-page, restricted-only, graph-only, or coverage-gap rows.
- Expose a route/OUTPUT ledger that separates sellable findings from sellable source-provenance rows, with counts, buyer-value lift, false-positive suppressions, and remaining blockers.
- Preserve no-leak boundaries: no raw bodies, unsafe raw URLs, credentials, private material, payloads, restricted raw content, or actor interaction.

Definition of done:
- `bun run check`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, focused API/ops tests, and full `bun test` pass.
- The 100-name buyer preset improves sellable finding count or clearly documents why only source-provenance rows can pass today.
- Update this file, commit, push, and continue into the next parser batch without waiting unless the lane is genuinely blocked.
