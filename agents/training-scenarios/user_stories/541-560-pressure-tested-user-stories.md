# User Stories 541-560: Pressure-Tested Ambiguous Builds

These stories focus on users who know the pain but do not know how to specify software. The agent should infer a small deployable product, avoid sensitive-data mistakes, keep copy and implementation concise, and produce verifiable Docker/Compose-ready projects quickly.

## 541. "The Accountant Site Sounds Like Everyone Else"

Perspective: a small-business accountant.

User ask: "Make the site sound serious. Services, deadlines, what clients bring, pricing caveats, contact. No fake tax advice."

Success signals:
- Builds an accountant services site with services, filing deadlines, client document checklist, pricing caveats, contact path, and professional trust cues.
- Avoids personalized tax advice or fake guarantees.
- Keeps the design restrained and easy to scan.

Failure signals:
- Generic finance landing page.
- Gives tax advice as fact.
- No document checklist or deadline framing.

## 542. "Client Documents Are Chaos"

Perspective: a bookkeeper.

User ask: "Track document requests, client category, tax year, document type, due date, status, received flag, and notes."

Success signals:
- Builds a Postgres API for client document requests with client category, tax year, document type, due date, status, received flag, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps sample data non-sensitive.

Failure signals:
- Stores personal tax details in examples.
- No due date/status/received flag.
- Missing migration.

## 543. "Document Chasers Must Not Annoy Clients"

Perspective: an accounting office manager.

User ask: "Queue document reminders only when missing, once per request version. Dry-run."

Success signals:
- Creates a Redis worker for missing-document reminders with idempotency by request/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider configuration.
- Avoids real email/SMS by default.

Failure signals:
- Real delivery by default.
- No version guard.
- No failed job visibility.

## 544. "A Renovation Contractor Needs Fewer Bad Leads"

Perspective: a residential contractor.

User ask: "I need a page that filters fit: services, project types, process, rough budget ranges, timeline caveats, quote path."

Success signals:
- Builds a contractor site with services, project types, process, budget ranges, timeline caveats, quote path, and portfolio-safe placeholders.
- Avoids fake instant quotes.
- Uses practical copy for homeowners, not agency hype.

Failure signals:
- Generic construction landing page.
- Fake quote calculator.
- No budget/timeline caveats.

## 545. "Estimate Requests Need Reality Checks"

Perspective: a contractor admin.

User ask: "Track estimate requests with project type, address area, budget range, timeline, site visit needed, status, and notes."

Success signals:
- Builds a Postgres API for estimate requests with project type, area, budget range, timeline, site visit flag, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps exact addresses out of sample data.

Failure signals:
- Full project-management system.
- No budget/timeline/site-visit fields.
- Missing migration.

## 546. "Permit Milestones Get Forgotten"

Perspective: a contractor project coordinator.

User ask: "Queue permit milestone checks by project/status version. Show failures. No noisy messages."

Success signals:
- Creates a Redis worker for permit milestone checks with idempotency by project/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents scheduling assumptions and rollback.
- Keeps messages generic.

Failure signals:
- No status-version guard.
- Real messages by default.
- Silent failures.

## 547. "The Course Page Should Not Feel Like a Scam"

Perspective: an independent educator.

User ask: "Make a course page with outcomes, who it is for, syllabus, schedule, prerequisites, refund caveat, application path."

Success signals:
- Builds a course page with outcomes, audience fit, syllabus, schedule, prerequisites, refund caveat, application path, and credible instructor context.
- Avoids fake countdowns, income claims, and checkout.
- Keeps design polished but not manipulative.

Failure signals:
- Growth-hack landing page.
- Fake urgency or income claims.
- No prerequisites/refund caveat.

## 548. "Cohort Applications Need Sorting"

Perspective: a course operator.

User ask: "Track applications with cohort, experience level, goal, schedule fit, scholarship flag, stage, reviewer, and notes."

Success signals:
- Builds a Postgres API for cohort applications with cohort, experience level, goal, schedule fit, scholarship flag, stage, reviewer, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps admissions workflow simple.

Failure signals:
- Full LMS.
- No stage/reviewer/schedule fit.
- Missing migration.

## 549. "Cohort Followups Should Be Fair"

Perspective: a course admissions assistant.

User ask: "Queue application followups by stage and cohort, but avoid duplicates."

Success signals:
- Creates a Redis worker for cohort application followups with idempotency by application/stage/cohort version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider configuration.
- Avoids real messages by default.

Failure signals:
- Duplicate followups.
- Real delivery by default.
- No failed job visibility.

## 550. "A Mediation Practice Needs Neutral Copy"

Perspective: a legal mediator.

User ask: "Explain services, process, neutrality, fees caveat, preparation, contact. No legal advice."

Success signals:
- Builds a mediation practice site with service areas, process, neutrality statement, fee caveats, preparation checklist, contact, and legal-advice disclaimer.
- Uses calm neutral language.
- Avoids promises about outcomes.

