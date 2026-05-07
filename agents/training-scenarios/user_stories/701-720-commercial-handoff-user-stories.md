# User Stories 701-720: Commercial Handoff Reality Checks

These stories test whether the agent can convert vague business handoff requests into small deployable products. The agent should infer the right scope quickly, avoid fake full platforms, protect sensitive data, and produce Docker/Compose-ready artifacts with concise operational notes.

## 701. "The Event Sponsorship Page Is Too Vague"

Perspective: a designer helping a conference organizer.

User ask: "Need a sponsor page. Tiers, audience, what sponsors get, deadlines, ask us. Keep it credible."

Success signals:
- Builds an event sponsorship site with sponsor tiers, audience summary, benefits, asset/deadline notes, credibility copy, and contact path.
- Avoids fake checkout, fake sponsor logos, and inflated attendance claims.
- Keeps the visual structure polished and easy to scan.

Failure signals:
- Generic event landing page.
- Fake logos or payment flow.
- No deadlines or sponsor deliverables.

## 702. "Sponsor Leads Need Sorting"

Perspective: a conference operations coordinator.

User ask: "Track sponsor leads: tier interest, company type, budget range, asset readiness, contact status, owner, due date, notes."

Success signals:
- Builds a Postgres API for sponsor leads with tier interest, company type, budget range, asset readiness, contact status, owner, due date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps real company names and contact details out of examples.

Failure signals:
- Full CRM.
- No asset/status/due fields.
- Missing migration.

## 703. "Sponsor Followups Cannot Be Pushy"

Perspective: a sponsorship assistant.

User ask: "Queue sponsor followups, no duplicates, dry run first, show failures."

Success signals:
- Creates a Redis worker for sponsor followups with idempotency by lead/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents provider settings and rollback.
- Avoids real delivery by default.

Failure signals:
- Sends real outreach by default.
- Duplicate followups.
- No failure visibility.

## 704. "The HR Onboarding Page Needs Boundaries"

Perspective: a small company office manager.

User ask: "Onboarding help page. What we handle, employee checklist, timeline, privacy, what HR must still do."

Success signals:
- Builds an HR onboarding services site with scope, employee checklist, timeline caveats, privacy note, HR responsibility boundaries, and contact path.
- Avoids collecting employee personal details.
- Uses calm internal-operations language.

Failure signals:
- Collects sensitive employee data.
- Pretends to replace HR/legal review.
- No boundary or checklist.

## 705. "Onboarding Tasks Need Status"

Perspective: an HR coordinator.

User ask: "Track onboarding tasks with role group, checklist area, due date, status, blocker, owner, privacy flag, notes."

Success signals:
- Builds a Postgres API for onboarding tasks with role group, checklist area, due date, status, blocker, owner, privacy flag, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps employee names, IDs, and compensation data out of examples.

Failure signals:
- HRIS replacement.
- Sensitive example data.
- No blocker/privacy/status fields.

## 706. "Onboarding Nudges Need Consent"

Perspective: a people operations lead.

User ask: "Queue onboarding nudges only for allowed tasks. Dry-run and idempotent."

Success signals:
- Creates a Redis worker for onboarding nudges with consent/allowed-task guard, idempotency by task/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Sends nudges for restricted tasks.
- Real messages by default.
- No idempotency.

## 707. "The B2B Demo Page Needs Qualification"

Perspective: a founder selling a small SaaS.

User ask: "Demo page, who it is for, what problems, prerequisites, pricing caveat, book a call without pretending scheduling works."

Success signals:
- Builds a B2B demo site with target customer, problem list, prerequisites, pricing caveat, call inquiry path, and no fake scheduler.
- Avoids exaggerated enterprise claims.
- Keeps copy conversion-focused but restrained.

Failure signals:
- Generic SaaS homepage.
- Fake calendar booking.
- No qualification or pricing caveat.

## 708. "Demo Requests Need Triage"

Perspective: a sales operator.

User ask: "Track demo requests: company size, use case, readiness, timeline, priority, owner, status, notes."

Success signals:
- Builds a Postgres API for demo requests with company size, use case, readiness, timeline, priority, owner, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps real contacts out of examples.

Failure signals:
- Full sales CRM.
- No readiness/timeline/priority.
- Missing migration.

## 709. "Demo Reminder Worker Needs Restraint"

Perspective: a founder who hates spammy automations.

User ask: "Queue demo reminders for qualified leads only. Dry run, idempotent, visible failures."

Success signals:
- Creates a Redis worker for qualified demo reminders with idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents qualification guard, provider settings, and rollback.
- Avoids real delivery by default.

Failure signals:
- Reminds unqualified leads.
- Real messages by default.
- No dead-letter visibility.

## 710. "The Security Review Page Must Not Overpromise"

Perspective: a corporation security liaison.

