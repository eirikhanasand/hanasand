#!/usr/bin/env python3
"""Checkpointed host journal, Docker and audit delivery. Advance only after HTTP acknowledgement."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
from urllib.error import HTTPError
import uuid

STATE = Path(os.environ.get('HANASAND_LOG_STATE', '/var/lib/hanasand-log-collector'))
CONFIG = Path(os.environ.get('HANASAND_LOG_CONFIG', '/etc/hanasand/log-collector.json'))

def iso(seconds=None):
    return datetime.datetime.fromtimestamp(seconds or time.time(), datetime.timezone.utc).isoformat()

def scrub(text):
    # Authorization schemes can appear without a literal Authorization header.
    text = re.sub(r'(?i)\b(Bearer|Basic)\s+[A-Za-z0-9+/_.=-]+', r'\1 [REDACTED]', text)
    text = re.sub(r'''(?i)(["'](?:set-cookie|cookie|authorization)\s*:\s*)([^"'\r\n]*)(["'])''', r'\1[REDACTED]\3', text)
    text = re.sub(r'(?i)^(\s*(?:set-cookie|cookie|authorization)\s*:\s*)[^\r\n]*', r'\1[REDACTED]', text)
    text = re.sub(r'(?i)(\b(?:authorization|proxy-authorization)\s*[:=]\s*)(?:bearer\s+|basic\s+)?[^\s\'\"]+', r'\1[REDACTED]', text)
    text = re.sub(r'''(?i)((?:--[\w-]*(?:password|passwd|token|secret|api[_-]?key|cookie)[\w-]*\s+)|(?:\b[\w-]*(?:password|passwd|token|secret|api[_-]?key|cookie)[\w-]*["']?\s*[=:]\s*))("[^"\r\n]*"|'[^'\r\n]*'|[^\s&;,"']+)''', r'\1[REDACTED]', text)
    for program, flag in (('curl', r'(?:-u|-U|--user|--proxy-user|--oauth2-bearer)'), ('sshpass', r'-p'), ('(?:mysql|mariadb)', r'-p'), ('redis-cli', r'-a')):
        text = re.sub(r'(?i)(\b'+program+r'\b[^;\r\n|]*?\s'+flag+r'(?:=|\s+))("[^"\r\n]*"|\'[^\'\r\n]*\'|[^\s;|]+)', r'\1[REDACTED]', text)
    for program, flag in (('curl', r'(?:-u|-U)'), ('(?:sshpass|mysql|mariadb)', r'-p'), ('redis-cli', r'-a')):
        text = re.sub(r'(\b'+program+r'\b[^;\r\n|]*?\s'+flag+r')([^\s;|]+)', r'\1[REDACTED]', text)
    return re.sub(r'(https?://)[^/@\s:]+:[^/@\s]+@', r'\1[REDACTED]@', text)

def scrub_arguments(arguments):
    result = []
    hide_next = False
    program = Path(arguments[0]).name if arguments else ''
    short = {'curl':('-u','-U','--user','--proxy-user','--oauth2-bearer'), 'sshpass':('-p',), 'mysql':('-p',), 'mariadb':('-p',), 'redis-cli':('-a',)}.get(program, ())
    for argument in arguments:
        if hide_next:
            result.append('[REDACTED]')
            hide_next = False
            continue
        attached = next((flag for flag in short if len(flag)==2 and argument.startswith(flag) and len(argument)>2), None)
        assigned = next((flag for flag in short if argument.startswith(flag+'=')), None)
        result.append(attached+'[REDACTED]' if attached else assigned+'=[REDACTED]' if assigned else scrub(argument))
        hide_next = argument in short or bool(re.fullmatch(r'(?i)--?[\w-]*(?:password|passwd|token|secret|api[_-]?key|cookie|authorization)[\w-]*', argument))
    return result

def scrub_metadata(value):
    if isinstance(value, dict):
        return {key: '[REDACTED]' if re.search(r'(?i)password|token|secret|cookie|authorization|api[_-]?key', key)
                else scrub_arguments(item) if key == 'arguments' and isinstance(item, list) and all(isinstance(argument,str) for argument in item)
                else scrub_metadata(item) for key, item in value.items()}
    if isinstance(value, list): return [scrub_metadata(item) for item in value]
    return scrub(value) if isinstance(value, str) else value

def json_size(value):
    return len(json.dumps(value, ensure_ascii=False).encode())

def fit_text(value, budget):
    if json_size(value) <= budget: return value
    low, high = 0, len(value)
    while low < high:
        middle = (low+high+1)//2
        if json_size(value[:middle]) <= budget: low = middle
        else: high = middle-1
    return value[:low]

def compact_metadata(value, depth=0, field=''):
    if isinstance(value, str): return fit_text(value, 65536 if field in ('command_line','command') else 4096)
    if isinstance(value, list):
        result = []
        budget = 65536 if field == 'arguments' else 16384
        for item in value[:512 if field == 'arguments' else 16]:
            item = compact_metadata(item, depth+1)
            if json_size(result+[item]) > budget: break
            result.append(item)
        return result
    if isinstance(value, dict):
        if depth > 4: return {'truncated':True}
        priority = ('process','executable','command_line','command','arguments','user','event_type','action','outcome','collector','physical_host','vm','structured')
        keys = [key for key in priority if key in value]+[key for key in value if key not in priority]
        result = {}
        for key in keys[:32]:
            item = compact_metadata(value[key],depth+1,key)
            if json_size({**result,key:item}) <= 170000: result[key] = item
        return result
    return value

def bounded_metadata(value):
    clean = scrub_metadata(value)
    size = json_size(clean)
    if size <= 230000: return clean
    result = compact_metadata(clean)
    result.update(telemetry_truncated=True, metadata_original_bytes=size)
    # Keep a redacted excerpt as evidence when arbitrary structured log fields are
    # oversized. Explicit budgets keep even one event below the HTTP body limit.
    result['metadata_preview'] = fit_text(json.dumps(clean,ensure_ascii=False),32000)
    return result

def event(config, source_id, service, message, timestamp, metadata=None, level='info'):
    return dict(sourceEventId=hashlib.sha256((config['host']+':'+source_id).encode()).hexdigest(), service=service[:256],
                host=config['host'], message=scrub(message)[:65536] or '(empty)', timestamp=timestamp,
                level=level, metadata=bounded_metadata(metadata or {}))

def send(config, events):
    def deliver(batch):
        payload = json.dumps({'events': batch},ensure_ascii=False).encode()
        request = urllib.request.Request(config['url'], data=payload, headers={'Content-Type':'application/json','Authorization':'Bearer '+config['token']})
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.load(response)
            if not result.get('ok'): raise RuntimeError('Ingestion did not acknowledge the batch')
    batch = []; size = 0
    for item in events:
        length = json_size(item)
        if batch and (len(batch) >= 100 or size + length > 512000): deliver(batch); batch = []; size = 0
        batch.append(item); size += length
    if batch: deliver(batch)

def save(name, value):
    path = STATE/name
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value)); temporary.chmod(0o600); temporary.replace(path)

def load(name, default):
    path = STATE/name
    return json.loads(path.read_text()) if path.exists() else default

class CommandError(RuntimeError):
    def __init__(self, name, code):
        self.code = code
        super().__init__(f'{name} collection failed ({code})')

def command(args, accepted=(0,), timeout=60):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout, env={**os.environ, 'LC_ALL':'C'})
    if result.returncode not in accepted or (result.returncode == 1 and result.stderr.strip() not in ('', '<no matches>')):
        raise CommandError(args[0], result.returncode)
    return result.stdout

def journal(config):
    checkpoint = load('journal.json', None)
    cursor = checkpoint.get('cursor') if isinstance(checkpoint, dict) else checkpoint
    since = checkpoint.get('since', config['start']) if isinstance(checkpoint, dict) else config['start']
    args = ['journalctl','--no-pager','-o','json','--show-cursor','--lines=+1000']
    try: output = command(args + (['--after-cursor', cursor] if cursor else ['--since', since]))
    except RuntimeError:
        if not cursor: raise
        # A rotated journal can invalidate its opaque cursor. Resume by timestamp;
        # source IDs make the inclusive boundary safe to replay.
        output = command(args + ['--since', since])
    events = []; last = cursor
    for line in output.splitlines():
        if not line.startswith('{'): continue
        row = json.loads(line); last = row['__CURSOR']; since = iso(int(row['__REALTIME_TIMESTAMP'])/1e6)
        priority = int(row.get('PRIORITY', 6))
        level = 'fatal' if priority <= 2 else 'error' if priority == 3 else 'warn' if priority == 4 else 'debug' if priority == 7 else 'info'
        service = str(row.get('SYSLOG_IDENTIFIER') or row.get('_SYSTEMD_UNIT') or 'system').removesuffix('.service')
        # The collector's own status is sent separately and must not recurse on errors.
        if service == 'hanasand-log-collector': continue
        events.append(event(config, 'journal:'+last, service, str(row.get('MESSAGE','')), iso(int(row['__REALTIME_TIMESTAMP'])/1e6),
                            {'collector':'journal','pid':row.get('_PID'),'user':{'id':row.get('_UID')},'unit':row.get('_SYSTEMD_UNIT')}, level))
    send(config, events)
    if last: save('journal.json', {'cursor':last, 'since':since})

def audit_arg(value):
    if value.startswith('"'): return value[1:-1]
    if re.fullmatch(r'(?:[0-9A-Fa-f]{2})+', value):
        try: return bytes.fromhex(value).decode('utf-8', errors='replace')
        except ValueError: pass
    return value

def parse_audit(text, config):
    events = []
    groups = {}
    # Raw ausearch records have no separator; enriched records contain a GS suffix.
    for line in text.splitlines():
        row = line.split('\x1d', 1)[0]
        if not row.startswith(('type=SYSCALL ', 'type=EXECVE ')): continue
        identity = re.search(r'msg=audit\((\d+(?:\.\d+)?):(\d+)\)', row)
        if identity: groups.setdefault(identity.group(0), []).append(row)
    for rows in groups.values():
        syscall = next((row for row in rows if row.startswith('type=SYSCALL ')), '')
        execrows = [row for row in rows if row.startswith('type=EXECVE ')]
        if not syscall or not execrows: continue
        identity = re.search(r'msg=audit\((\d+(?:\.\d+)?):(\d+)\)', syscall)
        if not identity: continue
        attrs = dict(re.findall(r'\b(\w+)=((?:"[^"]*")|\S+)', syscall))
        args = {}
        parts = {}
        for row in execrows:
            for key, part, value in re.findall(r'\ba(\d+)(?:\[(\d+)\])?=((?:"[^"]*")|\S+)', row):
                if part: parts.setdefault(int(key), {})[int(part)] = audit_arg(value)
                else: args[int(key)] = audit_arg(value)
        for key, chunks in parts.items(): args[key] = ''.join(chunks[index] for index in sorted(chunks))
        if not args: continue
        argv = [args[key] for key in sorted(args)]
        executable = audit_arg(attrs.get('exe', '"'+argv[0]+'"'))
        argv = scrub_arguments(argv)
        command_line = scrub(shlex.join(argv))
        metadata = {'collector':'auditd','event_type':'process','action':'exec','outcome':'success' if attrs.get('success')=='yes' else 'failure',
                    'process':{'executable':executable,'command_line':command_line,'arguments':argv,'pid':attrs.get('pid'),'parent_pid':attrs.get('ppid')},
                    'user':{'id':attrs.get('uid'),'login_id':attrs.get('auid')},'audit_id':identity.group(2)}
        events.append(event(config, 'audit:'+identity.group(0), 'audit', command_line, iso(float(identity.group(1))), metadata))
    return events

def checkpoint_time(path):
    if not path.exists(): return None
    match = re.search(r'^output=.*?\s(\d+(?:\.\d+)?):\d+',path.read_text(),re.MULTILINE)
    return float(match.group(1)) if match else None

def audit_behind():
    timestamp = checkpoint_time(STATE/'audit.checkpoint')
    return timestamp is None or timestamp < time.time()-30

def recent_audit_start():
    # ausearch interprets explicit dates in local time; command() fixes LC_ALL=C.
    return datetime.datetime.fromtimestamp(time.time()-60).strftime('%m/%d/%y %H:%M:%S').split()

def audit(config, live=False):
    prefix = 'audit-live' if live else 'audit'
    stable = STATE/(prefix+'.checkpoint'); pending = STATE/(prefix+'.pending')
    timestamp = checkpoint_time(stable) if live else None
    reuse = stable.exists() and (not live or (timestamp is not None and timestamp >= time.time()-60))
    if reuse: shutil.copyfile(stable, pending)
    elif pending.exists(): pending.unlink()
    args = ['ausearch','--input-logs','--checkpoint',str(pending),'-k','hanasand_exec','--raw']
    if live and not reuse: args += ['--start',*recent_audit_start()]
    try: output = command(args, accepted=(0,1))
    except CommandError as error:
        if error.code not in (10,11,12) or not pending.exists(): raise
        output = command(args+['--start','checkpoint'], accepted=(0,1))
    events = parse_audit(output, config)
    send(config, reversed(events) if live else events)
    if pending.exists(): pending.replace(stable)

class DockerCollectionError(RuntimeError):
    """Contains only source names and controlled status descriptions, never logs."""

def collection_error(error):
    return str(error) if isinstance(error,DockerCollectionError) else type(error).__name__

def docker(config):
    if not shutil.which('docker'): return
    containers = command(['docker','ps','-a','--format','{{.ID}} {{.Names}}']).splitlines()
    checkpoints = load('docker.json', {})
    failures = []
    for container in containers:
        container_id, name = container.split(' ', 1)
        since = checkpoints.get(container_id, config['start'])
        # Bound the initial historical read as well as memory: every container
        # advances independently through one minute, without skipping any range.
        since_time = datetime.datetime.fromisoformat(since.replace('Z','+00:00')).timestamp()
        until = iso(min(time.time()-1, since_time+60))
        try:
            result = subprocess.run(['docker','logs','--timestamps','--since',since,'--until',until,container_id],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=60)
        except subprocess.TimeoutExpired:
            failures.append(name+' (log read timed out after 60s)')
            continue
        except OSError as error:
            failures.append(name+' (log read '+type(error).__name__+')')
            continue
        if result.returncode:
            reason = next((label for fragment,label in (
                ('No such container','removed during collection'),
                ('does not support reading','logging driver does not support reading'),
                ('invalid character','invalid log data'),
            ) if fragment in result.stdout),'log read exited '+str(result.returncode))
            failures.append(name+' ('+reason+')')
            continue
        events = []
        for ordinal, line in enumerate(result.stdout.splitlines()):
            timestamp, separator, message = line.partition(' ')
            if not separator or not re.match(r'^\d{4}-\d{2}-\d{2}T', timestamp): continue
            metadata = {'collector':'docker','container_id':container_id}
            level = 'info'
            try:
                structured = json.loads(message)
                if isinstance(structured, dict):
                    raw_level = structured.get('level')
                    level = {10:'debug',20:'debug',30:'info',40:'warn',50:'error',60:'fatal'}.get(raw_level, raw_level if raw_level in ['debug','info','warn','error','fatal'] else 'info')
                    metadata['structured'] = structured
            except (ValueError, TypeError):
                if re.search(r'(?i)\b(error|exception|failed|failure|fatal|panic)\b',message): level='error'
            # Timestamp + complete line is stable when replaying the inclusive boundary.
            events.append(event(config, 'docker:'+container_id+':'+timestamp+':'+message, name, message, timestamp, metadata, level))
        try:
            send(config, events); checkpoints[container_id] = until; save('docker.json', checkpoints)
        except Exception as error:
            reason = 'HTTP '+str(error.code) if isinstance(error,HTTPError) else type(error).__name__
            failures.append(name+' (delivery '+reason+')')
    if failures: raise DockerCollectionError('Docker log collection failed for '+', '.join(failures))

def collect(config):
    failures = []
    for source in (audit, journal, docker):
        try: source(config)
        except Exception as error: failures.append(source.__name__+': '+collection_error(error))
    return failures

def guest_export(config):
    """Keep a replayable guest batch; only the host's acknowledgement commits cursors."""
    global STATE, send
    root = STATE
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    spool = root/'export.json'
    if not spool.exists():
        pending = root/'pending'
        if pending.exists(): shutil.rmtree(pending)
        pending.mkdir(mode=0o700)
        for name in ('audit.checkpoint', 'journal.json', 'docker.json'):
            if (root/name).exists(): shutil.copyfile(root/name, pending/name)
        events = []
        STATE = pending
        sender = send
        send = lambda _config, batch: events.extend(batch)
        try: failures = collect(config)
        finally: STATE = root; send = sender
        payload = {'id':uuid.uuid4().hex, 'events':events, 'failures':failures}
        save('export.json', payload)
    payload = json.loads(spool.read_text())
    # Replay old spools through current redaction before they leave the guest.
    for item in payload['events']:
        item['message'] = scrub(item['message'])
        item['metadata'] = bounded_metadata(item.get('metadata', {}))
    print(json.dumps(payload))

