Status: active_program_followon

# Agent 02 Coordination

Read `coordination_product_focus.md` first. Continue current scheduler work only where it supports daily 20-group Actor runs, source/dark-metadata scale ladder scheduling, live freshness, and marketplace row quality. Queue theory without buyer-visible output is lower priority.

## CONTINUATION DIRECTIVE

DO NOT STOP AFTER ONE PATCH. Finish Program BA/BA.5-BA.7, then continue into Agent 02 Program BB/BC/BD in `coordination_program_backlog.md` without waiting for a new prompt. Only write `ready_for_next_task` if the scheduler ownership lane is genuinely exhausted or blocked by missing cross-agent code.

Side-tool support priority:
- Support Agent 05 dark-web metadata index with periodic refresh scheduling for roughly 60k metadata records, safe liveness batches, queue partitions, retry/dead-letter behavior, and resource budgets.
- Support Agent 01 source atlas with first-100/first-1000 source import canary scheduling, source discovery cadence, and no-auto-activation controls.
- These are data enrichment helpers for the main CTI scraper, not separate products.

## Progress - 2026-06-20 17:30 CEST

- Completed the daily Apify Actor run-plan slice for revenue-focused freshness: `scheduler.dailyActorRunPlan` now exposes the 20-query default watchlist, Actor id/build, daily timing, 3-second polling, duplicate-run reuse, useful/fresh row targets, stale-only suppression, and cost-per-useful-row economics.
- Added source-tier sweep cadence for the first 100 safe public sources, first 1,000 safe public sources, and first 4,000 approved dark-metadata records with reserved scheduler slots, max daily task budgets, useful-row lift expectations, and advance/hold criteria.
- Wired the run plan through frontier status/search/run scheduler DTOs and `/v1/contracts` so UI/API clients can show queue, freshness, stale suppression, source ladder, dark-metadata cadence, and paid-row economics instead of a static searching state.
- Repaired shared Program BD quality-pack drift by wiring the existing paid-row quality gate and removing a duplicate helper so the repo compiles cleanly.
- Green: `bun run check`, `bun test src/tests/schedulerProduction.test.ts`, `bun test src/tests/pipeline.test.ts -t "Program BD"`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test` (527 pass).
- Next: continue the Agent 02 lane by turning the daily run plan into stronger execution-facing scheduler behavior for real source sweeps, freshness SLOs, run reuse, queue fairness, and worker/drain readiness.

## Progress - 2026-06-20 16:14 CEST

- Completed the next Apify monitor source-coverage handoff slice for `apify/public-threat-actor-monitor`.
- Actor dataset rows now consume `actorSourceCoverageMatrix` product fields when available and expose `freshnessExpectation`, `highestValueMissingFamily`, `nextBestSourceAction`, `buyerCaveat`, and `expectedTimeToUsefulSignal` with safe scheduler/source-gap fallbacks.
- Updated the APT42 fixture, smoke test, dataset schema, publication gate, launch checklist, and changelog so the marketplace output explains what source family is missing, what to do next, and how quickly useful signal is expected.
- Helped clear shared graph DTO drift by ensuring graph query/workspace/runtime/STIX response shapes carry the required actor comparison notebook.
- Green: `bun run check`, full `bun test`, `bun run check:apify-threat-actor-monitor`, `bun run check:apify-publication`, and `bun run smoke:apify-threat-actor-monitor`.
- Next: keep improving live data freshness/source coverage feeding the Apify monitor, especially real source-family coverage actions and scheduled-run freshness quality.

## Progress - 2026-06-20 15:48 CEST

- Completed the next Apify monitor listing-readiness slice by strengthening `check:publication` from text checks into schema and fixture contract validation.
- The publication gate now requires scheduler polling, retry/backoff, duplicate-run reuse, source coverage state/gaps, coverage-gap actions, review reasons, analysis facets, safe output constants, and a fixture that exercises active-run reuse plus public-channel coverage gaps.
- Updated the launch checklist and changelog so scheduler/source-coverage visibility is treated as a hard launch gate.
- Helped clear shared type/test drift in live capture and graph product packet helpers so root gates stay green.
- Green: `bun run check`, full `bun test`, `bun run check:apify-threat-actor-monitor`, `bun run check:apify-publication`, `bun run smoke:apify-threat-actor-monitor`, and focused `bun test src/tests/graphViews.test.ts`.
- Next: keep improving live data freshness/source coverage feeding the Apify monitor, especially scheduler-visible source-gap handoffs and freshness cadence quality.

## Progress - 2026-06-20 16:30 CEST

- Completed the current revenue-wrapper scheduler visibility task for `apify/public-threat-actor-monitor`.
- Finished the partial Actor coverage-quality work by adding coverage-gap rows, source-family arrays, missing-family arrays, coverage status, collection priority, recommended collection actions, and required review reasons to the safe metadata dataset contract.
- Wired public API scheduler/source-coverage state into every Actor dataset row: scheduler state/decision, next poll, retry-after, duplicate-run reuse, active-run attachment, queued task count, deferred workloads, scheduler badges, source coverage state, source coverage gaps, and a polling hint.
- Updated the fixture, smoke assertions, Apify dataset/input schemas, README, and changelog so the marketplace output shows queue/freshness/backoff/source-gap state instead of static intelligence rows only.
- Green: `bun run check`, `bun run check:apify-threat-actor-monitor`, `bun run smoke:apify-threat-actor-monitor`, `bun test src/tests/sourceSeeds.test.ts`, and `bun test src/tests/graphViews.test.ts`.
- Next: keep improving the Apify monitor and live data freshness/source coverage feeding it.

## Progress - 2026-05-24 23:16 CEST

- Completed current Task Z / final RC scheduler canary-control-plane validation: `scheduler.canaryControlPlane` is route-visible on frontier status, scheduler DTOs, apply-plan previews, and `/v1/contracts`.
- Confirmed the scheduler surface now reports dry-run canary controls, queue/headroom, memory target/ceiling, worker partition effects, warning codes, rollback steps, cursor replay guarantees, duplicate public polling/run reuse, and Agent 10 release decisions.
- Restored shared source-atlas helper block after cross-agent truncation so source atlas, export manifests, reliability economics, portfolio migration, SLO burn-rate, tenant activation, and source import canary routes load again.
- Helped finish Agent 08 graph/STIX DTO drift by ensuring every STIX readiness path carries the required `releaseCandidate` gate.
- Green: `bun run check`, focused scheduler/API tests, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test` (511 pass).
- Next: continue the longer scheduler vision from the backlog rather than stopping here, with priority on turning the dry-run canary/control-plane semantics into concrete worker-loop execution paths, Postgres-backed queue migration steps, and UI-visible queue/fairness/freshness behavior.

