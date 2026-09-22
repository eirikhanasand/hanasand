#!/usr/bin/env python3
"""Checkpointed host journal, Docker and audit delivery. Advance only after HTTP acknowledgement."""
import datetime
import contextlib
import http.client
import io
import hashlib
import heapq
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
from urllib.error import HTTPError
import uuid

STATE = Path(os.environ.get('HANASAND_LOG_STATE', '/var/lib/hanasand-log-collector'))
CONFIG = Path(os.environ.get('HANASAND_LOG_CONFIG', '/etc/hanasand/log-collector.json'))

def iso(seconds=None):
    return datetime.datetime.fromtimestamp(seconds or time.time(), datetime.timezone.utc).isoformat()

def scrub(text):
    # Most records contain no credential syntax; avoid the expensive replacement
    # expressions for ordinary application messages and command arguments.
    if text.isascii():
        lower = text.lower()
        if not any(marker in lower for marker in ('bearer','basic','password','passwd','token','secret','cookie',
                   'authorization','api','http://','https://','curl','sshpass','mysql','mariadb','redis-cli')):
            return text
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

QUEUE_READY = threading.Event()
QUEUE_DIRECTORY_LOCK = threading.Lock()
BATCH_BYTES = 256 * 1024
BATCH_COUNT = 100
MAX_RECORD_BYTES = 8 * 1024 * 1024


def sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try: os.fsync(descriptor)
    finally: os.close(descriptor)


def queue_batch(batch, lane):
    """A source may advance only after its JSON batch is durable on disk."""
    root = STATE/'queue'/lane
    with QUEUE_DIRECTORY_LOCK:
        if not root.exists():
            root.mkdir(mode=0o700, parents=True, exist_ok=True)
            sync_directory(root.parent); sync_directory(STATE)
    identity = str(time.time_ns()).zfill(20)+'-'+uuid.uuid4().hex
    pending = root/(identity+'.pending')
    destination = root/(identity+'.json')
    try:
        with pending.open('x', encoding='utf8') as handle:
            os.chmod(pending, 0o600)
            json.dump({'events':batch}, handle, ensure_ascii=False, separators=(',', ':'))
            handle.flush(); os.fsync(handle.fileno())
        pending.replace(destination)
        sync_directory(root)
        QUEUE_READY.set()
    finally:
        if pending.exists(): pending.unlink()


def send(config, events):
    # Never retain a backlog in Python. The two small buffers let recent events
    # bypass historical replay without a failed connection stopping collection.
    batches = {'live':[], 'history':[]}
    sizes = {'live':0, 'history':0}
    flushed = time.monotonic()
    for item in events:
        try: recent = datetime.datetime.fromisoformat(item['timestamp'].replace('Z','+00:00')).timestamp() >= time.time()-60
        except (KeyError, ValueError, TypeError): recent = True
        lane = 'live' if recent else 'history'
        size = json_size(item)
        if batches[lane] and (sizes[lane]+size > BATCH_BYTES or len(batches[lane]) >= BATCH_COUNT):
            queue_batch(batches[lane], lane); batches[lane] = []; sizes[lane] = 0
        batches[lane].append(item); sizes[lane] += size
        if time.monotonic()-flushed >= 0.1:
            for name, batch in batches.items():
                if batch: queue_batch(batch, name); batches[name] = []; sizes[name] = 0
            flushed = time.monotonic()
    for lane, batch in batches.items():
        if batch: queue_batch(batch, lane)


class DeliveryError(RuntimeError):
    pass


class Delivery:
    """One authenticated keep-alive connection per lane; ACK means DB commit."""
    def __init__(self, config):
        self.config = config
        self.connection = None
        self.url = urllib.parse.urlsplit(config['url'])
        if self.url.scheme not in ('http', 'https') or self.url.username or self.url.password:
            raise ValueError('Invalid ingestion URL')
        if self.url.scheme == 'http' and self.url.hostname not in ('127.0.0.1', 'localhost', '::1'):
            raise ValueError('Remote ingestion requires HTTPS')

    def close(self):
        if self.connection: self.connection.close()
        self.connection = None

    def deliver(self, path):
        return self.deliver_many([path])

    def deliver_many(self, paths):
        # Queue files are individual bounded batches, never the entire backlog.
        events = []
        for path in paths:
            with path.open('rb') as handle: raw = handle.read(512000+1)
            if len(raw) > 512000: raise RuntimeError('Queued batch exceeds ingestion limit')
            events.extend(json.loads(raw)['events'])
        payload = json.dumps({'events':events}, ensure_ascii=False, separators=(',', ':')).encode()
        count = len(events)
        if len(payload) > 512000 or count > BATCH_COUNT:
            raise RuntimeError('Delivery batch exceeds ingestion limit')
        if self.connection is None:
            constructor = http.client.HTTPSConnection if self.url.scheme == 'https' else http.client.HTTPConnection
            self.connection = constructor(self.url.hostname, self.url.port, timeout=8)
        try:
            self.connection.request('POST', urllib.parse.urlunsplit(('', '', self.url.path or '/', self.url.query, '')),
                body=payload, headers={'Content-Type':'application/json', 'Authorization':'Bearer '+self.config['token']})
            response = self.connection.getresponse()
            raw = response.read(4097)
            if response.status != 201 or len(raw) > 4096:
                raise DeliveryError('Ingestion HTTP '+str(response.status))
            acknowledgement = json.loads(raw)
            if acknowledgement.get('ok') is not True or acknowledgement.get('accepted') != count:
                raise DeliveryError('Ingestion acknowledgement mismatch')
        except Exception:
            self.close()
            raise
        for path in paths: path.unlink()
        sync_directory(paths[0].parent)
        return count


