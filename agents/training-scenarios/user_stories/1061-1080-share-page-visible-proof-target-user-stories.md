# Hanasand Share Page User Stories 1061-1080: Visible Proof Target

These stories test whether `/s` shows the browser proof target in the website UI before the user sends an ambiguous request. The agent should not hide critical state inside prompts, logs, or terminal output.

## 1061. What Page Are You Checking
As a founder, I ask "what page are you checking."

Success criteria:
- The current share target is visible before sending.
- The browser proof uses the same target.
- No sample URL is used.

## 1062. Designer Exact Inspected Page
As a designer, I need to know the exact inspected page.

Success criteria:
- The proof target URL is visible in chat.
- The response stays compact.
- Evidence is shown after the check.

## 1063. Newbie Link Before Send
As a newbie, I need the link shown before I trust the agent.

Success criteria:
- The proof URL appears before submit.
- The send button remains disabled until input.
- Tool tags stay hidden.

## 1064. Corporate Source Of Proof
As a corporate reviewer, I need the proof source.

Success criteria:
- The UI labels the target.
- Pending changes remain manual.
- The evidence card matches the visible target.

## 1065. Ops Hidden Logs Concern
As ops, I say "do not hide the target in logs."

Success criteria:
- The target is shown as UI state.
- The proof summary names the same URL.
- No terminal-only state is required.

## 1066. Agency Visible URL
As an agency PM, I need the page URL in the UI.

Success criteria:
- The visible URL can be checked before the run.
- The agent uses that URL.
- Handoff is scannable.

## 1067. Support Wrong Share Guard
As support, I want to avoid checking the wrong share.

Success criteria:
- Current share target is visible.
- Browser evidence checks that target.
- Wrong-target checks fail tests.

## 1068. Founder Hallucinated Checks
As a founder, I worry about fake browser checks.

Success criteria:
- The proof target is explicit.
- Browser proof card appears after checking.
- Screenshot limitations are honest.

## 1069. Accessibility Target Before Proof
As an accessibility reviewer, I need target context first.

Success criteria:
- Target is visible before evidence.
- Inputs/headings are tied to the target.
- No broad compliance claim is made.

## 1070. Pricing Page Source
As a SaaS operator, I need pricing proof to show which page was read.

Success criteria:
- Target is visible.
- Pricing evidence uses that target.
- Missing pricing becomes focused work.

## 1071. Mobile Bug This Share
As a mobile user, I say the bug is only on this share.

Success criteria:
- Current share URL is visible.
- Viewport proof uses that URL.
- Lint-only proof is not enough.

## 1072. Compliance Evidence Source
As compliance, I need the evidence source visible.

Success criteria:
- The UI shows the target.
- The proof is persisted in chat.
- No hidden context is required.

## 1073. Investor Handoff Source
As a founder, I need the page source visible in investor handoff.

Success criteria:
- Target is visible before check.
- The biggest visible risk can be tied to a URL.
- Pending edits are reviewable.

## 1074. Restaurant Inspected Page
As a restaurant owner, I ask what page was inspected.

Success criteria:
- The current target answers that before the model speaks.
- Booking proof uses that target.
- Fake booking backends are avoided.

## 1075. Terminal State Hidden
As a terminal-agent user, I dislike hidden session state.

Success criteria:
- Page target is visible in the website UI.
- Proof card and pending changes are visible.
- The contrast with terminal scrollback is clear.

## 1076. Another Agent Should Not Guess
As a teammate, I need the next agent not to guess the URL.

Success criteria:
- The URL is visible.
- The URL is also present in model context.
- Handoff does not require rereading logs.

## 1077. Exact Thing Users See
As a client, I say "prove the exact thing users see."

Success criteria:
- Target is current share.
- Browser evidence uses current share.
- The edit is focused.

## 1078. No Hidden Context
As a designer, I say "no hidden context please."

Success criteria:
- Target state is visible.
- Browser proof is visible.
- The response avoids bloat.

## 1079. Beginner Trust
As a beginner, I ask why the proof is trustworthy.

Success criteria:
- The source URL is visible.
- The proof result names the same URL.
- The UI avoids raw JSON.

## 1080. Token Bloat Check
As product owner, I ask if this reduces token bloat.

Success criteria:
- The target is visible without extra explanation.
- The model receives the right URL directly.
- The answer ties this to faster progress.