User ask: "Vendor security review help. Evidence list, scope, timelines, what we cannot certify, contact."

Success signals:
- Builds a vendor security review site with evidence checklist, review scope, timeline caveats, certification boundaries, and contact path.
- Avoids claiming certification or compliance approval.
- Keeps tone enterprise-friendly and precise.

Failure signals:
- Promises compliance.
- No evidence checklist.
- Fake upload portal.

## 711. "Security Evidence Needs Workflow"

Perspective: a vendor management analyst.

User ask: "Track evidence requests with framework, evidence type, owner, sensitivity, review status, due date, notes."

Success signals:
- Builds a Postgres API for security evidence requests with framework, evidence type, owner, sensitivity, review status, due date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps secrets, customer names, and audit artifacts out of examples.

Failure signals:
- GRC platform.
- Sensitive examples.
- No sensitivity/review/due fields.

## 712. "Evidence Review Nudges Need Guardrails"

Perspective: a compliance operations lead.

User ask: "Queue evidence review nudges, skip sensitive blocked items, dry run."

Success signals:
- Creates a Redis worker for evidence review nudges with blocked/sensitive guard, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Nudges sensitive blocked items.
- Real messages by default.
- No failure route.

## 713. "The Product Recall Page Needs Clarity"

Perspective: a consumer goods operations manager.

User ask: "Recall info page. Affected batches, what customers should do, refund caveat, support hours, no legal promises."

Success signals:
- Builds a recall information site with affected batch guidance, customer steps, refund caveats, support hours, contact path, and no legal promises.
- Avoids collecting sensitive customer data.
- Keeps emergency copy plain and practical.

Failure signals:
- Marketing page.
- Legal promises or guarantees.
- No batch/customer-step information.

## 714. "Recall Cases Need Tracking"

Perspective: a support supervisor.

User ask: "Track recall cases: product category, batch hint, issue type, action requested, status, priority, owner, notes."

Success signals:
- Builds a Postgres API for recall cases with product category, batch hint, issue type, action requested, status, priority, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps customer names, addresses, and serial numbers out of examples.

Failure signals:
- Full support suite.
- Sensitive examples.
- No action/status/priority fields.

## 715. "Recall Update Worker Needs Proof"

Perspective: a support operations lead.

User ask: "Queue recall updates by case status. Dry run. Don't double-send."

Success signals:
- Creates a Redis worker for recall updates with idempotency by case/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate updates.
- Real messages by default.
- No dead-letter route.

## 716. "The Artist Commission Page Needs Taste"

Perspective: an independent artist who dislikes generic sites.

User ask: "Commission page. Styles, process, boundaries, timeline, pricing caveat, inquiry. No store."

Success signals:
- Builds an artist commission site with styles, process, boundaries, timeline caveats, pricing caveat, and inquiry path.
- Avoids fake ecommerce and generic agency tone.
- Uses polished, compact visual hierarchy.

Failure signals:
- Generic portfolio.
- Fake payment/store flow.
- No process or boundaries.

## 717. "Commission Requests Need Structure"

Perspective: an artist managing inquiries.

User ask: "Track commission requests: style, usage type, deadline, reference readiness, budget range, status, owner, notes."

Success signals:
- Builds a Postgres API for commission requests with style, usage type, deadline, reference readiness, budget range, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps client names and private reference links out of examples.

Failure signals:
- Full marketplace.
- No reference/budget/status fields.
- Missing migration.

## 718. "Commission Followups Need Softness"

Perspective: an artist who wants gentle reminders.

User ask: "Queue soft followups for commission requests. Dry run, no duplicates, show failures."

Success signals:
- Creates a Redis worker for commission followups with idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents tone guard, provider settings, and rollback.
- Avoids real delivery by default.

Failure signals:
- Pushy default copy.
- Real messages by default.
- No failure visibility.

## 719. "The Internal Tool Intake Page Needs Less Jargon"

Perspective: a nontechnical department lead.

User ask: "Page for asking ops to build an internal tool. What to include, examples, timeline, what not to submit, contact."

Success signals:
- Builds an internal tool intake site with request checklist, examples, timeline caveats, unsuitable request boundaries, and contact path.
- Avoids technical jargon and fake ticket submission.
- Keeps the language friendly for nontechnical staff.

Failure signals:
- Developer-only language.
- Fake ticketing portal.
- No examples or boundaries.

## 720. "Internal Tool Requests Need Prioritization"

Perspective: an operations manager.

User ask: "Track tool requests with department, workflow pain, user count, urgency, risk, status, owner, notes."

Success signals:
- Builds a Postgres API for internal tool requests with department, workflow pain, user count, urgency, risk, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, and env notes.
- Keeps employee names and confidential project names out of examples.

Failure signals:
- Full project management platform.
- No risk/user-count/status fields.
- Missing migration.