def queued_batch(lane):
    root = STATE/'queue'/lane
    if not root.exists(): return None
    # min over an iterator keeps memory constant even with millions of batches.
    with os.scandir(root) as entries:
        name = min((entry.name for entry in entries if entry.name.endswith('.json')), default=None)
    return root/name if name else None


def queued_batches(lane):
    root = STATE/'queue'/lane
    if not root.exists(): return []
    with os.scandir(root) as entries:
        names = heapq.nsmallest(BATCH_COUNT, (entry.name for entry in entries if entry.name.endswith('.json')))
    paths = []; size = 0; count = 0
    for name in names:
        path = root/name
        with path.open('rb') as handle: raw = handle.read(512001)
        if len(raw) > 512000: raise RuntimeError('Queued batch exceeds ingestion limit')
        entries = len(json.loads(raw)['events'])
        if paths and (size+len(raw) > BATCH_BYTES or count+entries > BATCH_COUNT): break
        paths.append(path); size += len(raw); count += entries
    return paths


def deliver_queue(config, lane, statuses, lock):
    delivery = Delivery(config)
    while True:
        paths = queued_batches(lane)
        if not paths:
            QUEUE_READY.wait(0.25); QUEUE_READY.clear()
            continue
        try:
            count = delivery.deliver_many(paths)
            age = max(0, time.time()-int(paths[0].name.split('-')[0])/1e9)
            status = {'ok':lane != 'live' or age < 10, 'checkedAt':iso(), 'accepted':count, 'queueAgeSeconds':age}
            if not status['ok']: status['error'] = 'Live log delivery exceeded 10 seconds'
        except Exception as error:
            status = {'ok':False, 'checkedAt':iso(), 'error':collection_error(error)}
            # Keep the exact file for replay, including a lost response after commit.
            time.sleep(1)
        with lock: statuses['delivery_'+lane] = status

def save(name, value):
    path = STATE/name
    temporary = path.with_suffix('.tmp')
    with temporary.open('w') as handle:
        os.chmod(temporary, 0o600)
        json.dump(value, handle); handle.flush(); os.fsync(handle.fileno())
    temporary.replace(path); sync_directory(path.parent)

def load(name, default):
    path = STATE/name
    return json.loads(path.read_text()) if path.exists() else default

class CommandError(RuntimeError):
    def __init__(self, name, code, reason=None):
        self.reason = reason
        self.code = code
        super().__init__(f'{name} collection failed ({code})')

def command(args, accepted=(0,), timeout=60):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout, env={**os.environ, 'LC_ALL':'C'})
    if result.returncode not in accepted or (result.returncode == 1 and result.stderr.strip() not in ('', '<no matches>')):
        raise CommandError(args[0], result.returncode)
    return result.stdout

@contextlib.contextmanager
def command_file(args, accepted=(0,), timeout=60, merged=False):
    # /tmp can be tmpfs (it is on OVH). Capture on the persistent state volume.
    root = STATE/'capture'
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    with tempfile.TemporaryFile(dir=root, mode='w+b') as output, tempfile.TemporaryFile(dir=root, mode='w+b') as errors:
        result = subprocess.run(args, stdout=output, stderr=subprocess.STDOUT if merged else errors,
                                timeout=timeout, env={**os.environ, 'LC_ALL':'C'})
        errors.seek(0)
        detail = errors.read(4096).decode('utf8', errors='replace').strip()
        if result.returncode not in accepted or (result.returncode == 1 and detail not in ('', '<no matches>')):
            if merged:
                output.seek(0); detail = output.read(4096).decode('utf8', errors='replace')
            reason = next((label for fragment,label in (('No such container','removed during collection'),
                ('does not support reading','logging driver does not support reading'), ('invalid character','invalid log data')) if fragment in detail), None)
            raise CommandError(args[0], result.returncode, reason)
        output.seek(0)
        yield output


