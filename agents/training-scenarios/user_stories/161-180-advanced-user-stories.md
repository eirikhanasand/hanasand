# Advanced User Story Suite 161-180

This tranche keeps pressure on the agent to pick the right deployable scaffold immediately, spend fewer tokens on stack discussion, and ship operationally useful code. The stories intentionally cover designers, beginners, corporations, field teams, regulated workflows, and revenue workflows.

## 161 Design QA Portal

**Perspective:** Product design QA lead.

**Success story:** I need a clean portal for design review findings, launch readiness, owners, and stakeholder sign-off. It should be useful to engineers and designers on the same day.

**Prompt:** Build "DesignQASignal", a Dockerized Next.js design QA portal with review sections, defect metrics, service tiers, stakeholder quotes, handoff tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive review UI, `.env.example`, concise rollback/metrics README, build and compose success inside the stricter budget.

## 162 Beginner Cleaning Service Site

**Perspective:** Total newbie starting a cleaning business.

**Success story:** I need a trustworthy website with packages, proof, and a simple booking path. I do not want a long stack explanation or a half-finished static mockup.

**Prompt:** Build "CleanLocal", a Dockerized Next.js cleaning service website with service sections, response metrics, pricing packages, customer quotes, launch tasks, and beginner-safe deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive local-service UI, `.env.example`, concise README, build and compose success inside budget.

## 163 Enterprise Asset Inventory API

**Perspective:** Corporate IT platform owner.

**Success story:** Asset inventory records need persistence, migrations, and health checks before internal teams can connect automation.

**Prompt:** Build "AssetLedger API", a Fastify and Postgres enterprise asset inventory backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, `/health`, `/ready`, compose health checks, `.env.example`, concise README, build and compose success inside budget.

## 164 Enterprise Asset Audit Worker

**Perspective:** IT audit operations lead.

**Success story:** Asset checks and exception notices should run asynchronously so inventory intake stays responsive during audits.

**Prompt:** Build "AssetAudit Queue", a Fastify and Redis worker stack for enterprise asset audit jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker-status route, Docker Compose, concise README, build and compose success inside budget.

## 165 Retail Returns Portal

**Perspective:** Ecommerce operations manager.

**Success story:** Customers and staff need a self-hosted returns portal with status, policies, evidence, and next steps. It should feel operational, not promotional.

**Prompt:** Build "ReturnSignal", a Dockerized Next.js retail returns portal with return sections, resolution metrics, policy tiers, customer quotes, processing tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive operations UI, `.env.example`, concise rollback/metrics README, build and compose success inside budget.

## 166 Retail Returns API

**Perspective:** Ecommerce backend engineer.

**Success story:** Returns need durable records, readiness probes, and migrations before support teams can trust the workflow.

**Prompt:** Build "ReturnLedger API", a Fastify and Postgres returns backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, health/readiness routes, compose health checks, `.env.example`, concise README, build and compose success inside budget.

## 167 Retail Refund Worker

**Perspective:** Support operations lead.

**Success story:** Refund review and customer notification jobs should be queued so intake does not slow down during sales events.

**Prompt:** Build "RefundQueue Worker", a Fastify and Redis worker stack for retail refund processing jobs.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker heartbeat/status, Docker Compose, concise README, build and compose success inside budget.

## 168 Museum Exhibit Site

**Perspective:** Museum digital curator.

**Success story:** Visitors need a rich but self-hostable exhibit site with themes, accessibility notes, schedule, and sponsor proof. It should be polished without becoming decorative fluff.

**Prompt:** Build "ExhibitSignal", a Dockerized Next.js museum exhibit site with exhibit sections, visitor metrics, ticket tiers, curator quotes, accessibility tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive cultural-site UI, `.env.example`, concise README, build and compose success inside budget.

## 169 Museum Collection API

**Perspective:** Cultural archive engineer.

**Success story:** Collection records need durable storage and readiness checks before catalogs and public tools integrate.

**Prompt:** Build "CollectionLedger API", a Fastify and Postgres museum collection backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, health/readiness routes, compose health checks, `.env.example`, concise README, build and compose success inside budget.

## 170 Museum Digitization Worker

**Perspective:** Archive operations coordinator.

