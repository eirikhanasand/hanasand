Status: active_program_cn_first_100_paid_row_admission_quality

# Agent 07 Coordination

- Completed Program CH paid-row audit to the 100-row floor across pipeline quality evaluation, `/v1/ops/product-slo`, `/v1/intel/search`/contract response keys, route inventory, and Apify `OUTPUT`.
- Added route-visible and Apify-visible row classification for `sellable`, `useful_caveated`, `needs_public_support`, `stale_or_duplicate`, `wrong_actor_or_alias_collision`, `restricted_only`, and `not_payworthy`.
- Added fixtures covering APT29, APT28, APT42, Turla, Volt Typhoon, Lazarus Group, Sandworm, Scattered Spider, LockBit, Akira, Clop, Black Basta, RansomHub, Play, and Qilin with repair owners/actions and no-leak proof.
- Added release-gate coverage that refuses graph-only projections, synthetic rows, stale rows, restricted-only metadata, and caveated rows as production sellable rows.
- Recorded compact metrics: 5 current/protected sellable rows, 7 suppressed false positives, 9 one-repair-away rows, 21 expected sellable rows after parser/source repairs, 39 rows prevented from billing, and a 95-row floor gap.
- Verification passed: `bun run check`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:route-inventory`, `bun run check:contract-index`, focused pipeline/API/ops tests, and full `bun test` (529 pass).

# Current Task: Program CN First-100 Paid Row Admission Quality

Own the quality admission gate for the first real 100 sellable rows. The product must not reach the 100-row floor by admitting low-value rows, stale reposts, weak aliases, generic source summaries, directory-only darkweb index entries, or rows that only look useful because of graph/context fields.

Scope:
- Build an admission-quality packet across `/v1/quality/evaluate`, `/v1/intel/search`, `/v1/contracts`, `/v1/ops/product-slo`, and Apify `OUTPUT`.
- Define pass/fail rules for a row to count as production sellable: fresh enough, actor-specific, source-backed, source-family support present, buyer action present, provenance hash present, no contradictions, no unsafe/restricted-only dependency, and no default/demo/old-summary behavior.
- Add at least 40 fixtures across APT and ransomware rows: accepted sellable, caveated useful, needs public support, stale/duplicate, alias collision, wrong actor, restricted-only, graph-only, synthetic/proof-only, generic market/source page, and low buyer-value rows.
- Expose metrics that Agent 10 can use directly: rows admitted to production floor, rows downgraded to caveated context, rows suppressed, rows needing parser repair, rows needing source support, rows needing dark metadata public support, estimated buyer-value delta, and row-count inflation blocked.
- Coordinate with Agent 03 for parser field failures, Agent 04 for stale/source support failures, Agent 05 for restricted metadata public support, Agent 08 for graph-only/contradiction failures, Agent 09 for marketplace sample rows, and Agent 10 for release decisions.
- Do not add generic quality architecture unless it blocks bad paid rows or admits good ones. This lane exists to protect buyer trust and monetize only rows worth paying for.

Definition of done:
- The admission packet is route-visible and covered by tests.
- Non-sellable rows cannot count toward the 100-row paid floor.
- Accepted rows include why the buyer should care and what search/pivot/action they enable.
- `bun run check`, Apify check/smoke, focused pipeline/API/ops tests, contract checks, and full `bun test` are green.
- Update this file and `coordination.md`, then commit and push a coherent change. Do not leave dirty files behind.