@contextlib.contextmanager
def command_stream(args, accepted=(0,), timeout=60):
    # A bounded OS pipe avoids copying a large source log to a scratch file.
    # The JSON events themselves are durably queued before any cursor advances.
    root = STATE/'capture'; root.mkdir(mode=0o700, parents=True, exist_ok=True)
    with tempfile.TemporaryFile(dir=root, mode='w+b') as errors:
        process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=errors, env={**os.environ, 'LC_ALL':'C'})
        expired = threading.Event()
        def expire():
            expired.set()
            try: process.kill()
            except ProcessLookupError: pass
        timer = threading.Timer(timeout, expire); timer.daemon = True; timer.start()
        try:
            yield process.stdout
            code = process.wait()
            errors.seek(0); detail = errors.read(4096).decode('utf8', errors='replace').strip()
            if expired.is_set(): raise subprocess.TimeoutExpired(args[0], timeout)
            if code not in accepted or (code == 1 and detail not in ('', '<no matches>')):
                raise CommandError(args[0], code)
        finally:
            timer.cancel()
            if process.poll() is None: process.kill()
            process.wait(); process.stdout.close()


def record_lines(handle):
    while True:
        line = handle.readline(MAX_RECORD_BYTES+1)
        if not line: break
        if len(line) > MAX_RECORD_BYTES:
            raise RuntimeError('Source record exceeds 8MB; cursor retained')
        yield line.decode('utf8', errors='replace') if isinstance(line, bytes) else line


def audit_events(lines, config):
    # ausearch emits complete, grouped events. Keep only one event at a time.
    identity = None; rows = []; size = 0
    for line in lines:
        if not line.startswith(('type=SYSCALL ', 'type=EXECVE ')): continue
        match = re.search(r'msg=audit\((\d+(?:\.\d+)?):(\d+)\)', line)
        if not match: continue
        current = match.group(0)
        if identity is not None and current != identity:
            yield from parse_audit(''.join(rows), config)
            rows = []; size = 0
        identity = current; size += len(line)
        if size > MAX_RECORD_BYTES: raise RuntimeError('Audit event exceeds 8MB; cursor retained')
        rows.append(line)
    if rows: yield from parse_audit(''.join(rows), config)


def journal(config, live=False):
    state_name = 'journal-live.json' if live else 'journal.json'
    checkpoint = load(state_name, None)
    cursor = checkpoint.get('cursor') if isinstance(checkpoint, dict) else checkpoint
    since = checkpoint.get('since', config['start']) if isinstance(checkpoint, dict) else (iso(time.time()-60) if live else config['start'])
    args = ['journalctl','--no-pager','-o','json','--show-cursor','--lines=+1000']
    def consume(output):
        nonlocal cursor, since
        for line in record_lines(output):
            if not line.startswith('{'): continue
            row = json.loads(line); cursor = row['__CURSOR']; since = iso(int(row['__REALTIME_TIMESTAMP'])/1e6)
            priority = int(row.get('PRIORITY', 6))
            level = 'fatal' if priority <= 2 else 'error' if priority == 3 else 'warn' if priority == 4 else 'debug' if priority == 7 else 'info'
            service = str(row.get('SYSLOG_IDENTIFIER') or row.get('_SYSTEMD_UNIT') or 'system').removesuffix('.service')
            if service == 'hanasand-log-collector': continue
            yield event(config, 'journal:'+cursor, service, str(row.get('MESSAGE','')), since,
                        {'collector':'journal','pid':row.get('_PID'),'user':{'id':row.get('_UID')},'unit':row.get('_SYSTEMD_UNIT')}, level)
    try:
        with command_stream(args + (['--after-cursor', cursor] if cursor else ['--since', since]), timeout=5 if live else 60) as output:
            send(config, consume(output))
    except CommandError:
        if not cursor: raise
        with command_stream(args + ['--since', since], timeout=5 if live else 60) as output:
            send(config, consume(output))
    if cursor: save(state_name, {'cursor':cursor, 'since':since})


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
    end = None
    if not live:
        # Walk history in bounded time windows instead of replaying days in one
        # command. An empty window still advances its timestamp checkpoint.
        window = load('audit-window.json', None)
        beginning = max(value for value in (checkpoint_time(stable), window,
            datetime.datetime.fromisoformat(config.get('start', iso(time.time()-60)).replace('Z','+00:00')).timestamp()) if value is not None)
        end = min(int(time.time())-1, int(beginning)+60)
        if end <= beginning: return
        args += ['--end', *datetime.datetime.fromtimestamp(end).strftime('%m/%d/%y %H:%M:%S').split()]
        if not stable.exists(): args += ['--start', *datetime.datetime.fromtimestamp(beginning).strftime('%m/%d/%y %H:%M:%S').split()]
    try:
        with command_stream(args, accepted=(0,1), timeout=5 if live else 60) as output:
            send(config, audit_events(record_lines(output), config))
    except CommandError as error:
        if error.code not in (10,11,12) or not pending.exists(): raise
        with command_stream(args+['--start','checkpoint'], accepted=(0,1), timeout=5 if live else 60) as output:
            send(config, audit_events(record_lines(output), config))
    if pending.exists(): pending.replace(stable); sync_directory(STATE)
    if end is not None: save('audit-window.json', end)