## Progress - 2026-05-24 21:58 CEST

- Completed Program BA.7 scheduler freshness SLO dashboard for route-visible high-priority actor freshness and workload fairness.
- Added `scheduler.freshnessSloDashboard` with APT29, APT42, Sandworm, Volt Typhoon, Lazarus, LockBit, Akira, and Scattered Spider freshness targets, observed staleness, queue age, retry debt, dead-letter pressure, duplicate-run reuse, 3-second polling protection, priority aging, and fair-share lane state.
- Exposed the dashboard through live scheduler DTOs and `/v1/contracts.semantics.schedulerFreshnessSloDashboard`; updated scheduler/API tests and operations docs so the UI/API can show queue, aging, retry, and budget state instead of a flat "searching" spinner.
- Helped clear cross-agent type drift in the darkweb index, graph STIX readiness, live-search release hardening, and contract no-leak key sanitization so the shared Bun gates stay green.
- Green: `bun run check`, focused scheduler/API tests, `bun run check:route-inventory`, `bun run check:contract-index`, and `bun run check:api-regression`.
- Next: continue Program BD interactive search freshness scheduler and then Program BB/BC follow-ons from `coordination_program_backlog.md`.

## Progress - 2026-05-24 21:48 CEST

- Continued Program BA.6 / Program BC with `scheduler.workerLeaseSoakHarness`, a route-visible dry-run 10k multi-worker lease replay fixture.
- Covered APT29 actor bursts, public-channel fanout, restricted metadata holds, evidence replay, graph export, source outage waves, parser failure storms, and low-value sweep pressure.
- Added workload slices, worker partitions, exclusive lease semantics, heartbeat expiry recovery, deterministic retry/backoff, request deadlines, dead-letter isolation, per-source concurrency guardrails, priority aging, workload fairness proof, pressure fixtures, route contracts, and release-gate proof commands.
- Exposed the harness through live scheduler DTOs and `/v1/contracts.semantics.schedulerWorkerLeaseSoakHarness`; updated operations docs plus scheduler/API tests.
- Green: `bun run check`, focused scheduler/API/source tests, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:api-regression`, and full `bun test` (498 pass).
- Next: finish the broader verification gate set, then continue BA.7 scheduler SLO dashboard and Program BD interactive search freshness scheduler.

## Progress - 2026-05-24 21:12 CEST

- Completed Program BA.5 disabled-by-default Postgres scheduler queue adapter boundary.
- Added runtime flags for embedded vs. `postgres_scheduler_store`, Postgres enablement, DSN presence, shadow writes, and lease mode.
- Added `scheduler.postgresQueueAdapter` with backend selection, fail-closed safety, operation contracts, prepared statement names, route contracts, and release gates.
- Added a fail-closed `PostgresSchedulerQueueRepository` shell plus repository factory that keeps embedded memory authoritative unless Postgres is deliberately enabled with DSN/executor readiness.
- Updated `/v1/contracts`, operations docs, and scheduler/API/config tests for the adapter boundary.
- Helped clear unrelated dirty compile blockers in analyst feedback active-learning helpers, public-signal delta types, graph Neo4j projection typing, and live-search soak summary fields.
- Green: `bun run check`, `bun test`, `bun run check:route-inventory`, `bun run check:contract-index`, and `bun run check:api-regression`.
- Next: continue Program BA.6 multi-worker lease soak harness with 10k task replay, then BA.7 scheduler SLO dashboard.

## Progress - 2026-05-24 20:53 CEST

- Added `scheduler.persistenceReplayCutover` as the Program BA persistence/replay packet.
- Covered embedded-memory baseline, Postgres-first scheduler store contracts, Redis/NATS descriptors, restart fixtures, duplicate public run reuse, cursor replay, retry/dead-letter recovery, fairness budget snapshots, worker drain, emergency brake, and unknown actor honesty.
- Exposed the packet through frontier status/apply-plan, intel run scheduler DTOs, and `/v1/contracts` semantics.
- Updated operations docs with restart cutover and rollback procedure.
- Green: `bun run check`, focused scheduler/API tests, route inventory, contract index, and API regression.
- Next: continue Program BA.5 real Postgres queue adapter behind a disabled feature flag, then BA.6 multi-worker lease soak with 10k task replay.

## CURRENT ASSIGNMENT - READ FIRST

## Main Agent Update - 2026-06-20 17:05 CEST

The Actor is monetized in Apify with upcoming pay-per-event pricing, but revenue now depends on daily fresh runs that improve the dataset, not scheduler theory. Latest proof run: `iMQGeezZ8bx7WtlhQ`, published build `0.6.4`, 10 APT42 rows, 4s runtime, usage about `$0.001`; the dataset now exposes paid-row decisions, but still shows caveated rows, stale/held rows, weak victim extraction, and missing public-channel/dark metadata coverage. Your scheduler lane must now produce a daily default-watchlist run plan plus source-tier sweep cadence for 100 -> 1,000 -> 4,000 sources/metadata records, with cost per useful row, stale-row suppression, paid-row decision counts, and retries that make fresh live collection visible within seconds/minutes.

Continue durable queue work only where it directly supports those daily Actor runs, live source sweeps, run reuse, and freshness SLOs. When your patch is coherent, run focused tests, commit, push, and leave no hanging files.

Program BA: Durable Scheduler, Queue Backend, Replay, And Worker Orchestration.

This is a multi-week production lane. You own the scheduler until it can run real public actor searches, background source sweeps, evidence replays, restricted metadata holds, and graph/export work without losing state across restarts. Do not mark ready after adding readiness packets. Build the implementation path and proof harness.

Mission:
- Move the scheduler from embedded/demo semantics toward a durable production queue architecture.
- Preserve public `/ti` responsiveness: 3-second polling, stable run IDs, duplicate query reuse, honest `searching`/`partial`/`ready` states, and no default actor behavior.
- Enforce fairness across tenants, query classes, source families, restricted metadata, background sweeps, and interactive searches.

Phase 1: Durable Queue Contract And Migration
- Define Postgres-first queue tables/contracts for runs, tasks, leases, heartbeats, checkpoints, retry state, dead letters, cursor events, fairness budget snapshots, worker partitions, and emergency brake state.
- Keep Redis/NATS as future descriptors only unless the repo already has real dependencies.
- Add dry-run migration/cutover packets with rollback and replay checks.

Phase 2: Replay And Restart Semantics
- Implement route-visible restart rehearsal for queued, leased, heartbeat-expired, retrying, dead-lettered, restricted-hold, and completed runs.
- Duplicate public actor searches must reattach by tenant/query/reuse key, preserve cursors, and avoid re-enqueue storms.
- Add cursor replay guarantees for answer deltas, evidence deltas, graph holds, and source-gap changes.

Phase 3: Worker Orchestration
- Add worker pool planning for RSS/static, dynamic browser disabled pool, PDF/report, public channel, restricted metadata-only, evidence replay, graph export, and health probes.
- Include per-source concurrency, per-tenant budgets, priority aging, retry-after, queue pressure behavior, dead-letter isolation, worker drain, and controlled shutdown.

Phase 4: Load And Abuse Proof
- Add simulation fixtures for 10k queued tasks, bursty APT searches, low-value sweeps, source outage waves, parser failure storms, and capacity pressure.
- Route-visible telemetry must be compact and useful for Agent 09/API and Agent 10/release board.

Proof before changing status:
- `bun run check`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run check:api-regression`
- focused scheduler/API tests for restart replay, duplicate polling, worker leases, dead letters, fairness budgets, and emergency brake
- update operations docs with cutover, rollback, and drain procedures

Definition of done:
- The scheduler can explain exactly what will happen after a process restart, how public polling resumes, how workers are leased/drained, and why no tenant/query/source family starves another.
- Do not set `ready_for_next_task` until the durable queue program is route-visible, tested, documented, and integrated with Agents 01, 06, 09, and 10.

If you finish early, continue immediately with:
- Program BA.5: disabled-by-default real Postgres queue adapter implementation.
- Program BA.6: multi-worker lease soak harness with 10k task replay.
- Program BA.7: scheduler SLO dashboard for high-priority actor freshness.

Standing expansion rule:
- After Program BA and BA.5-BA.7, continue into `coordination_program_backlog.md` Agent 02 Program BB, then BC, then BD without waiting for a new prompt.
- If public search responsiveness, duplicate run reuse, or worker lease semantics drift, treat that as higher priority than new surfaces.
- Do not mark ready unless the durable scheduler lane is genuinely exhausted or blocked by missing cross-agent code.
