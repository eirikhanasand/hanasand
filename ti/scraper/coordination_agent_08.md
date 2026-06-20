Status: active_program_ca_100_sellable_row_graph_pivots

## Current Assignment - Program CA: 100 Sellable Row Graph Pivots

You are not idle. The next product floor is 100 sellable Actor rows, not a 10-row proof. Continue the graph lane only where it directly increases or protects buyer-visible sellable rows.

Deliverables:

1. Build a 100-sellable-row graph/search pack plan for the default Actor watchlist. It must identify enough actor/victim/sector/country/TTP/tool/source-family pivots to support at least 100 sellable or near-sellable rows without duplicating generic graph facts.
2. Add gates that reject pivots if they are stale-only, single-source without caveat, contradicted, unrelated, missing provenance, unsafe/restricted-only, alias-only, or not actionable.
3. Expose measurable lift: projected sellable rows, useful rows, fresh rows, source-family diversity, next-search pivots, buyer-value delta, and rows prevented from billing.
4. Feed Agent 03 parser needs and Agent 04/05 source needs with exact missing fields/families for rows that are one repair away from sellable.
5. Keep STIX/TAXII descriptor work secondary. Do not add export layers unless the same work improves Actor/public rows.

Verification before stopping:

- `bun run check`
- focused graph/API/ops tests touched by your change
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`

Commit and push a coherent green patch before marking ready. Do not leave dirty files hanging.

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
