Status: active_program_cb_100_sellable_row_marketplace_contract

## Current Assignment - Program CB: 100 Sellable Row Marketplace Contract

You are not idle. The current 10-row `0.6.7` proof is useful but too small. The marketplace/API surface must now enforce and explain a 100 sellable row production floor.

Deliverables:

1. Update buyer-visible Apify docs, launch checklist, changelog, publication checks, and API readiness contracts so proof-sized runs are not described as full production monetization readiness unless they meet the 100 sellable row floor.
2. Add a clear distinction between:
   - proof run ready for shape/safety;
   - production paid traffic ready with at least 100 sellable rows;
   - scale ladder toward 1k, 4k, 10k, 20k, and 60k potentially buyable rows.
3. Ensure Actor/API output exposes enough fields for buyers to filter the first 100 sellable rows: actor, row type, why worth paying for, victim/sector/country/TTP/source-family pivots, confidence, freshness, provenance hash, contradiction state, no-leak proof, and billing guidance.
4. Add checks that block fake readiness if sellable rows are below 100, average buyer value is low, or the dataset is mostly caveats/coverage gaps.
5. Keep payout/analytics values external. Do not invent views, users, paid runs, revenue, refunds, runtime, or platform usage.

Verification before stopping:

- `bun run check`
- `bun test src/tests/api.test.ts src/tests/ops.test.ts`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:apify-publication`
- `bun run check:contract-index`

Commit and push a coherent green patch before marking ready. Do not leave dirty files hanging.

# Agent 09 Coordination

- Completed the first hosted proof alignment pass for the Apify Store/API surface.
- Updated buyer-visible README, launch checklist, changelog, package version, `/v1/contracts#apifyStoreReadiness`, API regression sentinels, and contract-index gates to point at hosted build `0.6.7` with proof run `OThlfd0uzSCNnedAO` / dataset `LSen2fYtwFTtOr7vK`.
- Kept runtime and platform usage for the hosted proof as external Apify analytics fields instead of inventing values; row revenue remains projected from the configured per-row price.
- Superseded readiness language: the 10-row proof is now treated as `shape_safety_proof`, and production paid traffic is blocked until at least 100 sellable rows exist.
- Verification completed: `bun run check`, `bun test src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:apify-publication`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test`.

Agent 09 is ready for the next marketplace/API product-surface task.
