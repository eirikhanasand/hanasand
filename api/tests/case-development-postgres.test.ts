import { expect, mock, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'
if (process.env.DB_HOST !== 'case-development-test-db' && !(process.env.DB_HOST === '127.0.0.1' && process.env.DB === 'case-development-test-db')) throw Error('Requires isolated case-development-test-db')
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: any) => ({ valid: req.headers['x-test-user'] !== 'anonymous', id: req.headers['x-test-user'] || 'owner' }) }))
const { queryOnce: query } = await import('../src/utils/db.ts')
const { default: schema } = await import('../src/utils/db/caseDevelopmentSchema.ts')
const handlers = await import('../src/handlers/caseDevelopment.ts')
const app = Fastify()
app.register(handlers.caseRepositoryWebhooks)
app.get('/cases/development', handlers.getCaseDevelopment)
app.get('/cases/development/commits', handlers.getCaseCommits)
app.post('/cases/development/commits', handlers.postCaseCommit)
app.get('/cases/repositories', handlers.getCaseRepositories)
app.post('/cases/repositories', handlers.postCaseRepository)
app.delete('/cases/repositories/:id', handlers.deleteCaseRepository)

test('durable signed events, idempotency, stale updates, ownership and organization access', async () => {
    await query('CREATE TABLE organizations(id text, status text); CREATE TABLE organization_members(organization_id text, user_id text, status text, role text)')
    await query('INSERT INTO organizations VALUES (\'org\',\'active\'); INSERT INTO organization_members VALUES (\'org\',\'owner\',\'active\',\'admin\'),(\'org\',\'member\',\'active\',\'member\')')
    await query('CREATE TABLE monitoring_issues(id bigint PRIMARY KEY, merged_into bigint)')
    await schema(); await schema()
    const create = await app.inject({ method: 'POST', url: '/cases/repositories', payload: { provider: 'forgejo', repositoryUrl: 'https://git.example.com/team/app' } })
    expect(create.statusCode).toBe(201)
    const connection = create.json()
    const stored = await query('SELECT secret_encrypted FROM case_repositories WHERE id=$1', [connection.id])
    expect(stored.rows[0].secret_encrypted).not.toContain(connection.secret)
    const repo = { html_url: 'https://git.example.com/team/app' }
    const send = (payload: unknown, event = 'push', secret = connection.secret) => {
        const raw = JSON.stringify(payload, null, 2)
        return app.inject({ method: 'POST', url: `/cases/repository-events/${connection.id}`, payload: raw, headers: { 'content-type': 'application/json', 'x-forgejo-event': event, 'x-forgejo-signature': createHmac('sha256', secret).update(raw).digest('hex') } })
    }
    const push = { repository: repo, ref: 'refs/heads/main', commits: [{ id: 'a'.repeat(40), message: 'Repair HA-1 and HA-10', timestamp: '2026-09-12T12:00:00Z', author: { name: 'Engineer' } }] }
    expect((await send(push, 'push', 'wrong')).statusCode).toBe(401)
    expect((await send(push)).statusCode).toBe(200)
    expect((await send(push)).statusCode).toBe(200)
    const get = (user = 'owner', suffix = '') => app.inject({ url: `/cases/development?caseId=HA-1${suffix}`, headers: { 'x-test-user': user } })
    expect((await get()).json().items).toHaveLength(1)
    expect((await get('other')).json().items).toHaveLength(0)
    expect((await get('anonymous')).statusCode).toBe(401)
    expect((await app.inject('/cases/development?caseId=HA-100')).json().items).toHaveLength(0)
    await query('INSERT INTO monitoring_issues VALUES (1,NULL),(100,1)')
    await send({ ...push, commits: push.commits.map(commit => ({ ...commit, message: 'Repair HA-100' })) })
    expect((await get()).json().items).toHaveLength(1)
    expect((await app.inject('/cases/development?caseId=HA-100')).json().items).toHaveLength(1)
    expect((await app.inject('/cases/repositories')).json().items[0].secret_encrypted).toBeUndefined()
    const pr = { number: 7, title: 'Fix HA-1', state: 'open', updated_at: '2026-09-12T12:01:00Z', user: { login: 'Engineer' } }
    expect((await send({ repository: repo, pull_request: pr }, 'pull_request')).statusCode).toBe(200)
    expect((await send({ repository: repo, pull_request: { ...pr, state: 'closed', merged: true, updated_at: '2026-09-12T12:02:00Z' } }, 'pull_request')).statusCode).toBe(200)
    await send({ repository: repo, pull_request: pr }, 'pull_request')
    expect((await get()).json().items[0].state).toBe('merged')
    await send({ repository: repo, pull_request: { ...pr, title: 'No case reference', updated_at: '2026-09-12T12:03:00Z' } }, 'pull_request')
    expect((await get()).json().items).toHaveLength(1)
    const unrelated = { id: 'b'.repeat(40), message: 'Unrelated change', timestamp: '2026-09-12T13:00:00Z', author: { name: 'Engineer' } }
    await send({ ...push, commits: [unrelated] })
    const commitsUrl = `/cases/development/commits?repositoryId=${connection.id}`
    expect((await app.inject(commitsUrl)).json().items).toHaveLength(2)
    expect((await app.inject(`${commitsUrl}&search=UNRELATED`)).json().items.map((item: any) => item.external_id)).toEqual([unrelated.id])
    expect((await app.inject(`${commitsUrl}&search=Engineer`)).json().items).toHaveLength(2)
    expect((await app.inject(`${commitsUrl}&search=${unrelated.id}`)).json().items).toHaveLength(1)
    expect((await app.inject(`${commitsUrl}&search=%25_`)).json().items).toHaveLength(0)
    expect((await app.inject({ url: commitsUrl, headers: { 'x-test-user': 'other' } })).statusCode).toBe(404)
    const link = (user = 'owner', hash = unrelated.id, suffix = '') => app.inject({ method: 'POST', url: `/cases/development/commits${suffix}`, headers: { 'x-test-user': user }, payload: { repositoryId: connection.id, commit: hash, caseId: 'HA-1' } })
    expect((await link('other')).statusCode).toBe(403)
    expect((await link('owner', 'c'.repeat(40))).statusCode).toBe(404)
    expect((await link()).statusCode).toBe(200)
    expect((await link()).statusCode).toBe(200)
    await send({ ...push, commits: [unrelated] })
    expect((await get()).json().items).toHaveLength(2)
    expect((await query('SELECT manual_case_references FROM case_development WHERE external_id=$1', [unrelated.id])).rows[0].manual_case_references).toEqual(['HA-1'])
    // Personal links remain private even when their owner opens an organization case.
    expect((await get('owner', '&organizationId=org')).json().items).toHaveLength(2)
    expect((await get('member', '&organizationId=org')).json().items).toHaveLength(0)
    expect((await app.inject({ method: 'DELETE', url: `/cases/repositories/${connection.id}`, headers: { 'x-test-user': 'other' } })).statusCode).toBe(404)
    expect((await get('other', '&organizationId=org')).statusCode).toBe(403)
    expect((await app.inject({ method: 'POST', url: '/cases/repositories?organizationId=org', headers: { 'x-test-user': 'member' }, payload: { provider: 'github', repositoryUrl: 'https://github.com/team/app' } })).statusCode).toBe(403)
    await query('UPDATE case_repositories SET organization_id=$2 WHERE id=$1', [connection.id, 'org'])
    expect((await get('member', '&organizationId=org')).json().items).toHaveLength(2)
    expect((await link('member', unrelated.id, '?organizationId=org')).statusCode).toBe(403)
    await query('UPDATE organization_members SET status=\'removed\' WHERE user_id=\'member\'')
    expect((await get('member', '&organizationId=org')).statusCode).toBe(403)
    expect((await app.inject({ method: 'DELETE', url: `/cases/repositories/${connection.id}?organizationId=org` })).statusCode).toBe(200)
    expect((await query('SELECT * FROM case_development')).rows).toHaveLength(0)
})

