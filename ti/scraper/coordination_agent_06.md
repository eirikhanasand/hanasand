Status: active_program_ba

# Agent 06 Coordination

## CONTINUATION DIRECTIVE

DO NOT STOP AFTER ONE PATCH. Finish Program BA/BA.5-BA.7, then continue into Agent 06 Program BB/BC/BD in `coordination_program_backlog.md` without waiting for a new prompt. Only write `ready_for_next_task` if the evidence ownership lane is genuinely exhausted or blocked by missing cross-agent code.

Side-tool support priority:
- Own the TI database/read-model/search-index contracts for Agent 05 dark-web metadata index and Agent 01 source atlas.
- Keep the dark-web index modular: separate tables/contracts/read models where possible, with safe references into evidence/graph/source registry.
- Add scale fixtures for 60k dark-web metadata records and 10k public source candidates.

## CURRENT ASSIGNMENT - READ FIRST

Program BA: Durable Evidence Store, Search Index, Replay, And Retention Enforcement.

Progress update 2026-05-24 20:51 CEST:
- Added route-visible evidence search consistency SLOs as `ti.evidence_search_consistency_slo.v1` on `/v1/evidence/cutover-report.searchConsistencySlo`.
- Checks deterministic search document IDs, tenant routing, replay IDs, citation spans, capture hashes, object manifest verification, cursor replay, custody readiness, retention runtime safety, vector hash-only input boundaries, graph/STIX review holds, and API answer refresh safety.
- Publishes initial partial/cursor/index/vector SLO budgets, deterministic estimates, dry-run repair packets, and Agent 02/07/08/09/10 handoffs without mutating storage or starting collection.
- Keeps restricted/leak material metadata-only: defensive metadata remains searchable, restricted documents are excluded from vector embedding, and this exclusion does not count as a release hold.
- Updated evidence storage docs, shared coordination rules, API cutover contracts, and storage/API tests. Also restored public-wrapper cutover route aliases on the contract DTO to keep integration proof green.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/api.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run measure:search-product`, and full `bun test` passed.

Progress update 2026-05-24 21:11 CEST:
- Continued Program BA.5 with route-visible object-store integrity repair as `ti.evidence_object_integrity_repair.v1` on `/v1/evidence/cutover-report.objectIntegrityRepair`.
- Composes search handoff, chain-of-custody, search consistency SLO, and backup integrity into a dry-run missing-object/hash-mismatch/orphan-lineage runbook with hashed object refs only.
- Reports expected/verified/missing/mismatched objects, object checks, legal-hold preservation, metadata-only/restricted capture counts, public-answer/index/graph/STIX impact, no-leak validation, and Agent 02/07/08/09/10 handoffs.
- Restricted/leak captures stay metadata-only while surfacing defensive metadata such as victim/company, claimed accounts, dataset size, actor statements, source hashes, timestamps, review state, and retention class. Raw bodies, object keys, unsafe URLs, credentials, restricted raw content, and actor-interaction material are not serialized.
- Fixed the storage fixture to include promoted incident provenance and cleaned duplicate active-learning helper drift in `src/pipeline/analystFeedback.ts` so TypeScript checks are green.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/api.test.ts -t evidence`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run measure:search-product`, and full `bun test` passed with 492 tests.
- Next: continue BA.6 OpenSearch/pgvector migration readiness and fixtures without waiting for a new prompt.

Progress update 2026-05-24 21:24 CEST:
- Continued Program BA.6 with route-visible OpenSearch/pgvector migration readiness as `ti.evidence_search_backend_migration_readiness.v1` on `/v1/evidence/cutover-report.searchBackendMigration`.
- Defines OpenSearch candidate index/read-write aliases, pgvector namespace/candidate table, Postgres cursor checkpoints, reindex checkpoints, deletion replay, legal-hold/redaction policy, fixture scenarios, and rollback actions without connecting to live services or mutating indexes.
- Restricted/leak metadata remains searchable as defensive metadata and is explicitly excluded from pgvector embedding. No raw bodies, object keys, unsafe URLs, credentials, restricted raw content, private material, or actor-interaction content are serialized.
- Added storage/API fixtures and evidence storage docs for clean cutover, missing object, hash mismatch, restricted metadata, legal hold, redaction/delete replay, and alias rollback.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/api.test.ts -t evidence`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run measure:search-product`, and full `bun test` passed with 493 tests.
- Next: continue BA.7 evidence replay benchmark for 1M capture metadata records.

Progress update 2026-05-24 21:32 CEST:
- Completed Program BA.7 with route-visible evidence replay benchmark as `ti.evidence_replay_benchmark.v1` on `/v1/evidence/cutover-report.replayBenchmark`.
- Models 1M capture metadata replay in deterministic 100x10k chunks with estimated source/extraction/claim/relationship/restricted-metadata rows, cursor checkpoint cadence, throughput budgets, p95 rebuild budgets, and public answer/search/graph/STIX rebuild states.
- Keeps restricted/leak material metadata-only: defensive victim/company/account-count/dataset-size/actor-statement metadata is searchable, restricted rows are excluded from embedding, and benchmark output never loads or serializes raw bodies, object keys, unsafe URLs, credentials, restricted raw content, or actor-interaction material.
- Added fixtures for one-million public metadata, 60k restricted metadata rows, 10k source candidates, missing-object holds, legal-hold deletion replay, cursor-gap resume, and graph/STIX rebuild.
- Added storage/API assertions, evidence storage docs, and coordination rules. Also repaired narrow parallel graph runtime/source-atlas drift needed to keep checks green.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/api.test.ts -t evidence`, `bun test src/tests/sourceSeeds.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run measure:search-product`, and full `bun test` passed with 498 tests.
- Program BB/BC/BD equivalents are now covered by BA.6 search backend migration readiness, BA.7 evidence replay benchmark, and BA.5 object integrity repair runtime. Continue evidence backbone work from the long-running mission rather than stopping after this prompt; next useful direction is production-backed read-model/search-index implementation behind disabled adapters, using the same no-leak metadata-only boundaries.

