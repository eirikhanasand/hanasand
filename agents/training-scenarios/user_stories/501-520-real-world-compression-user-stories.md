# Real World Compression User Stories 501-520

These stories are meant to punish overexplaining. The user gives a cramped, real-world ask; the agent should choose a useful first version, produce deployable code, and spend tokens on implementation details rather than long discovery theater.

## 501. "The Funeral Home Site Feels Like a Sales Funnel"

Perspective: a grieving family advocate reviewing a local provider.

User ask: "People need prices, what to do first, documents, and who to call. Please make it respectful, not glossy."

Success signals:
- Builds a respectful funeral home site with first steps, service options, price caveats, documents checklist, contact path, and accessibility-friendly tone.
- Avoids fake booking, fake payment, and manipulative urgency.
- Includes concise deploy, rollback, and metrics notes.

Failure signals:
- Generic luxury service page.
- No documents or first-step clarity.
- Pushy sales language.

## 502. "Arrangements Are Tracked on Paper"

Perspective: a funeral home administrator.

User ask: "Track arrangement requests, family contact, service type, date, documents missing, status, owner, notes."

Success signals:
- Builds a Postgres API for arrangements, contact reference, service type, dates, missing documents, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps sensitive personal details minimal.

Failure signals:
- Overcollects grief/family details.
- No missing-document state.
- No migration.

## 503. "Document Followups Must Be Gentle"

Perspective: a funeral home coordinator.

User ask: "Remind the owner when documents are missing, once per window. Failed reminders need to be visible."

Success signals:
- Creates a Redis worker with idempotent document follow-up jobs, retry/dead-letter visibility, queue status, and dry-run behavior.
- Uses arrangement/window keys.
- Documents rollback and metrics.

Failure signals:
- Sends real messages by default.
- No duplicate guard.
- Silent failures.

## 504. "The Yoga Studio Page Is Pretty but Useless"

Perspective: a studio owner.

User ask: "Show classes, levels, what to bring, pricing basics, and how to ask about starting. Less spiritual wallpaper."

Success signals:
- Builds a yoga studio site with class levels, schedule cues, what to bring, pricing caveats, beginner path, teacher/contact info.
- Avoids fake booking/payment.
- Keeps tone calm and concrete.

Failure signals:
- Generic wellness landing page.
- No beginner/class-level information.
- Fake scheduling.

## 505. "Class Interest Needs Sorting"

Perspective: a studio assistant.

User ask: "Track class inquiries, level, preferred time, status, owner, and whether we replied."

Success signals:
- Builds a Postgres API for inquiries, class level, preferred time, reply status, owner, notes, and timestamps.
- Includes migration and health/ready routes.
- Keeps scope small.

Failure signals:
- Full gym management platform.
- No reply/status field.
- No readiness endpoint.

## 506. "Waitlist Nudges Should Not Be Weird"

Perspective: a studio operator.

User ask: "Queue followups for waitlist people, but only once per class opening."

Success signals:
- Creates a Redis worker with waitlist jobs, idempotency by class/opening/person, retries, dead-letter visibility, and worker status.
- Defaults to dry-run.
- Documents metrics.

Failure signals:
- Duplicate nudges.
- Real outbound messages by default.
- No failed-job visibility.

## 507. "A Farm Stand Needs a Site Before Weekend"

Perspective: a farmer who sells locally.

User ask: "People ask what's available, hours, where to park, and if they can reserve boxes. Make it simple."

Success signals:
- Builds a farm stand site with produce availability, hours, parking/location, box reservation caveat, contact path, and seasonal notes.
- Avoids fake ecommerce.
- Includes Docker/Compose and concise README.

Failure signals:
- Generic food brand page.
- No availability or parking info.
- Fake checkout.

## 508. "Produce Reservations Need Tracking"

Perspective: a farm stand helper.

User ask: "Track box requests, customer, pickup day, items, status, and notes."

Success signals:
- Builds a Postgres API for box requests, customer reference, pickup day, item notes, status, and timestamps.
- Includes migration and health/ready routes.
- Does not pretend to handle payments.

Failure signals:
- No pickup/status.
- Full ecommerce platform.
- No migration.

## 509. "Pickup Reminders Should Be Safe"

Perspective: a farm stand operator.

User ask: "Remind staff before pickup windows and show failed jobs."

Success signals:
- Creates a Redis worker with pickup reminder jobs, idempotency by pickup/window, retry/dead-letter visibility, and status endpoints.
- Keeps outbound dry-run.
- Documents rollback.

Failure signals:
- No dead-letter queue.
- Duplicate reminders.
- Sends real customer messages.

## 510. "A Security Consultant Needs a Serious Services Page"

Perspective: a skeptical technical buyer.

User ask: "Explain assessments, deliverables, timelines, what you don't do, and how to request a scoped call."

