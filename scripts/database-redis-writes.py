#!/usr/bin/env python3
"""Observe Redis write notifications without reading or retaining values."""
import json
import selectors
import subprocess
import time
from pathlib import Path
from importlib.util import module_from_spec, spec_from_file_location

spec = spec_from_file_location('metrics', Path(__file__).with_name('database-metrics.py'))
metrics = module_from_spec(spec)
spec.loader.exec_module(metrics)


def main():
    destination = Path('/var/lib/hanasand/metrics/database-redis-writes.json')
    try:
        writes = json.loads(destination.read_text())
    except (OSError, ValueError):
        writes = {}
    selector = selectors.DefaultSelector()
    processes = {}
    discovered = flushed = 0
    try:
        while True:
            now = time.time()
            if now - discovered > 30:
                discovered = now
                ids = metrics.command(['docker', 'ps', '-q']).splitlines()
                items = json.loads(metrics.command(['docker', 'inspect', *ids])) if ids else []
                for item in items:
                    if metrics.engine_for(item) != 'Redis':
                        continue
                    name = item['Name'].lstrip('/')
                    if name in processes:
                        continue
                    # Preserve existing notification flags. E+A reports mutations,
                    # expiry and eviction, never GET values or application payloads.
                    current = json.loads(metrics.command(['docker', 'exec', item['Id'], 'redis-cli', '--json', 'CONFIG', 'GET', 'notify-keyspace-events']))
                    flags = current.get('notify-keyspace-events', '') if isinstance(current, dict) else current[1]
                    metrics.command(['docker', 'exec', item['Id'], 'redis-cli', 'CONFIG', 'SET', 'notify-keyspace-events', ''.join(sorted(set(flags + 'EA')))])
                    process = subprocess.Popen(['docker', 'exec', item['Id'], 'redis-cli', '--json', 'PSUBSCRIBE', '__keyevent@*__:*'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=0)
                    processes[name] = process
                    selector.register(process.stdout, selectors.EVENT_READ, name)
            for key, _ in selector.select(timeout=1):
                line = key.fileobj.readline()
                name = key.data
                if not line:
                    selector.unregister(key.fileobj)
                    processes.pop(name).wait()
                    continue
                try:
                    event = json.loads(line)
                    if len(event) != 4 or event[0] != 'pmessage':
                        continue
                    database = 'db' + event[2].split('@', 1)[1].split('__:', 1)[0]
                    writes[json.dumps([name, database, event[3]], ensure_ascii=False, separators=(',', ':'))] = time.time()
                except (ValueError, IndexError, TypeError):
                    continue
            if now - flushed >= 5:
                # Keep metadata bounded; no values or command bodies are retained.
                writes = dict(sorted(((key, at) for key, at in writes.items() if now - at < 7 * 86400), key=lambda entry: entry[1])[-100000:])
                metrics.atomic_write(destination, writes)
                flushed = now
    finally:
        for process in processes.values():
            process.terminate()
        selector.close()


if __name__ == '__main__':
    main()
