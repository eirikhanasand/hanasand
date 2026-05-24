Status: active_task_aa

## CURRENT ASSIGNMENT - READ FIRST

Task AA: Incremental Graph Updates For Live Search

Build incremental graph/STIX behavior for responsive live search. Do not wait for another prompt. As clear-web and public-channel evidence arrives, graph relationships should update with provenance and review state; weak discovery provides pivots and caveats, not confident exported facts. Cover APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, CVE exploitation, random actor, weak co-mentions, restricted-held evidence, public-channel-only hints, missing ledger IDs, stale/contradicted relationships, missing provenance, accepted promotion, and STIX export eligibility. Wire to `/v1/graph/query`, `/v1/graph/review-plan`, `/v1/exports/stix`, `/v1/intel/search.graph`, `/v1/contracts`, Agent 06, Agent 07, Agent 09, and Agent 10. Preserve TAXII descriptor-only boundaries. Verify graph/API/export/full tests, typecheck, route inventory, graph mounted proof, STIX proof, and no unsupported TAXII server claims.

# Agent 08 Status

- Added final `GraphReleaseCandidateGateDto` inside graph/STIX certification packets with pass/hold/rollback RC decisions, required/covered/missing scenarios, public API/STIX impact, TAXII descriptor-only boundary, and Agent 10 `graphStixReleaseCandidateGate` proof metadata.
- Extended graph/STIX certification fixtures for missing provenance and contradicted relationships alongside APT29, Scattered Spider, Akira, Turla, CVE exploitation, weak co-mentions, restricted-only evidence, missing ledger IDs, schema risk, stale relationships, and analyst-reviewed promotion.
- Wired RC gate metadata through graph runtime, `/v1/graph/query`, `/v1/graph/review-plan`, `/v1/exports/stix`, `/v1/intel/search.graph`, and `/v1/contracts`.
- Preserved TAXII as descriptor-only metadata with no unsupported TAXII server claims.
- Updated graph/API/export tests and export docs for RC gates, proof routes, scenario coverage, and Agent 10 release-train fields.
- Verified `bun test`, `bun run check`, `bun run check:graph-review-mounted`, `bun run check:route-inventory`, and focused graph/API/export tests are green.

Superseded by active Task AA below; do not request another assignment until Task AA proof is complete.

## Main-Agent Task 2026-05-24 AA: Incremental Graph Updates For Live Search

Own graph/STIX behavior for responsive live search. As clear-web and public-channel evidence arrives, graph relationships should update incrementally with provenance and review state; weak discovery should provide pivots and caveats, not confident exported facts.

Deliver fixtures for APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, CVE exploitation, random actor, weak co-mentions, restricted-held evidence, public-channel-only hints, missing ledger IDs, stale relationships, contradicted relationships, missing provenance, accepted promotion, and STIX export eligibility. Wire incremental relationship deltas into `/v1/graph/query`, `/v1/graph/review-plan`, `/v1/exports/stix`, `/v1/intel/search.graph`, `/v1/contracts`, Agent 06 claim ledger, Agent 07 answer caveats, Agent 09 contract index, and Agent 10 release gates. Preserve TAXII descriptor-only boundaries. Verify graph/API/export/full tests, typecheck, route inventory, graph mounted proof, STIX proof, and no unsupported TAXII server claims.
