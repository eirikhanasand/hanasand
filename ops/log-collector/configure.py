#!/usr/bin/env python3
"""Set a host's protected ingest configuration; credential input is never printed."""
import datetime
import json
from pathlib import Path
import sys

host, credential_path = sys.argv[1:3]
path = Path(sys.argv[3] if len(sys.argv) > 3 else '/etc/hanasand/log-collector.json')
credential = json.load(sys.stdin) if credential_path == '-' else json.loads(Path(credential_path).read_text())
token = credential['LOG_INGEST_TOKEN']
if not isinstance(token, str) or len(token) < 32: raise ValueError('Invalid ingestion credential')
config = json.loads(path.read_text()) if path.exists() else {'start':datetime.datetime.now(datetime.timezone.utc).isoformat()}
config.update(host=host, url='https://api.hanasand.com/api/logs/ingest', token=token)
path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
temporary = path.with_suffix('.tmp')
temporary.touch(mode=0o600, exist_ok=True)
temporary.chmod(0o600)
temporary.write_text(json.dumps(config))
temporary.replace(path)
