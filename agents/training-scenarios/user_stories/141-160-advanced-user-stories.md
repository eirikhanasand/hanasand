# Advanced User Story Suite 141-160

This tranche tests whether the agent can make the right product choice under pressure, write only useful operational notes, and produce a deployable project without drifting into explanation bloat. Each story should be solved with a direct scaffold decision, a working build, and a concise README.

## 141 Brand Campaign Control Room

**Perspective:** Senior brand designer.

**Success story:** I need a polished control room for a product campaign, not a vague landing page. Stakeholders should immediately see launch status, assets, metrics, and owners.

**Prompt:** Build "CampaignSignal", a Dockerized Next.js brand campaign control room with asset sections, launch metrics, package tiers, stakeholder quotes, owner tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive campaign UI, `.env.example`, concise rollback/metrics README, build and compose success inside the stricter budget.

## 142 Beginner Photographer Site

**Perspective:** Total newbie starting a photography business.

**Success story:** I want a trustworthy site I can deploy without learning a stack first. The agent should choose the web scaffold quickly and give short run instructions.

**Prompt:** Build "FrameLocal", a Dockerized Next.js photography booking site with service sections, booking metrics, pricing bands, client quotes, launch tasks, and beginner-safe deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive service-business UI, concise README, `.env.example`, build and compose success inside budget.

## 143 Corporate Policy Exception API

**Perspective:** Enterprise governance platform team.

**Success story:** Policy exceptions need persistent tracking, readiness probes, and migrations so internal systems can rely on them.

**Prompt:** Build "PolicyException API", a Fastify and Postgres backend for policy exception records with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, `/health`, `/ready`, compose health checks, `.env.example`, concise README, build and compose success inside budget.

## 144 Corporate Policy Review Worker

**Perspective:** Governance operations lead.

**Success story:** Exception reviews and reminder jobs should run asynchronously so new requests are never blocked by slow reviewers.

**Prompt:** Build "PolicyReview Queue", a Fastify and Redis worker stack for policy exception review jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker-status route, Docker Compose, concise README, build and compose success inside budget.

## 145 Construction Bid Portal

**Perspective:** Construction project manager.

**Success story:** Subcontractors need a clear bid portal with packages, dates, risks, and owner tasks. It should be operational and self-hosted, not a brochure.

**Prompt:** Build "BidNorth", a Dockerized Next.js construction bid portal with trade sections, bid metrics, package tiers, contractor quotes, submission tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive operational UI, `.env.example`, concise rollback/metrics README, build and compose success inside budget.

## 146 Construction Bid API

**Perspective:** Construction technology lead.

**Success story:** Bid submissions need durable state and readiness checks before field teams depend on the backend.

**Prompt:** Build "BidLedger API", a Fastify and Postgres construction bid backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, compose health checks, concise README, build and compose success inside budget.

## 147 Construction Notification Worker

**Perspective:** Site coordination manager.

**Success story:** Bid reminders and site notifications must be queued so submission intake remains fast during deadline spikes.

**Prompt:** Build "SiteNotify Queue", a Fastify and Redis worker stack for construction bid notification jobs.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker heartbeat/status, Docker Compose, concise README, build and compose success inside budget.

## 148 Legal Matter Dashboard

**Perspective:** Law firm operations director.

**Success story:** Attorneys need a sober dashboard for matter status, deadlines, documents, and next actions. It cannot look like a startup marketing page.

**Prompt:** Build "MatterSignal", a Dockerized Next.js legal matter dashboard with matter sections, deadline metrics, retainer tiers, client quotes, review tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive work-focused UI, `.env.example`, concise README, build and compose success inside budget.

## 149 Legal Intake API

**Perspective:** Legal technology engineer.

**Success story:** Intake records need persistence, migrations, and probes so the firm can trust the service before integrating it.

**Prompt:** Build "IntakeLedger API", a Fastify and Postgres legal intake backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, health/readiness routes, compose health checks, `.env.example`, concise README, build and compose success inside budget.

## 150 Legal Deadline Worker

**Perspective:** Paralegal team lead.

