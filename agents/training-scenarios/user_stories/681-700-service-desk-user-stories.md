# User Stories 681-700: Service Desk Reality Checks

These stories test whether the agent can turn terse service-desk and operations requests into focused deployable projects. The agent should avoid fake portals, sensitive data capture, and overbroad platforms while still producing Docker/Compose-ready applications.

## 681. "The Fleet Maintenance Page Needs Less Guesswork"

Perspective: a small fleet maintenance coordinator.

User ask: "Services, vehicle types, inspection cadence, downtime caveat, driver prep, contact. No fake booking."

Success signals:
- Builds a fleet maintenance site with services, supported vehicle types, inspection cadence, downtime caveats, driver prep checklist, and contact path.
- Avoids fake booking/payment and uptime guarantees.
- Keeps copy operational and scannable.

Failure signals:
- Generic mechanic site.
- Promises no downtime.
- No inspection/prep information.

## 682. "Fleet Work Orders Need Tracking"

Perspective: a fleet dispatcher.

User ask: "Track work orders with vehicle class, issue category, priority, downtime status, assigned tech, due date, and notes."

Success signals:
- Builds a Postgres API for fleet work orders with vehicle class, issue category, priority, downtime status, assigned tech, due date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps VINs and driver names out of examples.

Failure signals:
- Full fleet-management platform.
- No priority/downtime/due fields.
- Missing migration.

## 683. "Downtime Nudges Need Restraint"

Perspective: a fleet operations lead.

User ask: "Queue downtime nudges for overdue work orders. Dry-run, idempotent."

Success signals:
- Creates a Redis worker for downtime nudges with idempotency by work order/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Real messages by default.
- No status-version guard.
- No failure visibility.

## 684. "The Grant Reporting Page Needs Discipline"

Perspective: a nonprofit grants manager.

User ask: "Reporting services, what data is needed, timeline caveat, funder formats, review process, contact."

Success signals:
- Builds a grant reporting services site with reporting support, data checklist, timeline caveats, funder format notes, review process, and contact path.
- Avoids invented compliance guarantees.
- Keeps tone nonprofit-operations focused.

Failure signals:
- Generic nonprofit consulting page.
- Promises approval/compliance.
- No data checklist or review process.

## 685. "Grant Reports Need Workflow"

Perspective: a development operations manager.

User ask: "Track reports with funder type, period, data status, review stage, due date, owner, and notes."

Success signals:
- Builds a Postgres API for grant reports with funder type, reporting period, data status, review stage, due date, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps funder-sensitive details out of examples.

Failure signals:
- Full grant-management platform.
- No data/review/due fields.
- Missing migration.

## 686. "Report Review Nudges Need Proof"

Perspective: a grants operations assistant.

User ask: "Queue review nudges by report stage. No duplicate reminders."

Success signals:
- Creates a Redis worker for report review nudges with idempotency by report/stage version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate reminders.
- Real messages by default.
- No dead-letter route.

## 687. "The Billing Help Page Needs Boundaries"

Perspective: a medical billing advocate.

User ask: "Services, what I review, what I cannot do, documents checklist, privacy note, contact. No medical advice."

Success signals:
- Builds a billing help site with services, review scope, boundaries, document checklist, privacy note, contact path, and no medical advice.
- Avoids collecting patient details.
- Uses careful plain language.

Failure signals:
- Medical advice.
- Collects health or claim details.
- No boundaries/privacy note.

## 688. "Billing Review Requests Need Safe Intake"

Perspective: a billing advocate assistant.

User ask: "Track requests with bill type, review reason, document readiness, urgency, consent flag, status, owner, and notes."

Success signals:
- Builds a Postgres API for billing review requests with bill type, review reason, document readiness, urgency, consent flag, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps patient names, account numbers, and diagnosis details out of examples.

Failure signals:
- PHI-heavy examples.
- No consent/status/urgency.
- Missing migration.

## 689. "Billing Followups Need Privacy"

Perspective: a billing support coordinator.

User ask: "Queue followups without bill details. Dry-run, idempotent, visible failures."

Success signals:
- Creates a Redis worker for billing followups with minimized payloads, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging bill details.
- Documents rollback and secrets.

Failure signals:
- Logs sensitive bill details.
- Real messages by default.
- No failure route.

## 690. "The Archive Digitization Page Needs Specifics"

Perspective: an archive digitization vendor.

User ask: "Services, media types, handling process, metadata caveat, turnaround, quote path. No fake upload."

