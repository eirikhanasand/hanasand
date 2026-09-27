#!/bin/sh
set -eu
version=${BUN_VERSION:-1.3.13}
prefix=${BUN_INSTALL_PREFIX:-"$HOME/.local"}
npm install --global --prefix "$prefix" "bun@$version"
installed=$("$prefix/bin/bun" --version)
test "$installed" = "$version" || { printf 'Expected Bun %s, got %s.\n' "$version" "$installed" >&2; exit 1; }
printf 'Bun %s installed at %s/bin/bun\n' "$installed" "$prefix"
