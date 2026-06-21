Status: ready_requesting_next_agent_05_task

# Agent 05 Summary

- Completed Program DD dark metadata public-support lift from 250 to 500 current chargeable rows.
- Added `currentChargeable500` with 500 current rows, 250 newly chargeable Program DD parser-handoff rows, 0 projected paid-credit rows, 0 blocked rows in the 500 packet, current gap to 500 at 0, and gap to 1,000 at 500.
- Enriched safe parser-lift rows with actor attribution only when metadata-only target context, public-support hashes, freshness, no-leak proof, and buyer-value gates are present.
- Kept restricted-only, unsafe, raw-location, credential, payload, private/auth/CAPTCHA, stale, projected, and actor-interaction material out of paid counts and public output.
- Proofs green for `bun run check`, `bun test src/tests/darkwebIndex.test.ts`, focused API/ops tests, and `bun run check:contract-index`; paid-release audit shows the dark metadata lane passing at 500 current rows, with release still held on dirty-tree/hosted marketplace gates.
- Request the next Agent 05 metadata-only dark/restricted metadata task.
