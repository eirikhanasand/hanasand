Status: active_program_fg_public_corroboration_750_to_1000_parser_ready

# Agent 08 Program FG - Public Corroboration 750 To 1,000 Parser-Ready Rows

You are no longer ready. Your next task is not graph architecture: it is buyer-visible public corroboration that helps the parser admit more sellable rows and makes the Actor output more credible to analysts.

Goal:
- Lift public corroboration from 750 to 1,000 parser-ready rows while keeping `rowsCountTowardFloorNow=0` unless the parser admits them.
- Prioritize rows that can convert caveated/held Actor rows into sellable findings: actor aliases, victim/target, sector/country, TTP/tool, dataset claim, source-family diversity, freshness, contradiction resolution, and next search pivots.
- Add quality fields that matter to buyers: why the corroboration matters, buyer action enabled, confidence delta, freshness delta, source-family delta, contradiction risk, no-leak proof, and parser admission reason.
- Continue rejecting STIX/TAXII-only, graph-only speculation, relationship padding, stale/latest-error support, generic source pages, unsupported aliases, restricted-only context, duplicates, and unsupported contradiction claims.

Implementation direction:
- Extend the existing public/graph handoff route surfaces in Product SLO, `/v1/intel/search`, `/v1/contracts`, Apify Actor `OUTPUT`, and smoke checks.
- Add focused tests so public corroboration improves parser readiness and source diversity but cannot inflate current paid-floor rows by itself.
- Include a short operator handoff naming which 1,000-row slices Agent 03 should admit next.

Proof before handoff:
- `bun run check`
- focused graph/API/ops tests for changed files
- `bun run check:contract-index`
- `bun run check:apify-publication`
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:paid-actor-release-audit`
- full `bun test` if stable

Do not mark ready until the 1,000 parser-ready handoff is useful to the parser and has zero direct paid-floor graph credit. Commit and push green changes before handoff.

## Previous Summary

- Completed Program DE public corroboration lift from 500 to 750 parser-ready graph/public handoff rows.
- Added `programDePriority` fields for expected current-row lift, confidence lift, freshness lift, source-family lift, contradiction risk, source-provenance-only risk, buyer-visible next pivot, current750/current1000 gate contribution, no-leak proof, and admission blocker.
- Added Program DE rejection buckets for stale, alias-conflict, contradiction, duplicate, generic source page, restricted-only, not enough source support, missing buyer action, weak source-family diversity, graph-only speculation, and unsupported relationship padding while preserving `rowsCountTowardFloorNow=0` and `admitted_by_parser=0`.
- Mirrored the 750-row handoff through `/v1/ops/product-slo`, `/v1/intel/search`/API contracts, Apify Actor `OUTPUT`, and Actor smoke checks without adding STIX/TAXII-only scope or paid-floor graph credit.
- Verification green: `bun run check`, focused API/ops/graph/hosted tests, `bun run check:contract-index`, `bun run check:apify-publication`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun run check:hosted-apify-paid-readiness`, and full `bun test`.
- Requesting the next Agent 08 buyer-visible graph/public-row/STIX/TAXII task.
