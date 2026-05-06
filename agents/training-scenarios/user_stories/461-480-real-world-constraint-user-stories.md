# Real World Constraint User Stories 461-480

These stories are deliberately constrained, ambiguous, and impatient. The agent should infer a useful first version, avoid fake integrations, keep output compact, and generate deployable Docker/Compose projects with env, rollback, and metrics notes.

## 461. "The Vet Clinic Site Makes People Call for Everything"

Perspective: a clinic manager.

User ask: "People need hours, what counts as urgent, what to bring, and how to ask for records. Make it clear without sounding cold."

Success signals:
- Builds a veterinary clinic site with services, urgent-care caveats, preparation notes, records request path, hours, contact, and trust cues.
- Avoids fake appointment booking or medical promises.
- Keeps copy practical and warm.

Failure signals:
- Generic healthcare page.
- No urgent-care caveat.
- Fake booking or diagnosis language.

## 462. "Pet Records Are in Email Threads"

Perspective: a nontechnical clinic receptionist.

User ask: "Track pet, owner, record request, status, missing info, and who owns the follow-up."

Success signals:
- Builds a Postgres API for pets, owner reference, record requests, status, missing info, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Avoids collecting unnecessary medical detail.

Failure signals:
- No missing-info state.
- Overcollects sensitive records.
- Static site only.

## 463. "Records Followups Need Not Vanish"

Perspective: a front desk lead.

User ask: "If a record request is waiting on someone, remind the owner once and show failures."

Success signals:
- Creates a Redis worker with idempotent follow-up jobs, retries, dead-letter visibility, queue status, and dry-run-safe behavior.
- Uses owner/request/window keys.
- Documents metrics and rollback.

Failure signals:
- No duplicate guard.
- Silent failures.
- Sends real messages by default.

## 464. "A Library Needs a Practical Events Page"

Perspective: a librarian.

User ask: "We have events for kids, adults, and seniors. People need dates, location, accessibility notes, and whether signup is needed."

Success signals:
- Builds a library events site with audience groups, dates, locations, accessibility notes, signup caveats, contact, and empty states.
- Avoids fake ticketing.
- Uses civic, readable copy.

Failure signals:
- Generic event landing page.
- No accessibility or signup caveats.
- Fake checkout.

## 465. "Room Bookings Need Basic Order"

Perspective: a small library administrator.

User ask: "Track room requests, group name, date, room, status, equipment needs, and notes."

Success signals:
- Builds a Postgres API for room requests, group reference, room, date/time, status, equipment needs, notes, and timestamps.
- Includes migration and health/ready routes.
- Leaves conflict detection as a future seam without pretending it exists.

Failure signals:
- Calendar mockup only.
- No equipment/status.
- No migration.

## 466. "Equipment Reminders Should Be Quiet"

Perspective: a library operations assistant.

User ask: "Remind staff before events that need projector or accessibility setup. Don't spam."

Success signals:
- Creates a Redis worker with setup reminder jobs, idempotency by event/setup/window, retry/dead-letter visibility, and status endpoints.
- Defaults to dry-run.
- Keeps README concise.

Failure signals:
- No duplicate suppression.
- No failed-job list.
- Real external sends by default.

## 467. "The Dental Plan Page Is Too Confusing"

Perspective: a designer hired by a dental office.

User ask: "Patients don't understand membership plans. Explain what's included, what's not, and how to ask questions."

Success signals:
- Builds a dental plan site with included services, exclusions, pricing caveats, FAQ, contact path, compliance-friendly tone, and no fake enrollment payment.
- Keeps first screen clear.
- Includes deploy/rollback notes.

Failure signals:
- Generic clinic page.
- No exclusions.
- Fake payment/enrollment.

## 468. "Plan Questions Need Tracking"

Perspective: a dental office admin.

User ask: "Track plan inquiries, patient reference, question, status, owner, and whether we replied."

Success signals:
- Builds a Postgres API for inquiries, patient reference, question category, reply status, owner, notes, and timestamps.
- Includes migration and health/ready routes.
- Keeps sensitive clinical info out.

Failure signals:
- No reply status.
- Collects treatment details.
- No readiness route.

## 469. "Plan Followups Should Be Safe"

Perspective: a compliance-minded office manager.

User ask: "Remind us to reply to plan questions, but no real patient messages from the worker."

Success signals:
- Creates a Redis worker with dry-run follow-up jobs, idempotency, retry/dead-letter visibility, and status endpoints.
- Documents safe outbound configuration as future work.
- Keeps failures visible.

Failure signals:
- Sends real patient messages.
- No dead-letter path.
- No duplicate guard.

## 470. "A Small Manufacturer Needs a Capability Page"

Perspective: a B2B sales designer.

User ask: "The page should say what we can make, tolerances, materials, lead times, and how to request a quote. No buzzwords."

