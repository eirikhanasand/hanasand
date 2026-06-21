# Evidence Storage Design

## Ownership
Agent 06 owns raw evidence persistence, immutable captures, deduplication, replay inputs, and storage safety rules. The store boundary separates raw captures from extracted incidents, indicators, entities, and analyst-reviewed intelligence.

## Capture Contract
Each `RawCapture` is immutable after first write. It carries:
- source, task, tenant, URL, canonical URL, collection time, and optional published time;
- content and normalized-text hashes;
- storage kind, object reference, media type, and metadata;
- sensitivity flags, redaction decision, retention class, and provenance.

The in-memory store prepares missing canonical URL, normalized text hash, redaction, retention, and provenance fields at write time. Production writers should do the same before committing metadata or object references.

## Sensitive Sources
Sensitive and leak-oriented sources are metadata-only. Any capture marked `sensitive` or flagged as `sensitive_source`, `leak_metadata`, `credential_material`, or `restricted_protocol` is persisted with:
- `storageKind: "metadata_only"`;
- no raw body;
- `retentionClass: "restricted_metadata"`;
- redaction policy `metadata_only`.

Safe excerpts belong in metadata fields such as `safeExcerpt`; raw leaked rows, credentials, private documents, and stolen datasets must never be persisted.

## Analyst Loop Persistence
`migrations/004_analyst_loop.sql` adds the durable workflow layer for the public `/ti` analyst loop. It persists collection plans, collection tasks, collection runs, metadata review tasks, source activation dry-run packets, victim notification packets, claim ledger entries, and analyst-loop snapshots.

This layer is intentionally metadata-only for leak and threat-actor claims. It may store company/victim names, affected-account counts or descriptions, dataset-size claims, actor statement summaries, claimed/observed timestamps, source hashes, provenance, confidence, allowed review actions, and explicit `what_was_not_accessed` fields. It must not store raw leaked rows, credential values, downloaded datasets, private-community content, CAPTCHA/auth bypass output, or actor-interaction transcripts.

The route-visible state model is:
- `queued`: approved safe collection work is running.
- `metadata_review`: leak or threat-actor metadata is safe enough for analyst review.
- `blocked_unsafe_target`: raw leak/download/credential/private-access/interaction targets were blocked.
- `needs_source_activation`: operator or legal approval is needed before collection.
- `ready`: enough reviewed evidence exists for a usable answer.

Victim notification packets are redacted drafts. They summarize what was claimed, who appears affected, dataset size, actor statement summary, timestamps, confidence, provenance, and what was not accessed. Sending still requires an explicit operator workflow outside this migration.

## Deduplication
Duplicate suppression uses two keys:
- `sourceId + canonicalUrl + publishedAt`;
- `sourceId + normalizedTextHash + publishedAt`.

This catches same-source URL variants and mirrors where normalized text is identical. Cross-source correlation belongs in extraction/correlation layers, not raw evidence mutation.

## Replay
`ReplayPipelineInput` reconstructs deterministic extractor inputs from stored captures by capture ID and extractor version. Metadata-only captures replay as metadata-only inputs, so later extractors cannot accidentally access raw sensitive body data.

Replay jobs carry source/capture/run IDs, old and new extractor versions, counts, status, and a diff summary. Replay results may add new derived incidents or relationships, but they must reference the original capture ID and content hash. They must not overwrite raw capture rows or object references.

## Query Helpers
The storage layer exposes backend-neutral helpers for `/ti` and `/v1/intel`:
- live-search snapshots by query and run;
- cursor-based evidence deltas since the last poll, including discovery, capture, extraction, relationship, policy, redaction, expiry, blocked, downgrade, contradiction, and promotion events;
- active-run evidence by cursor for Agent 09 polling;
- query timelines for live-search result history;
- latest captures by tenant, actor, source, or capture ID;
- claim provenance chains from source and task through capture, extractor, incident, entity, indicator, and TTP output;
- dedupe groups by source/canonical URL/normalized text hash/published timestamp;
- replay status by tenant/capture;
- source freshness and capture counts;
- extractor version summaries;
- redaction summaries that never include sensitive bodies or raw object keys.

Tenant scope must be applied before pagination or DTO projection. API DTO helpers reject cross-tenant access and redact sensitive bodies and object keys by default.

## Search And Vector Handoff
`buildEvidenceSearchIndexHandoff` emits the backend-neutral search/vector boundary for OpenSearch-compatible indexes and future vector backends. It builds `ti.evidence_search_index_handoff.v1` packets from captures, evidence deltas, analyst claim-ledger rows, graph relationship deltas, and source metadata without binding the scraper to a vendor.

Every handoff document carries:
- tenant scope, source/capture/claim/relationship IDs, query and normalized query;
- title, summary, tags, freshness, confidence, replay ID, content hash where safe, and citation spans;
- backend hints for a stable OpenSearch index, vector namespace, and tenant-scoped routing key;
- explicit redaction flags proving raw bodies, object keys, and unsafe URLs are not included.

