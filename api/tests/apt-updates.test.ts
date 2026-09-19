import { expect, test, mock, afterAll } from 'bun:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = await mkdtemp(join(tmpdir(), 'apt-updates-'))
process.env.APT_UPDATE_STATUS_PATH = join(directory, 'inspur.json')
process.env.OVH_HOST_METRICS_PATH = join(directory, 'ovh.json')
const queries: Array<{ sql: string, params: unknown[] }> = []
let rows: unknown[] = []
let readOnly = false
mock.module('../src/utils/resilience.ts', () => ({ recoveryReadOnly: () => readOnly }))
mock.module('#db', () => ({ default: async (sql: string, params: unknown[] = []) => { queries.push({ sql, params }); return { rows } } }))
let authenticated = true
let admin = true
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authenticated }) }))
mock.module('#utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: admin }) }))
const { readHostUpdateStatus, persistHostUpdateStatus, listHostUpdateHistory } = await import('../src/utils/aptUpdates.ts')
const { getAptUpdates } = await import('../src/handlers/aptUpdates.ts')
afterAll(() => rm(directory, { recursive: true, force: true }))

test('host data and history are separate and stale telemetry is not healthy', async () => {
    const status = { run_id: 'same-run', status: 'pending', checked_at: new Date().toISOString() }
    await writeFile(process.env.APT_UPDATE_STATUS_PATH!, JSON.stringify(status))
    await writeFile(process.env.OVH_HOST_METRICS_PATH!, JSON.stringify({ sampledAt: new Date().toISOString(), aptUpdates: { ...status, status: 'ok' } }))
    expect((await readHostUpdateStatus()).status.status).toBe('pending')
    expect((await readHostUpdateStatus('ovhcloud')).status.status).toBe('ok')
    for (const host of ['inspur', 'ovhcloud'] as const) {
        queries.length = 0
        await persistHostUpdateStatus(status, status.run_id, host)
        await listHostUpdateHistory(host)
        expect(queries.map(query => query.params.at(-1))).toEqual(Array(3).fill(host === 'inspur' ? 'hanasand' : host))
    }
    for (const snapshot of [{ sampledAt: '2000-01-01', aptUpdates: status }, { sampledAt: new Date().toISOString() }, { sampledAt: new Date().toISOString(), aptUpdates: { ...status, checked_at: '2000-01-01' } }]) {
        await writeFile(process.env.OVH_HOST_METRICS_PATH!, JSON.stringify(snapshot))
        expect(await readHostUpdateStatus('ovhcloud')).toMatchObject({ status: { status: 'unknown' }, runId: null })
    }
})

test('host allowlist and system administrator authorization are enforced', async () => {
    const invoke = async (host: unknown) => {
        let code = 200
        const reply = { status(value: number) { code = value; return this }, send() {} }
        await getAptUpdates({ query: { host } } as never, reply as never)
        return code
    }
    queries.length = 0
    expect(await invoke('../../other')).toBe(400)
    authenticated = false
    expect(await invoke('ovhcloud')).toBe(401)
    authenticated = true; admin = false
    expect(await invoke('ovhcloud')).toBe(403)
    admin = true
    expect(queries).toHaveLength(0)
    expect(await invoke('inspur')).toBe(200)
})

test('OVH standby reads host-scoped replicated snapshots without writing', async () => {
    const prior = process.env.RESILIENCE_SITE
    try {
        process.env.RESILIENCE_SITE = 'ovhcloud'
        for (const host of ['inspur', 'ovhcloud'] as const) {
            const status = { status: 'ok', run_id: host, checked_at: new Date().toISOString() }
            rows = [{ payload: status }]; queries.length = 0
            expect((await readHostUpdateStatus(host)).runId).toBe(host)
            await persistHostUpdateStatus(status, host, host)
            expect(queries).toHaveLength(1)
            expect(queries[0].params).toEqual([host === 'inspur' ? 'hanasand' : host])
        }
        process.env.RESILIENCE_SITE = 'inspur'; readOnly = true; queries.length = 0
        await persistHostUpdateStatus({ status: 'ok' }, 'run')
        expect(queries).toHaveLength(0)
    } finally {
        if (prior === undefined) delete process.env.RESILIENCE_SITE
        else process.env.RESILIENCE_SITE = prior
        rows = []; readOnly = false
    }
})
