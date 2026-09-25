"""Load private verification keys only into log-processing API processes."""
import json
import re
import stat
from pathlib import Path


def probe_verification_settings(path='/home/hanasand/runtime/probe-verification.json'):
    source = Path(path)
    if not source.exists():
        return {}
    mode = source.lstat().st_mode
    if not stat.S_ISREG(mode) or mode & 0o077:
        raise RuntimeError('Probe verification configuration must be a private regular file')
    config = json.loads(source.read_text())
    allowed = {'MODEL_PROBE_PROOF_KEY', 'READINESS_AUDIT_PROOF_PUBLIC_KEY'}
    if (not isinstance(config, dict) or not config or not set(config) <= allowed
            or not all(isinstance(value, str) and re.fullmatch(r'[a-f0-9]{64}', value)
                       for value in config.values())):
        raise RuntimeError('Invalid probe verification configuration')
    return config
