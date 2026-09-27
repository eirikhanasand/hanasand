#!/usr/bin/env sh
set -eu

script=$1
shift
node_bin=$(command -v node)
temporary=$(mktemp "${TMPDIR:-/tmp}/hanasand-ts.XXXXXX")
mv "$temporary" "$temporary.mjs"
temporary=$temporary.mjs
trap 'rm -f "$temporary"' EXIT
cat -- "$script" > "$temporary"
HANASAND_TYPESCRIPT_ENTRYPOINT=$script "$node_bin" --jitless "$temporary" "$@"
