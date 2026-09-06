#!/bin/sh
set -eu
if test -f /home/hanasand/resilience/config.json; then exec sh scripts/resilience/deploy-pair.sh auth "$@"; fi
# Two serving workers and two temporary replacements. The API is never restarted.
test "$(pwd)" = /home/hanasand/hanasand || { echo 'Run from /home/hanasand/hanasand' >&2; exit 1; }
# Share the frontend lock because both deployments reload the same proxy configuration.
exec 9>/tmp/hanasand-frontend-deploy.lock
flock 9
conf_dir=/home/hanasand/openresty/nginx/conf.d
main=$conf_dir/default.conf
upstream=$conf_dir/auth-upstream.conf
release=$(git rev-parse HEAD)
image=hanasand-auth:$release
case "${1:-}" in
    '') docker build --target auth-runtime -t "$image" api ;;
    --no-build) docker image inspect "$image" >/dev/null ;;
    *) echo 'Usage: scripts/deploy-auth.sh [--no-build]' >&2; exit 2 ;;
esac
if test -f "$upstream" && grep -q '127.0.0.1:8181' "$upstream"; then
    ports='8183 8184'; old_ports='8181 8182'
else
    ports='8181 8182'; old_ports='8183 8184'
fi
gateway=$(docker network inspect hanasand_hanasandnet --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}')
test -n "$gateway"
backup=$(mktemp -d)
cp "$main" "$backup/main"
if test -f "$upstream"; then cp "$upstream" "$backup/upstream"; fi
for snippet in auth-routes auth-proxy; do
    path=/home/hanasand/openresty/nginx/snippets/$snippet.conf
    if test -f "$path"; then cp "$path" "$backup/$snippet"; fi
done
switched=0
rollback() {
    if test "$switched" = 0; then
        cp "$backup/main" "$main"
        if test -f "$backup/upstream"; then cp "$backup/upstream" "$upstream"; else rm -f "$upstream"; fi
        for snippet in auth-routes auth-proxy; do
            path=/home/hanasand/openresty/nginx/snippets/$snippet.conf
            if test -f "$backup/$snippet"; then cp "$backup/$snippet" "$path"; else rm -f "$path"; fi
        done
        docker exec openresty nginx -t && docker exec openresty nginx -s reload || true
        # Keep failed candidates for inspection; they are not serving traffic.
    fi
}
trap rollback EXIT HUP INT TERM
for port in $ports; do
    name=hanasand-auth-$port
    docker rm -f "$name" >/dev/null 2>&1 || true
    docker run -d --name "$name" --restart unless-stopped --network hanasand_hanasandnet \
        -p "127.0.0.1:$port:8081" --env-file .env \
        -e AUTH_SERVICE_ONLY=1 -e PORT=8081 -e DB_MAX_CONN=5 -e DB_TIMEOUT_MS=2000 \
        -e "AUTH_TRUSTED_PROXY=$gateway" -e "HANASAND_RELEASE_COMMIT=$release" \
        --memory 512m --cpus 1 --stop-timeout 65 \
        --health-cmd 'wget -qO- -T 8 http://127.0.0.1:8081/ready || exit 1' \
        --health-interval 10s --health-timeout 9s --health-retries 3 \
        --entrypoint bun "$image" src/authServer.ts >/dev/null
    ready=0
    for attempt in $(seq 1 30); do
        if curl -fsS --max-time 8 "http://127.0.0.1:$port/ready" >/dev/null; then ready=1; break; fi
        sleep 2
    done
    test "$ready" = 1 || { echo "$name failed readiness; existing workers retained" >&2; exit 1; }
done
{
    echo 'upstream hanasand_auth {'
    echo '    zone hanasand_auth 64k;'
    echo '    least_conn;'
    for port in $ports; do echo "    server 127.0.0.1:$port max_fails=1 fail_timeout=5s;"; done
    echo '    keepalive 32;'
    echo '}'
} > "$upstream.tmp"
mv "$upstream.tmp" "$upstream"
# Install a scoped include once; unrelated API routes continue to use the monolith.
python3 - "$main" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
s = p.read_text()
marker = '    server_name api.hanasand.com;'
include = '    include snippets/auth-routes.conf;'
if include not in s:
    if s.count(marker) != 1: raise SystemExit('Cannot identify API virtual host safely')
    s = s.replace(marker, marker + '\n' + include)
    p.write_text(s)
PY
cp scripts/nginx-auth-proxy.conf /home/hanasand/openresty/nginx/snippets/auth-proxy.conf
cp scripts/nginx-auth-routes.conf /home/hanasand/openresty/nginx/snippets/auth-routes.conf
docker exec openresty nginx -t
docker exec openresty nginx -s reload
# Probe through the real TLS virtual host. A deliberately invalid session must be rejected.
for attempt in $(seq 1 10); do
    status=$(curl -sS --max-time 10 --resolve api.hanasand.com:443:127.0.0.1 \
        -H 'Authorization: Bearer deploy-invalid' -o /dev/null -w '%{http_code}' \
        https://api.hanasand.com/api/auth/token/deploy-health)
    test "$status" = 401 || { echo "Authentication boundary check failed: $status" >&2; exit 1; }
done
switched=1
trap - EXIT HUP INT TERM
# Old Nginx workers finish existing requests after reload. Leave a full proxy timeout
# before asking the old applications to drain; Fastify then finishes in-flight handlers.
sleep 60
for port in $old_ports; do
    if docker container inspect "hanasand-auth-$port" >/dev/null 2>&1; then
        docker stop -t 65 "hanasand-auth-$port" >/dev/null
    fi
done
echo "Authentication deployed: $release; serving ports $ports; rollback config $backup"
