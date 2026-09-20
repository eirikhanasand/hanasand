#!/usr/bin/env python3
# Redeploy existing TI services while preserving their storage, network and secrets.
import json,socket,http.client,subprocess,sys,time,fcntl,re
release=sys.argv[1]
assert re.fullmatch(r"[0-9a-f]{40}", release), "Use the full release commit"
names=sys.argv[2:] or ["hanasand_ti_scraper", "hanasand-ti-actors-query"]
assert all(name in {"hanasand_ti_scraper", "hanasand-ti-actors-query"} for name in names)
image='hanasand-ti-actors:'+release
lock=open('/tmp/hanasand-ti-deploy.lock','a');fcntl.flock(lock,fcntl.LOCK_EX)
class Docker(http.client.HTTPConnection):
 def connect(self):
  self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.connect('/var/run/docker.sock')
def request(method,path,data=None):
 c=Docker('localhost',timeout=90);c.request(method,'/v1.45'+path,body=json.dumps(data) if data is not None else None,headers={'Content-Type':'application/json'});r=c.getresponse();raw=r.read();c.close()
 if r.status>=400:raise RuntimeError('Docker '+method+' '+path+' failed: '+str(r.status)+' '+raw.decode()[:150])
 return json.loads(raw) if raw else None
for name in names:
 old=request('GET','/containers/'+name+'/json');backup=name+'-rollback-'+release[:12]+'-'+str(time.time_ns())
 config=dict(old['Config']);config['Image']=image;config['Hostname']='';config['Env']=[e for e in config['Env'] if not e.startswith('HANASAND_RELEASE_COMMIT=')]+['HANASAND_RELEASE_COMMIT='+release]
 # Host-network query replicas cannot resolve Docker service names.
 if name == 'hanasand-ti-actors-query' and old['HostConfig']['NetworkMode'] == 'host':
  environment=dict(entry.split('=',1) for entry in config['Env'])
  if not environment.get('HANASAND_AI_API_BASE'):
   environment['HANASAND_AI_API_BASE']='http://127.0.0.1:18181'
  config['Env']=[key+'='+value for key,value in environment.items()]
 config['Labels']={**(config.get('Labels') or {}),'org.opencontainers.image.revision':release}
 config['HostConfig']=old['HostConfig']
 config['NetworkingConfig']={'EndpointsConfig':{n:{'Aliases':v.get('Aliases') or []} for n,v in old['NetworkSettings']['Networks'].items()}}
 request('POST','/containers/'+name+'/stop?t=65');request('POST','/containers/'+name+'/rename?name='+backup)
 try:
  request('POST','/containers/create?name='+name,config);request('POST','/containers/'+name+'/start')
  ready=False
  probe="const r=await fetch('http://127.0.0.1:'+Bun.env.SCRAPER_PORT+'/v1/health');const d=await r.json();if(!r.ok||!d.ok)process.exit(1);" + ("if(!d.collection?.public?.supervisorAttached)process.exit(1);" if name=='hanasand_ti_scraper' else '')
  probe+="const parser=await fetch('http://127.0.0.1:'+Bun.env.SCRAPER_PORT+'/v1/dwm/exposure-parser/health',{headers:{'x-hanasand-service-token':Bun.env.TI_SCRAPER_SERVICE_TOKEN||''},signal:AbortSignal.timeout(10000)});if(!parser.ok)process.exit(1);"
  for _ in range(90):
   if subprocess.run(['docker','exec',name,'bun','-e',probe],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:ready=True;break
   time.sleep(2)
  if not ready:raise RuntimeError('New '+name+' failed readiness')
  print(name+' deployed '+release,flush=True)
 except Exception:
  subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  request('POST','/containers/'+backup+'/rename?name='+name);request('POST','/containers/'+name+'/start');raise
