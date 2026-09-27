FROM alpine:3.23

RUN apk add --no-cache pgbouncer=1.25.1-r0 postgresql17-client nodejs \
    && addgroup -S pgbouncer \
    && adduser -S -D -H -G pgbouncer pgbouncer \
    && mkdir -p /run/pgbouncer \
    && chown pgbouncer:pgbouncer /run/pgbouncer

COPY pgbouncer.ini /etc/pgbouncer/pgbouncer.ini
COPY entrypoint.mjs /usr/local/bin/pgbouncer-entrypoint.mjs

USER pgbouncer
ENTRYPOINT ["node", "/usr/local/bin/pgbouncer-entrypoint.mjs"]
