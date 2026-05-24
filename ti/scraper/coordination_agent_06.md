Status: active_task_z

## CURRENT ASSIGNMENT - READ FIRST

Task Z still active: Evidence Cutover Promotion Gate And Backup-Restore Drill

Finish evidence cutover promotion gates and backup/restore drills. Do not wait for another prompt. Convert certification into final dry-run promotion gates for raw capture storage, object integrity, Postgres-like repository migration, replay, retention, deletion audit, redaction, legal hold, and claim-ledger promotion. Include clean promotion, missing object, hash mismatch, object-store write failure, stale extractor replay, retired source, duplicate claim, cursor gap, restricted redaction, graph hold, legal hold, retention expiry, and restore drill fixtures. Wire to `/v1/evidence/claim-ledger`, `/v1/evidence/cutover-report`, `/v1/contracts`, `/v1/intel/search.claimLedger`, Agent 07, Agent 08, Agent 09, and Agent 10. Verify storage/evidence/API/full tests, typecheck, route inventory, mounted evidence proof, contract-index, and cutover rehearsal/plan.

# Agent 06 Summary

- Added raw evidence contracts for retention classes, sensitivity flags, content hashes, object references, redaction decisions, legal hold, capture provenance, dedupe keys, and replayable pipeline inputs.
- Added object-store/Postgres repository interfaces, production transaction boundaries, in-memory object evidence support, and replay-job persistence.
- Extended the in-memory scraper store with immutable capture writes, duplicate suppression, metadata-only enforcement for sensitive/leak captures, replay reconstruction/results, discovery/live-search evidence, immutable cursor deltas, promotion validation, retention simulation, and evidence query helpers.
- Added discovery, live-search snapshot, cursor delta, backup integrity, and cutover rehearsal contracts covering Agent 09 cursor readiness and Agent 10 promotion-gate/object-integrity fields.
- Added compact `/v1/evidence/replay-plan` and `/v1/evidence/cutover-report` DTOs and mounted API routes with pass, stale snapshot hold, missing object hold, restricted metadata redaction, and graph export blocker examples.
- Added runtime public-channel evidence persistence via `persistTelegramPublicRuntimeEvidence`: applies Agent 04 source cursor patches, stores connector source-health metadata, persists public-channel discovery rows, promotes safe message text into captures/extractions, appends connector-backed new/edited/deleted/unavailable cursor deltas, writes relationship-promotion deltas, and emits replayable live-search snapshots without raw media or private-channel material.
- Added Task R/S evidence trust ledger contracts via `EvidenceTrustLedgerReport` and compact cutover DTO `trustLedger`: stable ledger IDs from Agent 07 metadata keys with deterministic fallback, claim-level source/capture/hash/extractor/evidence-stage/confidence provenance, graph relationship IDs, review state, retention/redaction state, replayability, duplicate claim suppression, since-cursor promoted/downgraded/expired/redacted/blocked/contradicted counts, missing-object/hash/redaction/source-retirement/stale-extractor blockers, and safe-output guarantees for public answer and soak gates.
- Added Task T claim-ledger API/persistence cutover surface: dedicated non-mutating `GET /v1/evidence/trust-ledger` DTO/contract, mounted endpoint proof, compact object-integrity/redaction/cutover links, safe-output guarantees, min-confidence query support, and proof docs.
- Added Task U claim-ledger route proof and replay semantics: `GET /v1/evidence/claim-ledger` alias for Agent 07/08 consumers, mounted safe provenance proof, cursor counts for added/promoted/downgraded/expired/contradicted/review-required claim deltas, and cutover fixtures for restart replay, duplicate suppression, retired sources, missing objects, hash/redaction/graph holds, and legal-hold state.
- Added Task V evidence-ledger enforcement for claim promotion holds: compact `enforcement` state on claim-ledger/cutover/live-search claimLedger surfaces, release holds/warnings, dry-run repair packets, public API impact, and Agent 07 answer, Agent 08 graph export, and Agent 10 release-packet downstream decisions.
- Added Task X evidence persistence cutover/replay certification: compact `certification` DTOs on claim-ledger, cutover-report, live-search SLA, and `/v1/contracts`, covering object-store integrity, Postgres-like repository boundaries, cursor/restart replay, retention/deletion audit, duplicate suppression, redaction, legal hold, repair fixtures, and Agent 07/08/10 release decisions.
- Added/expanded storage, API, runtime evidence, and mounted Bun smoke tests covering immutability, dedupe, tenant isolation, sensitive redaction, provenance chains, polling/replay, retention, object refs, SQL indexes, cutover readiness, public-channel connector handoff persistence, trust-ledger gating, and safe DTO behavior.
- Added/expanded evidence migrations and docs for storage design, API contracts, cutover runbooks, endpoint proof commands, runtime public-channel persistence, trust-ledger gates, retention jobs, replay queues, backup/restore, deletion audit, and partitioning expectations.
- Verified `bun test` and `bun run check` are green.
- Verified `bun run check:route-inventory`, `bun run check:contract-index`, and `bun run rehearse:cutover examples/cutover-rehearsal-pass.json` are green.

Superseded by active Task Z below; do not request another assignment until Task Z proof is complete.

## Main-Agent Task 2026-05-24 Z: Evidence Cutover Promotion Gate And Backup-Restore Drill

Own evidence cutover promotion gates and backup/restore drills. Convert Task X certification into a final dry-run promotion gate for raw capture storage, object integrity, Postgres-like repository migration, replay, retention, deletion audit, redaction, legal hold, and claim-ledger promotion.

Deliver fixtures for clean promotion, missing object, hash mismatch, object-store write failure, stale extractor replay, retired source, duplicate claim, cursor gap, restricted redaction, graph hold, legal hold, retention expiry, and restore drill. Wire into `/v1/evidence/claim-ledger`, `/v1/evidence/cutover-report`, `/v1/contracts`, `/v1/intel/search.claimLedger`, Agent 07 public answer state, Agent 08 graph/STIX certification, Agent 09 contract index, and Agent 10 RC gates. Verify storage/evidence/API/full tests, typecheck, route inventory, mounted evidence proof, contract-index proof, and cutover rehearsal/plan compatibility.
