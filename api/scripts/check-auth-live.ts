import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import { queryOnce, closeDatabase } from '../src/utils/db.ts'

if (process.env.AUTH_LIVE_CHECK !== '1') throw new Error('Set AUTH_LIVE_CHECK=1 to create and clean up a temporary authentication test account')
const base = process.env.API_BASE || 'https://api.hanasand.com/api'
const id = `auth_probe_${randomUUID().replaceAll('-', '')}`
const password = randomUUID() + 'Aa1!'
let token = ''
const latencies: number[] = []
const failures: Record<string, number> = {}
async function validate(url = base) {
    const started = performance.now()
    try {
        const response = await fetch(`${url}/auth/token/${id}`, {
            headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000),
        })
        const body = await response.json()
        if (response.status !== 200 || body.id !== id || body.token !== token) throw new Error(`HTTP ${response.status}`)
        latencies.push(performance.now() - started)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures[message] = (failures[message] || 0) + 1
    }
}
try {
    await queryOnce('INSERT INTO users (id, name, password, avatar, active) VALUES ($1, $2, $3, $4, true)', [id, 'Temporary authentication rollout check', await bcrypt.hash(password, 12), ''])
    const login = await fetch(`${base}/auth/login/${id}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }), signal: AbortSignal.timeout(15_000),
    })
    const session = await login.json()
    assert.equal(login.status, 200, 'Real password login must succeed')
    assert.equal(typeof session.token, 'string')
    token = session.token
    for (const worker of (process.env.AUTH_CHECK_WORKERS || '').split(',').filter(Boolean)) await validate(`${worker}/api`)
    console.log('Authenticated rollout probe started; credentials are never printed.')
    const deadline = Date.now() + Number(process.env.AUTH_CHECK_SECONDS || 120) * 1000
    while (Date.now() < deadline) {
        await validate()
        await Bun.sleep(100)
    }
    await queryOnce('UPDATE tokens SET revoked_at = NOW() WHERE id = $1', [id])
    const revoked = await fetch(`${base}/auth/token/${id}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) })
    assert.equal(revoked.status, 401, 'Revocation must be enforced by the surviving pool')
    latencies.sort((a, b) => a - b)
    console.log(JSON.stringify({ successfulValidations: latencies.length, failures, p95Ms: Math.round(latencies[Math.floor(latencies.length * 0.95)] || 0), p99Ms: Math.round(latencies[Math.floor(latencies.length * 0.99)] || 0), revokedStatus: revoked.status }))
    assert.equal(Object.keys(failures).length, 0, 'Rollout/failover must preserve valid sessions')
} finally {
    await queryOnce('DELETE FROM tokens WHERE id = $1', [id])
    await queryOnce('DELETE FROM login_events WHERE user_id = $1', [id])
    await queryOnce('DELETE FROM attempts WHERE id = $1', [id])
    await queryOnce('DELETE FROM users WHERE id = $1', [id])
    await closeDatabase()
}