def guest_ack(identity):
    payload = load('export.json', {})
    if payload.get('id') != identity: raise RuntimeError('Guest export acknowledgement mismatch')
    pending = STATE/'pending'
    for name in ('audit.checkpoint', 'journal.json', 'docker.json'):
        if (pending/name).exists(): (pending/name).replace(STATE/name)
    (STATE/'export.json').unlink()
    shutil.rmtree(pending)

def recent_audit(config):
    output = command(['ausearch','--input-logs','-k','hanasand_exec','--raw','--start',*recent_audit_start()],accepted=(0,1))
    return list(reversed(parse_audit(output,config)))

def guests(config):
    """Read guest telemetry over the existing management channel, never guest credentials."""
    if config.get('guestCollection') is False: raise RuntimeError('Administrative VM access unavailable')
    lxc = '/snap/lxd/current/bin/lxc'
    if not Path('/var/snap/lxd/common/lxd/unix.socket').exists(): return
    inventory = json.loads(command([lxc, 'list', '--format=json']))
    binary = Path('/usr/local/sbin/hanasand-log-collector')
    version = hashlib.sha256(binary.read_bytes()).hexdigest()
    installed = load('guests.json', {})
    failures = []
    for guest in inventory:
        name = guest['name']
        if guest.get('status') != 'Running': continue
        # Identity includes creation time, so a replacement with the same name is enrolled again.
        identity = name+':'+guest.get('created_at', '')+':'+version
        try:
            enrolling = installed.get(name) != identity
            if enrolling:
                staging = '/var/lib/hanasand-log-collector/install'
                command([lxc, 'exec', name, '--', 'mkdir', '-p', staging])
                command([lxc, 'file', 'push', '--uid=0', '--gid=0', str(binary), name+staging+'/collector.py'])
                command([lxc, 'file', 'push', '--uid=0', '--gid=0', '/usr/local/lib/hanasand-log-collector/install.sh', name+staging+'/install.sh'])
                command([lxc, 'file', 'push', '--uid=0', '--gid=0', '/usr/local/lib/hanasand-log-collector/retention.py', name+staging+'/retention.py'])
                command([lxc, 'exec', name, '--', 'sh', staging+'/install.sh', config['host']+'/'+name, '--guest'], timeout=360)
                installed[name] = identity
                save('guests.json', installed)
            response = json.loads(command([lxc, 'exec', name, '--', '/usr/local/sbin/hanasand-log-collector', '--export', config['host']+'/'+name, config['start']], timeout=120))
            catching_up = any(datetime.datetime.fromisoformat(item['timestamp'].replace('Z','+00:00')).timestamp() < time.time()-120 for item in response['events'])
            if enrolling or catching_up:
                # Prioritize recent commands on every historical export, including
                # retries after an outage; the main cursor still covers all history.
                recent = json.loads(command([lxc, 'exec', name, '--', '/usr/local/sbin/hanasand-log-collector', '--recent', config['host']+'/'+name]))
                for item in recent: item['metadata'].update({'physical_host':config['host'], 'vm':{'name':name,'type':guest.get('type')}})
                send(config,recent)
            for item in response['events']:
                item['metadata'].update({'physical_host':config['host'], 'vm':{'name':name, 'type':guest.get('type')}})
            send(config, response['events'])
            command([lxc, 'exec', name, '--', '/usr/local/sbin/hanasand-log-collector', '--ack', response['id']])
            if response['failures']: failures.append(name+': '+', '.join(response['failures']))
        except Exception as error: failures.append(name+': '+type(error).__name__)
    save('guest-coverage.json', {'checkedAt':iso(), 'instances':[{'name':g['name'], 'status':g.get('status'), 'type':g.get('type')} for g in inventory], 'failures':failures})
    if failures: raise RuntimeError('Guest collection failed: '+', '.join(failures))

