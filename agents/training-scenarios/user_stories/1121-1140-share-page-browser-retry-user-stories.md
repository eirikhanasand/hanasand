# Hanasand Share Page User Stories 1121-1140: Browser Retry Honesty

These stories test whether `/s` is honest when the AI response succeeds but browser evidence fails. The run receipt must not show a green completed state when proof timed out or errored.

## 1121. Browser Failed Honestly
As a founder, I say browser proof failed but do not lie.

Success criteria:
- Last run shows needs retry.
- Completed is not visible for the failed proof.
- The pending edit remains reviewable.

## 1122. Designer Proof Retry
As a designer, I need to know proof did not complete.

Success criteria:
- Browser proof count remains visible.
- Issue count is visible.
- Screenshot state is not implied as successful.

## 1123. Newbie Check Failed
As a newbie, I ask whether the check worked.

Success criteria:
- Needs retry is visible.
- The checked URL is visible.
- Raw tool JSON stays hidden.

## 1124. Corporate Failed Proof
As a corporate reviewer, I need failed proof visible.

Success criteria:
- The run receipt marks retry.
- Browser evidence card shows an issue.
- The response stays compact.

## 1125. Ops Retry State
As ops, I want retry state when browser flakes.

Success criteria:
- Failure is visible without terminal logs.
- One browser proof attempt is counted.
- The user can rerun the request.

## 1126. Agency No False Complete
As an agency PM, I do not want a false completed state.

Success criteria:
- Completed is absent.
- Needs retry is visible.
- The edit is not auto-applied.

## 1127. Support Browser Timeout
As support, I ask whether the browser tool timed out.

Success criteria:
- Page issues show one failure.
- The proof title makes failure state clear.
- Handoff remains scannable.

## 1128. Founder Honest Failure
As a founder, I say stop pretending it worked.

Success criteria:
- The UI does not claim proof succeeded.
- The browser proof URL remains visible.
- The retry state is explicit.

## 1129. Accessibility No Claim
As an accessibility reviewer, I reject claims without proof.

Success criteria:
- Needs retry blocks false confidence.
- Browser evidence issue count is visible.
- No accessibility success is implied.

## 1130. Pricing Retry Visible
As a SaaS operator, I need pricing proof failure visible.

Success criteria:
- The pricing check URL is visible.
- Needs retry is visible.
- The edit remains pending.

## 1131. Mobile Proof Retry
As a mobile user, I say proof did not load.

Success criteria:
- Browser proof count is visible.
- Needs retry is visible.
- The run receipt fits the chat panel.

## 1132. Compliance Failure Visible
As compliance, I need failure visible before apply.

Success criteria:
- The run receipt marks retry.
- The pending change can be rejected.
- The browser issue is visible.

## 1133. Investor Check Error
As a founder, I need investor page check errors called out.

Success criteria:
- The URL remains visible.
- Needs retry appears before any apply action.
- The assistant answer is brief.

## 1134. Restaurant Proof Failed
As a restaurant owner, I need failed booking proof marked.

Success criteria:
- The browser proof failure is visible.
- No fake booking success is claimed.
- The edit is still manual.

## 1135. Terminal Failure Visible
As a terminal-agent user, I dislike hidden failed checks.

Success criteria:
- Failure state appears in the website UI.
- The user does not need scrollback.
- The proof card shows the issue count.

## 1136. Handoff Retry Needed
As a teammate, I need to see retry needed.

Success criteria:
- Needs retry is visible.
- The failed URL is visible.
- The next agent can continue without guessing.

## 1137. Client Proof Unreliable
As a client, I ask whether proof is reliable.

Success criteria:
- Failed browser evidence is not treated as reliable.
- The issue count is visible.
- The token cap remains visible.

## 1138. Designer No Green Check
As a designer, I say no green check if proof failed.

Success criteria:
- Completed is not shown.
- Needs retry is shown.
- The pending edit stays reviewable.

## 1139. Beginner Retry Next
As a beginner, I need to know what to do next after failure.

Success criteria:
- Needs retry is readable.
- The proof issue is visible.
- The user can send again.

## 1140. Production Honesty
As product owner, I ask whether the system is honest enough for production.

Success criteria:
- The run receipt reflects browser proof failure.
- The UI avoids hidden terminal state.
- The product remains aligned with trustworthy autonomous website-building.
