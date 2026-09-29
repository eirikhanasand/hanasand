#!/bin/sh
set -eu

root=$(git rev-parse --show-toplevel)
test "$root" = "/home/hanasand/hanasand" || {
    echo "Run this from /home/hanasand/hanasand" >&2
    exit 1
}

# Run each deployment in its own process group so a newer request can stop
# the complete older deployment, including a docker compose child process.
if test "${HANASAND_DEPLOY_GUARDED:-}" != 1; then
    exec env HANASAND_DEPLOY_GUARDED=1 setsid "$0" "$@"
fi

lock_file=/tmp/hanasand-full-deploy.lock
owner_file=/tmp/hanasand-full-deploy.pid
exec 8>/tmp/hanasand-full-deploy-start.lock
exec 9>"$lock_file"

running_deployments() {
    ps -eo pid=,args= | awk -v self="$$" \
        '$1 != self && $NF ~ /(^|\/)deploy-all[.]sh$/ { print $1 }'
}

stop_deployment_group() {
    signal=$1
    pid=$2
    /bin/kill -"$signal" -- "-$pid" 2>/dev/null || /bin/kill -"$signal" "$pid" 2>/dev/null || true
}

deployment_group_exists() {
    ps -eo pid=,pgid=,args= | awk -v group="$1" \
        '$2 == group && $0 ~ /(deploy-all[.]sh|docker compose|docker-compose|docker-buildx)/ { found=1 } END { exit !found }'
}

stop_existing_deployments() {
    previous_pids=
    previous_owner=$(cat "$owner_file" 2>/dev/null || true)
    case "$previous_owner" in
        ''|*[!0-9]*|1|"$$") ;;
        *)
            if deployment_group_exists "$previous_owner"; then
                previous_pids="$previous_pids $previous_owner"
                stop_deployment_group TERM "$previous_owner"
            fi
            ;;
    esac

    for pid in $(running_deployments); do
        if test "$(readlink "/proc/$pid/cwd" 2>/dev/null || true)" = "$root"; then
            case " $previous_pids " in
                *" $pid "*) ;;
                *)
                    previous_pids="$previous_pids $pid"
                    stop_deployment_group TERM "$pid"
                    ;;
            esac
        fi
    done

    attempt=0
    while test "$attempt" -lt 15; do
        if flock -n 9; then
            return
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    for pid in $previous_pids; do
        stop_deployment_group KILL "$pid"
    done
    flock 9
}

if ! flock -n 8; then
    stop_existing_deployments
    flock 8
fi

if flock -n 9; then
    :
else
    stop_existing_deployments
fi

printf '%s\n' "$$" > "$owner_file"
flock -u 8

sh "$root/scripts/require-main.sh"
release=$(git rev-parse HEAD)
sh "$root/scripts/require-compose-healthchecks.sh"

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

wait_for_healthy() {
    container=$1
    service=$2
    timeout=$3
    elapsed=0
    while test "$elapsed" -lt "$timeout"; do
        state=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || true)
        health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2>/dev/null || true)
        if test "$state" = running && test "$health" = healthy; then
            echo "$service is healthy."
            return 0
        fi
        if test -n "$state" && test "$state" != running; then
            echo "$service stopped during startup (state: $state)." >&2
            return 1
        fi
        sleep 5
        elapsed=$((elapsed + 5))
    done
    echo "$service did not become healthy within ${timeout}s." >&2
    return 1
}

# Keep both authentication replicas running while the rest of the stack is
# recreated. Replace each replica only after the previous one is healthy.
services=$(compose_live config --services | sed '/^auth-primary$/d; /^auth-secondary$/d')
# Compose service names are controlled by docker-compose.yml and contain no
# shell metacharacters, so split the list into its individual arguments.
# shellcheck disable=SC2086
compose_live up -d --no-build --no-deps browsers
compose_live up -d --no-build --no-deps --remove-orphans $services
compose_live up -d --no-build --no-deps api frontend
# The API can report unhealthy while its startup schema work retries transient
# database locks. Keep the existing auth pair up until the API has recovered.
wait_for_healthy hanasand_api "API" 600
wait_for_healthy hanasand "Frontend" 180
curl --fail --silent --show-error --max-time 10 --output /dev/null http://127.0.0.1:3100/
echo "Homepage cache warmed."
compose_live up -d --no-build --no-deps --force-recreate auth-secondary
wait_for_healthy hanasand_auth_secondary "Secondary auth worker" 180
compose_live up -d --no-build --no-deps --force-recreate auth-primary
wait_for_healthy hanasand_auth_primary "Primary auth worker" 180

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
