import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('health_routes', Path(__file__).with_name('install-health-routes.py'))
routes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(routes)
REVISION = 'a' * 40
SOURCE = """server {
    listen 443 ssl;
    server_name hanasand.com;
    location / { proxy_pass http://website; }
}

server {
    listen 443 ssl;
    server_name api.hanasand.com;
    location / { proxy_pass http://application; }
}
"""


class HealthRouteTests(unittest.TestCase):
    def test_each_gateway_reads_its_local_relay_and_verifies_the_fixed_peer(self):
        for site, peer in [('inspur', 'ovh'), ('ovh', 'inspur')]:
            config = routes.routes(site, REVISION)
            self.assertIn(f'proxy_pass http://127.0.0.1:{routes.SITES[site][1]}/health;', config)
            self.assertIn(f'proxy_pass https://{routes.SITES[peer][0]}/api/mail-relay/{peer}/health;', config)
            self.assertIn('proxy_ssl_verify on;', config)
            self.assertIn('proxy_ssl_name api.hanasand.com;', config)
            self.assertNotIn('hanasand_recovery_api', config)
            self.assertEqual(config.count('limit_except GET { deny all; }'), 2)
            self.assertEqual(config.count('proxy_pass_request_headers off;'), 2)
            self.assertEqual(config.count('proxy_intercept_errors off;'), 2)
            self.assertIn('limit_req_status 429;', config)
            self.assertIn('error_page 502 504 =503', config)
            self.assertIn('"ok":false', config)
            self.assertIn('Cache-Control "no-store" always;', config)

    def test_only_public_api_host_changes_and_install_is_idempotent(self):
        updated = routes.include_routes(SOURCE)
        self.assertEqual(updated, routes.include_routes(updated))
        self.assertEqual(updated.count(routes.INCLUDE), 1)
        self.assertEqual(updated.split('server_name api.hanasand.com;')[0], SOURCE.split('server_name api.hanasand.com;')[0])
        self.assertIn('location / { proxy_pass http://application; }', updated)
        with self.assertRaises(ValueError): routes.include_routes(SOURCE.replace('api.hanasand.com', 'other.example'))
        with self.assertRaises(ValueError): routes.include_routes(SOURCE + SOURCE)
        with self.assertRaises(ValueError): routes.routes('ovh', 'not-a-revision')

    def test_failed_nginx_validation_restores_all_prior_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'conf.d').mkdir()
            (root / 'snippets').mkdir()
            main = root / 'conf.d/default.conf'
            main.write_text(SOURCE)
            snippet = root / 'snippets/mail-relay-health.conf'
            snippet.write_text('previous configuration')
            failure = subprocess.CalledProcessError(1, 'nginx -t')
            with patch.object(routes.subprocess, 'run', side_effect=[failure, None]) as run:
                with self.assertRaises(subprocess.CalledProcessError): routes.install('ovh', root, REVISION)
            self.assertEqual(main.read_text(), SOURCE)
            self.assertEqual(snippet.read_text(), 'previous configuration')
            self.assertFalse((root / 'conf.d/mail-relay-health-limit.conf').exists())
            self.assertEqual(run.call_count, 2)


if __name__ == '__main__': unittest.main()
