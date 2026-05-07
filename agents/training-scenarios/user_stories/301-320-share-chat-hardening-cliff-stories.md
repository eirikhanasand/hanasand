# Share Chat Hardening Cliff User Stories 301-320

These stories are harder than 281-300. They target the point where critical users say the first demo is easy, but production is where AI builders fall apart: custom business rules, CORS, request tracing, OpenAPI, CI/CD, transactional rollback, cache invalidation, worker cancellation, backoff, and visible metrics.

Reddit complaint themes folded into this set:
- The first prompt looks good, then the platform cannot handle custom backend logic without hallucinated glue.
- Apps ship with hardcoded localhost, no CORS allowlist, no request IDs, and no way to debug user-specific failures.
- Generated code lacks OpenAPI, metrics, CI, and tests, so teams cannot review or operate it.
- Background jobs cannot be cancelled and retry instantly forever instead of using backoff and poison quarantine.
- Builders hide rollback, cache invalidation, transactions, and deployment checks until a real customer breaks something.

## 301. Transactional Billing Recovery API
As a billing engineer, I want an API with transaction rollback, idempotency, cache invalidation, audit events, request IDs, OpenAPI, metrics, RBAC, backup restore, and webhook signatures.

Acceptance:
- Includes `withTransaction`, `metrics`, `cache.clear`, `x-request-id`, `/openapi.json`, `requireRole`, `/backup`, `/restore`, `verifyWebhookSignature`.
- Includes CI workflow and Docker handoff.

## 302. CORS Debuggable Customer API
As a frontend engineer, I want an API that handles allowed origins, CORS headers, request IDs, shaped errors, owner scoping, pagination, rate limits, and readiness.

Acceptance:
- Includes `ALLOWED_ORIGINS`, `allowedOrigin`, `access-control-allow-origin`, `x-request-id`, `request_error`, `ownerId`, `nextCursor`, `rateLimit`.

## 303. Worker Cancellation Backoff Queue
As an operations lead, I want a worker queue where stuck jobs can be cancelled and failed jobs use backoff, poison quarantine, event logs, Redis, and worker status.

Acceptance:
- Includes `cancelJob`, `/api/jobs/:id/cancel`, `BACKOFF_MS`, `nextRunAt`, `poisonJobs`, `events`, `worker-status`.

## 304. CI Export Ownership Marketing Site
As a founder scared of lock-in, I want a marketing site with source export, Docker, GitHub Actions CI, no lock-in, backend contract, rollback path, and accessible controls.

Acceptance:
- Includes `.github/workflows/ci.yml`, no lock-in, readable source export, Docker, backend contract, rollback path, accessible controls.

## 305. OpenAPI Partner Integration API
As a partner engineer, I want an API with OpenAPI, security headers, request IDs, idempotency, webhook signature seam, metrics, backup restore, and readiness.

Acceptance:
- Includes `/openapi.json`, `x-content-type-options`, `x-request-id`, idempotency, `verifyWebhookSignature`, `/metrics`, `/backup`, `/restore`.

## 306. Cache TTL Product Catalog API
As a performance reviewer, I want an API that has cache TTL, cache hit/miss metrics, cache invalidation on write, pagination, owner scoping, rate limits, and request IDs.

Acceptance:
- Includes `CACHE_TTL_SECONDS`, `readCache`, `writeCache`, `cacheHits`, `cacheMisses`, `cache.clear`, `nextCursor`, `ownerId`, `x-request-id`.

## 307. Refund Dispute Transaction API
As a finance reviewer, I want refund dispute writes to be transactional with rollback metrics, audit events, PII redaction, RBAC, backup restore, and shaped errors.

Acceptance:
- Includes `withTransaction`, `rollbacks`, `auditEvents`, `redact`, `requireRole`, `/backup`, `/restore`, `request_error`.

## 308. Disaster Cutover CI Site
As an SRE, I want a cutover site with DNS/SSL checklist, rollback plan, verification, failure owner, source export, Docker, and CI workflow.

Acceptance:
- Includes DNS checklist, SSL checklist, rollback plan, verification, failure owner, source export, `.github/workflows/ci.yml`.

## 309. Moderator Evidence Bot With CI
As a Discord admin, I want a bot with audit logs, safe stubs, restart requests, maintenance notices, no destructive defaults, env handling, Docker, and CI workflow.

Acceptance:
- Includes `auditLog`, `restartRequests`, `maintenance`, `stub`, `DISCORD_TOKEN`, destructive-action warning, `.github/workflows/ci.yml`.

