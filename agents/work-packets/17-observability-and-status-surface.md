---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 17: Observability And Status Surface

## Objective
Expose clearer runtime status for model workers, tool executions, and workspace actions in Hanasand.

## Why this matters
When things fail, agents and users need to know whether the issue is the model, the tool loop, Docker, HTTP readiness, or UI state.

## Scope for this pass
- Improve status signals rather than building whole new systems.
- Prioritize the surfaces most helpful to active AI work.

## Step-by-step
1. Audit current status surfaces in `/ai`, `/status`, and relevant dashboard paths.
2. Identify the top missing status facts for AI work, such as active model, last tool run, last artifact, or last failure.
3. Add one or two targeted status displays that are cheap and high-value.
4. Keep terminology consistent across frontend and backend.
5. Ensure status messages help debugging rather than adding noise.
6. Validate with one healthy flow and one failing flow.
7. Document any backend data still needed for richer observability.
8. Add a short note to coordination with what changed.

## Acceptance criteria
- The system is easier to debug from the UI.
- At least one important blind spot in AI runtime status has been removed.
