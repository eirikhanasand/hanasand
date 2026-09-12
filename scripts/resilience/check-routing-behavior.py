#!/usr/bin/env python3
"""Isolated production-policy routing check; requires Docker and unused ports 29981-29985/19999."""
import importlib.util,json,pathlib,threading,time,subprocess,urllib.request,csv,io,tempfile
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
r=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('render',r/'render_proxy.py'); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
state={'delay':3,'down':False}
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  primary=self.server.server_port==29981
  if primary:time.sleep(state['delay'])
  body=b'primary' if primary else b'backup'
  self.send_response(503 if primary and state['down'] else 200);self.end_headers()
  try:self.wfile.write(body)
  except BrokenPipeError:pass
 def log_message(self,*args):pass
servers=[ThreadingHTTPServer(('127.0.0.1',p),Handler) for p in (29981,29982)]
for server in servers:threading.Thread(target=server.serve_forever,daemon=True).start()
config={'proxyIndex':90,'statsPort':29985,'services':[{'id':'test','listenPort':29983,'checkPath':'/ready','instances':[{'id':'primary','address':'127.0.0.1:29981'},{'id':'backup','address':'127.0.0.1:29982'}]}]}
folder=tempfile.TemporaryDirectory(prefix='hanasand-routing-check-'); path=pathlib.Path(folder.name);path.chmod(0o755);(path/'test.cfg').write_text(m.render(config))
name='hanasand-failover-probe-test'
image='haproxy@sha256:de601ccc9a79b715055bc5c8d51ff357edca04c1e869f4209f02bf6872fde8ac'
def fetch(port,route='/'):
 return urllib.request.urlopen(f'http://127.0.0.1:{port}{route}',timeout=8).read().decode()
def status():
 rows=csv.DictReader(io.StringIO(fetch(29985,'/stats;csv').lstrip('# ')))
 return {r['svname']:r['status'] for r in rows if r['svname'] in ('primary','backup')}
def until(predicate,limit):
 end=time.monotonic()+limit
 while time.monotonic()<end:
  try:
   if predicate():return
  except OSError:pass
  time.sleep(1)
 raise AssertionError('Timed out waiting for expected route')
try:
 subprocess.run(['docker','run','-d','--name',name,'--network','host','-v',str(path)+':/check:ro','--tmpfs','/run/haproxy:mode=700,uid=99,gid=99',image,'haproxy','-db','-f','/check/test.cfg'],check=True,stdout=subprocess.DEVNULL)
 until(lambda:status().get('primary')=='UP',10)
 for _ in range(5):
  assert fetch(29983)=='primary';assert status()['primary'].startswith('UP');time.sleep(2)
 print('PASS: 3-second healthy responses remain on primary (old 2-second deadline would fail).',flush=True)
 state.update(delay=0,down=True)
 until(lambda:status()['primary'].startswith('DOWN'),35)
 assert fetch(29983)=='backup';print('PASS: sustained 503 switches to backup.',flush=True)
 state['down']=False
 until(lambda:status()['primary']=='UP',65)
 assert fetch(29983)=='primary';print('PASS: sustained recovery returns to primary with production rise threshold.',flush=True)
finally:
 subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,check=False)
 for server in servers:server.shutdown()
 folder.cleanup()
