Status: active_program_dd_public_corroboration_300_to_500_parser_ready

# Agent 08 Program DD - Public Corroboration Lift From 300 To 500 Parser-Ready Rows

You are no longer ready. Program DC produced 300 parser-ready public corroboration rows; now convert graph/public context into rows that directly improve Actor sellability, confidence, contradiction handling, and freshness.

Goal:
- Raise `graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff` from 300 to at least 500 parser-ready rows.
- Ensure at least 350 of those rows are finding-likely, not source-provenance-only.
- Keep graph-only rows at zero current paid-floor credit until Agent 03 admits them as evidence-backed findings.
- Improve actor/victim/target/TTP/source pivots for the 100-name default Actor run and the next 750/1,000 sellable-row gates.

Implementation direction:
- Add `programDdPriority` fields with gap contribution, finding-likely state, source-provenance risk, parser action, admission blocker, source-family diversity lift, corroboration strength, contradiction risk, freshness risk, buyer-visible value, no-leak proof, and next pivot.
- Prioritize APT/ransomware rows that fix live buyer problems: stale latest activity, single-source evidence, missing victim/target context, missing sector/country, missing TTP/tool, weak public support, and alias ambiguity.
- Add rejection/hold buckets for stale-only, alias conflict, contradiction, duplicate, generic source page, restricted-only, not enough source support, missing buyer action, weak source-family diversity, and graph-only speculation.
- Surface the 500-row handoff through `/v1/ops/product-slo`, API contracts, Apify Actor `OUTPUT`, and Actor smoke tests.
- Defer STIX/TAXII-only work unless it directly improves current Actor row usefulness or marketplace conversion.

Proof before handoff:
- `bun run check`
- focused graph/API/ops tests
- `bun run check:contract-index`
- `bun run check:apify-publication`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- full `bun test` if shared tree is stable

Do not stop after adding fields. The output must be usable by Agent 03 for the 750 sellable-row lift.

## Previous Summary

- Completed Program DC public graph proof lift from 175 to 300 parser-ready rows in `graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff`.
- Added `programDcPriority` to parser handoff rows with gap contribution, finding-likely status, source-provenance-only risk, parser action, admission blocker, source-family diversity lift, corroboration strength, and freshness risk.
- Kept at least 170 finding-likely rows available for Agent 03 while preserving `admitted_by_parser=0`, `rowsCountTowardFloorNow=0`, and graph-only paid-floor credit disabled.
- Added Program DC rejection buckets for stale, alias conflict, contradiction, duplicate, generic source page, restricted-only, not enough source support, missing buyer action, and weak source-family diversity.
- Mirrored the 300-row handoff and rejection buckets through `/v1/ops/product-slo`, API contracts, Apify Actor `OUTPUT`, and Actor smoke tests.
- Carried forward coherent hosted/paid-release observed-proof and dark metadata gate work found in the dirty tree; paid traffic remains held on hosted Apify proof and marketplace observed-state requirements.
- Verification green: `bun run check`, focused API/ops tests, `bun run check:contract-index`, `bun run check:apify-publication`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, and full `bun test`.
- `bun run check:paid-actor-release-audit` reaches the expected safe release hold and only failed before commit because the worktree was dirty.

Requesting the next Agent 08 buyer-visible graph/public-row/STIX/TAXII task.
