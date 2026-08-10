# Hanasand thesis status — clean production line

This is the single historical status record for the Masters thesis and product. It records deployed behavior, not agent activity or candidate counts.

## Current state — 2026-08-10

- Production is now on the canonical `github/main` line. The deployed scraper is `43bdd13f`; frontend and API are on the preceding `44662e44` release while the API search-path verification is completed.
- The scraper is healthy with PostgreSQL storage, native search ready, zero collection errors in the first post-deploy public canary, and the production clear-web family enabled alongside dark-web metadata collection.
- The Cases UI was shortened and its source/UX checks now describe the actual compact evidence and activity workflow. Authenticated browser proof still requires a real customer session.
- Source review is not counted as product progress. The five-source clear-web family is implemented and active, but it still needs two useful scheduled cycles before it is considered productive.

## Clean line

The product began with public threat-intelligence collection, then moved useful source collection into the Hanasand application. External marketplace/readiness machinery was removed; the application is the product surface. The remaining work is to make the application’s real collection, evidence, search, cases, alerts, tenant isolation, and operational health reliable in production.

## Required evidence for each release

Record the deployed commit, deployment time, live API result, live browser result, relevant database/runtime evidence, known failures, and rollback commit. Do not record a merge, review, test run, candidate import, or agent claim as a production milestone.

## Release evidence

- `44662e44`: deployed source-family runtime, compact Cases copy, and unified frontend/API/scraper build. Rollback: `f9756c5a`.
- `43bdd13f`: deployed native PostgreSQL search readiness and query routing. Rollback: `44662e44`.
- Live scraper evidence after `43bdd13f`: `/v1/health` returned 200 with PostgreSQL storage and search ready; `/v1/intel/search?q=ransomware` returned 200 with captured public-intelligence records; selected sources were active and had recent collection timestamps.
- The remaining release blocker is customer-facing search latency/status verification: the API must remain an honest 503 when the scraper cannot answer, and return 200 only for a real result.

## Approved production work

1. Finish the API search timeout/status fix and deploy the API on `43bdd13f` or newer.
2. Prove two useful scheduled cycles for the implemented clear-web source family.
3. Verify the compact Cases list/detail flow with an authenticated customer session.
4. Remove or implement fake customer-facing paths, then complete tenant/permission and performance cleanup.
