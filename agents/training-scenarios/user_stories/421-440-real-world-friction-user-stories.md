# Real World Friction User Stories 421-440

These stories are deliberately impatient, incomplete, and a little contradictory. The agent should infer the smallest useful deployable system, avoid fake integrations, keep copy compact, and produce Docker, Compose, env, rollback, and metrics notes without asking for a second interview.

## 421. "Parents Keep Calling About the Same Camp Questions"

Perspective: a designer helping a small summer camp.

User ask: "The camp site is cute but useless. Parents need dates, ages, what to pack, price, and how to ask questions. Make it practical."

Success signals:
- Builds a camp site with dates, age groups, packing list, pricing caveats, FAQ, contact path, and trust/safety cues.
- Avoids fake registration/payment.
- Keeps page copy direct and parent-friendly.

Failure signals:
- Generic kids activity page.
- No age/date/pricing clarity.
- Fake checkout or booking.

## 422. "Camp Registrations Are in Inbox Chaos"

Perspective: a first-time camp administrator.

User ask: "I need to track kids, guardian contact, age group, status, and missing forms. Nothing fancy."

Success signals:
- Builds a Postgres API for campers, guardians, age group, registration status, missing forms, notes, and owner.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Avoids storing unnecessary sensitive medical details.

Failure signals:
- No missing-form status.
- Overcollects child data.
- Static site only.

## 423. "Missing Forms Need Gentle Nudges"

Perspective: a camp office assistant.

User ask: "Remind guardians about missing forms, but don't send the same reminder twice."

Success signals:
- Creates a Redis worker with idempotent reminder jobs, retries, dead-letter visibility, status endpoints, and dry-run-safe behavior.
- Documents metrics and rollback.
- Makes failures visible.

Failure signals:
- No duplicate guard.
- Sends real messages by default.
- Silent failures.

## 424. "The Repair Shop Looks Closed Online"

Perspective: a mechanic who hates marketing copy.

User ask: "People ask if we do bikes, scooters, and e-bikes. Make the site answer that and get them to bring the right info."

Success signals:
- Builds a repair shop site with service categories, intake instructions, limitations, hours/location, trust proof, and contact path.
- Avoids fake booking/payment.
- Uses plain practical copy.

Failure signals:
- Generic local business page.
- No service limitations or intake prep.
- Overwrites practical info with brand fluff.

## 425. "Repair Tickets Need Status"

Perspective: a shop owner using sticky notes.

User ask: "Track repairs, customer, item type, quote, waiting-on-parts, ready, picked up."

Success signals:
- Builds a Postgres API for repair tickets, item type, quote status, parts status, workflow state, customer contact reference, and notes.
- Includes migration and health/ready routes.
- Keeps personally identifying data modest.

Failure signals:
- No waiting-on-parts state.
- Fake POS/payment system.
- No migration.

## 426. "Customers Keep Asking If It Is Ready"

Perspective: a front desk employee.

User ask: "When a repair is ready or parts are delayed, queue a reminder, and show failed ones."

Success signals:
- Creates a Redis worker with repair notification jobs, idempotency by ticket/status, retry/dead-letter visibility, queue and worker status endpoints.
- Defaults to dry-run output.
- Documents metrics and rollback.

Failure signals:
- No failed-job view.
- Duplicate notifications.
- Sends external messages by default.

## 427. "Our Training Page Scares New Employees"

Perspective: a corporate enablement lead.

User ask: "Make onboarding less scary. They need week one tasks, owners, systems, and what done means."

Success signals:
- Builds an internal onboarding site with role paths, week-one checklist, owner contacts, completion cues, systems list, and empty states.
- Avoids splashy marketing layout.
- Includes deployable Docker/Compose output.

Failure signals:
- Generic HR homepage.
- No completion definition.
- Too much inspirational copy.

## 428. "Onboarding Tasks Need an API"

Perspective: an internal platform engineer.

User ask: "Track onboarding tasks, employee, owner, due date, status, and blocker. Keep it boring."

Success signals:
- Builds a Postgres API for onboarding tasks, employee reference, owner, due date, blocker, status, and timestamps.
- Includes migration, health/ready routes, Docker, Compose.
- Avoids auth theater.

Failure signals:
- No blocker or due date.
- Overbuilds an HRIS.
- No readiness route.

## 429. "Nudge Owners Before New Hires Get Stuck"

Perspective: an operations coordinator.

User ask: "If a task is blocked or late, remind the owner once and show failures."

Success signals:
- Creates a Redis worker with owner nudges, idempotency by task/window, retry/dead-letter behavior, and worker status endpoints.
- Keeps reminders dry-run safe.
- Explains metrics briefly.

Failure signals:
- No duplicate suppression.
- No failed-job visibility.
- No owner concept.

## 430. "A Photographer Needs a Site by Tonight"

Perspective: a photographer with no patience for setup.

User ask: "I need weddings, portraits, pricing starting points, available dates, and a way to inquire. Don't make it cheesy."

