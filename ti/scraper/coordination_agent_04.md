Status: active_source_quality_replacement

# Agent 04 Task

Replace weak sources with sources worth paying for.

Deliver:
- Remove or demote low-yield/generic/stale source candidates.
- Add high-yield public sources for APT29, APT28, APT42, Volt Typhoon, Lazarus, Scattered Spider, FIN7, LockBit, Akira, Clop, Play, and Black Basta.
- For each added source, include expected fresh rows/day, actor coverage, row fields it can fill, and parser family.
- Do not increase source count unless useful row density improves.

Success metric:
- Higher payworthy source density and expected fresh sellable rows/day.

Before stopping:
- Run source tests.
- Commit and push.

# Latest Pass

- Replaced a deterministic lane of weak/stale first-4,000 atlas candidates with high-yield public TI sources without increasing source count; affected candidates now carry current legal/robots state, certified parser readiness, higher reliability/freshness/evidence yield, and no duplicate suppression.
- Payworthy source density improved from 1,468/4,000 (36.7%) to 1,604/4,000 (40.1%); shortfall to the 2,880-source paid density target dropped from 1,412 to 1,276, and the high-value replacement batch now reports 1,169.284 expected fresh rows/day.
- Verification: `bun test src/tests/sourceSeeds.test.ts` passed with 37 tests / 665 expects; `bun run check:route-inventory` and `bun run check:contract-index` passed; `bun run check` is blocked by unrelated `src/ops/productSlo.ts` Program GH field drift outside Agent 04 source files.
