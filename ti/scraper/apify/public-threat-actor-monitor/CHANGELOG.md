# Changelog

## 0.6.4 - 2026-06-20

- Published Apify build `0.6.4` on Actor version `0.6`. Proof run `iMQGeezZ8bx7WtlhQ` produced dataset `5PLmkE30luBA5Lbgc` with 10 safe APT42 rows and visible paid-row decisions, caveated lead rows, held stale rows, and metadata-only safety fields.
- Added paid-row enforcement fields for `suppress`, stable reason codes, and owner-specific remediation actions so low-evidence capability rows are not presented or counted like sellable findings.

## 0.6.3 - 2026-06-20

- Recorded published build `0.6.3`, proof run `dQzvWhNM2OHrBWVfo`, dataset `aP1dqnK7uEezn5jJv`, July 4 pricing, Apify margin, platform-usage inclusion, and conversion metric handoff in the public readiness contract and launch checklist.
- Added paid-row decisions to every dataset row: `sellable`, `included_with_caveat`, `coverage_gap_only`, or `hold`, with buyer value score and billing guidance. `OUTPUT.paidRowQuality` and monetization counts now separate useful findings from context-only and remediation rows.

## 0.6.0 - 2026-06-20

- Added compact relationship insight fields to every marketplace dataset row: `relationshipSummary`, `relationshipPivots`, `whyActionable`, `freshnessDelta`, `confidenceDelta`, `contradictionHints`, `corroborationState`, and `nextSearchPivots`.
- Added the `GET /v1/contracts` `apifyStoreReadiness` publication contract as the source of truth for the exact default input, sample output DTOs, public proof DTOs, frontend polling states, pricing hooks, safety contract, and known Apify payout blockers.
- Expanded the manifest example input to the full 20-query default watchlist and kept `includeCoverageGaps` enabled by default.
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
