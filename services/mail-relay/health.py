"""Private relay readiness. Probes never send DATA or create messages."""
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import smtplib
import socket
import ssl
import subprocess
import threading
import time
import urllib.request

STATE = {'ok': False, 'checkedAt': None, 'checks': {}}
LOCK = threading.Lock()


def smtp_probe(settings, reject_anonymous=False):
    with smtplib.SMTP(timeout=5) as smtp:
        smtp.connect(settings['host'], settings['port'])
        smtp._host = settings['serverName']
        smtp.ehlo('mail.hanasand.com')
        smtp.starttls(context=ssl.create_default_context())
        smtp.ehlo('mail.hanasand.com')
        if reject_anonymous:
            code, _ = smtp.mail('noreply@hanasand.com')
            if code < 400:
                code, _ = smtp.rcpt('postmaster@example.net')
            if code < 400:
                raise ValueError('Anonymous relay accepted')
            smtp.rset()
        smtp.login(settings['username'], settings['password'])
        # RCPT consumes per-sender delivery quotas even without DATA.
        if smtp.mail('noreply@hanasand.com')[0] != 250:
            raise ValueError('Authenticated relay rejected')
        smtp.rset()
    return True


def queue_probe(settings):
    auth = base64.b64encode((settings['username'] + ':' + settings['password']).encode()).decode()
    def get(path):
        request = urllib.request.Request(settings['url'] + path, headers={'Authorization': 'Basic ' + auth})
        with urllib.request.urlopen(request, timeout=5) as response:
            body = json.load(response)
        if body.get('error') or 'data' not in body:
            raise ValueError('Queue unavailable')
        return body['data']
    queue = get('/api/queue/messages?limit=101')
    if queue['total'] > 100:
        raise ValueError('Queue limit exceeded')
    # A small queue is normal; messages older than five minutes are not.
    for item in queue['items']:
        message = get('/api/queue/messages/' + str(item))
        created = message['created']
        at = datetime.fromisoformat(created.replace('Z', '+00:00')).timestamp() if isinstance(created, str) else float(created)
        if time.time() - at > 300:
            raise ValueError('Delivery backlog')
    return True


def incoming_probe(settings):
    with smtplib.SMTP(timeout=5) as smtp:
        smtp.connect(settings['host'], 25)
        smtp._host = 'mail.hanasand.com'
        smtp.ehlo('mail.hanasand.com')
        smtp.starttls(context=ssl.create_default_context())
        if smtp.ehlo('mail.hanasand.com')[0] != 250:
            raise ValueError('Incoming SMTP unavailable')
    return True


def outbound_probe():
    with socket.create_connection(('hotmail-com.olc.protection.outlook.com', 25), timeout=5) as connection:
        if not connection.recv(512).startswith(b'220 '):
            raise ValueError('SMTP greeting unavailable')
        connection.sendall(b'QUIT\r\n')
    return True


def snapshot(service, checks, now=None):
    return {'service': service, 'ok': bool(checks) and all(checks.values()),
            'checkedAt': datetime.fromtimestamp(now or time.time(), timezone.utc).isoformat(), 'checks': checks}


def public_state(value, now=None):
    result = dict(value)
    at = result.get('checkedAt')
    fresh = at and 0 <= (now or time.time()) - datetime.fromisoformat(at).timestamp() <= 90
    result['ok'] = result.get('ok') is True and bool(fresh)
    result['summary'] = 'Mail relay is ready.' if result['ok'] else 'Mail relay needs attention.'
    return result


def poll(config):
    global STATE
    tunnel = None
    try:
        while True:
            if config['site'] == 'inspur' and (tunnel is None or tunnel.poll() is not None):
                tunnel = subprocess.Popen(['ssh', '-NT', '-i', '/run/ssh/key',
                    '-o', 'UserKnownHostsFile=/run/ssh/known_hosts', '-o', 'StrictHostKeyChecking=yes',
                    '-o', 'IdentitiesOnly=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ConnectTimeout=5',
                    '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3',
                    '-L', '0.0.0.0:1587:127.0.0.1:2687', '-L', '0.0.0.0:8081:127.0.0.1:19262',
                    '-R', '127.0.0.1:2625:stalwart:25',
                    'ubuntu@192.99.32.185'])
            tasks = {'smtpAuthentication': lambda: smtp_probe(config['smtp'], config['site'] == 'ovh'),
                     'queueHealthy': lambda: queue_probe(config['queue'])}
            if config['site'] == 'inspur':
                tasks['relayAuthentication'] = lambda: smtp_probe(config['relay'], True)
            else:
                tasks['outboundDeliveryConnection'] = outbound_probe
                if config.get('incoming'):
                    tasks['incomingConnection'] = lambda: incoming_probe(config['incoming'])
            checks = {}
            with ThreadPoolExecutor(max_workers=4) as pool:
                pending = {key: pool.submit(action) for key, action in tasks.items()}
                for key, future in pending.items():
                    try:
                        checks[key] = future.result() is True
                    except Exception:
                        checks[key] = False
            if tunnel is not None:
                checks['tunnel'] = tunnel.poll() is None
            current = snapshot('mail-relay-' + config['site'], checks)
            with LOCK:
                previous = STATE
                STATE = current
            if previous.get('checks') != checks:
                print(json.dumps(current), flush=True)
            time.sleep(30)
    finally:
        if tunnel is not None:
            tunnel.terminate()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/health':
            self.send_error(404)
            return
        with LOCK:
            body = public_state(STATE)
        encoded = json.dumps(body).encode()
        self.send_response(200 if body['ok'] else 503)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, *_):
        pass


if __name__ == '__main__':
    with open('/run/config/health.json') as source:
        config = json.load(source)
    threading.Thread(target=poll, args=(config,), daemon=True).start()
    ThreadingHTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
