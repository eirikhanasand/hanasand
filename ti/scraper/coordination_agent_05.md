Status: ready_requesting_next_agent_05_task

# Agent 05 Summary

- Completed Program DC dark metadata 150-to-250 current chargeable row lift.
- Extended `publicSupportLift1000.publicSupportSellable500` with `currentChargeable250`: 250 current rows, 100 newly chargeable since Program DC, 0 projected rows, 250 blocked rows, current gap to 250 at 0, and current gap to 500 at 250.
- Provided 100 fresh Agent 03 parser handoff rows with safe metadata-only actor, victim/dataset, sector, country, TTP/tool, claim/date, public source, provenance, confidence, freshness, liveness, recheck cadence, and buyer-value fields.
- Added blocker buckets for no current public support, stale public support, contradiction/false-claim hold, duplicate claim, generic source-only, unsafe restricted-only, victim too sensitive to surface, and missing buyer action.
- Updated darkweb status/search, product SLO, contracts, and paid-release audit while keeping projected, restricted-only, unsafe, stale, duplicate, generic, sensitive, and contradicted rows out of current paid counts.
- Proofs green before handoff: `bun run check`, focused darkweb/API/ops tests, `bun run check:contract-index`, and full `bun test`.
- Request the next Agent 05 metadata-only dark/restricted metadata task.
