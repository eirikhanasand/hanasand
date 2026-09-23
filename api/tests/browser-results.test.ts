import { beforeEach, expect, mock, test } from 'bun:test'
import { browserResultId } from '../src/utils/ws/browserResultIdentity.ts'

let userId = 'owner'
const records = [
    { id: 'new', target: 'https://vg.no', owner_id: 'owner', created_at: '2026-09-23T12:00:00Z', status: 'ended' },
    { id: 'old', target: 'https://vg.no', owner_id: 'owner', created_at: '2026-01-01T12:00:00Z', status: 'ended' },
]
let inserted: unknown[] = []
let historyQuery: { sql: string; params: any[] } | null = null
mock.module('#db', () => ({ default: async (sql: string, params: any[]) => {
    if (sql.includes('quota_identity = $1')) return { rows: [{ used: 0, active: 0 }] }
    if (sql.includes('LIMIT 51 OFFSET')) {
        historyQuery = { sql, params }
        return { rows: Array.from({ length: params.at(-1) === 0 ? 51 : 2 }, (_, index) => ({ ...records[0], id: String(index + params.at(-1)) })) }
    }
    if (sql.includes('INSERT INTO browser_run_evidence')) { inserted = params; return { rows: [] } }
    if (sql.includes('WHERE result_id')) {
        expect(sql).toContain('owner_id = $2 OR client_id_hash = $3')
        return { rows: records.filter(row => row.owner_id === params[1] && browserResultId(row.target) === params[0]) }
    }
    if (sql.includes('SELECT metadata')) return { rows: [{ metadata: { report: { analystSummary: { narrative: 'Saved analysis' } } } }] }
    if (sql.includes('SELECT payload')) return { rows: [{ payload: { type: 'frame', image: 'saved-image', url: 'https://vg.no/', evidence: { textExcerpt: 'Full captured text', sourceCode: '<main>Full source</main>' } } }] }
    throw new Error(sql)
}, withTransaction: async () => {} }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: Boolean(userId), id: userId }) }))
const { getBrowserRuns, getBrowserResult, buildStoredBrowserReport, persistBrowserRunEvidence } = await import('../src/handlers/browserSandboxRuns.ts')
const response = () => ({ code: 200, body: null as any, status(code: number) { this.code = code; return this }, header() { return this }, send(body: any) { this.body = body; return this } })
beforeEach(() => { userId = 'owner'; inserted = [] })

test('equivalent URLs have one stable identity; paths and queries remain distinct', () => {
    expect(browserResultId('https://vg.no/')).toBe('979b6683-b76b-87fc-95e8-02baa94ae619')
    expect(browserResultId('https://VG.no:443')).toBe(browserResultId('https://vg.no/'))
    expect(browserResultId('vg.no')).toBe(browserResultId('https://vg.no/'))
    expect(browserResultId('https://vg.no/a')).not.toBe(browserResultId('https://vg.no/b'))
    expect(browserResultId('https://vg.no/?a=1')).not.toBe(browserResultId('https://vg.no/?a=2'))
})
test('latest and older runs load without expiry, with stored screenshots and text', async () => {
    for (const run of [undefined, 'old']) {
        const res = response()
        await getBrowserResult({ params: { id: browserResultId('https://vg.no/') }, query: { run }, log: { error: console.error } } as any, res as any)
        expect(res.code).toBe(200)
        expect(res.body.runId).toBe(run || 'new')
        expect(res.body.runs).toHaveLength(2)
        expect(res.body.captures[0]).toMatchObject({ image: 'data:image/jpeg;base64,saved-image', evidence: { textExcerpt: 'Full captured text', sourceCode: '<main>Full source</main>' } })
    }
})
test('knowing the stable URL ID does not grant access to another user’s runs', async () => {
    userId = 'other'
    const res = response()
    await getBrowserResult({ params: { id: browserResultId('https://vg.no') }, query: {}, log: { error: console.error } } as any, res as any)
    expect(res.code).toBe(404)
})
test('a version from outside the accessible URL history is rejected', async () => {
    const res = response()
    await getBrowserResult({ params: { id: browserResultId('https://vg.no') }, query: { run: 'foreign' }, log: { error: console.error } } as any, res as any)
    expect(res.code).toBe(404)
})
test('archive retains all screenshots and untruncated text independently of client report limits', async () => {
    const text = 'Long line\n'.repeat(2000)
    const events = [...Array.from({ length: 35 }, (_, index) => ({ type: 'frame', image: String(index), url: 'https://vg.no/', evidence: { textExcerpt: text } })), { type: 'console', text, level: 'info' }]
    const report = buildStoredBrowserReport(records[0], { captures: [] }, events, records)
    expect(report.captures).toHaveLength(35)
    expect(report.consoleEvents[0]).toBe(`[info] ${text}`)
    await persistBrowserRunEvidence('new', events[0])
    expect(JSON.parse(String(inserted[1])).evidence.textExcerpt).toBe(text)
    inserted = []
    await persistBrowserRunEvidence('new', { type: 'stream_ready', streamUrl: 'private capability' })
    expect(inserted).toHaveLength(0)
})


test('full history includes repeated URLs, paginates and keeps client ownership filtering', async () => {
    userId = ''
    for (const offset of ['0', '50']) {
        const res = response()
        await getBrowserRuns({ query: { clientId: 'history-test-client', history: 'all', offset }, log: { error: console.error } } as any, res as any)
        expect(res.code).toBe(200)
        expect(res.body.runs).toHaveLength(offset === '0' ? 50 : 2)
        expect(res.body.nextOffset).toBe(offset === '0' ? 50 : null)
        expect(historyQuery!.sql).toContain('WHERE client_id_hash = $1')
        expect(historyQuery!.sql).not.toContain('DISTINCT')
        expect(historyQuery!.params[0]).not.toBe('history-test-client')
    }
    const invalid = response()
    await getBrowserRuns({ query: { clientId: 'history-test-client', history: 'all', offset: '-1' }, log: { error: console.error } } as any, invalid as any)
    expect(invalid.code).toBe(400)
})
