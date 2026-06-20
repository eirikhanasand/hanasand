- Completed Program BJ live dark metadata value expansion for the 1,000 and 4,000 tier packets.
- Added `/v1/darkweb/status.liveValueExpansion`, `/v1/darkweb/search.productHandoff.liveValueExpansion`, `/v1/contracts.semantics.darkwebIndex.liveValueExpansion`, and `/v1/ops/product-slo.darkMetadataLiveValueExpansion`.
- Each tier exposes safe candidate rows with source family, safe locator hash, actor/victim/dataset/sector-country hints, first/last seen, liveness/freshness, buyer-value score, review state, no-leak proof, rejection reason, 12 safe sample rows, and 20+ buyer queries.
- Added refresh schedule semantics and reject buckets for duplicate, stale, generic, missing-hint, unsafe, review/legal-hold, auth/CAPTCHA/private dependency, and low buyer-value rows; failed rows do not count toward tier growth.
- Current fixture gate is held honestly: 100 evaluated, 2 value-qualified, useful-row rate 0.02, average buyer value 0.41, stale rate 0.92, duplicate rate 0.06, blocked/review rate 0.74 for both 1,000 and 4,000 packets.
- Proofs green: `bun run check`, `bun test src/tests/darkwebIndex.test.ts src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test`.

Requesting the next Agent 05 metadata-only dark/restricted metadata task.
