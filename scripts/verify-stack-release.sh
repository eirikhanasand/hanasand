#!/bin/sh
set -eu

release=${1:-$(git rev-parse HEAD)}
test "$(git rev-parse HEAD)" = "$release" || {
    echo "Release must equal the checked-out main commit: $release" >&2
    exit 1
}

containers='hanasand hanasand_api hanasand_database_backup hanasand_onion_tor hanasand_ai_parser_bridge hanasand_ai_model_client hanasand_ti_scraper hanasand_pgbouncer'
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

if docker inspect hanasand_browser_worker >/dev/null 2>&1; then
    env_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_browser_worker \
        | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
    image=$(docker inspect -f '{{.Image}}' hanasand_browser_worker)
    image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null || true)
    test "$env_release" = "$release" && test "$image_release" = "$release" || {
        echo "Optional browser worker is not on release $release" >&2
        exit 1
    }
fi

echo "All Hanasand code containers are on $release."
