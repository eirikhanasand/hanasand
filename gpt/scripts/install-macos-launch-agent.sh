#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
GPT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$GPT_DIR/.." && pwd)"
LABEL="com.hanasand.model"
SOURCE_PLIST="$GPT_DIR/launchd/$LABEL.plist"
RUNTIME_ROOT="$HOME/Library/Application Support/HanasandModel"
RUNTIME_DIR="$RUNTIME_ROOT/current"
SOURCE_ENV="$(CDPATH= cd -- "$GPT_DIR/.." && pwd)/.env"
RUNTIME_ENV="$RUNTIME_ROOT/.env"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="$TARGET_DIR/$LABEL.plist"
GUI_DOMAIN="gui/$(id -u)"

if [ ! -f "$SOURCE_PLIST" ]; then
  echo "Missing launchd plist: $SOURCE_PLIST" >&2
  exit 1
fi

mkdir -p "$RUNTIME_ROOT" "$TARGET_DIR" "$HOME/Library/Logs"

if [ ! -d "$RUNTIME_DIR" ]; then
  echo "Creating launchd-safe runtime mirror at $RUNTIME_DIR"
  cp -cR "$GPT_DIR" "$RUNTIME_DIR"
else
  echo "Refreshing launchd-safe runtime mirror at $RUNTIME_DIR"
  rsync -a --delete \
    --exclude '.git' \
    --exclude 'models' \
    --exclude 'runtime' \
    "$GPT_DIR/" "$RUNTIME_DIR/"
fi

if [ -f "$SOURCE_ENV" ]; then
  cp "$SOURCE_ENV" "$RUNTIME_ENV"
  chmod 600 "$RUNTIME_ENV"
fi

if grep -q '^HANASAND_REPO_ROOT=' "$RUNTIME_ENV" 2>/dev/null; then
  perl -0pi -e "s#^HANASAND_REPO_ROOT=.*\$#HANASAND_REPO_ROOT=$REPO_ROOT#m" "$RUNTIME_ENV"
else
  printf '\nHANASAND_REPO_ROOT=%s\n' "$REPO_ROOT" >> "$RUNTIME_ENV"
fi
chmod 600 "$RUNTIME_ENV"

sed "s#__HOME__#$HOME#g" "$SOURCE_PLIST" > "$TARGET_PLIST"
chmod 644 "$TARGET_PLIST"

launchctl bootout "$GUI_DOMAIN/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "$GUI_DOMAIN" "$TARGET_PLIST"
launchctl enable "$GUI_DOMAIN/$LABEL"
launchctl kickstart -k "$GUI_DOMAIN/$LABEL"

echo "Installed and started $LABEL"
echo "Status: launchctl print $GUI_DOMAIN/$LABEL"
echo "Logs:   $HOME/Library/Logs/hanasand-model.log"
echo "Errors: $HOME/Library/Logs/hanasand-model.err.log"
