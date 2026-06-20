Status: active_program_bv_paid_row_entity_specificity_lift

# Agent 07 Coordination

- Completed Program BS paid-row freshness repair loop across Apify `OUTPUT`, `/v1/quality/evaluate`, `/v1/intel/search`, `/v1/contracts`, `/v1/ops/product-slo`, and route inventory.
- Recorded freshness repair lift: 4 stale rows blocked, 4 generic rows repaired, 4 alias/unrelated rows suppressed, 7 caveated rows preserved, 6 sellable rows gained, 6 useful rows gained, and 0.104 average buyer-value delta.
- Added owner handoffs for Agent 01, 03, 04, 05, 07, 08, 09, and 10 with no raw evidence, unsafe URLs, restricted payloads, or object keys exposed.

You are not idle. Continue the quality lane, but focus on buyer-visible entity specificity and paid-row usefulness. Do not add broad quality architecture unless it changes row decisions or buyer actionability.

## Program BV - Paid Row Entity Specificity Lift

Goal: raise conversion by turning vague actor activity rows into specific, useful CTI rows: actor, victim, sector, country, dataset/impact, TTP/tool, first/last seen, confidence, caveat, contradiction state, provenance hash, and next analyst action.

Work in this order:

1. Build a repair/evaluation packet from existing Apify/public TI rows where rows are caveated or held because victim, dataset, impact, sector/country, TTP/tool, or first/last-seen extraction is missing or generic.
2. Add at least 20 fixtures across APT29, APT28, APT42, Turla, Volt Typhoon, Lazarus Group, Sandworm, Scattered Spider, LockBit, Akira, Clop, Black Basta, RansomHub, Play, Qilin, and an unknown actor query.
3. For each fixture, record current paid-row decision, target decision, missing fields, required evidence/source family, expected buyer-visible lift, and why the row is or is not worth paying for.
4. Add a specificity lift packet on existing surfaces only: `/v1/quality/evaluate`, `/v1/intel/search`, `/v1/ops/product-slo`, `/v1/contracts`, and Apify `OUTPUT` if it improves the Actor.
5. Add gates that block promotion when a row is old, alias-only, single-source without caveat, unrelated actor, contradicted, metadata-only without public support, or lacks a useful buyer action.
6. Coordinate with Agent 03 for parser/extractor fixes, Agent 04/01 for source coverage, Agent 05 for restricted metadata support, Agent 08 for graph pivots, and Agent 09/10 for conversion economics.

Metric targets:

- Lift at least 8 rows from held/caveated/generic into useful or sellable decisions, or explicitly suppress them with buyer-visible reasons.
- Increase average buyer-value score without inventing evidence.
- Every promoted row needs freshness, specificity, provenance, source-family/corroboration state, confidence, and no-leak proof.
- Every held/suppressed row needs a concrete repair action or rejection reason.

Proof required before marking ready:

- `bun run check`
- `bun test src/tests/pipeline.test.ts src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- A note here with rows lifted, rows suppressed, average buyer-value delta, blocker codes removed, owner handoffs, and no-leak proof.

When a coherent patch is complete: update this file, commit, push, and continue into the next paid-row quality batch without waiting. Leave no dangling dirty files.
