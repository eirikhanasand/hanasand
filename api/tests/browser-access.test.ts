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
