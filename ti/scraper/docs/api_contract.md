# API Contract Plan

Agent 09 owns the compact `/v1` scraper API contract. The next stability step is to generate OpenAPI from the TypeScript DTOs rather than hand-maintaining parallel schemas.

## Current Contract Rules
- All external routes stay under `/v1`.
- Error bodies use `{ "error": { "code": string, "message": string, "details"?: object } }`.
- List endpoints use `limit`, `cursor`, and `nextCursor`.
- Capture responses use safe DTOs and hide `body` by default.
- Sensitive and metadata-only captures never expose raw body content.
- `POST /v1/intel/runs` supports tenant-scoped `idempotency-key`.
- Reusing an idempotency key with a different request body returns `409 idempotency_conflict`.

## Result Routes
- `GET /v1/intel/runs/:id/results`
- Optional `include` values: `captures`, `incidents`, `indicators`, `entities`, `relationships`.
- Optional `includeBody=true` only returns non-sensitive inline capture bodies.

## Interactive Search
- `GET /v1/intel/search`
- Query: `q`, optional `entityType`, optional `cursor`.
- Compact public-wrapper fields remain stable: `query`, `mode`, `status`, `runId`, `refreshAfterSeconds`, `summary`, `confidence`, `aliases`, `recentActivity`, `targets`, `ttps`, `datasets`, `sources`, `notes`, `cursor`, `nextCursor`, and `warnings`.
- Rich optional sections expose the scraper-native cutover context: `sourceCoverage`, `sourceActivation`, `scheduler.queueEconomics`, `scheduler.runtimeExecution`, `claimLedger`, `claimLedger.certification`, `answer`, `answerDeltas`, `reviewGates`, `graph`, `graphExport`, `publicChannel`, `restrictedMetadata`, `darknetMetadata`, `quality`, and `actorProfile`.
- Public wrapper proof is canonical POST JSON to `https://api.hanasand.com/api/ti/search` with `{ "query": "<actor>" }`. GET `/api/ti/search?q=...` is optional compatibility proof and should only block cutover when `TI_REQUIRE_GET_API_PROOF=true`.
- `bun run check:scraper-native-search` verifies scraper health, scraper-native search, cursor polling, degraded response shape, public `/ti`, and canonical public API POST proof. `bun run check:route-inventory` verifies mounted local `/v1` routes, including source activation batches.

## Export Routes
- `POST /v1/exports/stix`
- Body: `{ "runId": string, "producerName"?: string, "generatedAt"?: string, "tenantId"?: string }`.
- Response: `{ "bundle": StixBundle }`.

## Evidence Replay Routes
- `GET /v1/evidence/replay-plan`
- Query: `q`, optional `runId`, optional `sinceCursor`.
- Response: `{ "contract": EvidenceReplayPlanApiContract, "replayPlan": EvidenceReplayPlanDto }`.
- The replay plan proves discovery -> capture -> extraction -> relationship delta -> API cursor polling without exposing sensitive bodies or object keys.

- `GET /v1/evidence/cutover-report`
- Query: `q`, optional `runId`, optional `sinceCursor`, optional `generatedAt`.
- Response: `{ "contract": EvidenceCutoverReportApiContract, "cutoverReport": EvidenceCutoverReportDto }`.
- The cutover report includes readiness, counts, replay plan, retention state, redaction state, export blockers, Agent 09 cursor fields, and Agent 10 promotion-gate fields.
- `trustLedger` summarizes claim-level stable ledger IDs, source/capture/hash/extractor/evidence-stage/confidence provenance, graph relationship IDs, review state, retention/redaction state, since-cursor changes, replayability, blockers, and trusted/degraded/blocked gate state without exposing raw bodies or object keys. Ledger IDs are read from capture metadata keys `evidenceLedgerIds`, `evidenceLedgerId`, `ledgerIds`, `ledgerId`, `trustLedgerIds`, and `trustLedgerId`, with deterministic fallback IDs for older captures.

- `GET /v1/evidence/trust-ledger`
- Query: `q`, optional `runId`, optional `sinceCursor`, optional `generatedAt`, optional `minTrustedConfidence`.
- Response: `{ "contract": EvidenceTrustLedgerApiContract, "trustLedger": EvidenceTrustLedgerDto }`.
- The dedicated trust-ledger route exposes the same non-mutating claim gate without requiring consumers to parse a full cutover report. It includes readiness, trust gate, blockers, counts, since-cursor changes, compact claim rows, cutover gate links, object-integrity counts, redaction state, safe-output flags, and Task V enforcement state.
- `GET /v1/evidence/claim-ledger` is the Task U/V/X alias for downstream answer/graph consumers. It returns `{ "contract": EvidenceClaimLedgerApiContract, "claimLedger": EvidenceTrustLedgerDto }` with the same safe fields and cursor replay counts for added/promoted/downgraded/expired/contradicted/review-required claim changes. `claimLedger.enforcement` emits `pass`/`warning`/`hold`, `releaseAction`, `canPromote`, holds, warnings, affected claims, dry-run repair packets, public API impact, and downstream Agent 07 answer, Agent 08 graph export, and Agent 10 release-packet decisions.
- `claimLedger.certification` is the production-readiness cutover report for object store, Postgres-like repository, cursor replay, retention, deletion audit, duplicate suppression, redaction, legal hold, missing-object repair, restart replay, and safe downstream release action. It includes route-ready fixture coverage for clean cutover, missing object, hash mismatch, stale extractor replay, restricted metadata redaction, retired source, graph hold, low confidence, duplicate claim, cursor gap, retention expiry, legal hold, and object-store write failure.

- Contract examples cover pass, stale snapshot hold, missing object hold, restricted metadata redaction, graph export blocker states, and persistence certification fixtures.
- Mounted-route proof commands and expected outputs live in `docs/evidence_endpoint_proof.md`.

## OpenAPI Generation Plan
- Keep DTO interfaces in `src/types.ts` as the source of truth.
- Add a build step that converts exported API DTOs to JSON Schema.
- Compose route metadata in a small `src/api/contracts.ts` registry.
- Generate `docs/openapi.json` from the route registry plus JSON Schemas.
- Add a Bun test that validates generated paths include all public `/v1` routes.
- Keep schema generation offline and deterministic; do not require network access.
