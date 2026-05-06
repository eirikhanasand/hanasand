# Real World Ambiguity User Stories 381-400

These stories are intentionally under-specified and mildly messy. The agent should infer a practical first version, pick boring durable architecture, avoid long explanatory filler, and produce a deployable project with Docker, Compose, environment notes, rollback notes, and enough product shape to be useful without a second interview.

## 381. "Make the Old Site Stop Costing Me Leads"

Perspective: a designer inheriting a neglected trades business site.

User ask: "The plumber's site looks like it was made in 2012 and people keep calling about things they do not do. Make it clear what they actually offer, make it look trustworthy, and don't make it all marketing fluff."

Success signals:
- Creates a focused service site with emergency vs planned work, service area, trust proof, lead form, and plain language.
- Avoids fake booking/payment integrations.
- Includes a quick launch checklist, rollback path, and no bloated brand essay.

Failure signals:
- Produces a generic agency landing page.
- Hides the contact path or omits service constraints.
- Spends most of the output explaining design theory.

## 382. "The Leads Are in Four Places"

Perspective: a total newbie running a small service business.

User ask: "I have leads from email, Facebook, a spreadsheet, and texts. I just need one place to put them and mark who needs calling next."

Success signals:
- Builds a Postgres-backed API for leads, notes, source, status, next action, and owner.
- Includes health/ready routes and migration script.
- Keeps the model simple enough for a nontechnical owner.

Failure signals:
- Builds a complex CRM platform.
- Omits next follow-up state.
- Treats it as a static website only.

## 383. "Call People Back Without Forgetting"

Perspective: an overwhelmed office assistant.

User ask: "If someone has not been called back, remind us. If the reminder fails, I need to see it."

Success signals:
- Creates a Redis worker stack with enqueue, worker status, dead-letter/retry behavior, and clear failure visibility.
- Includes idempotency or duplicate guard.
- Keeps worker actions reviewable.

Failure signals:
- Sends real messages by default.
- No queue status endpoint.
- Silent failures.

## 384. "Our Demo Is Tomorrow and the Page Is Embarrassing"

Perspective: a startup founder under time pressure.

User ask: "We do warehouse software, but the page says nothing. Make a sharp one-pager for tomorrow's demo. It should look like a real product, not a pitch deck."

Success signals:
- Builds a Next app with warehouse-specific workflows, screenshots/placeholder surfaces, proof, CTA, and concise copy.
- Includes Docker/Compose and deploy notes.
- Avoids exaggerated AI claims.

Failure signals:
- Generic SaaS hero.
- No operational details.
- No deployable output.

## 385. "The Ops Team Wants a Receiving API"

Perspective: warehouse operations manager.

User ask: "We need to track inbound loads, exceptions, who touched them, and whether receiving is blocked. Keep it boring."

Success signals:
- Builds a Postgres API with receiving records, exceptions, status, audit timestamps, and migration.
- Has health/ready routes.
- Documents production database replacement and rollback.

Failure signals:
- Only creates a dashboard.
- Ignores auditability.
- Overbuilds with microservices.

## 386. "Labels Print Twice and Nobody Knows Why"

Perspective: warehouse floor lead.

User ask: "Make a job thing for labels so if someone retries it does not print two labels unless they ask for that."

Success signals:
- Builds a Redis worker stack with idempotent jobs, retry/dead-letter handling, job status, and explicit replay path.
- Does not actually integrate a printer.
- Includes operational notes.

Failure signals:
- No idempotency.
- Automatically replays destructive jobs.
- Missing worker service in Compose.

## 387. "A Serious Policy Page for People Who Hate Policy Pages"

Perspective: HR/compliance lead.

User ask: "People ignore our remote work policy. Make something readable where they can quickly find what applies to them."

Success signals:
- Builds a clear Next policy portal with categories, recent changes, owner/contact, acknowledgements, and FAQ.
- Uses restrained enterprise UI.
- Keeps copy scannable.

Failure signals:
- Marketing-style hero.
- No owner/change metadata.
- No accessibility-minded structure.

## 388. "Track Exceptions Before Audit Week"

Perspective: compliance analyst.

User ask: "We need to log policy exceptions and know which ones are expired before audit week. I do not need a huge app."

Success signals:
- Builds a Postgres API for exceptions, owner, expiry, status, and evidence notes.
- Includes migration and readiness checks.
- Keeps scope narrow.

Failure signals:
- Static policy site only.
- No expiry/status fields.
- No migration.

## 389. "Nudge Owners Before Exceptions Expire"

Perspective: compliance operations.

User ask: "Can it remind owners before exceptions expire and show which reminders failed?"

Success signals:
- Builds Redis worker stack with scheduled/nudge jobs, status endpoint, retries, and failure visibility.
- Does not send real email by default.
- Includes duplicate guard.

Failure signals:
- Hides failed reminders.
- Sends real notifications without configuration.
- No queue inspection.

## 390. "A Gallery Page That Does Not Feel Like a Template"

