#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
export HANASAND_MODEL_PROFILE="${HANASAND_MODEL_PROFILE:-validation}"
exec "$SCRIPT_DIR/run_model_common.sh" mac
