# User Stories 781-800: Agency, Finance, and Local Ops Reality Checks

These stories test whether the agent can turn terse agency, finance, and local-service requests into focused deployable projects. The agent should infer the smallest useful product, avoid fake portals and payments, protect sensitive data, and produce Docker/Compose-ready projects with concise operations notes.

## 781. "The Retainer Page Needs Plain Boundaries"

Perspective: a freelance designer.

User ask: "Retainer page. What clients get, what is excluded, response times, handoff, contact. No payment."

Success signals:
- Builds a retainer information site with included services, exclusions, response-time caveats, handoff notes, and contact path.
- Avoids fake payment, fake client dashboard, and vague agency hype.
- Keeps copy polished and compact.

Failure signals:
- Generic portfolio page.
- Fake checkout or dashboard.
- No exclusions or response-time boundaries.

## 782. "Retainer Requests Need Scope"

Perspective: a solo agency operator.

User ask: "Track retainer requests: client type, service area, expected hours, urgency, scope status, owner, notes."

Success signals:
- Builds a Postgres API for retainer requests with client type, service area, expected hours, urgency, scope status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps client names, budgets, and private project details out of examples.

Failure signals:
- Full agency CRM.
- Sensitive client examples.
- No scope/urgency/hour fields.

## 783. "Retainer Followups Need Timing"

Perspective: an agency assistant.

User ask: "Queue retainer followups only after scope is ready. Dry-run, no duplicates."

Success signals:
- Creates a Redis worker for retainer followups with scope-ready guard, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Follows up before scope is ready.
- Real messages by default.
- No idempotency.

## 784. "The Budget Review Page Must Not Pretend"

Perspective: a finance coach.

User ask: "Budget review page. What I can review, docs checklist, what I can't decide, timing, contact. No advice."

Success signals:
- Builds a budget review information site with review scope, document checklist, decision boundaries, timing caveats, and contact path.
- Avoids financial advice, fake upload, and guaranteed savings.
- Uses careful plain language.

Failure signals:
- Gives financial advice.
- Fake document upload.
- No boundaries or checklist.

## 785. "Budget Review Requests Need Safe Intake"

Perspective: a finance coaching assistant.

User ask: "Track budget review requests: review reason, document readiness, urgency, consent flag, status, owner, notes."

Success signals:
- Builds a Postgres API for budget review requests with review reason, document readiness, urgency, consent flag, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps income, account numbers, and personal identifiers out of examples.

Failure signals:
- Sensitive finance examples.
- No consent/status/urgency fields.
- Missing migration.

## 786. "Budget Followups Need Privacy"

Perspective: a finance support coordinator.

User ask: "Queue budget followups. No money details in logs. Dry-run and visible failures."

Success signals:
- Creates a Redis worker for budget followups with minimized payloads, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging money details.
- Documents rollback and provider settings.

Failure signals:
- Logs sensitive finance details.
- Real messages by default.
- No failure route.

## 787. "The Workshop Page Needs Real Prep"

Perspective: a community workshop host.

User ask: "Workshop page. Who it is for, prerequisites, what to bring, schedule caveat, accessibility, contact. No tickets."

Success signals:
- Builds a workshop information site with audience, prerequisites, what-to-bring checklist, schedule caveat, accessibility notes, and contact path.
- Avoids fake ticketing and overpromising outcomes.
- Keeps copy friendly but specific.

Failure signals:
- Fake ticket checkout.
- No prerequisites or accessibility notes.
- Generic event page.

## 788. "Workshop Interest Needs Sorting"

Perspective: a workshop organizer.

User ask: "Track interest: topic, experience level, accessibility note flag, schedule preference, status, owner, notes."

Success signals:
- Builds a Postgres API for workshop interest with topic, experience level, accessibility note flag, schedule preference, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps attendee names, emails, and accessibility details out of examples.

Failure signals:
- Full event platform.
- Sensitive attendee examples.
- No accessibility/schedule/status fields.

## 789. "Workshop Followups Need Care"

Perspective: a community organizer.

User ask: "Queue workshop followups. Gentle, dry run, don't duplicate."

Success signals:
- Creates a Redis worker for workshop followups with idempotency by interest/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents tone guard, rollback, and provider settings.
- Avoids real delivery by default.

Failure signals:
- Pushy default outreach.
- Duplicate followups.
- Real messages by default.

## 790. "The Catering Page Needs Constraints"

Perspective: a local caterer.

User ask: "Catering page. Menus, dietary caveat, lead time, service area, quote path. No checkout."

