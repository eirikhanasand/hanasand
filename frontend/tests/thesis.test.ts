import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { GET, PUT } from '../src/app/api/thesis/route'
import { canEditThesis, readThesis, validThesis } from '../src/utils/thesis'

test('thesis access follows active Hanasand organization roles', async() => {
    const originalFetch = globalThis.fetch
    const roles = new Map([['org-owner', 'owner'], ['org-editor', 'editor'], ['org-reader', 'reader']])
    let stored = { title: '# Thesis', body: '', revision: 0 }
    let fail = false
    globalThis.fetch = (async(url: unknown, options?: RequestInit) => {
        const target = new URL(String(url))
        const headers = new Headers(options?.headers)
        const id = headers.get('id') || target.pathname.split('/').pop() || ''
        const token = headers.get('Authorization')?.replace(/^Bearer /, '') || ''
        if (target.pathname.includes('/auth/token/')) {
            const valid = roles.has(id) && token === `valid-${id}`
            return valid ? Response.json({ token }) : Response.json({}, { status: 401 })
        }
        if (target.pathname.endsWith('/management/organizations')) {
            const role = roles.get(id)
            return Response.json({ allowed: roles.has(id), canEdit: ['owner', 'editor'].includes(role || '') })
        }
        if (target.pathname.endsWith('/organizations')) {
            const role = roles.get(id)
            return Response.json({ organizations: role ? [{ slug: 'hanasand', lifecycleStatus: 'active', role }] : [] })
        }
        if (target.pathname.endsWith('/thesis')) {
            if (fail) return Response.json({}, { status: 500 })
            if (!roles.has(id) || token !== `valid-${id}`) return Response.json({}, { status: 401 })
            if (options?.method === 'PUT') {
                if (!['owner', 'editor'].includes(roles.get(id) || '')) return Response.json({}, { status: 403 })
                stored = { ...JSON.parse(String(options.body)), revision: stored.revision + 1 }
            }
            return Response.json(stored, { headers: { 'X-Thesis-Can-Edit': String(['owner', 'editor'].includes(roles.get(id) || '')) } })
        }
        throw new Error(`Unexpected request ${target}`)
    }) as typeof fetch

    const request = (id: string, body: unknown = { title: '# Shared **Thesis**', body: '## Foundation\n\nShared text.', revision: 0 }, origin = 'https://hanasand.com') => new NextRequest('https://hanasand.com/api/thesis', {
        method: 'PUT',
        headers: { host: 'hanasand.com', origin, 'Content-Type': 'application/json', cookie: `id=${id}; access_token=valid-${id}` },
        body: JSON.stringify(body),
    })
    const getRequest = (id: string) => new NextRequest('https://hanasand.com/api/thesis', {
        headers: { host: 'hanasand.com', cookie: `id=${id}; access_token=valid-${id}` },
    })

    try {
        assert.deepEqual(await readThesis('valid-org-owner', 'org-owner'), { title: '# Thesis', body: '', revision: 0 })
        assert.equal(await canEditThesis(), false)
        assert.equal(await canEditThesis('valid-org-owner', 'org-owner'), true)
        assert.equal(await canEditThesis('valid-org-editor', 'org-editor'), true)
        assert.equal(await canEditThesis('valid-org-reader', 'org-reader'), false)
        assert.equal((await PUT(request('org-owner', {}, 'https://attacker.example'))).status, 403)
        assert.equal((await PUT(request('org-owner', { title: '', body: '', revision: 0 }))).status, 400)
        assert.equal(validThesis({ title: '# One\n# Two', body: '', revision: 0 }), false)
        assert.equal(validThesis({ title: '# Thesis', body: 'a'.repeat(1_000_001) }), false)
        assert.equal((await PUT(request('org-reader'))).status, 403)
        assert.equal((await PUT(request('org-editor'))).status, 200)
        assert.deepEqual(await (await GET(getRequest('org-reader'))).json(), stored)
        assert.equal((await GET(getRequest('outsider'))).status, 401)
        fail = true
        assert.equal((await GET(getRequest('org-owner'))).status, 500)
        assert.equal((await PUT(request('org-owner'))).status, 500)
    } finally {
        globalThis.fetch = originalFetch
    }
})
