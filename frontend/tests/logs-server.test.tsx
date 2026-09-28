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
afterEach(() => { globalThis.fetch = fetchOriginal; params = new URLSearchParams(); pathname = '/logs' })
test('server HTML contains counts and services before any client code runs', async () => {
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/logs/search?')) {
            expect(init?.cache).toBe('no-store')
            expect(init?.headers).toEqual({ id: 'user', Authorization: 'Bearer session', 'x-impersonation-token': 'impersonation' })
            expect(new URL(url).searchParams.get('stats')).toBe('1')
            return Response.json(data)
        }
        return Response.json(url.includes('/logs/services') ? { services: [] } : { summary: { total: 42 }, errors: [] })
    }) as typeof fetch
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))
    expect(html).toContain('12,345')
    expect(html).toContain('preloaded-service')
    expect(html).toContain('321')
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
test('Realtime server preload includes normal traffic regardless of a severity query parameter', async () => {
    let query = new URLSearchParams()
    globalThis.fetch = (async (input: string | URL | Request) => { query = new URL(String(input)).searchParams; return Response.json(data) }) as typeof fetch
    await getLogDashboard({ token: 'session', id: 'user', view: 'realtime', params: { severity: 'low' } })
    expect(query.has('severity')).toBe(false)
    expect(query.has('stats')).toBe(false)
})
test('Realtime retains all severities, including downgraded updates', async () => {
    const { retainEvents } = await import('../src/utils/logs/retainEvents')
    const events = ['low','medium','high','critical'].map((severity, index) => ({ id: String(index), event_timestamp: '2026-09-24T12:00:00Z', normalized: { severity } }))
    expect(retainEvents([], events).map(event => event.normalized.severity)).toEqual(['low','medium','high','critical'])
    expect(retainEvents(events, [{ ...events[2], normalized: { severity: 'low' } }]).map(event => event.normalized.severity)).toEqual(['low','medium','low','critical'])
})

test('the Realtime route seeds HTML with normal traffic', async () => {
    pathname = '/logs/realtime'
    const { default: RealtimePage } = await import('../src/app/dashboard/logs/realtime/page')
    globalThis.fetch = (async (input: string | URL | Request) => {
        if (!String(input).includes('/logs/search?')) return Response.json({ services: [], summary: { total: 0 }, errors: [] })
        expect(new URL(String(input)).searchParams.has('severity')).toBe(false)
        return Response.json({ ...data, rows: ['low','medium','high','critical'].map(severity => ({id:severity,event_timestamp:data.generated_at,normalized:{severity,service:'test',message:`event-${severity}`,level:'info',log_type:'ApplicationLogs'}})) })
    }) as typeof fetch
    const html = renderToStaticMarkup(await RealtimePage({ searchParams: Promise.resolve({severity:'low'}) }))
    expect(html).toContain('event-low')
    expect(html).toContain('event-medium')
    expect(html).toContain('event-high')
    expect(html).toContain('event-critical')
})
