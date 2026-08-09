# Clear-web source fleet — persistent 5,000-source goal

## Objective

Keep discovering, validating, integrating, and operating lawful clear-web threat-intelligence feeds until production has at least 5,000 unique qualifying sources.

## What qualifies

A source counts only when its canonical direct RSS, Atom, JSON, or official API endpoint:

- is reachable and parsed by the shipped bounded collector;
- produces useful retained current intelligence in at least two distinct scheduled production cycles;
- has current publisher and legal-basis evidence plus an approved evidence-bound automatic source review;
- is actively scheduled with truthful health, cadence, freshness, and backoff state; and
- is not a duplicate, mirror, static page, search wrapper, generated/padded row, marketing page, inactive archive, or irrelevant feed.

## Operating loop

1. Measure the live qualifying count from PostgreSQL, the scheduler, the source API, and the UI; reconcile discrepancies before claiming progress.
2. Discover a bounded batch through current authoritative publisher references.
3. Deduplicate by canonical endpoint across every seed pack and runtime source.
4. Run the real collector/parser and retain exact accepted, excluded, duplicate, parse-failure, current-item, and useful-item evidence.
5. Ship candidate configuration and focused regression coverage without granting production credit.
6. Deploy through the canonical production checkout and verify import plus recurring scheduling.
7. Promote only after two useful retained scheduled cycles and approved automatic review; retire sources that fail the production window.
8. Repeat until the live clear-web qualifying count is at least 5,000.

## Current state

Open. Production at `57587954d1ebd455c731acaa5aee0cb0e8af3187` had 28 strictly qualifying clear-web sources at 2026-08-09T13:07Z, leaving a qualifying gap of 4,972. Newly imported source packs remain candidate-only and contribute no production credit until governed review and two useful retained scheduled cycles.

| Measured at | Deployed commit | Qualifying clear-web sources | Remaining |
| --- | --- | ---: | ---: |
| 2026-08-09T06:49Z | `b64cdf05428dc2f6b5f60f258a6c348026a55060` | 3 | 4,997 |
| 2026-08-09T07:20Z | `98d393e81f90427f3a75c27dbbbf868bd89d288b` | 15 | 4,985 |
| 2026-08-09T07:43Z | `d37ab621c8d17f1bd32b23ba715dee4105f287fa` | 20 | 4,980 |
| 2026-08-09T10:59Z | `b7877ca408c50fbbdcf2b4ebb460b107d9363f4a` | 24 | 4,976 |
| 2026-08-09T13:07Z | `57587954d1ebd455c731acaa5aee0cb0e8af3187` | 28 | 4,972 |

Update this file only from deployed live evidence; raw registry or candidate counts do not satisfy the goal.

## Completion condition

Close this goal only when at least 5,000 canonical clear-web endpoints simultaneously qualify in the deployed system and the same count reconciles across persistent storage, scheduled collection, the source-operations API, and the customer UI.
