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

FROM oven/bun:1.3.11 AS browser-bun

FROM ghcr.io/selkies-project/selkies-gstreamer/gst-py-example@sha256:3b7e60077dfc56af335cbe2da33a8255ec0ab954ecf6169b9a46e78d09c3df84 AS browser-runtime

USER root
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
COPY package.json bun.lock* bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
COPY browser-worker/supervisor.conf /etc/supervisor/conf.d/browser-worker.conf
COPY browser-worker/start.sh /usr/local/bin/hanasand-browser-worker
COPY browser-worker/reconnect-watchdog.js /opt/gst-web/reconnect-watchdog.js
RUN chmod +x /usr/local/bin/hanasand-browser-worker \
    && sed -i 's/selkies-gstreamer-resize 1920x1080/selkies-gstreamer-resize "${BROWSER_STREAM_RESOLUTION:-1280x720}"/' /etc/entrypoint.sh \
    && sed -i '/\.scale {/,/}/s/height: 100%;/height: 100%;\n      object-fit: contain;/' /opt/gst-web/index.html \
    && sed -i 's#</body>#<script src="reconnect-watchdog.js"></script></body>#' /opt/gst-web/index.html \
    && sed -i 's/worker_processes auto;/worker_processes 4;/' /etc/nginx/nginx.conf

ENV CHROMIUM_BIN=/usr/bin/google-chrome-stable \
    BROWSER_STREAM_RESOLUTION=1280x720 \
    DISPLAY=:20 \
    START_XFCE4=false

USER 1000

FROM app-runtime

CMD chmod +x /app/entrypoint.sh; /app/entrypoint.sh
