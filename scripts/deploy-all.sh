#!/bin/sh
set -eu

root=$(git rev-parse --show-toplevel)
test "$root" = "/home/hanasand/hanasand" || {
    echo "Run this from /home/hanasand/hanasand" >&2
    exit 1
}
test -d "$root/mail/stalwart" || {
    echo "Persistent Stalwart state is missing: $root/mail/stalwart" >&2
    exit 1
}
export HANASAND_STALWART_STATE_DIR="$root/mail/stalwart"

# Run each deployment in its own process group and serialize requests. Builds
# happen beside the live stack, so a newer main commit must wait for the
# current release to finish rather than canceling and restarting its build.
if test "${HANASAND_DEPLOY_GUARDED:-}" != 1; then
    exec env HANASAND_DEPLOY_GUARDED=1 setsid "$0" "$@"
fi

lock_file=/tmp/hanasand-full-deploy.lock
owner_file=/tmp/hanasand-full-deploy.pid
if test "${HANASAND_DEPLOY_LOCK_HELD:-}" != 1; then
    exec 9>"$lock_file"
    if ! flock -n 9; then
        echo "Another Hanasand deployment is active; waiting for it to finish." >&2
        flock 9
    fi
fi
printf '%s\n' "$$" > "$owner_file"

release_has_schema_changes() {
    previous_release=$1
    target_release=$2
    # Re-run schema setup when the schema entry points or SQL files changed.
    # Other API source changes only trigger it when their diff changes DDL;
    # replaying idempotent ALTERs on every code-only release can hold candidate
    # startup behind long-running production transactions.
    if ! git diff --quiet "$previous_release" "$target_release" -- api/src/utils/db db; then
        return 0
    fi
    for path in $(git diff --name-only "$previous_release" "$target_release" -- api/src); do
        if git diff --unified=0 "$previous_release" "$target_release" -- "$path" \
            | grep -Eiq '^[+-].*([^[:alnum:]_])(CREATE|ALTER|DROP|TRUNCATE|REINDEX|GRANT|REVOKE)([[:space:]]|$)'; then
            return 0
        fi
    done
    return 1
}

reuse_schema_marker_for_code_only_release() {
    previous_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_api 2>/dev/null \
        | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
    case "$previous_release" in
        *[!a-f0-9]*|'') return 0 ;;
    esac
    test "${#previous_release}" -eq 40 || return 0
    test "$previous_release" != "$release" || return 0
    if release_has_schema_changes "$previous_release" "$release"; then
        return 0
    fi

    previous_schema_applied=$(docker exec hanasand_database psql -U hanasand -d hanasand -Atc \
        "SELECT EXISTS (SELECT 1 FROM app_schema_releases WHERE release = '$previous_release')" 2>/dev/null || true)
    test "$previous_schema_applied" = t || return 0

    docker exec hanasand_database psql -v ON_ERROR_STOP=1 -U hanasand -d hanasand \
        -c "INSERT INTO app_schema_releases (release) VALUES ('$release') ON CONFLICT DO NOTHING" >/dev/null
    echo "Reused the applied database schema marker for code-only release $release."
}

sh "$root/scripts/require-main.sh"
git fetch origin main
git merge --ff-only FETCH_HEAD
sh "$root/scripts/require-main.sh"
release=$(git rev-parse HEAD)
# The shell parsed this file before fetching. Re-exec once from the fast-forwarded
# checkout so deployment behavior matches the release being built.
if test "${HANASAND_DEPLOY_REFRESHED_RELEASE:-}" != "$release"; then
    exec env HANASAND_DEPLOY_LOCK_HELD=1 HANASAND_DEPLOY_REFRESHED_RELEASE="$release" \
        "$root/scripts/deploy-all.sh" "$@"
fi
sh "$root/scripts/require-compose-healthchecks.sh"
reuse_schema_marker_for_code_only_release

