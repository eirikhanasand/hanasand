FROM grafana/k6:latest AS k6builder

FROM oven/bun:1.3.11-alpine AS deps

WORKDIR /app

COPY package.json bun.lock* bunfig.toml ./
RUN bun install

FROM oven/bun:1.3.11-alpine AS app-runtime

ARG TRIVY_VERSION=0.72.0
RUN apk add --no-cache varnish git openssh-client docker-cli curl tar \
    && curl -fsSL "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-64bit.tar.gz" \
        | tar -xz -C /usr/local/bin trivy \
    && chmod +x /usr/local/bin/trivy

COPY --from=k6builder /usr/bin/k6 /usr/bin/k6

WORKDIR /app
ENV NODE_ENV=production

COPY default.vcl /etc/varnish/default.vcl
COPY --from=deps /app/node_modules /app/node_modules
COPY . .

# Build-time tests import the runtime constants module, but Docker builds do
# not receive the compose env_file. Keep placeholders scoped to this check so
# browser-worker containers do not inherit fake app credentials.
RUN DB_PASSWORD=build-test DB_HOST=localhost VM_API_TOKEN=build-test bun run test
RUN bun run lint

RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

FROM app-runtime AS browser-runtime
RUN apk del varnish git openssh-client docker-cli curl tar \
    && rm -f /usr/local/bin/trivy /usr/bin/k6 \
    && apk add --no-cache chromium xvfb ttf-freefont font-noto
ENV CHROMIUM_BIN=/usr/bin/chromium

FROM app-runtime

CMD chmod +x /app/entrypoint.sh; /app/entrypoint.sh
