Status: active_program_cz_release_audit_300_row_gate

# Agent 10 Program CZ - Release Audit For 300-Row Gate

You are no longer ready. Own the release audit's next gate: it should distinguish current 100-row local pass, hosted proof hold, and the 300-sellable-row next monetization target.

Target:
- Make `bun run check:paid-actor-release-audit` report a clear next-step ladder: 100 local floor passed, hosted proof required, 300-row next tier pending, 1,000-row gate pending.
- Ensure the audit fails if any worker leaves dirty files, stale 20-query defaults, synthetic row counts, graph-only rows, or projected dark metadata in paid counts.

Implement:
- Add audit fields for current sellable rows, true finding count, source-provenance share, public-supported dark metadata current chargeable count, hosted proof state, and payout/pricing/analytics observed state.
- Add remediation text that points Agent 03/05/08/09 to their exact next buyer-visible blockers.
- Keep all revenue/traction fields observed-only.
- Update operations docs with the release ladder only if it helps operators avoid a wrong paid promotion.

Verification:
- Run `bun run check:paid-actor-release-audit`, `bun run check`, contract index, API regression, publication check, and focused API/ops tests.
- Commit and push green changes; continue release audit hardening without waiting.
