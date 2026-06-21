Status: active_program_dd_release_gates_for_750_1000_and_hosted_revenue

# Agent 10 Program DD - Release Gates For 750/1,000 Rows And Hosted Revenue

You are no longer ready. The release board must now prevent local progress from being confused with production revenue readiness while making the next buyer-visible blockers obvious.

Goal:
- Add release gates for current750 and current1000 local sellable rows.
- Keep hosted Apify proof, pricing, payout, marketplace state, and analytics as observed-only gates.
- Make the release audit report one clear decision: `hold_paid_release`, `ready_for_private_paid_beta`, or `ready_for_public_paid_traffic`, with blockers ranked by revenue impact.
- Track non-monetizing work so architecture/coordination-only changes cannot look like revenue progress.

Implementation direction:
- Extend paid-release audit, Product SLO, Actor `OUTPUT`, contracts, and smoke checks with current750/current1000 gates.
- Include row count, true-finding share, source-provenance share, useful-row share, average buyer value, stale/latest-error suppression, no-leak proof, hosted proof, pricing, payout, analytics, and marketplace conversion fields.
- Add a concise blocker board for Agents 03/05/08/09: parser gap, dark metadata public-support gap, public corroboration gap, hosted proof gap, pricing/payout/analytics gap, and low-value row density gap.
- Keep external/hosted values `external_unknown` unless Agent 09 imports observed evidence.
- Preserve release hygiene: dirty worktree blocks paid promotion, tests must be green, and no worker should leave completed patches uncommitted.

Proof before handoff:
- `bun run check`
- focused API/ops tests
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:apify-publication`
- `bun run check:contract-index`
- `bun run check:api-regression`
- `bun run check:paid-actor-release-audit`
- full `bun test` if shared tree is stable

Do not mark ready after only adding labels. The audit must make the next paid-release decision easier and more honest.

## Previous Summary

- Added Program DC release gates across the paid-release audit, SLO/API surfaces, Actor output, smoke checks, and contract expectations for current500, current1000, hosted proof execution, and marketplace paid traffic.
- Current500/current1000 report exact row, useful-row, true-finding, source-provenance, no-leak, cost, and owner-action gaps while keeping hosted proof and marketplace promotion observed-only.
- Hardened hosted proof behavior so partial marketplace imports can keep hosted proof gates intact but do not unlock marketplace promotion; missing pricing or payout remains `external_unknown`.
- Verification is green for `bun run check`, full `bun test`, focused API/ops/darkweb tests, hosted-readiness, Apify Actor check/smoke/publication, contract index, and API regression.
- Ready for the next Agent 10 deployment, observability, release, or operations task.
