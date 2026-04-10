# Codex Handoff

## Work Completed In This Pass
- Added Playwright auth coverage in `frontend/tests/auth.spec.ts`.
- Added Playwright status publishing through `frontend/scripts/run-playwright-status.mjs`; npm test scripts now post `frontend / Playwright auth` into `/status`.
- Added `frontend/playwright.config.ts` and npm scripts `test:e2e` / `test:e2e:auth`.
- Added API scripts:
  - `api/scripts/audit-hanasand-api.mjs` expanded to cover sessions, logs, status, and tools.
  - `api/scripts/monitor-auth-and-services.mjs` for synthetic auth/service checks.
- Removed hard-coded audit DB password fallback and hard-coded audit user password. Audit now requires `DB_PASSWORD` and generates a per-run audit password.
- Added synthetic monitoring storage and status API/UI:
  - `service_monitor_results` table.
  - `GET /api/status`.
  - `/status` UI shows latest checks, latency, tested-at relative time, and 30-day uptime.
- Added log storage/query/ingest:
  - `service_logs` table.
  - `GET /api/logs?level=error`
  - `GET /api/logs/services`
- `POST /api/logs/ingest`
- `POST /api/status/ingest`
  - `/dashboard/logs` UI for filtered errors.
- Added API-side request error persistence via Fastify `onError` and unhandled rejection logging.
- Added token/session management:
  - Session metadata on tokens: user agent, created time, revoked time/by.
  - `GET /api/auth/sessions`.
  - `POST /api/auth/sessions/revoke`.
  - `DELETE /api/auth/sessions/:token_id`.
  - Profile UI for logged-in devices and token revocation.
- Added user deactivation:
  - DB columns `active`, `deactivated_at`, `deactivated_by`.
  - `PUT /api/user/:id/active`.
  - Admin user card controls for deactivate/reactivate.
- Added startup schema guard in `api/src/utils/db/ensureSchema.ts` so existing Docker/server volumes get new tables/columns.
- Added coding workbench backend routes:
  - `POST /api/tools/http/request`.
  - `POST /api/tools/ai` as authenticated AI-ready stub.
- Reworked the frontend request workbench UI with methods, URL, headers, body, AI tab, response status/body/timing.
- Updated Varnish pass-through for dynamic/authenticated APIs including `status`, `tools`, and `logs`.
- Updated global cursor behavior and copied the multi-scale grid pattern more closely while keeping the black/orange Hanasand visual direction.
- Rewrote login/register marketing copy to focus on user-facing product value rather than token mechanics.
- Added dashboard navigation links to Logs.

## Verification Completed
- API type check passed:
  - `npx tsc --noEmit -p api/tsconfig.json`
- Frontend type check passed:
  - `npx tsc --noEmit -p frontend/tsconfig.json`
- Non-Docker expanded API audit passed:
  - 50 checks, all green.
- Docker expanded API audit passed:
  - 50 checks, all green.
- Non-Docker Playwright auth passed:
  - signup/login/delete-account flow.
  - bad-login no-hang flow.
- Docker Playwright auth passed after separating UI auth checks from API delete-account verification:
  - 2 tests passed.
- Generated `frontend/test-results` artifacts were removed; future status should be read from `/status`.
- Docker rebuild succeeded after adding logs/status/tooling changes.

## Important Findings
- Do not run Playwright against Next dev with `127.0.0.1`; use `localhost`. Next blocks dev resources cross-origin and the app may not hydrate.
- Local persistent Postgres had a password mismatch versus `.env`. I aligned the local DB user to the env value so Docker API could start.
- Long `docker logs` tailing should be avoided. Use `/dashboard/logs` or `GET /api/logs?level=error`.
- `api/scripts/audit-hanasand-api.mjs` no longer embeds default DB credentials or a stable audit password.

## Still To Finish
- Commit and push the current Hanasand changes.
- Rotate any exposed server-side `.env` secrets on the remote, especially DB password and internal VM/API token, without printing the new values.
- Pull on the server, apply the same DB credential alignment if the persistent Postgres volume still uses the previous password, then run `rebuild -d`.
- After deployment, run the expanded audit in the deployed API container and smoke `/status` and `/dashboard/logs`.
- Consider adding the same `/api/logs/ingest` contract to Cashflow or configuring Cashflow to post errors into Hanasand with a `service` name of `cashflow`.
