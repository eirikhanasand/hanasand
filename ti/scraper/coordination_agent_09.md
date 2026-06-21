Status: active_program_cv_hosted_apify_paid_readiness_proof

# Agent 09 Program CV - Hosted Apify Paid Readiness Proof

You are no longer ready. Own the external proof lane. The local 100-name proof is not enough for paid release; we need hosted Actor evidence, payout/pricing/listing state, and conversion telemetry to stop guessing.

Buyer-visible goal:
- Prove whether the published Actor can run the 100-name default and produce at least 100 sellable, safe, buyer-useful rows in Apify-hosted infrastructure.
- Keep Apify listing/pricing/payout state observed, not projected.

Implement:
- Add a script or documented command path that runs or verifies the hosted Actor with the 100-name paid preset, captures run id, dataset item count, sellable count, sellable finding count, caveated count, average buyer value, runtime, memory, and cost.
- If API tokens are unavailable locally, make the proof state explicitly `external_token_missing` and include exact manual verification steps for the user; do not fake metrics.
- Update `/v1/contracts#apifyStoreReadiness`, `/v1/ops/product-slo`, launch checklist, and README so local proof, hosted proof, payout readiness, pricing readiness, and public listing status are separate fields.
- Tighten listing/pricing copy only where it reflects real current capability: 100-name default, metadata-only public intelligence, no raw stolen data, analyst-grade fields.
- Track marketplace conversion inputs: store views, runs, unique users, paid users, refunds, payout enabled, pricing model, and last verified timestamp. Unknown stays unknown.

Verification:
- Run publication check, Apify Actor check/smoke, API/ops tests, and full `bun test` if contracts change.
- Commit and push. Continue into pricing/listing conversion fixes only after hosted proof state is truthful.
