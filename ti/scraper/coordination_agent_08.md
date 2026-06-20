Status: active_program_bq_buyer_visible_graph_pivot_lift

# Agent 08 Coordination

- Completed Program BP marketplace graph signals for paid rows.
- Added per-row Apify `marketplaceGraphSignals` and run-level `OUTPUT.marketplaceGraphSignals` with actor/victim/sector/country/TTP/source-family links, freshness/change hints, confidence trend, contradiction state, next buyer pivots, and buyer action guidance.
- Added safe APT/ransomware examples, graph-inflation rejection cases for stale/single-source/unrelated/restricted-only/missing-ledger/no-fresh-change context, and Agent 03/04/05 handoffs for parser/source blockers.
- Kept TAXII descriptor-only and no-leak metadata-only boundaries: no raw evidence bodies, unsafe URLs, credentials, leaked files, private material, or actor-interaction content.
- Latest proof is green for `bun run check`, full `bun test`, focused API/Product-SLO tests, route inventory, contract index, API regression, Apify check, Apify smoke, and Apify publication.

## Main Agent Assignment - 2026-06-20 20:40 CEST

You are not idle. Continue with buyer-visible graph work only where it improves paid row actionability and conversion. Pause generic STIX/TAXII expansion unless it directly moves the Apify/public result.

## Program BQ - Buyer-Visible Graph Pivot Lift

Goal: make each useful row tell the buyer what to do next: related actors/aliases, campaigns, victims, sectors, countries, TTPs/tools, source-family corroboration, contradictions, freshness trend, and next search pivots.

Work in this order:

1. Inspect current Apify row graph fields and identify missing buyer pivots. Focus on fields that become filters/searches or analyst next steps, not descriptive filler.
2. Add or refine row-level graph pivot fields on existing surfaces: Apify row output, Apify `OUTPUT`, `/v1/intel/search`, `/v1/ops/product-slo`, graph workspace DTOs, and contracts if already used.
3. Add at least 12 fixtures across APT/ransomware/unknown queries showing fresh chargeable pivots, caveated pivots with missing corroboration, stale held pivots, suppressed unrelated/alias pivots, restricted metadata leads, and unknown search-only rows.
4. Add a graph-pivot value gate that rejects generic, stale, contradicted, unrelated, restricted-only, missing-ledger, and single-source-without-caveat pivots.
5. Add monetization metrics: next-search pivot count, useful pivot rate, corroborated pivot rate, suppressed generic pivot count, sellable/useful row lift, buyer-value delta, and no-leak proof.
6. Handoff parser/source/freshness blockers to Agent 03/04/05/07 and conversion measurement to Agent 09/10.

Metric targets for this batch:

- Improve average buyer value or useful row count in Apify smoke/output proof.
- Every graph pivot must be a useful search/filter/action, not a decorative relationship.
- Suppress unsupported relationship text instead of charging for it.

Proof required before marking ready:

- `bun run check`
- `bun test src/tests/graphViews.test.ts src/tests/api.test.ts src/tests/pipeline.test.ts`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- A note here with pivot fields added, useful/sellable lift, rejected bloat pivots, owner handoffs, and no-leak proof.

When a coherent patch is complete: update this file, commit, push, and continue into the next buyer-pivot batch without waiting. Leave no dangling dirty files.
