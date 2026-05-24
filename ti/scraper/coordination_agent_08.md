Status: ready_for_new_task

# Agent 08 Coordination

## Continuation Directive

Continue the graph/STIX/TAXII ownership lane beyond a single prompt. When one program is complete, summarize it briefly here and move to the next Agent 08 program in `coordination_program_backlog.md` unless the lane is genuinely blocked.

Keep all graph relationships replayable to evidence, claim ledger state, review state, confidence, freshness, and export eligibility. Weak discovery, restricted metadata, stale, contradicted, missing-ledger, public-channel-only, and budget-bounded edges remain held until reviewed and provenance-backed.

## Completed

- Completed Task AE: production graph investigation workspace and relationship confidence ledger.
- Added `graph.investigationWorkspace` with node groups, relationship confidence ledger rows, evidence/ledger/capture/source provenance IDs, contradiction/stale/review-hold/export blocker state, allowed analyst actions, 3-second cursor polling, metadata-only restricted handling, and TAXII descriptor-only boundaries.
- Completed Program BA graph backend, relationship semantics, STIX/TAXII export, and investigation workspace hardening.
- Added graph backend migration certification, ATT&CK campaign freshness SLOs, Neo4j migration adapter benchmark, graph delta client contract, query cost controls, drift monitor, review persistence, and reviewed export subset governance.
- Completed Program BB Neo4j/Postgres graph backend adapter contract.
- Added route-visible `runtime.backendAdapterCutover` / `GraphBackendAdapterCutoverContractDto` with Postgres as the primary graph backend, Neo4j as contract-only/no-live-driver, backend-neutral operation mappings, migration proof, cursor replay, review-hold parity, performance SLOs, fallback behavior, no-leak guarantees, and Agent 06/07/09/10 handoffs.
- Updated `docs/export/relationship_model.md` with the Program BB adapter-cutover boundary.
- Completed Program BC ATT&CK Campaign Freshness SLOs.
- Added deprecated/revoked ATT&CK technique lifecycle tracking, alias drift state, contradiction state, export eligibility decisions, summary counts, and held export blockers to `GraphAttackCampaignFreshnessSloDto`.
- Kept proof green: `bun run check`, full `bun test`, focused graph/API/source tests, `bun run check:graph-review-mounted`, `bun run check:ti-release-candidate`, `bun run check:route-inventory`, and `bun run check:contract-index`.
- Completed Program BD TAXII Descriptor And STIX Bundle Governance.
- Added `GraphTaxiiDescriptorStixBundleGovernanceDto` across graph runtime, investigation workspace, and STIX readiness with reviewed STIX subset governance, descriptor-only TAXII collection planning, future `TaxiiExportProvider` request/page contract, no mounted server routes, no server claim, and no-leak metadata-only safety.
- Repaired adjacent cross-agent green-build drift in darkweb index contract helpers, source-atlas duplicate handoff helpers, public coverage freshness helper naming, and restricted emergency-stop soak decision semantics.
- Updated `docs/export/relationship_model.md` with the Program BD TAXII/STIX governance boundary.

## Active Next Work

- Request a new Agent 08 graph/STIX/TAXII task. The explicit Agent 08 backlog currently ends at Program BD, so continue this long-running lane when a new task appears in `coordination_program_backlog.md` or `coordination.md`.
