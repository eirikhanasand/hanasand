# Hanasand thesis status — clean production line

This is the single historical status record for the Masters thesis and product. It records deployed behavior, not agent activity or candidate counts.

## Current state — 2026-08-10

- Production is deployed from private canonical `main` at `8b573221`. API, frontend, and scraper are healthy after the scraper’s PostgreSQL hydration/startup window.
- The live exposure queue returns HTTP 200 with retained customer-visible rows (`47` total in the verified probe). The public activity page showed `47/47 loaded` and a current RansomLook item. During scraper startup the same route returned an explicit HTTP 503, not an empty success.
- The Cases list is now compact: case, severity/status, owner, and updated time. Case detail retains real assignment, status, evidence, timeline, and delivery actions while collapsing secondary report controls. Authenticated browser proof still requires a real customer session; the unauthenticated route correctly redirects to login.
- A governed dark-web metadata source family is active with three approved sources. One RansomLook RSS scheduled cycle has produced retained output; the family remains incomplete until two useful scheduled cycles are proven.

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
- `930af7ca`: deployed governed exposure-source parsing and a live RansomLook RSS collection cycle. Rollback: `f7d90b84`.
- `882bf552`: deployed compact Cases UI controls and bounded exposure-claim timestamps/metadata-only semantics. Rollback: `930af7ca`.
- Live evidence after `882bf552`: production checkout matched the deployed SHA; API/frontend/scraper containers reported healthy after startup; `/api/dwm/exposure-queue?limit=3` returned live retained rows with `metadataOnly: true`; the public activity browser showed current retained activity. The public status monitor captured transient startup failures and requires a subsequent scheduled run to clear those current down checks.
- `b9202378`: deployed the DWM monitor fix to use the authenticated scraper queue as its canonical Latest Activity source. Rollback: `9cf9e596`.
- `8b573221`: deployed the default-tenant exposure candidate-index predicate fix. Rollback: `b9202378`.
- Live evidence after `8b573221`: repeated internal queue calls returned HTTP 200 in 27–40 ms; repeated public queue calls returned HTTP 200 in about 129 ms; the next monitor cycle reported Latest Activity `up` with 47 retained records; public browser activity showed `47/47 loaded`.
- Bounded governed canary evidence after `8b573221`: two approved RansomLook sources completed with `0` failed tasks and `38` retained exposure outputs; the public queue then showed `85` retained rows, a fresh collection check, and `metadataOnly: true` output. The live activity browser showed the expanded retained feed (`85` total, with the current page loading its first 50 rows).

## Approved production work

1. Prove two useful scheduled cycles for the implemented dark-web metadata source family.
2. Verify the compact Cases list/detail flow with an authenticated customer session.
3. Remove or implement fake customer-facing paths, then complete tenant/permission and performance cleanup.
