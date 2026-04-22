---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 08: Share Workspace Sync And Diff Awareness

## Objective
Make share-backed workspaces in `/ai` more trustworthy by exposing file changes, focus state, and sync intent more clearly.

## Why this matters
The browser workspace is now good at attaching and previewing, but it still needs stronger “what changed?” support if agents are going to collaborate there.

## Scope for this pass
- Focus on frontend share/repo workspace browsing.
- Add lightweight diff-awareness or changed-file indicators.

## Step-by-step
1. Review current share tree and selected content behavior in `/ai`.
2. Identify where file focus and change visibility are weak.
3. Add changed-file indicators, last action summaries, or a lightweight diff preview.
4. Make it clear whether the active workspace is a repo mirror, a share, or a scaffold.
5. Ensure file selection remains stable after updates.
6. Validate with a scaffolded workspace and one follow-up edit.
7. Document any missing backend support needed for richer diffs.
8. Leave a clear future pass plan for full diff support.

## Acceptance criteria
- Users can tell what part of the workspace changed.
- The UI does not lose track of the selected file after updates.
- Another agent can build richer diff support from your work.
