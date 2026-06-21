Status: active_program_ba

# Agent 06 Coordination

Read `coordination_product_focus.md` first. Continue current evidence/read-model work only where it makes real source and dark-metadata rows searchable, safe, and useful for Apify/public API answers. Defer deeper export/storage theory until live data quality is improving.

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

Progress update 2026-05-24 23:11 CEST:
- Continued the long-running evidence backbone with route-visible read-model cutover status on `/v1/evidence/cutover-report.readModelCutover` as `ti.evidence_search_read_model_cutover.v1`.
- The packet reports embedded replay readiness, fail-closed Postgres/OpenSearch/pgvector adapter state, backend write-set counts, replay/tombstone/legal-hold/stale-extractor requirements, and safe-output guarantees for production read-model promotion.
- Restricted/leak metadata remains searchable for defensive victim/company/account-count/dataset-size/timestamp/actor-demand facts, but it is never embedded, never vectorized, and never exposes raw bodies, object keys, unsafe URLs, credentials, private material, or actor-interaction content.
- Updated evidence storage docs and API evidence assertions. Also repaired parallel source-atlas helper drift that was blocking the shared TypeScript and route proof path.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/api.test.ts -t evidence`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run measure:search-product`, and full `bun test` passed with 511 tests.
- Product measurement remains green: empty/on-demand, captured evidence, and restricted metadata-only leak-claim scenarios all report useful-answer rate 1.0 and expected fact recall 1.0 with no cross-talk.
- Continue Agent 06 evidence backbone work next with replay-driven public answer/graph promotion from durable read-model rows.

Progress update 2026-06-20 14:01 CEST:
- Continued the long-running evidence backbone with replay-driven public answer and graph promotion inputs from durable read-model rows.
- Added `ti.evidence_search_read_model_promotion_replay.v1` in `src/storage/evidenceSearchReadModel.ts` and exposed it on `/v1/evidence/cutover-report.readModelCutover.promotionReplay`.
- The replay packet rebuilds support document IDs, captures, claim-ledger entries, source IDs, relationship IDs, replay IDs, citation counts, retention classes, legal holds, stale-extractor requirements, public-answer blockers/warnings, and graph promotion holds from backend write-set rows.
- Restricted/leak metadata remains metadata-only: it may support caveated defensive public-answer context for victim/company/account-count/dataset-size/timestamp/actor-demand facts, while restricted graph relationships stay held and restricted rows remain excluded from embeddings/vector promotion.
- Safe-output guarantees remain explicit: no raw bodies, object keys, unsafe URLs, credentials, private material, actor-interaction content, or restricted raw content are serialized.
- Also absorbed current shared source activation packet drift so tenant activation packets select source IDs by source class instead of leaking ambiguous positional slices into approval packets.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/api.test.ts -t evidence`, `bun test src/tests/graphViews.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run measure:search-product`, and full `bun test` passed with 519 tests.
- Product measurement remains green: empty/on-demand source-pack, captured clear-web evidence, and restricted metadata-only leak-claim scenarios all report useful-answer rate 1.0 and expected fact recall 1.0 with no cross-talk.
- Continue Agent 06 evidence backbone work next with production transaction wiring from durable promotion replay into public answer, graph, STIX, and API consumers.

Progress update 2026-06-20 15:24 CEST:
- Continued the evidence backbone with a dry-run production transaction plan from durable read-model promotion replay into downstream consumers.
- Added `ti.evidence_promotion_transaction_plan.v1` in `src/storage/evidenceSearchReadModel.ts` and exposed it on `/v1/evidence/cutover-report.readModelCutover.promotionTransaction`.
- The transaction plan orders public-answer, graph, STIX, and API cache consumer writes with deterministic idempotency keys, rollback steps, replay guarantees, consumer blockers/warnings, and Agent 07/08/09/10 handoffs.
- Restricted/leak metadata remains metadata-only: it may support caveated defensive public-answer context, while restricted graph/STIX promotion stays held and vector promotion remains disabled.
- Added evidence storage docs plus storage/API assertions; also repaired missing OpenAPI component schemas for the route-visible Apify store readiness contract so API regression remains aligned.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/api.test.ts -t evidence`, `bun test src/tests/apiRegressionSentinel.test.ts`, `bun run check:api-regression`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run measure:search-product`, and full `bun test` passed with 521 tests.
- Continue Agent 06 evidence backbone work next with fail-closed production repository transaction execution behind explicit enablement flags.

Progress update 2026-06-20 15:49 CEST:
- Continued the evidence backbone with fail-closed production promotion transaction execution behind explicit enablement flags.
- Added `ti.evidence_promotion_transaction_execution.v1` in `src/storage/evidenceSearchReadModel.ts` and exposed it on `/v1/evidence/cutover-report.readModelCutover.promotionExecution`.
- Execution is blocked by default with `promotion_transaction_repository_disabled`, no live backend connection, no production consumer mutation, deterministic audit fields, safe-output guarantees, and source-plan replay linkage.
- Explicit rehearsal mode can apply only ready public-answer/API cache steps with deterministic receipts and rollback refs while holding graph/STIX and all restricted/vector promotion paths.
- Restricted/leak metadata remains metadata-only: defensive victim/company/account-count/dataset-size/timestamp/actor-demand context may stay caveated in public-answer context, while raw bodies, object keys, unsafe URLs, credentials, private material, restricted raw content, actor-interaction content, embeddings, graph export, and STIX export remain blocked or held.
- Updated evidence storage docs plus storage/API assertions. Also repaired current shared live-capture/public-signal/graph fixture drift needed to keep the shared proof path green.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/api.test.ts -t evidence`, `bun test src/tests/graphViews.test.ts`, `bun test src/tests/adapterContracts.test.ts`, full `bun test` passed with 526 tests, `bun run check:route-inventory`, `bun run check:contract-index`, and `bun run measure:search-product`.
- Product measurement remains green: empty/on-demand source-pack, captured clear-web evidence, and restricted metadata-only leak-claim scenarios all report useful-answer rate 1.0 and expected fact recall 1.0 with no cross-talk.
- Continue Agent 06 evidence backbone work next with durable repository/table persistence for execution receipts and transaction audit replay, still disabled by default until an explicit production enablement gate exists.

