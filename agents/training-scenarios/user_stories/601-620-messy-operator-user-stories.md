# User Stories 601-620: Messy Operator Requests

These stories test whether the agent can quickly infer practical software from incomplete, real-world operator prompts. The agent should produce small deployable projects, avoid fake transactional flows, protect sensitive data, and keep implementation notes concise.

## 601. "The Accessibility Consultant Page Sounds Generic"

Perspective: an accessibility consultant.

User ask: "Services, audits, remediation help, training, deliverables, caveats, contact. Don't claim perfect compliance."

Success signals:
- Builds an accessibility consulting site with audit services, remediation help, training, deliverables, process, caveats, contact path, and no guaranteed compliance claims.
- Keeps tone practical and procurement-friendly.
- Avoids fake certification badges.

Failure signals:
- Generic design agency page.
- Guaranteed compliance claims.
- No deliverables or caveats.

## 602. "Audit Findings Need Tracking"

Perspective: an accessibility program manager.

User ask: "Track findings with page area, standard, severity, owner, remediation status, due date, and notes."

Success signals:
- Builds a Postgres API for accessibility findings with page area, standard, severity, owner, remediation status, due date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps it a findings tracker, not a full testing platform.

Failure signals:
- Full compliance suite.
- No severity/status/due date.
- Missing migration.

## 603. "Remediation Nudges Need Proof"

Perspective: an accessibility operations lead.

User ask: "Queue remediation nudges for overdue findings, idempotent and dry-run."

Success signals:
- Creates a Redis worker for overdue remediation nudges with idempotency by finding/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Real messages by default.
- No status-version guard.
- No failed job visibility.

## 604. "The Fire Safety Training Page Is Confusing"

Perspective: a fire safety trainer.

User ask: "Training types, who needs it, format, site requirements, certificate caveat, quote path. Plain."

Success signals:
- Builds a fire safety training site with training types, audience fit, delivery format, site requirements, certificate caveats, quote path, and plain operational tone.
- Avoids fake certification promises.
- Keeps information easy for facility managers to scan.

Failure signals:
- Generic safety landing page.
- Fake certification guarantee.
- No site requirements.

## 605. "Training Requests Need Scheduling Fields"

Perspective: a safety training coordinator.

User ask: "Track training requests with site type, attendee count, format, preferred date, certificate need, status, owner, and notes."

Success signals:
- Builds a Postgres API for training requests with site type, attendee count, format, preferred date, certificate need, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps scheduling focused.

Failure signals:
- Full LMS.
- No attendee/date/status fields.
- Missing migration.

## 606. "Training Prep Reminders Need Limits"

Perspective: a training coordinator.

User ask: "Queue prep reminders for scheduled trainings, once per request version. Dry-run."

Success signals:
- Creates a Redis worker for training prep reminders with idempotency by request/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real messages by default.

Failure signals:
- Duplicate reminders.
- Real delivery by default.
- No failure route.

## 607. "The Local Tour Page Needs Less Hype"

Perspective: a walking tour operator.

User ask: "Tours, meeting point caveat, weather, accessibility, group sizes, price caveat, inquiry path."

Success signals:
- Builds a local tour site with tour types, meeting point caveats, weather policy, accessibility notes, group sizes, price caveats, and inquiry path.
- Avoids fake booking/payment.
- Keeps tone local and useful.

Failure signals:
- Generic travel page.
- Fake booking checkout.
- No weather/accessibility info.

## 608. "Tour Requests Need Sorting"

Perspective: a tour coordinator.

User ask: "Track requests with tour type, date window, group size, language, accessibility need, status, owner, and notes."

Success signals:
- Builds a Postgres API for tour requests with tour type, date window, group size, language, accessibility need, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps payments out of scope.

Failure signals:
- Full reservation platform.
- No language/accessibility/status.
- Missing migration.

## 609. "Weather Followups Need Caution"

Perspective: a tour operator.

User ask: "Queue weather nudges for upcoming tours, once per tour version. Show failed jobs."

Success signals:
- Creates a Redis worker for weather nudges with idempotency by tour/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider configuration.
- Avoids real delivery by default.

Failure signals:
- Duplicate nudges.
- Real messages by default.
- No failed job visibility.

## 610. "The Debt Counselor Site Needs Trust"

Perspective: a debt counselor.

User ask: "Services, what to bring, process, fees caveat, urgent help note, contact. No magic promises."

Success signals:
- Builds a debt counseling site with services, document checklist, process, fee caveats, urgent help note, contact path, and no debt outcome promises.
- Avoids collecting financial details.
- Uses calm, nonjudgmental copy.

