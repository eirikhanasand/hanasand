# Public Telegram source completion goal

## Objective

Maintain at least 100 independently useful, lawful public Telegram feeds in production. Discovery continues while the live qualifying count is below 100.

## Live baseline

Measured on 2026-08-09 after SecurityLab completed its second native scheduler cycle and survived the next production restart:

- 164 registered `telegram_public` rows: 22 active, 17 candidate, 2 rejected, and 123 retired;
- 13 rows satisfying the full qualifying-count contract, leaving 87 to reach the Telegram objective; 9 other active legacy rows do not count as coverage;
- `src_securitylab_ru_telegram` completed two distinct useful HTTP 200 runs (`canary-run_abfe88ccf5b9498d` and `canary-run_6bd31b86c7a0d9c1`) with zero parser warnings and promoted to `active`, `productionCollection=true`, and `countsAsCoverage=true` at 2026-08-09T09:29:19Z;
- those runs retained 21 immutable captures; all 21 evidence objects and all 42 stored excerpt/title fields were present and produced zero residual changes under the deployed Telegram sanitizer;
- the post-promotion restart retained one stable SecurityLab source identity, both useful health rows, and the promoted lifecycle fields;
- the source-operations API reported `publicTelegram=13` and gap 87 at 2026-08-09T09:40:10Z; and
- production checkout `855df45ebfb20d3b1c0aea87c6ae9fdc3d4537a1` ran scraper image `sha256:dadc046a3cf2c7d3f5c0a58ba1501dc6926b1a44bb9fbf8572bb60ab653250c5`, healthy with restart count 0 since 2026-08-09T09:37:52Z.

The deployed repair preserves compatible governed approvals across prompt revisions, retains productive-cycle history during bounded restart hydration, and prevents the global Telegram canary from adopting scheduled watchlist-discovery runs. Candidate registration still does not reduce the gap: every new endpoint remains non-production and non-coverage until the native scheduler and evidence-bound review satisfy the qualification contract.

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
