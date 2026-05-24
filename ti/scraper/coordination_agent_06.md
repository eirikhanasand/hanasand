Status: active_task_aa

## CURRENT ASSIGNMENT - READ FIRST

Task AA: Durable Evidence Backend And Object Store Cutover

Move the evidence layer from useful in-memory/file fixtures toward a production-ready persistence boundary. This is a multi-day enterprise storage program, not a small ticket.

Scope:
- Own a durable evidence backend interface that can support Postgres/object-store deployment later while keeping Bun tests deterministic now.
- Model immutable raw public captures separately from extracted intelligence: capture metadata, content hash, canonical URL, fetch state, source id, run id, tenant id, timestamps, parser profile, redaction status, and provenance.
- Add object-store style contracts for public HTML/text/PDF snapshots and screenshot hashes without requiring binary blob writes in tests.
- Add claim ledger persistence for victim/company claims, actor claims, CVE claims, malware/tool claims, TTP claims, and source conflict/contradiction records.
- Preserve restricted metadata safety: metadata-only records, hash-only unsafe source identifiers, no raw leaked files, no credentials, no object keys, no private content, no actor interaction.
- Wire read models that API/search can use without knowing whether storage is memory, file-backed, or future Postgres/object-store.
- Add migration docs and tests proving idempotent writes, duplicate capture handling, replay, retention metadata, legal hold metadata, and no-leak serialization.

Proof requirements:
- Add or extend storage tests for durable evidence replay, capture dedupe, claim ledger persistence, analyst review state, and cross-run provenance.
- Keep existing search useful-answer measurements green.
- Run `bun run check`, targeted storage/API tests, and full `bun test` when touching shared store contracts.
- Update this file with progress, changed files, proof commands, and remaining integration needs.

Progress 2026-05-24:
- Extended `FileBackedScraperStore` snapshots to persist and rehydrate evidence deltas, analyst metadata review tasks, source activation packets, victim notification packets, analyst claim-ledger entries, and analyst-loop snapshots.
- Added replay-job snapshot hydration so completed extractor replay state, diff metadata, and immutable-capture replay guarantees survive file-backed restarts.
- Added storage cutover coverage proving file-backed restart replay for replay jobs, evidence cursors, and metadata-only analyst claim workflow rows without unsafe material.
- Product usefulness measurement remains green: cold/on-demand search and captured clear-web search both show 100% useful-answer rate and 1.0 average expected fact recall; restricted metadata-only leak claims expose defensive metadata fields only.

Changed files:
- `src/storage/fileBackedScraperStore.ts`
- `src/tests/storageCutover.test.ts`
- Existing search usefulness work remains in `scripts/measure-search-product.ts`, `src/api/server.ts`, `src/pipeline/intelligenceProfiles.ts`, and `src/pipeline/actorProfileFusion.ts`.

Proof commands:
- `bun run measure:search-product`
- `bun run check`
- `bun test src/tests/storageCutover.test.ts src/tests/storage.test.ts`
- `bun test`

Remaining integration needs:
- Continue Task AA with object-store manifest/export-import contracts, deeper Postgres/object-store repository cutover fixtures, and broader API read-model coverage across memory/file-backed/future durable stores.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AB: Claim Ledger API And Analyst Review Persistence

Expose API-ready read/write contracts for claim review: promote, hold, contradict, mark duplicate, attach provenance, attach confidence, set retention/legal-hold status, and emit graph/STIX eligibility. Make it safe for frontend analyst workflows and background workers.

Task AC: Evidence Retention, Replay, And Disaster Recovery Contract

Build retention and replay contracts for enterprise operation: point-in-time replay of public captures, hash verification, retention class enforcement, legal hold preservation, redaction repair replay, and disaster-recovery export/import manifests.
