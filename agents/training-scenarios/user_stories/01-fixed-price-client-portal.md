# Fixed Price Client Portal

## Success Story

I run a small freelance studio. Vercel was perfect when I had one marketing site, but now I have several clients, preview links, and a monthly bill that is hard to forecast. I want a polished client portal I can deploy on my own server with Docker, keep costs predictable, and still show clients a professional dashboard.

## Prompt

Build a complete Dockerized Next.js App Router project called "Northstar Studio Portal". It should be a polished client portal for a freelance web studio with project metrics, kanban delivery board, pricing tiers, testimonials, empty states, and a responsive layout. Include production Dockerfile, docker-compose.yml, package scripts, and verification notes.

## Acceptance Criteria

- Uses Next.js App Router with typed React components.
- Includes a dashboard, project board, pricing, testimonials, and mobile-responsive styling.
- Includes `Dockerfile`, `docker-compose.yml`, `.dockerignore`, and a production start command.
- `npm run build` succeeds.
- `docker compose config` succeeds.

## Suggested Tool Path

- `scaffoldNextjsDockerApp`
- `runCommand` for `npm run build`
- `runCommand` for `docker compose config`

## Why This Matters

This captures the user who loves Vercel's speed but needs portable infrastructure and fixed-cost deployment when client volume grows.
