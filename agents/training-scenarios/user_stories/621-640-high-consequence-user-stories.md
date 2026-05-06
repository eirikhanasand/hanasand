# User Stories 621-640: High-Consequence Small Builds

These stories test whether the agent can make useful small software for situations where wording, privacy, and operational boundaries matter. The agent should infer the smallest deployable project, avoid fake guarantees or sensitive data capture, and keep Docker/Compose instructions concise.

## 621. "The Lab Services Page Needs Trust"

Perspective: a small testing lab manager.

User ask: "Services, sample prep, turnaround caveat, chain of custody, pricing caveat, contact. No fake accreditation."

Success signals:
- Builds a lab services site with service categories, sample preparation, turnaround caveats, chain-of-custody explanation, pricing caveats, contact path, and no unsupported accreditation claims.
- Keeps tone technical and calm.
- Avoids fake sample submission uploads.

Failure signals:
- Generic science landing page.
- Fake accreditation badges.
- No chain-of-custody or turnaround caveats.

## 622. "Sample Intake Needs Tracking"

Perspective: a lab intake coordinator.

User ask: "Track sample batches with sample type, chain status, received date, test panel, priority, owner, status, and notes."

Success signals:
- Builds a Postgres API for sample batches with sample type, chain status, received date, test panel, priority, owner, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps client-identifying data out of examples.

Failure signals:
- Full LIMS scope.
- No chain/status/priority fields.
- Missing migration.

## 623. "Lab Status Nudges Need Auditability"

Perspective: a lab operations lead.

User ask: "Queue status nudges for delayed batches, idempotent, dry-run, visible failures."

Success signals:
- Creates a Redis worker for delayed batch nudges with idempotency by batch/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Real messages by default.
- No status-version guard.
- Silent failures.

## 624. "The Home Inspector Page Should Filter Fit"

Perspective: a home inspector.

User ask: "Services, what inspection includes, limits, prep checklist, report timing, sample report, contact."

Success signals:
- Builds a home inspection site with services, inspection scope, limits/disclaimers, prep checklist, report timing caveats, sample report section, and contact path.
- Avoids guarantees about finding every defect.
- Keeps homeowner copy clear.

Failure signals:
- Generic real-estate page.
- Guarantees defect detection.
- No limits or prep checklist.

## 625. "Inspection Requests Need Reality"

Perspective: a home inspection scheduler.

User ask: "Track requests with property type, area, preferred window, inspection type, urgency, status, owner, and notes."

Success signals:
- Builds a Postgres API for inspection requests with property type, area, preferred window, inspection type, urgency, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps exact addresses out of examples.

Failure signals:
- Full scheduling/payment platform.
- No urgency/status/window fields.
- Missing migration.

## 626. "Inspection Prep Reminders Need Restraint"

Perspective: an inspection office admin.

User ask: "Queue prep reminders for scheduled inspections once per request version. Dry-run."

Success signals:
- Creates a Redis worker for inspection prep reminders with idempotency by request/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and message-provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate reminders.
- Real messages by default.
- No failure visibility.

## 627. "The Public Records Page Needs Plain Language"

Perspective: a city clerk.

User ask: "Explain request process, fees caveat, timelines, exemptions, contact, documents. No legalese."

Success signals:
- Builds a public records information site with request process, fee caveats, timeline caveats, exemptions, contacts, documents, and plain-language public-sector tone.
- Avoids pretending requests can be filed live.
- Keeps accessibility strong.

Failure signals:
- Dense legal page.
- Fake request filing.
- No exemption/timeline caveats.

## 628. "Records Requests Need Tracking"

Perspective: a clerk's office assistant.

User ask: "Track requests with request type, department, received date, due date, exemption review status, public status, owner, and notes."

Success signals:
- Builds a Postgres API for records requests with request type, department, received date, due date, exemption review status, public status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps requester personal details out of examples.

Failure signals:
- Full government records portal.
- No exemption/due/public status.
- Missing migration.

## 629. "Records Deadline Nudges Need Caution"

Perspective: a clerk's office supervisor.

User ask: "Queue deadline checks for open records requests. No duplicates, visible failures."

Success signals:
- Creates a Redis worker for records deadline checks with idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real messages by default.

Failure signals:
- Duplicate nudges.
- Real delivery by default.
- No dead-letter visibility.

## 630. "The Elder Care Page Needs Calm"

Perspective: an elder care coordinator.

User ask: "Services, family process, visit notes, costs caveat, boundaries, emergency note, contact."

