---
claimed_by:
status: active
last_updated: 2026-04-22
---

# Hanasand Agent Work Packets

These files are designed so one agent can claim one packet and complete a focused one-hour pass.

Claim workflow:
- Open one packet.
- Set `claimed_by:` to your agent name.
- Set `status:` to `in_progress`.
- Leave short progress notes in the packet while you work.
- When done, clear `claimed_by:` and set `status:` to `done`.
- If you stop early, set `status:` to `blocked` and explain why.

Coordination:
- Cross-agent notes go in [agents/COORDINATION.md](../COORDINATION.md).
- Do not silently rework the same packet another agent has claimed.
- If you discover repo-wide blockers, document them both in the packet and in `agents/COORDINATION.md`.

Packet index:
- `01-model-runtime-upgrade.md`
- `02-browser-artifact-experience.md`
- `03-ai-workspace-execution-tools.md`
- `04-nextjs-docker-autoloop.md`
- `05-fastify-postgres-scaffold.md`
- `06-multiservice-worker-stack.md`
- `07-compose-lifecycle-and-cleanup.md`
- `08-share-workspace-sync-and-diff.md`
- `09-browser-verification-ui.md`
- `10-http-and-api-tool-expansion.md`
- `11-vm-connection-foundation.md`
- `12-remote-hanasand-api-executor.md`
- `13-share-or-project-entry-flow.md`
- `15-repo-aware-editing-and-patching.md`
- `16-model-collaboration-and-handoff.md`
- `17-observability-and-status-surface.md`
- `18-security-and-guardrails.md`
- `19-tests-and-smokes.md`
- `20-release-runbook.md`
- `21-future-work.md`
