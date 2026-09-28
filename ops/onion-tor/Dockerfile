FROM alpine:3.22
ARG HANASAND_RELEASE_COMMIT=unknown
LABEL org.opencontainers.image.revision=$HANASAND_RELEASE_COMMIT
COPY .git/HEAD /tmp/hanasand-source-head
RUN test "$(cat /tmp/hanasand-source-head)" = "ref: refs/heads/main" || { echo "Production image builds are allowed only from the main branch." >&2; exit 1; }


RUN apk add --no-cache privoxy su-exec tor \
    && chown -R tor:tor /var/lib/tor /etc/tor

COPY ops/onion-tor/torrc /etc/tor/torrc
COPY ops/onion-tor/privoxy.conf /etc/privoxy/config
COPY ops/onion-tor/entrypoint.sh /usr/local/bin/onion-proxy-entrypoint
COPY ops/onion-tor/healthcheck.sh /usr/local/bin/onion-proxy-healthcheck
RUN chmod 0755 /usr/local/bin/onion-proxy-entrypoint /usr/local/bin/onion-proxy-healthcheck

EXPOSE 8118 9050

ENTRYPOINT ["/usr/local/bin/onion-proxy-entrypoint"]
