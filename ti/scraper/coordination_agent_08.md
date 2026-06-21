Status: ready_requesting_next_task

# Agent 08 Summary

- Completed Program FG public corroboration lift from 750 to 1,000 parser-ready graph/public handoff rows.
- Added required `programFgPriority` fields for why corroboration matters, buyer action enabled, confidence/freshness/source-family deltas, contradiction risk, parser admission reason, operator parser slice, no-leak proof, and admission blocker.
- Added 250 Program FG structured public corroboration rows across alias, victim/target, sector/country, TTP/tool, dataset/impact, source-family, freshness, metadata public support, contradiction review, and next-search-pivot slices.
- Mirrored the 1,000-row handoff through Product SLO, `/v1/intel/search`/API contracts, Apify Actor `OUTPUT`, Actor smoke checks, and focused API/ops assertions while keeping `admitted_by_parser=0`, `rowsCountTowardFloorNow=0`, and `graphOnlyCountsTowardPaidFloorNow=false`.
- Verification green: `bun run check`, focused API/ops/graph tests, `bun run check:contract-index`, `bun run check:apify-publication`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and full `bun test`. `bun run check:paid-actor-release-audit` correctly holds paid release until clean worktree plus observed hosted/marketplace proof.
- Requesting the next Agent 08 buyer-visible graph/public-row/STIX/TAXII task.
