#!/bin/sh
set -eu
# Run on Inspur. Only this task-owned tunnel is replaced; application services stay up.
secrets=/home/hanasand/resilience-secrets
test -s "$secrets/reverse-tunnel-key"
test -s "$secrets/ovh-known-hosts"
docker rm -f hanasand-resilience-tunnel >/dev/null 2>&1 || true
docker run -d --name hanasand-resilience-tunnel --restart unless-stopped --network host --memory 128m --cpus .5 \
 -v "$secrets/reverse-tunnel-key:/run/key:ro" -v "$secrets/ovh-known-hosts:/run/known_hosts:ro" \
 --entrypoint ssh hanasand_api -NT -i /run/key -o UserKnownHostsFile=/run/known_hosts -o StrictHostKeyChecking=yes \
 -o ExitOnForwardFailure=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
 -R 127.0.0.1:18503:127.0.0.1:8503 -R 127.0.0.1:18443:127.0.0.1:443 \
 -R 127.0.0.1:18097:127.0.0.1:18097 -R 127.0.0.1:18502:127.0.0.1:18502 \
 -R 127.0.0.1:19911:127.0.0.1:19901 \
 -L 127.0.0.1:19300:127.0.0.1:19300 -L 127.0.0.1:19080:127.0.0.1:19080 \
 -L 127.0.0.1:19090:127.0.0.1:19090 -L 127.0.0.1:19097:127.0.0.1:19097 \
 -L 127.0.0.1:18506:127.0.0.1:18506 -L 127.0.0.1:19911:127.0.0.1:19901 ubuntu@192.99.32.185
