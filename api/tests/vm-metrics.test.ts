import { describe, expect, test } from 'bun:test'
import { cpuCount, memoryBytes, filesystemMetrics, metricSample, type Instance } from '../src/utils/vms/collectMetrics.ts'
const at = Date.parse('2026-09-12T20:00:00Z')
const vm: Instance = { name: 'cashflow', status: 'Running', last_used_at: new Date(at - 3600_000).toISOString(), expanded_config: { 'limits.cpu': '2' }, state: { cpu: { usage: 1e9 }, memory: { usage: 512 * 1048576, total: 1024 * 1048576 }, network: { eth0: { host_name: 'tap1', counters: { bytes_received: 1000, bytes_sent: 2000 } }, docker0: { counters: { bytes_received: 1e9, bytes_sent: 1e9 } } } } }
describe('VM metrics', () => {
    test('collects real memory, filesystem usage and power-on uptime', () => {
        const row = metricSample(vm, at, new Map(), { size: 100 * 1048576, free: 40 * 1048576 })
        expect(row).toMatchObject({ ram_used_mb: 512, ram_total_mb: 1024, disk_used_mb: 60, disk_total_mb: 100, uptime_seconds: 3600, power_state: 'on' })
        expect(row.cpu_usage_percent).toBeNull()
        expect(row.net_in_kbps).toBeNull()
    })
    test('calculates per-core CPU and external NIC rates between collections', () => {
        const history = new Map()
        metricSample(vm, at, history)
        const next = structuredClone(vm)
        next.state!.cpu!.usage = 61e9
        next.state!.network!.eth0.counters = { bytes_received: 61000, bytes_sent: 122000 }
        const row = metricSample(next, at + 60_000, history)
        expect(row.cpu_usage_percent).toBe(50)
        expect(row.net_in_kbps).toBe(8)
        expect(row.net_out_kbps).toBe(16)
    })
    test('separates counter history for every VM', () => {
        const history = new Map()
        metricSample(vm, at, history)
        expect(metricSample({ ...vm, name: 'another-vm' }, at + 60000, history).cpu_usage_percent).toBeNull()
        expect(history.size).toBe(2)
    })
    test('restarts, counter resets and old samples do not invent rates', () => {
        for (const next of [{ ...vm, last_used_at: new Date(at).toISOString() }, { ...vm, state: { ...vm.state, cpu: { usage: 0 } } }]) {
            const history = new Map()
            metricSample(vm, at, history)
            expect(metricSample(next, at + 60000, history).cpu_usage_percent).toBeNull()
        }
        const history = new Map()
        metricSample(vm, at, history)
        expect(metricSample(vm, at + 181000, history).cpu_usage_percent).toBeNull()
    })
    test('stopped VMs report off and zero active usage', () => {
        expect(metricSample({ ...vm, status: 'Stopped' }, at, new Map())).toMatchObject({ power_state: 'off', cpu_usage_percent: 0, net_in_kbps: 0, ram_used_mb: 0, uptime_seconds: 0, disk_used_mb: null })
    })
    test('missing counters and disk measurements remain unavailable', () => {
        const row = metricSample({ name: 'no-agent', status: 'Running' }, at, new Map())
        expect(row.ram_used_mb).toBeNull()
        expect(row.disk_used_mb).toBeNull()
        expect(row.uptime_seconds).toBeNull()
    })
    test('retains configured memory capacity for stopped VMs', () => {
        expect(memoryBytes('1GiB')).toBe(1073741824)
        expect(memoryBytes('2GB')).toBe(2000000000)
        expect(memoryBytes('25%')).toBeNull()
        expect(metricSample({ ...vm, status: 'Stopped', expanded_config: { 'limits.memory': '1GiB' }, state: { memory: { total: 0 } } }, at, new Map()).ram_total_mb).toBe(1024)
    })
    test('counts pinning ranges without duplicate CPUs', () => {
        expect(cpuCount('4')).toBe(4)
        expect(cpuCount('0-2,2,5')).toBe(4)
        expect(cpuCount('bad')).toBeNull()
    })
    test('uses only the matching project root filesystem, including exponent values', () => {
        const text = 'lxd_filesystem_size_bytes{name="cashflow",project="default",mountpoint="/"} 1e9\n' +
            'lxd_filesystem_free_bytes{name="cashflow",project="default",mountpoint="/"} 2e8\n' +
            'lxd_filesystem_size_bytes{name="cashflow",project="other",mountpoint="/"} 9e9\n' +
            'lxd_filesystem_size_bytes{name="cashflow",project="default",mountpoint="/run"} 8e9'
        expect(filesystemMetrics(text).get('cashflow')).toEqual({ size: 1e9, free: 2e8 })
    })
})
