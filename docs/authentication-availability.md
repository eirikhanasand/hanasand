# Authentication availability

Authentication now has two independent Fastify workers behind OpenResty. Both use the existing route handlers, PostgreSQL session records, passkey challenges, SSO configuration, and shared rate-limit buckets. There is no sticky-session requirement. The workers do not import the API entrypoint, execute schema migrations, run scheduled jobs, or mount Docker/LXD sockets.

`/api/auth/*` and registration (`/api/user`) on api.hanasand.com go to this pool. The frontend's `FRONTEND_AUTH_API` explicitly uses that virtual host instead of the single API container. Other API endpoints remain on the existing API. This isolates authentication from API releases; it does not make all application data endpoints highly available.

Run `scripts/deploy-auth.sh` from `/home/hanasand/hanasand`. It builds an immutable commit-tagged image, launches two replacements on the alternate pair of loopback ports (8181/8182 or 8183/8184), verifies writable database readiness, checks/reloads the proxy, and verifies invalid-session rejection through TLS. Existing workers remain through a 60-second proxy drain period and then receive SIGTERM, which invokes Fastify's connection drain and closes the pool. Failed pre-switch deployments retain the existing pair. Configuration backups are printed for rollback. The frontend and authentication deployment scripts share a lock to prevent concurrent proxy edits.

Deploy authentication separately from the API. Do not replace serving workers with a blanket Compose recreation. Schema changes must be backward compatible with both deployed versions: add first, migrate/backfill separately, switch readers/writers, and only remove obsolete schema after old workers are retired. No schema migration is introduced here.

Session-validation reads fail over after three seconds, within the frontend request deadline; login/SSO/registration retain a 60-second upstream read timeout. Proxy retries are limited to two upstreams and never enable `non_idempotent`: an already submitted login, registration, or password reset must not be replayed after an ambiguous failure. Two workers protect new requests from a failed worker, but a crash after accepting a mutation can still interrupt that request. Absolute zero failures across arbitrary crashes cannot be promised without application-specific idempotency.

Authentication database calls have a five-second statement timeout, a two-second connection acquisition timeout, and no automatic replay of ambiguous writes. Each worker has a five-connection pool: ten steady state, twenty during rollout. The existing database currently allows 100 connections, shared with other services. The readiness endpoint is private to loopback worker ports and checks session schema access plus a writable primary. Docker health status and proxy passive failure detection identify failed workers; Docker restarts exited processes.

The frontend retains its existing five-second server-side validation cache, bounded to 10,000 entries per process. Revocation/role changes can consequently take up to five seconds to reach frontend authorization; API authorization checks remain database-backed. Failed validations are never cached as an outage. Client-provided timestamp/role cookies cannot authorize an unavailable session. The rate limiter propagates infrastructure errors instead of converting them to invalid credentials. Token validation reuses the session already validated by the rate limiter when both user and token match, eliminating duplicate validation queries within that request.

## Scaling to 500,000 users

500,000 registered accounts is not 500,000 concurrent users. Size from peak session validations/s, login bursts and password-hash CPU, p95/p99 latency, database pool wait time, rate-limit write volume, and the capacity remaining with one worker or one failure domain unavailable. A small rollout smoke test is not a 500,000-user capacity certification.

The next production tier needs workers in at least two failure domains, a redundant load-balancing endpoint, and PostgreSQL primary/standby with tested automatic failover and connection routing. Auth reads must preserve revocation consistency; do not casually send them to lagging replicas. Reserve database connections across every service and rollout, then introduce PgBouncer if connection fan-out warrants it. Keep database migrations out of worker startup. Test failover and restore procedures under realistic peak load before claiming that tier is ready.

Current limitations: the proxy, workers, and database are on one host; PostgreSQL is a single primary; readiness does not certify external SSO or mail-provider availability. Ordinary API data calls can still be interrupted by a monolith restart. The existing session validator updates last-seen on validation and shared rate limits write PostgreSQL, so database write amplification needs profiling before a high-concurrency launch.

## Alternatives

| Approach | Advantages | Costs and fit |
| --- | --- | --- |
| Redundant workers with existing opaque sessions (implemented) | Preserves current accounts, passkeys, logout/revocation and permissions; isolates deployment failures; no new identity dependency | Requires shared-database HA and capacity work. Best incremental fit for this app. |
| Blue/green the entire API | Also protects ordinary API requests during releases | This monolith starts scheduled jobs, queues, and stateful WebSockets. Replicating it safely requires separating/locking that work and draining connections. Larger scope than authentication isolation. |
| Short-lived signed access tokens with refresh sessions | Local signature checks remove most synchronous session lookups; useful across many services | Revocation and permission changes remain stale until expiry unless another lookup is added; requires key rotation, issuer/audience validation and refresh-token replay protection. Possible later, not an availability patch to bolt onto current cookies. |
| Managed OIDC provider | Outsources much identity security and HA; can offer enterprise federation and MFA | Account/passkey migration, integration changes, provider dependency and usage costs. Worth evaluating for enterprise identity needs; does not remove the app's own session/authorization availability requirements. |

References: [NGINX retry semantics](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_next_upstream), [Fastify graceful close](https://fastify.dev/docs/latest/Reference/Server/#close), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [PostgreSQL high availability](https://www.postgresql.org/docs/current/high-availability.html).