export HANASAND_RELEASE_COMMIT="$release"
export BROWSER_SANDBOX_WORKER_IMAGE="hanasand_browsers:$release"
candidate_suffix=$(printf '%s' "$release" | cut -c1-12)
candidate_offset=$(printf '%s' "$release" | cksum | awk '{ print $1 % 5000 }')
candidate_attempt=0
while test "$candidate_attempt" -lt 5000; do
    candidate_frontend_port=$((20000 + candidate_offset))
    candidate_api_port=$((25000 + candidate_offset))
    if ! ss -H -lnt "sport = :$candidate_frontend_port" | grep -q . \
        && ! ss -H -lnt "sport = :$candidate_api_port" | grep -q .; then
        break
    fi
    candidate_offset=$(((candidate_offset + 1) % 5000))
    candidate_attempt=$((candidate_attempt + 1))
done
test "$candidate_attempt" -lt 5000 || {
    echo "No unused loopback ports are available for release candidates." >&2
    exit 1
}
export HANASAND_API_CANDIDATE_CONTAINER="hanasand_api_candidate_$candidate_suffix"
export HANASAND_FRONTEND_CANDIDATE_CONTAINER="hanasand_frontend_candidate_$candidate_suffix"
export HANASAND_PGBOUNCER_CANDIDATE_CONTAINER="hanasand_pgbouncer_candidate_$candidate_suffix"
export HANASAND_API_CANDIDATE_PORT=$candidate_api_port
export HANASAND_FRONTEND_CANDIDATE_PORT=$candidate_frontend_port
build_dir=$(mktemp -d "/tmp/hanasand-release-build.XXXXXX")
candidate_started=0
proxy_target=canonical
candidate_safe_to_remove=1
cleanup() {
    status=$?
    if test "$status" -ne 0 && test "$candidate_started" = 1 \
        && test "$proxy_target" != candidate && test "$candidate_safe_to_remove" = 1; then
        docker rm -f "$HANASAND_FRONTEND_CANDIDATE_CONTAINER" "$HANASAND_API_CANDIDATE_CONTAINER" \
            "$HANASAND_PGBOUNCER_CANDIDATE_CONTAINER" >/dev/null 2>&1 || true
    fi
    rm -rf "$build_dir"
    return "$status"
}
trap cleanup EXIT HUP INT TERM
git archive --format=tar --output="$build_dir/source.tar" "$release"
(
    umask 022
    tar -xf "$build_dir/source.tar" -C "$build_dir"
)
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
        export HANASAND_BROWSER_RUNTIME_BASE=hanasand_browser_base:latest
        export HANASAND_BROWSER_RUNTIME_PATCHED=1
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

compose_release() {
    if test -f "$build_dir/.env"; then
        docker compose --project-name hanasand --parallel 1 --env-file "$build_dir/.env" -f "$build_dir/docker-compose.yml" "$@"
    else
        docker compose --project-name hanasand --parallel 1 -f "$build_dir/docker-compose.yml" "$@"
    fi
}

# HANASAND_RELEASE_COMMIT changes on every application release. Do not roll
# the shared pool just for that label: long-lived clients resolve its container
# address once and would keep using the old address after a replacement.
pgbouncer_config_changed=1
pgbouncer_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_pgbouncer 2>/dev/null \
    | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
case "$pgbouncer_release" in
    *[!a-f0-9]*|'') ;;
    *)
        if test "${#pgbouncer_release}" -eq 40 \
            && git diff --quiet "$pgbouncer_release" "$release" -- ops/pgbouncer; then
            running_config_hash=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.config-hash"}}' \
                hanasand_pgbouncer 2>/dev/null || true)
            desired_config_hash=$(HANASAND_RELEASE_COMMIT="$pgbouncer_release" \
                compose_release config --hash pgbouncer 2>/dev/null | awk '{print $NF}')
            if test -n "$running_config_hash" && test "$running_config_hash" = "$desired_config_hash"; then
                pgbouncer_config_changed=0
            fi
        fi
        ;;
esac

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

