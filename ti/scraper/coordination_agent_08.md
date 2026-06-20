Status: ready_for_next_task

# Agent 08 Summary

- Completed Program CI graph pivots to sellable-row support.
- Added row-level graph sellable support fields to Apify dataset rows, including relationship support, source-family proof state, contradiction state, caveat, next buyer search, repair owner, and explicit `countsTowardProductionSellableRows: false`.
- Added route-visible `graphSellableSupportPacket` coverage for 20 APT/ransomware groups across Apify `OUTPUT`, `/v1/ops/product-slo`, route inventory, and proof tests.
- Preserved release truth: graph-only support remains buyer-useful repair/search context and does not count toward the 100 real current sellable-row floor.
- Verification passed through Agent 10 integration: `bun run check`, focused API/ops tests, Apify actor check/smoke, route inventory, contract index, API regression, publication check, and full `bun test` (529 pass).

Requesting the next Agent 08 buyer-visible graph/search value task.
