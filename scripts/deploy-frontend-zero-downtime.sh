#!/bin/sh
set -eu

root=$(pwd)
test "$root" = "/home/hanasand/hanasand" || {
    echo "Run this from /home/hanasand/hanasand" >&2
    exit 1
}

proxy_conf=/home/hanasand/openresty/nginx/conf.d/default.conf
active_port=$(sed -n 's/.*proxy_pass http:\/\/localhost:\([0-9][0-9]*\);.*/\1/p' "$proxy_conf" | head -1)
case "$active_port" in
    3000) new_port=3100; old_container=hanasand ;;
    3100) new_port=3000; old_container=hanasand-frontend-3100 ;;
    *) echo "Could not determine active frontend port" >&2; exit 1 ;;
esac

new_container=hanasand-frontend-$new_port
docker rm -f "$new_container" >/dev/null 2>&1 || true
docker compose build frontend
docker compose run -d --no-deps --name "$new_container" -p "$new_port:3000" frontend >/dev/null

ready=0
for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:$new_port/" >/dev/null 2>&1; then
        ready=1
        break
    fi
    sleep 2
done
test "$ready" = 1 || {
    docker rm -f "$new_container" >/dev/null 2>&1 || true
    echo "New frontend did not become ready; old frontend remains active" >&2
    exit 1
}

backup=$(mktemp)
cp "$proxy_conf" "$backup"
trap 'cp "$backup" "$proxy_conf"; docker exec openresty openresty -s reload >/dev/null 2>&1 || true; rm -f "$backup"' INT TERM EXIT
sed -i "s/proxy_pass http:\/\/localhost:$active_port;/proxy_pass http:\/\/localhost:$new_port;/g" "$proxy_conf"
docker exec openresty openresty -t >/dev/null
docker exec openresty openresty -s reload
rm -f "$backup"
trap - INT TERM EXIT

docker rm -f "$old_container" >/dev/null 2>&1 || true
echo "Frontend switched from $active_port to $new_port without stopping the old instance first."
