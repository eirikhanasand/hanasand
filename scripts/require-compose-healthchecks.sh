#!/bin/sh
set -eu

root=$(git rev-parse --show-toplevel)
cd "$root"
docker compose -f "$root/docker-compose.yml" config --format json | python3 -c '
import json
import sys

services = json.load(sys.stdin).get("services", {})
missing = []
for name, service in services.items():
    healthcheck = service.get("healthcheck") or {}
    test = healthcheck.get("test")
    if healthcheck.get("disable") or not isinstance(test, list) or not test or test[0] == "NONE":
        missing.append(name)

if missing:
    print("Docker healthchecks are required for every Hanasand Compose service; missing: " + ", ".join(missing), file=sys.stderr)
    sys.exit(1)
print(f"Docker healthchecks are configured for all {len(services)} Hanasand Compose services.")
'
