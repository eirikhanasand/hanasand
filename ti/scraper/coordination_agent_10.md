Status: active_program_da_release_gate_for_current_250_and_300

# Agent 10 Program DA - Release Gate For Current 250 And 300

You are no longer ready. Keep the release audit pointed at paid reality while Agents 03/05/08 lift row quality.

Target:
- Add explicit gates for current local 250 sellable, current local 300 sellable, hosted 100-name proof, and hosted 300-row proof.
- Make the audit separate current sellable findings, source-provenance-only rows, dark metadata current chargeable rows, public-proof parser-ready rows, and projected rows.
- Fail if any projected, graph-only, restricted-only, stale/latest-error, or source-provenance padding is counted as true findings.

Implement:
- Extend `releaseLadder` with `current250Gate`, `current300Gate`, `hosted100Gate`, `hosted300Gate`, and `marketplacePromotionGate`.
- Add exact next-action text for Agent 03/05/08/09 based on observed gaps.
- Add checks for imported observed Apify proof from Agent 09, but treat missing proof as hold, not pass.
- Keep all marketplace/revenue fields observed-only.
- Update operations docs only where it helps prevent premature paid promotion.

Verification:
- Run `bun run check:paid-actor-release-audit`, `bun run check`, contract index, API regression, publication check, and focused API/ops tests.
- Commit and push green changes; continue release audit hardening without waiting.
