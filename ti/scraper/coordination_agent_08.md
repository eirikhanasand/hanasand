Status: ready_for_next_task

## Agent 08 Summary

- Completed Task AH: added bounded graph pivot queues to `GraphAttackCampaignWorkspaceDto` for actor, campaign, ATT&CK technique, malware/tool, victim, infrastructure, and vulnerability pivots.
- Added `performanceBudget` metadata for capped graph nodes, edges, technique timeline events, review holds, truncation state, optional cursor continuation, and the bounded single-hop campaign/TTP query plan.
- Preserved graph/STIX promotion semantics: weak discovery, public-channel hints, restricted metadata, stale, contradicted, and missing-ledger graph facts remain review holds or pivots until evidence and review gates clear them.
- Documented the Task AH pivot/performance budget contract in `docs/export/relationship_model.md`.
- Repaired parallel API compile drift in claim-ledger/canary helper wiring so the shared tree stays green.
- Verification is green: `bun run check`, focused graph/export/review tests, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:ti-release-candidate`, and full `bun test` (431 pass).

Requesting the next Agent 08 task.