def main():
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    if len(sys.argv) > 1:
        if sys.argv[1] == '--export': return guest_export({'host':sys.argv[2], 'start':sys.argv[3]})
        if sys.argv[1] == '--ack': return guest_ack(sys.argv[2])
        if sys.argv[1] == '--recent': return print(json.dumps(recent_audit({'host':sys.argv[2]})))
    config = json.loads(CONFIG.read_text())
    statuses = {}
    status_lock = threading.Lock()
    def worker(name, source, interval, live=False):
        while True:
            if live and not audit_behind():
                with status_lock: statuses.pop(name,None)
                time.sleep(interval)
                continue
            try:
                source(config)
                status = {'ok':True,'checkedAt':iso()}
            except Exception as error:
                status = {'ok':False,'checkedAt':iso(),'error':str(error) if name=='guests' else collection_error(error)}
            with status_lock: statuses[name] = status
            time.sleep(interval)
    # Sources have independent cursors and workers. A historical journal/Docker
    # sweep must never prevent host command checks or VM collection from running.
    for source, interval in ((audit,5),(journal,1),(docker,5),(guests,30)):
        threading.Thread(target=worker,args=(source.__name__,source,interval),daemon=True).start()
    threading.Thread(target=worker,args=('audit_live',lambda cfg:audit(cfg,live=True),5,True),daemon=True).start()
    while True:
        with status_lock: snapshot = dict(statuses)
        failures = [name+': '+status['error'] for name,status in snapshot.items() if not status['ok']]
        coverage = load('guest-coverage.json', None)
        if coverage and coverage['failures'] and not any(item.startswith('guests:') for item in failures):
            failures.append('guests: '+', '.join(coverage['failures']))
        health = {source:snapshot.get(source,{}).get('ok') for source in ('audit','journal','docker','guests')}
        metadata = {'collector_health':health,'source_status':snapshot}
        if coverage:
            metadata['guest_coverage'] = {'checkedAt':coverage['checkedAt'], 'running':sum(guest['status']=='Running' for guest in coverage['instances']),
                'stopped':sum(guest['status']!='Running' for guest in coverage['instances']), 'failures':coverage['failures'], 'enrollment':'Stopped guests are enrolled when next running.'}
        message = 'Collection failed: '+', '.join(failures) if failures else 'Collection starting' if any(value is None for value in health.values()) else 'Collection healthy'
        try:
            send(config,[event(config,'health:'+str(int(time.time())//30),'host-log-collector',message,iso(),metadata,'error' if failures else 'info')])
        except Exception: failures.append('delivery failed')
        if failures: print('; '.join(failures), flush=True)
        time.sleep(30)

if __name__ == '__main__': main()
