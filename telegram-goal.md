# Public Telegram source completion goal

## Objective

Maintain at least 100 independently useful, lawful public Telegram feeds in production. Discovery continues while the live qualifying count is below 100.

## Live baseline

Measured from PostgreSQL, the source-operations API, and the native scheduler on 2026-08-09T15:54Z after repairing collection, review, and durable-write throughput:

- the canonical global fleet has 61 registered `telegram_public` rows: 26 active/executable, 26 candidate, 2 rejected, and 7 retired; 116 separate `default`-scoped legacy rows are retired and are not global coverage;
- 17 canonical global rows satisfy the full qualifying-count contract, leaving 83 to reach the Telegram objective; the other 9 active rows remain executable legacy sources but do not satisfy the current two-cycle, evidence-bound qualification contract;
- seed import was not the main bottleneck. A `needs_review` result copied its review cooldown into scheduler `crawlState`, preventing the newer retained evidence needed for the next review. The repair keeps the review timer in `automaticSourceReview.nextReviewAt`, clears only legacy review-created crawl backoff, and preserves HTTP, rate-limit, and collection backoff;
- all 8 affected Telegram candidates became scheduler-eligible without changing their review due dates. Native run `canary-run_758cd0e2fd5979dc` leased them and persisted truthful HTTP/parser/capture outcomes; Alexander Leonov then reached a second productive cycle, passed evidence-bound review, and became the 17th qualifying Telegram source, while duplicate-only and parser-low-yield rows remained candidates;
- `src_lukas_stefanko_android_malware_telegram` then reached two distinct productive scheduled cycles and was automatically promoted to one global `active`, executable, `productionCollection=true`, `countsAsCoverage=true`, `sustained_productive` identity. It has 21 retained captures, 6 scheduled health rows, 2 productive cycles, 99 duplicates, and zero parser warnings;
- `src_ransomfeed_ransomware_telegram` and `src_threat_hunting_father_telegram` remain candidates truthfully: each has one productive cycle, followed by duplicate-only or parser-low-yield checks. Registration and a successful public preview do not reduce the gap;
- a second production failure appeared after collection: a variable-arity PostgreSQL `IN` query collided with a prepared statement and left 1,327 writes pending. The shared query now uses one stable `ANY($1::text[])` statement with an explicitly encoded PostgreSQL array literal. Final scheduler run `canary-run_ed647af1a403b9f4` completed 18/18 tasks with 0 failures, 2 new captures, 26 duplicates, no retries, and storage drained to 0 pending writes;
- one clean restart reported `importedSourceCount=0` and `updatedSourceCount=0`. The final current-main restart imported 8 disjoint dark-web candidates and updated 0 rows; the global Telegram counts and IDs remained exactly 61/25/27/2/7 with no channel duplicate or Telegram bootstrap churn;
- all 53 retained objects and all 53 safe excerpts from the three newest channels passed the shipped Telegram sanitizer residual scan and object SHA-256 verification: 0 unreadable objects, 0 hash mismatches, and 0 residual email, contact, credential, token, or phone matches; and
- canonical checkout `6f48eb19e4148549504a854fd405c24cd67981ea` runs scraper image `sha256:1f64d3024f8539425dd21b5f9fa9ed82edc8e8fe611f1e09cd0616c0f1860e20`, containing the scraper repair from `15d6120e6e4a84396d72f4928dce3b49f8bf65fa`, healthy with restart count 0 since 2026-08-09T15:28:37Z. The authenticated source-operations API reports 85/85 executable global sources, 28 qualifying clear-web sources, and 17 qualifying public Telegram sources.

The next promotion queue is evidence-driven, not a raw-source target. Approved one-cycle candidates need a second naturally new retained item; uncertain reviews need new retained evidence before re-review. Duplicate-only checks, successful empty parses, and repeated copies must continue to record health without being counted as productive coverage.

Replace this section after every deployment with the current database/API measurement and deployed commit. Never substitute pack size, candidate count, test fixtures, injected fetches, or status labels.

## Latest bounded discovery ledger

The 2026-08-09T15:47Z–16:04Z iteration accepted two unreleased, non-coverage candidates on the current Telegram feature branch:

- `src_dciber_brazil_telegram` is the exact `https://t.me/dciber` channel linked by Instituto de Defesa Cibernetica's first-party organization page. The shipped public-preview adapter parsed 20 posts, classified 3 as useful, observed a latest post at 2026-08-03T19:45:54Z, and found zero sanitizer-idempotence or residual PII/credential matches. It remains `candidate`, `productionCollection=false`, and `countsAsCoverage=false` until deployment, two useful scheduled retained-capture cycles, and review approval.
- `src_redseg_latam_telegram` is the exact `https://t.me/redseg` channel linked by REDSEG LATINOAMERICA's CIBERSEG incident-response organization page. The shipped adapter parsed 20 posts, classified 5 as useful, observed a latest post at 2026-08-09T15:33:24Z, and found zero forwarded-message markers, sanitizer-idempotence failures, or residual PII/credential matches. It remains candidate-only under the same production qualification contract.

Explicit exclusions from the same pass:

- ANY.RUN had strong current yield and a current first-party ownership link, but `https://t.me/anyrun_app` already exists in the retired `default`-tenant legacy catalog under a different source identity. Adding a global copy would violate endpoint deduplication; migrate the legacy identity through the shared source-lifecycle owner before reconsidering it.
- `https://t.me/thecybershafarat` was first-party but stale and non-useful: 2 parsed posts, 0 useful, latest 2026-02-04T17:05:31Z.
- `https://t.me/senq_cyber` was first-party but parsed 0 posts and produced 0 useful items.
- `https://t.me/UAEcybersecurity` parsed 3 stale posts, produced 0 useful items, and had no current activity after 2025-12-30.
- `https://t.me/vxunderground` was current and parser-useful, but no exact first-party publisher reference to that Telegram endpoint was verified in this pass.
- `https://t.me/s2wdailybrief` had an exact current S2W ownership reference but produced 0 useful items across 20 parsed posts; its latest preview post was 2026-07-13T09:36:40Z.
- `https://t.me/kryptonite_channel` was current but produced 0 useful items across 15 parsed posts.
- `https://t.me/CyberSecurityIL` produced only 1 useful item across 17 parsed posts and predominantly linked third-party news, so it failed the independent-yield boundary.
- Singapore PDPC's `https://t.me/pdpcsg` parsed 8 posts but was inactive after 2025-10-31 and produced 0 useful items; the government-linked `https://t.me/ncpcscamalert` parsed 0 posts.
- Resecurity, CloudSEK, ThreatMon, Singapore CSA, CERT Polska, Oman CERT, and Jordan NCSA handle guesses resolved only to landing/empty previews or lacked exact ownership evidence; none were registered.

Keep this ledger append-only per bounded discovery iteration so rejected endpoints are not repeatedly guessed and accepted candidates are never mistaken for coverage.

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
