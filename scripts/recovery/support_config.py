"""Load only the private support routing settings needed by an API process."""
import json
from pathlib import Path


def support_settings(path='/home/hanasand/runtime/support.json', worker=False):
    source = Path(path)
    if not source.exists():
        return {}
    config = json.loads(source.read_text())
    key = config.get('SUPPORT_SERVICE_KEY', '')
    base = config.get('SUPPORT_SERVICE_BASE', '')
    if len(key) < 32 or base not in ('http://127.0.0.1:29181', 'http://127.0.0.1:19181'):
        raise RuntimeError('Invalid private support routing configuration')
    return {'SUPPORT_SERVICE_KEY': key, **({} if worker else {'SUPPORT_SERVICE_BASE': base})}
