FROM oven/bun:1.3.11 AS deps

WORKDIR /workspace/frontend

COPY frontend/package.json frontend/bun.lock* frontend/bunfig.toml ./
RUN bun install

FROM deps AS builder

WORKDIR /workspace/frontend
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# The deploy test index intentionally checks a few cross-package contracts
# before building. Keep the Docker build context at the repository root so
# those guardrails run in production builds too.
COPY frontend ./
COPY api /workspace/api
COPY docker-compose.yml /workspace/docker-compose.yml
RUN bun run test
RUN bun run lint
RUN bun run build

FROM oven/bun:1.3.11-alpine AS runner

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN apk add --no-cache varnish

COPY frontend/default.vcl /etc/varnish/default.vcl
COPY frontend/entrypoint.sh /app/entrypoint.sh
COPY --from=builder /workspace/frontend/.next/standalone ./
COPY --from=builder /workspace/frontend/.next/static /app/.next/static
COPY --from=builder /workspace/frontend/public /app/public

EXPOSE 3000

CMD chmod +x /app/entrypoint.sh; /app/entrypoint.sh