Failure signals:
- Promises debt elimination.
- Collects financial details.
- Generic finance page.

## 611. "Counseling Requests Need Safe Intake"

Perspective: a debt counseling office assistant.

User ask: "Track requests with help type, urgency, document readiness, preferred contact, consent flag, status, and notes."

Success signals:
- Builds a Postgres API for counseling requests with help type, urgency, document readiness, preferred contact, consent flag, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Avoids sensitive debt details in examples.

Failure signals:
- Stores account balances or creditor names in examples.
- No consent/status fields.
- Missing migration.

## 612. "Counseling Followups Must Be Quiet"

Perspective: a debt counseling coordinator.

User ask: "Queue followups without exposing notes. Dry-run, idempotent, visible failures."

Success signals:
- Creates a Redis worker for counseling followups with minimized payloads, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging private notes.
- Documents rollback and secrets.

Failure signals:
- Logs private notes.
- Real messages by default.
- No dead-letter route.

## 613. "The Equipment Rental Page Needs Boundaries"

Perspective: an equipment rental owner.

User ask: "Categories, rental rules, deposits caveat, pickup, safety, availability caveat, inquiry path."

Success signals:
- Builds an equipment rental site with categories, rental rules, deposit caveats, pickup instructions, safety notes, availability caveats, and inquiry path.
- Avoids fake live inventory or checkout.
- Keeps copy operational and clear.

Failure signals:
- Ecommerce product grid.
- Fake availability/payment.
- No safety/deposit caveats.

## 614. "Rental Requests Need Tracking"

Perspective: a rental coordinator.

User ask: "Track requests with category, date range, quantity, pickup need, deposit status, request status, owner, and notes."

Success signals:
- Builds a Postgres API for rental requests with category, date range, quantity, pickup need, deposit status, request status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps inventory reservation out of scope.

Failure signals:
- Full inventory platform.
- No date/deposit/status fields.
- Missing migration.

## 615. "Return Nudges Need Guardrails"

Perspective: a rental desk worker.

User ask: "Queue return nudges for active rentals, once per rental version, dry-run."

Success signals:
- Creates a Redis worker for return nudges with idempotency by rental/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate nudges.
- Real messages by default.
- No failure route.

## 616. "The Music Teacher Page Needs Clarity"

Perspective: a private music teacher.

User ask: "Lessons, levels, schedule caveat, practice expectations, pricing caveat, trial path, contact."

Success signals:
- Builds a music teacher site with lesson types, levels, schedule caveats, practice expectations, pricing caveats, trial lesson path, and contact.
- Avoids fake booking/payment.
- Keeps tone encouraging but concrete.

Failure signals:
- Generic artist site.
- Fake calendar checkout.
- No practice/schedule caveats.

## 617. "Lesson Inquiries Need Sorting"

Perspective: a music teacher.

User ask: "Track inquiries with instrument, level, age band, schedule window, goal, status, source, and notes."

Success signals:
- Builds a Postgres API for lesson inquiries with instrument, level, age band, schedule window, goal, status, source, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps student names out of examples.

Failure signals:
- Full school management system.
- No level/schedule/status.
- Missing migration.

## 618. "Trial Lesson Nudges Need Manners"

Perspective: a music teacher.

User ask: "Queue trial followups once per inquiry status. Dry-run first."

Success signals:
- Creates a Redis worker for trial lesson followups with idempotency by inquiry/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real messages by default.

Failure signals:
- Real messages by default.
- No status-version guard.
- No failure visibility.

## 619. "The Vendor Onboarding Page Needs Less Fluff"

Perspective: a procurement operations lead.

User ask: "Explain onboarding, documents, security review, payment setup caveat, timeline, contacts. Dense, not salesy."

Success signals:
- Builds a vendor onboarding information site with onboarding steps, required documents, security review, payment setup caveats, timeline, contacts, and dense procurement tone.
- Avoids collecting banking details.
- Keeps content scannable for vendors.

Failure signals:
- Sales landing page.
- Collects bank data.
- No security/payment caveats.

## 620. "Vendor Onboarding Tasks Need Accountability"

Perspective: a procurement operations assistant.

User ask: "Track onboarding tasks with vendor type, document group, security status, payment setup status, due date, owner, and notes."

Success signals:
- Builds a Postgres API for vendor onboarding tasks with vendor type, document group, security status, payment setup status, due date, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps sensitive payment data out of scope.

Failure signals:
- Full vendor management system.
- Stores bank details.
- Missing migration.
