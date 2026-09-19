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

    def test_incoming_probe_requires_tls_and_never_submits_mail(self):
        from unittest.mock import MagicMock
        smtp = MagicMock()
        smtp.__enter__.return_value = smtp
        smtp.ehlo.return_value = (250, b'OK')
        with patch.object(health.smtplib, 'SMTP', return_value=smtp):
            self.assertTrue(health.incoming_probe({'host': '192.0.2.1'}))
            smtp.starttls.assert_called_once()
            smtp.mail.assert_not_called()
            smtp.data.assert_not_called()
            smtp.starttls.side_effect = health.ssl.SSLError('certificate verification failed')
            with self.assertRaises(health.ssl.SSLError):
                health.incoming_probe({'host': '192.0.2.1'})

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

    def test_scheduled_reports_only_become_backlog_after_the_first_attempt_is_due(self):
        settings = {'url': 'http://mail', 'username': 'read-only', 'password': 'test'}
        scheduled = {'status': 'scheduled', 'retry_num': 0,
                     'next_retry': '2026-09-19T02:10:45Z'}
        due = health.datetime.fromisoformat(scheduled['next_retry']).timestamp()
        message = {'created': '2026-09-19T00:00:00Z', 'recipients': [scheduled]}
        for now, healthy in [(due - 3600, True), (due, True), (due + 300, True), (due + 301, False)]:
            with self.subTest(now=now):
                responses = [io.BytesIO(json.dumps({'data': {'items': [1], 'total': 1}}).encode()),
                             io.BytesIO(json.dumps({'data': message}).encode())]
                with patch.object(health.urllib.request, 'urlopen', side_effect=responses), patch.object(health.time, 'time', return_value=now):
                    if healthy:
                        self.assertTrue(health.queue_probe(settings))
                    else:
                        with self.assertRaisesRegex(ValueError, 'Delivery backlog'):
                            health.queue_probe(settings)

    def test_scheduled_recipients_do_not_hide_failed_or_overdue_deliveries(self):
        settings = {'url': 'http://mail', 'username': 'read-only', 'password': 'test'}
        scheduled = {'status': 'scheduled', 'retry_num': 0, 'next_retry': 2000}
        completed = {'status': {'completed': '250 OK'}}
        for recipient in [
            {'status': {'temp_fail': '451 Try later'}, 'retry_num': 1, 'next_retry': 2000},
            {'status': {'perm_fail': '550 Rejected'}},
            {**scheduled, 'retry_num': 1},
            {**scheduled, 'next_retry': 600},
            {'status': 'scheduled', 'retry_num': 0},
            {},
        ]:
            with self.subTest(recipient=recipient):
                message = {'created': 100, 'recipients': [completed, scheduled, recipient]}
                responses = [io.BytesIO(json.dumps({'data': {'items': [1], 'total': 1}}).encode()),
                             io.BytesIO(json.dumps({'data': message}).encode())]
                with patch.object(health.urllib.request, 'urlopen', side_effect=responses), patch.object(health.time, 'time', return_value=1000):
                    with self.assertRaisesRegex(ValueError, 'Delivery backlog'):
                        health.queue_probe(settings)

    def test_queue_limit_is_still_enforced(self):
        response = io.BytesIO(b'{"data":{"items":[],"total":101}}')
        with patch.object(health.urllib.request, 'urlopen', return_value=response):
            with self.assertRaisesRegex(ValueError, 'Queue limit exceeded'):
                health.queue_probe({'url': 'http://mail', 'username': 'read-only', 'password': 'test'})

    def test_submission_requires_authentication_and_never_sends_data(self):
        senders = []
        class SMTP:
            def __init__(self, **_): self.logged_in = False
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def connect(self, *_): pass
            def ehlo(self, *_): pass
            def starttls(self, context): pass
            def login(self, username, password): self.logged_in = True
            def mail(self, sender):
                senders.append(sender)
                return (250 if self.logged_in else 530, b'')
            def rcpt(self, *_):
                if self.logged_in: raise AssertionError('Probe consumed delivery quota')
                return (550, b'')
            def rset(self): pass
        settings = {'host': 'mail', 'port': 587, 'serverName': 'mail.example.test', 'username': 'test', 'password': 'test', 'sender': 'sales@hanasand.com'}
        with patch.object(health.smtplib, 'SMTP', SMTP): self.assertTrue(health.smtp_probe(settings, True))
        self.assertEqual(senders, ['sales@hanasand.com', 'sales@hanasand.com'])
        class OpenRelay(SMTP):
            def mail(self, *_): return 250, b''
            def rcpt(self, *_): return 250, b''
        with patch.object(health.smtplib, 'SMTP', OpenRelay):
            with self.assertRaises(ValueError): health.smtp_probe(settings, True)


if __name__ == '__main__': unittest.main()
