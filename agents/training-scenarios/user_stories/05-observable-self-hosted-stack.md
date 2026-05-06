# Observable Self Hosted Stack

## Success Story

I like fixed-price self hosting, but I miss the hosted dashboard that tells me whether my app is healthy. I want a service template that gives me health endpoints, clear logs, and enough structure that another agent can wire metrics into the control plane.

## Prompt

Build a deployable service called "PulseRail Ops". It should include health and readiness endpoints, structured JSON responses, Docker Compose, environment examples, and a README section describing which metrics should be scraped for uptime, request health, queue depth, and deploy status.

## Acceptance Criteria

- Includes health and readiness endpoints.
- Uses clear service names in Docker Compose.
- Includes environment examples and operational README notes.
- Separates app status from dependency readiness.
- `npm run build` succeeds.
- `docker compose config` succeeds.

## Suggested Tool Path

- `scaffoldFastifyPostgresApp` or `scaffoldFastifyWorkerRedisApp`
- `runCommand` for `npm run build`
- `runCommand` for `docker compose config`

## Why This Matters

Self-hosted alternatives win on cost, but users still expect the confidence, logs, and health feedback that polished managed platforms provide.
