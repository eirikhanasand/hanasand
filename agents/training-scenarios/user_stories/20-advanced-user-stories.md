# Advanced User Story Suite

These stories extend the first five scenarios into a broader product benchmark. Each story is intentionally written as a real customer outcome: the user should receive a working project with deployment assets, verification steps, operational notes, and enough structure to keep moving after the agent stops.

## 06 Webhook Ingestion Ledger

**Success story:** I run a marketplace and need to receive Stripe, GitHub, and CRM webhooks without losing events. Hosted frontend platforms are easy, but this needs durable storage, health checks, and a deployable API I can move to a fixed-price server.

**Prompt:** Build "HookLedger API", a Fastify and Postgres service for webhook ingestion. It should expose health/readiness endpoints, accept event records, persist an audit trail, include migration guidance, and ship with Docker Compose.

**Acceptance criteria:** Fastify API, Postgres dependency, migration script, `.env.example`, Dockerfile, compose health checks, `npm run build`, `docker compose config`, README with rollback and metrics.

## 07 Invoice Export Worker

**Success story:** My billing tool needs to generate invoice PDFs and CSV exports in the background. I do not want long HTTP requests or serverless timeouts to decide whether customers get invoices.

**Prompt:** Build "LedgerLift Exports", a Fastify API plus Redis worker stack. The API should enqueue export jobs, the worker should process them, and the stack should expose health, worker status, and Docker Compose.

**Acceptance criteria:** API entrypoint, worker entrypoint, Redis queue, job endpoints, worker heartbeat, `.env.example`, Dockerfile, compose config, README with queue metrics and rollback.

## 08 Multi Tenant Agency Dashboard

**Success story:** I sell websites to many local businesses and need a dashboard that feels as easy as Vercel but runs on my own server. I want client-level status, launch readiness, pricing visibility, and deployment confidence.

**Prompt:** Build "TenantScope", a Dockerized Next.js dashboard for agencies managing many client workspaces. Include tenant metrics, kanban launch flow, pricing panels, testimonials, empty states, and deployment instructions.

**Acceptance criteria:** Next.js App Router, standalone output, Dockerfile, compose file, `.env.example`, responsive UI, README with environment, rollback, and metrics, `npm run build`, `docker compose config`.

## 09 Booking Reservation API

**Success story:** A clinic wants online booking without buying a heavy SaaS product. They need an API with persistent data, predictable hosting, and clear readiness checks before going live.

**Prompt:** Build "SlotHarbor API", a Fastify and Postgres booking backend with health/readiness endpoints, migration path, sample CRUD route structure, Docker Compose, and operational README notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, `.env.example`, Dockerfile, compose health checks, build verification, compose verification.

## 10 Image Processing Queue

**Success story:** My design app accepts image uploads and creates thumbnails, previews, and metadata. The work must happen in the background so users do not sit on a blocked request.

**Prompt:** Build "PixelForge Queue", a Fastify API plus Redis worker stack for image-processing jobs. Include enqueue/list endpoints, worker status, Docker Compose, and metrics guidance.

**Acceptance criteria:** Redis-backed queue, API and worker services, worker status endpoint, `.env.example`, Dockerfile, compose config, build verification, README with queue metrics.

## 11 Uptime Status Page

**Success story:** I need a public status page for my SaaS. Hosted observability looks nice, but I need something portable, brandable, and cheap to run next to my app.

**Prompt:** Build "BeaconStatus", a Dockerized Next.js status page with incident summaries, uptime metrics, customer messaging, launch/readiness checklist, pricing impact notes, and deployment instructions.

**Acceptance criteria:** Next.js App Router, standalone Docker deployment, responsive UI, `.env.example`, README with rollback and metrics, successful build and compose validation.

## 12 Compliance Audit API

**Success story:** My B2B users ask who changed what and when. I need an audit API with persistence and operational readiness, not just frontend screens.

**Prompt:** Build "AuditTrail API", a Fastify and Postgres service for compliance logs. Include health/readiness routes, migration, Docker Compose, environment examples, and README operational notes.

**Acceptance criteria:** Fastify API, Postgres, migration script, `.env.example`, Dockerfile, compose health checks, build verification, compose verification, README metrics.

