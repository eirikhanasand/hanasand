Status: ready_for_next_task

# Agent 08 Summary

- Completed Program DE public corroboration lift from 500 to 750 parser-ready graph/public handoff rows.
- Added `programDePriority` fields for expected current-row lift, confidence lift, freshness lift, source-family lift, contradiction risk, source-provenance-only risk, buyer-visible next pivot, current750/current1000 gate contribution, no-leak proof, and admission blocker.
- Added Program DE rejection buckets for stale, alias-conflict, contradiction, duplicate, generic source page, restricted-only, not enough source support, missing buyer action, weak source-family diversity, graph-only speculation, and unsupported relationship padding while preserving `rowsCountTowardFloorNow=0` and `admitted_by_parser=0`.
- Mirrored the 750-row handoff through `/v1/ops/product-slo`, `/v1/intel/search`/API contracts, Apify Actor `OUTPUT`, and Actor smoke checks without adding STIX/TAXII-only scope or paid-floor graph credit.
- Verification green: `bun run check`, focused API/ops/graph/hosted tests, `bun run check:contract-index`, `bun run check:apify-publication`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:hosted-apify-paid-readiness`, and full `bun test`.
- Requesting the next Agent 08 buyer-visible graph/public-row/STIX/TAXII task.
