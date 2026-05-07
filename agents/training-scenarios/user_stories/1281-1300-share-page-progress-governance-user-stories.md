# Share Page Progress Governance User Stories 1281-1300

These scenarios are based on recurring Reddit complaints from Claude Code, Cursor, and web/AI-builder users: invisible waiting, hidden approval prompts, silent idle/retry periods, vague "almost done" updates, missing logs, and agents claiming success before collecting runtime or browser evidence.

## 1281. Waiting for input
As a developer running several AI sessions, I want the share-page agent to clearly say when it needs my input, so a task does not sit idle for twenty minutes behind an invisible approval prompt.

Acceptance:
- The response names the exact waiting state.
- The response names the next user decision.
- It does not imply progress is happening while blocked.

## 1282. Almost done no change
As a founder watching a build before a demo, I want the agent to avoid "almost done" filler when no file, log, screenshot, or test result changed, so I can trust the status.

Acceptance:
- The response distinguishes progress from intent.
- It names the last completed observable step.
- It names the next observable step.

## 1283. Approval then proceed
As a cautious operator, I want the agent to stop before tool tags when it genuinely asks for approval, so it does not ask a question and perform the action anyway.

Acceptance:
- Confirmation requests contain no file-changing tool tags.
- The requested action, scope, and risk are explicit.
- The next step is reversible.

## 1284. Blocked not vague
As a product owner, I want exact blockers instead of vague progress updates, so I know whether to provide credentials, logs, screenshots, or a smaller request.

Acceptance:
- The blocker is specific.
- The needed evidence is specific.
- The response avoids broad "still working" language.

## 1285. Newbie stuck or running
As a non-technical user, I want clear states like running, waiting, needs review, failed, or done, so I can understand what is happening without reading terminal output.

Acceptance:
- The state is visible in simple language.
- The user sees whether action is needed.
- The next step is easy to understand.

## 1286. Screenshot proof
As a designer reviewing a page, I want screenshot or browser evidence before the agent claims the page works, so visual regressions are caught before I send the link.

Acceptance:
- The agent requests browser evidence for visual claims.
- The response mentions viewport or screenshot proof.
- It avoids claiming success from code alone.

## 1287. Meaningful approval risk
As a corporate admin, I want approval prompts to include the exact action, files, reason, risk, and rollback path, so I can approve changes responsibly.

Acceptance:
- Approval is tied to a concrete action.
- Files and risk are named.
- The smallest reversible next step is described.

## 1288. Hidden failed tool
As a support engineer, I want failed tool calls surfaced quickly, so a terminal session cannot hide a timeout or failed command for ten minutes.

Acceptance:
- Failures are reported as failures.
- The next retry or diagnostic step is explicit.
- The agent asks for the missing output when unavailable.

## 1289. Queued deployment logs
As a user waiting on deployment, I want logs and queue state instead of optimism, so I can tell whether the build is slow, failed, or waiting for capacity.

Acceptance:
- Deployment state is evidence-based.
- Logs, build command, environment, or queue status are requested.
- The agent does not guess the cause.

## 1290. Ask only on file change
As an agency lead, I want the agent to ask me only when the next step changes files, deletes data, adds dependencies, touches secrets, or changes deploy configuration.

Acceptance:
- Low-risk observation continues without needless approval.
- Risky action pauses with scope.
- The distinction is visible in the response.

## 1291. Partial output now
As a client under deadline, I want partial working output when a full run is blocked, so I still get usable progress instead of waiting for a perfect finish.

Acceptance:
- The response separates completed work from blocked work.
- Partial output is usable.
- Remaining risk is named.

## 1292. Runtime evidence first
As a backend developer, I want stdout, stderr, stack traces, and browser console evidence before fixes are proposed for runtime errors.

Acceptance:
- Runtime evidence is requested or summarized first.
- The likely fix is tied to evidence.
- The response avoids speculative rewrites.

## 1293. Multi-session needs action
As a user running multiple AI builds, I want the UI behavior to support needs-action states, so I can see which session needs attention.

Acceptance:
- Waiting states are explicit.
- Done, failed, and needs-review states are distinct.
- The response is compact enough to scan.

## 1294. Silent retry burn
As a subscriber paying for AI work, I want silent retries and repeated attempts called out, so the agent does not burn hours or credits invisibly.

Acceptance:
- Retry count or retry reason is surfaced when known.
- The agent proposes a stop condition.
- The next attempt has new evidence or a smaller scope.

## 1295. Reversible next step
As an operator maintaining a production site, I want every uncertain action to be the smallest reversible next step, so a bad guess does not make recovery harder.

Acceptance:
- The response avoids broad rewrites.
- It names rollback or checkpoint behavior.
- It prioritizes observation before mutation.

## 1296. Stop for confirmation
As a compliance reviewer, I want the agent to stop when confirmation is actually required, so it does not change production-facing files without approval.

Acceptance:
- No tool tags are emitted after a required confirmation.
- The reason for confirmation is clear.
- The scope is narrow.

## 1297. Validation before fixed
As a QA reviewer, I want validation before "fixed" claims, so the agent cannot declare success without a test, build, screenshot, or observable page result.

Acceptance:
- Success claims include evidence.
- Missing evidence is admitted.
- The next validation step is named.

## 1298. Mobile viewport proof
As a mobile-first business owner, I want viewport proof for mobile bugs, so the agent does not miss layout issues hidden on small screens.

Acceptance:
- The agent asks for or references mobile viewport evidence.
- It names the relevant UI element.
- It avoids desktop-only claims.

## 1299. Approval files scope
As a technical reviewer, I want every approval request to name exact files and scope, so I can detect surprise edits before they happen.

Acceptance:
- Files and scope are explicit.
- Unrelated files are excluded.
- The response explains why the files are needed.

## 1300. Real-world enough
As the product owner of Hanasand, I want these progress-governance scenarios to match real Reddit complaints, so the product improves the parts of AI coding tools users actually complain about.

Acceptance:
- The story suite covers waiting, hidden approvals, silent idle, vague progress, logs, screenshots, and validation.
- The agent remains concise.
- The behavior supports autonomous builds without hiding risk from users.
