# Hanasand Share Page User Stories 1141-1160: Proof-Gated Apply

These stories test whether `/s` blocks applying pending AI edits when browser proof failed. A visible `Needs retry` state should prevent a user from accidentally shipping unverified work.

## 1141. Apply Blocked After Proof Fail
As a founder, I say do not let me apply if proof failed.

Success criteria:
- Apply is replaced with retry-proof guidance.
- The blocked state is visible.
- The pending edit remains reviewable.

## 1142. Designer No Unverified Apply
As a designer, I do not want unverified visual changes applied.

Success criteria:
- Browser proof failure blocks apply.
- The retry message is visible.
- The diff remains inspectable.

## 1143. Newbie Apply Guard
As a newbie, I might click apply anyway.

Success criteria:
- The apply button is disabled.
- The button says retry proof first.
- Raw tool JSON is hidden.

## 1144. Corporate Evidence Gate
As a corporate reviewer, I require an evidence gate.

Success criteria:
- Failed proof gates apply.
- Needs retry is visible.
- The edit count remains visible.

## 1145. Ops Release Block
As ops, I want failed checks to block release.

Success criteria:
- The UI prevents apply after failed proof.
- Issue count is visible.
- The checked URL remains visible.

## 1146. Agency Proof Gate
As an agency PM, I must not ship failed proof.

Success criteria:
- Apply is not available.
- Retry proof first is visible.
- The response stays compact.

## 1147. Support Apply Danger
As support, I think the apply button is dangerous here.

Success criteria:
- The dangerous apply action is disabled.
- The reason is visible.
- The pending change remains available for review.

## 1148. Founder Accidental Deploy
As a founder, I want accidental bad deploys prevented.

Success criteria:
- Failed proof blocks apply.
- Needs retry is visible.
- The user can rerun the prompt.

## 1149. Accessibility Apply Block
As an accessibility reviewer, failed proof should block apply.

Success criteria:
- No accessibility fix is applied without proof.
- Issue state remains visible.
- The proof URL remains visible.

## 1150. Pricing Apply Block
As a SaaS operator, failed pricing proof must block apply.

Success criteria:
- Apply is disabled.
- Pricing proof failure is visible.
- The token cap remains visible.

## 1151. Mobile Retry First
As a mobile user, failed mobile proof must require retry first.

Success criteria:
- Retry proof first is visible.
- The apply button is disabled.
- The browser issue is visible.

## 1152. Compliance Hard Gate
As compliance, I need a hard gate before apply.

Success criteria:
- Browser proof failure gates apply.
- Pending changes are not lost.
- The user sees the reason.

## 1153. Investor No Apply
As a founder, investor page proof failed so there should be no apply.

Success criteria:
- Apply is not clickable.
- Needs retry is visible.
- Handoff remains clear.

## 1154. Restaurant Stop Apply
As a restaurant owner, failed booking proof should stop apply.

Success criteria:
- The edit is held.
- Browser proof issue is visible.
- No fake booking success is implied.

## 1155. Terminal Proof Gate
As a terminal-agent user, I miss failed proof in scrollback.

Success criteria:
- The website UI gates apply visibly.
- The failure does not hide in logs.
- The checked URL is visible.

## 1156. Handoff Apply Blocked
As a teammate, I need handoff to show apply is blocked.

Success criteria:
- Retry proof first is visible.
- The pending edit is visible.
- The browser issue is visible.

## 1157. Client Unverified Block
As a client, I do not want unverified work shipped.

Success criteria:
- Apply stays disabled after failed proof.
- The UI explains why.
- The response avoids extra narration.

## 1158. Designer Visual Retry
As a designer, I need retry before visual apply.

Success criteria:
- Visual proof failure blocks apply.
- Retry proof first is visible.
- The diff can still be inspected.

## 1159. Beginner Obvious Retry
As a beginner, I need retry-first to be obvious.

Success criteria:
- The disabled button names the next action.
- The message explains the gate.
- The user can send another prompt.

## 1160. Production Safe Gate
As product owner, I ask whether this is production safe.

Success criteria:
- Failed browser proof blocks apply.
- The website UI prevents false confidence.
- The system remains aligned with trustworthy autonomous website-building.
