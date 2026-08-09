#!/bin/sh
set -eu

nc -z 127.0.0.1 8118
nc -z 127.0.0.1 9050
printf 'AUTHENTICATE\r\nGETINFO status/bootstrap-phase\r\nQUIT\r\n' \
  | nc -w 2 127.0.0.1 9051 \
  | grep -q 'PROGRESS=100'
