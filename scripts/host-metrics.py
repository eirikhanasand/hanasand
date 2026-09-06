#!/usr/bin/env python3
"""Collect host metrics once; API workers consume the same atomic snapshot."""
import datetime
import json
import math
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import time
import xml.etree.ElementTree as ET


def number(value):
    try:
        result = float(str(value).split()[0])
        return result if math.isfinite(result) else None
    except (ValueError, TypeError, IndexError):
        return None


def read_number(path):
    try:
        return number(path.read_text())
    except OSError:
        return None


def limited_sensor(label, value, limit, unit):
    threshold = math.floor(limit * 0.9) if limit is not None and limit > 0 else None
    return {'label': label, 'value': value, 'unit': unit, 'reportedLimit': limit,
            'alertLimit': threshold, 'margin': round(threshold - value, 3) if threshold is not None and value is not None else None}


def cpu_sample():
    values = list(map(int, Path('/proc/stat').read_text().splitlines()[0].split()[1:9]))
    return sum(values), values[3] + values[4]


def cpu_percent(first, second):
    total, idle = second[0] - first[0], second[1] - first[1]
    return round(100 * (1 - idle / total), 2) if total > 0 else None


def rapl_samples():
    result = {}
    for path in Path('/sys/class/powercap').glob('intel-rapl:*'):
        if path.name.count(':') != 1:
            continue
        value = read_number(path / 'energy_uj')
        if value is not None:
            result[str(path)] = (value, time.monotonic())
    return result


def collect():
    first, energy = cpu_sample(), rapl_samples()
    time.sleep(1)
    cpu = cpu_percent(first, cpu_sample())
    power = []
    for raw_path, (start, started) in energy.items():
        path = Path(raw_path)
        end = read_number(path / 'energy_uj')
        limit = read_number(path / 'constraint_0_power_limit_uw')
        maximum = read_number(path / 'max_energy_range_uj')
        if end is not None:
            delta = end - start
            if delta < 0 and maximum:
                delta += maximum
            watts = delta / 1_000_000 / (time.monotonic() - started)
            power.append(limited_sensor(path.name, round(watts, 2), limit / 1_000_000 if limit else None, 'W'))
    memory = {line.split(':')[0]: int(line.split()[1]) * 1024 for line in Path('/proc/meminfo').read_text().splitlines() if ':' in line and line.split()[1].isdigit()}
    storage, devices = [], set()
    for line in Path('/proc/mounts').read_text().splitlines():
        device, target, kind = line.split()[:3]
        if not device.startswith('/dev/') or kind in ('squashfs', 'iso9660'):
            continue
        target = re.sub(r'\\([0-7]{3})', lambda m: chr(int(m[1], 8)), target)
        try:
            identity = os.stat(target).st_dev
            if identity in devices:
                continue
            stats = os.statvfs(target)
            used, available = stats.f_blocks - stats.f_bfree, stats.f_bavail
            storage.append({'path': target, 'device': device, 'usedPercent': round(100 * used / (used + available), 2) if used + available else None,
                            'totalBytes': stats.f_blocks * stats.f_frsize, 'availableBytes': available * stats.f_frsize})
            devices.add(identity)
        except OSError:
            continue
    temperatures = []
    for hwmon in sorted(Path('/sys/class/hwmon').glob('hwmon*')):
        for path in sorted(hwmon.glob('temp*_input')):
            stem = path.name.removesuffix('_input')
            value = read_number(path)
            limit = read_number(hwmon / (stem + '_max')) or read_number(hwmon / (stem + '_crit'))
            if value is not None:
                label_file = hwmon / (stem + '_label')
                label = label_file.read_text().strip() if label_file.exists() else stem
                temperatures.append(limited_sensor(f'{hwmon.name} {label}', value / 1000, limit / 1000 if limit else None, '°C'))
    gpus, unavailable = [], []
    try:
        document = ET.fromstring(subprocess.check_output(['nvidia-smi', '-q', '-x'], timeout=10, stderr=subprocess.DEVNULL))
        for gpu in document.findall('gpu'):
            label = gpu.findtext('uuid') or gpu.attrib['id']
            gpus.append({'id': label, 'name': gpu.findtext('product_name'), 'usedPercent': number(gpu.findtext('utilization/gpu_util'))})
            for field, limit_field, suffix in [('gpu_temp', 'gpu_temp_max_gpu_threshold', 'GPU'), ('memory_temp', 'gpu_temp_max_mem_threshold', 'memory')]:
                value = number(gpu.findtext('temperature/' + field))
                limit = number(gpu.findtext('temperature/' + limit_field))
                if value is not None:
                    temperatures.append(limited_sensor(label + ' ' + suffix, value, limit, '°C'))
            value = number(gpu.findtext('gpu_power_readings/instant_power_draw'))
            limit = number(gpu.findtext('gpu_power_readings/current_power_limit'))
            if value is not None:
                power.append(limited_sensor(label, value, limit, 'W'))
    except (OSError, subprocess.SubprocessError, ET.ParseError) as error:
        unavailable.append('GPU telemetry unavailable: ' + type(error).__name__)
    if not energy:
        unavailable.append('CPU package power is unavailable.')
    unavailable.append('Whole-host wall power is not metered; power readings cover the reported CPU/GPU devices only.')
    return {'name': socket.gethostname(), 'sampledAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'cpuPercent': cpu, 'memoryPercent': round(100 * (1 - memory['MemAvailable'] / memory['MemTotal']), 2),
            'memoryTotalBytes': memory['MemTotal'], 'memoryAvailableBytes': memory['MemAvailable'],
            'storage': storage, 'gpus': gpus, 'temperatures': temperatures, 'power': power, 'unavailable': unavailable}


if __name__ == '__main__':
    destination = Path(sys.argv[1] if len(sys.argv) > 1 else '/var/lib/hanasand/metrics/host.json')
    payload = collect()
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(payload, allow_nan=False))
    temporary.chmod(0o644)
    temporary.replace(destination)