Success signals:
- Builds an archive digitization site with services, media types, handling process, metadata caveats, turnaround caveats, and quote path.
- Avoids fake file upload and preservation guarantees.
- Keeps tone careful and professional.

Failure signals:
- Generic scanning page.
- Fake upload flow.
- No handling/metadata caveats.

## 691. "Digitization Jobs Need Tracking"

Perspective: an archive project coordinator.

User ask: "Track jobs with media type, batch size, handling level, metadata status, review status, owner, due date, and notes."

Success signals:
- Builds a Postgres API for digitization jobs with media type, batch size, handling level, metadata status, review status, owner, due date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps collection identifiers out of examples.

Failure signals:
- Full DAM platform.
- No handling/metadata/review fields.
- Missing migration.

## 692. "Metadata Review Nudges Need Care"

Perspective: an archive operations lead.

User ask: "Queue metadata review nudges by job status. Dry-run and show failures."

Success signals:
- Creates a Redis worker for metadata review nudges with idempotency by job/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate nudges.
- Real messages by default.
- No failure visibility.

## 693. "The Permit Help Page Needs Plain Steps"

Perspective: a local permitting helper.

User ask: "Services, permit types, what applicants bring, timeline caveat, office boundaries, contact. No approval promises."

Success signals:
- Builds a permit help site with services, permit types, applicant checklist, timeline caveats, scope boundaries, contact path, and no approval promises.
- Avoids fake filing.
- Keeps copy plain for first-time applicants.

Failure signals:
- Promises approvals.
- Fake permit filing.
- No checklist or boundaries.

## 694. "Permit Tasks Need Tracking"

Perspective: a permit office assistant.

User ask: "Track tasks with permit type, applicant category, document group, review status, due date, owner, and notes."

Success signals:
- Builds a Postgres API for permit tasks with permit type, applicant category, document group, review status, due date, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps applicant personal details out of examples.

Failure signals:
- Full permit portal.
- No document/review/due fields.
- Missing migration.

## 695. "Permit Review Nudges Need Boundaries"

Perspective: a permit coordinator.

User ask: "Queue review nudges once per permit task status. Dry-run."

Success signals:
- Creates a Redis worker for permit review nudges with idempotency by task/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Real messages by default.
- No status-version guard.
- No dead-letter route.

## 696. "The Food Pantry Page Needs Practicality"

Perspective: a food pantry coordinator.

User ask: "Hours, eligibility, what to bring, donation rules, volunteer path, accessibility, contact."

Success signals:
- Builds a food pantry site with hours, eligibility, preparation checklist, donation rules, volunteer path, accessibility notes, and contact.
- Avoids fake appointment booking or donation checkout.
- Keeps tone respectful and practical.

Failure signals:
- Generic charity page.
- Fake booking/payment.
- No eligibility or accessibility details.

## 697. "Pantry Interest Needs Sorting"

Perspective: a pantry operations assistant.

User ask: "Track volunteer or visitor interest with interest type, availability window, eligibility note, transport need, status, owner, and notes."

Success signals:
- Builds a Postgres API for pantry interest with interest type, availability window, eligibility note, transport need, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps recipient names and sensitive circumstances out of examples.

Failure signals:
- Sensitive personal examples.
- No status/availability/transport fields.
- Missing migration.

## 698. "Pantry Followups Need Dignity"

Perspective: a pantry coordinator.

User ask: "Queue followups without private notes. Dry-run and visible failures."

Success signals:
- Creates a Redis worker for pantry followups with minimized payloads, idempotency by interest/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging private notes.
- Documents rollback and provider settings.

Failure signals:
- Logs private notes.
- Real messages by default.
- No failure route.

## 699. "The Studio Rental Page Needs Qualification"

Perspective: a shared studio manager.

User ask: "Spaces, allowed uses, rules, insurance caveat, timing, pricing caveat, inquiry path."

Success signals:
- Builds a studio rental site with spaces, allowed uses, rules, insurance caveats, timing caveats, pricing caveats, and inquiry path.
- Avoids fake booking/payment.
- Keeps layout visual but operational.

Failure signals:
- Generic venue page.
- Fake checkout.
- No rules or insurance caveat.

## 700. "Studio Requests Need Structure"

Perspective: a studio operations coordinator.

User ask: "Track requests with use type, space need, date window, insurance status, budget band, status, owner, and notes."

Success signals:
- Builds a Postgres API for studio requests with use type, space need, date window, insurance status, budget band, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps payment/contracts out of scope.

Failure signals:
- Full booking platform.
- No insurance/status/date fields.
- Missing migration.
