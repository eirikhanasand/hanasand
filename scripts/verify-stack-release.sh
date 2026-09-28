#!/bin/sh
set -eu

release=${1:-$(git rev-parse HEAD)}
test "$(git rev-parse HEAD)" = "$release" || {
    echo "Release must equal the checked-out main commit: $release" >&2
    exit 1
}

containers='hanasand hanasand_api hanasand_database_backup hanasand_onion_tor hanasand_ai_parser_bridge hanasand_ai_model_client hanasand_ti_scraper hanasand_pgbouncer hanasand_browsers'
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

echo "All Hanasand code containers are on $release."
