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
import time
import urllib.request
import uuid

STATE = Path(os.environ.get('HANASAND_LOG_STATE', '/var/lib/hanasand-log-collector'))
CONFIG = Path(os.environ.get('HANASAND_LOG_CONFIG', '/etc/hanasand/log-collector.json'))

def iso(seconds=None):
    return datetime.datetime.fromtimestamp(seconds or time.time(), datetime.timezone.utc).isoformat()

def scrub(text):
    text = re.sub(r'(?i)(\b(?:authorization|proxy-authorization)\s*[:=]\s*)(?:bearer\s+|basic\s+)?[^\s\'\"]+', r'\1[REDACTED]', text)
    text = re.sub(r'(?i)((?:password|passwd|token|secret|api[_-]?key|cookie)[=\s:]+)(\"[^\"]*\"|\'[^\']*\'|[^\s&]+)', r'\1[REDACTED]', text)
    return re.sub(r'(https?://)[^/@\s:]+:[^/@\s]+@', r'\1[REDACTED]@', text)

def scrub_arguments(arguments):
    result = []
    hide_next = False
    for argument in arguments:
        if hide_next:
            result.append('[REDACTED]')
            hide_next = False
            continue
        result.append(scrub(argument))
        hide_next = bool(re.fullmatch(r'(?i)--?(?:password|passwd|token|secret|api[_-]?key|cookie|authorization|user|u|p)', argument))
    return result

def scrub_metadata(value):
    if isinstance(value, dict):
        return {key: '[REDACTED]' if re.search(r'(?i)password|token|secret|cookie|authorization|api[_-]?key', key) else scrub_metadata(item) for key, item in value.items()}
    if isinstance(value, list): return [scrub_metadata(item) for item in value]
    return scrub(value) if isinstance(value, str) else value

def event(config, source_id, service, message, timestamp, metadata=None, level='info'):
    return dict(sourceEventId=hashlib.sha256((config['host']+':'+source_id).encode()).hexdigest(), service=service,
                host=config['host'], message=scrub(message)[:65536] or '(empty)', timestamp=timestamp,
                level=level, metadata=scrub_metadata(metadata or {}))

def send(config, events):
    def deliver(batch):
        payload = json.dumps({'events': batch}).encode()
        request = urllib.request.Request(config['url'], data=payload, headers={'Content-Type':'application/json','Authorization':'Bearer '+config['token']})
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.load(response)
            if not result.get('ok'): raise RuntimeError('Ingestion did not acknowledge the batch')
    batch = []; size = 0
    for item in events:
        length = len(json.dumps(item).encode())
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
    args = ['journalctl','--no-pager','-o','json','--show-cursor','--no-tail']
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

def audit(config):
    stable = STATE/'audit.checkpoint'; pending = STATE/'audit.pending'
    if stable.exists(): shutil.copyfile(stable, pending)
    elif pending.exists(): pending.unlink()
    args = ['ausearch','--input-logs','--checkpoint',str(pending),'-k','hanasand_exec','--raw']
    try: output = command(args, accepted=(0,1))
    except CommandError as error:
        if error.code not in (10,11,12) or not pending.exists(): raise
        output = command(args+['--start','checkpoint'], accepted=(0,1))
    send(config, parse_audit(output, config))
    if pending.exists(): pending.replace(stable)

def docker(config):
    if not shutil.which('docker'): return
    containers = command(['docker','ps','-a','--format','{{.ID}} {{.Names}}']).splitlines()
    checkpoints = load('docker.json', {})
    failures = []
    for container in containers:
        container_id, name = container.split(' ', 1)
        since = checkpoints.get(container_id, config['start'])
        until = iso(time.time()-1)
        result = subprocess.run(['docker','logs','--timestamps','--since',since,'--until',until,container_id],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=60)
        if result.returncode:
            failures.append(name)
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
        except Exception:
            failures.append(name)
    if failures: raise RuntimeError('Docker log collection failed for '+', '.join(failures))

def collect(config):
    failures = []
    for source in (audit, journal, docker):
        try: source(config)
        except Exception as error: failures.append(source.__name__+': '+type(error).__name__)
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
    print(spool.read_text())

def guest_ack(identity):
    payload = load('export.json', {})
    if payload.get('id') != identity: raise RuntimeError('Guest export acknowledgement mismatch')
    pending = STATE/'pending'
    for name in ('audit.checkpoint', 'journal.json', 'docker.json'):
        if (pending/name).exists(): (pending/name).replace(STATE/name)
    (STATE/'export.json').unlink()
    shutil.rmtree(pending)

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
            if installed.get(name) != identity:
                staging = '/var/lib/hanasand-log-collector/install'
                command([lxc, 'exec', name, '--', 'mkdir', '-p', staging])
                command([lxc, 'file', 'push', '--uid=0', '--gid=0', str(binary), name+staging+'/collector.py'])
                command([lxc, 'file', 'push', '--uid=0', '--gid=0', '/usr/local/lib/hanasand-log-collector/install.sh', name+staging+'/install.sh'])
                command([lxc, 'exec', name, '--', 'sh', staging+'/install.sh', config['host']+'/'+name, '--guest'], timeout=360)
                installed[name] = identity
                save('guests.json', installed)
            response = json.loads(command([lxc, 'exec', name, '--', '/usr/local/sbin/hanasand-log-collector', '--export', config['host']+'/'+name, config['start']], timeout=120))
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
    config = json.loads(CONFIG.read_text())
    next_guests = 0
    guest_error = None
    while True:
        failures = collect(config)
        if time.monotonic() >= next_guests:
            try: guests(config); guest_error = None
            except Exception as error: guest_error = 'guests: '+str(error)
            next_guests = time.monotonic()+30
        if guest_error: failures.append(guest_error)
        coverage = load('guest-coverage.json', None)
        if coverage and coverage['failures'] and not any(item.startswith('guests:') for item in failures):
            failures.append('guests: '+', '.join(coverage['failures']))
        health = {source:not any(failure.startswith(source+':') for failure in failures) for source in ('audit','journal','docker','guests')}
        metadata = {'collector_health':health}
        if coverage:
            metadata['guest_coverage'] = {'checkedAt':coverage['checkedAt'], 'running':sum(guest['status']=='Running' for guest in coverage['instances']),
                'stopped':sum(guest['status']!='Running' for guest in coverage['instances']), 'failures':coverage['failures'], 'enrollment':'Stopped guests are enrolled when next running.'}
        try:
            send(config,[event(config,'health:'+str(int(time.time())//30),'host-log-collector','Collection failed: '+', '.join(failures) if failures else 'Collection healthy',iso(),metadata,'error' if failures else 'info')])
        except Exception: failures.append('delivery failed')
        if failures: print('; '.join(failures), flush=True)
        time.sleep(5)

if __name__ == '__main__': main()
