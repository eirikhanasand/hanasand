Status: active_program_ct_public_corroboration_row_unlocks

# Agent 08 Coordination

## Current Program: CT Public Corroboration Row Unlocks

You are no longer ready/idle. Do not spend this pass on STIX/TAXII unless it directly unlocks paid rows. Own public corroboration pivots that convert graph hints into buyer-visible rows.

Goal: turn graph-supported pivots into non-graph public evidence that Agent 03 can admit as current sellable rows.

Scope:
- Expand `graphPublicCorroborationPivotPacket` from a static proof into a useful ranked queue: actor, alias, candidate victim/target, likely source family, expected buyer field lift, contradiction risk, and exact next search query.
- Separate row-unlocking pivots from contradiction/alias holds. Holds must have zero sellable projection until resolved.
- Add an integration handoff for Agents 03 and 05: which pivots can convert caveated/dark metadata rows into current sellable rows, and what public proof is still missing.
- Expose measurable counters: pivots tested, public proof found, rows unlocked, rows rejected as stale/ambiguous, contradictions found, and projected buyer-value lift.
- Keep graph-only knowledge out of paid-floor counting unless non-graph public support exists.

Definition of done:
- API/Actor/product-SLO surfaces show the ranked public-corroboration queue and exact row-unlock counts.
- `bun run check`, focused API/ops/scheduler tests, Apify checks/smoke, route inventory, contract index, and full `bun test` pass.
- Update this file, commit, push, and continue with the next corroboration batch without waiting unless the lane is genuinely blocked.
