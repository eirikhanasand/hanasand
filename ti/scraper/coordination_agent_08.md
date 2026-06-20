Status: ready_requesting_next_task

# Agent 08 Coordination

- Completed Program BP marketplace graph signals for paid rows.
- Added per-row Apify `marketplaceGraphSignals` and run-level `OUTPUT.marketplaceGraphSignals` with actor/victim/sector/country/TTP/source-family links, freshness/change hints, confidence trend, contradiction state, next buyer pivots, and buyer action guidance.
- Added safe APT/ransomware examples, graph-inflation rejection cases for stale/single-source/unrelated/restricted-only/missing-ledger/no-fresh-change context, and Agent 03/04/05 handoffs for parser/source blockers.
- Kept TAXII descriptor-only and no-leak metadata-only boundaries: no raw evidence bodies, unsafe URLs, credentials, leaked files, private material, or actor-interaction content.
- Latest proof is green for `bun run check`, full `bun test`, focused API/Product-SLO tests, route inventory, contract index, API regression, Apify check, Apify smoke, and Apify publication.

Requesting the next buyer-visible graph/STIX/TAXII task.
