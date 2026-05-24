Status: active_task_ab

## CURRENT ASSIGNMENT - READ FIRST

Task AB: Claim Ledger API And Analyst Review Persistence

Expose API-ready read/write contracts for claim review across public evidence and restricted metadata. This is the storage backbone for analyst trust.

Scope:
- Add claim review contracts for promote, hold, contradict, mark duplicate, mark stale, attach provenance, attach confidence, attach legal hold, set retention, and emit graph/STIX eligibility.
- Support actor claims, victim/company claims, CVE claims, malware/tool claims, campaign claims, TTP claims, sector/country claims, dataset claims, and infrastructure claims.
- Preserve storage abstraction parity: memory, file-backed, and future Postgres/object-store read models should expose the same API-safe DTOs.
- Wire to Agent 01 governance, Agent 05 restricted workflow, Agent 07 quality gates, Agent 08 graph confidence ledger, Agent 09 API contracts, and Agent 10 release gates.
- No raw restricted material, credentials, object keys, private content, or unsafe URLs may enter the ledger or API output.

Proof requirements:
- Add storage/API tests for claim review transitions, idempotent writes, duplicate detection, contradiction state, legal hold, retention, replay, file-backed restart, and no-leak serialization.
- Update evidence storage docs and `coordination.md`.
- Run `bun run check`, focused storage/API tests, search product measurement, and full tests when shared storage contracts change.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AC: Evidence Retention, Replay, And Disaster Recovery Contract

Build retention and replay contracts for enterprise operation: point-in-time replay of public captures, hash verification, retention class enforcement, legal hold preservation, redaction repair replay, and disaster-recovery export/import manifests.

Task AD: Evidence Search Index And Vector Handoff Boundary

Define the evidence-to-search boundary for OpenSearch/vector backends without binding the scraper to one vendor. Include document shape, redaction guarantees, embedding eligibility, citation spans, replay IDs, freshness fields, and tenant isolation.

Task AE: Immutable Evidence Provenance And Chain Of Custody

Build chain-of-custody DTOs for capture creation, extraction, review, graph promotion, STIX export, retention, legal hold, and deletion/expiry events.
