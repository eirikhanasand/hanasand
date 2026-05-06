# Advanced User Story Suite 81-100

This tranche raises the bar on speed and decisiveness again. The agent should select the correct scaffold immediately, avoid generic planning text, and leave a small deployable project that builds on the first pass.

## 81 Designer Asset Approval Site

**Perspective:** Senior brand designer.

**Success story:** I need a fast approval room for campaign assets. A generic landing page is not enough; stakeholders need proof, status, and launch tasks.

**Prompt:** Build "ProofDeck", a Dockerized Next.js creative asset approval portal with asset sections, approval metrics, package tiers, stakeholder quotes, review tasks, and concise deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive polished UI, `.env.example`, concise rollback/metrics README, build and compose success within the tighter budget.

## 82 Agency Retainer API

**Perspective:** Agency operations lead.

**Success story:** Retainer hours and client commitments need durable records. The agent should choose a Postgres backend fast.

**Prompt:** Build "RetainerLedger API", a Fastify and Postgres service for agency retainer tracking with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, compose health checks, concise README, build and compose success within budget.

## 83 Agency Report Worker

**Perspective:** Account strategist.

**Success story:** Client reports should render asynchronously so account managers are not blocked waiting on exports.

**Prompt:** Build "ReportQueue Worker", a Fastify and Redis worker stack for agency report generation jobs.

**Acceptance criteria:** API and worker services, Redis queue, job endpoints, worker heartbeat, Docker Compose, concise README, build and compose success within budget.

## 84 Newbie Service Directory Site

**Perspective:** Nontechnical founder.

**Success story:** I want a local service directory and do not know the stack. The agent should ship a usable site and keep instructions short.

**Prompt:** Build "LocalList Starter", a Dockerized Next.js local service directory with categories, lead metrics, pricing cards, testimonials, onboarding tasks, and beginner-safe deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, env example, concise README, build and compose success within budget.

## 85 Clinic Referral API

**Perspective:** Clinic coordinator.

**Success story:** Referrals need persistence and readiness checks. A static intake page would fail the job.

**Prompt:** Build "ReferralDesk API", a Fastify and Postgres clinic referral backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration, health/readiness routes, env example, compose health checks, build and compose success within budget.

## 86 Clinic Reminder Worker

**Perspective:** Patient operations team.

**Success story:** Reminder notifications should run in the background and expose worker status.

**Prompt:** Build "CareReminder Queue", a Fastify and Redis worker stack for clinic reminder jobs.

**Acceptance criteria:** API/worker split, Redis queue, job and worker-status endpoints, concise README, build and compose success within budget.

## 87 Enterprise Risk Briefing Site

**Perspective:** Corporate risk officer.

**Success story:** Executives need a controlled briefing portal with risk categories and action status. It should not read like marketing fluff.

**Prompt:** Build "RiskBrief HQ", a Dockerized Next.js executive risk briefing portal with mitigation metrics, investment tiers, board quotes, readiness tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, responsive UI, standalone Docker output, concise rollback/metrics README, build and compose success within budget.

## 88 Fintech Dispute API

**Perspective:** Fintech support manager.

**Success story:** Disputes need durable state and operational checks before automation is added.

**Prompt:** Build "DisputeLedger API", a Fastify and Postgres dispute backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, compose health checks, build and compose success within budget.

## 89 Fintech Reconciliation Worker

**Perspective:** Finance operations.

**Success story:** Reconciliation jobs should be queued and observable because payment files arrive in bursts.

**Prompt:** Build "ReconcileQueue Worker", a Fastify and Redis worker stack for reconciliation jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker heartbeat, concise README, build and compose success within budget.

## 90 Municipal Permit Site

**Perspective:** City digital services team.

**Success story:** Residents need a clear permit guide that can be self-hosted and updated by staff.

**Prompt:** Build "PermitPath", a Dockerized Next.js municipal permit guidance site with permit categories, service metrics, pricing impact, citizen quotes, application tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, polished responsive UI, standalone Docker output, env example, concise README, build and compose success within budget.

