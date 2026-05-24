Status: active_task_ae

## CURRENT ASSIGNMENT - READ FIRST

Task AE: Enterprise Source Coverage And Gap Radar

Build the coverage radar that tells analysts and operators what public collection is missing and what source families should be added next.

Scope:
- Report actor/source-family gaps, sector/country gaps, stale sources, missing advisory families, missing malware/tool feeds, weak ransomware coverage, weak CVE/advisory coverage, and query classes with poor useful-answer rate.
- Convert gaps into task-ready recommendations for Agent 01 onboarding, Agent 02 scheduling cadence, Agent 03 parser repair, Agent 06 evidence persistence, Agent 07 quality gates, Agent 08 graph pivots, Agent 09 API fields, and Agent 10 SLO monitoring.
- Include public-only source-pack recommendations with trust, freshness, family diversity, parser support, expected evidence yield, legal/robots review age, and activation readiness.
- Include conflict indicators where public advisories disagree on attribution, CVE exploitation, campaign timing, or sector/victim claims.
- Keep recommendations dry-run and safe-public only. Restricted metadata can appear only as review-held context, never as public coverage.

Proof requirements:
- Add fixtures for APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, CVE/advisory, malware/tool, country, sector, victim/company, unknown actor, stale source, parser-gap source, and duplicate source.
- Add tests for gap scoring, source-pack recommendations, stale suppression, conflict handoff, API-safe output, and no-leak serialization.
- Update public source docs and `coordination.md`.
- Run `bun run check`, focused public-signal/API tests, route inventory, and contract index if surfaces change.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AF: Public Signal Source Pack Expansion

Build larger safe-public source packs for APT, ransomware, CVE/advisory, malware/tool, country, sector, campaign, infrastructure, and victim/company searches. Include source-family diversity, stale-source suppression, dedupe keys, onboarding recommendations, and parser capability labels.

Task AG: Public Advisory Correlation And Conflict Handling

Add correlation logic for public advisories and security signals that disagree on actor attribution, CVE exploitation, campaign timing, victim sector, or malware/tool naming. Emit contradiction DTOs for Agent 07 quality gates and Agent 08 graph review holds.
