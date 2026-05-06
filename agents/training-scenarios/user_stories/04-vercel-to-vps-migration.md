# Vercel To VPS Migration

## Success Story

My Next.js app started on Vercel, but traffic and add-on usage made me nervous about monthly cost. I want the agent to produce a portable deployment that I can run on a VM without rewriting my app.

## Prompt

Convert a Next.js App Router project into a VPS-ready standalone deployment called "Harbor Metrics". Include a production Dockerfile, compose file, environment handling, health-oriented start command, and a concise README that explains how to build, run, and roll back.

## Acceptance Criteria

- Uses Next.js standalone output.
- Includes Dockerfile and Docker Compose.
- Documents required environment variables and deployment commands.
- Avoids provider-specific APIs unless clearly isolated.
- `npm run build` succeeds.
- `docker compose config` succeeds.

## Suggested Tool Path

- `scaffoldNextjsDockerApp`
- `runCommand` for `npm run build`
- `runCommand` for `docker compose config`

## Why This Matters

People can outgrow a hosted frontend platform, but switching providers becomes painful when the app depends on proprietary deployment behavior.