Success signals:
- Builds a photography site with service types, pricing starting points, availability cues, inquiry path, proof, and image placeholders.
- Avoids fake booking/payment.
- Uses restrained visual language.

Failure signals:
- Generic portfolio with no inquiry path.
- No pricing/availability caveat.
- Fake calendar integration.

## 431. "Photo Inquiries Need Sorting"

Perspective: a solo creative.

User ask: "Track inquiries by shoot type, date, budget, status, and whether I replied."

Success signals:
- Builds a Postgres API for inquiries, shoot type, event date, budget range, reply status, lead stage, and notes.
- Includes migration and health/ready routes.
- Keeps data simple enough for one person.

Failure signals:
- Builds a full CRM.
- No reply status.
- No migration.

## 432. "Follow Up Without Sounding Desperate"

Perspective: a photographer.

User ask: "Remind me to follow up when I haven't replied, but never more than once for the same inquiry stage."

Success signals:
- Creates a Redis worker with follow-up jobs, idempotency by inquiry/stage, retry/dead-letter visibility, and status endpoints.
- Does not send real email by default.
- Keeps README concise.

Failure signals:
- No duplicate guard.
- Silent failures.
- Real outbound sends by default.

## 433. "The HOA Website Starts Fights"

Perspective: a volunteer HOA board member.

User ask: "People need rules, notices, meeting dates, and who to contact. Make it boring and clear."

Success signals:
- Builds an HOA site with rules, notices, meeting dates, board contacts, maintenance request path, and recent changes.
- Avoids political/community drama tone.
- Includes rollback and metrics notes.

Failure signals:
- Generic neighborhood landing page.
- No notices or meeting info.
- Hides contacts.

## 434. "HOA Requests Need Tracking"

Perspective: an exhausted board secretary.

User ask: "Track maintenance requests, rule questions, owner, priority, status, and board notes."

Success signals:
- Builds a Postgres API for requests, category, priority, status, owner, board notes, and timestamps.
- Includes migration and health/ready routes.
- Keeps resident data minimal.

Failure signals:
- No category/priority.
- Overbuilds property management.
- No migration.

## 435. "Meeting Reminders Should Not Spam Everyone"

Perspective: a cautious HOA treasurer.

User ask: "Queue meeting reminders by audience, but only once per meeting version."

Success signals:
- Creates a Redis worker with reminder jobs, idempotency by meeting/audience/version, retry/dead-letter visibility, and status endpoints.
- Defaults to dry-run.
- Documents metrics and rollback.

Failure signals:
- No audience/version guard.
- Sends real messages.
- No failed-job visibility.

## 436. "A B2B Integration Page That Engineers Trust"

Perspective: a developer relations contractor.

User ask: "Make a page for our API. Buyers need to know auth, rate limits, webhooks, support, and how to evaluate it."

Success signals:
- Builds an API product site with auth overview, rate limits, webhook cues, evaluation checklist, support path, and technical trust signals.
- Avoids vague AI/SaaS fluff.
- Includes Docker/Compose deploy notes.

Failure signals:
- Generic SaaS landing page.
- No rate limit/webhook detail.
- Fake docs portal.

## 437. "API Keys Need Basic Governance"

Perspective: a platform lead.

User ask: "Track API clients, keys, scopes, owner, rotation date, and disabled state. No security theater."

Success signals:
- Builds a Postgres API for clients, key metadata, scopes, owner, rotation date, disabled state, and audit timestamps.
- Includes migration and health/ready routes.
- Does not store plaintext secrets in examples.

Failure signals:
- Stores fake plaintext keys.
- No rotation/disabled state.
- No readiness route.

## 438. "Webhook Retries Are Invisible"

Perspective: an integration engineer.

User ask: "Queue webhook deliveries, retry failures, and let me see what died."

Success signals:
- Creates a Redis worker with webhook delivery jobs, idempotency by event/endpoint, retry/backoff, dead-letter visibility, and status routes.
- Does not call real customer endpoints by default.
- Documents metrics and rollback.

Failure signals:
- No dead-letter queue.
- Real outbound calls by default.
- No idempotency key.

## 439. "The Board Wants a Risk Register, Not a BI Project"

Perspective: a COO before a board meeting.

User ask: "One screen: top risks, owners, due dates, mitigation, and what changed this week."

Success signals:
- Builds a risk register dashboard with top risks, severity, owner, due dates, mitigation, weekly change summary, and action queue.
- Avoids generic executive dashboard copy.
- Includes deployable Docker/Compose output.

Failure signals:
- Generic metrics board.
- No owner/due date/mitigation.
- Too much explanatory text.

## 440. "Risk Items Need an API"

Perspective: an operations analyst.

User ask: "Track risks, severity, owner, mitigation, review date, status, and comments."

Success signals:
- Builds a Postgres API for risks, severity, owner, mitigation, review date, status, comments, and audit timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps scope focused.

Failure signals:
- Overbuilds GRC software.
- No review date or mitigation.
- No migration.
