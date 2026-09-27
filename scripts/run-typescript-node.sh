#!/usr/bin/env sh
set -eu

script=${1:?TypeScript script path required}
shift
bun_bin=${BUN_BIN:-/home/hanasand/.local/bin/bun}
test -x "$bun_bin" || { printf 'Bun is not installed at %s. Run scripts/install-typescript-runtime.sh.\n' "$bun_bin" >&2; exit 1; }
exec "$bun_bin" "$script" "$@"
