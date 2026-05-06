# Advanced User Story Suite 121-140

This tranche raises the bar for fast, correct product execution. The agent should choose the right deployable scaffold immediately, avoid long stack lectures, keep documentation operational and concise, and prove the result with build and Docker Compose checks.

## 121 Designer Handoff Portal

**Perspective:** Design systems lead.

**Success story:** I need a polished handoff portal that engineers can use without another meeting. It should show components, readiness, stakeholder proof, and deployment notes in one self-hosted package.

**Prompt:** Build "HandoffNorth", a Dockerized Next.js design handoff portal with component groups, release metrics, service tiers, stakeholder quotes, implementation tasks, and concise deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive product UI, `.env.example`, concise rollback/metrics README, build and compose success inside the stricter budget.

## 122 Beginner Trades Website

**Perspective:** Total newbie running an electrician business.

**Success story:** I need a site that looks trustworthy today and tells me exactly how to run it. I do not want a long explanation or a pile of undecided options.

**Prompt:** Build "VoltLocal", a Dockerized Next.js electrician website with services, response metrics, simple pricing bands, customer quotes, launch checklist, and beginner-safe deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive local-business UI, concise README, `.env.example`, build and compose success inside budget.

## 123 Enterprise Access Request API

**Perspective:** Corporate identity platform team.

**Success story:** Access requests need durable records, readiness probes, and a migration path before security will let teams use it.

**Prompt:** Build "AccessLedger API", a Fastify and Postgres access-request backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, `/health`, `/ready`, compose health checks, `.env.example`, concise README, build and compose success inside budget.

## 124 Enterprise Provisioning Worker

**Perspective:** IT operations lead.

**Success story:** Provisioning tasks can be slow and must not block request intake. The generated stack should make the worker path obvious.

**Prompt:** Build "ProvisionQueue Worker", a Fastify and Redis worker stack for access provisioning jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker-status route, Docker Compose, concise README, build and compose success inside budget.

## 125 Compliance Evidence Room

**Perspective:** Compliance manager preparing a customer audit.

**Success story:** I need a trustable evidence room, not a marketing page. Buyers should see control families, gaps, owner tasks, and proof of operations.

**Prompt:** Build "EvidenceRoom", a Dockerized Next.js compliance evidence portal with control families, audit metrics, assurance tiers, reviewer quotes, evidence tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive operational UI, rollback/metrics README, `.env.example`, build and compose success inside budget.

## 126 Compliance Finding API

**Perspective:** GRC platform owner.

**Success story:** Audit findings need persistence and readiness checks so teams can integrate without guessing.

**Prompt:** Build "FindingLedger API", a Fastify and Postgres audit finding backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, compose health checks, concise README, build and compose success inside budget.

## 127 Compliance Remediation Worker

**Perspective:** Audit remediation coordinator.

**Success story:** Remediation reminders and evidence checks should run in the background so new findings can still be accepted.

**Prompt:** Build "RemediateQueue Worker", a Fastify and Redis worker stack for compliance remediation jobs.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker heartbeat/status, Docker Compose, concise README, build and compose success inside budget.

## 128 Marketplace Seller Console

**Perspective:** Small marketplace founder.

**Success story:** Sellers need a focused console for orders, payouts, listing health, and launch tasks. A generic SaaS homepage would fail.

**Prompt:** Build "SellerSignal", a Dockerized Next.js seller console with listing sections, payout metrics, pricing plans, seller quotes, onboarding tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive dashboard UI, `.env.example`, concise README, build and compose success inside budget.

## 129 Marketplace Order API

**Perspective:** Marketplace backend engineer.

**Success story:** Order state needs a durable API with migrations and health checks before checkout work can depend on it.

**Prompt:** Build "OrderLedger API", a Fastify and Postgres marketplace order backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, health/readiness routes, compose health checks, `.env.example`, build and compose success inside budget.

## 130 Marketplace Fulfillment Worker

**Perspective:** Marketplace operations manager.

**Success story:** Fulfillment updates and seller notifications should queue asynchronously because order spikes happen during promotions.

