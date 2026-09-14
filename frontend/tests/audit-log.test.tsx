import { expect, mock, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDashboardNavigation, navigationLinks } from '../src/utils/layout/dashboardNavigation'

mock.module('next/headers', () => ({ cookies: async () => ({ get: (name: string) => ({ value: name === 'id' ? 'admin' : 'test-token' }) }) }))
const { default: AuditLogPage } = await import('../src/app/dashboard/management/audit/page')

test('audit navigation belongs to Management and remains administrator-only', () => {
    const access = { id: 'admin', isAdmin: true, canManageSystem: true, canManageContent: true }
    const links = navigationLinks(getDashboardNavigation(access))
    expect(links.find(link => link.href === '/management/audit')?.ancestors).toEqual(['Administration', 'Management'])
    expect(links.some(link => link.href === '/ti/audit')).toBe(false)
    expect(navigationLinks(getDashboardNavigation({ ...access, isAdmin: false })).some(link => link.href === '/management/audit')).toBe(false)
})

test('shared audit renders service, event and object fields and retains filters and displays the matching total', async () => {
    const originalFetch = globalThis.fetch
    let requested = ''
    globalThis.fetch = (async (url: string | URL | Request) => {
        requested = String(url)
        return Response.json({ events: [{ id: 12, created_at: '2026-09-13T12:00:00Z', service: 'compute', actor_id: 'admin', event_type: 'vm.restart', object_id: 'cashflow', outcome: 'success' }], pagination: { nextCursor: 'next', total: 125 } })
    }) as typeof fetch
    try {
        const html = renderToStaticMarkup(await AuditLogPage({ searchParams: Promise.resolve({ service: 'compute' }) }))
        expect(requested).toContain('/system/events?')
        expect(requested).toContain('service=compute')
        expect(html).toContain('vm.restart')
        expect(html).toContain('cashflow')
        expect(html).toContain('compute')
        expect(html).toContain('1/125')
        expect(html).toContain('Load 50 more')
        expect(requested).not.toContain('page=')
        expect(html).not.toContain('/ti/domains')
    } finally { globalThis.fetch = originalFetch }
})