# The durable log processor keeps using canonical PgBouncer while the new
# release is built in isolation. Restore and verify that path first so a
# partially completed prior deployment cannot strand backlog processing.
canonical_pgbouncer_state=$(docker inspect -f '{{.State.Status}}' hanasand_pgbouncer 2>/dev/null || true)
canonical_pgbouncer_health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' hanasand_pgbouncer 2>/dev/null || true)
canonical_pgbouncer_recreated=0
if test "$canonical_pgbouncer_state" != running || test "$canonical_pgbouncer_health" != healthy; then
    compose_release up -d --no-build --no-deps --force-recreate pgbouncer
    canonical_pgbouncer_recreated=1
fi
wait_for_healthy hanasand_pgbouncer "Canonical PgBouncer" 180
wait_for_healthy hanasand_log_processor "Durable log processor" 180
if test "$canonical_pgbouncer_recreated" = 1; then
    # The recovery changed the pool's address; refresh clients before the
    # long image build so authentication does not wait for the rollout tail.
    compose_release up -d --no-build --no-deps --force-recreate auth-secondary
    wait_for_healthy hanasand_auth_secondary "Secondary auth worker" 180
    compose_release up -d --no-build --no-deps --force-recreate auth-primary
    wait_for_healthy hanasand_auth_primary "Primary auth worker" 180
fi
if test "$pgbouncer_config_changed" = 0; then
    echo "Keeping healthy PgBouncer from $pgbouncer_release in place for this code-only release."
fi

if test "$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand 2>/dev/null \
    | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)" = "$release" \
    && test "$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_api 2>/dev/null \
    | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)" = "$release"; then
    expected_pgbouncer_release=
    if test "$pgbouncer_config_changed" = 1; then expected_pgbouncer_release=$release; fi
    if sh "$root/scripts/verify-stack-release.sh" "$release" "$expected_pgbouncer_release"; then
        echo "Release $release is already deployed and verified; skipping this queued duplicate."
        exit 0
    fi
fi

wait_for_database_backups() {
    while :; do
        active_backups=$(docker exec hanasand_database psql -U hanasand -d hanasand -Atc \
            "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND application_name = 'pg_dump'")
        case "$active_backups" in
            ''|*[!0-9]*)
                echo "Could not read active database backup count: $active_backups" >&2
                return 1
                ;;
        esac
        test "$active_backups" -gt 0 || return 0
        echo "Waiting for $active_backups active database backup(s) before deployment work."
        sleep 30
    done
}

# Builds run beside the live stack. Wait until the large database export has
# finished, and build one image at a time to keep CPU and disk available to users.
wait_for_database_backups
compose_release build
compose_live() {
    if test -f "$build_dir/.env"; then
        docker compose --project-name hanasand --parallel 2 --env-file "$build_dir/.env" -f "$build_dir/docker-compose.yml" "$@"
    else
        docker compose --project-name hanasand --parallel 2 -f "$build_dir/docker-compose.yml" "$@"
    fi
}
log_processor_can_be_reused() {
    log_processor_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_log_processor 2>/dev/null \
        | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
    case "$log_processor_release" in
        *[!a-f0-9]*|'') return 1 ;;
    esac
    test "${#log_processor_release}" -eq 40 || return 1
    git merge-base --is-ancestor "$log_processor_release" "$release" || return 1
    if ! git diff --quiet "$log_processor_release" "$release" -- \
        api/src api/Dockerfile api/package.json api/bun.lock api/bunfig.toml \
        api/scripts/download-session-geo.ts api/scripts/check-session-network.ts db; then
        return 1
    fi

    log_processor_image=$(docker inspect -f '{{.Image}}' hanasand_log_processor)
    log_processor_image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
        "$log_processor_image" 2>/dev/null || true)
    test "$log_processor_image_release" = "$log_processor_release" || return 1

    log_processor_running_hash=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.config-hash"}}' \
        hanasand_log_processor 2>/dev/null || true)
    log_processor_desired_hash=$(HANASAND_RELEASE_COMMIT="$log_processor_release" \
        compose_live config --hash log-processor 2>/dev/null | sed 's/.* //')
    test -n "$log_processor_running_hash" \
        && test "$log_processor_running_hash" = "$log_processor_desired_hash"
}
compose_candidates() {
    docker compose --project-name hanasand --parallel 2 --profile deployment-candidates --env-file "$build_dir/.env" \
        -f "$build_dir/docker-compose.yml" "$@"
}

