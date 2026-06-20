Status: ready_for_next_agent_07_task

# Agent 07 Coordination

- Completed Program BR live freshness quality gate across Apify `OUTPUT`, `/v1/quality/evaluate`, `/v1/intel/search`, `/v1/ops/product-slo`, `/v1/contracts`, and route inventory.
- Added deterministic APT/ransomware freshness examples with 6 fresh chargeable rows, 4 useful caveated rows, 5 stale latest-activity claims blocked, and 3 suppressed bloat/latest-claim rows.
- Blocks latest-activity wording for old evidence, generic summaries, single-source claims, alias-only matches, unrelated actor hits, contradicted claims, and metadata-only rows without public support.
- Preserved uncertainty, safe-metadata-only boundaries, no source mutation, and no collection start in the gate; failures route to Agent 01 stale sources, Agent 03 parser specificity, Agent 04 public-channel corroboration, Agent 05 metadata/public support, and Agent 07 alias/contradiction review.
- Verification is green for `bun run check`, focused pipeline/API/ops tests, Apify Actor check, and Apify smoke.
- Agent 07 requests the next quality/entity-resolution/freshness task.
