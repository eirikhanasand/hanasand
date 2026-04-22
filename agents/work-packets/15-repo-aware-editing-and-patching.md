---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 15: Repo-Aware Editing And Patching

## Objective
Make the agent better at reading, editing, and reasoning about repos without requiring brittle full-file rewrites every time.

## Why this matters
A real coding assistant needs stronger repo-aware edit primitives than scaffold-and-rewrite. This is a stepping stone toward tool self-expansion.

## Scope for this pass
- Focus on the local model tool loop’s repo tools.
- Improve one meaningful limitation of current read/list/write behavior.

## Step-by-step
1. Audit `list_files`, `grep_repo`, `read_file`, and `write_file` usage patterns in the tool loop.
2. Identify where the model likely over-writes files instead of making minimal edits.
3. Add a patch-style tool or a safer structured edit helper if feasible.
4. Ensure the tool is easy for the model to call correctly.
5. Add artifacts or result messages that make edits traceable.
6. Validate on a small code edit task.
7. Document when the model should prefer patching versus full rewrites.
8. Note any future improvements needed for multi-file transactions.
9. Create additional work packets for additional work needed before the agent can self improve on its own. You can create 10-30 notes, whatever is necesarry to describe the changes and cover all areas.

## Acceptance criteria
- The agent has a more precise repo-edit option than before, or a clear implementation stub with parsing and result handling exists.
