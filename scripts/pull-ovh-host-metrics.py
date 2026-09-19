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
    # This endpoint is only available through the private loopback tunnel.
    # A diagnostic outage must not interrupt the fast host health telemetry.
    try:
        with urllib.request.urlopen('http://127.0.0.1:19911/disk-diagnostics', timeout=3) as response:
            raw = response.read(1_048_577)
        diagnostics = json.loads(raw) if len(raw) <= 1_048_576 else None
    except (OSError, ValueError):
        diagnostics = None
    return host, diagnostics


if __name__ == '__main__':
    host, diagnostics = read_snapshot()
    if isinstance(diagnostics, dict):
        diagnostic_path = Path('/var/lib/hanasand/metrics/ovhcloud-disk-directories.json')
        diagnostic_tmp = diagnostic_path.with_suffix('.tmp')
        diagnostic_tmp.write_text(json.dumps(diagnostics, allow_nan=False))
        diagnostic_tmp.chmod(0o644)
        diagnostic_tmp.replace(diagnostic_path)
    destination = Path('/var/lib/hanasand/metrics/ovhcloud.json')
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(host, allow_nan=False))
    temporary.chmod(0o644)
    temporary.replace(destination)
