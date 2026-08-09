# Public Telegram source completion goal

## Objective

Maintain at least 100 independently useful, lawful public Telegram feeds in production. Discovery continues while the live qualifying count is below 100.

## Live baseline

Measured on 2026-08-09 after the approved-candidate promotion repair and a later clean production recreation:

- 174 registered `telegram_public` rows: 23 active, 26 candidate, 2 rejected, and 123 retired;
- 14 rows satisfying the full qualifying-count contract, leaving 86 to reach the Telegram objective; 9 other active legacy rows do not count as coverage;
- the production defect was not missing seed import: approved candidates with retained productive cycles were left behind an automatic-review backoff, while reconciliation waited for another review or collection event that the backoff itself prevented;
- the repair reconciles an evidence-bound approved candidate during the ordinary automatic-review sync, clears only review-created backoff, preserves real collection/rate-limit backoff, and requires a scheduled check inside the current check window before promotion;
- `src_portfolio_tg_k8security` is the first recovered source: one global row, `active`, executable, `productionCollection=true`, `countsAsCoverage=true`, with 34 retained captures, 605 health observations, 16 useful scheduled cycles, and zero parser warnings;
- its persisted source timestamp, capture count, health count, and lifecycle state survived stop/start and the later image recreation without a duplicate row; bootstrap on the later recreation reported `updatedSourceCount=0` while importing 36 unrelated newly shipped candidates;
- the source-operations API reported `qualifyingPublicTelegramSourceCount=14`, 82/82 active executable global sources, 81 checked successfully within 24 hours, and no failed source at 2026-08-09T13:07Z; and
- production checkout `57587954d1ebd455c731acaa5aee0cb0e8af3187` ran scraper image `sha256:db64d55794b04abcc7e3ecff0ded3e573f07fa3d5a8cc55a2b671b86035413de`, healthy with restart count 0 since 2026-08-09T13:03:05Z.

The next promotion queue is concrete, not a raw-source target. Nine model-approved candidates currently have one useful retained scheduled cycle: Angara Security, Anti-Malware.ru, BI.ZONE, CSIRT Italia, Netlas, UCSB, RUSCADASEC News, ScadaX News, and Security Vision. F6 and Tumar.One also have one useful retained cycle but still need an evidence-bound automatic source review. Four older candidates have multiple productive cycles but an uncertain automatic review and therefore remain correctly withheld: Alexey Lukatsky, Alexander Leonov, Solar 4RAYS, and Deiteriy Lab. Candidate registration still does not reduce the gap.

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
