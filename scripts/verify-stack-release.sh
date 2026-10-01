#!/bin/sh
set -eu

release=${1:-$(git rev-parse HEAD)}
expected_pgbouncer_release=${2:-}
preserved_services=${3:-}
current_branch=$(git branch --show-current)
current_release=$(git rev-parse HEAD)
test "$current_branch" = main && git merge-base --is-ancestor "$release" "$current_release" || {
    echo "Release must be checked out on main or be an ancestor of its current commit: $release" >&2
    exit 1
}

is_preserved_service() {
    case " $preserved_services " in
        *" $1 "*) return 0 ;;
        *) return 1 ;;
    esac
}

for service in $preserved_services; do
    case "$service" in
        onion-tor|ai-parser-bridge|ti-scraper) ;;
        *)
            echo "Unknown preserved Hanasand service: $service" >&2
            exit 1
            ;;
    esac
done

containers='hanasand hanasand_api hanasand_auth_primary hanasand_auth_secondary hanasand_database_backup hanasand_onion_tor hanasand_ai_parser_bridge hanasand_ai_model_client hanasand_ti_scraper hanasand_browsers'
for container in $containers; do
    test "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)" = true || {
        echo "Required Hanasand container is not running: $container" >&2
        exit 1
    }
    test "$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || true)" = healthy || {
        echo "Required Hanasand container is not healthy: $container" >&2
        exit 1
    }
    env_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container" \
        | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
    image=$(docker inspect -f '{{.Image}}' "$container")
    image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null || true)

    expected_container_release=$release
    case "$container" in
        hanasand_onion_tor) preserved_service=onion-tor ;;
        hanasand_ai_parser_bridge) preserved_service=ai-parser-bridge ;;
        hanasand_ti_scraper) preserved_service=ti-scraper ;;
        *) preserved_service= ;;
    esac
    if test -n "$preserved_service" && is_preserved_service "$preserved_service"; then
        expected_container_release=$env_release
    fi
    if test "$expected_container_release" != "$release"; then
        case "$expected_container_release" in *[!a-f0-9]*|'')
            echo "$container has an invalid preserved release $expected_container_release." >&2
            exit 1
            ;;
        esac
        test "${#expected_container_release}" -eq 40 && git merge-base --is-ancestor "$expected_container_release" "$release" || {
            echo "$container's preserved release is not an ancestor of $release." >&2
            exit 1
        }
    fi
    test "$env_release" = "$expected_container_release" || {
        echo "$container has release $env_release, expected $expected_container_release" >&2
        exit 1
    }
    test "$image_release" = "$expected_container_release" || {
        echo "$container image has revision $image_release, expected $expected_container_release" >&2
        exit 1
    }
done

# The log processor is a durable worker. It may stay on an older application
# release when its source, dependencies, schema, image, and service config have
# not changed; unrelated frontend or operations releases must not interrupt it.
processor_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_log_processor \
    | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
case "$processor_release" in
    *[!a-f0-9]*|'')
        echo "The durable log processor has no valid release marker." >&2
        exit 1
        ;;
esac
test "${#processor_release}" -eq 40 \
    && git merge-base --is-ancestor "$processor_release" "$release" || {
    echo "The durable log processor release is not an ancestor of $release." >&2
    exit 1
}
if ! git diff --quiet "$processor_release" "$release" -- \
    api/src api/Dockerfile api/package.json api/bun.lock api/bunfig.toml \
    api/scripts/download-session-geo.ts api/scripts/check-session-network.ts db; then
    echo "The durable log processor source or schema differs from $release." >&2
    exit 1
fi
processor_image=$(docker inspect -f '{{.Image}}' hanasand_log_processor)
processor_image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
    "$processor_image" 2>/dev/null || true)
test "$processor_image_release" = "$processor_release" || {
    echo "The durable log processor image does not match its release marker." >&2
    exit 1
}
processor_running_hash=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.config-hash"}}' \
    hanasand_log_processor 2>/dev/null || true)
root=$(git rev-parse --show-toplevel)
if test -f "$root/.env"; then
    processor_desired_hash=$(HANASAND_RELEASE_COMMIT="$processor_release" docker compose --project-name hanasand \
        --env-file "$root/.env" -f "$root/docker-compose.yml" config --hash log-processor 2>/dev/null | sed 's/.* //')
else
    processor_desired_hash=$(HANASAND_RELEASE_COMMIT="$processor_release" docker compose --project-name hanasand \
        -f "$root/docker-compose.yml" config --hash log-processor 2>/dev/null | sed 's/.* //')
fi
test -n "$processor_running_hash" && test "$processor_running_hash" = "$processor_desired_hash" || {
    echo "The durable log processor service configuration is stale." >&2
    exit 1
}

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
case "$processor_health" in *'"ok":true'*"\"release\":\"$processor_release\""*) ;; *)
    echo "Durable log processor health did not report its verified release $processor_release." >&2
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

ti_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_ti_scraper \
    | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
ti_source=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/ti/scraper"}}{{.Source}}{{end}}{{end}}' hanasand_ti_scraper)
test "$ti_source" = "/home/hanasand/hanasand/ops/runtime/ti-releases/$ti_release" || {
    echo "hanasand_ti_scraper is not mounted from its immutable release directory." >&2
    exit 1
}
test "$(cat "$ti_source/.hanasand-release")" = "$ti_release" || {
    echo "hanasand_ti_scraper source marker does not match the container release." >&2
    exit 1
}
ti_api_source=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/api"}}{{.Source}}{{end}}{{end}}' hanasand_ti_scraper)
test "$ti_api_source" = "/home/hanasand/hanasand/ops/runtime/ti-releases/$ti_release/api" || {
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

echo "All application and browser containers are healthy for release $release; durable log processor verified on $processor_release; preserved unchanged services: ${preserved_services:-none}."
