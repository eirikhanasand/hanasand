#!/bin/sh
set -eu

su-exec privoxy:privoxy privoxy /etc/privoxy/config
exec su-exec tor:tor tor -f /etc/tor/torrc
