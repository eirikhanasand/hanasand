Status: active_program_ch_paid_row_quality_audit_to_100_rows

# Agent 07 Coordination

- Completed Program BZ paid-row contradiction and false-positive suppression gate across pipeline quality evaluation, `/v1/intel/search`, `/v1/contracts`, `/v1/ops/product-slo`, route inventory, and Apify `OUTPUT`.
- Added 32 suppression fixtures covering alias collisions, ambiguous victim names, unrelated actor co-mentions, stale reposts, single-source caveats, metadata-only holds, contradicted claims, unknown-query suppression, and true positives that stay sellable.
- Recorded lift: 12 false positives suppressed/searching, 2 contradicted rows held, 3 stale reposts blocked, 3 single-source rows caveated, 8 true positives preserved, 8 sellable rows protected, 21 rows prevented from billing, and buyer-trust delta above 0.2.
- Added owner handoffs for Agent 03/04/05/07/08/09/10 and no-leak proof for raw evidence, unsafe URLs, restricted payloads, object keys, private material, account material, and actor-interaction content.
- Verification passed: `bun run check`, focused pipeline/API/ops tests, Apify Actor check, Apify smoke, route inventory check, contract index check, and full `bun test` (529 pass).

## Current Task: Program CH Paid-Row Quality Audit To 100 Rows

Build the next sellable-data quality layer, not a contract-only layer. Audit the current Apify Actor rows, `/v1/intel/search` rows, and `/v1/ops/product-slo.releaseDecision` so the product can move from 3-16 current sellable rows toward 100 true sellable rows without counting graph-only, synthetic, stale, restricted-only, or caveat-only rows.

Deliverables:
- Add a route-visible and Apify-visible paid-row audit that classifies rows into `sellable`, `useful_caveated`, `needs_public_support`, `stale_or_duplicate`, `wrong_actor_or_alias_collision`, `restricted_only`, and `not_payworthy`.
- For every non-sellable class, emit the exact repair action and owner handoff needed to turn the row into a buyer-visible finding or suppress it.
- Add fixtures that prove APT29/APT28/APT42/Turla/Volt Typhoon/Lazarus/Sandworm/Scattered Spider plus LockBit/Akira/Clop/Black Basta/RansomHub/Play/Qilin behave correctly.
- Update tests so the release gate refuses to count graph-only projections, synthetic rows, stale rows, restricted-only metadata, or caveated rows as production sellable rows.
- Produce a compact metric summary: current sellable rows, protected sellable rows, suppressed false positives, rows one repair away, expected sellable lift after parser/source repairs, and rows prevented from billing.

Do not stop after a small patch. Continue until `bun run check`, Apify check/smoke, focused API/ops/pipeline tests, contract checks, and full `bun test` are green. Commit and push your coherent changes when done so other workers are not blocked by dirty files.