## 310. Tenant Metrics API
As a tenant admin, I want metrics and request tracing for scoped records, rate limits, cache hits, writes, rollbacks, audit events, pagination, and readiness.

Acceptance:
- Includes `/metrics`, `metrics`, `x-request-id`, `ownerId`, `rateLimit`, `cacheHits`, `writes`, `rollbacks`, `auditEvents`, `nextCursor`.

## 311. Report Worker Customer Cancel
As a customer waiting on a long report, I want to cancel the job and see event logs, backoff, retry/dead/poison states, worker status, Redis seam, and failure owner.

Acceptance:
- Includes `cancelJob`, `/api/jobs/:id/cancel`, `BACKOFF_MS`, `events`, `retrying`, `dead`, `poisonJobs`, `worker-status`, `FAILURE_OWNER`.

## 312. Security Headers API
As a security reviewer, I want an API with security headers, CORS allowlist, request IDs, RBAC, audit events, PII redaction, webhook signatures, and OpenAPI.

Acceptance:
- Includes `x-content-type-options`, `x-frame-options`, `ALLOWED_ORIGINS`, `x-request-id`, `requireRole`, `auditEvents`, `redact`, `verifyWebhookSignature`, `/openapi.json`.

## 313. Accessible Analytics Site
As an angry marketer, I want an analytics consent site that has proof, pricing, FAQ, lead capture, privacy seams, accessible controls, CI, Docker, and handoff tasks.

Acceptance:
- Includes Proof, Pricing, FAQ, lead capture, Privacy and data seams, Accessible controls, `.github/workflows/ci.yml`, Docker.

## 314. Replay-Safe Webhook API
As an integration owner, I want webhook handling with signature seam, idempotency, transaction rollback, audit events, metrics, request IDs, OpenAPI, and backup restore.

Acceptance:
- Includes `verifyWebhookSignature`, idempotency, `withTransaction`, `auditEvents`, `/metrics`, `x-request-id`, `/openapi.json`, `/backup`, `/restore`.

## 315. Backpressure Import Worker
As an SRE, I want an import worker with backoff, cancellation, idempotency, poison quarantine, event logs, retry/dead states, Redis, and status counts.

Acceptance:
- Includes `BACKOFF_MS`, `cancelJob`, `idempotency`, `poisonJobs`, `events`, `retrying`, `dead`, `Redis`, `worker-status`.

## 316. Enterprise Status With CI Site
As an enterprise buyer, I want a status page with service health, incident timeline, subscriber notice, SLO evidence, postmortems, failure owner, Docker, and CI.

Acceptance:
- Includes service health, incident timeline, subscriber notice, SLO evidence, postmortems, failure owner, `.github/workflows/ci.yml`.

## 317. Custom Rules Admin API
As a product manager, I want an API that exposes feature flags, migrations, RBAC, request IDs, metrics, backup restore, OpenAPI, and transaction rollback for custom rules.

Acceptance:
- Includes `featureFlags`, `migrations`, `requireRole`, `x-request-id`, `/metrics`, `/backup`, `/restore`, `/openapi.json`, `withTransaction`.

## 318. Rate Limit UX API
As a frontend lead, I want rate limit errors to be shaped with request IDs, CORS, metrics, owner scoping, pagination, and readiness instead of random red backend text.

Acceptance:
- Includes `Limit reached`, `request_error`, `x-request-id`, `access-control-allow-origin`, `/metrics`, `ownerId`, `nextCursor`, `/ready`.

## 319. Source Review Portfolio Site
As a designer skeptical of generic AI pages, I want a portfolio site with readable source export, Docker, CI, accessible controls, mobile layout, backend contract, rollback path, and no lock-in.

Acceptance:
- Includes readable source export, Docker, `.github/workflows/ci.yml`, accessible controls, mobile-first layout, backend contract, rollback path, no lock-in.

## 320. Production Operations API
As a principal engineer, I want a production operations API with CORS allowlist, request IDs, OpenAPI, metrics, cache TTL, transaction rollback, RBAC, backup restore, migrations, feature flags, security headers, PII redaction, audit events, idempotency, webhook signatures, pagination, schemaVersion, failureOwner, rate limiting, token gate, health/readiness, Docker, and CI.

Acceptance:
- Includes every listed API hardening seam.
- Includes CI workflow, Docker/export handoff, and no hardcoded secrets.
