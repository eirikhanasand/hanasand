FROM grafana/k6:latest AS k6builder

FROM oven/bun:1.3.13-alpine AS deps

COPY .git/HEAD /tmp/hanasand-source-head
RUN test "$(cat /tmp/hanasand-source-head)" = "ref: refs/heads/main" || { echo "Production image builds are allowed only from the main branch." >&2; exit 1; }

WORKDIR /app

COPY api/package.json api/bun.lock* api/bunfig.toml ./
RUN bun install

FROM deps AS session-geo
COPY api/scripts/download-session-geo.ts scripts/download-session-geo.ts
ARG SESSION_GEOIP_MONTH
RUN SESSION_GEOIP_MONTH=$SESSION_GEOIP_MONTH bun scripts/download-session-geo.ts

FROM deps AS auth-runtime-base
ARG HANASAND_RELEASE_COMMIT=unknown
LABEL org.opencontainers.image.revision=$HANASAND_RELEASE_COMMIT
COPY --chown=bun:bun api/ .
COPY --from=session-geo /app/geoip /app/geoip
RUN bun scripts/check-session-network.ts

FROM auth-runtime-base AS auth-review
RUN DB_PASSWORD=build-test DB_HOST=localhost VM_API_TOKEN=build-test bun run test --only=auth-service,auth-boundary,social-oidc,social-auth
RUN bun run lint

FROM auth-runtime-base AS auth-runtime
ENV NODE_ENV=production AUTH_SERVICE_ONLY=1
USER bun
CMD ["bun", "src/authServer.ts"]

FROM oven/bun:1.3.13-alpine AS app-runtime-base

ARG HANASAND_RELEASE_COMMIT=unknown
ARG TRIVY_VERSION=0.72.0
LABEL org.opencontainers.image.revision=$HANASAND_RELEASE_COMMIT
RUN apk add --no-cache varnish git openssh-client docker-cli curl tar postgresql-client \
    && curl -fsSL "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz" \
        | tar -xz -C /usr/local/bin trivy \
    && chmod +x /usr/local/bin/trivy

COPY --from=k6builder /usr/bin/k6 /usr/bin/k6

WORKDIR /app
ENV NODE_ENV=production

COPY api/default.vcl /etc/varnish/default.vcl
COPY --from=deps /app/node_modules /app/node_modules
COPY api/ .
COPY --from=session-geo /app/geoip /app/geoip

RUN chmod +x /app/entrypoint.sh

FROM app-runtime-base AS app-review
# The full API test/lint gate is an explicit review target so production image
# builds do not block on it or inherit its build-only credentials.
RUN --mount=from=database_schema,target=/db NODE_ENV=test DB_PASSWORD=build-test DB_HOST=localhost DB_POOL_HOST=localhost DB_POOL_PORT=18505 DB_MAX_CONN=1000 VM_API_TOKEN=build-test bun run test
RUN bun run lint

FROM app-runtime-base AS app-runtime

EXPOSE 8080

FROM app-runtime

CMD chmod +x /app/entrypoint.sh; /app/entrypoint.sh
