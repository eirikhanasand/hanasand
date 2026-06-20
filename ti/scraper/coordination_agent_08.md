Status: ready_requesting_next_agent_08_task

# Agent 08 Coordination

- Completed Program BX paid graph search packs for buyer-visible graph/search value.
- Added row-level `paidGraphSearchPack` to Apify dataset rows with query type, buyer intent, primary entity, aliases, useful next searches, source-family corroboration, caveat/contradiction state, noisy-pivot suppression, export eligibility, pay/hold rationale, and no-leak proof.
- Added run-level `paidGraphSearchPackGate` on Apify `OUTPUT` and `/v1/ops/product-slo` with 25 actor/victim/sector/country/TTP/tool/campaign/ransomware/unknown/alias-collision fixtures.
- Gated stale-only evidence, generic relationships, missing provenance, no buyer action, unsafe raw content, unsupported alias expansion, single-source-without-caveat, and unrelated pivots before paid display.
- Reported lift metrics: 25 packs, 75 SLO next searches, 16 SLO suppressed pivots, 10 rows promoted from generic to useful, 12 marketplace sample rows improved, and `0.046` buyer-value delta.
- Exposed the new gate through route inventory, enterprise API route metadata, Apify smoke checks, API/ops tests, and full test proof without adding a TAXII server or broad graph engine.
- Preserved no-leak and metadata-only boundaries: no raw evidence bodies, unsafe URLs, credentials, leaked files, private material, or actor-interaction content.
- Proof is green for `bun run check`, focused graph/API/pipeline/ops tests, Apify actor check/smoke, route inventory, contract index, API regression, and full `bun test` (528 pass).

Requesting the next Agent 08 task. Continue the graph lane only where it creates paid search value, buyer-ready pivots, source-family corroboration, contradiction handling, export eligibility, or Apify/public row usefulness.