warm_dashboard_pages() {
    port=$1
    for page_path in /scanner /vms /db/backups /automation/health; do
        page_cookie='id=dashboard-render-proof-user; access_token=local-dashboard-render-proof-token; dashboard_view_mode=normal'
        curl --fail --silent --show-error --max-time 15 --output /dev/null \
            -H "Cookie: $page_cookie" \
            -H 'x-hanasand-render-proof-auth: local-dashboard-render-proof' \
            "http://127.0.0.1:$port$page_path"

        response=$(curl --fail --silent --show-error --max-time 15 --output /dev/null \
            --write-out '%{http_code} %{time_starttransfer}' \
            -H "Cookie: $page_cookie" \
            -H 'x-hanasand-render-proof-auth: local-dashboard-render-proof' \
            "http://127.0.0.1:$port$page_path")
        status=${response%% *}
        elapsed=${response#* }
        if [ "$status" != "200" ] || ! awk -v elapsed="$elapsed" 'BEGIN { exit (elapsed < 0.020) ? 0 : 1 }'; then
            echo "$page_path did not reach 200 with a first byte under 20ms (status $status, ${elapsed}s)." >&2
            return 1
        fi
        printf '%s first byte %.1f ms\n' "$page_path" "$(awk -v elapsed="$elapsed" 'BEGIN { print elapsed * 1000 }')"
    done
}

# Keep authentication replicas untouched until the rest of the release passes
# its health checks.
# The API candidate owns schema setup. Do not restart the shared database during
# an application release; its recovery period interrupts authenticated traffic.
services=$(compose_live config --services \
    | sed '/^api$/d; /^frontend$/d; /^auth-primary$/d; /^auth-secondary$/d; /^log-processor$/d; /^postgres$/d')
if test "$pgbouncer_config_changed" = 0; then
    services=$(printf '%s\n' "$services" | sed '/^pgbouncer$/d')
fi
wait_for_database_backups
# Compose service names are controlled by docker-compose.yml and contain no
# shell metacharacters, so split the list into its individual arguments.
# shellcheck disable=SC2086
compose_live up -d --no-build --no-deps browsers

# Start an isolated release-matched connection pool and API/frontend pair
# before touching any live dependencies. The API candidate applies additive
# schema setup but suppresses duplicate production workers.
compose_candidates run -d --no-deps --name "$HANASAND_PGBOUNCER_CANDIDATE_CONTAINER" pgbouncer-candidate
candidate_started=1
wait_for_healthy "$HANASAND_PGBOUNCER_CANDIDATE_CONTAINER" "PgBouncer release candidate" 180
compose_candidates run -d --no-deps --name "$HANASAND_API_CANDIDATE_CONTAINER" \
    --publish "127.0.0.1:$HANASAND_API_CANDIDATE_PORT:8080" api-candidate
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
warm_dashboard_pages "$HANASAND_FRONTEND_CANDIDATE_PORT"

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
    next_proxy_target=$3
    last_proxy_workers=$(docker exec openresty sh -c 'ps -o pid=,args=' \
        | awk '$0 ~ /nginx: worker process$/ { print $1 }')
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
    proxy_target=$next_proxy_target
    rm -f "$backup"
}

proxy_workers_for_pids() {
    worker_pids=$1
    state=$2
    docker exec openresty sh -c 'ps -o pid=,args=' \
        | awk -v worker_pids="$worker_pids" -v state="$state" '
            BEGIN {
                count = split(worker_pids, pids, " ")
                for (i = 1; i <= count; i++) wanted[pids[i]] = 1
            }
            $1 in wanted && $0 ~ /nginx: worker process/ {
                if (state == "shutting" && $0 !~ /nginx: worker process is shutting down/) next
                print $1
            }
        '
}

