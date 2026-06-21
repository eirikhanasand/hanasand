Status: active_program_db_release_audit_for_300_and_marketplace_unlock

# Agent 10 Program DB - Release Audit For 300 And Marketplace Unlock

You are no longer ready. The audit now shows local 250 passes and local 300 is 50 rows away. Own the release truth for that transition and marketplace proof import.

Target:
- Make the audit pass local300 only when current sellable rows >=300, true findings >=150, source-provenance share <=45%, and no unsafe/projection/graph/restricted/stale rows count.
- Add gate effects for Agent 09 observed proof: hosted100 pass, hosted300 pass, marketplace promotion pass/hold.
- Keep current paid traffic held until hosted proof and marketplace state are observed.

Implement:
- Extend `releaseLadder` with a `local300UnlockRequirements` packet and `marketplaceUnlockRequirements` packet.
- Add fail-closed checks for sample proofs, partial observed proof imports, nonzero no-leak failures, missing secondBatchAudit, and unobserved marketplace fields.
- Add concise remediation mapping for Agents 03/05/08/09 based on the current gaps.
- Update docs only if it prevents premature promotion or helps the operator import proof.

Verification:
- Run `bun run check:paid-actor-release-audit`, `bun run check`, contract index, API regression, publication check, and focused API/ops tests.
- Commit and push green changes; continue release audit hardening without waiting.
