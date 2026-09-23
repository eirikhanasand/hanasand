#!/usr/bin/env python3
"""Deploy only the native probe caller, preserving its live Docker configuration."""
import argparse
import fcntl
import http.client
import json
from pathlib import Path
import re
import socket
import subprocess
import time
import tempfile
import urllib.request
from probe_verification_config import probe_verification_settings


class DockerConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.connect('/var/run/docker.sock')


def docker_api(method, path, body=None):
    connection = DockerConnection('localhost', timeout=45)
    connection.request(method, '/v1.41' + path, None if body is None else json.dumps(body), {'Content-Type': 'application/json'})
    response = connection.getresponse()
    raw = response.read()
    connection.close()
    if response.status >= 300:
        raise RuntimeError(f'Docker operation failed: {method} {path}: HTTP {response.status}')
    return json.loads(raw) if raw else None


def health():
    with urllib.request.urlopen('http://127.0.0.1:18182/health', timeout=3) as response:
        return json.load(response)


def idle(state):
    if 'activeRequests' in state:
        return state['activeRequests'] == 0
    # Older callers do not expose active counts; completion timestamps cannot
    # prove idleness when multiple lanes run concurrently.
    return model_lanes_idle()


def model_lanes_idle(fetch=None):
    def read(port):
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/metrics', timeout=2) as response:
            return response.read(4 * 1024 * 1024).decode('utf8')
    try:
        for port in range(18081, 18089):
            text = (fetch or read)(port)
            for metric in ('num_requests_running', 'num_requests_waiting'):
                values = re.findall(r'^vllm:' + metric + r'(?:\{[^\n]*\})? ([^\s]+)(?: [0-9]+)?$', text, re.MULTILINE)
                if not values or any(float(value) != 0 for value in values):
                    return False
        return True
    except (OSError, ValueError):
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--release', required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--expected-image', required=True)
    args = parser.parse_args()
    if not re.fullmatch('[a-f0-9]{40}', args.release):
        raise RuntimeError('Exact committed release required')
    key = probe_verification_settings().get('MODEL_PROBE_PROOF_KEY')
    if not key:
        raise RuntimeError('Provision the common verification key first')
    source = Path(args.source).resolve()
    image = 'hanasand-ai-model-client:' + args.release
    subprocess.run(['docker', 'build', '-t', image, '--label', 'org.opencontainers.image.revision=' + args.release,
                    '-f', str(source / 'ti/ai-model-client/Dockerfile'), str(source)], check=True)
    lock = open('/tmp/hanasand-frontend-deploy.lock', 'a')
    fcntl.flock(lock, fcntl.LOCK_EX)
    name = 'hanasand_ai_model_client'
    previous = docker_api('GET', '/containers/' + name + '/json')
    if previous['Config']['Image'] != args.expected_image or previous['HostConfig']['NetworkMode'] != 'host':
        raise RuntimeError('Runtime changed; inspect before replacing')
    # The key never enters command arguments, output, the image, or the shared .env.
    subprocess.run(['sudo', '-n', 'install', '-d', '-m', '700', '-o', 'root', '-g', 'root',
                    '/var/lib/hanasand/model-probe-config', '/var/lib/hanasand/model-probe-receipts'], check=True)
    with tempfile.NamedTemporaryFile(mode='w') as temporary:
        json.dump({'MODEL_PROBE_PROOF_KEY': key}, temporary)
        temporary.flush()
        subprocess.run(['sudo', '-n', 'install', '-m', '600', '-o', 'root', '-g', 'root', temporary.name,
                        '/var/lib/hanasand/model-probe-config/verification.json'], check=True)
    for _ in range(45):
        state = health()
        if state.get('connected') and state.get('modelHealth', {}).get('ready') and idle(state):
            time.sleep(1)
            if idle(health()):
                break
        time.sleep(1)
    else:
        raise RuntimeError('Model client did not become idle; caller remains running')
    backup = name + '_probe_rollback_' + args.release[:12]
    config = previous['Config'].copy()
    config['Image'] = image
    config['Env'] = [value for value in config.get('Env', []) if value.split('=', 1)[0] not in
                     ('MODEL_PROBE_PROOF_DIR', 'MODEL_PROBE_PROOF_KEY', 'MODEL_PROBE_VERIFICATION_FILE', 'HANASAND_RELEASE_COMMIT')]
    config['Env'] += ['MODEL_PROBE_PROOF_DIR=/model-probe-receipts', 'HANASAND_RELEASE_COMMIT=' + args.release]
    config['Labels'] = {**config.get('Labels', {}), 'org.opencontainers.image.revision': args.release}
    host = previous['HostConfig'].copy()
    host['Binds'] = [value for value in host.get('Binds', []) if value.split(':')[1] not in ('/model-probe-receipts', '/model-probe-config')]
    host['Binds'] += ['/var/lib/hanasand/model-probe-receipts:/model-probe-receipts:rw',
                     '/var/lib/hanasand/model-probe-config:/model-probe-config:ro']
    config['HostConfig'] = host
    stopped = renamed = created = False
    try:
        docker_api('POST', '/containers/' + name + '/stop?t=15'); stopped = True
        docker_api('POST', '/containers/' + name + '/rename?name=' + backup); renamed = True
        docker_api('POST', '/containers/create?name=' + name, config); created = True
        docker_api('POST', '/containers/' + name + '/start')
        for _ in range(45):
            time.sleep(2)
            try:
                state = health()
                if state.get('connected') and state.get('modelHealth', {}).get('ready') and state.get('modelProbeProof', {}).get('lastProofAt'):
                    live = docker_api('GET', '/containers/' + name + '/json')
                    if live['Config']['Image'] != image:
                        raise RuntimeError('Unexpected live model client image')
                    docker_api('DELETE', '/containers/' + backup)
                    print('Model client healthy with native signed proof at release ' + args.release)
                    return
            except (OSError, ValueError):
                pass
        raise RuntimeError('Signed probe readiness not confirmed')
    except Exception:
        if created:
            docker_api('DELETE', '/containers/' + name + '?force=true')
        if renamed:
            docker_api('POST', '/containers/' + backup + '/rename?name=' + name)
        if stopped:
            docker_api('POST', '/containers/' + name + '/start')
        raise


if __name__ == '__main__':
    main()
