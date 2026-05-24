Status: active_task_ac

## CURRENT ASSIGNMENT - READ FIRST

Task AC: Extraction Evaluation Dashboard And Field-Level Quality Gates

Build the quality layer that tells analysts and operators whether scraper output is actually useful. This should make actor queries reliable, current, and explainable instead of merely returning text.

Scope:
- Define field-level quality gates for actor summary, aliases, recent activity, targets, sectors, countries, tools, malware, CVEs, TTPs, campaigns, infrastructure, datasets, victim/company claims, IOCs, confidence, freshness, and provenance.
- Add evaluation fixtures for APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, LockBit-style ransomware, CVE/advisory queries, malware/tool queries, and unknown/random actor queries.
- Track useful-answer rate, expected fact recall, stale-fact suppression, contradiction handling, source-family diversity, evidence count, confidence bands, citation availability, and freshness per field.
- Emit API-ready dashboard DTOs that Agent 09 can expose compactly and Agent 10 can use in release gates.
- Feed low-quality states back into source activation, parser repair, graph review holds, and analyst review queues.
- Keep language honest: if the system is searching, say `Searching`; if partial, explain which fields are fresh/old/low-confidence without demo prose or cache-scented filler.

Proof requirements:
- Add targeted tests for field-level gates, stale recent-activity suppression, contradiction flags, query cross-talk, random actor behavior, and no raw unsafe evidence in quality DTOs.
- Update docs with quality gate definitions and dashboard semantics.
- Run `bun run check`, focused quality/API tests, and route inventory if route contracts change.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AD: Entity Resolution And Actor Profile Workbench

Build entity resolution contracts for actor aliases, ransomware rebrands, company/victim normalization, country/sector mapping, malware/tool aliases, CVE mentions, and infrastructure dedupe. Expose review states and confidence reasons so analysts can correct bad merges.

Task AE: Recent Activity And Timeliness Ground Truth Harness

Build a timeliness harness that prevents stale actor activity from looking current. It should score latest-source dates, source freshness, field freshness, query-class expectations, and gaps for high-activity actors like APT29 where no credible result should claim old activity is latest.
