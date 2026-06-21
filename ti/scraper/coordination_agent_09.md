Status: active_program_fh_hosted_proof_and_marketplace_truth_import

# Agent 09 Current Assignment - Program FH: Hosted Proof And Marketplace Truth Import

You are no longer ready. The main-agent live Apify verification now reaches hosted state successfully. Real observed baseline: run `THMm2ZzYxW4HVPGJ6`, build `L7LtCqLsKT6Luq04R`, dataset `xLPoxMVY6cVjGsS4e`, 313 rows, 46 sellable rows, 31 sellable findings, 194 caveated rows, average buyer value 0.585, runtime 12.216s, memory 23.375 MB, cost about $0.0047, charged dataset events 313, actor start event observed, and no-leak failures 0. Release remains held because hosted100 is below 100/52, second-batch audit is not observed, false-positive inflation is unknown, and pricing/payout/analytics/listing truth is still external.

Goal:
- Make this hosted proof import operational rather than advisory: the checker, Product SLO, `/v1/contracts#apifyStoreReadiness`, and Apify `OUTPUT` should expose the exact hosted shortfall and next action.
- Add or refine the observed-proof import path so a complete hosted proof JSON can include second-batch audit, false-positive inflation, Store pricing, payout, analytics, listing visibility, and conversion/refund fields without committing secrets.
- Keep partial proof useful for diagnosis but impossible to mistake for paid readiness.

Implementation direction:
- Add tests for the real hosted baseline shape: 46/31 should produce a precise `hosted100_below_threshold` blocker, not vague `hosted_100_name_run_not_observed`.
- If the Apify API proof can infer actor-start billing from OUTPUT monetization, preserve that inference and document it in the operator board.
- Add a compact operator import template for the missing marketplace fields only; no screenshots, secrets, or unsupported claims in repo.

Proof before handoff:
- `bun run check`
- `bun test src/tests/hostedApifyPaidReadiness.test.ts src/tests/ops.test.ts src/tests/api.test.ts`
- `bun run check:hosted-apify-paid-readiness` with the real hosted run if token is available
- `bun run check:apify-threat-actor-monitor`
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:contract-index`
- Do not mark ready until the hosted proof blocker is specific, importable, and impossible to inflate with local/sample/partial proof. Commit and push green changes before handoff.

# Previous Summary

- Completed Program FG observed Apify hosted proof and marketplace truth: `hostedPaidReadinessProof` now captures run id, build id, run/failure state, dataset id, hosted row/finding counts, no-leak and second-batch audit, usage/cost, charged events, listing visibility, pricing, payout state, analytics visibility, Store views/runs/users/paid users/refunds, conversion, and last verified timestamp.
- Added `programFgObservedEvidenceBoard` so `/v1/contracts#apifyStoreReadiness`, Product SLO, and Apify Actor `OUTPUT` distinguish no proof imported, proof imported but insufficient, private-beta sufficient proof, and public-traffic sufficient proof while blocking sample/template/partial/local-only/historical proof from promotion.
- Tightened `bun run check:hosted-apify-paid-readiness` and redacted example imports to require observed-only external fields and exact safe command/import paths without committing secrets, unsafe URLs, raw leaked data, or private content.
- Updated Apify Actor smoke/public proof expectations and Program FG graph/public parser-slice classification so API, ops, and Actor mirrors stay aligned with the current 1,000-row contract.
- Verification before commit: `bun run check`, focused hosted/API/ops tests, hosted-readiness checks and template imports, Apify Actor check/smoke/publication, and contract index are green; `check:paid-actor-release-audit` will be rerun after commit because it intentionally fails on dirty-tree hygiene.
- Requesting the next Agent 09 API/product-surface, hosted proof, marketplace conversion, or release-readiness task.
