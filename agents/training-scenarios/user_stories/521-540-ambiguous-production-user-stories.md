# User Stories 521-540: Ambiguous Production Pressure

These stories test whether the agent can turn fuzzy real-world requests into deployable, focused software without overbuilding. Prompts are intentionally terse and under-specified so the agent must infer the smallest useful product shape, preserve trust, and avoid spending tokens on ornamental explanation.

## 521. "The Architect Portfolio Feels Like a Template"

Perspective: a senior architect who cares about restraint.

User ask: "Make my portfolio feel credible. Projects, process, press, contact. No giant sales pitch."

Success signals:
- Builds an architect portfolio site with selected projects, project metadata, process, press/awards, contact, and image-safe layout placeholders.
- Keeps typography and spacing restrained, editorial, and accessible.
- Avoids fake booking flows and exaggerated claims.

Failure signals:
- Generic agency landing page.
- No project detail structure.
- Bloated hero copy.

## 522. "Project Inquiries Are Buried in Email"

Perspective: a solo architecture studio.

User ask: "Track project inquiries with property type, budget range, timeline, location, client status, and notes."

Success signals:
- Builds a Postgres API for architecture inquiries with property type, budget range, timeline, location, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps it an intake tracker, not a CRM.

Failure signals:
- No status/timeline.
- Full CRM scope.
- Missing migration.

## 523. "Inquiry Followups Need Taste"

Perspective: an architect who hates spam.

User ask: "Queue followups for new inquiries, but only once per inquiry revision and dry-run by default."

Success signals:
- Creates a Redis worker with inquiry followup jobs, idempotency by inquiry/revision, retry/dead-letter visibility, and dry-run default.
- Includes status and enqueue routes.
- Documents rollback and environment variables.

Failure signals:
- Sends real messages by default.
- No revision guard.
- Silent retries.

## 524. "The Nonprofit Page Is Too Vague"

Perspective: a nonprofit director.

User ask: "We need a clear site for donations, programs, impact, board, reports, and ways to help. Do not invent numbers."

Success signals:
- Builds a nonprofit site with programs, impact narrative without fake metrics, board/governance, annual reports, donation caveats, volunteer/contact paths.
- Uses practical trust cues and clear calls to action.
- Avoids fake payment handling.

Failure signals:
- Invented impact statistics.
- Generic charity copy.
- Fake donation checkout.

## 525. "Donor Pledges Need Audit Trail"

Perspective: a nonprofit operations manager.

User ask: "Track pledges, donor category, amount, restricted purpose, status, receipt flag, and notes."

Success signals:
- Builds a Postgres API for pledges with donor category, amount, restricted purpose, status, receipt flag, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps personally identifying donor data out of example content.

Failure signals:
- Stores unnecessary sensitive details in examples.
- No restricted/status fields.
- Missing migration.

## 526. "Receipts Must Be Controlled"

Perspective: a nonprofit finance volunteer.

User ask: "Queue receipt reminders after pledge status changes. Show failures. No accidental emails."

Success signals:
- Creates a Redis worker for receipt reminder jobs, idempotent by pledge/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and secrets.
- Avoids real email delivery by default.

Failure signals:
- Real delivery enabled by default.
- No status-version idempotency.
- No failed job visibility.

## 527. "The Clinic Needs a Calm Information Page"

Perspective: a clinic administrator.

User ask: "People ask the same things. Hours, services, insurance caveats, prep instructions, accessibility, urgent care disclaimer."

Success signals:
- Builds a clinic information site with services, hours, insurance caveats, prep instructions, accessibility, contact, and urgent/emergency disclaimer.
- Avoids collecting health data.
- Uses calm, clear, accessible content.

Failure signals:
- Intake form asking for medical details.
- No urgent-care disclaimer.
- Generic wellness landing page.

## 528. "Appointment Requests Need Triage"

Perspective: a clinic front desk lead.

User ask: "Track requests with service, preferred time, urgency level, insurance status, contact preference, and notes."

Success signals:
- Builds a Postgres API for appointment requests with service, preferred time, urgency level, insurance status, contact preference, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps it a request tracker, not medical diagnosis.

Failure signals:
- Diagnosis fields or PHI-heavy examples.
- No urgency/contact preference.
- Missing migration.

## 529. "Clinic Reminders Need Safety Rails"

Perspective: a clinic ops person.

User ask: "Queue appointment request nudges, but don't expose health details and make failures visible."

Success signals:
- Creates a Redis worker with appointment nudge jobs, payload minimization, idempotency, retries, dead-letter visibility, dry-run default, and status routes.
- Documents secret handling and rollback.
- Avoids logging sensitive notes.

Failure signals:
- Logs full patient notes.
- Real messages by default.
- No dead-letter route.

## 530. "A Manufacturer Needs a Serious Capability Page"

Perspective: a B2B manufacturer.

User ask: "Show capabilities, materials, tolerances, industries, quality docs, quote path. No startup fluff."

