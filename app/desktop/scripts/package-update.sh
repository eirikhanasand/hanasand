#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${HANASAND_APP_VERSION:-$(git -C "$ROOT_DIR/../.." rev-parse --short HEAD)}"
DIST_DIR="${ROOT_DIR}/dist"
BUILD_DIR="${ROOT_DIR}/.build/release"
APP_DIR="${DIST_DIR}/Hanasand.app"
PACKAGE_PATH="${DIST_DIR}/Hanasand-${VERSION}-macos.zip"

rm -rf "$APP_DIR" "$PACKAGE_PATH"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources" "$DIST_DIR"

swift build --package-path "$ROOT_DIR" -c release

cp "$BUILD_DIR/Hanasand" "$APP_DIR/Contents/MacOS/Hanasand"
chmod +x "$APP_DIR/Contents/MacOS/Hanasand"

cat > "$APP_DIR/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Hanasand</string>
  <key>CFBundleIdentifier</key>
  <string>com.hanasand.desktop</string>
  <key>CFBundleName</key>
  <string>Hanasand</string>
  <key>CFBundleDisplayName</key>
  <string>Hanasand</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${VERSION}</string>
  <key>CFBundleVersion</key>
  <string>${VERSION}</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

if [[ -n "${HANASAND_CODESIGN_IDENTITY:-}" ]]; then
  codesign --force --deep --options runtime --sign "$HANASAND_CODESIGN_IDENTITY" "$APP_DIR"
else
  codesign --force --deep --sign - "$APP_DIR"
fi

(
  cd "$DIST_DIR"
  ditto -c -k --keepParent "Hanasand.app" "$(basename "$PACKAGE_PATH")"
)

SHA256="$(shasum -a 256 "$PACKAGE_PATH" | awk '{print $1}')"
SIZE="$(stat -f%z "$PACKAGE_PATH")"

cat > "${DIST_DIR}/manifest.json" <<JSON
{
  "app": "hanasand-desktop",
  "platform": "macos",
  "version": "${VERSION}",
  "package": "$(basename "$PACKAGE_PATH")",
  "sha256": "${SHA256}",
  "size": ${SIZE}
}
JSON

printf '%s\n' "$PACKAGE_PATH"
