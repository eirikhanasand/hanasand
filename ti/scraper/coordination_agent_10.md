Status: active_program_fg_private_beta_release_decision_and_cost_guard

# Agent 10 Program FG - Private Beta Release Decision And Cost Guard

You are no longer ready. Program EF created the proof ladder; now own the release decision quality for the next paid milestone. This task should prevent both false confidence and over-cautious non-shipping.

Goal:
- Convert the release board from “held because unknown” into a precise private-beta decision surface: which fields are sufficient, which are missing, and whether the Actor can safely enter private paid beta before public traffic.
- Add a cost/useful-row guard based on observed hosted usage when available; if unavailable, keep it unknown and blocking rather than estimating from local data.
- Add a buyer-visible SLO summary that names the remaining revenue blockers in order: current1000 local sellable rows, current1000 useful rows, hosted100/300/500 proof, pricing, payout, analytics, conversion/refunds, no-leak proof, stale/latest-error proof, and dirty/test hygiene.
- Make sure private paid beta and public paid traffic are separate decisions. Private beta can be stricter than local proof but does not need public conversion evidence; public paid traffic does.

Implementation direction:
- Extend Product SLO, `/v1/contracts#apifyStoreReadiness`, paid-release audit, Apify Actor `OUTPUT`, and smoke tests with a Program FG decision summary.
- Use observed fields from Agent 09 if present. Do not fabricate Store views, paid users, refunds, payout status, pricing status, or cost/useful-row.
- Add tests proving local 1,000 rows alone cannot unlock hosted paid traffic, but observed hosted/payout/pricing proof can advance the private-beta decision when thresholds pass.
- Keep anti-bloat guards explicit: coordination, DTOs, STIX/TAXII, and synthetic index rows cannot improve the release score without buyer-visible rows or observed hosted proof.

Proof before handoff:
- `bun run check`
- focused API/ops/publication tests for changed files
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:apify-threat-actor-monitor`
- `bun run check:apify-publication`
- `bun run check:contract-index`
- `bun run check:api-regression`
- `bun run check:paid-actor-release-audit`

Do not mark ready until the private beta decision is operationally sharper and impossible to mistake for public paid readiness. Commit and push green changes before handoff.

## Previous Summary

- Completed Program EF hosted revenue proof import and release observability.
- Added an observed-only hosted500 proof ladder across hosted readiness, Product SLO, `/v1/contracts#apifyStoreReadiness`, Apify Actor `OUTPUT`, Actor smoke, API/ops tests, and paid-release audit surfaces.
- Added `conversionPayoutTruth` for pricing, payout, Store analytics, listing state, and hosted500 proof with `external_unknown` defaults and no synthetic fallback.
- Added `docs/examples/hosted-apify-observed-proof.hosted500.template.json` as a sample-only import shape; sample proofs are accepted for validation but cannot unlock hosted or marketplace gates.
- Private beta and paid traffic remain held until real hosted 100/300/500 proof, pricing, payout, analytics, conversion/refund evidence, no-leak proof, and cost/useful-row fields are observed.
- Preserved 96 GB target, 160 GB normal ceiling, 500 GB CTI reserve, no-GPU assumption, and anti-bloat guards.
- Request the next Agent 10 deployment, observability, release, capacity, or operations task.
