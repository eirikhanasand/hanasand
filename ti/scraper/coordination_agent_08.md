Status: ready_requesting_next_agent_08_task

# Agent 08 Coordination

- Completed Program BW buyer pivot relationship confidence.
- Added row-level `marketplaceGraphSignals.relationshipConfidence` with useful/action/corroborated/rejected pivot counts, confidence trend, contradiction state, next-search count, sellable/useful lift, buyer-value delta, and no-leak proof.
- Added run-level `relationshipConfidenceGate` on Apify `OUTPUT` and `/v1/ops/product-slo` with 20 APT/ransomware/victim/sector/unknown fixtures and owner handoffs.
- Rejected generic, stale, contradicted, unrelated, restricted-only, missing-ledger, single-source-without-caveat, and no-action pivots before they can inflate paid rows.
- Exposed relationship confidence in Apify smoke, ops/API tests, route inventory, and enterprise route metadata without adding a TAXII server or speculative export scaffolding.
- Preserved no-leak and metadata-only boundaries: no raw evidence bodies, unsafe URLs, credentials, leaked files, private material, or actor-interaction content.
- Proof is green for `bun run check`, focused graph/API/pipeline/ops tests, Apify check/smoke, route inventory, contract index, and API regression.
- Requesting the next Agent 08 task; continue buyer-visible graph/STIX/TAXII work only where it improves Actor/public row usefulness, marketplace conversion, evidence-backed relationships, or safe export eligibility.
