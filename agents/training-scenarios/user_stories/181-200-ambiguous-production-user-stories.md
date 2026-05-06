# Ambiguous Production User Stories 181-200

These stories deliberately give the agent less help than the earlier suites. The user asks are messy, incomplete, and sometimes internally vague, but the output still has to become a runnable, self-hostable project with operational basics. This tranche checks whether the agent can infer the useful shape quickly without spending tokens on long discovery loops.

## 181. "Make My Agency Site Less Embarrassing"
Perspective: designer/founder.

User ask: "Our site looks like a template and I hate sending it to clients. Make it look like a real tiny agency. I do brand, Webflow cleanup, and launch help. No giant manifesto."

What success means:
- Creates a polished agency site with focused hero, proof, services, selected work, pricing cues, testimonials, and contact CTA.
- Keeps the copy specific and concise, with no filler claims like "innovative solutions".
- Produces a runnable standalone Next.js project with Docker Compose, `.env.example`, metrics/rollback notes, and mobile-safe layout.

Failure signals:
- Asks for excessive clarification before building.
- Produces a generic marketing page that could be any company.
- Omits deployment or rollback instructions.

## 182. "Orders Are Everywhere"
Perspective: newbie shop owner.

User ask: "I have orders in emails, Stripe, and a spreadsheet. Need a tiny API to get this under control before Monday. I do not know what database tables are called."

What success means:
- Creates a Fastify/Postgres service with order, customer, status, and audit-oriented structure.
- Includes health/readiness routes, migrations, `.env.example`, Docker Compose, and safe validation/error shapes.
- Explains local operations briefly enough for a beginner to run it.

Failure signals:
- Assumes a hosted SaaS dependency.
- Hardcodes secrets or skips readiness.
- Writes a long essay instead of a working API scaffold.

## 183. "Email Keeps Getting Lost"
Perspective: overwhelmed operator.

User ask: "Every launch email is manual and someone forgets. Give me a queue thing. It should retry and show me if it is jammed."

What success means:
- Creates a Redis-backed worker/API starter with enqueue, worker status, retry, and failed-job concepts.
- Includes safe `.env.example`, Docker Compose, and operational README with metrics and rollback notes.
- Keeps destructive or real email sending stubbed until configured.

Failure signals:
- Sends real email by default.
- Has no worker entrypoint or queue status route.
- Ignores retry/failure behavior.

## 184. "The CEO Wants a Board Pack Thing"
Perspective: corporation/chief of staff.

User ask: "Can you make something board-ready for initiatives, blockers, decisions, and asks? It should feel executive, not startup cute."

What success means:
- Creates a restrained executive dashboard with initiatives, risk, decisions, owner asks, timeline, and status metrics.
- Uses concise enterprise language and scannable layout.
- Ships as a standalone Next.js/Docker project with operational docs.

Failure signals:
- Uses playful or consumer-style UI.
- Hides the important statuses behind decorative cards.
- Does not build.

## 185. "Finance CSV Mess"
Perspective: finance operator.

User ask: "The accountant sends CSVs and the numbers never match. I need an API shape for imports, mismatches, approvals, and notes. Keep it boring."

What success means:
- Creates a Postgres-backed API with reconciliation/import/mismatch-oriented resources.
- Includes migrations, health/readiness, Docker Compose, `.env.example`, and audit-friendly README.
- Uses conservative naming and clear error responses.

Failure signals:
- Builds only a dashboard with no API path.
- Omits auditability.
- Requires paid third-party finance APIs to run.

## 186. "The Import Job Duplicates Stuff"
Perspective: platform engineer.

User ask: "We need a worker for imports that can retry without double-processing everything. Make a starter, I will wire the real source later."

What success means:
- Creates a Redis worker/API starter with idempotency-oriented job payloads, status route, retry/dead-letter language, and safe stubs.
- Includes Docker Compose, `.env.example`, and concise operational instructions.
- Avoids pretending to solve the unknown external integration.

Failure signals:
- No idempotency concept.
- No worker status route.
- Overexplains instead of scaffolding.

## 187. "Artist Drop Page, But Not Cringe"
Perspective: independent creator.

User ask: "I am releasing prints next month. Need a page that feels premium but not luxury nonsense. People should understand editions, dates, and shipping."

What success means:
- Creates a polished product/drop page with edition details, launch timeline, shipping notes, proof, FAQ, and purchase CTA.
- Uses tasteful visual hierarchy and concrete copy.
- Ships as a runnable Next.js/Docker project.

Failure signals:
- Generic ecommerce page.
- Missing date/edition/shipping details.
- Layout breaks on mobile.

## 188. "Clinic Intake, Maybe HIPAA Later"
Perspective: small clinic admin.

User ask: "We need an intake backend for forms and follow-ups. Do not make legal promises. Just structure it so it is not a mess."

What success means:
- Creates a Postgres API with intake, patient/contact, form status, follow-up, and audit-friendly structure.
- Includes health/readiness, migration script, validation, `.env.example`, and Docker Compose.
- Uses cautious README language about compliance boundaries.

Failure signals:
- Claims compliance certification.
- Stores secrets or sensitive examples unsafely.
- Skips migrations.

## 189. "Patients Forget Appointments"
Perspective: clinic operations.

User ask: "Make a reminder worker skeleton. It should not actually text people yet. I need retries and a way to see what is pending."

What success means:
- Creates a Redis worker/API starter with enqueue, pending/status route, retry/failure handling, and provider stub.
- Includes Docker Compose, `.env.example`, and operational README.
- Keeps real messaging disabled until configured.

Failure signals:
- Sends real messages by default.
- No status visibility.
- No retry or failure model.

## 190. "Nobody Reads the Permit Page"
Perspective: municipal communications.

