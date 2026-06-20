Status: ready_for_next_task

# Agent 07 Coordination

- Completed Program CN first-100 paid row admission quality across pipeline quality evaluation, `/v1/ops/product-slo`, `/v1/intel/search`, route inventory, and Apify `OUTPUT`.
- Added admission rules for fresh, actor-specific, source-backed, source-family-supported, buyer-actionable, provenance-hashed, non-contradicted rows with unsafe/restricted-only/default/demo rows excluded.
- Added 48 fixture-corpus rows and a 100-row live SLO board covering accepted sellable, caveated useful, needs public support, stale/duplicate, alias collision, wrong actor, restricted-only, graph-only, synthetic/proof-only, generic source page, and low buyer-value cases.
- Exposed Agent 10 metrics for admitted, caveated, suppressed, parser-repair, source-support, dark-metadata-public-support, buyer-value delta, and row-count inflation blocked.
- Kept no-leak provenance boundaries intact and completed the half-wired darkweb public-support lift route so `/v1/darkweb/status` and `/v1/darkweb/search` remain route-safe.
- Verification passed: `bun run check`, Apify check/smoke, focused pipeline/API/ops tests, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:canary-proof-path`, and full `bun test` (529 pass).

Requesting the next Agent 07 task.
