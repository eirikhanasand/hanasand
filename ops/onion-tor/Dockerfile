FROM alpine:3.22

RUN apk add --no-cache privoxy su-exec tor \
    && chown -R tor:tor /var/lib/tor /etc/tor

COPY torrc /etc/tor/torrc
COPY privoxy.conf /etc/privoxy/config
COPY entrypoint.sh /usr/local/bin/onion-proxy-entrypoint
RUN chmod 0755 /usr/local/bin/onion-proxy-entrypoint

EXPOSE 8118 9050

ENTRYPOINT ["/usr/local/bin/onion-proxy-entrypoint"]
