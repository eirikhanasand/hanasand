# Hanasand Desktop App + Agent

Native macOS desktop app with an embedded loopback agent. The UI is built for fast agentic work: project rail, transcript, local status, Hanasand actions, and a bottom command dock. The embedded agent exposes the same safe local API that the phone app can call.

## Run the Desktop GUI

```sh
swift run Hanasand
```

The app starts a local agent on `http://127.0.0.1:45731` and keeps the status visible in the title bar and transcript.

## Native Features

- Command-first local control surface.
- Native dashboard panels for Hanasand website, admin, share, VM, logs, database, backups, restore, notes, traffic, and vulnerability pages.
- Real local Mac status through the embedded loopback agent.
- Mail overview loader using the real Hanasand mail API.
- Hanasand AI model check and prompt endpoint wiring.
- Server controls for VPN, RDP, start, stop, and logs.
- Settings for API URLs, auth token, user id, desktop agent URL, VPN, RDP, and server paths.

## Package an Auto Update

```sh
HANASAND_APP_VERSION=0.1.2 app/desktop/scripts/package-update.sh
```

The script builds a release `.app`, signs it ad-hoc unless `HANASAND_CODESIGN_IDENTITY` is set, and writes `dist/Hanasand-<version>-macos.zip` plus `dist/manifest.json`.
Deploy the zip to the API host and set:

```sh
HANASAND_APP_UPDATE_FILE=/srv/hanasand/app-updates/Hanasand-<version>-macos.zip
HANASAND_APP_VERSION=<version>
```

## Run the macOS Update Runner

The Forgejo workflow needs a macOS runner because SwiftUI apps cannot be built in the Linux git container. To avoid an always-on remote execution agent, run the macOS runner in the foreground only when publishing desktop updates:

```sh
app/desktop/scripts/run-macos-runner-once.sh
```

The script builds the Forgejo runner locally if needed, registers it with `macos` and `macos-arm64` labels, and runs it until you stop it with `Ctrl-C`.

## Embedded Agent Endpoints

- `GET /health`
- `GET /status`
- `POST /command` with `{ "command": "status" }`

Only the safe `status` command is enabled. Add future actions as explicit allowlist entries.

## Legacy C++ Agent

The small C++ loopback agent is still available when a GUI is not needed.

### Build

```sh
clang++ -std=c++17 -O2 -Wall -Wextra main.cpp -o build/hanasand-agent
```

On Windows, build with a C++17 compiler and link Winsock.

### Run

```sh
./build/hanasand-agent 45731
```

The agent binds only to `127.0.0.1` by default. The iOS simulator can reach it through `http://127.0.0.1:45731`.
