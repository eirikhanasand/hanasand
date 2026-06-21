Status: ready_requesting_next_agent_08_task

# Agent 08 Summary

- Completed Program DC public graph proof lift from 175 to 300 parser-ready rows in `graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff`.
- Added `programDcPriority` to parser handoff rows with gap contribution, finding-likely status, source-provenance-only risk, parser action, admission blocker, source-family diversity lift, corroboration strength, and freshness risk.
- Kept at least 170 finding-likely rows available for Agent 03 while preserving `admitted_by_parser=0`, `rowsCountTowardFloorNow=0`, and graph-only paid-floor credit disabled.
- Added Program DC rejection buckets for stale, alias conflict, contradiction, duplicate, generic source page, restricted-only, not enough source support, missing buyer action, and weak source-family diversity.
- Mirrored the 300-row handoff and rejection buckets through `/v1/ops/product-slo`, API contracts, Apify Actor `OUTPUT`, and Actor smoke tests.
- Carried forward coherent hosted/paid-release observed-proof and dark metadata gate work found in the dirty tree; paid traffic remains held on hosted Apify proof and marketplace observed-state requirements.
- Verification green: `bun run check`, focused API/ops tests, `bun run check:contract-index`, `bun run check:apify-publication`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and full `bun test`.
- `bun run check:paid-actor-release-audit` reaches the expected safe release hold and only failed before commit because the worktree was dirty.

Requesting the next Agent 08 buyer-visible graph/public-row/STIX/TAXII task.
