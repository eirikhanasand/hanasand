#!/usr/bin/env python3
"""Bounded, low-priority directory diagnostics for high-storage incidents."""
import datetime
import heapq
import json
import os
from pathlib import Path
import selectors
import signal
import socket
import subprocess
import sys
import time


def largest_directories(root, timeout=120):
    root = os.path.abspath(root)
    process = subprocess.Popen(['du', '-x', '-B1', '--null', '--', root],
                               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, start_new_session=True)
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    deadline, buffer, largest, timed_out = time.monotonic() + timeout, b'', [], False
    try:
        while True:
            if time.monotonic() >= deadline:
                timed_out = True
                break
            ready = selector.select(min(1, max(0, deadline - time.monotonic())))
            if not ready:
                continue
            chunk = os.read(process.stdout.fileno(), 65536)
            if not chunk:
                break
            buffer += chunk
            while b'\0' in buffer:
                row, buffer = buffer.split(b'\0', 1)
                size, _, path = row.partition(b'\t')
                path = os.fsdecode(path)
                if size.isdigit() and path != root:
                    heapq.heappush(largest, (int(size), path))
                    if len(largest) > 20:
                        heapq.heappop(largest)
        if timed_out:
            os.killpg(process.pid, signal.SIGKILL)
        code = process.wait(timeout=5)
    finally:
        selector.close()
        process.stdout.close()
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
    return {'complete': not timed_out and code == 0,
            'directories': [{'path': path, 'sizeBytes': size} for size, path in sorted(largest, reverse=True)]}


def collect(snapshot):
    sampled = datetime.datetime.fromisoformat(snapshot['sampledAt'].replace('Z', '+00:00'))
    age = (datetime.datetime.now(datetime.timezone.utc) - sampled).total_seconds()
    if age < -5 or age > 90:
        raise ValueError('Host telemetry is stale')
    filesystems = []
    for filesystem in snapshot.get('storage', []):
        if filesystem.get('usedPercent', 0) < 80:
            continue
        path = filesystem['path']
        filesystems.append({'path': path, 'usedPercent': filesystem['usedPercent'], **largest_directories(path)})
    return {'sampledAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'host': socket.gethostname(), 'filesystems': filesystems}


if __name__ == '__main__':
    metrics = Path(sys.argv[1] if len(sys.argv) > 1 else '/var/lib/hanasand/metrics/host.json')
    destination = metrics.with_name('disk-directories.json')
    snapshot = json.loads(metrics.read_text())
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(collect(snapshot)))
    temporary.chmod(0o644)
    temporary.replace(destination)