Restricted and leak-source metadata remains searchable when it is defensive metadata such as victim/company, affected account count, dataset size, actor statement summary, claimed/observed time, source hash, retention class, and review status. It is not embedding-eligible. Public non-sensitive summaries may be embedding-eligible with an input-text hash, but metadata-only, restricted, legal-hold, and no-text documents are excluded from vector input. This lets Agent 07 quality/search index useful metadata, Agent 08 pivot graph relationships, Agent 09 expose API-safe serialization, and Agent 10 observe counts without raw leak material, credentials, private content, actor interaction, object keys, or unsafe URLs.

## Index Replay Migration
`buildEvidenceIndexReplayMigrationReport` emits `ti.evidence_index_replay_migration.v1` and is included on `/v1/evidence/cutover-report` as `indexReplayMigration`. It composes the search/vector handoff, object manifest verification, cursor replay proof, and chain-of-custody packet into the migration proof for OpenSearch/vector backend cutover.

The migration report is dry-run and route-safe. It defines the backend targets, tenant-scoped routing, blue/green alias cutover, replay input checksum, rebuild/backfill plan, validation gates, consistency counts across evidence/source/capture/extraction/claim/graph/API/STIX surfaces, and rollback checkpoint. It blocks on missing or mismatched object refs, missing index documents, unsafe restricted bodies, and hash-chain failures. It holds on cursor replay gaps, parser-version drift, export-without-review, missing graph relationships, or missing API answer snapshots.

Restricted/leak metadata can be indexed for defensive search fields such as company/victim, affected-account counts, dataset size, actor statement summaries, timestamps, source hashes, review state, and retention class. Those documents are held out of vector embedding and remain metadata-only. The report never includes raw bodies, object keys, unsafe URLs, credentials, restricted material, or actor-interaction content.

## Search Backend Migration Readiness
`buildEvidenceSearchBackendMigrationReadinessReport` emits `ti.evidence_search_backend_migration_readiness.v1` and is included on `/v1/evidence/cutover-report` as `searchBackendMigration`. It is the OpenSearch/pgvector-neutral readiness packet for the real backend cutover path after replay documents, object integrity, retention enforcement, and search consistency are known.

The report exposes candidate backend boundaries without connecting to live services:
- OpenSearch candidate index, read/write aliases, tenant routing key count, document count, and bulk checkpoint.
- pgvector namespace/table, embedding-eligible count, restricted-metadata exclusion count, and hash-only input validation.
- Postgres cursor source, replay checkpoint, retention-class count, legal-hold count, and cursor readiness.

Cutover checkpoints cover source snapshot, bulk index, vector upsert, deletion replay, alias swap, API refresh, and rollback. Deletion replay uses `tombstone_then_delete_object` and legal hold blocks destructive actions. Restricted/leak metadata remains searchable as safe defensive metadata and is never embedded. Fixture rows cover clean cutover, missing object, hash mismatch, restricted metadata, legal hold, redaction/delete replay, and alias rollback. The packet never serializes raw bodies, object keys, unsafe URLs, credentials, restricted raw content, or actor-interaction material, and it never mutates indexes or databases.

## Replay Benchmark
`buildEvidenceReplayBenchmarkReport` emits `ti.evidence_replay_benchmark.v1` and is included on `/v1/evidence/cutover-report` as `replayBenchmark`. It is the deterministic scale packet for proving the evidence path can rebuild public answers, search indexes, graph relationships, and reviewed STIX descriptors from durable capture metadata without materializing a million rows in the test process.

The default benchmark models 1,000,000 capture metadata records in 100 chunks of 10,000 rows. It publishes estimated source, extraction, claim, relationship, and restricted-metadata row counts; cursor checkpoint cadence; throughput budgets for metadata replay, extraction deltas, search documents, graph relationships, and STIX descriptors; and p95 budgets for public answer refresh, metadata replay, search rebuild, graph rebuild, and STIX preview generation. The report is dry-run only and uses existing replay, chain-of-custody, search consistency, retention, and backend migration gates to decide whether public answers are ready, partial, or held.

Restricted/leak sources remain metadata-only during the benchmark. Defensive metadata such as victim/company, affected-account counts, dataset size, actor statement summaries, source hashes, timestamps, review state, and retention class can be indexed for search and used as safe evidence for public answer caveats, but restricted rows are never embedded and raw bodies are never loaded. Fixture rows cover one-million public metadata replay, 60k restricted metadata rows, 10k source candidates, missing-object holds, legal-hold deletion replay, cursor-gap resume, and graph/STIX rebuild behavior.

## Search Consistency SLO
`buildEvidenceSearchConsistencySloReport` emits `ti.evidence_search_consistency_slo.v1` and is included on `/v1/evidence/cutover-report` as `searchConsistencySlo`. It is the route-visible production-readiness packet for the user-facing search data path after the OpenSearch/vector handoff is built.

The report checks deterministic document IDs, tenant routing, replay IDs, citation spans, capture content hashes, object manifest verification, cursor replay, custody chain readiness, retention runtime safety, vector input boundaries, graph/STIX review holds, and API answer refresh safety. It also publishes fixed SLO budgets for initial partial answer, cursor replay, index refresh, and vector upsert with deterministic local estimates so Agent 09/10 can hold release when the evidence path is drifting before a backend is live.

