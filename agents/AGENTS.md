# Hanasand Agent Notes

## Ship Mode Override
The product is improving too slowly. Stop spending prompts on readiness/receipt/proof/contract work unless it directly unlocks a visible user workflow in the same change. The user wants fast, obvious product improvement across the website, not long chains of tiny implementation receipts.

Default to ship mode:

1. One main thread owns the website and portal experience end to end.
2. No more readiness, receipt, proof, or contract-only slices unless they are required to make a visible workflow work in the same prompt.
3. Prioritize these three surfaces: `/dashboard`, `/ti/<query>`, and organization/watchlist/settings workflows.
4. In one prompt, make the chosen surface visibly better with real APIs, useful UI states, quick visual check only when it directly helps ship, then always commit, push, deploy, and probe.
5. Use subagents only for narrow backend blockers that prevent the visible workflow from shipping.

If a task would only add metadata, receipts, proof ledgers, compatibility fixtures, or readiness rows, stop and instead implement the visible customer or analyst workflow those artifacts were supposed to support. The final result should be something a user can open and immediately feel is better.

## Functionality-First Sprint Override
Every agent should ship product code as fast as possible. Spend tokens on usable components, API wiring, real source output, alert workflows, DWM/TI coverage, org/watchlist/settings workflows, and deployable UI. Do not spend tokens on process artifacts, broad test campaigns, strategy essays, readiness/proof receipts, or coordination polish.

The product should feel like Microsoft Defender for Endpoint: compact queues, actionable tables, detail panes, evidence timelines, filters, assignments, source provenance, and workflow actions. Remove essay text sections, marketing copy, explanatory walls, teaser panels, and prompt-shaped labels. Replace them with controls and data the user can act on.

Sellable surfaces are the priority: `/ti`, `/ti/<query>`, DWM/exposure monitoring, actor intelligence, source coverage, alerts/cases, webhooks, and organization/watchlist/settings. Each pass should make one of those surfaces visibly more useful to a buyer or analyst.

Testing overhead is not the work. Run only the smallest fast check needed to avoid shipping obviously broken code, then return to product code. If a check will consume meaningful time or tokens without directly protecting the shipped surface, skip it and state that it was intentionally skipped for ship speed.

## One-Prompt Product Shipping Bar
Do not give agents small work-sized packets. Codex can make broad, coherent product changes in one prompt. A ship-mode prompt should ask for a complete visible product surface, not one receipt, one schema, one card, or one copy fix.

Hanasand should feel closer to Microsoft Defender for Endpoint or Wiz: dense, operator-grade, scannable, action-first, and visually disciplined. It should not feel like a text-bloated wall, a status essay, a receipt ledger, or a loose collection of cards.

For the three priority surfaces, ship the full workflow shape in one pass:

- `/dashboard`: a Defender/Wiz-style operator console with a left queue, severity and ownership, selected alert/case detail, evidence timeline, source/provenance, org/watchlist context, workflow actions, delivery/case timeline, and compact source health.
- `/ti/<query>`: an actor intelligence workspace with compact actor facts, aliases, TTPs, infrastructure, tools/malware, observed sources, evidence rows, watchlist relevance, enrichment gaps, and alert/case handoff. Ban teaser/example/signal language.
- Organization/watchlist/settings: a SaaS settings workflow for org creation, invites, member roles, shared watchlists, webhook destinations/test delivery, permissions, and audit trail.

A one-prompt ship must include real API wiring where available, loading/empty/error states, responsive desktop/mobile behavior, quick visual check only when it directly helps ship, focused checks, commit, push, deploy, and live probe. If backend support is missing, implement the missing hook in the same prompt when reasonable; otherwise ask exactly one narrow blocker agent.

## Goal
Make Hanasand production-ready without wasting user time, tokens, or server resources. Prefer small automated checks over broad manual rereads. Do not tail server logs for minutes. Use the API audit, monitor, status, and filtered logs surfaces first.

Quality beats speed. Do not rush to the smallest plausible patch when the user is asking for a presentable product. It is acceptable for one prompt to take many steps if that is what turns a thin implementation into a usable application.

Avoid dashboard slop. If the request is about a product workflow, do not stop at cards, counters, charts, status pages, or text promises. Build the workspace where the user can actually do the job: select objects, inspect detail, act, save state, recover from errors, and see what happens next.

For SOC, TI, DWM, XDR, monitoring, source operations, incident response, and analyst work, default to an operator portal: prioritized queue, detail/evidence panel, timestamps, source/provenance, objective confidence/reasoning, assignment/notes, route/replay/test/send/close actions where supported, timeline/audit behavior, and honest persistence semantics. Use real API/data wiring where available; if persistence is missing, make the local/session behavior clear and still useful.

## Fulfill Requested Capabilities
Ponytail/lazy mode means avoiding fake, speculative, or bloated work. It does not mean refusing product expansion.

If the user explicitly asks for a capability, build the smallest real end-to-end version that fulfills it. Do not stop at "the backend/API/storage does not exist yet" when creating that backend, schema, route, worker, storage, or UI wiring is the work required to make the request real.

- Fake controls are not acceptable.
- Missing backend support is not a reason to skip the feature.
- Build the narrowest real implementation that lets the user perform the requested action.
- Reuse existing patterns, shared choke points, and installed tooling before adding anything new.
- If only part of the request can be safely implemented, ship that real part and state exactly what remains and why.

Example: if the user asks to make audit-only jobs runnable, do not only relabel or hide "audit-only." Add safe run/pause endpoints for jobs with real runners, persist pause state if pause must survive restart, and leave only unsafe/request-driven jobs non-runnable with a clear reason.

## Token-Saving Workflow
- Start with `git status --short` and targeted `rg`, not whole-repo reading.
- For every implementation prompt, write 3-7 acceptance criteria, identify affected routes/files/surfaces, implement the complete presentable slice, verify with focused checks and quick browser check for UI, then commit only the isolated intended diff, push to GitHub and Forgejo, deploy from the real server checkout, and live probe.
- Acceptance criteria must include the real user workflow, not only the visible screen components. Ask what a strong competitor would let the user do here and what would make the slice feel genuinely better.
- Do not stop at 5 percent of the ask. Keep going on the obvious next 20 percent inside the same scope when that is what makes the workflow usable.
- Final implementation handoffs must include: `BASELINE dirty files:`, `FINAL dirty files:`, `Commit:`, `Checks:`, `Live probes:`, and `Remaining blockers:`.
- Always commit agent-owned changes. Dirty worktree baseline is not a reason to skip commit; leave unrelated paths unstaged and report them.
- Always push committed work to both GitHub and Forgejo, keep local main aligned, and deploy from `/home/hanasand/hanasand` on the production server.
- Never deploy from `*-deploy*`, `*deploy-*`, temp, copied checkout, archive, worktree, or generated staging directories. The Docker Compose `deploy-path-guard` service must remain in the deploy graph and blocks production deploys from any path other than `/home/hanasand/hanasand`.
- Never use `rsync` for Hanasand deployment.
- Never copy `.env`, env folders, secret folders, or environment material as part of deployment. The server's real checkout and existing server environment are the source of truth.
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
- The agent training path for native app parity work is documented in `agents/DESKTOP_APP_DEVELOPMENT.md`. Use it before implementing Hanasand app features copied from the web product.

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
- If the user asks for website functionality in the Hanasand app, independently trace the website implementation and backend contract first. Do not ask for endpoint names or payload shapes unless source inspection and smoke checks cannot identify them.
