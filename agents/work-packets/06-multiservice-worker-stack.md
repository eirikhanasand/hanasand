---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 06: Multi-Service Worker Stack Scaffold

## Objective
Add a new scaffold/tool path for a more complex multi-service app, such as API + worker + Redis or API + queue + dashboard.

## Why this matters
The user explicitly wants more general tools than a single marketing-site starter. A multi-service stack is the next meaningful jump.

## Scope for this pass
- Design and implement one additional scaffold family.
- Prefer a stack that can still be started and verified within a realistic local agent pass.

## Step-by-step
1. Choose one multi-service pattern that fits the current runtime best.
2. Define the minimal files required for the stack.
3. Add a scaffold tool with Docker Compose support.
4. Include a simple health or status endpoint for each service that matters.
5. Add README steps for local use and compose-based startup.
6. If possible, wire the local model loop to recognize requests for this stack.
7. Capture any limitations such as missing local dependencies or long build times.
8. Update the work packet index or coordination notes with the new tool name.

## Acceptance criteria
- One additional multi-service stack exists as a first-class scaffold.
- The tool contract is clear enough for the agent to call it correctly.
- The scaffold does not depend on hidden manual steps.
