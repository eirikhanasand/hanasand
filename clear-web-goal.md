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

Open. Production at `f829076e0009d752b9f62303d84dc59f0fc809b3` had 23 qualifying clear-web sources at 2026-08-09T10:15:40Z. The clear-web fleet contained 84 sources in total and 61 remained candidates, so the remaining gap is 4,977. The 17 Ledger 014 rows are imported as candidate/noncoverage with only one scheduled health observation and receive no qualification credit. Wireshark and JetBrains have retained source-review-candidate captures but no automatic review task because the deployed PostgreSQL index still requires useful health; successor `b60d58f8ce304cbd48dd14310263281ba43bb9f2` is verified but not deployed.

| Measured at | Deployed commit | Qualifying clear-web sources | Remaining |
| --- | --- | ---: | ---: |
| 2026-08-09T06:49Z | `b64cdf05428dc2f6b5f60f258a6c348026a55060` | 3 | 4,997 |
| 2026-08-09T07:20Z | `98d393e81f90427f3a75c27dbbbf868bd89d288b` | 15 | 4,985 |
| 2026-08-09T07:43Z | `d37ab621c8d17f1bd32b23ba715dee4105f287fa` | 20 | 4,980 |
| 2026-08-09T10:15:40Z | `f829076e0009d752b9f62303d84dc59f0fc809b3` | 23 | 4,977 |

Update this file only from deployed live evidence; raw registry or candidate counts do not satisfy the goal.

## Completion condition

Close this goal only when at least 5,000 canonical clear-web endpoints simultaneously qualify in the deployed system and the same count reconciles across persistent storage, scheduled collection, the source-operations API, and the customer UI.
