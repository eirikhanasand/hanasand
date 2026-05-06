# Advanced User Story Suite 21-40

These stories add stricter perspective coverage. The agent must choose the right tool quickly, generate a deployable result, keep documentation concise, and avoid spending budget on explanation when a scaffolded, verified project is the right answer.

## 21 Designer Portfolio Booking Site

**Perspective:** Independent designer.

**Success story:** I want a portfolio that feels designed, not templated. I need case-study structure, inquiry flow, pricing, testimonials, and simple deployment steps because I care about the final visual impression more than infrastructure trivia.

**Prompt:** Build "StudioLuma Portfolio", a Dockerized Next.js site for a designer with case studies, booking readiness, pricing, testimonials, metrics, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive polished UI, `.env.example`, concise README with rollback and metrics, build and compose verification.

## 22 Newbie Local Business Site

**Perspective:** Total beginner business owner.

**Success story:** I own a bakery and do not know Docker. I need the agent to make the right choices, give me a working site, and keep instructions short enough that I can follow them without learning a whole platform.

**Prompt:** Build "CornerBakery Launch", a portable Next.js site for a local bakery with hours, offers, pricing, testimonials, launch checklist, and beginner-safe deployment notes.

**Acceptance criteria:** Next.js App Router, Dockerfile, compose file, `.env.example`, clear README under the bloat limit, build and compose success.

## 23 Enterprise Procurement Portal

**Perspective:** Corporate procurement team.

**Success story:** We need an internal service for vendor requests. It must be persistent, easy to run in a controlled environment, and operationally obvious for IT.

**Prompt:** Build "ProcureDesk API", a Fastify and Postgres backend for procurement intake with health/readiness, migration, Docker Compose, environment example, rollback, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, Docker Compose with health checks, concise operational README, build and compose success.

## 24 Corporate Approval Queue

**Perspective:** Enterprise operations.

**Success story:** Approvals can trigger emails, policy checks, and finance tasks. The user should not wait while those jobs run. We need an API plus worker shape immediately.

**Prompt:** Build "ApprovalFlow Queue", a Fastify and Redis worker stack for asynchronous approval processing.

**Acceptance criteria:** API and worker entrypoints, Redis queue, job and worker-status endpoints, `.env.example`, Docker Compose, concise rollback/metrics README, build and compose success.

## 25 Nonprofit Donor Dashboard

**Perspective:** Nonprofit director.

**Success story:** I need a donor campaign page that shows impact and progress without paying for a heavy platform. The agent should give me something credible fast.

**Prompt:** Build "DonorPulse", a Dockerized Next.js donor dashboard with campaign metrics, sponsor tiers, testimonials, volunteer tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, responsive UI, Docker deploy assets, `.env.example`, concise operational README, build and compose success.

## 26 Healthcare Intake API

**Perspective:** Clinic operator.

**Success story:** Patient intake cannot be a static form thrown over a wall. I need a persistent backend shape with readiness checks and clear deployment controls.

**Prompt:** Build "CareIntake API", a Fastify and Postgres service for healthcare intake workflows with migration, health/readiness, Docker Compose, and operational notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, env example, compose health checks, build and compose success.

## 27 Education Assignment Worker

**Perspective:** School technology lead.

**Success story:** Assignments and report exports should run in the background. Teachers need fast UI responses while jobs process reliably.

**Prompt:** Build "ClassQueue Worker", a Fastify and Redis queue stack for assignment processing.

**Acceptance criteria:** API service, worker service, Redis, job endpoints, worker heartbeat, `.env.example`, Docker Compose, concise README, build and compose success.

## 28 Real Estate Listing Site

**Perspective:** Small brokerage.

**Success story:** I need a listing website with enough launch structure to look professional, but I do not want a surprise bill from preview traffic and media-heavy pages.

**Prompt:** Build "OpenHouse North", a Dockerized Next.js listing dashboard with property metrics, viewing readiness, pricing, testimonials, and deployment guidance.

**Acceptance criteria:** Next.js App Router, standalone output, responsive UI, `.env.example`, Dockerfile, compose file, build and compose success.

## 29 Fleet Maintenance API

**Perspective:** Logistics manager.

**Success story:** Fleet maintenance requests need persistence and health checks. This should be a small backend that our IT team can inspect and run.

**Prompt:** Build "FleetLedger API", a Fastify and Postgres maintenance backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, env example, Docker Compose, build and compose success.

## 30 Legal Document Worker