wait_for_proxy_workers_to_drain() {
    workers=$1
    test -n "$workers" || return 0
    elapsed=0
    while test "$elapsed" -lt 15; do
        pending=$(proxy_workers_for_pids "$workers" all)
        test -z "$pending" && return 0
        sleep 1
        elapsed=$((elapsed + 1))
    done

    # Reloaded workers stop taking new requests. Bound long-lived WebSockets so
    # their old upstream containers can be removed without leaving stale routes.
    shutting_down=$(proxy_workers_for_pids "$workers" shutting)
    if test "$(printf '%s\n' "$pending" | sort -u | wc -l | tr -d ' ')" \
        -ne "$(printf '%s\n' "$shutting_down" | sort -u | wc -l | tr -d ' ')"; then
        echo "OpenResty workers did not enter graceful shutdown; preserving their upstream." >&2
        return 1
    fi
    docker exec openresty sh -c "kill -TERM $shutting_down" >/dev/null 2>&1 || true

    elapsed=0
    while test "$elapsed" -lt 5; do
        pending=$(proxy_workers_for_pids "$workers" all)
        test -z "$pending" && return 0
        sleep 1
        elapsed=$((elapsed + 1))
    done
    echo "OpenResty workers still reference the previous upstream; preserving its containers." >&2
    return 1
}

switch_upstreams "$HANASAND_FRONTEND_CANDIDATE_PORT" "$HANASAND_API_CANDIDATE_PORT" candidate
wait_for_proxy_workers_to_drain "$last_proxy_workers"
echo "OpenResty now serves the healthy frontend and API candidates for $release."

# Recreate dependent services only after traffic is on the isolated candidates.
# The candidate API continues using its candidate pool while canonical PgBouncer
# and the rest of the stack are updated. Authentication replicas stay online.
# Compose can leave the shared health-gated guard in `created` during this
# no-deps update, so start and verify it before recreating dependent services.
compose_live up -d --no-build --no-deps deploy-path-guard
wait_for_healthy hanasand-deploy-path-guard-1 "Deploy path guard" 30
services=$(printf '%s\n' "$services" | sed '/^deploy-path-guard$/d')
# shellcheck disable=SC2086
compose_live up -d --no-build --no-deps --remove-orphans $services

compose_live up -d --no-build --no-deps api frontend
wait_for_healthy hanasand_api "API" 600
wait_for_healthy hanasand "Frontend" 180
if log_processor_can_be_reused; then
    echo "Keeping durable log processor on $log_processor_release; its code and configuration are unchanged."
else
    compose_live up -d --no-build --no-deps log-processor
    wait_for_healthy hanasand_log_processor "Durable log processor" 180
fi
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
warm_dashboard_pages 3100
candidate_safe_to_remove=0
switch_upstreams 3100 8082 canonical
if wait_for_proxy_workers_to_drain "$last_proxy_workers"; then
    candidate_safe_to_remove=1
    for candidate in $(docker ps -aq --filter label=com.docker.compose.project=hanasand \
        --filter label=com.docker.compose.service=api-candidate) \
        $(docker ps -aq --filter label=com.docker.compose.project=hanasand \
        --filter label=com.docker.compose.service=frontend-candidate) \
        $(docker ps -aq --filter label=com.docker.compose.project=hanasand \
        --filter label=com.docker.compose.service=pgbouncer-candidate); do
        docker rm -f "$candidate" >/dev/null
    done
else
    # New requests use canonical now. Keep the healthy candidate stack for
    # long-lived connections still handled by the old graceful workers.
    echo "OpenResty still has connections to the release candidates; keeping them online."
fi
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
expected_pgbouncer_release=
if test "$pgbouncer_config_changed" = 1; then expected_pgbouncer_release=$release; fi
export HANASAND_VERIFY_COMPOSE_FILE="$build_dir/docker-compose.yml"
export HANASAND_VERIFY_ENV_FILE="$build_dir/.env"
sh "$root/scripts/verify-stack-release.sh" "$release" "$expected_pgbouncer_release"
echo "Hanasand stack deployed from main at $release."