Restricted/leak metadata remains searchable for defensive metadata and is not treated as a failure when it is excluded from vector embedding. Any restricted embedding leak, raw body/object-key/unsafe URL exposure, missing object, cursor replay gap, missing citation, or unsafe answer refresh produces a blocked or held packet with dry-run repair actions only. The packet never serializes raw bodies, object keys, unsafe URLs, credentials, restricted raw content, or actor-interaction material.

## Search Read Model Adapter
`src/storage/evidenceSearchReadModel.ts` turns `EvidenceSearchIndexHandoff` packets into an actual queryable read model. The embedded implementation is used for tests and local product measurement; production backends are represented as disabled-by-default adapter boundaries for Postgres read-model tables and OpenSearch/pgvector until an explicit feature-flagged cutover enables them.

The read model accepts only safe `ti.evidence_search_index_document.v1` documents. It stores document IDs, safe summaries, replay IDs, citation counts, routing keys, retention class, and embedding input hashes for public embedding-eligible documents. Restricted/leak metadata is searchable for defensive facts but never receives an embedding input hash. Retention deletion tombstones matching read-model rows while preserving legal-hold rows, and disabled production adapters fail closed instead of shadow-writing to live backends.

The same module now emits backend write sets with durable mapper rows:

- `evidence_search_documents` rows round-trip full safe search documents, replay metadata, citation spans, retention class, redaction state, and backend routing hints.
- OpenSearch documents carry only safe summaries/search text, replay IDs, routing keys, retention/review metadata, citation counts, and hash-only embedding inputs.
- pgvector candidate rows are emitted only for public embedding-eligible documents. Restricted and metadata-only records are omitted from vector rows even when they remain searchable in full-text metadata.
- Tombstone rows carry document ID, tenant, capture, retention class, legal hold, reason, and replay ID so deletion replay can retire search rows without losing custody history.

`/v1/evidence/cutover-report.readModelCutover` exposes the route-visible cutover state for those mapper rows as `ti.evidence_search_read_model_cutover.v1`. It combines the backend write-set counts, embedded replay readiness, fail-closed Postgres/OpenSearch/pgvector adapter state, replay/tombstone/legal-hold/stale-extractor requirements, and vector policy so operators can see why the durable read path is ready locally but still held from production backend writes until explicit enablement.

The same cutover packet now includes `searchableSourceMetadataCatalog` as `ti.evidence_searchable_source_metadata_catalog.v1`. It is derived from safe Postgres read-model rows, not raw captures, and lists which public source rows can directly support Actor/public answers and which restricted/dark metadata rows are searchable only as caveated defensive context. Buyer-visible fields such as victim/company, account count, dataset size, timestamp, actor demand, hash/provenance, actor, and TTP/CVE are surfaced when present; restricted rows never receive vector embeddings and never expose raw leak material, unsafe URLs, object keys, credentials, or actor-interaction content.

`searchableSourceMetadataPublicSupportQueue` is the dry-run repair bridge as `ti.evidence_searchable_source_metadata_public_support_queue.v1`. It converts searchable restricted/dark metadata catalog rows into public-support candidates for Agent 01 source reports, Agent 04 public-channel corroboration, and Agent 07 advisory/vendor references. Candidates remain blocked from paid Actor rows until public support replays through the evidence read model, and the queue never mutates queues, activates sources, starts crawling, embeds restricted rows, or serializes raw leak material.

`searchableSourceMetadataPublicSupportRepository` is the disabled Postgres audit boundary as `ti.evidence_searchable_source_metadata_public_support_repository.v1`. It maps public-support queue runs and candidates to `evidence_searchable_source_public_support_queue_runs` and `evidence_searchable_source_public_support_candidates`, then holds persistence behind `TI_SEARCHABLE_SOURCE_METADATA_PUBLIC_SUPPORT_REPOSITORY_ENABLED`. The status exposes accepted/held row counts and replay readiness while persisting zero rows, mutating zero queues, activating zero sources, starting no crawling, and promoting zero Actor rows.

`searchableSourceMetadataPromotionGate` is the route-visible Actor/public-answer promotion decision point as `ti.evidence_searchable_source_metadata_promotion_gate.v1`. It separates direct public-support rows that can be eligible for dry-run Actor/public-answer support from restricted/dark metadata rows that remain blocked until public-support replay proves corroboration through the repository boundary. The gate performs zero production writes and keeps leak/restricted material metadata-only: no raw bodies, object keys, unsafe URLs, credentials, actor-interaction content, restricted raw material, or restricted embeddings are exposed.

`searchableSourceMetadataPromotionGateRepository` is the disabled Postgres audit boundary as `ti.evidence_searchable_source_metadata_promotion_gate_repository.v1`. It maps promotion-gate runs and decisions to `evidence_searchable_source_promotion_gate_runs` and `evidence_searchable_source_promotion_gate_rows`, then holds persistence behind `TI_SEARCHABLE_SOURCE_METADATA_PROMOTION_GATE_REPOSITORY_ENABLED`. The status reports direct-eligible and blocked-metadata row counts while persisting zero rows and writing zero Actor dataset or public-answer cache entries.

