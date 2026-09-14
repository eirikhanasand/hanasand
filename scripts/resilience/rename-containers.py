#!/usr/bin/env python3
"""Rename existing service containers and their operational references without restarting them."""
import argparse
import fcntl
import json
from pathlib import Path
import re
import subprocess
from container_names import simple_name


def rewrite(value):
    if isinstance(value, str):
        return simple_name(value)
    if isinstance(value, list):
        return [rewrite(item) for item in value]
    if isinstance(value, dict):
        return {key: rewrite(item) for key, item in value.items()}
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    args = parser.parse_args()
    with open('/tmp/hanasand-frontend-deploy.lock', 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        ids = subprocess.check_output(['docker', 'ps', '-aq'], text=True).split()
        containers = json.loads(subprocess.check_output(['docker', 'inspect', *ids]))
        existing = {item['Name'].lstrip('/') for item in containers}
        plan = [(item, simple_name(item['Name'].lstrip('/'))) for item in containers
                if simple_name(item['Name'].lstrip('/')) != item['Name'].lstrip('/')]
        targets = [name for _, name in plan]
        if len(targets) != len(set(targets)) or any(name in existing for name in targets):
            raise SystemExit('Container name collision; nothing changed.')
        originals = {}
        renamed = []
        try:
            config = args.root / 'config.json'
            originals[config] = config.read_text()
            replacement = rewrite(json.loads(originals[config]))
            backup = config.with_name(config.name + '.before-container-names')
            if not backup.exists():
                backup.write_text(originals[config])
                backup.chmod(0o600)
            temporary = config.with_suffix('.names.tmp')
            temporary.write_text(json.dumps(replacement, indent=2) + '\n')
            temporary.chmod(config.stat().st_mode & 0o777)
            temporary.replace(config)
            # These local recovery helpers predate the tracked deployment scripts.
            for filename in ('replace-recovery.py', 'upgrade-routers.py'):
                path = args.root / filename
                if not path.exists():
                    continue
                originals[path] = path.read_text()
                text = re.sub(r"hanasand-resilience-[a-z0-9-]+", lambda match: simple_name(match[0]), originals[path])
                text = text.replace("'hanasand-resilience-proxy-'+str(index)", "'hanasand-proxy-'+str(index + 1)")
                path.write_text(text)
            source = Path(__file__).resolve().parent
            for filename in ('container_names.py', 'start-inspur-pair.py', 'deploy-pair.sh',
                             'start-routing.sh', 'start-tunnel.sh', 'isolated-tunnels.py', 'configure.py'):
                path = args.root / filename
                if not path.exists() and filename != 'container_names.py':
                    continue
                originals[path] = path.read_text() if path.exists() else None
                path.write_text((source / filename).read_text())
            for item, target in plan:
                old = item['Name'].lstrip('/')
                subprocess.run(['docker', 'rename', item['Id'], target], check=True)
                renamed.append((item['Id'], old))
                after = json.loads(subprocess.check_output(['docker', 'inspect', item['Id']]))[0]
                assert after['Name'] == '/' + target
                assert after['State']['StartedAt'] == item['State']['StartedAt']
                assert after['State']['Running'] == item['State']['Running']
                print(f'{old} -> {target}', flush=True)
        except Exception:
            for identifier, old in reversed(renamed):
                subprocess.run(['docker', 'rename', identifier, old], check=True)
            for path, text in originals.items():
                if text is None:
                    path.unlink()
                else:
                    path.write_text(text)
            raise
        print(f'Verified {len(plan)} renames; no container was restarted.', flush=True)


if __name__ == '__main__':
    main()
