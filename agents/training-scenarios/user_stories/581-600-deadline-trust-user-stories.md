# User Stories 581-600: Deadline and Trust Pressure

These stories test whether the agent can handle rushed, ambiguous requests from people who need useful software more than long explanations. The agent should infer the smallest deployable product, avoid sensitive-data traps, and produce concise Docker/Compose-ready projects with clear operational notes.

## 581. "The Immigration Advisor Site Must Be Careful"

Perspective: an immigration advisor.

User ask: "Explain services, process, document prep, timelines caveat, fees, contact. No legal promises."

Success signals:
- Builds an immigration advisory site with services, process, document preparation, timeline caveats, fee caveats, contact path, and legal-outcome disclaimer.
- Uses careful reassuring copy without promising approvals.
- Avoids collecting sensitive case details.

Failure signals:
- Promises visa outcomes.
- Intake form asks for private immigration facts.
- Generic consultant page.

## 582. "Case Prep Needs Tracking"

Perspective: an immigration office coordinator.

User ask: "Track prep tasks with case type, document group, due date, review status, client status, owner, and notes."

Success signals:
- Builds a Postgres API for case prep tasks with case type, document group, due date, review status, client status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps sample data non-sensitive.

Failure signals:
- Full legal case-management system.
- Sensitive case facts in examples.
- Missing migration.

## 583. "Document Prep Nudges Need Privacy"

Perspective: an immigration office assistant.

User ask: "Queue document prep nudges, idempotent, dry-run, don't log private notes."

Success signals:
- Creates a Redis worker for document prep nudges with minimized payloads, idempotency by task/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging private notes.
- Documents rollback and provider configuration.

Failure signals:
- Logs private notes.
- Real messages by default.
- No failure visibility.

## 584. "A Local Energy Auditor Needs Credibility"

Perspective: a home energy auditor.

User ask: "Services, what happens during visit, rebates caveat, prep checklist, sample report, contact. No fake savings."

Success signals:
- Builds an energy audit site with services, visit process, rebate caveats, prep checklist, sample report section, contact path, and no guaranteed savings claims.
- Keeps tone technical but homeowner-friendly.
- Avoids fake rebate application flow.

Failure signals:
- Promises specific savings.
- Generic contractor page.
- Fake rebate form.

## 585. "Audit Requests Need Triage"

Perspective: an energy audit coordinator.

User ask: "Track requests with property type, utility area, audit goal, rebate interest, preferred window, status, and notes."

Success signals:
- Builds a Postgres API for audit requests with property type, utility area, audit goal, rebate interest, preferred window, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps exact addresses out of examples.

Failure signals:
- Full scheduling platform.
- No rebate/status/preferred window.
- Missing migration.

## 586. "Audit Prep Reminders Need Restraint"

Perspective: an energy audit scheduler.

User ask: "Queue prep reminders before visits, once per request version, dry-run."

Success signals:
- Creates a Redis worker for audit prep reminders with idempotency by request/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate reminders.
- Real messages by default.
- No failure route.

## 587. "The Grant Writer Page Needs Proof Without Hype"

Perspective: a grant writer.

User ask: "Services, fit, timeline, what I need from clients, reporting caveat, contact. Don't invent win rates."

Success signals:
- Builds a grant writing site with services, client fit, timeline, client material checklist, reporting caveats, contact path, and careful proof language without invented win rates.
- Avoids fake guarantees.
- Keeps copy practical for nonprofits.

Failure signals:
- Invented success rates.
- Generic copywriting page.
- No client checklist or reporting caveat.

## 588. "Grant Pipeline Needs Visibility"

Perspective: a nonprofit development manager.

User ask: "Track grants with funder type, deadline, program area, amount range, stage, owner, submitted flag, and notes."

Success signals:
- Builds a Postgres API for grant pipeline items with funder type, deadline, program area, amount range, stage, owner, submitted flag, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps it a pipeline tracker, not a donor database.

Failure signals:
- Full fundraising CRM.
- No deadline/stage/submitted flag.
- Missing migration.

## 589. "Grant Deadline Nudges Cannot Be Noisy"

Perspective: a development operations assistant.

User ask: "Queue deadline nudges by grant stage. Avoid duplicates and show failures."

Success signals:
- Creates a Redis worker for grant deadline nudges with idempotency by grant/stage version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate nudges.
- Real messages by default.
- Silent failures.

## 590. "The Catering Page Needs To Qualify Events"

Perspective: a catering owner.

User ask: "Show menus, event types, minimums, service area, timing, allergy caveat, inquiry path."

Success signals:
- Builds a catering site with menu categories, event types, minimums, service area, timing caveats, allergy disclaimer, inquiry path, and practical food-service tone.
- Avoids fake checkout or live availability.
- Keeps layout fast to scan.

