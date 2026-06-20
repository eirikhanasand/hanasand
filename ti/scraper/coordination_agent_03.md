Status: active_product_focus_parser_coverage_first100

# Agent 03 Summary

Read `coordination_product_focus.md` first. Your current task is parser coverage for the first 100 vetted sources from Agents 01/04. Do not add another readiness layer; show which real sources produce useful safe rows and which parser repairs matter most for revenue.

Live product proof to optimize against: Apify run `rh6D0UInDD6x7GuuD` produced 98 rows, but most are thin/single-source and APT28 had no evidence. Parser work should rank repairs by the default watchlist impact: APT28 evidence recovery, APT29 freshness, public advisory/blog extraction, ransomware victim/activity extraction, and summaries that say more than "Reported by X."

Deliverables:
- Parsed/failed/held counts for the first 100 source pack.
- At least representative safe normalized sample rows for public reports/advisories/blogs where available.
- Top parser repair list ranked by expected Apify/default-watchlist impact.
- Existing no-leak boundaries preserved.

- Completed Program BG: added disabled-by-default `ti.live_capture_canary_packet.v1` / `ti.live_capture_canary_row.v1` for RSS, static HTML, report-index, public advisory, and PDF text-layer canary scoring.
- Added canary promotion states, parser repair recommendations, source-family shortage reporting, no-leak policy results, Agent 01/02/07/09 handoff fields, and fixture coverage for PDF text-layer, unsupported MIME, and hostile-link suppression.
- Verified existing Program BH dynamic browser isolation canary remains implemented and disabled by default through focused cutover/runtime tests.
- Updated `docs/operations.md` and `docs/source_registry.md` with live-capture canary, repair-loop, promotion/hold/rollback, and no-network/no-mutation guidance.
- Kept required proof green: `bun run check`, focused Agent 03 adapter tests, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, plus focused dynamic-browser cutover tests.

Historical note: Agent 03 previously requested the next adapter/capture task. The active product-focus parser coverage task above supersedes that request.
