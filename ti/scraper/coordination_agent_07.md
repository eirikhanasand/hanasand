Status: active_program_bs_paid_row_freshness_repair_loop

# Agent 07 Coordination

- Completed Program BR live freshness quality gate across Apify `OUTPUT`, `/v1/quality/evaluate`, `/v1/intel/search`, `/v1/ops/product-slo`, `/v1/contracts`, and route inventory.
- Added deterministic APT/ransomware freshness examples with 6 fresh chargeable rows, 4 useful caveated rows, 5 stale latest-activity claims blocked, and 3 suppressed bloat/latest-claim rows.
- Blocks latest-activity wording for old evidence, generic summaries, single-source claims, alias-only matches, unrelated actor hits, contradicted claims, and metadata-only rows without public support.
- Preserved uncertainty, safe-metadata-only boundaries, no source mutation, and no collection start in the gate; failures route to Agent 01 stale sources, Agent 03 parser specificity, Agent 04 public-channel corroboration, Agent 05 metadata/public support, and Agent 07 alias/contradiction review.
- Verification is green for `bun run check`, focused pipeline/API/ops tests, Apify Actor check, and Apify smoke.
## Main Agent Assignment - 2026-06-20 20:40 CEST

You are not idle. Continue the quality lane, but move from freshness contracts into a paid-row repair loop that directly raises useful/sellable output.

## Program BS - Paid Row Freshness Repair Loop

Goal: stop stale or generic “latest activity” output from reaching buyers and turn repairable rows into useful paid rows. This is a monetization task: buyers pay for timely actor activity, specific claims, and honest caveats.

Work in this order:

1. Build a repair queue from existing Apify/public TI quality examples: stale latest-activity rows, generic summaries, single-source rows, alias-only rows, unrelated actor rows, contradicted rows, and metadata-only rows lacking public support.
2. For each repair row, assign owner, exact blocker, expected buyer-visible lift, required evidence/source family, current paid-row decision, target paid-row decision, and proof needed to promote.
3. Wire the queue into existing surfaces only: Apify `OUTPUT`, `/v1/quality/evaluate`, `/v1/intel/search`, `/v1/ops/product-slo`, and `/v1/contracts`.
4. Add at least 20 fixtures across APT29/APT28/APT42/Turla/Volt Typhoon/Lazarus/Sandworm/Scattered Spider/LockBit/Akira/Clop/Black Basta showing chargeable, caveated, held, and suppressed decisions.
5. Add a measurable “freshness repair lift” packet: stale rows blocked, generic rows repaired, alias/unrelated rows suppressed, caveated rows preserved, sellable rows gained, useful rows gained, and average buyer-value delta.
6. Coordinate explicitly with Agent 01/03/04/05/08/09/10 for the rows they must fix. Avoid broad new quality architecture unless it changes row decisions.

Metric targets for this batch:

- Increase useful/sellable row readiness or suppress non-monetizing rows.
- Every promoted row needs freshness, specificity, provenance, source-family/corroboration state, confidence, and no-leak proof.
- Every held/suppressed row needs an actionable repair reason or a clear rejection.

Proof required before marking ready:

- `bun run check`
- `bun test src/tests/pipeline.test.ts src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- A note here with stale blocked, rows repaired, useful/sellable lift, average buyer-value delta, owner handoffs, and no-leak proof.

When a coherent patch is complete: update this file, commit, push, and continue into the next freshness repair batch without waiting. Leave no dangling dirty files.
