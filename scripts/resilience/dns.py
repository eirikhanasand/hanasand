"""Scoped DNS recovery. No wildcard, mail, or unrelated record changes."""
import base64
import json
import pathlib
import subprocess
import time
import urllib.request


def api(config, path, payload=None):
    values = dict(line.split('=', 1) for line in pathlib.Path(config['credentialsFile']).read_text().splitlines() if '=' in line and not line.lstrip().startswith('#'))
    values = {key.strip(): value.strip() for key, value in values.items()}
    auth = base64.b64encode((values['dns_domeneshop_client_token'] + ':' + values['dns_domeneshop_client_secret']).encode()).decode()
    request = urllib.request.Request('https://api.domeneshop.no/v0' + path, data=json.dumps(payload).encode() if payload is not None else None,
        headers={'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json', 'User-Agent': 'Hanasand-Resilience/1.0'}, method='PUT' if payload is not None else 'GET')
    with urllib.request.urlopen(request, timeout=10) as response:
        body = response.read()
        return json.loads(body) if body else None


def probe(host, ip, path):
    try:
        result = subprocess.run(['curl', '-fsS', '--max-time', '4', '--resolve', f'{host}:443:{ip}', '-o', '/dev/null', f'https://{host}{path}'], capture_output=True, timeout=5)
        return result.returncode == 0
    except subprocess.SubprocessError:
        return False


def reconcile(config, state, previous):
    if not config or not config.get('enabled'):
        return {'status': 'disabled', 'reason': 'Standby public endpoints must pass validation before DNS recovery is enabled.'}, []
    result, events = {}, []
    for record in config['records']:
        if record['host'] not in ('@', 'api', 'www') or record['type'] != 'A':
            raise ValueError('DNS recovery record outside allowed scope')
        host = 'hanasand.com' if record['host'] == '@' else record['host'] + '.hanasand.com'
        old = previous.get(host, {})
        primary_ready = probe(host, config['primaryIp'], record['checkPath'])
        standby_ready = probe(host, config['standbyIp'], record['checkPath'])
        # Public primary health includes both local instances and proxy failover.
        # Losing only the private tunnel must never initiate a DNS failover.
        target = 'inspur' if primary_ready else 'ovhcloud' if standby_ready else None
        candidate_since = old.get('candidateSince', time.time()) if target == old.get('candidate') else time.time()
        current = dict(old, candidate=target, candidateSince=candidate_since, primaryReady=primary_ready, standbyReady=standby_ready)
        delay = 120 if target == 'inspur' else 15
        if target and time.time() - candidate_since >= delay and time.time() - old.get('verifiedAt', 0) >= 30:
            path = f"/domains/{config['domainId']}/dns/{record['id']}"
            existing = api(config, path)
            if existing['host'] != record['host'] or existing['type'] != 'A': raise ValueError('DNS record identity changed')
            if existing['data'] not in (config['primaryIp'], config['standbyIp']): raise ValueError('DNS record was changed by another operator')
            desired = config['primaryIp'] if target == 'inspur' else config['standbyIp']
            if existing['data'] != desired:
                api(config, path, dict(host=record['host'], type='A', ttl=60, data=desired))
                verified = api(config, path)
                if verified['data'] != desired: raise ValueError('DNS change not verified')
                events.append({'title': ('Failback' if target == 'inspur' else 'Failover') + ': ' + host,
                    'description': f"Public endpoint switched to {target}. DNS caches may take up to the configured TTL to refresh. " + ('Preferred site is stable again.' if target == 'inspur' else 'Both local service paths failed the public readiness check.'),
                    'color': 0x00CC66 if target == 'inspur' else 0xFF0000,
                    'fields': [{'name': 'Still affected', 'value': ', '.join(state.get('affected', [])) or 'All monitored services are back to normal.'}]})
            current.update(activeSite=target, verifiedAt=time.time(), ttl=60)
        result[host] = current
    return result, events
