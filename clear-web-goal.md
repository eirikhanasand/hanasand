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

Open. The last truthful production measurement in `goals.md` is 3 qualifying clear-web sources on 2026-08-09. Update this file only from deployed live evidence; raw registry or candidate counts do not satisfy the goal.

## Completion condition

Close this goal only when at least 5,000 canonical clear-web endpoints simultaneously qualify in the deployed system and the same count reconciles across persistent storage, scheduled collection, the source-operations API, and the customer UI.
