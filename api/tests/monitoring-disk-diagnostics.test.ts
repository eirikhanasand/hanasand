import { expect, mock, test } from 'bun:test'
mock.module('../src/utils/db.ts', () => ({ default: async () => ({ rows: [] }) }))
const { diskDiagnosticsFor } = await import('../src/utils/monitoringDiskDiagnostics.ts')
const now = Date.now()
const monitor = { target_url: 'system:metrics', json_rule: { path: 'host.storage.*.usedPercent' } }
const snapshot = { sampledAt: new Date(now).toISOString(), host: 'inspur', filesystems: [{ path: '/', usedPercent: 85, complete: false, directories: Array.from({ length: 30 }, (_, i) => ({ path: '/some folder/' + i, sizeBytes: i * 1024 })) }] }
test('disk incidents retain the largest 20 full paths, exact sizes and partial-scan status', () => {
    const result = diskDiagnosticsFor(monitor, snapshot, now)!
    expect(result.filesystems[0].directories).toHaveLength(20)
    expect(result.filesystems[0].directories[0]).toEqual({ path: '/some folder/29', sizeBytes: 29 * 1024 })
    expect(result.filesystems[0].complete).toBe(false)
    expect(diskDiagnosticsFor({ ...monitor, json_rule: { path: 'hosts.ovhcloud.storage.*.usedPercent' } }, snapshot, now)).not.toBeNull()
})
test('unrelated checks and stale or malformed snapshots cannot become disk evidence', () => {
    expect(diskDiagnosticsFor({ ...monitor, target_url: 'https://example.com' }, snapshot, now)).toBeNull()
    expect(diskDiagnosticsFor({ ...monitor, json_rule: { path: 'host.memory.usedPercent' } }, snapshot, now)).toBeNull()
    for (const data of [null, {}, { ...snapshot, sampledAt: 'bad' }, { ...snapshot, sampledAt: new Date(now - 31 * 60000).toISOString() }, { ...snapshot, sampledAt: new Date(now + 60000).toISOString() }, { ...snapshot, filesystems: [null] }]) {
        expect(diskDiagnosticsFor(monitor, data, now)).toBeNull()
    }
    const result = diskDiagnosticsFor(monitor, { ...snapshot, filesystems: [{ ...snapshot.filesystems[0], directories: [null, { path: 'relative', sizeBytes: 1 }, { path: '/negative', sizeBytes: -1 }, { path: '/empty', sizeBytes: 0 }] }] }, now)!
    expect(result.filesystems[0].directories).toEqual([{ path: '/empty', sizeBytes: 0 }])
})
