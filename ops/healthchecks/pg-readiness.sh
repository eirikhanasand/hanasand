#!/bin/sh
# Only the existing fixed readiness invocation receives correlation evidence.
if [ "$#" -ne 4 ] || [ "$1" != '-U' ] || [ "$2" != 'hanasand' ] || [ "$3" != '-d' ] || [ "$4" != 'hanasand' ]; then
    exec /usr/bin/pg_isready "$@"
fi
IFS= read -r nonce < /proc/sys/kernel/random/uuid || exec /usr/bin/pg_isready "$@"
# The nonce remains visible in this exact process's argv for host-side binding.
exec /bin/sh -c 'printf "hanasand-pg-ready-v1 nonce=%s pid=%s\n" "$1" "$$"; /usr/lib/postgresql/15/bin/pg_isready -U hanasand -d "dbname=hanasand application_name=pg_isready fallback_application_name=hanasand_probe_$1"; exit $?' hanasand-readiness-v1 "$nonce"
