# Advanced User Story Suite 101-120

This tranche keeps pressure on the agent to act like a product builder, not a verbose consultant. Each story requires it to choose the right scaffold quickly, generate deployable code, keep the README short, and preserve operational proof through build and compose checks.

## 101 Designer Campaign Microsite

**Perspective:** Freelance campaign designer.

**Success story:** I need a polished microsite for a campaign launch that stakeholders can inspect today. It should feel designed, but it must still be easy to self-host.

**Prompt:** Build "LaunchCanvas", a Dockerized Next.js campaign microsite with creative sections, launch metrics, package tiers, stakeholder quotes, task status, and concise deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive UI, `.env.example`, concise rollback/metrics README, build and compose success within the stricter budget.

## 102 Newbie Appointment API

**Perspective:** First-time clinic founder.

**Success story:** I asked for booking logic, not a static page. I need the agent to pick a durable backend without explaining stacks for ages.

**Prompt:** Build "AppointmentLedger API", a Fastify and Postgres appointment backend with migration, health/readiness routes, Docker Compose, and beginner-safe metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, compose health checks, concise README, build and compose success within budget.

## 103 Newbie Reminder Worker

**Perspective:** Nontechnical service operator.

**Success story:** Reminder jobs should run in the background so users are not blocked. The generated project must show the queue and worker clearly.

**Prompt:** Build "ReminderRun Queue", a Fastify and Redis worker stack for appointment reminder jobs.

**Acceptance criteria:** API and worker services, Redis queue, job endpoints, worker heartbeat/status, Docker Compose, concise README, build and compose success within budget.

## 104 Corporate Vendor Portal

**Perspective:** Enterprise procurement team.

**Success story:** Vendor onboarding needs a sober internal portal with status, risk, and next actions. A marketing page would be the wrong product.

**Prompt:** Build "VendorGate", a Dockerized Next.js vendor onboarding portal with risk categories, review metrics, package tiers, buyer quotes, readiness tasks, and controlled deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive operational UI, concise rollback/metrics README, build and compose success within budget.

## 105 Corporate Vendor API

**Perspective:** Corporate platform owner.

**Success story:** Vendor records need persistence and readiness checks before other systems can integrate.

**Prompt:** Build "VendorLedger API", a Fastify and Postgres vendor onboarding backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, env example, compose health checks, build and compose success within budget.

## 106 Corporate Vendor Worker

**Perspective:** Procurement operations.

**Success story:** Document review and risk scoring should be queued so procurement staff can keep submitting vendors.

**Prompt:** Build "VendorReview Queue", a Fastify and Redis worker stack for vendor document review jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker heartbeat, concise README, build and compose success within budget.

## 107 Designer Case Study Portal

**Perspective:** Senior product designer.

**Success story:** I need a case study portal that shows measurable product impact, not a generic portfolio.

**Prompt:** Build "ImpactFrames", a Dockerized Next.js case study portal with project sections, outcome metrics, service tiers, client quotes, handoff tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, responsive polished UI, standalone Docker output, env example, concise README, build and compose success within budget.

## 108 Startup Usage API

**Perspective:** SaaS founder.

**Success story:** I need a real usage ledger for pricing experiments. The agent should not make a dashboard when the prompt asks for an API.

**Prompt:** Build "UsageLedger API", a Fastify and Postgres usage tracking backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration, health/readiness routes, compose health checks, build and compose success within budget.

## 109 Startup Billing Worker

**Perspective:** Startup operations lead.

**Success story:** Billing summaries should be asynchronous because usage imports arrive in batches.

**Prompt:** Build "BillingQueue Worker", a Fastify and Redis worker stack for billing summary jobs.

**Acceptance criteria:** API/worker split, Redis queue, job and worker-status endpoints, concise README, build and compose success within budget.

## 110 Municipality Service Portal

**Perspective:** Public-sector digital team.

**Success story:** Residents need a clear service portal with status and next steps. It must be self-hostable and understandable by staff.

**Prompt:** Build "CivicSignal", a Dockerized Next.js municipal service portal with service categories, response metrics, cost tiers, resident quotes, application tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive UI, env example, concise rollback/metrics README, build and compose success within budget.

## 111 Municipality Request API

**Perspective:** City service manager.

**Success story:** Service requests need durable records and readiness probes so internal teams can run the backend.

**Prompt:** Build "RequestLedger API", a Fastify and Postgres municipal request backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, compose health checks, build and compose success within budget.

## 112 Municipality Dispatch Worker

**Perspective:** City operations dispatcher.

**Success story:** Dispatch notifications must queue in the background because spikes happen during storms and outages.

**Prompt:** Build "DispatchQueue Worker", a Fastify and Redis worker stack for municipal dispatch jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker heartbeat, Docker Compose, build and compose success within budget.

## 113 Security Trust Center Site

**Perspective:** B2B security lead.

**Success story:** Buyers need a trust center with concrete security sections and operational status, not fluffy compliance copy.

**Prompt:** Build "TrustSignal Center", a Dockerized Next.js security trust center with control groups, assurance metrics, plan tiers, customer quotes, evidence tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, responsive UI, standalone Docker output, concise rollback/metrics README, build and compose success within budget.

## 114 Security Exception API

**Perspective:** Enterprise security analyst.

**Success story:** Security exceptions need durable state, migrations, and health checks before teams depend on them.

**Prompt:** Build "ExceptionLedger API", a Fastify and Postgres security exception backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, env example, compose health checks, build and compose success within budget.

## 115 Security Exception Worker

**Perspective:** Compliance operations.

**Success story:** Exception reviews should be queued because evidence checks can be slow.

**Prompt:** Build "ExceptionQueue Worker", a Fastify and Redis worker stack for security exception review jobs.

**Acceptance criteria:** API and worker services, Redis queue, job endpoints, worker heartbeat, concise README, build and compose success within budget.

## 116 Creator Launch Hub

**Perspective:** Solo creator.

**Success story:** I need a launch hub that helps me sell without being trapped on a hosted platform. The output should be polished and deployable.

**Prompt:** Build "LaunchHearth", a Dockerized Next.js creator launch hub with offer sections, revenue metrics, pricing levels, audience quotes, launch tasks, and beginner-safe deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive UI, `.env.example`, concise README, build and compose success within budget.

## 117 Manufacturer Work Order API

**Perspective:** Factory operations manager.

**Success story:** Work orders need persistent tracking and health checks before floor supervisors use the system.

**Prompt:** Build "WorkOrderLedger API", a Fastify and Postgres manufacturing work order backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, compose health checks, build and compose success within budget.

## 118 Manufacturer Work Order Worker

**Perspective:** Production coordinator.

**Success story:** Follow-up tasks and escalation notices must run asynchronously so work order intake stays fast.

**Prompt:** Build "WorkOrderQueue Worker", a Fastify and Redis worker stack for manufacturing work order follow-up jobs.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker-status endpoint, Docker Compose, build and compose success within budget.

## 119 Research Review Site

**Perspective:** Research program director.

**Success story:** Reviewers need a concise portal for themes, evidence, and funding impact that can run on our own server.

**Prompt:** Build "ReviewSignal Lab", a Dockerized Next.js research review portal with research themes, impact metrics, sponsor tiers, reviewer quotes, submission tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, responsive UI, standalone Docker output, concise README, build and compose success within budget.

## 120 Logistics Routing API

**Perspective:** Logistics planner.

**Success story:** Route plans need persistent records and readiness probes. A static logistics landing page would fail.

**Prompt:** Build "RouteLedger API", a Fastify and Postgres logistics routing backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration, health/readiness routes, env example, compose health checks, build and compose success within budget.