**Success story:** Deadline reminders must run in the background because case intake should not wait on notification work.

**Prompt:** Build "DeadlineQueue Worker", a Fastify and Redis worker stack for legal deadline reminder jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker-status route, Docker Compose, concise README, build and compose success inside budget.

## 151 Climate Grant Portal

**Perspective:** Nonprofit climate program manager.

**Success story:** Applicants need a clear grant portal with funding tracks, impact metrics, deadlines, and document tasks. Staff should be able to self-host it.

**Prompt:** Build "GrantSignal", a Dockerized Next.js climate grant portal with funding sections, impact metrics, sponsor tiers, applicant quotes, submission tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive nonprofit UI, `.env.example`, concise rollback/metrics README, build and compose success inside budget.

## 152 Climate Grant API

**Perspective:** Nonprofit platform engineer.

**Success story:** Grant applications need durable records and readiness probes before reviewers can depend on them.

**Prompt:** Build "GrantLedger API", a Fastify and Postgres climate grant backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, `/health`, `/ready`, compose health checks, concise README, build and compose success inside budget.

## 153 Climate Review Worker

**Perspective:** Grant review coordinator.

**Success story:** Reviewer reminders and scoring summaries should run asynchronously so submissions keep flowing.

**Prompt:** Build "GrantReview Queue", a Fastify and Redis worker stack for climate grant review jobs.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker heartbeat/status, Docker Compose, concise README, build and compose success inside budget.

## 154 Logistics Yard Board

**Perspective:** Warehouse shift supervisor.

**Success story:** Dispatchers need a yard board for dock status, route pressure, exceptions, and actions. It must be quick to inspect during a shift.

**Prompt:** Build "YardSignal", a Dockerized Next.js logistics yard board with dock sections, throughput metrics, escalation tiers, dispatcher quotes, action tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive operations UI, `.env.example`, concise README, build and compose success inside budget.

## 155 Logistics Yard API

**Perspective:** Logistics systems engineer.

**Success story:** Yard movements need durable state, migrations, and health checks before scanners and planning tools integrate.

**Prompt:** Build "YardLedger API", a Fastify and Postgres logistics yard backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, health/readiness routes, compose health checks, `.env.example`, concise README, build and compose success inside budget.

## 156 Logistics Alert Worker

**Perspective:** Dispatch operations lead.

**Success story:** Delay alerts and dock reminders should queue in the background so movement intake remains responsive.

**Prompt:** Build "YardAlert Queue", a Fastify and Redis worker stack for logistics yard alert jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker-status route, Docker Compose, concise README, build and compose success inside budget.

## 157 Product Research Repository

**Perspective:** Corporate research manager.

**Success story:** Product teams need a research repository with themes, evidence, decisions, and owners. It should be sober and useful, not decorative.

**Prompt:** Build "InsightSignal", a Dockerized Next.js product research repository with study sections, evidence metrics, access tiers, researcher quotes, synthesis tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive research UI, `.env.example`, concise rollback/metrics README, build and compose success inside budget.

## 158 Product Research API

**Perspective:** Product platform engineer.

**Success story:** Research notes and decisions need durable storage and readiness checks before teams connect internal tools.

**Prompt:** Build "InsightLedger API", a Fastify and Postgres product research backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, health/readiness routes, compose health checks, `.env.example`, concise README, build and compose success inside budget.

## 159 Product Research Worker

**Perspective:** Research operations lead.

**Success story:** Tagging jobs and digest generation should be queued so researchers can keep saving notes quickly.

**Prompt:** Build "InsightQueue Worker", a Fastify and Redis worker stack for product research digest jobs.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker heartbeat/status, Docker Compose, concise README, build and compose success inside budget.

## 160 Investor Data Room

**Perspective:** Startup CFO.

**Success story:** Investors need a controlled data room with metrics, documents, risks, and owner actions. It should be concise, polished, and self-hostable.

**Prompt:** Build "DataRoomSignal", a Dockerized Next.js investor data room with document sections, KPI metrics, access tiers, investor quotes, diligence tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive executive UI, `.env.example`, concise rollback/metrics README, build and compose success inside budget.
