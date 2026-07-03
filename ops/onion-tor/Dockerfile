FROM alpine:3.22

RUN apk add --no-cache tor \
    && chown -R tor:tor /var/lib/tor /etc/tor

COPY torrc /etc/tor/torrc

USER tor
EXPOSE 9050

CMD ["tor", "-f", "/etc/tor/torrc"]