Success signals:
- Builds an elder care coordination site with services, family process, visit note expectations, cost caveats, service boundaries, emergency disclaimer, and contact path.
- Avoids collecting medical details.
- Uses calm, trustworthy copy.

Failure signals:
- Medical advice or outcome promises.
- Collects health details.
- No emergency/boundary note.

## 631. "Care Requests Need Safe Intake"

Perspective: an elder care office assistant.

User ask: "Track care inquiries with service type, urgency, preferred contact, family role, consent flag, status, owner, and notes."

Success signals:
- Builds a Postgres API for care inquiries with service type, urgency, preferred contact, family role, consent flag, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Avoids health details in sample data.

Failure signals:
- Stores medical facts in examples.
- No consent/status/urgency.
- Missing migration.

## 632. "Care Followups Must Be Private"

Perspective: an elder care coordinator.

User ask: "Queue followups without private notes. Dry-run and show failed jobs."

Success signals:
- Creates a Redis worker for care followups with minimized payloads, idempotency by inquiry/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging private notes.
- Documents rollback and secrets.

Failure signals:
- Logs private notes.
- Real messages by default.
- No failure route.

## 633. "Incident Reporting Page Needs Trust"

Perspective: a workplace safety officer.

User ask: "Explain how to report incidents, what info helps, privacy, timelines, contacts, urgent note. No blame language."

Success signals:
- Builds an incident reporting information site with reporting process, helpful info checklist, privacy notes, timeline caveats, contacts, urgent escalation note, and neutral language.
- Avoids fake live submission.
- Keeps tone supportive and clear.

Failure signals:
- Blame-oriented copy.
- Fake submission form.
- No privacy/urgent note.

## 634. "Incident Reviews Need Tracking"

Perspective: a safety operations manager.

User ask: "Track incident reviews with category, severity, reported date, review status, action owner, due date, and notes."

Success signals:
- Builds a Postgres API for incident reviews with category, severity, reported date, review status, action owner, due date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps identifying incident details out of examples.

Failure signals:
- Full EHS suite.
- No severity/status/due date.
- Missing migration.

## 635. "Action Reminders Need Discipline"

Perspective: a safety coordinator.

User ask: "Queue action reminders for overdue incident reviews. Dry-run, idempotent."

Success signals:
- Creates a Redis worker for incident action reminders with idempotency by review/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Real messages by default.
- No status-version guard.
- No failure visibility.

## 636. "The Executive Coach Page Needs Specificity"

Perspective: an executive coach.

User ask: "Offerings, who it's for, cadence, confidentiality, outcomes caveat, pricing caveat, contact."

Success signals:
- Builds an executive coaching site with offerings, audience fit, cadence, confidentiality note, outcome caveats, pricing caveats, and contact path.
- Avoids guaranteed transformation claims.
- Keeps tone senior and restrained.

Failure signals:
- Generic motivational page.
- Guaranteed outcomes.
- No confidentiality/cadence details.

## 637. "Coaching Leads Need Qualification"

Perspective: a coach's assistant.

User ask: "Track leads with role level, goal area, cadence interest, confidentiality concern, budget signal, stage, owner, and notes."

Success signals:
- Builds a Postgres API for coaching leads with role level, goal area, cadence interest, confidentiality concern, budget signal, stage, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps personal work details out of examples.

Failure signals:
- Full CRM.
- No stage/budget/cadence fields.
- Missing migration.

## 638. "Coaching Followups Need Taste"

Perspective: an executive coach.

User ask: "Queue followups by lead stage, but only once per stage version. Dry-run."

Success signals:
- Creates a Redis worker for coaching followups with idempotency by lead/stage version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate followups.
- Real messages by default.
- No failed job visibility.

## 639. "The Art Commission Page Needs Boundaries"

Perspective: a commissioned artist.

User ask: "Styles, process, timeline caveat, usage rights, pricing caveat, availability, inquiry path."

Success signals:
- Builds an art commission site with style examples/placeholders, process, timeline caveats, usage rights notes, pricing caveats, availability caveat, and inquiry path.
- Avoids fake checkout and rights promises.
- Keeps visual layout portfolio-forward.

Failure signals:
- Generic artist bio page.
- Fake cart/payment.
- No usage rights or timeline caveats.

## 640. "Commission Requests Need Structure"

Perspective: an artist studio assistant.

User ask: "Track commission requests with style, size band, usage intent, deadline, budget band, status, owner, and notes."

Success signals:
- Builds a Postgres API for commission requests with style, size band, usage intent, deadline, budget band, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps file upload/payment out of scope.

Failure signals:
- Full marketplace.
- No usage/deadline/status fields.
- Missing migration.