The same cutover packet now includes `promotionReplay` as `ti.evidence_search_read_model_promotion_replay.v1`. That replay packet rebuilds public-answer and graph-promotion inputs from durable read-model rows: support document IDs, capture IDs, claim ledger IDs, source IDs, relationship IDs, replay IDs, citation counts, retention classes, legal-hold rows, stale-extractor requirements, public-answer blockers/warnings, and graph holds. Restricted/leak metadata can support caveated defensive public-answer context, but restricted graph relationships remain held for review and restricted rows stay excluded from embeddings and vector promotion.

The cutover packet also includes `promotionTransaction` as `ti.evidence_promotion_transaction_plan.v1`. This is the dry-run transaction boundary from durable read-model rows into downstream consumers: public answer cache, graph relationship read model, STIX preview read model, and API intel-search answer cache. It publishes ordered write steps, deterministic idempotency keys, rollback steps, consumer blockers/warnings, restricted metadata caveats, graph/STIX holds, and Agent 07/08/09/10 handoffs. It never mutates live consumers by itself, and restricted/leak metadata stays metadata-only: it may appear only as caveated defensive context, never as raw content, vector input, or export-ready graph/STIX material without review.

`promotionExecution` adds the fail-closed repository execution boundary as `ti.evidence_promotion_transaction_execution.v1`. The default route-visible receipt is blocked because production consumer writes require explicit enablement. When explicitly enabled for rehearsal, the executor records deterministic receipts only for ready consumer steps, leaves held graph/STIX steps uncommitted, emits rollback references, and still reports `willMutateProductionConsumers:false` with `liveBackendConnection:false`. This lets operators prove idempotency, partial-step handling, and rollback accounting before any future production repository is allowed to mutate public answer, graph, STIX, or API cache consumers.

Execution receipts now have Postgres-style audit row mappers for future durable persistence: `evidence_promotion_execution_receipts`, `evidence_promotion_execution_steps`, `evidence_promotion_execution_held_steps`, and `evidence_promotion_execution_rollbacks`. `/v1/evidence/cutover-report.readModelCutover.promotionAuditReplay` exposes those rows as `ti.evidence_promotion_transaction_audit_replay.v1`, proving row counts, deterministic receipt IDs, committed consumer counts, fail-closed reasons, rollback refs, and replay-without-raw-evidence behavior while the repository remains disabled by default. The audit rows contain only ids, counts, state, blockers, rollback labels, retention/review policy metadata, and no-leak flags.

`actorProductImpactReplay` adds the buyer-visible Apify/public answer bridge as `ti.evidence_actor_product_impact_replay.v1`. It answers which durable read-model rows can improve the `public-threat-actor-monitor` Actor result, which stale rows should be suppressed, which source families are missing, and how to replay the latest proof. Fresh public rows may improve Actor summaries directly. Restricted/dark metadata rows can improve defensive context only as metadata-only caveats such as victim/company, affected-account count, dataset size, actor statement summary, timestamps, hashes, review state, and retention class. Stale rows are held out of Actor impact when freshness timestamps are missing/outside the product freshness window or when extractor version metadata is missing. The packet carries build `0.6.4`, proof run `iMQGeezZ8bx7WtlhQ`, dataset `5PLmkE30luBA5Lbgc`, replay commands, and no-leak guarantees; it never serializes raw bodies, object keys, unsafe URLs, credentials, restricted raw content, private material, actor-interaction content, or restricted vector embeddings.

`actorDatasetPromotionPreview` is the direct non-mutating consumer packet for the Actor/public answer row path as `ti.evidence_actor_dataset_promotion_preview.v1`. It turns the impact replay into explicit row decisions: `billable_result_candidate` for fresh public evidence that can render as a paid Actor result row after formatting, `not_billable_context` for caveated restricted metadata, `not_billable_suppressed` for stale rows, and `not_billable_coverage_gap` for missing source families. It also exposes buyer-value scores, billing guidance, public-answer cache input/ready/held/suppressed document IDs, and the same proof run/dataset ids. This lets the Actor wrapper or API answer cache consume durable evidence row decisions without mutating datasets, starting collection, or exposing restricted material.

`actorDatasetSourceGapSuppressionFeedback` is the route-visible suppression policy feedback packet as `ti.evidence_actor_dataset_source_gap_suppression_feedback.v1`. It is derived only from `actorDatasetPromotionPreview` rows and explains why coverage-gap rows remain non-billable, stale rows remain suppressed, and restricted metadata remains context-only. Each source-family feedback row lists the missing family, current non-billable decision, required repair conditions, owner handoff, and buyer-visible effect. It never activates sources, mutates Actor datasets, or serializes raw leak material; restricted metadata stays limited to defensive metadata fields and no embedding/vector promotion.

