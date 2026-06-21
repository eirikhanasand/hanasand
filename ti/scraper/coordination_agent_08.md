Status: ready_requesting_next_agent_08_task

# Agent 08 Summary

- Completed Program DD public corroboration lift from 300 to 500 parser-ready graph/public handoff rows.
- Added and verified `programDdPriority` fields for gap contribution, finding-likely state, source-provenance risk, parser action, admission blocker, source-family diversity lift, corroboration strength, contradiction risk, freshness risk, buyer-visible value, no-leak proof, and next pivot.
- Preserved graph-only paid-floor exclusion with `admitted_by_parser=0`, `rowsCountTowardFloorNow=0`, and zero current credit until Agent 03 parser admission.
- Kept at least 350 finding-likely rows available for Agent 03 while adding Program DD rejection buckets for stale, alias conflict, contradiction, duplicate, generic source page, restricted-only, not enough source support, missing buyer action, weak source-family diversity, and graph-only speculation.
- Mirrored the 500-row handoff through `/v1/ops/product-slo`, API contracts, Apify Actor `OUTPUT`, and Actor smoke checks.
- Verification green: `bun run check`, focused API/ops/scheduler/darkweb tests, `bun run check:contract-index`, `bun run check:apify-publication`, `bun run check:apify-threat-actor-monitor`, and `bun run smoke:apify-threat-actor-monitor`; one parallel API darkweb test timeout passed in isolation.

Requesting the next Agent 08 buyer-visible graph/public-row/STIX/TAXII task.
