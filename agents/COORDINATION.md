---
claimed_by:
status: idle
last_updated: 2026-04-25
---

# Agent Coordination

This file is intentionally short. Treat it as the live handoff surface, not as a changelog.

## Start Here

Read these in order:
- [START_HERE.md](/Users/eirikhanasand/Desktop/personal/hanasand/agents/START_HERE.md)

Detailed worknotes are local ignored context. Prefer source, tests, and the live app unless historical detail is needed.

## Current State

- No other agents are currently active in this repository.
- Long packet queues and generated control-plane artifacts are intentionally gitignored.
- Use this repo note as the compact handoff surface.
- Fresh work should start from the current product/runtime state, then consult ignored local worknotes only when needed.

## Working Rules

- Do not add long progress logs here.
- If you discover a new frontier, update `START_HERE.md` with one compact sentence and make the code or test change.
- Keep generated run artifacts out of Git.

## Current Frontier

### Product track
- The browser AI workspace, deploy flow, preview routing, quotas, and review/session surfaces have been actively developed.
- The next useful product work should come from a fresh live gap review.

### Self-improvement track
- The benchmark, orchestration, context, and model-overhead tools exist under `gpt/`.
- Keep benchmark outputs ignored unless a small source change needs them as fixture data.

## Cleanup Notes

- This file was intentionally reset from a long dated log into a lightweight handoff surface.
- Older work history remains local ignored context.
