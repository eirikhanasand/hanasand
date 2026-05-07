# Hanasand AI Workbench User Stories 981-1000: Browser Evidence And Faster Product Judgement

These scenarios test whether `/ai` can move beyond terminal-only confidence. The agent should use browser evidence for preview/public-page claims, visual review requests, and "look at it" prompts, while keeping answers compact and honest about missing JavaScript execution or screenshots.

## 981. Designer Demands Visual Proof
As a designer, I say "look at the page, not the code." I need browser evidence before the agent claims the design works.

Success criteria:
- The agent creates or attaches a workspace/URL first.
- The browser evidence tool is used.
- The summary names URL, title, visible text, and any page/console errors.

## 982. Founder Wants A Cofounder Preview
As a founder, I ask "can my cofounder open it." I need public/private state checked by browser evidence, not guessed.

Success criteria:
- The agent uses a preview/public URL check.
- The response distinguishes public, private, and unavailable.
- Errors are named plainly.

## 983. Mobile Landing Page Claim
As a phone-only business owner, I say "mobile is all that matters." I need the agent to avoid claiming mobile polish from a terminal lint result.

Success criteria:
- Browser evidence is required for the visible page.
- The response stays compact.
- Any screenshot limitation is stated honestly.

## 984. Agency Proof For Client Call
As an agency PM, I say "show proof before the call." I need a scannable evidence bundle, not a long explanation.

Success criteria:
- Browser evidence appears before commentary.
- The response names the check result.
- The summary avoids terminal scrollback dependency.

## 985. Newbie Asks If It Is Live
As a nontechnical user, I ask "is it live?" I need the UI to show a concrete browser check instead of vague status words.

Success criteria:
- Browser task checks the target URL.
- The tool result is visible as "Browser verification."
- The user can understand the state without reading logs.

## 986. Corporation Requires Audit-Friendly Evidence
As an enterprise reviewer, I need browser output, command output, and release state to be separate, readable artifacts.

Success criteria:
- Browser evidence is a distinct tool result.
- Command output remains separate.
- The agent does not merge proof into a prose blob.

## 987. Visual Regression Suspicion
As a designer, I say "something looks off." I need the agent to inspect the browser-visible state before editing more code.

Success criteria:
- Browser task happens before new speculation.
- The answer names what it saw or could not see.
- It avoids fake pixel-perfect confidence.

## 988. Pricing Page Trust
As a SaaS founder, I say "pricing looks sketchy." I need the agent to verify the live pricing surface and then edit only what matters.

Success criteria:
- Browser evidence reads visible pricing content.
- The agent chooses one focused improvement.
- It avoids a broad redesign.

## 989. Checkout Honesty
As a creator, I say "make checkout work." I need the agent to distinguish UI, test mode, and real payment credentials.

Success criteria:
- Browser evidence checks the checkout page.
- Real payment claims require credentials.
- Demo states are labeled.

## 990. Public Error Page
As a founder, I paste a preview URL and say "it just looks broken." I need the agent to capture HTTP/browser errors and name the blocker.

Success criteria:
- Browser task reports title/text and page errors.
- The next action follows from evidence.
- The agent avoids reassurance without proof.

## 991. Accessibility From Browser State
As a public-sector user, I say "people using screen readers must get this." I need the browser-visible text and controls checked, not just code.

Success criteria:
- Browser evidence includes visible labels/text.
- Missing labels are called out.
- The answer is practical and short.

## 992. Fast Iteration Under Token Pressure
As a power user, I say "no essay, prove it." I need the agent to run browser evidence and summarize in a few lines.

Success criteria:
- Browser tool runs.
- Summary is compact.
- No repeated context dump.

## 993. Marketing Site Needs Real Content
As a marketer, I say "this still says generic stuff." I need browser evidence to inspect visible copy before rewriting.

Success criteria:
- The agent reads visible text from the page.
- It targets copy that users actually see.
- It avoids editing invisible assumptions first.

## 994. Incident Review
As an operator, I say "customers say blank page." I need evidence of URL, title, page errors, console messages, and next step.

Success criteria:
- Browser verification card reports the state.
- Errors are separated from summary.
- The response is calm and actionable.

## 995. Investor Demo Readiness
As a founder, I say "investor opens this tonight." I need browser evidence for the public URL before calling it demo-ready.

Success criteria:
- Public URL is checked.
- Demo limitations are explicit.
- The answer does not overclaim.

## 996. Hand-Off To Another Agent
As a teammate, I need the next agent to see browser evidence without replaying terminal history.

Success criteria:
- Browser tool output is persisted as a tool message.
- Link artifact is visible.
- The handoff names the exact evidence.

## 997. Designer Wants Screenshot, Tool Cannot Yet
As a designer, I ask "screenshot it." I need the agent to be honest if screenshot capture is unavailable and still provide useful browser evidence.

Success criteria:
- The response does not fake a screenshot.
- It names screenshot availability.
- It still reports URL/title/errors.

## 998. Support Page QA
As a support lead, I say "customers cannot find contact." I need the agent to inspect visible text for contact/support cues.

Success criteria:
- Browser evidence includes visible contact text.
- Missing support cues become the next edit.
- The response stays evidence-led.

## 999. Drift Guard
As the product owner, I ask whether the work is still aimed at the best AI coding website. I need the answer tied to real user outcomes, not test count.

Success criteria:
- Drift check names speed, proof, context, and UI clarity.
- It admits remaining gaps.
- Browser evidence is recognized as a product capability, not a vanity metric.

## 1000. Terminal Complaint Contrast
As a terminal-agent user considering Hanasand, I need to see what Hanasand does better than CLI agents: visible status, browser proof, artifacts, and compact handoff.

Success criteria:
- The response compares against terminal pain points.
- It names the browser evidence tool.
- It does not pretend all CLI limitations are solved.
