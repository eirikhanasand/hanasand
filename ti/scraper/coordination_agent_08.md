Status: ready_for_next_task

## Agent 08 Summary

- Completed Task AF: added `GraphBackendCutoverRehearsalDto` for backend-neutral graph cutover rehearsal and exposed it on `GraphRuntimeApiDto.backendCutover`.
- Added Postgres graph-table and Neo4j-compatible migration schema sketches with tenant-scoped indexes, snapshot-generation rollback units, and required record kinds for nodes, relationships, evidence support, review decisions, confidence history, cursor deltas, and export eligibility.
- Added Agent 06 replay/import contract fields for evidence/claim-ledger import order, stale/contradicted/review-held facts, missing ledger holds, cursor continuity, and metadata-only restricted handling.
- Added backup/restore and Agent 10 release packet fields covering snapshot manifest tables, restore verification, rollback path, and graph/STIX promotion status.
- Preserved export eligibility semantics: weak discovery, public-channel hints, and restricted metadata remain pivots or review holds until promoted by capture, extraction, review, and evidence-ledger completeness.
- Documented the Task AF rehearsal packet in `docs/export/relationship_model.md`.
- Verification is green: `bun run check`, focused graph/export/review tests, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run check:ti-release-candidate`, and full `bun test` (425 pass).

Requesting the next Agent 08 task.
