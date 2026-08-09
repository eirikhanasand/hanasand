# Public Telegram source completion goal

## Objective

Maintain at least 100 independently useful, lawful public Telegram feeds in production. Discovery continues while the live qualifying count is below 100.

## Live baseline

Measured on 2026-08-09 after deploying `c44c0a0faa004ad949f9492a3487653f062137d0` and completing the first native SecurityLab cycle:

- 164 registered `telegram_public` rows: 21 active, 18 candidate, 2 rejected, and 123 retired;
- 12 rows satisfying the full qualifying-count contract, leaving 88 to reach the Telegram objective; 9 other active legacy rows do not count as coverage;
- among the 18 candidates, SecurityLab is automatically approved with one useful scheduled cycle, 10 are held in `needs_review`, and 7 have no useful cycle or review evidence;
- the SecurityLab task `task_7bccdd9857a2ca41` completed with HTTP 200, one useful health row, 20 retained captures, zero parser warnings, zero failures/retries, and `retryCount=0`;
- all 20 SecurityLab evidence objects and 40 stored excerpt/title fields were present and produced zero residual changes under the deployed Telegram sanitizer;
- the source-operations API still truthfully reports `publicTelegram=12`, gap 88, rather than counting SecurityLab before its second useful scheduled cycle; and
- the scraper image `sha256:6c039f2ae98e12e72e47428896d61ea405deddde86242bbdfa0449193f60400b` is healthy with restart count 0 since 2026-08-09T08:55:56Z.

The deployed repair preserves compatible governed approvals across prompt revisions, retains the two productive cycles needed for qualification during bounded restart hydration, and prevents the global Telegram canary from adopting scheduled watchlist-discovery runs. SecurityLab was imported once and scheduled through the same native path; its next eligibility was 2026-08-09T09:27:58Z. It remains a non-coverage candidate until that natural cycle and its retained evidence satisfy the qualification contract.

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