## 91 Municipal Casework API

**Perspective:** Public-sector case manager.

**Success story:** Casework requests need durable storage and health checks so an internal ops team can run them.

**Prompt:** Build "CaseworkLedger API", a Fastify and Postgres municipal casework backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration, health routes, env example, compose health checks, build and compose success within budget.

## 92 Municipal Notification Worker

**Perspective:** City communications team.

**Success story:** Citizen notifications should not block case updates and must expose queue status.

**Prompt:** Build "NoticeQueue Worker", a Fastify and Redis worker stack for municipal notification jobs.

**Acceptance criteria:** API/worker split, Redis queue, job endpoints, worker status, Docker Compose, build and compose success within budget.

## 93 B2B Security Comparison Site

**Perspective:** Enterprise buyer.

**Success story:** I need a trustworthy security comparison site with concrete controls, not a generic SaaS hero.

**Prompt:** Build "SecureCompare", a Dockerized Next.js B2B security comparison site with control categories, trust metrics, plan tiers, customer quotes, procurement tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker deployment, responsive UI, concise rollback/metrics README, build and compose success within budget.

## 94 Security Questionnaire API

**Perspective:** Vendor security team.

**Success story:** Security questionnaire answers need a durable backend with readiness checks.

**Prompt:** Build "QuestionnaireVault API", a Fastify and Postgres security questionnaire backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration, health/readiness, env example, compose health checks, build and compose success within budget.

## 95 Security Evidence Worker

**Perspective:** Compliance engineer.

**Success story:** Evidence collection should run asynchronously because large exports and screenshots take time.

**Prompt:** Build "EvidenceQueue Worker", a Fastify and Redis worker stack for security evidence collection jobs.

**Acceptance criteria:** API service, worker service, Redis queue, job endpoints, worker heartbeat, concise README, build and compose success within budget.

## 96 Creator Membership Site

**Perspective:** Independent creator.

**Success story:** I need a membership site I can run myself, with clear pricing and deployment notes.

**Prompt:** Build "MemberForge", a Dockerized Next.js creator membership site with benefits, revenue metrics, pricing levels, subscriber quotes, launch tasks, and beginner-safe deployment notes.

**Acceptance criteria:** Next.js App Router, responsive UI, standalone Docker output, env example, concise README, build and compose success within budget.

## 97 Manufacturer Quality API

**Perspective:** Quality manager.

**Success story:** Quality findings need durable records and health checks before inspectors use the system.

**Prompt:** Build "QualityLedger API", a Fastify and Postgres manufacturing quality backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration script, health/readiness routes, compose health checks, build and compose success within budget.

## 98 Manufacturer Inspection Worker

**Perspective:** Factory operations.

**Success story:** Inspection follow-ups should be queued so floor teams can keep submitting findings.

**Prompt:** Build "InspectionQueue Worker", a Fastify and Redis worker stack for manufacturing inspection jobs.

**Acceptance criteria:** API and worker entrypoints, Redis queue, job endpoints, worker heartbeat, Docker Compose, build and compose success within budget.

## 99 Research Lab Grant Site

**Perspective:** Research administrator.

**Success story:** We need a grant showcase that makes funding themes and impact clear without requiring a hosted platform.

**Prompt:** Build "GrantSignal Lab", a Dockerized Next.js research grant showcase with funding themes, impact metrics, sponsor tiers, collaborator quotes, submission tasks, and deployment notes.

**Acceptance criteria:** Next.js App Router, standalone Docker output, responsive UI, concise README, build and compose success within budget.

## 100 Logistics Customs API

**Perspective:** Logistics operator.

**Success story:** Customs documents need persistent tracking and readiness checks. The agent should select a backend, not a brochure site.

**Prompt:** Build "CustomsDesk API", a Fastify and Postgres logistics customs backend with migration, health/readiness, Docker Compose, and metrics notes.

**Acceptance criteria:** Fastify, Postgres, migration, health routes, env example, compose health checks, build and compose success within budget.
