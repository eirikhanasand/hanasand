# User Stories 561-580: Operator Ambiguity Under Load

These stories simulate terse real customer asks from operators, consultants, and small teams. The agent should infer a minimal useful product, protect sensitive information, avoid fake transactional flows, and produce Docker/Compose-ready projects with concise operational notes.

## 561. "The Museum Exhibit Page Needs Context"

Perspective: a museum curator.

User ask: "Make the exhibit page useful: objects, dates, access, programs, sponsors, visitor notes. Keep it dignified."

Success signals:
- Builds a museum exhibit site with object highlights, dates, accessibility, visitor notes, related programs, sponsor/supporter cues, and contact path.
- Uses dignified editorial tone and avoids fake ticket checkout.
- Keeps layout readable for mobile visitors.

Failure signals:
- Generic event page.
- No accessibility or visitor notes.
- Fake ticket purchase flow.

## 562. "Object Loans Need Tracking"

Perspective: a collections manager.

User ask: "Track loans with object category, lender type, condition status, insurance flag, return date, owner, status, and notes."

Success signals:
- Builds a Postgres API for object loans with object category, lender type, condition status, insurance flag, return date, owner, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps object examples non-sensitive.

Failure signals:
- Full collections management system.
- No condition/insurance/return fields.
- Missing migration.

## 563. "Loan Deadline Nudges Need Care"

Perspective: a museum registrar.

User ask: "Queue loan return reminders once per loan version. Dry-run and show failures."

Success signals:
- Creates a Redis worker for loan return reminders with idempotency by loan/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider configuration.
- Avoids real delivery by default.

Failure signals:
- No version guard.
- Real messages by default.
- No dead-letter visibility.

## 564. "A Repair Shop Needs Fewer Phone Calls"

Perspective: a bicycle repair shop owner.

User ask: "People ask the same repair questions. Services, turnaround, what to bring, pricing caveats, booking path."

Success signals:
- Builds a repair shop site with services, turnaround caveats, preparation checklist, pricing caveats, booking/inquiry path, and location/contact details.
- Avoids fake real-time availability or checkout.
- Keeps tone local and practical.

Failure signals:
- Generic retail site.
- Fake booking/payment.
- No turnaround or preparation information.

## 565. "Repair Tickets Need Basic Structure"

Perspective: a shop mechanic.

User ask: "Track repair tickets with item type, issue, priority, estimate approved, promised date, status, assigned tech, and notes."

Success signals:
- Builds a Postgres API for repair tickets with item type, issue, priority, estimate approval flag, promised date, status, assigned tech, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps it focused on ticket tracking.

Failure signals:
- Full inventory/POS platform.
- No approval/status/promised-date fields.
- Missing migration.

## 566. "Pickup Reminders Need a Guard"

Perspective: a repair shop front desk lead.

User ask: "Queue pickup reminders for completed tickets, but only once per ticket version."

Success signals:
- Creates a Redis worker for pickup reminders with idempotency by ticket/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and message-provider configuration.
- Avoids real delivery by default.

Failure signals:
- Duplicate reminders.
- Real messages by default.
- No failure visibility.

## 567. "The Therapy Practice Site Needs Boundaries"

Perspective: a therapist opening a private practice.

User ask: "Services, fit, fees, availability caveat, crisis note, contact. Don't make it medical software."

Success signals:
- Builds a therapy practice site with service areas, fit guidance, fees caveat, availability note, crisis/emergency disclaimer, contact path, and calm accessible copy.
- Avoids collecting health details or promising outcomes.
- Keeps design quiet and trustworthy.

Failure signals:
- Intake form requesting clinical details.
- No crisis disclaimer.
- Outcome promises.

## 568. "Consult Requests Need Minimal Intake"

Perspective: a therapist's admin helper.

User ask: "Track consultation requests with service interest, preferred format, availability window, urgency, consent flag, status, and notes."

Success signals:
- Builds a Postgres API for consultation requests with service interest, preferred format, availability window, urgency, consent flag, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Avoids sensitive clinical example data.

Failure signals:
- Clinical diagnosis fields.
- No consent/status fields.
- Missing migration.

## 569. "Consult Nudges Must Be Private"

Perspective: a therapy practice coordinator.

User ask: "Queue consult followups without exposing private notes. Dry-run, idempotent, visible failures."

Success signals:
- Creates a Redis worker for consultation followups with minimized payloads, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging sensitive notes.
- Documents rollback and secrets.

Failure signals:
- Logs private notes.
- Real messages by default.
- No failed job route.

## 570. "A Property Manager Needs a Resident Page"

Perspective: a property manager.

User ask: "Make a resident info page: move-in, rent caveats, maintenance, rules, contacts, documents, emergency note."