`actorDatasetSourceGapConsumerQueue` is the non-mutating queue packet as `ti.evidence_actor_dataset_source_gap_consumer_queue.v1`. It turns suppression feedback into concrete owner queues for Agent 01 source activation, Agent 04 public-channel freshness, Agent 05 restricted metadata corroboration, and Agent 07 advisory/extraction quality. Queue rows carry required promotion conditions, acceptance criteria, buyer-visible effect, and explicit `explicit_operator_approval` plus `durable_evidence_replay` blockers. It does not enqueue jobs, activate sources, crawl, or include raw leak material, credentials, unsafe URLs, object keys, actor-interaction material, or restricted embeddings.

`actorDatasetSourceGapConsumerQueueAuditRepository` is the disabled audit boundary as `ti.evidence_actor_dataset_source_gap_consumer_queue_audit_repository.v1`. It maps queue runs and queue items to Postgres-style audit rows for `evidence_actor_source_gap_queue_runs` and `evidence_actor_source_gap_queue_items`, then holds persistence behind `TI_ACTOR_SOURCE_GAP_QUEUE_AUDIT_REPOSITORY_ENABLED`. The status reports accepted/held row counts and replay readiness, but persists zero rows, mutates zero queues, activates zero sources, and starts no crawling until an explicit repository is configured.

`actorDatasetSourceGapRepairHandoff` is the direct owner handoff packet as `ti.evidence_actor_dataset_source_gap_repair_handoff.v1`. It groups source-gap queue items into Agent 01 source-atlas, Agent 04 public-channel, Agent 05 dark-metadata, and Agent 07 quality/extraction packets with route hints, queue actions, source families, acceptance criteria, and buyer-visible effects. It is still a dry-run coordination surface: no queue mutation, source activation, crawling, restricted embedding, unsafe URL, credential, raw leak material, object key, or actor interaction is serialized or requested.

`actorDatasetSourceGapRepairReplayLedger` is the replay linkage packet as `ti.evidence_actor_dataset_source_gap_repair_replay_ledger.v1`. It converts repair handoff packets into replay checkpoints that must be satisfied before any coverage-gap, stale, or restricted-context row can affect Actor promotion. Every checkpoint requires durable capture rows, claim-ledger rows, source-family rows, and freshness timestamps; restricted metadata also requires review state and public corroboration. The ledger promotes zero rows by itself and keeps all repaired rows blocked until replayed evidence rows exist.

`actorDatasetSourceGapRepairReplayRepository` adds the disabled Postgres receipt boundary as `ti.evidence_actor_dataset_source_gap_repair_replay_repository.v1`. It maps replay ledgers and checkpoints to `evidence_actor_source_gap_repair_replay_runs` and `evidence_actor_source_gap_repair_replay_checkpoints`, then holds persistence behind `TI_ACTOR_SOURCE_GAP_REPAIR_REPLAY_REPOSITORY_ENABLED`. The status exposes replay-receipt readiness and row counts while persisting zero rows, promoting zero Actor rows, writing zero public-answer cache entries, activating zero sources, and carrying no raw leak material.

`actorDatasetConsumerHandoff` is the next dry-run bridge as `ti.evidence_actor_dataset_consumer_handoff.v1`. It renders promotion-preview rows into Actor dataset row candidates and public-answer cache write intents without writing either backend. Billable candidates become `render_sellable_candidate` rows with `charge_after_actor_emit`; restricted metadata becomes `render_caveated_context` with `do_not_charge_context`; stale rows create suppression receipts; and missing source families render coverage-gap rows. Every rendered row carries safe dataset fields, replay/source/capture ids where available, buyer-value score, evidence grade, coverage status, and explicit safety flags proving no raw content, restricted material, unsafe URL, credential, or actor interaction is included.

`actorDatasetConsumerExecution` adds the disabled-by-default execution receipt as `ti.evidence_actor_dataset_consumer_execution.v1`. It holds every Actor dataset row and public-answer cache write behind explicit `TI_ACTOR_DATASET_CONSUMER_WRITES_ENABLED` and `TI_PUBLIC_ANSWER_CACHE_WRITES_ENABLED` gates, reports zero production writes, and emits deterministic held receipts for sellable, caveated, suppressed, and coverage-gap rows. This gives operators a replayable audit packet for the future repository cutover without mutating Apify datasets or answer caches.

`actorDatasetConsumerAuditReplay` persists the same execution receipt into Postgres-style audit rows for future repository cutover as `ti.evidence_actor_dataset_consumer_audit_replay.v1`. The modeled tables are `evidence_actor_dataset_consumer_execution_receipts`, `evidence_actor_dataset_consumer_dataset_receipts`, and `evidence_actor_dataset_consumer_cache_receipts`. Rows contain only execution ids, dataset/cache receipt ids, source-promotion row ids, cache keys, intended actions, held states, blocker reasons, counts, and no-leak flags; there are still no live backend connections or production writes.

