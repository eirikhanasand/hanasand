#!/usr/bin/env python3
"""Enforce published DMARC rejection policies at the Inspur inbound boundary.

Run from a pushed revision on Inspur. The OVH gateway preserves the original
client IP using PROXY protocol; authenticated submission remains unaffected.
"""
import base64
import json
import subprocess
import tomllib
import urllib.request


def main():
    config = tomllib.loads(subprocess.check_output([
        'docker', 'exec', 'hanasand_mail', 'cat', '/opt/stalwart/etc/config.toml',
    ], text=True))
    admin = config['authentication']['fallback-admin']
    authorization = base64.b64encode((admin['user'] + ':' + admin['secret']).encode()).decode()

    def call(path, body=None):
        request = urllib.request.Request('http://127.0.0.1:8081/api' + path,
            headers={'Authorization': 'Basic ' + authorization, 'Content-Type': 'application/json'},
            data=json.dumps(body).encode() if body is not None else None)
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.load(response)
        data = result.get('data')
        if result.get('error') or (isinstance(data, dict) and data.get('errors')):
            raise RuntimeError('Sender authentication configuration failed; inspect the mail server logs.')
        return result

    prefix = 'auth.dmarc.verify'
    old = call('/settings/keys?keys=' + prefix + '&prefixes=' + prefix)['data']
    values = {
        prefix + '.0.if': "local_port == 25 && is_empty(authenticated_as)",
        prefix + '.0.then': 'strict',
        prefix + '.1.else': 'disable',
    }

    def save(settings):
        call('/settings', [
            {'type': 'clear', 'prefix': prefix},
            {'type': 'insert', 'assert_empty': False, 'prefix': None, 'values': list(settings.items())},
        ])
        call('/reload')

    try:
        save(values)
        if call('/settings/keys?keys=' + prefix + '&prefixes=' + prefix)['data'] != values:
            raise RuntimeError('Sender authentication settings did not persist.')
    except Exception:
        save(old)
        raise
    print('Incoming SMTP enforces DMARC rejection; authenticated submission is unchanged.')


if __name__ == '__main__':
    main()
