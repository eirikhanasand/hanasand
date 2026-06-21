Status: active_high_value_source_replacement_4000_to_10000

# Agent 04 Current Assignment

Own high-value public source replacement. Do not pad source count.

## Goal

Improve the source pool from 4,000 evaluated candidates toward 10,000 while raising payworthy density and fresh row yield.

## Current Metrics

- Evaluated candidates: 4,000
- Payworthy: 1,468
- Payworthy rate: 36.7%
- Target payworthy rate: 72%
- Shortfall: 1,412 payworthy sources

## Work

- Replace low-value candidates with public sources that produce fresh, actor-specific, buyer-useful rows.
- Prioritize vendor CTI, CERT/government, advisories/APIs, ransomware trackers, public datasets, malware research, cloud/SaaS, ICS/OT, exploit intelligence, and public-channel descriptors.
- For each candidate family, report expected fresh rows/day, evidence yield, actor coverage, parser readiness, legal/robots status, and buyer-visible row effect.
- Focus first on APT29, APT28, APT42, Volt Typhoon, Lazarus, Scattered Spider, FIN7, LockBit, and Akira.
- Keep candidates review-only until approved; no crawling or source activation from this task.

## Proof Before Handoff

- `bun run check`
- `bun test src/tests/sourceSeeds.test.ts`
- focused source/public-signal/API tests
- `bun run check:route-inventory`
- `bun run check:contract-index`
- Commit and push green changes.
