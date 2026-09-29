// @ts-expect-error Bun provides this module when running tests.
import { afterEach, expect, mock, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
let pathname = '/logs'
let params = new URLSearchParams()
mock.module('next/navigation', () => ({ usePathname: () => pathname, useSearchParams: () => params, redirect: () => { throw new Error('Redirect') } }))
mock.module('next/headers', () => ({ cookies: async () => ({ get: (key: string) => ({ value: ({ access_token: 'session', id: 'user', impersonation_token: 'impersonation' } as Record<string, string>)[key] }) }) }))
const { getLogDashboard } = await import('../src/utils/logs/getLogs')
const { default: Page } = await import('../src/app/dashboard/logs/page')
const fetchOriginal = globalThis.fetch
const data = { rows: [], counts: [{ severity: 'low', count: 12345 }], services: [{ service: 'preloaded-service', count: 321 }], processing: { updated_at: '2026-09-24T12:00:00Z' }, generated_at: '2026-09-24T12:00:00Z', limit: 200 }
const metrics = { generated_at: '2026-09-24T12:00:00Z', current: { pps: 128.4, eps: 42.1, historical_eps: 11, npps: 0.33, remaining: 1840, thresholds: { npps_below: false, eps_above: false, pps_below: false } }, history: [] }
afterEach(() => { globalThis.fetch = fetchOriginal; params = new URLSearchParams(); pathname = '/logs' })
test('dashboard server HTML preloads public throughput metrics without log rows or credentials', async () => {
    const requests: Array<{ url: string, init?: RequestInit }> = []
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        requests.push({ url, init })
        return Response.json(metrics)
    }) as typeof fetch
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))
    expect(requests).toHaveLength(1)
    expect(new URL(requests[0].url).pathname).toMatch(/\/logs\/metrics\/public$/)
    expect(requests[0].init?.next).toEqual({ revalidate: 5 })
    expect(requests[0].init?.headers).toBeUndefined()
    expect(html).toContain('42.1')
    expect(html).not.toContain('12,345')
    expect(html).not.toContain('preloaded-service')
    expect(html).not.toContain('Bearer session')
})
test('server preload honors basic filters and legacy HQL without caching credentials', async () => {
    let query = new URLSearchParams()
    globalThis.fetch = (async (input: string | URL | Request) => { query = new URL(String(input)).searchParams; return Response.json(data) }) as typeof fetch
    await getLogDashboard({ token: 'session', id: 'user', params: { service: ['audit', 'ignored'], hours: '168', severity: 'high', table: 'HttpLogs', search: '200' } })
    expect(Object.fromEntries(query)).toEqual({ stats: '1', service: 'audit', hours: '168', severity: 'high', hql: 'HttpLogs | take 200', search: '200' })
    await getLogDashboard({ token: 'session', id: 'user', params: { kql: 'Logs | take 3', search: 'ignored' } })
    expect(query.get('hql')).toBe('Logs | take 3')
    expect(query.has('search')).toBe(false)
})
test('failed preload returns a recoverable error instead of fabricated counts', async () => {
    globalThis.fetch = (async () => Response.json({ error: 'Log search unavailable' }, { status: 503 })) as typeof fetch
    expect(await getLogDashboard({ token: 'session', id: 'user', params: {} })).toEqual({ data: null, error: 'Log search unavailable' })
})
test('Realtime server preload always requests high severity regardless of the supplied filter', async () => {
    let query = new URLSearchParams()
    globalThis.fetch = (async (input: string | URL | Request) => { query = new URL(String(input)).searchParams; return Response.json(data) }) as typeof fetch
    await getLogDashboard({ token: 'session', id: 'user', view: 'realtime', params: { severity: 'low' } })
    expect(query.get('severity')).toBe('high,critical')
    expect(query.has('stats')).toBe(false)
})
test('event retention replaces duplicate IDs when an event changes', async () => {
    const { retainEvents } = await import('../src/utils/logs/retainEvents')
    const events = ['low','medium','high','critical'].map((severity, index) => ({ id: String(index), event_timestamp: '2026-09-24T12:00:00Z', normalized: { severity } }))
    expect(retainEvents([], events).map(event => event.normalized.severity)).toEqual(['low','medium','high','critical'])
    expect(retainEvents(events, [{ ...events[2], normalized: { severity: 'low' } }]).map(event => event.normalized.severity)).toEqual(['low','medium','low','critical'])
})

test('the Realtime route leaves log loading to the client', async () => {
    pathname = '/logs/realtime'
    const { default: RealtimePage } = await import('../src/app/dashboard/logs/realtime/page')
    const requests: string[] = []
    globalThis.fetch = (async (input: string | URL | Request) => { requests.push(String(input)); return Response.json(data) }) as typeof fetch
    const html = renderToStaticMarkup(await RealtimePage({ searchParams: Promise.resolve({severity:'low'}) }))
    expect(requests).toEqual([])
    expect(html).toContain('Realtime')
    expect(html).not.toContain('event-low')
})
