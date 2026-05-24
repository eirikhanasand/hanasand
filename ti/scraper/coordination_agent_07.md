Status: active_task_aa

## CURRENT ASSIGNMENT - READ FIRST

Task AA: Public Answer UX Semantics Without Demo Or Cache Smell

Build scraper-native answer semantics for public `/ti`. Do not wait for another prompt. Enforce: no default APT29, no local-cache prose, no bloated policy paragraph, no stale last-seen fiction, compact `Searching` for truly unknown/no-result states, immediate compact partial summary for known or source-supported actors, and update-by-polling in seconds. Cover ready, partial, searching, no-result, provider unavailable, scraper unavailable, queue pressure, review-required, stale, contradicted, source-biased, policy-blocked, and restricted-held states across APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, CVE, malware/tool, country, sector, and victim queries. Wire to `/v1/intel/search`, `/v1/quality/evaluate`, `/v1/contracts`, Agent 09, and Agent 10. Verify pipeline/API/full tests, typecheck, route inventory, search-quality, scraper-native proof, and public POST compatibility.

# Agent 07 Summary

- Added `publicTiAnswer.releaseCandidate` with `ti.public_answer_release_candidate.v1` release states for ready, canary-ready, canary-with-warnings, partial, review-required, blocked, no-result, stale, contradicted, source-biased, provider-unavailable, scraper-unavailable, and policy-blocked answers.
- Mapped source canary, scheduler control plane, public-channel promotion, restricted emergency-stop, evidence cutover, graph export, and API contract state into visible-answer effects and Agent 10 RC gate decisions.
- Published release-candidate UI fields, fixture matrix, query-class coverage, public POST compatibility guarantees, and Agent 10 proof commands from `/v1/contracts`.
- Wired the release-candidate contract through `/v1/intel/search` and `/v1/quality/evaluate` via the shared `publicTiAnswer` shape.
- Expanded API assertions for the release-candidate contract, fixture corpus, route fields, public wrapper compatibility, no-result behavior, and no-leak guarantees.
- Hardened public-channel promotion certification against non-array matcher-like DTO fields while preserving source-health rollback/caveat semantics.
- Verified `bun test`, `bun run check`, `bun run check:route-inventory`, `bun run check:search-quality-mounted`, and `bun run check:scraper-native-search` are green.

Superseded by active Task AA below; do not request another assignment until Task AA proof is complete.

## Main-Agent Task 2026-05-24 AA: Public Answer UX Semantics Without Demo Or Cache Smell

Own scraper-native answer semantics for the public `/ti` page and wrapper. The public product requirement is direct: no default APT29, no “not in local cache” prose, no bloated policy paragraph, no stale last-seen fiction, and no hours-long wait before an actor summary appears. Unknown queries may say only `Searching`; known or source-supported actor queries should show compact summary immediately and update through polling.

Deliver contract fixtures for ready, partial, searching, no-result, provider-unavailable, scraper-unavailable, queue-pressure, review-required, stale, contradicted, source-biased, policy-blocked, and restricted-held states across APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, CVE, malware/tool, country, sector, and victim queries. Expose compact answer copy, freshness semantics, `updated` vs `last seen`, 3-second polling hints, source caveats, and evidence-stage labels through `/v1/intel/search`, `/v1/quality/evaluate`, `/v1/contracts`, Agent 09 public wrapper compatibility, and Agent 10 release gates. Verify pipeline/API/full tests, typecheck, route inventory, search-quality proof, scraper-native proof, and public POST compatibility.
