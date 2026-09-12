import { expect, test, mock } from 'bun:test'
import config from '../src/constants.ts'
let deleted = false
mock.module('../src/utils/db.ts', () => ({ default: async () => ({ rows: deleted ? [{ name: 'keepalive-test' }] : [] }), withDatabaseAdvisoryLock: async (_key: string, work: () => Promise<unknown>) => work() }))
const { applyAlwaysRunning } = await import('../src/utils/vms/ensureAlwaysRunning.ts')
import { setLxdRequestForTest, setVmDetailsWriterForTest } from '../src/utils/vms/lxd.ts'

test('keepalive applies boot and idle policies, starts a stopped instance, and can be disabled', async () => {
    let status = 'Stopped'
    let settings: Record<string, string> = { 'limits.cpu': '1' }
    let starts = 0
    const restoreWriter = setVmDetailsWriterForTest(async () => {})
    const restore = setLxdRequestForTest(async <T>(path: string, options: { method?: string, body?: unknown } = {}) => {
        if (options.method === 'PATCH') settings = (options.body as { config: Record<string, string> }).config
        if (options.method === 'PUT' && path.endsWith('/state')) { starts++; status = 'Running' }
        const metadata = path.includes('/operations') ? {} : path.endsWith('/state') ? { status } : { name: 'keepalive-test', status, config: settings }
        return { status_code: 200, status: 'Success', metadata: metadata as T }
    })
    try {
        const vm = { name: 'keepalive-test', primary_host: config.vm_host_id }
        await applyAlwaysRunning(vm, true)
        expect(settings).toMatchObject({ 'limits.cpu': '1', 'boot.autostart': 'true', 'user.hanasand.always_running': 'true' })
        expect(starts).toBe(1)
        await applyAlwaysRunning(vm, true)
        expect(starts).toBe(1)
        await applyAlwaysRunning(vm, false)
        expect(settings['boot.autostart']).toBe('false')
        expect(settings['user.hanasand.always_running']).toBe('false')
        await expect(applyAlwaysRunning({ ...vm, primary_host: 'wrong-host' }, true)).rejects.toThrow('primary host')
        deleted = true
        await expect(applyAlwaysRunning(vm, true)).rejects.toThrow('scheduled for deletion')
        expect(starts).toBe(1)
    } finally { restore(); restoreWriter() }
})
