Status: active_program_cp_second_batch_candidate_audit

# Agent 07 Coordination

- Completed Program CP first-pass paid-row false-positive and freshness hardening across `/v1/ops/product-slo`, `/v1/quality/evaluate`, `/v1/intel/search`, pipeline quality reports, and Apify `OUTPUT`.
- Added `programCpHardening` suppression proof for stale/latest-activity, alias collisions, wrong-actor rows, generic source pages, unrelated co-mentions, graph-only pivots, restricted-only claims, synthetic/proof-only rows, low buyer-value rows, and caveated rows that must not count as chargeable.
- Preserved true-positive proof rows with current public support, actor specificity, victim/dataset context, provenance hashes, buyer action, and no-leak boundaries.
- Added fastest repair handoffs for Agents 03/04/05/06/07/08/09/10 and kept projected/caveated/held rows excluded from the 100-row paid floor.
- Fixed Apify marketplace graph-signal drift so public-evidence sellable rows expose buyer-ready marketplace signals while graph export eligibility remains stricter.
- Verification passed: `bun run check`, focused API/ops tests, Apify check/smoke, route inventory, contract index, and full `bun test` (529 pass).

# Current Task: Program CP Second Batch Candidate Audit

Continue auditing the first-100 paid row path and Apify smoke rows for remaining buyer-visible row inflation. Prioritize:
- Cross-check second-batch candidate rows for stale latest-activity wording, actor alias collisions, wrong primary actor, and generic source-page evidence.
- Add suppression/admission proof only where it changes buyer-visible paid-row trust or moves concrete rows toward the 100-row floor.
- Keep true positives chargeable only when fresh/current public support, actor specificity, context, provenance hash, no-leak proof, and buyer action all survive the gate.
- Continue producing actionable handoffs to Agents 03/04/05/06/08/09/10.
