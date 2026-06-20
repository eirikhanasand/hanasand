Status: active_program_cl_marketplace_conversion_from_real_rows

- Completed Program CF: Marketplace 100-row conversion proof.
- Added buyer-facing 100-row progress surfaces to Actor OUTPUT and `/v1/contracts#apifyStoreReadiness`: current sellable rows, projected sellable rows from accepted repairs, one-repair-away rows, caveated useful rows, blocked rows, and exact blockers.
- Store copy, sample output, launch checklist, changelog, publication checks, API contract, and smoke tests now state the product is useful today as a safe metadata monitor while production paid-traffic readiness remains blocked until 100 sellable rows.
- Regression coverage blocks proof-sized, caveat-only, and graph-only plans from being marketed as production-ready and keeps payout, views, users, paid runs, revenue, runtime, platform usage, and conversion rates external.
- First paid-traffic experiment plan is present but blocked until the 100-row floor passes, with target buyer, preset, success metric, stop-loss metric, refund risk, and required Apify analytics fields.
- Verification completed: `bun run check`, `bun test src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:apify-publication`, and `bun run check:contract-index`.

# Current Task: Program CL Marketplace Conversion From Real Rows

Own the buyer-facing Apify/API surface until it helps convert real users without overstating readiness. This is not a copywriting pass. It is a data-product pass: the listing, README, input schema, output schema, sample output, API contract, and publication checks must make the current sellable rows easy to evaluate and the remaining blockers impossible to miss.

Scope:
- Build a compact buyer-facing sample pack from the highest-value current safe rows only. Do not use synthetic, graph-only, stale, restricted-only, or caveat-only rows as proof of paid readiness.
- Improve Actor OUTPUT/API fields so each row explains why it is useful: actor/group, claim type, victim/target when safe, sector/country, dataset/impact claim when safe, TTP/tool/CVE pivots, freshness, confidence, corroboration state, contradictions, next buyer search pivots, provenance hash, and no-leak proof.
- Keep Store/listing text human and specific. Remove placeholder/TODO/proof-run ambiguity. Say “searching” or “held” plainly where the product is not ready, and never imply external Apify analytics, users, revenue, payout, or conversion proof unless it is directly verified.
- Add a paid-traffic experiment readiness block that is activated only when Agent 10’s real 100-row floor passes.
- Add marketplace conversion telemetry descriptors for views, runs, paid runs, retention, refund risk, cost/useful row, and useful-row density, but keep values `external_unknown` unless verified through Apify.
- Coordinate with Agent 03/05/07/10 so sample rows and listing claims always match the actual output gates.

Definition of done:
- Apify check/smoke/publication checks pass and show the current sample rows are useful but not inflated.
- Contract/API tests prove marketplace claims cannot mark paid readiness before 100 real sellable rows.
- `bun run check`, focused API/ops/Apify tests, contract checks, and full `bun test` are green.
- Update this file and `coordination.md`, then commit and push a coherent change. Do not leave dirty files behind.
