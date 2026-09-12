from pathlib import Path
import re, subprocess, tempfile, os
source=Path('scripts/install-ssh-gateway.sh').read_text()
with tempfile.TemporaryDirectory(prefix='vm-deletion-ssh-') as root:
 root=Path(root)
 logger=root/'logger';logger.write_text('#!/bin/sh\nexit 0\n');logger.chmod(0o700)
 mock=root/'lxc'
 mock.write_text('''#!/bin/sh
printf '%s\\n' "$*" >> "$PROBE_CALLS"
case "$1 $2" in
 'config get') if [ "$PROBE_MODE" = failure ]; then exit 1; fi; printf '%s' "$PROBE_MARKER";;
 'info '*) printf 'Status: STOPPED\\n';;
 'exec '*) printf 'fixture-key\\n';;
esac
''');mock.chmod(0o700)
 for name in ['hanasand-vm-authorized-keys','hanasand-vm-ssh-dispatch-root']:
  code=re.search(r'cat >/usr/local/sbin/'+name+r" <<'SH'\n(.*?)\nSH",source,re.S).group(1)
  script=root/name;script.write_text(code);script.chmod(0o700)
  for mode,marker,blocked in [('normal','2026-10-12',True),('failure','',True),('normal','',False)]:
   calls=root/'calls';calls.write_text('')
   env={**os.environ,'PATH':str(root)+':'+os.environ['PATH'],'LXC_BIN':str(mock),'PROBE_CALLS':str(calls),'PROBE_MODE':mode,'PROBE_MARKER':marker,'HANASAND_GATEWAY_USER':'cashflow'}
   result=subprocess.run(['bash',str(script),'cashflow'],env=env,capture_output=True,text=True)
   invoked=calls.read_text()
   if blocked:
    assert result.returncode!=0,(name,result)
    assert 'start cashflow' not in invoked and 'exec cashflow' not in invoked,invoked
   else: assert result.returncode==0,(name,result.stderr)
 print('SSH guards passed: pending deletion and failed config checks never start a VM or open a session; normal login preserved.')
