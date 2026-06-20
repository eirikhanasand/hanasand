Status: active_program_cs_graph_pivots_that_unlock_real_rows

# Agent 08 Coordination

- Completed Program CI graph pivots to sellable-row support.
- Added row-level graph sellable support fields to Apify dataset rows, including relationship support, source-family proof state, contradiction state, caveat, next buyer search, repair owner, and explicit `countsTowardProductionSellableRows: false`.
- Added route-visible `graphSellableSupportPacket` coverage for 20 APT/ransomware groups across Apify `OUTPUT`, `/v1/ops/product-slo`, route inventory, and proof tests.
- Preserved release truth: graph-only support remains buyer-useful repair/search context and does not count toward the 100 real current sellable-row floor.
- Verification passed through Agent 10 integration: `bun run check`, focused API/ops tests, Apify actor check/smoke, route inventory, contract index, API regression, publication check, and full `bun test` (529 pass).

# Current Task: Program CS Graph Pivots That Unlock Real Rows

Own graph/search support only where it converts blocked candidates into real buyer-visible rows. Graph context is useful, but it is not sellable by itself; this task must produce concrete public-source pivots, contradiction checks, and row repair handoffs that move the product toward 100 chargeable rows.

Scope:
- Start from the current `graphSellableSupportPacket`, `first100AdmissionQuality`, and dark/source repair queues. Identify 30-60 graph-supported candidate rows where a specific next public source search can confirm actor, victim/dataset, sector/country, TTP/tool, or campaign context.
- For each candidate, emit a buyer-useful `nextPublicCorroborationPivot` with query text, entity type, expected source family, expected row field it will repair, contradiction risk, and owner handoff.
- Separate graph-only context from row-unlocking support. Graph-only context must remain excluded from paid counts. Row-unlocking support must name the exact missing public proof needed for Agent 03/04/05/07/09/10.
- Add contradiction and alias-collision checks for common actor overlaps so stale or wrong-actor rows do not become sellable through graph association alone.
- Keep outputs compact and route-visible through existing product SLO/Apify/search packets; avoid building a new graph platform, STIX/TAXII server, or broad DTO layer.

Definition of done:
- Route/API/Apify proof exposes graph pivots that can reasonably unlock concrete rows toward the first 100 paid rows, with projected row gain and owner handoffs.
- Tests prove graph-only rows still do not count as sellable and contradiction/alias collision pivots are held.
- Update this file and `coordination.md`, run appropriate Bun checks/tests, commit and push a coherent green change.
- If finished early, continue into the next 30 candidates instead of stopping.
