#!/bin/sh
set -eu
root=${1:?site root required}
mkdir -p "$root/proxy"
# Native master-worker reload drains existing requests; both routing instances remain configured.
python3 "$root/render_proxy.py" "$root/config.json" "$root/proxy/haproxy.cfg" "$root/proxy/haproxy-secondary.cfg"
for index in 0 1; do
 file=haproxy.cfg; test "$index" = 0 || file=haproxy-secondary.cfg
 docker run --rm --network host -v "$root/proxy:/resilience:ro" haproxy@sha256:475863a372c92c3dab3d59eafbbf8019dceebcd0c456594551b160ecdba4bdb9 haproxy -c -f "/resilience/$file"
done
for index in 0 1; do
 file=haproxy.cfg; test "$index" = 0 || file=haproxy-secondary.cfg
 name=hanasand-resilience-proxy-$index
 if docker inspect "$name" >/dev/null 2>&1; then
  docker kill -s USR2 "$name" >/dev/null
 else
  docker run -d --name "$name" --restart unless-stopped --network host --memory 128m --cpus .5 \
   -v "$root/proxy:/resilience:ro" --tmpfs /run/haproxy:mode=700,uid=99,gid=99 haproxy@sha256:475863a372c92c3dab3d59eafbbf8019dceebcd0c456594551b160ecdba4bdb9 haproxy -W -db -f "/resilience/$file" >/dev/null
 fi
done