Success signals:
- Builds a security consulting site with services, deliverables, timelines, exclusions, scoped-call CTA, proof, and no exaggerated claims.
- Avoids fear marketing.
- Includes deploy/rollback notes.

Failure signals:
- Generic cybersecurity hero.
- No exclusions/deliverables.
- Overpromises protection.

## 511. "Assessment Requests Need an API"

Perspective: a solo security consultant.

User ask: "Track assessment requests, company, scope, urgency, status, owner, next action, and notes."

Success signals:
- Builds a Postgres API for requests, company reference, scope, urgency, status, owner, next action, notes, and timestamps.
- Includes migration and health/ready routes.
- Avoids storing secrets or credentials.

Failure signals:
- Stores sensitive credentials.
- No urgency/next action.
- No migration.

## 512. "Follow Up on Scoped Calls"

Perspective: a consultant trying not to lose leads.

User ask: "Queue followups for scoped calls, once per stage, and show failures."

Success signals:
- Creates a Redis worker with follow-up jobs, idempotency by request/stage, retry/dead-letter visibility, and status endpoints.
- Dry-run by default.
- Concise README.

Failure signals:
- Duplicate followups.
- Silent failures.
- Real outbound email.

## 513. "A Daycare Needs Calm Parent Info"

Perspective: a parent comparing providers.

User ask: "Show ages, daily rhythm, meals, pickup rules, costs, and how to ask about openings. Make it not chaotic."

Success signals:
- Builds a daycare site with age groups, daily rhythm, meals, pickup rules, cost caveats, openings inquiry path, and trust/safety cues.
- Avoids fake application/payment.
- Uses calm practical copy.

Failure signals:
- Generic childcare page.
- No pickup/cost/openings clarity.
- Fake enrollment.

## 514. "Openings Need a Waitlist API"

Perspective: a daycare administrator.

User ask: "Track family, child age, desired start, status, missing info, owner, and notes."

Success signals:
- Builds a Postgres API for waitlist records, child age group, desired start, status, missing info, owner, notes, and timestamps.
- Includes migration and health/ready routes.
- Minimizes child data.

Failure signals:
- Collects sensitive child details.
- No desired start/status.
- No readiness route.

## 515. "Waitlist Followups Need Boundaries"

Perspective: a daycare office manager.

User ask: "Remind us to follow up on waitlist families, but don't send anything externally."

Success signals:
- Creates a Redis worker with internal waitlist follow-up jobs, idempotency, retries, dead-letter visibility, and status endpoints.
- Defaults to dry-run/internal output.
- Documents metrics.

Failure signals:
- Sends family messages.
- No duplicate guard.
- No failed-job view.

## 516. "A Local Theatre Needs a Show Page"

Perspective: a volunteer producer.

User ask: "People need show dates, venue, access info, cast note, ticket caveat, and who to contact. Fast."

Success signals:
- Builds a theatre show site with dates, venue, accessibility, cast/crew notes, ticket caveats, contact, and sponsor/volunteer cues.
- Avoids fake ticket checkout.
- Keeps visual tone lively but not cluttered.

Failure signals:
- Generic event page.
- No accessibility/ticket caveats.
- Fake checkout.

## 517. "Volunteer Shifts Need Tracking"

Perspective: a theatre volunteer coordinator.

User ask: "Track shifts, role, person, show date, status, conflicts, and notes."

Success signals:
- Builds a Postgres API for volunteer shifts, roles, person reference, show date, status, conflicts, notes, and timestamps.
- Includes migration and health/ready routes.
- Keeps scheduling simple.

Failure signals:
- Full HR scheduler.
- No conflicts/status.
- No migration.

## 518. "Shift Reminders Should Not Spam"

Perspective: a volunteer coordinator.

User ask: "Queue shift reminders once per shift version and show failed reminders."

Success signals:
- Creates a Redis worker with shift reminder jobs, idempotency by shift/version, retries, dead-letter visibility, and status routes.
- Defaults to dry-run.
- Documents rollback.

Failure signals:
- No version guard.
- Real messages by default.
- Silent failures.

## 519. "A Tiny SaaS Needs a Changelog People Read"

Perspective: a product designer.

User ask: "Make a changelog page with releases, fixes, known issues, and what's next. Not a marketing blog."

Success signals:
- Builds a changelog site with releases, fixes, known issues, upcoming work, filters/sections, and concise product tone.
- Avoids fake login or docs portal.
- Includes Docker/Compose notes.

Failure signals:
- Blog landing page.
- No known issues/next section.
- Bloated launch copy.

## 520. "Changelog Items Need an API"

Perspective: a product ops person.

User ask: "Track releases, change items, type, status, owner, published date, and notes."

Success signals:
- Builds a Postgres API for releases, change items, type, status, owner, publish date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps scope focused.

Failure signals:
- Full CMS.
- No type/status/date.
- No migration.
