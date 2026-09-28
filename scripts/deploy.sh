#!/bin/sh
set -eu
exec "$(dirname "$0")/deploy-all.sh" "$@"
