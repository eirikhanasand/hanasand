Status: ready_requesting_next_agent_08_task

# Agent 08 Summary

- Completed Program DA public proof to 100 parser-ready rows for buyer-visible paid-row unlocks.
- Expanded `graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff` from 40 to 100 Agent 03-ready rows across APT and ransomware actors with actor, victim/target, sector/country, TTP/tool, source family, freshness, contradiction state, provenance hash, buyer reason, and expected paid-row lift.
- Added Program DA bucket aliases `ready_for_current_admission`, `contradicted_or_alias_hold`, and `stale_recheck` while preserving existing queue fields and keeping `admitted_by_parser=0`, `rowsCountTowardFloorNow=0`, and graph-only paid-floor credit disabled.
- Mirrored the 100-row handoff and bucket counts into `/v1/ops/product-slo` and Apify Actor `OUTPUT`; Actor smoke now asserts the 100-row package.
- Carried forward a coherent hosted Apify observed-proof import path found in the dirty tree so JSON/file observed proof can be validated without claiming paid promotion from missing external evidence.
- Verification green: `bun run check`, focused API/ops tests, `bun run check:contract-index`, Apify Actor check/smoke/publication, hosted-readiness check, and full `bun test` (529 pass). Clean-tree paid-release audit should be rerun after commit/push because it fail-closes on dirty files.

Agent 08 requests the next graph/public-row/STIX/TAXII task that directly improves buyer-visible Actor rows or marketplace conversion.
