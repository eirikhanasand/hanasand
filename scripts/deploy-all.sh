#!/bin/sh
set -eu

root=$(git rev-parse --show-toplevel)
test "$root" = "/home/hanasand/hanasand" || {
    echo "Run this from /home/hanasand/hanasand" >&2
    exit 1
}
sh "$root/scripts/require-main.sh"
release=$(git rev-parse HEAD)

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

test -d "$root/ti/scraper/node_modules" || {
    echo "TI dependencies are missing on the deploy host; refusing an unverified source mount." >&2
    exit 1
}
ln -s "$root/ti/scraper/node_modules" "$build_dir/ti/scraper/node_modules"
(cd "$build_dir/ti/scraper" && /home/hanasand/.local/bin/bun run check)
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
    printf '%s\n' "$release" > "$ti_release_dir/.hanasand-release"
fi
export HANASAND_TI_SCRAPER_SOURCE="$ti_release_dir"

# Build from the immutable release archive, not the live checkout. This keeps
# runtime state (including the separate code-review mirror) out of every image
# context while preserving parallel BuildKit execution for the release.
if test -f "$build_dir/.env"; then
    docker compose --env-file "$build_dir/.env" -f "$build_dir/docker-compose.yml" build
else
    docker compose -f "$build_dir/docker-compose.yml" build
fi
docker compose up -d --force-recreate
sh "$root/scripts/verify-stack-release.sh" "$release"
echo "Hanasand stack deployed from main at $release."
