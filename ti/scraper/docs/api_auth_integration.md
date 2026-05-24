# API Auth Integration Notes

The scraper API assumes authentication and authorization are enforced by the main CTI application or an API gateway before traffic reaches this service.

## Boundary
- All external routes are versioned under `/v1`.
- Forward `x-tenant-id` and `x-actor-id` from the trusted upstream boundary.
- Resolve roles/scopes upstream; this service should receive already-authorized operational calls.
- Require `source:write` or `scraper:admin` for source administration.
- Require `intel:run` for `/v1/intel/plan` and `/v1/intel/runs`.

## Idempotency
- Clients should send `idempotency-key` on `POST /v1/intel/runs`.
- Idempotency is scoped by tenant ID.
- Repeated requests return the original run instead of creating duplicate work.

## Pagination
- List endpoints accept `limit` and `cursor`.
- `nextCursor` is an opaque offset for the current in-memory implementation and should be treated as a string by clients.

## Current Typed Routes
- `GET /v1/health`
- `GET /v1/metrics`
- `GET /v1/sources`
- `POST /v1/sources`
- `PATCH /v1/sources/:id`
- `GET /v1/frontier`
- `GET /v1/intel/plans`
- `POST /v1/intel/plan`
- `POST /v1/intel/runs`
- `GET /v1/intel/runs/:id`
- `GET /v1/intel/runs/:id/results`
- `GET /v1/captures`
- `GET /v1/incidents`
- `GET /v1/auth/integration-notes`

## OpenAPI Contract Freeze
- `GET /v1/contracts` is the source of truth for the OpenAPI-ready contract.
- The `enterpriseApiSurface` section defines trusted gateway auth, tenant/requester identity, idempotency, pagination, rate-limit hints, audit fields, error envelopes, OpenAPI paths, schema components, and no-leak examples.
- The `publicWrapperResponsiveAudit` and `publicWrapperDeltaAudit` sections freeze `/api/ti/search` compatibility for first responses, repeated polls, empty deltas, new deltas, queue pressure, policy blocks, searching/no-result responses, metadata review holds, graph holds, claim-ledger holds, and ready states.
- The `clientCompatibilityMatrix` section freezes client expectations for frontend `/ti`, CTI backend integrations, analyst automation, future SDKs, and future SSE/webhooks.
- Required fields may be extended with optional fields, but removing or renaming required response keys, states, cursor fields, retry headers, or schema components requires a new compatibility entry before promotion.

## Client Compatibility Matrix
- Frontend `/ti` uses `POST /api/ti/search` and `GET /v1/intel/search`, preserves `runId`, `pollCursor`, `deltaCursor`, `updated`, `publicTiAnswer`, and `publicWrapperDelta`, and keeps the last safe answer on empty deltas or retryable degradation.
- CTI backend clients use idempotent `/v1/intel/runs`, run status, paginated results, and STIX export routes. They must honor `idempotency-key`, `nextCursor`, and the shared error envelope.
- Analyst automation uses analyst loop, metadata review, claim ledger, and restricted metadata status routes. These responses remain metadata-only and victim-safe.
- Future SDKs should generate from the `SdkPollingEnvelope` and `SdkSubscriptionRegistration` schemas plus the `xSdkPollingContract` extension.
- Future SSE/webhooks are contract-only: event payloads may carry identifiers, cursors, warning codes, hashes, confidence, and compact summaries, but never raw bodies, credentials, restricted raw URLs, object references, or leaked rows.
