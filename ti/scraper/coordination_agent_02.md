Status: active_task_aa

## CURRENT ASSIGNMENT - READ FIRST

Task AA: Sub-Second Public Search Scheduling And Polling Contracts

Build the scheduler contract for responsive `/ti` search. Do not wait for another prompt. Deliver run attach/reuse, 3-second polling hints, duplicate public polling suppression, backpressure, abandoned-client cleanup, source activation fanout, no-result `Searching`, live discovery to capture task promotion, public-channel windows, restricted metadata holds, and worker headroom under the 96 GB target and 160 GB ceiling. Cover APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, ransomware/victim, CVE, malware/tool, country, and sector queries. Wire to `/v1/frontier/status`, `/v1/intel/search.scheduler`, `/v1/frontier/apply-plan`, `/v1/contracts`, Agent 07, Agent 09, and Agent 10. Verify scheduler/API/full tests, typecheck, route inventory, frontier apply-plan, and cutover rehearsal/plan.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AB: Durable Scheduler Backend, Worker Drain, And Fairness Under Load

After Task AA proof is complete, continue directly into Task AB. Build a production scheduler backend contract that can move from in-memory to Postgres/Redis/NATS without changing public API semantics. Cover leases, acknowledgements, retries, dead letters, cursor replay, abandoned public pollers, active-run reuse, per-tenant budgets, per-source fairness, queue partitions, worker drain, emergency brake, and 24h soak telemetry. Wire to `/v1/frontier/status`, `/v1/frontier/apply-plan`, `/v1/intel/search.scheduler`, Agent 01 activation waves, Agent 06 replay, Agent 09 delta API, and Agent 10 SLO board.

Task AC: Continuous Collection Cadence And Freshness SLO Engine

Build cadence planning for actor/CVE/ransomware/country/sector watches: frequency decisions from source freshness, source reliability, topic volatility, customer watchlists, queue pressure, and evidence yield. Include dry-run changes, rollback, stale-source pause, noisy-source throttling, and fairness proofs. Verify scheduler tests, soak scripts, and route contracts.

# Agent 02 Summary

- Added scheduler production adapter telemetry for embedded memory plus future Postgres, Redis, and NATS scheduler implementations.
- Added scheduler canary execution control-plane DTOs for start, pause, drain, rollback, and expand across source rollout, public-channel promotion, restricted metadata drills, evidence replay, graph export, and public `/ti` polling.
- Wired `productionAdapterTelemetry` and `canaryControlPlane` into `/v1/frontier/status`, `/v1/frontier/apply-plan`, `/v1/intel/search.scheduler`, and `/v1/contracts` with dry-run queue deltas, worker partition effects, cursor/replay guarantees, rollback steps, warning codes, memory/queue headroom, and Agent 10 release fields.
- Restored hybrid frontier classifier behavior for APT29 fanout by preserving CVE/APT markers, avoiding destination confidence without destination evidence, and aligning precision/balanced enqueue thresholds with scheduler workload admission.
- Verified `bun test`, `bun run check`, `bun run check:route-inventory`, `bun run check:frontier-apply-plan`, `bun run rehearse:cutover examples/cutover-rehearsal-pass.json`, and `bun run plan:cutover examples/cutover-rehearsal-pass.json` are green.

Superseded by active Task AA below; do not request another assignment until Task AA proof is complete.

## Main-Agent Task 2026-05-24 AA: Sub-Second Public Search Scheduling And Polling Contracts

Own scheduler behavior for responsive public `/ti` searches. The product requirement is that an actor query feels alive immediately: first response may be compact, but a live run must be attached/reused, polling cadence should be seconds not minutes, and duplicate public polling must not flood the queue.

Deliver scheduler contracts and fixtures for APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, ransomware/victim, CVE, malware/tool, country, and sector queries. Cover run reuse, 3-second public polling hints, backpressure, abandoned clients, source activation fanout, no-result searching state, live discovery to capture task promotion, public-channel windows, restricted metadata holds, and worker headroom under 96 GB/160 GB limits. Expose compact fields through `/v1/frontier/status`, `/v1/intel/search.scheduler`, `/v1/frontier/apply-plan`, `/v1/contracts`, Agent 07 answer states, Agent 09 public wrapper DTO, and Agent 10 RC board. Verify scheduler/API/full tests, typecheck, route inventory, frontier apply-plan proof, cutover rehearsal/plan, and no queue mutation from dry-run controls.
