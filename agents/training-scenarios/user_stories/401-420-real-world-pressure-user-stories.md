# Real World Pressure User Stories 401-420

These stories are intentionally terse, impatient, and uneven. The agent should infer a useful first version without turning the response into a planning essay. Success means a deployable project with Docker, Compose, environment notes, rollback notes, compact README, and product-specific defaults that make sense for the user.

## 401. "The Menu Has Become a Liability"

Perspective: a designer helping a neighborhood restaurant.

User ask: "Their menu changes all the time, allergy info is scattered, and the current site looks fancy but nobody can find the basics. Fix it."

Success signals:
- Builds a restaurant site with menu sections, allergen cues, opening hours, location, contact path, and update-friendly copy.
- Keeps reservations/takeout honest instead of pretending integrations exist.
- Uses compact operations notes and avoids a brand manifesto.

Failure signals:
- Generic hospitality landing page.
- No allergen or update story.
- Contact/location hidden below decorative copy.

## 402. "Bookings Are Just Text Messages Right Now"

Perspective: a nontechnical restaurant manager.

User ask: "I need a place to put booking requests, mark confirmed or declined, and see tonight without scrolling texts."

Success signals:
- Builds a Postgres API for booking requests, party size, time window, status, customer notes, and owner action.
- Includes health/ready routes and a migration script.
- Keeps the data model small and understandable.

Failure signals:
- Implements fake payment or external booking vendor.
- Omits booking status.
- Makes it a static website only.

## 403. "Stop Double Confirming Tables"

Perspective: a tired front-of-house lead.

User ask: "If someone has already been confirmed, don't send another reminder. If it fails, I want to know."

Success signals:
- Creates a Redis worker with idempotent reminder jobs, queue status, retries, and dead-letter visibility.
- Exposes enqueue and worker-status endpoints.
- Does not send real messages by default.

Failure signals:
- Silent failure path.
- No duplicate guard.
- No operational README.

## 404. "The Charity Looks Like It Closed"

Perspective: a volunteer board member.

User ask: "Our nonprofit site is old, but we mostly need donors to trust us and volunteers to know what to do next."

Success signals:
- Builds a nonprofit site with mission, programs, donation/volunteer paths, proof, basic reporting cues, and no fake donation processor.
- Makes the first screen clear and calm.
- Includes deploy and rollback notes.

Failure signals:
- Corporate SaaS tone.
- No volunteer path.
- Pretends to process donations.

## 405. "Grant Reporting Is a Spreadsheet Fight"

Perspective: a small nonprofit operations person.

User ask: "We need to track grants, deadlines, restrictions, receipts, and which report is due next."

Success signals:
- Builds a Postgres API for grants, reporting deadlines, expenses/receipts, restrictions, and owner status.
- Includes migration and health/ready routes.
- Documents production database replacement.

Failure signals:
- Builds only a donor CRM.
- No due-date or restriction tracking.
- No migration.

## 406. "Reports Are Due Before Anyone Remembers"

Perspective: a grant coordinator.

User ask: "Nudge the owner before reports are due, but don't spam them every hour."

Success signals:
- Creates a Redis worker for scheduled grant report reminders with idempotency, retry/backoff, worker status, and dead-letter notes.
- Makes failures reviewable.
- Keeps delivery dry-run safe.

Failure signals:
- No duplicate suppression.
- No queue visibility.
- Sends real external messages by default.

## 407. "The Lab Equipment Page Is a PDF Graveyard"

Perspective: a university lab administrator.

User ask: "People keep asking what equipment we have and who to contact. The answer is in six PDFs. Make a useful page."

Success signals:
- Builds a lab equipment site with equipment categories, availability/contact owner, safety notes, booking caveats, and request path.
- Avoids fake live booking.
- Uses an academic but readable tone.

Failure signals:
- Generic university brochure.
- No safety or owner information.
- No deployable output.

## 408. "Shared Equipment Requests Need Order"

Perspective: a lab manager.

User ask: "We need to request equipment time, approve it, reject it, and see conflicts later. Don't make it huge."

Success signals:
- Builds a Postgres API for equipment, requests, requested windows, status, approver notes, and audit timestamps.
- Includes migration and health/ready routes.
- Leaves room for future conflict checks without overbuilding them.

Failure signals:
- Calendar-only mockup.
- No status or approver notes.
- No database migration.

## 409. "Calibration Reminders Keep Slipping"

Perspective: a research technician.

User ask: "Remind us before equipment needs calibration. If the reminder fails, I need a list."

Success signals:
- Creates a Redis worker with calibration reminder jobs, duplicate guard, status endpoint, retry/dead-letter behavior, and dry-run defaults.
- Keeps operational instructions short.
- Makes failures visible.

Failure signals:
- No dead-letter path.
- No worker status.
- No idempotency.

## 410. "Legal Intake Without Looking Sketchy"

Perspective: a solo lawyer.

User ask: "I need a clean page for potential clients, but it cannot promise outcomes or sound like an ad farm."