Progress update 2026-05-24 21:43 CEST:
- Continued the long-running evidence backbone with an implemented search read-model adapter boundary in `src/storage/evidenceSearchReadModel.ts`.
- Added an embedded queryable read model for safe `EvidenceSearchIndexHandoff` documents plus fail-closed disabled adapters for future Postgres read-model and OpenSearch/pgvector cutover.
- The adapter indexes safe summaries, replay IDs, citation counts, routing keys, retention class, and public embedding input hashes; restricted/leak metadata remains searchable for defensive facts but never gets an embedding hash.
- Retention deletion tombstones matching read-model rows while preserving legal-hold rows, and production backends do not write/search unless explicitly enabled.
- Added storage tests and evidence docs; also absorbed source-atlas table expansion in existing storage expectations and updated public-signal metadata marker expectations to the safe normalized taxonomy.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/api.test.ts -t evidence`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run measure:search-product`, focused public-signal loop proof, and full `bun test` passed with 506 tests.
- Product measurement remains green for empty/on-demand source-pack, captured evidence, and restricted metadata-only leak-claim scenarios: useful-answer rate 1.0 and expected fact recall 1.0, with restricted victim/company/account-count/dataset-size/timestamp/actor-demand metadata surfaced without raw leak material or embeddings.
- Continue the long-running evidence backbone lane with the next production evidence slice: route-visible read-model cutover wiring, Postgres/OpenSearch row-mapper fixtures, or replay-driven public answer/graph promotion from durable evidence.

