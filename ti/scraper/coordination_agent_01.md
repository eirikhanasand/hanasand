Status: active_program_bh_source_atlas_to_production_ingestion

## Current Assignment - Program BH: Source Atlas To Production Ingestion

You are no longer waiting for a task. Continue the source-atlas/source-registry lane until the product can onboard and govern large source packs that actually feed the public TI product and Apify Actor.

Mission:
- Turn `/v1/sources/atlas` from a dry-run source discovery tool into a production-ready source onboarding workbench with explicit approval, canary, rollback, and scheduler handoff semantics.
- Keep every operation safe and auditable: no silent activation, no private/auth/CAPTCHA sources, no credentialed fetching, no payload downloads, no mutation unless the route explicitly says dry-run apply.

Build:
- Add curated source pack contracts for at least: APT/vendor blogs, government/CERT advisories, vulnerability intelligence, malware research, ransomware reporting, industrial/critical-infrastructure sources, public-channel candidates, dark-web metadata directories, and regional news.
- Each source pack must include source type, trust score, legal/robots notes, parser profile, expected cadence, evidence yield estimate, duplicate risk, freshness SLO, approval packet, rollback packet, and scheduler budget impact.
- Add operator review/export surfaces so Agent 09 can wire product UI/API without reading internal helpers.
- Add Postgres-backed audit persistence readiness for source plans, approval decisions, canary runs, parser failures, source retirements, and claim-ledger handoffs. If live DB wiring is too large, add disabled-by-default adapters with schema fixtures and route-visible fail-closed state.
- Add source retirement/degradation workflows for stale, noisy, broken, duplicate-heavy, legally blocked, or unsafe sources.
- Coordinate field names with Agent 02 scheduler budgets, Agent 03 adapters, Agent 04 public-channel gaps, Agent 06 evidence, Agent 09 API/UI, and Agent 10 SLOs.

Proof before status change:
- `bun run check`
- `bun test src/tests/sourceSeeds.test.ts src/tests/api.test.ts`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- focused tests for source pack export, approval packet, canary handoff, rollback, audit persistence readiness, and no-mutation/no-crawl boundaries
- docs update in `docs/source_registry.md` and any operations section touched

Do not mark ready after a single patch. If this phase completes, continue immediately into Program BI: large-scale source scoring and reliability economics for thousands of public TI sources.

# Agent 01 Coordination

- Added `/v1/sources/atlas` registry activation handoff previews with dry-run source-record candidates, canary source IDs, governance prerequisites, scheduler estimates, rollback packet IDs, downstream handoffs, and forbidden operations.
- Repaired source portfolio helper drift for reliability economics, migration readiness, SLO burn-rate remediation, tenant activation approval packets, and source import canary packets while preserving no-mutation/no-crawl/no-silent-activation boundaries.
- Restored related contract drift needed for shared proof: graph incident-claim workspaces, `/v1/contracts.routeInventory.activeRoutes`, product SLO route typing, and public advisory safe-delta typing.
- Proof is green: `bun run check`, focused source/API/graph/public-advisory tests, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test` (519 pass).

Next Agent 01 continuation:
- Ready for the next Agent 01 task.
- If no explicit task is assigned, continue the long-running source-atlas/source-registry vision: curated public source packs, operator review/export surfaces, registry/scheduler activation packet integration, and Postgres-backed audit persistence for source plans/runs/review/captures/claim ledger.
