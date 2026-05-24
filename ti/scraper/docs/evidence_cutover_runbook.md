# Evidence Persistence Cutover Runbook

## Scope
This runbook moves Agent 06 evidence storage from in-memory/dev stores to Postgres metadata plus object storage while keeping replay, cursor polling, retention, and safe DTO behavior testable through the same TypeScript contracts.

## Repository Contracts
Production storage should implement the contracts in `src/storage/evidenceStore.ts`:
- `CaptureMetadataStore`: captures, discovery evidence, live snapshots, evidence deltas, replay jobs, and query helpers.
- `ObjectEvidenceStore`: allowed raw bodies and large artifacts only. Sensitive/leak captures remain metadata-only and must not create object keys.
- `ProductionEvidenceRepository`: transaction wrapper for multi-row operations such as discovery promotion, capture/extraction persistence, replay completion, and retention job checkpoints.
- `PostgresEvidenceRepository`: Postgres-oriented boundary for transaction-scoped capture writes, discovery promotion, extraction results, relationship deltas, policy events, redactions, expirations, and snapshots.
- `EvidenceBackupIntegrityReport`: Agent 10 drill output with expected object count, verified object count, missing object IDs, hash mismatches, orphan rows, retention expiry counts, and rollback notes.
- `EvidenceCutoverRehearsalReport`: Agent 06 rehearsal bundle combining evidence reconciliation, object integrity, cursor replay proof, retention state, redaction state, export blockers, Agent 09 readiness fields, and Agent 10 promotion-gate fields.
- `EvidenceReplayProof`: compact proof that a live query can replay from discovery evidence through capture, extraction, relationship delta, and API cursor polling.

Postgres owns metadata tables. Object storage owns allowed raw bodies/HTML/screenshots/artifacts. Query helpers must behave like `InMemoryEvidenceQueries` before API traffic is switched.

## Cutover Steps
1. Freeze writes to the in-memory/dev backend for the tenant or environment being cut over.
2. Export captures, discovery evidence, live snapshots, evidence deltas, replay jobs, and retention jobs from the current store.
3. Insert metadata into Postgres in dependency order: `raw_captures`, `capture_dedupe_keys`, `evidence_object_refs`, `discovery_evidence`, `live_search_snapshots`, `evidence_deltas`, `capture_replay_jobs`, `retention_jobs`.
4. Upload allowed raw/external objects to object storage using content-addressed keys. Do not upload metadata-only sensitive/leak evidence.
5. Verify every raw capture hash, normalized text hash, object SHA-256, object size, and dedupe key against the exported source data.
6. Verify every evidence delta cursor is unique and strictly replayable by `(tenant_id, normalized_query, cursor)` and `(tenant_id, run_id, cursor)`.
7. Verify promotion lineage: discovery evidence points to existing capture/incident IDs, and promoted captures preserve the original discovery ID in metadata or delta lineage.
8. Generate an `EvidenceBackupIntegrityReport` and resolve missing objects, hash mismatches, orphan rows, and rollback notes before switching reads.
9. Generate an `EvidenceCutoverRehearsalReport` for representative live queries. Agent 09 consumes `promotionGate.agent09Fields`; Agent 10 consumes `promotionGate.agent10Fields` and `promotionGate.blockers`.
10. Run retention dry runs for each retention class. Confirm legal-hold captures and legal-hold classes are excluded from destructive actions.
11. Run query parity checks against the new repository: latest captures, provenance by result ID, active-run evidence by cursor, search deltas, evidence timeline, replay status, freshness, and redaction summaries.
12. Restart the repository process and replay cursor deltas from the last known cursor to verify ordering survives restart.
13. Rebuild stale live snapshots from durable deltas before switching reads.
14. Switch read traffic to Postgres/object storage. Keep writes frozen until smoke tests pass.
15. Switch writes to the production repository transaction boundary.
16. Keep the old export sealed until backup/restore, retention dry run, and cursor replay checks have passed for at least one full polling interval.

## Failure Modes
- Duplicate cursor write: reject the write and preserve the existing delta row.
- Partial promotion failure: roll back discovery promotion pointers unless the referenced capture and incident rows are already durable.
- Object-store write failure: fail before inserting capture metadata for external-object captures.
- Retention interruption: mark the retention job failed with a checkpoint/audit trail and leave unapplied captures unchanged.
- Sensitive/leak source regression: reject any write that attempts to persist body/object bytes for metadata-only evidence.
- Duplicate capture hash: suppress the second write through the capture dedupe path before object metadata is exposed to readers.
- Restart cursor replay: deltas must remain replayable from stored cursor strings; regenerated process-local sequence numbers must not be required to resume polling.
- Stale snapshot rebuild: a stale snapshot is a hold for Agent 09 until durable deltas rebuild API-visible state.
- Graph export block: blocked, contradicted, or downgraded relationship deltas hold promotion until Agent 08/analyst review clears export readiness.

## Backup And Restore Checks
Agent 10 should alert on missing object backups, restore hash mismatches, stalled retention jobs, duplicate cursor conflicts, and legal-hold deletion attempts. Restore drills should replay deltas from a saved cursor and confirm API-visible polling state is identical before and after restore.
