import fcntl,json,os,re,subprocess,sys,tempfile,time,urllib.request
from pathlib import Path
from support_config import support_settings
release=sys.argv[1]
if not re.fullmatch(r'[0-9a-f]{40}', release):
    raise SystemExit('Pass the full built release commit.')
catchup={}
for key,minimum,maximum in [('LOG_CATCHUP_BATCH_LIMIT',1,1000),('LOG_CATCHUP_HISTORY_LIMIT',1,10000),('LOG_CATCHUP_INTERVAL_MS',50,5000)]:
    if key in os.environ:
        value=os.environ[key]
        if not value.isdecimal() or not minimum <= int(value) <= maximum:
            raise SystemExit(f'{key} must be an integer from {minimum} to {maximum}.')
        catchup[key]=value
image='hanasand-resilience-api:'+release
root='/home/hanasand/hanasand'
lock=open('/tmp/hanasand-frontend-deploy.lock','a')
fcntl.flock(lock,fcntl.LOCK_EX)
# Worker startup changes schemas. Queuing those changes behind an online index
# build also queues ordinary reads, even though the build itself allows them.
index_builds=subprocess.check_output(['docker','exec','hanasand_database','psql','-X','-At','-v','ON_ERROR_STOP=1','-U','hanasand','-d','hanasand',
    '-c',"SELECT count(*) FROM pg_stat_progress_create_index WHERE datname=current_database()"],text=True).strip()
if index_builds != '0':
    raise SystemExit('Wait for the database index build to finish before restarting the scheduled worker. The existing worker has been left running.')
original=json.loads(subprocess.check_output(['docker','inspect','hanasand_api']))[0]
settings=dict(value.split('=',1) for value in original['Config']['Env'])
settings.update(support_settings(worker=True))
settings['DB_BACKUP_WORKER_SOCKET']='/var/lib/hanasand/backups/database/.worker.sock'
# Collectors receive a credential that authenticates only log ingestion.
log_ingest_file = Path('/home/hanasand/resilience/log-ingest.json')
if log_ingest_file.exists():
    log_ingest = json.loads(log_ingest_file.read_text())
    if not isinstance(log_ingest, dict) or set(log_ingest) != {'LOG_INGEST_TOKEN'} or not isinstance(log_ingest['LOG_INGEST_TOKEN'], str) or len(log_ingest['LOG_INGEST_TOKEN']) < 32:
        raise SystemExit('Invalid log ingestion configuration')
    settings.update(log_ingest)

mail_file = Path('/home/hanasand/resilience/mail.json')
if mail_file.exists():
    mail = json.loads(mail_file.read_text())
    allowed = {'MAIL_ADMIN_USERNAME', 'MAIL_ADMIN_PASSWORD', 'MAIL_SERVICE_KEY', 'MAIL_SYSTEM_SENDER_PASSWORD', 'MAIL_INTERNAL_URL', 'MAIL_SMTP_INTERNAL_PORT'}
    if not isinstance(mail, dict) or not set(mail) <= allowed or not all(isinstance(v, str) and v for v in mail.values()):
        raise SystemExit('Invalid mail runtime configuration')
    settings.update(mail)

assert settings.get('API_HTTP_ONLY','0') != '1'
subprocess.run(['docker','image','inspect',image],check=True,stdout=subprocess.DEVNULL)
with tempfile.NamedTemporaryFile(mode='w',suffix='.json',prefix='monitoring-worker-',delete=False) as temporary:
    override=temporary.name
os.chmod(override,0o600)
def apply(target,env):
    Path(override).write_text(json.dumps({'services':{'api':{'image':target,'command':original['Config']['Cmd'],'environment':env,'stop_grace_period':'65s',
        'volumes':['/home/hanasand/resilience/status:/resilience:ro']}}}))
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
        apply(image,{**settings,**catchup,'HANASAND_RELEASE_COMMIT':release,'VM_HOST_ID':'inspur'})
        ready(release)
    except Exception:
        apply(original['Image'],settings)
        ready(settings.get('HANASAND_RELEASE_COMMIT','unknown'))
        raise
    print('Scheduled worker ready at '+release,flush=True)
finally:
    os.unlink(override)