Success signals:
- Builds a manufacturing capability site with materials, tolerances, industries, quality documentation, quote path, lead-time caveats, and technical tone.
- Avoids fake configurators and unsupported certifications.
- Keeps information scannable for procurement.

Failure signals:
- SaaS-style landing page.
- Fake certification claims.
- No quote/process caveats.

## 531. "RFQs Need Structure"

Perspective: an inside sales coordinator.

User ask: "Track RFQs with material, process, quantity, tolerance, drawing received, due date, status, and notes."

Success signals:
- Builds a Postgres API for RFQs with material, process, quantity, tolerance, drawing received flag, due date, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps file upload out of scope unless stubbed clearly.

Failure signals:
- Full quoting engine.
- No drawing/status/due-date fields.
- Missing migration.

## 532. "RFQ Followups Should Respect Engineering"

Perspective: an estimator.

User ask: "Queue followups for stale RFQs and missing drawings, but never spam."

Success signals:
- Creates a Redis worker for RFQ followups with job type, idempotency by RFQ/reason/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents operational rollback.
- Keeps followup content generic.

Failure signals:
- No reason/version guard.
- Real messages enabled.
- No failed job visibility.

## 533. "The Wedding Vendor Site Feels Fake"

Perspective: a wedding florist.

User ask: "I need packages, seasonal flowers, gallery, process, budget notes, and inquiry path. Less Pinterest, more trust."

Success signals:
- Builds a wedding florist site with packages, seasonal availability, gallery placeholders, planning process, budget caveats, inquiry path, and credible tone.
- Avoids fake checkout and fake availability calendar.
- Uses polished but practical design.

Failure signals:
- Generic event landing page.
- No budget/seasonality caveats.
- Fake cart.

## 534. "Wedding Inquiries Need Priorities"

Perspective: a florist managing busy season.

User ask: "Track wedding date, venue, rough budget, style, guest count, status, source, and notes."

Success signals:
- Builds a Postgres API for wedding inquiries with date, venue, budget range, style, guest count, status, source, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps it focused on inquiry triage.

Failure signals:
- Full event planner.
- No date/status/budget.
- Missing migration.

## 535. "Seasonal Followups Need Boundaries"

Perspective: a florist owner.

User ask: "Queue proposal reminders by wedding date and inquiry status. Dry-run first."

Success signals:
- Creates a Redis worker for proposal reminder jobs, idempotent by inquiry/status/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents scheduling assumptions and rollback.
- Avoids real messages by default.

Failure signals:
- No status/version guard.
- Real messages by default.
- No failure visibility.

## 536. "A Municipality Microsite Needs Clarity"

Perspective: a communications officer.

User ask: "Make a project page for roadworks. Timeline, affected streets, access, updates, contacts, documents. Plain language."

Success signals:
- Builds a municipal roadworks microsite with timeline, affected streets, access/parking notes, updates, contacts, documents, and plain-language accessibility.
- Avoids political campaign tone.
- Includes operational caveats without pretending to be live GIS.

Failure signals:
- Promotional city landing page.
- No affected streets/access.
- Fake live map.

## 537. "Roadwork Updates Need an API"

Perspective: a municipal project assistant.

User ask: "Track updates, affected street, date, category, severity, public flag, owner, and notes."

Success signals:
- Builds a Postgres API for roadwork updates with street, date, category, severity, public flag, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps moderation/publication simple.

Failure signals:
- Full CMS.
- No public/severity/category.
- Missing migration.

## 538. "Resident Alerts Must Be Careful"

Perspective: a municipal communications lead.

User ask: "Queue alerts for public roadwork updates. Don't send duplicates and show what failed."

Success signals:
- Creates a Redis worker for resident alert jobs, idempotent by update/version/channel, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and contact-provider configuration.
- Avoids real broadcast by default.

Failure signals:
- No duplicate guard.
- Real broadcast by default.
- No failure route.

## 539. "The Internal Tool Vendor Page Needs Procurement Trust"

Perspective: a corporate buyer.

User ask: "Make a vendor page with security, deployment, support, pricing caveats, procurement docs, and pilot path. Cut the hype."

Success signals:
- Builds a B2B vendor site with security posture, deployment options, support, pricing caveats, procurement docs, pilot path, and restrained enterprise tone.
- Avoids unsupported compliance claims.
- Keeps content dense and scannable.

Failure signals:
- Startup hype page.
- Fake compliance badges.
- No procurement/pilot path.

## 540. "Pilot Requests Need Accountability"

Perspective: a corporate partnerships manager.

User ask: "Track pilot requests with company type, deployment preference, security review status, support tier, owner, stage, and notes."

Success signals:
- Builds a Postgres API for pilot requests with company type, deployment preference, security review status, support tier, owner, stage, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps sales automation out of scope.

Failure signals:
- Full CRM.
- No security/stage fields.
- Missing migration.