**Success story:** Digitization reminders and processing summaries should run in the background so catalog intake stays fast.

**Prompt:** Build "DigitizeQueue Worker", a Fastify and Redis worker stack for museum digitization jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker-status route, Docker Compose, concise README, build and compose success inside budget.

## 171 Security Incident Portal

**Perspective:** Corporate security response lead.

**Success story:** During incidents, teams need a sober portal for scope, status, customer impact, owners, and next actions. It must be quickly scannable.

**Prompt:** Build "IncidentSignal", a Dockerized Next.js security incident portal with incident sections, response metrics, severity tiers, stakeholder quotes, action tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive command UI, `.env.example`, concise rollback/metrics README, build and compose success inside budget.

## 172 Security Incident API

**Perspective:** Security platform engineer.

**Success story:** Incident records need persistence, migrations, and health checks before alerting tools can connect.

**Prompt:** Build "IncidentLedger API", a Fastify and Postgres security incident backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, `/health`, `/ready`, compose health checks, concise README, build and compose success inside budget.

## 173 Security Notification Worker

**Perspective:** Security operations manager.

**Success story:** Notification fan-out and follow-up reminders should queue asynchronously so incident intake stays fast.

**Prompt:** Build "IncidentNotify Queue", a Fastify and Redis worker stack for security incident notification jobs.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker heartbeat/status, Docker Compose, concise README, build and compose success inside budget.

## 174 Agency Client Health Board

**Perspective:** Agency account director.

**Success story:** Account teams need a board for client health, risks, retainers, proof, and next actions. It should be dense enough for weekly review.

**Prompt:** Build "ClientHealthSignal", a Dockerized Next.js agency client health board with client sections, health metrics, retainer tiers, client quotes, action tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive agency dashboard UI, `.env.example`, concise README, build and compose success inside budget.

## 175 Agency Client API

**Perspective:** Agency technical lead.

**Success story:** Client health records need durable storage and readiness probes before dashboards and automations rely on them.

**Prompt:** Build "ClientHealthLedger API", a Fastify and Postgres agency client health backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, health/readiness routes, compose health checks, `.env.example`, concise README, build and compose success inside budget.

## 176 Agency Report Worker

**Perspective:** Agency operations lead.

**Success story:** Weekly report generation should run in the background so account managers can keep updating client records.

**Prompt:** Build "ClientReport Queue", a Fastify and Redis worker stack for agency client report jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker-status route, Docker Compose, concise README, build and compose success inside budget.

## 177 Farmer CSA Membership Site

**Perspective:** Small farm owner.

**Success story:** Members need a clear CSA site with shares, pickup schedules, seasonal proof, and signup tasks. The site must be deployable by a nontechnical owner.

**Prompt:** Build "HarvestSignal", a Dockerized Next.js CSA membership site with share sections, harvest metrics, membership tiers, member quotes, pickup tasks, and beginner-safe deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive local-commerce UI, `.env.example`, concise README, build and compose success inside budget.

## 178 Farm Subscription API

**Perspective:** Farm cooperative systems lead.

**Success story:** Subscription and pickup records need persistence and health checks before staff use it during busy harvest weeks.

**Prompt:** Build "HarvestLedger API", a Fastify and Postgres farm subscription backend with migration, health/readiness routes, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres migration script, health/readiness routes, compose health checks, `.env.example`, concise README, build and compose success inside budget.

## 179 Farm Reminder Worker

**Perspective:** CSA operations coordinator.

**Success story:** Pickup reminders and route summaries should be queued so signup intake remains responsive.

**Prompt:** Build "HarvestQueue Worker", a Fastify and Redis worker stack for CSA pickup reminder jobs.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker heartbeat/status, Docker Compose, concise README, build and compose success inside budget.

## 180 Executive Decision Log

**Perspective:** Corporate chief of staff.

**Success story:** Leadership needs a controlled decision log with owners, rationale, risks, and follow-up actions. It must be concise, professional, and self-hostable.

**Prompt:** Build "DecisionSignal", a Dockerized Next.js executive decision log with decision sections, follow-up metrics, governance tiers, stakeholder quotes, action tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive executive UI, `.env.example`, concise rollback/metrics README, build and compose success inside budget.
