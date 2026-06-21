# Changelog

## 0.6.8 - 2026-06-21

- Expanded the default monitor from the 20-name proof preset to a 100-name buyer preset / 100-name default watchlist while keeping custom runs capped at 100 names.
- Added Program CU `buyerPaidReleaseVerdict` under `paidReleaseTruthBoard` so Actor `OUTPUT`, `/v1/contracts#apifyStoreReadiness`, and `/v1/ops/product-slo` expose a compact buyer/operator go-no-go summary with paid traffic held, draft listing state, observed row blockers, observed-only operator recording rules, and no-leak proof.
- Added Program CY `graphPublicCorroborationPivotPacket.paidRowUnlockQueue` so Actor `OUTPUT` and `/v1/ops/product-slo` separate graph-backed pivots into parser-ready, public-source-needed, contradicted, stale, and unsafe/restricted buckets with hash-only proof ids, source classes, candidate fields, buyer reasons, and zero current paid-floor credit until parser admission.
- Added Program CZ release-ladder proof: Actor `OUTPUT`, `/v1/ops/product-slo`, and `bun run check:paid-actor-release-audit` now distinguish local 100-row pass, hosted proof hold, 300-sellable target gap, 1,000-row gate state, current dark metadata chargeable rows, graph parser handoff rows, and observed-only Apify payout/pricing/analytics state without counting projections as paid rows.
- Added sellable public source-provenance rows for fresh or recent safe source evidence that directly supports an actor result, without presenting provenance as a confirmed incident claim.
- Changed paid defaults to suppress held/suppressed rows and coverage-gap diagnostics unless explicitly requested. The current local 100-name buyer preset produces 607 safe rows: 187 sellable rows, 420 caveated leads, 30.8% sellable rate, and average buyer value `0.593`.
- Added the compact release runbook for moving from 100 to 1,000 rows without bloat: promote only hosted 100-name proof plus observed Apify telemetry, then expand by measured source/parser repairs that increase current sellable findings, useful density, no-leak proof, and refund-free paid usage; exclude projections, graph-only pivots, caveated rows, source counts, and generated files from release readiness.
- Increased the Actor timeout to 600 seconds for the 100-name default tier.

## 0.6.7 - 2026-06-20

- Recorded hosted build `0.6.7` as the current shape/safety proof surface. Remote proof run `OThlfd0uzSCNnedAO` produced dataset `LSen2fYtwFTtOr7vK` with 10 safe APT42 rows: 4 sellable, 2 caveated, 4 held, average buyer value `0.577`, and `shape_safety_proof`.
- Updated buyer-visible README and launch-checklist proof copy so the Store-facing surface points at the latest hosted proof while production paid traffic stays blocked until at least `100 sellable rows` are present and runtime/platform usage stay external analytics fields until copied from Apify.
- Added Program CF `hundredRowConversionProof` / `hundredRowConversionProgress` so Actor `OUTPUT` and `/v1/contracts#apifyStoreReadiness` show current sellable rows, projected sellable rows from accepted repairs, one-repair-away rows, caveated useful rows, blocked rows, exact blockers, and a first paid-traffic experiment that stays `blocked_until_100_sellable_rows`.
- Added Program CL `marketplaceConversionRealRowSamplePack` so Actor `OUTPUT` and `/v1/contracts#apifyStoreReadiness` expose only current safe sellable sample rows, exclude synthetic/graph-only/stale/restricted-only/caveat-only/held/coverage-gap rows from readiness proof, and keep marketplace telemetry descriptors as `external_unknown` until externally verified.
- Added Program CT `first100BuyerPreview` under the real-row sample pack so Actor `OUTPUT`, `/v1/contracts#apifyStoreReadiness`, and `/v1/ops/product-slo` show the first-100 sample format, current sellable/useful-not-chargeable counts, blocker buckets, required buyer fields, no-leak proof, freshness proof, and activation gates while staying blocked until the real 100-row floor passes.

## 0.6.4 - 2026-06-20