Progress update 2026-06-20 16:11 CEST:
- Continued the evidence backbone with durable Postgres-style execution audit rows and transaction audit replay for promotion receipts.
- Added `EvidencePromotionTransactionExecutionPostgresRows` mappers in `src/storage/evidenceSearchReadModel.ts` for `evidence_promotion_execution_receipts`, `evidence_promotion_execution_steps`, `evidence_promotion_execution_held_steps`, and `evidence_promotion_execution_rollbacks`.
- Added `ti.evidence_promotion_transaction_audit_replay.v1` and exposed it on `/v1/evidence/cutover-report.readModelCutover.promotionAuditReplay`, proving row counts, deterministic receipt IDs, committed consumer counts, fail-closed reasons, rollback refs, and replay-without-raw-evidence behavior while the future repository stays disabled by default.
- Restricted/leak metadata remains metadata-only: audit rows contain only ids, counts, state, blockers, rollback labels, retention/review policy metadata, and no-leak flags; no raw bodies, object keys, unsafe URLs, credentials, private material, restricted raw content, actor-interaction content, embeddings, graph export, or STIX export are persisted or exposed.
- Updated evidence storage docs plus storage/API assertions. Also repaired current shared source-atlas economics drift needed to keep full proof green.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/api.test.ts -t evidence`, focused source-atlas/API drift checks, full `bun test` passed with 526 tests, `bun run check:route-inventory`, `bun run check:contract-index`, and `bun run measure:search-product`.
- Product measurement remains green: empty/on-demand source-pack, captured clear-web evidence, and restricted metadata-only leak-claim scenarios all report useful-answer rate 1.0 and expected fact recall 1.0 with no cross-talk.
- Continue Agent 06 evidence backbone work next with disabled-by-default execution receipt repository interface/factory or public-answer/graph audit replay consumers from these durable rows.

Progress update 2026-06-20 17:28 CEST:
- Continued the product-focused evidence backbone with `ti.evidence_actor_product_impact_replay.v1` on `/v1/evidence/cutover-report.readModelCutover.actorProductImpactReplay`.
- The packet answers the Apify Actor questions directly from durable read-model rows: which fresh public rows improve paid Actor results, which restricted/dark metadata rows can be searched as caveated defensive context, which stale rows are suppressed, which source families are missing, and how to replay proof run `iMQGeezZ8bx7WtlhQ`.
- Restricted/leak rows remain metadata-only and caveated: victim/company/account-count/dataset-size/actor-statement/timestamp/hash/review/retention facts can be searched, while raw bodies, object keys, unsafe URLs, credentials, restricted raw content, actor interaction, and restricted vector embeddings remain excluded.
- Updated evidence storage docs plus storage/API assertions. Also repaired narrow shared TypeScript drift in the product SLO/source-atlas/API helper surfaces that was blocking `bun run check` without reverting other agents' dirty work.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, `bun test src/tests/api.test.ts -t evidence`, focused source-atlas/API checks, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run measure:search-product`, and full `bun test` passed with 527 tests.
- Product measurement remains green: empty/on-demand source-pack, captured clear-web evidence, and restricted metadata-only leak-claim scenarios all report useful-answer rate 1.0 and expected fact recall 1.0 with no cross-talk.
- Continue Agent 06 evidence backbone work next with disabled-by-default execution receipt repository interfaces or direct Actor/public-answer consumers for `actorProductImpactReplay` so stale suppression and source-family gaps can drive actual dataset rows.

