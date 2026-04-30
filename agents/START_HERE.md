---
last_updated: 2026-04-25
---

# Hanasand Agent Start Here

This is the shortest reliable way to get oriented in this repository.

## What Hanasand Is

Hanasand is now two connected systems:
- a product path: `/ai`, share-backed coding, deploys, previews, quotas, collaboration, and review flows
- a self-improvement path: local model runtime, orchestration, benchmark loops, context packing, and control-plane governance

The important rule is that the self-improvement work is only valuable when it feeds back into the real developer flow.

## Current Repo State

- The detailed packet queue is local workspace context and is intentionally gitignored.
- The durable repo-facing takeaway is that the product and runtime tracks are usable enough for fresh gap review.
- Keep new AI notes compact and outcome-oriented.

## Where To Look First

- Live handoff: [COORDINATION.md](/Users/eirikhanasand/Desktop/personal/hanasand/agents/COORDINATION.md)
- Desktop/app implementation guide: [DESKTOP_APP_DEVELOPMENT.md](/Users/eirikhanasand/Desktop/personal/hanasand/agents/DESKTOP_APP_DEVELOPMENT.md)
- Source code and tests for the surface you are touching.
- Local ignored worknotes only when you need historical detail.

## Stable Mental Model

### Product side
- `/ai` is the main user-facing AI workspace.
- Imported repositories are expected to become real share-backed workspaces.
- Deployments, previews, releases, quotas, and ownership metadata are already part of the documented flow.
- Native app work should be driven by website/API contract discovery, then adapted into the target app's local design system.

### Runtime side
- `gpt/` contains the local model runtime, orchestration logic, benchmark scripts, and self-improvement artifacts.
- The local benchmark and overhead artifacts are now good enough to drive next-step optimization work.

## Recommended Next Steps

1. Review the live product surface before adding more roadmap text.
2. For app parity work, follow `DESKTOP_APP_DEVELOPMENT.md` and implement from website behavior plus API contracts.
3. Prefer one small production fix over another packet note.
4. If a note is needed, make it short enough to ingest in one pass.

## What To Avoid

- Do not recreate duplicate packet numbers inside `work-packets/`.
- Do not use `COORDINATION.md` as a dated diary.
- Do not add new roadmap notes when the real next move is visible in the app.
