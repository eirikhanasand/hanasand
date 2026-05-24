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