`actorDatasetConsumerAuditRepository` adds the disabled repository factory/status as `ti.evidence_actor_dataset_consumer_audit_repository.v1`. It accepts the audit row set, reports the required feature flag and tables, keeps persisted row counts at zero, and holds every row with `actor_dataset_consumer_audit_repository_disabled` until a real Postgres repository is explicitly configured. This gives the Actor/public-answer consumer path a concrete fail-closed persistence boundary without writing Apify datasets, answer caches, or audit tables.

This is the first implementation slice behind the earlier migration/readiness packets. It does not connect to external services, mutate OpenSearch/pgvector/Postgres, or serialize raw bodies, object keys, unsafe URLs, credentials, restricted raw content, private material, or actor-interaction content.

## Object Integrity Repair Runtime
`buildEvidenceObjectIntegrityRepairReport` emits `ti.evidence_object_integrity_repair.v1` and is included on `/v1/evidence/cutover-report` as `objectIntegrityRepair`. It is the operator runbook packet for object-store integrity repair before search/vector index cutover, graph/STIX export, or public answer refresh.

The report composes the search handoff, chain-of-custody report, search consistency SLO, and backup integrity manifest. It lists expected object captures, verified objects, missing objects, hash mismatches, orphan rows, legal-hold objects, metadata-only captures, and restricted captures. Per-object rows include capture/source/tenant IDs, retention class, legal-hold state, content hash, expected/actual SHA-256, replay checkpoint, blockers, and a repair action. Object references are represented only as stable hashes; object keys are never serialized.

The operator runbook is dry-run only. It covers manifest verification, missing-object restore from backup or object-lock version, hash-mismatch quarantine, index/vector/graph/API replay, public-answer refresh after blockers clear, and legal-hold preservation. The report blocks or holds on missing objects, hash mismatch, orphan lineage, metadata-only object refs, legal-hold repair requirements, or search consistency drift. Restricted/leak captures remain metadata-only and can surface defensive metadata such as victim/company, claimed account counts, dataset size, actor statement summaries, source hashes, timestamps, review state, and retention class without exposing raw leaked rows, credentials, unsafe URLs, private material, object keys, or actor-interaction content.

## Retention Runtime Enforcement
`buildEvidenceRetentionRuntimeReport` emits `ti.evidence_retention_runtime_enforcement.v1` and is included on `/v1/evidence/cutover-report` as `retentionRuntime`. It turns retention class, legal hold, redaction, replay, object manifest, index migration, graph, STIX, and API answer state into an enforceable route-safe packet.

The report covers raw captures, extracted text projections, object references, search index documents, vector index decisions, graph relationships, STIX previews, restricted metadata, and API answer refresh. Each surface exposes immutable audit fields only: ids, hashes, hashed object refs, replay checkpoint, cursor, observed time, retention transition, legal-hold state, redaction state, eligibility, blockers, and rollback action.

Legal hold always wins over deletion actions and keeps capture/object/index state preserved. Restricted/leak metadata remains searchable for defensive metadata fields but is excluded from vector embedding and held for graph/STIX export until review gates pass. Redaction repair, restricted raw bodies, missing objects, hash mismatch, cursor replay gaps, parser drift, and export-without-review move API answer refresh to partial/hold and block graph or STIX promotion as needed. The report never serializes raw bodies, object keys, unsafe URLs, credentials, private material, restricted raw content, or actor-interaction content.

## Chain Of Custody
`buildEvidenceChainOfCustodyReport` emits `ti.evidence_chain_of_custody.v1` and is included on `/v1/evidence/cutover-report` as `chainOfCustody`. It is the compact route-visible proof that a user-facing answer or export candidate can be traced from source governance through scheduler/run context, immutable capture/object references, extraction deltas, claim ledger review, graph relationships, API search snapshots, and STIX export previews.

Each custody stage exposes only safe operational proof fields:
- ids for source, run, capture, claim ledger entry, relationship, and stage;
- timestamps, content hashes, hashed object-reference identifiers, parser versions, confidence, review state, retention class, and replay cursor;
- redaction flags proving metadata-only restricted handling and proving raw bodies, object keys, unsafe URLs, restricted material, secrets, and actor interaction are absent;
- previous/next stage links for replay and incident investigation.

The verification section fails closed for missing captures, missing object references, broken object/hash chains, missing relationship captures, missing claim captures, or restricted bodies. It holds for parser-version drift, cursor replay gaps, export/STIX eligibility without trusted review, missing claim ledger coverage, missing graph relationships, missing API snapshots, or redaction repair needs. Restricted/leak sources may contribute defensive metadata to custody stages, but they remain metadata-only and review-held until an analyst explicitly promotes safe claims.

## Repository Boundary
Production implementations should satisfy the same contracts used by the in-memory store:
- `CaptureMetadataStore` for Postgres-backed captures, discovery evidence, live snapshots, evidence deltas, replay jobs, and retention metadata.
- `ObjectEvidenceStore` for object storage writes, reads, and retention deletes.
- `ProductionEvidenceRepository` for transaction-scoped promotion and replay operations.
- `PostgresEvidenceRepository` for transaction-scoped captures, discovery evidence, extraction results, relationship deltas, policy events, redactions, expirations, and snapshots.