Success signals:
- Builds a resident information site with move-in steps, rent caveats, maintenance path, rules, contacts, documents, accessibility, and emergency disclaimer.
- Avoids fake payment or tenant portal.
- Keeps layout useful for stressed residents.

Failure signals:
- Generic apartment marketing page.
- Fake rent payment.
- No maintenance/emergency information.

## 571. "Lease Tasks Need Tracking"

Perspective: a property office assistant.

User ask: "Track lease tasks with unit group, task type, due date, resident status, document flag, owner, status, and notes."

Success signals:
- Builds a Postgres API for lease tasks with unit group, task type, due date, resident status, document flag, owner, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Avoids exact resident details in samples.

Failure signals:
- Full property-management platform.
- No due date/status/document fields.
- Missing migration.

## 572. "Lease Task Nudges Need Discipline"

Perspective: a property office manager.

User ask: "Queue lease task reminders once per task version. Dry-run."

Success signals:
- Creates a Redis worker for lease task reminders with idempotency by task/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real messages by default.

Failure signals:
- Duplicate nudges.
- Real delivery by default.
- No failure visibility.

## 573. "The Procurement Training Page Is Too Abstract"

Perspective: a corporate training lead.

User ask: "Make a training page for procurement teams: modules, outcomes, format, prerequisites, pricing caveat, pilot path."

Success signals:
- Builds a procurement training site with modules, outcomes, format options, prerequisites, pricing caveats, pilot path, facilitator context, and enterprise-friendly tone.
- Avoids fake checkout or unsupported certification claims.
- Keeps information dense and scannable.

Failure signals:
- Generic course landing page.
- Fake certification claims.
- No pilot/prerequisite info.

## 574. "Training Cohorts Need Coordination"

Perspective: a training coordinator.

User ask: "Track cohorts with company type, module, format, participant count, kickoff date, owner, stage, and notes."

Success signals:
- Builds a Postgres API for training cohorts with company type, module, format, participant count, kickoff date, owner, stage, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps it coordination-focused.

Failure signals:
- Full LMS.
- No stage/kickoff/participant count.
- Missing migration.

## 575. "Cohort Prep Reminders Need Limits"

Perspective: a training operations assistant.

User ask: "Queue prep reminders by cohort stage. No duplicate messages."

Success signals:
- Creates a Redis worker for cohort prep reminders with idempotency by cohort/stage version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider configuration.
- Avoids real delivery by default.

Failure signals:
- Duplicate reminders.
- Real messages by default.
- No failed job route.

## 576. "The Youth Program Site Needs Trust"

Perspective: a community program director.

User ask: "Parents need schedule, eligibility, safety, staff, costs caveat, transport note, contact. No fake registration."

Success signals:
- Builds a youth program site with schedule, eligibility, safety notes, staff/mentor info, cost caveats, transport notes, contact path, and trust cues.
- Avoids collecting child information or fake registration.
- Uses clear parent-friendly copy.

Failure signals:
- Generic nonprofit page.
- Collects child details.
- No safety/transport information.

## 577. "Program Interest Needs Sorting"

Perspective: a community program coordinator.

User ask: "Track interest with age band, program type, guardian contact preference, transport need, fee assistance flag, status, and notes."

Success signals:
- Builds a Postgres API for program interest with age band, program type, guardian contact preference, transport need, fee assistance flag, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Avoids child names in examples.

Failure signals:
- Sensitive child data in sample records.
- No transport/fee-assistance/status fields.
- Missing migration.

## 578. "Guardian Followups Need Safety"

Perspective: a youth program admin.

User ask: "Queue guardian followups, dry-run first, never log private notes."

Success signals:
- Creates a Redis worker for guardian followups with minimized payloads, idempotency by interest/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging private notes.
- Documents rollback and provider settings.

Failure signals:
- Logs private notes.
- Real messages by default.
- No failure visibility.

## 579. "A Fractional CFO Needs a Better Services Page"

Perspective: a fractional CFO.

User ask: "Services, who it's for, deliverables, cadence, pricing caveat, onboarding path. No finance bro vibes."

Success signals:
- Builds a fractional CFO services site with service packages, audience fit, deliverables, meeting cadence, pricing caveats, onboarding path, and sober B2B tone.
- Avoids investment advice and exaggerated outcome promises.
- Keeps layout executive-friendly and scannable.

Failure signals:
- Generic consultant page.
- Promises financial outcomes.
- No deliverables/cadence.

## 580. "CFO Leads Need Qualification"

Perspective: a fractional CFO operations assistant.

User ask: "Track leads with company stage, revenue band, service need, decision timeline, budget signal, owner, stage, and notes."

Success signals:
- Builds a Postgres API for CFO leads with company stage, revenue band, service need, decision timeline, budget signal, owner, stage, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps sales automation out of scope.

Failure signals:
- Full CRM.
- No stage/timeline/budget signal.
- Missing migration.
