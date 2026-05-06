# Share Chat Critical User Stories 201-220

These stories are intentionally harder than the earlier builder set. They are written from skeptical or frustrated users who have been burned by generic AI builders, lock-in, bad accessibility, weak exports, broken deployment, hidden limits, vague progress, and fragile business workflows.

Research basis from Reddit complaint themes:
- Output looks generic or like "AI slop" instead of intentional design.
- Sites miss WCAG/ADA accessibility, SEO, and business-specific structure.
- Builders create lock-in, weak export paths, or single-file projects that cannot grow.
- Ecommerce/product pages, forms, auth, and custom integrations break first.
- Users want real code, Docker/self-hosting, validation, health checks, and clear handoff.

## 201. Angry Founder Landing Page
As a founder who has already rejected two generic AI landing pages, I want Chat to build a conversion-focused landing page with proof, pricing, objections, FAQ, and exportable source so it does not look like a template dressed in glassmorphism.

Acceptance:
- Produces a runnable multi-file Next.js project, not a single HTML blob.
- Includes Dockerfile, docker-compose.yml, README, and .env.example.
- Includes accessible navigation, lead form labels, concrete copy, and no vague placeholder sections.

## 202. Local Restaurant Reservation Site
As a restaurant owner who is tired of pretty sites with broken booking flow, I want a mobile-first reservation site with menu, allergens, hours, events, location, and private dining CTAs.

Acceptance:
- Includes responsive sections for menu/allergens, reservations, hours, guest proof, and location.
- Includes a labelled form and clear production handoff notes.
- Keeps export/self-hosting straightforward.

## 203. Discord Moderation Bot
As a community moderator who has seen bots leak tokens or delete things too eagerly, I want a Discord bot starter with safe env handling, role command stubs, status, and audit history.

Acceptance:
- Uses .env.example for tokens and never hardcodes secrets.
- Includes command handling, audit trail, and destructive-action stubs.
- Includes Docker and README run instructions.

## 204. Healthcare Intake API
As a clinic admin who cannot accept toy demos, I want an intake API with validation, health/readiness, safe token handling, and a clear path from in-memory demo to real persistence.

Acceptance:
- Includes /health and /ready routes.
- Validates required request fields and returns shaped errors.
- Includes Docker/export files and env documentation.

## 205. Ecommerce Product Page Rebuild
As a shop owner who tried an AI builder and got awful product formatting, I want a product launch page with bundles, shipping notes, reviews, FAQ, return-policy upload space, and conversion CTAs.

Acceptance:
- Includes product/store sections with concrete copy.
- Includes accessibility and SEO-oriented metadata.
- Includes exportable Docker handoff.

## 206. Webhook Idempotency Ledger
As a platform engineer who hates duplicate webhook processing, I want a webhook ledger API with idempotency keys, validation, health, readiness, and audit-shaped records.

Acceptance:
- Includes POST route with idempotency handling.
- Includes safe token handling and shaped errors.
- Includes Docker and README verification steps.

## 207. Invoice Export Worker
As an operations lead who has lost background jobs silently, I want a queue starter with enqueue API, worker entrypoint, retries, dead-letter status, and worker-status endpoint.

Acceptance:
- Includes queue abstraction, API route, worker entrypoint, and retry/dead-letter concepts.
- Includes Redis production seam in compose.
- Avoids destructive automatic side effects.

## 208. Accessibility-First Service Site
As a business owner worried about ADA/WCAG risk, I want a service website that starts with keyboard flow, labels, contrast, skip links, and concrete maintenance notes.

Acceptance:
- Includes skip link, labelled form fields, accessible navigation, and responsive layout.
- Includes README instructions for keyboard and Lighthouse checks.
- Includes no random/gibberish class names or inaccessible placeholder controls.

## 209. Local SEO Contractor Site
As a contractor who needs leads from nearby customers, I want a local SEO site with services, location proof, reviews, pricing ranges, quote CTA, and metadata.

Acceptance:
- Includes local-business sections and non-generic copy.
- Includes metadata and responsive layout.
- Includes exportable source, Docker, and .env.example.

## 210. Multi-Tenant Admin Dashboard
As an agency lead who outgrew one-off demos, I want a dashboard prototype with tenant metrics, risk flags, task queues, empty states, and a path to real data.

Acceptance:
- Includes metrics/records/follow-ups/risk/next-action sections.
- Includes clear future data integration notes.
- Runs as a normal multi-file project.

## 211. Support Knowledge Base Portal
As a support manager who hates content trapped inside a builder, I want a docs/knowledge portal with quickstarts, categories, status callouts, escalation paths, and exportable code.

Acceptance:
- Includes docs-style sections and readable typography.
- Includes README and Docker handoff.
- Avoids auth-only assumptions.

## 212. Privacy-Sensitive Portfolio
As an artist worried about scraping and lock-in, I want a portfolio starter that emphasizes control, export, contact, case studies, and content replacement guidance.

Acceptance:
- Includes portfolio sections and clear handoff notes.
- Includes no external image dependencies by default.
- Includes export/self-hosting files.

## 213. Restaurant Group Operations API
As a restaurant group operator, I want an API to track booking requests, statuses, readiness, and admin review without pretending there is a full database yet.

Acceptance:
- Includes validation, status records, /health, /ready, and token handling.
- Includes a README explaining the persistence seam.
- Includes Docker and env example.

## 214. Image Review Queue
As a photographer who needs fast culling without accidental deletion, I want an image review tool with keep/reject-later language, counters, export summary, and accessible controls.

Acceptance:
- Includes review queue, keep/reject later, collection, and export-summary sections.
- Makes deletion deferred until confirmation in the copy.
- Includes responsive and accessible layout.

## 215. Compliance Audit API
As a compliance reviewer who distrusts vague audit logs, I want an audit API with shaped records, validation, idempotency where useful, health/readiness, and consistent errors.

Acceptance:
- Includes audit-like records and health/readiness routes.
- Includes validation and safe token handling.
- Includes exportable Docker handoff.

## 216. CSV Import Worker
As a finance operator who has seen imports freeze, I want a CSV import queue with enqueue route, worker entrypoint, retry/dead-letter states, and status endpoint.

Acceptance:
- Includes worker queue files and Redis compose seam.
- Includes retry/dead-letter language and no silent failure path.
- Includes README verification steps.

## 217. Conference Site With Schedule Pressure
As an event organizer who needs something publishable today, I want a conference site with schedule, speakers, tracks, sponsors, tickets, venue, and mobile CTAs.

Acceptance:
- Includes event-specific sections and concrete copy.
- Includes responsive layout and accessible nav.
- Includes Docker/export handoff.

## 218. Auth Repair Starter
As a developer burned by AI-generated auth bugs, I want an API starter that does not fake auth but clearly gates writes behind an API token and documents where real auth belongs.

Acceptance:
- Includes token-gated write route with shaped 403 errors.
- Includes .env.example and README auth seam notes.
- Includes health/readiness routes.

## 219. Observability Status Page
As an ops lead who wants fewer black boxes, I want a status page with uptime proof, incident timeline, service cards, customer messaging, and operational handoff notes.

Acceptance:
- Includes status/incident/service sections and non-generic copy.
- Includes responsive and accessible layout.
- Includes self-hosting files and README verification steps.

## 220. Game Server Control Bot
As a game server admin who refuses unsafe restarts, I want a bot/service starter with status commands, maintenance notices, audit trail, and restart request stubs that never execute destructively by default.

Acceptance:
- Includes safe command handling and audit history.
- Includes env example, Docker, and README run instructions.
- Does not hardcode secrets or run destructive actions automatically.