Success signals:
- Builds a legal intake site with practice areas, disclaimers, conflict-check caveat, consultation path, and trust proof.
- Avoids guarantees and fake scheduling/payment.
- Keeps tone restrained and professional.

Failure signals:
- Overpromising marketing copy.
- No disclaimer/conflict caveat.
- Generic lead-gen site.

## 411. "Case Intake Is in Email"

Perspective: a legal assistant.

User ask: "We need to record intake requests, conflict status, next action, and who owns it."

Success signals:
- Builds a Postgres API for intake records, conflict-check status, next action, owner, notes, and timestamps.
- Includes migration and health/ready routes.
- Does not store unnecessary sensitive detail.

Failure signals:
- No conflict status.
- Overcollects sensitive data.
- No readiness endpoint.

## 412. "Deadlines Cannot Disappear"

Perspective: a small law office operations person.

User ask: "If an intake or case has a deadline, remind the owner and show failed reminders."

Success signals:
- Creates a Redis worker with deadline reminder jobs, idempotency, retry/dead-letter visibility, and worker-status endpoint.
- Defaults to safe dry-run behavior.
- Documents rollback and metrics.

Failure signals:
- Sends real legal notices.
- Silent retry failure.
- No queue API.

## 413. "Bids Are Getting Lost"

Perspective: a construction estimator.

User ask: "I need a simple bid pipeline screen. Not a whole ERP. Just what's due, what's risky, and who owns it."

Success signals:
- Builds a construction bid dashboard with bid stages, due dates, risk flags, owners, proof/status metrics, and a practical CTA.
- Avoids generic project-management copy.
- Includes Docker/Compose deploy notes.

Failure signals:
- Generic kanban with no construction language.
- No due date or risk signal.
- Overbuilt enterprise pitch.

## 414. "RFQs Need a Source of Truth"

Perspective: a subcontractor office manager.

User ask: "Track RFQs, due dates, client, scope notes, documents, and whether we said no."

Success signals:
- Builds a Postgres API for RFQs, scope notes, due dates, document references, status, no-bid reason, and owner.
- Includes migration and health/ready routes.
- Keeps document handling as references, not fake storage.

Failure signals:
- Omits no-bid state.
- Pretends to upload files without storage.
- No migration.

## 415. "Bid Reminders Should Not Create Panic"

Perspective: an estimator who hates noisy tools.

User ask: "Remind owners before bid due dates, but only once per window unless the due date changes."

Success signals:
- Creates a Redis worker with due-date reminder jobs, idempotency keyed by RFQ/window, retry/dead-letter behavior, and status endpoints.
- Makes reminder rules clear.
- Avoids spamming by default.

Failure signals:
- No duplicate guard.
- No dead-letter visibility.
- No owner/status model.

## 416. "Residents Cannot Find the Right Form"

Perspective: a municipal communications employee.

User ask: "Our service page is impossible. People need to know what permit they need and what happens after they apply."

Success signals:
- Builds a municipal service site with permit categories, eligibility cues, process steps, documents checklist, contact/escalation path, and plain language.
- Avoids decorative civic fluff.
- Includes accessibility-minded structure.

Failure signals:
- Generic city homepage.
- No process or document checklist.
- Uses fake online submission.

## 417. "Permits Need Status"

Perspective: a small municipal IT lead.

User ask: "We need a permit status API: submitted, reviewing, missing docs, approved, denied, and who touched it."

Success signals:
- Builds a Postgres API for permits, applicants, statuses, missing-document notes, owner, audit timestamps, and health/ready routes.
- Includes migration and production database notes.
- Keeps personally identifying data minimal.

Failure signals:
- No status history/audit.
- Overcollects citizen data.
- No migration script.

## 418. "Inspection Windows Keep Moving"

Perspective: a permit office coordinator.

User ask: "When an inspection window changes, remind the owner. If it fails, don't let it disappear."

Success signals:
- Creates a Redis worker with inspection reminder jobs, idempotency by permit/window, retries, dead-letter visibility, and status endpoint.
- Defaults to reviewable dry-run output.
- Documents metrics and rollback.

Failure signals:
- No failure queue.
- No duplicate guard.
- Sends real notifications without configuration.

## 419. "Sellers Need a Real Admin, Not a Pretty Storefront"

Perspective: a marketplace founder.

User ask: "Customers see the storefront, but sellers are lost. Make a seller admin that shows listings, orders, payouts, and what needs attention."

Success signals:
- Builds a seller admin site with listings, order issues, payout status, action queue, empty states, and operational metrics.
- Avoids customer-facing ecommerce fluff.
- Includes deployment and rollback notes.

Failure signals:
- Builds a marketing page.
- No seller actions or payout signal.
- Fake payment integration.

## 420. "Seller Records Need an API"

Perspective: a marketplace backend lead.

User ask: "Track sellers, listings, order exceptions, payout status, and support notes. Keep it portable."

Success signals:
- Builds a Postgres API for sellers, listings, exceptions, payout status, support notes, and owner/action state.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Does not pretend to connect to Stripe or shipping providers.

Failure signals:
- No exception or payout status.
- Overbuilds a full marketplace.
- No readiness route or migration.
