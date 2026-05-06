# Advanced User Story Suite 41-60

This suite is stricter than the previous two. It checks whether the agent picks the right stack immediately, avoids verbose hand-holding, and reaches a deployable project fast enough to feel useful in production.

## 41 UX Audit Landing Site

**Perspective:** Senior designer selling a service.

**Success story:** I need a premium UX audit landing page with strong visual hierarchy, proof, pricing, and a deployment path. The agent should build, not lecture.

**Prompt:** Build "FlowAudit Studio", a Dockerized Next.js UX audit landing site with audit packages, proof metrics, testimonials, launch tasks, and concise ops notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, polished responsive UI, `.env.example`, concise rollback/metrics README, build and compose success within budget.

## 42 First-Time SaaS Admin

**Perspective:** Total newbie founder.

**Success story:** I need a SaaS admin dashboard but do not know the right stack. The agent should conclude quickly that a Dockerized Next.js dashboard is enough for the first useful version.

**Prompt:** Build "LaunchRoom Admin", a portable Next.js admin dashboard with signups, pricing, testimonials, launch tasks, and beginner-safe deployment notes.

**Acceptance criteria:** Next.js App Router, Dockerfile, compose, `.env.example`, concise README, build and compose success within budget.

## 43 Enterprise Risk Register API

**Perspective:** Corporate risk team.

**Success story:** Risk entries need persistence and operational checks. The agent should choose an API with Postgres immediately.

**Prompt:** Build "EnterpriseRisk API", a Fastify and Postgres service for risk register records with health/readiness, migration, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration, health/readiness routes, compose health checks, concise README, build and compose success within budget.

## 44 Enterprise Contract Review Worker

**Perspective:** Legal operations in a corporation.

**Success story:** Contract review jobs are slow and asynchronous. The agent should not hide that work in a request handler.

**Prompt:** Build "ContractQueue Worker", a Fastify and Redis worker stack for contract review jobs with enqueue/list endpoints and worker status.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker heartbeat, `.env.example`, Docker Compose, concise README, build and compose success within budget.

## 45 Agency White-Label Portal

**Perspective:** Agency owner.

**Success story:** I sell white-label dashboards and need a polished first version that looks client-ready and is cheap to run.

**Prompt:** Build "BrandDock Portal", a Dockerized Next.js white-label agency portal with metrics, delivery tasks, pricing, testimonials, and deployment notes.

**Acceptance criteria:** Next.js App Router, responsive UI, standalone output, Docker deploy assets, concise README, build and compose success within budget.

## 46 Solo Consultant CRM API

**Perspective:** Solo consultant.

**Success story:** I need client notes and tasks stored reliably. The agent should pick a small persistent backend and avoid overbuilding.

**Prompt:** Build "ClientTrail API", a Fastify and Postgres CRM backend with health/readiness, migration, Docker Compose, and concise operational notes.

**Acceptance criteria:** Fastify, Postgres, migration, env example, compose health checks, concise README, build and compose success within budget.

## 47 Podcast Publishing Worker

**Perspective:** Content creator.

**Success story:** Publishing episodes and show notes has background steps. The agent should use a queue so the dashboard stays responsive.

**Prompt:** Build "CastQueue Worker", a Fastify and Redis worker stack for podcast publishing jobs.

**Acceptance criteria:** API and worker services, Redis queue, job endpoints, worker status, `.env.example`, Docker Compose, build and compose success within budget.

## 48 Hotel Event Booking Site

**Perspective:** Hotel sales team.

**Success story:** We need an event booking site fast, with pricing packages and credibility, not a generic brochure.

**Prompt:** Build "VenueNorth Events", a Dockerized Next.js hotel event booking site with package pricing, inquiry metrics, testimonials, launch tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, polished responsive UI, standalone Docker output, concise README, build and compose success within budget.

## 49 Insurance Claims API

**Perspective:** Insurance operations.

**Success story:** Claims need durable records and readiness checks. The model should choose Postgres and ship a small auditable backend.

**Prompt:** Build "ClaimDesk API", a Fastify and Postgres claims backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration, health routes, env example, compose health checks, build and compose success within budget.

