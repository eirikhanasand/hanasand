# User Stories 661-680: Admin Glue With Sharp Edges

These stories test whether the agent can build small, practical systems for operators who need clarity more than features. The agent should infer useful scope, avoid sensitive data and fake transactions, and produce Docker/Compose-ready projects with concise operational notes.

## 661. "The Export Consultant Page Needs Precision"

Perspective: an export documentation consultant.

User ask: "Services, documents, process, timelines caveat, compliance caveat, contact. No legal guarantees."

Success signals:
- Builds an export documentation site with services, document categories, process, timeline caveats, compliance caveats, and contact path.
- Avoids legal guarantees and fake customs advice.
- Keeps tone precise and B2B.

Failure signals:
- Generic logistics page.
- Guarantees customs outcomes.
- No document/process details.

## 662. "Export Docs Need Tracking"

Perspective: an export coordinator.

User ask: "Track document sets with shipment type, destination region, document group, review status, due date, owner, and notes."

Success signals:
- Builds a Postgres API for export document sets with shipment type, destination region, document group, review status, due date, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps shipment identifiers out of examples.

Failure signals:
- Full logistics platform.
- No review/due/region fields.
- Missing migration.

## 663. "Export Review Nudges Need Audit Trail"

Perspective: an export operations lead.

User ask: "Queue review nudges once per document-set status. Dry-run and show failures."

Success signals:
- Creates a Redis worker for export review nudges with idempotency by document set/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate nudges.
- Real messages by default.
- No dead-letter visibility.

## 664. "The Facilities Page Needs To Reduce Tickets"

Perspective: a facilities manager.

User ask: "Explain requests, priorities, what tenants should include, response caveats, emergency note, contacts."

Success signals:
- Builds a facilities help site with request categories, priority explanation, tenant checklist, response caveats, emergency note, and contacts.
- Avoids fake live ticket submission.
- Keeps layout fast to scan.

Failure signals:
- Generic building page.
- Fake ticket portal.
- No priority/emergency guidance.

## 665. "Facilities Requests Need Routing"

Perspective: a facilities coordinator.

User ask: "Track requests with building area, category, priority, access note, vendor needed, status, owner, and notes."

Success signals:
- Builds a Postgres API for facilities requests with building area, category, priority, access note, vendor-needed flag, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps exact tenant details out of examples.

Failure signals:
- Full CMMS platform.
- No priority/vendor/status.
- Missing migration.

## 666. "Vendor Dispatch Nudges Need Limits"

Perspective: a facilities operations assistant.

User ask: "Queue vendor dispatch nudges for open requests. Once per request version."

Success signals:
- Creates a Redis worker for vendor dispatch nudges with idempotency by request/version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real messages by default.

Failure signals:
- Duplicate dispatches.
- Real delivery by default.
- No failed job visibility.

## 667. "The Tutoring Center Page Needs Clarity"

Perspective: a tutoring center owner.

User ask: "Subjects, levels, schedule caveat, assessment, pricing caveat, parent info, contact. No guaranteed grades."

Success signals:
- Builds a tutoring center site with subjects, levels, schedule caveats, assessment process, pricing caveats, parent information, and contact path.
- Avoids grade guarantees and fake booking.
- Keeps tone parent-friendly and specific.

Failure signals:
- Generic education page.
- Promises grade improvement.
- No assessment/schedule info.

## 668. "Tutoring Inquiries Need Sorting"

Perspective: a tutoring coordinator.

User ask: "Track inquiries with subject, level, age band, schedule window, goal, assessment status, stage, and notes."

Success signals:
- Builds a Postgres API for tutoring inquiries with subject, level, age band, schedule window, goal, assessment status, stage, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps student names out of examples.

Failure signals:
- Full school platform.
- No assessment/stage/schedule fields.
- Missing migration.

## 669. "Assessment Followups Need Manners"

Perspective: a tutoring center admin.

User ask: "Queue assessment followups once per inquiry stage. Dry-run."

Success signals:
- Creates a Redis worker for assessment followups with idempotency by inquiry/stage version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Real messages by default.
- No stage-version guard.
- No failure visibility.

## 670. "The Insurance Claim Helper Page Needs Boundaries"

Perspective: a claim documentation helper.

User ask: "Services, what I can help with, what I can't, documents checklist, timeline caveat, contact."

Success signals:
- Builds a claim helper site with services, boundaries, document checklist, timeline caveats, contact path, and no claim-outcome promises.
- Avoids collecting claim details.
- Keeps copy reassuring and precise.

Failure signals:
- Promises payout outcomes.
- Collects claim facts.
- No boundaries/checklist.

## 671. "Claim Docs Need Tracking"

