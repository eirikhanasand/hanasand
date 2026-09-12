// @ts-expect-error Bun provides this module when running tests.
import { beforeEach, expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { NextRequest } from 'next/server'

let product: (request: NextRequest) => Promise<Response>
let cases: (request: NextRequest) => Promise<Response>
mock.module('../src/app/api/dwm/product/route', () => ({ GET: (request: NextRequest) => product(request) }))
mock.module('../src/app/api/cases/route', () => ({ GET: (request: NextRequest) => cases(request) }))
const { loadOverview } = await import('../src/app/dashboard/overview/loadOverview')
const { default: Panel } = await import('../src/app/dashboard/overview/dwmOverviewPanel')
const snapshot = { schemaVersion: 'test', tenantId: 'org-a', watchlist: [], sourceCoverage: [] }
beforeEach(() => {
    product = async () => Response.json(snapshot)
    cases = async () => Response.json({ items: [{ status: 'open' }, { status: 'resolved' }] })
})
test('server requests retain session and organization scope and start in parallel', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    let productStarted = false
    product = async request => {
        expect(request.cookies.get('access_token')?.value).toBe('session-a')
        expect(request.nextUrl.searchParams.get('organizationId')).toBe('org-a')
        productStarted = true
        await gate
        return Response.json(snapshot)
    }
    cases = async request => {
        expect(productStarted).toBe(true)
        expect(request.cookies.get('id')?.value).toBe('user-a')
        expect(request.nextUrl.searchParams.get('organizationId')).toBe('org-a')
        release()
        return Response.json({ items: [{ status: 'open' }, { status: 'closed' }] })
    }
    const state = await loadOverview('id=user-a; access_token=session-a', 'org-a')
    expect(state).toMatchObject({ status: 'ready', openCases: 1 })
    const html = renderToStaticMarkup(createElement(Panel, { organizationId: 'org-a', state }))
    expect(html).toContain('Welcome to Hanasand')
    expect(html).not.toContain('Loading')
})
test('refreshes read fresh data and unavailable cases are not reported as zero', async () => {
    cases = async () => { throw Error('offline') }
    expect(await loadOverview('id=user-a')).toMatchObject({ status: 'ready', openCases: null })
    product = async () => Response.json({ error: { message: 'Session expired.' } }, { status: 401 })
    const state = await loadOverview('id=user-b')
    expect(state).toEqual({ status: 'error', message: 'Session expired.' })
    expect(renderToStaticMarkup(createElement(Panel, { state }))).toContain('Session expired.')
})
test('rejects data for a different organization', async () => {
    expect(await loadOverview('id=user-a', 'org-b')).toEqual({ status: 'error', message: 'Organization monitoring returned an unexpected tenant scope.' })
})

let currentPath = '/dashboard'
mock.module('next/headers', () => ({ headers: async () => new Headers({ 'x-current-path': currentPath }) }))
const { default: Loading } = await import('../src/app/loading')
test('dashboard refresh has no generic loading panel while other pages keep theirs', async () => {
    currentPath = '/dashboard'
    expect(await Loading()).toBeNull()
    currentPath = '/browser'
    expect(renderToStaticMarkup(await Loading())).toContain('Loading')
})
