#!/usr/bin/env python3
"""Read OVH telemetry through the existing loopback-only SSH tunnel."""
import datetime
import json
from pathlib import Path
import urllib.request


def read_snapshot():
    with urllib.request.urlopen('http://127.0.0.1:19911/status', timeout=5) as response:
        raw = response.read(1_048_577)
    if len(raw) > 1_048_576:
        raise ValueError('OVH status response is too large')
    status = json.loads(raw)
    if status.get('site') != 'ovhcloud':
        raise ValueError('Expected OVH telemetry')
    host = status.get('hostMetrics')
    if not isinstance(host, dict):
        raise ValueError('OVH host telemetry is unavailable')
    sampled = datetime.datetime.fromisoformat(host['sampledAt'].replace('Z', '+00:00'))
    age = (datetime.datetime.now(datetime.timezone.utc) - sampled).total_seconds()
    if age < -5 or age > 90:
        raise ValueError('OVH host telemetry is stale')
    return host


if __name__ == '__main__':
    destination = Path('/var/lib/hanasand/metrics/ovhcloud.json')
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(read_snapshot(), allow_nan=False))
    temporary.chmod(0o644)
    temporary.replace(destination)
