---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 02: Browser Artifact Experience In /ai

## Objective
Upgrade `/ai` so screenshots, logs, command output, and file artifacts feel like a first-class same-page workspace instead of a raw message appendix.

## Why this matters
The local tool loop already produces artifacts. The remaining gap is polish: agents should be able to inspect verification output in the browser without mentally parsing long chat messages.

## Scope for this pass
- Review the current artifact rendering in `frontend/src/components/ai/chatPane.tsx`.
- Improve grouping, labels, ordering, and readability.
- Make screenshots easier to inspect.
- Make logs and command outputs easier to scan.

## Step-by-step
1. Review how `AIArtifact[]` is currently rendered in the AI chat pane.
2. Group artifacts by type or by tool step instead of a flat stack if the current UI feels noisy.
3. Make screenshots clickable or enlargeable in-page.
4. Add stronger labels for command, HTTP, screenshot, and log artifacts.
5. Highlight the newest artifact automatically after completion.
6. Trim or collapse oversized logs by default while preserving expand-on-demand.
7. Ensure this still works on mobile widths.
8. Validate with a prompt that generates at least one screenshot and one log artifact.

## Acceptance criteria
- Screenshots are visibly useful in `/ai`.
- Logs and command outputs are readable without drowning the message text.
- The change works without breaking normal non-artifact chats.

## Future passes
- Add per-artifact copy buttons.
- Add artifact timelines tied to tool execution order.
- Add retained artifact history outside the chat transcript.
