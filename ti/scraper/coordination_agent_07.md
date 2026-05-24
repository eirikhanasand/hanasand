Status: active_task_ab

## CURRENT ASSIGNMENT - READ FIRST

Task AB: Real-Time Public Answer Delta Contract And Analyst-Grade Freshness Semantics

Own the next public answer layer after Task AA. Do not wait for another prompt. Build the scraper-native contract that lets `hanasand.com/ti` update actor/search results within seconds without refresh while staying compact and honest. The page should start with immediate known context or `Searching`, then progressively merge clear-web captures, public-channel hints, restricted metadata holds, graph deltas, claim-ledger gates, source caveats, and freshness changes as deltas arrive.

Deliver a typed answer-delta model and fixtures for APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, made-up actor, CVE, malware/tool, victim/ransomware, country, sector, provider unavailable, scraper unavailable, queue pressure, no approved sources, policy blocked, restricted held, contradiction, stale source, low confidence, and review-required states. Include stable `runId`, `pollCursor`/`deltaCursor`, `refreshAfterSeconds: 3`, generated `updated` timestamps, observed `lastSeen` only when evidence supports it, compact public copy, no default actor, no local-cache language, no seeded-demo smell, and no bloated policy paragraphs.

Wire this to `/v1/intel/search`, `/v1/quality/evaluate`, `/v1/contracts`, Agent 02 scheduler cursors, Agent 03/04 evidence promotion, Agent 05 restricted holds, Agent 06 claim ledger, Agent 08 graph deltas, Agent 09 public wrapper compatibility, and Agent 10 release board. Verify pipeline/API/full tests, typecheck, route inventory, search-quality mounted proof, scraper-native proof, public POST compatibility fixtures, and a small contract doc explaining how the frontend should poll and merge deltas.

# Agent 07 Summary

- Added `publicTiAnswer.ux` with `ti.public_answer_ux.v1` compact public `/ti` copy, `Searching` unknown-query behavior, 3-second polling hints, source caveats, evidence-stage labels, and public wrapper compatibility fields.
- Clamped public `refreshAfterSeconds` and `nextPollSeconds` hints to seconds-level polling while preserving internal scheduler and run state.
- Added explicit freshness semantics: `Updated` is response-generation time, and `Last seen` is shown only when evidence supplies an observed timestamp.
- Removed bloated partial and blocked public summary prose, and added APT42 alias support for public actor queries.
- Published UX semantics, fixture matrix, banned-copy rules, no-default-query rule, and public POST compatibility from `/v1/contracts`.
- Expanded API assertions for contract fixtures, compact copy, no local-cache/default-APT29 copy, 3-second polling, searching state, freshness, and no-result behavior.
- Verified `bun test`, `bun run check`, `bun run check:route-inventory`, `bun run check:search-quality-mounted`, and `bun run check:scraper-native-search` are green.
- Superseded by active Task AB above; do not request another assignment until Task AB proof is complete.
