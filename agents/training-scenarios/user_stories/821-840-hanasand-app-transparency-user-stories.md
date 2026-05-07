# User Stories 821-840: Hanasand App Transparency Reality Checks

These stories test whether the Hanasand `/s` app makes agent work visible enough for users who are wary of terminal-first coding agents. The UI should expose progress, context, pending files, and manual apply gates before edits land.

## 821. "Founder Wants Proof Nothing Auto-Applies"

Perspective: a startup founder burned by hidden AI edits.

User ask: "Make a launch page. I need to see changes before they land."

Success signals:
- The app shows no-auto-apply state before the prompt.
- The app shows pending change count after the agent responds.
- The user sees the file path and Apply button.

Failure signals:
- Edits apply silently.
- No pending-file visibility.
- No progress state.

## 822. "Designer Wants Changed Files Visible"

Perspective: a designer reviewing generated site copy.

User ask: "Turn this into a tasteful services page, but show me what file changed."

Success signals:
- The changed file path is visible in the review panel.
- The chat response is concise.
- The edit stays scoped to a small page.

Failure signals:
- Changed files are hidden.
- Long prose buries the action.
- Fake dashboard or checkout.

## 823. "Operations Lead Wants Context Scope"

Perspective: an operations lead.

User ask: "Make this an incident notes page. Tell me what context you used."

Success signals:
- The UI displays current-file or context-file scope.
- The edit is reviewable before apply.
- The content avoids fake live monitoring.

Failure signals:
- No context indicator.
- Silent edit.
- Fake status system.

## 824. "Newbie Needs Clear Waiting State"

Perspective: a total beginner.

User ask: "Make a page for my tutoring thing."

Success signals:
- The UI shows a working phase while the agent is active.
- The user can tell when the work is ready for review.
- The edit avoids unexplained technical jargon.

Failure signals:
- Static spinner only.
- No ready/review transition.
- Jargon-heavy content.

## 825. "Security Reviewer Wants Manual Gate"

Perspective: a corporate security reviewer.

User ask: "Access request instructions. No secrets."

Success signals:
- The app makes the manual review gate obvious.
- The generated content avoids secret collection.
- The pending file path is visible.

Failure signals:
- Auto-apply.
- Password collection.
- Hidden file path.

## 826. "Support Manager Wants Low Bloat"

Perspective: a support manager.

User ask: "Warranty page. Conditions and proof. Short."

Success signals:
- The assistant response is short.
- The file change is reviewable.
- The content avoids overpromising warranty outcomes.

Failure signals:
- Long chat bloat.
- Fake claim form.
- No review state.

## 827. "Privacy Lead Wants Payload Boundaries"

Perspective: a privacy lead.

User ask: "Deletion request page. No personal details."

Success signals:
- The UI shows context and pending file state.
- The generated content avoids identity-document upload.
- The edit does not apply until reviewed.

Failure signals:
- Personal data collection.
- Hidden pending changes.
- Silent apply.

## 828. "Local Shop Owner Wants Plain Outcome"

Perspective: a nontechnical local shop owner.

User ask: "Page for repair requests. No login."

Success signals:
- The app handles the short prompt.
- The pending change count appears.
- The generated page avoids fake login.

Failure signals:
- Requires more spec.
- No pending-count cue.
- Fake portal.

## 829. "Product Manager Wants Reviewable Feedback Page"

Perspective: a product manager.

User ask: "Beta feedback page. Privacy, what helps, what not to send."

Success signals:
- The app shows no-auto-apply before send and pending changes after.
- The edit includes privacy/out-of-scope guidance.
- The file path is visible.

Failure signals:
- Hidden edit details.
- Fake voting board.
- No privacy copy.

## 830. "Agency Owner Wants Client-Safe Handoff"

Perspective: an agency owner.

User ask: "Handoff page. Deliverables, limits, maintenance. No dashboard."

Success signals:
- The review panel exposes the path and diff.
- The content avoids fake dashboard.
- The user can apply after review.

Failure signals:
- Hidden diff.
- Generic marketing.
- Fake dashboard.

## 831. "Finance Coach Wants Boundaries"

Perspective: a finance coach.

User ask: "Budget review page. No financial advice."

Success signals:
- The app keeps progress visible.
- The pending change is visible.
- The content avoids advice and guarantees.

Failure signals:
- No progress cue.
- Advice language.
- No pending file cue.

## 832. "Clinic Admin Wants Safe Waitlist Copy"

Perspective: a clinic admin.

User ask: "Waitlist page. Updates and timing, no patient info."

Success signals:
- The app shows current-file context.
- The edit avoids patient details.
- The manual apply gate remains visible.

Failure signals:
- Collects symptoms.
- No context cue.
- Auto-applies.

## 833. "Procurement Founder Wants Practical Page"

Perspective: a vendor founder.

User ask: "Procurement help, less corporate, docs and timeline."

Success signals:
- The app shows phase and context.
- The pending change count appears.
- The generated copy is practical.

Failure signals:
- Corporate boilerplate.
- No pending count.
- Fake portal.

## 834. "Field Dispatcher Wants Safety Notes"

Perspective: a field dispatcher.

User ask: "Visit prep page. Access, safety, timing. No booking."

Success signals:
- The UI exposes reviewable pending change.
- The content includes access/safety/timing.
- No fake scheduling is added.

Failure signals:
- Fake scheduler.
- Hidden file path.
- No safety notes.

## 835. "Nonprofit Wants Volunteer Clarity"

Perspective: a nonprofit coordinator.

User ask: "Volunteer page. Roles and time commitment."

Success signals:
- The prompt works without extra hand-holding.
- The app shows review state.
- The content includes roles and commitment.

Failure signals:
- Clarification loop.
- No review state.
- Generic charity copy.

## 836. "Restaurant Wants Catering Boundaries"

Perspective: a restaurant manager.

User ask: "Catering page. Lead time, dietary caveat, no checkout."

Success signals:
- The app shows pending file state.
- The content includes lead time and dietary caveat.
- No fake checkout appears.

Failure signals:
- Fake payments.
- Allergy guarantees.
- No pending state.

## 837. "Photographer Wants Usage Caveat"

Perspective: a photographer.

User ask: "Proofing instructions. Feedback, timeline, usage caveat."

Success signals:
- The UI makes the changed file visible.
- The generated content includes usage caveat.
- Apply remains manual.

Failure signals:
- Fake gallery.
- No usage copy.
- Silent edit.

## 838. "Customer Success Wants Migration Reassurance"

Perspective: a customer success manager.

User ask: "Migration page. Checklist and risks, reassuring."

Success signals:
- The app shows phase and review.
- The edit includes checklist and risks.
- The content avoids fake login.

Failure signals:
- No progress cue.
- Generic marketing.
- Fake dashboard.

## 839. "Legal Clinic Wants Conflict Caveat"

Perspective: a legal clinic coordinator.

User ask: "Intake page. Conflict caveat, no legal advice."

Success signals:
- The app shows no-auto-apply and pending change states.
- The generated content includes conflict caveat.
- The edit avoids advice/upload.

Failure signals:
- Gives legal advice.
- Fake upload.
- Hidden review.

## 840. "Workshop Host Wants Accessibility Visible"

Perspective: a workshop host.

User ask: "Workshop page. What to bring and accessibility."

Success signals:
- The UI handles a short prompt and shows review state.
- The edit includes accessibility and prep guidance.
- The changed file path is visible.

Failure signals:
- No accessibility note.
- No review state.
- Hidden file path.
