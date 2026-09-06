import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { recoveryReadOnly, recoveryRequestAllowed } from '../src/utils/resilience.ts'
const root = mkdtempSync(join(tmpdir(), 'hanasand-recovery-'))
process.env.RESILIENCE_STATE_FILE = join(root, 'state.json')
try {
    assert.equal(recoveryReadOnly(), true, 'Missing state must fail closed')
    writeFileSync(process.env.RESILIENCE_STATE_FILE, JSON.stringify({ readOnly: true, updatedAt: new Date().toISOString() }))
    await Bun.sleep(1010)
    assert.equal(recoveryRequestAllowed('GET', '/api/organizations/one'), true)
    assert.equal(recoveryRequestAllowed('POST', '/api/ti/search'), true)
    assert.equal(recoveryRequestAllowed('POST', '/api/auth/login/one'), false)
    assert.equal(recoveryRequestAllowed('DELETE', '/api/organizations/one'), false)
    assert.equal(recoveryRequestAllowed('GET', '/api/auth/logout/one'), false)
    process.env.RESILIENCE_ESSENTIAL_ONLY = '1'
    assert.equal(recoveryRequestAllowed('GET', '/api/vms'), false)
    assert.equal(recoveryRequestAllowed('GET', '/api/ws/pwned/one'), false)
    writeFileSync(process.env.RESILIENCE_STATE_FILE, JSON.stringify({ readOnly: false, updatedAt: new Date(0).toISOString() }))
    await Bun.sleep(1010)
    assert.equal(recoveryReadOnly(), true, 'Stale state must fail closed')
    writeFileSync(process.env.RESILIENCE_STATE_FILE, JSON.stringify({ readOnly: false, updatedAt: new Date().toISOString() }))
    await Bun.sleep(1010)
    assert.equal(recoveryRequestAllowed('POST', '/api/auth/login/one'), true)
    console.log('Recovery preserves reads/search, blocks mutations and host workloads, fails closed on missing/stale status, and resumes login after recovery.')
} finally { delete process.env.RESILIENCE_STATE_FILE; delete process.env.RESILIENCE_ESSENTIAL_ONLY; rmSync(root, { recursive: true }) }