Perspective: a claim support coordinator.

User ask: "Track document packs with claim type, document group, completeness status, review status, due date, owner, and notes."

Success signals:
- Builds a Postgres API for claim document packs with claim type, document group, completeness status, review status, due date, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps claim numbers and personal details out of examples.

Failure signals:
- Full insurance platform.
- No completeness/review/due fields.
- Missing migration.

## 672. "Claim Doc Nudges Need Privacy"

Perspective: a claim support assistant.

User ask: "Queue document nudges without claim details. Dry-run, idempotent."

Success signals:
- Creates a Redis worker for claim document nudges with minimized payloads, idempotency by pack/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging claim details.
- Documents rollback and secrets.

Failure signals:
- Logs claim details.
- Real messages by default.
- No failed job route.

## 673. "The Cemetery Info Page Needs Sensitivity"

Perspective: a cemetery administrator.

User ask: "Plot info, rules, visiting hours, fees caveat, maintenance, records contact. Gentle tone."

Success signals:
- Builds a cemetery information site with plot information, rules, visiting hours, fee caveats, maintenance notes, records contact, and sensitive tone.
- Avoids fake plot sales or payments.
- Keeps accessibility and visitor info clear.

Failure signals:
- Salesy memorial page.
- Fake plot checkout.
- No rules/records contact.

## 674. "Plot Records Need Tracking"

Perspective: a cemetery office assistant.

User ask: "Track plot records with section, plot type, status, maintenance flag, record review status, owner, and notes."

Success signals:
- Builds a Postgres API for plot records with section, plot type, status, maintenance flag, record review status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps personal names out of examples.

Failure signals:
- Full cemetery management suite.
- Personal names in sample data.
- Missing migration.

## 675. "Maintenance Review Nudges Need Care"

Perspective: a cemetery grounds coordinator.

User ask: "Queue maintenance review nudges by plot status. Dry-run and visible failures."

Success signals:
- Creates a Redis worker for maintenance review nudges with idempotency by plot/status version, dry-run default, retries, dead-letter visibility, and status routes.
- Documents rollback and provider settings.
- Avoids real delivery by default.

Failure signals:
- Duplicate nudges.
- Real messages by default.
- No failure route.

## 676. "The Policy Team Page Needs Substance"

Perspective: a policy research team lead.

User ask: "Research areas, briefs, process, review caveat, stakeholder notes, contact. Not a think tank brochure."

Success signals:
- Builds a policy team site with research areas, brief types, process, review caveats, stakeholder notes, contact path, and restrained civic tone.
- Avoids partisan campaign language.
- Keeps content dense and useful.

Failure signals:
- Generic think tank brochure.
- Partisan campaign tone.
- No process/review caveat.

## 677. "Policy Briefs Need Workflow"

Perspective: a policy operations manager.

User ask: "Track briefs with topic, audience, review stage, publication status, owner, due date, and notes."

Success signals:
- Builds a Postgres API for policy briefs with topic, audience, review stage, publication status, owner, due date, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps document content out of scope.

Failure signals:
- Full CMS.
- No review/publication/due fields.
- Missing migration.

## 678. "Brief Review Nudges Need Discipline"

Perspective: a policy editor.

User ask: "Queue review nudges by brief stage. No document content in logs."

Success signals:
- Creates a Redis worker for brief review nudges with minimized payloads, idempotency by brief/stage version, dry-run default, retries, dead-letter visibility, and status routes.
- Avoids logging document content.
- Documents rollback and provider settings.

Failure signals:
- Logs document content.
- Real messages by default.
- No dead-letter route.

## 679. "The Photographer Page Needs To Qualify Clients"

Perspective: a commercial photographer.

User ask: "Services, usage rights, prep, timelines, pricing caveat, availability, inquiry path."

Success signals:
- Builds a photographer site with service types, usage rights notes, prep checklist, timeline caveats, pricing caveats, availability caveat, and inquiry path.
- Avoids fake booking/payment and rights guarantees.
- Keeps visual portfolio placeholders polished.

Failure signals:
- Generic portfolio bio.
- Fake booking checkout.
- No usage rights or prep info.

## 680. "Shoot Requests Need Structure"

Perspective: a studio coordinator.

User ask: "Track shoot requests with shoot type, usage intent, location type, deadline, budget band, status, owner, and notes."

Success signals:
- Builds a Postgres API for shoot requests with shoot type, usage intent, location type, deadline, budget band, status, owner, notes, and timestamps.
- Includes migration, health/ready routes, Docker, Compose, env notes.
- Keeps file upload/payment out of scope.

Failure signals:
- Full booking marketplace.
- No usage/deadline/status.
- Missing migration.