## 13 Newsletter Dispatch Queue

**Success story:** My newsletter product needs to send batches without timing out and without coupling user clicks to provider latency.

**Prompt:** Build "LetterRun Queue", a Fastify API plus Redis worker stack for newsletter dispatch. It should enqueue jobs, expose worker status, and run as separate API and worker services in Docker Compose.

**Acceptance criteria:** Redis queue, API and worker entrypoints, job endpoints, worker heartbeat, `.env.example`, Dockerfile, compose config, build verification, operational README.

## 14 Ecommerce Launch Dashboard

**Success story:** A store is launching a campaign and needs one page that tracks readiness, conversion goals, pricing, approvals, and launch tasks. The owner wants fixed hosting cost and a professional UI.

**Prompt:** Build "CartLift Launch", a Dockerized Next.js launch dashboard for ecommerce teams. Include metrics cards, kanban tasks, pricing/readiness panels, testimonials, and Docker deployment.

**Acceptance criteria:** Next.js App Router, polished responsive UI, Dockerfile, compose, `.env.example`, standalone output, README with rollback and metrics, build and compose success.

## 15 Feature Flag Config API

**Success story:** My team wants feature flags but does not want to depend on a hosted service for every environment. We need a small persistent API we can self-host.

**Prompt:** Build "FlagFoundry API", a Fastify and Postgres configuration backend. Include health/readiness, migration, environment examples, Docker Compose, and operational notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, `.env.example`, Dockerfile, compose health checks, build verification, README rollback and metrics.

## 16 CSV Import Worker

**Success story:** Customers upload spreadsheets with thousands of rows. Imports should run in the background with visible status instead of blocking the browser.

**Prompt:** Build "ImportPilot Queue", a Fastify API and Redis worker stack for CSV import jobs. Include enqueue/list endpoints, worker heartbeat, Docker Compose, and metrics guidance.

**Acceptance criteria:** Redis-backed queue, API and worker services, job endpoints, `.env.example`, Dockerfile, compose config, successful TypeScript build, README queue metrics.

## 17 Developer Docs Portal

**Success story:** I am launching an API product and need documentation, examples, pricing, onboarding status, and deployment confidence. I want a static-friendly app but still portable as a Docker service.

**Prompt:** Build "DocHarbor", a Dockerized Next.js documentation portal with onboarding metrics, pricing tiers, launch checklist, testimonials, and deployment instructions.

**Acceptance criteria:** Next.js App Router, responsive UI, standalone output, Dockerfile, compose, `.env.example`, README rollback and metrics, build and compose validation.

## 18 Customer Feedback API

**Success story:** My customers leave feedback from several apps. I need one backend that stores it reliably and can run on a predictable server bill.

**Prompt:** Build "VoiceBoard API", a Fastify and Postgres feedback backend with health/readiness endpoints, migration, Docker Compose, and environment examples.

**Acceptance criteria:** Fastify, Postgres, migration, `.env.example`, Dockerfile, compose health checks, build verification, compose verification, operational README.

## 19 Media Transcoding Queue

**Success story:** My app receives video clips and needs transcoding jobs. Users should see status immediately while heavy work runs in a worker.

**Prompt:** Build "ClipSmith Queue", a Fastify API plus Redis worker stack for media transcoding jobs. Include enqueue/list endpoints, worker heartbeat, Docker Compose, and metrics guidance.

**Acceptance criteria:** API service, worker service, Redis, job endpoints, worker status endpoint, `.env.example`, Dockerfile, compose config, build verification, README rollback and metrics.

## 20 Incident Response Command Center

**Success story:** During incidents I need one internal page for status, tasks, customer updates, impact, and launch/deploy confidence. It must be portable and fast to redeploy.

**Prompt:** Build "Fireline Command", a Dockerized Next.js incident response command center. Include incident metrics, kanban response flow, pricing/impact panel, customer update testimonials, empty states, and deployment docs.

**Acceptance criteria:** Next.js App Router, standalone output, Dockerfile, Docker Compose, `.env.example`, responsive UI, README rollback and metrics, successful build and compose validation.
