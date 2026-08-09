#!/bin/sh
set -eu

nc -z 127.0.0.1 8118
nc -z 127.0.0.1 9050
cookie="$(od -An -tx1 /tmp/control_auth_cookie | tr -d '[:space:]')"
test -n "$cookie"
printf 'AUTHENTICATE %s\r\nGETINFO status/bootstrap-phase\r\nQUIT\r\n' "$cookie" \
  | nc -w 2 127.0.0.1 9051 \
  | grep -q 'PROGRESS=100'
