Status: active_program_cp_hosted_proof_audit

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
- Verification passed: `bun run check`, focused API/ops tests, Apify check/smoke, route inventory, contract index, and full `bun test` (529 pass).

# Current Task: Program CP Hosted Proof Audit

Continue auditing the hosted 100-name paid proof path. Prioritize:
- Ensure hosted Apify proof cannot promote local-only, source-provenance-only, stale/latest, alias/wrong-actor, generic source-page, graph-only, restricted-only, or caveated-only rows into paid findings.
- Keep paid promotion blocked until hosted 100-name evidence, Apify marketplace telemetry, payout/pricing status, and analytics are observed rather than inferred.
- Preserve uncertainty, provenance hashes, buyer actions, no-leak boundaries, and row-level reasons for partial public answers.
- Continue producing actionable handoffs to Agents 03/04/05/06/08/09/10.
