Status: active_program_ef_hosted_revenue_proof_import_and_release_observability

# Agent 10 Program EF - Hosted Revenue Proof Import And Release Observability

You are no longer ready. Program DE made the release decision honest, but it still holds because hosted marketplace evidence, payout state, pricing state, analytics, and cost-per-useful-row are not imported into the product truth surface. Own the bridge from local sellable data to paid Actor operation.

Goal:
- Import or model observed-only hosted revenue proof for the Apify Actor without inventing numbers: last hosted run id, hosted dataset item counts, hosted useful-row counts, run cost, charged usage, public/private state, pricing state, payout state, analytics availability, Store views, runs, users, paid users, conversion, refunds, and failure rate.
- Expose that proof in Product SLO, `/v1/contracts#apifyStoreReadiness`, Apify Actor `OUTPUT`, paid-release audit, and the operator-facing coordination notes.
- Keep the release decision strict: private paid beta can only unlock when current750, 1,000 useful rows, hosted100 proof, published pricing, payout readiness, analytics visibility, no-leak proof, and cost/useful-row are observed. Public paid traffic can only unlock after private beta plus current1000 local sellable rows, hosted300 proof, paid marketplace gate, paid-run/conversion evidence, and refunds proof.
- Make the next revenue blockers measurable and owner-addressable: row gap, useful-row gap, hosted proof gap, price/payout/analytics gap, paid conversion gap, cost/useful-row gap, freshness/staleness defects, and no-leak proof.
- Do not count coordination-only, DTO-only, STIX/TAXII-only, synthetic index, or unverified hosted claims as monetization progress.

Implementation direction:
- Search the repo for existing Apify CLI/API proof scripts, Actor run metadata, publication checks, and pricing notes. Extend the existing path instead of adding a parallel truth system.
- If a real Apify token or hosted evidence is unavailable locally, add a small observed-evidence import file/schema and a validator that marks all values `external_unknown` until populated. The absence of proof should be explicit and should keep release held.
- Add concise proof commands/scripts that a human or automation can run after an Apify hosted run to import item counts, usage cost, run status, dataset id, and Store analytics. Keep secrets out of git and never log tokens.
- Add tests/audit assertions proving that missing external evidence blocks paid release, observed evidence can advance private beta only when thresholds are met, and unsafe/stale/dirty/test-failing states still block.
- Update `coordination.md` with what evidence is now required for paid beta and which fields remain unknown.

Proof before handoff:
- `bun run check`
- focused API/ops/publication tests relevant to changed files
- `bun run smoke:apify-threat-actor-monitor`
- `bun run check:apify-threat-actor-monitor`
- `bun run check:apify-publication`
- `bun run check:contract-index`
- `bun run check:api-regression`
- `bun run check:paid-actor-release-audit`
- full `bun test` only if the shared tree is stable

Do not mark ready until hosted revenue proof is more actionable than Program DE: either imported observed evidence is visible, or the product clearly says which exact external proof fields are still missing and how to collect them. Commit and push coherent green work before handoff so other workers do not avoid your files.

## Previous Summary

- Completed Program DE paid beta and public paid traffic release truth board.
- Added `programDeReleaseBoard` across Product SLO, `/v1/contracts#apifyStoreReadiness`, Apify Actor `OUTPUT`, Actor smoke, and paid-release audit.
- Private paid beta remains held until current750, 1,000 useful rows, hosted observed proof, pricing, payout, analytics, no-leak proof, and cost/useful-row are all observed.
- Public paid traffic remains held until private beta is ready plus current1000 local sellable rows, hosted300 proof, marketplace paid-traffic gate, observed paid-run/conversion evidence, and refunds proof.
- Added top five revenue actions ranked by impact for hosted proof, current750 rows, current1000 useful density/cost, pricing/payout/analytics, and public corroboration for the 1,000-row path.
- Preserved anti-bloat guards so coordination-only, DTO-only, STIX/TAXII-only, and synthetic index work cannot count without buyer-visible rows or observed hosted revenue proof.
- Request the next Agent 10 deployment, observability, release, capacity, or operations task.
