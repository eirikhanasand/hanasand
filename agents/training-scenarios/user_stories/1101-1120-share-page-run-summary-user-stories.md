# Hanasand Share Page User Stories 1101-1120: Last Run Receipt

These stories test whether `/s` shows a compact run receipt after an AI action. Users should see whether the agent completed, how long it took, how many edits are pending, whether browser proof ran, and that the response stayed inside a bounded token budget.

## 1101. Fast Run Proof
As a founder, I ask whether it actually did anything fast.

Success criteria:
- Last run is visible after completion.
- Duration is visible.
- The edit count is visible.

## 1102. Designer Speed Proof
As a designer, I want speed, not a wall of text.

Success criteria:
- The run receipt replaces extra narration.
- Browser proof count is visible.
- Pending changes remain manual.

## 1103. Newbie Run Summary
As a newbie, I ask what happened just now.

Success criteria:
- Completion state is visible.
- The checked URL remains visible.
- Raw tool JSON is hidden.

## 1104. Corporate Token Cap
As a corporate reviewer, I need bounded output.

Success criteria:
- The 2.2k response cap is visible.
- The response stays compact.
- The UI shows the run result.

## 1105. Ops Tool Count
As ops, I need tool count without logs.

Success criteria:
- Browser proof count appears in the UI.
- Duration appears in the UI.
- No terminal transcript is required.

## 1106. Agency Progress Proof
As an agency PM, I need quick proof of progress.

Success criteria:
- Last run is visible.
- One pending edit is visible.
- Browser proof is visible.

## 1107. Support Browser Count
As support, I ask whether browser evidence ran.

Success criteria:
- Browser proof count is visible.
- Proof card still names the checked page.
- The URL remains visible.

## 1108. Founder No Ramble
As a founder, I ask whether it just rambled.

Success criteria:
- Run receipt shows concrete progress.
- Tool tags are hidden.
- The assistant response stays terse.

## 1109. Accessibility Compact Run
As an accessibility reviewer, I need concise evidence.

Success criteria:
- Run summary shows completion.
- Browser evidence remains structured.
- No broad claim is made without proof.

## 1110. Pricing Budget Visible
As a SaaS operator, I need token budget visible during pricing checks.

Success criteria:
- The 2.2k cap is visible.
- The checked pricing URL is visible.
- The edit remains reviewable.

## 1111. Mobile Run Result
As a mobile user, I need the run result quickly.

Success criteria:
- The run receipt fits in the chat panel.
- Browser proof count is visible.
- Duration is visible.

## 1112. Compliance Retry State
As compliance, I need failed runs to show retry state.

Success criteria:
- Completed or needs-retry state is explicit.
- Errors do not look successful.
- Bounded output remains visible.

## 1113. Investor Duration
As a founder, I need to know how long investor-link proof took.

Success criteria:
- Duration is visible.
- Browser proof is visible.
- The response avoids an essay.

## 1114. Restaurant Progress
As a restaurant owner, I just need progress shown.

Success criteria:
- Last run status is visible.
- Pending edit count is visible.
- Browser proof count is visible.

## 1115. Terminal Duration Visible
As a terminal-agent user, I dislike hidden duration.

Success criteria:
- Duration is shown in the website UI.
- The user does not need scrollback.
- The run state persists after completion.

## 1116. Handoff Run Receipt
As a teammate, I need a run receipt for handoff.

Success criteria:
- Completion status is visible.
- Edit and browser proof counts are visible.
- The checked URL remains visible.

## 1117. Client Edit Count
As a client, I ask how many edits are pending.

Success criteria:
- The run receipt shows edit count.
- The review panel shows the same pending count.
- No auto-apply happens.

## 1118. Designer Less Narration
As a designer, I ask for less narration.

Success criteria:
- UI state carries run facts.
- The assistant can answer compactly.
- Browser evidence remains discoverable.

## 1119. Beginner Completed State
As a beginner, I ask whether it finished.

Success criteria:
- Completed state is visible.
- Needs-retry state is distinct.
- The next action is obvious.

## 1120. Real User Run Proof
As product owner, I ask if this still optimizes for real users.

Success criteria:
- The feature reduces hidden terminal state.
- It surfaces speed and boundedness.
- It supports autonomous website-building work.