## 50 Insurance Claims Worker

**Perspective:** Claims processing team.

**Success story:** Some claim checks are slow. The agent should split them into a worker queue immediately.

**Prompt:** Build "ClaimQueue Worker", a Fastify and Redis worker stack for claims processing jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker heartbeat, Docker Compose, concise README, build and compose success within budget.

## 51 Open-Source Sponsor Site

**Perspective:** Maintainer.

**Success story:** I need to explain roadmap value and sponsor tiers without paying for a complex platform.

**Prompt:** Build "SponsorForge", a Dockerized Next.js sponsor site with roadmap metrics, sponsor pricing, testimonials, release tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone output, responsive UI, env example, concise README, build and compose success within budget.

## 52 HR Onboarding API

**Perspective:** HR team.

**Success story:** Onboarding tasks and employee records require a persistent backend with clear readiness checks.

**Prompt:** Build "OnboardLedger API", a Fastify and Postgres onboarding backend with migration, health/readiness, Docker Compose, and operations notes.

**Acceptance criteria:** Fastify, Postgres, migration, health/readiness routes, Docker Compose, concise README, build and compose success within budget.

## 53 HR Onboarding Worker

**Perspective:** HR operations.

**Success story:** Account setup and document reminders should run in the background so onboarding remains responsive.

**Prompt:** Build "OnboardQueue Worker", a Fastify and Redis worker stack for onboarding jobs.

**Acceptance criteria:** API/worker split, Redis queue, job and worker-status endpoints, env example, compose config, build and compose success within budget.

## 54 Sports Club Membership Site

**Perspective:** Volunteer club admin.

**Success story:** I need a professional membership site but need instructions that do not assume I am a developer.

**Prompt:** Build "ClubPulse", a Dockerized Next.js club membership site with membership tiers, activity metrics, testimonials, launch tasks, and short deployment notes.

**Acceptance criteria:** Next.js App Router, responsive UI, standalone Docker deployment, concise README, build and compose success within budget.

## 55 Lab Sample Tracking API

**Perspective:** Lab manager.

**Success story:** Samples must be tracked reliably with health checks and migration-ready storage.

**Prompt:** Build "SampleTrack API", a Fastify and Postgres lab sample backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, env example, compose health checks, build and compose success within budget.

## 56 Lab Result Processing Worker

**Perspective:** Lab operations.

**Success story:** Result processing can be slow and should run asynchronously with visible status.

**Prompt:** Build "ResultQueue Worker", a Fastify and Redis worker stack for lab result processing.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker heartbeat, concise README, build and compose success within budget.

## 57 Conference Call For Papers Site

**Perspective:** Conference organizer.

**Success story:** I need a CFP site with sponsor pricing and submission readiness, not a giant generated essay.

**Prompt:** Build "PaperCall North", a Dockerized Next.js conference CFP site with tracks, submission metrics, sponsor pricing, testimonials, launch tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, responsive UI, standalone Docker output, env example, concise README, build and compose success within budget.

## 58 Warehouse Receiving API

**Perspective:** Warehouse manager.

**Success story:** Receiving events need persistence and a small service that can be deployed on internal infrastructure.

**Prompt:** Build "DockLedger API", a Fastify and Postgres warehouse receiving backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration, health routes, env example, compose health checks, build and compose success within budget.

## 59 Warehouse Label Worker

**Perspective:** Warehouse operations.

**Success story:** Label generation should be queued so staff are not blocked by printer or carrier delays.

**Prompt:** Build "LabelQueue Worker", a Fastify and Redis worker stack for warehouse label jobs.

**Acceptance criteria:** API and worker entrypoints, Redis queue, job endpoints, worker heartbeat, Docker Compose, build and compose success within budget.

## 60 Board Report Portal

**Perspective:** Corporate executive team.

**Success story:** Board reports need concise metrics, risk notes, and a controlled deployment path. The model should avoid bloat and ship quickly.

**Prompt:** Build "BoardBrief Portal", a Dockerized Next.js board report portal with executive metrics, risk notes, pricing impact, testimonials, readiness tasks, and auditable deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive UI, env example, concise rollback/metrics README, build and compose success within budget.
