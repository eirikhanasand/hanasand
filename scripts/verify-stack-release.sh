#!/bin/sh
set -eu

release=${1:-$(git rev-parse HEAD)}
test "$(git rev-parse HEAD)" = "$release" || {
    echo "Release must equal the checked-out main commit: $release" >&2
    exit 1
}

containers='hanasand hanasand_api hanasand_auth_primary hanasand_auth_secondary hanasand_database_backup hanasand_onion_tor hanasand_ai_parser_bridge hanasand_ai_model_client hanasand_ti_scraper hanasand_pgbouncer hanasand_browsers'
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

for container in hanasand_auth_primary hanasand_auth_secondary; do
    test "$(docker inspect -f '{{.State.Health.Status}}' "$container")" = healthy || {
        echo "$container is not healthy after deployment." >&2
        exit 1
    }
done

recovery_services='tunnel tunnel-database tunnel-intelligence tunnel-web tunnel-monitor tunnel-replication tunnel-support tunnel-ai proxy-1 proxy-2'
elapsed=0
while test "$elapsed" -lt 180; do
    recovery_current=1
    for service in $recovery_services; do
        container="hanasand-$service"
        if ! docker inspect "$container" >/dev/null 2>&1; then
            recovery_current=0
            continue
        fi
        running=$(docker inspect -f '{{.State.Running}}' "$container")
        health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container")
        container_release=$(docker inspect -f '{{index .Config.Labels "com.hanasand.release"}}' "$container")
        project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$container")
        compose_service=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$container")
        if test "$running" != true || test "$health" != healthy || test "$container_release" != "$release" || test "$project" != hanasand-recovery || test "$compose_service" != "$service"; then
            recovery_current=0
            continue
        fi
        case "$service" in
            proxy-*) ;;
            *)
                image=$(docker inspect -f '{{.Image}}' "$container")
                image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null || true)
                test "$image_release" = "$release" || recovery_current=0
                ;;
        esac
    done
    test "$recovery_current" = 1 && break
    sleep 5
    elapsed=$((elapsed + 5))
done
test "$recovery_current" = 1 || {
    echo "Recovery tunnels and proxies did not reach the healthy release $release within 180 seconds." >&2
    exit 1
}

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

echo "All Hanasand code, browser warm, recovery tunnel, and proxy containers are on $release."