**Prompt:** Build "FulfillQueue Worker", a Fastify and Redis worker stack for marketplace fulfillment jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker-status route, Docker Compose, concise README, build and compose success inside budget.

## 131 Hospital Staffing Board

**Perspective:** Hospital operations planner.

**Success story:** Staff need a self-hosted board for shift pressure, staffing gaps, and actions. It must feel practical and controlled, not decorative.

**Prompt:** Build "ShiftSignal", a Dockerized Next.js hospital staffing board with unit sections, coverage metrics, escalation tiers, coordinator quotes, staffing tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive operations UI, concise rollback/metrics README, `.env.example`, build and compose success inside budget.

## 132 Hospital Credential API

**Perspective:** Healthcare platform engineer.

**Success story:** Credential records need persistence, migrations, and readiness probes before clinical operations can trust the service.

**Prompt:** Build "CredentialLedger API", a Fastify and Postgres hospital credential backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, `/health`, `/ready`, compose health checks, concise README, build and compose success inside budget.

## 133 Hospital Credential Worker

**Perspective:** Credentialing coordinator.

**Success story:** License checks and renewal notices should run in the background so intake remains fast.

**Prompt:** Build "CredentialQueue Worker", a Fastify and Redis worker stack for hospital credential verification jobs.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker heartbeat/status, Docker Compose, concise README, build and compose success inside budget.

## 134 School Enrollment Portal

**Perspective:** School administrator.

**Success story:** Families need a clear enrollment portal that staff can run locally. It should explain status, documents, deadlines, and next actions without overwhelming new users.

**Prompt:** Build "EnrollNorth", a Dockerized Next.js school enrollment portal with program sections, application metrics, fee tiers, parent quotes, document tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive public-service UI, `.env.example`, concise README, build and compose success inside budget.

## 135 School Enrollment API

**Perspective:** District technology director.

**Success story:** Applications need durable records and readiness checks before schools can rely on the backend.

**Prompt:** Build "EnrollmentLedger API", a Fastify and Postgres school enrollment backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, health/readiness routes, compose health checks, `.env.example`, concise README, build and compose success inside budget.

## 136 School Notification Worker

**Perspective:** Enrollment operations team.

**Success story:** Family notifications and document reminders must run asynchronously because deadlines create bursts.

**Prompt:** Build "EnrollmentQueue Worker", a Fastify and Redis worker stack for school enrollment notification jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker-status route, Docker Compose, concise README, build and compose success inside budget.

## 137 Data Team Quality Dashboard

**Perspective:** Analytics engineering lead.

**Success story:** The data team needs a dashboard for pipeline quality, freshness, owners, and incidents. The agent must produce an operational tool, not just a pretty landing page.

**Prompt:** Build "FreshnessBoard", a Dockerized Next.js data quality dashboard with pipeline sections, freshness metrics, support tiers, stakeholder quotes, incident tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive data-ops UI, `.env.example`, concise rollback/metrics README, build and compose success inside budget.

## 138 Data Contract API

**Perspective:** Data platform engineer.

**Success story:** Data contracts need persistent records, migrations, and probes so other services can integrate safely.

**Prompt:** Build "ContractLedger API", a Fastify and Postgres data contract backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, health/readiness routes, compose health checks, `.env.example`, concise README, build and compose success inside budget.

## 139 Data Sync Worker

**Perspective:** Analytics operations lead.

**Success story:** Dataset syncs and freshness checks should run in a queue so API users are not blocked by long tasks.

**Prompt:** Build "SyncQueue Worker", a Fastify and Redis worker stack for data freshness sync jobs.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker heartbeat/status, Docker Compose, concise README, build and compose success inside budget.

## 140 Executive Board Pack Site

**Perspective:** Corporate strategy director.

**Success story:** Leadership needs a concise, self-hosted board pack with decisions, metrics, risks, and owners. It must be polished but sober.

**Prompt:** Build "BoardSignal", a Dockerized Next.js executive board pack site with decision sections, KPI metrics, investment tiers, stakeholder quotes, action tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive executive UI, `.env.example`, concise rollback/metrics README, build and compose success inside budget.
