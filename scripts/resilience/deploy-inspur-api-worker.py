import fcntl,json,os,re,subprocess,sys,tempfile,time,urllib.request
from pathlib import Path
release=sys.argv[1]
if not re.fullmatch(r'[0-9a-f]{40}', release):
    raise SystemExit('Pass the full built release commit.')
image='hanasand-resilience-api:'+release
root='/home/hanasand/hanasand'
lock=open('/tmp/hanasand-frontend-deploy.lock','a')
fcntl.flock(lock,fcntl.LOCK_EX)
original=json.loads(subprocess.check_output(['docker','inspect','hanasand_api']))[0]
settings=dict(value.split('=',1) for value in original['Config']['Env'])
assert settings.get('API_HTTP_ONLY','0') != '1'
subprocess.run(['docker','image','inspect',image],check=True,stdout=subprocess.DEVNULL)
with tempfile.NamedTemporaryFile(mode='w',suffix='.json',prefix='monitoring-worker-',delete=False) as temporary:
    override=temporary.name
os.chmod(override,0o600)
def apply(target,env):
    Path(override).write_text(json.dumps({'services':{'api':{'image':target,'command':original['Config']['Cmd'],'environment':env,'stop_grace_period':'65s'}}}))
    subprocess.run(['docker','compose','-f','docker-compose.yml','-f',override,'up','-d','--no-deps','--no-build','api'],cwd=root,check=True)
def ready(expected):
    for _ in range(90):
        try:
            with urllib.request.urlopen('http://127.0.0.1:8080/ready',timeout=3) as response:
                state=json.load(response)
                if state.get('ok') and state.get('release')==expected:return
        except Exception:pass
        time.sleep(2)
    raise RuntimeError('Scheduled worker readiness failed')
try:
    try:
        # This worker owns the Inspur LXD socket; do not inherit the old OVH default.
        apply(image,{**settings,'HANASAND_RELEASE_COMMIT':release,'VM_HOST_ID':'inspur'})
        ready(release)
    except Exception:
        apply(original['Image'],settings)
        ready(settings.get('HANASAND_RELEASE_COMMIT','unknown'))
        raise
    print('Scheduled worker ready at '+release,flush=True)
finally:
    os.unlink(override)
