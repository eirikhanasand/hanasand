Status: active_task_ae

## CURRENT ASSIGNMENT - READ FIRST

Task AE: Production Graph Investigation Workspace And Relationship Confidence Ledger

Move the graph lane from export/readiness contracts into an analyst-usable production graph backend contract. This is a large enterprise workstream; keep working until contracts, fixtures, docs, tests, and coordination notes are complete.

Scope:
- Define an investigation workspace DTO for CTI analysts: actor, victim/company, malware/tool, CVE, campaign, infrastructure, TTP, source, capture, claim, and incident nodes with provenance-aware edges.
- Add a relationship confidence ledger that records why an edge exists, which evidence supports it, which sources disagree, which claims are stale, which graph facts are blocked by review, and which are eligible for STIX/TAXII export.
- Build query contracts for graph expansion from arbitrary search terms such as `APT29`, `APT42`, ransomware actor names, CVEs, malware/tool names, victims, sectors, countries, and infrastructure pivots.
- Add compact graph delta polling semantics compatible with Agent 09 public wrapper cursors and Agent 07 progressive answer states.
- Add review actions for promote, hold, reject, mark stale, merge duplicate, split alias collision, attach contradiction, and export-ready.
- Keep restricted metadata and leak-site claims as review-held pivots until Agent 06 claim ledger and analyst approval promote them. No raw URLs, credentials, leaked datasets, screenshots, or private-content references may enter graph output.
- Coordinate with Agent 06 on claim/evidence IDs, Agent 07 on confidence language, Agent 09 on route DTO stability, and Agent 10 on release gates.

Proof requirements:
- Add fixtures for APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira/ransomware, a CVE/advisory query, a malware/tool query, and an unknown/random actor.
- Add tests for relationship confidence, contradiction handling, stale edge suppression, review transitions, export eligibility, cursor deltas, tenant isolation, no-leak serialization, and graph query DTO stability.
- Update graph/export docs and `coordination.md` with changed contract surfaces.
- Run `bun run check`, focused graph/API/export tests, route inventory, and contract index if surfaces change.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AF: Graph Backend Cutover Rehearsal And Migration Plan

Design the migration path from in-memory graph DTOs to a production backend such as Postgres graph tables or Neo4j-compatible storage. Include schema sketches, replay/import from evidence ledger, export eligibility replay, tenant isolation, backup/restore, and rollback.

Task AG: ATT&CK Technique Timeline And Campaign Graph

Build a timeline-oriented graph contract showing how actors, campaigns, malware/tools, CVEs, infrastructure, sectors, and victims evolve over time. Include ATT&CK technique freshness, deprecated/revoked technique holds, and analyst review semantics.