- Published Apify build `0.6.4` on Actor version `0.6`. Proof run `iMQGeezZ8bx7WtlhQ` produced dataset `5PLmkE30luBA5Lbgc` with 10 safe APT42 rows and visible paid-row decisions, caveated lead rows, held stale rows, and metadata-only safety fields.
- Added paid-row enforcement fields for `suppress`, stable reason codes, and owner-specific remediation actions so low-evidence capability rows are not presented or counted like sellable findings.
- Added `OUTPUT.monetizationReadiness` so every run states whether it has enough chargeable rows for paid-traffic confidence, why it is blocked, and the next revenue action.
- Promoted fresh or recent multi-source public profile, target, and TTP rows to `sellable` while keeping missing source families visible as caveats; single-source activity, stale, contradicted, and no-evidence rows remain held or caveated.
- Added dry-run `OUTPUT.qualityLiftGate` with accepted/rejected before-after repair examples, sellable/fresh/useful row lift metrics, cost-per-useful-row delta, projected row revenue delta, and owner handoffs so repair work only counts when buyer-visible paid output improves.
- Added per-row `graphQualityLift` and `graphQualityLiftEvidence` so sellable/caveated/held rows expose relationship readiness, corroboration, contradiction holds, freshness lift, export-review eligibility, and no-leak state.
- Added Program BO `OUTPUT.graphLiftBatch2` against live proof `OThlfd0uzSCNnedAO` / dataset `LSen2fYtwFTtOr7vK`, including one accepted graph-backed sellable lift and explicit graph-only rejection cases for stale, single-source, contradicted, restricted-only, missing-ledger, and unrelated-actor context.
- Added Program BP per-row `marketplaceGraphSignals` plus run-level `OUTPUT.marketplaceGraphSignals` with eight safe APT/ransomware examples, next buyer pivots, row actions, and graph-inflation rejection cases for stale, single-source, unrelated, restricted-only, missing-ledger, and no-fresh-change context.

## 0.6.3 - 2026-06-20

- Recorded published build `0.6.3`, proof run `dQzvWhNM2OHrBWVfo`, dataset `aP1dqnK7uEezn5jJv`, July 4 pricing, Apify margin, platform-usage inclusion, and conversion metric handoff in the public readiness contract and launch checklist.
- Added paid-row decisions to every dataset row: `sellable`, `included_with_caveat`, `coverage_gap_only`, or `hold`, with buyer value score and billing guidance. `OUTPUT.paidRowQuality` and monetization counts now separate useful findings from context-only and remediation rows.

## 0.6.0 - 2026-06-20

- Added compact relationship insight fields to every marketplace dataset row: `relationshipSummary`, `relationshipPivots`, `whyActionable`, `freshnessDelta`, `confidenceDelta`, `contradictionHints`, `corroborationState`, and `nextSearchPivots`.
- Added the `GET /v1/contracts` `apifyStoreReadiness` publication contract as the source of truth for the exact default input, sample output DTOs, public proof DTOs, frontend polling states, pricing hooks, safety contract, and known Apify payout blockers.
- Expanded the manifest example input to the full 20-query default watchlist and kept `includeCoverageGaps` enabled by default. Superseded in `0.6.8` by the 100-name buyer preset with diagnostics disabled by default.
- Tightened publication guardrails to reject draft listing copy, hello-world input, generic local categories, and unsafe output claims.
- Tightened the publication gate to validate required scheduler, retry/backoff, duplicate-run reuse, source-coverage, coverage-gap, review, and analysis-facet fields in the actual dataset schema and fixture.
- Added actor source-coverage action fields to every dataset row: freshness expectation, top missing source family, next best source action, buyer caveat, and expected time to useful signal.
- Documented public proof commands for `APT29`, `Volt Typhoon`, `Scattered Spider`, `LockBit`, random actor, and made-up actor readiness checks.

## 0.5.0 - 2026-06-20

- Added `reviewReasons` to every dataset row so analysts can see why a finding is actionable, single-source, partial, stale, contradicted, metadata-only, or held.
- Added `analysisFacets` to every dataset row for stable filtering by row type, claim type, evidence grade, freshness, collection action, entity presence, source class, and safety boundary.
- Added coverage-gap rows plus source-family, collection-priority, and recommended collection action fields for thin or stale evidence.
- Added scheduler polling, retry/backoff, duplicate-run reuse, deferred workload, badge, and source-coverage gap fields to every dataset row.
- Aligned fixture smoke coverage with scheduler polling, duplicate-run reuse, source coverage gaps, and safe-metadata-only quality fields.

## 0.4.0 - 2026-06-20

- Clustered strongly overlapping public reports into incident claim rows.
- Added claim type, optional victim/sector/country/impact fields, reporting windows, publisher counts, and corroborating or contradicting source IDs.
- Kept every underlying source row available for provenance and review.

## 0.3.0 - 2026-06-20

- Disabled service coverage rows by default so normal runs only return intelligence and evidence.
- Kept coverage metadata available as an explicit input option.
- Revised the example output to reflect single-source evidence without inflated corroboration claims.
- Classified dated news sources as clear-web evidence and covered the mapping in the smoke fixture.
- Removed internal run-status rows and capability-only darknet warnings from customer datasets.
- Counted evidence sources separately from orchestration records.

## 0.2.0 - 2026-06-20

- Added a 20-group default watchlist and bounded five-query concurrency.
- Added source and dataset coverage rows.
- Added freshness, corroboration, actionability, and source-family signals.
- Added Apify output and dataset schemas with an analyst-oriented table view.
- Removed the user-configurable backend URL to prevent server-side request forgery.
- Excluded internal run-status records and planned coverage from evidence scoring.
- Kept all output metadata-only; credentials, stolen files, and private content remain excluded.