class DockerCollectionError(RuntimeError):
    """Contains only source names and controlled status descriptions, never logs."""

def collection_error(error):
    return str(error) if isinstance(error,(DockerCollectionError,DeliveryError)) else type(error).__name__

def docker_event(config, container_id, name, timestamp, message, stream=None):
    metadata = {'collector':'docker','container_id':container_id}
    if stream: metadata['stream'] = stream
    level = 'info'
    try:
        structured = json.loads(message)
        if isinstance(structured,dict):
            raw_level = structured.get('level')
            if isinstance(raw_level,str):
                raw_level=raw_level.strip().lower()
                raw_level={'warning':'warn','critical':'fatal'}.get(raw_level,raw_level)
            level = {10:'debug',20:'debug',30:'info',40:'warn',50:'error',60:'fatal'}.get(raw_level,raw_level if raw_level in ['debug','info','warn','error','fatal'] else 'info')
            metadata['structured'] = structured
    except (ValueError,TypeError):
        if re.search(r'(?i)\b(error|exception|failed|failure|fatal|panic)\b',message): level='error'
    return event(config,'docker:'+container_id+':'+timestamp+':'+message,name,message,timestamp,metadata,level)

def docker_cli_events(config, container_id, name, output):
    return list(docker_cli_stream(config, container_id, name, output.splitlines(keepends=True)))

def docker_cli_stream(config, container_id, name, lines):
    timestamp=None; parts=[]; size=0
    for line in lines:
        match=re.match(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})) ',line)
        if match:
            if timestamp is not None:
                yield docker_event(config,container_id,name,timestamp,''.join(parts).removesuffix('\n').removesuffix('\r'))
            timestamp=match.group(1);parts=[line[match.end():]];size=len(parts[0])
        elif timestamp is not None:parts.append(line);size+=len(line)
        if size>MAX_RECORD_BYTES: raise RuntimeError('Docker event exceeds 8MB; cursor retained')
    if timestamp is not None:
        yield docker_event(config,container_id,name,timestamp,''.join(parts).removesuffix('\n').removesuffix('\r'))

def docker_json_files(source):
    path=Path(source['path'])
    files=[]
    for candidate in path.parent.glob(path.name+'*'):
        suffix=candidate.name[len(path.name):]
        if not suffix: rank=0
        else:
            match=re.fullmatch(r'\.(\d+)(?:\.gz)?',suffix)
            if not match: continue
            rank=int(match.group(1))
        if candidate.is_file(): files.append((rank,candidate,candidate.stat()))
    return sorted(files,key=lambda item:item[0],reverse=True)

def register_docker_file(config, container_id, name, since):
    """Switch a timed-out readable json-file source without changing its cutoff."""
    try:
        details=json.loads(command(['docker','inspect','--format','{"path":{{json .LogPath}},"driver":{{json .HostConfig.LogConfig.Type}}}',container_id],timeout=15))
        if details['driver']!='json-file' or not Path(details['path']).is_file() or not os.access(details['path'],os.R_OK): return False
        source={'name':name,'path':details['path'],'since':since}
        # A fresh gzip seek repeats decompression from byte zero. Retain CLI
        # collection rather than claiming a bounded resumable file path for it.
        if any(path.suffix=='.gz' for _,path,_ in docker_json_files(source)): return False
        sources=load('docker-file-sources.json',{})
        sources[container_id]=source
        save('docker-file-sources.json',sources)
        return True
    except Exception: return False

