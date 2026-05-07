# User Stories 721-740: Messy Revenue and Support Reality Checks

These stories test whether the agent can handle short, imperfect commercial and support requests without overbuilding. The agent should infer practical scope, protect sensitive information, avoid fake workflows, and produce Docker/Compose-ready projects with concise operations notes.

## 721. "The Clinic Waitlist Page Needs Honesty"

Perspective: a clinic office manager with no technical vocabulary.

User ask: "Waitlist page. Explain who it is for, how updates work, timing caveat, what not to send, contact. No patient details."

Success signals:
- Builds a clinic waitlist information site with audience, update process, timing caveat, privacy boundaries, contact path, and no patient-detail collection.
- Avoids medical advice and fake appointment booking.
- Keeps language plain for anxious visitors.

Failure signals:
- Collects symptoms or patient identifiers.
- Fake booking portal.
- No privacy boundary or timing caveat.

## 722. "Clinic Waitlist Entries Need Safe Tracking"

Perspective: a front desk coordinator.

User ask: "Track waitlist entries with service category, availability window, urgency, consent flag, status, owner, notes."

Success signals:
- Builds a Postgres API for clinic waitlist entries with service category, availability window, urgency, consent flag, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps names, symptoms, and medical record numbers out of examples.

Failure signals:
- PHI-heavy examples.
- No consent/status/urgency fields.
- Missing migration.

## 723. "Waitlist Nudges Need Privacy"

Perspective: a clinic operations lead.

User ask: "Queue waitlist nudges. No details in logs, dry-run, no duplicates."

Success signals:
- Creates a Redis worker for waitlist nudges with minimized payloads, idempotency by entry/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging patient details.
- Documents rollback and provider settings.

Failure signals:
- Logs sensitive details.
- Real messages by default.
- No idempotency or dead-letter visibility.

## 724. "The Volunteer Drive Page Is Too Cheerful"

Perspective: a nonprofit volunteer coordinator.

User ask: "Volunteer page. Roles, time commitment, training, boundaries, accessibility, contact. Don't make it look like signup exists."

Success signals:
- Builds a volunteer drive site with roles, time commitment, training notes, boundaries, accessibility notes, and contact path.
- Avoids fake signup and inflated impact claims.
- Uses practical nonprofit language.

Failure signals:
- Fake registration flow.
- No time/training/boundary information.
- Overly generic charity copy.

## 725. "Volunteer Interest Needs Sorting"

Perspective: a nonprofit operations assistant.

User ask: "Track volunteer interest: role, availability, training need, accessibility note flag, background-check status, status, owner, notes."

Success signals:
- Builds a Postgres API for volunteer interest with role, availability, training need, accessibility note flag, background-check status, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps applicant names and personal background details out of examples.

Failure signals:
- Full volunteer platform.
- Sensitive example details.
- No training/background/status fields.

## 726. "Volunteer Followups Need Dignity"

Perspective: a volunteer coordinator.

User ask: "Queue volunteer followups. Gentle, dry run, don't double send, failures visible."

Success signals:
- Creates a Redis worker for volunteer followups with idempotency by interest/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents tone guard, provider settings, and rollback.
- Avoids real delivery by default.

Failure signals:
- Pushy outreach defaults.
- Duplicate followups.
- No failure visibility.

## 727. "The Legal Intake Page Needs Big Warnings"

Perspective: a small legal clinic administrator.

User ask: "Intake page. What we can review, what not to send, timing, conflict caveat, contact. No legal advice."

Success signals:
- Builds a legal intake information site with review scope, prohibited submissions, timing caveat, conflict caveat, contact path, and no legal advice.
- Avoids file upload and sensitive case-detail collection.
- Keeps warnings visible but not frightening.

Failure signals:
- Gives legal advice.
- Collects case files or sensitive details.
- No conflict or scope caveat.

## 728. "Legal Intake Requests Need Triage"

Perspective: a clinic intake coordinator.

User ask: "Track intake requests with matter category, urgency, conflict-check status, document readiness, status, owner, notes."

Success signals:
- Builds a Postgres API for legal intake requests with matter category, urgency, conflict-check status, document readiness, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps client names, opposing parties, and case facts out of examples.

Failure signals:
- Sensitive legal examples.
- No conflict/document/status fields.
- Missing migration.

## 729. "Conflict Check Nudges Need Restraint"

Perspective: a legal operations lead.

User ask: "Queue conflict-check nudges by request status. Dry-run. Never include matter details."

Success signals:
- Creates a Redis worker for conflict-check nudges with minimized payloads, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging or sending matter details.
- Documents rollback and provider settings.

Failure signals:
- Includes matter details.
- Real messages by default.
- No status route or idempotency.

## 730. "The Insurance Help Page Must Stay Narrow"

Perspective: an insurance claims advocate.

User ask: "Claims help page. What we explain, documents checklist, what we cannot decide, timeline caveat, contact."

