"""Private lookup forwarding, preserving other tunnels and SSH restrictions."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('tunnels', Path(__file__).with_name('isolated-tunnels.py'))
tunnels = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tunnels)

with TemporaryDirectory() as directory:
    home = Path(directory)
    (home / '.ssh').mkdir()
    path = home / '.ssh/authorized_keys'
    original = '# preserve\nrestrict,port-forwarding,command="false",permitlisten="127.0.0.1:18503" ssh-ed25519 fixture\n'
    path.write_text(original)
    with patch.object(tunnels.pathlib.Path, 'home', return_value=home):
        tunnels.authorize()
        once = path.read_text()
        tunnels.authorize()
    assert path.read_text() == once
    assert once.startswith('# preserve\n') and once.endswith(' ssh-ed25519 fixture\n')
    assert 'restrict,port-forwarding,command="false"' in once
    assert once.count('permitlisten="127.0.0.1:28099"') == 1
    assert (home / '.ssh/authorized_keys.before-isolated-tunnels').read_text() == original
    path.write_text('ssh-ed25519 unexpected\n')
    with patch.object(tunnels.pathlib.Path, 'home', return_value=home):
        try:
            tunnels.authorize()
            raise AssertionError('Unexpected credentials must not be modified')
        except RuntimeError:
            assert path.read_text() == 'ssh-ed25519 unexpected\n'

calls = []
def run(command, **kwargs):
    calls.append(command)
    return SimpleNamespace(returncode=1 if command[:2] == ['docker', 'inspect'] else 0, stdout='')

with patch.object(tunnels.subprocess, 'run', side_effect=run):
    tunnels.start('fixture-image', 'pwned')
launch = next(c for c in calls if c[:2] == ['docker', 'run'])
assert launch[launch.index('--name') + 1] == 'hanasand-tunnel-pwned'
assert launch[launch.index('-R') + 1] == '127.0.0.1:28099:127.0.0.1:8099'
assert 'StrictHostKeyChecking=yes' in launch and 'ExitOnForwardFailure=yes' in launch
assert not any(c[:2] == ['docker', 'stop'] for c in calls)
assert sum(c[:2] == ['docker', 'run'] for c in calls) == 1
print('Private lookup tunnel, isolated start and SSH restriction checks passed.')
