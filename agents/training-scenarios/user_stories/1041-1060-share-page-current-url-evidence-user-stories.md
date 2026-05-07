# Hanasand Share Page User Stories 1041-1060: Current URL Evidence

These stories test whether `/s` uses the actual share or preview URL for browser proof instead of drifting to generic sample pages. The agent should prove the page the user is looking at.

## 1041. Actual Page, Not Sample
As a founder, I say "look at the actual page, not a sample site."

Success criteria:
- Browser evidence uses the current share URL.
- `https://example.com` is not used.
- The proof is visible in the share chat.

## 1042. Broken Preview, Right Link
As support, I say "preview is broken, use the right link."

Success criteria:
- The prompt includes the current share page target.
- The browser tool checks that target.
- The answer does not claim proof from a placeholder.

## 1043. Newbie Click Confusion
As a newbie, I ask where I am supposed to click.

Success criteria:
- Links/buttons are read from the current share.
- The next edit is scoped to the visible page.
- Tool JSON stays hidden.

## 1044. Designer Current Page
As a designer, I say "inspect the page I am on."

Success criteria:
- Browser proof uses the current `/s` route.
- Headings are visible in the UI.
- The response stays compact.

## 1045. Corporate Share Proof
As a corporate reviewer, I need proof from this share.

Success criteria:
- The current share URL appears in browser evidence.
- Pending changes remain manual.
- No generic proof target is accepted.

## 1046. No Hallucinated Preview URL
As an operator, I say "do not hallucinate the preview url."

Success criteria:
- Browser targets are explicitly provided in the prompt.
- The model uses a supplied target.
- Missing runtime preview does not cause a fake subdomain.

## 1047. Exact Share Blank Page
As support, I say users see a blank page on this exact share.

Success criteria:
- Page errors are tied to the current share.
- The agent does not reassure without evidence.
- Screenshot limitation is explicit.

## 1048. Workspace Evidence
As ops, I need evidence attached to this workspace.

Success criteria:
- Browser proof persists in the share chat.
- The target URL matches the workspace.
- The handoff is scannable.

## 1049. Agency Handoff URL
As an agency PM, I need the visible share URL in handoff.

Success criteria:
- The proof card includes the share URL.
- The summary names current-share evidence.
- Pending files are reviewable.

## 1050. Pricing From Our Page
As a SaaS operator, I need pricing proof from our page.

Success criteria:
- Pricing evidence is checked on the current share.
- Placeholder sites are rejected.
- Missing pricing becomes a focused edit.

## 1051. Mobile Complaint On This Share
As a mobile user, I complain about this share only.

Success criteria:
- Viewport proof is tied to the current share.
- The agent avoids lint-only proof.
- The answer names any remaining visual gap.

## 1052. Accessibility On Current Page
As an accessibility reviewer, I need the current page checked.

Success criteria:
- Inputs/forms/headings are read from the current share.
- Missing labels become concrete work.
- No broad compliance guarantee is made.

## 1053. Investor Share Link
As a founder, I am sending the share link today.

Success criteria:
- The current share link is checked.
- Biggest visible risk is named.
- Apply remains manual.

## 1054. Public Users See Here
As compliance, I ask what public users see here.

Success criteria:
- Browser evidence target is the current share page.
- The UI shows proof, not only chat text.
- No private-only assumptions are made.

## 1055. Booking Hidden Here
As a restaurant owner, I say booking is hidden here.

Success criteria:
- Buttons/forms are checked on the current share.
- Fake booking backends are avoided.
- The next edit improves visible cues.

## 1056. Scammy Here
As a founder, I say "it looks scammy here."

Success criteria:
- Claims are inspected on the current share.
- Risky copy is changed in pending files.
- Caveats are kept.

## 1057. Continue From This URL
As a teammate, I need another agent to continue from this URL.

Success criteria:
- Evidence includes the current URL.
- The proof survives as UI state.
- Handoff does not depend on terminal scrollback.

## 1058. Terminal Loses Page Context
As a terminal-agent user, I need the website UI to keep page context.

Success criteria:
- The prompt carries current URL evidence targets.
- The UI displays proof and pending changes.
- The comparison acknowledges terminal context pain.

## 1059. Still Shipping Websites
As product owner, I ask if this is still about shipping websites.

Success criteria:
- Current-share proof is tied to faster delivery.
- Test count is not treated as the product goal.
- Remaining gaps are explicit.

## 1060. Fix What Users See
As a vague client, I say "fix the thing users see."

Success criteria:
- The current visible share is inspected first.
- The edit is focused.
- The answer is short.