User ask: "Residents keep calling because the permit page is confusing. Make a clearer page for permits, timelines, fees, documents, and where to ask."

What success means:
- Creates a civic-service page with permit types, timeline, fee/document checklist, office hours, status CTA, and plain-language FAQ.
- Uses accessible, calm design.
- Ships as a standalone Next.js/Docker project.

Failure signals:
- Marketing-style hype.
- Missing plain-language structure.
- No deployment docs.

## 191. "Permit Status API"
Perspective: municipal IT.

User ask: "The public page needs an API eventually. Start the boring backend for permit status, staff notes, and audit trail."

What success means:
- Creates a Postgres API with permit/status/note-oriented resources, migrations, health/readiness, and Docker Compose.
- Uses safe validation and consistent error response patterns.
- Documents local operation, metrics, and rollback concisely.

Failure signals:
- No migration script.
- No readiness route.
- Treats staff notes as public by default.

## 192. "Tell People When Their Permit Changes"
Perspective: municipal operations.

User ask: "We need notifications later when permit status changes. Make a worker starter with queue and retries, no real SMS yet."

What success means:
- Creates a Redis worker/API starter with queued notification jobs, status route, retry/dead-letter concepts, and provider stub.
- Includes `.env.example`, Docker Compose, and operational docs.
- Avoids real outbound delivery by default.

Failure signals:
- No worker entrypoint.
- No retry/failure visibility.
- Hardcodes provider credentials.

## 193. "I Need a Chores App, I Think"
Perspective: total newbie.

User ask: "My family needs something for chores and allowance maybe. I don't know. Make a first version I can understand."

What success means:
- Creates a beginner-friendly household dashboard with chores, assignments, allowance/progress, reminders, and empty states.
- Uses simple copy and obvious layout.
- Ships as a runnable Next.js/Docker project with beginner-safe README.

Failure signals:
- Builds an overcomplicated enterprise task manager.
- Requires auth or payments to demo.
- Uses jargon-heavy setup instructions.

## 194. "Maintenance Requests Are in Texts"
Perspective: property manager.

User ask: "Tenants text me repairs and I lose them. Need an API starter for requests, units, urgency, vendors, and notes."

What success means:
- Creates a Postgres API with maintenance request, unit, vendor, urgency/status, and note-oriented structure.
- Includes migrations, health/readiness, Docker Compose, `.env.example`, and rollback/metrics docs.
- Avoids exposing private tenant notes casually.

Failure signals:
- No persistence plan.
- No validation/error shapes.
- Uses destructive admin actions without safeguards.

## 195. "Dispatch the Repair Jobs"
Perspective: small operations team.

User ask: "Make the background worker part for sending repair jobs to vendors later. It needs retries and a jammed queue view."

What success means:
- Creates a Redis worker/API starter with dispatch jobs, status route, retry/dead-letter concepts, and safe vendor-send stub.
- Includes Docker Compose and concise operational README.
- Keeps real outbound vendor messages disabled by default.

Failure signals:
- No queue status.
- No failed-job path.
- Sends real vendor requests by default.

## 196. "Policy Portal That People Might Actually Use"
Perspective: corporation/internal comms.

User ask: "Our policy docs are impossible. Make a portal-ish first screen for policy categories, what's changed, owners, and how to ask questions."

What success means:
- Creates an internal portal UI with policy categories, recent changes, owner/contact sections, acknowledgement cues, and search-like structure.
- Uses restrained enterprise UI and concise copy.
- Ships as a standalone Next.js/Docker project.

Failure signals:
- Marketing landing page tone.
- No ownership/change visibility.
- Missing run/deploy instructions.

## 197. "Legal Hold Tracker"
Perspective: legal operations.

User ask: "Need the backend skeleton for legal holds, custodians, notices, acknowledgements, and audit trail. Keep it careful."

What success means:
- Creates a Postgres API with legal hold/custodian/notice/acknowledgement-oriented resources.
- Includes migrations, health/readiness, Docker Compose, `.env.example`, and audit-focused README.
- Uses cautious language and avoids legal-compliance overclaiming.

Failure signals:
- Claims legal compliance.
- No audit trail concept.
- No readiness route.

## 198. "Exports Cannot Fail Silently"
Perspective: legal/compliance engineer.

User ask: "Make a worker skeleton for legal exports. It should queue, retry, show status, and never pretend the export succeeded."

What success means:
- Creates a Redis worker/API starter with export jobs, status route, retry/dead-letter concepts, and safe storage stub.
- Includes operational README, `.env.example`, and Docker Compose.
- Makes failure visibility explicit.

Failure signals:
- No failed-job state.
- No worker entrypoint.
- Writes fake successful exports without status.

## 199. "Ugly Spreadsheet CRM"
Perspective: freelancer/newbie.

User ask: "My leads are in an ugly sheet. Make me a simple CRM screen for who to follow up with and what might close. I hate CRMs."

What success means:
- Creates a simple CRM dashboard with leads, next follow-up, deal stage, notes, metrics, empty states, and import/export cues.
- Uses low-friction copy for a non-technical freelancer.
- Ships as a runnable standalone Next.js/Docker project.

Failure signals:
- Enterprise CRM bloat.
- Requires auth/payment integrations to demo.
- Omits deployment and rollback notes.

## 200. "Turn That CRM Into an API"
Perspective: practical small-business operator.

User ask: "If the CRM screen works I need a backend later. Start the API for leads, notes, follow-ups, stages, and basic audit."

What success means:
- Creates a Postgres API with lead, note, follow-up, stage, and audit-oriented structure.
- Includes migrations, health/readiness, Docker Compose, `.env.example`, and concise run/rollback/metrics docs.
- Keeps future UI integration obvious.

Failure signals:
- No migration script.
- No validation/error shapes.
- Too much explanation and not enough runnable structure.