Failure signals:
- Law-firm marketing tone.
- Legal advice or outcome promises.
- No neutrality/disclaimer.

## 551. "Mediation Intake Needs Boundaries"

Perspective: a mediator's assistant.

User ask: "Track intake requests with matter type, parties count, preferred format, urgency, conflict check status, stage, and notes."

Success signals:
- Builds a Postgres API for mediation intakes with matter type, parties count, preferred format, urgency, conflict check status, stage, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Avoids sensitive case specifics in examples.

Failure signals:
- Collects detailed legal facts in sample data.
- No conflict/stage fields.
- Missing migration.

## 552. "Conflict Check Followups Need Discipline"

Perspective: a mediation office coordinator.

User ask: "Queue conflict-check nudges by intake stage. Dry-run and show failed jobs."

Success signals:
- Creates a Redis worker for conflict-check nudges with idempotency by intake/stage version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and secret configuration.
- Keeps payloads minimal.

Failure signals:
- Logs sensitive case notes.
- Real messages by default.
- No dead-letter route.

## 553. "The Restaurant Private Events Page Is Useless"

Perspective: a restaurant manager.

User ask: "People ask about private events. Capacity, rooms, menus, minimums, timing, accessibility, inquiry path."

Success signals:
- Builds a restaurant private-events site with room/capacity information, menu options, minimum spend caveats, timing, accessibility, gallery placeholders, and inquiry path.
- Avoids fake reservation checkout.
- Keeps tone hospitality-focused and practical.

Failure signals:
- Generic restaurant homepage.
- No capacity/minimums.
- Fake booking/payment.

## 554. "Event Inquiries Need Less Back-And-Forth"

Perspective: a restaurant events coordinator.

User ask: "Track event date, guest count, room preference, budget range, menu interest, status, source, and notes."

Success signals:
- Builds a Postgres API for private event inquiries with date, guest count, room preference, budget range, menu interest, status, source, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps it inquiry-focused.

Failure signals:
- Full reservation platform.
- No guest count/status/budget.
- Missing migration.

## 555. "Deposit Reminders Need Caution"

Perspective: a restaurant events coordinator.

User ask: "Queue deposit reminders for tentative events. Once per event version, dry-run."

Success signals:
- Creates a Redis worker for deposit reminders with idempotency by event/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real payment handling.

Failure signals:
- Attempts payment collection.
- No event-version guard.
- No failure visibility.

## 556. "The Privacy Consultant Page Needs Substance"

Perspective: a privacy consultant.

User ask: "Services, audits, DPIA help, vendor reviews, training, deliverables, caveats. No fake compliance guarantee."

Success signals:
- Builds a privacy consulting site with services, audits, DPIA support, vendor reviews, training, deliverables, caveats, and contact path.
- Avoids guaranteed compliance claims.
- Uses dense, serious B2B layout.

Failure signals:
- Generic cyber landing page.
- Fake compliance guarantees.
- No deliverables/caveats.

## 557. "Vendor Risk Reviews Need Tracking"

Perspective: a privacy ops lead.

User ask: "Track vendor reviews with vendor type, data category, region, risk rating, review status, owner, due date, and notes."

Success signals:
- Builds a Postgres API for vendor risk reviews with vendor type, data category, region, risk rating, review status, owner, due date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps sensitive vendor details out of sample data.

Failure signals:
- Full GRC platform.
- No risk/status/due date.
- Missing migration.

## 558. "Risk Review Nudges Should Be Boring"

Perspective: a privacy program manager.

User ask: "Queue review nudges for overdue vendors. Idempotent, dry-run, visible failures."

Success signals:
- Creates a Redis worker for overdue vendor review nudges with idempotency by vendor review/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids logging sensitive notes.

Failure signals:
- Logs sensitive vendor notes.
- Real messages by default.
- No dead-letter visibility.

## 559. "Student Housing Info Is Scattered"

Perspective: a housing coordinator.

User ask: "Make a page for buildings, eligibility, rent caveats, move-in steps, maintenance, contacts, and documents."

Success signals:
- Builds a student housing site with building summaries, eligibility, rent caveats, move-in checklist, maintenance path, contacts, documents, and accessibility notes.
- Avoids fake applications or payments.
- Keeps layout useful for stressed students.

Failure signals:
- Generic apartment site.
- Fake application/payment.
- No move-in/maintenance information.

## 560. "Maintenance Requests Need a Basic API"

Perspective: a student housing operations lead.

User ask: "Track maintenance requests with building, category, priority, access permission, status, assigned team, and notes."

Success signals:
- Builds a Postgres API for maintenance requests with building, category, priority, access permission, status, assigned team, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps scope to request tracking.

Failure signals:
- Full property-management system.
- No priority/status/access permission.
- Missing migration.
