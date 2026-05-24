Status: active_value_api_contracts

# Agent 09 Coordination

## CURRENT ASSIGNMENT - READ FIRST

DO NOT STOP AFTER ONE PATCH. Continue Agent 09 value-program API/frontend contract support without waiting for a new prompt. Program BB/BC/BD are satisfied by the completed frontend progressive update, SDK/OpenAPI, fixture/changelog gates, realtime delivery soak, dark-web index frontend contract, and source-atlas frontend contract. Only write `ready_for_next_task` if the API/frontend contract ownership lane is genuinely exhausted or blocked by missing cross-agent code.

Side-tool support priority:
- Own API/frontend contracts for `hanasand.com/ti/darkweb/index` and scraper `/v1/darkweb/*` or equivalent restricted metadata index routes.
- Own API contracts for Agent 01 source atlas/source discovery surfaces.
- Keep these as side tools that feed the main CTI app; public copy must be compact and safe, with no raw unsafe onion URL exposure.

## Completed Program BA

- Hardened `/v1/contracts` as the API product truth index for public wrapper, auth/rate-limit/error semantics, polling, deltas, realtime prototypes, SDK compatibility, and frontend integration.
- Added `/v1/contracts.clientGenerationFreeze` with generated-client targets, OpenAPI manifest, stable operation IDs, schema and fixture manifests, fail-closed drift checks, no-leak DTO rules, and Agent 02/06/07/08/10 handoffs.
- Extended OpenAPI schemas with `ClientGenerationFreeze` and `GeneratedClientTarget`, and wired the freeze into API regression sentinel invariants, route inventory expectations, contract-index proof, focused API tests, and API/auth docs.
- Preserved public product rules: unknown actors remain `Searching`, polling stays primary, realtime is disabled by default, stable run/cursor fields remain required, and generated clients must not expose raw bodies, restricted URLs, credentials, object keys, leaked rows, private channel material, or webhook secrets.
- Repaired parallel public-signal coverage-plan helper drift that was breaking mounted search/public-channel routes.
- Verified `bun run check`, `bun run check:api-regression`, `bun run check:sdk-fixtures`, `bun run check:route-inventory`, `bun run check:contract-index`, focused API/API-regression tests, full `bun test`, and public proof for `APT29`, `Random Actor`, and `Made Up Actor`.

## Current Continuation

Value Program: source-atlas approval/export API follow-through.

- Continue source-atlas approval/export handoff contracts around `/v1/sources/atlas`, `/v1/sources/atlas/export`, `/v1/analyst/source-activation-packets`, and `/v1/contracts`.
- Keep source-atlas side-tool contracts compact, SDK/OpenAPI-friendly, no-leak, dry-run/non-crawling, and explicit that review/export/canary planning does not mutate the registry or activate sources.
- Look next for approval queue, rollback packet, canary handoff, route inventory, and generated-client fixture drift that would block the source-atlas side tool from becoming a trustworthy product surface.

## Completed Value Program Source Atlas Frontend Contract

- Added `/v1/contracts.sourceAtlasFrontendContract` as the frozen `/ti/sources/atlas` frontend/API contract for dry-run source discovery and staging.
- Covered source-candidate search, query-class/family/language/region/sector/parser/legal/activation filters, table columns, safe detail drawer sections, first-100/first-1000/future-10k import-plan labels, export manifest fields, approval packets, rollback packets, and canary-plan handoffs.
- Preserved no-mutation/no-crawl boundaries: source-atlas UI DTOs may show domains, hashes, coverage, parser/legal state, approval packets, rollback ids, and dry-run plans only; they must not imply registry mutation, source-pack import, crawl enqueue, silent activation, private/invite/auth/CAPTCHA activation, credentialed fetch, or payload download.
- Wired the contract into `/v1/contracts`, semantics, API regression sentinel invariants, contract-index checks, source/contract surfaces, focused API tests, and API/auth docs.
- Repaired parallel value-program drift in `publicSignalFusion` and source-atlas registry activation handoff tests so public signal/source atlas proof paths remain route-safe.

## Completed Value Program DW Frontend Contract

- Added `/v1/contracts.darkwebIndexFrontendContract` as the frozen `/ti/darkweb/index` frontend contract for metadata-only dark-web index browsing.
- Covered search, cursor pagination, category/risk/liveness/review filters, table columns, compact legal/risk triage copy, source provenance, safe detail drawer sections, graph/STIX holds, and "what was not accessed" display text.
- Preserved no-leak UI boundaries: redacted labels and hashes only; no raw unsafe URLs/full onion locators, raw bodies, credentials, object keys, leaked rows, private-message material, payload downloads, or threat-actor interaction content.
- Wired the contract into `/v1/contracts`, semantics, API regression sentinel invariants, contract-index checks, route inventory response keys, focused API tests, and API/auth docs.
- Verification is green for `bun run check`, `bun run check:api-regression`, `bun run check:contract-index`, `bun run check:route-inventory`, `bun run check:sdk-fixtures`, focused API/API-regression/darkweb tests, and full `bun test`.

