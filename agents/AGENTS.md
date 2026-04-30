# Hanasand Agent Notes

## Goal
Make Hanasand production-ready without wasting user time, tokens, or server resources. Prefer small automated checks over broad manual rereads. Do not tail server logs for minutes. Use the API audit, monitor, status, and filtered logs surfaces first.

## Token-Saving Workflow
- Start with `git status --short` and targeted `rg`, not whole-repo reading.
- After code edits, run type checks and the focused scripts below instead of manually reviewing every touched file.
- For logs, use the database-backed API/UI:
  - API: `GET /api/logs?level=error`
  - API: `GET /api/logs/services`
  - UI: `/dashboard/logs`
  - Ingestion for other services: `POST /api/logs/ingest` with the internal token.
- `/dashboard/logs` also merges native host logs when available, so check that before dropping to `journalctl` or raw `/var/log/*`.
- Avoid long-running `docker logs`. If absolutely necessary, use a short `--tail` only after checking `/dashboard/logs`.
- Playwright status is recorded in `/status` when using the npm scripts, so prefer `npm run test:e2e:auth` over raw `npx playwright ...`.
- Use `localhost` rather than `127.0.0.1` for Playwright against Next dev, otherwise Next can block dev resources and the page may not hydrate.

## Project Status
- Auth/login has been stabilized around local session validation, token expiry refresh, and consistent bearer/id headers.
- Signup, login, and account deletion now have Playwright coverage.
- Playwright auth test results are posted to the status monitor as `frontend / Playwright auth`.
- The API has an endpoint audit script that creates temporary users/resources and validates response shapes.
- Synthetic auth/service monitoring runs every minute from API cron and is shown on `/status`.
- The status page shows latest service checks, latency, “tested ago” timestamps, and 30-day uptime.
- User deactivation is persisted in the DB/API and exposed in admin user controls.
- Profile pages expose login sessions/devices and token revocation controls.
- The coding/Postman-style workbench has an authenticated backend HTTP runner and an AI-ready endpoint stub.
- Application error logs are persisted to `service_logs` and queryable/filterable without shell log tailing.
- The agent training path for native app parity work is documented in `agents/DESKTOP_APP_DEVELOPMENT.md`. Use it before implementing Hanasand app or Nucleus app features copied from the web products.

## Useful Commands
Run from `/Users/eirikhanasand/Desktop/personal/hanasand`.

```bash
npx tsc --noEmit -p api/tsconfig.json
npx tsc --noEmit -p frontend/tsconfig.json
```

For cheap API contract checks after auth, notes, role, or user-admin edits:

```bash
cd api
bun run smoke:unit
```

For Hanasand native app work:

```bash
cd app
npm run typecheck
npm run lint
```

For Nucleus app work:

```bash
cd /Users/eirikhanasand/Desktop/Login/nucleus
npx tsc --noEmit
npm test -- --watchman=false
```

For practical app-parity agent training, start the local model and run:

```bash
cd gpt/api
MODEL_API=http://127.0.0.1:18082 bun run training:app-parity
```

The Hanasand Desktop app must stay trained too. After app-parity changes, also smoke the actual desktop path:

```bash
cd app/desktop
swift build
HANASAND_DESKTOP_INITIAL_SECTION=ai swift run Hanasand
```

Use the AI sidebar's `App parity drill` action to verify the model can continue from the Desktop app surface, not just from scripts.

```bash
cd api
npm run audit
npm run monitor
```

```bash
cd api
bun scripts/smoke-dashboard-runtime.mjs
```

```bash
cd frontend
npm run test:e2e:auth
```

For local non-Docker verification, run the API against the loopback Postgres port and the frontend against that API:

```bash
cd api
set -a; source ../.env; set +a; DB_HOST=127.0.0.1 DB_PORT=8503 PORT=18082 node src/index.ts
```

```bash
cd frontend
NEXT_PUBLIC_API=http://127.0.0.1:18082/api PORT=3100 npm run dev
PLAYWRIGHT_BASE_URL=http://localhost:3100 PLAYWRIGHT_API_BASE=http://127.0.0.1:18082/api npx playwright test tests/auth.spec.ts
```

For Docker verification:

```bash
DOCKER_BUILDKIT=0 docker compose up -d --build
set -a; source .env; set +a; API_BASE=http://127.0.0.1:8080/api DB_HOST=127.0.0.1 DB_PORT=8503 node api/scripts/audit-hanasand-api.mjs
cd frontend
PLAYWRIGHT_BASE_URL=http://localhost:3000 PLAYWRIGHT_API_BASE=http://127.0.0.1:8080/api npx playwright test tests/auth.spec.ts
```

## Secret Handling
- Do not add fallback passwords/tokens in scripts.
- `api/scripts/audit-hanasand-api.mjs` requires `DB_PASSWORD` and generates a per-run audit password by default.
- If a persistent DB volume has an old password, align/rotate the database user to the `.env` value before rebuilding.
- Never paste secret values in final responses.

## Deployment Notes
- The user expects changes to be verified locally without Docker and with Docker before pushing.
- After verification, push the code and use the server aliases:
  - `hanasand` for SSH.
  - `rebuild -d` for restart/rebuild.
- Preserve server-local files unless explicitly asked to remove them.

## App Parity Rule
- If the user asks for website functionality in the Hanasand or Nucleus app, independently trace the website implementation and backend contract first. Do not ask for endpoint names or payload shapes unless source inspection and smoke checks cannot identify them.
