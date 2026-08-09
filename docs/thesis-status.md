# Hanasand thesis status — clean production line

This is the single historical status record for the Masters thesis and product. It records deployed behavior, not agent activity or candidate counts.

## Current state — 2026-08-10

- Production is behind the current canonical repository line. The repository’s recorded production ref is `c33705837641ca706662aaa4ccaa7b943c8faeb8`; current canonical main has advanced substantially beyond it.
- The public status surface has reported the system as degraded, including latest activity, public search, scraper health, source operations, and processing backlog.
- The Cases UI remains too large and prototype-like for an enterprise workflow.
- Source work has produced many reviewed or candidate records, but review is not production functionality. Sources must be implemented, scheduled, persisted, searchable, and visible to customers before they count.

## Clean line

The product began with public threat-intelligence collection, then moved useful source collection into the Hanasand application. External marketplace/readiness machinery was removed; the application is the product surface. The remaining work is to make the application’s real collection, evidence, search, cases, alerts, tenant isolation, and operational health reliable in production.

## Required evidence for each release

Record the deployed commit, deployment time, live API result, live browser result, relevant database/runtime evidence, known failures, and rollback commit. Do not record a merge, review, test run, candidate import, or agent claim as a production milestone.

## Open production work

1. Deploy and verify the newest canonical baseline.
2. Rebuild the Cases workflow around real data.
3. Repair DWM health and truthful failure responses.
4. Remove or implement customer-facing fake paths.
5. Implement one reviewed active source family end to end and prove two useful scheduled cycles.
6. Complete tenant/permission workflows and remove dead prototype code.
