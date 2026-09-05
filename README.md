# Hanasand

Hanasand combines threat intelligence, AI development tools, and infrastructure management at [hanasand.com](https://hanasand.com). The public site and authenticated dashboard share a Next.js frontend and a Bun/Fastify API. PostgreSQL stores accounts and application data.

## Service map

| Component | Source | Responsibility |
| --- | --- | --- |
| Frontend | `frontend/` | Public pages, dashboard, AI editor, shared projects, articles, notes, mail and thesis |
| API | `api/` | Authentication, organizations, permissions, billing, AI requests, project storage, infrastructure and public API |
| Threat intelligence | `ti/scraper/` | Source collection, parsing, search, alerts and monitoring; separate storage and migrations |
| AI model client | `ti/ai-model-client/` | Connects an inference server to the API over WebSockets |
| AI parser bridge | `ti/ai-parser-bridge/` | Makes AI parsing available to the collector |
| Model runtime | `gpt/` | Model launch scripts and inference server code |
| Browser services | `ops/browser-worker/`, `ops/onion-tor/` | Isolated browser sessions, WebRTC transport and Tor access |
| Database | `db/`, `api/src/utils/db/` | Initial schema and application schema updates |
| Mail | `mail/` | Stalwart configuration and persistent mail data |
| Client apps | `app/` | Mobile and desktop clients; see [desktop setup](app/desktop/README.md) |
| Operations | `ops/`, `scripts/` | Deployment, backups, maintenance and service checks |

`docker-compose.yml` defines service connections, ports, volumes and health checks. OpenResty terminates public HTTPS outside this Compose project. The API also integrates with external VM hosts, password lookup and other configured services.

## Development

Use Bun 1.3.11, Node.js 22 and Docker Compose. Install dependencies in the component you are changing with `bun install`.

The root `.env` is private and is not committed. Obtain a development configuration from the operator; never copy production credentials into tests. The API requires `DB_HOST`, `DB_PASSWORD` and `VM_API_TOKEN`. Also configure `DB`, `DB_USER` and `DB_PORT` for the development database. Match the frontend API URLs to that environment; several defaults point at production.

Run in separate terminals:

```sh
cd api
bun run start:local
```

```sh
cd frontend
bun run dev
```

The local API defaults to port 8080 and the frontend to 3000. A host process reaches the Compose database on port 8503; containers use `postgres:5432`. Use a separate development database. API startup applies schema updates and starts scheduled jobs, so do not point a development server at production.

## AI

`POST /api/tools/ai` handles AI requests. Common project requests can use built-in generators; other requests go to a connected model. `GET /api/ai/models` reports connected models. An empty list means inference is unavailable, even if the API and parser bridge are healthy.

The model client uses `HANASAND_AI_CLIENT_API_WS`, `HANASAND_AI_OPENAI_BASE` and `HANASAND_AI_MODEL`. Model launch scripts live in `gpt/`. Starting the client alone does not start an inference server.

Generated projects include source, a README, environment examples, build commands and Docker configuration. Website output includes its page, layout and CSS. These are starting points: API records and worker queues currently use in-memory state, and external integrations require implementation. A generated project or passing source check is not evidence that a production integration works.


### AI monitoring

- [Connected models](https://api.hanasand.com/api/ai/health/models): reports the current model connection count; HTTP 503 when none are connected.
- [Inference](https://api.hanasand.com/api/ai/health/inference): runs a small request through the production WebSocket path; HTTP 503 if it cannot complete. Results are shared for 30 seconds to limit probe traffic.

Both checks run every minute under Dashboard → Automation → Monitoring and use the existing Discord destination. `bun scripts/setup-ai-monitoring.ts` in `api/` configures them from the Hanasand API monitor without exposing its webhook. Failed availability checks keep running.

Monitoring history uses the actual stored check count, supports date filters, and loads older checks on scroll. Graph bars show recorded results; uptime is calculated from completed checks.

## Tests

Run the checks for the component you change:

```sh
cd api
bun run test
bun run lint
```

```sh
cd frontend
bun run test
bun run lint
bun run build
```

The API command runs the core checks and every unit test in `api/tests`, with each file in a separate process. Database, server, network and browser checks are opt-in through `api/scripts/index.ts`; run them against disposable services. The thesis database check also requires `THESIS_TEST_DATABASE=1`. Automation history requires `DB_HOST=monitor-test-db`; thesis storage requires `DB_HOST=thesis-test-db`.

Generated-project checks cover exported files, TypeScript, API validation and pagination, worker retries and cancellation, and honest website output. Run `bun run test --only=generated-builds` in `api/` to install each generated project's declared dependencies and build all four project types. This requires npm and package-registry access. Set `GENERATED_PROJECTS_DIR` to retain the builds.

The real website browser test is `frontend/tests/generated-website.spec.ts`. Point `GENERATED_WEBSITE_URL` at the generated website you started, then run that file with Playwright. It checks keyboard navigation, mobile layout, zoom, runtime errors and contact configuration. If the website was built with `CONTACT_EMAIL`, supply the same value as `GENERATED_WEBSITE_CONTACT_EMAIL` to the test.

The old share-chat story suites were removed: minimum file counts, required document phrases and test-authored preview pages did not verify generated application behavior.

The collector has its own `bun run test` and `bun run check` commands in `ti/scraper/`.

## Production deployment

Use `ssh inspur` and work from `/home/hanasand/hanasand`. Deploy only the changed component.

```sh
# Frontend: build, check, switch traffic, then remove the old container.
./scripts/deploy.sh
# Equivalent: make deploy
# Use an already tested image tagged hanasand:
./scripts/deploy.sh --no-build

# API: build and test before replacing the running container.
docker compose build api
docker compose up -d --no-deps --no-build api
```

Do not use a stack-wide `docker compose up --build`. Do not replace the frontend directly through Compose; use the script to avoid a gap in service. API replacement can briefly interrupt requests and WebSockets.

After deployment, check the affected page or endpoint, service logs and `docker compose ps`. The frontend alternates between ports 3000 and 3100, with OpenResty routing traffic to the active container. For rollback, retain the previous image ID and proxy configuration. Schema changes require a separate rollback plan; an image rollback does not reverse a migration.

## Data and operations

PostgreSQL, API state, prompt submissions, collected evidence and mail are persistent. `db/init.sql` initializes a new database; application schema updates run through `api/src/utils/db/ensureSchema.ts`. Collector migrations are maintained under `ti/scraper/migrations/`.

Database backups are configured through `DB_BACKUP_*` variables. Defaults schedule a daily backup and retain 14 days in the API state volume. Keep an independent copy and verify restoration; a backup on the same host does not cover host loss. Collector backup tools are under `ops/threat-intel-backup/`. Do not delete volumes during deployment.

Start diagnosis with `docker compose ps` and `docker compose logs --tail=100 <service>`. `/api/health` checks the API process; `/api/ai/models` checks model connections. Use the dashboard status page for collection, processing and dependency failures. A healthy container does not imply that its external dependencies work.

## Shared thesis

`/thesis` is public. Dashboard → Admin → Thesis opens the editor. Only account ID `eirikhanasand` can edit; permissions do not depend on its display name.

PostgreSQL stores the shared title and content. Edits autosave after five seconds and broadcast over `/api/ws/thesis`. Unchanged content causes no write. Leaving the page triggers a final save attempt; local recovery drafts cover interrupted delivery and browser request limits.

History keeps the previous version, 20-minute checkpoints for seven days, then up to three checkpoints per day. Stale concurrent writes require a choice of versions. Restoring a version preserves the text it replaces.

## Contributing

Follow [AGENTS.md](AGENTS.md) and [copy style](docs/copy-style.md). Keep changes focused, verify them, and push `main` to both Forgejo (`origin`) and GitHub (`github`). Do not include private configuration or credentials in commits or logs.
