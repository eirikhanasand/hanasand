"""Exercise staged deployment and rollback without Docker or production requests."""
import io
import json
from pathlib import Path
import runpy
from types import SimpleNamespace
from unittest.mock import patch

script = Path(__file__).with_name('deploy-ovh-frontend.py')
release = 'a' * 40
original = {'Config': {'Env': ['PORT=19300', 'PRIVATE_VALUE=fixture']},
            'HostConfig': {'NetworkMode': 'host', 'Memory': 2147483648, 'NanoCpus': 1000000000,
                           'RestartPolicy': {'Name': 'unless-stopped'}, 'ExtraHosts': ['kept:127.0.0.2']},
            'State': {'Running': True},
            'Mounts': [{'Type': 'bind', 'Source': '/fixture', 'Destination': '/resilience', 'RW': False}]}

for failure in (None, 'candidate', 'serving', 'rename'):
    calls = []
    def run(command, **kwargs):
        calls.append(command)
        if failure == 'rename' and command[:3] == ['docker', 'rename', 'hanasand-frontend']:
            raise RuntimeError('rename failed')
        if command[:2] == ['docker', 'run']:
            assert kwargs['env']['PRIVATE_VALUE'] == 'fixture'
            assert 'PRIVATE_VALUE=fixture' not in command
            assert kwargs['env']['COMPACT_PWNED_RANGE_API'] == 'http://127.0.0.1:28099/range'
            assert '/fixture:/resilience:ro' in command and 'kept:127.0.0.2' in command
        return SimpleNamespace(returncode=1 if command[:2] == ['docker', 'inspect'] else 0)
    class Response(io.BytesIO):
        status = 200
        headers = {'Content-Type': 'application/vnd.hanasand.pwned-prefix'}
    def urlopen(request, **kwargs):
        url = request if isinstance(request, str) else request.full_url
        corrupt = ('19301' in url and failure == 'candidate') or ('19300' in url and failure == 'serving')
        return Response(b'incorrect' if corrupt else b'PWNPRF02' + (3).to_bytes(4, 'little'))
    with patch('sys.argv', [str(script), release]), patch('subprocess.run', side_effect=run), \
         patch('subprocess.check_output', return_value=json.dumps([original]).encode()), \
         patch('urllib.request.urlopen', side_effect=urlopen), patch('fcntl.flock'), \
         patch('builtins.open', return_value=io.StringIO()), patch('socket.socket'):
        try:
            runpy.run_path(str(script), run_name='__main__')
            assert failure is None
        except RuntimeError:
            assert failure is not None
    if failure == 'candidate':
        assert ['docker', 'stop', 'hanasand-frontend'] not in calls
    if failure == 'serving':
        assert ['docker', 'rename', 'hanasand-frontend-before-' + release[:12], 'hanasand-frontend'] in calls
    if failure in ('serving', 'rename'):
        assert ['docker', 'start', 'hanasand-frontend'] in calls
print('OVH staged deployment, preserved runtime and rollback checks passed.')
