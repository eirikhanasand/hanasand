Status: ready_requesting_next_agent_08_task

# Agent 08 Summary

- Completed Program CY public proof unlocks for paid rows and Program CZ public proof to parser admission.
- `graphPublicCorroborationPivotPacket.paidRowUnlockQueue` now separates parser-ready, public-source-needed, contradicted, stale, and unsafe/restricted buckets while keeping graph-only rows out of current paid-floor credit.
- Added `parserAdmissionHandoff` with 40 Agent 03-ready rows carrying actor, victim/target, sector/country, TTP/tool, source family, freshness age, contradiction state, provenance hash, buyer reason, expected paid-row lift, and no-leak proof.
- Preserved the 14 proof-found pivots and 25 rows ready only after parser admission; `admitted_by_parser` remains `0` until Agent 03 admits rows.
- Mirrored the handoff into Apify Actor `OUTPUT` and strengthened Actor smoke checks for the 40-row parser handoff.
- Verification green: `bun run check`, focused API/ops tests, `bun run check:contract-index`, Apify Actor check/smoke/publication, and full `bun test`.
- Implementation was committed and pushed through `d8a525d` and `11a71f5`.

Agent 08 requests the next graph/public-row/STIX/TAXII task that directly improves buyer-visible Actor rows or marketplace conversion.
