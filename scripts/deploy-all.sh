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
    group=$2
    /bin/kill -"$signal" -- "-$group" 2>/dev/null || true
}

process_group() {
    ps -o pgid= -p "$1" 2>/dev/null | tr -d ' '
}

deployment_group_exists() {
    ps -eo pid=,pgid=,args= | awk -v group="$1" \
        '$2 == group && $0 ~ /(deploy-all[.]sh|docker compose|docker-compose|docker-buildx)/ { found=1 } END { exit !found }'
}

stop_existing_deployments() {
    previous_groups=
    previous_owner=$(cat "$owner_file" 2>/dev/null || true)
    case "$previous_owner" in
        ''|*[!0-9]*|1|"$$") ;;
        *)
            owner_group=$(process_group "$previous_owner")
            case "$owner_group" in
                ''|*[!0-9]*) owner_group=$previous_owner ;;
            esac
            if deployment_group_exists "$owner_group"; then
                previous_groups="$previous_groups $owner_group"
                stop_deployment_group TERM "$owner_group"
            fi
            ;;
    esac

    for pid in $(running_deployments); do
        if test "$(readlink "/proc/$pid/cwd" 2>/dev/null || true)" = "$root"; then
            group=$(process_group "$pid")
            case " $previous_groups " in
                *" $group "*) ;;
                *)
                    previous_groups="$previous_groups $group"
                    stop_deployment_group TERM "$group"
                    ;;
            esac
        fi
    done

    # Older deploy shells may have exited while Compose descendants still hold
    # the release lock. Their immutable archive path identifies those builds.
    for group in $(ps -eo pgid=,args= | awk \
        '$0 ~ /hanasand-release-build[.]([^ /]+)\// && $0 ~ /(docker compose|docker-compose|docker-buildx)/ { print $1 }' | sort -u); do
        case " $previous_groups " in
            *" $group "*) ;;
            *)
                previous_groups="$previous_groups $group"
                stop_deployment_group TERM "$group"
                ;;
        esac
    done

    attempt=0
    while test "$attempt" -lt 15; do
        if flock -n 9; then
            return
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    for group in $previous_groups; do
        stop_deployment_group KILL "$group"
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

owner_group=$(process_group "$$")
test -n "$owner_group" || owner_group=$$
printf '%s\n' "$owner_group" > "$owner_file"
flock -u 8

sh "$root/scripts/require-main.sh"
release=$(git rev-parse HEAD)
sh "$root/scripts/require-compose-healthchecks.sh"

export HANASAND_RELEASE_COMMIT="$release"
export BROWSER_SANDBOX_WORKER_IMAGE="hanasand_browsers:$release"
candidate_suffix=$(printf '%s' "$release" | cut -c1-12)
candidate_offset=$(printf '%s' "$release" | cksum | awk '{ print $1 % 10000 }')
export HANASAND_API_CANDIDATE_CONTAINER="hanasand_api_candidate_$candidate_suffix"
export HANASAND_FRONTEND_CANDIDATE_CONTAINER="hanasand_frontend_candidate_$candidate_suffix"
export HANASAND_API_CANDIDATE_PORT=$((40000 + candidate_offset))
export HANASAND_FRONTEND_CANDIDATE_PORT=$((30000 + candidate_offset))
build_dir=$(mktemp -d "/tmp/hanasand-release-build.XXXXXX")
candidate_started=0
proxy_target=canonical
cleanup() {
    status=$?
    if test "$status" -ne 0 && test "$candidate_started" = 1 && test "$proxy_target" != candidate; then
        docker rm -f "$HANASAND_FRONTEND_CANDIDATE_CONTAINER" "$HANASAND_API_CANDIDATE_CONTAINER" >/dev/null 2>&1 || true
    fi
    rm -rf "$build_dir"
    return "$status"
}
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
    if grep -q '^BROWSER_SANDBOX_WORKER_IMAGE=' "$build_dir/.env"; then
        sed -i "s#^BROWSER_SANDBOX_WORKER_IMAGE=.*#BROWSER_SANDBOX_WORKER_IMAGE=$BROWSER_SANDBOX_WORKER_IMAGE#" "$build_dir/.env"
    else
        printf 'BROWSER_SANDBOX_WORKER_IMAGE=%s\n' "$BROWSER_SANDBOX_WORKER_IMAGE" >> "$build_dir/.env"
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
compose_candidates() {
    docker compose --profile deployment-candidates --env-file "$build_dir/.env" \
        -f "$root/docker-compose.yml" "$@"
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

# Replace all internal services first, while the currently serving frontend
# and API remain untouched. Authentication replicas are updated separately.
services=$(compose_live config --services | sed '/^api$/d; /^frontend$/d; /^auth-primary$/d; /^auth-secondary$/d')
# Compose service names are controlled by docker-compose.yml and contain no
# shell metacharacters, so split the list into its individual arguments.
# shellcheck disable=SC2086
compose_live up -d --no-build --no-deps browsers
compose_live up -d --no-build --no-deps --remove-orphans $services

# Start a matching API/frontend pair on release-specific loopback ports. The
# API candidate runs schema setup but suppresses the production background
# workers, then both candidates must pass their container health checks before
# traffic moves.
compose_candidates run -d --no-deps --name "$HANASAND_API_CANDIDATE_CONTAINER" \
    --publish "127.0.0.1:$HANASAND_API_CANDIDATE_PORT:8080" api-candidate
candidate_started=1
compose_candidates run -d --no-deps --name "$HANASAND_FRONTEND_CANDIDATE_CONTAINER" \
    --publish "127.0.0.1:$HANASAND_FRONTEND_CANDIDATE_PORT:3000" frontend-candidate
wait_for_healthy "$HANASAND_API_CANDIDATE_CONTAINER" "API release candidate" 600
wait_for_healthy "$HANASAND_FRONTEND_CANDIDATE_CONTAINER" "Frontend release candidate" 180
candidate_api_health=$(curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$HANASAND_API_CANDIDATE_PORT/health")
case "$candidate_api_health" in *'"ok":true'*"\"release\":\"$release\""*) ;; *)
    echo "API release candidate did not report release $release." >&2
    exit 1
    ;;
