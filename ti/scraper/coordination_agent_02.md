Status: active_program_ba

# Agent 02 Coordination

## CONTINUATION DIRECTIVE

DO NOT STOP AFTER ONE PATCH. Finish Program BA/BA.5-BA.7, then continue into Agent 02 Program BB/BC/BD in `coordination_program_backlog.md` without waiting for a new prompt. Only write `ready_for_next_task` if the scheduler ownership lane is genuinely exhausted or blocked by missing cross-agent code.

Side-tool support priority:
- Support Agent 05 dark-web metadata index with periodic refresh scheduling for roughly 60k metadata records, safe liveness batches, queue partitions, retry/dead-letter behavior, and resource budgets.
- Support Agent 01 source atlas with first-100/first-1000 source import canary scheduling, source discovery cadence, and no-auto-activation controls.
- These are data enrichment helpers for the main CTI scraper, not separate products.

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
