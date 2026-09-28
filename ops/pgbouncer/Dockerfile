FROM alpine:3.23
COPY .git/HEAD /tmp/hanasand-source-head
RUN test "$(cat /tmp/hanasand-source-head)" = "ref: refs/heads/main" || { echo "Production image builds are allowed only from the main branch." >&2; exit 1; }


RUN apk add --no-cache pgbouncer=1.25.1-r0 postgresql17-client nodejs \
    && addgroup -S pgbouncer \
    && adduser -S -D -H -G pgbouncer pgbouncer \
    && mkdir -p /run/pgbouncer \
    && chown pgbouncer:pgbouncer /run/pgbouncer

COPY ops/pgbouncer/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini
COPY ops/pgbouncer/entrypoint.mjs /usr/local/bin/pgbouncer-entrypoint.mjs

USER pgbouncer
ENTRYPOINT ["node", "/usr/local/bin/pgbouncer-entrypoint.mjs"]