Failure signals:
- Generic restaurant site.
- Fake cart/payment.
- No minimums/allergy caveat.

## 591. "Catering Leads Need Sorting"

Perspective: a catering coordinator.

User ask: "Track event leads with event type, date, guest count, service area, menu interest, allergy flag, status, and notes."

Success signals:
- Builds a Postgres API for catering leads with event type, date, guest count, service area, menu interest, allergy flag, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps payment and menu inventory out of scope.

Failure signals:
- Full catering operations suite.
- No guest/status/allergy fields.
- Missing migration.

## 592. "Menu Followups Need Boundaries"

Perspective: a catering sales assistant.

User ask: "Queue menu followups for open leads, once per lead version, dry-run."

Success signals:
- Creates a Redis worker for catering menu followups with idempotency by lead/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider configuration.
- Avoids real messages by default.

Failure signals:
- Real delivery by default.
- No version guard.
- No dead-letter visibility.

## 593. "The IT Support Page Feels Like Vapor"

Perspective: a managed IT consultant.

User ask: "Services, response expectations, onboarding, security caveats, supported orgs, contact. No fake SLA."

Success signals:
- Builds a managed IT support site with services, response expectations, onboarding process, security caveats, supported organization profiles, contact path, and no unsupported SLA claims.
- Uses sober operational tone.
- Avoids fake ticket portal.

Failure signals:
- Generic tech startup page.
- Fake SLA/compliance claims.
- No onboarding or response expectations.

## 594. "Support Requests Need Basic Triage"

Perspective: an IT support dispatcher.

User ask: "Track requests with org type, issue category, severity, affected users, remote ok, status, owner, and notes."

Success signals:
- Builds a Postgres API for support requests with org type, issue category, severity, affected users, remote-ok flag, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Avoids passwords or secrets in examples.

Failure signals:
- Logs secrets in examples.
- No severity/status/remote flag.
- Missing migration.

## 595. "Support Escalations Need Control"

Perspective: an IT support lead.

User ask: "Queue escalation checks for severe tickets. Dry-run and visible failures."

Success signals:
- Creates a Redis worker for support escalation checks with idempotency by request/severity version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real notifications by default.

Failure signals:
- Real paging by default.
- No idempotency by severity version.
- No failure route.

## 596. "The Estate Sale Page Needs Calm"

Perspective: an estate sale organizer.

User ask: "Dates, location caveat, item categories, rules, accessibility, parking, contact. Don't make it ecommerce."

Success signals:
- Builds an estate sale site with dates, location caveats, item categories, sale rules, accessibility, parking, contact path, and calm practical tone.
- Avoids fake online checkout/reservations.
- Keeps mobile visitor use in mind.

Failure signals:
- Ecommerce catalog.
- No rules/accessibility/parking info.
- Fake cart.

## 597. "Sale Items Need Simple Tracking"

Perspective: an estate sale coordinator.

User ask: "Track item groups, room, price band, hold status, pickup note, visibility, owner, and notes."

Success signals:
- Builds a Postgres API for sale item groups with room, price band, hold status, pickup note, visibility, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps it grouped inventory, not ecommerce.

Failure signals:
- Full marketplace.
- No hold/visibility/pickup fields.
- Missing migration.

## 598. "Pickup Coordination Needs Guardrails"

Perspective: an estate sale logistics helper.

User ask: "Queue pickup nudges for held items, once per hold version. Dry-run."

Success signals:
- Creates a Redis worker for held-item pickup nudges with idempotency by item group/hold version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids payment handling.

Failure signals:
- Attempts payment workflow.
- No hold-version guard.
- No failed job visibility.

## 599. "The Translation Studio Page Needs Specificity"

Perspective: a translation studio owner.

User ask: "Languages, domains, process, turnaround caveats, certification caveat, file prep, quote path."

Success signals:
- Builds a translation studio site with languages, domain specialties, process, turnaround caveats, certification caveat, file-prep checklist, and quote path.
- Avoids fake instant translation or upload of sensitive files.
- Keeps tone international and professional.

Failure signals:
- Generic freelancer page.
- Fake instant quote/upload.
- No certification/turnaround caveats.

## 600. "Translation Quotes Need Tracking"

Perspective: a translation project manager.

User ask: "Track quote requests with language pair, domain, word count band, certification need, deadline, status, owner, and notes."

Success signals:
- Builds a Postgres API for translation quote requests with language pair, domain, word count band, certification need, deadline, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps source document content out of scope.

Failure signals:
- Stores document text.
- No deadline/status/certification fields.
- Missing migration.
