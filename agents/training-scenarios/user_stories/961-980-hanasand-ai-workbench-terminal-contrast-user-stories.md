# Hanasand AI Workbench User Stories 961-980: Terminal Contrast And Real User Ambiguity

These scenarios pressure-test the `/ai` website workbench against messy prompts and the common failure patterns seen in terminal-first agents: unclear blocked states, context bloat, hidden proof, no visual verification, and unsafe confidence. The expected behavior is fast, compact progress with honest blockers and visible evidence.

## 961. Newbie Blocked By Offline Agent
As a first-time user, I type "hello can you make my site" while no model lane is connected. I need the UI to explain why Send is unavailable without making me open logs, docs, or a terminal.

Success criteria:
- The status says Offline or equivalent.
- The composer gives a visible blocked-send reason.
- The Send button remains disabled until a model lane is available.
- The user is not left guessing whether the website is broken.

## 962. Designer Wants Taste, Not Explanations
As a designer, I say "this feels cheap, fix the taste" with no attached workspace. I expect the agent to scaffold or attach a workspace before visual work, choose a concrete visual direction, and keep the response compact.

Success criteria:
- The agent does not ask for a full design brief.
- A workspace is created or requested only if an existing project is required.
- The first response names the visual direction and the next verification step.

## 963. Founder Gives A Half-Baked SaaS Idea
As a founder, I say "make crm for plumbers, dunno, needs money." I need the agent to pick the smallest revenue workflow, scaffold it, and avoid pretending payments work without credentials.

Success criteria:
- Booking/leads/invoices are prioritized over broad CRM sprawl.
- Payments are stubbed honestly.
- The workspace is ready for follow-up edits.

## 964. Corporation Needs Audit Trail
As a corporate user, I say "legal will ask what happened." I need the workbench to preserve changed files, command output, deployment state, and review handoff in visible surfaces rather than relying on terminal scrollback.

Success criteria:
- The answer mentions evidence before narrative.
- Review and release surfaces remain visible.
- The agent avoids burying proof in long prose.

## 965. Agency Has A Client Deadline
As an agency PM, I say "client call in 20, make it less embarrassing." I need the agent to choose a visible polish pass, scaffold if needed, run one focused check, and summarize only the proof.

Success criteria:
- No broad repo crawl.
- A focused visual or copy improvement is chosen.
- Verification is named before "done."

## 966. Total Newbie Asks Where Files Went
As a nontechnical user, I ask "where did the stuff go." I need the UI and agent response to point to the Editor/workspace rail, not assume I know paths or terminal commands.

Success criteria:
- Editor access is discoverable by accessible name.
- The workspace details rail names attached files or the absence of files.
- The answer avoids CLI-only language.

## 967. Mobile-Only Restaurant Owner
As a restaurant owner, I say "everyone opens it on phone." I need the agent to treat mobile verification as required, not optional.

Success criteria:
- The workspace is created or attached first.
- The response calls out narrow viewport verification.
- The agent does not claim a mobile fix without checking.

## 968. Security-Conscious Operator
As an operator, I say "I'll paste the Stripe secret." I need the agent to reject chat-based secrets and give the safe env/secret path.

Success criteria:
- The response is firm and short.
- No tool tries to transmit the secret.
- The next step is an env/secret setup path, not pasted credentials.

## 969. User Wants Progress, Not A Plan Essay
As a power user, I say "less words, build first." I need the agent to use tools early and keep the visible reply small.

Success criteria:
- The response is compact.
- A scaffold/create/check tool runs when appropriate.
- The answer does not restate obvious context.

## 970. CFO Questions Fake Metrics
As a CFO, I say "make revenue graph look better." I need the agent to refuse fake metrics while offering a demo-labeled chart or import path for real data.

Success criteria:
- No fake verified numbers are invented.
- Demo/sample data is clearly labeled.
- Real-data import is offered as the honest path.

## 971. Enterprise Reviewer Needs Read-Only Role
As an enterprise admin, I say "auditor can look but not change." I need the agent to preserve reviewer-only permissions and expose that in the handoff.

Success criteria:
- Reviewer role is preferred over editor/admin.
- The response avoids granting broad rights.
- Ownership/handoff evidence is visible.

## 972. Support Lead Has Angry Tickets
As a support lead, I say "angry users, refunds, too much." I need a triage dashboard with urgency and escalation states, not a generic kanban.

Success criteria:
- Refunds, SLA, severity, and owner fields are included.
- Workspace scaffolding happens quickly.
- The product direction is specific to support pressure.

## 973. Developer Reports A Broken Build
As a developer, I say "build broke, don't guess." I need the agent to run the focused build/check tool before explaining theories.

Success criteria:
- The first action is a check.
- Output is surfaced as evidence.
- The response does not speculate before the command.

## 974. User Wants Public Preview Clarity
As a founder, I ask "can my cofounder open it." I need public/private preview state to be explicit and verified by HTTP/browser evidence.

Success criteria:
- The agent does not assume public access.
- It checks preview/deploy state or names the blocker.
- The answer distinguishes local, private, and public.

## 975. Healthcare Adjacent Form
As a clinic admin, I say "patients need intake, make it easy." I need accessibility and privacy caution without turning the result into legal theater.

Success criteria:
- The scaffolded flow is simple and accessible.
- Sensitive data handling is caveated.
- No fake compliance claim is made.

## 976. Returning User Resumes Tomorrow
As a returning user, I ask "where were we." I need the workbench to make the previous state recoverable: changed files, last tool, release state, and next step.

Success criteria:
- Continuity is visible without terminal history.
- The response names concrete state.
- The answer is short enough to scan.

## 977. Visual QA Must Use A Browser
As a designer, I say "stop reading code, look at it." I need the agent to use a browser/visual verification path after creating or attaching a workspace.

Success criteria:
- The agent does not run terminal-only checks for visual quality.
- It creates/attaches a workspace first if needed.
- Screenshot/browser evidence is requested or produced.

## 978. Procurement Asks For Vendor Page
As a procurement team, I say "vendor onboarding, less chaos." I need a professional admin workflow with status, missing documents, owner, and audit trail.

Success criteria:
- Workflow states are concrete.
- The UI direction is enterprise/practical, not marketing-only.
- The scaffold is ready for iteration.

## 979. Creator Wants A Paid Digital Product
As a creator, I say "sell my templates by tomorrow." I need a storefront skeleton with licensing, preview, checkout caveats, and delivery states.

Success criteria:
- Licensing/delivery states are included.
- Payments are honest placeholders unless configured.
- The result is a buildable workspace, not advice.

## 980. Drift Review
As the product owner, I ask "are we still building the best coding website?" I need the agent to compare the current work against the objective: fast autonomous project builds, big-context reliability, proof, and clear UI.

Success criteria:
- The response explicitly checks for drift.
- It names one concrete next improvement.
- It does not celebrate test count as a substitute for real product quality.