test('indexed history pagination, repository isolation and persistent manual linking', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'case-commits-'))
    const previous = process.env.CASE_COMMITS_PATH
    process.env.CASE_COMMITS_PATH = join(directory, 'commits.json')
    try {
        const repositoryUrl = 'https://github.com/team/indexed'
        const commits = Array.from({ length: 205 }, (_, index) => ({ external_id: index.toString(16).padStart(40, '0'), title: `Indexed ${index}`, author: 'Engineer', updated_at: '2026-09-21T00:00:00Z' }))
        await writeFile(process.env.CASE_COMMITS_PATH, JSON.stringify({ revision: commits[0].external_id, repositories: [repositoryUrl], commits }))
        const connection = (await app.inject({ method: 'POST', url: '/cases/repositories', payload: { provider: 'github', repositoryUrl } })).json()
        const url = `/cases/development/commits?repositoryId=${connection.id}`
        const first = (await app.inject(url)).json()
        expect(first.items).toHaveLength(100)
        expect((await app.inject(`${url}&search=INDEXED%20204`)).json().items).toEqual([commits[204]])
        expect((await app.inject(`${url}&search=${'x'.repeat(201)}`)).statusCode).toBe(400)
        const second = (await app.inject(`${url}&cursor=${first.nextCursor}`)).json()
        expect(second.items[0]).toEqual(commits[100])
        const last = (await app.inject(`${url}&cursor=${second.nextCursor}`)).json()
        expect(last.items).toHaveLength(5)
        expect(last.nextCursor).toBeNull()
        expect((await app.inject(`${url}&cursor=${'f'.repeat(40)}`)).statusCode).toBe(409)
        expect((await app.inject({ url, headers: { 'x-test-user': 'other' } })).statusCode).toBe(404)
        const other = (await app.inject({ method: 'POST', url: '/cases/repositories', payload: { provider: 'github', repositoryUrl: 'https://github.com/team/other' } })).json()
        expect((await app.inject(`/cases/development/commits?repositoryId=${other.id}`)).json().items).toHaveLength(0)
        const payload = { repositoryId: connection.id, caseId: 'HA-49441', commit: commits[104].external_id }
        expect((await app.inject({ method: 'POST', url: '/cases/development/commits', payload })).statusCode).toBe(200)
        const linked = (await app.inject('/cases/development?caseId=HA-49441')).json().items
        expect(linked).toHaveLength(1)
        expect(linked[0].url).toBe(`${repositoryUrl}/commit/${commits[104].external_id}`)
    } finally {
        if (previous === undefined) delete process.env.CASE_COMMITS_PATH
        else process.env.CASE_COMMITS_PATH = previous
        await rm(directory, { recursive: true })
    }
})
