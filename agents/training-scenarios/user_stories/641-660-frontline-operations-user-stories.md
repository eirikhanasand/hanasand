# User Stories 641-660: Frontline Operations Under Pressure

These stories test whether the agent can turn terse frontline-operations requests into small deployable projects. The agent should infer the practical shape, avoid fake transactional flows, protect sensitive information, and keep operational notes short.

## 641. "The Crisis Communications Page Needs Calm"

Perspective: a communications consultant.

User ask: "Services, what happens first, response tiers, media prep, caveats, contact. No fear pitch."

Success signals:
- Builds a crisis communications site with services, first-response process, response tiers, media prep, caveats, contact path, and calm professional tone.
- Avoids fear marketing and guaranteed reputation outcomes.
- Keeps sections dense and scannable.

Failure signals:
- Generic PR landing page.
- Promises outcomes.
- No response-tier or first-step information.

## 642. "Crisis Requests Need Triage"

Perspective: a communications operations lead.

User ask: "Track requests with issue type, urgency, public status, media interest, response tier, owner, status, and notes."

Success signals:
- Builds a Postgres API for crisis requests with issue type, urgency, public status, media interest, response tier, owner, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps sensitive incident details out of examples.

Failure signals:
- Full PR CRM.
- No urgency/public/status fields.
- Missing migration.

## 643. "Crisis Followups Need Control"

Perspective: a communications coordinator.

User ask: "Queue followups by request status. Dry-run, idempotent, visible failures."

Success signals:
- Creates a Redis worker for crisis followups with idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real messages by default.

Failure signals:
- Real messages by default.
- No status-version guard.
- No failed job visibility.

## 644. "The Shelter Page Needs To Reduce Calls"

Perspective: an animal shelter coordinator.

User ask: "Adoption process, foster info, visiting hours, fees caveat, what to bring, contact. No fake applications."

Success signals:
- Builds an animal shelter information site with adoption process, foster information, visiting hours, fee caveats, preparation checklist, and contact path.
- Avoids fake adoption applications or payments.
- Keeps tone warm but operational.

Failure signals:
- Generic charity page.
- Fake application/payment flow.
- No visiting/prep details.

## 645. "Adoption Interest Needs Sorting"

Perspective: a shelter adoption lead.

User ask: "Track interest with animal type, household fit, experience level, visit window, foster interest, status, owner, and notes."

Success signals:
- Builds a Postgres API for adoption interest with animal type, household fit, experience level, visit window, foster interest, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps personal household details out of sample data.

Failure signals:
- Full shelter-management system.
- No fit/status/visit fields.
- Missing migration.

## 646. "Foster Followups Need Boundaries"

Perspective: a foster coordinator.

User ask: "Queue foster followups once per interest status. Dry-run and show failures."

Success signals:
- Creates a Redis worker for foster followups with idempotency by interest/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider configuration.
- Avoids real delivery by default.

Failure signals:
- Duplicate followups.
- Real messages by default.
- No failure route.

## 647. "The Legal Aid Page Needs Plain Help"

Perspective: a legal aid clinic volunteer.

User ask: "Services, eligibility, what to bring, limits, urgent note, clinic times, contact. No legal advice."

Success signals:
- Builds a legal aid clinic site with services, eligibility, document checklist, scope limits, urgent note, clinic times, and contact path.
- Avoids legal advice and outcome promises.
- Uses plain accessible language.

Failure signals:
- Law firm sales page.
- Gives legal advice.
- No eligibility/scope limits.

## 648. "Clinic Slots Need Triage"

Perspective: a legal aid intake helper.

User ask: "Track clinic requests with help area, eligibility status, urgency, preferred clinic time, document readiness, status, and notes."

Success signals:
- Builds a Postgres API for clinic requests with help area, eligibility status, urgency, preferred clinic time, document readiness, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Avoids sensitive legal facts in examples.

Failure signals:
- Full case management.
- No eligibility/urgency/status.
- Missing migration.

## 649. "Document Reminders Need Privacy"

Perspective: a legal aid coordinator.

User ask: "Queue document reminders without private notes. Dry-run, idempotent, visible failures."

Success signals:
- Creates a Redis worker for legal-aid document reminders with minimized payloads, idempotency by request/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging private notes.
- Documents rollback and secrets.

Failure signals:
- Logs private legal notes.
- Real messages by default.
- No dead-letter route.

## 650. "The Construction Safety Page Needs Substance"

Perspective: a site safety consultant.

User ask: "Services, toolbox talks, audits, incident review, site requirements, caveats, contact. No fake certification."

