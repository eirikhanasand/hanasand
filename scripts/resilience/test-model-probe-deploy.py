import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('deploy_model', Path(__file__).with_name('deploy-model-probe-client.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class DrainTests(unittest.TestCase):
    def test_all_lanes_must_be_idle(self):
        empty = 'vllm:num_requests_running{model_name="hanasand"} 0.0\nvllm:num_requests_waiting{model_name="hanasand"} 0.0\n'
        self.assertTrue(module.model_lanes_idle(lambda port: empty))
        for metric in ('running', 'waiting'):
            self.assertFalse(module.model_lanes_idle(lambda port: empty.replace(metric + '{model_name="hanasand"} 0.0', metric + '{model_name="hanasand"} 1.0') if port == 18088 else empty))
        self.assertFalse(module.model_lanes_idle(lambda port: ''))
        self.assertFalse(module.model_lanes_idle(lambda port: empty.replace('0.0', 'NaN')))
        self.assertFalse(module.model_lanes_idle(lambda port: empty.replace('0.0', 'invalid')))
        self.assertFalse(module.model_lanes_idle(lambda port: (_ for _ in ()).throw(OSError('offline'))))


if __name__ == '__main__':
    unittest.main()
