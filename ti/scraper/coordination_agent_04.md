Status: active_task_ac

## CURRENT ASSIGNMENT - READ FIRST

Task AC: Public Advisory And GitHub Security Signal Connector Layer

Build the enterprise public-signal connector layer for advisory-grade CTI. This should make random actor, malware, CVE, campaign, and tool searches feel responsive from approved public sources, not only cached actor profiles.

Scope:
- Add connector contracts for public advisories and public code/security signals: CISA/known-exploited style advisories, CERT/government advisories, vendor security blogs, GitHub Security Advisories-style records, public malware/research feeds, and curated public report indexes.
- Implement a source-family abstraction that can rank and merge signals across advisories, public repos, vendor reports, public channels, and static web captures without duplicating evidence.
- Support actor, malware/tool, CVE, campaign, sector, country, and victim/company query classes. The result should prioritize fast initial summaries while deeper collection continues.
- Emit provenance-rich, API-ready deltas with family, source id, title, canonical URL, published/observed time, confidence, reliability score, language, region, tags, matched entities, and dedupe keys.
- Add policy guards: public-only, no auth bypass, no private repo access, no CAPTCHA solving, no scraping terms-bypass, no exploit payload download, no leaked data redistribution.
- Wire connector outputs into existing public signal fusion/status DTOs so Agent 06 can persist evidence, Agent 07 can extract entities/TTPs, Agent 08 can graph eligible facts, and Agent 09 can expose stable API fields.

Proof requirements:
- Add fixtures for at least APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, a CVE query, a malware/tool query, and an unknown/random actor query.
- Add tests for dedupe, ranking, unavailable sources, policy-disabled sources, stale advisories, edited records, and cross-family merge behavior.
- Update docs with source onboarding rules and operational caveats.
- Run `bun run check`, targeted tests, and route inventory if contracts/routes change.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AD: Analyst Public Source Workbench UX Contract

Design and implement the backend contract for an analyst workbench that explains why a public source was trusted, suppressed, merged, stale, duplicated, or sent to review. Include actions for approve, disable, lower trust, raise cadence, mark duplicate, and request parser repair.

Task AE: Enterprise Source Coverage And Gap Radar

Build a coverage radar that reports actor/source-family gaps, sector/country gaps, stale sources, missing advisory families, and query classes with poor useful-answer rate. It should produce task-ready recommendations for Agent 01 source onboarding and Agent 10 SLO monitoring.
