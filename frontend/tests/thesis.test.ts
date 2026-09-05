import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { GET, PUT } from '../src/app/api/thesis/route'
import { canEditThesis, readThesis, validThesis } from '../src/utils/thesis'

test('thesis authorizes the account ID, forwards authenticated saves and preserves database content', async() => {
    const originalFetch = globalThis.fetch
    let stored = { title: '# Thesis', body: '' }
    let fail = false
    globalThis.fetch = (async(url: unknown, options?: RequestInit) => {
        const headers = new Headers(options?.headers)
        if (String(url).includes('/auth/token/')) {
            return headers.get('Authorization') === 'Bearer owner'
                ? Response.json({ name: 'Eirik Hanasand' })
                : Response.json({}, { status: 401 })
        }
        if (fail) return Response.json({}, { status: 500 })
        if (options?.method === 'PUT') {
            assert.equal(headers.get('id'), 'eirikhanasand')
            assert.equal(headers.get('Authorization'), 'Bearer owner')
            stored = JSON.parse(String(options.body))
            return Response.json({ saved: true })
        }
        return Response.json(stored)
    }) as typeof fetch
    const request = (token = '', id = 'eirikhanasand', body: unknown = { title: '# Shared **Thesis**', body: '## Foundation\n\nShared text.' }, origin = 'https://hanasand.com') => new NextRequest('https://hanasand.com/api/thesis', {
        method: 'PUT',
        headers: { host: 'hanasand.com', origin, 'Content-Type': 'application/json', cookie: `id=${id}; access_token=${token}; name=eirikhanasand` },
        body: JSON.stringify(body),
    })
    try {
        assert.deepEqual(await readThesis(), { title: '# Thesis', body: '' })
        assert.equal(await canEditThesis(), false)
        assert.equal(await canEditThesis('owner', 'eirikhanasand'), true)
        assert.equal(await canEditThesis('owner', 'another-user'), false)
        assert.equal((await PUT(request())).status, 403)
        assert.equal((await PUT(request('forged'))).status, 403)
        assert.equal((await PUT(request('owner', 'another-user'))).status, 403)
        assert.equal((await PUT(request('owner', 'eirikhanasand', {}, 'https://attacker.example'))).status, 403)
        assert.equal((await PUT(request('owner', 'eirikhanasand', { title: '', body: '' }))).status, 400)
        assert.equal(validThesis({ title: '# One\n# Two', body: '' }), false)
        assert.equal(validThesis({ title: '# Thesis', body: 'a'.repeat(1_000_001) }), false)
        assert.equal((await PUT(request('owner'))).status, 200)
        assert.deepEqual(await (await GET()).json(), stored)
        fail = true
        assert.equal((await GET()).status, 500)
        assert.equal((await PUT(request('owner'))).status, 500)
    } finally {
        globalThis.fetch = originalFetch
    }
})
