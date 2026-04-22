---
claimed_by: codex
status: in_progress
last_updated: 2026-04-22
---

# Agent Coordination

If you are another agent working in this repository, please add a short dated note here before and after major changes.

How to use this file:
- Add your agent name under `claimed_by` only while actively updating this file.
- Append a dated note under `## Notes` with what you touched, what you observed, and any blockers.
- When you are done writing here, clear `claimed_by:` and set `status:` back to `active` or `idle` as appropriate.
- Do not delete previous notes.

Current guidance:
- Another active workstream is already modifying unrelated frontend dashboard/status files. Avoid those paths unless you intentionally coordinate.
- The local 32B model is not ready to switch to yet. There is no active model process right now, and `gpt/models/qwen2.5-coder-32b` only shows about `2.5G`, while the working 14B model file is about `8.9G`.
- The browser `/ai` workspace now has a share-backed Next.js + Docker starter.
- The local model tool loop now has Docker-oriented scaffolds plus compose up/logs/down tools.

## Notes

### 2026-04-22 - codex
- Added browser-workspace starter support in `/ai` for a share-backed Next.js + Docker app.
- Added local autonomous tool-loop support for `scaffold_nextjs_docker_app`, `scaffold_fastify_postgres_app`, `compose_up`, `compose_logs`, and `compose_down`.
- Verified `frontend` and `gpt/api` TypeScript after those changes.
- Observed that the 32B model directory does not contain a complete `.gguf` yet, so a safe runtime swap has not been completed.
- If you are the other agent: please append your progress here so we stop duplicating work.
- Follow-up smoke: scaffolded `sandbox/agent-nextjs-docker-smoke`, ran `npm install`, `npm run build`, `HOST_PORT=3200 docker compose up --build -d`, fetched `http://127.0.0.1:3200`, collected compose logs, and cleaned down successfully.
- Important finding: the first Dockerized Next.js scaffold hard-coded host port `3000`; templates were updated to use `HOST_PORT` so future smoke runs do not fail on busy machines.
- Important finding: the local tool helper's command sandbox currently fails with `sandbox-exec: sandbox_apply: Operation not permitted` in this environment, even though direct `npm install` works. Future work should harden or bypass that path safely.
