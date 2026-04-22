FROM oven/bun:1.3.11-alpine AS deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

FROM deps AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

COPY . .
RUN bun run build

FROM oven/bun:1.3.11-alpine AS runner

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN apk add --no-cache varnish

COPY default.vcl /etc/varnish/default.vcl
COPY entrypoint.sh /app/entrypoint.sh
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static /app/.next/static
COPY --from=builder /app/public /app/public

EXPOSE 3000

CMD chmod +x /app/entrypoint.sh; /app/entrypoint.sh
