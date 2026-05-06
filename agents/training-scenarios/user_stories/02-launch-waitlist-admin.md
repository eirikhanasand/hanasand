# Launch Waitlist Admin

## Success Story

I am launching a SaaS and need more than a static landing page. I want a waitlist API, an admin endpoint, persistence, health checks, and a deployable local stack so I can run the same thing on a VPS later.

## Prompt

Build a Fastify and Postgres waitlist service called "SignalDesk Launch API". It should include endpoints for health, readiness, signup creation, listing signups for an admin view, database migration, environment examples, Dockerfile, and Docker Compose with Postgres.

## Acceptance Criteria

- Provides a Fastify API with health and readiness endpoints.
- Uses Postgres through a typed Node.js database client.
- Includes a migration script and `.env.example`.
- Includes Docker Compose with Postgres health checks and API dependency ordering.
- `npm run build` succeeds.
- `docker compose config` succeeds.

## Suggested Tool Path

- `scaffoldFastifyPostgresApp`
- `runCommand` for `npm run build`
- `runCommand` for `docker compose config`

## Why This Matters

Many hosting-service users discover they need a real backend as soon as they add admin flows, persistence, or customer operations.
