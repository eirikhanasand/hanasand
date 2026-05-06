# Background Jobs And Queue

## Success Story

My app sends emails, imports CSV files, and calls third-party APIs. I do not want long user requests to time out, and I do not want the agent to pretend a serverless route is enough. I need a queue worker I can deploy beside my app.

## Prompt

Build a Fastify and Redis worker stack called "TaskForge Queue". It should expose an API to enqueue jobs, include a worker process that consumes jobs, provide health checks, and ship with Docker Compose for API, worker, and Redis.

## Acceptance Criteria

- Includes separate API and worker entrypoints.
- Uses Redis as the queue or job coordination layer.
- Includes Docker Compose with Redis and both application services.
- Includes health or readiness endpoints.
- `npm run build` succeeds.
- `docker compose config` succeeds.

## Suggested Tool Path

- `scaffoldFastifyWorkerRedisApp`
- `runCommand` for `npm run build`
- `runCommand` for `docker compose config`

## Why This Matters

This is the practical gap between "host a frontend" and "run a business app" with imports, notifications, retries, and background processing.