Success signals:
- Builds an insurance claims help site with explanation scope, document checklist, decision boundaries, timeline caveats, and contact path.
- Avoids legal/coverage promises and fake claim submission.
- Uses careful consumer-friendly language.

Failure signals:
- Promises claim approval.
- Fake claim filing.
- No document checklist or boundaries.

## 731. "Claims Review Requests Need Status"

Perspective: a claims support assistant.

User ask: "Track review requests: claim type, review reason, document readiness, urgency, decision boundary flag, status, owner, notes."

Success signals:
- Builds a Postgres API for claims review requests with claim type, review reason, document readiness, urgency, decision boundary flag, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps policy numbers, addresses, and claim facts out of examples.

Failure signals:
- Sensitive claim examples.
- No boundary/status/urgency fields.
- Missing migration.

## 732. "Claims Followups Need Proof"

Perspective: a support operations lead.

User ask: "Queue claim followups. Dry run, idempotent, show skipped and failed work."

Success signals:
- Creates a Redis worker for claim followups with idempotency by review/status version, dry-run default, skip visibility, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Real messages by default.
- No skipped/failure visibility.
- Duplicate followups.

## 733. "The Repair Request Page Needs No Portal"

Perspective: a property manager.

User ask: "Repair request info page. What tenants should prepare, emergency caveat, photos note, response time caveat, contact. No login."

Success signals:
- Builds a repair request information site with preparation checklist, emergency caveat, photo guidance, response-time caveat, and contact path.
- Avoids fake tenant login and emergency promises.
- Keeps language direct for stressed tenants.

Failure signals:
- Fake portal/login.
- No emergency caveat.
- Promises immediate response.

## 734. "Repair Requests Need Routing"

Perspective: a maintenance dispatcher.

User ask: "Track repair requests: category, access window, urgency, photo-ready flag, emergency flag, status, owner, notes."

Success signals:
- Builds a Postgres API for repair requests with category, access window, urgency, photo-ready flag, emergency flag, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps tenant names, addresses, and unit numbers out of examples.

Failure signals:
- Full property-management platform.
- Sensitive tenant examples.
- No emergency/access/status fields.

## 735. "Repair Dispatch Nudges Need Guardrails"

Perspective: a maintenance operations lead.

User ask: "Queue dispatch nudges for overdue non-emergency repairs. Dry run, no duplicates."

Success signals:
- Creates a Redis worker for repair dispatch nudges with non-emergency guard, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Nudges emergency cases incorrectly.
- Real messages by default.
- No idempotency.

## 736. "The Launch Checklist Page Needs Less Startup Theater"

Perspective: a first-time founder.

User ask: "Launch checklist page. What to prepare, risks, owners, timing, what can wait, contact. Practical not hype."

Success signals:
- Builds a launch checklist site with preparation checklist, risk notes, owner guidance, timing caveats, deferrable items, and contact path.
- Avoids vague motivational copy and fake account creation.
- Keeps structure useful for a novice.

Failure signals:
- Startup hype page.
- No owners/risks/timing.
- Fake signup.

## 737. "Launch Tasks Need Priorities"

Perspective: an operations-minded founder.

User ask: "Track launch tasks with area, owner, risk, priority, due date, blocked flag, status, notes."

Success signals:
- Builds a Postgres API for launch tasks with area, owner, risk, priority, due date, blocked flag, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps private launch names and customer details out of examples.

Failure signals:
- Full project management suite.
- No risk/priority/blocked fields.
- Missing migration.

## 738. "Launch Nudges Need Focus"

Perspective: a founder trying to avoid noisy automation.

User ask: "Queue nudges only for blocked or high-risk launch tasks. Dry-run. Show failures."

Success signals:
- Creates a Redis worker for launch nudges with blocked/high-risk guard, idempotency by task/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Nudges every task.
- Real messages by default.
- No failure visibility.

## 739. "The Agency Handoff Page Needs Specifics"

Perspective: a designer handing a finished site to a client.

User ask: "Handoff page. What client gets, limits, maintenance, launch checklist, support path, no fake dashboard."

Success signals:
- Builds an agency handoff site with deliverables, limitations, maintenance notes, launch checklist, support path, and no fake dashboard.
- Keeps copy client-friendly and concrete.
- Avoids generic agency marketing.

Failure signals:
- Generic portfolio page.
- Fake dashboard.
- No limits or maintenance notes.

## 740. "Handoff Requests Need Audit Trail"

Perspective: an agency operations manager.

User ask: "Track handoff requests with client type, deliverable group, launch risk, maintenance status, owner, due date, notes."

Success signals:
- Builds a Postgres API for handoff requests with client type, deliverable group, launch risk, maintenance status, owner, due date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps client names, credentials, and private URLs out of examples.

Failure signals:
- Full agency CRM.
- Sensitive examples.
- No launch-risk/maintenance/due fields.
