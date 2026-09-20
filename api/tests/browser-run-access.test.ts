import { beforeEach, expect, mock, test } from 'bun:test'
let rows: any[] = [], paid = false, validSession = true, transaction = Promise.resolve()
const queries: string[] = []
const query = async (sql: string, p: any[] = []) => {
    queries.push(sql)
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 }
    if (sql.includes('SELECT EXISTS')) return { rows: [{ paid }], rowCount: 1 }
    if (sql.includes('AS active')) {
        const owned = rows.filter(r => r.quota_identity === p[0])
        return { rows: [{ used: owned.length, active: owned.filter(r => ['running', 'unreachable'].includes(r.status) && Date.parse(r.metadata.leaseExpiresAt) > Date.now()).length }], rowCount: 1 }
    }
    if (sql.includes('INSERT INTO browser_runs')) {
        if (rows.some(r => r.id === p[0])) return { rows: [], rowCount: 0 }
        const row = { id: p[0], owner_id: p[1], quota_identity: p[2], target: p[5], network: p[6], status: 'running', metadata: JSON.parse(p[7]), created_at: new Date().toISOString() }
        rows.push(row)
        return { rows: [row], rowCount: 1 }
    }
    if (sql.includes('SELECT owner_id')) return { rows: rows.filter(r => r.id === p[0]), rowCount: 1 }
    if (sql.includes('UPDATE browser_runs')) {
        const row = rows.find(r => r.id === p[0])
        if (row && p.length > 1) { row.status = p[1]; row.metadata.leaseExpiresAt = new Date().toISOString() }
        return { rows: [], rowCount: row ? 1 : 0 }
    }
    throw new Error(`Unexpected query: ${sql}`)
}
mock.module('../src/utils/db.ts', () => ({ default: query, withTransaction: (work: (q: typeof query) => Promise<unknown>) => {
    const result = transaction.then(() => work(query))
    transaction = result.then(() => undefined, () => undefined)
    return result
} }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: false }) }))
mock.module('../src/utils/auth/session.ts', () => ({ validateSession: async () => validSession ? { user: { id: 'member' } } : null }))
const { prepareBrowserRun, finishBrowserRun, browserPaidExtensionAllowed } = await import('../src/handlers/browserSandboxRuns.ts')
const input = (id: string) => ({ id, target: 'https://example.com', network: 'regular' as const, clientId: 'browser-client-test-123456789', userId: 'member', sessionToken: 'session' })
beforeEach(() => { rows = []; paid = false; validSession = true; queries.length = 0 })
test('twelve completed runs stay available without billing consumption', async () => {
    for (let n = 0; n < 12; n++) {
        const result = await prepareBrowserRun(input(`run-${n}`))
        expect(result.allowed).toBe(true)
        expect(result.quota).toMatchObject({ limit: null, remaining: null, concurrentLimit: 1, active: 1, used: n + 1 })
        await finishBrowserRun(`run-${n}`)
    }
    expect(queries.some(sql => sql.includes('billing_usage'))).toBe(false)
})
test('simultaneous free starts admit one and closing it releases the slot', async () => {
    const results = await Promise.all([prepareBrowserRun(input('one')), prepareBrowserRun(input('two'))])
    expect(results.map(r => r.allowed)).toEqual([true, false])
    expect(results[1]).toMatchObject({ reason: 'concurrency_limit' })
    expect(queries.some(sql => sql.includes('pg_advisory_xact_lock'))).toBe(true)
    await finishBrowserRun('one')
    expect((await prepareBrowserRun(input('three'))).allowed).toBe(true)
})
test('paid users get three browsers; cancellation removes extensions', async () => {
    paid = true
    for (let n = 0; n < 3; n++) expect((await prepareBrowserRun(input(`paid-${n}`))).allowed).toBe(true)
    expect(await prepareBrowserRun(input('four'))).toMatchObject({ allowed: false, reason: 'concurrency_limit' })
    expect(await browserPaidExtensionAllowed('paid-0')).toBe(true)
    paid = false
    expect(await browserPaidExtensionAllowed('paid-0')).toBe(false)
})
test('expired crashed sessions do not permanently block browsing', async () => {
    await prepareBrowserRun(input('crashed'))
    rows[0].metadata.leaseExpiresAt = new Date(Date.now() - 1000).toISOString()
    expect((await prepareBrowserRun(input('new'))).allowed).toBe(true)
})
test('invalid credentials cannot select paid access', async () => {
    paid = true
    validSession = false
    expect((await prepareBrowserRun(input('anonymous'))).quota).toMatchObject({ paid: false, concurrentLimit: 1 })
    expect(await browserPaidExtensionAllowed('anonymous')).toBe(false)
    expect(await prepareBrowserRun({ ...input('missing'), clientId: undefined })).toMatchObject({ allowed: false, reason: 'identity_required' })
})
test('duplicate run IDs cannot overwrite history', async () => {
    await prepareBrowserRun(input('same'))
    await finishBrowserRun('same')
    expect(await prepareBrowserRun(input('same'))).toMatchObject({ allowed: false, reason: 'run_exists' })
    expect(rows).toHaveLength(1)
})
