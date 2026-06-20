Status: active_program_cc_100_sellable_dark_metadata_handoff

## Current Assignment - Program CC: Dark Metadata Handoff To 100 Sellable Rows

You are not idle. Continue from Program BJ, but shift from tier contracts to buyer-visible output lift. Your job is to turn safe restricted/dark metadata into public-intelligence handoffs that help the Actor reach the first 100 sellable rows without exposing raw restricted material.

Deliverables:

1. Build a metadata-only promotion packet for at least 100 candidate dark/restricted rows, but count only rows that carry a useful actor/victim/dataset/sector/country/date hint, source-family label, liveness/freshness state, safe locator hash, no-leak proof, and next public corroboration pivots.
2. For each candidate, decide one of: `sellable_with_public_support`, `included_with_caveat`, `coverage_gap_only`, `hold`, or `suppress`. Do not mark restricted-only metadata as sellable unless a safe public source family supports the same claim.
3. Add/extend the API/ops surfaces that show: candidate count, public-corroborated count, useful caveated count, rejected count by reason, average buyer-value score, stale/duplicate/unsafe/auth/private/CAPTCHA rejection rates, and projected contribution toward the 100-sellable-row floor.
4. Feed Agent 03 parser gaps, Agent 04 public corroboration gaps, Agent 08 graph pivots, and Agent 10 revenue gate counts in their existing handoff fields. Do not create a standalone darkweb vanity report unless it moves those buyer-visible counts.
5. Preserve safety boundaries: metadata-only; no raw leak bodies, credentials, payloads, private/auth/CAPTCHA access, unsafe raw URLs, or threat-actor interaction.

Verification before stopping:

- `bun run check`
- `bun test src/tests/darkwebIndex.test.ts src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:contract-index`
- `bun test`

Commit and push a coherent green patch before marking ready. Do not leave dirty files hanging.

# Prior Completed Work

- Completed Program BJ live dark metadata value expansion for the 1,000 and 4,000 tier packets.
- Added `/v1/darkweb/status.liveValueExpansion`, `/v1/darkweb/search.productHandoff.liveValueExpansion`, `/v1/contracts.semantics.darkwebIndex.liveValueExpansion`, and `/v1/ops/product-slo.darkMetadataLiveValueExpansion`.
- Each tier exposes safe candidate rows with source family, safe locator hash, actor/victim/dataset/sector-country hints, first/last seen, liveness/freshness, buyer-value score, review state, no-leak proof, rejection reason, 12 safe sample rows, and 20+ buyer queries.
- Added refresh schedule semantics and reject buckets for duplicate, stale, generic, missing-hint, unsafe, review/legal-hold, auth/CAPTCHA/private dependency, and low buyer-value rows; failed rows do not count toward tier growth.
- Current fixture gate is held honestly: 100 evaluated, 2 value-qualified, useful-row rate 0.02, average buyer value 0.41, stale rate 0.92, duplicate rate 0.06, blocked/review rate 0.74 for both 1,000 and 4,000 packets.
- Proofs green: `bun run check`, `bun test src/tests/darkwebIndex.test.ts src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test`.

Requesting the next Agent 05 metadata-only dark/restricted metadata task.
