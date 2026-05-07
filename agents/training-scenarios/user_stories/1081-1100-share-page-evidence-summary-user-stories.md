# Hanasand Share Page User Stories 1081-1100: Evidence Summary Strip

These stories test whether `/s` makes browser proof scannable in the website UI after an ambiguous request. The user should not need terminal scrollback, raw tool logs, or long assistant prose to know what page was checked, whether errors were found, and whether screenshot proof exists.

## 1081. Broken Fast Proof
As a founder, I say "looks broken, show me fast."

Success criteria:
- The browser proof title is visible in the chat status strip.
- The checked URL is visible.
- The response stays compact.

## 1082. Designer Scan Proof
As a designer, I say the top feels off.

Success criteria:
- The evidence title is visible without opening a details card.
- Screenshot state is visible.
- The pending edit remains manual.

## 1083. Newbie Proof Summary
As a newbie, I ask if it is safe to trust.

Success criteria:
- The proof strip shows the URL and issue count.
- Raw tool JSON stays hidden.
- The next step is visible as a pending change.

## 1084. Corporate Issue Count
As a corporate reviewer, I need issue count now.

Success criteria:
- Issue count appears in the status strip.
- Evidence still shows detailed headings below.
- The model does not add extra explanation to compensate for missing UI.

## 1085. Mobile No Logs
As a mobile user, I do not want to read logs.

Success criteria:
- Proof status is visible in the chat panel.
- The URL can be checked at a glance.
- Screenshot availability is visible.

## 1086. Agency Screenshot State
As an agency PM, I need screenshot status visible.

Success criteria:
- The strip says when screenshot proof was captured.
- The browser proof card remains available.
- The edit is not auto-applied.

## 1087. Ops Failed URL
As ops, I ask which page failed.

Success criteria:
- The exact failed URL is visible.
- Issue count appears before the chat transcript details.
- Handoff does not require rereading logs.

## 1088. Investor Compact Proof
As a founder, I need investor-link proof without an essay.

Success criteria:
- Title, URL, screenshot state, and issue count are visible.
- The assistant answer is short.
- Pending changes are reviewable.

## 1089. Accessibility Evidence Status
As an accessibility reviewer, I need evidence status before claims.

Success criteria:
- Viewport and headings remain in the proof card.
- The proof strip exposes the summary.
- No accessibility pass is claimed without browser evidence.

## 1090. Pricing Proof Strip
As a SaaS operator, I worry pricing is wrong.

Success criteria:
- The checked pricing URL is visible.
- Issue count is visible.
- The model avoids fake pricing claims.

## 1091. Support Proof Title
As support, I need the proof title visible.

Success criteria:
- The title appears in the strip.
- The checked URL appears under it.
- The card still shows links and buttons.

## 1092. Founder No Scrollback
As a founder, I hate terminal scrollback.

Success criteria:
- Critical proof state lives in UI.
- No terminal-only artifact is required.
- The assistant response remains terse.

## 1093. Restaurant Browser Saw
As a restaurant owner, I ask what the browser saw.

Success criteria:
- The evidence title and URL are visible.
- Buttons/forms can be inspected in the card.
- No fake booking claim is made.

## 1094. Compliance Errors First
As compliance, I want errors before edits.

Success criteria:
- Issue count is visible before applying.
- Errors remain attached to browser proof.
- The user can decline the edit.

## 1095. Designer Screenshot Proof
As a designer, I ask whether screenshot happened.

Success criteria:
- Screenshot state is visible in the strip.
- Evidence can be opened by URL.
- The model does not bury screenshot state in prose.

## 1096. Beginner Worked Proof
As a beginner, I ask "did it work?"

Success criteria:
- Issue count is scannable.
- Screenshot state is scannable.
- The checked page is visible.

## 1097. Handoff Proof Strip
As a teammate, I continue after another agent.

Success criteria:
- The current proof title is visible.
- The URL is visible.
- The count of saved evidence is visible.

## 1098. Sales Claims Proof
As a founder, I worry the sales page looks scammy.

Success criteria:
- The browser proof summary is visible.
- Claims can be tied to the checked page.
- No hidden context is required.

## 1099. Public Sector Proof
As a public sector buyer, I need a quick audit surface.

Success criteria:
- Proof status is scannable.
- Issue count is explicit.
- Detailed evidence remains structured.

## 1100. Shipping Drift Proof
As product owner, I ask whether we are drifting.

Success criteria:
- The feature improves autonomous website-building confidence.
- It reduces log reading and token bloat.
- The UI makes proof state visible where users work.
