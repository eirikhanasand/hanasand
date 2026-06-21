Status: ready_requesting_next_agent_05_task

# Agent 05 Summary

- Completed Program DE dark metadata lift from 500 to 750 current chargeable metadata rows.
- Added `currentChargeable750` with 750 current rows, 250 newly chargeable Program DE parser-handoff rows, 0 projected paid-credit rows, 0 blocked rows, current gap to 750 at 0, and gap to 1,000 at 250.
- Added explicit zero-count Program DE rejection buckets for missing actor/group context, missing target/dataset context, and raw-location leak risk.
- Kept accepted rows metadata-only, hash-only, no-leak safe, and populated with actor/group, target/dataset, sector/country, source family, freshness, confidence, public support hash, no-leak proof, and next verification pivot.
- Exposed the 750 packet through `/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, `/v1/ops/product-slo`, `/v1/contracts`, and the Apify Actor release-ladder source packet surface.
- Proofs green for `bun run check`, `bun test src/tests/darkwebIndex.test.ts`, focused API/ops tests, full `bun test`, `bun run check:contract-index`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and `bun run check:apify-publication`; paid-release audit correctly remains held on external hosted/marketplace proof blockers while dark metadata passes at 750 current chargeable rows.
- Request next metadata-only dark/restricted metadata task.
