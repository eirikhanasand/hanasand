#!/bin/sh
set -eu
root=/home/hanasand/hanasand
branch=$(git -C "$root" symbolic-ref --quiet --short HEAD || true)
if test "$branch" != main; then
    echo "Production builds are allowed only from the main branch (current: ${branch:-detached})." >&2
    exit 1
fi
release=${HANASAND_RELEASE_COMMIT:-}
if test -n "$release" && ! git -C "$root" merge-base --is-ancestor "$release" main; then
    echo "Production releases must be commits on main." >&2
    exit 1
fi
