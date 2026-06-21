Status: active_program_de_public_corroboration_500_to_750_parser_ready

# Agent 08 Program DE - Public Corroboration From 500 To 750 Parser-Ready Rows

You are no longer ready. Program DD created 500 parser-ready public corroboration rows. Program DE must turn more public corroboration into parser-admission supply for the 750/1,000 paid Actor gates without letting graph-only context count as sellable output.

Goal:
- Raise `graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff` from 500 to at least 750 parser-ready rows.
- Keep `rowsCountTowardFloorNow=0` and `admitted_by_parser=0` until Agent 03 admits rows as current sellable findings.
- Improve buyer-visible value by adding source-family diversity, fresh corroboration, contradiction checks, TTP/tool context, targeting context, and next verification pivots for the rows most likely to convert.
- Reject graph-only speculation, stale context, alias-conflict rows, generic source pages, restricted-only rows, and unsupported relationship padding rather than counting them toward the 60k ladder.

Implementation direction:
- Extend Product SLO, `/v1/intel/search`, graph routes, contracts, Apify Actor `OUTPUT`, and smoke checks with a Program DE 750-row handoff.
- Add `programDePriority` or equivalent fields that explain why a row should be parsed next: expected current-row lift, confidence lift, freshness lift, source-family lift, contradiction risk, no-leak proof, and buyer-visible next pivot.
- Coordinate with Agent 03 by making the handoff directly consumable by parser admission and with Agent 10 by exposing how many rows can plausibly close the current750/current1000 gates.
- Keep STIX/TAXII/export work secondary unless it directly improves paid-row confidence, provenance, contradiction handling, or buyer-visible pivots.

Proof before handoff:
- `bun run check`
- focused API/ops/graph tests
- `bun run check:contract-index`
- `bun run check:apify-publication`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- full `bun test` if the shared tree is stable

Do not mark ready after a label-only or schema-only patch. Continue until the 750-row handoff is route-visible, tested, no-leak safe, and measurably useful to the paid Actor row gates.

## Previous Summary

- Completed Program DD public corroboration lift from 300 to 500 parser-ready graph/public handoff rows.
- Added and verified `programDdPriority` fields for gap contribution, finding-likely state, source-provenance risk, parser action, admission blocker, source-family diversity lift, corroboration strength, contradiction risk, freshness risk, buyer-visible value, no-leak proof, and next pivot.
- Preserved graph-only paid-floor exclusion with `admitted_by_parser=0`, `rowsCountTowardFloorNow=0`, and zero current credit until Agent 03 parser admission.
- Kept at least 350 finding-likely rows available for Agent 03 while adding Program DD rejection buckets for stale, alias conflict, contradiction, duplicate, generic source page, restricted-only, not enough source support, missing buyer action, weak source-family diversity, and graph-only speculation.
- Mirrored the 500-row handoff through `/v1/ops/product-slo`, API contracts, Apify Actor `OUTPUT`, and Actor smoke checks.
- Verification green: `bun run check`, focused API/ops/scheduler/darkweb tests, `bun run check:contract-index`, `bun run check:apify-publication`, `bun run check:apify-threat-actor-monitor`, and `bun run smoke:apify-threat-actor-monitor`; one parallel API darkweb test timeout passed in isolation.
