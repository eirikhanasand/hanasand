# Hanasand AI Workbench User Stories 1001-1020: Structured Browser Evidence

These stories test whether `/ai` can judge a website faster by reading page structure, not only prose or terminal output. The browser evidence tool should expose headings, links, buttons, inputs/forms, viewport metadata, errors, and screenshot availability so the agent can reach the right conclusion with fewer tokens.

## 1001. Newbie Cannot Find Contact
As a nontechnical service owner, I say "customers cannot find contact." I need the agent to inspect visible links/buttons/forms and identify whether contact is actually present.

Success criteria:
- Browser evidence includes links/buttons/forms.
- Contact/support cues are named from evidence.
- The next edit is targeted, not a broad redesign.

## 1002. Designer Checks Hierarchy
As a designer, I say "the hierarchy feels flat." I need browser evidence of headings before the agent rewrites layout.

Success criteria:
- Headings are listed.
- The agent uses the heading structure to choose a focused improvement.
- The answer stays compact.

## 1003. Founder Wants Pricing Proof
As a SaaS founder, I say "make sure pricing is obvious." I need the agent to check visible pricing headings/links/buttons first.

Success criteria:
- Pricing evidence is extracted from the page.
- The agent does not assume pricing exists.
- Missing pricing becomes the next edit.

## 1004. Mobile Viewport Sanity
As a mobile-first user, I say "phone users only." I need the browser tool to at least detect viewport metadata before claiming mobile readiness.

Success criteria:
- Viewport meta state is reported.
- Screenshot limitations are honest.
- No mobile claim is made from lint alone.

## 1005. Checkout CTA Audit
As a creator, I say "people need to buy fast." I need the agent to inspect buttons and forms for checkout cues.

Success criteria:
- Buttons/forms are listed.
- Fake payment claims are avoided.
- The next change targets CTA clarity.

## 1006. Public Sector Accessibility First Pass
As a public-sector operator, I say "screen readers matter." I need visible labels/inputs/forms checked from browser evidence.

Success criteria:
- Inputs/forms are listed.
- Missing labels become concrete follow-up work.
- No broad compliance claim is made.

## 1007. Investor Demo Triage
As a founder, I say "investor opens this in an hour." I need title, headings, CTAs, and errors checked before "ready" is claimed.

Success criteria:
- Browser evidence includes title/headings/buttons/errors.
- The summary names the biggest visible risk.
- The agent stays brief.

## 1008. Blank Page Complaint
As support, I say "users see a blank page." I need browser evidence to separate HTTP/page errors from missing visible content.

Success criteria:
- Page errors and text/heading evidence are visible.
- The blocker is named.
- The agent avoids reassurance without proof.

## 1009. Agency Needs Fast Proof Bundle
As an agency PM, I say "client asks what changed." I need browser structure evidence alongside command/release evidence.

Success criteria:
- Browser evidence is a distinct tool message.
- Link artifact exists.
- Handoff is scannable.

## 1010. Marketing Copy Is Generic
As a marketer, I say "copy is generic." I need the agent to read visible headings and CTAs before editing.

Success criteria:
- Visible headings/buttons are used.
- Invisible assumptions are avoided.
- The edit target is specific.

## 1011. Restaurant Booking Flow
As a restaurant owner, I say "can people book." I need forms/buttons inspected for booking cues before the agent says yes.

Success criteria:
- Forms/buttons are checked.
- Booking state is explicit.
- The answer does not overclaim.

## 1012. Enterprise Onboarding Form
As an enterprise admin, I say "vendor onboarding must be clear." I need headings/forms/links checked for onboarding state.

Success criteria:
- Onboarding structure is visible in evidence.
- Missing documents/status/owner gaps become next edits.
- The response is operational, not marketing.

## 1013. Total Newbie Wants Proof
As a newbie, I say "prove it works." I need proof that reads like page facts, not terminal jargon.

Success criteria:
- Browser evidence includes human-readable structure.
- The summary avoids internal implementation details.
- Tool result is visible in the workbench.

## 1014. Designer Requests Screenshot But Tool Is Limited
As a designer, I ask for a screenshot. I need the system to honestly say screenshot is unavailable while still giving structure evidence.

Success criteria:
- Screenshot state is reported.
- Structured evidence is still present.
- No fake screenshot is implied.

## 1015. Pricing CTA Missing
As a SaaS operator, I say "people do not click pricing." I need buttons and links inspected before CTA changes.

Success criteria:
- Pricing links/buttons are extracted.
- The next action is focused.
- The summary is short.

## 1016. Handoff Across Agents
As a teammate, I say "another agent will continue." I need structured browser evidence persisted so the next agent does not reread everything.

Success criteria:
- Evidence is a tool message.
- It includes title/headings/links/buttons.
- It supports compact handoff.

## 1017. Ambiguous "Looks Bad"
As a vague client, I say "looks bad." I need the agent to inspect visible structure and choose one likely improvement.

Success criteria:
- Browser evidence runs before broad advice.
- The next edit is a single focused pass.
- The answer avoids overexplaining.

## 1018. Compliance Page Trust
As a compliance lead, I say "does this show the right docs." I need links/headings inspected for policy/document cues.

Success criteria:
- Links/headings are reported.
- Missing doc cues are identified.
- No fake audit guarantee is made.

## 1019. Drift Check
As product owner, I ask if we are still on the original objective. I need the answer to tie structured browser evidence to faster autonomous project delivery.

Success criteria:
- Drift check mentions speed, proof, context, and UI clarity.
- Remaining gaps are explicit.
- Test count is not treated as the product goal.

## 1020. Terminal-Agent Comparison
As a terminal-agent user, I ask why Hanasand is better. I need a direct contrast: visible browser proof and artifacts versus scrollback, compaction, and session-state ambiguity.

Success criteria:
- Comparison is grounded in browser evidence.
- It acknowledges remaining limitations.
- It avoids claiming terminal agents are obsolete.
