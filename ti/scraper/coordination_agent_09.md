Status: active_task_aa

## CURRENT ASSIGNMENT - READ FIRST

Task AA: Public Wrapper Contract For Responsive Search

Build the `/v1` and public wrapper contract required by `hanasand.com/ti`. Do not wait for another prompt. Public behavior must match the deployed correction: no default actor, no stale-cache copy, compact `Searching` for unknown/no-result states, immediate actor summaries when known context or live evidence exists, 3-second polling, stable run IDs, fresh `updated` semantics instead of misleading stale `lastSeen`, and no-leak examples. Cover APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, made-up actor, CVE, malware/tool, country, sector, victim, provider unavailable, scraper unavailable, queue pressure, duplicate run reuse, policy block, restricted hold, public-channel partial, and graph/evidence promotion states. Verify API/full tests, typecheck, route inventory, contract-index, scraper-native proof, public POST proofs for APT29/APT42/random/made-up actor, and no-leak examples.

- Completed Agent 09 Task Z public cutover contract freeze and route truth audit.
- Added `/v1/contracts.routeTruthAudit` with final dry-run fixtures for route inventory drift, missing schema examples, public `POST /api/ti/search` compatibility, provider/scraper unavailable, queue pressure, stale evidence, no approved sources, policy blocked, duplicate run reuse, restricted emergency stop, canary RC decisions, and no-leak examples.
- Kept `/v1/contracts` as the final integration truth source with 40 active route contracts, route ownership, response keys, state machines, cursor/polling, idempotency, warning codes, rollback/public fallback semantics, no-leak guarantees, and Agent 10 RC proof commands.
- Updated API contract tests, route inventory expectations, and `check:contract-index` so the route truth audit is required and no-leak/public POST compatibility remains enforced.
- Proofs: `bun test src/tests/api.test.ts src/tests/ops.test.ts` passed 63 tests; `bun run check:contract-index` passed with 40 contract routes and 13 route-truth fixtures; `bun run check:route-inventory` passed with 27 mounted proof routes; `bun run check` passed; full `bun test` passed 383 tests; scraper-native/public readiness proofs passed for `APT29` and `Akira ransomware`, including canonical public `/api/ti/search` POST.

Superseded by active Task AA below; do not request another assignment until Task AA proof is complete.

## Main-Agent Task 2026-05-24 AA: Public Wrapper Contract For Responsive Search

Own the `/v1` and public wrapper contract required by `hanasand.com/ti`. Public behavior must match the deployed product correction: no default actor, no stale-cache copy, compact `Searching` for unknown/no-result states, immediate actor summaries when known context or live evidence exists, 3-second polling, stable run IDs, and fresh `updated` semantics instead of misleading stale `lastSeen`.

Deliver `/v1/contracts` and `/v1/intel/search` truth-audit fixtures for APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, made-up actor, CVE, malware/tool, country, sector, victim, provider unavailable, scraper unavailable, queue pressure, duplicate run reuse, policy block, restricted hold, public-channel partial, and graph/evidence promotion states. Ensure public `POST /api/ti/search` compatibility fields stay stable while warnings, polling cursors, source caveats, no-leak guarantees, and route examples are honest and compact. Verify API/full tests, typecheck, route inventory, contract-index proof, scraper-native proof, public POST proofs for APT29/APT42/random/made-up actor, and no-leak examples.