def retire_docker_file(config, container_id, source):
    """Archive unavailable removed sources only after the coverage notice is ACKed."""
    retired=load('docker-file-retired.json',{})
    entry={'source':source,'retired_at':iso(),'final_coverage':'unknown','cursors':{}}
    for kind in ('history','live'):
        state_name='docker-file-'+kind+'-'+container_id+'.json'
        cursor=load(state_name,None)
        if cursor:
            entry['cursors'][kind]={'checkpoint':cursor,'last_ack_at':iso((STATE/state_name).stat().st_mtime)}
    notice=event(config,'docker-source-retired:'+container_id,'host-log-collector',
        source['name']+': container removed; final log coverage is unknown because source files are unavailable',entry['retired_at'],
        {'collector':'docker','container_id':container_id,'source_status':'removed_source_unavailable','retired_source':entry},'error')
    send(config,[notice])
    retired[container_id]=entry
    save('docker-file-retired.json',retired)
    sources=load('docker-file-sources.json',{})
    sources.pop(container_id,None)
    save('docker-file-sources.json',sources)


def docker_created_at(container_id):
    created=load('docker-created.json',{})
    if container_id not in created:
        try:
            timestamp=command(['docker','inspect','--format','{{.Created}}',container_id],timeout=15).strip()
            datetime.datetime.fromisoformat(timestamp.replace('Z','+00:00'))
            created[container_id]=timestamp
            save('docker-created.json',created)
        except Exception: return None
    return created[container_id]

def docker_file_notice(config, container_id, source, cursor, reason):
    # This records discontinuity explicitly; it does not assert unverified loss.
    identity='docker-file-notice:'+container_id+':'+str(cursor.get('inode'))+':'+str(cursor.get('offset'))+':'+str(cursor.get('anchor',''))+':'+reason
    send(config,[event(config,identity,'host-log-collector',source['name']+': '+reason,iso(),
        {'collector':'docker','container_id':container_id,'source_status':reason},'error')])

def docker_fragment_event(config, container_id, source, stat, offset, raw):
    digest=hashlib.sha256(raw).hexdigest()
    identity='docker-fragment:'+container_id+':'+str(stat.st_ino)+':'+str(offset)+':'+digest
    return event(config,identity,source['name'],raw.decode('utf8',errors='replace'),iso(),
        {'collector':'docker','container_id':container_id,'event_type':'source_fragment',
         'source_fragment':{'reason':'incomplete_rotated_record','inode':str(stat.st_ino),'offset':offset,
                            'byte_length':len(raw),'sha256':digest,'file_modified_at':iso(stat.st_mtime),
                            'encoding':'utf8-replacement','preview_truncated':len(raw)>65536}},'error')

