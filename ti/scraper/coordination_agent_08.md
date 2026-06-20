Status: active_program_bw_buyer_pivot_relationship_confidence

# Agent 08 Coordination

- Completed Program BQ buyer-visible graph pivot lift for Apify/public rows.
- Added per-row `marketplaceGraphSignals.pivotUtility` and `rejectedPivotReasons`.
- Added run-level `graphPivotLiftGate` with 12 APT/ransomware/unknown examples, next-search pivot count, useful/corroborated pivot rates, sellable/useful row lift, buyer-value delta, and rejected bloat pivots.

You are not idle. Continue graph/STIX/TAXII work only where it improves Actor/public row usefulness, marketplace conversion, evidence-backed relationships, and safe export eligibility. Pause generic export architecture unless it directly affects buyer-visible output or a paid workflow.

## Program BW - Buyer Pivot Relationship Confidence

Goal: make row relationships useful enough to pay for. Buyers should be able to pivot from a finding into related actors, aliases, campaigns, victims, sectors, countries, TTPs/tools, source-family corroboration, contradictions, and next search queries without being charged for decorative or unsupported graph text.

Work in this order:

1. Inspect current Apify rows and `/v1/intel/search` graph fields for pivots that are useful but not confidence-scored enough to guide a buyer.
2. Add or refine a compact relationship-confidence packet on existing surfaces only: Apify row output, Apify `OUTPUT`, `/v1/intel/search`, `/v1/ops/product-slo`, `/v1/contracts`, and graph workspace DTOs if already used.
3. Add at least 20 fixtures across APT/ransomware/victim/sector/unknown queries with:
   - fresh corroborated pivots that should be useful/sellable
   - caveated single-source pivots
   - stale or contradicted pivots
   - unrelated alias collisions
   - restricted metadata leads that remain caveated
   - unknown search-only rows
4. Add metrics that affect product value: useful pivot count, action pivot count, corroborated pivot count, rejected unsupported pivot count, confidence trend, contradiction state, next-search count, sellable/useful row lift, and buyer-value delta.
5. Add gates that reject generic, stale, contradicted, unrelated, restricted-only, missing-ledger, single-source-without-caveat, and no-action pivots.
6. Only improve STIX/TAXII readiness where a buyer-visible field or export eligibility changes. Do not build broad standards scaffolding for its own sake.
7. Handoff parser/source/freshness blockers to Agent 03/04/05/07 and conversion measurement to Agent 09/10.

Metric targets:

- Every graph pivot must be a useful search/filter/action, not a decorative relationship.
- Suppress unsupported relationship text instead of charging for it.
- Increase useful pivot rate or buyer actionability, or explicitly report why it did not improve.
- Keep no-leak proof on every row and run-level packet.

Proof required before marking ready:

- `bun run check`
- `bun test src/tests/graphViews.test.ts src/tests/api.test.ts src/tests/pipeline.test.ts src/tests/ops.test.ts`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- A note here with pivot fields added, useful/sellable lift, rejected bloat pivots, confidence metrics, owner handoffs, and no-leak proof.

When a coherent patch is complete: update this file, commit, push, and continue into the next buyer-pivot batch without waiting. Leave no dangling dirty files.
