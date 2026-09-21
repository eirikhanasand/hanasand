import { expect, test } from 'bun:test'
import { browserAccess, browserStartOptions } from '../src/utils/ws/browserAccess.ts'

test('free browsing stays available with one five-minute browser', () => {
    for (const plan of ['free', 'anonymous', 'unknown', 'constructor', '__proto__']) {
        expect(browserAccess(plan)).toEqual({ paid: false, concurrentLimit: 1, sessionSeconds: 300, advancedAnalysis: false })
    }
})
test('current and legacy subscriptions retain paid access', () => {
    for (const [plan, slots] of Object.entries({ browser: 3, starter: 3, team: 5, business: 10, volume: 20 })) {
        expect(browserAccess(plan)).toEqual({ paid: true, concurrentLimit: slots, sessionSeconds: 1800, advancedAnalysis: true })
    }
})
test('client flags cannot buy analysis, extensions or longer sessions', () => {
    const options = browserStartOptions({ type: 'start', durationSeconds: 99999, durationMinutes: 999, profileTools: [{ id: 'triage' }], paidAuthorized: true, paid: true }, browserAccess('free'))
    expect(options.durationSeconds).toBe(300)
    expect(options.durationMinutes).toBeUndefined()
    expect(options.profileTools).toEqual([])
    expect(options.paidAuthorized).toBe(false)
})
test('paid runs allow tools and clamp duration, including malformed requests', () => {
    const access = browserAccess('browser')
    expect(browserStartOptions({ durationMinutes: 60, profileTools: [{ id: 'triage' }] }, access)).toMatchObject({ durationSeconds: 1800, profileTools: [{ id: 'triage' }] })
    expect(browserStartOptions({ durationSeconds: 120 }, access).durationSeconds).toBe(120)
    for (const value of [undefined, -1, 'invalid', Infinity]) expect(browserStartOptions({ durationSeconds: value }, access).durationSeconds).toBe(1800)
    expect(browserStartOptions({ durationSeconds: 1, profileTools: 'invalid' }, access)).toMatchObject({ durationSeconds: 60, profileTools: [] })
})


test('browser leases tolerate transient failures but close before the persisted lease expires', async () => {
    const { browserLeaseHeartbeat, BrowserLeaseExpiredError } = await import('../src/utils/ws/browserLease.ts')
    let now = 0, lost = 0, failure: Error | null = null
    const beat = browserLeaseHeartbeat(async () => { if (failure) throw failure }, () => lost++, () => now)
    now = 30_000
    await beat()
    failure = new Error('Connection terminated unexpectedly')
    now = 60_000
    await beat()
    expect(lost).toBe(0)
    failure = null
    now = 90_000
    await beat()
    expect(lost).toBe(0)
    failure = new Error('Database unavailable')
    for (now of [120_000, 150_000]) await beat()
    expect(lost).toBe(0)
    now = 180_000
    await beat()
    await beat()
    expect(lost).toBe(1)
    const expired = browserLeaseHeartbeat(async () => { throw new BrowserLeaseExpiredError('expired') }, () => lost++, () => now)
    await expired()
    expect(lost).toBe(2)
})

test('a hung renewal cannot keep a session alive beyond its safe deadline', async () => {
    const { browserLeaseHeartbeat } = await import('../src/utils/ws/browserLease.ts')
    let now = 0, lost = 0, calls = 0, resolve!: () => void
    const pending = new Promise<void>(done => { resolve = done })
    const beat = browserLeaseHeartbeat(() => { calls++; return pending }, () => lost++, () => now)
    const first = beat()
    now = 30_000
    await beat()
    expect(calls).toBe(1)
    now = 90_000
    await beat()
    expect(lost).toBe(1)
    resolve()
    await first
    await beat()
    expect(lost).toBe(1)
})

test('free SOC triage includes built-in providers but not arbitrary paid tools', () => {
    const tools = [
        { id: 'virustotal', url: 'https://www.virustotal.com/gui/search/{url}' },
        { id: 'urlquery', url: 'https://urlquery.net/search?q={url}' },
        { id: 'webcrack', url: 'https://webcrack.netlify.app/' },
    ]
    expect(browserStartOptions({ profileTools: [...tools, { id: 'virustotal', url: 'https://other.example/' }] }, browserAccess('free')).profileTools).toEqual(tools)
})
