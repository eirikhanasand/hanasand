import { beforeEach, expect, mock, test } from 'bun:test'
let authenticated = true
let administrator = true
let writes: string[] = []
let values: unknown[][] = []
let found = true
const query = async (sql: string, params: unknown[] = []) => { writes.push(sql); values.push(params); return { rows: found ? [{ id: 'svc_fixture', name: params[1] ?? 'Existing monitor', description: params[2] ?? 'Existing description' }] : [] } }
mock.module('#db', () => ({ default: query, withTransaction: async (work: any) => work(query) }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authenticated, id: 'actor' }) }))
mock.module('#utils/auth/hasRole.ts', () => ({ default: async () => ({ valid: administrator }) }))
mock.module('#utils/auth/apiKeys.ts', () => ({ createApiKey: async (input: any) => ({ apiKey: { ownerId: input.ownerId, scopes: input.scopes }, secret: 'once' }), listApiKeys: async () => [] }))
mock.module('#utils/systemEvent.ts', () => ({ recordSystemEvent: async () => {} }))
const { getServiceAccounts, postServiceAccount, patchServiceAccount, deleteServiceAccount } = await import('../src/handlers/serviceAccounts.ts')
const reply = () => ({ statusCode: 200, body: null as any, header() { return this }, status(value: number) { this.statusCode = value; return this }, send(value: any) { this.body = value; return this } })
const body = { name: 'Health monitor', scopes: [{ method: 'GET', route: '/api/service-accounts/self' }] }
beforeEach(() => { authenticated = true; administrator = true; writes = []; values = []; found = true })
test('creation rejects signed-out and non-administrative users without writes', async () => {
    for (const [auth, admin, status] of [[false, true, 401], [true, false, 403]]) {
        authenticated = Boolean(auth); administrator = Boolean(admin)
        const res = reply(); await postServiceAccount({ body } as any, res as any)
        expect(res.statusCode).toBe(status); expect(writes).toHaveLength(0)
    }
})
test('creation cannot accept a wildcard or arbitrary admin endpoint', async () => {
    const res = reply(); await postServiceAccount({ body: { ...body, scopes: [{ method: 'POST', route: '/api/role' }] } } as any, res as any)
    expect(res.statusCode).toBe(400); expect(writes).toHaveLength(0)
})
test('creation uses a separate service identity and returns the secret once', async () => {
    const res = reply(); await postServiceAccount({ body } as any, res as any)
    expect(res.statusCode).toBe(201); expect(res.body.apiKey.ownerId.startsWith('svc_')).toBe(true)
    expect(writes[0]).toContain("'service'"); expect(res.body.secret).toBe('once')
    expect(writes.some(sql => sql.includes('user_roles'))).toBe(false)
})
test('deletion revokes all credentials and retains audit identity', async () => {
    const res = reply(); await deleteServiceAccount({ params: { id: 'svc_fixture' } } as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(writes.some(sql => sql.includes('active = FALSE'))).toBe(true)
    expect(writes.some(sql => sql.includes('enabled = FALSE'))).toBe(true)
    expect(writes.some(sql => sql.includes('revoked_at = NOW()'))).toBe(true)
    expect(writes.some(sql => sql.startsWith('DELETE'))).toBe(false)
})
test('creation persists an optional description and rejects invalid descriptions', async () => {
    for (const description of [null, 123, {}, 'a'.repeat(2001)]) {
        const res = reply(); await postServiceAccount({ body: { ...body, description } } as any, res as any)
        expect(res.statusCode).toBe(400); expect(writes).toHaveLength(0)
    }
    const res = reply(); await postServiceAccount({ body: { ...body, description: '  Database monitoring\nRead-only checks.  ' } } as any, res as any)
    expect(res.statusCode).toBe(201)
    expect(writes[0]).toContain('service_description')
    expect(values[0][3]).toBe('Database monitoring\nRead-only checks.')
})
test('listing includes saved descriptions', async () => {
    const res = reply(); await getServiceAccounts({} as any, res as any)
    expect(writes[0]).toContain('service_description AS description')
    expect(res.body.accounts[0].description).toBe('Existing description')
})
test('name and description edits require a system administrator', async () => {
    for (const [auth, admin, status] of [[false, true, 401], [true, false, 403]]) {
        authenticated = Boolean(auth); administrator = Boolean(admin)
        const res = reply(); await patchServiceAccount({ params: { id: 'svc_fixture' }, body: { name: 'Updated monitor', description: 'Update' } } as any, res as any)
        expect(res.statusCode).toBe(status); expect(writes).toHaveLength(0)
    }
})
test('description edits validate text, support clearing, and only affect active service accounts', async () => {
    for (const description of [undefined, null, 1, {}, 'a'.repeat(2001)]) {
        const res = reply(); await patchServiceAccount({ params: { id: 'svc_fixture' }, body: { description } } as any, res as any)
        expect(res.statusCode).toBe(400); expect(writes).toHaveLength(0)
    }
    for (const description of ['  Updated notes  ', '', 'a'.repeat(2000)]) {
        const res = reply(); await patchServiceAccount({ params: { id: 'svc_fixture' }, body: { description } } as any, res as any)
        expect(res.statusCode).toBe(200)
        expect(values.at(-1)).toEqual(['svc_fixture', null, description.trim()])
        expect(res.body).toEqual({ id: 'svc_fixture', name: 'Existing monitor', description: description.trim() })
        expect(writes.at(-1)).toContain("account_type = 'service' AND active = TRUE")
    }
    found = false
    const res = reply(); await patchServiceAccount({ params: { id: 'user_or_missing' }, body: { description: 'No' } } as any, res as any)
    expect(res.statusCode).toBe(404)
})
test('renaming validates names and preserves credentials and omitted descriptions', async () => {
    for (const name of [null, 123, {}, '', '  ', 'a'.repeat(101)]) {
        const res = reply(); await patchServiceAccount({ params: { id: 'svc_fixture' }, body: { name, description: 'Update' } } as any, res as any)
        expect(res.statusCode).toBe(400); expect(writes).toHaveLength(0)
    }
    for (const name of ['  Renamed monitor  ', 'a'.repeat(100)]) {
        const res = reply(); await patchServiceAccount({ params: { id: 'svc_fixture' }, body: { name } } as any, res as any)
        expect(res.statusCode).toBe(200)
        expect(values.at(-1)).toEqual(['svc_fixture', name.trim(), null])
        expect(res.body).toEqual({ id: 'svc_fixture', name: name.trim(), description: 'Existing description' })
        expect(writes.at(-1)).toContain('service_description = COALESCE($3, service_description)')
    }
    const res = reply(); await patchServiceAccount({ params: { id: 'svc_fixture' }, body: { name: 'Combined edit', description: '' } } as any, res as any)
    expect(res.body).toEqual({ id: 'svc_fixture', name: 'Combined edit', description: '' })
    expect(values.at(-1)).toEqual(['svc_fixture', 'Combined edit', ''])
    expect(writes).toHaveLength(3)
    expect(writes.every(sql => sql.startsWith('UPDATE users SET name ='))).toBe(true)
    expect(writes.some(sql => /api_keys|password|tokens/.test(sql))).toBe(false)
    found = false
    const missing = reply(); await patchServiceAccount({ params: { id: 'user_or_missing' }, body: { name: 'No' } } as any, missing as any)
    expect(missing.statusCode).toBe(404)
})
