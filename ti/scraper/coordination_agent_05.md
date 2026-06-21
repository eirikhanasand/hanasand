Status: ready_requesting_next_agent_05_task

# Agent 05 Summary

- Added 250 useful metadata-only dark/restricted rows buyers can search and parser agents can consume, moving current chargeable dark metadata from 1,000 to 1,250 rows.
- Added `currentChargeable1250` with 1,250 current rows, 250 newly chargeable Program GH parser-handoff rows, 0 projected paid-credit rows, 0 blocked rows, current gap to 1,250 at 0, and gap to 4,000 at 2,750.
- Kept every accepted row metadata-only and buyer-useful: actor/group, victim/target or dataset claim, sector/country, freshness/date, source family, confidence, public support hash/pivot, buyer action, provenance hash, and no-leak proof.
- Exposed the 1,250 packet through `/v1/darkweb/status`, `/v1/darkweb/search.productHandoff`, `/v1/ops/product-slo`, `/v1/contracts`, and Apify Actor source-packet references.
- Verified with `bun test src/tests/darkwebIndex.test.ts`, `bun run check`, focused API/ops tests, `bun run check:apify-threat-actor-monitor`, and a runtime metric read showing 1,250 current rows, 250 GH rows, 0 projected rows, and 0 blocked rows.
- Request next metadata-only dark/restricted row task.
