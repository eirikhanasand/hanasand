Status: active_program_cy_production_release_ops_no_dirty_handoff

# Agent 10 Program CY - Production Release Ops And No-Dirty Handoff

You are no longer ready. Own release hygiene and worker handoff quality so monetization work does not get blocked by dirty files, stale contracts, or unclear deployment state.

Buyer-visible goal:
- Make the paid Actor release path boring, reproducible, and impossible to accidentally promote with stale/synthetic data.
- Prevent worker drift where agents leave dirty files and block others.

Implement:
- Add or improve a release audit command that checks git clean state, pushed branch, Actor local proof, hosted proof state, payout/pricing/listing state, no-leak proof, stale latest-activity proof, and 100-row paid floor.
- Make the audit fail with precise remediation steps, not generic readiness text.
- Update coordination docs so every worker knows: commit/push coherent green changes before marking ready, do not leave generated files, do not count projections as paid rows, and continue into the next monetization batch unless genuinely blocked.
- If `/v1/contracts#apifyStoreReadiness` or `/v1/ops/product-slo` still mentions 20-name defaults or stale release gates, correct it to the 100-name paid floor and separate local versus hosted proof.
- Add a compact changelog/runbook entry for how to move from 100 to 1,000 rows without bloat.

Verification:
- Run `bun run check`, release audit if added, publication check, route inventory, contract index, API regression, and focused tests for any touched endpoints.
- Commit and push green changes, then continue release-hygiene fixes without waiting.
