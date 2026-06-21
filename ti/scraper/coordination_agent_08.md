Status: active_program_dc_public_proof_175_to_300_parser_ready

# Agent 08 Program DC - Public Proof From 175 To 300 Parser-Ready Rows

You are no longer ready. The next graph/public proof work must feed current sellable parser rows and the 1,000-row tier, not graph exports.

Goal:
- Grow parser-ready public proof rows from 175 to at least 300.
- At least 170 rows should be finding-likely, not source-provenance-only.
- Add stronger source-family diversity and corroboration signals so Agent 03 can safely admit rows toward 500 current sellable rows.
- Keep `admitted_by_parser=0`, `rowsCountTowardFloorNow=0`, and graph-only paid-floor credit disabled until Agent 03 actually admits rows.

Implementation direction:
- Extend `graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff` and its SLO/Actor mirrors.
- Expand `programDbPriority` or add `programDcPriority` fields for `gapContribution`, `findingLikely`, `sourceProvenanceOnlyRisk`, `preferredParserAction`, `admissionBlocker`, `sourceFamilyDiversityLift`, `corroborationStrength`, and `freshnessRisk`.
- Include actor/group, victim/target/context, sector, country/region, TTP/tool/campaign, source family, public support hash/id, confidence, freshness, contradiction state, no-leak proof, and buyer reason.
- Add rejection buckets for stale, alias conflict, contradiction, duplicate, generic source page, restricted-only, not enough source support, missing buyer action, and weak source-family diversity.
- Surface through `/v1/ops/product-slo`, Apify Actor `OUTPUT`, Actor smoke, and paid-release audit blocker text if needed.

Proof before handoff:
- `bun run check`
- focused graph/API/ops tests
- `bun run check:contract-index`
- `bun run check:apify-publication`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:paid-actor-release-audit`

If 300 parser-ready rows pass, continue directly into a 500 parser-ready plan only if it improves actual Agent 03 admission quality.

## Previous Summary

- Completed Program DB public proof lift from 100 to 175 parser-ready graph handoff rows.
- Added `programDbPriority` to each `parserAdmissionHandoff` row with gap contribution, finding-likely flag, source-provenance risk, preferred parser action, and admission blocker.
- Added 95 finding-likely rows for Agent 03 current-finding admission while preserving `admitted_by_parser=0`, `rowsCountTowardFloorNow=0`, and graph-only paid-floor credit disabled.
- Added Program DB rejection buckets for stale, alias conflict, contradiction, duplicate, generic source page, restricted-only, and not-enough-source-support holds.
- Mirrored the 175-row queue and priority fields into `/v1/ops/product-slo` and Apify Actor `OUTPUT`; Actor smoke asserts the new contract.
- Carried forward the coherent hosted Apify observed-proof operator checklist already present in the dirty tree; it remains observed-only and holds paid promotion without external proof.
- Verification green: `bun run check`, focused API/ops tests, `bun run check:contract-index`, Apify Actor check/publication/smoke, hosted-readiness check, and full `bun test`.
