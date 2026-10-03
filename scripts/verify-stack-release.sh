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

verify_image_revision() {
    container=$1
    image=$2
    image_release=$3
    expected_release=$4
    allow_missing_image=${5:-0}
    if ! docker image inspect "$image" >/dev/null 2>&1; then
        if test "${HANASAND_VERIFY_LIVE_RELEASE_ONLY:-0}" = 1 || test "$allow_missing_image" = 1; then
            echo "$container has no retained image metadata; checking its live release marker and health instead." >&2
            return 0
        fi
        echo "$container image is not available to verify (expected revision $expected_release)." >&2
        return 1
    fi
    test "$image_release" = "$expected_release" || {
        echo "$container image has revision $image_release, expected $expected_release" >&2
        return 1
    }
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

containers='hanasand hanasand_api hanasand_auth_primary hanasand_auth_secondary hanasand_database_backup hanasand_onion_tor hanasand_ai_parser_bridge hanasand_ai_model_client hanasand_ti_scraper hanasand_browsers hanasand_ovh_host_metrics_tunnel'
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

    preserved_service=
    expected_container_release=$release
    case "$container" in
        hanasand_onion_tor) preserved_service=onion-tor ;;
        hanasand_ai_parser_bridge) preserved_service=ai-parser-bridge ;;
        hanasand_ti_scraper) preserved_service=ti-scraper ;;
        hanasand_browsers)
            expected_container_release=$image_release
            case "$image_release" in
                *[!a-f0-9]*|'')
                    echo "The browser image has no valid browser repository revision." >&2
                    exit 1
                    ;;
            esac
            test "${#image_release}" -eq 40 || {
                echo "The browser image has no valid browser repository revision." >&2
                exit 1
            }
            ;;
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
    if test "$container" != hanasand_browsers; then
        test "$env_release" = "$expected_container_release" || {
            echo "$container has release $env_release, expected $expected_container_release" >&2
            exit 1
        }
    fi
    allow_missing_image=0
    if test -n "$preserved_service" && is_preserved_service "$preserved_service"; then
        allow_missing_image=1
    fi
    verify_image_revision "$container" "$image" "$image_release" "$expected_container_release" "$allow_missing_image"
done

systemctl is-active --quiet hanasand-ovh-host-metrics.timer || {
    echo "The OVH host metrics refresh timer is not active." >&2
    exit 1
}
if ! curl --fail --silent --show-error --max-time 10 http://127.0.0.1:19911/status \
    | grep -Eq '"site"[[:space:]]*:[[:space:]]*"ovhcloud"'; then
    echo "The OVH host metrics tunnel does not return OVH status." >&2
    exit 1
fi
metrics_age=$(($(date +%s) - $(stat -c %Y /var/lib/hanasand/metrics/ovhcloud.json)))
if test "$metrics_age" -lt 0 || test "$metrics_age" -gt 90; then
    echo "OVH host telemetry is not fresh (age: ${metrics_age}s)." >&2
    exit 1
fi

# Processor is deployed from its own repository and Compose project.
processor_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' processor \
    | sed -n 's/^PROCESSOR_RELEASE_COMMIT=//p' | head -1)
case "$processor_release" in
    *[!a-f0-9]*|'') echo "Processor has no valid release marker." >&2; exit 1 ;;
esac
test "${#processor_release}" -eq 40 || { echo "Processor release is invalid." >&2; exit 1; }
processor_image=$(docker inspect -f '{{.Image}}' processor)
processor_image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
    "$processor_image" 2>/dev/null || true)
verify_image_revision "Standalone processor" "$processor_image" "$processor_image_release" "$processor_release"
test "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' processor)" = processor || {
    echo "Processor must belong to its own Compose project." >&2; exit 1
}
processor_health=$(docker exec processor wget -qO- http://127.0.0.1:8099/health)
case "$processor_health" in *'"ok":true'*"\"release\":\"$processor_release\""*) ;; *)
    echo "Standalone processor is not healthy on its reported release." >&2; exit 1 ;;
esac

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
    test "$pgbouncer_env_release" = "$expected_pgbouncer_release" || {
        echo "PgBouncer does not match its requested release $expected_pgbouncer_release." >&2
        exit 1
    }
    verify_image_revision "PgBouncer" "$pgbouncer_image" "$pgbouncer_image_release" "$expected_pgbouncer_release"
fi

test "$(docker inspect -f '{{.State.Health.Status}}' processor)" = healthy || {
    echo "Standalone processor is not healthy after deployment." >&2
    exit 1
}

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

# Browser warm workers are created directly by the API, so site releases keep
# their containers and image versions. Confirm every slot remains healthy.
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
        image=$(docker inspect -f '{{.Image}}' "$container")
        image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null || true)
        case "$image_release" in *[!a-f0-9]*|'') browser_pool_current=0 ;; esac
        if test "$running" != true || test "$health" != healthy || test "${#image_release}" -ne 40; then
            browser_pool_current=0
        fi
    done
    test "$browser_pool_current" = 1 && break
    sleep 5
    elapsed=$((elapsed + 5))
done
test "$browser_pool_current" = 1 || {
    echo "Browser warm pool did not reach five healthy workers within 240 seconds." >&2
    exit 1
}

# Container health does not prove the API can claim or connect to a warm worker.
# Probe the authenticated worker status from the API's own network namespace.
for slot in 0 1 2 3 4; do
    container="hanasand_browser_warm_$slot"
    worker_ip=$(docker inspect -f "{{.NetworkSettings.Networks.hanasand_browsernet.IPAddress}}" "$container")
    worker_token=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container" \
        | sed -n 's/^BROWSER_SANDBOX_POOL_TOKEN=//p' | head -1)
    if test -z "$worker_ip" || test -z "$worker_token" \
        || ! printf '%s' "$worker_token" | docker exec -i \
            -e "HANASAND_BROWSER_WORKER_PROBE_IP=$worker_ip" hanasand_api bun -e '
                const token = await new Response(Bun.stdin.stream()).text()
                const ip = process.env.HANASAND_BROWSER_WORKER_PROBE_IP
                const response = await fetch(`http://${ip}:8090/internal/browser-warm`, {
                    headers: { "x-browser-pool-token": token },
                    signal: AbortSignal.timeout(1500),
                })
                const status = await response.json()
                const health = await fetch(`http://${ip}:8080/health`, { signal: AbortSignal.timeout(1000) })
                if (!response.ok || status.state !== "ready" || !health.ok) process.exit(1)
            ' >/dev/null 2>&1; then
        echo "API cannot reach ready browser worker slot $slot." >&2
        exit 1
    fi
done

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
