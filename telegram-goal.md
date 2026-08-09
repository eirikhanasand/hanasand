# Public Telegram source completion goal

## Objective

Maintain at least 100 independently useful, lawful public Telegram feeds in production. Discovery continues while the live qualifying count is below 100.

## Live baseline

Measured from PostgreSQL and the native scheduler on 2026-08-09T15:25Z after repairing collection, review, and durable-write throughput:

- the canonical global fleet has 61 registered `telegram_public` rows: 25 active/executable, 27 candidate, 2 rejected, and 7 retired; 116 separate `default`-scoped legacy rows are retired and are not global coverage;
- 16 canonical global rows satisfy the full qualifying-count contract, leaving 84 to reach the Telegram objective; the other 9 active rows remain executable legacy sources but do not satisfy the current two-cycle, evidence-bound qualification contract;
- seed import was not the main bottleneck. A `needs_review` result copied its review cooldown into scheduler `crawlState`, preventing the newer retained evidence needed for the next review. The repair keeps the review timer in `automaticSourceReview.nextReviewAt`, clears only legacy review-created crawl backoff, and preserves HTTP, rate-limit, and collection backoff;
- all 8 affected Telegram candidates became scheduler-eligible without changing their review due dates. Native run `canary-run_758cd0e2fd5979dc` leased them and persisted truthful HTTP/parser/capture outcomes; only Alexander Leonov produced useful new retained evidence, while duplicate-only and parser-low-yield rows remained candidates;
- `src_lukas_stefanko_android_malware_telegram` then reached two distinct productive scheduled cycles and was automatically promoted to one global `active`, executable, `productionCollection=true`, `countsAsCoverage=true`, `sustained_productive` identity. It has 21 retained captures, 6 scheduled health rows, 2 productive cycles, 99 duplicates, and zero parser warnings;
- `src_ransomfeed_ransomware_telegram` and `src_threat_hunting_father_telegram` remain candidates truthfully: each has one productive cycle, followed by duplicate-only or parser-low-yield checks. Registration and a successful public preview do not reduce the gap;
- a second production failure appeared after collection: a variable-arity PostgreSQL `IN` query collided with a prepared statement and left 1,327 writes pending. The shared query now uses one stable `ANY($1::text[])` statement with an explicitly encoded PostgreSQL array literal. Final scheduler run `canary-run_ed647af1a403b9f4` completed 18/18 tasks with 0 failures, 2 new captures, 26 duplicates, no retries, and storage drained to 0 pending writes;
- one clean restart reported `importedSourceCount=0` and `updatedSourceCount=0`. The final current-main restart imported 8 disjoint dark-web candidates and updated 0 rows; the global Telegram counts and IDs remained exactly 61/25/27/2/7 with no channel duplicate or Telegram bootstrap churn;
- all 53 retained objects and all 53 safe excerpts from the three newest channels passed the shipped Telegram sanitizer residual scan and object SHA-256 verification: 0 unreadable objects, 0 hash mismatches, and 0 residual email, contact, credential, token, or phone matches; and
- deployed checkout `15d6120e6e4a84396d72f4928dce3b49f8bf65fa` runs scraper image `sha256:1f64d3024f8539425dd21b5f9fa9ed82edc8e8fe611f1e09cd0616c0f1860e20`, healthy with restart count 0 since 2026-08-09T15:28:37Z. The authenticated source-operations API reports 84/84 executable global sources, 28 qualifying clear-web sources, and 16 qualifying public Telegram sources.

The next promotion queue is evidence-driven, not a raw-source target. Approved one-cycle candidates need a second naturally new retained item; uncertain reviews need new retained evidence before re-review. Duplicate-only checks, successful empty parses, and repeated copies must continue to record health without being counted as productive coverage.

Replace this section after every deployment with the current database/API measurement and deployed commit. Never substitute pack size, candidate count, test fixtures, injected fetches, or status labels.

## One iteration

1. Measure registered, executable, qualifying, current-useful, stale, failed, and backoff counts from PostgreSQL and the source-operations API.
2. Reconcile approved candidates that already have two distinct useful retained scheduled cycles; fix shared lifecycle defects before adding more registrations.
3. Discover a bounded batch from exact publisher, CERT/government, or independently authoritative references.
4. Require an unauthenticated public `/s` preview, current relevant parser yield, endpoint deduplication, lawful public-text collection, and sanitizer residual checks.
5. Reject private, invite-only, authenticated, CAPTCHA-gated, copied, hijacked, sample-distribution, stale, irrelevant, or zero-yield channels.
6. Keep accepted discoveries as non-coverage candidates until the native scheduler persists two distinct useful cycles and the evidence-bound automatic review approves them.
7. Deploy from the canonical production checkout, then verify scheduler health, captures, parser outcomes, backoff, qualification, and restart idempotence.
8. Update this baseline and repeat while the qualifying count is below 100.

## A source counts only when

- its canonical publisher ownership or independent authority is recorded;
- it is globally scoped, publicly reachable without credentials, low risk, and policy approved;
- the production collector and Telegram sanitizer/parser execute on the recurring scheduler;
- at least two distinct scheduled runs have useful retained captures linked to matching health rows;
- its automatic source review is approved and bound to retained immutable evidence;
- `status=active`, `productionCollection=true`, `countsAsCoverage=true`, and collection is executable;
- content, last-success, last-useful, parser, retry, and backoff timestamps are truthful;
- restart preserves one stable source identity without bootstrap churn; and
- PostgreSQL, source-operations API, scheduler status, and customer UI report the same qualifying result.

## Completion

This goal is complete only when production has at least 100 sources meeting every condition above, the count remains at or above 100 across a restart and two later scheduler cycles, and no counted source exposes restricted/private content or residual credentials and personal data.
