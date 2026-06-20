Status: active_program_bi_source_reliability_economics

# Agent 01 Coordination

## Current Assignment - Program BI: Source Reliability Economics And Activation Planning

You are no longer waiting for a task. Continue the source-governance lane until source onboarding can prioritize thousands of candidate public TI sources by value, cost, legality, freshness, and product impact.

Mission:
- Turn the source atlas from approval packets into a source portfolio optimizer for the Apify Actor, `/ti`, and thesis evaluation.
- Score sources by real product value, not just presence in a list: unique evidence yield, freshness, actor coverage, parser stability, legal/robots state, duplicate rate, source-family diversity, and downstream answer improvement.
- Produce activation plans that can safely feed Agent 02 scheduler, Agent 03 adapters, Agent 06 evidence storage, Agent 07 quality gates, Agent 09 API/frontend, and Agent 10 ops budgets.

Build:
- Add source reliability/economics DTOs for first-50, first-500, and first-5000 public-source rollout scenarios.
- Include per-source and per-source-family metrics: expected actors covered, expected query classes, unique evidence yield, duplicate risk, parser repair dependency, language/region coverage, legal status, crawl frequency, estimated storage cost, expected API/Actor usefulness, and rollback state.
- Add marketplace-focused score breakdowns for actor profile value, ransomware victim-claim value, CVE/advisory value, public-channel value, dark-metadata-corroboration value, and enterprise STIX/export value.
- Add degradation/burn-rate queues for stale, noisy, duplicate-heavy, legally blocked, broken parser, low-yield, or high-cost sources.
- Keep all outputs dry-run and source-id/hash oriented; no source activation, crawling, credential use, private/invite source handling, CAPTCHA/auth bypass, raw unsafe URLs, payload downloads, or leaked-data redistribution.

Proof before status change:
- `bun run check`
- `bun test src/tests/sourceSeeds.test.ts src/tests/api.test.ts src/tests/productionAdapterRuntime.test.ts`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run check:api-regression`
- update `docs/source_registry.md`

If this phase completes, continue immediately into Program BJ: tenant-aware source policy overlays and paid-product source pack segmentation.

## Previous Completed Slice

- Added `/v1/sources/atlas.lifecycleReview`: dry-run source lifecycle review packets for degradation, quarantine, parser repair, legal review, duplicate retirement, and descriptor-only holds.
- Lifecycle review rows stay source-id/hash only, include scheduler dry-run impact, rollback notes, replacement candidates, no-mutation boundaries, and Agent 02/03/06/09/10 handoff fields.
- Updated shared coordination and source registry docs for the lifecycle review contract before changing the shared `/v1/sources/atlas` response.
- Repaired verification drift encountered in graph product packets: unknown actors no longer inherit unrelated graph evidence, STIX readiness gets an actor-focused product packet when actor nodes exist, and graph test fixtures match current provenance contracts.
- Proof is green: `bun run check`, `bun test src/tests/sourceSeeds.test.ts src/tests/api.test.ts`, `bun test src/tests/graphViews.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, and full `bun test` (526 pass).

Historical note: Agent 01 previously requested the next explicit source-governance task. The active Program BI assignment above supersedes that request.
