# Hanasand thesis status — clean production line

This is the single historical status record for the Masters thesis and product. It records deployed behavior, not agent activity or candidate counts.

## Current state — 2026-08-10

- Production is now built from canonical `github/main` at `20f23e2d`. Frontend and API are healthy; the scraper image is also from this release but is currently unhealthy during recovery.
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
- `20f23e2d`: deployed truthful browser-search status handling and removed obsolete agent/audit documentation. Rollback: `43bdd13f`.
- Live scraper evidence after `43bdd13f`: `/v1/health` returned 200 with PostgreSQL storage and search ready; `/v1/intel/search?q=ransomware` returned 200 with captured public-intelligence records; selected sources were active and had recent collection timestamps.
- Live browser search now returns HTTP 503 with an unavailable status when the scraper cannot answer. The remaining production blocker is the scraper write queue retrying orphaned `evidence_links` rows, which currently makes the scraper health check fail.

## Approved production work

1. Repair the scraper write queue’s orphaned evidence-link retry path and restore healthy collection/search service.
2. Prove two useful scheduled cycles for the implemented clear-web source family.
3. Verify the compact Cases list/detail flow with an authenticated customer session.
4. Remove or implement fake customer-facing paths, then complete tenant/permission and performance cleanup.