## Completed Program BA.5

- Added `/v1/contracts.clientGenerationFreeze.changelogGate` for generated-client release gating, semver policy, breaking-change blockers, 90-day deprecation requirements, fixture gate alignment, release checklist, and compact changelog entries.
- Wired the changelog gate into OpenAPI, API regression sentinel invariants, `check:api-regression`, `check:sdk-fixtures`, `check:contract-index`, API tests, and API/auth docs.
- Kept generated SDK work contract-only: no generated artifacts are committed or published by the scraper.
- Repaired compile drift from parallel public-signal/analyst-feedback fixture updates while preserving current DTO boundaries.
- Verified `bun run check`, `bun run check:api-regression`, `bun run check:sdk-fixtures`, `bun run check:route-inventory`, `bun run check:contract-index`, focused API/API-regression/SDK/public-signal tests, full `bun test`, and public scraper-native proof for `APT29`, `Random Actor`, and `Made Up Actor`.

## Completed Program BA.6

- Added `/v1/contracts.frontendProgressiveUpdateContract` for frontend `/ti` progressive polling, repeated polls, empty deltas, new deltas, metadata/restricted/graph/claim-ledger holds, and ready/no-result states.
- Indexed the contract through `/v1/contracts`, OpenAPI semantics, API regression sentinel invariants, contract-index checks, API tests, and API/auth docs.
- Froze compact UI proof scenarios for `/api/ti/search` and scraper-native `/v1/intel/search` parity without demo/default actor behavior, preserving `runId`, `pollCursor`, `deltaCursor`, `refreshAfterSeconds`, `publicTiAnswer`, and `publicWrapperDelta`.
- Repaired parallel source-atlas, evidence no-leak, and graph helper drift needed to keep the full suite stable.
- Verified `bun run check`, `bun run check:api-regression`, `bun run check:sdk-fixtures`, `bun run check:route-inventory`, `bun run check:contract-index`, focused API/API-regression/SDK/graph tests, full `bun test`, and public scraper-native proof for `APT29`, `Random Actor`, and `Made Up Actor`.

## Completed Program BA.7

- Added `/v1/contracts.scraperNativeReplacementReadiness` as the compact replacement-readiness board for frontend `/ti`, public `POST /api/ti/search`, and scraper-native `GET /v1/intel/search`.
- Covered known actor, random actor, made-up actor, CVE/advisory, sector/country, victim/company, restricted metadata hold, graph hold, and empty-delta proof cases.
- Wired the board into `/v1/contracts`, OpenAPI semantics, API regression sentinel invariants, contract-index checks, API tests, and API/auth docs.
- Preserved product guardrails: polling remains primary, unknown actors stay `Searching`, default/demo actor fallback blocks promotion, held states do not auto-promote, and unsafe/raw payload fields remain forbidden.
- Verified `bun run check`, `bun run check:api-regression`, `bun run check:sdk-fixtures`, `bun run check:route-inventory`, `bun run check:contract-index`, focused API/API-regression/SDK tests, full `bun test`, and public scraper-native proof for `APT29`, `Random Actor`, and `Made Up Actor`.

## Completed Program BD

- Added `/v1/contracts.realtimeDeliverySoak` for disabled SSE/webhook replay, webhook outbox retry, cursor-gap handling, fallback-to-polling, held-state events, duplicate-event dedupe, unsafe-payload blocks, and empty-delta polling.
- Wired the soak contract into `/v1/contracts`, semantics, API regression sentinel invariants, contract-index checks, API tests, route inventory response keys, and API/auth docs.
- Kept realtime strictly contract-only: feature flags remain false, realtime routes remain unmounted, outbox writes are dry-run only, polling stays primary, and cursor gaps fall back to stable `runId`/`pollCursor`/`deltaCursor` polling.
- Preserved no-leak event boundaries for ids, cursors, hashes, warning codes, retry hints, and compact summaries only; raw bodies, restricted raw URLs, credentials, object keys, leaked rows, webhook secrets, and private-channel material remain forbidden.
- Verified `bun run check`, `bun run check:api-regression`, `bun run check:sdk-fixtures`, `bun run check:route-inventory`, `bun run check:contract-index`, focused API/API-regression/SDK tests, and full `bun test`.