Success signals:
- Builds a construction safety consulting site with services, toolbox talks, audits, incident review, site requirements, caveats, contact path, and no unsupported certification claims.
- Keeps layout practical for site managers.
- Avoids fake certification badges.

Failure signals:
- Generic safety page.
- Fake certification claims.
- No site requirements.

## 651. "Toolbox Talks Need Tracking"

Perspective: a construction safety coordinator.

User ask: "Track talks with site type, topic, crew size, scheduled date, attendance status, owner, status, and notes."

Success signals:
- Builds a Postgres API for toolbox talks with site type, topic, crew size, scheduled date, attendance status, owner, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps it focused on talk coordination.

Failure signals:
- Full EHS suite.
- No attendance/status/date.
- Missing migration.

## 652. "Safety Talk Nudges Need Discipline"

Perspective: a site safety admin.

User ask: "Queue reminders for scheduled talks. Once per talk version, dry-run."

Success signals:
- Creates a Redis worker for toolbox talk reminders with idempotency by talk/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real messages by default.

Failure signals:
- Duplicate reminders.
- Real messages by default.
- No failed job visibility.

## 653. "The Pest Control Page Needs Less Panic"

Perspective: a pest control owner.

User ask: "Services, prep steps, safety caveats, followup timing, pricing caveat, service area, contact."

Success signals:
- Builds a pest control site with services, preparation steps, safety caveats, followup timing, pricing caveats, service area, and contact path.
- Avoids fear marketing and fake instant booking.
- Keeps homeowner copy clear.

Failure signals:
- Fear-heavy landing page.
- Fake booking/payment.
- No safety/prep information.

## 654. "Service Requests Need Routing"

Perspective: a pest control dispatcher.

User ask: "Track requests with pest type, area, urgency, access notes, prep status, route owner, status, and notes."

Success signals:
- Builds a Postgres API for service requests with pest type, area, urgency, access notes, prep status, route owner, status, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps exact addresses out of examples.

Failure signals:
- Full field-service platform.
- No urgency/prep/status.
- Missing migration.

## 655. "Prep Followups Need Guardrails"

Perspective: a pest control office assistant.

User ask: "Queue prep followups before visits, once per request version. Dry-run."

Success signals:
- Creates a Redis worker for prep followups with idempotency by request/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate followups.
- Real messages by default.
- No failed job route.

## 656. "The Board Governance Page Needs Dense Clarity"

Perspective: a governance consultant.

User ask: "Services, board packs, policies, meeting cadence, confidentiality caveat, onboarding path. No fluff."

Success signals:
- Builds a governance consulting site with services, board pack support, policy work, meeting cadence, confidentiality caveats, onboarding path, and dense executive tone.
- Avoids legal guarantees.
- Keeps content scannable.

Failure signals:
- Generic consultant page.
- Legal guarantees.
- No cadence/confidentiality details.

## 657. "Board Packs Need Tracking"

Perspective: a board secretary.

User ask: "Track board packs with meeting type, document group, review owner, due date, approval status, confidentiality level, and notes."

Success signals:
- Builds a Postgres API for board packs with meeting type, document group, review owner, due date, approval status, confidentiality level, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps sensitive board content out of examples.

Failure signals:
- Full board portal.
- Stores board content.
- Missing migration.

## 658. "Board Pack Nudges Need Discretion"

Perspective: a board secretary.

User ask: "Queue review nudges without document content. Dry-run and visible failures."

Success signals:
- Creates a Redis worker for board pack review nudges with minimized payloads, idempotency by pack/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging document content.
- Documents rollback and provider settings.

Failure signals:
- Logs confidential content.
- Real messages by default.
- No failure route.

## 659. "The Warranty Repair Page Needs Trust"

Perspective: a small appliance repair shop.

User ask: "Warranty rules, covered items, process, timing caveat, exclusions, contact. No fake claim approval."

Success signals:
- Builds a warranty repair site with warranty rules, covered items, process, timing caveats, exclusions, contact path, and no fake claim approval flow.
- Keeps tone clear for frustrated customers.
- Avoids fake claim submission/payment.

Failure signals:
- Generic repair page.
- Fake approval flow.
- No exclusions/timing caveats.

## 660. "Warranty Claims Need Basic Tracking"

Perspective: a warranty desk coordinator.

User ask: "Track claims with item type, purchase window, issue category, warranty status, approval status, owner, and notes."

Success signals:
- Builds a Postgres API for warranty claims with item type, purchase window, issue category, warranty status, approval status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps receipts and files out of scope.

Failure signals:
- Full claims platform.
- No warranty/approval status.
- Missing migration.
