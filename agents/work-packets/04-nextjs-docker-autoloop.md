---
claimed_by:
status: unclaimed
last_updated: 2026-04-22
---

# Packet 04: Autonomous Next.js Docker Build Loop

## Objective
Turn the Dockerized Next.js path into a dependable autonomous loop: scaffold, install, compose up, verify, inspect, and clean down.

## Why this matters
The agent can now scaffold a Next.js Docker app. The next step is to make that flow self-driving and reliable under the local tool loop.

## Scope for this pass
- Work mainly in `gpt/api/src/utils/tools/modelToolLoop.ts` and the Next.js Docker scaffold.
- Use real outputs and artifacts from compose and verification steps.

## Step-by-step
1. Read the current `scaffold_nextjs_docker_app` and compose tool behavior.
2. Prompt the local model with a Dockerized Next.js build request and observe the actual tool sequence.
3. Identify where the loop stalls, repeats, or explains too early.
4. Tighten the loop so it prefers compose up, HTTP verification, artifact collection, and cleanup.
5. Ensure the loop records logs if compose fails.
6. Ensure success includes enough artifact context to trust the result.
7. If needed, add a browser verification step against the started app.
8. Document the final stable flow in `agents/COORDINATION.md`.

## Acceptance criteria
- A Dockerized Next.js request can be completed autonomously with compose up and verification.
- Failures produce useful logs.
- Cleanup happens at the end of the run.

## Future passes
- Add branch-aware target directories.
- Add optional “keep running” behavior when explicitly requested.
