import json
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

import setup


class MailRelaySetupTests(unittest.TestCase):
    def test_mail_admin_reads_config_from_running_mail_container_when_file_is_private(self):
        config = '[authentication.fallback-admin]\nuser = "relay-admin"\nsecret = "test-secret"\n'
        with patch.object(Path, 'read_text', side_effect=PermissionError), patch.object(
            setup.subprocess, 'check_output', return_value=config
        ) as check_output:
            self.assertEqual(setup.mail_admin(), {'user': 'relay-admin', 'secret': 'test-secret'})
        check_output.assert_called_once_with(
            ['docker', 'exec', 'hanasand_mail', 'cat', '/opt/stalwart/etc/config.toml'], text=True
        )

    def test_start_replaces_container_when_volume_source_changed(self):
        current = [{
            'Config': {'Image': 'health:latest'},
            'Mounts': [{'Source': '/old/health', 'Destination': '/run/config'}],
            'NetworkSettings': {'Networks': {'private': {'IPAddress': '172.30.0.8'}}},
        }]
        with patch.object(setup.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)) as run, patch.object(
            setup.subprocess, 'check_output', return_value=json.dumps(current)
        ):
            setup.start('health', 'health:latest', 'private', ['/new/health:/run/config:ro'], [], aliases=())
        commands = [call.args[0][1] for call in run.call_args_list]
        self.assertEqual(commands, ['inspect', 'stop', 'rm', 'run'])


if __name__ == '__main__':
    unittest.main()
