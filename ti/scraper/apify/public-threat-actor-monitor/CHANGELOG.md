# Changelog

## 0.3.0 - 2026-06-20

- Disabled service coverage rows by default so normal runs only return intelligence and evidence.
- Kept coverage metadata available as an explicit input option.
- Revised the example output to reflect single-source evidence without inflated corroboration claims.
- Classified dated news sources as clear-web evidence and covered the mapping in the smoke fixture.

## 0.2.0 - 2026-06-20

- Added a 20-group default watchlist and bounded five-query concurrency.
- Added source and dataset coverage rows.
- Added freshness, corroboration, actionability, and source-family signals.
- Added Apify output and dataset schemas with an analyst-oriented table view.
- Removed the user-configurable backend URL to prevent server-side request forgery.
- Excluded internal run-status records and planned coverage from evidence scoring.
- Kept all output metadata-only; credentials, stolen files, and private content remain excluded.
