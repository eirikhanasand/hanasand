Status: active_task_ab_blocked_on_external_public_proof

## CURRENT ASSIGNMENT - READ FIRST

Task AB: Public Wrapper Delta API And Compatibility Freeze

Own the public API wrapper contract for the next real-time `/ti` behavior. Do not wait for another prompt. Agent 07 now owns answer-delta semantics; your lane is to freeze the external API shape that `hanasand.com/ti`, future CTI clients, and polling consumers can rely on while live evidence streams in. Keep the public contract compact, stable, backwards compatible, and honest.

Deliver `/v1/intel/search`, `/v1/contracts`, and public `POST /api/ti/search` compatibility fixtures for first response, repeated poll with same `runId`, `pollCursor`/`deltaCursor` advancement, empty delta, new clear-web capture delta, public-channel hint delta, restricted metadata held delta, graph relationship delta, claim-ledger hold, contradiction downgrade, no-result/searching, provider unavailable, scraper unavailable, queue pressure, duplicate run reuse, stale source, low confidence, policy block, and final ready state. Cover APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, made-up actor, CVE, malware/tool, victim/ransomware, country, and sector.

Ensure public fields stay stable: `status`, `summary`, `runId`, `refreshAfterSeconds`, `pollCursor`, `deltaCursor`, `updated`, optional evidence-backed `lastSeen`, `sources`, `recentActivity`, `targets`, `ttps`, `datasets`, `warnings`, `warningCodes`, `sourceCoverage`, `publicChannel`, `restrictedMetadata`, `claimLedger`, and `graph`. Add no-leak examples and route truth audit entries for delta polling. Wire to Agent 02 scheduler cursors, Agent 06 claim ledger, Agent 07 answer deltas, Agent 08 graph deltas, and Agent 10 release board. Verify API/full tests, typecheck, route inventory, contract-index, scraper-native proof, public POST poll proof for known/random/made-up actor, and no raw proof payloads.

## Task AB Progress

- Added the `publicWrapperDelta` response contract to `/v1/intel/search` with stable fields, cursor polling metadata, delta counts, no-leak examples, and Agent 02/06/07/08/10 handoff fields.
- Added `/v1/contracts.publicWrapperDeltaAudit` fixtures for first response, repeated polls, cursor advancement, empty delta, clear-web/public-channel/restricted/graph/claim-ledger deltas, downgraded/blocked/degraded states, and actor/CVE/tool/victim/country/sector query classes.
- Updated route truth audit, public compatibility fields, route inventory, contract-index checks, and API tests for delta polling and stable public POST compatibility.
- Preserved repeated-poll run identity for public wrapper fallback runs by deriving synthetic run IDs from the planner reuse key when no persisted run is attached.
- Repaired restricted metadata analyst-operation DTO helpers that were blocking `/v1/contracts`, `/v1/intel/search`, and route inventory.
- Local proofs passed: `bun test src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check`, `bun run check:contract-index`, `bun run check:route-inventory`, and full `bun test`.
- External scraper-native/public POST readiness proofs for `APT29`, `Random Actor`, and `Made Up Actor` were attempted; sandbox network returned `ConnectionRefused`, then escalated reruns were rejected by the app usage-limit approval gate. Continue with those three proof commands when approvals/network are available, then close Task AB and proceed to Task AC.

## QUEUED NEXT TASKS - CONTINUE AFTER CURRENT PROOF

Task AC: Enterprise API Surface, Auth Boundary, And OpenAPI Contract

After Task AB proof is complete, continue directly into Task AC. Build enterprise API contracts for tenant identity, requester identity, idempotency, pagination/cursors, rate limits, error envelopes, auth boundary placeholders, audit fields, and OpenAPI-ready schema examples. Cover source APIs, runs, results, evidence, graph, quality, restricted metadata, public channels, contracts, and health/metrics. No real secret handling unless already present; keep it integration-ready and safe. Verify API tests, route inventory, contract-index, docs, and no-leak examples.

Task AD: SDK-Friendly Polling And Webhook/SSE Boundary Design

Design client integration contracts for polling, future SSE/webhooks, delta cursors, empty deltas, retry-after, duplicate run reuse, and degraded modes. Include examples for frontend, backend CTI app, and analyst automation. Do not implement unsafe push of sensitive data. Verify API docs and compatibility fixtures.

## Agent 09 Summary

- Completed Task AA public wrapper contract for responsive TI search.
- Added `/v1/contracts.publicWrapperResponsiveAudit` and mirrored semantics coverage for APT29, APT42, Turla, Volt Typhoon, Scattered Spider, Akira, random actor, made-up actor, CVE, malware/tool, country, sector, victim, provider unavailable, scraper unavailable, queue pressure, duplicate run reuse, policy block, restricted hold, public-channel partial, and graph/evidence promotion states.
- Enforced public wrapper guarantees: no default actor, no stale cache/demo copy, compact `Searching` for no-result public UX, 3-second polling, stable run/cursor fields, fresh `updated` semantics, evidence-backed `lastSeen`, and no-leak examples.
- Updated API tests, route inventory, and contract-index proof so responsive public wrapper fixtures are required.
- Kept source-pack dry-run planning useful after starter-pack sources have already been materialized by live search.
- Proofs passed: `bun test src/tests/api.test.ts src/tests/ops.test.ts`, `bun run check:contract-index`, `bun run check:route-inventory`, `bun run check`, full `bun test`, and scraper-native/public POST readiness proofs for `APT29`, `APT42`, `Random Actor`, and `Made Up Actor`.
- Superseded by active Task AB above; do not request another assignment until Task AB proof is complete.
