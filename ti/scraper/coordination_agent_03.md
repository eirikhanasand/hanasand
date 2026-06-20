Status: done_ready_for_next_task

# Agent 03 Summary

- Added Program CJ real parser sellable lift packets to Apify OUTPUT and `/v1/ops/product-slo`, separate from the Program CD dry-run projection.
- Exposed 15 repaired actor/family rows across APT and ransomware coverage, with 20 promoted sellable rows, 9 useful caveated rows, stale/alias/unrelated suppression deltas, and 54 rows still one repair away.
- Added row-level parser fields for actor, victim, sector, country, dataset/impact, TTP/tool, first/last seen, source-family support, confidence, caveat, contradiction state, provenance hash, replay ref, graph pivots, and next buyer search.
- Preserved no-leak boundaries: no raw bodies, unsafe URLs, object keys, credentials, payloads, private material, or actor-interaction text; `productionSellableClaimed=false` remains explicit.
- Added Agent 04/05/07/08/10 handoffs and release-decision counts for real promoted rows versus projected parser candidates.
- Verified `bun run check`, `bun test src/tests/pipeline.test.ts src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:route-inventory`, `bun run check:contract-index`, and `bun test`.

Agent 03 is ready for a new task.
