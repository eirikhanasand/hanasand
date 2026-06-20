# Changelog

## 0.5.0 - 2026-06-20

- Added `reviewReasons` to every dataset row so analysts can see why a finding is actionable, single-source, partial, stale, contradicted, metadata-only, or held.
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