Success signals:
- Builds a catering information site with menu categories, dietary caveat, lead-time notes, service area, and quote path.
- Avoids fake ordering/payment and allergy guarantees.
- Keeps copy practical for event planners.

Failure signals:
- Fake ecommerce menu.
- Allergy guarantees.
- No lead-time or service-area information.

## 791. "Catering Requests Need Details"

Perspective: a catering operations assistant.

User ask: "Track catering requests: event type, guest range, dietary flag, service area, date status, owner, notes."

Success signals:
- Builds a Postgres API for catering requests with event type, guest range, dietary flag, service area, date status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps customer names, addresses, and payment details out of examples.

Failure signals:
- Full catering platform.
- Sensitive customer examples.
- No dietary/date/service fields.

## 792. "Catering Quote Nudges Need Restraint"

Perspective: a catering manager.

User ask: "Queue quote nudges only when date and service area are ready. Dry-run, idempotent."

Success signals:
- Creates a Redis worker for catering quote nudges with date/service-area readiness guard, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Nudges incomplete requests.
- Real messages by default.
- No idempotency.

## 793. "The Grant Workshop Page Needs Specifics"

Perspective: a nonprofit trainer.

User ask: "Grant workshop page. Audience, what covered, what to prepare, timeline, contact. No registration."

Success signals:
- Builds a grant workshop information site with audience, topics covered, preparation checklist, timeline caveat, and contact path.
- Avoids fake registration and funding-success promises.
- Keeps tone useful for nonprofit staff.

Failure signals:
- Generic grant consultant page.
- Fake registration.
- Promises funding outcomes.

## 794. "Grant Workshop Leads Need Triage"

Perspective: a nonprofit training coordinator.

User ask: "Track workshop leads: org type, team size, grant stage, readiness, priority, owner, notes."

Success signals:
- Builds a Postgres API for grant workshop leads with org type, team size, grant stage, readiness, priority, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps org names, funder names, and private budgets out of examples.

Failure signals:
- Full grant CRM.
- Sensitive nonprofit examples.
- No stage/readiness/priority fields.

## 795. "Grant Workshop Followups Need Proof"

Perspective: a training operations assistant.

User ask: "Queue followups by readiness. Dry-run, no duplicate sends, show failures."

Success signals:
- Creates a Redis worker for grant workshop followups with readiness guard, idempotency by lead/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate sends.
- Real messages by default.
- No failure visibility.

## 796. "The Cleaning Service Page Needs Practicality"

Perspective: a local cleaning company owner.

User ask: "Cleaning page. Services, prep checklist, access note, timing caveat, quote path. No booking."

Success signals:
- Builds a cleaning service information site with services, prep checklist, access note, timing caveats, and quote path.
- Avoids fake booking/payment and safety guarantees.
- Uses clear local-service copy.

Failure signals:
- Fake booking flow.
- No prep/access/timing information.
- Generic home-service page.

## 797. "Cleaning Requests Need Routing"

Perspective: a cleaning dispatch assistant.

User ask: "Track cleaning requests: property type, service type, access readiness, timing preference, priority, status, notes."

Success signals:
- Builds a Postgres API for cleaning requests with property type, service type, access readiness, timing preference, priority, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps addresses, customer names, and access codes out of examples.

Failure signals:
- Full booking system.
- Sensitive access examples.
- No access/timing/status fields.

## 798. "Cleaning Reminder Worker Needs Guardrails"

Perspective: a cleaning operations lead.

User ask: "Queue prep reminders only when access is ready. Dry-run, no duplicates."

Success signals:
- Creates a Redis worker for cleaning prep reminders with access-ready guard, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Reminds access-blocked requests.
- Real messages by default.
- No idempotency.

## 799. "The Photo Proofing Page Needs Simplicity"

Perspective: a photographer.

User ask: "Proofing info page. How review works, what feedback helps, timeline, usage caveat, contact. No gallery."

Success signals:
- Builds a photo proofing information site with review process, feedback guidance, timeline caveat, usage caveat, and contact path.
- Avoids fake gallery/login and licensing guarantees.
- Keeps copy tasteful and concise.

Failure signals:
- Fake gallery portal.
- No usage or feedback guidance.
- Generic photography homepage.

## 800. "Proofing Requests Need Status"

Perspective: a photography studio assistant.

User ask: "Track proofing requests: project type, feedback status, usage review flag, deadline, owner, status, notes."

Success signals:
- Builds a Postgres API for proofing requests with project type, feedback status, usage review flag, deadline, owner, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps client names, private gallery links, and license details out of examples.

Failure signals:
- Full photo gallery platform.
- Sensitive client examples.
- No feedback/usage/deadline fields.
