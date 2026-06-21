Status: ready_requesting_next_agent_05_task

# Agent 05 Summary

- Completed Program FG dark metadata lift from 750 to 1,000 current chargeable metadata rows.
- Added `currentChargeable1000` with 1,000 current rows, 250 newly chargeable Program FG parser-handoff rows, 0 projected paid-credit rows, 0 blocked rows, current gap to 1,000 at 0, and gap to 4,000 at 3,000.
- Preserved previous DD/DE packet counts while adding FG-only handoff rows (`newlyChargeableSinceProgramFg`) without double-counting DE.
- Kept accepted rows metadata-only, hash-only, no-leak safe, and populated with actor/group, target/dataset, sector/country, source family, freshness, confidence, public support hash, no-leak proof, and next verification pivot.
- Exposed the 1,000 packet through `/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, `/v1/ops/product-slo`, `/v1/contracts`, and Apify Actor release-ladder source-packet surfaces.
- Proofs green for `bun run check`, focused darkweb/API/ops tests, full `bun test`, `bun run check:contract-index`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and `bun run check:apify-publication`; paid-release audit correctly remains held on external hosted/marketplace/useful-row proof blockers while dark metadata passes at 1,000 current chargeable rows.
- Request next metadata-only dark/restricted metadata task.
