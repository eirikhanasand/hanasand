# User Stories 761-780: Customer Trust and Field Ops Reality Checks

These stories test whether the agent can convert terse customer-trust and field-operations requests into focused deployable projects. The agent should infer practical scope, avoid fake full platforms, protect sensitive information, and produce Docker/Compose-ready projects with concise operations notes.

## 761. "The Data Deletion Page Needs Trust"

Perspective: a privacy-conscious founder.

User ask: "Deletion request page. What can be deleted, what we need, timing, exceptions, contact. No login."

Success signals:
- Builds a data deletion request information site with deletion scope, request checklist, timing caveats, exception notes, and contact path.
- Avoids fake login, identity-document upload, and privacy guarantees it cannot prove.
- Keeps copy clear and reassuring.

Failure signals:
- Fake account portal.
- Collects identity documents.
- No exception or timing guidance.

## 762. "Deletion Requests Need Safe Tracking"

Perspective: a support operations analyst.

User ask: "Track deletion requests: request type, verification status, data area, exception flag, owner, due date, notes."

Success signals:
- Builds a Postgres API for deletion requests with request type, verification status, data area, exception flag, owner, due date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps emails, account IDs, and identity details out of examples.

Failure signals:
- Full privacy platform.
- Sensitive example data.
- No verification/exception/due fields.

## 763. "Deletion Followups Need No Details"

Perspective: a privacy operations lead.

User ask: "Queue deletion followups. No personal data in payloads, dry-run, no duplicates."

Success signals:
- Creates a Redis worker for deletion followups with minimized payloads, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging personal data.
- Documents rollback and provider settings.

Failure signals:
- Logs personal data.
- Real messages by default.
- No idempotency or dead-letter visibility.

## 764. "The Warranty Page Needs Real Conditions"

Perspective: a hardware startup support lead.

User ask: "Warranty page. Coverage, exclusions, proof needed, timing, support. No claim form."

Success signals:
- Builds a warranty information site with coverage, exclusions, proof checklist, timing caveats, and support path.
- Avoids fake claim form, legal overpromises, and invented guarantee language.
- Keeps copy practical for customers.

Failure signals:
- Fake claim submission.
- No exclusions or proof checklist.
- Overpromises outcomes.

## 765. "Warranty Requests Need Triage"

Perspective: a support coordinator.

User ask: "Track warranty requests: product category, issue type, proof status, eligibility status, priority, owner, notes."

Success signals:
- Builds a Postgres API for warranty requests with product category, issue type, proof status, eligibility status, priority, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps serial numbers, customer names, and purchase details out of examples.

Failure signals:
- Full RMA system.
- Sensitive examples.
- No proof/eligibility/priority fields.

## 766. "Warranty Nudges Need Restraint"

Perspective: a support operations manager.

User ask: "Queue warranty nudges for missing proof only. Dry-run, show failures."

Success signals:
- Creates a Redis worker for warranty proof nudges with missing-proof guard, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Nudges all warranty cases.
- Real messages by default.
- No failure visibility.

## 767. "The Field Visit Page Needs Logistics"

Perspective: a field services dispatcher.

User ask: "Visit info page. What we need on site, access, safety, timing, contact. No booking."

Success signals:
- Builds a field visit information site with site-prep checklist, access requirements, safety notes, timing caveats, and contact path.
- Avoids fake booking and safety guarantees.
- Keeps copy direct for busy facility staff.

Failure signals:
- Fake appointment scheduler.
- No access or safety notes.
- Generic services page.

## 768. "Field Visits Need Routing"

Perspective: a field operations planner.

User ask: "Track visits: site type, access window, safety flag, equipment need, priority, status, owner, notes."

Success signals:
- Builds a Postgres API for field visits with site type, access window, safety flag, equipment need, priority, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps exact addresses, contact names, and access codes out of examples.

Failure signals:
- Full dispatch platform.
- Sensitive access examples.
- No safety/access/status fields.

## 769. "Field Visit Reminders Need Guardrails"

Perspective: a field operations lead.

User ask: "Queue reminders only for confirmed access windows. Dry-run, no duplicates."

Success signals:
- Creates a Redis worker for field visit reminders with confirmed-access guard, idempotency by visit/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Reminds unconfirmed visits.
- Real messages by default.
- No idempotency.

## 770. "The Beta Feedback Page Needs Less Noise"

Perspective: a product designer.

User ask: "Beta feedback page. What feedback helps, what not to send, timeline, privacy, contact. No voting board."

Success signals:
- Builds a beta feedback information site with useful feedback guidance, out-of-scope guidance, timeline caveats, privacy note, and contact path.
- Avoids fake voting board and account creation.
- Keeps visual hierarchy polished and concise.

