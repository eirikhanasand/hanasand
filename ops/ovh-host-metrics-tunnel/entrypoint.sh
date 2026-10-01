#!/bin/sh
set -eu

exec ssh \
    -NT \
    -i /run/key \
    -o BatchMode=yes \
    -o IdentitiesOnly=yes \
    -o UserKnownHostsFile=/run/known_hosts \
    -o StrictHostKeyChecking=yes \
    -o ExitOnForwardFailure=yes \
    -o ConnectTimeout=10 \
    -o ServerAliveInterval=15 \
    -o ServerAliveCountMax=3 \
    "$@"
