#!/usr/bin/env python3
"""Read saved update events from stdin; emit version enrichments proven by local dpkg logs."""
import gzip
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


def enrich(events, log_lines):
    records = {}
    for line in log_lines:
        parts = line.split()
        if len(parts) != 6 or parts[2:4] != ['status', 'installed']:
            continue
        try:
            # dpkg uses the host timezone; both supported hosts currently use UTC.
            at = datetime.fromisoformat(' '.join(parts[:2])).astimezone(timezone.utc)
        except ValueError:
            continue
        records.setdefault(parts[4], []).append((at, parts[5]))
    events = sorted(events, key=lambda event: event['occurred_at'])
    updates = []
    for index, event in enumerate(events):
        start = datetime.fromisoformat(event['occurred_at'].replace('Z', '+00:00'))
        end = start + timedelta(hours=6)
        if index + 1 < len(events):
            end = min(end, datetime.fromisoformat(events[index + 1]['occurred_at'].replace('Z', '+00:00')))
        installed = []
        changed = False
        for item in event['installed']:
            item = dict(item)
            if not item.get('version'):
                name = item['package']
                matching = [record for package, values in records.items()
                            if package == name or ':' not in name and package.split(':')[0] == name
                            for record in values if start <= record[0] < end]
                versions = {version for _, version in matching}
                # Never substitute today's version or guess between multiple installs.
                if len(versions) == 1:
                    item['version'] = versions.pop()
                    changed = True
            installed.append(item)
        if changed:
            updates.append({'run_id': event['run_id'], 'installed': installed})
    return updates


if __name__ == '__main__':
    def lines():
        for path in Path('/var/log').glob('dpkg.log*'):
            opener = gzip.open if path.suffix == '.gz' else open
            with opener(path, 'rt', errors='replace') as log:
                yield from log
    json.dump(enrich(json.load(sys.stdin), lines()), sys.stdout)
    print()
