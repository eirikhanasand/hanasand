#!/bin/sh
set -eu

root=$(git rev-parse --show-toplevel)
test "$root" = "/home/hanasand/hanasand" || {
    echo "Run this from /home/hanasand/hanasand" >&2
    exit 1
}
sh "$root/scripts/require-main.sh"
release=$(git rev-parse HEAD)
sh "$root/scripts/require-compose-healthchecks.sh"

exec 9>/tmp/hanasand-full-deploy.lock
flock 9

export HANASAND_RELEASE_COMMIT="$release"
build_dir=$(mktemp -d "/tmp/hanasand-release-build.XXXXXX")
cleanup() { rm -rf "$build_dir"; }
trap cleanup EXIT HUP INT TERM
git archive --format=tar --output="$build_dir/source.tar" "$release"
tar -xf "$build_dir/source.tar" -C "$build_dir"
rm -f "$build_dir/source.tar"
mkdir -p "$build_dir/.git"
printf 'ref: refs/heads/main\n' > "$build_dir/.git/HEAD"
if test -f "$root/.env"; then cp "$root/.env" "$build_dir/.env"; fi
if test -f "$build_dir/.env"; then
    printf 'HANASAND_DEPLOY_ENV_FILE=%s\n' "$build_dir/.env" >> "$build_dir/.env"
    if grep -q '^HANASAND_RELEASE_COMMIT=' "$build_dir/.env"; then
        sed -i "s/^HANASAND_RELEASE_COMMIT=.*/HANASAND_RELEASE_COMMIT=$release/" "$build_dir/.env"
    else
        printf 'HANASAND_RELEASE_COMMIT=%s\n' "$release" >> "$build_dir/.env"
    fi
    if docker image inspect hanasand_browser_base:latest >/dev/null 2>&1; then
        if grep -q '^HANASAND_BROWSER_RUNTIME_BASE=' "$build_dir/.env"; then
            sed -i 's#^HANASAND_BROWSER_RUNTIME_BASE=.*#HANASAND_BROWSER_RUNTIME_BASE=hanasand_browser_base:latest#' "$build_dir/.env"
        else
            printf 'HANASAND_BROWSER_RUNTIME_BASE=hanasand_browser_base:latest\n' >> "$build_dir/.env"
        fi
        if grep -q '^HANASAND_BROWSER_RUNTIME_PATCHED=' "$build_dir/.env"; then
            sed -i 's#^HANASAND_BROWSER_RUNTIME_PATCHED=.*#HANASAND_BROWSER_RUNTIME_PATCHED=1#' "$build_dir/.env"
        else
            printf 'HANASAND_BROWSER_RUNTIME_PATCHED=1\n' >> "$build_dir/.env"
        fi
    fi
    printf 'HANASAND_TI_SCRAPER_SOURCE=%s\n' "$root/ops/runtime/ti-releases/$release" >> "$build_dir/.env"
    printf 'HANASAND_TI_API_SOURCE=%s\n' "$root/ops/runtime/ti-releases/$release/api" >> "$build_dir/.env"
fi

test -d "$root/ti/scraper/node_modules" || {
    echo "TI dependencies are missing on the deploy host; refusing an unverified source mount." >&2
    exit 1
}
ln -s "$root/ti/scraper/node_modules" "$build_dir/ti/scraper/node_modules"
(cd "$build_dir/ti/scraper" && PATH="/home/hanasand/.local/bin:$PATH" /home/hanasand/.local/bin/bun run check)
rm "$build_dir/ti/scraper/node_modules"

ti_release_dir="$root/ops/runtime/ti-releases/$release"
if test -e "$ti_release_dir"; then
    test -f "$ti_release_dir/.hanasand-release" && test "$(cat "$ti_release_dir/.hanasand-release")" = "$release" || {
        echo "TI release directory exists for a different revision: $ti_release_dir" >&2
        exit 1
    }
else
    mkdir -p "$root/ops/runtime/ti-releases"
    mkdir "$ti_release_dir"
    cp -a "$build_dir/ti/scraper/." "$ti_release_dir/"
    mkdir -p "$ti_release_dir/api/src/utils/alerts" "$ti_release_dir/api/src/utils/dwm"
    cp "$build_dir/api/src/utils/alerts/discordWebhookFile.ts" "$ti_release_dir/api/src/utils/alerts/"
    cp "$build_dir/api/src/utils/dwm/customerOutputSafety.ts" "$ti_release_dir/api/src/utils/dwm/"
    printf '%s\n' "$release" > "$ti_release_dir/.hanasand-release"
fi
if ! test -f "$ti_release_dir/api/src/utils/alerts/discordWebhookFile.ts" || ! test -f "$ti_release_dir/api/src/utils/dwm/customerOutputSafety.ts"; then
    mkdir -p "$ti_release_dir/api/src/utils/alerts" "$ti_release_dir/api/src/utils/dwm"
    cp "$build_dir/api/src/utils/alerts/discordWebhookFile.ts" "$ti_release_dir/api/src/utils/alerts/"
    cp "$build_dir/api/src/utils/dwm/customerOutputSafety.ts" "$ti_release_dir/api/src/utils/dwm/"
fi
export HANASAND_TI_SCRAPER_SOURCE="$ti_release_dir"
export HANASAND_TI_API_SOURCE="$ti_release_dir/api"

# Build from the immutable release archive, not the live checkout. This keeps
# runtime state (including the separate code-review mirror) out of every image
# context while preserving parallel BuildKit execution for the release.
if test -f "$build_dir/.env"; then
    docker compose --env-file "$build_dir/.env" -f "$build_dir/docker-compose.yml" build
else
    docker compose -f "$build_dir/docker-compose.yml" build
fi

compose_live() {
    if test -f "$build_dir/.env"; then
        docker compose --env-file "$build_dir/.env" -f "$root/docker-compose.yml" "$@"
    else
        docker compose -f "$root/docker-compose.yml" "$@"
    fi
}

# Keep both authentication replicas running while the rest of the stack is
# recreated. Replace each replica only after the previous one is healthy.
services=$(compose_live config --services | sed '/^auth-primary$/d; /^auth-secondary$/d')
# Compose service names are controlled by docker-compose.yml and contain no
# shell metacharacters, so split the list into its individual arguments.
# shellcheck disable=SC2086
compose_live up -d --force-recreate --remove-orphans --wait --wait-timeout 180 $services
compose_live up -d --force-recreate --wait --wait-timeout 180 auth-secondary
compose_live up -d --force-recreate --wait --wait-timeout 180 auth-primary

# The host-network HAProxy instance cannot resolve the Compose service name.
# Resolve the freshly recreated scraper container and refresh its runtime
# server address so a Compose network recreation cannot strand the TI route on
# the previous container IP.
if docker inspect hanasand-proxy-1 >/dev/null 2>&1; then
    ti_ip=$(docker inspect -f '{{with index .NetworkSettings.Networks "hanasand_hanasandnet"}}{{.IPAddress}}{{end}}' hanasand_ti_scraper)
    test -n "$ti_ip" || {
        echo "Could not resolve the threat-intelligence scraper address." >&2
        exit 1
    }
    docker exec hanasand-proxy-1 sh -lc \
        "printf 'set server intelligence/inspur-ti-1 addr %s port 8097\\nset server intelligence/inspur-ti-1 check-port 8098\\n' '$ti_ip' | socat - UNIX-CONNECT:/run/haproxy/admin0.sock"
fi
sh "$root/scripts/verify-stack-release.sh" "$release"
echo "Hanasand stack deployed from main at $release."
