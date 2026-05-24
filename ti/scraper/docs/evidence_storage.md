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