The repository boundary keeps tests backend-neutral. Production code must reject duplicate delta cursors, validate promotion references before updating discovery evidence, and write external objects before inserting capture metadata.

Backup/restore drills should emit `EvidenceBackupIntegrityReport` with object counts, hash verification, missing object IDs, orphan rows, retention expiry counts, and rollback notes for Agent 10 alerting.

Cutover rehearsals should emit `EvidenceCutoverRehearsalReport`. It combines reconciliation, object integrity, cursor replay proof, retention state, redaction state, export blockers, compact Agent 09 readiness fields, and Agent 10 promotion-gate fields. `EvidenceReplayProof` must show discovery -> capture -> extraction -> relationship delta -> API cursor polling before scraper-native search promotion is marked ready.

Task R/S add `EvidenceTrustLedgerReport` for soak and public answer gates. The ledger summarizes every claim for a query with stable ledger IDs, source, capture, content hash, extractor version, evidence stage, confidence, graph relationship IDs, review state, retention class, redaction state, replay status, and blockers. Ledger IDs are read from capture metadata keys `evidenceLedgerIds`, `evidenceLedgerId`, `ledgerIds`, `ledgerId`, `trustLedgerIds`, and `trustLedgerId`, with deterministic fallback IDs for older captures. Claims are `trusted`, `degraded`, or `blocked`; missing objects, hash mismatches, unsafe restricted bodies, and missing captures block promotion, while low confidence, metadata-only support, retired/deleted source state, stale extractor replay, or incomplete replay hold it. The compact cutover DTO and dedicated `/v1/evidence/trust-ledger` plus `/v1/evidence/claim-ledger` routes expose this ledger and a since-cursor change summary without raw bodies, object keys, or unsafe restricted metadata. The cursor summary counts added/promoted/downgraded/expired/contradicted/review-required claim changes for replay after restart and answer/graph consumers. Task V adds `enforcement` to the same compact surface: release holds/warnings, dry-run repair packets, public API impact, and Agent 07/08/10 downstream decisions for missing lineage, missing objects, hash mismatch, restricted redaction, cursor replay gaps, retired sources, graph holds, legal hold, duplicate claims, stale extractor replay, and low-confidence claims. Task X adds `certification` to the claim-ledger/cutover/live-search surfaces: route-ready production certification for object store integrity, Postgres-like transaction boundaries and immutable captures, cursor/restart replay, retention and deletion-audit coverage, duplicate suppression, redaction, legal hold, missing-object repair, and downstream Agent 07/08/10 release readiness. Certification fixtures explicitly cover clean cutover, missing object, hash mismatch, stale extractor replay, restricted metadata redaction, retired source, graph hold, low confidence, duplicate claim, cursor gap, retention expiry, legal hold, and object-store write failure.

## Retention Classes
Default classes:
- `discovery_snippet`: search-provider snippets, public-channel snippets, and metadata-only leak claim previews before full capture.
- `live_search_snapshot`: compact polling snapshots that point to discovery evidence, captures, incidents, and graph deltas.
- `evidence_delta`: immutable cursor records for polling state transitions; enough metadata is retained to preserve chain-of-custody after transient live snapshots are pruned.
- `public_report`: public RSS, static web, PDF, or API reports; object body TTL defaults longer than chat.
- `public_chat_text`: public Telegram/channel text; body TTL defaults shorter, metadata and hashes persist.
- `darknet_metadata`: approved Tor/I2P/Freenet metadata-only captures; raw leaked contents are never present.
- `screenshot_hash`: screenshot hashes or image fingerprints; retain hashes, not screenshot bytes unless policy explicitly allows.
- `sensitive_metadata`: sensitive metadata and safe excerpts only.
- `legal_hold`: no automated deletion.

Retention jobs simulate and then enforce deletion actions while preserving hashes and metadata when required. `legalHold` and `legal_hold` captures are excluded from destructive retention actions.

