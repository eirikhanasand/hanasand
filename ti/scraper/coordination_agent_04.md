Status: active_program_bi_actor_source_coverage_expansion

# Agent 04 Coordination

## Current Assignment - Program BI: Actor Source Coverage Expansion

You are no longer requesting a task. Continue the public-channel/source-coverage lane until the scraper can explain which source families cover each high-value actor, what is missing, and which safe source activations will improve the Apify/public product.

Mission:
- Build a buyer-useful coverage expansion layer for at least 30 configured actors/groups, with public-only and metadata-only source families mapped per actor.
- Turn source gaps into concrete upstream work for Agents 01/02/03/05 and downstream quality/graph/API handoffs for Agents 07/08/09.
- Keep the product practical: this should improve live results for actor searches, not create abstract taxonomy bloat.

Build:
- Add/update actor coverage fixtures for APT29, APT42, Sandworm, Volt Typhoon, Salt Typhoon, Lazarus, Kimsuky, Charming Kitten, MuddyWater, OilRig, FIN7, TA505, Scattered Spider, LockBit, Akira, Cl0p, Play, BlackSuit, RansomHub, Qilin, Medusa, DragonForce, 8Base, Hunters International, BianLian, ALPHV/BlackCat, Royal, Conti legacy, DarkSide/BlackMatter legacy, and one unknown-query control.
- For each actor, expose required source families, currently covered families, stale families, blocked/restricted metadata families, public advisory/blog/news/channel value, dark metadata caveat state, and next safe activation tasks.
- Add freshness expectations by actor class: high-volume ransomware/public extortion groups should not show old-only recent activity as fresh; APT groups need corroborated reports, advisories, malware/tool/TTP changes, or public campaign updates.
- Route output into the public product surface without raw URLs, raw leaked data, private-channel claims, actor interaction, credentials, payload links, or auth/CAPTCHA behavior.
- Coordinate with Agent 09 so the Apify Actor can surface compact `sourceCoverageGaps` and `coverageStatus` fields that help buyers understand why a result is partial.

Proof before status change:
- `bun run check`
- `bun test src/tests/publicSignalFusion.test.ts src/tests/publicAdvisory.test.ts src/tests/api.test.ts`
- `bun run check:route-inventory`
- `bun run check:contract-index`
- `bun run check:api-regression`
- update `docs/source_registry.md` or `docs/operations.md` if contracts move

If this phase completes, continue immediately into Program BJ: public-channel freshness scoring and source economics for the highest-value marketplace queries.

## Prior Completed Slice

- Added a runtime bridge from `PublicAdvisoryAdapter` `CollectedItem` output into connector-ready `PublicAdvisorySignalRecord` rows, preserving source id, family, entities, confidence, reliability, state, safe policy flags, timestamps, and parser provenance.
- Proved captured GitHub Security Advisory and CISA/KEV-style records can flow into `buildPublicAdvisorySignalConnector` and `buildPublicAdvisoryCorrelation` for ranked, evidence-backed actor/CVE signals and reviewable conflict output.
- Kept Agent 04 safety boundaries intact: public/official API or public HTTP only, no private repo access, no auth/CAPTCHA bypass, no payload download, no leaked-data redistribution, no private channels, and unsafe URLs hash/suppress before public output.
- Verification passed for `bun test src/tests/publicAdvisory.test.ts`, `bun test src/tests/publicSignalFusion.test.ts`, full `bun test` with 521 passing tests, and `bun run check`.
