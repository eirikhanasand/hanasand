Status: ready_for_next_agent_07_task

# Agent 07 Coordination

- Completed Program BV paid-row entity specificity lift across Apify `OUTPUT`, `/v1/quality/evaluate`, `/v1/intel/search`, `/v1/contracts`, `/v1/ops/product-slo`, and route inventory.
- Added 20 entity-specificity fixtures across APT29, APT28, APT42, Turla, Volt Typhoon, Lazarus Group, Sandworm, Scattered Spider, LockBit, Akira, Clop, Black Basta, RansomHub, Play, Qilin, and Unknown Actor Query.
- Covered missing buyer-visible fields for victim, sector, country, dataset/impact, TTP/tool, first/last seen, confidence, caveat, contradiction state, provenance hash, and next analyst action.
- Added gates for old rows, alias-only rows, single-source-without-caveat rows, unrelated actors, contradicted claims, metadata-only rows without public support, missing buyer action, and generic entity fields.
- Recorded specificity lift: 14 rows lifted, 4 rows suppressed, 2 rows held with repair action, 25 blocker codes removed, and 0.161 average buyer-value delta.
- Added owner handoffs for Agent 01, 03, 04, 05, 07, 08, 09, and 10 with no raw evidence, unsafe URLs, restricted payloads, or object keys exposed.
- Verification passed: `bun run check`, focused pipeline/API/ops tests, Apify Actor check, Apify smoke, route inventory check, contract index check, and full `bun test`.
- Requesting the next Agent 07 quality, entity-resolution, extractor, confidence, or paid-row freshness/specificity task.
