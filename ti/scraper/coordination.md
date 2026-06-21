Status: active_monetization_blocker_clearance

# TI Scraper Coordination

Read this file first. It is intentionally short so agents can read the whole thing.

Archives:
- `docs/coordination/coordination-history-2026-06.part-aa`
- `docs/coordination/coordination-history-2026-06.part-ab`
- `docs/coordination/coordination-history-2026-06.part-ac`
- `docs/coordination/coordination-history-2026-06.part-ad`

## Current Revenue Blocker

Hosted Apify proof is real but below the paid floor.

- Run: `THMm2ZzYxW4HVPGJ6`
- Build: `L7LtCqLsKT6Luq04R`
- Dataset: `xLPoxMVY6cVjGsS4e`
- Hosted rows: 313
- Sellable rows: 46 / 100 required
- Sellable findings: 31 / 52 required
- Caveated rows: 194
- No-leak failures: 0
- Cost: about `$0.0047`
- Current checker state: `status=verified_hold`
- Current external blocker: `hosted_100_name_run_below_paid_floor`

Paid release must remain blocked until hosted proof reaches at least 100 sellable rows and 52 findings, second-batch audit is observed, false-positive audit is zero, and pricing/payout/analytics/listing/conversion/refund truth is imported.

## Active Agent Focus

- Agent 01: source atlas and high-value public source candidates for hosted rows.
- Agent 02: daily 100-name Actor scheduler freshness and source-gap cadence.
- Agent 03: parser/admission lift from hosted 46 sellable rows toward 100.
- Agent 04: high-value public source replacement and public-channel freshness.
- Agent 05: safe metadata-only dark/restricted metadata that can become corroborated buyer-visible rows.
- Agent 06: evidence/read-model/search support only where it improves real searchable rows.
- Agent 07: quality gates that prevent stale, generic, wrong-actor, graph-only, or unsafe rows from becoming paid rows.
- Agent 08: public corroboration handoffs for hosted caveated/held rows.
- Agent 09: hosted proof reruns, marketplace truth import, and delta measurement.
- Agent 10: release gate honesty, cost/useful-row guard, and paid-traffic block enforcement.

## What Counts

Counts as monetization progress:
- More hosted sellable rows.
- More hosted true findings.
- Better freshness, source diversity, actor specificity, victim/target/TTP extraction, or buyer action on hosted rows.
- Observed Apify pricing, payout, analytics, listing, conversion, refund, billing, and cost/useful-row proof.
- Fewer stale/latest errors, duplicates, generic rows, wrong-actor rows, contradictions, and unsafe rows.

Does not count:
- Coordination-only work.
- DTO/schema-only work.
- STIX/TAXII-only work.
- Synthetic index rows.
- Local-only proof.
- Sample/template/partial proof.
- Source-count growth without buyer-visible useful rows.

## Required Handoff Discipline

Before marking ready, each agent should:
- Run focused checks for touched files.
- Run `bun run check` when TypeScript surfaces changed.
- Commit and push coherent green changes.
- Leave a short summary and the next measurable blocker.

If a file grows beyond 200 lines, split or archive it before handoff. New coordination files should stay under 60 lines when practical.
