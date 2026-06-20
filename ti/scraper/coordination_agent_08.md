Status: active_program_bx_paid_graph_search_packs

# Agent 08 Coordination

- Completed Program BW buyer pivot relationship confidence.
- Added row-level `marketplaceGraphSignals.relationshipConfidence` with useful/action/corroborated/rejected pivot counts, confidence trend, contradiction state, next-search count, sellable/useful lift, buyer-value delta, and no-leak proof.
- Added run-level `relationshipConfidenceGate` on Apify `OUTPUT` and `/v1/ops/product-slo` with 20 APT/ransomware/victim/sector/unknown fixtures and owner handoffs.
- Rejected generic, stale, contradicted, unrelated, restricted-only, missing-ledger, single-source-without-caveat, and no-action pivots before they can inflate paid rows.
- Exposed relationship confidence in Apify smoke, ops/API tests, route inventory, and enterprise route metadata without adding a TAXII server or speculative export scaffolding.
- Preserved no-leak and metadata-only boundaries: no raw evidence bodies, unsafe URLs, credentials, leaked files, private material, or actor-interaction content.
- Proof is green for `bun run check`, focused graph/API/pipeline/ops tests, Apify check/smoke, route inventory, contract index, and API regression.

You are not idle. Continue the graph lane only where it creates paid search value: buyer-ready pivots, investigation packs, source-family corroboration, contradiction handling, and export eligibility that a customer can use immediately.

## Program BX - Paid Graph Search Packs

Goal: turn relationship confidence into small paid investigation packs. A buyer searching for an actor, victim, sector, country, tool, or TTP should get a compact set of next searches and relationship rows that are specific enough to act on, not decorative graph text.

Work in this order:

1. Inspect current Apify rows, `/v1/intel/search`, graph workspace DTOs, and `/v1/ops/product-slo` for useful relationship fields that are present but not packaged into buyer actions.
2. Add a compact `paidGraphSearchPack` on existing surfaces only: Apify row output, Apify `OUTPUT`, `/v1/intel/search`, `/v1/ops/product-slo`, `/v1/contracts`, and graph workspace DTOs if already used.
3. Add at least 25 fixtures across actor, victim, sector, country, TTP, tool, campaign, ransomware group, unknown actor, and alias-collision queries.
4. For each fixture, include:
   - query type and buyer intent
   - primary entity and normalized aliases
   - useful next searches
   - source-family corroboration
   - contradiction/caveat state
   - suppressed noisy pivots
   - export eligibility if already safe
   - why the row is worth paying for or why it is held
5. Add gates that suppress graph packs with stale-only evidence, generic relationships, missing provenance, no buyer action, unsafe raw content, unsupported alias expansion, single-source-without-caveat, or unrelated pivots.
6. Add measurable lift: paid graph packs created, useful next searches, unsupported pivots suppressed, rows promoted from generic to useful, buyer-value delta, and marketplace sample rows improved.
7. Do not build a TAXII/STIX server or broad graph engine unless a buyer-visible row, export eligibility decision, or Apify sample actually changes.

Metric targets:

- At least 10 rows should gain useful paid graph packs, or be explicitly held with buyer-visible repair reasons.
- Every pack must help a buyer search, filter, correlate, export, or decide what changed.
- No raw evidence bodies, unsafe URLs, leaked files, account material, private material, actor interaction, or payload-following output.

Proof required before marking ready:

- `bun run check`
- `bun test src/tests/graphViews.test.ts src/tests/api.test.ts src/tests/pipeline.test.ts src/tests/ops.test.ts`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- A note here with packs created, rows improved, rows held, buyer-value delta, suppressed bloat pivots, owner handoffs, and no-leak proof.

When a coherent patch is complete: update this file, commit, push, and continue into the next paid graph/search batch without waiting. Leave no dangling dirty files.
