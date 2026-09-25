import { afterAll, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { recoveryRequestAllowed, supportFailoverActive } from '../src/utils/recovery.ts'

const directory = mkdtempSync(join(tmpdir(), 'support-failover-'))
const original = { ...process.env }
const path = join(directory, 'state.json')
async function state(services: unknown, overrides = {}) {
    writeFileSync(path, JSON.stringify({ site: 'ovhcloud', readOnly: false, updatedAt: new Date().toISOString(), services, ...overrides }))
    await Bun.sleep(1050)
}
afterAll(() => {
    for (const key of ['RECOVERY_STATE_FILE', 'RECOVERY_ESSENTIAL_ONLY', 'RECOVERY_SITE', 'SUPPORT_SERVICE_BASE', 'SUPPORT_SERVICE_KEY']) {
        if (original[key] === undefined) delete process.env[key]
        else process.env[key] = original[key]
    }
    rmSync(directory, { recursive: true })
})

test('support follows active placement, fails closed, and leaves unrelated recovery routes restricted', async () => {
    process.env.RECOVERY_STATE_FILE = path
    process.env.RECOVERY_ESSENTIAL_ONLY = '1'
    process.env.RECOVERY_SITE = 'ovhcloud'
    const active = [{ id: 'api', activeSite: 'ovhcloud', status: 'failed_over' }]
    const allowed = () => ['GET', 'POST'].every(method => recoveryRequestAllowed(method, '/api/support/chat'))
    await state([{ id: 'api', activeSite: 'inspur', status: 'up' }])
    expect(allowed()).toBe(false)
    await state(active)
    expect(allowed()).toBe(true)
    expect(recoveryRequestAllowed('POST', '/api/support/tickets/id/status')).toBe(true)
    expect(recoveryRequestAllowed('GET', '/api/ws/support')).toBe(true)
    expect(recoveryRequestAllowed('POST', '/api/support-admin')).toBe(false)
    expect(recoveryRequestAllowed('POST', '/api/ai/deployments')).toBe(false)
    expect(process.env.RECOVERY_ESSENTIAL_ONLY).toBe('1')
    await state([{ id: 'frontend', activeSite: 'ovhcloud', status: 'failed_over' }])
    expect(allowed()).toBe(true)
    for (const overrides of [{ readOnly: true }, { site: 'inspur' }, { updatedAt: new Date(0).toISOString() }]) {
        await state(active, overrides)
        expect(allowed()).toBe(false)
        expect(recoveryRequestAllowed('GET', '/api/ws/support')).toBe(false)
    }
    process.env.SUPPORT_SERVICE_BASE = 'http://127.0.0.1:19181'
    process.env.SUPPORT_SERVICE_KEY = 'a'.repeat(64)
    await state(active, { readOnly: true })
    expect(allowed()).toBe(true)
    expect(recoveryRequestAllowed('GET', '/api/ws/support')).toBe(true)
    expect(recoveryRequestAllowed('POST', '/api/ai/deployments')).toBe(false)
    await state({ invalid: true })
    expect(supportFailoverActive()).toBe(false)
    await state([{ id: 'api', activeSite: 'ovhcloud', status: 'unavailable' }])
    expect(allowed()).toBe(false)
    await state([{ id: 'api', activeSite: 'inspur', status: 'up' }])
    expect(allowed()).toBe(false)
    delete process.env.RECOVERY_ESSENTIAL_ONLY
    expect(allowed()).toBe(true)
}, 15000)
