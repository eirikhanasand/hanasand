# Public Telegram source completion goal

## Objective

Maintain at least 100 independently useful, lawful public Telegram feeds in production. Discovery continues while the live qualifying count is below 100.

## Live baseline

Measured on 2026-08-09 after the production qualification repair, a native global scheduler cycle, and a deliberate restart:

- 163 registered `telegram_public` rows;
- 21 active rows, of which 12 have governed evidence-bound approval and 9 are legacy rows that do not count as coverage;
- 12 rows satisfying the full qualifying-count contract, leaving 88 to reach the Telegram objective;
- 10 candidates awaiting review, 7 candidates without review evidence, 2 rejected rows, and 123 retired rows;
- the first unstarved global cycle used its own `canary-run_*` identity, completed 46/46 due sources, inserted 282 captures, and had zero failed or retried tasks;
- the first post-restart global cycle completed 10/10 due sources, inserted 52 captures, deduplicated 157, and had zero failed or retried tasks;
- every qualifying Telegram source had a latest successful HTTP 200 parser result, zero latest parser warnings, and no active retry or backoff; and
- 374 retained Telegram evidence objects across the 12 qualifying sources had zero residual email, bot-token, named-credential, or phone matches under the production sanitizer patterns.

The deployed repair preserves compatible governed approvals across prompt revisions, retains the two productive cycles needed for qualification during bounded restart hydration, and prevents the global Telegram canary from adopting scheduled watchlist-discovery runs. The restart retained all 12 qualifying identities with zero source imports and no bootstrap errors.

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