Progress update 2026-06-20 18:54 CEST:
- Continued the direct Actor/public-answer consumer path with `ti.evidence_actor_dataset_promotion_preview.v1` on `/v1/evidence/cutover-report.readModelCutover.actorDatasetPromotionPreview`.
- The preview converts actor product impact replay into explicit dataset/public-answer row decisions: billable result candidates, restricted metadata context-only rows, stale suppressions, coverage-gap rows, buyer-value scores, billing guidance, and proof run/dataset lineage for build `0.6.4`.
- Restricted/leak rows remain metadata-only and caveated: defensive victim/company/account-count/dataset-size/timestamp/actor-demand facts can support context, while raw bodies, object keys, unsafe URLs, credentials, private material, restricted raw content, actor interaction, embeddings, graph export, and STIX export remain excluded or held.
- Updated evidence storage docs plus storage/API assertions. Also absorbed shared scheduler/source-atlas/planner drift around `public_channel_probe`, source atlas graph empty rows, and stale duplicate source-atlas helpers so the product proof path stays green.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts src/tests/api.test.ts -t evidence`, `bun test src/tests/sourceSeeds.test.ts src/tests/schedulerProduction.test.ts`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run measure:search-product`, and full `bun test` passed with 527 tests.
- Product measurement remains green and now reports useful-answer rate 1.0 and expected fact recall 1.0 for empty/on-demand source-pack, captured clear-web evidence, and restricted metadata-only leak-claim scenarios, with no cross-talk.
- Continue Agent 06 evidence backbone work next with real Actor dataset row rendering or public-answer cache consumption from `actorDatasetPromotionPreview`, keeping stale suppressions and source-family coverage gaps buyer-visible.

