FROM grafana/k6:latest AS k6builder

FROM oven/bun:1.3.11-alpine AS deps

WORKDIR /app

COPY package.json bun.lock* bunfig.toml ./
RUN bun install

FROM oven/bun:1.3.11-alpine

ARG DOCKER_SCOUT_VERSION=1.23.1
RUN apk add --no-cache varnish git openssh-client chromium docker-cli curl tar \
    && mkdir -p /usr/local/lib/docker/cli-plugins \
    && curl -fsSL "https://github.com/docker/scout-cli/releases/download/v${DOCKER_SCOUT_VERSION}/docker-scout_${DOCKER_SCOUT_VERSION}_linux_amd64.tar.gz" \
        | tar -xz -C /usr/local/lib/docker/cli-plugins docker-scout \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-scout

COPY --from=k6builder /usr/bin/k6 /usr/bin/k6

WORKDIR /app
ENV NODE_ENV=production

COPY default.vcl /etc/varnish/default.vcl
COPY --from=deps /app/node_modules /app/node_modules
COPY . .

# Build-time tests import the runtime constants module, but Docker builds do
# not receive the compose env_file. These placeholders are only available while
# proving the image; compose still injects the real runtime values.
ENV DB_PASSWORD=build-test \
    DB_HOST=localhost \
    VM_API_TOKEN=build-test
RUN bun run test
RUN bun run lint

RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

CMD chmod +x /app/entrypoint.sh; /app/entrypoint.sh
