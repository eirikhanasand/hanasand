import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('relay_health', Path(__file__).with_name('health.py'))
health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(health)


class HealthTests(unittest.TestCase):
    def test_failure_and_stale_samples_never_report_ready(self):
        self.assertTrue(health.public_state(health.snapshot('test', {'smtp': True}, 100), 110)['ok'])
        self.assertFalse(health.public_state(health.snapshot('test', {'smtp': True}, 100), 191)['ok'])
        self.assertFalse(health.public_state(health.snapshot('test', {'smtp': False}, 100), 110)['ok'])
        self.assertFalse(health.public_state({'ok': True, 'checkedAt': None}, 110)['ok'])

    def test_queue_age_and_failed_queue_reads(self):
        settings = {'url': 'http://mail', 'username': 'read-only', 'password': 'test'}
        for created, healthy in [(950, True), (600, False)]:
            responses = [io.BytesIO(json.dumps({'data': {'items': [1], 'total': 1}}).encode()), io.BytesIO(json.dumps({'data': {'created': created}}).encode())]
            with patch.object(health.urllib.request, 'urlopen', side_effect=responses), patch.object(health.time, 'time', return_value=1000):
                if healthy:
                    self.assertTrue(health.queue_probe(settings))
                else:
                    with self.assertRaises(ValueError): health.queue_probe(settings)
        with patch.object(health.urllib.request, 'urlopen', return_value=io.BytesIO(b'{"error":"forbidden"}')):
            with self.assertRaises(ValueError): health.queue_probe(settings)

    def test_submission_requires_authentication_and_never_sends_data(self):
        class SMTP:
            def __init__(self, **_): self.logged_in = False
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def connect(self, *_): pass
            def ehlo(self, *_): pass
            def starttls(self, context): pass
            def login(self, username, password): self.logged_in = True
            def mail(self, *_): return (250 if self.logged_in else 530, b'')
            def rcpt(self, *_): return (250 if self.logged_in else 550, b'')
            def rset(self): pass
        settings = {'host': 'mail', 'port': 587, 'serverName': 'mail.example.test', 'username': 'test', 'password': 'test'}
        with patch.object(health.smtplib, 'SMTP', SMTP): self.assertTrue(health.smtp_probe(settings, True))
        class OpenRelay(SMTP):
            def mail(self, *_): return 250, b''
            def rcpt(self, *_): return 250, b''
        with patch.object(health.smtplib, 'SMTP', OpenRelay):
            with self.assertRaises(ValueError): health.smtp_probe(settings, True)


if __name__ == '__main__': unittest.main()
