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

FROM deps AS auth-runtime
COPY --chown=bun:bun api/ .
COPY --from=session-geo /app/geoip /app/geoip
RUN bun scripts/check-session-network.ts
RUN DB_PASSWORD=build-test DB_HOST=localhost VM_API_TOKEN=build-test bun run test --only=auth-service,auth-boundary,social-oidc,social-auth
RUN bun run lint
ENV NODE_ENV=production AUTH_SERVICE_ONLY=1
USER bun
CMD ["bun", "src/authServer.ts"]

FROM oven/bun:1.3.13-alpine AS app-runtime

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

# Build-time tests import the runtime constants module, but Docker builds do
# not receive the compose env_file. Keep placeholders scoped to this check so
# browser-worker containers do not inherit fake app credentials.
RUN --mount=from=database_schema,target=/db NODE_ENV=test DB_PASSWORD=build-test DB_HOST=localhost DB_POOL_HOST=localhost DB_POOL_PORT=18505 DB_MAX_CONN=1000 VM_API_TOKEN=build-test bun run test
RUN bun run lint

RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

FROM oven/bun:1.3.11 AS browser-bun

FROM ghcr.io/selkies-project/selkies-gstreamer/gst-py-example@sha256:3b7e60077dfc56af335cbe2da33a8255ec0ab954ecf6169b9a46e78d09c3df84 AS browser-runtime

ARG HANASAND_RELEASE_COMMIT=unknown
LABEL org.opencontainers.image.revision=$HANASAND_RELEASE_COMMIT

USER root
COPY .git/HEAD /tmp/hanasand-source-head
RUN test "$(cat /tmp/hanasand-source-head)" = "ref: refs/heads/main" || { echo "Production image builds are allowed only from the main branch." >&2; exit 1; }
COPY --from=browser-bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl fonts-noto-color-emoji \
    && curl -fsSLo /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y --no-install-recommends /tmp/chrome.deb \
    && apt-get purge -y git \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* /tmp/chrome.deb

WORKDIR /app
COPY api/package.json api/bun.lock* api/bunfig.toml ./
RUN bun install --frozen-lockfile
COPY api/ .
COPY api/browser-worker/supervisor.conf /etc/supervisor/conf.d/browser-worker.conf
COPY api/browser-worker/start.sh /usr/local/bin/hanasand-browser-worker
COPY api/browser-worker/reconnect-watchdog.js /opt/gst-web/reconnect-watchdog.js
COPY api/browser-worker/patch-stream-input.ts /tmp/patch-stream-input.ts
COPY api/browser-worker/touch-input.js /tmp/touch-input.js
COPY api/browser-worker/wheel-input.js /tmp/wheel-input.js
COPY api/browser-worker/patch-stream-controls.ts /tmp/patch-stream-controls.ts
COPY api/browser-worker/patch-stream-playback.ts /tmp/patch-stream-playback.ts
COPY api/browser-worker/patch-stream-framerate.ts /tmp/patch-stream-framerate.ts
COPY api/browser-worker/patch-stream-h264.ts /tmp/patch-stream-h264.ts
COPY api/browser-worker/patch-stream-receiver.ts /tmp/patch-stream-receiver.ts
COPY api/browser-worker/patch-stream-packets.ts /tmp/patch-stream-packets.ts
COPY api/browser-worker/patch-stream-signalling.ts /tmp/patch-stream-signalling.ts
RUN bun /tmp/patch-stream-input.ts \
    && bun /tmp/patch-stream-playback.ts \
    && bun /tmp/patch-stream-framerate.ts \
    && bun /tmp/patch-stream-h264.ts \
    && bun /tmp/patch-stream-receiver.ts \
    && bun /tmp/patch-stream-packets.ts \
    && bun /tmp/patch-stream-signalling.ts \
    && bun /tmp/patch-stream-controls.ts \
    && chmod +x /usr/local/bin/hanasand-browser-worker \
    && sed -i 's/selkies-gstreamer-resize 1920x1080/selkies-gstreamer-resize "${BROWSER_STREAM_RESOLUTION:-1280x720}"/' /etc/entrypoint.sh \
    && sed -i '/\.scale {/,/}/s/height: 100%;/height: 100%;\n      object-fit: contain;/' /opt/gst-web/index.html \
    && sed -i 's#</body>#<script src="reconnect-watchdog.js"></script></body>#' /opt/gst-web/index.html \
    && sed -i 's/worker_processes auto;/worker_processes 4;/' /etc/nginx/nginx.conf

RUN BROWSER_STREAM_ASSET_DIR=/opt/gst-web bun test tests/browser-stream-watchdog.test.ts \
    && bun scripts/check-browser-player-image.ts
RUN GSTREAMER_PATH=/opt/gstreamer bash -c '. /opt/gstreamer/gst-env && bun browser-worker/check-stream-h264.ts'

ENV CHROMIUM_BIN=/usr/bin/google-chrome-stable \
    BROWSER_STREAM_RESOLUTION=1280x720 \
    DISPLAY=:20 \
    START_XFCE4=false

USER 1000

FROM app-runtime

CMD chmod +x /app/entrypoint.sh; /app/entrypoint.sh
