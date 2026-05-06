# User Story Training Scenarios

These scenarios model what people commonly want from Vercel-like hosting and app builders: fast project launch, predictable cost, portable Docker output, observability, backend services, and fewer surprises when an app grows.

The scenarios are written from the user's perspective so the model is trained and evaluated against outcomes, not tool trivia. A successful run should leave behind a working project that can be built, inspected, and moved to another host without hidden platform assumptions.

## Research Signals

- Vercel's documented limits make build duration, concurrent builds, runtime logs, files, cron jobs, and WebSocket support real constraints for production users.
- Community reports repeatedly mention pricing uncertainty and surprise overages as a reason to want fixed-price VPS or self-hosted deployment paths.
- Next.js users who move away from Vercel often ask for Docker Compose, Postgres, Redis, workers, reverse proxy readiness, and simple rollbacks.
- Self-hosted alternatives are attractive on paper, but users miss Vercel's interface, observability, easy domains, SSL, and deployment feedback.

## What Success Looks Like

- The agent chooses high-leverage tools instead of reading context for minutes.
- Generated apps are complete enough to be useful to a real business user, not placeholders.
- Every scenario produces source code plus deployment assets such as Dockerfile, compose file, environment example, and health checks where appropriate.
- The agent verifies its own work with build and compose commands before handing back the result.

## Automation

Run the smoke test from `gpt/api`:

```sh
API=https://api.hanasand.com/api bun scripts/user-story-tool-smoke.ts
```

The script creates fresh projects under `sandbox/user-story-tool-smoke`, runs the relevant scaffold tools, and writes a JSON report to `gpt/api/runtime/user-story-tool-smoke`.