Failure signals:
- Fake product board.
- No privacy or out-of-scope guidance.
- Generic launch page.

## 771. "Beta Feedback Needs Sorting"

Perspective: a product operations manager.

User ask: "Track feedback: area, feedback type, severity, user segment, review status, owner, notes."

Success signals:
- Builds a Postgres API for beta feedback with area, feedback type, severity, user segment, review status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps customer names, emails, and account details out of examples.

Failure signals:
- Full product-management suite.
- Sensitive customer examples.
- No severity/review/status fields.

## 772. "Feedback Review Nudges Need Focus"

Perspective: a product lead.

User ask: "Queue review nudges for severe beta feedback only. Dry-run and show skipped."

Success signals:
- Creates a Redis worker for severe feedback nudges with severity guard, idempotency by feedback/status version, dry-run default, skip visibility, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Nudges every feedback item.
- Real messages by default.
- No skipped/failure visibility.

## 773. "The Supplier Delay Page Needs Candor"

Perspective: a small manufacturer.

User ask: "Delay update page. What's delayed, why generally, what customers can do, timing caveat, support. No excuses."

Success signals:
- Builds a supplier delay update site with delayed item categories, plain reason summary, customer guidance, timing caveats, and support path.
- Avoids blame, fake live tracking, and delivery guarantees.
- Keeps copy candid and calm.

Failure signals:
- Blame-heavy copy.
- Fake tracking portal.
- No customer guidance or timing caveat.

## 774. "Supplier Delays Need Tracking"

Perspective: an operations coordinator.

User ask: "Track delays: item category, supplier area, impact level, customer message status, owner, due date, notes."

Success signals:
- Builds a Postgres API for supplier delays with item category, supplier area, impact level, customer message status, owner, due date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps supplier names, contract terms, and customer identifiers out of examples.

Failure signals:
- Full supply-chain platform.
- Sensitive examples.
- No impact/message/due fields.

## 775. "Delay Update Worker Needs Proof"

Perspective: an operations lead.

User ask: "Queue delay update reminders by message status. Dry-run, no duplicates, failures visible."

Success signals:
- Creates a Redis worker for delay update reminders with idempotency by delay/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate reminders.
- Real messages by default.
- No dead-letter visibility.

## 776. "The Partner Onboarding Page Needs Boundaries"

Perspective: a partnerships manager.

User ask: "Partner onboarding page. Steps, docs, timing, what partner owns, support. No contract upload."

Success signals:
- Builds a partner onboarding information site with steps, document checklist, timing caveats, partner responsibility boundaries, and support path.
- Avoids fake contract upload and partnership guarantees.
- Keeps copy practical and businesslike.

Failure signals:
- Fake upload flow.
- No partner responsibilities.
- Generic partnership marketing.

## 777. "Partner Onboarding Needs Status"

Perspective: a partnerships operations assistant.

User ask: "Track partner onboarding: partner type, document readiness, integration need, risk, status, owner, notes."

Success signals:
- Builds a Postgres API for partner onboarding with partner type, document readiness, integration need, risk, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps partner names, contract values, and private integration details out of examples.

Failure signals:
- Full partner portal.
- Sensitive examples.
- No readiness/integration/risk fields.

## 778. "Partner Followups Need Timing"

Perspective: a partnerships lead.

User ask: "Queue partner followups only after docs are marked ready. Dry-run, idempotent."

Success signals:
- Creates a Redis worker for partner followups with document-ready guard, idempotency by onboarding/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Follows up before docs are ready.
- Real messages by default.
- No idempotency.

## 779. "The Renewal Reminder Page Needs Fairness"

Perspective: a small SaaS operator.

User ask: "Renewal info page. What renews, timing, cancellation path, support, no dark patterns."

Success signals:
- Builds a renewal information site with renewal scope, timing caveats, cancellation path, support path, and fair-language boundaries.
- Avoids fake account login, payment flow, and dark-pattern copy.
- Keeps copy transparent.

Failure signals:
- Fake billing portal.
- No cancellation path.
- Manipulative language.

## 780. "Renewal Reviews Need Tracking"

Perspective: a customer success operations lead.

User ask: "Track renewal reviews: account segment, renewal window, risk, cancellation status, owner, due date, notes."

Success signals:
- Builds a Postgres API for renewal reviews with account segment, renewal window, risk, cancellation status, owner, due date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps account names, invoices, and payment details out of examples.

Failure signals:
- Full billing platform.
- Sensitive payment examples.
- No risk/cancellation/due fields.
