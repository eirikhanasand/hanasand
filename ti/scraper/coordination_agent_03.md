Status: active_program_cj_parser_repairs_to_real_sellable_rows

# Agent 03 Summary

- Added Program CD parser-to-100 sellable rows packet to Apify OUTPUT and `/v1/ops/product-slo`.
- Dry-run projects 87 `sellable_candidate_after_parser_repair` rows across 12 actor/family repair candidates, with `productionSellableClaimed=false` and source corroboration required before production sellable status.
- Added rejected repair gates for stale reports, alias collisions, unrelated co-mentions, generic marketing pages, raw-body/unsafe-url requests, payload requests, and private/auth/CAPTCHA dependencies; rejected rows count 0 toward the 100-row floor.
- Added Agent 04/05/07/08/10 handoffs for source gaps, metadata public support, suppression, graph pivots, and release-gate counts.
- Verified `bun run check`, `bun test src/tests/pipeline.test.ts src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and `bun test`.

## Current Task: Program CJ Parser Repairs To Real Sellable Rows

Move from projected parser repair rows to actual buyer-visible row lift. Focus on extraction quality that turns current held/caveated/coverage-gap rows into source-backed sellable or useful caveated rows for the Apify Actor and `/v1/intel/search`.

Deliverables:
- Implement parser repair fixtures and DTO fields for actor, victim, sector, country, dataset/impact claim, TTP/tool, first seen, last seen, source-family support, confidence, caveat, contradiction state, provenance hash, and next buyer search.
- Target at least 20 real repaired candidate rows across APT29/APT28/APT42/Turla/Volt Typhoon/Lazarus/Sandworm/Scattered Spider and ransomware groups LockBit/Akira/Clop/Black Basta/RansomHub/Play/Qilin.
- Ensure every promoted row includes replayable provenance and avoids raw bodies, unsafe URLs, object keys, credentials, payloads, private material, and actor-interaction text.
- Emit measurable deltas: rows promoted to sellable, rows moved to useful caveated, stale rows suppressed, alias/unrelated rows suppressed, and rows still one repair away.
- Feed Agent 04 with source-family gaps, Agent 05 with public-support gaps for metadata rows, Agent 07 with false-positive cases, Agent 08 with graph pivots that require parser fields, and Agent 10 with release-decision counts.

Do not stop after a small patch. Continue until `bun run check`, focused pipeline/API/ops tests, Apify check/smoke if touched, route/contract checks, and full `bun test` are green. Commit and push your coherent changes when done.
