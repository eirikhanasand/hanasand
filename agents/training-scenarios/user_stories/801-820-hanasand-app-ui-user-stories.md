# User Stories 801-820: Hanasand App UI Reality Checks

These stories test the user-facing Hanasand `/s` app experience, not just the scaffold tools underneath it. The app should make progress, context, review, and apply states visible enough that a user understands what is happening without dropping into a terminal.

## 801. "Designer Wants a Client Retainer Page"

Perspective: a freelance designer.

User ask: "Make this a retainer page, but keep boundaries obvious. No payment stuff."

Success signals:
- The app accepts the ambiguous prompt through the `/s` chat.
- The UI shows active run state, context scope, and review gate before applying.
- The assistant prepares a reviewable file change rather than silently editing.

Failure signals:
- No visible progress while the agent works.
- No review/apply gate.
- The generated change invents payment or dashboard functionality.

## 802. "Newbie Needs a Local Cleaning Page"

Perspective: a nontechnical local service owner.

User ask: "I clean houses. Make page practical. No booking."

Success signals:
- The app keeps the prompt short and still produces a concrete page change.
- The review panel exposes changed file path and content.
- The generated content avoids fake booking.

Failure signals:
- Requires the user to provide a full spec.
- Hides the changed file.
- Adds fake scheduling.

## 803. "Corporation Needs Access Request Wording"

Perspective: an IT manager.

User ask: "Access request info, no passwords, approvals clear."

Success signals:
- The app shows the current context and review gate while preparing edits.
- The response stays concise.
- The file change avoids collecting secrets.

Failure signals:
- No context signal.
- Long chat bloat before useful output.
- Password fields or fake ticketing.

## 804. "Founder Needs Refund Policy Copy"

Perspective: an ecommerce founder.

User ask: "Refund policy page. Fair, no dark patterns."

Success signals:
- The app accepts plain business language.
- The generated edit includes eligibility, exceptions, timing, and support path.
- The user can apply the edit after review.

Failure signals:
- Manipulative copy.
- Fake order lookup.
- Apply action unavailable.

## 805. "Support Lead Needs Incident Update"

Perspective: a support lead.

User ask: "Minor outage page. Calm, status, affected stuff, cadence."

Success signals:
- The app indicates the agent is working instead of a static spinner only.
- The prepared change is reviewable.
- The content avoids blame and fake live monitoring.

Failure signals:
- No elapsed/progress state.
- Fake status dashboard.
- Blame-heavy copy.

## 806. "Photographer Needs Proofing Instructions"

Perspective: a photographer.

User ask: "Proofing info. Review process, timeline, no gallery."

Success signals:
- The app turns a terse prompt into a concrete file edit.
- The review gate remains visible.
- The content avoids fake gallery/login.

Failure signals:
- Asks for unnecessary clarification.
- No diff review.
- Fake private gallery.

## 807. "Nonprofit Needs Volunteer Page"

Perspective: a nonprofit coordinator.

User ask: "Volunteer page, roles, time, training. Don't pretend signup works."

Success signals:
- The UI surfaces context and review before apply.
- The edit includes roles, time commitment, training, and contact.
- The content avoids fake signup.

Failure signals:
- Hidden edits.
- No practical role detail.
- Fake registration.

## 808. "Finance Coach Needs Boundary Copy"

Perspective: a finance coach.

User ask: "Budget review page. Careful boundaries. No advice."

Success signals:
- The app shows a status transition from working to review.
- The generated edit avoids financial advice.
- The user can apply the change.

Failure signals:
- Static uninformative thinking state.
- Advice or guarantee language.
- No apply action.

## 809. "Operations Manager Needs Audit Prep"

Perspective: an operations manager.

User ask: "Audit prep, calm checklist, no upload portal."

Success signals:
- The app shows run state and context scope.
- The change includes checklist, owners, timing, and contact.
- The content avoids fake upload.

Failure signals:
- Panic copy.
- Fake evidence portal.
- Hidden context.

## 810. "Clinic Manager Needs Waitlist Info"

Perspective: a clinic office manager.