Perspective: independent artist.

User ask: "I have 12 pieces and a show next month. Make a small site that feels calm and lets people ask about availability."

Success signals:
- Builds a Next gallery with artwork list, show details, inquiry path, availability labels, and shipping/visit notes.
- Avoids fake checkout.
- Uses concise handoff notes.

Failure signals:
- Generic portfolio with no show context.
- Fake ecommerce.
- Overly ornate copy.

## 391. "Artwork Inventory Without the Spreadsheet Panic"

Perspective: artist assistant.

User ask: "I need an API to track pieces, where they are, if they are sold, and who asked about them."

Success signals:
- Builds Postgres API with artwork, location, status, inquiry notes, migration, and health routes.
- Keeps schema understandable.
- Includes backup/rollback notes.

Failure signals:
- Website only.
- No status/location.
- No migration.

## 392. "Follow Up With Collectors Later"

Perspective: small gallery operator.

User ask: "If someone asks about a piece and we have not answered, put it in a queue so it is not forgotten."

Success signals:
- Builds Redis worker stack for follow-up jobs, retry/dead-letter status, and enqueue API.
- Includes idempotency guard.
- Avoids sending actual emails by default.

Failure signals:
- No status route.
- Silent failures.
- No worker command in Compose.

## 393. "The CFO Wants One Screen, Not a BI Project"

Perspective: finance leader.

User ask: "Can you make one screen for cash, overdue invoices, risks, and what changed this week? Keep it board-safe."

Success signals:
- Builds a restrained Next finance dashboard with cash, overdue, risks, weekly changes, owners, and review checklist.
- Avoids pretending to connect live bank feeds.
- Includes env/deploy/rollback notes.

Failure signals:
- Consumer finance app.
- No owner/risk sections.
- Fake bank integration.

## 394. "Invoice Exceptions API"

Perspective: accounting manager.

User ask: "Track invoices that need attention, why they are blocked, and who owns the next step."

Success signals:
- Builds Postgres API with invoices, block reason, owner, status, timestamps, and migration.
- Includes health/ready routes.
- Keeps endpoints simple.

Failure signals:
- Only a report page.
- No ownership/status.
- No migration.

## 395. "Retry Invoice Exports Safely"

Perspective: finance operations.

User ask: "Exports sometimes fail. I need retry, but I cannot have duplicate exports."

Success signals:
- Builds Redis worker with idempotency, retry budget, dead-letter/replay path, and status route.
- Does not integrate accounting software by default.
- Documents safe manual replay.

Failure signals:
- No duplicate guard.
- Auto-replays destructive exports.
- No failure inspection.

## 396. "A Local Clinic Site That Does Not Sound Like a Hospital Chain"

Perspective: local clinic owner.

User ask: "Make our clinic site less cold. People need services, hours, how to prepare, and when to call instead of booking."

Success signals:
- Builds a Next clinic site with services, hours, preparation, urgent-care caveat, contact path, and plain copy.
- Avoids medical promises.
- Includes deploy and rollback notes.

Failure signals:
- Generic hospital marketing.
- No safety caveats.
- Fake appointment integration.

## 397. "Clinic Intake Tracker"

Perspective: clinic admin.

User ask: "We need to track intake requests, what documents are missing, and whether someone followed up."

Success signals:
- Builds Postgres API with intake, missing documents, follow-up status, owner, timestamps, and migration.
- Includes ready route.
- Avoids storing unnecessary sensitive data in examples.

Failure signals:
- Collects excessive patient data by default.
- No follow-up state.
- No migration.

## 398. "Remind Staff About Missing Documents"

Perspective: clinic operations.

User ask: "If intake docs are missing, queue a staff reminder. If the reminder fails, we need to know."

Success signals:
- Builds Redis worker with enqueue/status routes, retry/dead-letter handling, and clear failed reminders.
- Does not send real patient notifications.
- Includes safe environment defaults.

Failure signals:
- Sends patient messages directly.
- No failed-job visibility.
- No worker service.

## 399. "A Tiny Internal Tool for a Boss Who Says 'Just Make It Work'"

Perspective: solo developer inside a small company.

User ask: "My boss wants one page to see open tasks, blockers, owners, and what got shipped. No login for now, but make it easy to add later."

Success signals:
- Builds a Next internal dashboard with tasks, blockers, owners, shipped log, and auth seam notes.
- Keeps the first screen useful.
- Includes Docker/Compose and env notes.

Failure signals:
- Makes a public marketing site.
- Ignores future auth seam.
- No deployable artifact.

## 400. "Turn That Internal Tool Into an API"

Perspective: same solo developer, next day.

User ask: "Okay, now I need the data behind that page as an API. Tasks, blockers, owners, shipped things. Keep it normal."

Success signals:
- Builds Postgres API with task/blocker/owner/shipped fields, migration, health/ready routes.
- Keeps endpoints straightforward.
- Includes operational notes and rollback.

Failure signals:
- Static site only.
- No migration.
- Overcomplicated workflow engine.
