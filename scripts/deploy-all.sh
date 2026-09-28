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
# The API image runs the complete test suite during its build. Building the
# large frontend and TI contexts concurrently can starve that test process and
# create false timeout failures, so release builds are intentionally serialized.
export COMPOSE_PARALLEL_LIMIT=1
docker compose build
docker compose up -d --force-recreate
sh "$root/scripts/verify-stack-release.sh" "$release"
echo "Hanasand stack deployed from main at $release."