def docker_file_batch(config, container_id, source, live=False):
    state_name='docker-file-'+('live-' if live else 'history-')+container_id+'.json'
    cursor=load(state_name,None)
    files=docker_json_files(source)
    if not files: raise DockerCollectionError(source['name']+' (source files unavailable)')
    selected=next((item for item in files if cursor and item[2].st_ino==cursor['inode'] and item[2].st_dev==cursor['device']),None)
    if cursor and selected is None:
        docker_file_notice(config,container_id,source,cursor,'previous source file unavailable; replaying retained history')
        cursor=None
    if selected is None:
        selected=files[-1] if live else files[0]
    rank,path,stat=selected
    compressed=path.suffix=='.gz'
    if compressed:
        raise DockerCollectionError(source['name']+' (compressed history requires CLI recovery; file cursor preserved)')
    offset=cursor['offset'] if cursor else 0
    if cursor and stat.st_size<offset:
        docker_file_notice(config,container_id,source,cursor,'source file truncated; replaying available contents')
        offset=0
    with open(path,'rb') as handle:
        actual=os.fstat(handle.fileno())
        if (actual.st_dev,actual.st_ino)!=(stat.st_dev,stat.st_ino):
            raise DockerCollectionError(source['name']+' (source rotated during open; retrying)')
        if live and cursor is None:
            # Historical reading retains every earlier byte. The independent live
            # cursor starts at the last complete line and captures new writes.
            handle.seek(max(0,stat.st_size-8*1024*1024))
            base=handle.tell(); tail=handle.read(stat.st_size-base)
            offset=base+tail.rfind(b'\n')+1 if b'\n' in tail else 0
        handle.seek(max(0,offset-128)); anchor_bytes=handle.read(min(offset,128))
        if cursor and cursor.get('anchor') and offset==cursor['offset'] and hashlib.sha256(anchor_bytes).hexdigest()!=cursor['anchor']:
            docker_file_notice(config,container_id,source,cursor,'source file rewritten or truncated; replaying available contents')
            offset=0; anchor_bytes=b''
        handle.seek(offset)
        started=time.monotonic(); scanned=0; events=[]; event_bytes=0; complete=offset; eof=False
        cutoff=datetime.datetime.fromisoformat(source['since'].replace('Z','+00:00')).timestamp()
        while scanned<8*1024*1024 and len(events)<100 and event_bytes<BATCH_BYTES and time.monotonic()-started<0.1:
            line=handle.readline(8*1024*1024+1)
            if not line: eof=True; break
            if not line.endswith(b'\n'):
                if len(line)>8*1024*1024: raise DockerCollectionError(source['name']+' (JSON log record exceeds 8MB)')
                if rank>0:
                    # A closed rotated fragment cannot become a complete JSON
                    # record. Preserve its redacted evidence before moving on.
                    events.append(docker_fragment_event(config,container_id,source,stat,complete,line))
                    complete=handle.tell();anchor_bytes=(anchor_bytes+line)[-128:];eof=True
                break  # Active partial records wait; rotated evidence is ACKed below.
            try:
                record=json.loads(line)
                timestamp=record['time']; message=record['log'].removesuffix('\n').removesuffix('\r')
                if not isinstance(message,str) or record.get('stream') not in ('stdout','stderr'): raise ValueError()
                seconds=datetime.datetime.fromisoformat(timestamp.replace('Z','+00:00')).timestamp()
                # Docker CLI --timestamps pads nanoseconds to nine digits. Keep
                # identical IDs when overlapping the original CLI cursor.
                match=re.fullmatch(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})',timestamp)
                if not match: raise ValueError()
                timestamp=match.group(1)+'.'+(match.group(2) or '').ljust(9,'0')+match.group(3)
            except (ValueError,KeyError,TypeError,AttributeError):
                raise DockerCollectionError(source['name']+' (invalid JSON log record at byte '+str(complete)+')') from None
            if seconds>=cutoff:
                item=docker_event(config,container_id,source['name'],timestamp,message,record['stream'])
                events.append(item); event_bytes+=json_size(item)
            scanned+=len(line); complete=handle.tell(); anchor_bytes=(anchor_bytes+line)[-128:]
    send(config,events)
    next_cursor={'device':stat.st_dev,'inode':stat.st_ino,'offset':complete,'anchor':hashlib.sha256(anchor_bytes).hexdigest()}
    # Finish a rotated file before advancing to its newer successor.
    index=files.index(selected)
    if eof and index+1<len(files):
        next_stat=files[index+1][2]
        next_cursor={'device':next_stat.st_dev,'inode':next_stat.st_ino,'offset':0}
    if next_cursor != cursor: save(state_name,next_cursor)
    remaining=max(0,stat.st_size-complete)+sum(item[2].st_size for item in files[index+1:])
    return remaining

def docker_file_source(config, live=False):
    sources=load('docker-file-sources.json',{}); failures=[]; remaining=0
    for container_id,source in sources.items():
        try: remaining+=docker_file_batch(config,container_id,source,live)
        except Exception as error:
            if isinstance(error,(DockerCollectionError,DeliveryError)): failures.append(str(error))
            else:
                detail='delivery HTTP '+str(error.code) if isinstance(error,HTTPError) else type(error).__name__
                failures.append(source['name']+' ('+detail+')')
    if failures: raise DockerCollectionError('; '.join(failures))
    return {'sources':len(sources),'pendingFileBytes':remaining,'retiredUnavailableSources':len(load('docker-file-retired.json',{}))}

def docker_file_history(config): return docker_file_source(config)
def docker_file_live(config): return docker_file_source(config,True)

