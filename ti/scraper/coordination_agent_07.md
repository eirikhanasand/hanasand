Status: active_program_cp_release_integrity_drift_audit

# Agent 07 Coordination

- Completed Program CP first-pass paid-row false-positive and freshness hardening across `/v1/ops/product-slo`, `/v1/quality/evaluate`, `/v1/intel/search`, pipeline quality reports, and Apify `OUTPUT`.
- Added `programCpHardening` suppression proof for stale/latest-activity, alias collisions, wrong-actor rows, generic source pages, unrelated co-mentions, graph-only pivots, restricted-only claims, synthetic/proof-only rows, low buyer-value rows, and caveated rows that must not count as chargeable.
- Preserved true-positive proof rows with current public support, actor specificity, victim/dataset context, provenance hashes, buyer action, and no-leak boundaries.
- Added fastest repair handoffs for Agents 03/04/05/06/07/08/09/10 and kept projected/caveated/held rows excluded from the 100-row paid floor.
- Fixed Apify marketplace graph-signal drift so public-evidence sellable rows expose buyer-ready marketplace signals while graph export eligibility remains stricter.
- Completed Program CP second-batch candidate audit across Apify `OUTPUT`, `/v1/ops/product-slo`, `/v1/quality/evaluate`, and `/v1/intel/search`.
- Added `secondBatchAudit` proof separating sellable findings from sellable source-provenance rows: 607 local proof rows, 187 sellable rows, 52 sellable findings, and 135 source-provenance rows that do not count toward the finding floor.
- Added row-inflation guards for source-provenance padding, stale/latest activity, alias or wrong actor, generic source pages, graph-only rows, restricted-only rows, and caveated-as-chargeable rows, with hosted proof and external marketplace verification still required before paid promotion.
- Apify smoke now verifies dynamic APT42 counts: 16 rows, 12 sellable rows, 7 sellable findings, 4 sellable source-provenance rows, zero stale/alias/generic/graph-only/restricted sellable finding inflation, and no-leak proof.
- Added hosted paid-row integrity gate to `hostedPaidReadinessProof` across `/v1/contracts`, `/v1/ops/product-slo`, Apify `OUTPUT`, hosted readiness CLI, Actor smoke, and publication checks.
- Hosted paid promotion now requires Program CP `secondBatchAudit` proof, 52 sellable findings, zero false-positive inflation buckets, source-provenance rows excluded from the finding floor, caveated rows excluded from chargeable counts, required buyer/provenance/no-leak signals, and observed external marketplace/payout/pricing data.
- Preserved adjacent dark-metadata public support expansion: `publicSupportSellable250` exposes 250 metadata-only candidates, current/projected/blocked counters, parser handoff rows, route-visible SLO fields, and no-leak serialization.
- Verification passed: `bun run check`, focused API/ops/darkweb tests, hosted readiness check, Apify check/smoke/publication, route inventory, contract index, and full `bun test` (529 pass).
- 2026-06-21 watchdog check: canary proof path, hosted Apify readiness, contract index, route inventory, Apify Actor check/smoke, typecheck, and full test suite remain green; paid release audit correctly holds on observed hosted/marketplace proof and will fail only when the worktree is dirty.
- Current Program DC surfaces preserve the critical paid-count exclusions: dark metadata has 198 current chargeable rows with 52 remaining to the 250-current dark lane, graph/public proof has 300 parser-ready rows with zero current paid-floor credit, and Program DC 500 lift rows remain candidate-only until admitted.

# Current Task: Program CP Release Integrity Drift Audit

Continue watching every paid proof and release surface for drift while other agents expand rows. Prioritize:
- Keep hosted/local/API/Actor paid readiness surfaces aligned with Program CP row-integrity gates.
- Block paid promotion if source-provenance-only, stale/latest, alias/wrong-actor, generic source-page, graph-only, restricted-only, projected-only, or caveated-only rows drift into sellable findings.
- Preserve uncertainty, provenance hashes, buyer actions, no-leak boundaries, and row-level reasons for partial public answers.
- Continue producing actionable handoffs to Agents 03/04/05/06/08/09/10.
