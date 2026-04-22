---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 07: Compose Lifecycle And Cleanup

## Objective
Make compose-based execution safer and cleaner so autonomous runs do not leave half-failed containers, orphan networks, or unclear logs behind.

## Why this matters
The user explicitly asked for cleanup of tools and helper terminals. Compose stacks need the same care that managed processes already get.

## Scope for this pass
- Focus on `compose_up`, `compose_logs`, and `compose_down` behavior.
- Capture lifecycle expectations for success, failure, and interruption.

## Step-by-step
1. Review the current compose helper implementation and where it is called.
2. Decide on default cleanup policy for success and failure.
3. Add stronger failure handling around `compose_up`.
4. Ensure logs are collected before teardown on failure.
5. Ensure `compose_down --remove-orphans` runs when a flow ends unless explicitly told otherwise.
6. Record which artifacts should survive teardown.
7. Add a simple smoke test or command sequence to validate lifecycle behavior.
8. Document edge cases like missing Docker, failed builds, or port conflicts.

## Acceptance criteria
- Compose flows leave a clean local environment by default.
- Logs are not lost on failure.
- The agent behavior is predictable enough for repeated runs.