def docker(config):
    if not shutil.which('docker'): return
    containers = [row.split(' ',1) for row in command(['docker','ps','-a','--format','{{.ID}} {{.Names}}']).splitlines()]
    checkpoints = load('docker.json', {})
    failures = []
    file_sources=load('docker-file-sources.json',{})
    # Only a successful complete inventory can prove a registered container gone.
    current_ids={container_id for container_id,_name in containers}
    for container_id,source in list(file_sources.items()):
        if container_id not in current_ids and not docker_json_files(source):
            try:
                retire_docker_file(config,container_id,source)
                file_sources.pop(container_id,None)
            except Exception as error:
                detail='HTTP '+str(error.code) if isinstance(error,HTTPError) else type(error).__name__
                failures.append(source['name']+' (retirement notice delivery '+detail+')')
    for container_id,name in containers:
        if container_id in file_sources: continue
        since = checkpoints.get(container_id, config['start'])
        # A replacement retains the same file-collection behavior and original
        # cutoff, while its predecessor's acknowledged cursors remain archived.
        if register_docker_file(config,container_id,name,since): continue
        created=docker_created_at(container_id)
        if created and datetime.datetime.fromisoformat(created.replace('Z','+00:00')) > datetime.datetime.fromisoformat(since.replace('Z','+00:00')):
            since=created  # No Docker records can predate this container's creation.
        # Bound the initial historical read as well as memory: every container
        # advances independently through one minute, without skipping any range.
        since_time = datetime.datetime.fromisoformat(since.replace('Z','+00:00')).timestamp()
        until = iso(min(time.time()-1, since_time+60))
        try:
            with command_file(['docker','logs','--timestamps','--since',since,'--until',until,container_id], merged=True) as output:
                send(config, docker_cli_stream(config,container_id,name,record_lines(output)))
            checkpoints[container_id] = until; save('docker.json', checkpoints)
        except subprocess.TimeoutExpired:
            failures.append(name+' (log read timed out after 60s)')
        except CommandError as error:
            failures.append(name+' ('+(error.reason or 'log read exited '+str(error.code))+')')
        except Exception as error:
            reason = 'HTTP '+str(error.code) if isinstance(error,HTTPError) else collection_error(error)
            failures.append(name+' (collection '+reason+')')
    if failures: raise DockerCollectionError('Docker log collection failed for '+', '.join(failures))

def collect(config):
    failures = []
    for source in (audit, journal, docker, docker_file_history, docker_file_live):
        try: source(config)
        except Exception as error: failures.append(source.__name__+': '+collection_error(error))
    return failures

def checkpoint_files(root):
    return ['audit.checkpoint','audit-window.json','journal.json','docker.json','docker-created.json',*(path.name for path in root.glob('docker-file-*.json'))]

def json_events(handle, metadata, array=False):
    """Read one event from a JSON export at a time, including legacy spools."""
    decoder = json.JSONDecoder(); buffer = ''; eof = False
    def fill():
        nonlocal buffer, eof
        chunk = handle.read(65536)
        if not chunk: eof = True
        buffer += chunk
        if len(buffer) > MAX_RECORD_BYTES: raise RuntimeError('Export record exceeds 8MB')
    def whitespace():
        nonlocal buffer
        buffer = buffer.lstrip()
        while not buffer and not eof: fill(); buffer = buffer.lstrip()
    def token(expected):
        nonlocal buffer
        whitespace()
        if not buffer.startswith(expected): raise ValueError('Invalid export JSON')
        buffer = buffer[len(expected):]
    def value():
        nonlocal buffer
        whitespace()
        while True:
            try:
                result, end = decoder.raw_decode(buffer)
                buffer = buffer[end:]
                return result
            except json.JSONDecodeError:
                if eof: raise
                fill()
    def events():
        token('['); whitespace()
        if buffer.startswith(']'): token(']'); return
        while True:
            yield value(); whitespace()
            if buffer.startswith(']'): token(']'); return
            token(',')
    if array:
        yield from events()
    else:
        token('{')
        while True:
            key = value(); token(':')
            if key == 'events': yield from events()
            else: metadata[key] = value()
            whitespace()
            if buffer.startswith('}'): token('}'); break
            token(',')
    whitespace()
    if buffer: raise ValueError('Trailing export data')


def guest_export(config):
    """A disk-only export retains its source cursors until the host ACKs."""
    global STATE, send
    root = STATE
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    spool = root/'export.json'
    if not spool.exists():
        pending = root/'pending'
        if pending.exists(): shutil.rmtree(pending)
        pending.mkdir(mode=0o700)
        for name in checkpoint_files(root):
            if (root/name).exists(): shutil.copyfile(root/name, pending/name)
        staging = root/'export.pending'
        with staging.open('w') as handle:
            os.chmod(staging, 0o600)
            handle.write('{"id":'+json.dumps(uuid.uuid4().hex)+',"events":[')
            first = True
            def append(_config, batch):
                nonlocal first
                for item in batch:
                    if not first: handle.write(',')
                    json.dump(item, handle); first = False
            STATE = pending; sender = send; send = append
            try: failures = collect(config)
            finally: STATE = root; send = sender
            handle.write('],"failures":'+json.dumps(failures)+'}')
            handle.flush(); os.fsync(handle.fileno())
        staging.replace(spool); sync_directory(root)
    # Also stream legacy exports, which may already contain a large backlog.
    metadata = {}; first = True
    sys.stdout.write('{"events":[')
    with spool.open() as handle:
        for item in json_events(handle, metadata):
            item['message'] = scrub(item['message'])
            item['metadata'] = bounded_metadata(item.get('metadata', {}))
            if not first: sys.stdout.write(',')
            json.dump(item, sys.stdout); first = False
    sys.stdout.write('],"id":'+json.dumps(metadata['id'])+',"failures":'+json.dumps(metadata['failures'])+'}\n')


