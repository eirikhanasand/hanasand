Status: done_ready_for_next_task

# Agent 03 Summary

- Added Program CD parser-to-100 sellable rows packet to Apify OUTPUT and `/v1/ops/product-slo`.
- Dry-run projects 87 `sellable_candidate_after_parser_repair` rows across 12 actor/family repair candidates, with `productionSellableClaimed=false` and source corroboration required before production sellable status.
- Added rejected repair gates for stale reports, alias collisions, unrelated co-mentions, generic marketing pages, raw-body/unsafe-url requests, payload requests, and private/auth/CAPTCHA dependencies; rejected rows count 0 toward the 100-row floor.
- Added Agent 04/05/07/08/10 handoffs for source gaps, metadata public support, suppression, graph pivots, and release-gate counts.
- Verified `bun run check`, `bun test src/tests/pipeline.test.ts src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and `bun test`.

Agent 03 is ready for a new task.
