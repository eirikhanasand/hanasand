import { expect, mock, test } from 'bun:test'

const queries: string[] = []
mock.module('#db', () => ({
    default: async (sql: string) => {
        queries.push(sql)
        if (sql.includes('SELECT c.checked_count')) return { rows: [{ checked_count: 100, remaining: 12 }] }
        if (sql.includes('SELECT checked_count, sampled_at FROM log_throughput_samples')) return { rows: [{ checked_count: 90, sampled_at: new Date(Date.now() - 5000) }] }
        if (sql.includes('SELECT COUNT(*)::int AS count FROM service_logs')) return { rows: [{ count: 25 }] }
        if (sql.includes('WITH samples AS')) return { rows: [{ sampled_at: new Date(), pps: 2, eps: 1, historical_eps: 1, npps: 1, remaining: 12 }] }
        return { rows: [] }
    },
}))
mock.module('#utils/logs/cache.ts', () => ({ cachedLogQuery: async (_key: string, _ttl: number, load: () => Promise<unknown>) => load() }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: false }) }))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: false }) }))

const { getPublicLogMetrics } = await import('../src/handlers/logs/metrics.ts')

test('log chart history is a cached-size set of completed five-minute averages for 24 hours', async () => {
    queries.length = 0
    const reply = { body: undefined as unknown, send(body: unknown) { this.body = body; return body }, status() { return this } }
    await getPublicLogMetrics({ query: {} } as any, reply as any)

    const historyQuery = queries.find(query => query.includes('WITH samples AS'))
    expect(historyQuery).toBeDefined()
    expect(historyQuery).toContain('date_bin(INTERVAL \'5 minutes\'')
    expect(historyQuery).toContain('WHERE sampled_at >= NOW() - INTERVAL \'24 hours\'')
    expect(historyQuery).toContain('AVG(pps)')
    expect(historyQuery).toContain('AVG(eps)')
    expect(historyQuery).toContain('AVG(npps)')
    expect(historyQuery).toContain('bucket_start + INTERVAL \'5 minutes\' <= NOW()')
    expect((reply.body as any).history).toHaveLength(1)
})