Progress update 2026-05-24 21:58 CEST:
- Continued the long-running production evidence slice with durable read-model mapper fixtures in `src/storage/evidenceSearchReadModel.ts`.
- Added backend write sets for `ti.evidence_search_read_model_backend_write_set.v1`: Postgres document rows, OpenSearch-safe documents, pgvector candidate rows, and retention tombstone rows.
- Postgres rows round-trip safe search documents with replay metadata, citation spans, redaction state, retention class, and routing hints; OpenSearch docs expose only safe summaries/search text and hash-only embedding inputs; pgvector rows are emitted only for public embedding-eligible documents.
- Restricted/leak metadata remains searchable for defensive facts but is never embedded, never receives vector rows, and tombstone rows preserve replay/custody state without raw material.
- Updated storage tests and evidence docs. Also absorbed live parallel type drift in API/graph/ops surfaces while keeping no-leak boundaries intact.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/api.test.ts -t evidence`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run measure:search-product`, and full `bun test` passed with 510 tests.
- Product measurement remains green: empty/on-demand, captured evidence, and restricted metadata-only leak-claim scenarios all report useful-answer rate 1.0 and expected fact recall 1.0 with no cross-talk.
- Continue Agent 06 evidence backbone work next with route-visible read-model cutover status or replay-driven public answer/graph promotion from these durable rows.

You completed retention/search consistency pieces. Now own the complete evidence backbone. The product cannot become enterprise-grade until raw captures, extracted text, claim ledgers, object refs, indexes, graph relationships, and public answers all replay from durable, auditable evidence.

Mission:
- Turn evidence handling into a durable, replayable, retention-aware subsystem that supports production search, graph, API answers, and analyst review.
- Keep raw evidence separate from extracted intelligence. Restricted material remains metadata-only and no-leak.

Phase 1: Evidence Storage Contracts And Cutover
- Define/extend durable store contracts for raw captures, text projections, object manifests, content hashes, source metadata, extraction outputs, claim ledger, analyst snapshots, graph deltas, and API answer deltas.
- Model filesystem/object-store/Postgres boundaries and migration order. Avoid adding live external services unless already present; readiness packets are okay when real implementation is too large.

Phase 2: Search/Vector/OpenSearch Handoff
- Build backend-neutral search index handoff for full-text, semantic/vector, IOC/entity lookup, actor/victim/TTP lookup, freshness, and provenance filters.
- Restricted documents must not be embedded or exposed; only safe metadata/hash/provenance can be indexed.
- Add index replay, deletion, legal hold, redaction, and stale-extractor reprocessing semantics.

Phase 3: Evidence Replay And Public Answer Promotion
- Add replay pathways from captures to extracted entities, incidents, graph edges, STIX previews, and public answer readiness.
- Every promoted claim must answer: source, first seen, last seen, confidence, extraction version, evidence hash, retention state, review state, and what changed.

Phase 4: Retention/Legal Hold Enforcement
- Enforce retention expiry, legal hold override, redaction, object missing/hash mismatch, duplicate claim, low-confidence, and restricted hold across API/search/graph/STIX.
- Coordinate with Agent 02 restart replay and Agent 10 release gates.

Proof before changing status:
- `bun run check`
- focused storage/evidence/API/graph tests
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run measure:search-product` if available
- docs update for evidence cutover, replay, retention, and index boundaries

Definition of done:
- The scraper can explain, replay, search, redact, and retire evidence without losing provenance or leaking restricted material.
- Do not mark ready until the evidence backbone is route-visible, tested, documented, and integrated with Agents 02, 05, 07, 08, 09, and 10.

If you finish early, continue immediately with:
- Program BA.5: object-store integrity repair and missing-object runbook.
- Program BA.6: OpenSearch/pgvector migration readiness and test fixtures.
- Program BA.7: evidence replay benchmark for 1M capture metadata records.

Standing expansion rule:
- After Program BA and BA.5-BA.7, continue into `coordination_program_backlog.md` Agent 06 Program BB, then BC, then BD without waiting for a new prompt.
- If provenance, replay, retention, or redaction is incomplete, prioritize that over new search/index surfaces.
- Do not mark ready unless the evidence backbone lane is genuinely exhausted or blocked by missing cross-agent code.
