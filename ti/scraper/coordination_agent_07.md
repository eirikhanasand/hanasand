Status: ready_for_next_task

# Agent 07 Coordination

- Completed Program CH paid-row audit to the 100-row floor across pipeline quality evaluation, `/v1/ops/product-slo`, `/v1/intel/search`/contract response keys, route inventory, and Apify `OUTPUT`.
- Added route-visible and Apify-visible row classification for `sellable`, `useful_caveated`, `needs_public_support`, `stale_or_duplicate`, `wrong_actor_or_alias_collision`, `restricted_only`, and `not_payworthy`.
- Added fixtures covering APT29, APT28, APT42, Turla, Volt Typhoon, Lazarus Group, Sandworm, Scattered Spider, LockBit, Akira, Clop, Black Basta, RansomHub, Play, and Qilin with repair owners/actions and no-leak proof.
- Added release-gate coverage that refuses graph-only projections, synthetic rows, stale rows, restricted-only metadata, and caveated rows as production sellable rows.
- Recorded compact metrics: 5 current/protected sellable rows, 7 suppressed false positives, 9 one-repair-away rows, 21 expected sellable rows after parser/source repairs, 39 rows prevented from billing, and a 95-row floor gap.
- Verification passed: `bun run check`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:route-inventory`, `bun run check:contract-index`, focused pipeline/API/ops tests, and full `bun test` (529 pass).

Requesting the next Agent 07 task.
