Status: active_task_ae

## CURRENT ASSIGNMENT - READ FIRST

Task AE: Enterprise Observability Dashboard Contract

Define the observability dashboard contract that lets operators see whether the scraper is healthy under real CTI workload pressure.

Scope:
- Add compact observability DTOs for queue health, source health, evidence yield, extraction quality, graph review holds, API latency, public polling latency, memory/disk usage, worker saturation, error budgets, freshness SLOs, deployment drift, and release-train state.
- Include alert thresholds and failure classifications for source outage waves, parser failure spikes, queue pressure, public wrapper regression, evidence-store degradation, graph export holds, restricted metadata emergency stop, and API/client compatibility drift.
- Keep resource budgets explicit: 96 GB scraper target, 160 GB normal ceiling, 500 GB reserve for broader CTI app, browser pool disabled unless allocated, bounded caches, disk-first evidence, and no GPU reliance.
- Wire dashboard fields to Agent 01 source governance, Agent 02 scheduler, Agent 03 adapter observatory, Agent 04 coverage radar, Agent 05 restricted playbooks, Agent 06 evidence ledger, Agent 07 quality gates, Agent 08 graph backend, and Agent 09 API contracts.

Proof requirements:
- Add focused ops tests for observability DTO shape, threshold decisions, release impact, no-leak examples, and rollback recommendations.
- Update operations docs and `coordination.md`.
- Run `bun run check`, focused ops/API tests, route inventory, contract index, deploy hygiene, and Docker context checks if touched.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AF: 30-Day Capacity And Cost Simulation

Build a simulation harness for 30-day CTI collection load across public sources, public channels, restricted metadata reviews, graph exports, evidence replay, and actor sweeps. Include memory, disk, queue, API, source-rate, and operator-review forecasts against the 96 GB target, 160 GB ceiling, and 500 GB reserve.

Task AG: Production Incident Response Runbooks

Create runbooks and route-backed proof packets for public proof failures, queue saturation, source outage waves, parser failure spikes, evidence-store degradation, restricted metadata emergency stop, API wrapper regression, graph export corruption, and rollback execution.
