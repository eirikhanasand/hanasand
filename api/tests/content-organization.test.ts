import { beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

let user: string | null = 'member'
let role = 'editor'
let active = true
let legacyAdmin = false
let shareOrganization: string | null = 'hanasand'
let writes: Array<{ sql: string, params: unknown[] }> = []
let queries: Array<{ sql: string, params: unknown[] }> = []
const share = () => ({ id: 'code', path: 'code', content: 'hello', owner: 'anonymous', organization_id: shareOrganization, parent: '', alias: 'code', type: 'file', locked: false })
mock.module('../src/utils/db.ts', () => ({ default: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    if (sql.startsWith('SELECT content_organization_access')) return { rows: [{ allowed: active && params[0] === 'hanasand' && params[1] === 'member' && (!params[2] || ['owner', 'admin', 'editor'].includes(role)) }] }
    if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) {
        writes.push({ sql, params })
        return { rows: [{ ...share(), created_by: 'member' }] }
    }
    if (sql.includes('FROM share')) return { rows: [share()] }
    if (sql.includes('FROM thoughts')) return { rows: [{ id: 1, title: 'Why?', created_by: 'author', organization_id: 'hanasand' }] }
    if (sql.includes('FROM notes')) return { rows: [{ id: 'note', owner_id: 'author', organization_id: 'hanasand' }] }
    if (sql.includes('FROM article_ownership')) return { rows: [{ id: 'example.md', organization_id: 'hanasand', owner_id: null }] }
    throw new Error(`Unexpected query: ${sql}`)
} }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: { headers: Record<string, string> }) => {
    if (user) req.headers.id = user
    return { valid: Boolean(user), id: user }
} }))
mock.module('../src/utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: legacyAdmin }) }))
mock.module('../src/utils/auth/session.ts', () => ({ validateSession: async () => user ? { user: { id: user } } : null }))
mock.module('../src/utils/git/git.ts', () => ({ ARTICLES_DIR: '/article-fixture', ensureRepo: async () => {} }))
mock.module('../src/utils/git/ensureRepositoryUpToDate.ts', () => ({ default: async () => {} }))
mock.module('../src/utils/git/fileExists.ts', () => ({ default: async () => true }))
mock.module('../src/utils/git/createdAt.ts', () => ({ default: async () => '2025-01-01' }))
mock.module('../src/utils/git/updatedAt.ts', () => ({ default: async () => '2025-01-01' }))
mock.module('fs/promises', () => ({ readdir: async () => ['example.md'], stat: async () => ({ size: 10, isFile: () => true }), readFile: async () => '# Example' }))

const shares = await import('../src/handlers/share.ts')
const notes = await import('../src/handlers/notes.ts')
const { default: postThought } = await import('../src/handlers/thoughts/post.ts')
const { default: getThoughts } = await import('../src/handlers/thoughts/getThoughts.ts')
const { default: getArticles, getArticle } = await import('../src/handlers/articles/get.ts')
const app = Fastify()
app.get('/share/user/:id', shares.getUserShares)
app.get('/share/:id', shares.getShare)
app.post('/share', shares.postShare)
app.put('/share/:id', shares.putShare)
app.delete('/share/:id', shares.deleteShare)
app.get('/share/lock/:id', shares.toggleShareLock)
app.get('/notes', notes.getNotes)
app.post('/notes', notes.postNote)
app.put('/notes/:id', notes.putNote)
app.delete('/notes/:id', notes.deleteNote)
app.post('/thoughts', postThought)
app.get('/thoughts', getThoughts)
app.get('/articles', getArticles)
app.get('/article/:id', getArticle)
const headers = { authorization: 'Bearer test-session', id: 'member', 'x-organization-id': 'hanasand' }
beforeEach(() => { user = 'member'; role = 'editor'; active = true; legacyAdmin = false; shareOrganization = 'hanasand'; writes = []; queries = [] })

test('public shares, articles and thoughts stay readable without a session', async () => {
    user = null
    for (const url of ['/share/code', '/articles', '/article/example', '/thoughts']) {
        const response = await app.inject({ url })
        expect(response.statusCode).toBe(200)
        expect(response.body).toContain('hanasand')
    }
    expect(writes).toEqual([])
})
test('organization lists verify membership; forged scope and removed membership fail closed', async () => {
    for (const url of ['/share/user/member', '/notes', '/articles?workspace=true', '/thoughts?workspace=true']) {
        expect((await app.inject({ url, headers })).statusCode).toBe(200)
        expect((await app.inject({ url, headers: { ...headers, 'x-organization-id': 'another-org' } })).statusCode).toBe(403)
        active = false
        expect((await app.inject({ url, headers })).statusCode).toBe(403)
        active = true
    }
})
test('personal lists explicitly exclude organization content', async () => {
    await app.inject({ url: '/notes', headers: { id: 'member', authorization: 'Bearer test-session' } })
    expect(queries.at(-1)?.sql).toContain('organization_id IS NULL AND owner_id = $1')
    await app.inject({ url: '/share/user/member', headers: { id: 'member', authorization: 'Bearer test-session' } })
    expect(queries.at(-1)?.sql).toContain('organization_id IS NULL AND owner = $1')
    const response = await app.inject({ url: '/articles?workspace=true' })
    expect(response.json()).toEqual([])
})
test('organization share writes and locks reject readers, anonymous users and stale membership', async () => {
    for (const state of ['reader', 'anonymous', 'removed']) {
        role = state === 'reader' ? 'reader' : 'editor'; user = state === 'anonymous' ? null : 'member'; active = state !== 'removed'
        for (const method of ['PUT', 'DELETE', 'GET'] as const) {
            const response = await app.inject({ method, url: method === 'GET' ? '/share/lock/code' : '/share/code', headers, ...(method === 'PUT' ? { payload: { content: 'changed' } } : {}) })
            expect(response.statusCode).toBe(403)
        }
        expect((await app.inject({ method: 'POST', url: '/share', headers, payload: { id: 'code', content: 'changed' } })).statusCode).toBe(403)
    }
    expect(writes).toEqual([])
})
test('organization editors can edit shares, while anonymous legacy shares preserve their behavior', async () => {
    expect((await app.inject({ method: 'PUT', url: '/share/code', headers, payload: { content: 'changed' } })).statusCode).toBe(200)
    shareOrganization = null; user = null
    expect((await app.inject({ method: 'PUT', url: '/share/code', payload: { content: 'legacy edit' } })).statusCode).toBe(200)
})
test('new organization notes and thoughts retain verified authors and selected organization', async () => {
    expect((await app.inject({ method: 'POST', url: '/notes', headers, payload: { title: 'Plan', content: 'Work' } })).statusCode).toBe(201)
    expect(writes.at(-1)?.params).toEqual(['member', 'Plan', 'Work', 'api', 'hanasand'])
    expect((await app.inject({ method: 'POST', url: '/thoughts', headers, payload: { title: 'Why?', id: 'spoofed-author' } })).statusCode).toBe(201)
    expect(writes.at(-1)?.params).toEqual(['Why?', 'member', 'hanasand'])
    role = 'reader'; writes = []
    expect((await app.inject({ method: 'POST', url: '/notes', headers, payload: { title: 'Plan' } })).statusCode).toBe(403)
    expect((await app.inject({ method: 'POST', url: '/thoughts', headers, payload: { title: 'Why?' } })).statusCode).toBe(403)
    expect(writes).toEqual([])
})
test('note mutations enforce organization write access in the actual SQL, not the original author', async () => {
    await app.inject({ method: 'PUT', url: '/notes/note', headers, payload: { title: 'Updated' } })
    await app.inject({ method: 'DELETE', url: '/notes/note', headers })
    for (const write of writes) {
        expect(write.sql).toContain('CASE WHEN organization_id IS NULL THEN owner_id =')
        expect(write.sql).toContain('content_organization_access(organization_id,')
        expect(write.sql).toContain('TRUE) END')
    }
})