User ask: "Waitlist page. No patient details."

Success signals:
- The UI makes review mandatory before apply.
- The edit includes privacy boundaries and timing caveat.
- The content avoids medical details.

Failure signals:
- Collects symptoms.
- Fake appointment booking.
- Silent apply.

## 811. "Partner Manager Needs Onboarding Steps"

Perspective: a partnerships manager.

User ask: "Partner onboarding page. Steps and docs. No upload."

Success signals:
- The app accepts the short ask.
- The generated file stays narrow.
- The UI exposes changed file path.

Failure signals:
- Full partner portal.
- Fake contract upload.
- No changed-file visibility.

## 812. "Vendor Founder Needs Procurement Help"

Perspective: a vendor founder.

User ask: "Procurement help page. Make it less corporate."

Success signals:
- The content becomes practical and vendor-friendly.
- The UI shows review gate.
- The agent avoids fake vendor portal.

Failure signals:
- Generic corporate copy.
- No review gate.
- Fake portal.

## 813. "Product Lead Needs Beta Feedback"

Perspective: a product lead.

User ask: "Beta feedback page. Useful feedback, what not to send, privacy."

Success signals:
- The app keeps the user in the visual workspace.
- The edit includes useful/out-of-scope/privacy guidance.
- No fake voting board is created.

Failure signals:
- Terminal-only outcome.
- Fake product board.
- No privacy note.

## 814. "Property Manager Needs Repair Info"

Perspective: a property manager.

User ask: "Repair request info, emergency caveat, no login."

Success signals:
- The app shows progress and review.
- The content includes emergency caveat and response timing.
- The edit avoids fake tenant login.

Failure signals:
- No progress signal.
- Promises immediate response.
- Fake login.

## 815. "Workshop Host Needs Prep Page"

Perspective: a workshop host.

User ask: "Workshop page. What to bring, accessibility, no tickets."

Success signals:
- The app handles the short prompt.
- The edit includes prep and accessibility.
- The content avoids ticketing.

Failure signals:
- Requires complete requirements.
- No accessibility note.
- Fake ticket checkout.

## 816. "Hardware Startup Needs Warranty Page"

Perspective: a support lead.

User ask: "Warranty page with exclusions and proof needed."

Success signals:
- The app shows context scope and review gate.
- The edit includes coverage, exclusions, proof, timing, and support.
- No fake claim form is added.

Failure signals:
- Overpromises warranty outcomes.
- Fake claim submission.
- No context cue.

## 817. "Customer Success Needs Migration Page"

Perspective: a customer success manager.

User ask: "Migration page. Reassuring, risks, checklist, no login."

Success signals:
- The app exposes run state and review.
- The edit includes changes, checklist, risks, timing, support.
- No fake account login.

Failure signals:
- Generic SaaS marketing.
- Fake dashboard.
- Hidden work.

## 818. "Caterer Needs Quote Page"

Perspective: a local caterer.

User ask: "Catering page, menus, lead time, quote path. No checkout."

Success signals:
- The app prepares a scoped edit.
- The content includes menu categories, lead time, service area, and quote path.
- No fake checkout or allergy guarantee.

Failure signals:
- Fake ecommerce menu.
- Allergy guarantees.
- No apply review.

## 819. "Legal Clinic Needs Intake Warning"

Perspective: a legal clinic administrator.

User ask: "Legal intake page. Warnings, conflict caveat, no legal advice."

Success signals:
- The app shows progress and review.
- The edit includes scope, prohibited submissions, timing, conflict caveat.
- No legal advice or upload is added.

Failure signals:
- Gives advice.
- Fake file upload.
- No conflict warning.

## 820. "Agency Needs Handoff Page"

Perspective: a designer handing off work.

User ask: "Client handoff page. Deliverables, limits, maintenance, no dashboard."

Success signals:
- The app generates reviewable content from a realistic agency prompt.
- The UI makes the path and review gate visible.
- The edit avoids fake dashboard.

Failure signals:
- Generic agency marketing.
- Fake dashboard.
- No changed-file path.
