# Hanasand thesis status — clean production line

This is the single historical status record for the Masters thesis and product. It records deployed behavior, not agent activity or candidate counts.

## Current state — 2026-08-10

- Production is deployed from private canonical `main` at `9d8fe5a1`. The API, frontend, and scraper are healthy after the scraper’s PostgreSQL hydration/startup window; the frontend/API/scraper build completed its production test, lint, TypeScript, and Next build gates.
- The live exposure queue returns HTTP 200 with retained customer-visible rows (`85` total in the verified probe); the public endpoint completed in about 175 ms and returned real RansomLook items. During scraper startup the same route returned an explicit HTTP 503, not an empty success.
- The Cases list is now compact: case, severity/status, owner, and updated time. Case detail retains real assignment, status, evidence, timeline, and delivery actions while collapsing secondary report controls. Authenticated browser proof still requires a real customer session; the unauthenticated route correctly redirects to login.
- A governed public-metadata source family is active with three approved sources. The live source-operations snapshot records six successful scheduled checks for each RansomLook source, with RansomLook Recent producing 42 retained captures across three useful checks and RansomLook RSS producing 3 retained captures across two useful checks. The ransomware.live JSON source is healthy but has not produced retained captures.
- Authenticated customer proof uses organization `f74e8270-a189-4236-ad4b-f4b1320c71b6`: one real watch term matched a live RansomLook alert, handed off two retained evidence rows into case `case_dd24806f79f1e5cc`, and the browser recorded assignment, review, escalation, and a customer note. The compact Cases list search and status filter were verified live.
- The live status contract now distinguishes “collector healthy; no new customer claims within the freshness window” from an unavailable collector. On the final post-deploy check, overall status was `up`, Latest Activity was `up` with that explicit no-new-claims message, Source Operations was `up`, and the scheduler reported `operational` with a completed canary run.
- The stale review queue was measured and corrected: 5,010 obsolete active automatic-review tasks were quarantined without deleting history or touching customer cases, evidence, alerts, or sources. The live monitor then reported collection processing current, with zero captured sources awaiting optional automatic review.

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
- `b0003510`: deployed the public source-status credibility fix; rollback: `81a6dbe6`.
- Live evidence after `b0003510`: frontend build, tests, TypeScript, and production build passed; the frontend container restarted healthy; `/api/status` reported Source Operations `up` with “Source collection is responding; freshness is being monitored”; Latest Activity reported 85 retained records.
- `fefd8f96`: deployed retained-capture fallback in the DWM workflow and real matched-alert case handoff/review panel. Rollback: `b0003510`.
- Live evidence after `fefd8f96`: Actions showed one customer term, `94/1538` sources, `17818` retained captures, one matched alert, and a real Open case action; the case detail showed two RansomLook evidence rows and live assignment/status/note events. Current `/status` reports Source Operations and Latest Activity as normal after scraper recovery.
- `aa1b1aaf`: deployed truthful collector/no-new-claims status handling, bounded collection-run reporting, and rerouted live TI audit/domain links away from the obsolete workbench handoff. Rollback: `fefd8f96`.
- Live evidence after `aa1b1aaf`: production HEAD matched `aa1b1aaf`; API and scraper were healthy, scheduler status was `operational`, and `/api/status` was `up` with Latest Activity explicitly reporting a healthy collector and no new claims rather than falsely reporting service failure.
- `b83123df`: deployed the restore-verifier fix that skips the already-applied high-volume maintenance migration during isolated validation. Rollback: `aa1b1aaf`.
- Restore evidence after `b83123df`: receipt `RESTORE-RECEIPT-20260810T054453Z-3401723` reports `status=succeeded`, matching database inventory hashes, `content_hashes=matched`, `evidence_hashes=matched`, `evidence_object_reconciliation=passed`, `application_read=passed`, 100 tables and 7,924,605 rows, with the temporary database and evidence volume removed.
- `9d8fe5a1`: deployed truthful processing-backlog messaging after quarantining obsolete review tasks. Rollback: `b83123df`.
- Live evidence after `9d8fe5a1`: `/api/status` was `up`; Processing Backlog reported “Collection processing is current; automatic review is disabled”; Public Search, Source Operations, and Latest Activity were also `up`. API, scraper, frontend, and website containers were healthy.

## Approved production work

1. Continue customer-facing tenant/performance measurement on the live DWM/search/cases paths; do not spend agent time on reviews, handoffs, merge-gating, or portfolio work.