**Perspective:** Law firm operations.

**Success story:** Document generation and review tasks are slow. Lawyers should submit work and get status instead of waiting on a long request.

**Prompt:** Build "ClauseRun Queue", a Fastify and Redis worker stack for legal document jobs.

**Acceptance criteria:** Separate API/worker, Redis queue, job endpoints, worker status, `.env.example`, Docker Compose, concise operational README, build and compose success.

## 31 Founder Investor Update Site

**Perspective:** Startup founder.

**Success story:** I need to send investors a polished update with traction, runway, risks, and proof. It should be quick to generate and cheap to host.

**Prompt:** Build "RunwayBrief", a Dockerized Next.js investor update dashboard with metrics, pricing, testimonials, launch tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive UI, `.env.example`, rollback/metrics README, build and compose success.

## 32 Municipal Service API

**Perspective:** Public-sector team.

**Success story:** Residents submit service requests. We need persistent records, readiness checks, and a deployable service that does not depend on proprietary hosting.

**Prompt:** Build "CivicDesk API", a Fastify and Postgres municipal service backend with health/readiness, migration, Docker Compose, and concise operational notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, env example, compose health checks, build and compose success.

## 33 Retail Inventory Worker

**Perspective:** Retail operator.

**Success story:** Inventory sync runs in batches and should not block the storefront. The agent should immediately create a queue worker stack.

**Prompt:** Build "StockSweep Queue", a Fastify and Redis worker stack for inventory synchronization.

**Acceptance criteria:** API and worker services, Redis queue, job endpoints, worker heartbeat, Docker Compose, `.env.example`, build and compose success.

## 34 Restaurant Reservation Site

**Perspective:** Restaurant owner.

**Success story:** I need a beautiful reservation-ready site that I can run on predictable hosting. I do not want generic placeholder text.

**Prompt:** Build "TableNorth", a Dockerized Next.js restaurant site with availability, menu pricing, service metrics, testimonials, launch tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, polished responsive UI, Docker deploy assets, env example, concise README, build and compose success.

## 35 Security Report API

**Perspective:** Security team.

**Success story:** Findings need durable storage, health checks, and clean deployment notes. The agent must choose backend persistence, not a static page.

**Prompt:** Build "RiskRegister API", a Fastify and Postgres security findings backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, env example, compose health checks, build and compose success.

## 36 Support Ticket Triage Worker

**Perspective:** Customer support lead.

**Success story:** Ticket classification and notifications should happen asynchronously. The frontend must stay fast while work is queued.

**Prompt:** Build "TriageFlow Queue", a Fastify and Redis worker stack for support-ticket triage.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker status endpoint, `.env.example`, Docker Compose, operational README, build and compose success.

## 37 Artist Shop Launch Site

**Perspective:** Independent artist.

**Success story:** I am launching a limited-edition shop and need a polished, fast site with pricing, collector proof, launch tasks, and predictable hosting.

**Prompt:** Build "EditionDrop", a Dockerized Next.js artist shop launch site with metrics, pricing, testimonials, launch checklist, and deployment notes.

**Acceptance criteria:** Next.js App Router, responsive UI, standalone Docker output, env example, concise README, build and compose success.

## 38 Manufacturing Quality API

**Perspective:** Manufacturing quality lead.

**Success story:** Quality events need to be recorded reliably with readiness checks. We need a backend that can be audited and moved between environments.

**Prompt:** Build "QualityLine API", a Fastify and Postgres quality-event backend with migration, health/readiness, Docker Compose, and rollback notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, env example, compose health checks, build and compose success.

## 39 Finance Reconciliation Worker

**Perspective:** Finance operations.

**Success story:** Reconciliation jobs are slow and must be visible. The agent should create a queue worker, not bury the work in one HTTP handler.

**Prompt:** Build "ReconcileRun Queue", a Fastify and Redis worker stack for finance reconciliation jobs.

**Acceptance criteria:** API and worker entrypoints, Redis queue, job endpoints, worker heartbeat, Docker Compose, concise README, build and compose success.

## 40 Corporate Knowledge Base Site

**Perspective:** Corporate enablement team.

**Success story:** We need an internal knowledge base with onboarding signal, launch readiness, and deployment control. The output should be polished but not verbose.

**Prompt:** Build "AtlasDesk", a Dockerized Next.js corporate knowledge base with docs sections, onboarding metrics, readiness tasks, testimonials, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive UI, `.env.example`, concise rollback/metrics README, build and compose success.