Progress update 2026-06-20 19:25 CEST:
- Continued the real Actor/public-answer consumer bridge with `ti.evidence_actor_dataset_consumer_handoff.v1` on `/v1/evidence/cutover-report.readModelCutover.actorDatasetConsumerHandoff`.
- The handoff renders `actorDatasetPromotionPreview` rows into dry-run Actor dataset row candidates and public-answer cache write intents: sellable rows, caveated restricted-metadata context, stale suppression receipts, and coverage-gap rows.
- Buyer-visible fields now carry dataset row ids, paid-row decisions, billing guidance, buyer-value score, evidence grade, coverage status, replay/source/capture ids, and cache write actions without writing the Actor dataset or API answer cache.
- Restricted/leak material remains metadata-only: victim/company/account-count/dataset-size/timestamp/actor-demand context can stay caveated, while raw bodies, object keys, unsafe URLs, credentials, private material, restricted raw content, actor interaction, embeddings, graph export, and STIX export remain excluded or held.
- Updated evidence storage docs plus storage/API assertions. The 30-minute `agent-06-work-loop` automation is active so this lane keeps picking up new Agent 06 work.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts src/tests/api.test.ts -t evidence`, `bun run check:route-inventory`, `bun run check:contract-index`, `bun run measure:search-product`, and full `bun test` passed with 527 tests.
- Product measurement remains green: empty/on-demand source-pack, captured clear-web evidence, and restricted metadata-only leak-claim scenarios all report useful-answer rate 1.0 and expected fact recall 1.0 with no cross-talk.
- Continue Agent 06 evidence backbone work next with disabled-by-default Actor dataset/public-answer cache repository interfaces or execution receipts for actual consumer writes behind explicit enablement gates.

Progress update 2026-06-20 19:40 CEST:
- Continued the consumer write boundary with `ti.evidence_actor_dataset_consumer_execution.v1` on `/v1/evidence/cutover-report.readModelCutover.actorDatasetConsumerExecution`.
- The execution packet holds every Actor dataset row and public-answer cache write behind disabled repositories and explicit `TI_ACTOR_DATASET_CONSUMER_WRITES_ENABLED` / `TI_PUBLIC_ANSWER_CACHE_WRITES_ENABLED` gates.
- It reports zero production writes, live backend connection `false`, deterministic held receipts for dataset rows/cache writes, blocked reasons, and empty rollback refs until a real repository is explicitly enabled.
- Restricted/leak rows remain metadata-only and caveated; execution receipts contain only ids, intended actions, held states, blocker reasons, counts, and no-leak flags.
- Updated evidence storage docs plus storage/API assertions. Continue next with actual disabled repository interfaces/table mappers for these execution receipts, or source-family gap feedback into Actor row suppression policy.

Progress update 2026-06-20 20:00 CEST:
- Continued with Postgres-style audit table mappers for the Actor dataset/public-answer consumer execution receipts.
- Added `ti.evidence_actor_dataset_consumer_audit_replay.v1` on `/v1/evidence/cutover-report.readModelCutover.actorDatasetConsumerAuditReplay`, modeling execution receipt, dataset receipt, and cache receipt tables while the repository remains disabled by default.
- Audit rows contain only ids, cache keys, intended actions, held states, blocker reasons, counts, and no-leak flags; no raw bodies, object keys, unsafe URLs, credentials, private material, restricted raw content, actor interaction, embeddings, graph export, or STIX export are persisted or exposed.
- Updated evidence storage docs plus storage/API assertions. Continue next with source-family gap feedback into Actor row suppression policy or a disabled repository factory around these audit rows.

Progress update 2026-06-20 20:28 CEST:
- Continued with the disabled repository factory/status for Actor dataset/public-answer consumer audit rows.
- Added `ti.evidence_actor_dataset_consumer_audit_repository.v1` on `/v1/evidence/cutover-report.readModelCutover.actorDatasetConsumerAuditRepository`, accepting execution/cache/dataset audit rows while holding persistence behind `TI_ACTOR_DATASET_CONSUMER_AUDIT_REPOSITORY_ENABLED`.
- The factory is fail-closed by default: no live backend connection, no persisted rows, zero Actor dataset/public-answer mutations, and explicit blocked reasons until a real Postgres audit repository is configured.
- Restricted/leak rows remain metadata-only and caveated; repository status contains only row counts, table names, feature flags, blocker reasons, replay readiness, and no-leak flags.
- Continue next with source-family gap feedback into Actor row suppression policy or a real repository implementation behind explicit enablement.

Progress update 2026-06-21 00:13 CEST:
- Continued with source-family gap feedback into Actor row suppression policy.
- Added `ti.evidence_actor_dataset_source_gap_suppression_feedback.v1` on `/v1/evidence/cutover-report.readModelCutover.actorDatasetSourceGapSuppressionFeedback`, derived from `actorDatasetPromotionPreview`.
- The packet keeps coverage-gap rows non-billable, stale rows suppressed, and restricted metadata context-only until durable source-family repairs replay into the read model.
- Feedback rows expose missing source family, current non-billable decision, required promotion conditions, owner handoff, buyer-visible effect, and no-leak proof; they do not mutate datasets, activate sources, crawl, or expose raw restricted material.
- Continue next with actual source-family feedback consumers for Agent 01/04/05/07 queues or a real repository implementation behind explicit enablement.

Progress update 2026-06-21 00:42 CEST:
- Continued with source-family feedback consumers for Agent 01/04/05/07 queues.
- Added `ti.evidence_actor_dataset_source_gap_consumer_queue.v1` on `/v1/evidence/cutover-report.readModelCutover.actorDatasetSourceGapConsumerQueue`, derived from the suppression feedback packet.
- Queue rows route missing source-family, stale-refresh, and restricted-corroboration work to Agent 01 source activation, Agent 04 public-channel freshness, Agent 05 restricted metadata, and Agent 07 advisory/extraction quality with acceptance criteria and buyer-visible effects.
- The queue is dry-run and fail-closed: it does not mutate queues, activate sources, crawl, or expose raw leak material, credentials, unsafe URLs, object keys, actor interaction, or restricted embeddings.
- Continue next with a disabled-by-default repository/audit mapper for these queue rows or direct consumer alignment with Agent 01/04/05/07 source repair packets.

Progress update 2026-06-21 00:58 CEST:
- Continued with the disabled-by-default repository/audit mapper for source-gap consumer queue rows.
- Added `ti.evidence_actor_dataset_source_gap_consumer_queue_audit_repository.v1` on `/v1/evidence/cutover-report.readModelCutover.actorDatasetSourceGapConsumerQueueAuditRepository`.
- Queue runs and queue items now map to Postgres-style audit rows for `evidence_actor_source_gap_queue_runs` and `evidence_actor_source_gap_queue_items`, then stay held behind `TI_ACTOR_SOURCE_GAP_QUEUE_AUDIT_REPOSITORY_ENABLED`.
- The repository status persists zero rows, mutates zero queues, activates zero sources, starts no crawling, and keeps restricted/leak material metadata-only with no raw bodies, unsafe URLs, credentials, object keys, actor interaction, or restricted embeddings.
- Continue next with direct consumer alignment to Agent 01/04/05/07 source repair packets or a real repository implementation behind explicit enablement.

Progress update 2026-06-21 01:31 CEST:
- Continued with direct consumer alignment to Agent 01/04/05/07 source repair packets.
- Added `ti.evidence_actor_dataset_source_gap_repair_handoff.v1` on `/v1/evidence/cutover-report.readModelCutover.actorDatasetSourceGapRepairHandoff`.
- The handoff groups queue rows into Agent 01 source-atlas, Agent 04 public-channel, Agent 05 dark-metadata, and Agent 07 quality/extraction repair packets with route hints, queue actions, source families, acceptance criteria, buyer-visible effects, and explicit blockers.
- It remains dry-run and fail-closed: no queue mutation, source activation, crawling, unsafe URL, credential, raw leak material, object key, actor interaction, or restricted embedding is serialized or requested.
- Continue next with a real repository implementation behind explicit enablement or richer replay linkage from completed repair packets back into Actor row promotion.

Progress update 2026-06-21 02:10 CEST:
- Continued with richer replay linkage from source-gap repair packets back into Actor row promotion.
- Added `ti.evidence_actor_dataset_source_gap_repair_replay_ledger.v1` on `/v1/evidence/cutover-report.readModelCutover.actorDatasetSourceGapRepairReplayLedger`.
- The ledger turns Agent 01/04/05/07 repair handoff packets into replay checkpoints requiring durable capture rows, claim-ledger rows, source-family rows, freshness timestamps, and, for restricted metadata, review state plus public corroboration.
- It promotes zero Actor rows and writes zero public-answer cache rows by itself; all source-gap/stale/restricted rows stay blocked until repaired evidence rows replay through the read model.
- Continue next with an explicit production repository implementation behind enablement or completed-repair replay receipts once cross-agent repair packets produce completed rows.

Progress update 2026-06-21 04:40 CEST:
- Continued with the explicit production repository boundary for source-gap repair replay receipts.
- Added `ti.evidence_actor_dataset_source_gap_repair_replay_repository.v1` on `/v1/evidence/cutover-report.readModelCutover.actorDatasetSourceGapRepairReplayRepository`.
- Replay ledgers/checkpoints now map to Postgres-style `evidence_actor_source_gap_repair_replay_runs` and `evidence_actor_source_gap_repair_replay_checkpoints` rows, then remain held behind `TI_ACTOR_SOURCE_GAP_REPAIR_REPLAY_REPOSITORY_ENABLED`.
- The repository status persists zero rows, promotes zero Actor rows, writes zero public-answer cache entries, activates zero sources, and exposes only ids/counts/replay gates/no-leak flags so restricted/leak metadata remains metadata-only.
- Continue next with completed-repair replay receipts once Agent 01/04/05/07 emit completed repair rows, or with the next direct searchable read-model path for real source/dark metadata rows.

Progress update 2026-06-21 05:22 CEST:
- Continued with a direct searchable read-model catalog for real source/dark metadata rows.
- Added `ti.evidence_searchable_source_metadata_catalog.v1` on `/v1/evidence/cutover-report.readModelCutover.searchableSourceMetadataCatalog`.
- The catalog is derived from safe Postgres read-model rows and shows public rows eligible for direct Actor/public-answer support plus restricted/dark metadata rows that are searchable only as caveated defensive context.
- It surfaces buyer-visible metadata fields when present, including victim/company, account count, dataset size, timestamp, actor demand, hash/provenance, actor, and TTP/CVE, while keeping restricted rows non-vectorized and no-leak.
- Continue next with completed repair receipts or with the next searchable source/dark metadata path that moves caveated context toward fresh public-supported Actor rows.

Progress update 2026-06-21 06:03 CEST:
- Continued by turning searchable caveated restricted/dark metadata rows into public-support repair work.
- Added `ti.evidence_searchable_source_metadata_public_support_queue.v1` on `/v1/evidence/cutover-report.readModelCutover.searchableSourceMetadataPublicSupportQueue`.
- The queue derives candidates from `searchableSourceMetadataCatalog`, routes public report support to Agent 01, public-channel corroboration to Agent 04, and advisory/vendor references to Agent 07.
- Metadata-only candidates stay blocked from paid Actor rows until public support replays through the read model; the queue does not mutate queues, activate sources, crawl, embed restricted rows, or expose raw leak material.
- Continue next with completed public-support replay receipts or a repository/audit mapper for these public-support candidates if cross-agent rows are still pending.

Progress update 2026-06-21 06:44 CEST:
- Continued with the disabled Postgres repository/audit boundary for searchable metadata public-support candidates.
- Added `ti.evidence_searchable_source_metadata_public_support_repository.v1` on `/v1/evidence/cutover-report.readModelCutover.searchableSourceMetadataPublicSupportRepository`.
- Public-support queue runs and candidates now map to `evidence_searchable_source_public_support_queue_runs` and `evidence_searchable_source_public_support_candidates`, then stay held behind `TI_SEARCHABLE_SOURCE_METADATA_PUBLIC_SUPPORT_REPOSITORY_ENABLED`.
- The repository status persists zero rows, mutates zero queues, activates zero sources, starts no crawling, promotes zero Actor rows, and keeps restricted/leak rows metadata-only.
- Continue next with completed public-support replay receipts when Agent 01/04/07 produce completed support rows, or with another measurable read-model path that makes metadata-supported rows sellable.

Progress update 2026-06-21 07:27 CEST:
- Continued with the explicit promotion gate for searchable source/dark metadata rows.
- Added `ti.evidence_searchable_source_metadata_promotion_gate.v1` on `/v1/evidence/cutover-report.readModelCutover.searchableSourceMetadataPromotionGate`.
- The gate separates direct public-support rows that can be eligible for dry-run Actor/public-answer support from restricted/dark metadata rows that stay blocked until public-support replay and repository corroboration complete.
- It exposes required evidence, buyer-visible fields, promotion state, and no-leak proof while writing zero production Actor rows or public-answer cache entries.
- Restricted/leak material remains metadata-only: no raw bodies, object keys, unsafe URLs, credentials, actor interaction, restricted raw content, or restricted embeddings are exposed.
- Verification completed: `bun run check`, `bun test src/tests/storageCutover.test.ts`, and `bun run check:route-inventory`.
- Continue next with completed public-support replay receipts once cross-agent repair rows exist, or with a disabled repository/audit boundary for promotion-gate decisions.

You completed retention/search consistency pieces. Now own the complete evidence backbone. The product cannot become enterprise-grade until raw captures, extracted text, claim ledgers, object refs, indexes, graph relationships, and public answers all replay from durable, auditable evidence.

## Main Agent Update - 2026-06-20 17:05 CEST

The first revenue vehicle is now the Apify Actor, published build `0.6.4`, with pay-per-event pricing scheduled for July 4. Latest proof run `iMQGeezZ8bx7WtlhQ` produced 10 safe APT42 rows with paid-row decisions, but still shows caveated output, stale/held rows, weak victim extraction, and missing public-channel/dark metadata coverage. Your evidence/search work should now make real source and Tier 100 dark metadata rows searchable, replayable, and promotable into Actor rows, rather than adding new backend theory.

Prioritize a read-model path that can answer: which fresh source/metadata rows improved a paid Actor result, which stale rows were suppressed, which source families are missing, and how to replay the proof. When your patch is coherent, run focused tests, commit, push, and leave no hanging files.

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