## Production Layout
Postgres should hold operational metadata:
- `raw_captures`: id, tenant_id, source_id, task_id, url, canonical_url, collected_at, published_at, content_hash, normalized_text_hash, media_type, storage_kind, object_ref JSONB, metadata JSONB, sensitive, sensitivity_flags, redaction JSONB, retention_class, legal_hold, provenance JSONB, created_at.
- `discovery_evidence`: provider snippets and metadata-only claims with query, normalized query, result id, observed time, snippet, URL/source/rank, confidence, retention, stale time, and promotion pointers.
- `extraction_results`: durable extractor outputs keyed to immutable captures with extractor/parser/collector versions, incident ID, relationship delta IDs, policy event IDs, and result JSON.
- `live_search_snapshots`: polling snapshots keyed by query/run with discovery evidence IDs, capture IDs, incident IDs, new evidence IDs, status, stale time, and compact metadata.
- `evidence_deltas`: immutable cursor ledger keyed by query/run with delta kind, subject type/id, chain-of-custody IDs for discovery/capture/incident/relationship/policy events, observed time, retention class, stale time, and compact metadata.
- `capture_dedupe_keys`: dedupe_key, capture_id, source_id, key_kind, created_at with a unique index on `dedupe_key`.
- `evidence_object_refs`: capture_id, bucket, object_key, version_id, size_bytes, sha256, media_type, retention_class.
- `capture_replay_jobs`: capture_id, run_id, from/to extractor versions, status, counts, diff summary, and error metadata.
- `retention_jobs`: retention class, action, cutoff, affected capture IDs, status, and completion/error fields.
- `capture_audit`: event_id, capture_id, tenant_id, action, actor_id, occurred_at, metadata JSONB.
- `collection_plans`: analyst-loop request, query, counts, state, planner explanations, and audit trail.
- `collection_tasks`: queued/review/blocked task rows with safe target kind and planning metadata.
- `collection_runs`: run status and counts for `/ti` polling and run summary clarity.
- `metadata_review_tasks`: review inbox rows for leak/threat-actor claims with company/victim, affected accounts, dataset size, actor statement summary, source hash, provenance, allowed actions, confidence, and explicit unsafe-material non-access checks.
- `source_activation_packets`: dry-run-only restore/approval packets with expected effect and rollback notes.
- `source_atlas_activation_packet_audit`: source-atlas repair packet inputs for operator/legal review, including atlas source ids, replacement candidates, prerequisites, forbidden actions, expected payworthy/fresh-row lift, and hard no-mutation/no-crawl/no-activation/no-leak flags.
- `source_atlas_source_pack_candidate_review`: source-atlas source economics pack candidates for operator/legal/source-governance review, including safe source ids/hashes, family, acquisition mode, required proof, expected payworthy/fresh/useful lift, owner handoffs, and hard no-import/no-mutation/no-crawl/no-activation/no-leak flags.
- `victim_notification_packets`: safe redacted notification drafts with confidence, provenance, redactions, and what was not accessed.
- `claim_ledger_entries`: deduplicated metadata claim ledger rows keyed by query/source hash/claim kind/company.
- `analyst_loop_snapshots`: compact polling snapshots for queued/review/blocked/activation/ready state and next-step visibility.

Object storage should hold only allowed raw bodies, HTML, screenshots, and large artifacts. Use content-addressed keys:

```text
evidence/{tenantId|global}/{sourceId}/{yyyy}/{mm}/{dd}/{captureId}/{contentHash}
```

Enable object versioning or object lock where available, server-side encryption, separate KMS keys per tenant for production, backup/restore tests for metadata and objects, and deletion audit rows before object deletion. Metadata-only captures must not create object keys.

The production cutover runbook is in `docs/evidence_cutover_runbook.md`.

## Live Search Promotion
The promotion chain is:

```text
DiscoveryEvidence -> CollectionTask -> RawCapture -> PipelineResult -> Incident/Entity/TTP -> graph/search result
```

Discovery evidence is immutable except for promotion pointers and promotion audit metadata. Polling clients can first receive discovery snippets, then later receive promoted captures and extraction results. The original discovery evidence row remains intact enough to distinguish search-provider snippets from durable evidence.

Every polling-visible state transition should also append an `EvidenceDelta`. Generated cursors sort by event time and insertion order so same-timestamp capture/extraction transitions remain replayable. `getSearchDeltas(query, sinceCursor)`, `getActiveRunEvidence(runId, sinceCursor)`, and `getEvidenceTimeline(query)` are the Agent 09 integration points. Live snapshots can expire quickly, but promoted evidence deltas keep enough IDs to reconstruct chain-of-custody from discovery to capture, extraction, graph relationship, and STIX-eligible export policy event.

`persistTelegramPublicRuntimeEvidence` is the runtime bridge for Agent 04 public-channel handoff. It applies the adapter `sourcePatch`, stores the connector `sourceHealthPatch` on source metadata, writes public-channel evidence rows, promotes safe message text into normal captures/extractions, appends connector-backed new/edited/deleted/unavailable message deltas, appends relationship-promotion deltas for replay proof, and writes a compact live-search snapshot with promotion handoff counts, promoted public message URLs, public message provenance, and partial-evidence-only state. Deleted or unavailable messages remain metadata/cursor-only; media remains metadata-only and no private-channel material or raw media payloads are persisted.

Recommended indexes:
- unique `raw_captures(id)`;
- unique `capture_dedupe_keys(dedupe_key)`;
- `raw_captures(source_id, collected_at desc)`;
- `raw_captures(tenant_id, source_id, collected_at desc)`;
- `raw_captures(tenant_id, retention_class, collected_at)`;
- `raw_captures(tenant_id, legal_hold, retention_class)`;
- `raw_captures(content_hash)`;
- `raw_captures(normalized_text_hash)`.
- `evidence_deltas(tenant_id, normalized_query, cursor)`.
- `evidence_deltas(tenant_id, run_id, cursor)`.
- `evidence_deltas(tenant_id, subject_type, subject_id)`.

Partitioning expectation: start unpartitioned for MVP, then partition `raw_captures` and replay/retention jobs by month or tenant/month once capture volume or retention jobs make vacuum and index maintenance material.
