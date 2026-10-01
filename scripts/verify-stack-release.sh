#!/bin/sh
set -eu

release=${1:-$(git rev-parse HEAD)}
expected_pgbouncer_release=${2:-}
test "$(git rev-parse HEAD)" = "$release" || {
    echo "Release must equal the checked-out main commit: $release" >&2
    exit 1
}

containers='hanasand hanasand_api hanasand_log_processor hanasand_auth_primary hanasand_auth_secondary hanasand_database_backup hanasand_onion_tor hanasand_ai_parser_bridge hanasand_ai_model_client hanasand_ti_scraper hanasand_browsers'
for container in $containers; do
    test "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)" = true || {
        echo "Required Hanasand container is not running: $container" >&2
        exit 1
    }
    env_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container" \
        | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
    image=$(docker inspect -f '{{.Image}}' "$container")
    image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null || true)
    test "$env_release" = "$release" || {
        echo "$container has release $env_release, expected $release" >&2
        exit 1
    }
    test "$image_release" = "$release" || {
        echo "$container image has revision $image_release, expected $release" >&2
        exit 1
    }
done

test "$(docker inspect -f '{{.State.Running}}' hanasand_pgbouncer 2>/dev/null || true)" = true \
    && test "$(docker inspect -f '{{.State.Health.Status}}' hanasand_pgbouncer 2>/dev/null || true)" = healthy || {
    echo "Canonical PgBouncer is not running and healthy." >&2
    exit 1
}
if test -n "$expected_pgbouncer_release"; then
    pgbouncer_env_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_pgbouncer \
        | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
    pgbouncer_image=$(docker inspect -f '{{.Image}}' hanasand_pgbouncer)
    pgbouncer_image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
        "$pgbouncer_image" 2>/dev/null || true)
    test "$pgbouncer_env_release" = "$expected_pgbouncer_release" \
        && test "$pgbouncer_image_release" = "$expected_pgbouncer_release" || {
        echo "PgBouncer does not match its requested release $expected_pgbouncer_release." >&2
        exit 1
    }
fi

test "$(docker inspect -f '{{.State.Health.Status}}' hanasand_log_processor)" = healthy || {
    echo "hanasand_log_processor is not healthy after deployment." >&2
    exit 1
}
processor_health=$(docker exec hanasand_log_processor wget -qO- http://127.0.0.1:8099/health)
case "$processor_health" in *'"ok":true'*"\"release\":\"$release\""*) ;; *)
    echo "Durable log processor health did not report release $release." >&2
    exit 1
    ;;
esac

for container in hanasand_auth_primary hanasand_auth_secondary; do
    test "$(docker inspect -f '{{.State.Health.Status}}' "$container")" = healthy || {
        echo "$container is not healthy after deployment." >&2
        exit 1
    }
done

for container in $(docker ps -aq --filter label=com.docker.compose.project=hanasand-recovery) \
    hanasand-tunnel hanasand-tunnel-database hanasand-tunnel-intelligence hanasand-tunnel-web \
    hanasand-tunnel-monitor hanasand-tunnel-replication hanasand-tunnel-support hanasand-tunnel-ai \
    hanasand-proxy-1 hanasand-proxy-2 log-catchup-pg-check; do
    if docker inspect "$container" >/dev/null 2>&1; then
        echo "Retired recovery container still exists: $container" >&2
        exit 1
    fi
done

# Browser warm workers are created directly by the API, so Compose does not
# recreate them with the rest of the stack. Wait until all named pool slots
# report both the application release and browser image revision being checked.
elapsed=0
while test "$elapsed" -lt 240; do
    browser_pool_current=1
    for slot in 0 1 2 3 4; do
        container="hanasand_browser_warm_$slot"
        if ! docker inspect "$container" >/dev/null 2>&1; then
            browser_pool_current=0
            continue
        fi
        running=$(docker inspect -f '{{.State.Running}}' "$container")
        health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container")
        worker_release=$(docker inspect -f '{{index .Config.Labels "com.hanasand.release"}}' "$container")
        image=$(docker inspect -f '{{.Image}}' "$container")
        image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null || true)
        if test "$running" != true || test "$health" != healthy || test "$worker_release" != "$release" || test "$image_release" != "$release"; then
            browser_pool_current=0
        fi
    done
    test "$browser_pool_current" = 1 && break
    sleep 5
    elapsed=$((elapsed + 5))
done
test "$browser_pool_current" = 1 || {
    echo "Browser warm pool did not reach five healthy workers on release $release within 240 seconds." >&2
    exit 1
}

ti_source=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/ti/scraper"}}{{.Source}}{{end}}{{end}}' hanasand_ti_scraper)
test "$ti_source" = "/home/hanasand/hanasand/ops/runtime/ti-releases/$release" || {
    echo "hanasand_ti_scraper is not mounted from the immutable release directory." >&2
    exit 1
}
test "$(cat "$ti_source/.hanasand-release")" = "$release" || {
    echo "hanasand_ti_scraper source marker does not match the release." >&2
    exit 1
}
ti_api_source=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/api"}}{{.Source}}{{end}}{{end}}' hanasand_ti_scraper)
test "$ti_api_source" = "/home/hanasand/hanasand/ops/runtime/ti-releases/$release/api" || {
    echo "hanasand_ti_scraper API utility mount is not from the immutable release directory." >&2
    exit 1
}
test -f "$ti_api_source/src/utils/alerts/discordWebhookFile.ts" && test -f "$ti_api_source/src/utils/dwm/customerOutputSafety.ts" || {
    echo "hanasand_ti_scraper API utility mount is incomplete." >&2
    exit 1
}

api_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8082/health)
case "$api_health" in *'"ok":true'*"\"release\":\"$release\""*) ;; *)
    echo "API health endpoint did not report release $release." >&2
    exit 1
    ;;
esac
frontend_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3100/api/health)
case "$frontend_health" in *'"ok":true'*"\"release\":\"$release\""*"\"api\""*) ;; *)
    echo "Frontend health endpoint did not report release $release and API health." >&2
    exit 1
    ;;
esac
recovery_route_status=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 http://127.0.0.1:3100/api/recovery)
test "$recovery_route_status" = 404 || {
    echo "Retired /api/recovery route returned HTTP $recovery_route_status instead of 404." >&2
    exit 1
}

echo "All Hanasand code and browser containers are on $release."