def guest_ack(identity):
    # IDs are first in old and new on-disk exports; never load their event array.
    with (STATE/'export.json').open() as handle: header = handle.read(256)
    match = re.match(r'\s*\{\s*"id"\s*:\s*("[^"\\]*")', header)
    if not match or json.loads(match.group(1)) != identity: raise RuntimeError('Guest export acknowledgement mismatch')
    pending = STATE/'pending'
    for name in checkpoint_files(pending):
        if (pending/name).exists(): (pending/name).replace(STATE/name)
    sync_directory(STATE)
    (STATE/'export.json').unlink(); sync_directory(STATE)
    shutil.rmtree(pending)


def recent_audit(config):
    with command_stream(['ausearch','--input-logs','-k','hanasand_exec','--raw','--start',*recent_audit_start()],accepted=(0,1)) as output:
        yield from audit_events(record_lines(output),config)


def print_recent(config):
    sys.stdout.write('['); first = True
    for item in recent_audit(config):
        if not first: sys.stdout.write(',')
        json.dump(item, sys.stdout); first = False
    sys.stdout.write(']\n')

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
            def forward(output, metadata, array=False):
                with io.TextIOWrapper(output, encoding='utf8') as handle:
                    for item in json_events(handle, metadata, array):
                        item['metadata'].update({'physical_host':config['host'], 'vm':{'name':name,'type':guest.get('type')}})
                        yield item
            # Recent executions get their own bounded pass before disk replay.
            with command_file([lxc, 'exec', name, '--', '/usr/local/sbin/hanasand-log-collector', '--recent', config['host']+'/'+name]) as output:
                send(config, forward(output, {}, array=True))
            metadata = {}
            with command_file([lxc, 'exec', name, '--', '/usr/local/sbin/hanasand-log-collector', '--export', config['host']+'/'+name, config['start']], timeout=120) as output:
                send(config, forward(output, metadata))
            command([lxc, 'exec', name, '--', '/usr/local/sbin/hanasand-log-collector', '--ack', metadata['id']])
            if metadata['failures']: failures.append(name+': '+', '.join(metadata['failures']))
        except Exception as error: failures.append(name+': '+type(error).__name__)
    save('guest-coverage.json', {'checkedAt':iso(), 'instances':[{'name':g['name'], 'status':g.get('status'), 'type':g.get('type')} for g in inventory], 'failures':failures})
    if failures: raise RuntimeError('Guest collection failed: '+', '.join(failures))

def main():
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    if len(sys.argv) > 1:
        if sys.argv[1] == '--export': return guest_export({'host':sys.argv[2], 'start':sys.argv[3]})
        if sys.argv[1] == '--ack': return guest_ack(sys.argv[2])
        if sys.argv[1] == '--recent': return print_recent({'host':sys.argv[2]})
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
                details=source(config)
                status = {'ok':True,'checkedAt':iso()}
                if isinstance(details,dict): status.update(details)
            except Exception as error:
                status = {'ok':False,'checkedAt':iso(),'error':str(error) if name=='guests' else collection_error(error)}
            with status_lock: statuses[name] = status
            time.sleep(interval)
    # Sources have independent cursors and workers. A historical journal/Docker
    # sweep must never prevent host command checks or VM collection from running.
    for lane in ('live', 'history'):
        threading.Thread(target=deliver_queue,args=(config,lane,statuses,status_lock),daemon=True).start()
    for source, interval in ((audit,5),(journal,1),(docker,5),(docker_file_history,0.25),(docker_file_live,0.1),(guests,30)):
        threading.Thread(target=worker,args=(source.__name__,source,interval),daemon=True).start()
    threading.Thread(target=worker,args=('audit_live',lambda cfg:audit(cfg,live=True),1),daemon=True).start()
    threading.Thread(target=worker,args=('journal_live',lambda cfg:journal(cfg,live=True),1),daemon=True).start()
    while True:
        with status_lock: snapshot = dict(statuses)
        failures = [name+': '+status['error'] for name,status in snapshot.items() if not status['ok']]
        coverage = load('guest-coverage.json', None)
        if coverage and coverage['failures'] and not any(item.startswith('guests:') for item in failures):
            failures.append('guests: '+', '.join(coverage['failures']))
        health = {source:snapshot.get(source,{}).get('ok') for source in ('audit','journal','docker','docker_file_history','docker_file_live','guests')}
        metadata = {'collector_health':health,'source_status':snapshot}
        save('health.json', {'checkedAt':iso(), **metadata})
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
