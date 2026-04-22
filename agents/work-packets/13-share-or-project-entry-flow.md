---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 13: Share Or Project Entry Flow

## Objective
Design and implement the first Hanasand UX step where users choose between a share and a project-oriented workspace flow.

## Why this matters
The user described a future where `hanasand.com/s` can branch into “make a share” or “create a project.” This packet should move that from concept toward product.

## Scope for this pass
- Focus on the user journey, not full VM execution.
- Implement a thin but real entry point if possible.

## Step-by-step
1. Audit the current share entry flow and route structure.
2. Identify the least disruptive insertion point for a “share vs project” chooser.
3. Design the states and copy for that chooser.
4. Implement the UI shell if feasible.
5. Wire the project option to a placeholder or early project creation path that matches today’s real backend capabilities.
6. Keep the share option fast and unchanged for existing users.
7. Validate navigation and state preservation.
8. Document what a later VM-integrated project flow should do next.

## Acceptance criteria
- A real branching point exists or the exact implementation plan is encoded in code comments plus UI shell.
- The current share flow is not broken.
