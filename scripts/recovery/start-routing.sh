#!/bin/sh
set -eu
root=${1:?site root required}
mkdir -p "$root/proxy"
# Render and validate off to the side so a failed render cannot replace the live config.
staged=$(mktemp -d "$root/proxy/.routing.XXXXXX")
cleanup() { rm -rf "$staged"; }
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
"$root/run-typescript-node.sh" "$root/render_proxy.ts" "$root/config.json" "$staged/haproxy.cfg" "$staged/haproxy-secondary.cfg"
chmod 755 "$staged"
chmod 644 "$staged"/*.cfg
for index in 0 1; do
 file=haproxy.cfg; test "$index" = 0 || file=haproxy-secondary.cfg
 docker run --rm --network host -v "$staged:/recovery:ro" haproxy@sha256:de601ccc9a79b715055bc5c8d51ff357edca04c1e869f4209f02bf6872fde8ac haproxy -c -f "/recovery/$file"
done
for index in 0 1; do
 file=haproxy.cfg; test "$index" = 0 || file=haproxy-secondary.cfg
 name=hanasand-proxy-$((index + 1))
 if docker inspect "$name" >/dev/null 2>&1; then
  # Unchanged configs need no reload; each reload eventually closes old DB sessions.
  if cmp -s "$staged/$file" "$root/proxy/$file"; then continue; fi
  mv "$staged/$file" "$root/proxy/$file"
  docker kill -s USR2 "$name" >/dev/null
 else
  mv "$staged/$file" "$root/proxy/$file"
  docker run -d --name "$name" --restart unless-stopped --network host --memory 128m --cpus .5 \
   -v "$root/proxy:/recovery:ro" --tmpfs /run/haproxy:mode=700,uid=99,gid=99 haproxy@sha256:de601ccc9a79b715055bc5c8d51ff357edca04c1e869f4209f02bf6872fde8ac haproxy -W -db -f "/recovery/$file" >/dev/null
 fi
done