esac
candidate_frontend_health=$(curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$HANASAND_FRONTEND_CANDIDATE_PORT/api/health")
case "$candidate_frontend_health" in *'"ok":true'*"\"release\":\"$release\""*"\"api\""*) ;; *)
    echo "Frontend release candidate did not report release $release and its matching API." >&2
    exit 1
    ;;
esac

upstream_file=/home/hanasand/openresty/nginx/conf.d/hanasand-upstreams.conf
test -w "$upstream_file" || {
    echo "Cannot update the OpenResty upstream file: $upstream_file" >&2
    exit 1
}
docker inspect openresty >/dev/null 2>&1 || {
    echo "The OpenResty container is not available for a graceful cutover." >&2
    exit 1
}
switch_upstreams() {
    frontend_port=$1
    api_port=$2
    backup=$(mktemp "${upstream_file}.backup.XXXXXX")
    temporary=$(mktemp "${upstream_file}.tmp.XXXXXX")
    cp "$upstream_file" "$backup"
    cat > "$temporary" <<EOF
upstream hanasand_frontend {
    server 127.0.0.1:$frontend_port max_fails=1 fail_timeout=3s;
    keepalive 32;
}

upstream hanasand_api {
    server 127.0.0.1:$api_port max_fails=1 fail_timeout=3s;
    keepalive 32;
}
EOF
    chmod --reference="$upstream_file" "$temporary"
    mv "$temporary" "$upstream_file"
    if ! docker exec openresty /usr/local/openresty/bin/openresty -t >/dev/null \
        || ! docker exec openresty /usr/local/openresty/bin/openresty -s reload; then
        mv "$backup" "$upstream_file"
        docker exec openresty /usr/local/openresty/bin/openresty -t >/dev/null 2>&1 || true
        docker exec openresty /usr/local/openresty/bin/openresty -s reload >/dev/null 2>&1 || true
        rm -f "$temporary" "$backup"
        return 1
    fi
    rm -f "$backup"
}

switch_upstreams "$HANASAND_FRONTEND_CANDIDATE_PORT" "$HANASAND_API_CANDIDATE_PORT"
proxy_target=candidate
echo "OpenResty now serves the healthy frontend and API candidates for $release."

compose_live up -d --no-build --no-deps api frontend
wait_for_healthy hanasand_api "API" 600
wait_for_healthy hanasand "Frontend" 180
canonical_frontend_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3100/api/health)
case "$canonical_frontend_health" in *'"ok":true'*"\"release\":\"$release\""*"\"api\""*) ;; *)
    echo "Canonical frontend did not report release $release and its matching API." >&2
    exit 1
    ;;
esac
canonical_api_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8082/health)
case "$canonical_api_health" in *'"ok":true'*"\"release\":\"$release\""*) ;; *)
    echo "Canonical API did not report release $release." >&2
    exit 1
    ;;
esac
switch_upstreams 3100 8082
proxy_target=canonical
for candidate in $(docker ps -aq --filter label=com.docker.compose.project=hanasand \
    --filter label=com.docker.compose.service=api-candidate) \
    $(docker ps -aq --filter label=com.docker.compose.project=hanasand \
    --filter label=com.docker.compose.service=frontend-candidate); do
    docker rm -f "$candidate" >/dev/null
done
echo "Frontend and API health verified."
compose_live up -d --no-build --no-deps --force-recreate auth-secondary
wait_for_healthy hanasand_auth_secondary "Secondary auth worker" 180
compose_live up -d --no-build --no-deps --force-recreate auth-primary
wait_for_healthy hanasand_auth_primary "Primary auth worker" 180

# Remove containers left by the retired cross-site recovery stack. Preserve
# anonymous volumes so this cleanup cannot delete data.
for container in $(docker ps -aq --filter label=com.docker.compose.project=hanasand-recovery); do
    docker rm -f "$container"
done
for container in hanasand-tunnel hanasand-tunnel-database hanasand-tunnel-intelligence hanasand-tunnel-web hanasand-tunnel-monitor hanasand-tunnel-replication hanasand-tunnel-support hanasand-tunnel-ai hanasand-proxy-1 hanasand-proxy-2 log-catchup-pg-check; do
    if docker inspect "$container" >/dev/null 2>&1; then docker rm -f "$container"; fi
done
sh "$root/scripts/verify-stack-release.sh" "$release"
echo "Hanasand stack deployed from main at $release."