Success signals:
- Builds a manufacturing capability site with capabilities, materials, tolerances, lead-time caveats, quote path, proof, and contact.
- Avoids generic industrial marketing.
- Includes Docker/Compose output.

Failure signals:
- Generic B2B hero.
- No tolerances/materials.
- Fake quote automation.

## 471. "Quotes Need a Source of Truth"

Perspective: an operations lead at a small manufacturer.

User ask: "Track quote requests, material, tolerance, quantity, due date, status, owner, and notes."

Success signals:
- Builds a Postgres API for quote requests, material, tolerance, quantity, due date, status, owner, notes, and timestamps.
- Includes migration and health/ready routes.
- Does not fake file storage.

Failure signals:
- No due date/status.
- Overbuilds ERP.
- No migration.

## 472. "Quote Owners Forget Due Dates"

Perspective: an estimator.

User ask: "Remind owners before quote due dates, once per quote and window. Show failures."

Success signals:
- Creates a Redis worker with quote reminder jobs, idempotency by quote/window, retries, dead-letter visibility, and worker status.
- Defaults to dry-run.
- Documents metrics and rollback.

Failure signals:
- No duplicate guard.
- No failed-job visibility.
- Real messages by default.

## 473. "A Museum Exhibit Page Needs Context"

Perspective: a curator.

User ask: "Visitors need dates, themes, accessibility, tickets info, and what they'll actually see. Don't make it a poster."

Success signals:
- Builds a museum exhibit site with dates, themes, highlights, accessibility, ticket caveats, visit info, and inquiry/contact.
- Avoids fake ticketing.
- Uses refined but clear copy.

Failure signals:
- Generic event page.
- No accessibility/visit details.
- Fake ticket checkout.

## 474. "Loan Requests Need Tracking"

Perspective: a museum collections manager.

User ask: "Track object loan requests, institution, object, dates, status, conditions, owner, and notes."

Success signals:
- Builds a Postgres API for loan requests, institution, object reference, requested dates, status, conditions, owner, and notes.
- Includes migration and health/ready routes.
- Avoids pretending to attach object files.

Failure signals:
- No conditions/status.
- Full collections system.
- No migration.

## 475. "Loan Deadlines Cannot Slip"

Perspective: a collections coordinator.

User ask: "Remind owners before loan response deadlines. Show dead reminders."

Success signals:
- Creates a Redis worker with loan deadline jobs, idempotency by loan/window, retries, dead-letter visibility, and status endpoints.
- Keeps outbound dry-run safe.
- Documents rollback/metrics.

Failure signals:
- No dead-letter queue.
- Duplicate reminders.
- Sends real external messages.

## 476. "An MSP Needs a Service Page That Is Not Terrible"

Perspective: a technical founder.

User ask: "Explain managed IT, response times, security basics, onboarding, and how to ask for an audit. No stock-photo nonsense."

Success signals:
- Builds an MSP service site with services, response-time caveats, onboarding, security basics, audit CTA, proof, and no vague cyber claims.
- Uses operational tone.
- Includes Docker/Compose.

Failure signals:
- Generic cyber landing page.
- No response/onboarding detail.
- Overpromises security.

## 477. "Client Tickets Need a Lightweight API"

Perspective: an MSP operator.

User ask: "Track client tickets, priority, status, owner, SLA target, blocked reason, and notes."

Success signals:
- Builds a Postgres API for tickets, client reference, priority, status, owner, SLA target, blocked reason, notes, and timestamps.
- Includes migration and health/ready routes.
- Keeps auth as an integration seam.

Failure signals:
- No SLA/blocked state.
- Overbuilds PSA software.
- No readiness route.

## 478. "SLA Breaches Need Visibility"

Perspective: an MSP dispatcher.

User ask: "Queue reminders before SLA breach, but only once per threshold unless priority changes."

Success signals:
- Creates a Redis worker with SLA reminder jobs, idempotency by ticket/threshold/priority, retry/dead-letter visibility, and status endpoints.
- Defaults to dry-run.
- Documents metrics.

Failure signals:
- No priority/version guard.
- No failed-job visibility.
- Sends real alerts by default.

## 479. "A Founder Needs a Clean Investor Update Page"

Perspective: a startup founder.

User ask: "One private-ish page for monthly metrics, wins, risks, asks, and runway. Don't make it a pitch deck."

Success signals:
- Builds an investor update site with metrics, wins, risks, asks, runway caveats, owner notes, and restrained layout.
- Avoids fake auth while documenting auth seam.
- Includes Docker/Compose notes.

Failure signals:
- Generic pitch deck page.
- No risks/asks/runway.
- Pretends to be secure without auth.

## 480. "Investor Updates Need an API"

Perspective: a fractional CFO.

User ask: "Track update periods, metrics, risks, asks, owner, status, and comments."

Success signals:
- Builds a Postgres API for update periods, metrics, risks, asks, owner, status, comments, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps scope focused.

Failure signals:
- Overbuilds investor CRM.
- No status/comments.
- No migration.
