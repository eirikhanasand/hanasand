import { strict as assert } from 'node:assert'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { GET, PUT } from '../src/app/api/thesis/route'
import { canEditThesis, readThesis, validThesis } from '../src/utils/thesis'
import { test } from 'node:test'

test('shared thesis enforces owner writes, validates input and persists public Markdown', async() => {
    const directory = await mkdtemp(path.join(tmpdir(), 'thesis-test-'))
    const originalDirectory = process.env.PROMPT_PORTAL_STATE_DIR
    const originalFetch = globalThis.fetch
    process.env.PROMPT_PORTAL_STATE_DIR = directory
    globalThis.fetch = (async(_url: unknown, options?: RequestInit) => {
        const token = new Headers(options?.headers).get('Authorization')
        if (token === 'Bearer owner') return Response.json({ name: 'eirikhanasand' })
        if (token === 'Bearer reader') return Response.json({ name: 'another-user' })
        return Response.json({}, { status: 401 })
    }) as typeof fetch
    const request = (token = '', body: unknown = { title: '# Shared **Thesis**', body: '## Foundation\n\nShared text.' }, origin = 'https://hanasand.com') => new NextRequest('https://hanasand.com/api/thesis', {
        method: 'PUT',
        headers: { host: 'hanasand.com', origin, 'Content-Type': 'application/json', cookie: `id=test; access_token=${token}; name=eirikhanasand` },
        body: JSON.stringify(body),
    })
    try {
        assert.deepEqual(await readThesis(), { title: '# Thesis', body: '' })
        assert.equal(await canEditThesis(), false)
        assert.equal((await PUT(request())).status, 403)
        assert.equal((await PUT(request('forged'))).status, 403)
        assert.equal((await PUT(request('reader'))).status, 403)
        assert.equal((await PUT(request('owner', {}, 'https://attacker.example'))).status, 403)
        assert.equal((await PUT(request('owner', {}, 'invalid'))).status, 403)
        assert.equal((await PUT(request('owner', { title: '', body: '' }))).status, 400)
        assert.equal(validThesis({ title: '# One\n# Two', body: '' }), false)
        assert.equal(validThesis({ title: '# Thesis', body: 'a'.repeat(1_000_001) }), false)
        assert.equal((await PUT(request('owner'))).status, 200)
        const response = await GET()
        assert.equal(response.headers.get('Cache-Control'), 'no-store')
        assert.deepEqual(await response.json(), { title: '# Shared **Thesis**', body: '## Foundation\n\nShared text.' })
        assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'thesis.json'), 'utf8')), await readThesis())
        await writeFile(path.join(directory, 'thesis.json'), 'broken')
        assert.equal((await GET()).status, 500)
    } finally {
        globalThis.fetch = originalFetch
        if (originalDirectory === undefined) delete process.env.PROMPT_PORTAL_STATE_DIR
        else process.env.PROMPT_PORTAL_STATE_DIR = originalDirectory
        await rm(directory, { recursive: true, force: true })
    }
})

