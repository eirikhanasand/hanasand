import assert from 'node:assert/strict'
import { afterEach, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { PrivacyLifecyclePanel } from '../src/app/organizations/organizationWorkspaceClient'

const originalFetch = globalThis.fetch
const originalApi = process.env.FRONTEND_AUTH_API

mock.module('next/headers', () => ({ cookies: async() => ({ get: () => undefined }) }))

afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalApi === undefined) delete process.env.FRONTEND_AUTH_API
    else process.env.FRONTEND_AUTH_API = originalApi
})

test('renders real retention results and keeps deletion confirmation gated', () => {
    const html = renderToStaticMarkup(createElement(PrivacyLifecyclePanel, {
        organization: { id: 'org_render', name: 'Rendered Organization', slug: 'rendered' },
        privacy: {
            runs: [{ id: 'run_render', status: 'completed', deleted_count: 4, redacted_count: 2, protected_count: 1, failed_count: 0, completed_at: '2026-07-22T10:00:00.000Z' }],
            requests: [{ status: 'completed' }],
            protection: { explanation: 'One legal-held record remains protected.' },
            permissions: { canExport: true, canRunRetention: true, canRequestDeletion: true },
        },
        retentionDays: 30,
        canManage: true,
        busy: '',
        onRun: () => undefined,
        onExport: () => undefined,
        onDelete: () => undefined,
    }))

    assert.match(html, /30 day policy/)
    assert.match(html, /One legal-held record remains protected\./)
    assert.match(html, />4<\/p>/)
    assert.match(html, />2<\/p>/)
    assert.match(html, />1<\/p>/)
    assert.match(html, /data-org-privacy-delete-confirmation="true"/)
    assert.match(html, /type="password" autoComplete="current-password"[^>]*data-org-privacy-delete-password="true"/)
    assert.match(html, /disabled=""[^>]*>[\s\S]*?Request deletion<\/button>/)
})

test('authenticated privacy action proxy forwards the real request and result', async() => {
    process.env.FRONTEND_AUTH_API = 'http://privacy-api.test/api'
    let upstream = {}
    globalThis.fetch = async(input, init) => {
        upstream = { url: String(input), init }
        return Response.json({ worker: { runId: 'run_proxy', hasMore: true } }, { status: 202 })
    }
    const { POST } = await import('../src/app/api/organizations/[id]/privacy/route')
    const body = JSON.stringify({ action: 'delete', requestId: 'request_proxy', confirmation: 'Rendered Organization', currentPassword: 'current password' })
    const response = await POST(new NextRequest('http://frontend.test/api/organizations/org/privacy', {
        method: 'POST',
        headers: { authorization: 'Bearer session-token', id: 'user_proxy' },
        body,
    }), { params: Promise.resolve({ id: 'org/proxy' }) })

    assert.equal(response.status, 202)
    assert.deepEqual(await response.json(), { worker: { runId: 'run_proxy', hasMore: true } })
    assert.equal(upstream.url, 'http://privacy-api.test/api/organizations/org%2Fproxy/privacy')
    assert.equal(upstream.init?.method, 'POST')
    assert.equal(upstream.init?.body, body)
    assert.equal(new Headers(upstream.init?.headers).get('authorization'), 'Bearer session-token')
})
