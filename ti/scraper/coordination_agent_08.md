Status: active_program_fh_hosted_public_corroboration_lift

# Agent 08 Current Assignment - Program FH: Hosted Public Corroboration Lift

You are no longer ready. The hosted Apify proof run `THMm2ZzYxW4HVPGJ6` is the revenue blocker: 313 hosted rows, 46 sellable rows, 31 sellable findings, 194 caveated rows, no leaks, but no second-batch audit and not enough sellable findings for the 100-row paid floor.

Goal:
- Turn the best hosted caveated rows into parser-ready public corroboration handoffs that Agent 03 can admit as sellable findings.
- Focus on buyer-visible lift: corroborating public source family, actor-specific claim, victim/target or TTP/tool context, freshness, contradiction check, and next search pivots.
- Do not spend this task on STIX/TAXII, graph decoration, DTO-only mirrors, or source-family counts unless the output directly helps hosted rows become sellable.

Implementation direction:
- Build a Program FH public-corroboration packet keyed to hosted proof `THMm2ZzYxW4HVPGJ6` / dataset `xLPoxMVY6cVjGsS4e`.
- Prioritize rows that are already close to sellable but fail single-source, stale timestamp, missing sector/country, missing TTP/tool, missing buyer action, or missing confidence-reason gates.
- Surface accepted and rejected corroboration examples in Apify `OUTPUT`, Product SLO, `/v1/contracts#apifyStoreReadiness`, and API tests. Accepted examples must name the buyer-visible row metric they improve.

Proof before handoff:
- `bun run check`
- focused API/ops/graph-public tests for changed files
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- Full `bun test` if shared surfaces changed
- Do not mark ready until the packet is useful for the hosted 46 -> 100 sellable-row lift or you have documented exact blocking source gaps for Agent 01/04/05. Commit and push green changes before handoff.

# Previous Summary

- Completed Program FG public corroboration lift from 750 to 1,000 parser-ready graph/public handoff rows.
- Added required `programFgPriority` fields for why corroboration matters, buyer action enabled, confidence/freshness/source-family deltas, contradiction risk, parser admission reason, operator parser slice, no-leak proof, and admission blocker.
- Added 250 Program FG structured public corroboration rows across alias, victim/target, sector/country, TTP/tool, dataset/impact, source-family, freshness, metadata public support, contradiction review, and next-search-pivot slices.
- Mirrored the 1,000-row handoff through Product SLO, `/v1/intel/search`/API contracts, Apify Actor `OUTPUT`, Actor smoke checks, and focused API/ops assertions while keeping `admitted_by_parser=0`, `rowsCountTowardFloorNow=0`, and `graphOnlyCountsTowardPaidFloorNow=false`.
- Verification green: `bun run check`, focused API/ops/graph tests, `bun run check:contract-index`, `bun run check:apify-publication`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and full `bun test`. `bun run check:paid-actor-release-audit` correctly holds paid release until clean worktree plus observed hosted/marketplace proof.
- Requesting the next Agent 08 buyer-visible graph/public-row/STIX/TAXII task.
